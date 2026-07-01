"use client";

import { useState, useEffect } from "react";
import { importManager, type ImportTask } from "@/lib/import-task";
import { CheckCircle2, Loader2, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 全局导入进度浮窗
 * 显示在页面右上角，任何页面都能看到导入进度
 */
export function ImportProgress() {
  const [tasks, setTasks] = useState<ImportTask[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    return importManager.subscribe(setTasks);
  }, []);

  // 只显示运行中或最近完成的任务（30秒内）
  const visibleTasks = tasks.filter(t => {
    if (t.status === "running") return true;
    if (t.finishedAt && Date.now() - t.finishedAt < 30 * 1000) return true;
    return false;
  });

  if (visibleTasks.length === 0) return null;

  const runningCount = visibleTasks.filter(t => t.status === "running").length;

  return (
    <div className="fixed top-4 right-4 z-50 w-80">
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          className="w-full bg-white rounded-xl shadow-lg border border-border p-3 flex items-center gap-2 hover:shadow-md transition-shadow"
        >
          {runningCount > 0 ? (
            <Loader2 className="size-4 animate-spin text-[#0071E3]" />
          ) : (
            <CheckCircle2 className="size-4 text-[#34C759]" />
          )}
          <span className="text-sm font-medium flex-1 text-left">
            {runningCount > 0 ? `${runningCount} 个导入任务进行中` : "导入完成"}
          </span>
        </button>
      ) : (
        <div className="bg-white rounded-xl shadow-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#F5F5F7] border-b border-border">
            <span className="text-sm font-semibold">导入任务</span>
            <button
              onClick={() => setCollapsed(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {visibleTasks.map(task => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TaskItem({ task }: { task: ImportTask }) {
  const progress = task.total > 0 ? (task.success + task.failed) / task.total : 0;
  const pct = Math.round(progress * 100);

  return (
    <div className="px-4 py-3 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2 mb-1.5">
        {task.status === "running" ? (
          <Loader2 className="size-3.5 animate-spin text-[#0071E3]" />
        ) : task.status === "completed" ? (
          <CheckCircle2 className="size-3.5 text-[#34C759]" />
        ) : (
          <XCircle className="size-3.5 text-[#FF3B30]" />
        )}
        <span className="text-xs font-medium flex-1 truncate">{task.storeName}</span>
        <span className="text-xs text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 bg-[#F5F5F7] rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-300",
            task.status === "failed" ? "bg-[#FF3B30]" : "bg-[#0071E3]"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
        <span>成功 {task.success}</span>
        {task.failed > 0 && <span className="text-[#FF3B30]">失败 {task.failed}</span>}
        <span>共 {task.total}</span>
      </div>
    </div>
  );
}
