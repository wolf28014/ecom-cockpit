"use client";

import { useState, useEffect } from "react";
import { KpiRow, SectionCard } from "@/components/ecom/kpi";
import { StoreSelector, RefreshButton } from "@/components/ecom/store-selector";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Legend, Area, AreaChart,
} from "recharts";
import { Progress } from "@/components/ui/progress";

const PIE_COLORS = ["#0071E3", "#34C759", "#FF9500", "#AF52DE", "#FF3B30", "#5856D6", "#FF2D55"];

export function DashboardPage() {
  const [storeId, setStoreId] = useState("all");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    const sid = storeId === "all" ? "" : `&storeId=${storeId}`;
    fetch(`/api/dashboard?days=30${sid}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData(); }, [storeId]);

  const today = data?.today;
  const trend = data?.trend || [];
  const promotion = data?.promotion || {};
  const cost = data?.cost || {};
  const progress = data?.progress || {};
  const changes = data?.changes || {};

  const fmtMoney = (v: number) => `¥${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">首页驾驶舱</h1>
          <p className="text-sm text-muted-foreground mt-1">实时掌握经营全貌</p>
        </div>
        <div className="flex items-center gap-2">
          <StoreSelector value={storeId} onChange={setStoreId} />
          <RefreshButton onClick={loadData} loading={loading} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 px-1">今日概览</h2>
        <KpiRow cards={[
          { title: "今日销售额", value: fmtMoney(today?.salesAmount || 0), subtitle: `${today?.orderCount || 0} 单`, trend: changes.sales, trendLabel: "环比昨日" },
          { title: "今日净利润", value: fmtMoney(today?.netProfit || 0), subtitle: `利润率 ${fmtPct(today?.profitRate || 0)}`, trend: changes.profit, trendLabel: "环比昨日", accent: "#34C759" },
          { title: "今日 ROI", value: (today?.roi || 0).toFixed(2), subtitle: `推广费率 ${fmtPct(today?.promotionRate || 0)}`, accent: "#0071E3" },
          { title: "今日客单价", value: fmtMoney(today?.avgOrderValue || 0), subtitle: `单均利润 ${fmtMoney(today?.profitPerOrder || 0)}`, accent: "#AF52DE" },
          { title: "今日退款率", value: fmtPct(today?.refundRate || 0), subtitle: `退款 ${fmtMoney(today?.refundAmount || 0)}`, accent: (today?.refundRate || 0) > 0.08 ? "#FF3B30" : "#FF9500" },
        ]} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 px-1">周期对比</h2>
        <KpiRow cards={[
          { title: "本周销售额", value: fmtMoney(data?.week?.salesAmount || 0), subtitle: `本周利润 ${fmtMoney(data?.week?.netProfit || 0)}`, accent: "#1D1D1F" },
          { title: "本月销售额", value: fmtMoney(data?.month?.salesAmount || 0), subtitle: `本月利润 ${fmtMoney(data?.month?.netProfit || 0)}`, accent: "#1D1D1F" },
          { title: "本月利润率", value: fmtPct(data?.month?.profitRate || 0), subtitle: `推广费率 ${fmtPct(data?.month?.promotionRate || 0)}`, accent: "#1D1D1F" },
          { title: "年度 GMV", value: fmtMoney(data?.year?.salesAmount || 0), subtitle: `年度利润 ${fmtMoney(data?.year?.netProfit || 0)}`, accent: "#1D1D1F" },
        ]} />
      </div>

      <SectionCard title="经营趋势" subtitle="近 30 天销售/利润率组合图">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trend.map((p: any) => ({ ...p, date: p.date.slice(5), profitRatePct: (p.profitRate * 100).toFixed(1) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" />
              <XAxis dataKey="date" stroke="#6E6E73" fontSize={11} tickLine={false} />
              <YAxis yAxisId="left" stroke="#6E6E73" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" stroke="#6E6E73" fontSize={11} tickLine={false} axisLine={false} unit="%" />
              <Tooltip
                contentStyle={{ background: "#1D1D1F", border: "none", borderRadius: 8, color: "#fff", fontSize: 12 }}
                formatter={(v: any, name: any) => name === "销售额" ? `¥${v.toLocaleString()}` : `${v}%`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="sales" name="销售额" fill="#0071E3" radius={[4, 4, 0, 0]} barSize={16} />
              <Line yAxisId="right" type="monotone" dataKey="profitRatePct" name="利润率" stroke="#FF9500" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        <SectionCard title="成本结构" subtitle="近 30 天">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={Object.entries(cost).map(([k, v]) => ({ name: k, value: v as number }))}
                  dataKey="value"
                  nameKey="name"
                  cx="40%" cy="50%"
                  outerRadius={90} innerRadius={50}
                  paddingAngle={2}
                >
                  {Object.entries(cost).map(([k, v], i) => (
                    <Cell key={k} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => `¥${v.toLocaleString()}`} contentStyle={{ background: "#1D1D1F", border: "none", borderRadius: 8, color: "#fff", fontSize: 12 }} />
                <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

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
