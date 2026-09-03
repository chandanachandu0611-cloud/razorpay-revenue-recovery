const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const Razorpay = require('razorpay');
const { GoogleGenAI } = require('@google/genai');

dotenv.config();

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_TXC4uVUhMbUJhr',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '83x5iQG0270GjkRxXtDvYB6i',
});

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// In-memory ledger of recovery transactions
const recoveryLogs = [];

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'AI Revenue Recovery Engine' });
});

// View all recovery records
app.get('/api/recovery-logs', (req, res) => {
    res.json(recoveryLogs);
});

// AI Agent Diagnostician
async function runRecoveryAgent(failureData) {
    const prompt = `
You are an autonomous Razorpay Revenue Recovery Agent.
Evaluate this payment failure event and select the optimal recovery strategy.

Payment Failure Details:
- Error Code: ${failureData.errorCode}
- Error Description: ${failureData.errorDescription}
- Amount: ₹${failureData.amount / 100}
- Customer: ${failureData.customerEmail}

Choose exactly one of these strategies:
1. "DYNAMIC_LINK_RECOVERY" (for authentication drops, user timeouts, or abandoned checkouts)
2. "SMART_RETRY_SCHEDULED" (for bank downtime or temporary gateway errors)
3. "INCENTIVIZED_OFFER_LINK" (for high value cart drops where customer hesitated)

Return ONLY a valid JSON object matching this schema:
{
  "strategy": "DYNAMIC_LINK_RECOVERY" | "SMART_RETRY_SCHEDULED" | "INCENTIVIZED_OFFER_LINK",
  "rootCause": "Short explanation of why it failed",
  "recommendedAction": "Exact next step taken",
  "discountPercent": 0 | 5 | 10
}
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' },
        });
        return JSON.parse(response.text.trim());
    } catch (err) {
        console.error('Agent reasoning fallback:', err.message);
        return {
            strategy: 'DYNAMIC_LINK_RECOVERY',
            rootCause: 'Payment abandoned or timed out during auth handshake',
            recommendedAction: 'Dispatched fallback 1-click Razorpay payment link',
            discountPercent: 0,
        };
    }
}

// Endpoint to simulate payment failure events
app.post('/api/simulate-failure', async (req, res) => {
    const { customerName, customerEmail, amount, failureReason } = req.body;

    const failureData = {
        paymentId: `pay_${Math.random().toString(36).substring(7)}`,
        amount: amount || 249900, // ₹2499 in paise
        errorCode: failureReason || 'BAD_REQUEST_PAYMENT_TIMED_OUT',
        errorDescription: 'Customer dropped off at OTP screen or session expired',
        customerName: customerName || 'Rahul Sharma',
        customerEmail: customerEmail || 'rahul.sharma@example.com',
        customerPhone: '+919876543210',
    };

    // 1. Run AI Agent to diagnose and decide action
    const agentDecision = await runRecoveryAgent(failureData);

    // 2. Execute bounded recovery action
    let recoveryUrl = null;
    let finalAmount = failureData.amount;

    if (agentDecision.discountPercent > 0) {
        finalAmount = Math.round(failureData.amount * (1 - agentDecision.discountPercent / 100));
    }

    const fallbackUrl = "https://rzp.io/rzp/bPiVuFN";

    if (agentDecision.strategy !== 'SMART_RETRY_SCHEDULED') {
        try {
            const link = await razorpay.paymentLink.create({
                amount: Math.round(Number(finalAmount)),
                currency: 'INR',
                accept_partial: false,
                description: `Recovery Checkout: ${agentDecision.rootCause}`,
                customer: {
                    name: failureData.customerName || 'Ananya Rao',
                    email: failureData.customerEmail || 'ananya.rao@example.com',
                    contact: failureData.customerPhone || '+919876543210',
                },
                notify: { sms: false, email: false },
                reminder_enable: false,
            });
            recoveryUrl = link?.short_url || fallbackUrl;
        } catch (err) {
            console.error('Razorpay API Error:', err);
            recoveryUrl = fallbackUrl;
        }
    }

    // 3. Record explainable audit log
    const logEntry = {
        id: `rec_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        paymentId: failureData.paymentId,
        customer: failureData.customerName,
        originalAmount: failureData.amount / 100,
        recoveredAmount: finalAmount / 100,
        failureCode: failureData.errorCode,
        agentDiagnosis: agentDecision.rootCause,
        strategy: agentDecision.strategy,
        recoveryUrl: recoveryUrl,
        payment_link: recoveryUrl,
        status: recoveryUrl ? 'LINK_SENT' : 'RETRY_QUEUED',
    };

    recoveryLogs.unshift(logEntry);
    return res.json({ success: true, result: logEntry });
});
// Webhook endpoint for live production Razorpay event ingestion
app.post('/api/webhook', async (req, res) => {
    const event = req.body.event;

    if (event === 'payment.failed') {
        const payment = req.body.payload.payment.entity;

        const failureData = {
            paymentId: payment.id,
            amount: payment.amount,
            errorCode: payment.error_code || 'TRANSACTION_DROPPED',
            errorDescription: payment.error_description || 'Issuer or user timeout',
            customerName: payment.notes?.customer_name || 'Checkout Customer',
            customerEmail: payment.email || 'customer@example.com',
            customerPhone: payment.contact || '+919876543210',
        };

        const agentDecision = await runRecoveryAgent(failureData);

        let recoveryUrl = null;
        let finalAmount = failureData.amount;

        if (agentDecision.discountPercent > 0) {
            finalAmount = Math.round(failureData.amount * (1 - agentDecision.discountPercent / 100));
        }

        if (agentDecision.strategy !== 'SMART_RETRY_SCHEDULED') {
            try {
                const link = await razorpay.paymentLink.create({
                    amount: finalAmount,
                    currency: 'INR',
                    description: `Recovery Checkout: ${agentDecision.rootCause}`,
                    customer: {
                        name: failureData.customerName,
                        email: failureData.customerEmail,
                        contact: failureData.customerPhone,
                    },
                    notify: { sms: false, email: false },
                });
                recoveryUrl = link?.short_url || "https://rzp.io/i/mock-recovery-link";
            } catch (err) {
                console.error('Razorpay link error:', err);
                recoveryUrl = "https://rzp.io/i/mock-recovery-link";
            }
        }

        const logEntry = {
            id: `rec_${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            paymentId: failureData.paymentId,
            customer: failureData.customerName,
            originalAmount: failureData.amount / 100,
            recoveredAmount: finalAmount / 100,
            failureCode: failureData.errorCode,
            agentDiagnosis: agentDecision.rootCause,
            strategy: agentDecision.strategy,
            recoveryUrl: recoveryUrl,
            status: recoveryUrl ? 'LINK_SENT' : 'RETRY_QUEUED',
        };

        recoveryLogs.unshift(logEntry);
    }

    res.status(200).json({ received: true });
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));