/**
 * PaymongoService.js - Integration with Paymongo API
 */

class PaymongoService {
  constructor() {
    this.apiKey = PropertiesService.getScriptProperties().getProperty('PAYMONGO_SECRET_KEY');
    this.apiUrl = 'https://api.paymongo.com/v1';
  }

  createCheckoutSession(plan, userMobile, successUrl, cancelUrl) {
    const payload = {
      data: {
        attributes: {
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          line_items: [
            {
              amount: Math.round(plan.price * 100),
              currency: 'PHP',
              description: plan.name,
              name: plan.name,
              quantity: 1
            }
          ],
          payment_method_types: ['gcash', 'paymaya', 'grab_pay', 'dob', 'card', 'billease', 'qrph'],
          success_url: successUrl,
          cancel_url: cancelUrl,
          description: `WiFi Plan: ${plan.name} for ${userMobile}`
        }
      }
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Basic ' + Utilities.base64Encode(this.apiKey + ':')
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(`${this.apiUrl}/checkout_sessions`, options);
    const result = JSON.parse(response.getContentText());

    if (result.errors) {
      throw new Error(result.errors[0].detail);
    }

    return result.data;
  }

  getCheckoutSession(sessionId) {
    const options = {
      method: 'get',
      headers: {
        Authorization: 'Basic ' + Utilities.base64Encode(this.apiKey + ':')
      }
    };

    const response = UrlFetchApp.fetch(`${this.apiUrl}/checkout_sessions/${sessionId}`, options);
    return JSON.parse(response.getContentText()).data;
  }
}
