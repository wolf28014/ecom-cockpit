"use client";

import { useState, useEffect } from "react";
import { KpiRow, SectionCard } from "@/components/ecom/kpi";
import { StoreSelector, RefreshButton } from "@/components/ecom/store-selector";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Sparkles, Loader2, AlertTriangle, ShieldCheck, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

const fmtMoney = (v: number) => `¥${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const SCENARIOS = [
  "如果推广增加 20%",
  "如果推广减少 20%",
  "如果客单价提升 10%",
  "如果退款率降低到 3%",
  "如果新增一个爆款",
  "如果停售底部 3 个 SKU",
];

const RISK_CONFIG: Record<string, { color: string; label: string; icon: any }> = {
  safe: { color: "#34C759", label: "安全", icon: ShieldCheck },
  warning: { color: "#FF9500", label: "需关注", icon: AlertTriangle },
  danger: { color: "#FF3B30", label: "高风险", icon: AlertCircle },
};

const TOOLTIP_STYLE = { background: "#1D1D1F", border: "none", borderRadius: 8, color: "#fff", fontSize: 12 };

export function CashflowPage() {
  const [storeId, setStoreId] = useState("all");
  const [days, setDays] = useState(30);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [scenario, setScenario] = useState(SCENARIOS[0]);
  const [simResult, setSimResult] = useState("");
  const [simLoading, setSimLoading] = useState(false);

  const loadData = () => {
    setLoading(true);
    const sid = storeId === "all" ? "" : `&storeId=${storeId}`;
    fetch(`/api/forecast?${sid.slice(1)}&days=${days}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { toast.error("加载失败"); setLoading(false); });
  };

  useEffect(() => { loadData(); }, [storeId, days]);

  const handleAiAnalyze = async () => {
    setAiLoading(true);
    setAiResult("");
    try {
      const r = await fetch("/api/ai/cashflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: storeId === "all" ? null : storeId, days }),
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setAiResult(d.result || "");
    } catch {
      toast.error("AI 分析失败");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSimulate = async () => {
    setSimLoading(true);
    setSimResult("");
    try {
      const r = await fetch("/api/ai/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: storeId === "all" ? null : storeId, scenario }),
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setSimResult(d.result || "");
    } catch {
      toast.error("模拟失败");
    } finally {
      setSimLoading(false);
    }
  };

  const forecast = data?.dailyForecast || [];
  const risk = data?.riskLevel || "safe";
  const riskConf = RISK_CONFIG[risk] || RISK_CONFIG.safe;
  const RiskIcon = riskConf.icon;

  const chartData = forecast.map((p: any) => ({
    date: p.date.slice(5),
    sales: Math.round(p.sales),
    profit: Math.round(p.profit),
    balance: Math.round(p.balance),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">现金流预测</h1>
          <p className="text-sm text-muted-foreground mt-1">基于历史数据预测未来现金流，识别风险</p>
        </div>
        <div className="flex items-center gap-2">
          <StoreSelector value={storeId} onChange={setStoreId} />
          <RefreshButton onClick={loadData} loading={loading} />
        </div>
      </div>

      <Tabs defaultValue="7" onValueChange={(v) => setDays(Number(v))}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="7">7 天</TabsTrigger>
          <TabsTrigger value="30">30 天</TabsTrigger>
          <TabsTrigger value="90">90 天</TabsTrigger>
          <TabsTrigger value="simulate">AI 模拟</TabsTrigger>
        </TabsList>

        {[
          { tab: "7", days: 7 },
          { tab: "30", days: 30 },
          { tab: "90", days: 90 },
        ].map(({ tab }) => (
          <TabsContent key={tab} value={tab} className="space-y-4">
            <KpiRow cards={[
              { title: `预计 ${days} 天销售`, value: fmtMoney(data?.projectedSales || 0), subtitle: `日均 ${fmtMoney(data?.avgDailySales || 0)}`, accent: "#0071E3" },
              { title: `预计 ${days} 天利润`, value: fmtMoney(data?.projectedProfit || 0), subtitle: `日均 ${fmtMoney(data?.avgDailyProfit || 0)}`, accent: "#34C759" },
              { title: `预计 ${days} 天支出`, value: fmtMoney(data?.projectedCost || 0), subtitle: `日均 ${fmtMoney(data?.avgDailyCost || 0)}`, accent: "#FF9500" },
              {
                title: "预计期末余额",
                value: fmtMoney(data?.projectedBalance || 0),
                subtitle: `风险等级：${riskConf.label}`,
                accent: riskConf.color,
                icon: <RiskIcon className="size-4" />,
              },
              {
                title: "现金流风险",
                value: riskConf.label,
                subtitle: risk === "safe" ? "现金流充足" : risk === "warning" ? "需关注支出" : "存在资金缺口",
                accent: riskConf.color,
              },
            ]} />

            <SectionCard
              title={`${days} 天现金流预测趋势`}
              subtitle="销售额 / 净利润 / 累计余额"
              action={
                <Button size="sm" onClick={handleAiAnalyze} disabled={aiLoading}>
                  {aiLoading ? <><Loader2 className="size-4 mr-1 animate-spin" /> 分析中</> : <><Sparkles className="size-4 mr-1" /> AI 分析</>}
                </Button>
              }
            >
              {aiLoading ? (
                <div className="py-10 text-center">
                  <Loader2 className="size-7 mx-auto animate-spin text-[#0071E3] mb-2" />
                  <p className="text-sm text-muted-foreground">GLM-4 正在分析现金流...</p>
                </div>
              ) : aiResult ? (
                <div className="prose prose-sm max-w-none mb-4 p-4 bg-[#F0F7FF] rounded-lg border border-[#0071E3]/20">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-2">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-sm font-semibold mt-3 mb-1.5">{children}</h2>,
                      p: ({ children }) => <p className="text-sm leading-6 my-1.5">{children}</p>,
                      ul: ({ children }) => <ul className="text-sm my-1.5 list-disc pl-5 space-y-0.5">{children}</ul>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    }}
                  >
                    {aiResult}
                  </ReactMarkdown>
                </div>
              ) : null}
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" />
                    <XAxis dataKey="date" stroke="#6E6E73" fontSize={11} tickLine={false} interval={days > 30 ? Math.floor(days / 15) : 0} />
                    <YAxis stroke="#6E6E73" fontSize={11} tickLine={false} axisLine={false}
                      tickFormatter={(v) => Math.abs(v) >= 10000 ? `${(v / 10000).toFixed(1)}万` : String(v)} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => `¥${v.toLocaleString()}`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="sales" name="销售" stroke="#0071E3" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="profit" name="利润" stroke="#34C759" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="balance" name="累计余额" stroke="#FF9500" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </TabsContent>
        ))}

        <TabsContent value="simulate" className="space-y-4">
          <SectionCard title="AI 经营情景模拟" subtitle="选择假设情景，AI 模拟对销售/利润的影响">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">选择情景假设</label>
                <Select value={scenario} onValueChange={setScenario}>
                  <SelectTrigger className="w-full sm:w-[400px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCENARIOS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={handleSimulate} disabled={simLoading}>
                {simLoading ? <><Loader2 className="size-4 mr-1 animate-spin" /> 模拟中...</> : <><Sparkles className="size-4 mr-1" /> 开始模拟</>}
              </Button>
            </div>
          </SectionCard>

          {simLoading ? (
            <SectionCard>
              <div className="py-12 text-center">
                <Loader2 className="size-8 mx-auto animate-spin text-[#0071E3] mb-3" />
                <p className="text-sm text-muted-foreground">GLM-4 正在进行情景模拟分析...</p>
              </div>
            </SectionCard>
          ) : simResult ? (
            <SectionCard title={`模拟结果：${scenario}`} subtitle="AI 基于当前数据推演">
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-base font-semibold mt-4 mb-2">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1.5">{children}</h3>,
                    p: ({ children }) => <p className="text-sm leading-6 my-2">{children}</p>,
                    ul: ({ children }) => <ul className="text-sm my-2 list-disc pl-5 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="text-sm my-2 list-decimal pl-5 space-y-1">{children}</ol>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    blockquote: ({ children }) => <blockquote className="border-l-2 border-[#FF9500] pl-3 my-2 text-muted-foreground italic">{children}</blockquote>,
                  }}
                >
                  {simResult}
                </ReactMarkdown>
              </div>
            </SectionCard>
          ) : (
            <SectionCard>
              <div className="py-12 text-center">
                <Badge variant="secondary" style={{ background: "#F0F7FF", color: "#0071E3", border: "none" }} className="mb-3">
                  <Sparkles className="size-3 mr-1" /> GLM-4 模拟器
                </Badge>
                <p className="text-sm text-muted-foreground">选择情景并点击「开始模拟」</p>
              </div>
            </SectionCard>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
