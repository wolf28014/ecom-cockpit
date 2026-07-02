import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const settings = await db.setting.findMany();
  const obj: Record<string, string> = {};
  for (const s of settings) obj[s.key] = s.value;
  return NextResponse.json(obj);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  for (const [key, value] of Object.entries(body)) {
    const existing = await db.setting.findUnique({ where: { key } });
    if (existing) {
      await db.setting.update({ where: { key }, data: { value: String(value) } });
    } else {
      await db.setting.create({ data: { key, value: String(value) } });
    }
  }
  return NextResponse.json({ ok: true });
}
