"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, CheckCircle2, Lock, ArrowRight, Sparkles } from "lucide-react";

function RecoveryCheckoutContent() {
  const searchParams = useSearchParams();
  const amount = searchParams.get("amount") || "2499";
  const customer = searchParams.get("customer") || "Customer";
  const reason = searchParams.get("reason") || "Payment timeout recovery";
  const discount = searchParams.get("discount") || "0";

  const [isPaid, setIsPaid] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePay = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsPaid(true);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 font-sans">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        {/* Header Branding */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-lg">
              R
            </div>
            <div>
              <h1 className="font-bold text-white tracking-wide text-base">Razorpay Recovery</h1>
              <p className="text-xs text-slate-400">1-Click Autonomous Checkout</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2.5 py-1 rounded-full font-medium">
            <ShieldCheck className="h-3.5 w-3.5" />
            Verified Secure
          </div>
        </div>

        {!isPaid ? (
          <div className="py-6 space-y-5">
            {/* Customer & Incident Notice */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <div className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Customer</div>
              <div className="text-sm font-semibold text-white mt-0.5">{customer}</div>
              <div className="text-xs text-indigo-300 mt-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                {reason}
              </div>
            </div>

            {/* Price Details */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Original Order Total</span>
                <span>₹{Number(amount).toLocaleString("en-IN")}</span>
              </div>
              {Number(discount) > 0 && (
                <div className="flex justify-between text-emerald-400 font-medium">
                  <span>Recovery Offer Discount ({discount}%)</span>
                  <span>-₹{Math.round((Number(amount) * Number(discount)) / 100).toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-3 border-t border-slate-800 text-lg font-extrabold text-white">
                <span>Amount Payable</span>
                <span className="text-blue-400">₹{Number(amount).toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* 1-Click Payment Trigger */}
            <button
              onClick={handlePay}
              disabled={isProcessing}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <span>Authorizing 1-Click Payment...</span>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Pay ₹{Number(amount).toLocaleString("en-IN")} via Razorpay</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <p className="text-center text-xs text-slate-500 flex items-center justify-center gap-1">
              Encrypted 256-bit Razorpay Smart Auth • Direct Merchant Recovery
            </p>
          </div>
        ) : (
          /* Payment Success Confirmation */
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Payment Recovered Successfully!</h2>
              <p className="text-sm text-slate-400 mt-1">
                ₹{Number(amount).toLocaleString("en-IN")} has been captured for order recovery.
              </p>
            </div>
            <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-xl p-3 text-xs text-emerald-300">
              Agent Audit Log updated. GMV saved from cart abandonment.
            </div>
            <button
              onClick={() => (window.location.href = "/")}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-sm transition"
            >
              Back to Merchant Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RecoveryCheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading recovery checkout...</div>}>
      <RecoveryCheckoutContent />
    </Suspense>
  );
}
