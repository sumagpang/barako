function getDashboardData(filterMonth) {
  var users = getUsers();
  var transactions = getTransactions(); // Now implemented in Database.js

  var totalSales = 0;
  var planCounts = {};
  var topUsersMap = {};

  // Filter by month (YYYY-MM)
  if (filterMonth) {
    transactions = transactions.filter(function(tx) {
      var d = new Date(tx.date);
      var m = d.getFullYear() + "-" + ("0" + (d.getMonth()+1)).slice(-2);
      return m === filterMonth;
    });
  }

  // Aggregate Transactions
  transactions.forEach(function(tx) {
    if (tx.status === 'PAID') {
      totalSales += tx.amount;

      if (!topUsersMap[tx.mobile]) topUsersMap[tx.mobile] = 0;
      topUsersMap[tx.mobile] += tx.amount;

      if (!planCounts[tx.planId]) planCounts[tx.planId] = 0;
      planCounts[tx.planId]++;
    }
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
    traffic: { download: "100GB", upload: "50GB" }
  };
}

function kickUser(mobile) {
  var ss = getDbConnection();
  if (!ss) return mockKickUser(mobile);

  var sheet = ss.getSheetByName("Users");
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == mobile) {
      sheet.getRange(i + 1, 6).setValue("KICK");
      return true;
    }
  }
  return false;
}

function mockKickUser(mobile) {
  console.log("Mock Kick User:", mobile);
  return true;
}
