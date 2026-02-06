var PaymongoService = {
  createCheckoutSession: function(amount, description, redirectUrl) {
    if (typeof UrlFetchApp === 'undefined') return mockCreateCheckoutSession(amount);

    var keys = getApiKeys();
    var url = "https://api.paymongo.com/v1/checkout_sessions";
    var options = {
      method: "post",
      headers: {
        "Authorization": "Basic " + Utilities.base64Encode(keys.PAYMONGO_SECRET_KEY + ":"),
        "Content-Type": "application/json"
      },
      muteHttpExceptions: true, // IMPORTANT: Inspect errors
      payload: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              {
                amount: Math.round(amount * 100), // ensure integer centavos
                currency: "PHP",
                name: description,
                quantity: 1
              }
            ],
            // Removed shopeepay to avoid potential 500 errors if unsupported.
            // Stick to core supported methods.
            payment_method_types: ["gcash", "paymaya", "grab_pay", "card"],
            success_url: redirectUrl,
            cancel_url: redirectUrl,
            description: description
          }
        }
      })
    };

    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();
    var content = response.getContentText();
    var json = JSON.parse(content);

    if (code >= 400) {
      // Log error details for debugging (visible in user's execution transcript)
      console.error("Paymongo Error " + code + ": " + JSON.stringify(json));
      var detail = (json.errors && json.errors[0] && json.errors[0].detail) ? json.errors[0].detail : "Unknown Error";
      throw "Paymongo Error: " + detail;
    }

    return json;
  },

  retrieveCheckoutSession: function(id) {
    if (typeof UrlFetchApp === 'undefined') return mockRetrieveCheckoutSession(id);

    var keys = getApiKeys();
    var url = "https://api.paymongo.com/v1/checkout_sessions/" + id;
    var options = {
      method: "get",
      headers: {
        "Authorization": "Basic " + Utilities.base64Encode(keys.PAYMONGO_SECRET_KEY + ":")
      },
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() >= 400) {
       throw "Paymongo Retrieve Error: " + response.getContentText();
    }
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
function mockCreateCheckoutSession(amount) {
  console.log("Mock Paymongo Create Checkout Session:", amount);
  return {
    data: {
      id: "cs_mock_" + new Date().getTime(),
      attributes: {
        checkout_url: "#mock_checkout_url",
        payment_status: "unpaid"
      }
    }
  };
}

function mockRetrieveCheckoutSession(id) {
  // Simulate successful payment for testing
  return {
    data: {
      id: id,
      attributes: {
        payment_status: "paid",
        line_items: [
           { amount: 1000, currency: "PHP" }
        ],
        payments: [
           { id: "pay_mock_123", attributes: { amount: 1000, status: "paid" } }
        ]
      }
    }
  };
}

function mockSendSMS(mobile, message) {
  console.log("Mock SMS to " + mobile + ": " + message);
  return { status: "success" };
}
