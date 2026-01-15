/**
 * Serves the HTML file when the web app is visited.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('FairShare')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Saves the current list of housemates to the "Housemates" sheet.
 * Overwrites existing list.
 */
function saveHousemates(housematesList) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Housemates");

  if (!sheet) {
    sheet = ss.insertSheet("Housemates");
    sheet.appendRow(["Name"]); // Header
  }

  // Clear existing content
  sheet.clear();
  sheet.appendRow(["Name"]);

  if (housematesList && housematesList.length > 0) {
    // Map list to 2D array for setValues
    const rows = housematesList.map(name => [name]);
    sheet.getRange(2, 1, rows.length, 1).setValues(rows);
  }

  return "Housemates list saved successfully!";
}

/**
 * Retrieves the list of housemates from the "Housemates" sheet.
 */
function getHousemates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Housemates");

  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  return values.map(row => row[0]).filter(name => name !== "");
}

/**
 * Saves the bill configuration to the "Settings" sheet.
 * Stores keys and values.
 */
function saveBillTypes(types) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Settings");

  if (!sheet) {
    sheet = ss.insertSheet("Settings");
    sheet.appendRow(["Key", "Value"]);
  }

  // We want to update the BILL_TYPES row or create it
  // Simple approach: Clear and rewrite all settings (for now only BILL_TYPES)
  // Or scan for Key.
  // Given simplicity, let's just use the second row for BILL_TYPES always for now.
  // Better: find row by key.

  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === "BILL_TYPES") {
      rowIndex = i + 1; // 1-based
      break;
    }
  }

  const json = JSON.stringify(types);

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 2).setValue(json);
  } else {
    sheet.appendRow(["BILL_TYPES", json]);
  }

  return "Bill types saved successfully!";
}

/**
 * Retrieves the bill types from Settings.
 */
function getBillTypes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Settings");

  // Default types
  const defaults = [
    {name: 'Kahramaa', color: '#3b82f6'},
    {name: 'Ooredoo', color: '#ef4444'},
    {name: 'Other', color: '#9ca3af'}
  ];

  if (!sheet) return defaults;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === "BILL_TYPES") {
      try {
        const val = data[i][1];
        if (val) return JSON.parse(val);
      } catch (e) {
        Logger.log("Error parsing Bill Types: " + e);
      }
    }
  }

  return defaults;
}

/**
 * Saves a bill entry to the "History_v2" sheet.
 * If "History" (legacy) exists, we leave it alone.
 */
function saveBill(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("History_v2");

  if (!sheet) {
    sheet = ss.insertSheet("History_v2");
    sheet.appendRow([
      "Date",
      "Month",
      "Total",
      "Avg Share",
      "Housemates Count",
      "Housemates JSON",
      "Bill Details JSON"
    ]);
  }

  const date = new Date();
  const housemates = data.housemates || [];
  const billDetails = data.billDetails || [];

  sheet.appendRow([
    date,
    data.month,
    data.total,
    data.sharePerPerson,
    housemates.length,
    JSON.stringify(housemates),
    JSON.stringify(billDetails)
  ]);

  return "Bill saved successfully!";
}

/**
 * Deletes a history entry based on date and month.
 * Checks both History_v2 and History.
 */
function deleteHistoryItem(dateIsoStr, monthStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Try v2 first
  const sheetV2 = ss.getSheetByName("History_v2");
  let deleted = false;
  if (sheetV2) {
      deleted = deleteFromSheet(sheetV2, dateIsoStr, monthStr);
  }

  // Try legacy
  if (!deleted) {
      const sheetLegacy = ss.getSheetByName("History");
      if (sheetLegacy) {
          deleted = deleteFromSheet(sheetLegacy, dateIsoStr, monthStr);
      }
  }

  if (deleted) return "Record deleted successfully!";
  throw new Error("Item not found in database.");
}

function deleteFromSheet(sheet, dateIsoStr, monthStr) {
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    let rowDate = data[i][0];
    let rowMonth = data[i][1];

    let rowDateStr = "";
    if (rowDate instanceof Date) rowDateStr = rowDate.toISOString();
    else rowDateStr = String(rowDate);

    let rowMonthStr = String(rowMonth);
    if (rowMonth instanceof Date) {
        const y = rowMonth.getFullYear();
        const m = String(rowMonth.getMonth() + 1).padStart(2, '0');
        rowMonthStr = `${y}-${m}`;
    }

    if (rowDateStr === dateIsoStr && rowMonthStr === monthStr) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

/**
 * Retrieves history data for the frontend.
 * Merges "History" and "History_v2".
 */
function getHistory() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let history = [];

  // 1. Process Legacy "History"
  const sheetLegacy = ss.getSheetByName("History");
  if (sheetLegacy) {
     history = history.concat(processHistorySheet(sheetLegacy, true));
  }

  // 2. Process New "History_v2"
  const sheetV2 = ss.getSheetByName("History_v2");
  if (sheetV2) {
     history = history.concat(processHistorySheet(sheetV2, false));
  }

  return history.reverse(); // Newest first
}

function processHistorySheet(sheet, forceLegacyMode) {
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  if (values.length < 2) return [];

  const headers = values[0];
  // Determine schema if not forced
  // Legacy has "Kahramaa" at index 2
  const isOldSchema = forceLegacyMode || (headers.length > 2 && headers[2] === "Kahramaa");

  const data = values.slice(1);

  return data.map(row => {
    let housemates = [];
    let billDetails = [];

    const parseJSON = (str) => {
        try {
            const s = String(str).trim();
            if (s.startsWith("[")) return JSON.parse(s);
        } catch(e) {}
        return [];
    };

    if (isOldSchema) {
        const k = Number(row[2]) || 0;
        const o = Number(row[3]) || 0;
        const oth = Number(row[4]) || 0;
        billDetails = [
            {name: 'Kahramaa', amount: k},
            {name: 'Ooredoo', amount: o},
            {name: 'Other', amount: oth}
        ];
        housemates = parseJSON(row[8]);

        return {
          date: formatDate(row[0]),
          month: formatMonth(row[1]),
          total: Number(row[5]) || 0,
          sharePerPerson: Number(row[6]) || 0,
          housemateCount: Number(row[7]) || 0,
          housemates: housemates,
          billDetails: billDetails
        };
    } else {
        housemates = parseJSON(row[5]);
        billDetails = parseJSON(row[6]);

        return {
          date: formatDate(row[0]),
          month: formatMonth(row[1]),
          total: Number(row[2]) || 0,
          sharePerPerson: Number(row[3]) || 0,
          housemateCount: Number(row[4]) || 0,
          housemates: housemates,
          billDetails: billDetails
        };
    }
  }).filter(item => item.month);
}

// Helpers
function formatDate(val) {
    try {
      if (val instanceof Date) return val.toISOString();
      return String(val);
    } catch (e) { return ""; }
}

function formatMonth(val) {
    if (val instanceof Date) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }
    return String(val || "");
}
