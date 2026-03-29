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

  if (page == 'payment_success') {
      var t = HtmlService.createTemplateFromFile('payment_success');
      t.mobile = e.parameter.mobile;
      t.planId = e.parameter.planId;
      return t.evaluate()
        .setTitle('Verifying Payment...')
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

  // Public Endpoint: Get Plans (GET)
  if (action == 'getPlans') {
    var result = { status: 'success', data: getPlans() };
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }

  // Public Endpoint: Get Announcements (GET)
  if (action == 'getAnnouncements') {
    var result = { status: 'success', data: getAnnouncements() };
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }

  // Public Endpoint: Diagnostic Config Check
  if (action == 'testConfig') {
      var status = { db: 'unknown', keys: 'unknown' };
      try {
          // Check DB
          var ss = getDbConnection();
          if (ss) status.db = "Connected: " + ss.getName();
          else status.db = "Failed (Null)";

          // Check Keys
          var keys = getApiKeys();
          status.keys = (keys.PAYMONGO_SECRET_KEY && keys.PAYMONGO_SECRET_KEY !== "sk_test_mock") ? "Present" : "Missing/Default";

          return ContentService.createTextOutput(JSON.stringify({ status: 'ok', details: status }))
            .setMimeType(ContentService.MimeType.JSON);
      } catch (e) {
          return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: e.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
      }
  }

  // Default response
  return ContentService.createTextOutput("WiFi sa Bukid API Active");
}

function doPost(e) {
  // Handle Paymongo Webhook
  if (!e.parameter.action && e.postData) {
      try {
          var hook = JSON.parse(e.postData.contents);
          if (hook.data && hook.data.attributes && hook.data.attributes.type === 'checkout_session.payment.paid') {
              var session = hook.data.attributes.data;
              var sourceId = session.id;

              // We need to parse metadata from description or verify with session retrieve
              // Unfortunately, Paymongo webhook payload for checkout session might not have all custom fields easily.
              // But we can retrieve the session details again to be sure.
              var sessionData = PaymongoService.retrieveCheckoutSession(sourceId);
              var desc = sessionData.data.attributes.description || "";
              // Description format: "WiFi Plan {planId} - {mobile}"
              // OR we can store metadata during creation? We didn't.
              // Let's parse the description.
              var parts = desc.split(" - ");
              if(parts.length >= 2) {
                  var planId = parts[0].replace("WiFi Plan ", "");
                  var mobile = parts[1];
                  // MAC is harder. We might not have it in description.
                  // But usually the user is already created via polling.
                  // This is a failsafe.
                  processSuccessfulPayment(sourceId, planId, mobile, null);
              }
          }
          return ContentService.createTextOutput("Webhook Received");
      } catch (err) {
          console.error("Webhook Error: " + err);
          return ContentService.createTextOutput("Webhook Error");
      }
  }

  var action = e.parameter.action;
  var payload = e.postData ? JSON.parse(e.postData.contents) : {};

  var result = executeAction(action, payload);

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function rpc(action, payload) {
  return executeAction(action, payload || {});
}

function setupWebhook() {
  var url = ScriptApp.getService().getUrl();
  if (!url || url.indexOf("/exec") === -1) {
    return { status: 'error', message: "Please deploy as Web App first." };
  }

  try {
     var res = PaymongoService.createWebhook(url);
     return { status: 'success', data: res };
  } catch (e) {
     return { status: 'error', message: e.toString() };
  }
}

function processSuccessfulPayment(sourceId, planId, mobile, mac) {
    // Check idempotency: if transaction exists, do nothing
    var txs = getTransactions();
    var exists = txs.find(function(t) { return t.refId === sourceId; });
    if (exists) return { status: 'success', paid: true, passcode: "ALREADY_PROCESSED", mobile: mobile };

    var passcode = Math.floor(1000 + Math.random() * 9000).toString();

    // Get amount from session (we need to retrieve it if not passed, but let's assume valid planId price or fetch session)
    // To be safe, let's fetch session again or get plan price.
    // Fetching session is safer for amount.
    var sessionData = PaymongoService.retrieveCheckoutSession(sourceId);
    var amountPaid = sessionData.data.attributes.line_items[0].amount / 100;

    saveUser({
      mobile: mobile,
      passcode: passcode,
      planId: planId,
      mac: mac,
      expiry: calculateExpiry(planId),
      status: "ACTIVE",
      synced: false
    });

    saveTransaction({
       refId: sourceId,
       mobile: mobile,
       planId: planId,
       amount: amountPaid,
       status: 'PAID'
    });

    // Get plan name for SMS
    var plans = getPlans();
    var plan = plans.find(function(p) { return p.id === planId; });
    var planName = plan ? plan.name : planId;

    try {
      var message = "You bought " + planName + ". User: " + mobile + ", Passcode: " + passcode + ". Enjoy WiFi sa Bukid!";
      SemaphoreService.sendSMS(mobile, message);
    } catch (smsErr) {
      console.error("SMS Failed: " + smsErr);
    }

    return { status: 'success', paid: true, passcode: passcode, mobile: mobile };
}

function executeAction(action, payload) {
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
        var mac = payload.mac;
        // Redirect back to THIS Web App first to record transaction/verify
        var scriptUrl = ScriptApp.getService().getUrl();
        var redirectUrl = scriptUrl + "?page=payment_success&mobile=" + mobile + "&planId=" + planId;
        var description = "WiFi Plan " + planId + " - " + mobile;

        var session = PaymongoService.createCheckoutSession(amount, description, redirectUrl);
        result = { status: 'success', data: session };
        break;

      case 'checkPayment':
        var sourceId = payload.sourceId;
        var planId = payload.planId;
        var mobile = payload.mobile;
        var mac = payload.mac;

        var sessionData = PaymongoService.retrieveCheckoutSession(sourceId);

        if (sessionData.data.attributes.payment_status === 'paid') {
            result = processSuccessfulPayment(sourceId, planId, mobile, mac);
        } else {
            result = { status: 'success', paid: false };
        }
        break;

      case 'checkUserStatus':
        var mobile = payload.mobile;
        var users = getUsers();
        // Find latest active user with this mobile
        var activeUser = users.filter(function(u) { return u.mobile == mobile && u.status == 'ACTIVE'; })
                              .sort(function(a,b) { return new Date(b.expiry) - new Date(a.expiry); })[0];

        if (activeUser) {
            result = { status: 'success', passcode: activeUser.passcode, mobile: activeUser.mobile };
        } else {
            result = { status: 'pending', message: 'User not found or not active' };
        }
        break;

      case 'updateConnection':
        var mac = payload.mac;
        var status = payload.status;
        updateUserConnection(mac, status);
        result = { status: 'success' };
        break;

      // Admin Actions (Protected)
      case 'adminLogin':
        if (checkAdminPassword(payload.password)) {
          var token = Utilities.getUuid();
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

      case 'deletePlan':
        verifyAdmin(payload.token);
        deletePlan(payload.id);
        result = { status: 'success' };
        break;

      case 'saveAnnouncement':
        verifyAdmin(payload.token);
        saveAnnouncement(payload.data);
        result = { status: 'success' };
        break;

      case 'deleteAnnouncement':
        verifyAdmin(payload.token);
        deleteAnnouncement(payload.id);
        result = { status: 'success' };
        break;

      case 'reconnectUser':
        verifyAdmin(payload.token);
        updateUserStatus(payload.mobile, 'ACTIVE');
        result = { status: 'success' };
        break;

      case 'updateSettings':
        verifyAdmin(payload.token);
        saveSettings(payload.settings);
        result = { status: 'success' };
        break;

      case 'setupWebhook':
        verifyAdmin(payload.token);
        var setupRes = setupWebhook();
        if(setupRes.status === 'success') {
            result = { status: 'success', data: setupRes.data };
        } else {
            result = { status: 'error', message: setupRes.message };
        }
        break;

      default:
        result = { status: 'error', message: 'Unknown action' };
    }
  } catch (err) {
    result = { status: 'error', message: err.toString() };
  }
  return result;
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
