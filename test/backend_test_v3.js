/**
 * backend_test_v3.js - Test for Multi-Gateway support
 */

const fs = require('fs');
const path = require('path');

// Load mocks
require('./mocks.js');

// Load backend files
const DatabaseCode = fs.readFileSync(path.join(__dirname, '../src/backend/Database.js'), 'utf8');
const ServicesCode = fs.readFileSync(path.join(__dirname, '../src/backend/Services.js'), 'utf8');
const MainCode = fs.readFileSync(path.join(__dirname, '../src/backend/Code.js'), 'utf8');

eval(DatabaseCode);
eval(ServicesCode);
eval(MainCode);

console.log('--- TEST START ---');

// Setup
DB.insert('Plans', { id: 'p1', name: 'Plan 1', price: 50, durationHours: 1, speedLimit: '1M/1M', status: 'Active' });

// 1. Test Xendit (Default)
console.log('Testing Xendit Gateway (Default)...');
DB.setSetting('GATEWAY', 'Xendit');
const resX = initiatePurchase({ planId: 'p1', mobileNumber: '09123' });
console.log('Xendit Checkout URL:', resX.checkoutUrl);
if (resX.checkoutUrl && resX.checkoutUrl.includes('xendit')) {
  console.log('✅ Xendit Integration SUCCESS');
} else {
  console.error('❌ Xendit Integration FAILED');
  process.exit(1);
}

// 2. Test Paymongo
console.log('Testing Paymongo Gateway...');
DB.setSetting('GATEWAY', 'Paymongo');
const resP = initiatePurchase({ planId: 'p1', mobileNumber: '09123' });
console.log('Paymongo Checkout URL:', resP.checkoutUrl);
if (resP.checkoutUrl && resP.checkoutUrl.includes('paymongo')) {
  console.log('✅ Paymongo Integration SUCCESS');
} else {
  console.error('❌ Paymongo Integration FAILED');
  process.exit(1);
}

// 3. Test Webhooks
console.log('Testing Webhooks...');

// Xendit Webhook
console.log(' - Testing Xendit Webhook...');
DB.insert('Transactions', { referenceId: 'REF_X', status: 'Pending' });
DB.insert('Users', { username: 'user_x', referenceId: 'REF_X', syncStatus: 'Pending', planId: 'p1', mobileNumber: '091' });
doPost({
  parameter: {},
  postData: { contents: JSON.stringify({ status: 'PAID', external_id: 'REF_X' }) }
});
if (DB.findBy('Users', 'username', 'user_x').syncStatus === 'Ready') {
  console.log('   ✅ Xendit Webhook SUCCESS');
} else {
  console.error('   ❌ Xendit Webhook FAILED');
  process.exit(1);
}

// Paymongo Webhook
console.log(' - Testing Paymongo Webhook...');
DB.insert('Transactions', { referenceId: 'REF_P', status: 'Pending' });
DB.insert('Users', { username: 'user_p', referenceId: 'REF_P', syncStatus: 'Pending', planId: 'p1', mobileNumber: '092' });
doPost({
  parameter: {},
  postData: { contents: JSON.stringify({
    data: { attributes: { type: 'checkout_session.payment.paid', data: { attributes: { reference_number: 'REF_P' } } } }
  }) }
});
if (DB.findBy('Users', 'username', 'user_p').syncStatus === 'Ready') {
  console.log('   ✅ Paymongo Webhook SUCCESS');
} else {
  console.error('   ❌ Paymongo Webhook FAILED');
  process.exit(1);
}

console.log('--- ALL TESTS PASSED ---');
