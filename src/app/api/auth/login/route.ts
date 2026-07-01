import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";

// 登录
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "请填写邮箱和密码" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "邮箱或密码错误" }, { status: 400 });
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "邮箱或密码错误" }, { status: 400 });
    }

    await setSessionCookie(user.id);

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "登录失败" }, { status: 500 });
  }
}
