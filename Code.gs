// CONFIGURATION (Ideally set these in Project Settings > Script Properties)
// Keys should be stored in Script Properties, not hardcoded.
var SENDER_NAME = 'SEMAPHORE'; // Your registered Sender Name (or default)
var SHEET_NAME = 'Transactions';

// SECURITY: Define a shared secret token for the MikroTik to authenticate with this script
var MIKROTIK_TOKEN = 'CHANGE_THIS_TO_A_LONG_RANDOM_STRING';

var PLANS = {
  '1hour': { name: '1 Hour Pass', amount: 1000, description: '1 Hour WiFi Access' }, // Amount in centavos
  '1day':  { name: '1 Day Pass',  amount: 5000, description: '1 Day WiFi Access' },
  '1week': { name: '1 Week Pass', amount: 15000, description: '1 Week WiFi Access' }
};

function doGet(e) {
  // Mode 1: MikroTik Router Fetching Users (Requires Token)
  if (e.parameter.token && e.parameter.token === MIKROTIK_TOKEN) {
    return handleRouterRequest(e);
  }

  // Mode 2: Storefront (HTML)
  // Handle success/cancel params if needed (e.g. show a thank you message)
  if (e.parameter.status === 'success') {
     return HtmlService.createHtmlOutput('<h1>Payment Successful!</h1><p>Wait for the SMS with your WiFi password.</p>')
         .setTitle('Payment Success').addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('WIFI sa BUKID')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL) // Allow iframing if needed
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
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

    if (status === 'PENDING_SYNC') {
      usersToAdd.push({
        username: row[4],
        password: row[5],
        profile: getProfileFromDescription(row[3]), // Map plan to profile
        limitUptime: getLimitFromDescription(row[3]) // Map plan to time limit
      });

      // Mark as SYNCED so we don't add it again
      sheet.getRange(i + 1, 7).setValue('SYNCED');
    }
  }

  output.setContent(JSON.stringify(usersToAdd));
  return output;
}

// Called from Frontend (index.html)
function createPayMongoCheckout(planId) {
  var plan = PLANS[planId];
  if (!plan) throw new Error('Invalid Plan');

  // Create PayMongo Checkout Session
  // success_url and cancel_url are required.
  // We point them back to the Web App URL (the store).
  var webAppUrl = ScriptApp.getService().getUrl();

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
        payment_method_types: ['gcash', 'paymaya', 'grab_pay'],
        send_email_receipt: false,
        description: plan.description,
        show_description: true,
        show_line_items: true,
        success_url: webAppUrl + "?status=success",
        cancel_url: webAppUrl + "?status=cancelled"
      }
    }
  };

  var apiKey = PropertiesService.getScriptProperties().getProperty('PAYMONGO_SECRET_KEY');
  if (!apiKey) throw new Error('Payment Server Config Error'); // Don't leak key info

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

    // SECURITY: Verify the transaction with PayMongo API to prevent spoofing.
    // We cannot trust the webhook payload alone because we cannot verify headers in GAS.
    var checkoutSessionId = postData.data.attributes.data.id;
    var verifiedSession = verifyPayMongoSession(checkoutSessionId);

    if (!verifiedSession) {
        Logger.log('Security Alert: Verification failed for session ' + checkoutSessionId);
        output.setContent(JSON.stringify({status: 'error_verification_failed'}));
        return output;
    }

    // Proceed with verified data
    var attributes = verifiedSession.attributes;

    // Check payment status again to be sure
    // Note: The session attribute usually has 'payment_intent' which has status 'succeeded'
    // But since we are handling the 'paid' event, we assume it's paid.

    var description = attributes.description || 'WiFi Access';
    var amountPaid = 0;
    if (attributes.line_items && attributes.line_items.length > 0) {
        amountPaid = attributes.line_items[0].amount / 100;
    }

    // Get phone number
    var rawPhone = null;
    if (attributes.billing && attributes.billing.phone) {
        rawPhone = attributes.billing.phone;
    } else if (attributes.customer && attributes.customer.phone) {
        rawPhone = attributes.customer.phone;
    }

    var mobileNumber = sanitizePhoneNumber(rawPhone);

    if (!mobileNumber) {
        Logger.log('No valid phone number found in payment: ' + rawPhone);
        output.setContent(JSON.stringify({status: 'error_no_phone'}));
        return output;
    }

    // 2. Generate WiFi Credentials
    var username = generateRandomString(6);
    var password = generateRandomString(4);

    // 3. Save to Database
    var sheet = getOrCreateSheet();
    var timestamp = new Date();
    sheet.appendRow([timestamp, mobileNumber, amountPaid, description, username, password, 'PENDING_SYNC']);

    // 4. Send SMS
    var message = 'WIFI sa BUKID: Thanks for buying ' + description + '! Code: ' + username + ' Pass: ' + password;
    sendSms(mobileNumber, message);

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
    // Ensure the ID matches and payments exist
    if (json.data.id === sessionId && json.data.attributes.payments && json.data.attributes.payments.length > 0) {
        return json.data;
    }
    return null;
  } catch (e) {
    Logger.log('Verification Error: ' + e);
    return null;
  }
}

function sanitizePhoneNumber(phone) {
  if (!phone) return null;
  var cleaned = phone.toString().replace(/\D/g, '');

  if (cleaned.startsWith('63') && cleaned.length === 12) return '0' + cleaned.substring(2);
  if (cleaned.startsWith('09') && cleaned.length === 11) return cleaned;
  if (cleaned.startsWith('9') && cleaned.length === 10) return '0' + cleaned;

  return null;
}

function sendSms(number, message) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('SEMAPHORE_API_KEY');
  if (!apiKey) {
      Logger.log('SEMAPHORE_API_KEY not set');
      return;
  }

  var payload = {
    apikey: apiKey,
    number: number,
    message: message,
    sendername: SENDER_NAME
  };

  var options = {
    method: 'post',
    payload: payload
  };

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
    sheet.appendRow(['Timestamp', 'Phone', 'Amount', 'Description', 'Username', 'Password', 'Status']);
  }
  return sheet;
}

function getProfileFromDescription(desc) {
  if (!desc) return 'default';
  if (desc.toLowerCase().indexOf('1 hour') !== -1) return '1hour_plan';
  if (desc.toLowerCase().indexOf('1 day') !== -1) return '1day_plan';
  if (desc.toLowerCase().indexOf('1 week') !== -1) return '1week_plan';
  return 'default';
}

function getLimitFromDescription(desc) {
  if (!desc) return '1h';
  if (desc.toLowerCase().indexOf('1 hour') !== -1) return '1h';
  if (desc.toLowerCase().indexOf('1 day') !== -1) return '1d';
  if (desc.toLowerCase().indexOf('1 week') !== -1) return '1w';
  return '1h';
}
