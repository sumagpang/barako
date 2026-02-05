const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock GAS Environment
const context = {
  ContentService: {
    createTextOutput: (content) => ({
      setMimeType: () => ({ content }),
      getContent: () => content
    }),
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
  // Test 1: getPlans (Mock)
  console.log("Test 1: getPlans...");
  const plans = context.getPlans();
  if (plans.length > 0) console.log("PASS");
  else throw "getPlans failed";

  // Test 2: getNewUsersSync (Mock)
  console.log("Test 2: getNewUsersSync...");
  const newUsers = context.getNewUsersSync();
  // Expecting 1 user from mock (synced=false)
  if (newUsers.length === 1 && newUsers[0].mobile === "09171234567") {
    console.log("PASS");
  } else {
    throw "getNewUsersSync failed: " + JSON.stringify(newUsers);
  }

  // Test 3: doGet Actions
  console.log("Test 3: doGet Actions...");
  const eKick = { parameter: { action: 'getKickList' } };
  const resKick = context.doGet(eKick).getContent();
  // Mock users has no KICK status? wait, mockUsers in Database.js:
  // { mobile: "09189998888", ..., status: "KICK" }
  // So result should contain "09189998888"
  if (resKick.includes("09189998888")) console.log("PASS KickList");
  else throw "getKickList failed: " + resKick;

  const eNew = { parameter: { action: 'getNewUsers' } };
  const resNew = context.doGet(eNew).getContent();
  // Should contain "09171234567,1234,1h" (PLAN1 is 60m = 1h)
  if (resNew.includes("09171234567,1234")) console.log("PASS NewUsers");
  else throw "getNewUsers failed: " + resNew;

  console.log("All Tests Passed!");

} catch (err) {
  console.error("FAIL:", err);
  process.exit(1);
}
