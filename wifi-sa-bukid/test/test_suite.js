const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock Cache
const mockCache = new Map();

// Mock GAS Environment
const context = {
  ContentService: {
    createTextOutput: (content) => {
      const output = {
        setMimeType: () => output, // Return self for chaining
        getContent: () => content
      };
      return output;
    },
    MimeType: { JSON: 'JSON' }
  },
  HtmlService: {
    createTemplateFromFile: () => ({
      evaluate: () => ({
        setTitle: () => ({
          setXFrameOptionsMode: () => ({
            addMetaTag: () => "HTML_OUTPUT"
          })
        })
      })
    }),
    createHtmlOutputFromFile: () => ({ getContent: () => "INCLUDED_CONTENT" }),
    XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperties: () => ({})
    })
  },
  CacheService: {
    getScriptCache: () => ({
      put: (key, value, time) => mockCache.set(key, value),
      get: (key) => mockCache.get(key)
    })
  },
  Utilities: {
    base64Encode: (str) => Buffer.from(str).toString('base64'),
    getUuid: () => "mock-uuid-1234"
  },
  SpreadsheetApp: undefined,
  UrlFetchApp: undefined,
  console: console
};

vm.createContext(context);

// Load Backend Files
const backendDir = path.join(__dirname, '../src/backend');
const files = ['Database.js', 'Services.js', 'AdminController.js', 'Code.js'];

files.forEach(file => {
  const content = fs.readFileSync(path.join(backendDir, file), 'utf8');
  vm.runInContext(content, context);
});

console.log("Running Tests...");

try {
  // Test 1: createCheckoutSession (Mock)
  console.log("Test 1: createCheckoutSession...");
  const session = context.PaymongoService.createCheckoutSession(100, "Test Plan", "http://redirect");
  if (session.data.attributes.checkout_url) console.log("PASS");
  else throw "createCheckoutSession failed";

  // Test 2: Admin Auth via RPC
  console.log("Test 2: Admin Auth via RPC...");
  // Now using rpc directly which returns object
  const authRes = context.rpc('adminLogin', { password: 'admin' });

  if (authRes.status === 'success' && authRes.token) {
    // Validate Token via RPC
    const verifyRes = context.rpc('savePlan', { token: authRes.token, plan: { id: 'TEST' } });

    if(verifyRes.status === 'success') console.log("PASS");
    else throw "Token Verification Failed";

  }
  else throw "Admin Login Failed: " + JSON.stringify(authRes);

  // Test 3: Dashboard Filter
  console.log("Test 3: Dashboard Filter...");
  const dash = context.getDashboardData("2023-10");
  if (dash.totalSales >= 0) console.log("PASS");
  else throw "Dashboard Filter Failed";

  // Test 4: checkPayment Flow (Checkout Session)
  console.log("Test 4: checkPayment Flow...");
  const checkRes = JSON.parse(context.doPost({
    parameter: { action: 'checkPayment' },
    postData: { contents: JSON.stringify({ sourceId: 'cs_mock_123', planId: 'PLAN1', mobile: '0917000' }) }
  }).getContent());

  if (checkRes.status === 'success' && checkRes.paid === true) console.log("PASS");
  else throw "checkPayment Failed: " + JSON.stringify(checkRes);

  console.log("All Tests Passed!");

} catch (err) {
  console.error("FAIL:", err);
  process.exit(1);
}
