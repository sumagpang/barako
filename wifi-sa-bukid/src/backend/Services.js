var PaymongoService = {
  createSource: function(amount, currency, redirectUrl) {
    if (typeof UrlFetchApp === 'undefined') return mockCreateSource(amount);

    var keys = getApiKeys();
    var url = "https://api.paymongo.com/v1/sources";
    var options = {
      method: "post",
      headers: {
        "Authorization": "Basic " + Utilities.base64Encode(keys.PAYMONGO_SECRET_KEY + ":"),
        "Content-Type": "application/json"
      },
      payload: JSON.stringify({
        data: {
          attributes: {
            amount: amount * 100, // in centavos
            type: "gcash",
            currency: currency || "PHP",
            redirect: {
              success: redirectUrl,
              failed: redirectUrl
            }
          }
        }
      })
    };

    var response = UrlFetchApp.fetch(url, options);
    return JSON.parse(response.getContentText());
  },

  retrieveSource: function(id) {
    if (typeof UrlFetchApp === 'undefined') return mockRetrieveSource(id);

    var keys = getApiKeys();
    var url = "https://api.paymongo.com/v1/sources/" + id;
    var options = {
      method: "get",
      headers: {
        "Authorization": "Basic " + Utilities.base64Encode(keys.PAYMONGO_SECRET_KEY + ":")
      }
    };

    var response = UrlFetchApp.fetch(url, options);
    return JSON.parse(response.getContentText());
  },

  createPayment: function(sourceId, amount, description) {
    if (typeof UrlFetchApp === 'undefined') return mockCreatePayment(sourceId, amount);

    var keys = getApiKeys();
    var url = "https://api.paymongo.com/v1/payments";
    var options = {
      method: "post",
      headers: {
        "Authorization": "Basic " + Utilities.base64Encode(keys.PAYMONGO_SECRET_KEY + ":"),
        "Content-Type": "application/json"
      },
      payload: JSON.stringify({
        data: {
          attributes: {
            amount: amount * 100,
            currency: "PHP",
            description: description || "WiFi Payment",
            source: {
              id: sourceId,
              type: "source"
            }
          }
        }
      })
    };

    var response = UrlFetchApp.fetch(url, options);
    return JSON.parse(response.getContentText());
  }
};

var SemaphoreService = {
  sendSMS: function(mobile, message) {
    if (typeof UrlFetchApp === 'undefined') return mockSendSMS(mobile, message);

    var keys = getApiKeys();
    var url = "https://api.semaphore.co/api/v4/messages";
    var payload = {
      apikey: keys.SEMAPHORE_API_KEY,
      number: mobile,
      message: message,
      sendername: keys.SEMAPHORE_SENDER_NAME || "SEMAPHORE"
    };

    var options = {
      method: "post",
      payload: payload
    };

    var response = UrlFetchApp.fetch(url, options);
    return JSON.parse(response.getContentText());
  }
};

function getApiKeys() {
  if (typeof PropertiesService === 'undefined') {
    return {
      PAYMONGO_SECRET_KEY: "sk_test_mock",
      SEMAPHORE_API_KEY: "mock_key"
    };
  }
  return PropertiesService.getScriptProperties().getProperties();
}

// Mocks
function mockCreateSource(amount) {
  console.log("Mock Paymongo Create Source:", amount);
  return {
    data: {
      id: "src_mock_" + new Date().getTime(),
      attributes: {
        status: "pending",
        redirect: { checkout_url: "#mock_checkout" }
      }
    }
  };
}

function mockRetrieveSource(id) {
  return {
    data: {
      id: id,
      attributes: {
        status: "chargeable"
      }
    }
  };
}

function mockCreatePayment(sourceId, amount) {
  console.log("Mock Payment Capture:", sourceId, amount);
  return {
    data: {
      id: "pay_" + sourceId,
      attributes: {
        status: "paid"
      }
    }
  };
}

function mockSendSMS(mobile, message) {
  console.log("Mock SMS to " + mobile + ": " + message);
  return { status: "success" };
}
