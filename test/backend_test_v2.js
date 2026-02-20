/**
 * backend_test_v2.js - Updated test for sync logic and webhook
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

// 1. Test getNewUsers (Should be CSV)
console.log('Testing getNewUsers (CSV output)...');
// Pre-populate a plan with speed limit
DB.insert('Plans', { id: 'p1', name: 'Plan 1', durationHours: 1, speedLimit: '1M/1M', status: 'Active' });
// Pre-populate a user
DB.insert('Users', { username: 'sync_test', passcode: '111', syncStatus: 'Ready', planId: 'p1', connectionStatus: 'Offline' });
DB.insert('Users', { username: 'unpaid_user', passcode: '222', syncStatus: 'Pending', planId: 'p1', connectionStatus: 'Offline' });

const e = {
  parameter: {
    action: 'getNewUsers',
    token: 'secret'
  }
};

const usersResponse = doGet(e).getContent();
console.log('getNewUsers Response:', usersResponse);

if (usersResponse.includes('sync_test,111,01:00:00,1M/1M') && !usersResponse.includes('unpaid_user')) {
  console.log('✅ getNewUsers SUCCESS (Ready users only, CSV format with speed)');
} else {
  console.error('❌ getNewUsers FAILED');
  process.exit(1);
}

// 2. Test Webhook (Checkout Session)
console.log('Testing Paymongo Checkout Webhook...');
const eWeb = {
  parameter: {}, // ADDED THIS
  postData: {
    contents: JSON.stringify({
      data: {
        attributes: {
          type: 'checkout_session.payment.paid',
          data: {
            attributes: {
              reference_number: 'REF_TEST_999'
            }
          }
        }
      }
    })
  }
};

// Create a pending user/transaction for this ref
DB.insert('Transactions', { referenceId: 'REF_TEST_999', status: 'Pending' });
DB.insert('Users', { username: 'paid_user', referenceId: 'REF_TEST_999', syncStatus: 'Pending', planId: 'p1', mobileNumber: '09123' });

const webResponse = doPost(eWeb).getContent();
console.log('Webhook Response:', webResponse);

const updatedUser = DB.findBy('Users', 'username', 'paid_user');
if (updatedUser.syncStatus === 'Ready') {
  console.log('✅ Webhook processing SUCCESS');
} else {
  console.error('❌ Webhook processing FAILED');
  process.exit(1);
}

// 3. Test markSynced
console.log('Testing markSynced...');
const eMark = {
  parameter: {
    action: 'markSynced',
    token: 'secret',
    usernames: 'sync_test'
  }
};
const markResponse = JSON.parse(doGet(eMark).getContent());
const userAfterSync = DB.findBy('Users', 'username', 'sync_test');
if (markResponse.success && userAfterSync.syncStatus === 'Synced') {
  console.log('✅ markSynced SUCCESS');
} else {
  console.error('❌ markSynced FAILED');
  process.exit(1);
}

console.log('--- ALL TESTS PASSED ---');
