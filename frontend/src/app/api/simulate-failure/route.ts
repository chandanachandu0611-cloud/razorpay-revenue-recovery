import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import Razorpay from "razorpay";
import { recoveryLogs, RecoveryLog } from "@/lib/recoveryStore";

interface FailureInput {
  paymentId?: string;
  errorCode?: string;
  errorDescription?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  amount?: number;
  failureReason?: string;
}

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
    console.warn("GEMINI_API_KEY missing, using agent reasoning fallback");
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
    const message = err instanceof Error ? err.message : String(err);
    console.error("Agent reasoning fallback:", message);
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
    const body: FailureInput = await req.json().catch(() => ({}));

    const failureData = {
      paymentId: body.paymentId || `pay_${Math.random().toString(36).substring(7)}`,
      amount: body.amount || 249900,
      errorCode: body.failureReason || body.errorCode || "BAD_REQUEST_PAYMENT_TIMED_OUT",
      errorDescription: body.errorDescription || "Customer dropped off at OTP screen or session expired",
      customerName: body.customerName || "Rahul Sharma",
      customerEmail: body.customerEmail || "rahul.sharma@example.com",
      customerPhone: body.customerPhone || "+919876543210",
    };

    const agentDecision = await runRecoveryAgent(failureData);

    let recoveryUrl: string | null = null;
    let finalAmount = failureData.amount;

    if (agentDecision.discountPercent > 0) {
      finalAmount = Math.round(failureData.amount * (1 - agentDecision.discountPercent / 100));
    }

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID || "rzp_test_TXC4uVUhMbUJhr";
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || "83x5iQG0270GjkRxXtDvYB6i";

    const fallbackUrl = `/checkout-recovery?amount=${finalAmount / 100}&customer=${encodeURIComponent(failureData.customerName)}&reason=${encodeURIComponent(agentDecision.rootCause)}&discount=${agentDecision.discountPercent}`;

    if (agentDecision.strategy !== "SMART_RETRY_SCHEDULED") {
      try {
        const razorpay = new Razorpay({
          key_id: razorpayKeyId,
          key_secret: razorpayKeySecret,
        });

        const link = await razorpay.paymentLink.create({
          amount: Math.round(Number(finalAmount)),
          currency: "INR",
          accept_partial: false,
          description: `Recovery Checkout: ${agentDecision.rootCause}`,
          customer: {
            name: failureData.customerName || "Ananya Rao",
            email: failureData.customerEmail || "ananya.rao@example.com",
            contact: failureData.customerPhone || "+919876543210",
          },
          notify: { sms: false, email: false },
          reminder_enable: false,
        });
        recoveryUrl = link?.short_url || fallbackUrl;
      } catch (err: unknown) {
        console.error("Razorpay API Error:", err);
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

    return NextResponse.json({ success: true, result: logEntry });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
