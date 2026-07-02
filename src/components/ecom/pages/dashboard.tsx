"use client";

import { useState } from "react";
import { KpiRow, SectionCard } from "@/components/ecom/kpi";
import { RefreshButton } from "@/components/ecom/store-selector";
import { StoreMultiSelect } from "@/components/ecom/store-multi-select";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Legend, Area, AreaChart,
} from "recharts";
import { Progress } from "@/components/ui/progress";
import { useCachedFetch } from "@/lib/use-cached-fetch";

const PIE_COLORS = ["#0071E3", "#34C759", "#FF9500", "#AF52DE", "#FF3B30", "#5856D6", "#FF2D55"];

export function DashboardPage() {
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [yearType, setYearType] = useState<"natural" | "seasonal">("natural");

  const sidParam = storeIds.length > 0 ? `&storeIds=${storeIds.join(",")}` : "";
  const url = `/api/dashboard?days=30${sidParam}`;
  const { data, loading, refresh } = useCachedFetch(url, `ecom:dashboard:${storeIds.join(",") || "all"}`);

  const handleRefresh = () => refresh();

  const today = data?.today;
  const trend = data?.trend || [];
  const promotion = data?.promotion || {};
  const progress = data?.progress || {};
  const changes = data?.changes || {};

  // 根据年类型选择数据
  const yearSummary = yearType === "seasonal" ? data?.seasonalYear : data?.naturalYear;
  const cumulative = yearType === "seasonal" ? data?.seasonalCumulative : data?.naturalCumulative;
  const yearLabel = yearType === "seasonal" ? "季节年" : "自然年";

  const fmtMoney = (v: number) => `¥${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const fmtMoney2 = (v: number) => `¥${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const fmtPct2 = (v: number) => `${(v * 100).toFixed(2)}%`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">首页驾驶舱</h1>
          <p className="text-sm text-muted-foreground mt-1">实时掌握经营全貌</p>
        </div>
        <div className="flex items-center gap-2">
          <StoreMultiSelect value={storeIds} onChange={setStoreIds} />
          <RefreshButton onClick={handleRefresh} loading={loading} />
        </div>
      </div>

      {/* 今日 KPI */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 px-1">今日概览</h2>
        <KpiRow cards={[
          { title: "今日销售额", value: fmtMoney(today?.salesAmount || 0), subtitle: `${today?.orderCount || 0} 单 · ${today?.visitors || 0} 访客数`, trend: changes.sales, trendLabel: "环比" },
          { title: "今日退款", value: fmtMoney(today?.refundAmount || 0), subtitle: `退款率 ${fmtPct(today?.refundRate || 0)}`, trend: changes.refund, trendLabel: "环比", accent: "#FF9500" },
          { title: "今日净销售额", value: fmtMoney(today?.netSales || 0), subtitle: `销售 - 退款`, trend: changes.netSales, trendLabel: "环比", accent: "#34C759" },
          { title: "今日投产比", value: (today?.roi || 0).toFixed(2), subtitle: `推广 ${fmtMoney(today?.promotionTotal || 0)}`, accent: "#0071E3" },
          { title: "今日转化率", value: fmtPct2(today?.conversionRate || 0), subtitle: `客单价 ${fmtMoney(today?.avgOrderValue || 0)}`, accent: "#AF52DE" },
        ]} />
      </div>

      {/* 周期对比 */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 px-1">周期对比</h2>
        <KpiRow cards={[
          { title: "本周销售额", value: fmtMoney(data?.week?.salesAmount || 0), subtitle: `净销售 ${fmtMoney(data?.week?.netSales || 0)}`, accent: "#1D1D1F" },
          { title: "本月销售额", value: fmtMoney(data?.month?.salesAmount || 0), subtitle: `净销售 ${fmtMoney(data?.month?.netSales || 0)}`, accent: "#1D1D1F" },
          { title: "本月投产比", value: (data?.month?.roi || 0).toFixed(2), subtitle: `推广占比 ${fmtPct(data?.month?.promotionRate || 0)}`, accent: "#0071E3" },
          { title: `${yearLabel}销售额`, value: fmtMoney(yearSummary?.salesAmount || 0), subtitle: `净销售 ${fmtMoney(yearSummary?.netSales || 0)}`, accent: "#1D1D1F" },
        ]} />
      </div>

      {/* 年度累积指标 + 自然年/季节年切换 */}
      <SectionCard
        title={`${yearLabel}累积指标`}
        subtitle="年度累计数据 · 支持自然年/季节年切换"
        action={
          <ToggleGroup type="single" value={yearType} onValueChange={(v) => v && setYearType(v as "natural" | "seasonal")}>
            <ToggleGroupItem value="natural" className="text-xs">自然年</ToggleGroupItem>
            <ToggleGroupItem value="seasonal" className="text-xs">季节年</ToggleGroupItem>
          </ToggleGroup>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <CumItem label="累积销售额" value={fmtMoney2(cumulative?.cumulativeSales || 0)} color="#0071E3" />
          <CumItem label="累积退款" value={fmtMoney2(cumulative?.cumulativeRefund || 0)} color="#FF9500" />
          <CumItem label="累积净销售额" value={fmtMoney2(cumulative?.cumulativeNetSales || 0)} color="#34C759" />
          <CumItem label="累积推广费" value={fmtMoney2(cumulative?.cumulativePromotion || 0)} color="#AF52DE" />
          <CumItem label="累积退款率" value={fmtPct2(cumulative?.cumulativeRefundRate || 0)} color="#FF9500" />
          <CumItem label="累积推广占比" value={fmtPct2(cumulative?.cumulativePromotionRate || 0)} color="#0071E3" />
          <CumItem label="累积净推广费率" value={fmtPct2(cumulative?.cumulativeNetPromotionRate || 0)} color="#FF3B30" />
          <CumItem
            label="同比去年"
            value={`${(cumulative?.yoyGrowth || 0) > 0 ? "+" : ""}${((cumulative?.yoyGrowth || 0) * 100).toFixed(1)}%`}
            color={(cumulative?.yoyGrowth || 0) >= 0 ? "#34C759" : "#FF3B30"}
          />
        </div>
      </SectionCard>

      {/* 趋势图 */}
      <SectionCard title="经营趋势" subtitle="近 30 天销售/净销售/投产比">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trend.map((p: any) => ({
              ...p,
              date: p.date.slice(5),
              roiNum: p.roi,
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" />
              <XAxis dataKey="date" stroke="#6E6E73" fontSize={11} tickLine={false} />
              <YAxis yAxisId="left" stroke="#6E6E73" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" stroke="#6E6E73" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "#1D1D1F", border: "none", borderRadius: 8, color: "#fff", fontSize: 12 }}
                formatter={(v: any, name: any) => {
                  if (name === "销售额" || name === "净销售额") return `¥${v.toLocaleString()}`;
                  return v;
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="sales" name="销售额" fill="#0071E3" radius={[4, 4, 0, 0]} barSize={14} />
              <Bar yAxisId="left" dataKey="netSales" name="净销售额" fill="#34C759" radius={[4, 4, 0, 0]} barSize={14} />
              <Line yAxisId="right" type="monotone" dataKey="roiNum" name="投产比" stroke="#FF9500" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* 推广分布 */}
      <SectionCard title="推广渠道分布" subtitle="近 30 天">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={Object.entries(promotion).map(([k, v]) => ({ name: k, value: v as number }))}
                dataKey="value"
                nameKey="name"
                cx="40%" cy="50%"
                outerRadius={90} innerRadius={50}
                paddingAngle={2}
              >
                {Object.entries(promotion).map(([k, v], i) => (
                  <Cell key={k} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => `¥${v.toLocaleString()}`} contentStyle={{ background: "#1D1D1F", border: "none", borderRadius: 8, color: "#fff", fontSize: 12 }} />
              <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* 利润目标 */}
      <SectionCard title="利润目标进度" subtitle="年度/季度/月度完成情况">
        <div className="space-y-4">
          {Object.keys(progress).length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">暂未设置利润目标，请前往「利润目标管理」页面设置</p>
          )}
          {Object.entries(progress).map(([k, v]: any) => {
            const label = { yearly: "年度目标", quarterly: "季度目标", monthly: "月度目标" }[k] || k;
            const color = v.rate >= 0.8 ? "#34C759" : v.rate >= 0.5 ? "#FF9500" : "#FF3B30";
            return (
              <div key={k}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-sm text-muted-foreground">
                    已完成 <span style={{ color }} className="font-bold">¥{v.actual.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    {" / "}¥{v.target.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({(v.rate * 100).toFixed(1)}%)
                  </span>
                </div>
                <Progress value={v.rate * 100} className="h-2" style={{ background: "#F2F2F7" }} />
                <p className="text-xs text-muted-foreground mt-1">剩余 ¥{v.remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}{v.daysLeft ? ` · 剩余 ${v.daysLeft} 天` : ""}</p>
              </div>
            );
          })}
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
