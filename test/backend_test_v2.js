/**
 * backend_test_v2.js - Updated test for sync logic
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

// Test Sync Logic
console.log('Testing getNewUsers...');
// Pre-populate a user
DB.insert('Users', { username: 'sync_test', passcode: '111', syncStatus: 'Ready', planId: 'p1' });

const e = {
  parameter: {
    action: 'getNewUsers',
    token: 'secret'
  }
};
// Token is 'secret' in mocks.js

const usersResponse = JSON.parse(doGet(e).getContent());
console.log('getNewUsers Response:', usersResponse);

if (usersResponse.length > 0 && usersResponse[0].durationHours === 1) {
  console.log('✅ getNewUsers SUCCESS (durationHours attached)');
} else {
  console.error('❌ getNewUsers FAILED');
  process.exit(1);
}

console.log('Testing markSynced...');
const eMark = {
  parameter: {
    action: 'markSynced',
    token: 'secret',
    usernames: 'sync_test'
  }
};
const markResponse = JSON.parse(doGet(eMark).getContent());
console.log('markSynced Response:', markResponse);

const updatedUser = DB.findBy('Users', 'username', 'sync_test');
if (markResponse.success && updatedUser.syncStatus === 'Synced') {
  console.log('✅ markSynced SUCCESS');
} else {
  console.error('❌ markSynced FAILED');
  process.exit(1);
}

// Test getNewUsers again (should be empty for 'Synced' users)
const usersResponse2 = JSON.parse(doGet(e).getContent());
if (usersResponse2.every(u => u.username !== 'sync_test')) {
  console.log('✅ getNewUsers exclusion SUCCESS');
} else {
  console.error('❌ getNewUsers exclusion FAILED');
  process.exit(1);
}

console.log('All V2 tests passed!');
