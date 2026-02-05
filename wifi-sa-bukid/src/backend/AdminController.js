function getDashboardData(filterMonth) {
  var users = getUsers();
  // Transactions aren't fully implemented in Database.js mocks perfectly yet, so we'll mock aggregation
  // In a real app, we'd read Transactions sheet.

  var totalSales = 0;
  var planCounts = {};
  var topUsersMap = {};

  // Mock logic for aggregation
  users.forEach(function(u) {
    if (!planCounts[u.planId]) planCounts[u.planId] = 0;
    planCounts[u.planId]++;

    // Assume flat rate for calculation if transaction missing
    var price = (u.planId === 'PLAN1') ? 10 : 50;
    totalSales += price;

    if (!topUsersMap[u.mobile]) topUsersMap[u.mobile] = 0;
    topUsersMap[u.mobile] += price;
  });

  var topUsers = Object.keys(topUsersMap).map(function(k) {
    return { mobile: k, total: topUsersMap[k] };
  }).sort(function(a,b) { return b.total - a.total; }).slice(0, 10);

  return {
    totalSales: totalSales,
    activeUsersCount: users.filter(function(u) { return u.status === 'ACTIVE'; }).length,
    planCounts: planCounts,
    topUsers: topUsers,
    activeUsers: users.filter(function(u) { return u.status === 'ACTIVE'; }),
    traffic: { download: "100GB", upload: "50GB" } // Mocked as GAS can't see RouterOS traffic directly
  };
}

function kickUser(mobile) {
  var ss = getDbConnection();
  if (!ss) return mockKickUser(mobile);

  var sheet = ss.getSheetByName("Users");
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == mobile) {
      sheet.getRange(i + 1, 6).setValue("KICK"); // Set status to KICK
      return true;
    }
  }
  return false;
}

function mockKickUser(mobile) {
  console.log("Mock Kick User:", mobile);
  return true;
}
