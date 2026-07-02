"use client";

import { useState } from "react";
import { SectionCard } from "@/components/ecom/kpi";
import { RefreshButton } from "@/components/ecom/store-selector";
import { StoreMultiSelect } from "@/components/ecom/store-multi-select";
import { useCachedFetch } from "@/lib/use-cached-fetch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const COST_FIELDS = [
  { key: "goodsCost", label: "货品成本", color: "#FF3B30" },
  { key: "promotionTotal", label: "推广费用", color: "#0071E3" },
  { key: "redPacket", label: "红包", color: "#FF9500" },
  { key: "labor", label: "人工", color: "#FF9500" },
  { key: "logistics", label: "集运物流", color: "#FF9500" },
  { key: "other", label: "其它", color: "#FF9500" },
  { key: "consumerExperience", label: "消费者体验", color: "#AF52DE" },
  { key: "bnplTechFee", label: "先用后付", color: "#AF52DE" },
  { key: "basicSoftwareFee", label: "基础软件费", color: "#AF52DE" },
  { key: "redPacketAdvance", label: "红包垫付", color: "#AF52DE" },
  { key: "brandGiftFee", label: "品牌礼金", color: "#AF52DE" },
  { key: "charity", label: "公益宝贝", color: "#AF52DE" },
  { key: "quickPaymentFee", label: "极速回款", color: "#AF52DE" },
  { key: "marketingPlatform", label: "营销平台", color: "#AF52DE" },
  { key: "tax", label: "税务", color: "#FF3B30" },
];

export function ProfitCenterPage() {
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [dayDate, setDayDate] = useState(new Date().toISOString().slice(0, 10));
  const now = new Date();
  const [monthYear, setMonthYear] = useState(now.getFullYear());
  const [monthMonth, setMonthMonth] = useState(now.getMonth() + 1);
  const [naturalYear, setNaturalYear] = useState(now.getFullYear());
  const [seasonalYear, setSeasonalYear] = useState(now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1);

  const sidParam = storeIds.length > 0 ? `&storeIds=${storeIds.join(",")}` : "";
  const url = `/api/profit?${sidParam}&day=${dayDate}&monthYear=${monthYear}&monthMonth=${monthMonth}&naturalYear=${naturalYear}&seasonalYear=${seasonalYear}`;
  const cacheKey = `ecom:profit:${storeIds.join(",") || "all"}:${dayDate}:${monthYear}-${monthMonth}:N${naturalYear}:S${seasonalYear}`;
  const { data, loading, refresh } = useCachedFetch(url, cacheKey, true, true); // 历史数据用长缓存

  const fmt = (v: number) => `¥${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const fmt0 = (v: number) => `¥${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">利润中心</h1>
          <p className="text-sm text-muted-foreground mt-1">利润计算 · 利润目标 · 现金流预测</p>
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
        <Tabs defaultValue="calc">
          <TabsList>
            <TabsTrigger value="calc">利润计算</TabsTrigger>
            <TabsTrigger value="target">利润目标</TabsTrigger>
            <TabsTrigger value="forecast">现金流预测</TabsTrigger>
          </TabsList>

          {/* 利润计算 */}
          <TabsContent value="calc">
            <div className="space-y-4">
              <Tabs defaultValue="daily">
                <TabsList>
                  <TabsTrigger value="daily">日利润</TabsTrigger>
                  <TabsTrigger value="monthly">月利润</TabsTrigger>
                  <TabsTrigger value="natural">自然年</TabsTrigger>
                  <TabsTrigger value="seasonal">季节年</TabsTrigger>
                </TabsList>

                <TabsContent value="daily">
                  <ProfitDetail data={data.dayProfit} title="日利润" dateLabel={dayDate} dateSelector={<input type="date" value={dayDate} max={new Date().toISOString().slice(0,10)} onChange={e=>setDayDate(e.target.value)} className="h-8 px-2 text-xs rounded-lg border border-border bg-[#F5F5F7]" />} fmt={fmt} fmt0={fmt0} pct={pct} />
                </TabsContent>
                <TabsContent value="monthly">
                  <ProfitDetail data={data.monthProfit} title="月利润" dateLabel={`${monthYear}年${monthMonth}月`} dateSelector={<MonthNav year={monthYear} month={monthMonth} onChange={(y,m)=>{setMonthYear(y);setMonthMonth(m);}} />} fmt={fmt} fmt0={fmt0} pct={pct} />
                </TabsContent>
                <TabsContent value="natural">
                  <ProfitDetail data={data.naturalYearProfit} title={`自然年 ${naturalYear}`} dateLabel={`${naturalYear}年 1/1~12/31`} dateSelector={<YearNav year={naturalYear} onChange={setNaturalYear} />} fmt={fmt} fmt0={fmt0} pct={pct} />
                </TabsContent>
                <TabsContent value="seasonal">
                  <ProfitDetail data={data.seasonalYearProfit} title={`季节年 ${seasonalYear}`} dateLabel={`${seasonalYear}年 7/1~${seasonalYear+1}年 6/30`} dateSelector={<YearNav year={seasonalYear} onChange={setSeasonalYear} />} fmt={fmt} fmt0={fmt0} pct={pct} />
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          {/* 利润目标 */}
          <TabsContent value="target">
            <ProfitTargetSection storeIds={storeIds} />
          </TabsContent>

          {/* 现金流预测 */}
          <TabsContent value="forecast">
            <CashFlowSection storeIds={storeIds} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ============== 利润明细展示 ==============
function ProfitDetail({ data, title, dateLabel, dateSelector, fmt, fmt0, pct }: any) {
  if (!data) return <Card><CardContent className="py-8 text-center text-muted-foreground">暂无数据</CardContent></Card>;

  const profitColor = data.netProfit >= 0 ? "#34C759" : "#FF3B30";

  return (
    <div className="space-y-4 mt-4">
      <SectionCard title={title} subtitle={dateLabel} action={dateSelector}>
        {/* 核心利润指标 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg border p-4 bg-[#F0F7FF]">
            <p className="text-xs text-muted-foreground">净销售额</p>
            <p className="text-xl font-bold text-[#0071E3]">{fmt0(data.netSales)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">销售 {fmt0(data.salesAmount)} - 退款 {fmt0(data.refundAmount)}</p>
          </div>
          <div className="rounded-lg border p-4 bg-[#F0FFF4]">
            <p className="text-xs text-muted-foreground">毛利润</p>
            <p className="text-xl font-bold text-[#34C759]">{fmt0(data.grossProfit)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">净销售 - 货品成本</p>
          </div>
          <div className="rounded-lg border p-4" style={{ background: data.netProfit >= 0 ? "#F0FFF4" : "#FFF0F0" }}>
            <p className="text-xs text-muted-foreground">净利润</p>
            <p className="text-xl font-bold" style={{ color: profitColor }}>{fmt0(data.netProfit)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">毛利 - 推广 - 其他成本</p>
          </div>
          <div className="rounded-lg border p-4 bg-[#F5F5F7]">
            <p className="text-xs text-muted-foreground">利润率</p>
            <p className="text-xl font-bold" style={{ color: profitColor }}>{pct(data.profitRate)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">净利润 / 净销售额</p>
          </div>
        </div>

        {/* 利润计算公式可视化 */}
        <div className="rounded-lg border p-4 bg-white">
          <p className="text-sm font-semibold mb-3">利润计算明细</p>
          <div className="space-y-1.5 text-sm">
            <Row label="销售额" value={fmt(data.salesAmount)} color="#0071E3" />
            <Row label="- 退款金额" value={fmt(data.refundAmount)} color="#FF9500" />
            <Row label="= 净销售额" value={fmt(data.netSales)} bold color="#0071E3" />
            <div className="border-t my-1" />
            <Row label="- 货品成本" value={fmt(data.goodsCost) + (data.goodsCostSource === "ratio" ? "（按比例）" : "")} color="#FF3B30" />
            <Row label="= 毛利润" value={fmt(data.grossProfit)} bold color="#34C759" />
            <div className="border-t my-1" />
            <Row label="- 推广费用" value={fmt(data.promotionTotal)} color="#0071E3" />
            <Row label="- 其他成本合计" value={fmt(data.totalCost - data.goodsCost)} color="#FF9500" />
            <Row label="= 净利润" value={fmt(data.netProfit)} bold color={profitColor} />
          </div>
        </div>
      </SectionCard>

      {/* 成本明细 */}
      <SectionCard title="成本明细" subtitle="各项成本占比">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {COST_FIELDS.map(f => {
            const val = data[f.key] || 0;
            const ratio = data.totalCost > 0 ? val / (data.totalCost + data.promotionTotal) : 0;
            return (
              <div key={f.key} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{f.label}</p>
                <p className="text-base font-semibold" style={{ color: f.color }}>{fmt0(val)}</p>
                <p className="text-[10px] text-muted-foreground">{pct(ratio)}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t flex justify-between items-center">
          <span className="text-sm font-semibold">总成本 + 推广</span>
          <span className="text-lg font-bold text-[#FF3B30]">{fmt0(data.totalCost + data.promotionTotal)}</span>
        </div>
      </SectionCard>
    </div>
  );
}

function Row({ label, value, bold, color }: any) {
  return (
    <div className="flex justify-between items-center">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={bold ? "font-bold" : ""} style={{ color: color || undefined }}>{value}</span>
    </div>
  );
}

// ============== 利润目标 ==============
function ProfitTargetSection({ storeIds }: { storeIds: string[] }) {
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const sid = storeIds.length > 0 ? `?storeId=${storeIds[0]}` : "";
    fetch(`/api/targets${sid}`).then(r => r.json()).then(d => { setTargets(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
  };

  useState(() => { load(); });

  const fmt0 = (v: number) => `¥${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-4 mt-4">
      <SectionCard title="利润目标" subtitle="年度 / 季度 / 月度目标完成情况">
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">加载中...</div>
        ) : targets.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">暂未设置利润目标，请前往「利润目标管理」添加</div>
        ) : (
          <div className="space-y-3">
            {targets.map(t => {
              const label = t.targetType === "yearly" ? `${t.targetYear}年年度目标` : t.targetType === "quarterly" ? `${t.targetYear}年 Q${t.targetQuarter}` : `${t.targetYear}年${t.targetMonth}月`;
              const color = "#0071E3";
              return (
                <div key={t.id} className="rounded-lg border p-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-sm text-muted-foreground">目标 {fmt0(t.targetAmount)}</span>
                  </div>
                  <Progress value={50} className="h-2" style={{ background: "#F2F2F7" }} />
                  <p className="text-xs text-muted-foreground mt-1">请在利润目标管理页面查看详细进度</p>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ============== 现金流预测 ==============
function CashFlowSection({ storeIds }: { storeIds: string[] }) {
  const [forecast, setForecast] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const sid = storeIds.length > 0 ? `&storeIds=${storeIds.join(",")}` : "";
    fetch(`/api/forecast?days=30${sid}`).then(r => r.json()).then(d => { setForecast(d); setLoading(false); }).catch(() => setLoading(false));
  };

  useState(() => { load(); });

  const fmt0 = (v: number) => `¥${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  if (loading) return <div className="py-8 text-center text-muted-foreground mt-4">加载中...</div>;
  if (!forecast) return <div className="py-8 text-center text-muted-foreground mt-4">暂无数据</div>;

  const riskColor = { safe: "#34C759", warning: "#FF9500", danger: "#FF3B30" }[forecast.riskLevel as string] || "#1D1D1F";
  const riskLabel = { safe: "安全", warning: "需关注", danger: "高风险" }[forecast.riskLevel as string] || "—";

  return (
    <div className="space-y-4 mt-4">
      <SectionCard title="未来 30 天现金流预测" subtitle="基于近 30 天日均数据">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border p-4 bg-[#F0F7FF]">
            <p className="text-xs text-muted-foreground">预计销售</p>
            <p className="text-xl font-bold text-[#0071E3]">{fmt0(forecast.projectedSales)}</p>
            <p className="text-[10px] text-muted-foreground">日均 {fmt0(forecast.avgDailySales)}</p>
          </div>
          <div className="rounded-lg border p-4 bg-[#F0FFF4]">
            <p className="text-xs text-muted-foreground">预计利润</p>
            <p className="text-xl font-bold text-[#34C759]">{fmt0(forecast.projectedProfit)}</p>
            <p className="text-[10px] text-muted-foreground">日均 {fmt0(forecast.avgDailyProfit)}</p>
          </div>
          <div className="rounded-lg border p-4 bg-[#FFF5E6]">
            <p className="text-xs text-muted-foreground">预计支出</p>
            <p className="text-xl font-bold text-[#FF9500]">{fmt0(forecast.projectedCost)}</p>
            <p className="text-[10px] text-muted-foreground">日均 {fmt0(forecast.avgDailyCost)}</p>
          </div>
          <div className="rounded-lg border p-4" style={{ background: riskColor + "15" }}>
            <p className="text-xs text-muted-foreground">预计余额</p>
            <p className="text-xl font-bold" style={{ color: riskColor }}>{fmt0(forecast.projectedBalance)}</p>
            <p className="text-[10px] font-medium" style={{ color: riskColor }}>风险: {riskLabel}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">提示：现金流预测基于历史日均数据，实际可能因促销活动、季节因素等波动。</p>
      </SectionCard>
    </div>
  );
}

// ============== 日期选择器 ==============
function MonthNav({ year, month, onChange }: any) {
  const prev = () => month === 1 ? onChange(year - 1, 12) : onChange(year, month - 1);
  const next = () => { const now = new Date(); if (year === now.getFullYear() && month === now.getMonth() + 1) return; month === 12 ? onChange(year + 1, 1) : onChange(year, month + 1); };
  return (
    <div className="flex items-center gap-1 bg-[#F5F5F7] rounded-lg p-0.5">
      <button onClick={prev} className="p-1 rounded hover:bg-white"><ChevronLeft className="size-4" /></button>
      <span className="text-xs font-medium px-2 min-w-[80px] text-center">{year}年 {month}月</span>
      <button onClick={next} className="p-1 rounded hover:bg-white"><ChevronRight className="size-4" /></button>
    </div>
  );
}

function YearNav({ year, onChange }: any) {
  const cy = new Date().getFullYear();
  return (
    <div className="flex items-center gap-1 bg-[#F5F5F7] rounded-lg p-0.5">
      <button onClick={() => onChange(year - 1)} className="p-1 rounded hover:bg-white"><ChevronLeft className="size-4" /></button>
      <span className="text-xs font-medium px-2 min-w-[60px] text-center">{year}年</span>
      <button onClick={() => year < cy && onChange(year + 1)} className="p-1 rounded hover:bg-white disabled:opacity-30" disabled={year >= cy}><ChevronRight className="size-4" /></button>
    </div>
  );
}
