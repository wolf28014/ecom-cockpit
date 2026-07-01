"use client";

import { useState, useEffect } from "react";
import { SectionCard } from "@/components/ecom/kpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Bot, Clock, Building2, AlertTriangle, Save, Loader2, CheckCircle2, Key, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { getApiKey, saveApiKey, getApiBaseUrl, saveApiBaseUrl, getAiModel, saveAiModel, AI_PROVIDERS } from "@/lib/ai-client";

export function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [apiKey, setApiKey] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("glm");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = () => {
    setLoading(true);
    fetch("/api/settings")
      .then(r => r.json())
      .then(d => {
        setSettings({
          aiModel: d.aiModel || "glm-4-plus",
          aiTimeout: d.aiTimeout || "60",
          companyName: d.companyName || "我的电商公司",
          currency: d.currency || "¥",
          salesDeclineDays: d.salesDeclineDays || "3",
          profitDeclinePct: d.profitDeclinePct || "15",
          promotionRoiMin: d.promotionRoiMin || "1.5",
          refundRateMax: d.refundRateMax || "8",
          promotionRateMax: d.promotionRateMax || "25",
        });
        setApiKey(getApiKey());
        setApiBaseUrl(getApiBaseUrl());
        setAiModel(getAiModel());
        // 检测当前是哪个提供商
        const currentUrl = getApiBaseUrl();
        const provider = AI_PROVIDERS.find(p => p.baseUrl === currentUrl);
        setSelectedProvider(provider?.id || "custom");
        setLoading(false);
      })
      .catch(() => { toast.error("加载设置失败"); setLoading(false); });
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      saveApiKey(apiKey);
      saveApiBaseUrl(apiBaseUrl);
      saveAiModel(aiModel);
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      toast.success("设置已保存", {
        description: apiKey ? `AI 快速模式已启用（${aiModel || '默认模型'}）` : "AI 将使用服务端模式",
      });
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  // 选择 AI 提供商时自动填充 Base URL 和模型
  const selectProvider = (providerId: string) => {
    setSelectedProvider(providerId);
    if (providerId === "custom") return;
    const provider = AI_PROVIDERS.find(p => p.id === providerId);
    if (provider) {
      setApiBaseUrl(provider.baseUrl);
      setAiModel(provider.defaultModel);
    }
  };

  const update = (k: string, v: string) => setSettings(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">系统设置</h1>
          <p className="text-sm text-muted-foreground mt-1">配置 AI 模型、公司信息与预警阈值</p>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving || loading}>
          {saving ? <><Loader2 className="size-4 mr-1 animate-spin" /> 保存中...</> : <><Save className="size-4 mr-1" /> 保存设置</>}
        </Button>
      </div>

      {loading ? (
        <SectionCard>
          <div className="py-16 text-center"><Loader2 className="size-8 mx-auto animate-spin text-muted-foreground" /></div>
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* AI 配置 */}
          <SectionCard title="AI 模型配置" subtitle="支持智谱/DeepSeek/Kimi/通义千问/OpenAI">
            <div className="space-y-4">
              {/* AI 提供商选择 */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Zap className="size-4" /> AI 服务商</Label>
                <div className="grid grid-cols-2 gap-2">
                  {AI_PROVIDERS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => selectProvider(p.id)}
                      className={`px-3 py-2 text-xs rounded-lg border text-left transition-colors ${
                        selectedProvider === p.id
                          ? "border-[#0071E3] bg-[#F0F7FF] text-[#0071E3] font-medium"
                          : "border-border hover:bg-[#F5F5F7]"
                      }`}
                    >
                      {p.name}
                      <p className="text-[10px] text-muted-foreground mt-0.5">{p.note}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Key className="size-4" /> API Key</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="填写后 AI 调用更快（前端直调）"
                />
                {selectedProvider !== "custom" && (
                  <p className="text-xs text-muted-foreground">
                    获取 Key：<a href={AI_PROVIDERS.find(p => p.id === selectedProvider)?.getKeyUrl} target="_blank" rel="noopener" className="text-[#0071E3] hover:underline">{AI_PROVIDERS.find(p => p.id === selectedProvider)?.getKeyUrl}</a>
                  </p>
                )}
              </div>

              {/* Base URL */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Bot className="size-4" /> API Base URL</Label>
                <Input
                  value={apiBaseUrl}
                  onChange={e => { setApiBaseUrl(e.target.value); setSelectedProvider("custom"); }}
                  placeholder="https://open.bigmodel.cn/api/paas/v4/chat/completions"
                />
                <p className="text-xs text-muted-foreground">选择服务商自动填充，也可自定义</p>
              </div>

              {/* 模型 */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Bot className="size-4" /> 模型名</Label>
                <Input
                  value={aiModel}
                  onChange={e => setAiModel(e.target.value)}
                  placeholder="glm-4-plus"
                />
                {selectedProvider !== "custom" && (
                  <p className="text-xs text-muted-foreground">
                    可选：{AI_PROVIDERS.find(p => p.id === selectedProvider)?.models.join(" / ")}
                  </p>
                )}
              </div>

              {/* 状态指示 */}
              <div className="flex items-center justify-between rounded-lg border p-3 bg-[#E8F8EC]/50">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-[#34C759]" />
                  <div>
                    <p className="text-sm font-medium">AI 服务状态</p>
                    <p className="text-xs text-muted-foreground">
                      {apiKey ? `快速模式（${aiModel || '默认模型'}）` : "兼容模式（服务端 z-ai CLI）"}
                    </p>
                  </div>
                </div>
                <Badge style={{ background: "#34C759", color: "#fff", border: "none" }}>
                  <span className="size-1.5 rounded-full bg-white mr-1 animate-pulse" /> 已就绪
                </Badge>
              </div>
            </div>
          </SectionCard>

          {/* 公司信息 */}
          <SectionCard title="公司信息" subtitle="报表与导出中显示的公司信息">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Building2 className="size-4" /> 公司名称</Label>
                <Input value={settings.companyName || ""} onChange={e => update("companyName", e.target.value)} placeholder="如：XX 电商有限公司" />
              </div>
              <div className="space-y-2">
                <Label>货币单位</Label>
                <Select value={settings.currency || "¥"} onValueChange={v => update("currency", v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="¥">人民币 (¥)</SelectItem>
                    <SelectItem value="$">美元 ($)</SelectItem>
                    <SelectItem value="€">欧元 (€)</SelectItem>
                    <SelectItem value="£">英镑 (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  预览：{settings.companyName || "公司名称"} {settings.currency || "¥"} 12,345
                </p>
              </div>
            </div>
          </SectionCard>

          {/* 预警阈值 */}
          <SectionCard title="预警阈值" subtitle="触发预警的阈值设置" className="lg:col-span-2">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                <AlertTriangle className="size-4 text-[#FF9500]" /> 异常自动检测阈值
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>销售连续下降天数</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={settings.salesDeclineDays || ""} onChange={e => update("salesDeclineDays", e.target.value)} />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">天</span>
                  </div>
                  <p className="text-xs text-muted-foreground">连续下降达此天数将预警</p>
                </div>
                <div className="space-y-2">
                  <Label>利润下降阈值</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={settings.profitDeclinePct || ""} onChange={e => update("profitDeclinePct", e.target.value)} />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">环比下降幅度超过此值将预警</p>
                </div>
                <div className="space-y-2">
                  <Label>推广 ROI 阈值</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" step="0.1" value={settings.promotionRoiMin || ""} onChange={e => update("promotionRoiMin", e.target.value)} />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">≥</span>
                  </div>
                  <p className="text-xs text-muted-foreground">ROI 低于此值将预警</p>
                </div>
                <div className="space-y-2">
                  <Label>退款率阈值</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={settings.refundRateMax || ""} onChange={e => update("refundRateMax", e.target.value)} />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">退款率高于此值将预警</p>
                </div>
                <div className="space-y-2">
                  <Label>推广费率阈值</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={settings.promotionRateMax || ""} onChange={e => update("promotionRateMax", e.target.value)} />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">推广费率高于此值将预警</p>
                </div>
              </div>
              <div className="rounded-lg bg-[#FFF8E8] border border-[#FF9500]/30 p-3 mt-2">
                <p className="text-xs text-[#9A6700]">
                  💡 提示：预警阈值较为保守时建议保持默认值；激进增长期可适当放宽退款率/推广费率阈值以减少噪音。
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      <div className="text-center text-xs text-muted-foreground pt-4">
        电商经营驾驶舱 Pro · v1.0.0 · 基于 Next.js 16 + GLM-4
      </div>
    </div>
  );
}
