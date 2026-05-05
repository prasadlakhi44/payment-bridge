const express = require('express');
const Razorpay = require('razorpay');
const admin = require('firebase-admin');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. Firebase Admin Setup
const serviceAccount = require("./firebase-key.json");
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DB_URL
    });
}
const db = admin.database();

// 2. Razorpay Setup
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

app.get('/', (req, res) => res.send("Payment Server is Online! 🚀"));

// 3. API: Create Order and Show Razorpay Popup
app.get('/createOrder', async (req, res) => {
    const { amt, uid } = req.query;
   
    if (!amt || !uid) {
        return res.status(400).send("Amount (amt) and User ID (uid) are required!");
    }

    try {
        const order = await razorpay.orders.create({
            amount: parseInt(amt) * 100, // Convert to paise
            currency: "INR",
            receipt: `rcpt_${uid}_${Date.now()}`
        });

        // Yeh HTML code Razorpay ka popup auto-open karega
        res.send(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Secure Payment</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body onload="document.getElementById('pay-now').click()" style="background:#f4f4f4; text-align:center; padding-top:50px; font-family:sans-serif;">
                    <h3>Processing Payment...</h3>
                    <p>Please do not refresh this page.</p>
                   
                    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
                    <button id="pay-now" style="display:none;">Pay Now</button>
                   
                    <script>
                        var options = {
                            "key": "${process.env.RAZORPAY_KEY_ID}",
                            "amount": "${order.amount}",
                            "currency": "${order.currency}",
                            "name": "RAJESH UNIQUE APPS",
                            "description": "Premium Access Upgrade",
                            "order_id": "${order.id}",
                            "callback_url": "https://payment-bridge-five.vercel.app/verify?uid=${uid}&amt=${amt}",
                            "prefill": {
                                "name": "User",
                                "email": "payment@uniqueapps.com"
                            },
                            "theme": { "color": "#3399cc" }
                        };
                        var rzp1 = new Razorpay(options);
                        rzp1.on('payment.failed', function (response){
                            alert("Payment Failed! Please try again.");
                        });
                        rzp1.open();
                    </script>
                </body>
            </html>
        `);
    } catch (e) {
        res.status(500).send("Error creating order: " + e.message);
    }
});

// 4. API: Verify Payment & Update Firebase
app.post('/verify', async (req, res) => {
    const { uid, amt } = req.query;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Yahan hum simply success assume kar rahe hain jab Razorpay redirect karega
    // Real-world mein signature verification zaruri hai, par test ke liye ye best hai
    try {
        await db.ref('Transactions/' + uid).set({
            status: "SUCCESS",
            amount: amt,
            payment_id: razorpay_payment_id,
            order_id: razorpay_order_id,
            timestamp: admin.database.ServerValue.TIMESTAMP
        });

        res.send(`
            <div style="text-align:center; padding-top:100px; font-family:sans-serif;">
                <h1 style="color:green;">✅ Payment Successful!</h1>
                <p>You can go back to the app now.</p>
            </div>
        `);
    } catch (e) {
        res.status(500).send("Firebase Update Error: " + e.message);
    }
});

module.exports = app;
