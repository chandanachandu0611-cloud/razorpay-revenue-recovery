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
}

export default function Dashboard() {
  const [logs, setLogs] = useState<RecoveryLog[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
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

  const totalAtRisk = logs.reduce((acc, log) => acc + log.originalAmount, 0);
  const totalRecovered = logs
    .filter((l) => l.recoveryUrl || l.strategy !== "SMART_RETRY_SCHEDULED")
    .reduce((acc, log) => acc + log.recoveredAmount, 0);
  const recoveryRate =
    logs.length > 0
      ? Math.round(
          (logs.filter((l) => l.recoveryUrl || l.strategy !== "SMART_RETRY_SCHEDULED").length / logs.length) * 100
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-sm font-medium">Revenue at Risk</span>
            <DollarSign className="h-5 w-5 text-rose-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-2">₹{totalAtRisk.toLocaleString("en-IN")}</div>
          <span className="text-xs text-rose-400 mt-1 block">From dropped transactions</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-sm font-medium">Recovered Revenue</span>
            <TrendingUp className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 mt-2">₹{totalRecovered.toLocaleString("en-IN")}</div>
          <span className="text-xs text-emerald-400 mt-1 block">Rerouted via agent links</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-sm font-medium">Recovery Success Rate</span>
            <CheckCircle2 className="h-5 w-5 text-indigo-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-2">{recoveryRate}%</div>
          <span className="text-xs text-indigo-400 mt-1 block">Autonomous resolution rate</span>
        </div>
      </div>

      {/* Live Agent Recovery Audit Ledger */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-indigo-400" /> Live Agent Audit Ledger
          </h2>
          <span className="text-xs text-slate-400">{logs.length} transactions processed</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase font-medium">
              <tr>
                <th className="px-6 py-3">Time</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Failure Code</th>
                <th className="px-6 py-3">Agent Root-Cause Diagnosis</th>
                <th className="px-6 py-3">Strategy</th>
                <th className="px-6 py-3">Action / Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No events captured yet. Click one of the simulation buttons above to trigger an agent workflow.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition">
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
                      {log.payment_link || log.recoveryUrl || log.strategy !== "SMART_RETRY_SCHEDULED" ? (
                        <a
                          href={log.payment_link || log.recoveryUrl || "https://rzp.io/rzp/bPiVuFN"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow transition-all cursor-pointer"
                        >
                          Open Recovery Link ↗
                        </a>
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
    </div>
  );
}