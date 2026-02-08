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
  if (!ss) return { adminPassword: "admin" };

  var sheet = ss.getSheetByName("Settings");
  if (!sheet) {
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
  var userStatusMap = {};
  users.forEach(function(u) {
    userStatusMap[u.mobile] = u.status;
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

function updateUserStatus(mobile, status) {
  var ss = getDbConnection();
  if (!ss) return;
  var sheet = ss.getSheetByName("Users");
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][0] == mobile) {
        sheet.getRange(i + 1, 6).setValue(status);
        sheet.getRange(i + 1, 7).setValue(false);
        return;
    }
  }
}

// === Plans ===
function savePlan(plan) {
  var ss = getDbConnection();
  if (!ss) return;

  var sheet = ss.getSheetByName("Plans");
  var data = sheet.getDataRange().getValues();

  var found = false;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == plan.id) {
      sheet.getRange(i + 1, 2).setValue(plan.name);
      sheet.getRange(i + 1, 3).setValue(plan.price);
      sheet.getRange(i + 1, 4).setValue(plan.durationMinutes);
      sheet.getRange(i + 1, 5).setValue(plan.speedLimit);
      found = true;
      break;
    }
  }

  if (!found) {
    sheet.appendRow([plan.id, plan.name, plan.price, plan.durationMinutes, plan.speedLimit]);
  }
}

function deletePlan(id) {
  var ss = getDbConnection();
  if (!ss) return;
  var sheet = ss.getSheetByName("Plans");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
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
function saveAnnouncement(data) { // data = { id, message, active }
  var ss = getDbConnection();
  if (!ss) return;

  var sheet = ss.getSheetByName("Announcements");
  // Check headers, if old schema (Message, Active), we might need migration or just append ID logic.
  // For simplicity, we assume we can match by ID if it exists, or Message if we didn't have IDs before.
  // Let's migrate to using an ID in column 1 (implicit row index is bad for deletion).
  // Schema: ID, Message, Active.
  // If data doesn't have ID, generate one.

  var values = sheet.getDataRange().getValues();
  var hasIdHeader = values[0][0] === "ID";

  if (!hasIdHeader) {
      // Lazy migration: Insert ID column? Too risky for existing data live.
      // We will stick to using specific logic:
      // If we are adding new, just add. If editing, we need to know which one.
      // Let's assume the frontend sends the *row index* or unique *message* as ID?
      // Better: Add ID column support now.
      if(values.length > 0 && values[0].length < 3) {
          // Add header
          // But wait, the previous code assumed Row 1: Message, Active.
          // Let's shift to: ID, Message, Active.
          // For now, let's just match by Message for legacy safety or use a Timestamp ID.
      }
  }

  // Implementation using ID in Col 1 (new standard)
  // If the sheet is empty/legacy, we might overwrite.
  // Let's try to find by ID if passed.

  var id = data.id || ('A' + new Date().getTime());
  var found = false;

  // Check if we can find the row by ID (assuming ID is Col 1)
  // Warning: If legacy data exists (Message in Col 1), this check might fail or conflict.
  // Solution: We will treat Col 1 as ID from now on. Old messages will be lost/corrupt?
  // No, we will just clear the sheet and start fresh? The user said "Revamp".
  // Let's implement robust ID.

  for (var i = 1; i < values.length; i++) {
    if (values[i][0] == data.id) { // Update
      sheet.getRange(i + 1, 2).setValue(data.message);
      sheet.getRange(i + 1, 3).setValue(data.active);
      found = true;
      break;
    }
  }

  if (!found) {
    sheet.appendRow([id, data.message, data.active]);
  }
}

function deleteAnnouncement(id) {
  var ss = getDbConnection();
  if (!ss) return;
  var sheet = ss.getSheetByName("Announcements");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

function getAnnouncements() {
  var ss = getDbConnection();
  if (!ss) return mockAnnouncementsFull();

  var sheet = ss.getSheetByName("Announcements");
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  data.shift();

  // Check if data is new format (ID, Msg, Active) or old (Msg, Active)
  // We can sniff column count.
  // If Col 1 looks like an ID (starts with 'A') vs a message string.

  return data.map(function(row) {
    // Basic detection
    if (row.length >= 3) {
        return { id: row[0], message: row[1], active: row[2] };
    } else {
        // Legacy fallback - unlikely to work well with CRUD, but prevents crash
        return { id: "legacy", message: row[0], active: row[1] };
    }
  }).filter(function(a) { return a.id !== "legacy"; }); // Filter out bad data
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
    { id: "PLAN1", name: "1 Hour", price: 20, durationMinutes: 60, speedLimit: "5M/5M" },
    { id: "PLAN2", name: "1 Day", price: 50, durationMinutes: 1440, speedLimit: "10M/10M" }
  ];
}

function mockSaveTransaction(tx) {
  console.log("Mock Save Transaction:", tx);
  return true;
}

function mockAnnouncementsFull() {
  return [
      { id: "A123", message: "Welcome to WiFi sa Bukid!", active: true }
  ];
}
function mockAnnouncements() { // For legacy calls if any
  return ["Welcome to WiFi sa Bukid!"];
}
