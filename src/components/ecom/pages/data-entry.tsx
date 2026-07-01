"use client";

import { useState, useEffect } from "react";
import { KpiRow, SectionCard } from "@/components/ecom/kpi";
import { StoreSelector } from "@/components/ecom/store-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Save, Download, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";

const PLATFORM_PROMO: Record<string, string[]> = {
  taobao: ["直通车", "万相台", "引力魔方", "淘宝客", "其他"],
  tmall: ["直通车", "万相台", "引力魔方", "淘宝客", "品牌专区", "其他"],
  douyin: ["千川投放", "小店随心推", "达人推广", "直播投放", "其他"],
  pinduoduo: ["多多搜索", "多多场景", "多多进宝", "明星店铺", "其他"],
};

const COST_FIELDS = ["商品成本", "运费", "包装", "人工", "房租", "其他"];

interface StoreInfo { id: string; platform: string; }

export function DataEntryPage() {
  const [storeId, setStoreId] = useState("all");
  const [date, setDate] = useState<Date>(new Date());
  const [calOpen, setCalOpen] = useState(false);
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [base, setBase] = useState({ salesAmount: "0", orderCount: "0", refundAmount: "0", refundOrderCount: "0" });
  const [promo, setPromo] = useState<Record<string, string>>({});
  const [cost, setCost] = useState<Record<string, string>>({});

  // fetch store info to get platform
  useEffect(() => {
    if (storeId === "all") { setStoreInfo(null); return; }
    fetch("/api/stores")
      .then(r => r.json())
      .then((data: StoreInfo[]) => {
        const s = data.find(x => x.id === storeId);
        setStoreInfo(s || null);
      })
      .catch(() => setStoreInfo(null));
  }, [storeId]);

  // initialize promo fields when platform changes
  useEffect(() => {
    if (!storeInfo) return;
    const fields = PLATFORM_PROMO[storeInfo.platform] || [];
    setPromo(prev => {
      const next: Record<string, string> = {};
      for (const f of fields) next[f] = prev[f] || "0";
      return next;
    });
  }, [storeInfo?.platform]);

  // initialize cost fields
  useEffect(() => {
    setCost(prev => {
      const next: Record<string, string> = {};
      for (const f of COST_FIELDS) next[f] = prev[f] || "0";
      return next;
    });
  }, []);

  const loadExisting = async () => {
    if (storeId === "all") { toast.error("请选择具体店铺"); return; }
    setLoading(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const r = await fetch(`/api/data-entry?storeId=${storeId}&date=${dateStr}`);
      const d = await r.json();
      if (!d || !d.id) {
        toast.info("该日暂无数据，已重置为默认值");
        setBase({ salesAmount: "0", orderCount: "0", refundAmount: "0", refundOrderCount: "0" });
        const fields = storeInfo ? (PLATFORM_PROMO[storeInfo.platform] || []) : [];
        const newPromo: Record<string, string> = {};
        for (const f of fields) newPromo[f] = "0";
        setPromo(newPromo);
        const newCost: Record<string, string> = {};
        for (const f of COST_FIELDS) newCost[f] = "0";
        setCost(newCost);
        return;
      }
      setBase({
        salesAmount: String(d.salesAmount || 0),
        orderCount: String(d.orderCount || 0),
        refundAmount: String(d.refundAmount || 0),
        refundOrderCount: String(d.refundOrderCount || 0),
      });
      try {
        const promoObj = JSON.parse(d.promotionData || "{}");
        const fields = storeInfo ? (PLATFORM_PROMO[storeInfo.platform] || []) : [];
        const newPromo: Record<string, string> = {};
        for (const f of fields) newPromo[f] = String(promoObj[f] || 0);
        setPromo(newPromo);
      } catch { /* empty */ }
      try {
        const costObj = JSON.parse(d.costData || "{}");
        const newCost: Record<string, string> = {};
        for (const f of COST_FIELDS) newCost[f] = String(costObj[f] || 0);
        setCost(newCost);
      } catch { /* empty */ }
      toast.success("已加载该日数据");
    } catch {
      toast.error("加载数据失败");
    } finally {
      setLoading(false);
    }
  };

  // auto load on store/date change
  useEffect(() => {
    if (storeId !== "all" && storeInfo) loadExisting();
  }, [storeId, date, storeInfo?.platform]);

  const num = (s: string) => Number(s) || 0;

  const promoTotal = Object.values(promo).reduce((a, v) => a + num(v), 0);
  const costTotal = Object.values(cost).reduce((a, v) => a + num(v), 0);
  const goodsCost = num(cost["商品成本"] || "0");
  const shipping = num(cost["运费"] || "0");
  const packageCost = num(cost["包装"] || "0");
  const labor = num(cost["人工"] || "0");
  const rent = num(cost["房租"] || "0");
  const other = num(cost["其他"] || "0");

  const sales = num(base.salesAmount);
  const orders = num(base.orderCount);
  const refund = num(base.refundAmount);
  const refundOrders = num(base.refundOrderCount);

  const grossProfit = sales - goodsCost - refund;
  const netProfit = grossProfit - promoTotal - shipping - packageCost - labor - rent - other;
  const profitRate = sales > 0 ? netProfit / sales : 0;
  const roi = promoTotal > 0 ? sales / promoTotal : 0;
  const avgOrderValue = orders > 0 ? sales / orders : 0;
  const profitPerOrder = orders > 0 ? netProfit / orders : 0;
  const refundRate = orders > 0 ? refundOrders / orders : 0;
  const promotionRate = sales > 0 ? promoTotal / sales : 0;

  const fmtMoney = (v: number) => `¥${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

  const handleSave = async () => {
    if (storeId === "all") { toast.error("请选择具体店铺"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/data-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          recordDate: format(date, "yyyy-MM-dd"),
          salesAmount: sales,
          orderCount: orders,
          refundAmount: refund,
          refundOrderCount: refundOrders,
          promotionData: promo,
          costData: cost,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("数据已保存");
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setBase({ salesAmount: "0", orderCount: "0", refundAmount: "0", refundOrderCount: "0" });
    const fields = storeInfo ? (PLATFORM_PROMO[storeInfo.platform] || []) : [];
    const newPromo: Record<string, string> = {};
    for (const f of fields) newPromo[f] = "0";
    setPromo(newPromo);
    const newCost: Record<string, string> = {};
    for (const f of COST_FIELDS) newCost[f] = "0";
    setCost(newCost);
    toast.info("已重置为默认值");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">每日数据录入</h1>
          <p className="text-sm text-muted-foreground mt-1">录入销售/推广/成本，自动计算利润</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StoreSelector value={storeId} onChange={setStoreId} allowAll={false} />
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="size-4 mr-1" />
                {format(date, "yyyy-MM-dd")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => { if (d) { setDate(d); setCalOpen(false); } }}
                locale={zhCN}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={loadExisting} disabled={loading}>
            <Download className="size-4 mr-1" /> 加载
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="size-4 mr-1" /> 重置
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || storeId === "all"}>
            <Save className="size-4 mr-1" /> {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 基础数据 */}
        <Card className="shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">基础销售数据</h3>
              <span className="text-xs text-muted-foreground">单位：元/单</span>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">销售额（含运费）</Label>
                <Input type="number" value={base.salesAmount} onChange={e => setBase({ ...base, salesAmount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">订单数</Label>
                <Input type="number" value={base.orderCount} onChange={e => setBase({ ...base, orderCount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">退款金额</Label>
                <Input type="number" value={base.refundAmount} onChange={e => setBase({ ...base, refundAmount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">退款订单数</Label>
                <Input type="number" value={base.refundOrderCount} onChange={e => setBase({ ...base, refundOrderCount: e.target.value })} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 推广数据 */}
        <Card className="shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">推广数据</h3>
              <span className="text-xs text-muted-foreground">
                {storeInfo ? `当前平台：${storeInfo.platform}` : "请选择店铺"}
              </span>
            </div>
            {storeId === "all" ? (
              <p className="text-sm text-muted-foreground py-8 text-center">请先选择店铺</p>
            ) : (
              <div className="space-y-3">
                {Object.keys(promo).map(field => (
                  <div key={field} className="space-y-1.5">
                    <Label className="text-xs">{field}</Label>
                    <Input type="number" value={promo[field]} onChange={e => setPromo({ ...promo, [field]: e.target.value })} />
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">推广费合计</span>
                  <span className="font-bold text-[#0071E3]">{fmtMoney(promoTotal)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 成本数据 */}
        <Card className="shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">成本数据</h3>
              <span className="text-xs text-muted-foreground">含商品/运营成本</span>
            </div>
            <div className="space-y-3">
              {COST_FIELDS.map(field => (
                <div key={field} className="space-y-1.5">
                  <Label className="text-xs">{field}</Label>
                  <Input type="number" value={cost[field] || "0"} onChange={e => setCost({ ...cost, [field]: e.target.value })} />
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">成本合计</span>
                <span className="font-bold text-[#FF9500]">{fmtMoney(costTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 px-1">自动计算结果（实时）</h2>
        <KpiRow cards={[
          { title: "毛利润", value: fmtMoney(grossProfit), subtitle: "销售 - 成本 - 退款", accent: grossProfit >= 0 ? "#34C759" : "#FF3B30" },
          { title: "净利润", value: fmtMoney(netProfit), subtitle: "毛利 - 推广 - 运营成本", accent: netProfit >= 0 ? "#34C759" : "#FF3B30" },
          { title: "利润率", value: fmtPct(profitRate), subtitle: "净利 / 销售", accent: "#0071E3" },
          { title: "ROI", value: roi.toFixed(2), subtitle: `推广费率 ${fmtPct(promotionRate)}`, accent: roi >= 2 ? "#34C759" : "#FF9500" },
          { title: "客单价", value: fmtMoney(avgOrderValue), subtitle: `单均利润 ${fmtMoney(profitPerOrder)}`, accent: "#AF52DE" },
          { title: "退款率", value: fmtPct(refundRate), subtitle: `退款 ${fmtMoney(refund)}`, accent: refundRate > 0.08 ? "#FF3B30" : "#FF9500" },
        ]} />
      </div>
    </div>
  );
}
