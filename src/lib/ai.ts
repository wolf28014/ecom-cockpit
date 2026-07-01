/**
 * AI 服务 - 通过子进程调用 z-ai CLI 调用 GLM-4
 */
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * 调用 GLM-4 完成对话
 */
export async function callGLM4(
  systemPrompt: string,
  userPrompt: string,
  timeoutMs = 60000
): Promise<string> {
  // 写入临时文件作为输出
  const tmpDir = os.tmpdir();
  const outputFile = path.join(tmpDir, `zai-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

  return new Promise((resolve) => {
    const args = ["chat", "-p", userPrompt, "-s", systemPrompt, "-o", outputFile];
    const proc = spawn("z-ai", args, { timeout: timeoutMs });

    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });

    proc.on("close", async (code) => {
      try {
        if (code !== 0) {
          resolve(`[AI 调用失败] ${stderr.slice(0, 500)}`);
          return;
        }
        const raw = await fs.readFile(outputFile, "utf-8");
        const data = JSON.parse(raw);
        const content = data?.choices?.[0]?.message?.content ?? "";
        resolve(content || "[AI 返回空]");
      } catch (e: any) {
        resolve(`[AI 调用异常] ${e?.message ?? String(e)}`);
      } finally {
        try { await fs.unlink(outputFile); } catch {}
      }
    });

    proc.on("error", (e) => {
      resolve(`[AI 启动失败] ${e.message}. 请确保 z-ai CLI 已安装: npm install -g z-ai-web-dev-sdk`);
    });
  });
}

// ============== 系统提示词 ==============
export const SYSTEM_PROMPT_BOSS = `你是电商经营驾驶舱 Pro 的 AI 老板助手，专为中国淘宝/天猫/抖店/拼多多商家设计。

你的职责：
1. 基于真实经营数据回答老板的经营问题
2. 用大白话解释数据背后的原因
3. 给出可执行的经营建议，避免空话套话
4. 涉及金额时用人民币（¥），保留 2 位小数
5. 回答简洁直接，老板时间宝贵

数据背景：
{context}

请始终基于上述数据回答，不要编造数据。如果数据不足，请明确告知。`;

export const SYSTEM_PROMPT_REPORT = `你是电商经营驾驶舱 Pro 的 AI 经营分析师，擅长将枯燥的经营数据转化为有洞察力的经营报告。

报告要求：
1. 用 Markdown 格式输出
2. 包含：核心数据回顾 → 趋势分析 → 异常诊断 → 行动建议 四部分
3. 数据要具体到数字，不要笼统说"有所提升"
4. 建议要可执行，分优先级（立即/本周/本月）
5. 语气专业但不晦涩，老板看得懂
6. 涉及金额用人民币（¥），保留 2 位小数`;
