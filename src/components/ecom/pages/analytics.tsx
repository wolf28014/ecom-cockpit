"use client";

import { useState } from "react";
import { SectionCard } from "@/components/ecom/kpi";
import { RefreshButton } from "@/components/ecom/store-selector";
import { StoreMultiSelect } from "@/components/ecom/store-multi-select";
import { DraggableKpiGrid, type KpiItem } from "@/components/ecom/draggable-kpi-grid";
import { useCachedFetch } from "@/lib/use-cached-fetch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function AnalyticsPage() {
  const [storeIds, setStoreIds] = useState<string[]>([]);

  // 日分析日期
  const [dayDate, setDayDate] = useState(new Date().toISOString().slice(0, 10));
  // 月分析年月
  const now = new Date();
  const [monthYear, setMonthYear] = useState(now.getFullYear());
  const [monthMonth, setMonthMonth] = useState(now.getMonth() + 1);
  // 自然年/季节年年份
  const [naturalYear, setNaturalYear] = useState(now.getFullYear());
  const [seasonalYear, setSeasonalYear] = useState(now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1);

  // 构建请求 URL
  const sidParam = storeIds.length > 0 ? `&storeIds=${storeIds.join(",")}` : "";
  const url = `/api/analytics?${sidParam}&day=${dayDate}&monthYear=${monthYear}&monthMonth=${monthMonth}&naturalYear=${naturalYear}&seasonalYear=${seasonalYear}`;
  const cacheKey = `ecom:analytics2:${storeIds.join(",") || "all"}:${dayDate}:${monthYear}-${monthMonth}:N${naturalYear}:S${seasonalYear}`;
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
          <p className="text-sm text-muted-foreground mt-1">日 / 月 / 自然年 / 季节年 · 支持拖拽排序</p>
        </div>
        <div className="flex items-center gap-2">
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
            <TabsTrigger value="monthly">月分析</TabsTrigger>
            <TabsTrigger value="natural">自然年</TabsTrigger>
            <TabsTrigger value="seasonal">季节年</TabsTrigger>
          </TabsList>

          {/* 日分析 */}
          <TabsContent value="daily">
            <AnalysisSection
              title="日分析"
              dateLabel={dayDate}
              dateSelector={
                <SimpleDatePicker value={dayDate} onChange={setDayDate} />
              }
              overviewData={data.dayData}
              cumulativeData={data.dayCumulative}
              storagePrefix="analytics:daily"
              fmtMoney0={fmtMoney0}
              fmtPct={fmtPct}
              fmtYoy={fmtYoy}
            />
          </TabsContent>

          {/* 月分析 */}
          <TabsContent value="monthly">
            <AnalysisSection
              title="月分析"
              dateLabel={`${monthYear}年 ${monthMonth}月`}
              dateSelector={
                <MonthPicker year={monthYear} month={monthMonth} onChange={(y, m) => { setMonthYear(y); setMonthMonth(m); }} />
              }
              overviewData={data.monthData}
              cumulativeData={data.monthCumulative}
              storagePrefix="analytics:monthly"
              fmtMoney0={fmtMoney0}
              fmtPct={fmtPct}
              fmtYoy={fmtYoy}
            />
          </TabsContent>

          {/* 自然年 */}
          <TabsContent value="natural">
            <AnalysisSection
              title={`自然年 ${naturalYear}`}
              dateLabel={`${naturalYear}年 1月1日 ~ 12月31日`}
              dateSelector={
                <YearPicker year={naturalYear} onChange={setNaturalYear} />
              }
              overviewData={data.naturalYearData}
              cumulativeData={data.naturalYearCumulative}
              storagePrefix="analytics:natural"
              fmtMoney0={fmtMoney0}
              fmtPct={fmtPct}
              fmtYoy={fmtYoy}
            />
          </TabsContent>

          {/* 季节年 */}
          <TabsContent value="seasonal">
            <AnalysisSection
              title={`季节年 ${seasonalYear}`}
              dateLabel={`${seasonalYear}年 7月1日 ~ ${seasonalYear + 1}年 6月30日`}
              dateSelector={
                <YearPicker year={seasonalYear} onChange={setSeasonalYear} />
              }
              overviewData={data.seasonalYearData}
              cumulativeData={data.seasonalYearCumulative}
              storagePrefix="analytics:seasonal"
              fmtMoney0={fmtMoney0}
              fmtPct={fmtPct}
              fmtYoy={fmtYoy}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ============== 统一的分析区块 ==============
function AnalysisSection({ title, dateLabel, dateSelector, overviewData, cumulativeData, storagePrefix, fmtMoney0, fmtPct, fmtYoy }: any) {
  const overviewItems: KpiItem[] = overviewData ? [
    { key: "sales", title: "销售额", value: fmtMoney0(overviewData.salesAmount), subtitle: `${overviewData.orderCount} 单`, color: "#0071E3" },
    { key: "orders", title: "订单量", value: String(overviewData.orderCount || 0), subtitle: `客单价 ${fmtMoney0(overviewData.avgOrderValue)}`, color: "#1D1D1F" },
    { key: "refund", title: "退款金额", value: fmtMoney0(overviewData.refundAmount), subtitle: `退款率 ${fmtPct(overviewData.refundRate)}`, color: "#FF9500" },
    { key: "promotion", title: "推广费用", value: fmtMoney0(overviewData.promotionTotal), subtitle: `推广占比 ${fmtPct(overviewData.promotionRate)}`, color: "#0071E3" },
    { key: "visitors", title: "访客数", value: String(overviewData.visitors || 0), subtitle: `转化率 ${fmtPct(overviewData.conversionRate)}`, color: "#AF52DE" },
    { key: "netSales", title: "净销售额", value: fmtMoney0(overviewData.netSales), subtitle: "销售 - 退款", color: "#34C759" },
    { key: "refundRate", title: "退款率", value: fmtPct(overviewData.refundRate), subtitle: fmtMoney0(overviewData.refundAmount), color: "#FF3B30" },
    { key: "promotionRate", title: "推广占比", value: fmtPct(overviewData.promotionRate), subtitle: fmtMoney0(overviewData.promotionTotal), color: "#0071E3" },
    { key: "roi", title: "投产比", value: (overviewData.roi || 0).toFixed(2), subtitle: "销售 / 推广", color: "#AF52DE" },
  ] : [];

  const cumulativeItems: KpiItem[] = cumulativeData ? [
    { key: "cumSales", title: "累积销售额", value: fmtMoney0(cumulativeData.cumulativeSales), color: "#0071E3", isCumulative: true },
    { key: "cumRefund", title: "累积退款", value: fmtMoney0(cumulativeData.cumulativeRefund), color: "#FF9500", isCumulative: true },
    { key: "cumNetSales", title: "累积净销售额", value: fmtMoney0(cumulativeData.cumulativeNetSales), color: "#34C759", isCumulative: true },
    { key: "cumPromotion", title: "累积推广费", value: fmtMoney0(cumulativeData.cumulativePromotion), color: "#AF52DE", isCumulative: true },
    { key: "cumRefundRate", title: "累积退款率", value: fmtPct(cumulativeData.cumulativeRefundRate), color: "#FF9500", isCumulative: true },
    { key: "cumPromotionRate", title: "累积推广占比", value: fmtPct(cumulativeData.cumulativePromotionRate), color: "#0071E3", isCumulative: true },
    { key: "cumNetPromotionRate", title: "累积净推广费率", value: fmtPct(cumulativeData.cumulativeNetPromotionRate), color: "#FF3B30", isCumulative: true },
    { key: "yoyGrowth", title: "同比去年", value: fmtYoy(cumulativeData.yoyGrowth), color: (cumulativeData.yoyGrowth || 0) >= 0 ? "#34C759" : "#FF3B30", isCumulative: true },
  ] : [];

  return (
    <div className="space-y-4">
      <SectionCard title={title} subtitle={dateLabel} action={dateSelector}>
        {overviewItems.length > 0 ? (
          <DraggableKpiGrid items={overviewItems} storageKey={`${storagePrefix}:overview`} columns={5} />
        ) : (
          <div className="py-8 text-center text-muted-foreground text-sm">暂无数据</div>
        )}
      </SectionCard>
      {cumulativeItems.length > 0 && (
        <SectionCard title="累积指标" subtitle="可拖拽排序">
          <DraggableKpiGrid items={cumulativeItems} storageKey={`${storagePrefix}:cumulative`} columns={4} />
        </SectionCard>
      )}
    </div>
  );
}

// ============== 日期选择器 ==============
// 日历选择器
function SimpleDatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      max={new Date().toISOString().slice(0, 10)}
      onChange={e => onChange(e.target.value)}
      className="h-8 px-2 text-xs rounded-lg border border-border bg-[#F5F5F7] cursor-pointer"
    />
  );
}

// 月份选择器
function MonthPicker({ year, month, onChange }: { year: number; month: number; onChange: (y: number, m: number) => void }) {
  const prev = () => {
    if (month === 1) onChange(year - 1, 12);
    else onChange(year, month - 1);
  };
  const next = () => {
    const now = new Date();
    if (year === now.getFullYear() && month === now.getMonth() + 1) return;
    if (month === 12) onChange(year + 1, 1);
    else onChange(year, month + 1);
  };
  return (
    <div className="flex items-center gap-1 bg-[#F5F5F7] rounded-lg p-0.5">
      <button onClick={prev} className="p-1 rounded hover:bg-white"><ChevronLeft className="size-4" /></button>
      <span className="text-xs font-medium px-2 min-w-[80px] text-center">{year}年 {month}月</span>
      <button onClick={next} className="p-1 rounded hover:bg-white"><ChevronRight className="size-4" /></button>
    </div>
  );
}

// 年份选择器
function YearPicker({ year, onChange }: { year: number; onChange: (y: number) => void }) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  return (
    <div className="flex items-center gap-1 bg-[#F5F5F7] rounded-lg p-0.5">
      <button onClick={() => onChange(year - 1)} className="p-1 rounded hover:bg-white"><ChevronLeft className="size-4" /></button>
      <select
        value={year}
        onChange={e => onChange(Number(e.target.value))}
        className="text-xs font-medium px-2 py-1 bg-transparent border-none outline-none cursor-pointer min-w-[70px]"
      >
        {years.map(y => <option key={y} value={y}>{y}年</option>)}
      </select>
      <button onClick={() => year < currentYear && onChange(year + 1)} className="p-1 rounded hover:bg-white disabled:opacity-30" disabled={year >= currentYear}><ChevronRight className="size-4" /></button>
    </div>
  );
}
