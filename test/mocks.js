/**
 * mocks.js - Mock implementations of Google Apps Script globals
 */

global.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: (key) => {
      const props = {
        'SPREADSHEET_ID': 'mock-ss-id',
        'PAYMONGO_SECRET_KEY': 'mock-paymongo-key',
        'SEMAPHORE_API_KEY': 'mock-semaphore-key',
        'ADMIN_PASSWORD': 'admin',
        'MIKROTIK_TOKEN': 'secret'
      };
      return props[key];
    }
  })
};

global.Utilities = {
  base64Encode: (str) => Buffer.from(str).toString('base64'),
  getUuid: () => 'mock-uuid-' + Math.random()
};

global.LockService = {
  getScriptLock: () => ({
    waitLock: () => {},
    releaseLock: () => {}
  })
};

global.UrlFetchApp = {
  fetch: (url, options) => {
    console.log('Mock Fetch:', url, options.method);
    return {
      getContentText: () => JSON.stringify({
        data: { attributes: { checkout_url: 'http://checkout.mock' } }
      })
    };
  }
};

global.ContentService = {
  MimeType: { JSON: 'application/json' },
  createTextOutput: (text) => ({
    setMimeType: () => ({ content: text })
  })
};

// SpreadsheetApp Mock
let mockData = {
  'Users': [['username', 'passcode', 'planId', 'mobileNumber', 'referenceId', 'syncStatus', 'expirationDate', 'connectionStatus']],
  'Plans': [['id', 'name', 'price', 'durationHours', 'status'], ['p1', '1 Hour', 10, 1, 'Active']],
  'Transactions': [['referenceId', 'mobileNumber', 'planId', 'amount', 'status', 'timestamp']],
  'Announcements': [['id', 'title', 'message', 'status']],
  'Settings': [['key', 'value']]
};

global.SpreadsheetApp = {
  openById: (id) => ({
    getSheetByName: (name) => ({
      getDataRange: () => ({
        getValues: () => mockData[name]
      }),
      getRange: (row, col, rows, cols) => ({
        getValues: () => [mockData[name][0]], // headers
        setValue: (val) => {
          if (row > 1) {
            mockData[name][row-1][col-1] = val;
          }
        }
      }),
      appendRow: (row) => mockData[name].push(row),
      getLastColumn: () => mockData[name][0].length
    })
  })
};
