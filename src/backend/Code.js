/**
 * Code.js - Main entry point for the Apps Script Web App
 */

function doGet(e) {
  const page = e.parameter.page || 'index';
  const db = new Database();

  // Public router endpoints
  if (e.parameter.action === 'test') {
    return ContentService.createTextOutput("ARASU_OK");
  }
  if (e.parameter.action === 'getPlans') {
    return handleGetPlans();
  }
  if (e.parameter.action === 'getNewUsers') {
    return handleGetNewUsers(e.parameter.token);
  }
  if (e.parameter.action === 'getKickList') {
    return handleGetKickList(e.parameter.token);
  }
  if (e.parameter.action === 'markSynced') {
    return handleMarkSynced(e.parameter.token, e.parameter.usernames);
  }

  // Success bounce page
  if (e.parameter.action === 'payment_success') {
    const template = HtmlService.createTemplateFromFile('payment_success');
    template.refId = e.parameter.refId || '';
    return template.evaluate().addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // Admin and Hotspot Frontends
  // In GAS, all HTML files are in the root folder, so use their names directly.
  try {
    const template = HtmlService.createTemplateFromFile(page);
    return template.evaluate()
      .setTitle('ARASU WiFi sa Bukid')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    console.error("Error evaluating page: " + page + " - " + err.message);
    return HtmlService.createHtmlOutput('<h2>Page not found or Authorization required</h2>' +
       '<p>Please ensure you have authorized the script using the "Perform Initial Setup" menu in your Google Sheet.</p>' +
       '<p>If you see a blank page, try <b>Incognito Mode</b> or <b>Logging out of other Google accounts</b>.</p>');
  }
}

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput("Invalid JSON").setMimeType(ContentService.MimeType.TEXT);
  }

  // Paymongo Webhook
  if (data.data && data.data.type === 'event') {
    const signature = e.parameter['X-Paymongo-Signature'] || e.postData.headers['x-paymongo-signature'];
    if (!verifyPaymongoSignature(e.postData.contents, signature)) {
      return ContentService.createTextOutput("Unauthorized").setMimeType(ContentService.MimeType.TEXT);
    }
    return handlePaymongoWebhook(data);
  }

  // Router Connection Updates
  if (data.action === 'updateConnection') {
    return handleUpdateConnection(data);
  }

  // Public Purchase
  if (data.action === 'public_initiatePurchase') {
    try {
      const checkoutUrl = initiatePurchase(data.planId, data.mobile);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', checkoutUrl: checkoutUrl }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid request' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function verifyPaymongoSignature(payload, signature) {
  const secret = PropertiesService.getScriptProperties().getProperty('PAYMONGO_WEBHOOK_SECRET');
  if (!secret) return true; // For initial setup if secret not yet configured
  if (!signature) return false;

  const parts = signature.split(',');
  const timestamp = parts[0].split('=')[1];
  const testSignature = parts[1].split('=')[1];

  const baseString = timestamp + "." + payload;
  const hash = Utilities.computeHmacSha256Signature(baseString, secret);
  const hashHex = hash.map(function(val) {
    return ("0" + (val & 0xFF).toString(16)).slice(-2);
  }).join("");

  return hashHex === testSignature;
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * ROUTER API HANDLERS
 */

function handleGetPlans() {
  const db = new Database();
  const plans = db.getData('Plans');
  const announcements = db.getData('Announcements');
  const activeAnn = announcements.find(a => a.enabled === true || a.enabled === 'TRUE');

  return ContentService.createTextOutput(JSON.stringify({
    plans: plans,
    announcement: activeAnn ? activeAnn.content : ''
  })).setMimeType(ContentService.MimeType.JSON);
}

function handleGetNewUsers(token) {
  if (token !== PropertiesService.getScriptProperties().getProperty('MIKROTIK_TOKEN')) {
    return ContentService.createTextOutput("Invalid Token");
  }

  const db = new Database();
  const users = db.getData('Users').filter(u => u.syncStatus === 'Ready');

  // Format: username,password,limit-uptime,speed-limit|...
  const output = users.map(u => {
    // Calculate limit-uptime from duration (e.g., "1h" -> "01:00:00")
    // For simplicity, we assume duration is already in HH:mm:ss format in the User record
    const plan = db.findByField('Plans', 'id', u.planId);
    const speedLimit = plan ? plan.speedLimit : '';
    return `${u.username},${u.password},${u.duration},${speedLimit}`;
  }).join('|');

  return ContentService.createTextOutput(output);
}

function handleGetKickList(token) {
  if (token !== PropertiesService.getScriptProperties().getProperty('MIKROTIK_TOKEN')) {
    return ContentService.createTextOutput("Invalid Token");
  }

  const db = new Database();
  const now = new Date();
  const users = db.getData('Users');

  const kickList = users.filter(u => {
    if (u.syncStatus === 'Disabled') return true;
    if (u.expirationDate && new Date(u.expirationDate) < now) {
      // Auto-expire
      return true;
    }
    return false;
  }).map(u => u.username).join(',');

  return ContentService.createTextOutput(kickList);
}

function handleMarkSynced(token, usernames) {
  if (token !== PropertiesService.getScriptProperties().getProperty('MIKROTIK_TOKEN')) {
    return ContentService.createTextOutput("Error");
  }

  const db = new Database();
  const names = usernames.split(',');
  names.forEach(name => {
    const user = db.findByField('Users', 'username', name);
    if (user) {
      db.updateRow('Users', user._row, { syncStatus: 'Synced' });
    }
  });

  return ContentService.createTextOutput("OK");
}

function handleUpdateConnection(data) {
  if (data.token !== PropertiesService.getScriptProperties().getProperty('MIKROTIK_TOKEN')) {
    return ContentService.createTextOutput("Error");
  }

  const db = new Database();
  const user = db.findByField('Users', 'username', data.username);
  if (user) {
    db.updateRow('Users', user._row, {
      status: data.status, // 'Connected' or 'Disconnected'
      macAddress: data.mac || user.macAddress
    });
  }
  return ContentService.createTextOutput("OK");
}

/**
 * INITIAL SETUP AND PERMISSIONS HANDLER
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ARASU WiFi Settings')
    .addItem('Perform Initial Setup', 'initialSetup')
    .addToUi();
}

function initialSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ['Users', 'Plans', 'Transactions', 'Announcements', 'Settings'];

  sheets.forEach(name => {
    if (!ss.getSheetByName(name)) {
      const sheet = ss.insertSheet(name);
      if (name === 'Users') sheet.appendRow(['id', 'username', 'password', 'expirationDate', 'status', 'syncStatus', 'mobile', 'planId', 'duration', 'balance', 'macAddress']);
      if (name === 'Plans') sheet.appendRow(['id', 'name', 'price', 'duration', 'speedLimit']);
      if (name === 'Transactions') sheet.appendRow(['id', 'userId', 'amount', 'type', 'status', 'date', 'refId']);
      if (name === 'Announcements') sheet.appendRow(['id', 'content', 'enabled', 'date']);
      if (name === 'Settings') sheet.appendRow(['key', 'value']);
    }
  });

  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

  Browser.msgBox("Initial Setup Complete! Please deploy as a Web App and update the WEB_APP_URL in Script Properties.");
}

/**
 * ADMIN RPC HANDLERS (Called via google.script.run)
 */

function validateAdmin(password) {
  return password === PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
}

function getDashboardData(password) {
  if (!validateAdmin(password)) throw new Error("Unauthorized");
  const db = new Database();
  return JSON.stringify({
    status: 'success',
    users: db.getData('Users'),
    plans: db.getData('Plans'),
    transactions: db.getData('Transactions'),
    announcements: db.getData('Announcements'),
    settings: {
       MIKROTIK_TOKEN: PropertiesService.getScriptProperties().getProperty('MIKROTIK_TOKEN')
    }
  });
}

function saveDatabaseRecord(password, sheet, payload) {
  if (!validateAdmin(password)) throw new Error("Unauthorized");
  const db = new Database();
  if (payload._row) {
    db.updateRow(sheet, payload._row, payload);
  } else {
    db.addRow(sheet, payload);
  }
  return JSON.stringify({ status: 'success' });
}

function deleteDatabaseRecord(password, sheet, row) {
  if (!validateAdmin(password)) throw new Error("Unauthorized");
  const db = new Database();
  db.deleteRow(sheet, row);
  return JSON.stringify({ status: 'success' });
}

function saveSettings(password, payload) {
  if (!validateAdmin(password)) throw new Error("Unauthorized");
  if (payload.MIKROTIK_TOKEN) {
    PropertiesService.getScriptProperties().setProperty('MIKROTIK_TOKEN', payload.MIKROTIK_TOKEN);
  }
  return JSON.stringify({ status: 'success' });
}
