const admin = require("firebase-admin");
const serviceAccount = require("../firebase-admin.json"); // Path to your JSON

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://nexo-7fc25.firebaseio.com" // Optional (if using Realtime DB)
});

module.exports = admin;