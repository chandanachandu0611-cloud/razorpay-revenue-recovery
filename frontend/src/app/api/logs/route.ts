import { NextResponse } from "next/server";
import { recoveryLogs } from "@/lib/recoveryStore";

export async function GET() {
  return NextResponse.json(recoveryLogs);
}
