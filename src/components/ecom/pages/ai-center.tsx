"use client";

import { useState, useEffect, useRef } from "react";
import { SectionCard } from "@/components/ecom/kpi";
import { StoreSelector } from "@/components/ecom/store-selector";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2, FileText, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

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
    try {
      const r = await fetch("/api/ai/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: storeId === "all" ? null : storeId, reportType }),
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setReport(data);
      toast.success(`${label}已生成`);
    } catch {
      toast.error("生成失败，请稍后重试");
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
    try {
      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: storeId === "all" ? null : storeId, question: q }),
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
    } catch {
      toast.error("请求失败");
      setMessages(prev => [...prev, { role: "assistant", content: "抱歉，回答失败，请稍后重试。" }]);
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
