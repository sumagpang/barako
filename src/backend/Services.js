/**
 * Services.js - Higher level business logic
 */

function handlePaymongoWebhook(payload) {
  const event = payload.data.attributes.type;
  const data = payload.data.attributes.data;
  const db = new Database();

  console.log("Processing Webhook Event: " + event);

  if (event === 'checkout_session.payment.paid' || event === 'link.payment.paid') {
    const checkoutSession = event === 'checkout_session.payment.paid'
      ? new PaymongoService().getCheckoutSession(data.id)
      : data;

    const refId = checkoutSession.attributes.reference_number || checkoutSession.id;
    const description = checkoutSession.attributes.description;

    console.log("Webhook Metadata: " + description);

    // Check if it's a Wallet Top Up
    if (description.includes("Wallet Top Up")) {
       const mobileMatch = description.match(/for (09\d{9})/);
       if (mobileMatch) {
          const mobile = mobileMatch[1];
          const amount = checkoutSession.attributes.line_items[0].amount / 100;
          topUpWallet(mobile, amount, refId);
       }
       return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }

    const planMatch = description.match(/WiFi Plan: (.*) for (09\d{9})/);
    if (planMatch) {
      const planName = planMatch[1];
      const mobile = planMatch[2];
      const plan = db.getData('Plans').find(p => p.name === planName);

      if (plan) {
        activatePlan(mobile, plan, refId);
      }
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function topUpWallet(mobile, amount, refId) {
  const db = new Database();
  let user = db.findByField('Users', 'username', mobile);

  if (!user) {
    user = { username: mobile, mobile: mobile, balance: 0, status: 'Active', syncStatus: 'Synced' };
    db.addRow('Users', user);
    user = db.findByField('Users', 'username', mobile);
  }

  const newBalance = (parseFloat(user.balance) || 0) + parseFloat(amount);
  db.updateRow('Users', user._row, { balance: newBalance });

  db.addRow('Transactions', {
    userId: mobile,
    amount: amount,
    type: 'TopUp',
    status: 'Success',
    date: new Date().toISOString(),
    refId: refId
  });

  new SemaphoreService().sendSMS(mobile, `ARASU WiFi: Wallet Top Up successful! New balance: PHP ${newBalance}. You can now buy plans directly from the portal.`);
}

function activatePlan(mobile, plan, refId) {
  const db = new Database();
  const username = mobile;
  const password = Math.random().toString(36).substr(2, 6);

  // Calculate expiration date
  const now = new Date();
  const durationParts = plan.duration.match(/(\d+)([hmd])/);
  let expirationDate = new Date(now);
  if (durationParts) {
    const value = parseInt(durationParts[1]);
    const unit = durationParts[2];
    if (unit === 'h') expirationDate.setHours(now.getHours() + value);
    if (unit === 'd') expirationDate.setDate(now.getDate() + value);
    if (unit === 'm') expirationDate.setMinutes(now.getMinutes() + value);
  }

  const user = {
    username: username,
    password: password,
    expirationDate: expirationDate.toISOString(),
    status: 'Ready',
    syncStatus: 'Ready',
    mobile: mobile,
    planId: plan.id,
    duration: plan.duration, // Pass duration to Mikrotik limit-uptime
    balance: 0
  };

  db.addRow('Users', user);

  db.addRow('Transactions', {
    userId: username,
    amount: plan.price,
    type: 'Purchase',
    status: 'Success',
    date: new Date().toISOString(),
    refId: refId
  });

  // Send SMS
  const sms = new SemaphoreService();
  const msg = `ARASU WiFi: Payment successful! Your login: User: ${username}, Pass: ${password}. Valid until ${expirationDate.toLocaleString()}.`;
  sms.sendSMS(mobile, msg);
}

// Function called by frontend buyPlan (RPC)
function initiatePurchase(planId, mobile, customAmount) {
  const db = new Database();
  const webAppUrl = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL');
  const paymongo = new PaymongoService();

  if (planId === 'topup') {
    const fakePlan = { name: "Wallet Top Up", price: customAmount };
    const session = paymongo.createCheckoutSession(
      fakePlan, mobile,
      `${webAppUrl}?action=payment_success&refId=topup`,
      webAppUrl
    );
    return session.attributes.checkout_url;
  }

  const plan = db.findByField('Plans', 'id', planId);
  if (!plan) throw new Error("Plan not found");

  const session = paymongo.createCheckoutSession(
    plan, mobile,
    `${webAppUrl}?action=payment_success&refId=pending`,
    webAppUrl
  );

  return session.attributes.checkout_url;
}

function buyPlanWithBalance(planId, mobile) {
  const db = new Database();
  const user = db.findByField('Users', 'username', mobile);
  const plan = db.findByField('Plans', 'id', planId);

  if (!user || !plan) throw new Error("Account or Plan not found");
  if (parseFloat(user.balance) < parseFloat(plan.price)) throw new Error("Insufficient balance");

  const newBalance = parseFloat(user.balance) - parseFloat(plan.price);
  db.updateRow('Users', user._row, { balance: newBalance });

  activatePlan(mobile, plan, 'WALLET-' + Math.random().toString(36).substr(2, 6));
}
