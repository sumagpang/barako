/**
 * Services.js - Integration with Paymongo and Semaphore
 */

var PaymongoService = {
  getApiKey: function() {
    return PropertiesService.getScriptProperties().getProperty('PAYMONGO_SECRET_KEY');
  },

  createPaymentLink: function(amount, description, referenceId) {
    const url = 'https://api.paymongo.com/v1/checkout_sessions';
    const options = {
      method: 'post',
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode(this.getApiKey() + ':'),
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({
        data: {
          attributes: {
            description: description,
            line_items: [{ amount: Math.round(amount * 100), currency: 'PHP', name: 'Internet Access', quantity: 1 }],
            payment_method_types: ['card', 'gcash', 'grab_pay', 'paymaya', 'dob', 'qrph', 'shopeepay'],
            reference_number: referenceId,
            success_url: PropertiesService.getScriptProperties().getProperty('WEB_APP_URL') + '?page=payment_success&refId=' + referenceId
          }
        }
      }),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    if (result.errors) throw new Error('Paymongo Error: ' + result.errors[0].detail);
    return result.data.attributes.checkout_url;
  }
};

var SemaphoreService = {
  getApiKey: function() {
    return PropertiesService.getScriptProperties().getProperty('SEMAPHORE_API_KEY');
  },

  sendSMS: function(number, message) {
    const url = 'https://semaphore.co/api/v4/messages';
    const options = {
      method: 'post',
      payload: { apikey: this.getApiKey(), number: number, message: message },
      muteHttpExceptions: true
    };

    try {
      const response = UrlFetchApp.fetch(url, options);
      return JSON.parse(response.getContentText());
    } catch (e) {
      console.error('SMS Send Failed:', e);
      return { error: e.message };
    }
  }
};
