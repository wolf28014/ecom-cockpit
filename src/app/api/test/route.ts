import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "API works",
    hasDbUrl: !!process.env.DATABASE_URL,
    dbUrlLength: process.env.DATABASE_URL?.length || 0,
    dbUrlPrefix: process.env.DATABASE_URL?.slice(0, 30) || "missing",
    nodeEnv: process.env.NODE_ENV,
  });
}
