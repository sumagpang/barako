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

function calculatePreview(month, amount) {
  const housemates = _getSheetData('Housemates');
  // Parse inputs as local dates from Month string "YYYY-MM"
  const parts = month.split('-');
  const start = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
  const end = new Date(Number(parts[0]), Number(parts[1]), 0); // Last day of month

  // Calculate total days in period
  const totalBillDays = end.getDate(); // Simple for full months

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
    totalAllocated: allocations.reduce((sum, a) => sum + a.amount, 0),
    startDate: Utilities.formatDate(start, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    endDate: Utilities.formatDate(end, Session.getScriptTimeZone(), 'yyyy-MM-dd')
  };
}

function saveBill(month, items, preview) {
  // items: [{type: 'Ooredoo', amount: 100}, ...]
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const billId = _getUuid(); // Shared ID for all items in this batch
  const timestamp = new Date();

  // Calculate Start/End based on month for record keeping
  const parts = month.split('-');
  const start = Utilities.formatDate(new Date(Number(parts[0]), Number(parts[1]) - 1, 1), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const end = Utilities.formatDate(new Date(Number(parts[0]), Number(parts[1]), 0), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  // Save Bills (Multiple rows, same ID)
  const billsSheet = ss.getSheetByName('Bills');
  const billRows = items.map(item => [
    billId,
    timestamp,
    item.type,
    item.amount,
    start,
    end
  ]);

  if (billRows.length > 0) {
     billsSheet.getRange(billsSheet.getLastRow() + 1, 1, billRows.length, 6).setValues(billRows);
  }

  // Save Allocations (One set for the whole batch)
  const allocSheet = ss.getSheetByName('Allocations');
  const allocData = preview.allocations.map(a => [
    billId,
    a.housemateId,
    a.name,
    a.amount,
    a.daysActive
  ]);

  if (allocData.length > 0) {
    allocSheet.getRange(allocSheet.getLastRow() + 1, 1, allocData.length, 5).setValues(allocData);
  }

  return true;
}

function deleteBillGroup(billId) {
   const ss = SpreadsheetApp.getActiveSpreadsheet();
   const billsSheet = ss.getSheetByName('Bills');
   const allocSheet = ss.getSheetByName('Allocations');

   // Helper to delete rows by matching value in column 1 (ID)
   // Warning: Deleting rows shifts indices. Must delete from bottom up.
   const deleteByVal = (sheet) => {
     const data = sheet.getDataRange().getValues();
     // Start from last row
     for (let i = data.length - 1; i >= 1; i--) {
       if (data[i][0] == billId) {
         sheet.deleteRow(i + 1);
       }
     }
   };

   deleteByVal(billsSheet);
   deleteByVal(allocSheet);

   return true;
}

function getHistory() {
  const bills = _getSheetData('Bills');
  const allocations = _getSheetData('Allocations');

  const history = {};

  // Group by Bill ID first, then by Month
  const groups = {};

  bills.forEach(b => {
    if (!groups[b.ID]) {
       groups[b.ID] = {
         id: b.ID,
         items: [],
         total: 0,
         start: b.StartDate,
         end: b.EndDate,
         allocations: []
       };
    }
    groups[b.ID].items.push({ type: b.BillType, amount: Number(b.Amount) });
    groups[b.ID].total += Number(b.Amount);
  });

  // Add allocations
  allocations.forEach(a => {
    if (groups[a.BillID]) {
      groups[a.BillID].allocations.push({
        name: a.Name,
        amount: Number(a.Amount),
        days: a.DaysActive
      });
    }
  });

  // Convert groups to history object (key by Month)
  Object.values(groups).forEach(g => {
    const d = _dateFromStr(g.start);
    if (!d) return;
    const key = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM');

    if (!history[key]) {
      history[key] = { records: [] };
    }
    history[key].records.push(g);
  });

  // Sort
  const sortedHistory = {};
  Object.keys(history).sort().reverse().forEach(k => sortedHistory[k] = history[k]);

  return sortedHistory;
}
