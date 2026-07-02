'use client';

import { useState, useEffect } from "react";
import {
  LayoutDashboard, Store, PencilLine, UploadCloud, BarChart3, Bot,
  Target, Package, Settings, Bell, TrendingUp, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoginPage } from "@/components/ecom/login-page";
import { ImportProgress } from "@/components/ecom/import-progress";
import { QuickBackupButton } from "@/components/ecom/quick-backup";
import { clearCacheByPrefix } from "@/lib/cache";

import { DashboardPage } from "@/components/ecom/pages/dashboard";
import { StoresPage } from "@/components/ecom/pages/stores";
import { DataEntryPage } from "@/components/ecom/pages/data-entry";
import { DataImportPage } from "@/components/ecom/pages/data-import";
import { AnalyticsPage } from "@/components/ecom/pages/analytics";
import { ProfitCenterPage } from "@/components/ecom/pages/profit-center";
import { SkuPage } from "@/components/ecom/pages/sku";
import { AiCenterPage } from "@/components/ecom/pages/ai-center";
import { SettingsPage } from "@/components/ecom/pages/settings";

type PageKey =
  | "dashboard" | "stores" | "data-entry" | "data-import" | "analytics"
  | "profit-center" | "sku" | "ai-center" | "settings";

interface NavItem {
  key: PageKey;
  label: string;
  icon: any;
  group: "main" | "data" | "analysis" | "ai" | "system";
}

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "首页驾驶舱", icon: LayoutDashboard, group: "main" },
  { key: "stores", label: "店铺管理", icon: Store, group: "main" },
  { key: "data-entry", label: "数据录入", icon: PencilLine, group: "data" },
  { key: "data-import", label: "Excel 导入", icon: UploadCloud, group: "data" },
  { key: "analytics", label: "经营分析", icon: BarChart3, group: "analysis" },
  { key: "profit-center", label: "利润中心", icon: Target, group: "analysis" },
  { key: "sku", label: "SKU 分析", icon: Package, group: "analysis" },
  { key: "ai-center", label: "AI 经营中心", icon: Bot, group: "ai" },
  { key: "settings", label: "系统设置", icon: Settings, group: "system" },
];

const GROUP_LABELS: Record<string, string> = {
  main: "经营",
  data: "数据",
  analysis: "分析",
  ai: "AI 智能",
  system: "系统",
};

const PAGE_TITLES: Record<PageKey, { title: string; subtitle: string }> = {
  dashboard: { title: "首页驾驶舱", subtitle: "实时掌握经营全貌" },
  stores: { title: "多店铺管理", subtitle: "管理你的全平台电商店铺" },
  "data-entry": { title: "数据录入", subtitle: "每日数据 + 月度成本" },
  "data-import": { title: "Excel 导入", subtitle: "批量导入每日数据 + 聚水潭SKU" },
  analytics: { title: "经营分析", subtitle: "日 / 月 / 自然年 / 季节年" },
  "profit-center": { title: "利润中心", subtitle: "利润计算 · 利润目标 · 现金流预测" },
  "ai-center": { title: "AI 经营中心", subtitle: "GLM-4 智能分析与建议" },
  sku: { title: "SKU 分析", subtitle: "爆款/利润/滞销/高退款" },
  settings: { title: "系统设置", subtitle: "AI 配置 / 预警阈值 / 备份" },
};

export default function Home() {
  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 检查登录状态
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => {
        if (d.user) {
          setUser(d.user);
        }
        setAuthLoading(false);
      })
      .catch(() => setAuthLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    clearCacheByPrefix("ecom:");
    location.reload();
  };

  const handleLoginSuccess = () => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => {
        if (d.user) {
          setUser(d.user);
          clearCacheByPrefix("ecom:");
        }
      });
  };

  // 加载中
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
        <div className="text-center">
          <div className="size-12 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#0071E3] to-[#34C759] flex items-center justify-center text-white text-xl font-bold animate-pulse">
            📊
          </div>
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  // 未登录：显示登录页
  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return <AppContent user={user} onLogout={handleLogout} activePage={activePage} setActivePage={setActivePage} unreadAlerts={unreadAlerts} setUnreadAlerts={setUnreadAlerts} />;
}

function AppContent({
  user, onLogout, activePage, setActivePage, unreadAlerts, setUnreadAlerts,
}: {
  user: any;
  onLogout: () => void;
  activePage: PageKey;
  setActivePage: (p: PageKey) => void;
  unreadAlerts: number;
  setUnreadAlerts: (n: number) => void;
}) {
  const [showAlerts, setShowAlerts] = useState(false);
  const [alertsList, setAlertsList] = useState<any[]>([]);

  useEffect(() => {
    const loadAlerts = () => {
      fetch("/api/alerts?unread=true&limit=100")
        .then(r => r.json())
        .then(d => { setUnreadAlerts(Array.isArray(d) ? d.length : 0); })
        .catch(() => {});
    };
    loadAlerts();
    const timer = setInterval(loadAlerts, 30000);
    return () => clearInterval(timer);
  }, []);

  const openAlerts = () => {
    fetch("/api/alerts?limit=50")
      .then(r => r.json())
      .then(d => {
        setAlertsList(Array.isArray(d) ? d : []);
        setShowAlerts(true);
      })
      .catch(() => {});
  };

  const markAllRead = () => {
    fetch("/api/alerts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).then(() => {
      setUnreadAlerts(0);
      setShowAlerts(false);
    });
  };

  const renderPage = () => {
    return (
      <>
        <div style={{ display: activePage === "dashboard" ? "block" : "none" }}><DashboardPage /></div>
        <div style={{ display: activePage === "stores" ? "block" : "none" }}><StoresPage /></div>
        <div style={{ display: activePage === "data-entry" ? "block" : "none" }}><DataEntryPage /></div>
        <div style={{ display: activePage === "data-import" ? "block" : "none" }}><DataImportPage /></div>
        <div style={{ display: activePage === "analytics" ? "block" : "none" }}><AnalyticsPage /></div>
        <div style={{ display: activePage === "profit-center" ? "block" : "none" }}><ProfitCenterPage /></div>
        <div style={{ display: activePage === "sku" ? "block" : "none" }}><SkuPage /></div>
        <div style={{ display: activePage === "ai-center" ? "block" : "none" }}><AiCenterPage /></div>
        <div style={{ display: activePage === "settings" ? "block" : "none" }}><SettingsPage /></div>
      </>
    );
  };

  const grouped = NAV_ITEMS.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

  const groupOrder = ["main", "data", "analysis", "ai", "system"];

  return (
    <div className="flex min-h-screen bg-[#F5F5F7]">
      {/* PC 侧边栏 — 仅 lg 以上显示 */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-[#E5E5EA] flex-col z-40">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#E5E5EA]">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-gradient-to-br from-[#0071E3] to-[#34C759] flex items-center justify-center text-white shadow-sm">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-[#1D1D1F] leading-tight">电商驾驶舱</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">Pro · v1.0</p>
            </div>
          </div>
          {/* 用户信息 */}
          <div className="mt-3 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#F5F5F7]">
            <div className="size-6 rounded-full bg-[#0071E3] flex items-center justify-center text-white text-xs font-bold">
              {user.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user.name || user.email}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
            </div>
            <button
              onClick={onLogout}
              className="text-muted-foreground hover:text-[#FF3B30] p-1"
              title="退出登录"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {groupOrder.map(group => {
            const items = grouped[group];
            if (!items || items.length === 0) return null;
            return (
              <div key={group} className="space-y-1">
                <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {GROUP_LABELS[group]}
                </p>
                {items.map(item => {
                  const Icon = item.icon;
                  const active = activePage === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setActivePage(item.key)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                        active
                          ? "bg-[#0071E3] text-white font-medium shadow-sm"
                          : "text-[#1D1D1F] hover:bg-[#F5F5F7]"
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", active ? "text-white" : "text-muted-foreground")} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Alerts Indicator */}
        <div className="border-t border-[#E5E5EA] p-3">
          <button
            onClick={openAlerts}
            className="flex w-full items-center justify-between rounded-lg bg-[#F5F5F7] hover:bg-[#EBEDEF] px-3 py-2 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className={cn(
                "size-2 rounded-full",
                unreadAlerts > 0 ? "bg-[#FF3B30] animate-pulse" : "bg-[#34C759]"
              )} />
              <span className="text-xs text-muted-foreground">预警中心</span>
            </div>
            <Badge
              variant="secondary"
              style={{
                background: unreadAlerts > 0 ? "#FF3B30" : "#34C759",
                color: "#fff",
                border: "none",
                minWidth: 20,
                justifyContent: "center",
              }}
            >
              {unreadAlerts}
            </Badge>
          </button>
        </div>
      </aside>

      {/* Alerts Dialog */}
      <Dialog open={showAlerts} onOpenChange={setShowAlerts}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="size-5 text-[#FF3B30]" />
              预警中心
            </DialogTitle>
            <DialogDescription>
              共 {alertsList.length} 条预警 · 未读 {unreadAlerts} 条
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[60vh]">
            {alertsList.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="size-12 mx-auto mb-3 opacity-30" />
                <p>暂无预警</p>
              </div>
            )}
            {alertsList.map((a) => {
              const color = a.level === "critical" ? "#FF3B30" : a.level === "warning" ? "#FF9500" : "#0071E3";
              const levelLabel = a.level === "critical" ? "严重" : a.level === "warning" ? "警告" : "信息";
              return (
                <div
                  key={a.id}
                  className="rounded-lg border p-3 hover:bg-[#F5F5F7] transition-colors"
                  style={{ borderLeftWidth: 3, borderLeftColor: color }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                        style={{ background: color }}
                      >
                        {levelLabel}
                      </span>
                      <span className="text-sm font-medium">{a.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.triggeredAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{a.content}</p>
                </div>
              );
            })}
          </div>
          {unreadAlerts > 0 && (
            <div className="border-t pt-3 flex justify-end">
              <Button onClick={markAllRead} size="sm">
                全部标为已读
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Main */}
      <main className="flex-1 lg:ml-60 min-h-screen pb-20 lg:pb-0">
        <div className="max-w-[1400px] mx-auto p-4 lg:p-8">
          {/* 移动端标题 */}
          <div className="lg:hidden mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">{PAGE_TITLES[activePage].title}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{PAGE_TITLES[activePage].subtitle}</p>
            </div>
            <button
              onClick={onLogout}
              className="size-9 rounded-full bg-[#F5F5F7] flex items-center justify-center text-muted-foreground"
              title="退出登录"
            >
              <LogOut className="size-4" />
            </button>
          </div>
          {renderPage()}
        </div>
      </main>

      {/* 移动端底部 Tab 栏 — 仅 lg 以下显示 */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-[#E5E5EA] z-40"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-around px-1 py-1">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = activePage === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActivePage(item.key)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors min-w-[44px] min-h-[44px]",
                  active ? "text-[#0071E3]" : "text-muted-foreground"
                )}
              >
                <Icon className="size-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* 全局导入进度浮窗 - 任何页面都可见 */}
      <ImportProgress />

      {/* 全局立即备份按钮 - 仅 PC 端 */}
      <div className="hidden lg:block">
        <QuickBackupButton />
      </div>
    </div>
  );
}
