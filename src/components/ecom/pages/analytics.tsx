"use client";

import { useState } from "react";
import { KpiRow, SectionCard } from "@/components/ecom/kpi";
import { StoreSelector, RefreshButton } from "@/components/ecom/store-selector";
import { StoreMultiSelect } from "@/components/ecom/store-multi-select";
import { DateRangePicker, type DateRange } from "@/components/ecom/date-range-picker";
import { YearTypeSelector } from "@/components/ecom/year-type-selector";
import { DataDetailTable } from "@/components/ecom/data-detail-table";
import { useCachedFetch } from "@/lib/use-cached-fetch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Legend,
} from "recharts";

const PIE_COLORS = ["#0071E3", "#34C759", "#FF9500", "#AF52DE", "#FF3B30", "#5856D6"];

export function AnalyticsPage() {
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  });

  const sidParam = storeIds.length > 0 ? `&storeIds=${storeIds.join(",")}` : "";
  const rangeParam = `&start=${dateRange.start}&end=${dateRange.end}`;
  const url = `/api/analytics?${sidParam}${rangeParam}`;
  const cacheKey = `ecom:analytics:${storeIds.join(",") || "all"}:${dateRange.start}:${dateRange.end}`;
  const { data, loading, refresh } = useCachedFetch(url, cacheKey);

  const fmtMoney = (v: number) => `¥${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">经营分析中心</h1>
          <p className="text-sm text-muted-foreground mt-1">日 / 周 / 月 / 年 四档分析 · 自然年与季节年双轨</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StoreMultiSelect value={storeIds} onChange={setStoreIds} />
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <RefreshButton onClick={refresh} loading={loading} />
        </div>
      </div>

      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">日分析</TabsTrigger>
          <TabsTrigger value="weekly">周分析</TabsTrigger>
          <TabsTrigger value="monthly">月分析</TabsTrigger>
          <TabsTrigger value="yearly">年分析</TabsTrigger>
        </TabsList>

        {/* 日分析 */}
        <TabsContent value="daily">
          <div className="space-y-4">
            <KpiRow cards={[
              { title: "日销售额", value: fmtMoney(data?.today.salesAmount), subtitle: `${data?.today.orderCount} 单 · ${data?.today.visitors} 访客`, trend: data?.dailyChange.sales, trendLabel: "环比", accent: "#0071E3" },
              { title: "日净销售额", value: fmtMoney(data?.today.netSales), subtitle: `销售 - 退款`, trend: data?.dailyChange.netSales, trendLabel: "环比", accent: "#34C759" },
              { title: "日退款率", value: fmtPct(data?.today.refundRate), subtitle: `退款 ${fmtMoney(data?.today.refundAmount)}`, accent: "#FF9500" },
              { title: "日投产比", value: (data?.today.roi || 0).toFixed(2), subtitle: `推广占比 ${fmtPct(data?.today.promotionRate)}`, accent: "#AF52DE" },
              { title: "日转化率", value: `${(data?.today.conversionRate * 100 || 0).toFixed(2)}%`, subtitle: `客单价 ${fmtMoney(data?.today.avgOrderValue)}`, accent: "#FF3B30" },
            ]} />

            <SectionCard title="近 14 天趋势" subtitle="销售额/净销售额/投产比">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={(data?.trend14 || []).map((p: any) => ({ ...p, date: p.date.slice(5), roi: p.roi }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" />
                    <XAxis dataKey="date" stroke="#6E6E73" fontSize={11} tickLine={false} />
                    <YAxis yAxisId="left" stroke="#6E6E73" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" stroke="#6E6E73" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "#1D1D1F", border: "none", borderRadius: 8, color: "#fff", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="left" dataKey="sales" name="销售额" fill="#0071E3" radius={[4, 4, 0, 0]} barSize={14} />
                    <Bar yAxisId="left" dataKey="netSales" name="净销售额" fill="#34C759" radius={[4, 4, 0, 0]} barSize={14} />
                    <Line yAxisId="right" type="monotone" dataKey="roi" name="投产比" stroke="#FF9500" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            {/* 数据明细表格 - 支持最近5年 */}
            <SectionCard title="数据明细" subtitle="每日经营数据明细 · 支持自然年/季节年切换 · 可查看最近5年">
              <DataDetailTable />
            </SectionCard>
          </div>
        </TabsContent>
        <TabsContent value="weekly">
          <div className="space-y-4">
            <KpiRow cards={[
              { title: "本周销售额", value: fmtMoney(data?.week.salesAmount), subtitle: `${data?.week.orderCount} 单`, trend: data?.weeklyChange.sales, trendLabel: "环比上周", accent: "#0071E3" },
              { title: "本周净销售额", value: fmtMoney(data?.week.netSales), subtitle: `销售 - 退款`, trend: data?.weeklyChange.netSales, trendLabel: "环比上周", accent: "#34C759" },
              { title: "本周投产比", value: (data?.week.roi || 0).toFixed(2), subtitle: `推广 ${fmtMoney(data?.week.promotionTotal)}`, accent: "#AF52DE" },
              { title: "本周转化率", value: `${(data?.week.conversionRate * 100 || 0).toFixed(2)}%`, subtitle: `退款率 ${fmtPct(data?.week.refundRate)}`, accent: "#FF3B30" },
            ]} />

            <SectionCard title="本周 vs 上周对比" subtitle="14 天每日销售额">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(data?.trend14 || []).map((p: any) => ({ ...p, date: p.date.slice(5) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" />
                    <XAxis dataKey="date" stroke="#6E6E73" fontSize={11} tickLine={false} />
                    <YAxis stroke="#6E6E73" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "#1D1D1F", border: "none", borderRadius: 8, color: "#fff", fontSize: 12 }} formatter={(v: any) => `¥${v.toLocaleString()}`} />
                    <Bar dataKey="sales" name="销售额" fill="#0071E3" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        {/* 月分析 */}
        <TabsContent value="monthly">
          <div className="space-y-4">
            <KpiRow cards={[
              { title: "本月销售额", value: fmtMoney(data?.month.salesAmount), subtitle: `${data?.month.orderCount} 单`, accent: "#0071E3" },
              { title: "本月净销售额", value: fmtMoney(data?.month.netSales), subtitle: `退款率 ${fmtPct(data?.month.refundRate)}`, accent: "#34C759" },
              { title: "本月投产比", value: (data?.month.roi || 0).toFixed(2), subtitle: `推广 ${fmtMoney(data?.month.promotionTotal)}`, accent: "#AF52DE" },
              { title: "本月推广占比", value: fmtPct(data?.month.promotionRate), subtitle: `转化率 ${(data?.month.conversionRate * 100 || 0).toFixed(2)}%`, accent: "#FF3B30" },
            ]} />

            <SectionCard title="本月每日趋势" subtitle="销售/净销售/投产比">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={(data?.trend30 || []).map((p: any) => ({ ...p, date: p.date.slice(5), roi: p.roi }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" />
                    <XAxis dataKey="date" stroke="#6E6E73" fontSize={11} tickLine={false} />
                    <YAxis yAxisId="left" stroke="#6E6E73" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" stroke="#6E6E73" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "#1D1D1F", border: "none", borderRadius: 8, color: "#fff", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="left" dataKey="sales" name="销售额" fill="#0071E3" radius={[4, 4, 0, 0]} barSize={10} />
                    <Bar yAxisId="left" dataKey="netSales" name="净销售额" fill="#34C759" radius={[4, 4, 0, 0]} barSize={10} />
                    <Line yAxisId="right" type="monotone" dataKey="roi" name="投产比" stroke="#FF9500" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        {/* 年分析 - 自然年/季节年切换 */}
        <TabsContent value="yearly">
          <YearAnalysis data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function YearAnalysis({ data }: { data: any }) {
  const [yearType, setYearType] = useState<"natural" | "seasonal">("natural");
  const [year, setYear] = useState(new Date().getFullYear());

  const yearSummary = yearType === "seasonal" ? data?.seasonalYear : data?.naturalYear;
  const cumulative = yearType === "seasonal" ? data?.seasonalCumulative : data?.naturalCumulative;
  const yearLabel = yearType === "seasonal" ? `季节年 ${year}（7/1 - 次年 6/30）` : `自然年 ${year}（1/1 - 12/31）`;

  const fmtMoney = (v: number) => `¥${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;

  return (
    <div className="space-y-4">
      <SectionCard
        title={`${yearLabel}概览`}
        subtitle="可切换自然年 / 季节年，支持最近5年"
        action={
          <YearTypeSelector yearType={yearType} setYearType={setYearType} year={year} setYear={setYear} />
        }
      >
        <KpiRow cards={[
          { title: "年度销售额", value: fmtMoney(yearSummary?.salesAmount), subtitle: `${yearSummary?.orderCount} 单 · ${yearSummary?.visitors} 访客`, accent: "#0071E3" },
          { title: "年度净销售额", value: fmtMoney(yearSummary?.netSales), subtitle: `退款率 ${fmtPct(yearSummary?.refundRate)}`, accent: "#34C759" },
          { title: "年度投产比", value: (yearSummary?.roi || 0).toFixed(2), subtitle: `推广 ${fmtMoney(yearSummary?.promotionTotal)}`, accent: "#AF52DE" },
          { title: "年度推广占比", value: fmtPct(yearSummary?.promotionRate), subtitle: `转化率 ${fmtPct(yearSummary?.conversionRate)}`, accent: "#FF3B30" },
        ]} />
      </SectionCard>

      <SectionCard title={`${yearLabel}累积指标`} subtitle="累计数据 · 含同比">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <CumItem label="累积销售额" value={fmtMoney(cumulative?.cumulativeSales)} color="#0071E3" />
          <CumItem label="累积退款" value={fmtMoney(cumulative?.cumulativeRefund)} color="#FF9500" />
          <CumItem label="累积净销售额" value={fmtMoney(cumulative?.cumulativeNetSales)} color="#34C759" />
          <CumItem label="累积推广费" value={fmtMoney(cumulative?.cumulativePromotion)} color="#AF52DE" />
          <CumItem label="累积退款率" value={fmtPct(cumulative?.cumulativeRefundRate)} color="#FF9500" />
          <CumItem label="累积推广占比" value={fmtPct(cumulative?.cumulativePromotionRate)} color="#0071E3" />
          <CumItem label="累积净推广费率" value={fmtPct(cumulative?.cumulativeNetPromotionRate)} color="#FF3B30" />
          <CumItem
            label="同比去年（销售）"
            value={`${(cumulative?.yoyGrowth || 0) > 0 ? "+" : ""}${((cumulative?.yoyGrowth || 0) * 100).toFixed(1)}%`}
            color={(cumulative?.yoyGrowth || 0) >= 0 ? "#34C759" : "#FF3B30"}
          />
        </div>
      </SectionCard>

      <SectionCard title="月度趋势" subtitle="按月聚合的销售/净销售/推广对比">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={Object.entries(data?.monthlyAgg || {}).map(([k, v]: any) => ({
              month: k,
              销售额: Math.round(v.sales),
              净销售额: Math.round(v.netSales),
              推广: Math.round(v.promotion),
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" />
              <XAxis dataKey="month" stroke="#6E6E73" fontSize={11} tickLine={false} />
              <YAxis stroke="#6E6E73" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#1D1D1F", border: "none", borderRadius: 8, color: "#fff", fontSize: 12 }} formatter={(v: any) => `¥${v.toLocaleString()}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="销售额" fill="#0071E3" radius={[4, 4, 0, 0]} />
              <Bar dataKey="净销售额" fill="#34C759" radius={[4, 4, 0, 0]} />
              <Bar dataKey="推广" fill="#FF9500" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>
    </div>
  );
}

function CumItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-3 bg-[#F8F8FA]">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  );
}
