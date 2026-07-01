"use client";

import { useState, useEffect } from "react";
import { KpiRow, SectionCard } from "@/components/ecom/kpi";
import { StoreSelector, RefreshButton } from "@/components/ecom/store-selector";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Sparkles, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = {
  yearly: "年度目标",
  quarterly: "季度目标",
  monthly: "月度目标",
};

const fmtMoney = (v: number) => `¥${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

interface Target {
  id: string;
  storeId: string;
  targetType: string;
  targetYear: number;
  targetQuarter?: number | null;
  targetMonth?: number | null;
  targetAmount: number;
  note?: string | null;
  createdAt: string;
}

const emptyForm = {
  id: "", targetType: "yearly", targetYear: new Date().getFullYear(),
  targetQuarter: 1, targetMonth: 1, targetAmount: "", note: "",
};

export function ProfitTargetPage() {
  const [storeId, setStoreId] = useState("all");
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<any>({});
  const [predictResult, setPredictResult] = useState("");
  const [predicting, setPredicting] = useState(false);

  const loadData = () => {
    setLoading(true);
    const sid = storeId === "all" ? "" : `&storeId=${storeId}`;
    Promise.all([
      fetch(`/api/targets?${sid.slice(1)}`).then(r => r.json()),
      fetch(`/api/dashboard?${sid.slice(1) || "days=30"}`).then(r => r.json()),
    ]).then(([t, d]) => {
      setTargets(t || []);
      setProgress(d?.progress || {});
      setLoading(false);
    }).catch(() => { toast.error("加载失败"); setLoading(false); });
  };

  useEffect(() => { loadData(); }, [storeId]);

  const openAdd = () => {
    if (storeId === "all") { toast.error("请选择具体店铺"); return; }
    setForm({ ...emptyForm, targetYear: new Date().getFullYear() });
    setDialogOpen(true);
  };

  const openEdit = (t: Target) => {
    setForm({
      id: t.id,
      targetType: t.targetType,
      targetYear: t.targetYear,
      targetQuarter: t.targetQuarter || 1,
      targetMonth: t.targetMonth || 1,
      targetAmount: String(t.targetAmount),
      note: t.note || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.targetAmount || Number(form.targetAmount) <= 0) {
      toast.error("请输入目标金额"); return;
    }
    setSaving(true);
    const payload: any = {
      ...(form.id ? { id: form.id } : { storeId }),
      targetType: form.targetType,
      targetYear: Number(form.targetYear),
      targetAmount: Number(form.targetAmount),
      note: form.note || null,
    };
    if (form.targetType === "quarterly") payload.targetQuarter = Number(form.targetQuarter);
    if (form.targetType === "monthly") payload.targetMonth = Number(form.targetMonth);
    try {
      const res = await fetch("/api/targets", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success(form.id ? "已更新" : "已创建");
      setDialogOpen(false);
      loadData();
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: Target) => {
    if (!confirm("确认删除该目标？")) return;
    try {
      await fetch(`/api/targets?id=${t.id}`, { method: "DELETE" });
      toast.success("已删除");
      loadData();
    } catch {
      toast.error("删除失败");
    }
  };

  const handlePredict = async () => {
    setPredicting(true);
    setPredictResult("");
    try {
      const r = await fetch("/api/ai/target-predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: storeId === "all" ? null : storeId }),
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setPredictResult(data.result || "");
    } catch {
      toast.error("AI 预测失败");
    } finally {
      setPredicting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">利润目标管理</h1>
          <p className="text-sm text-muted-foreground mt-1">设定目标、跟踪进度、AI 预测完成概率</p>
        </div>
        <div className="flex items-center gap-2">
          <StoreSelector value={storeId} onChange={setStoreId} />
          <RefreshButton onClick={loadData} loading={loading} />
          <Button size="sm" onClick={openAdd} disabled={storeId === "all"}>
            <Plus className="size-4 mr-1" /> 新增目标
          </Button>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 px-1">目标进度概览</h2>
        {Object.keys(progress).length === 0 ? (
          <SectionCard>
            <p className="text-sm text-muted-foreground py-6 text-center">暂未设置利润目标，请点击右上角新增</p>
          </SectionCard>
        ) : (
          <KpiRow cards={Object.entries(progress).map(([k, v]: any) => {
            const label = TYPE_LABELS[k] || k;
            const color = v.rate >= 0.8 ? "#34C759" : v.rate >= 0.5 ? "#FF9500" : "#FF3B30";
            return {
              title: label,
              value: `${(v.rate * 100).toFixed(1)}%`,
              subtitle: `${fmtMoney(v.actual)} / ${fmtMoney(v.target)}`,
              accent: color,
            };
          })} />
        )}
      </div>

      <SectionCard title="目标进度详情" subtitle="年度/季度/月度目标完成情况">
        <div className="space-y-5">
          {Object.entries(progress).map(([k, v]: any) => {
            const label = TYPE_LABELS[k] || k;
            const color = v.rate >= 0.8 ? "#34C759" : v.rate >= 0.5 ? "#FF9500" : "#FF3B30";
            return (
              <div key={k}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-sm text-muted-foreground">
                    已完成 <span style={{ color }} className="font-bold">{fmtMoney(v.actual)}</span>
                    {" / "}{fmtMoney(v.target)} ({(v.rate * 100).toFixed(1)}%)
                  </span>
                </div>
                <Progress value={v.rate * 100} className="h-2.5" style={{ background: "#F2F2F7" }} />
                <p className="text-xs text-muted-foreground mt-1">
                  剩余 {fmtMoney(v.remaining)}{v.daysLeft ? ` · 剩余 ${v.daysLeft} 天` : ""}
                </p>
              </div>
            );
          })}
          {Object.keys(progress).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">暂无目标数据</p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="目标列表" subtitle="所有已设定的利润目标">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>类型</TableHead>
              <TableHead>周期</TableHead>
              <TableHead className="text-right">目标金额</TableHead>
              <TableHead>备注</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets.map(t => (
              <TableRow key={t.id}>
                <TableCell>
                  <Badge variant="secondary" style={{ background: "#F0F7FF", color: "#0071E3", border: "none" }}>
                    {TYPE_LABELS[t.targetType] || t.targetType}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {t.targetYear}年
                  {t.targetQuarter ? ` Q${t.targetQuarter}` : ""}
                  {t.targetMonth ? ` ${t.targetMonth}月` : ""}
                </TableCell>
                <TableCell className="text-right font-semibold text-[#0071E3]">{fmtMoney(t.targetAmount)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{t.note || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString("zh-CN")}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(t)}><Pencil className="size-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(t)} className="text-[#FF3B30]"><Trash2 className="size-3.5" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {targets.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">暂无目标</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard
        title="AI 利润目标预测"
        subtitle="基于当前节奏预测全年目标完成概率"
        action={
          <Button size="sm" onClick={handlePredict} disabled={predicting}>
            {predicting ? <><Loader2 className="size-4 mr-1 animate-spin" /> 预测中...</> : <><Sparkles className="size-4 mr-1" /> AI 预测</>}
          </Button>
        }
      >
        {predicting ? (
          <div className="py-12 text-center">
            <Loader2 className="size-8 mx-auto animate-spin text-[#0071E3] mb-3" />
            <p className="text-sm text-muted-foreground">GLM-4 正在分析进度并预测完成概率...</p>
          </div>
        ) : predictResult ? (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-semibold mt-4 mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1.5">{children}</h3>,
                p: ({ children }) => <p className="text-sm leading-6 my-2">{children}</p>,
                ul: ({ children }) => <ul className="text-sm my-2 list-disc pl-5 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="text-sm my-2 list-decimal pl-5 space-y-1">{children}</ol>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              }}
            >
              {predictResult}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="py-12 text-center">
            <Sparkles className="size-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">点击右上角「AI 预测」按钮开始分析</p>
          </div>
        )}
      </SectionCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{form.id ? "编辑利润目标" : "新增利润目标"}</DialogTitle>
            <DialogDescription>设定阶段性利润目标，系统会自动跟踪进度</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>目标类型</Label>
              <Select value={form.targetType} onValueChange={v => setForm({ ...form, targetType: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yearly">年度目标</SelectItem>
                  <SelectItem value="quarterly">季度目标</SelectItem>
                  <SelectItem value="monthly">月度目标</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>年份</Label>
                <Input type="number" value={form.targetYear} onChange={e => setForm({ ...form, targetYear: Number(e.target.value) })} />
              </div>
              {form.targetType === "quarterly" && (
                <div className="space-y-2">
                  <Label>季度</Label>
                  <Select value={String(form.targetQuarter)} onValueChange={v => setForm({ ...form, targetQuarter: Number(v) })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map(q => <SelectItem key={q} value={String(q)}>第 {q} 季度</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.targetType === "monthly" && (
                <div className="space-y-2">
                  <Label>月份</Label>
                  <Select value={String(form.targetMonth)} onValueChange={v => setForm({ ...form, targetMonth: Number(v) })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <SelectItem key={m} value={String(m)}>{m} 月</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>目标金额（元） <span className="text-[#FF3B30]">*</span></Label>
              <Input type="number" value={form.targetAmount} onChange={e => setForm({ ...form, targetAmount: e.target.value })} placeholder="如 100000" />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2} placeholder="目标说明" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
