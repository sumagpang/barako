/**
 * Code.js - Main entry point and request handling
 */

function doGet(e) {
  const action = e.parameter.action;
  const page = e.parameter.page;

  if (page === 'admin') {
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('WiFi sa Bukid Admin')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Hotspot API Endpoints
  if (action === 'getPlans') {
    return jsonResponse(DB.getData('Plans').filter(p => p.status === 'Active'));
  }

  if (action === 'getAnnouncements') {
    return jsonResponse(DB.getData('Announcements').filter(a => a.status === 'Active'));
  }

  if (action === 'checkPayment') {
    const refId = e.parameter.refId;
    const transaction = DB.findBy('Transactions', 'referenceId', refId);
    if (transaction && transaction.status === 'Success') {
      const user = DB.findBy('Users', 'referenceId', refId);
      return jsonResponse({ success: true, passcode: user.passcode, username: user.username });
    }
    return jsonResponse({ success: false });
  }

  if (action === 'buyPlan') {
    return jsonResponse(initiatePurchase({
      planId: e.parameter.planId,
      mobileNumber: e.parameter.mobileNumber
    }));
  }

  if (page === 'payment_success') {
    const refId = (e.parameter.refId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    return HtmlService.createHtmlOutput(`
      <html>
        <head><title>Payment Success</title><script src="https://cdn.tailwindcss.com"></script></head>
        <body class="bg-slate-900 text-white flex items-center justify-center min-h-screen p-6">
          <div class="max-w-md w-full text-center space-y-6">
            <div class="text-6xl text-emerald-500">✅</div>
            <h1 class="text-2xl font-bold">Payment Successful!</h1>
            <p class="text-slate-400">Please wait while we prepare your connection. You will be redirected shortly.</p>
            <div class="animate-pulse text-sm text-blue-400">Syncing with router...</div>
            <script>
              async function checkSync() {
                try {
                  const res = await fetch('?action=checkPayment&refId=${refId}');
                  const data = await res.json();
                  if (data.success) {
                    // Redirect back to Mikrotik with credentials
                    window.location.href = 'http://hotspot.bukid.net/login?action=from_payment&user=' + data.username + '&pass=' + data.passcode;
                  } else {
                    setTimeout(checkSync, 2000);
                  }
                } catch(e) { setTimeout(checkSync, 2000); }
              }
              checkSync();
            </script>
          </div>
        </body>
      </html>
    `);
  }

  // Mikrotik Sync Endpoints
  if (action === 'getNewUsers') {
    const token = e.parameter.token;
    if (token !== PropertiesService.getScriptProperties().getProperty('MIKROTIK_TOKEN')) {
      return ContentService.createTextOutput('Unauthorized').setMimeType(ContentService.MimeType.TEXT);
    }
    // IMPORTANT: Only return READY users (those who paid). NEVER 'Pending'.
    const users = DB.getData('Users').filter(u => u.syncStatus === 'Ready' && u.connectionStatus !== 'Synced');
    const plans = DB.getData('Plans');

    // Format: username,passcode,durationHours,speedLimit;...
    const result = users.map(u => {
      const plan = plans.find(p => p.id === u.planId);
      let durationStr = '00:00:00';
      if (plan && plan.durationHours) {
        const h = Math.floor(plan.durationHours);
        const m = Math.round((plan.durationHours - h) * 60);
        durationStr = (h < 10 ? '0'+h : h) + ':' + (m < 10 ? '0'+m : m) + ':00';
      }
      const speed = plan ? (plan.speedLimit || '') : '';
      return `${u.username},${u.passcode},${durationStr},${speed}`;
    }).join('|');

    return ContentService.createTextOutput(result).setMimeType(ContentService.MimeType.TEXT);
  }

  if (action === 'getKickList') {
    const token = e.parameter.token;
    if (token !== PropertiesService.getScriptProperties().getProperty('MIKROTIK_TOKEN')) {
      return ContentService.createTextOutput('Unauthorized').setMimeType(ContentService.MimeType.TEXT);
    }

    const now = new Date();
    const users = DB.getData('Users').filter(u => {
      if (u.syncStatus === 'Expired' || u.syncStatus === 'Disabled') return true;
      if (u.syncStatus === 'Synced' && u.expirationDate) {
        return new Date(u.expirationDate) < now;
      }
      return false;
    });

    const result = users.map(u => u.username).join('|');
    return ContentService.createTextOutput(result).setMimeType(ContentService.MimeType.TEXT);
  }

  if (action === 'markSynced') {
    const token = e.parameter.token;
    if (token !== PropertiesService.getScriptProperties().getProperty('MIKROTIK_TOKEN')) {
      return jsonResponse({ error: 'Unauthorized' });
    }
    const usernames = (e.parameter.usernames || '').split(',');
    usernames.forEach(uname => {
      if (!uname) return;
      const user = DB.findBy('Users', 'username', uname.trim());
      if (user) {
        DB.update('Users', user._row, { syncStatus: 'Synced' });
      }
    });
    return jsonResponse({ success: true });
  }

  return HtmlService.createHtmlOutput('<h1>WiFi sa Bukid</h1><p>Backend is running.</p>');
}

function doPost(e) {
  // Handle RPC or other POSTs from the Admin Portal or Hotspot
  if (e.parameter.rpc) {
    return handleRpc(e);
  }

  // Handle Paymongo Webhook (Checkout Sessions & Links)
  try {
    const postData = JSON.parse(e.postData.contents);
    const type = postData.data.attributes.type;

    if (type === 'checkout_session.payment.paid') {
      const checkoutSession = postData.data.attributes.data.attributes;
      const referenceId = checkoutSession.reference_number;
      if (referenceId) processSuccessfulPayment(referenceId);
      return ContentService.createTextOutput('OK');
    }

    if (type === 'link.payment.paid') {
      const linkPayment = postData.data.attributes.data.attributes;
      const referenceId = linkPayment.remarks; // Link API uses remarks for our refId
      if (referenceId) processSuccessfulPayment(referenceId);
      return ContentService.createTextOutput('OK');
    }
  } catch (err) {
    return ContentService.createTextOutput('Error: ' + err.toString());
  }
}

function handleRpc(e) {
  const payload = JSON.parse(e.postData.contents);
  const method = payload.method;
  const args = payload.args || [];

  // Basic security for Admin RPC and Mikrotik RPC
  const adminPassword = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  const mToken = PropertiesService.getScriptProperties().getProperty('MIKROTIK_TOKEN');

  const isAuthorized = (payload.password === adminPassword) ||
                       (payload.token === mToken && (method === 'updateConnection')) ||
                       (method === 'buyPlan');

  if (!isAuthorized) {
    return jsonResponse({ error: 'Unauthorized' });
  }

  if (method === 'getDashboardData') {
    return jsonResponse({
      sales: DB.getData('Transactions').filter(t => t.status === 'Success'),
      users: DB.getData('Users'),
      plans: DB.getData('Plans'),
      announcements: DB.getData('Announcements'),
      settings: DB.getData('Settings')
    });
  }

  if (method === 'buyPlan') {
    return jsonResponse(initiatePurchase(args[0]));
  }

  if (method === 'saveUser') {
    const user = args[0];
    if (user._row) {
      DB.update('Users', user._row, user);
    } else {
      DB.insert('Users', user);
    }
    return jsonResponse({ success: true });
  }

  if (method === 'savePlan') {
    const plan = args[0];
    if (plan._row) {
      DB.update('Plans', plan._row, plan);
    } else {
      DB.insert('Plans', plan);
    }
    return jsonResponse({ success: true });
  }

  if (method === 'updateConnection') {
    const { username, status } = args[0];
    const user = DB.findBy('Users', 'username', username);
    if (user) {
      DB.update('Users', user._row, { connectionStatus: status });
    }
    return jsonResponse({ success: true });
  }
}

function initiatePurchase(data) {
  try {
    const plan = DB.findBy('Plans', 'id', data.planId);
    if (!plan) throw new Error('Selected plan not found.');

    const referenceId = 'REF' + new Date().getTime();
    const passcode = Math.floor(100000 + Math.random() * 900000).toString();
    const username = data.mobileNumber;

    // Save pending transaction
    DB.insert('Transactions', {
      referenceId: referenceId,
      mobileNumber: data.mobileNumber,
      planId: data.planId,
      amount: plan.price,
      status: 'Pending',
      timestamp: new Date()
    });

    // Save pending user
    DB.insert('Users', {
      username: username,
      passcode: passcode,
      planId: data.planId,
      mobileNumber: data.mobileNumber,
      referenceId: referenceId,
      syncStatus: 'Pending',
      expirationDate: '',
      connectionStatus: 'Offline'
    });

    const checkoutUrl = PaymongoService.createPaymentLink(plan.price, 'WiFi Plan: ' + plan.name, referenceId);
    return { success: true, checkoutUrl: checkoutUrl, referenceId: referenceId };
  } catch (err) {
    console.error('initiatePurchase Error:', err);
    return { success: false, error: err.message };
  }
}

function processSuccessfulPayment(referenceId) {
  const transaction = DB.findBy('Transactions', 'referenceId', referenceId);
  if (transaction && transaction.status === 'Pending') {
    DB.update('Transactions', transaction._row, { status: 'Success' });

    const user = DB.findBy('Users', 'referenceId', referenceId);
    const plan = DB.findBy('Plans', 'id', user.planId);

    // Calculate expiration
    const now = new Date();
    const expiration = new Date(now.getTime() + (plan.durationHours * 60 * 60 * 1000));

    DB.update('Users', user._row, {
      syncStatus: 'Ready',
      expirationDate: expiration.toISOString()
    });

    // Send SMS
    const message = 'Thank you for your purchase! Your passcode for WiFi sa Bukid is: ' + user.passcode + '. Valid for ' + plan.durationHours + ' hours.';
    SemaphoreService.sendSMS(user.mobileNumber, message);
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Wrapper for google.script.run calls from the Admin Portal
 * Requires adminPassword as the first argument for all sensitive operations.
 */
function handleRpcManual(method, args, password) {
  const adminPassword = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');

  if (password !== adminPassword) {
    throw new Error('Unauthorized: Invalid Admin Password');
  }

  if (method === 'getDashboardData') {
    return {
      sales: DB.getData('Transactions').filter(t => t.status === 'Success'),
      users: DB.getData('Users'),
      plans: DB.getData('Plans'),
      announcements: DB.getData('Announcements'),
      settings: DB.getData('Settings')
    };
  }

  if (method === 'saveUser') {
    const user = args[0];
    if (user._row) {
      return DB.update('Users', user._row, user);
    } else {
      return DB.insert('Users', user);
    }
  }

  if (method === 'savePlan') {
    const plan = args[0];
    if (plan._row) {
      return DB.update('Plans', plan._row, plan);
    } else {
      return DB.insert('Plans', plan);
    }
  }

  if (method === 'saveAnnouncement') {
    const ann = args[0];
    if (ann._row) {
      return DB.update('Announcements', ann._row, ann);
    } else {
      return DB.insert('Announcements', ann);
    }
  }

  if (method === 'deleteAnnouncement') {
    const ann = args[0];
    if (ann._row) {
      return DB.delete('Announcements', ann._row);
    }
  }

  if (method === 'updateKeys') {
    const { paymongo, semaphore, token } = args[0];
    const props = PropertiesService.getScriptProperties();
    if (paymongo) props.setProperty('PAYMONGO_SECRET_KEY', paymongo);
    if (semaphore) props.setProperty('SEMAPHORE_API_KEY', semaphore);
    if (token) props.setProperty('MIKROTIK_TOKEN', token);
    return { success: true };
  }

  if (method === 'changePassword') {
    const { password } = args[0];
    PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', password);
    return { success: true };
  }

  return { error: 'Unknown method' };
}
