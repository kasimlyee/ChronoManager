module.exports = {
  port: process.env.PORT || 3000,
  sms: {
    enabled: true, // Set to true to enable real SMS
    apiUrl: "https://www.egosms.co/api/v1/json/",
    username: "Kasim",
    password: "@Kas!m1223",
  },
};
