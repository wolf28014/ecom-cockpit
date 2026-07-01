"use client";

import { useState, useEffect } from "react";
import { KpiRow, SectionCard } from "@/components/ecom/kpi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Database, Save, Trash2, RotateCcw, Loader2, HardDrive, Clock, CheckCircle2, XCircle,
} from "lucide-react";
import { toast } from "sonner";

interface Backup {
  id: string;
  backupType: string;
  filePath: string;
  fileSize: number;
  status: string;
  note?: string | null;
  createdAt: string;
}

const fmtSize = (b: number) => {
  if (!b) return "0 B";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
};

const TYPE_LABELS: Record<string, string> = {
  manual: "手动备份",
  auto_daily: "自动每日",
  auto_weekly: "自动每周",
};

const TYPE_COLORS: Record<string, string> = {
  manual: "#0071E3",
  auto_daily: "#34C759",
  auto_weekly: "#FF9500",
};

export function BackupPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [autoType, setAutoType] = useState("off");

  const loadData = () => {
    setLoading(true);
    fetch("/api/backup")
      .then(r => r.json())
      .then(d => { setBackups(d || []); setLoading(false); })
      .catch(() => { toast.error("加载备份列表失败"); setLoading(false); });
  };

  useEffect(() => {
    loadData();
    // load auto backup setting
    fetch("/api/settings")
      .then(r => r.json())
      .then(d => { if (d.autoBackup) setAutoType(d.autoBackup); })
      .catch(() => {});
  }, []);

  const handleBackup = async () => {
    setCreating(true);
    try {
      const r = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "manual" }),
      });
      if (!r.ok) throw new Error();
      toast.success("备份已创建");
      loadData();
    } catch {
      toast.error("备份失败");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (b: Backup) => {
    if (!confirm("确认删除该备份？")) return;
    try {
      await fetch(`/api/backup?id=${b.id}`, { method: "DELETE" });
      toast.success("已删除");
      loadData();
    } catch {
      toast.error("删除失败");
    }
  };

  const handleClearOld = async () => {
    const old = backups.filter(b => {
      const days = (Date.now() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return days > 30;
    });
    if (old.length === 0) {
      toast.info("没有超过 30 天的旧备份");
      return;
    }
    if (!confirm(`将删除 ${old.length} 个超过 30 天的旧备份，确认？`)) return;
    for (const b of old) {
      try {
        await fetch(`/api/backup?id=${b.id}`, { method: "DELETE" });
      } catch { /* ignore */ }
    }
    toast.success(`已清理 ${old.length} 个旧备份`);
    loadData();
  };

  const handleSaveAuto = async () => {
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoBackup: autoType }),
      });
      toast.success("自动备份设置已保存");
    } catch {
      toast.error("保存失败");
    }
  };

  const totalSize = backups.reduce((a, b) => a + (b.fileSize || 0), 0);
  const successCount = backups.filter(b => b.status === "success").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">数据备份</h1>
          <p className="text-sm text-muted-foreground mt-1">保护数据安全，支持手动/自动备份</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleClearOld} disabled={loading}>
            <RotateCcw className="size-4 mr-1" /> 清理旧备份
          </Button>
          <Button size="sm" onClick={handleBackup} disabled={creating}>
            {creating ? <><Loader2 className="size-4 mr-1 animate-spin" /> 备份中...</> : <><Save className="size-4 mr-1" /> 立即备份</>}
          </Button>
        </div>
      </div>

      <KpiRow cards={[
        { title: "备份总数", value: String(backups.length), subtitle: "全部记录", accent: "#0071E3", icon: <Database className="size-4" /> },
        { title: "成功备份", value: String(successCount), subtitle: "可用恢复", accent: "#34C759", icon: <CheckCircle2 className="size-4" /> },
        { title: "占用空间", value: fmtSize(totalSize), subtitle: "本地存储", accent: "#FF9500", icon: <HardDrive className="size-4" /> },
        { title: "最近备份", value: backups[0] ? new Date(backups[0].createdAt).toLocaleDateString("zh-CN") : "—", subtitle: backups[0]?.backupType || "", accent: "#AF52DE", icon: <Clock className="size-4" /> },
      ]} />

      <SectionCard title="自动备份设置" subtitle="按计划自动创建数据库快照">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={autoType} onValueChange={setAutoType}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="off">关闭自动备份</SelectItem>
              <SelectItem value="auto_daily">每天自动备份</SelectItem>
              <SelectItem value="auto_weekly">每周自动备份</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleSaveAuto}>保存设置</Button>
          <span className="text-xs text-muted-foreground">
            {autoType === "off" ? "已关闭，建议开启自动备份" :
             autoType === "auto_daily" ? "将在每日凌晨 3:00 自动备份" :
             "将在每周一凌晨 3:00 自动备份"}
          </span>
        </div>
      </SectionCard>

      <SectionCard title="备份记录" subtitle="所有备份历史">
        <div className="max-h-[500px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>文件路径</TableHead>
                <TableHead className="text-right">大小</TableHead>
                <TableHead>备份时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.map(b => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Badge style={{ background: TYPE_COLORS[b.backupType] || "#6E6E73", color: "#fff", border: "none" }}>
                      {TYPE_LABELS[b.backupType] || b.backupType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {b.status === "success" ? (
                      <span className="flex items-center gap-1 text-[#34C759] text-xs"><CheckCircle2 className="size-3.5" /> 成功</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[#FF3B30] text-xs"><XCircle className="size-3.5" /> 失败</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono max-w-[280px] truncate" title={b.filePath}>
                    {b.filePath}
                  </TableCell>
                  <TableCell className="text-right text-xs">{fmtSize(b.fileSize)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleString("zh-CN")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(b)} className="text-[#FF3B30]">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {backups.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    暂无备份记录，点击右上角「立即备份」开始
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <SectionCard title="备份说明" subtitle="数据安全建议">
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>1. 备份文件存储于服务器本地 <code className="bg-muted px-1.5 py-0.5 rounded text-xs">~/.ecom_cockpit_pro_web/backups</code>；</p>
          <p>2. 建议开启每日自动备份，确保数据安全；</p>
          <p>3. 备份保留建议：30 天内的备份可随时回滚，超出可手动清理；</p>
          <p>4. 数据库文件为 SQLite 单文件，可直接下载备份文件进行离线分析；</p>
          <p>5. 恢复：将备份文件覆盖当前数据库文件即可（需要停止服务后操作）。</p>
        </div>
      </SectionCard>
    </div>
  );
}
