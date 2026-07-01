"use client";

import { useState, useEffect } from "react";
import { KpiRow, SectionCard } from "@/components/ecom/kpi";
import { StoreSelector, RefreshButton, useStores } from "@/components/ecom/store-selector";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const fmtMoney = (v: number) => `¥${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

const TABS = [
  { key: "sales", label: "爆款", desc: "按销售额排序", color: "#FF3B30" },
  { key: "profit", label: "利润", desc: "按毛利排序", color: "#34C759" },
  { key: "slow", label: "滞销", desc: "按销量升序", color: "#FF9500" },
  { key: "refund", label: "高退款", desc: "按退款率排序", color: "#AF52DE" },
];

const PIE_COLORS = ["#0071E3", "#34C759", "#FF9500", "#AF52DE", "#FF3B30", "#5856D6", "#FF2D55"];
const TOOLTIP_STYLE = { background: "#1D1D1F", border: "none", borderRadius: 8, color: "#fff", fontSize: 12 };

export function SkuPage() {
  const { stores } = useStores();
  const [storeId, setStoreId] = useState("all");
  const [days, setDays] = useState(30);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [clearing, setClearing] = useState(false);

  // 新增 SKU 表单
  const [newSku, setNewSku] = useState({
    storeId: "",
    skuCode: "",
    skuName: "",
    category: "",
    unitCost: 0,
    unitPrice: 0,
    stock: 0,
  });

  const loadData = () => {
    setLoading(true);
    const sid = storeId === "all" ? "" : `&storeId=${storeId}`;
    fetch(`/api/sku?${sid.slice(1)}&days=${days}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { toast.error("加载失败"); setLoading(false); });
  };

  useEffect(() => { loadData(); }, [storeId, days]);

  // 新增 SKU
  const handleAddSku = async () => {
    if (!newSku.storeId || !newSku.skuCode || !newSku.skuName) {
      toast.error("请填写店铺、SKU编码和名称");
      return;
    }
    try {
      const res = await fetch("/api/sku-manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSku),
      });
      if (res.ok) {
        toast.success("SKU 添加成功");
        setShowAddDialog(false);
        setNewSku({ storeId: "", skuCode: "", skuName: "", category: "", unitCost: 0, unitPrice: 0, stock: 0 });
        loadData();
      } else {
        const d = await res.json();
        toast.error(d.error || "添加失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  // 删除单个 SKU
  const handleDeleteSku = async (skuId: string) => {
    if (!confirm("确认删除该 SKU 及其所有销售数据？")) return;
    try {
      const res = await fetch(`/api/sku-manage?id=${skuId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("已删除");
        loadData();
      } else {
        toast.error("删除失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  // 清空所有 SKU
  const handleClearAll = async () => {
    if (!confirm("确认清空所有 SKU 数据？此操作不可恢复！")) return;
    setClearing(true);
    try {
      const storeIdParam = storeId !== "all" ? `&storeId=${storeId}` : "";
      const res = await fetch(`/api/sku-manage?all=true${storeIdParam}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("已清空所有 SKU 数据");
        loadData();
      } else {
        toast.error("清空失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setClearing(false);
    }
  };

  const totals = data?.totals || {};
  const rankings = data?.rankings || {};

  const renderKpiRow = () => (
    <KpiRow cards={[
      { title: "SKU 总数", value: String(totals.count || 0), subtitle: `统计周期 ${days} 天`, accent: "#0071E3" },
      { title: "总销售额", value: fmtMoney(totals.totalSales || 0), subtitle: `总利润 ${fmtMoney(totals.totalProfit || 0)}`, accent: "#34C759" },
      { title: "平均 ROI", value: (totals.avgRoi || 0).toFixed(2), subtitle: "所有 SKU 均值", accent: "#AF52DE" },
      { title: "平均退款率", value: fmtPct(totals.avgRefund || 0), subtitle: "所有 SKU 均值", accent: (totals.avgRefund || 0) > 0.08 ? "#FF3B30" : "#FF9500" },
    ]} />
  );

  const renderTab = (tabKey: string) => {
    const list: any[] = rankings[tabKey] || [];
    const top10 = list.slice(0, 10);
    const barData = top10.map(s => ({
      name: s.skuName?.length > 8 ? s.skuName.slice(0, 8) + "…" : s.skuName || s.skuCode,
      value: tabKey === "sales" ? s.salesAmount : tabKey === "profit" ? s.grossProfit : tabKey === "slow" ? s.quantity : s.refundRate,
    }));

    const valueFormatter = (v: any) => tabKey === "refund" ? `${(v * 100).toFixed(1)}%` : tabKey === "slow" ? `${v} 件` : `¥${v.toLocaleString()}`;

    return (
      <div className="space-y-4">
        {renderKpiRow()}
        <SectionCard title={`Top 10 ${TABS.find(t => t.key === tabKey)?.label} SKU`} subtitle={TABS.find(t => t.key === tabKey)?.desc}>
          <div className="h-[340px]">
            {barData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">暂无数据</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ left: 30, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" horizontal={false} />
                  <XAxis type="number" stroke="#6E6E73" fontSize={11} tickLine={false} axisLine={false}
                    tickFormatter={(v) => tabKey === "refund" ? `${(v * 100).toFixed(0)}%` : tabKey === "slow" ? String(v) : v >= 10000 ? `${(v / 10000).toFixed(1)}万` : String(v)} />
                  <YAxis type="category" dataKey="name" stroke="#6E6E73" fontSize={11} tickLine={false} axisLine={false} width={90} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={valueFormatter} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
                    {barData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        <SectionCard title="明细列表" subtitle={`共 ${list.length} 个 SKU`}>
          <div className="max-h-[480px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>排名</TableHead>
                  <TableHead>SKU 编码</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead className="text-right">销售额</TableHead>
                  <TableHead className="text-right">销量</TableHead>
                  <TableHead className="text-right">毛利</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                  <TableHead className="text-right">退款率</TableHead>
                  <TableHead className="text-center w-12">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.slice(0, 50).map((s, i) => (
                  <TableRow key={s.skuId || i}>
                    <TableCell>
                      <Badge variant={i < 3 ? "default" : "outline"}
                        style={i < 3 ? { background: PIE_COLORS[i], border: "none" } : {}}>
                        {i + 1}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{s.skuCode}</TableCell>
                    <TableCell className="font-medium">{s.skuName}</TableCell>
                    <TableCell className="text-right">{fmtMoney(s.salesAmount)}</TableCell>
                    <TableCell className="text-right">{s.quantity}</TableCell>
                    <TableCell className="text-right" style={{ color: s.grossProfit >= 0 ? "#34C759" : "#FF3B30" }}>{fmtMoney(s.grossProfit)}</TableCell>
                    <TableCell className="text-right">{s.roi.toFixed(2)}</TableCell>
                    <TableCell className="text-right" style={{ color: s.refundRate > 0.08 ? "#FF3B30" : undefined }}>{fmtPct(s.refundRate)}</TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={() => handleDeleteSku(s.skuId)}
                        className="text-muted-foreground hover:text-[#FF3B30] p-1"
                        title="删除"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
                {list.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">暂无数据</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SKU 利润分析</h1>
          <p className="text-sm text-muted-foreground mt-1">爆款/利润/滞销/高退款多维度 SKU 分析</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StoreSelector value={storeId} onChange={setStoreId} />
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">近 7 天</SelectItem>
              <SelectItem value="30">近 30 天</SelectItem>
              <SelectItem value="90">近 90 天</SelectItem>
            </SelectContent>
          </Select>
          <RefreshButton onClick={loadData} loading={loading} />
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="size-4 mr-1" /> 添加 SKU</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加 SKU</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">所属店铺 *</Label>
                  <Select value={newSku.storeId} onValueChange={(v) => setNewSku({ ...newSku, storeId: v })}>
                    <SelectTrigger><SelectValue placeholder="选择店铺" /></SelectTrigger>
                    <SelectContent>
                      {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">SKU 编码 *</Label>
                    <Input value={newSku.skuCode} onChange={e => setNewSku({ ...newSku, skuCode: e.target.value })} placeholder="SP-001" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">商品名称 *</Label>
                    <Input value={newSku.skuName} onChange={e => setNewSku({ ...newSku, skuName: e.target.value })} placeholder="商品名称" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">类目</Label>
                    <Input value={newSku.category} onChange={e => setNewSku({ ...newSku, category: e.target.value })} placeholder="数码/家居/个护" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">库存</Label>
                    <Input type="number" value={newSku.stock || ""} onChange={e => setNewSku({ ...newSku, stock: Number(e.target.value) })} placeholder="0" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">单位成本</Label>
                    <Input type="number" value={newSku.unitCost || ""} onChange={e => setNewSku({ ...newSku, unitCost: Number(e.target.value) })} placeholder="0.00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">售价</Label>
                    <Input type="number" value={newSku.unitPrice || ""} onChange={e => setNewSku({ ...newSku, unitPrice: Number(e.target.value) })} placeholder="0.00" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>取消</Button>
                  <Button onClick={handleAddSku}>保存</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="outline" onClick={handleClearAll} disabled={clearing}>
            {clearing ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Trash2 className="size-4 mr-1" />}
            清空数据
          </Button>
        </div>
      </div>

      <Tabs defaultValue="sales">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="sales">🔥 爆款</TabsTrigger>
          <TabsTrigger value="profit">💰 利润</TabsTrigger>
          <TabsTrigger value="slow">📉 滞销</TabsTrigger>
          <TabsTrigger value="refund">↩️ 高退款</TabsTrigger>
        </TabsList>
        {TABS.map(t => (
          <TabsContent key={t.key} value={t.key}>{renderTab(t.key)}</TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
