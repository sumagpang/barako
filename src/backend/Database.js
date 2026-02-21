/**
 * Database.js - Handles all interactions with Google Sheets
 */

var DB = {
  getSpreadsheet: function() {
    const props = PropertiesService.getScriptProperties();
    const id = props.getProperty('SPREADSHEET_ID');

    if (!id) {
      if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActiveSpreadsheet()) {
        return SpreadsheetApp.getActiveSpreadsheet();
      }
      throw new Error('SPREADSHEET_ID is not configured in Script Properties.');
    }

    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      console.error('Failed to open spreadsheet:', e);
      throw new Error('Invalid SPREADSHEET_ID or insufficient permissions.');
    }
  },

  getTable: function(tableName) {
    const ss = this.getSpreadsheet();
    const sheet = ss.getSheetByName(tableName);
    if (!sheet) {
      throw new Error('Sheet "' + tableName + '" not found.');
    }
    return sheet;
  },

  getData: function(tableName) {
    const sheet = this.getTable(tableName);
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return [];

    const headers = values[0];
    const rows = values.slice(1);

    return rows.map((row, index) => {
      const obj = { _row: index + 2 };
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });
  },

  insert: function(tableName, data) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
      const sheet = this.getTable(tableName);
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const newRow = headers.map(header => data[header] !== undefined ? data[header] : '');
      sheet.appendRow(newRow);
      return true;
    } catch (e) {
      console.error('Insert error:', e);
      return false;
    } finally {
      lock.releaseLock();
    }
  },

  update: function(tableName, rowNumber, data) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
      const sheet = this.getTable(tableName);
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

      headers.forEach((header, i) => {
        if (data[header] !== undefined) {
          sheet.getRange(rowNumber, i + 1).setValue(data[header]);
        }
      });
      return true;
    } catch (e) {
      console.error('Update error:', e);
      return false;
    } finally {
      lock.releaseLock();
    }
  },

  findBy: function(tableName, key, value) {
    const data = this.getData(tableName);
    return data.find(item => item[key] == value);
  },

  getSetting: function(key) {
    const setting = this.findBy('Settings', 'key', key);
    return setting ? setting.value : null;
  },

  setSetting: function(key, value) {
    const setting = this.findBy('Settings', 'key', key);
    if (setting) {
      this.update('Settings', setting._row, { value: value });
    } else {
      this.insert('Settings', { key: key, value: value });
    }
  },

  deleteRow: function(tableName, rowNumber) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
      const sheet = this.getTable(tableName);
      sheet.deleteRow(rowNumber);
      return true;
    } catch (e) {
      console.error('Delete error:', e);
      return false;
    } finally {
      lock.releaseLock();
    }
  },

  // Batch update for connection status
  updateConnectionStatuses: function(updates) {
    if (updates.length === 0) return;

    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
      const sheet = this.getTable('Users');
      const data = this.getData('Users');
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const statusIdx = headers.indexOf('connectionStatus');

      if (statusIdx === -1) return;

      updates.forEach(update => {
        const user = data.find(u => u.username === update.username);
        if (user) {
          sheet.getRange(user._row, statusIdx + 1).setValue(update.status);
        }
      });
    } finally {
      lock.releaseLock();
    }
  }
};
