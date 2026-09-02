export interface RecoveryLog {
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
  status: string;
}

// Global in-memory log store for serverless execution
const globalForLogs = global as unknown as { recoveryLogs: RecoveryLog[] };

export const recoveryLogs = globalForLogs.recoveryLogs || [];

if (process.env.NODE_ENV !== "production") {
  globalForLogs.recoveryLogs = recoveryLogs;
}
