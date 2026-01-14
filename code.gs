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
 * Saves a bill entry to the "History" sheet.
 */
function saveBill(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("History");

  if (!sheet) {
    sheet = ss.insertSheet("History");
    sheet.appendRow([
      "Date",
      "Month",
      "Kahramaa",
      "Ooredoo",
      "Other",
      "Total",
      "Avg Share",
      "Housemates Count",
      "Housemates JSON"
    ]);
  }

  const date = new Date();
  const housemates = data.housemates || [];

  sheet.appendRow([
    date,
    data.month,
    data.kahramaa,
    data.ooredoo,
    data.other,
    data.total,
    data.sharePerPerson,
    housemates.length,
    JSON.stringify(housemates)
  ]);

  return "Bill saved successfully!";
}

/**
 * Deletes a history entry based on date and month.
 */
function deleteHistoryItem(dateIsoStr, monthStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("History");
  if (!sheet) return "Sheet not found";

  const data = sheet.getDataRange().getValues();

  // Iterate backwards to safely delete without messing up indices
  for (let i = data.length - 1; i >= 1; i--) {
    let rowDate = data[i][0];
    let rowMonth = data[i][1];

    // Normalize date to string for comparison
    let rowDateStr = "";
    if (rowDate instanceof Date) {
      rowDateStr = rowDate.toISOString();
    } else {
      rowDateStr = String(rowDate);
    }

    // Normalize month to string
    let rowMonthStr = String(rowMonth);
    // Handle case where month cell might be a date object
    if (rowMonth instanceof Date) {
        const y = rowMonth.getFullYear();
        const m = String(rowMonth.getMonth() + 1).padStart(2, '0');
        rowMonthStr = `${y}-${m}`;
    }

    // Check for match
    // We check if the passed ISO string matches
    if (rowDateStr === dateIsoStr && rowMonthStr === monthStr) {
      sheet.deleteRow(i + 1); // deleteRow is 1-indexed
      return "Record deleted successfully!";
    }
  }

  throw new Error("Item not found in database. It may have already been deleted.");
}

/**
 * Retrieves history data for the frontend.
 */
function getHistory() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("History");

  if (!sheet) return [];

  // Use getDataRange to safely get all data present in the sheet
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  // If only headers or empty
  if (values.length < 2) return [];

  // Remove header row
  const data = values.slice(1);

  const history = data.map(row => {
    // Safety check for row length

    let housemates = [];
    if (row.length > 8 && row[8]) {
      try {
        const jsonString = String(row[8]);
        if (jsonString.trim().startsWith("[")) {
           housemates = JSON.parse(jsonString);
        }
      } catch (e) {
        Logger.log("Error parsing housemates JSON: " + e);
        housemates = [];
      }
    }

    let dateStr = "";
    try {
      if (row[0] instanceof Date) {
        dateStr = row[0].toISOString();
      } else {
        dateStr = String(row[0]);
      }
    } catch (e) {
      dateStr = "";
    }

    let monthStr = row[1];
    if (monthStr instanceof Date) {
      const y = monthStr.getFullYear();
      const m = String(monthStr.getMonth() + 1).padStart(2, '0');
      monthStr = `${y}-${m}`;
    } else {
      monthStr = String(monthStr || "");
    }

    return {
      date: dateStr,
      month: monthStr,
      kahramaa: Number(row[2]) || 0,
      ooredoo: Number(row[3]) || 0,
      other: Number(row[4]) || 0,
      total: Number(row[5]) || 0,
      sharePerPerson: Number(row[6]) || 0,
      housemateCount: Number(row[7]) || 0,
      housemates: housemates
    };
  }).filter(item => item.month);

  return history.reverse(); // Newest first
}