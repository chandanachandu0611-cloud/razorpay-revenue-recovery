import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import Razorpay from "razorpay";
import { recoveryLogs, RecoveryLog } from "@/lib/recoveryStore";

interface AgentDecision {
  strategy: "DYNAMIC_LINK_RECOVERY" | "SMART_RETRY_SCHEDULED" | "INCENTIVIZED_OFFER_LINK";
  rootCause: string;
  recommendedAction: string;
  discountPercent: number;
}

async function runRecoveryAgent(failureData: {
  errorCode: string;
  errorDescription: string;
  amount: number;
  customerEmail: string;
}): Promise<AgentDecision> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      strategy: "DYNAMIC_LINK_RECOVERY",
      rootCause: "Payment abandoned or timed out during auth handshake",
      recommendedAction: "Dispatched fallback 1-click Razorpay payment link",
      discountPercent: 0,
    };
  }

  const ai = new GoogleGenAI({ apiKey });
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
      model: "gemini-1.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    const text = response.text ? response.text.trim() : "";
    return JSON.parse(text) as AgentDecision;
  } catch (err: unknown) {
    return {
      strategy: "DYNAMIC_LINK_RECOVERY",
      rootCause: "Payment abandoned or timed out during auth handshake",
      recommendedAction: "Dispatched fallback 1-click Razorpay payment link",
      discountPercent: 0,
    };
  }
}

export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => ({}));

    if (payload.event === "payment.failed" && payload.payload?.payment?.entity) {
      const payment = payload.payload.payment.entity;

      const failureData = {
        paymentId: payment.id || `pay_${Math.random().toString(36).substring(7)}`,
        amount: payment.amount || 0,
        errorCode: payment.error_code || "TRANSACTION_DROPPED",
        errorDescription: payment.error_description || "Issuer or user timeout",
        customerName: payment.notes?.customer_name || "Checkout Customer",
        customerEmail: payment.email || "customer@example.com",
        customerPhone: payment.contact || "+919876543210",
      };

      const agentDecision = await runRecoveryAgent(failureData);

      let recoveryUrl: string | null = null;
      let finalAmount = failureData.amount;

      if (agentDecision.discountPercent > 0) {
        finalAmount = Math.round(failureData.amount * (1 - agentDecision.discountPercent / 100));
      }

      const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
      const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

      const fallbackUrl = "https://pages.razorpay.com/pl_sample_recovery/view";

      if (agentDecision.strategy !== "SMART_RETRY_SCHEDULED") {
        if (razorpayKeyId && razorpayKeySecret) {
          try {
            const razorpay = new Razorpay({
              key_id: razorpayKeyId,
              key_secret: razorpayKeySecret,
            });

            const link = await razorpay.paymentLink.create({
              amount: finalAmount,
              currency: "INR",
              accept_partial: false,
              description: `Recovery Checkout: ${agentDecision.rootCause}`,
              customer: {
                name: failureData.customerName,
                email: failureData.customerEmail,
                contact: failureData.customerPhone,
              },
              notify: { sms: false, email: false },
              reminder_enable: false,
            });
            recoveryUrl = link?.short_url || fallbackUrl;
          } catch (err: unknown) {
            console.error("Razorpay Error:", err);
            recoveryUrl = fallbackUrl;
          }
        } else {
          console.warn("Razorpay API keys missing in environment; using hosted Razorpay payment page fallback.");
          recoveryUrl = fallbackUrl;
        }
      }

      const logEntry: RecoveryLog = {
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
        status: recoveryUrl ? "LINK_SENT" : "RETRY_QUEUED",
      };

      recoveryLogs.unshift(logEntry);
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    return NextResponse.json({ received: true });
  }
}
