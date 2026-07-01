/**
 * 前端 AI 服务 - 直接调用 GLM API
 * 用户在系统设置中填入 API Key，前端直接请求，无需服务端中转
 * 速度更快（无 CLI 启动开销），但 API Key 存在浏览器 localStorage
 *
 * 支持的 AI 提供商（通过 Base URL 自定义）：
 * - 智谱 GLM（默认）：https://open.bigmodel.cn/api/paas/v4/chat/completions
 * - OpenAI：https://api.openai.com/v1/chat/completions
 * - DeepSeek：https://api.deepseek.com/v1/chat/completions
 * - 月之暗面 Moonshot：https://api.moonshot.cn/v1/chat/completions
 * - 通义千问：https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
 */

const DEFAULT_API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const DEFAULT_MODEL = "glm-4-plus";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * 从 localStorage 读取 API Key
 */
export function getApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("ecom_ai_api_key") || "";
}

/**
 * 从 localStorage 读取 Base URL（可选，默认智谱）
 */
export function getApiBaseUrl(): string {
  if (typeof window === "undefined") return DEFAULT_API_URL;
  return localStorage.getItem("ecom_ai_base_url") || DEFAULT_API_URL;
}

/**
 * 从 localStorage 读取模型名
 */
export function getAiModel(): string {
  if (typeof window === "undefined") return DEFAULT_MODEL;
  return localStorage.getItem("ecom_ai_model") || DEFAULT_MODEL;
}

/**
 * 保存 API Key 到 localStorage
 */
export function saveApiKey(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("ecom_ai_api_key", key);
}

/**
 * 保存 Base URL
 */
export function saveApiBaseUrl(url: string): void {
  if (typeof window === "undefined") return;
  if (url) {
    localStorage.setItem("ecom_ai_base_url", url);
  } else {
    localStorage.removeItem("ecom_ai_base_url");
  }
}

/**
 * 保存模型名
 */
export function saveAiModel(model: string): void {
  if (typeof window === "undefined") return;
  if (model) {
    localStorage.setItem("ecom_ai_model", model);
  } else {
    localStorage.removeItem("ecom_ai_model");
  }
}

/**
 * 调用 AI API（支持智谱/OpenAI/DeepSeek 等兼容接口）
 */
export async function callGLMApi(
  messages: ChatMessage[],
  apiKey?: string,
  model?: string
): Promise<string> {
  const key = apiKey || getApiKey();
  if (!key) {
    throw new Error("未配置 AI API Key，请在「系统设置」中填写");
  }

  const baseUrl = getApiBaseUrl();
  const useModel = model || getAiModel();

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: useModel,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errMsg = `API 调用失败 (${res.status})`;
    try {
      const errJson = JSON.parse(errText);
      errMsg += `: ${errJson.error?.message || errJson.message || errText.slice(0, 150)}`;
    } catch {
      errMsg += `: ${errText.slice(0, 150)}`;
    }
    throw new Error(errMsg);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI 返回空内容");
  }
  return content;
}

/**
 * 简单的聊天（单轮）
 */
export async function chat(systemPrompt: string, userPrompt: string): Promise<string> {
  return callGLMApi([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
}

/**
 * AI 提供商预设
 */
export const AI_PROVIDERS = [
  {
    id: "glm",
    name: "智谱 GLM（推荐）",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    defaultModel: "glm-4-plus",
    models: ["glm-4-plus", "glm-4-air", "glm-4-long", "glm-4-flash"],
    getKeyUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    note: "国内访问快，免费额度多",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1/chat/completions",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    getKeyUrl: "https://platform.deepseek.com/api_keys",
    note: "性价比高，推理能力强",
  },
  {
    id: "moonshot",
    name: "月之暗面 Kimi",
    baseUrl: "https://api.moonshot.cn/v1/chat/completions",
    defaultModel: "moonshot-v1-8k",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
    getKeyUrl: "https://platform.moonshot.cn/console/api-keys",
    note: "长文本处理强",
  },
  {
    id: "openai",
    name: "OpenAI（需代理）",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
    getKeyUrl: "https://platform.openai.com/api-keys",
    note: "需科学上网，国内直连可能超时",
  },
  {
    id: "qwen",
    name: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    defaultModel: "qwen-plus",
    models: ["qwen-plus", "qwen-turbo", "qwen-max"],
    getKeyUrl: "https://dashscope.console.aliyun.com/apiKey",
    note: "阿里云，国内稳定",
  },
] as const;
