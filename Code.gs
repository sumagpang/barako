function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Bill Splitter')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- Setup ---

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheets = ['Housemates', 'BillTypes', 'Bills', 'Allocations'];
  sheets.forEach(name => {
    if (!ss.getSheetByName(name)) {
      ss.insertSheet(name);
    }
  });

  // Setup Housemates Headers
  const shHouse = ss.getSheetByName('Housemates');
  if (shHouse.getLastRow() === 0) {
    shHouse.appendRow(['ID', 'Name', 'MoveInDate', 'MoveOutDate']);
  }

  // Setup BillTypes Headers
  const shTypes = ss.getSheetByName('BillTypes');
  if (shTypes.getLastRow() === 0) {
    shTypes.appendRow(['Type']);
  }

  // Setup Bills Headers
  const shBills = ss.getSheetByName('Bills');
  if (shBills.getLastRow() === 0) {
    shBills.appendRow(['ID', 'Timestamp', 'BillType', 'Amount', 'StartDate', 'EndDate']);
  }

  // Setup Allocations Headers
  const shAlloc = ss.getSheetByName('Allocations');
  if (shAlloc.getLastRow() === 0) {
    shAlloc.appendRow(['BillID', 'HousemateID', 'Name', 'Amount', 'DaysActive']);
  }
}

// --- Helpers ---

function _getUuid() {
  return Utilities.getUuid();
}

function _getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function _dateFromStr(str) {
  if (!str) return null;
  // Handle if it's already a Date object (Apps Script sometimes auto-converts)
  if (str instanceof Date) return str;
  // If it matches YYYY-MM-DD, parse as local date to avoid UTC shifts
  if (typeof str === 'string' && str.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const parts = str.split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  return new Date(str);
}

// --- API ---

function getInitialData() {
  const housemates = _getSheetData('Housemates').map(h => ({
    id: h.ID,
    name: h.Name,
    moveIn: h.MoveInDate ? _formatDateForClient(h.MoveInDate) : null,
    moveOut: h.MoveOutDate ? _formatDateForClient(h.MoveOutDate) : null
  }));

  const billTypes = _getSheetData('BillTypes').map(t => t.Type);

  return { housemates, billTypes };
}

function _formatDateForClient(val) {
  const d = _dateFromStr(val);
  if (!d) return null;
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function saveHousemate(form, id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Housemates');
  const data = sheet.getDataRange().getValues();

  const newRow = [
    id || _getUuid(),
    form.name,
    form.moveIn,
    form.moveOut || ''
  ];

  let found = false;
  // If updating
  if (id) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == id) {
        sheet.getRange(i + 1, 1, 1, 4).setValues([newRow]);
        found = true;
        break;
      }
    }
  }

  if (!found) {
    sheet.appendRow(newRow);
  }
}

function addBillType(type) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('BillTypes');
  // Check dupes
  const data = _getSheetData('BillTypes');
  if (data.find(d => d.Type === type)) return;

  sheet.appendRow([type]);
}

function calculatePreview(bill) {
  const housemates = _getSheetData('Housemates');
  // Parse inputs as local dates
  const start = _dateFromStr(bill.start);
  const end = _dateFromStr(bill.end);
  const amount = parseFloat(bill.amount);

  // Calculate total days in period
  const totalBillDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;

  let dailyTotals = new Array(totalBillDays).fill(0);
  let housemateStats = {}; // { id: { daysActive: 0, cost: 0 } }

  housemates.forEach(h => {
    housemateStats[h.ID] = { name: h.Name, daysActive: 0, cost: 0, id: h.ID };
  });

  const dailyCost = amount / totalBillDays;

  for (let i = 0; i < totalBillDays; i++) {
    let currentDay = new Date(start);
    currentDay.setDate(start.getDate() + i);

    let activeHousemates = [];

    housemates.forEach(h => {
      const moveIn = _dateFromStr(h.MoveInDate);
      const moveOut = _dateFromStr(h.MoveOutDate);

      let isActive = true;
      // Compare time values to ensure safety
      if (moveIn && moveIn.getTime() > currentDay.getTime()) isActive = false;
      if (moveOut && moveOut.getTime() < currentDay.getTime()) isActive = false;

      if (isActive) {
        activeHousemates.push(h.ID);
      }
    });

    if (activeHousemates.length > 0) {
      const share = dailyCost / activeHousemates.length;
      activeHousemates.forEach(hid => {
        housemateStats[hid].daysActive++;
        housemateStats[hid].cost += share;
      });
    } else {
      // Warning: Days with 0 people. Who pays?
      // In this simple model, it remains unallocated or falls to owner.
      // For now, let's ignore or maybe return a warning.
    }
  }

  const allocations = Object.values(housemateStats)
    .filter(h => h.daysActive > 0)
    .map(h => ({
      housemateId: h.id,
      name: h.name,
      daysActive: h.daysActive,
      amount: h.cost
    }));

  return {
    totalDays: totalBillDays,
    allocations: allocations,
    totalAllocated: allocations.reduce((sum, a) => sum + a.amount, 0)
  };
}

function saveBill(bill, preview) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const billId = _getUuid();
  const timestamp = new Date();

  // Save Bill
  const billsSheet = ss.getSheetByName('Bills');
  billsSheet.appendRow([
    billId,
    timestamp,
    bill.type,
    bill.amount,
    bill.start,
    bill.end
  ]);

  // Save Allocations
  const allocSheet = ss.getSheetByName('Allocations');
  const allocData = preview.allocations.map(a => [
    billId,
    a.housemateId,
    a.name,
    a.amount,
    a.daysActive
  ]);

  if (allocData.length > 0) {
    // Write in bulk
    allocSheet.getRange(allocSheet.getLastRow() + 1, 1, allocData.length, 5).setValues(allocData);
  }

  return true;
}

function getHistory() {
  const bills = _getSheetData('Bills');
  const allocations = _getSheetData('Allocations');

  // Group by Month (YYYY-MM based on Bill Start Date or just Date Recorded? Usually Bill Date)
  // Let's use StartDate for grouping.

  const history = {};

  bills.forEach(b => {
    // b.StartDate might be string or Date
    const d = _dateFromStr(b.StartDate);
    if (!d) return;
    const key = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM');

    if (!history[key]) {
      history[key] = { total: 0, bills: [], housemateTotals: {} };
    }

    history[key].total += Number(b.Amount);
    history[key].bills.push({
      id: b.ID,
      type: b.BillType,
      amount: Number(b.Amount),
      start: b.StartDate,
      end: b.EndDate
    });
  });

  // Aggregate housemate totals per month
  allocations.forEach(a => {
    const bill = bills.find(b => b.ID == a.BillID);
    if (!bill) return;

    const d = _dateFromStr(bill.StartDate);
    const key = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM');

    if (history[key]) {
      if (!history[key].housemateTotals[a.Name]) {
        history[key].housemateTotals[a.Name] = 0;
      }
      history[key].housemateTotals[a.Name] += Number(a.Amount);
    }
  });

  // Sort keys desc
  const sortedHistory = {};
  Object.keys(history).sort().reverse().forEach(k => sortedHistory[k] = history[k]);

  return sortedHistory;
}
