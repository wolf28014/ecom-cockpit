import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// 获取当前登录用户
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}
