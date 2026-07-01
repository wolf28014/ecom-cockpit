"use client";

import { useState, useEffect } from "react";
import { KpiRow, SectionCard } from "@/components/ecom/kpi";
import { StoreSelector, RefreshButton } from "@/components/ecom/store-selector";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { toast } from "sonner";

const fmtMoney = (v: number) => `¥${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

const TOOLTIP_STYLE = { background: "#1D1D1F", border: "none", borderRadius: 8, color: "#fff", fontSize: 12 };

export function AnalyticsPage() {
  const [storeId, setStoreId] = useState("all");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    const sid = storeId === "all" ? "" : `&storeId=${storeId}`;
    fetch(`/api/analytics?${sid.slice(1)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { toast.error("加载失败"); setLoading(false); });
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData(); }, [storeId]);

  const today = data?.today || {};
  const week = data?.week || {};
  const month = data?.month || {};
  const year = data?.year || {};
  const dailyChange = data?.dailyChange || {};
  const weeklyChange = data?.weeklyChange || {};
  const trend14 = data?.trend14 || [];
  const trend30 = data?.trend30 || [];
  const monthlyAgg = data?.monthlyAgg || {};

  // weekly bar chart: this week (last 7) vs last week (prev 7) of trend14
  const weeklyCompare = trend14.map((p: any, i: number) => ({
    date: p.date.slice(5),
    label: i < 7 ? `上周D${i + 1}` : `本周D${i - 6}`,
    sales: p.sales,
  }));

  const monthlyTrend = trend30.map((p: any) => ({
    date: p.date.slice(5),
    sales: p.sales,
    profitRatePct: Number((p.profitRate * 100).toFixed(1)),
  }));

  const yearlyBars = Object.entries(monthlyAgg).map(([k, v]: any) => ({
    month: k.slice(5),
    sales: v.sales,
    profit: v.profit,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">经营分析中心</h1>
          <p className="text-sm text-muted-foreground mt-1">日/周/月/年多维度数据分析</p>
        </div>
        <div className="flex items-center gap-2">
          <StoreSelector value={storeId} onChange={setStoreId} />
          <RefreshButton onClick={loadData} loading={loading} />
        </div>
      </div>

      <Tabs defaultValue="daily">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="daily">日</TabsTrigger>
          <TabsTrigger value="weekly">周</TabsTrigger>
          <TabsTrigger value="monthly">月</TabsTrigger>
          <TabsTrigger value="yearly">年</TabsTrigger>
        </TabsList>

        {/* 日 */}
        <TabsContent value="daily" className="space-y-4">
          <KpiRow cards={[
            { title: "日销售额", value: fmtMoney(today.salesAmount), subtitle: `${today.orderCount || 0} 单`, trend: dailyChange.sales, trendLabel: "环比" },
            { title: "日净利润", value: fmtMoney(today.netProfit), subtitle: `利润率 ${fmtPct(today.profitRate)}`, trend: dailyChange.profit, trendLabel: "环比", accent: "#34C759" },
            { title: "日 ROI", value: (today.roi || 0).toFixed(2), subtitle: `推广费率 ${fmtPct(today.promotionRate)}`, accent: "#0071E3" },
            { title: "日退款率", value: fmtPct(today.refundRate), subtitle: `客单价 ${fmtMoney(today.avgOrderValue)}`, accent: (today.refundRate || 0) > 0.08 ? "#FF3B30" : "#FF9500" },
            { title: "异常检测", value: (today.refundRate || 0) > 0.08 || (today.roi || 99) < 1.5 ? "⚠️ 异常" : "✓ 正常", subtitle: "退款/ROI 综合判定", accent: (today.refundRate || 0) > 0.08 ? "#FF3B30" : "#34C759" },
          ]} />
          <SectionCard title="近 7 天明细" subtitle="每日关键指标">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead className="text-right">销售额</TableHead>
                  <TableHead className="text-right">订单</TableHead>
                  <TableHead className="text-right">净利润</TableHead>
                  <TableHead className="text-right">利润率</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                  <TableHead className="text-right">退款率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trend14.slice(-7).reverse().map((p: any) => (
                  <TableRow key={p.date}>
                    <TableCell className="font-medium">{p.date}</TableCell>
                    <TableCell className="text-right">{fmtMoney(p.sales)}</TableCell>
                    <TableCell className="text-right">{p.orders}</TableCell>
                    <TableCell className="text-right" style={{ color: p.profit >= 0 ? "#34C759" : "#FF3B30" }}>{fmtMoney(p.profit)}</TableCell>
                    <TableCell className="text-right">{fmtPct(p.profitRate)}</TableCell>
                    <TableCell className="text-right">{p.roi.toFixed(2)}</TableCell>
                    <TableCell className="text-right" style={{ color: p.refundRate > 0.08 ? "#FF3B30" : undefined }}>{fmtPct(p.refundRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        {/* 周 */}
        <TabsContent value="weekly" className="space-y-4">
          <KpiRow cards={[
            { title: "本周销售额", value: fmtMoney(week.salesAmount), subtitle: `${week.orderCount || 0} 单`, trend: weeklyChange.sales, trendLabel: "环比", accent: "#0071E3" },
            { title: "本周净利润", value: fmtMoney(week.netProfit), subtitle: `利润率 ${fmtPct(week.profitRate)}`, trend: weeklyChange.profit, trendLabel: "环比", accent: "#34C759" },
            { title: "本周 ROI", value: (week.roi || 0).toFixed(2), subtitle: `推广费率 ${fmtPct(week.promotionRate)}`, accent: "#AF52DE" },
            { title: "本周客单价", value: fmtMoney(week.avgOrderValue), subtitle: `单均利润 ${fmtMoney(week.profitPerOrder)}`, accent: "#FF9500" },
            { title: "本周退款率", value: fmtPct(week.refundRate), subtitle: `退款金额 ${fmtMoney(week.refundAmount)}`, accent: (week.refundRate || 0) > 0.08 ? "#FF3B30" : "#34C759" },
          ]} />
          <SectionCard title="本周 vs 上周每日销售对比" subtitle="近 14 天日销售额">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyCompare}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" />
                  <XAxis dataKey="label" stroke="#6E6E73" fontSize={11} tickLine={false} />
                  <YAxis stroke="#6E6E73" fontSize={11} tickLine={false} axisLine={false}
                    tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(1)}万` : String(v)} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => `¥${v.toLocaleString()}`} />
                  <Bar dataKey="sales" name="销售额" fill="#0071E3" radius={[4, 4, 0, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </TabsContent>

        {/* 月 */}
        <TabsContent value="monthly" className="space-y-4">
          <KpiRow cards={[
            { title: "本月销售额", value: fmtMoney(month.salesAmount), subtitle: `${month.orderCount || 0} 单`, accent: "#0071E3" },
            { title: "本月净利润", value: fmtMoney(month.netProfit), subtitle: `利润率 ${fmtPct(month.profitRate)}`, accent: "#34C759" },
            { title: "本月 ROI", value: (month.roi || 0).toFixed(2), subtitle: `推广费率 ${fmtPct(month.promotionRate)}`, accent: "#AF52DE" },
            { title: "本月客单价", value: fmtMoney(month.avgOrderValue), subtitle: `单均利润 ${fmtMoney(month.profitPerOrder)}`, accent: "#FF9500" },
            { title: "本月退款率", value: fmtPct(month.refundRate), subtitle: `退款 ${fmtMoney(month.refundAmount)}`, accent: (month.refundRate || 0) > 0.08 ? "#FF3B30" : "#34C759" },
          ]} />
          <SectionCard title="近 30 天销售/利润率组合图" subtitle="柱状为销售额，折线为利润率">
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" />
                  <XAxis dataKey="date" stroke="#6E6E73" fontSize={11} tickLine={false} interval={2} />
                  <YAxis yAxisId="left" stroke="#6E6E73" fontSize={11} tickLine={false} axisLine={false}
                    tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(1)}万` : String(v)} />
                  <YAxis yAxisId="right" orientation="right" stroke="#6E6E73" fontSize={11} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip contentStyle={TOOLTIP_STYLE}
                    formatter={(v: any, name: any) => name === "利润率" ? `${v}%` : `¥${v.toLocaleString()}`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="sales" name="销售额" fill="#0071E3" radius={[3, 3, 0, 0]} barSize={10} />
                  <Line yAxisId="right" type="monotone" dataKey="profitRatePct" name="利润率" stroke="#FF9500" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </TabsContent>

        {/* 年 */}
        <TabsContent value="yearly" className="space-y-4">
          <KpiRow cards={[
            { title: "年度 GMV", value: fmtMoney(year.salesAmount), subtitle: `${year.orderCount || 0} 单`, accent: "#0071E3" },
            { title: "年度净利润", value: fmtMoney(year.netProfit), subtitle: `利润率 ${fmtPct(year.profitRate)}`, accent: "#34C759" },
            { title: "年度 ROI", value: (year.roi || 0).toFixed(2), subtitle: `推广费率 ${fmtPct(year.promotionRate)}`, accent: "#AF52DE" },
            { title: "年度客单价", value: fmtMoney(year.avgOrderValue), subtitle: `单均利润 ${fmtMoney(year.profitPerOrder)}`, accent: "#FF9500" },
            { title: "年度退款率", value: fmtPct(year.refundRate), subtitle: `日均销售 ${fmtMoney((year.salesAmount || 0) / 365)}`, accent: "#FF3B30" },
          ]} />
          <SectionCard title="月度销售/利润对比" subtitle="本年度月度汇总">
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearlyBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" />
                  <XAxis dataKey="month" stroke="#6E6E73" fontSize={11} tickLine={false} />
                  <YAxis stroke="#6E6E73" fontSize={11} tickLine={false} axisLine={false}
                    tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v)} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => `¥${v.toLocaleString()}`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="sales" name="销售额" fill="#0071E3" radius={[4, 4, 0, 0]} barSize={28} />
                  <Bar dataKey="profit" name="净利润" fill="#34C759" radius={[4, 4, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
