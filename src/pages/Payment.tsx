const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Initialize Razorpay instance
const razorpay = new Razorpay({
    key_id: process.env.API_KEY,
    key_secret: process.env.SECRET_KEY,
});

// Create an order
app.post('/create-order', async (req, res) => {
    try {
        const { amount, receipt } = req.body;
        const options = { amount, currency: 'INR', receipt };
        const order = await razorpay.orders.create(options);
        res.status(200).json(order);
        console.log("Order created successfully");
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// Verify payment
app.post('/verify-payment', (req, res) => {
    try {
        const { orderId, paymentId, signature } = req.body;
        const text = `${orderId}|${paymentId}`;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.SECRET_KEY)
            .update(text)
            .digest('hex');

        if (expectedSignature === signature) {
            res.status(200).json({ valid: true });
            console.log("Payment verification successful");
        } else {
            res.status(400).json({ valid: false, error: 'Invalid signature' });
            console.log("Payment verification failed");
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ error: 'Payment verification failed' });
    }
});

// Check payment status
app.get('/check-payment/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const payments = await razorpay.orders.fetchPayments(orderId);
        
        if (payments.items.length === 0) {
            return res.status(404).json({ success: false, message: "No payments found for this order ID" });
        }

        const payment = payments.items[0];
        if (payment.status === 'captured') {
            return res.status(200).json({ success: true, payment });
        } else {
            return res.status(400).json({ success: false, message: "Payment not captured yet", payment });
        }
    } catch (error) {
        console.error('Error fetching payment status:', error);
        res.status(500).json({ success: false, error: 'Failed to check payment status' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
