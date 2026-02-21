/**
 * Code.js - Main entry point and request handling (Paymongo + Wallet System)
 */

const TOP_UP_AMOUNT = 100;

function doGet(e) {
  try {
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

  if (action === 'getUserInfo') {
    const mobile = e.parameter.mobileNumber;
    const user = DB.findBy('Users', 'mobileNumber', mobile);
    if (user) {
      return jsonResponse({ success: true, balance: user.balance || 0 });
    }
    return jsonResponse({ success: true, balance: 0 });
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

  if (action === 'topUp') {
    return jsonResponse(initiateTopUp(e.parameter.mobileNumber));
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
            <p class="text-slate-400">Please wait while we prepare your connection.</p>
            <div class="animate-pulse text-sm text-blue-400">Processing...</div>
            <script>
              async function checkSync() {
                try {
                  const res = await fetch('?action=checkPayment&refId=${refId}');
                  const data = await res.json();
                  if (data.success) {
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
    const users = DB.getData('Users').filter(u => u.syncStatus === 'Ready');
    const plans = DB.getData('Plans');

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
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    if (e.parameter.rpc) {
      return handleRpc(e);
    }

    try {
      const postData = JSON.parse(e.postData.contents);
      if (postData.data && postData.data.attributes && postData.data.attributes.type === 'checkout_session.payment.paid') {
        const referenceId = postData.data.attributes.data.attributes.reference_number;
        if (referenceId) processSuccessfulPayment(referenceId);
        return ContentService.createTextOutput('OK');
      }
    } catch (err) {
      return ContentService.createTextOutput('Error: ' + err.toString());
    }

    return ContentService.createTextOutput('No action');
  } catch (err) {
    return ContentService.createTextOutput('Global Error: ' + err.toString());
  }
}

function handleRpc(e) {
  const payload = JSON.parse(e.postData.contents);
  const method = payload.method;
  const args = payload.args || [];

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

function initiateTopUp(mobileNumber) {
  try {
    const referenceId = 'TOP' + new Date().getTime();
    DB.insert('Transactions', {
      referenceId: referenceId,
      mobileNumber: mobileNumber,
      planId: 'TOPUP',
      amount: TOP_UP_AMOUNT,
      status: 'Pending',
      timestamp: new Date()
    });

    const checkoutUrl = PaymongoService.createPaymentLink(TOP_UP_AMOUNT, 'Wallet Top Up: ₱' + TOP_UP_AMOUNT, referenceId);
    return { success: true, checkoutUrl: checkoutUrl, referenceId: referenceId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function initiatePurchase(data) {
  try {
    const plan = DB.findBy('Plans', 'id', data.planId);
    if (!plan) throw new Error('Selected plan not found.');

    const mobileNumber = data.mobileNumber;
    let user = DB.findBy('Users', 'mobileNumber', mobileNumber);

    if (!user) {
      // Auto-create user with 0 balance
      DB.insert('Users', {
        username: mobileNumber,
        mobileNumber: mobileNumber,
        balance: 0,
        syncStatus: 'None',
        connectionStatus: 'Offline'
      });
      user = DB.findBy('Users', 'mobileNumber', mobileNumber);
    }

    // Case 1: Plan is >= 100 PHP, use Paymongo directly
    if (plan.price >= 100) {
      const referenceId = 'REF' + new Date().getTime();
      const passcode = Math.floor(100000 + Math.random() * 900000).toString();

      DB.insert('Transactions', {
        referenceId: referenceId,
        mobileNumber: mobileNumber,
        planId: data.planId,
        amount: plan.price,
        status: 'Pending',
        timestamp: new Date()
      });

      DB.update('Users', user._row, {
        passcode: passcode,
        planId: data.planId,
        referenceId: referenceId,
        syncStatus: 'Pending'
      });

      const checkoutUrl = PaymongoService.createPaymentLink(plan.price, 'WiFi Plan: ' + plan.name, referenceId);
      return { success: true, checkoutUrl: checkoutUrl, referenceId: referenceId };
    }

    // Case 2: Plan is < 100 PHP, must use Balance
    if ((user.balance || 0) >= plan.price) {
      const referenceId = 'BAL' + new Date().getTime();
      const passcode = Math.floor(100000 + Math.random() * 900000).toString();

      // Deduct balance
      DB.update('Users', user._row, { balance: (user.balance || 0) - plan.price });

      // Record transaction
      DB.insert('Transactions', {
        referenceId: referenceId,
        mobileNumber: mobileNumber,
        planId: data.planId,
        amount: plan.price,
        status: 'Success',
        timestamp: new Date()
      });

      // Activate plan immediately
      const now = new Date();
      const expiration = new Date(now.getTime() + (plan.durationHours * 60 * 60 * 1000));

      DB.update('Users', user._row, {
        passcode: passcode,
        planId: data.planId,
        referenceId: referenceId,
        syncStatus: 'Ready',
        expirationDate: expiration.toISOString()
      });

      const message = 'Success! Your passcode for WiFi sa Bukid is: ' + passcode + '. Balance: ₱' + (user.balance - plan.price);
      SemaphoreService.sendSMS(mobileNumber, message);

      return { success: true, passcode: passcode, username: mobileNumber, isBalance: true };
    } else {
      return { success: false, error: 'Insufficient Balance. Please Top Up at least ₱100.', needsTopUp: true };
    }
  } catch (err) {
    console.error('initiatePurchase Error:', err);
    return { success: false, error: err.message };
  }
}

function processSuccessfulPayment(referenceId) {
  const transaction = DB.findBy('Transactions', 'referenceId', referenceId);
  if (transaction && transaction.status === 'Pending') {
    DB.update('Transactions', transaction._row, { status: 'Success' });

    if (referenceId.startsWith('TOP')) {
      // Handle Top Up
      const user = DB.findBy('Users', 'mobileNumber', transaction.mobileNumber);
      if (user) {
        DB.update('Users', user._row, { balance: (user.balance || 0) + transaction.amount });
      }
      // Create a dummy user record for checkPayment to succeed if they are waiting
      DB.update('Users', user._row, { referenceId: referenceId });
      SemaphoreService.sendSMS(user.mobileNumber, 'Top Up Successful! Your new balance is ₱' + (user.balance + transaction.amount));
    } else {
      // Handle Direct Purchase
      const user = DB.findBy('Users', 'referenceId', referenceId);
      const plan = DB.findBy('Plans', 'id', user.planId);

      const now = new Date();
      const expiration = new Date(now.getTime() + (plan.durationHours * 60 * 60 * 1000));

      DB.update('Users', user._row, {
        syncStatus: 'Ready',
        expirationDate: expiration.toISOString()
      });

      const message = 'Thank you for your purchase! Your passcode for WiFi sa Bukid is: ' + user.passcode + '. Valid for ' + plan.durationHours + ' hours.';
      SemaphoreService.sendSMS(user.mobileNumber, message);
    }
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function handleRpcManual(method, args, password) {
  const adminPassword = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (password !== adminPassword) throw new Error('Unauthorized');

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
    if (user._row) return DB.update('Users', user._row, user);
    else return DB.insert('Users', user);
  }

  if (method === 'savePlan') {
    const plan = args[0];
    if (plan._row) return DB.update('Plans', plan._row, plan);
    else return DB.insert('Plans', plan);
  }

  if (method === 'saveAnnouncement') {
    const ann = args[0];
    if (ann._row) return DB.update('Announcements', ann._row, ann);
    else return DB.insert('Announcements', ann);
  }

  if (method === 'deleteRecord') {
    const { table, row } = args[0];
    return DB.deleteRow(table, row);
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
