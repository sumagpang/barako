/**
 * Database.js - Handles all Google Sheets interactions
 *
 * Sheets required:
 * - Users (columns: id, username, password, expirationDate, status, syncStatus, mobile, planId, balance, macAddress)
 * - Plans (columns: id, name, price, duration, speedLimit)
 * - Transactions (columns: id, userId, amount, type, status, date, refId)
 * - Announcements (columns: id, content, enabled, date)
 * - Settings (columns: key, value)
 */

class Database {
  constructor() {
    this.ss = null;
    try {
      const ssId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
      if (ssId) {
        this.ss = SpreadsheetApp.openById(ssId);
      } else {
        this.ss = SpreadsheetApp.getActiveSpreadsheet();
      }
    } catch (e) {
      console.warn("Could not open spreadsheet. Make sure SPREADSHEET_ID is set or script is bound to a sheet.");
    }
  }

  getSheet(name) {
    if (!this.ss) throw new Error("Spreadsheet not initialized. Please run Initial Setup.");
    let sheet = this.ss.getSheetByName(name);
    if (!sheet) {
      throw new Error(`Sheet "${name}" not found. Please run Initial Setup.`);
    }
    return sheet;
  }

  getData(sheetName) {
    const sheet = this.getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    return data.map((row, index) => {
      const obj = { _row: index + 2 };
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });
  }

  addRow(sheetName, data) {
    const sheet = this.getSheet(sheetName);
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) return false;
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const row = headers.map(header => data[header] || "");
    sheet.appendRow(row);
    return true;
  }

  updateRow(sheetName, rowNumber, data) {
    const sheet = this.getSheet(sheetName);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const range = sheet.getRange(rowNumber, 1, 1, headers.length);
    const values = [headers.map(header => data.hasOwnProperty(header) ? data[header] : range.getCell(1, headers.indexOf(header) + 1).getValue())];
    range.setValues(values);
    return true;
  }

  deleteRow(sheetName, rowNumber) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      const sheet = this.getSheet(sheetName);
      sheet.deleteRow(rowNumber);
      return true;
    } finally {
      lock.releaseLock();
    }
  }

  findByField(sheetName, field, value) {
    const data = this.getData(sheetName);
    return data.find(item => item[field] == value);
  }

  getSetting(key, defaultValue = "") {
    try {
      const settings = this.getData('Settings');
      const setting = settings.find(s => s.key === key);
      return setting ? setting.value : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }
}
