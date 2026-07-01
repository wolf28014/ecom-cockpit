"use client";

import { useState } from "react";
import { Database, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * 全局立即备份按钮
 * 浮动在右下角，任何页面都能快速备份
 */
export function QuickBackupButton() {
  const [loading, setLoading] = useState(false);

  const handleBackup = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "manual" }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        toast.success("备份成功", {
          description: `${new Date().toLocaleString("zh-CN")}`,
          duration: 3000,
        });
      } else {
        toast.error("备份失败", { description: data.note || "未知错误" });
      }
    } catch (e) {
      toast.error("备份失败：网络错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleBackup}
      disabled={loading}
      className={cn(
        "fixed bottom-6 right-6 z-40 size-12 rounded-full shadow-lg",
        "bg-gradient-to-br from-[#0071E3] to-[#0058B0] text-white",
        "flex items-center justify-center",
        "hover:shadow-xl hover:scale-105 transition-all",
        "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
      )}
      title="立即备份"
    >
      {loading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <Database className="size-5" />
      )}
    </button>
  );
}
