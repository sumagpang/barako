/**
 * backend_test.js - Test backend logic using mocks
 */

const fs = require('fs');
const path = require('path');

// Load mocks
require('./mocks.js');

// Load backend files (as commonjs-ish)
const DatabaseCode = fs.readFileSync(path.join(__dirname, '../src/backend/Database.js'), 'utf8');
const ServicesCode = fs.readFileSync(path.join(__dirname, '../src/backend/Services.js'), 'utf8');
const MainCode = fs.readFileSync(path.join(__dirname, '../src/backend/Code.js'), 'utf8');

eval(DatabaseCode);
eval(ServicesCode);
eval(MainCode);

// Test Purchase Logic
console.log('Testing initiatePurchase...');
const purchaseResult = initiatePurchase({ planId: 'p1', mobileNumber: '09123456789' });
console.log('Purchase Result:', purchaseResult);

if (purchaseResult.checkoutUrl === 'http://checkout.mock') {
  console.log('✅ initiatePurchase SUCCESS');
} else {
  console.error('❌ initiatePurchase FAILED');
  process.exit(1);
}

// Test Payment Success Logic
console.log('Testing processSuccessfulPayment...');
processSuccessfulPayment(purchaseResult.referenceId);

const user = DB.findBy('Users', 'referenceId', purchaseResult.referenceId);
if (user && user.syncStatus === 'Ready') {
  console.log('✅ processSuccessfulPayment SUCCESS');
} else {
  console.error('❌ processSuccessfulPayment FAILED', user);
  process.exit(1);
}

// Test CRUD logic
console.log('Testing saveUser...');
handleRpcManual('saveUser', [{ username: '09000000000', passcode: '123456', syncStatus: 'Ready' }]);
const newUser = DB.findBy('Users', 'username', '09000000000');
if (newUser && newUser.passcode === '123456') {
  console.log('✅ saveUser SUCCESS');
} else {
  console.error('❌ saveUser FAILED');
  process.exit(1);
}

console.log('All tests passed!');
