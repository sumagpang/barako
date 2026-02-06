var SS_ID = "YOUR_SPREADSHEET_ID_HERE";

function getDbConnection() {
  if (typeof SpreadsheetApp === 'undefined') {
    return null;
  }
  try {
    return SpreadsheetApp.openById(SS_ID);
  } catch (e) {
    console.error("DB Connection Error: " + e);
    return null;
  }
}

// === Settings ===
function getSettings() {
  var ss = getDbConnection();
  if (!ss) return { adminPassword: "admin" }; // Default

  var sheet = ss.getSheetByName("Settings");
  if (!sheet) {
    // Auto-init Settings if missing
    sheet = ss.insertSheet("Settings");
    sheet.appendRow(["Key", "Value"]);
    sheet.appendRow(["adminPassword", "admin123"]);
    return { adminPassword: "admin123" };
  }

  var data = sheet.getDataRange().getValues();
  var settings = {};
  for(var i=1; i<data.length; i++) {
    settings[data[i][0]] = data[i][1];
  }
  return settings;
}

function saveSettings(newSettings) {
  var ss = getDbConnection();
  if (!ss) return;

  var sheet = ss.getSheetByName("Settings");
  // Simple overwrite for this demo key
  var data = sheet.getDataRange().getValues();
  for(var i=1; i<data.length; i++) {
    if(data[i][0] === 'adminPassword' && newSettings.adminPassword) {
      sheet.getRange(i+1, 2).setValue(newSettings.adminPassword);
    }
  }
}

function checkAdminPassword(input) {
  var settings = getSettings();
  return String(input) === String(settings.adminPassword);
}

// === Users ===
function getUsers() {
  var ss = getDbConnection();
  if (!ss) return mockUsers();

  var sheet = ss.getSheetByName("Users");
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  data.shift();

  return data.map(function(row) {
    return {
      mobile: row[0],
      passcode: row[1],
      mac: row[2],
      planId: row[3],
      expiry: row[4],
      status: row[5],
      synced: row[6]
    };
  });
}

function getUsersToKick() {
  var users = getUsers();

  var userStatusMap = {}; // mobile -> status

  users.forEach(function(u) {
    userStatusMap[u.mobile] = u.status; // Overwrites with latest
  });

  var kickList = [];
  for (var mobile in userStatusMap) {
    if (userStatusMap[mobile] === 'KICK') {
      kickList.push(mobile);
    }
  }

  return kickList;
}

function getNewUsersSync() {
  var ss = getDbConnection();
  if (!ss) return mockUsers().filter(u => !u.synced);

  var sheet = ss.getSheetByName("Users");
  var data = sheet.getDataRange().getValues();
  var newUsers = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[6] && row[5] === 'ACTIVE') {
      newUsers.push({
        mobile: row[0],
        passcode: row[1],
        planId: row[3]
      });
      sheet.getRange(i + 1, 7).setValue(true);
    }
  }
  return newUsers;
}

function saveUser(user) {
  var ss = getDbConnection();
  if (!ss) return mockSaveUser(user);

  var sheet = ss.getSheetByName("Users");
  sheet.appendRow([
    user.mobile,
    user.passcode,
    user.mac || "",
    user.planId,
    user.expiry,
    "ACTIVE",
    false
  ]);
}

// === Plans ===
function savePlan(plan) {
  var ss = getDbConnection();
  if (!ss) return;

  var sheet = ss.getSheetByName("Plans");
  sheet.appendRow([plan.id, plan.name, plan.price, plan.durationMinutes, plan.speedLimit]);
}

function getPlans() {
  var ss = getDbConnection();
  if (!ss) return mockPlans();

  var sheet = ss.getSheetByName("Plans");
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  data.shift();

  return data.map(function(row) {
    return {
      id: row[0],
      name: row[1],
      price: row[2],
      durationMinutes: row[3],
      speedLimit: row[4]
    };
  });
}

// === Announcements ===
function saveAnnouncement(message) {
  var ss = getDbConnection();
  if (!ss) return;

  var sheet = ss.getSheetByName("Announcements");
  sheet.appendRow([message, true]);
}

function getAnnouncements() {
  var ss = getDbConnection();
  if (!ss) return mockAnnouncements();

  var sheet = ss.getSheetByName("Announcements");
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  data.shift();

  return data.filter(function(row) { return row[1] === true; })
             .map(function(row) { return row[0]; });
}

// === Transactions ===
function saveTransaction(tx) {
  var ss = getDbConnection();
  if (!ss) return mockSaveTransaction(tx);

  var sheet = ss.getSheetByName("Transactions");
  sheet.appendRow([
    tx.refId,
    tx.mobile,
    tx.planId,
    tx.amount,
    tx.status,
    new Date()
  ]);
}

function getTransactions() {
  var ss = getDbConnection();
  if (!ss) return [];

  var sheet = ss.getSheetByName("Transactions");
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  data.shift();

  return data.map(function(row) {
    return {
      refId: row[0],
      mobile: row[1],
      planId: row[2],
      amount: row[3],
      status: row[4],
      date: new Date(row[5])
    };
  });
}

// Mock Data Providers
function mockUsers() {
  return [
    { mobile: "09171234567", passcode: "1234", mac: "00:00:00:00:00:01", planId: "PLAN1", expiry: new Date().toISOString(), status: "ACTIVE", synced: false },
    { mobile: "09189998888", passcode: "5678", mac: "00:00:00:00:00:02", planId: "PLAN2", expiry: new Date().toISOString(), status: "KICK", synced: true }
  ];
}

function mockSaveUser(user) {
  console.log("Mock Save User:", user);
  return true;
}

function mockPlans() {
  return [
    // Updated Plan Prices to 20/50 PHP to strictly meet typical Paymongo minimums
    { id: "PLAN1", name: "1 Hour", price: 20, durationMinutes: 60, speedLimit: "5M/5M" },
    { id: "PLAN2", name: "1 Day", price: 50, durationMinutes: 1440, speedLimit: "10M/10M" }
  ];
}

function mockSaveTransaction(tx) {
  console.log("Mock Save Transaction:", tx);
  return true;
}

function mockAnnouncements() {
  return ["Welcome to WiFi sa Bukid! Enjoy fast internet."];
}
