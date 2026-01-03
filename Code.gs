// CONFIGURATION (Ideally set these in Project Settings > Script Properties)
// Keys should be stored in Script Properties, not hardcoded.
var SENDER_NAME = 'SEMAPHORE'; // Your registered Sender Name (or default)
var SHEET_NAME = 'Transactions';

// SECURITY: Define a shared secret token for the MikroTik to authenticate with this script
var MIKROTIK_TOKEN = 'CHANGE_THIS_TO_A_LONG_RANDOM_STRING';

var PLANS = {
  '1hour': { name: '1 Hour Pass', amount: 1000, description: '1 Hour WiFi Access' }, // Amount in centavos
  '3hours': { name: '3 Hours Pass', amount: 2000, description: '3 Hours WiFi Access' },
  '1day':  { name: '1 Day Pass',  amount: 5000, description: '1 Day WiFi Access' },
  '1week': { name: '1 Week Pass', amount: 15000, description: '1 Week WiFi Access' }
};

function doGet(e) {
  // Mode 1: MikroTik Router Fetching Users (Requires Token)
  if (e.parameter.token && e.parameter.token === MIKROTIK_TOKEN) {
    return handleRouterRequest(e);
  }

  // Mode 2: Success Page (User Returned from PayMongo)
  if (e.parameter.status === 'success' && e.parameter.ref) {
     return handleSuccessPage(e.parameter.ref);
  }

  // Mode 3: Storefront (HTML)
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('WIFI sa BUKID')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL) // Allow iframing if needed
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function handleSuccessPage(referenceId) {
  // Look up the transaction to get credentials
  var sheet = getOrCreateSheet();
  var data = sheet.getDataRange().getValues();
  var user = null;

  // Search for the reference ID (Column H - 8th column, index 7)
  // Assuming we add Reference ID to column H
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
    // If status is still 'PENDING_PAYMENT', we might need to wait or just show it anyway if we trust the redirect
    // But ideally, we wait for webhook. However, user is impatient.
    // We can show the credentials immediately since we pre-generated them.
    // The router won't accept them until status becomes SYNCED (after webhook fires).

    html = `
      <div style="font-family: sans-serif; text-align: center; padding: 20px;">
        <h1 style="color: #2e7d32;">Payment Successful!</h1>
        <p>Your WiFi access is being prepared.</p>
        <div style="background: #f0f0f0; padding: 20px; border-radius: 10px; margin: 20px auto; max-width: 400px;">
           <p><strong>Username:</strong> <span style="font-size: 24px;">${user.username}</span></p>
           <p><strong>Password:</strong> <span style="font-size: 24px; color: #d32f2f;">${user.password}</span></p>
        </div>
        <p>A copy has been sent to your mobile number.</p>
        <p style="font-size: 12px; color: #666;">Note: Please wait 1-2 minutes for the router to activate your account.</p>
        <a href="http://10.0.0.1/login" style="display: inline-block; background: #2e7d32; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Login</a>
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
function createPayMongoCheckout(planId, mobileNumber) {
  var plan = PLANS[planId];
  if (!plan) throw new Error('Invalid Plan');

  var webAppUrl = ScriptApp.getService().getUrl();

  // Generate Reference ID and Password NOW
  var referenceId = 'ref_' + generateRandomString(12);
  var username = mobileNumber; // User wants Mobile # as Username
  var password = generateRandomString(4);

  // Pre-save to DB as PENDING_PAYMENT
  // Columns: Timestamp, Phone, Amount, Description, Username, Password, Status, ReferenceID
  var sheet = getOrCreateSheet();
  var timestamp = new Date();
  sheet.appendRow([
    timestamp,
    mobileNumber,
    plan.amount / 100,
    plan.description,
    username,
    password,
    'PENDING_PAYMENT',
    referenceId
  ]);

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
          email: 'customer@example.com', // Optional but recommended
          phone: mobileNumber // Pre-fill phone
        },
        payment_method_types: ['gcash', 'paymaya', 'grab_pay'],
        send_email_receipt: false,
        description: plan.description,
        reference_number: referenceId, // Pass our ref to PayMongo
        show_description: true,
        show_line_items: true,
        success_url: webAppUrl + "?status=success&ref=" + referenceId,
        cancel_url: webAppUrl + "?status=cancelled"
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
    return json.data.attributes.checkout_url;
  } catch (e) {
    Logger.log('PayMongo Error: ' + e.toString());
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

    // Only process checkout payments
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

    // Validated
    var attributes = verifiedSession.attributes;
    var referenceId = attributes.reference_number; // We passed this earlier

    // Find row by Reference ID and Update Status
    var sheet = getOrCreateSheet();
    var data = sheet.getDataRange().getValues();
    var foundRowIndex = -1;
    var userRow = null;

    for (var i = 1; i < data.length; i++) {
        // Check Reference ID (Col H / Index 7)
        if (data[i][7] == referenceId) {
            foundRowIndex = i + 1; // 1-based index
            userRow = data[i];
            break;
        }
    }

    if (foundRowIndex > 0) {
        // Update status to PAID_PENDING_SYNC so router can pick it up
        sheet.getRange(foundRowIndex, 7).setValue('PAID_PENDING_SYNC');

        var username = userRow[4];
        var password = userRow[5];
        var description = userRow[3];
        var mobileNumber = userRow[1];

        // Send SMS
        var message = 'WIFI sa BUKID: Payment Received! Username: ' + username + ' Password: ' + password;
        sendSms(mobileNumber, message);

    } else {
        Logger.log("Transaction not found for ref: " + referenceId);
        // Fallback: Create new row if not found (unlikely if flow followed)
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

function sendSms(number, message) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('SEMAPHORE_API_KEY');
  if (!apiKey) return;

  // Ensure number is clean for Semaphore
  var cleanNum = number;
  // (Assuming already cleaned by frontend or sanitized here)

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
    // Columns: Timestamp, Phone, Amount, Description, Username, Password, Status, ReferenceID
    sheet.appendRow(['Timestamp', 'Phone', 'Amount', 'Description', 'Username', 'Password', 'Status', 'ReferenceID']);
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
