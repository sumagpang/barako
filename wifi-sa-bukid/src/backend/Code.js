function doGet(e) {
  var page = e.parameter.page;
  var action = e.parameter.action;

  if (page == 'admin') {
    return HtmlService.createTemplateFromFile('index') // Simplified name
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
        var redirectUrl = "http://hotspot.mikrotik.com/login?status=paid";
        var source = PaymongoService.createSource(amount, "PHP", redirectUrl);
        result = { status: 'success', data: source };
        break;

      case 'checkPayment':
        var sourceId = payload.sourceId;
        var planId = payload.planId;
        var mobile = payload.mobile;

        var sourceData = PaymongoService.retrieveSource(sourceId);

        if (sourceData.data.attributes.status === 'chargeable') {
          // CAPTURE PAYMENT
          var plans = getPlans();
          var plan = plans.find(function(p){ return p.id === planId });
          var amount = plan ? plan.price : 10;

          var payment = PaymongoService.createPayment(sourceId, amount, "Plan " + planId + " - " + mobile);

          if(payment.data.attributes.status === 'paid') {
            var passcode = Math.floor(1000 + Math.random() * 9000).toString();

            saveUser({
              mobile: mobile,
              passcode: passcode,
              planId: planId,
              expiry: calculateExpiry(planId),
              status: "ACTIVE",
              synced: false
            });

            saveTransaction({
               refId: payment.data.id,
               mobile: mobile,
               planId: planId,
               amount: amount,
               status: 'PAID'
            });

            SemaphoreService.sendSMS(mobile, "Your WiFi Passcode is: " + passcode);

            result = { status: 'success', paid: true, passcode: passcode, mobile: mobile };
          } else {
             result = { status: 'error', message: 'Payment capture failed' };
          }
        } else {
          result = { status: 'success', paid: false };
        }
        break;

      // Admin Actions (Protected)
      case 'adminLogin':
        if (checkAdminPassword(payload.password)) {
          result = { status: 'success', token: "VALID_SESSION" }; // Simplified session
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
        saveSettings(payload.settings); // { adminPassword: ... }
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
  // In a real app, use a proper session token or HMAC
  // Here we trust the client provided a "VALID_SESSION" token if they passed login
  // Ideally, passing the password again or a derived token is better.
  if (token !== "VALID_SESSION") {
    throw "Unauthorized";
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
