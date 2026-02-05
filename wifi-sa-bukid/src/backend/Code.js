function doGet(e) {
  var page = e.parameter.page;
  var action = e.parameter.action;

  if (page == 'admin') {
    return HtmlService.createTemplateFromFile('src/frontend/admin/index')
      .evaluate()
      .setTitle('WiFi sa Bukid - Admin')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // Mikrotik Sync Endpoints
  if (action == 'getKickList') {
    var users = getUsersToKick();
    return ContentService.createTextOutput(users.join(","));
  }

  if (action == 'getNewUsers') {
    var users = getNewUsersSync();
    // Format: mobile,passcode,limit-uptime
    // Map planId to time limit
    var csv = users.map(function(u) {
       var limit = getPlanDuration(u.planId);
       return u.mobile + "," + u.passcode + "," + limit;
    }).join("\n");
    return ContentService.createTextOutput(csv);
  }

  // Default response for unspecified Get
  return ContentService.createTextOutput("WiFi sa Bukid API Active");
}

function doPost(e) {
  var action = e.parameter.action;
  var payload = e.postData ? JSON.parse(e.postData.contents) : {};

  var result = {};

  try {
    switch (action) {
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
        var redirectUrl = "http://hotspot.mikrotik.com/login?status=paid";
        var source = PaymongoService.createSource(amount, "PHP", redirectUrl);
        result = { status: 'success', data: source };
        break;

      case 'checkPayment':
        var sourceId = payload.sourceId;
        var sourceData = PaymongoService.retrieveSource(sourceId);
        if (sourceData.data.attributes.status === 'chargeable') {
          var passcode = Math.floor(1000 + Math.random() * 9000).toString();
          var mobile = payload.mobile;
          var planId = payload.planId;

          saveUser({
            mobile: mobile,
            passcode: passcode,
            planId: planId,
            expiry: calculateExpiry(planId),
            status: "ACTIVE",
            synced: false // Mark for sync
          });

          SemaphoreService.sendSMS(mobile, "Your WiFi Passcode is: " + passcode);

          result = { status: 'success', paid: true, passcode: passcode, mobile: mobile };
        } else {
          result = { status: 'success', paid: false };
        }
        break;

      case 'login':
        var users = getUsers();
        var valid = users.find(function(u) {
          return u.mobile == payload.mobile && u.passcode == payload.passcode;
        });
        result = { status: 'success', valid: !!valid, user: valid };
        break;

      // Admin Actions
      case 'savePlan':
        // payload: { id, name, price... }
        savePlan(payload);
        result = { status: 'success' };
        break;

      case 'saveAnnouncement':
        // payload: { message }
        saveAnnouncement(payload.message);
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
  return plan ? (plan.durationMinutes + "m") : "1h"; // Format for Mikrotik: 1h, 30m, etc.
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
