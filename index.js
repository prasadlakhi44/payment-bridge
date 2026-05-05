const express = require('express');
const Razorpay = require('razorpay');
const admin = require('firebase-admin');
const app = express();

app.use(express.json());

// Firebase Connection
const serviceAccount = require("./firebase-key.json");
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DB_URL
    });
}
const db = admin.database();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// App test karne ke liye
app.get('/', (req, res) => res.send("Payment Server is Online!"));

// Order Create API
app.get('/createOrder', async (req, res) => {
    const { amt, uid } = req.query;
    try {
        const order = await razorpay.orders.create({
            amount: amt * 100, // INR to Paise
            currency: "INR",
            receipt: `rcpt_${uid}`
        });
        res.json(order);
    } catch (e) { res.status(500).send(e); }
});

// Payment verify aur Firebase update
app.post('/verify', async (req, res) => {
    const { payment_id, uid, amt } = req.body;
    await db.ref('Transactions/' + uid).set({
        status: "SUCCESS",
        amount: amt,
        payment_id: payment_id,
        timestamp: Date.now()
    });
    res.json({ success: true });
});

module.exports = app;
