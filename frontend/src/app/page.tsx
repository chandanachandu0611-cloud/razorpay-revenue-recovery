"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, RefreshCw, Zap, TrendingUp, DollarSign, ShieldAlert } from "lucide-react";

interface RecoveryLog {
  id: string;
  timestamp: string;
  paymentId: string;
  customer: string;
  originalAmount: number;
  recoveredAmount: number;
  failureCode: string;
  agentDiagnosis: string;
  strategy: string;
  recoveryUrl: string | null;
  payment_link?: string | null;
  status: string;
  isPaid?: boolean;
  paidAt?: string;
}

export default function Dashboard() {
  const [logs, setLogs] = useState<RecoveryLog[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeReceiptLog, setActiveReceiptLog] = useState<RecoveryLog | null>(null);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/logs");
      if (res.ok) {
        const data = await res.json();
        setLogs((prevLogs) => {
          const paidMap = new Map(
            prevLogs.filter((p) => p.isPaid).map((p) => [p.id, p])
          );
          return data.map((item: RecoveryLog) => {
            const existingPaid = paidMap.get(item.id);
            if (existingPaid) {
              return { ...item, ...existingPaid };
            }
            return item;
          });
        });
      }
    } catch (err) {
      console.error("Error fetching recovery logs:", err);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  const triggerSimulation = async (failureReason: string, amount?: number) => {
    setIsSimulating(true);
    try {
      const res = await fetch("/api/simulate-failure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount,
          failureReason: failureReason,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.result) {
          setLogs((prev) => [data.result, ...prev]);
        }
      }
      await fetchLogs();
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleOpenCheckout = (log: RecoveryLog) => {
    if (log.isPaid) {
      setActiveReceiptLog(log);
      return;
    }

    if (typeof window === "undefined" || !(window as any).Razorpay) {
      alert("Razorpay SDK is loading, please try again in a moment.");
      return;
    }

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TXC4uVUhMbUJhr",
      amount: Math.round((log.recoveredAmount || log.originalAmount || 2499) * 100),
      currency: "INR",
      name: "Autonomous Revenue Recovery",
      description: `Cart Recovery Checkout for ${log.customer || "Ananya Rao"}`,
      prefill: {
        name: log.customer || "Ananya Rao",
        email: `${(log.customer || "ananya.rao").toLowerCase().replace(/\s+/g, '')}@example.com`,
        contact: "+919876543210"
      },
      theme: {
        color: "#2563eb"
      },
      handler: function (response: any) {
        const timePaid = new Date().toLocaleTimeString();
        const payId = response.razorpay_payment_id || `pay_${Math.random().toString(36).substring(7)}`;

        setLogs((prevLogs) =>
          prevLogs.map((item) =>
            item.id === log.id
              ? {
                  ...item,
                  isPaid: true,
                  paymentId: payId,
                  paidAt: timePaid,
                  status: "RECOVERED",
                }
              : item
          )
        );

        setActiveReceiptLog({
          ...log,
          isPaid: true,
          paymentId: payId,
          paidAt: timePaid,
          status: "RECOVERED",
        });
      }
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.open();
  };

  const totalAtRisk = logs.reduce((acc, log) => acc + log.originalAmount, 0);
  const totalRecovered = logs
    .filter((l) => l.isPaid || l.recoveryUrl || l.strategy !== "SMART_RETRY_SCHEDULED")
    .reduce((acc, log) => acc + (log.recoveredAmount || log.originalAmount), 0);
  const recoveryRate =
    logs.length > 0
      ? Math.round(
          (logs.filter((l) => l.isPaid || l.recoveryUrl || l.strategy !== "SMART_RETRY_SCHEDULED").length / logs.length) * 100
        )
      : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-8 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight text-white">Razorpay Autonomous Revenue Recovery</h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Agentic triage, diagnosis, and dynamic retry/link routing for dropped checkouts and failed payments.
          </p>
        </div>

        {/* Demo Trigger Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => triggerSimulation("BAD_REQUEST_PAYMENT_TIMED_OUT", 249900)}
            disabled={isSimulating}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 cursor-pointer"
          >
            <Zap className="h-4 w-4" />
            Simulate Timeout (₹2,499)
          </button>
          <button
            onClick={() => triggerSimulation("GATEWAY_ERROR", 499900)}
            disabled={isSimulating}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 cursor-pointer"
          >
            <ShieldAlert className="h-4 w-4" />
            Simulate Gateway Failure (₹4,999)
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-8">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-sm font-medium">GMV At Risk</span>
            <DollarSign className="h-5 w-5 text-rose-500" />
          </div>
          <p className="text-3xl font-bold text-white">₹{totalAtRisk.toLocaleString("en-IN")}</p>
          <p className="text-xs text-slate-500 mt-2">Monitored failed payment volume</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-sm font-medium">GMV Recovered</span>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-emerald-400">₹{totalRecovered.toLocaleString("en-IN")}</p>
          <p className="text-xs text-slate-500 mt-2">Recovered via 1-click links & retries</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-sm font-medium">Success Rate</span>
            <CheckCircle2 className="h-5 w-5 text-indigo-400" />
          </div>
          <p className="text-3xl font-bold text-indigo-400">{recoveryRate}%</p>
          <p className="text-xs text-slate-500 mt-2">Autonomous resolution efficiency</p>
        </div>
      </div>

      {/* Live Audit Ledger */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-white">Real-Time Autonomous Audit Ledger</h2>
            <p className="text-xs text-slate-400 mt-0.5">Diagnosed failures and autonomous agent actions</p>
          </div>
          <button
            onClick={fetchLogs}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs uppercase bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Error Code</th>
                <th className="px-6 py-4">AI Agent Diagnosis</th>
                <th className="px-6 py-4">Strategy</th>
                <th className="px-6 py-4">Action / Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No recovery records yet. Click a simulation button above to trigger the AI agent.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/50 transition">
                    <td className="px-6 py-4 text-slate-400 whitespace-nowrap">{log.timestamp}</td>
                    <td className="px-6 py-4 font-medium text-white">{log.customer}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-950 text-rose-400 border border-rose-800">
                        {log.failureCode}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300 max-w-xs">{log.agentDiagnosis}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-950 text-indigo-300 border border-indigo-800">
                        {log.strategy}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.isPaid ? (
                        <button
                          onClick={() => handleOpenCheckout(log)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow transition-all cursor-pointer border border-emerald-400/30"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          View Receipt ({log.paymentId.substring(0, 10)}...)
                        </button>
                      ) : log.payment_link || log.recoveryUrl || log.strategy !== "SMART_RETRY_SCHEDULED" ? (
                        <button
                          onClick={() => handleOpenCheckout(log)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow transition-all cursor-pointer"
                        >
                          Open Recovery Link ↗
                        </button>
                      ) : (
                        <span className="text-slate-500 text-xs">Smart Retry Scheduled</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Modal */}
      {activeReceiptLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <CheckCircle2 className="h-10 w-10 animate-bounce" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Payment Successfully Completed!</h2>
              <p className="text-xs text-slate-400 mt-1">Transaction confirmed by Razorpay Engine</p>
            </div>

            <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-3 text-left text-sm">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400 text-xs">Amount Recovered</span>
                <span className="font-semibold text-emerald-400 text-base">
                  ₹{(activeReceiptLog.recoveredAmount || activeReceiptLog.originalAmount).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400 text-xs">Customer Name</span>
                <span className="font-medium text-slate-200">{activeReceiptLog.customer}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400 text-xs">Transaction ID</span>
                <span className="font-mono text-xs text-indigo-300">{activeReceiptLog.paymentId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-xs">Timestamp</span>
                <span className="text-slate-300 text-xs">{activeReceiptLog.paidAt || activeReceiptLog.timestamp}</span>
              </div>
            </div>

            <button
              onClick={() => setActiveReceiptLog(null)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 px-4 rounded-xl transition text-sm cursor-pointer border border-slate-700"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}