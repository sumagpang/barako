var SS_ID = "YOUR_SPREADSHEET_ID_HERE";

function getDbConnection() {
  if (typeof SpreadsheetApp === 'undefined') {
    return null;
  }
  return SpreadsheetApp.openById(SS_ID);
}

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
  // Filter for status = KICK
  return users.filter(function(u) { return u.status === 'KICK'; }).map(function(u) { return u.mobile; }); // Returning mobile or MAC? Mikrotik uses MAC or User. If user, mobile.
  // Code.js joined them.
}

function getNewUsersSync() {
  var ss = getDbConnection();
  if (!ss) return mockUsers().filter(u => !u.synced);

  var sheet = ss.getSheetByName("Users");
  var data = sheet.getDataRange().getValues();
  var newUsers = [];

  // Start from row 2 (index 1)
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    // Check if synced is falsy and status is ACTIVE
    if (!row[6] && row[5] === 'ACTIVE') {
      newUsers.push({
        mobile: row[0],
        passcode: row[1],
        planId: row[3]
      });
      // Mark as synced immediately (Optimistic sync)
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
    false // Synced
  ]);
}

function savePlan(plan) {
  var ss = getDbConnection();
  if (!ss) return; // Mock do nothing

  var sheet = ss.getSheetByName("Plans");
  // Check if exists, update; else append.
  // Simple append for now or overwrite if ID matches?
  // Let's just append for this demo scope
  sheet.appendRow([plan.id, plan.name, plan.price, plan.durationMinutes, plan.speedLimit]);
}

function saveAnnouncement(message) {
  var ss = getDbConnection();
  if (!ss) return;

  var sheet = ss.getSheetByName("Announcements");
  // Deactivate all others?
  sheet.appendRow([message, true]);
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
    { id: "PLAN1", name: "1 Hour", price: 10, durationMinutes: 60, speedLimit: "5M/5M" },
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
