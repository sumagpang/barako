/**
 * SemaphoreService.js - Integration with Semaphore SMS API
 */

class SemaphoreService {
  constructor() {
    this.apiKey = PropertiesService.getScriptProperties().getProperty('SEMAPHORE_API_KEY');
    this.apiUrl = 'https://api.semaphore.co/api/v4/messages';
    this.senderName = PropertiesService.getScriptProperties().getProperty('SEMAPHORE_SENDER_NAME') || '';
  }

  sendSMS(mobile, message) {
    if (!this.apiKey) {
      console.warn("Semaphore API Key not set. SMS not sent.");
      return null;
    }

    const payload = {
      apikey: this.apiKey,
      number: mobile,
      message: message,
      sendername: this.senderName
    };

    const options = {
      method: 'post',
      payload: payload,
      muteHttpExceptions: true
    };

    try {
      const response = UrlFetchApp.fetch(this.apiUrl, options);
      return JSON.parse(response.getContentText());
    } catch (e) {
      console.error("Failed to send SMS: " + e.message);
      return null;
    }
  }
}
