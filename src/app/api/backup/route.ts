import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const BACKUP_DIR = path.join(os.homedir(), ".ecom_cockpit_pro_web", "backups");

async function ensureBackupDir() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

export async function GET() {
  await ensureBackupDir();
  const records = await db.backupRecord.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(records);
}

import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  await ensureBackupDir();
  const { type = "manual" } = await req.json();

  // 源数据库文件路径
  const dbPath = process.env.DATABASE_URL?.replace("file:", "") || "";
  if (!dbPath) {
    return NextResponse.json({ error: "无法定位数据库文件" }, { status: 500 });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `ecom_cockpit_${type}_${timestamp}.db`;
  const backupPath = path.join(BACKUP_DIR, filename);

  try {
    await fs.copyFile(dbPath, backupPath);
    const stat = await fs.stat(backupPath);
    const record = await db.backupRecord.create({
      data: {
        backupType: type,
        filePath: backupPath,
        fileSize: stat.size,
        status: "success",
        note: `${type} 备份`,
      },
    });
    return NextResponse.json(record);
  } catch (e: any) {
    const record = await db.backupRecord.create({
      data: {
        backupType: type,
        filePath: backupPath,
        fileSize: 0,
        status: "failed",
        note: `备份失败: ${e.message}`,
      },
    });
    return NextResponse.json(record, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const record = await db.backupRecord.findUnique({ where: { id } });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try { await fs.unlink(record.filePath); } catch {}
  await db.backupRecord.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
