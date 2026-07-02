import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const storeCount = await db.store.count();
    return NextResponse.json({
      ok: true,
      storeCount,
      message: "Database connection works",
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e.message,
      code: e.code,
      stack: e.stack?.slice(0, 500),
    }, { status: 500 });
  }
}
