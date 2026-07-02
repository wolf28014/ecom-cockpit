/**
 * 认证工具：密码哈希、Session 管理
 */
import crypto from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const SESSION_COOKIE = "ecom_session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 天（秒）

// 简单的密码哈希（SHA-256 + salt）
// 生产环境建议用 bcrypt，但 Vercel Serverless 环境下 SHA-256 更稳定
export function hashPassword(password: string): string {
  const salt = "ecom-cockpit-pro-2026"; // 固定 salt（简化部署）
  return crypto.createHash("sha256").update(salt + password).digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// 简单的 session token（Base64 编码 userId + 过期时间）
export function createSessionToken(userId: string): string {
  const payload = {
    userId,
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export function parseSessionToken(token: string): { userId: string; exp: number } | null {
  try {
    const payload = JSON.parse(Buffer.from(token, "base64").toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// 在 Server Component / API Route 中获取当前用户
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = parseSessionToken(token);
  if (!payload) return null;

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true },
  });
  return user;
}

// 设置 session cookie
export async function setSessionCookie(userId: string) {
  const token = createSessionToken(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

// 清除 session cookie
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// 获取当前用户的店铺 ID 列表（用于过滤数据）
export async function getCurrentUserStoreIds(): Promise<string[] | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const stores = await db.store.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  return stores.map(s => s.id);
}
