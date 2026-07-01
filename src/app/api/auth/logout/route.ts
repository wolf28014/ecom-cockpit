import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

// 退出登录
export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
