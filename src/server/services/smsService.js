const axios = require("axios");
const config = require("../config");

class SMSService {
  async sendSMS(phoneNumber, message) {
    const urlAPI = config.sms.apiUrl;
    const username = config.sms.username;
    const userpass = config.sms.password;

    const payload = {
      method: "SendSms",
      userdata: {
        username: username,
        password: userpass,
      },
      msgdata: [
        {
          number: phoneNumber,
          message: message,
          senderid: "Lyee",
          priority: "0",
        },
      ],
    };

    try {
      const response = await axios.post(urlAPI, payload, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      console.log("SMS sent:", response.data);
      return response.data;
    } catch (error) {
      console.error(`Error sending SMS: ${error.message}`);
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }
}

module.exports = new SMSService();
