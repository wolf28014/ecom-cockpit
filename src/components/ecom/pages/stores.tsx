"use client";

import { useState, useEffect } from "react";
import { KpiRow, SectionCard } from "@/components/ecom/kpi";
import { RefreshButton } from "@/components/ecom/store-selector";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Plus, Pencil, Trash2, Store as StoreIcon } from "lucide-react";
import { toast } from "sonner";
import { getCached, setCached, clearCacheByPrefix } from "@/lib/cache";

const PLATFORM_LABELS: Record<string, string> = {
  taobao: "淘宝店",
  tmall: "天猫店",
  douyin: "抖店",
  pinduoduo: "拼多多",
};

const PLATFORM_COLORS: Record<string, string> = {
  taobao: "#FF9500",
  tmall: "#FF3B30",
  douyin: "#1D1D1F",
  pinduoduo: "#34C759",
};

interface StoreItem {
  id: string;
  name: string;
  platform: string;
  shopUrl?: string | null;
  shopId?: string | null;
  contact?: string | null;
  note?: string | null;
  isActive: boolean;
  createdAt: string;
  platformLabel?: string;
  dailyRecordsCount?: number;
  skusCount?: number;
}

const emptyForm = {
  id: "", name: "", platform: "taobao", shopUrl: "", shopId: "", contact: "", isActive: true, note: "",
};

export function StoresPage() {
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [compareData, setCompareData] = useState<any[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);

  const loadStores = () => {
    // 先尝试缓存
    const cached = getCached<StoreItem[]>("ecom:stores");
    if (cached) {
      setStores(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    fetch("/api/stores")
      .then(r => r.json())
      .then(data => { setStores(data); setLoading(false); setCached("ecom:stores", data); })
      .catch(() => { if (!cached) toast.error("加载店铺列表失败"); setLoading(false); });
  };

  const loadCompare = async () => {
    setCompareLoading(true);
    try {
      const results = await Promise.all(
        stores.filter(s => s.isActive).map(async s => {
          const r = await fetch(`/api/dashboard?storeId=${s.id}&days=30`);
          const d = await r.json();
          return {
            name: s.name,
            platform: s.platform,
            sales: d?.month?.salesAmount || 0,
            profit: d?.month?.netProfit || 0,
          };
        })
      );
      setCompareData(results);
    } catch {
      toast.error("加载对比数据失败");
    } finally {
      setCompareLoading(false);
    }
  };

  useEffect(() => { loadStores(); }, []);
  useEffect(() => { if (stores.length > 0) loadCompare(); }, [stores.length]);

  const openAdd = () => { setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (s: StoreItem) => {
    setForm({
      id: s.id, name: s.name, platform: s.platform,
      shopUrl: s.shopUrl || "", shopId: s.shopId || "",
      contact: s.contact || "", isActive: s.isActive, note: s.note || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("请填写店铺名称"); return; }
    setSaving(true);
    const payload = {
      ...(form.id ? { id: form.id } : {}),
      name: form.name,
      platform: form.platform,
      shopUrl: form.shopUrl || null,
      shopId: form.shopId || null,
      contact: form.contact || null,
      note: form.note || null,
      isActive: form.isActive,
    };
    try {
      const res = await fetch("/api/stores", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success(form.id ? "店铺已更新" : "店铺已创建");
      setDialogOpen(false);
      clearCacheByPrefix("ecom:stores"); loadStores();
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (s: StoreItem) => {
    try {
      await fetch("/api/stores", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id, isActive: !s.isActive }),
      });
      toast.success(s.isActive ? "已停用" : "已启用");
      clearCacheByPrefix("ecom:stores"); loadStores();
    } catch {
      toast.error("操作失败");
    }
  };

  const handleDelete = async (s: StoreItem) => {
    if (!confirm(`确认删除店铺「${s.name}」？所有相关数据将一并删除。`)) return;
    try {
      await fetch(`/api/stores?id=${s.id}`, { method: "DELETE" });
      toast.success("已删除");
      clearCacheByPrefix("ecom:stores"); loadStores();
    } catch {
      toast.error("删除失败");
    }
  };

  const fmtMoney = (v: number) => `¥${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">多店铺管理</h1>
          <p className="text-sm text-muted-foreground mt-1">管理你的全平台电商店铺</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onClick={loadStores} loading={loading} />
          <Button onClick={openAdd} size="sm">
            <Plus className="size-4 mr-1" /> 新增店铺
          </Button>
        </div>
      </div>

      <KpiRow cards={[
        { title: "店铺总数", value: String(stores.length), subtitle: "全平台", accent: "#0071E3", icon: <StoreIcon className="size-4" /> },
        { title: "营业中", value: String(stores.filter(s => s.isActive).length), subtitle: "已启用", accent: "#34C759" },
        { title: "已停用", value: String(stores.filter(s => !s.isActive).length), subtitle: "暂停经营", accent: "#FF9500" },
        { title: "淘宝系", value: String(stores.filter(s => s.platform === "taobao" || s.platform === "tmall").length), subtitle: "淘宝+天猫", accent: "#FF3B30" },
        { title: "抖音+拼多多", value: String(stores.filter(s => s.platform === "douyin" || s.platform === "pinduoduo").length), subtitle: "新兴渠道", accent: "#AF52DE" },
      ]} />

      <SectionCard title="店铺列表" subtitle="所有店铺基础信息">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>店铺名称</TableHead>
              <TableHead>平台</TableHead>
              <TableHead>联系人</TableHead>
              <TableHead>店铺ID</TableHead>
              <TableHead>数据/SKU</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stores.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>
                  <Badge style={{ background: PLATFORM_COLORS[s.platform] || "#6E6E73", color: "#fff", border: "none" }}>
                    {PLATFORM_LABELS[s.platform] || s.platform}
                  </Badge>
                </TableCell>
                <TableCell>{s.contact || "—"}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{s.shopId || "—"}</TableCell>
                <TableCell className="text-xs">{s.dailyRecordsCount || 0} / {s.skusCount || 0}</TableCell>
                <TableCell>
                  <Badge variant={s.isActive ? "secondary" : "outline"}
                    style={s.isActive ? { background: "#E8F8EC", color: "#1B873F", border: "none" } : { color: "#86868B" }}>
                    {s.isActive ? "营业中" : "已停用"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString("zh-CN")}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleToggleActive(s)}>
                      {s.isActive ? "停用" : "启用"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(s)} className="text-[#FF3B30]">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {stores.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  暂无店铺，请点击右上角「新增店铺」开始
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard title="近 30 天销售/利润对比" subtitle="所有营业中店铺横向对比">
        <div className="h-[360px]">
          {compareData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              {compareLoading ? "加载中..." : "暂无对比数据"}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compareData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" />
                <XAxis dataKey="name" stroke="#6E6E73" fontSize={11} tickLine={false} />
                <YAxis stroke="#6E6E73" fontSize={11} tickLine={false} axisLine={false}
                  tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(1)}万` : String(v)} />
                <Tooltip
                  contentStyle={{ background: "#1D1D1F", border: "none", borderRadius: 8, color: "#fff", fontSize: 12 }}
                  formatter={(v: any) => `¥${v.toLocaleString()}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="sales" name="销售额" fill="#0071E3" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="profit" name="净利润" fill="#34C759" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </SectionCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{form.id ? "编辑店铺" : "新增店铺"}</DialogTitle>
            <DialogDescription>填写店铺基础信息，平台决定推广字段配置</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>店铺名称 <span className="text-[#FF3B30]">*</span></Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="如：旗舰店" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>所属平台</Label>
                <Select value={form.platform} onValueChange={v => setForm({ ...form, platform: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>店铺ID</Label>
                <Input value={form.shopId} onChange={e => setForm({ ...form, shopId: e.target.value })} placeholder="可选" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>店铺链接</Label>
              <Input value={form.shopUrl} onChange={e => setForm({ ...form, shopUrl: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>联系人</Label>
              <Input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="负责人姓名/电话" />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2} placeholder="店铺说明、特殊经营事项" />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>启用店铺</Label>
                <p className="text-xs text-muted-foreground mt-0.5">停用后该店铺数据将不计入汇总</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={v => setForm({ ...form, isActive: v })} />
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
