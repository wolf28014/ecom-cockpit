"use client";

import { useState, useEffect, useRef } from "react";
import { SectionCard } from "@/components/ecom/kpi";
import { StoreSelector } from "@/components/ecom/store-selector";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2, FileText, Bot, User, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { getApiKey, callGLMApi } from "@/lib/ai-client";

const REPORT_TABS = [
  { key: "daily", label: "AI 经营日报", icon: "📊" },
  { key: "weekly", label: "AI 经营周报", icon: "📈" },
  { key: "monthly", label: "AI 经营月报", icon: "📅" },
  { key: "suggestion", label: "AI 经营建议", icon: "💡" },
];

const QUICK_QUESTIONS = [
  "为什么利润下降？",
  "为什么订单上涨但利润下降？",
  "本月哪些产品最赚钱？",
  "应该增加广告预算吗？",
  "退款率为什么变高？",
];

// 构造报告 prompt（前端直调模式用）
function buildReportPrompt(reportType: string, data: any): string {
  const today = data.today || {};
  const week = data.week || {};
  const month = data.month || {};
  const natCum = data.naturalCumulative || {};
  const progress = data.progress || {};

  const progressStr = Object.entries(progress).map(([k, v]: any) =>
    `${k}: 目标¥${v.target?.toLocaleString()} 已完成¥${Math.round(v.actual || 0).toLocaleString()} (${(v.rate * 100).toFixed(1)}%)`
  ).join("\n");

  const labels: Record<string, string> = {
    daily: "今日经营日报",
    weekly: "本周经营周报",
    monthly: "本月经营月报",
    suggestion: "今日经营建议（销售/推广/定价/库存/风险5维度）",
  };

  return `请生成【${labels[reportType] || reportType}】

今日数据：
- 销售额：¥${today.salesAmount?.toLocaleString() || 0}
- 净销售额：¥${today.netSales?.toLocaleString() || 0}
- 退款：¥${today.refundAmount?.toLocaleString() || 0}（退款率 ${(today.refundRate * 100).toFixed(1)}%）
- 订单：${today.orderCount || 0} 单 / 访客 ${today.visitors || 0} 人
- 推广费：¥${today.promotionTotal?.toLocaleString() || 0}（占比 ${(today.promotionRate * 100).toFixed(1)}%）
- 投产比：${today.roi?.toFixed(2) || 0}
- 转化率：${(today.conversionRate * 100).toFixed(2)}%

本周：销售额¥${week.salesAmount?.toLocaleString() || 0} 净销售¥${week.netSales?.toLocaleString() || 0}
本月：销售额¥${month.salesAmount?.toLocaleString() || 0} 净销售¥${month.netSales?.toLocaleString() || 0}

自然年累积：
- 累积销售额：¥${natCum.cumulativeSales?.toLocaleString() || 0}
- 累积净销售额：¥${natCum.cumulativeNetSales?.toLocaleString() || 0}
- 累积推广费：¥${natCum.cumulativePromotion?.toLocaleString() || 0}
- 累积净推广费率：${(natCum.cumulativeNetPromotionRate * 100).toFixed(1)}%
- 同比去年：${(natCum.yoyGrowth * 100).toFixed(1)}%

利润目标进度：
${progressStr || "暂未设置"}

请用 Markdown 输出，包含核心数据回顾、趋势分析、异常诊断、行动建议。`;
}

// 构造老板助手的数据上下文
function buildDataContext(data: any): string {
  const today = data.today || {};
  const week = data.week || {};
  const month = data.month || {};
  const natCum = data.naturalCumulative || {};
  return `今日数据：
- 销售额：¥${today.salesAmount?.toLocaleString() || 0}
- 净销售额：¥${today.netSales?.toLocaleString() || 0}
- 退款：¥${today.refundAmount?.toLocaleString() || 0}（退款率 ${(today.refundRate * 100).toFixed(1)}%）
- 订单：${today.orderCount || 0} 单 / 访客 ${today.visitors || 0} 人
- 推广费：¥${today.promotionTotal?.toLocaleString() || 0}（占比 ${(today.promotionRate * 100).toFixed(1)}%）
- 投产比：${today.roi?.toFixed(2) || 0}
- 转化率：${(today.conversionRate * 100).toFixed(2)}%

本周：销售额¥${week.salesAmount?.toLocaleString() || 0} 净销售¥${week.netSales?.toLocaleString() || 0}
本月：销售额¥${month.salesAmount?.toLocaleString() || 0} 净销售¥${month.netSales?.toLocaleString() || 0}
自然年累积：销售额¥${natCum.cumulativeSales?.toLocaleString() || 0} 净销售¥${natCum.cumulativeNetSales?.toLocaleString() || 0}`;
}

interface ChatMsg { role: string; content: string; }

function ReportPanel({ storeId, reportType, label }: { storeId: string; reportType: string; label: string }) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadLatest = async () => {
    setLoading(true);
    try {
      const sid = storeId === "all" ? "" : `&storeId=${storeId}`;
      const r = await fetch(`/api/ai/report?type=${reportType}${sid}&limit=1`);
      const arr = await r.json();
      setReport(arr && arr.length > 0 ? arr[0] : null);
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLatest(); }, [storeId, reportType]);

  const handleGenerate = async () => {
    setGenerating(true);
    const apiKey = getApiKey();

    try {
      if (apiKey) {
        // 模式 A：前端直接调 GLM API（快）
        // 1. 先获取经营数据
        const sid = storeId === "all" ? "" : `&storeId=${storeId}`;
        const dashRes = await fetch(`/api/dashboard?days=30${sid}`);
        const dashData = await dashRes.json();

        // 2. 构造 prompt
        const today = dashData.today;
        const prompt = buildReportPrompt(reportType, dashData);

        const systemPrompt = "你是电商经营分析师，用 Markdown 输出经营报告，包含核心数据回顾、趋势分析、异常诊断、行动建议。涉及金额用人民币¥保留2位小数。";

        // 3. 前端直调 GLM API
        const content = await callGLMApi([
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ], apiKey);

        // 4. 保存到数据库
        const saveRes = await fetch("/api/ai/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId: storeId === "all" ? null : storeId,
            reportType,
            content, // 直接传内容，API 应跳过生成只保存
            directSave: true,
          }),
        });
        if (saveRes.ok) {
          const data = await saveRes.json();
          setReport(data);
        } else {
          // 保存失败也显示内容
          setReport({ content, title: `AI ${label} - ${new Date().toISOString().slice(0,10)}`, createdAt: new Date().toISOString() });
        }
        toast.success(`${label}已生成（快速模式）`);
      } else {
        // 模式 B：服务端生成（兼容旧逻辑，需 z-ai CLI）
        const r = await fetch("/api/ai/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeId: storeId === "all" ? null : storeId, reportType }),
        });
        if (!r.ok) throw new Error();
        const data = await r.json();
        setReport(data);
        toast.success(`${label}已生成`);
      }
    } catch (e: any) {
      toast.error("生成失败", { description: e.message?.slice(0, 100) });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" style={{ background: "#F0F7FF", color: "#0071E3", border: "none" }}>
            <Sparkles className="size-3 mr-1" /> GLM-4
          </Badge>
          {report && (
            <span className="text-xs text-muted-foreground">
              生成于 {new Date(report.createdAt).toLocaleString("zh-CN")}
            </span>
          )}
        </div>
        <Button size="sm" onClick={handleGenerate} disabled={generating}>
          {generating ? <><Loader2 className="size-4 mr-1 animate-spin" /> GLM-4 生成中...</> : <><Sparkles className="size-4 mr-1" /> 生成{label}</>}
        </Button>
      </div>

      {generating ? (
        <SectionCard>
          <div className="py-16 text-center">
            <Loader2 className="size-8 mx-auto animate-spin text-[#0071E3] mb-3" />
            <p className="text-sm text-muted-foreground">GLM-4 正在生成报告，请稍候 10-30 秒...</p>
          </div>
        </SectionCard>
      ) : loading ? (
        <SectionCard>
          <div className="py-16 text-center">
            <Loader2 className="size-8 mx-auto animate-spin text-muted-foreground" />
          </div>
        </SectionCard>
      ) : report ? (
        <SectionCard title={report.title} subtitle={report.summary}>
          <div className="prose prose-sm max-w-none text-foreground">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2 text-foreground">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-semibold mt-4 mb-2 text-foreground">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1.5 text-foreground">{children}</h3>,
                p: ({ children }) => <p className="text-sm leading-6 my-2 text-foreground/90">{children}</p>,
                ul: ({ children }) => <ul className="text-sm my-2 list-disc pl-5 space-y-1 text-foreground/90">{children}</ul>,
                ol: ({ children }) => <ol className="text-sm my-2 list-decimal pl-5 space-y-1 text-foreground/90">{children}</ol>,
                li: ({ children }) => <li className="text-foreground/90">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                blockquote: ({ children }) => <blockquote className="border-l-2 border-[#0071E3] pl-3 my-2 text-muted-foreground italic">{children}</blockquote>,
                code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                table: ({ children }) => <table className="w-full text-xs border-collapse my-2">{children}</table>,
                th: ({ children }) => <th className="border border-border bg-muted p-2 text-left font-semibold">{children}</th>,
                td: ({ children }) => <td className="border border-border p-2">{children}</td>,
              }}
            >
              {report.content}
            </ReactMarkdown>
          </div>
        </SectionCard>
      ) : (
        <SectionCard>
          <div className="py-16 text-center">
            <FileText className="size-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">暂无{label}，点击上方按钮生成</p>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function ChatPanel({ storeId }: { storeId: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const sid = storeId === "all" ? "" : `&storeId=${storeId}`;
      const r = await fetch(`/api/ai/chat?${sid.slice(1)}&limit=30`);
      const arr = await r.json();
      setMessages(arr || []);
    } catch {
      setMessages([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => { loadHistory(); }, [storeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: q }]);
    setLoading(true);
    const apiKey = getApiKey();
    try {
      if (apiKey) {
        // 快速模式：前端直调 GLM API
        // 获取经营数据上下文
        const sid = storeId === "all" ? "" : `&storeId=${storeId}`;
        const dashRes = await fetch(`/api/dashboard?days=30${sid}`);
        const dashData = await dashRes.json();
        const context = buildDataContext(dashData);
        const systemPrompt = `你是电商经营驾驶舱的 AI 老板助手。基于以下经营数据回答问题，用大白话，给可执行建议。\n\n${context}`;
        const answer = await callGLMApi([
          { role: "system", content: systemPrompt },
          { role: "user", content: q },
        ], apiKey);
        setMessages(prev => [...prev, { role: "assistant", content: answer }]);
      } else {
        // 兼容模式：服务端 z-ai CLI
        const r = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeId: storeId === "all" ? null : storeId, question: q }),
        });
        if (!r.ok) throw new Error();
        const data = await r.json();
        setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
      }
    } catch (e: any) {
      toast.error("请求失败", { description: e.message?.slice(0, 80) });
      setMessages(prev => [...prev, { role: "assistant", content: `抱歉，回答失败：${e.message || "请稍后重试"}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {QUICK_QUESTIONS.map(q => (
          <Button key={q} variant="outline" size="sm" onClick={() => send(q)} disabled={loading}>
            {q}
          </Button>
        ))}
      </div>

      <SectionCard>
        <div className="h-[460px] flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {historyLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <Bot className="size-10 mb-2 opacity-50" />
                <p className="text-sm">AI 老板助手已就绪，问点什么吧</p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" && (
                    <div className="size-7 rounded-full bg-[#F0F7FF] flex items-center justify-center shrink-0">
                      <Bot className="size-4 text-[#0071E3]" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-[#0071E3] text-white"
                      : "bg-muted text-foreground"
                  }`}>
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="leading-6 my-1">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    ) : m.content}
                  </div>
                  {m.role === "user" && (
                    <div className="size-7 rounded-full bg-[#0071E3] flex items-center justify-center shrink-0">
                      <User className="size-4 text-white" />
                    </div>
                  )}
                </div>
              ))
            )}
            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="size-7 rounded-full bg-[#F0F7FF] flex items-center justify-center shrink-0">
                  <Bot className="size-4 text-[#0071E3]" />
                </div>
                <div className="bg-muted rounded-xl px-3 py-2 text-sm">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="border-t pt-3 mt-2 flex gap-2">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="输入你的问题，按 Cmd/Ctrl+Enter 发送..."
              rows={1}
              className="resize-none min-h-[40px] max-h-[120px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <Button onClick={() => send(input)} disabled={loading || !input.trim()} size="icon" className="h-10 w-10">
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

export function AiCenterPage() {
  const [storeId, setStoreId] = useState("all");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI 经营中心</h1>
          <p className="text-sm text-muted-foreground mt-1">基于 GLM-4 大模型，生成深度分析与建议</p>
        </div>
        <StoreSelector value={storeId} onChange={setStoreId} />
      </div>

      <Tabs defaultValue="daily">
        <TabsList className="w-full sm:w-auto flex-wrap h-auto">
          <TabsTrigger value="daily">日报</TabsTrigger>
          <TabsTrigger value="weekly">周报</TabsTrigger>
          <TabsTrigger value="monthly">月报</TabsTrigger>
          <TabsTrigger value="suggestion">经营建议</TabsTrigger>
          <TabsTrigger value="chat">老板助手</TabsTrigger>
        </TabsList>

        {REPORT_TABS.map(t => (
          <TabsContent key={t.key} value={t.key}>
            <ReportPanel storeId={storeId} reportType={t.key} label={t.label} />
          </TabsContent>
        ))}

        <TabsContent value="chat">
          <ChatPanel storeId={storeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
