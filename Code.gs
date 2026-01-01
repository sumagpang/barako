// CONFIGURATION (Ideally set these in Project Settings > Script Properties)
// Keys should be stored in Script Properties, not hardcoded.
var SENDER_NAME = 'SEMAPHORE'; // Your registered Sender Name (or default)
var SHEET_NAME = 'Transactions';

// SECURITY: Define a shared secret token for the MikroTik to authenticate with this script
var MIKROTIK_TOKEN = 'CHANGE_THIS_TO_A_LONG_RANDOM_STRING';

// SECURITY: Webhook Secret from PayMongo Dashboard (to verify signatures)
var PAYMONGO_WEBHOOK_SECRET = 'wh_...';

function doPost(e) {
  try {
    var output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);

    // 0. Security Check: Verify PayMongo Signature
    // Note: PayMongo sends a 'Paymongo-Signature' header.
    // Implementing full HMAC verification in GAS can be complex due to header parsing limitations in some contexts.
    // As a basic check, ensure the request has a body.
    // For Production: Use Utilities.computeHmacSha256Signature(payload, secret) and compare.

    if (!e.postData || !e.postData.contents) {
       output.setContent(JSON.stringify({status: 'error', message: 'No content'}));
       return output;
    }

    // 1. Parse Webhook
    var postData = JSON.parse(e.postData.contents);
    var type = postData.data.attributes.type;

    // We only care about successful payments
    if (type !== 'payment.paid') {
      output.setContent(JSON.stringify({status: 'ignored'}));
      return output;
    }

    var paymentData = postData.data.attributes.data.attributes;
    var amount = paymentData.amount / 100; // PayMongo uses centavos
    var description = paymentData.description; // e.g., "1 Hour WiFi"

    // Get phone number and sanitize it
    var rawPhone = paymentData.billing.phone;
    var mobileNumber = sanitizePhoneNumber(rawPhone);

    if (!mobileNumber) {
        // Log error but return success to PayMongo so they don't retry indefinitely
        Logger.log('Invalid Phone Number: ' + rawPhone);
        output.setContent(JSON.stringify({status: 'error_invalid_phone'}));
        return output;
    }

    // 2. Generate WiFi Credentials
    var username = generateRandomString(6);
    var password = generateRandomString(4); // Short for ease of typing

    // 3. Save to Database (Google Sheet)
    var sheet = getOrCreateSheet();
    var timestamp = new Date();
    // Status 'PENDING_SYNC' means MikroTik hasn't picked it up yet
    sheet.appendRow([timestamp, mobileNumber, amount, description, username, password, 'PENDING_SYNC']);

    // 4. Send SMS via Semaphore
    var message = 'Thanks for purchasing ' + description + '! Your WiFi Code is: ' + username + ' Password: ' + password;
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

function doGet(e) {
  // This endpoint is for the MikroTik Router to fetch new users
  // Security Check: Token is required
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  if (!e.parameter.token || e.parameter.token !== MIKROTIK_TOKEN) {
     output.setContent(JSON.stringify({error: 'Unauthorized'}));
     return output;
  }

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

// --- Helper Functions ---

function sanitizePhoneNumber(phone) {
  if (!phone) return null;

  // Remove all non-numeric characters
  var cleaned = phone.toString().replace(/\D/g, '');

  // Check for Country Code 63 (Philippines)
  if (cleaned.startsWith('63') && cleaned.length === 12) {
    return '0' + cleaned.substring(2);
  }

  // Check if it already starts with 09
  if (cleaned.startsWith('09') && cleaned.length === 11) {
    return cleaned;
  }

  // If it's 9xxxxxxxxx (missing 0)
  if (cleaned.startsWith('9') && cleaned.length === 10) {
    return '0' + cleaned;
  }

  return null; // Invalid format
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
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, 1, O, 0 to avoid confusion
  var result = '';
  for (var i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
     throw new Error("Script must be bound to a Google Sheet");
  }
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Timestamp', 'Phone', 'Amount', 'Description', 'Username', 'Password', 'Status']);
  }
  return sheet;
}

function getProfileFromDescription(desc) {
  // Simple mapping logic - Customize as needed
  if (!desc) return 'default';
  if (desc.toLowerCase().indexOf('1 hour') !== -1) return '1hour_plan';
  if (desc.toLowerCase().indexOf('1 day') !== -1) return '1day_plan';
  return 'default';
}

function getLimitFromDescription(desc) {
  // Return time limit in string format for MikroTik (e.g., "1h", "1d")
  if (!desc) return '1h';
  if (desc.toLowerCase().indexOf('1 hour') !== -1) return '1h';
  if (desc.toLowerCase().indexOf('1 day') !== -1) return '1d';
  return '1h';
}
