"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function LoginPage({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("请填写邮箱和密码");
      return;
    }
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login"
        ? { email, password }
        : { email, password, name };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        toast.success(mode === "login" ? "登录成功" : "注册成功");
        onLoginSuccess();
      } else {
        toast.error(data.error || "操作失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] p-4">
      <Card className="w-full max-w-md shadow-xl border-border/60">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 size-14 rounded-2xl bg-gradient-to-br from-[#0071E3] to-[#34C759] flex items-center justify-center text-white text-2xl font-bold">
            📊
          </div>
          <CardTitle className="text-2xl">电商经营驾驶舱 Pro</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login" ? "登录您的账号" : "创建新账号"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label className="text-xs">昵称（可选）</Label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="您的昵称"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">邮箱</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">密码</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading && <Loader2 className="size-4 mr-2 animate-spin" />}
              {mode === "login" ? "登录" : "注册"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            {mode === "login" ? (
              <p className="text-muted-foreground">
                还没有账号？{" "}
                <button
                  onClick={() => setMode("register")}
                  className="text-[#0071E3] font-medium hover:underline"
                >
                  立即注册
                </button>
              </p>
            ) : (
              <p className="text-muted-foreground">
                已有账号？{" "}
                <button
                  onClick={() => setMode("login")}
                  className="text-[#0071E3] font-medium hover:underline"
                >
                  返回登录
                </button>
              </p>
            )}
          </div>

          <div className="mt-6 p-3 rounded-lg bg-[#F0F7FF] border border-[#0071E3]/20">
            <p className="text-xs text-[#0071E3] font-medium mb-1">💡 演示账号</p>
            <p className="text-xs text-muted-foreground">
              邮箱：demo@ecom.com<br />
              密码：demo123
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
