"use client";

import { useState, useEffect } from "react";
import { KpiRow, SectionCard } from "@/components/ecom/kpi";
import { StoreSelector, RefreshButton, useStores } from "@/components/ecom/store-selector";
import { StoreMultiSelect } from "@/components/ecom/store-multi-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";

const PROMOTION_FIELDS = [
  "货品全站推广",
  "关键词推广",
  "人群推广",
  "店铺直达",
  "内容营销",
  "淘宝客",
  "其它",
];

const MONTHLY_COST_FIELDS = [
  { key: "goodsCost", label: "货品成本" },
  { key: "redPacket", label: "红包" },
  { key: "labor", label: "人工" },
  { key: "other", label: "其它" },
  { key: "consumerExperience", label: "消费者体验提升计划服务费" },
  { key: "bnplTechFee", label: "先用后付技术服务费" },
  { key: "basicSoftwareFee", label: "基础软件服务费" },
  { key: "redPacketAdvance", label: "限时红包代商家垫付扣回" },
  { key: "logistics", label: "商家集运物流服务费" },
  { key: "brandGiftFee", label: "品牌新享淘宝礼金软件服务费" },
  { key: "charity", label: "公益宝贝" },
  { key: "quickPaymentFee", label: "淘宝极速回款手动回款服务费" },
  { key: "marketingPlatform", label: "营销平台" },
] as const;

export function DataEntryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">数据录入</h1>
        <p className="text-sm text-muted-foreground mt-1">每日数据 + 月度成本</p>
      </div>
      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">每日数据录入</TabsTrigger>
          <TabsTrigger value="monthly">月度成本录入</TabsTrigger>
        </TabsList>
        <TabsContent value="daily"><DailyTab /></TabsContent>
        <TabsContent value="monthly"><MonthlyTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// =================== 每日数据录入 ===================
function DailyTab() {
  const { stores, loading } = useStores();
  const [storeId, setStoreId] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  // 基础数据
  const [sales, setSales] = useState(0);
  const [orders, setOrders] = useState(0);
  const [refund, setRefund] = useState(0);
  const [visitors, setVisitors] = useState(0);

  // 推广数据
  const [promo, setPromo] = useState<Record<string, number>>({});
  const [promoManualTotal, setPromoManualTotal] = useState<string>(""); // 手填合计

  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!storeId && stores.length > 0) setStoreId(stores[0].id);
  }, [stores, storeId]);

  // 初始化推广字段
  useEffect(() => {
    const init: Record<string, number> = {};
    PROMOTION_FIELDS.forEach(f => (init[f] = 0));
    setPromo(init);
  }, []);

  // 切换店铺/日期时加载已有数据
  useEffect(() => {
    if (!storeId) return;
    setLoadingData(true);
    fetch(`/api/data-entry?storeId=${storeId}&date=${date}`)
      .then(r => r.json())
      .then(d => {
        if (d) {
          setSales(d.salesAmount || 0);
          setOrders(d.orderCount || 0);
          setRefund(d.refundAmount || 0);
          setVisitors(d.visitors || 0);
          const promoData = d.promotionData || {};
          const init: Record<string, number> = {};
          PROMOTION_FIELDS.forEach(f => (init[f] = promoData[f] || 0));
          setPromo(init);
          setPromoManualTotal(d.promotionManualTotal != null ? String(d.promotionManualTotal) : "");
        } else {
          setSales(0); setOrders(0); setRefund(0); setVisitors(0);
          const init: Record<string, number> = {};
          PROMOTION_FIELDS.forEach(f => (init[f] = 0));
          setPromo(init);
          setPromoManualTotal("");
        }
      })
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, [storeId, date]);

  // 自动计算
  const promoAutoTotal = Object.values(promo).reduce((a, b) => a + (Number(b) || 0), 0);
  const promoEffectiveTotal = promoManualTotal !== "" && Number(promoManualTotal) > 0
    ? Number(promoManualTotal) : promoAutoTotal;

  const netSales = sales - refund;
  const refundRate = sales > 0 ? refund / sales : 0;
  const promotionRate = sales > 0 ? promoEffectiveTotal / sales : 0;
  const roi = promoEffectiveTotal > 0 ? sales / promoEffectiveTotal : 0;
  const avgOrderValue = orders > 0 ? sales / orders : 0;
  const conversionRate = visitors > 0 ? orders / visitors : 0;

  const fmt = (v: number) => `¥${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;

  const handleSave = async (silent = false) => {
    if (!storeId) {
      if (!silent) toast.error("请先选择店铺");
      return;
    }
    if (!silent) setSaving(true);
    try {
      const res = await fetch("/api/data-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId, recordDate: date,
          salesAmount: sales, orderCount: orders, refundAmount: refund, visitors,
          promotionData: promo,
          promotionManualTotal: promoManualTotal !== "" ? Number(promoManualTotal) : null,
        }),
      });
      if (res.ok) {
        if (silent) {
          // 静默自动保存：右下角轻提示
          toast.success("已自动保存", {
            description: `净销售额 ${fmt(netSales)}`,
            duration: 2000,
          });
        } else {
          toast.success("保存成功", {
            description: `净销售额 ${fmt(netSales)} · 投产比 ${roi.toFixed(2)}`,
          });
        }
        // 清除 dashboard 缓存，让首页下次加载新数据
        try {
          localStorage.removeItem("ecom:dashboard:all");
          localStorage.removeItem(`ecom:dashboard:${storeId}`);
        } catch {}
      } else {
        if (!silent) toast.error("保存失败");
      }
    } catch (e) {
      if (!silent) toast.error("保存失败");
    } finally {
      if (!silent) setSaving(false);
    }
  };

  // 失焦自动保存（静默模式）
  const handleBlur = () => {
    if (!storeId) return;
    handleSave(true);
  };

  return (
    <div className="space-y-4">
      {/* 顶部：店铺 + 日期 */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">选择店铺</Label>
            <StoreSelector value={storeId || "all"} onChange={(v) => setStoreId(v === "all" ? "" : v)} allowAll={false} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">录入日期</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[180px]" />
          </div>
          <div className="ml-auto flex gap-2">
            {loadingData && <span className="text-xs text-muted-foreground self-center">加载中...</span>}
            <RefreshButton onClick={() => {}} loading={loadingData} />
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存数据"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 基础销售数据 */}
        <SectionCard title="基础销售数据" subtitle="销售额 / 订单 / 退款 / 访客">
          <div className="space-y-3">
            <div>
              <Label className="text-xs">销售额</Label>
              <Input type="number" value={sales || ""} onChange={(e) => setSales(Number(e.target.value))} onBlur={handleBlur} placeholder="0.00" />
            </div>
            <div>
              <Label className="text-xs">订单数</Label>
              <Input type="number" value={orders || ""} onChange={(e) => setOrders(Number(e.target.value))} onBlur={handleBlur} placeholder="0" />
            </div>
            <div>
              <Label className="text-xs">退款金额</Label>
              <Input type="number" value={refund || ""} onChange={(e) => setRefund(Number(e.target.value))} onBlur={handleBlur} placeholder="0.00" />
            </div>
            <div>
              <Label className="text-xs">访客数</Label>
              <Input type="number" value={visitors || ""} onChange={(e) => setVisitors(Number(e.target.value))} onBlur={handleBlur} placeholder="0" />
            </div>
          </div>
        </SectionCard>

        {/* 推广数据 */}
        <SectionCard
          title="推广数据"
          subtitle="7 项推广渠道 · 合计可手填"
          action={
            <div className="text-right">
              <p className="text-xs text-muted-foreground">合计（自动）</p>
              <p className="text-sm font-semibold">{fmt(promoAutoTotal)}</p>
            </div>
          }
        >
          <div className="space-y-3">
            {PROMOTION_FIELDS.map((f) => (
              <div key={f}>
                <Label className="text-xs">{f}</Label>
                <Input
                  type="number"
                  value={promo[f] || ""}
                  onChange={(e) => setPromo({ ...promo, [f]: Number(e.target.value) })}
                  onBlur={handleBlur}
                  placeholder="0.00"
                />
              </div>
            ))}
            <div className="pt-2 border-t">
              <Label className="text-xs text-[#0071E3]">推广合计（手填覆盖）</Label>
              <Input
                type="number"
                value={promoManualTotal}
                onChange={(e) => setPromoManualTotal(e.target.value)}
                onBlur={handleBlur}
                placeholder="留空则用自动汇总"
                className="border-[#0071E3]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                当前生效合计：<span className="font-semibold text-[#0071E3]">{fmt(promoEffectiveTotal)}</span>
              </p>
            </div>
          </div>
        </SectionCard>

        {/* 自动计算 */}
        <SectionCard title="自动计算结果" subtitle="保存后立即生效">
          <div className="grid grid-cols-2 gap-2">
            <CalcItem label="净销售额" value={fmt(netSales)} color="#34C759" />
            <CalcItem label="退款率" value={fmtPct(refundRate)} color="#FF9500" />
            <CalcItem label="推广费用" value={fmt(promoEffectiveTotal)} color="#0071E3" />
            <CalcItem label="推广占比" value={fmtPct(promotionRate)} color="#0071E3" />
            <CalcItem label="投产比" value={roi.toFixed(2)} color="#AF52DE" />
            <CalcItem label="客单价" value={fmt(avgOrderValue)} color="#1D1D1F" />
            <CalcItem label="转化率" value={fmtPct(conversionRate)} color="#FF3B30" />
            <CalcItem label="访客数" value={String(visitors)} color="#1D1D1F" />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function CalcItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border p-2.5 bg-[#F8F8FA]">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-base font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

// =================== 月度成本录入 ===================
function MonthlyTab() {
  const { stores } = useStores();
  const [storeId, setStoreId] = useState<string>("");
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [costs, setCosts] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storeId && stores.length > 0) setStoreId(stores[0].id);
  }, [stores, storeId]);

  useEffect(() => {
    const init: Record<string, number> = {};
    MONTHLY_COST_FIELDS.forEach(f => (init[f.key] = 0));
    setCosts(init);
  }, []);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    fetch(`/api/monthly-cost?storeId=${storeId}&year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => {
        if (d) {
          const init: Record<string, number> = {};
          MONTHLY_COST_FIELDS.forEach(f => (init[f.key] = d[f.key] || 0));
          setCosts(init);
          setNote(d.note || "");
        } else {
          const init: Record<string, number> = {};
          MONTHLY_COST_FIELDS.forEach(f => (init[f.key] = 0));
          setCosts(init);
          setNote("");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storeId, year, month]);

  const total = Object.values(costs).reduce((a, b) => a + (Number(b) || 0), 0);
  const fmt = (v: number) => `¥${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const handleSave = async () => {
    if (!storeId) {
      toast.error("请先选择店铺");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/monthly-cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, year, month, ...costs, note }),
      });
      if (res.ok) {
        toast.success("月度成本已保存", {
          description: `${year}年${month}月 · 合计 ${fmt(total)}`,
        });
      } else {
        toast.error("保存失败");
      }
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">选择店铺</Label>
            <StoreSelector value={storeId || "all"} onChange={(v) => setStoreId(v === "all" ? "" : v)} allowAll={false} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">年份</Label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-[120px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">月份</Label>
            <Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-[100px]" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            {loading && <span className="text-xs text-muted-foreground">加载中...</span>}
            <div className="text-right">
              <p className="text-xs text-muted-foreground">成本合计</p>
              <p className="text-lg font-bold text-[#FF3B30]">{fmt(total)}</p>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <SectionCard title="月度成本明细" subtitle="12 项成本明细（按月填写）">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MONTHLY_COST_FIELDS.map((f) => (
            <div key={f.key}>
              <Label className="text-xs">{f.label}</Label>
              <Input
                type="number"
                value={costs[f.key] || ""}
                onChange={(e) => setCosts({ ...costs, [f.key]: Number(e.target.value) })}
                placeholder="0.00"
              />
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Label className="text-xs">备注</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="可填写本月特殊说明..." className="min-h-[60px]" />
        </div>
      </SectionCard>
    </div>
  );
}

// =================== 数据明细表格（生意参谋风格） ===================
function DetailTab() {
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [yearType, setYearType] = useState<"natural" | "seasonal">("natural");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // storeIds 为空数组表示全店铺，直接加载
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const sidParam = storeIds.length > 0 ? `&storeIds=${storeIds.join(",")}` : "";
    fetch(`/api/daily-detail?yearType=${yearType}${sidParam}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [storeIds, yearType]);

  const rows: any[] = data?.rows || [];
  const summary: any = data?.summary || {};

  const fmtMoney = (v: number) => v?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || "0";
  const fmtPct = (v: number | null) => v === null || v === undefined ? "—" : `${(v * 100).toFixed(2)}%`;
  const fmtPct0 = (v: number | null) => v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`;
  const fmtYoy = (v: number | null) => {
    if (v === null || v === undefined) return "—";
    const sign = v >= 0 ? "+" : "";
    return `${sign}${(v * 100).toFixed(1)}%`;
  };

  const yearLabel = yearType === "seasonal" ? "季节年" : "自然年";

  return (
    <div className="space-y-4">
      {/* 顶部控制栏 */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">选择店铺（可多选汇总）</Label>
            <StoreMultiSelect value={storeIds} onChange={setStoreIds} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">统计周期</Label>
            <ToggleGroup type="single" value={yearType} onValueChange={(v) => v && setYearType(v as "natural" | "seasonal")}>
              <ToggleGroupItem value="natural" className="text-xs">自然年</ToggleGroupItem>
              <ToggleGroupItem value="seasonal" className="text-xs">季节年</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-muted-foreground">{yearLabel}周期</p>
            <p className="text-sm font-medium">{data?.startDate} ~ {data?.endDate}</p>
            <p className="text-xs text-muted-foreground mt-1">共 {data?.totalDays || 0} 天</p>
          </div>
        </CardContent>
      </Card>

      {/* 数据表格 - 生意参谋风格，横纵向均可滚动 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto" style={{ maxHeight: "70vh" }}>
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-20">
                <tr className="bg-[#0071E3] text-white">
                  <th className="sticky left-0 top-0 z-30 bg-[#0071E3] px-3 py-2.5 text-left font-semibold whitespace-nowrap border-r border-white/20">日期</th>
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">销售额</th>
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">订单量</th>
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">退款金额</th>
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">推广费用</th>
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">访客数</th>
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-[#0058B0]">累积销售额</th>
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-[#0058B0]">累积退款</th>
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-[#34C759]">净销售额</th>
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">退款率</th>
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">同比去年</th>
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">推广占比</th>
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-[#0058B0]">累积推广占比</th>
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-[#34C759]">累积净销售额</th>
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-[#0058B0]">累积推广费</th>
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-[#0058B0]">累积净推广费率</th>
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">投产比</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={17} className="text-center py-12 text-muted-foreground">加载中...</td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={17} className="text-center py-12 text-muted-foreground">暂无数据</td>
                  </tr>
                )}
                {!loading && rows.map((r, i) => (
                  <tr key={r.date} className={i % 2 === 0 ? "bg-white" : "bg-[#F8F8FA]"} style={{ height: "32px" }}>
                    <td className="sticky left-0 z-10 px-3 py-2 text-left whitespace-nowrap border-r border-[#E5E5EA] bg-inherit font-medium">
                      {r.date}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(r.sales)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.orders}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-[#FF9500]">{fmtMoney(r.refund)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-[#0071E3]">{fmtMoney(r.promotion)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.visitors}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap bg-[#F0F7FF] font-medium">{fmtMoney(r.cumSales)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap bg-[#F0F7FF]">{fmtMoney(r.cumRefund)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap bg-[#F0FFF4] font-medium text-[#34C759]">{fmtMoney(r.netSales)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{fmtPct(r.refundRate)}</td>
                    <td className={`px-3 py-2 text-right whitespace-nowrap font-medium ${r.yoyGrowth === null ? "text-muted-foreground" : r.yoyGrowth >= 0 ? "text-[#34C759]" : "text-[#FF3B30]"}`}>
                      {fmtYoy(r.yoyGrowth)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{fmtPct(r.promotionRate)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap bg-[#F0F7FF]">{fmtPct(r.cumPromotionRate)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap bg-[#F0FFF4] font-medium text-[#34C759]">{fmtMoney(r.cumNetSales)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap bg-[#F0F7FF]">{fmtMoney(r.cumPromotion)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap bg-[#F0F7FF]">{fmtPct(r.cumNetPromotionRate)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-semibold text-[#AF52DE]">{r.roi.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="sticky bottom-0 z-20">
                  <tr className="bg-[#1D1D1F] text-white font-semibold" style={{ height: "40px" }}>
                    <td className="sticky left-0 bottom-0 z-30 bg-[#1D1D1F] px-3 py-2 text-left border-r border-white/20">汇总</td>
                    <td className="px-3 py-2 text-right">{fmtMoney(summary.sales)}</td>
                    <td className="px-3 py-2 text-right">{summary.orders}</td>
                    <td className="px-3 py-2 text-right text-[#FF9500]">{fmtMoney(summary.refund)}</td>
                    <td className="px-3 py-2 text-right text-[#5BA3FF]">{fmtMoney(summary.promotion)}</td>
                    <td className="px-3 py-2 text-right">{summary.visitors}</td>
                    <td className="px-3 py-2 text-right bg-[#0071E3]">{fmtMoney(summary.cumSales)}</td>
                    <td className="px-3 py-2 text-right bg-[#0071E3]">{fmtMoney(summary.cumRefund)}</td>
                    <td className="px-3 py-2 text-right bg-[#34C759]">{fmtMoney(summary.netSales)}</td>
                    <td className="px-3 py-2 text-right">{fmtPct(summary.refundRate)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                    <td className="px-3 py-2 text-right">{fmtPct(summary.promotionRate)}</td>
                    <td className="px-3 py-2 text-right bg-[#0071E3]">{fmtPct(summary.cumPromotionRate)}</td>
                    <td className="px-3 py-2 text-right bg-[#34C759]">{fmtMoney(summary.cumNetSales)}</td>
                    <td className="px-3 py-2 text-right bg-[#0071E3]">{fmtMoney(summary.cumPromotion)}</td>
                    <td className="px-3 py-2 text-right bg-[#0071E3]">{fmtPct(summary.cumNetPromotionRate)}</td>
                    <td className="px-3 py-2 text-right text-[#AF52DE]">{summary.roi.toFixed(2)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 图例说明 */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2 font-medium">字段说明</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div>• <span className="text-[#0071E3]">蓝色背景</span> = 累积指标（从周期起始日累加）</div>
            <div>• <span className="text-[#34C759]">绿色背景</span> = 净额指标（销售 - 退款）</div>
            <div>• <span className="text-[#FF9500]">橙色文字</span> = 退款相关</div>
            <div>• <span className="text-[#0071E3]">蓝色文字</span> = 推广相关</div>
            <div>• <span className="text-[#AF52DE]">紫色文字</span> = 投产比</div>
            <div>• 同比去年需有去年同期数据才会显示</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
