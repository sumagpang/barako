// CONFIGURATION (Ideally set these in Project Settings > Script Properties)
// Keys should be stored in Script Properties, not hardcoded.
var SENDER_NAME = 'SEMAPHORE'; // Your registered Sender Name (or default)
var SHEET_NAME = 'Transactions';
var ADMIN_PASSWORD = 'admin123'; // Change this for security!

// SECURITY: Define a shared secret token for the MikroTik to authenticate with this script
var MIKROTIK_TOKEN = 'CHANGE_THIS_TO_A_LONG_RANDOM_STRING';

var PLANS = {
  '1hour': { name: '1 Hour Pass', amount: 1000, description: '1 Hour WiFi Access', durationMinutes: 60 },
  '3hours': { name: '3 Hours Pass', amount: 2000, description: '3 Hours WiFi Access', durationMinutes: 180 },
  '1day':  { name: '1 Day Pass',  amount: 5000, description: '1 Day WiFi Access', durationMinutes: 1440 },
  '1week': { name: '1 Week Pass', amount: 15000, description: '1 Week WiFi Access', durationMinutes: 10080 }
};

function doGet(e) {
  // Mode 1: MikroTik Router Fetching Users (Requires Token)
  if (e.parameter.token && e.parameter.token === MIKROTIK_TOKEN) {
    return handleRouterRequest(e);
  }

  // Mode 5: Admin Dashboard
  if (e.parameter.page === 'admin') {
      return HtmlService.createHtmlOutputFromFile('admin')
          .setTitle('WIFI Admin')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
          .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // Mode 2: Success Page (User Returned from PayMongo)
  if (e.parameter.status === 'success' && e.parameter.ref) {
     return handleSuccessPage(e.parameter.ref);
  }

  // Mode 3: Cancelled Page (User Cancelled in PayMongo)
  if (e.parameter.status === 'cancelled' && e.parameter.ref) {
      updateTransactionStatus(e.parameter.ref, 'CANCELLED');
      return HtmlService.createHtmlOutput('<h1>Transaction Cancelled</h1><p>You have cancelled the payment. Close this window to try again.</p>')
          .setTitle('Transaction Cancelled')
          .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // Mode 4: Storefront (HTML)
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('WIFI sa BUKID')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL) // Allow iframing if needed
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function loginUser(mobile, password) {
    try {
        var sheet = getOrCreateSheet();
        var data = sheet.getDataRange().getValues();
        var user = null;

        // Skip header, Iterate backwards to find latest
        for (var i = data.length - 1; i > 0; i--) {
            // Check Mobile (Col 1/B) and Password (Col 5/F)
            // Ensure types match string
            if (String(data[i][1]) === String(mobile) && String(data[i][5]) === String(password)) {
                // Check if PAID
                var status = data[i][6];
                if (status.includes('PAID') || status === 'SYNCED') {
                    user = {
                        timestamp: data[i][0],
                        mobile: String(data[i][1]),
                        description: data[i][3],
                        status: data[i][6],
                        password: String(data[i][5])
                    };
                    break;
                }
            }
        }

        if (!user) {
            return { error: "Invalid Credentials or Plan not Active" };
        }

        // Calculate Remaining Time
        // Find Plan Duration
        var planDuration = 60; // Default 1 hour
        var desc = user.description.toLowerCase();
        if (desc.includes('1 hour')) planDuration = 60;
        if (desc.includes('3 hours')) planDuration = 180;
        if (desc.includes('1 day')) planDuration = 1440;
        if (desc.includes('1 week')) planDuration = 10080;

        var startTime = new Date(user.timestamp);
        var now = new Date();
        var diffMinutes = Math.floor((now - startTime) / 60000);
        var remaining = planDuration - diffMinutes;

        if (remaining < 0) remaining = 0;

        // Format Remaining Time
        var h = Math.floor(remaining / 60);
        var m = remaining % 60;
        var remainingStr = h + "h " + m + "m";

        return {
            success: true,
            mobile: user.mobile,
            password: user.password,
            plan: user.description,
            remaining: remainingStr,
            remainingMinutes: remaining
        };

    } catch (e) {
        return { error: "Login Error: " + e.toString() };
    }
}

function getAdminData(password) {
  try {
    if (password !== ADMIN_PASSWORD) {
        return { error: "Invalid Password" };
    }

    var sheet = getOrCreateSheet();
    var data = sheet.getDataRange().getValues();
    var result = [];

    // Skip header
    for (var i = 1; i < data.length; i++) {
        // Safe Date Conversion
        var ts = data[i][0];
        var tsStr = "";
        if (ts instanceof Date) {
            tsStr = ts.toISOString();
        } else {
            tsStr = String(ts);
        }

        result.push({
            timestamp: tsStr,
            mobile: String(data[i][1]),
            amount: data[i][2],
            description: data[i][3],
            status: data[i][6],
            method: data[i][9]
        });
    }
    return result;
  } catch (e) {
    return { error: "Server Error: " + e.toString() };
  }
}

function handleSuccessPage(referenceId) {
  // Look up the transaction to get credentials
  var sheet = getOrCreateSheet();
  var data = sheet.getDataRange().getValues();
  var user = null;

  // Search for the reference ID (Column H - 8th column, index 7)
  for (var i = 1; i < data.length; i++) {
    if (data[i][7] === referenceId) {
       user = {
         username: data[i][4],
         password: data[i][5],
         status: data[i][6]
       };
       break;
    }
  }

  var html = '';
  if (user) {
    html = `
      <div style="font-family: sans-serif; text-align: center; padding: 20px;">
        <h1 style="color: #2e7d32;">Payment Successful!</h1>
        <p>Your WiFi access is being prepared.</p>
        <div style="background: #f0f0f0; padding: 20px; border-radius: 10px; margin: 20px auto; max-width: 400px;">
           <p><strong>Username:</strong> <span style="font-size: 24px;">${user.username}</span></p>
           <p><strong>Password:</strong> <span style="font-size: 24px; color: #d32f2f;">${user.password}</span></p>
        </div>
        <p>A copy has been sent to your mobile number.</p>
        <a href="http://10.0.0.1/login?username=${user.username}&password=${user.password}" style="display: inline-block; background: #2e7d32; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">Connect Now</a>
        <p style="font-size: 12px; color: #666; margin-top: 20px;">Note: If 'Connect Now' doesn't work, wait 1 minute for activation.</p>
      </div>
    `;
  } else {
    html = '<h1>Processing...</h1><p>Please check your SMS for the password.</p>';
  }

  return HtmlService.createHtmlOutput(html)
      .setTitle('Payment Success').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function handleRouterRequest(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  var sheet = getOrCreateSheet();
  var data = sheet.getDataRange().getValues();
  var usersToAdd = [];

  // Skip header row
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var status = row[6]; // Column G

    // Only sync PAID transactions
    if (status === 'PAID_PENDING_SYNC') {
      usersToAdd.push({
        username: row[4],
        password: row[5],
        profile: getProfileFromDescription(row[3]),
        limitUptime: getLimitFromDescription(row[3])
      });

      // Mark as SYNCED
      sheet.getRange(i + 1, 7).setValue('SYNCED');
    }
  }

  output.setContent(JSON.stringify(usersToAdd));
  return output;
}

// Called from Frontend (index.html)
function createPayMongoCheckout(planId, mobileNumber, paymentMethod) {
  var plan = PLANS[planId];
  if (!plan) throw new Error('Invalid Plan');

  var webAppUrl = ScriptApp.getService().getUrl();

  // Generate Reference ID and Password NOW
  var referenceId = 'ref_' + generateRandomString(12);
  var username = mobileNumber; // User wants Mobile # as Username
  var password = generateRandomString(4);

  // Pre-save to DB as INITIALIZING
  var sheet = getOrCreateSheet();
  var timestamp = new Date();

  sheet.appendRow([
    timestamp,
    mobileNumber,
    plan.amount / 100,
    plan.description,
    username,
    password,
    'INITIALIZING',
    referenceId,
    '', // Placeholder for Session ID
    paymentMethod // Added Payment Method
  ]);

  var paymentTypes = ['gcash', 'paymaya', 'grab_pay']; // Default fallback
  if (paymentMethod === 'gcash') {
    paymentTypes = ['gcash'];
  } else if (paymentMethod === 'paymaya') {
    paymentTypes = ['paymaya'];
  } else if (paymentMethod === 'coinsph') {
    paymentTypes = ['gcash', 'paymaya', 'grab_pay'];
  }

  // Create PayMongo Checkout Session
  var payload = {
    data: {
      attributes: {
        line_items: [
          {
            name: plan.name,
            amount: plan.amount,
            currency: 'PHP',
            quantity: 1,
            description: plan.description
          }
        ],
        billing: {
          name: 'Customer ' + mobileNumber,
          email: 'customer@example.com',
          phone: mobileNumber
        },
        payment_method_types: paymentTypes,
        send_email_receipt: false,
        description: plan.description,
        reference_number: referenceId,
        show_description: true,
        show_line_items: true,
        success_url: webAppUrl + "?status=success&ref=" + referenceId,
        cancel_url: webAppUrl + "?status=cancelled&ref=" + referenceId
      }
    }
  };

  var apiKey = PropertiesService.getScriptProperties().getProperty('PAYMONGO_SECRET_KEY');
  if (!apiKey) throw new Error('Payment Server Config Error');

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Basic ' + Utilities.base64Encode(apiKey + ':')
    },
    payload: JSON.stringify(payload)
  };

  try {
    var response = UrlFetchApp.fetch('https://api.paymongo.com/v1/checkout_sessions', options);
    var json = JSON.parse(response.getContentText());
    var checkoutUrl = json.data.attributes.checkout_url;
    var sessionId = json.data.id;

    updateTransactionWithSession(referenceId, sessionId, 'PENDING_PAYMENT');

    return checkoutUrl;

  } catch (e) {
    Logger.log('PayMongo Error: ' + e.toString());
    updateTransactionStatus(referenceId, 'FAILED_API');
    throw new Error('Failed to create payment link.');
  }
}

function doPost(e) {
  try {
    var output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);

    if (!e.postData || !e.postData.contents) {
       output.setContent(JSON.stringify({status: 'error', message: 'No content'}));
       return output;
    }

    var postData = JSON.parse(e.postData.contents);
    var eventType = postData.data.attributes.type;

    if (eventType !== 'checkout_session.payment.paid') {
      output.setContent(JSON.stringify({status: 'ignored'}));
      return output;
    }

    var checkoutSessionId = postData.data.attributes.data.id;
    var verifiedSession = verifyPayMongoSession(checkoutSessionId);

    if (!verifiedSession) {
        Logger.log('Security Alert: Verification failed for session ' + checkoutSessionId);
        output.setContent(JSON.stringify({status: 'error_verification_failed'}));
        return output;
    }

    var attributes = verifiedSession.attributes;
    var referenceId = attributes.reference_number;

    var sheet = getOrCreateSheet();
    var data = sheet.getDataRange().getValues();
    var foundRowIndex = -1;
    var userRow = null;

    for (var i = 1; i < data.length; i++) {
        if (data[i][7] == referenceId) {
            foundRowIndex = i + 1;
            userRow = data[i];
            break;
        }
    }

    if (foundRowIndex > 0) {
        sheet.getRange(foundRowIndex, 7).setValue('PAID_PENDING_SYNC');

        var username = userRow[4];
        var password = userRow[5];
        var description = userRow[3];
        var mobileNumber = userRow[1];

        var message = 'WIFI sa BUKID: Payment Received! Username: ' + username + ' Password: ' + password;
        sendSms(mobileNumber, message);

    } else {
        Logger.log("Transaction not found for ref: " + referenceId);
    }

    output.setContent(JSON.stringify({status: 'success'}));
    return output;

  } catch (error) {
    Logger.log(error);
    var errorOutput = ContentService.createTextOutput();
    errorOutput.setMimeType(ContentService.MimeType.JSON);
    errorOutput.setContent(JSON.stringify({status: 'error', message: error.toString()}));
    return errorOutput;
  }
}

// --- Helper Functions ---

function verifyPayMongoSession(sessionId) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('PAYMONGO_SECRET_KEY');
  if (!apiKey) return null;

  var options = {
    method: 'get',
    headers: {
      'Authorization': 'Basic ' + Utilities.base64Encode(apiKey + ':')
    },
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch('https://api.paymongo.com/v1/checkout_sessions/' + sessionId, options);
    if (response.getResponseCode() !== 200) {
       return null;
    }
    var json = JSON.parse(response.getContentText());
    if (json.data.id === sessionId && json.data.attributes.payments && json.data.attributes.payments.length > 0) {
        return json.data;
    }
    return null;
  } catch (e) {
    Logger.log('Verification Error: ' + e);
    return null;
  }
}

function updateTransactionStatus(referenceId, newStatus) {
  var sheet = getOrCreateSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][7] === referenceId) {
       sheet.getRange(i + 1, 7).setValue(newStatus);
       break;
    }
  }
}

function updateTransactionWithSession(referenceId, sessionId, newStatus) {
  var sheet = getOrCreateSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][7] === referenceId) {
       sheet.getRange(i + 1, 7).setValue(newStatus);
       sheet.getRange(i + 1, 9).setValue(sessionId);
       break;
    }
  }
}

function sendSms(number, message) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('SEMAPHORE_API_KEY');
  if (!apiKey) return;

  var cleanNum = number;

  var payload = {
    apikey: apiKey,
    number: cleanNum,
    message: message,
    sendername: SENDER_NAME
  };

  var options = { method: 'post', payload: payload };
  try {
    UrlFetchApp.fetch('https://api.semaphore.co/api/v4/messages', options);
  } catch (e) {
    Logger.log('SMS Failed: ' + e.toString());
  }
}

function generateRandomString(length) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var result = '';
  for (var i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Script must be bound to a Google Sheet");
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Timestamp', 'Phone', 'Amount', 'Description', 'Username', 'Password', 'Status', 'ReferenceID', 'SessionID', 'PaymentMethod']);
  } else {
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (headers.indexOf('SessionID') === -1) {
       sheet.getRange(1, headers.length + 1).setValue('SessionID');
       headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }
    if (headers.indexOf('PaymentMethod') === -1) {
       sheet.getRange(1, headers.length + 1).setValue('PaymentMethod');
    }
  }
  return sheet;
}

function getProfileFromDescription(desc) {
  if (!desc) return 'default';
  if (desc.toLowerCase().indexOf('1 hour') !== -1) return '1hour_plan';
  if (desc.toLowerCase().indexOf('3 hours') !== -1) return '3hours_plan';
  if (desc.toLowerCase().indexOf('1 day') !== -1) return '1day_plan';
  if (desc.toLowerCase().indexOf('1 week') !== -1) return '1week_plan';
  return 'default';
}

function getLimitFromDescription(desc) {
  if (!desc) return '1h';
  if (desc.toLowerCase().indexOf('1 hour') !== -1) return '1h';
  if (desc.toLowerCase().indexOf('3 hours') !== -1) return '3h';
  if (desc.toLowerCase().indexOf('1 day') !== -1) return '1d';
  if (desc.toLowerCase().indexOf('1 week') !== -1) return '1w';
  return '1h';
}
