/**
 * 前端 AI 服务 - 直接调用 GLM API
 * 用户在系统设置中填入 API Key，前端直接请求，无需服务端中转
 * 速度更快（无 CLI 启动开销），但 API Key 存在浏览器 localStorage
 */

const AI_API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

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
 * 保存 API Key 到 localStorage
 */
export function saveApiKey(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("ecom_ai_api_key", key);
}

/**
 * 调用 GLM API
 * @param messages 消息列表
 * @param apiKey GLM API Key
 * @param model 模型名（默认 glm-4-plus）
 * @returns AI 回复内容
 */
export async function callGLMApi(
  messages: ChatMessage[],
  apiKey?: string,
  model: string = "glm-4-plus"
): Promise<string> {
  const key = apiKey || getApiKey();
  if (!key) {
    throw new Error("未配置 AI API Key，请在「系统设置」中填写");
  }

  const res = await fetch(AI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API 调用失败 (${res.status}): ${err.slice(0, 200)}`);
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
