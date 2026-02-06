function doGet(e) {
  var page = e.parameter.page;
  var action = e.parameter.action;

  if (page == 'admin') {
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('WiFi sa Bukid - Admin')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // Public Endpoint: Kick List (Router Only)
  if (action == 'getKickList') {
    var users = getUsersToKick();
    return ContentService.createTextOutput(users.join(","));
  }

  // Public Endpoint: New Users (Router Only)
  if (action == 'getNewUsers') {
    var users = getNewUsersSync();
    var csv = users.map(function(u) {
       var limit = getPlanDuration(u.planId);
       return u.mobile + "," + u.passcode + "," + limit;
    }).join("\n");
    return ContentService.createTextOutput(csv);
  }

  // Default response
  return ContentService.createTextOutput("WiFi sa Bukid API Active");
}

function doPost(e) {
  var action = e.parameter.action;
  var payload = e.postData ? JSON.parse(e.postData.contents) : {};
  var result = {};

  try {
    switch (action) {
      // Public Actions
      case 'getPlans':
        result = { status: 'success', data: getPlans() };
        break;

      case 'getAnnouncements':
        result = { status: 'success', data: getAnnouncements() };
        break;

      case 'createPayment':
        var amount = payload.amount;
        var mobile = payload.mobile;
        var planId = payload.planId;
        var redirectUrl = "http://hotspot.mikrotik.com/login"; // Redirect back to login
        var description = "WiFi Plan " + planId + " - " + mobile;

        var session = PaymongoService.createCheckoutSession(amount, description, redirectUrl);
        result = { status: 'success', data: session };
        break;

      case 'checkPayment':
        var sourceId = payload.sourceId; // This is now sessionId
        var planId = payload.planId;
        var mobile = payload.mobile;

        var sessionData = PaymongoService.retrieveCheckoutSession(sourceId);

        if (sessionData.data.attributes.payment_status === 'paid') {
            // Payment Confirmed
            var passcode = Math.floor(1000 + Math.random() * 9000).toString();

            saveUser({
              mobile: mobile,
              passcode: passcode,
              planId: planId,
              expiry: calculateExpiry(planId),
              status: "ACTIVE",
              synced: false
            });

            // Get actual payment ID if available, else use session ID
            var refId = sourceId;
            var amountPaid = sessionData.data.attributes.line_items[0].amount / 100;

            saveTransaction({
               refId: refId,
               mobile: mobile,
               planId: planId,
               amount: amountPaid,
               status: 'PAID'
            });

            SemaphoreService.sendSMS(mobile, "Your WiFi Passcode is: " + passcode);

            result = { status: 'success', paid: true, passcode: passcode, mobile: mobile };
        } else {
            result = { status: 'success', paid: false };
        }
        break;

      // Admin Actions (Protected)
      case 'adminLogin':
        if (checkAdminPassword(payload.password)) {
          var token = Utilities.getUuid();

          // Store token in Cache Service for 6 hours (21600 seconds)
          var cache = CacheService.getScriptCache();
          cache.put("ADMIN_SESSION_" + token, "TRUE", 21600);

          result = { status: 'success', token: token };
        } else {
          result = { status: 'error', message: 'Invalid Password' };
        }
        break;

      case 'savePlan':
        verifyAdmin(payload.token);
        savePlan(payload.plan);
        result = { status: 'success' };
        break;

      case 'saveAnnouncement':
        verifyAdmin(payload.token);
        saveAnnouncement(payload.message);
        result = { status: 'success' };
        break;

      case 'updateSettings':
        verifyAdmin(payload.token);
        saveSettings(payload.settings);
        result = { status: 'success' };
        break;

      default:
        result = { status: 'error', message: 'Unknown action' };
    }
  } catch (err) {
    result = { status: 'error', message: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function verifyAdmin(token) {
  if (!token) throw "Unauthorized";

  var cache = CacheService.getScriptCache();
  var session = cache.get("ADMIN_SESSION_" + token);

  if (session !== "TRUE") {
    throw "Unauthorized - Session Expired";
  }
}

function calculateExpiry(planId) {
  var plans = getPlans();
  var plan = plans.find(function(p) { return p.id === planId; });
  if (!plan) return new Date().toISOString();

  var now = new Date();
  now.setMinutes(now.getMinutes() + plan.durationMinutes);
  return now.toISOString();
}

function getPlanDuration(planId) {
  var plans = getPlans();
  var plan = plans.find(function(p) { return p.id === planId; });
  return plan ? (plan.durationMinutes + "m") : "1h";
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
