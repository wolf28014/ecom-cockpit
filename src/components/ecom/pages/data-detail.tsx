"use client";

import { useState } from "react";
import { SectionCard } from "@/components/ecom/kpi";
import { RefreshButton } from "@/components/ecom/store-selector";
import { StoreMultiSelect } from "@/components/ecom/store-multi-select";
import { useCachedFetch } from "@/lib/use-cached-fetch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export function DataDetailPage() {
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [tab, setTab] = useState<"daily" | "monthly" | "cost">("daily");

  // 日明细：自然年/季节年 + 年份
  const now = new Date();
  const [yearType, setYearType] = useState<"natural" | "seasonal">("natural");
  const [dailyYear, setDailyYear] = useState(now.getFullYear());

  // 月明细：年月下拉
  const [monthYear, setMonthYear] = useState(now.getFullYear());
  const [monthMonth, setMonthMonth] = useState(now.getMonth() + 1);

  // 请求 URL
  const sidParam = storeIds.length > 0 ? `&storeIds=${storeIds.join(",")}` : "";
  let url = "";
  let cacheKey = "";
  if (tab === "daily") {
    url = `/api/daily-detail?yearType=${yearType}&year=${dailyYear}${sidParam}`;
    cacheKey = `ecom:detail:daily:${storeIds.join(",")}:${yearType}:${dailyYear}`;
  } else if (tab === "monthly") {
    url = `/api/monthly-summary?year=${monthYear}&month=${monthMonth}${sidParam}`;
    cacheKey = `ecom:detail:monthly:${storeIds.join(",")}:${monthYear}-${monthMonth}`;
  } else {
    url = `/api/monthly-cost-list${sidParam}`;
    cacheKey = `ecom:detail:cost:${storeIds.join(",")}`;
  }

  const { data, loading, refresh } = useCachedFetch(url, cacheKey, true, true); // 历史数据用长缓存

  const fmt = (v: number) => v?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || "0";
  const fmt0 = (v: number) => `¥${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const pct = (v: number) => v ? `${(v * 100).toFixed(2)}%` : "—";

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">数据明细</h1>
          <p className="text-sm text-muted-foreground mt-1">每日销售 · 每月汇总 · 成本明细</p>
        </div>
        <div className="flex items-center gap-2">
          <StoreMultiSelect value={storeIds} onChange={setStoreIds} />
          <RefreshButton onClick={refresh} loading={loading} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="daily">每日销售明细</TabsTrigger>
          <TabsTrigger value="monthly">每月销售汇总</TabsTrigger>
          <TabsTrigger value="cost">成本明细</TabsTrigger>
        </TabsList>

        {/* 每日销售明细 */}
        <TabsContent value="daily">
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <ToggleGroup type="single" value={yearType} onValueChange={(v) => v && setYearType(v as any)}>
                <ToggleGroupItem value="natural" className="text-xs">自然年</ToggleGroupItem>
                <ToggleGroupItem value="seasonal" className="text-xs">季节年</ToggleGroupItem>
              </ToggleGroup>
              <Select value={String(dailyYear)} onValueChange={(v) => setDailyYear(Number(v))}>
                <SelectTrigger className="w-[100px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}年</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                {yearType === "seasonal" ? `${dailyYear}年7/1 ~ ${dailyYear+1}年6/30` : `${dailyYear}年1/1 ~ 12/31`}
              </span>
            </div>
            {loading && !data && <Card><CardContent className="py-8 text-center text-muted-foreground">加载中...</CardContent></Card>}
            {data && <DailyTable data={data} fmt={fmt} pct={pct} />}
          </div>
        </TabsContent>

        {/* 每月销售汇总 */}
        <TabsContent value="monthly">
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={String(monthYear)} onValueChange={(v) => setMonthYear(Number(v))}>
                <SelectTrigger className="w-[100px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}年</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(monthMonth)} onValueChange={(v) => setMonthMonth(Number(v))}>
                <SelectTrigger className="w-[80px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map(m => <SelectItem key={m} value={String(m)}>{m}月</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {loading && !data && <Card><CardContent className="py-8 text-center text-muted-foreground">加载中...</CardContent></Card>}
            {data && <MonthlyTable data={data} fmt={fmt} fmt0={fmt0} pct={pct} />}
          </div>
        </TabsContent>

        {/* 成本明细 */}
        <TabsContent value="cost">
          {loading && !data && <Card><CardContent className="py-8 text-center text-muted-foreground">加载中...</CardContent></Card>}
          {data && <CostTable data={data} fmt0={fmt0} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============== 每日销售明细表格 ==============
function DailyTable({ data, fmt, pct }: any) {
  const rows: any[] = data?.rows || [];
  const summary: any = data?.summary || {};
  if (rows.length === 0) return <Card><CardContent className="py-8 text-center text-muted-foreground">暂无数据</CardContent></Card>;

  const COLS = [
    { key: "date", label: "日期", cum: false },
    { key: "sales", label: "销售额", cum: false },
    { key: "orders", label: "订单", cum: false },
    { key: "refund", label: "退款", cum: false },
    { key: "promotion", label: "推广费", cum: false },
    { key: "visitors", label: "访客数", cum: false },
    { key: "netSales", label: "净销售", cum: false },
    { key: "refundRate", label: "退款率", cum: false },
    { key: "promotionRate", label: "推广占比", cum: false },
    { key: "roi", label: "投产比", cum: false },
    { key: "cumSales", label: "累积销售", cum: true },
    { key: "cumRefund", label: "累积退款", cum: true },
    { key: "cumNetSales", label: "累积净销售", cum: true },
    { key: "cumPromotion", label: "累积推广费", cum: true },
    { key: "cumPromotionRate", label: "累积推广占比", cum: true },
    { key: "cumNetPromotionRate", label: "累积净推广费率", cum: true },
  ];

  const fmtVal = (key: string, val: any) => {
    if (key === "date") return val;
    if (key.includes("Rate")) return pct(val);
    if (key === "roi") return val?.toFixed(2);
    if (key === "orders" || key === "visitors") return String(val || 0);
    return `¥${fmt(val)}`;
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-auto" style={{ maxHeight: "70vh" }}>
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-[#0071E3] text-white">
                {COLS.map(c => (
                  <th key={c.key} className={cn("px-2 py-2 text-right font-semibold whitespace-nowrap", c.cum && "bg-[#0058B0]")}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.date} className={i % 2 === 0 ? "bg-white" : "bg-[#F8F8FA]"} style={{ height: "30px" }}>
                  {COLS.map(c => (
                    <td key={c.key} className={cn("px-2 py-1.5 text-right whitespace-nowrap", c.cum && "bg-[#F0F7FF]", c.key === "date" && "text-left font-medium sticky left-0 bg-inherit")}>
                      {fmtVal(c.key, r[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
              <tr className="bg-[#1D1D1F] text-white font-semibold" style={{ height: "36px" }}>
                {COLS.map(c => (
                  <td key={c.key} className={cn("px-2 py-1.5 text-right", c.cum && "bg-[#0071E3]")}>
                    {c.key === "date" ? "汇总" : fmtVal(c.key, summary[c.key])}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="px-4 py-2 text-xs text-muted-foreground border-t">
          共 {data?.totalDays || 0} 天 · {data?.startDate} ~ {data?.endDate}
        </div>
      </CardContent>
    </Card>
  );
}

// ============== 每月销售汇总表格 ==============
function MonthlyTable({ data, fmt, fmt0, pct }: any) {
  const days: any[] = data?.days || [];
  if (days.length === 0) return <Card><CardContent className="py-8 text-center text-muted-foreground">暂无数据</CardContent></Card>;
  const total = data?.total || {};

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-auto" style={{ maxHeight: "70vh" }}>
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-[#0071E3] text-white">
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">日期</th>
                <th className="px-3 py-2 text-right font-semibold">销售额</th>
                <th className="px-3 py-2 text-right font-semibold">订单</th>
                <th className="px-3 py-2 text-right font-semibold">退款</th>
                <th className="px-3 py-2 text-right font-semibold">净销售</th>
                <th className="px-3 py-2 text-right font-semibold">推广费</th>
                <th className="px-3 py-2 text-right font-semibold">访客数</th>
                <th className="px-3 py-2 text-right font-semibold">退款率</th>
                <th className="px-3 py-2 text-right font-semibold">推广占比</th>
                <th className="px-3 py-2 text-right font-semibold">投产比</th>
                <th className="px-3 py-2 text-right font-semibold">客单价</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => (
                <tr key={d.date} className={i % 2 === 0 ? "bg-white" : "bg-[#F8F8FA]"} style={{ height: "30px" }}>
                  <td className="px-3 py-1.5 text-left font-medium whitespace-nowrap">{d.date}</td>
                  <td className="px-3 py-1.5 text-right">{fmt0(d.sales)}</td>
                  <td className="px-3 py-1.5 text-right">{d.orders}</td>
                  <td className="px-3 py-1.5 text-right text-[#FF9500]">{fmt0(d.refund)}</td>
                  <td className="px-3 py-1.5 text-right text-[#34C759]">{fmt0(d.netSales)}</td>
                  <td className="px-3 py-1.5 text-right text-[#0071E3]">{fmt0(d.promotion)}</td>
                  <td className="px-3 py-1.5 text-right">{d.visitors}</td>
                  <td className="px-3 py-1.5 text-right">{pct(d.refundRate)}</td>
                  <td className="px-3 py-1.5 text-right">{pct(d.promotionRate)}</td>
                  <td className="px-3 py-1.5 text-right">{d.roi?.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">¥{fmt(d.avgOrderValue)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
              <tr className="bg-[#1D1D1F] text-white font-semibold" style={{ height: "36px" }}>
                <td className="px-3 py-1.5 text-left">汇总</td>
                <td className="px-3 py-1.5 text-right">{fmt0(total.sales)}</td>
                <td className="px-3 py-1.5 text-right">{total.orders}</td>
                <td className="px-3 py-1.5 text-right">{fmt0(total.refund)}</td>
                <td className="px-3 py-1.5 text-right">{fmt0(total.netSales)}</td>
                <td className="px-3 py-1.5 text-right">{fmt0(total.promotion)}</td>
                <td className="px-3 py-1.5 text-right">{total.visitors}</td>
                <td className="px-3 py-1.5 text-right">{pct(total.refundRate)}</td>
                <td className="px-3 py-1.5 text-right">{pct(total.promotionRate)}</td>
                <td className="px-3 py-1.5 text-right">{total.roi?.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right">¥{fmt(total.avgOrderValue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="px-4 py-2 text-xs text-muted-foreground border-t">{data?.monthLabel} · 共 {days.length} 天</div>
      </CardContent>
    </Card>
  );
}

// ============== 成本明细表格 ==============
function CostTable({ data, fmt0 }: any) {
  const costs: any[] = Array.isArray(data) ? data : [];
  if (costs.length === 0) return <Card><CardContent className="py-8 text-center text-muted-foreground">暂无成本数据</CardContent></Card>;

  const COST_FIELDS = [
    { key: "goodsCost", label: "货品成本" },
    { key: "redPacket", label: "红包" },
    { key: "labor", label: "人工" },
    { key: "other", label: "其它" },
    { key: "consumerExperience", label: "消费者体验" },
    { key: "bnplTechFee", label: "先用后付" },
    { key: "basicSoftwareFee", label: "基础软件费" },
    { key: "redPacketAdvance", label: "红包垫付" },
    { key: "logistics", label: "集运物流" },
    { key: "brandGiftFee", label: "品牌礼金" },
    { key: "charity", label: "公益宝贝" },
    { key: "quickPaymentFee", label: "极速回款" },
    { key: "marketingPlatform", label: "营销平台" },
    { key: "tax", label: "税务" },
  ];

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-auto" style={{ maxHeight: "70vh" }}>
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-[#34C759] text-white">
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">月份</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">店铺</th>
                {COST_FIELDS.map(f => (
                  <th key={f.key} className="px-3 py-2 text-right font-semibold whitespace-nowrap">{f.label}</th>
                ))}
                <th className="px-3 py-2 text-right font-semibold bg-[#2A9D4A]">合计</th>
              </tr>
            </thead>
            <tbody>
              {costs.map((c, i) => (
                <tr key={c.id || i} className={i % 2 === 0 ? "bg-white" : "bg-[#F8F8FA]"} style={{ height: "30px" }}>
                  <td className="px-3 py-1.5 text-left font-medium whitespace-nowrap">{c.year}-{String(c.month).padStart(2, "0")}</td>
                  <td className="px-3 py-1.5 text-left text-muted-foreground whitespace-nowrap">{c.storeName || "—"}</td>
                  {COST_FIELDS.map(f => (
                    <td key={f.key} className="px-3 py-1.5 text-right whitespace-nowrap">{c[f.key] ? fmt0(c[f.key]) : "—"}</td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-bold text-[#FF3B30] whitespace-nowrap">{fmt0(c.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs text-muted-foreground border-t">共 {costs.length} 个月度成本记录</div>
      </CardContent>
    </Card>
  );
}
