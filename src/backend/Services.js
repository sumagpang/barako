/**
 * Services.js - Integration with Xendit, Paymongo and Semaphore
 */

var PaymentService = {
  getGateway: function() {
    // Fetches GATEWAY from Settings tab, defaults to Xendit for 1 PHP support
    const gateway = DB.getSetting('GATEWAY') || 'Xendit';
    return gateway;
  },

  createPayment: function(amount, description, referenceId) {
    const gateway = this.getGateway();
    if (gateway === 'Paymongo') {
      return PaymongoService.createPaymentLink(amount, description, referenceId);
    } else {
      return XenditService.createInvoice(amount, description, referenceId);
    }
  }
};

var XenditService = {
  getApiKey: function() {
    return PropertiesService.getScriptProperties().getProperty('XENDIT_SECRET_KEY');
  },

  createInvoice: function(amount, description, referenceId) {
    const url = 'https://api.xendit.co/v2/invoices';
    const options = {
      method: 'post',
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode(this.getApiKey() + ':'),
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({
        external_id: referenceId,
        amount: Math.round(amount),
        description: description,
        currency: 'PHP',
        success_redirect_url: PropertiesService.getScriptProperties().getProperty('WEB_APP_URL') + '?page=payment_success&refId=' + referenceId,
        items: [{ name: 'Internet Plan', quantity: 1, price: Math.round(amount) }]
      }),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    if (result.error_code) throw new Error('Xendit Error: ' + result.message);
    return result.invoice_url;
  }
};

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
            line_items: [{ amount: Math.round(amount * 100), currency: 'PHP', name: 'Internet Plan', quantity: 1 }],
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
