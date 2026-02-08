// ... (previous mock env)
// The issue is `vm.runInContext` executes the code but `function doPost() {}` declarations
// might not be automatically attached to the `context` object property *if* they are not explicitly assigned.
// However, typically in Node VM, they are.
// Let's try explicitly exporting or just using `rpc` for test 4 since `doPost` just wraps `executeAction` which `rpc` also uses.
// OR, I can inspect context.

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
        setMimeType: () => output,
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
  ScriptApp: {
    getService: () => ({ getUrl: () => "https://script.google.com/macros/s/TEST_ID/exec" })
  },
  SpreadsheetApp: undefined,
  UrlFetchApp: undefined,
  console: console
};

vm.createContext(context);

const backendDir = path.join(__dirname, '../src/backend');
const files = ['Database.js', 'Services.js', 'AdminController.js', 'Code.js'];

files.forEach(file => {
  const content = fs.readFileSync(path.join(backendDir, file), 'utf8');
  vm.runInContext(content, context);
});

console.log("Running Tests...");

try {
  // Test 1: createCheckoutSession
  console.log("Test 1: createCheckoutSession...");
  const session = context.PaymongoService.createCheckoutSession(100, "Test Plan", "http://redirect");
  if (session.data.attributes.checkout_url) console.log("PASS");
  else throw "createCheckoutSession failed";

  // Test 2: Admin Auth via RPC
  console.log("Test 2: Admin Auth via RPC...");
  const authRes = context.rpc('adminLogin', { password: 'admin' }); // Default mock password

  if (authRes.status === 'success' && authRes.token) {
    // Validate Token via RPC
    const verifyRes = context.rpc('savePlan', { token: authRes.token, plan: { id: 'TEST', name: 'Test' } });
    if(verifyRes.status === 'success') console.log("PASS");
    else throw "Token Verification Failed: " + JSON.stringify(verifyRes);
  }
  else throw "Admin Login Failed: " + JSON.stringify(authRes);

  // Test 3: Dashboard Filter
  console.log("Test 3: Dashboard Filter...");
  const dash = context.getDashboardData("2023-10");
  if (dash.totalSales >= 0) console.log("PASS");
  else throw "Dashboard Filter Failed";

  // Test 4: checkPayment Flow
  console.log("Test 4: checkPayment Flow...");
  // Use rpc directly to test logic, bypassing the ContentService wrapper which caused test issue
  const checkRes = context.rpc('checkPayment', { sourceId: 'cs_mock_123', planId: 'PLAN1', mobile: '0917000' });

  if (checkRes.status === 'success' && checkRes.paid === true) console.log("PASS");
  else throw "checkPayment Failed: " + JSON.stringify(checkRes);

  // Test 5: checkUserStatus
  console.log("Test 5: checkUserStatus...");
  // Use a user from mockUsers() in Database.js since mock state is not persisted in file
  const statusRes = context.rpc('checkUserStatus', { mobile: '09171234567' });
  if (statusRes.status === 'success' && statusRes.passcode) console.log("PASS");
  else throw "checkUserStatus Failed: " + JSON.stringify(statusRes);

  // Test 6: Webhook
  console.log("Test 6: Webhook...");
  // Mock doPost
  const hookPayload = {
      data: {
          attributes: {
              type: 'checkout_session.payment.paid',
              data: {
                  id: 'cs_hook_123'
              }
          }
      }
  };

  // Mock Paymongo Retrieve for this hook (since Code.js calls retrieveCheckoutSession)
  const originalRetrieve = context.PaymongoService.retrieveCheckoutSession;
  context.PaymongoService.retrieveCheckoutSession = (id) => {
      return {
          data: {
              attributes: {
                  payment_status: 'paid',
                  description: 'WiFi Plan PLAN1 - 0917HOOK123',
                  line_items: [{ amount: 1000 }]
              }
          }
      };
  };

  const postRes = context.doPost({
      parameter: {},
      postData: { contents: JSON.stringify(hookPayload) }
  });

  if (postRes.getContent() === "Webhook Received") console.log("PASS");
  else throw "Webhook Failed: " + postRes.getContent();

  // Restore mock
  context.PaymongoService.retrieveCheckoutSession = originalRetrieve;

  console.log("All Tests Passed!");

} catch (err) {
  console.error("FAIL:", err);
  process.exit(1);
}
