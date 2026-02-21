/**
 * mocks.js - Updated for Wallet System
 */

let scriptProperties = {
  'SPREADSHEET_ID': 'mock-ss-id',
  'PAYMONGO_SECRET_KEY': 'mock-paymongo-key',
  'SEMAPHORE_API_KEY': 'mock-semaphore-key',
  'ADMIN_PASSWORD': 'admin',
  'MIKROTIK_TOKEN': 'secret',
  'WEB_APP_URL': 'https://mock.url'
};

global.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: (key) => scriptProperties[key],
    setProperty: (key, val) => { scriptProperties[key] = val; },
    getProperties: () => scriptProperties
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
        data: { attributes: { checkout_url: 'http://paymongo.checkout.mock' } }
      })
    };
  }
};

global.ContentService = {
  MimeType: { JSON: 'application/json' },
  createTextOutput: (text) => ({
    setMimeType: () => ({ getContent: () => text }),
    getContent: () => text
  })
};

global.HtmlService = {
  XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
  createHtmlOutput: (html) => ({ getContent: () => html }),
  createTemplateFromFile: (filename) => ({
    evaluate: () => ({
      setTitle: (title) => ({
        setXFrameOptionsMode: (mode) => ({ getContent: () => `Template: ${filename}` })
      })
    })
  })
};

let mockData = {
  'Users': [['username', 'passcode', 'planId', 'mobileNumber', 'referenceId', 'syncStatus', 'expirationDate', 'connectionStatus', 'balance']],
  'Plans': [['id', 'name', 'price', 'durationHours', 'speedLimit', 'status'],
            ['p1', 'Small Plan', 5, 1, '1M/1M', 'Active'],
            ['p2', 'Big Plan', 150, 24, '2M/2M', 'Active']],
  'Transactions': [['referenceId', 'mobileNumber', 'planId', 'amount', 'status', 'timestamp']],
  'Announcements': [['id', 'title', 'message', 'status']],
  'Settings': [['key', 'value']]
};

global.SpreadsheetApp = {
  openById: (id) => ({
    getSheetByName: (name) => ({
      getDataRange: () => ({ getValues: () => mockData[name] }),
      getRange: (row, col) => ({
        getValues: () => [mockData[name][0]],
        setValue: (val) => {
          if (row > 1) {
            if (!mockData[name][row-1]) mockData[name][row-1] = new Array(mockData[name][0].length);
            mockData[name][row-1][col-1] = val;
          }
        }
      }),
      appendRow: (row) => mockData[name].push(row),
      deleteRow: (rowNumber) => mockData[name].splice(rowNumber - 1, 1),
      getLastColumn: () => mockData[name][0].length
    })
  })
};
