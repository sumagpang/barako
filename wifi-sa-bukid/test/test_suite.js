const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
  Utilities: {
    base64Encode: (str) => Buffer.from(str).toString('base64')
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
  // Test 1: createPayment (Mock)
  console.log("Test 1: createPayment...");
  const payment = context.PaymongoService.createPayment("src_123", 100);
  if (payment.data.attributes.status === 'paid') console.log("PASS");
  else throw "createPayment failed";

  // Test 2: Admin Auth
  console.log("Test 2: Admin Auth...");
  const authRes = JSON.parse(context.doPost({
    parameter: { action: 'adminLogin' },
    postData: { contents: JSON.stringify({ password: 'admin' }) }
  }).getContent());

  if (authRes.status === 'success' && authRes.token === 'VALID_SESSION') console.log("PASS");
  else throw "Admin Login Failed: " + JSON.stringify(authRes);

  // Test 3: Dashboard Filter
  console.log("Test 3: Dashboard Filter...");
  const dash = context.getDashboardData("2023-10");
  if (dash.totalSales >= 0) console.log("PASS");
  else throw "Dashboard Filter Failed";

  // Test 4: checkPayment Flow (Capture)
  console.log("Test 4: checkPayment Flow...");
  const checkRes = JSON.parse(context.doPost({
    parameter: { action: 'checkPayment' },
    postData: { contents: JSON.stringify({ sourceId: 'src_test', planId: 'PLAN1', mobile: '0917000' }) }
  }).getContent());

  // Mock createPayment returns 'paid', so checkPayment should succeed
  if (checkRes.status === 'success' && checkRes.paid === true) console.log("PASS");
  else throw "checkPayment Failed: " + JSON.stringify(checkRes);

  console.log("All Tests Passed!");

} catch (err) {
  console.error("FAIL:", err);
  process.exit(1);
}
