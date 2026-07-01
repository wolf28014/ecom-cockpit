"use client";

import { useState, useEffect, useCallback } from "react";
import { SectionCard } from "@/components/ecom/kpi";
import { RefreshButton } from "@/components/ecom/store-selector";
import { StoreMultiSelect } from "@/components/ecom/store-multi-select";
import { YearTypeSelector } from "@/components/ecom/year-type-selector";
import { DataDetailTable } from "@/components/ecom/data-detail-table";
import { DraggableKpiGrid, type KpiItem } from "@/components/ecom/draggable-kpi-grid";
import { TabDatePicker, type DateMode } from "@/components/ecom/tab-date-picker";
import { useCachedFetch } from "@/lib/use-cached-fetch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Legend, Line,
} from "recharts";

const today = new Date().toISOString().slice(0, 10);

export function AnalyticsPage() {
  const [storeIds, setStoreIds] = useState<string[]>([]);

  // 各 Tab 独立的日期选择
  const [dayDate, setDayDate] = useState(today);
  const [weekDate, setWeekDate] = useState(today);
  const [monthDate, setMonthDate] = useState(today);
  const [yearType, setYearType] = useState<"natural" | "seasonal">("natural");
  const [year, setYear] = useState(new Date().getFullYear());

  // 构建请求 URL - 根据当前 Tab 传不同参数
  // 但因为所有 Tab 都在同一个页面，我们用一个统一的 API 获取所有数据
  const sidParam = storeIds.length > 0 ? `&storeIds=${storeIds.join(",")}` : "";
  const url = `/api/analytics?${sidParam}&day=${dayDate}&week=${weekDate}&month=${monthDate}&yearType=${yearType}&year=${year}`;
  const cacheKey = `ecom:analytics:${storeIds.join(",") || "all"}:${dayDate}:${weekDate}:${monthDate}:${yearType}:${year}`;
  const { data, loading, refresh } = useCachedFetch(url, cacheKey);

  const fmtMoney0 = (v: number) => `¥${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const fmtPct = (v: number) => v === 0 || !v ? "0.00%" : `${(v * 100).toFixed(2)}%`;
  const fmtYoy = (v: number) => {
    if (!v || v === 0) return "—";
    const sign = v >= 0 ? "+" : "";
    return `${sign}${(v * 100).toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">经营分析中心</h1>
          <p className="text-sm text-muted-foreground mt-1">日 / 周 / 月 / 年 统一分析 · 支持拖拽排序</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StoreMultiSelect value={storeIds} onChange={setStoreIds} />
          <RefreshButton onClick={refresh} loading={loading} />
        </div>
      </div>

      {loading && !data && (
        <Card><CardContent className="py-16 text-center text-muted-foreground">加载中...</CardContent></Card>
      )}

      {data && (
        <Tabs defaultValue="daily">
          <TabsList>
            <TabsTrigger value="daily">日分析</TabsTrigger>
            <TabsTrigger value="weekly">周分析</TabsTrigger>
            <TabsTrigger value="monthly">月分析</TabsTrigger>
            <TabsTrigger value="yearly">年分析</TabsTrigger>
          </TabsList>

          {/* 日分析 */}
          <TabsContent value="daily">
            <DailyAnalysis data={data} date={dayDate} setDate={setDayDate} fmtMoney0={fmtMoney0} fmtPct={fmtPct} fmtYoy={fmtYoy} />
          </TabsContent>

          {/* 周分析 */}
          <TabsContent value="weekly">
            <WeeklyAnalysis data={data} date={weekDate} setDate={setWeekDate} fmtMoney0={fmtMoney0} fmtPct={fmtPct} fmtYoy={fmtYoy} />
          </TabsContent>

          {/* 月分析 */}
          <TabsContent value="monthly">
            <MonthlyAnalysis data={data} date={monthDate} setDate={setMonthDate} fmtMoney0={fmtMoney0} fmtPct={fmtPct} fmtYoy={fmtYoy} />
          </TabsContent>

          {/* 年分析 */}
          <TabsContent value="yearly">
            <YearAnalysis data={data} yearType={yearType} setYearType={setYearType} year={year} setYear={setYear} fmtMoney0={fmtMoney0} fmtPct={fmtPct} fmtYoy={fmtYoy} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ============== 通用：构建卡片项 ==============
function buildOverviewItems(d: any, fmtMoney0: any, fmtPct: any): KpiItem[] {
  if (!d) return [];
  return [
    { key: "sales", title: "销售额", value: fmtMoney0(d.salesAmount), subtitle: `${d.orderCount} 单`, color: "#0071E3" },
    { key: "orders", title: "订单量", value: String(d.orderCount || 0), subtitle: `客单价 ${fmtMoney0(d.avgOrderValue)}`, color: "#1D1D1F" },
    { key: "refund", title: "退款金额", value: fmtMoney0(d.refundAmount), subtitle: `退款率 ${fmtPct(d.refundRate)}`, color: "#FF9500" },
    { key: "promotion", title: "推广费用", value: fmtMoney0(d.promotionTotal), subtitle: `推广占比 ${fmtPct(d.promotionRate)}`, color: "#0071E3" },
    { key: "visitors", title: "访客数", value: String(d.visitors || 0), subtitle: `转化率 ${fmtPct(d.conversionRate)}`, color: "#AF52DE" },
    { key: "netSales", title: "净销售额", value: fmtMoney0(d.netSales), subtitle: "销售 - 退款", color: "#34C759" },
    { key: "refundRate", title: "退款率", value: fmtPct(d.refundRate), subtitle: fmtMoney0(d.refundAmount), color: "#FF3B30" },
    { key: "promotionRate", title: "推广占比", value: fmtPct(d.promotionRate), subtitle: fmtMoney0(d.promotionTotal), color: "#0071E3" },
    { key: "roi", title: "投产比", value: (d.roi || 0).toFixed(2), subtitle: "销售 / 推广", color: "#AF52DE" },
  ];
}

function buildCumulativeItems(d: any, fmtMoney0: any, fmtPct: any, fmtYoy: any): KpiItem[] {
  if (!d) return [];
  return [
    { key: "cumSales", title: "累积销售额", value: fmtMoney0(d.cumulativeSales), color: "#0071E3", isCumulative: true },
    { key: "cumRefund", title: "累积退款", value: fmtMoney0(d.cumulativeRefund), color: "#FF9500", isCumulative: true },
    { key: "cumNetSales", title: "累积净销售额", value: fmtMoney0(d.cumulativeNetSales), color: "#34C759", isCumulative: true },
    { key: "cumPromotion", title: "累积推广费", value: fmtMoney0(d.cumulativePromotion), color: "#AF52DE", isCumulative: true },
    { key: "cumRefundRate", title: "累积退款率", value: fmtPct(d.cumulativeRefundRate), color: "#FF9500", isCumulative: true },
    { key: "cumPromotionRate", title: "累积推广占比", value: fmtPct(d.cumulativePromotionRate), color: "#0071E3", isCumulative: true },
    { key: "cumNetPromotionRate", title: "累积净推广费率", value: fmtPct(d.cumulativeNetPromotionRate), color: "#FF3B30", isCumulative: true },
    { key: "yoyGrowth", title: "同比去年", value: fmtYoy(d.yoyGrowth), color: (d.yoyGrowth || 0) >= 0 ? "#34C759" : "#FF3B30", isCumulative: true },
  ];
}

// ============== 日分析 ==============
function DailyAnalysis({ data, date, setDate, fmtMoney0, fmtPct, fmtYoy }: any) {
  const [mode, setMode] = useState<DateMode>("today");
  const dayData = data.dayData || data.today;
  const cumData = data.naturalCumulative;

  return (
    <div className="space-y-4">
      <SectionCard title="日分析" subtitle="选择日期查看当日数据"
        action={<TabDatePicker mode={mode} onModeChange={setMode} date={date} onDateChange={setDate} />}
      >
        <DraggableKpiGrid items={buildOverviewItems(dayData, fmtMoney0, fmtPct)} storageKey="analytics:daily:overview" columns={5} />
      </SectionCard>
      <SectionCard title="累积指标" subtitle="年度累计 · 可拖拽排序">
        <DraggableKpiGrid items={buildCumulativeItems(cumData, fmtMoney0, fmtPct, fmtYoy)} storageKey="analytics:daily:cumulative" columns={4} />
      </SectionCard>
      {/* 趋势图 */}
      <SectionCard title="近 14 天趋势" subtitle="销售额/净销售额/投产比">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={(data.trend30 || []).slice(-14).map((p: any) => ({ ...p, date: p.date.slice(5) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" />
              <XAxis dataKey="date" stroke="#6E6E73" fontSize={11} />
              <YAxis yAxisId="left" stroke="#6E6E73" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" stroke="#6E6E73" fontSize={11} />
              <Tooltip contentStyle={{ background: "#1D1D1F", border: "none", borderRadius: 8, color: "#fff", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="sales" name="销售额" fill="#0071E3" radius={[4, 4, 0, 0]} barSize={14} />
              <Bar yAxisId="left" dataKey="netSales" name="净销售额" fill="#34C759" radius={[4, 4, 0, 0]} barSize={14} />
              <Line yAxisId="right" type="monotone" dataKey="roi" name="投产比" stroke="#FF9500" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>
      {/* 数据明细 */}
      <div><DataDetailTable /></div>
    </div>
  );
}

// ============== 周分析 ==============
function WeeklyAnalysis({ data, date, setDate, fmtMoney0, fmtPct, fmtYoy }: any) {
  const [mode, setMode] = useState<DateMode>("week");
  const weekData = data.weekData || data.week;
  const cumData = data.naturalCumulative;

  return (
    <div className="space-y-4">
      <SectionCard title="周分析" subtitle="选择日期所在周"
        action={<TabDatePicker mode={mode} onModeChange={setMode} date={date} onDateChange={setDate} />}
      >
        <DraggableKpiGrid items={buildOverviewItems(weekData, fmtMoney0, fmtPct)} storageKey="analytics:weekly:overview" columns={5} />
      </SectionCard>
      <SectionCard title="累积指标" subtitle="年度累计 · 可拖拽排序">
        <DraggableKpiGrid items={buildCumulativeItems(cumData, fmtMoney0, fmtPct, fmtYoy)} storageKey="analytics:weekly:cumulative" columns={4} />
      </SectionCard>
    </div>
  );
}

// ============== 月分析 ==============
function MonthlyAnalysis({ data, date, setDate, fmtMoney0, fmtPct, fmtYoy }: any) {
  const [mode, setMode] = useState<DateMode>("month");
  const monthData = data.monthData || data.month;
  const cumData = data.naturalCumulative;

  return (
    <div className="space-y-4">
      <SectionCard title="月分析" subtitle="选择日期所在月"
        action={<TabDatePicker mode={mode} onModeChange={setMode} date={date} onDateChange={setDate} />}
      >
        <DraggableKpiGrid items={buildOverviewItems(monthData, fmtMoney0, fmtPct)} storageKey="analytics:monthly:overview" columns={5} />
      </SectionCard>
      <SectionCard title="累积指标" subtitle="年度累计 · 可拖拽排序">
        <DraggableKpiGrid items={buildCumulativeItems(cumData, fmtMoney0, fmtPct, fmtYoy)} storageKey="analytics:monthly:cumulative" columns={4} />
      </SectionCard>
    </div>
  );
}

// ============== 年分析（自然年/季节年分开） ==============
function YearAnalysis({ data, yearType, setYearType, year, setYear, fmtMoney0, fmtPct, fmtYoy }: any) {
  const yearSummary = yearType === "seasonal" ? data?.seasonalYear : data?.naturalYear;
  const cumulative = yearType === "seasonal" ? data?.seasonalCumulative : data?.naturalCumulative;
  const yearLabel = yearType === "seasonal" ? `季节年 ${year}` : `自然年 ${year}`;

  return (
    <div className="space-y-4">
      <SectionCard
        title={`${yearLabel}概览`}
        subtitle="可切换自然年 / 季节年 · 支持最近5年"
        action={<YearTypeSelector yearType={yearType} setYearType={setYearType} year={year} setYear={setYear} />}
      >
        <DraggableKpiGrid items={buildOverviewItems(yearSummary, fmtMoney0, fmtPct)} storageKey="analytics:yearly:overview" columns={5} />
      </SectionCard>
      <SectionCard title={`${yearLabel}累积指标`} subtitle="年度累计 · 可拖拽排序">
        <DraggableKpiGrid items={buildCumulativeItems(cumulative, fmtMoney0, fmtPct, fmtYoy)} storageKey="analytics:yearly:cumulative" columns={4} />
      </SectionCard>
    </div>
  );
}
