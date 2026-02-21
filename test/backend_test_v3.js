/**
 * backend_test_v3.js - Test for Wallet System
 */

const fs = require('fs');
const path = require('path');

require('./mocks.js');
const DatabaseCode = fs.readFileSync(path.join(__dirname, '../src/backend/Database.js'), 'utf8');
const ServicesCode = fs.readFileSync(path.join(__dirname, '../src/backend/Services.js'), 'utf8');
const MainCode = fs.readFileSync(path.join(__dirname, '../src/backend/Code.js'), 'utf8');

eval(DatabaseCode);
eval(ServicesCode);
eval(MainCode);

console.log('--- WALLET TEST START ---');

// 1. Test Big Plan (Direct Paymongo)
console.log('Testing Big Plan (₱150)...');
const resBig = initiatePurchase({ planId: 'p2', mobileNumber: '091' });
if (resBig.success && resBig.checkoutUrl.includes('paymongo')) {
  console.log('✅ Direct Paymongo SUCCESS');
} else {
  console.error('❌ Direct Paymongo FAILED');
  process.exit(1);
}

// 2. Test Small Plan (Insufficient Balance)
console.log('Testing Small Plan (₱5) - Insufficient...');
const resSmallFail = initiatePurchase({ planId: 'p1', mobileNumber: '091' });
if (!resSmallFail.success && resSmallFail.needsTopUp) {
  console.log('✅ Insufficient Balance Detection SUCCESS');
} else {
  console.error('❌ Insufficient Balance Detection FAILED', resSmallFail);
  process.exit(1);
}

// 3. Test Top Up
console.log('Testing Top Up (₱100)...');
const resTop = initiateTopUp('091');
if (resTop.success && resTop.checkoutUrl.includes('paymongo')) {
  console.log('✅ Top Up Link Generation SUCCESS');
} else {
  console.error('❌ Top Up Link Generation FAILED');
  process.exit(1);
}

// 4. Test Top Up Webhook Success
console.log('Testing Top Up Webhook...');
doPost({
  parameter: {},
  postData: { contents: JSON.stringify({
    data: { attributes: { type: 'checkout_session.payment.paid', data: { attributes: { reference_number: resTop.referenceId } } } }
  }) }
});
const user = DB.findBy('Users', 'mobileNumber', '091');
if (user && user.balance === 100) {
  console.log('✅ Wallet Credit SUCCESS (Balance: ₱100)');
} else {
  console.error('❌ Wallet Credit FAILED', user);
  process.exit(1);
}

// 5. Test Small Plan (Sufficient Balance)
console.log('Testing Small Plan (₱5) - Sufficient...');
const resSmallSuccess = initiatePurchase({ planId: 'p1', mobileNumber: '091' });
const userAfter = DB.findBy('Users', 'mobileNumber', '091');
if (resSmallSuccess.success && resSmallSuccess.passcode && userAfter.balance === 95) {
  console.log('✅ Balance Purchase SUCCESS (Passcode generated, Balance: ₱95)');
} else {
  console.error('❌ Balance Purchase FAILED', resSmallSuccess, userAfter);
  process.exit(1);
}

console.log('--- ALL WALLET TESTS PASSED ---');
