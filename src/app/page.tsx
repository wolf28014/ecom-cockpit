'use client';

import { useState, useEffect } from "react";
import {
  LayoutDashboard, Store, PencilLine, UploadCloud, BarChart3, Bot,
  Target, Wallet, Package, FileText, Settings, Database, Bell, TrendingUp, LogOut,
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
import { AiCenterPage } from "@/components/ecom/pages/ai-center";
import { ProfitTargetPage } from "@/components/ecom/pages/profit-target";
import { CashflowPage } from "@/components/ecom/pages/cashflow";
import { SkuPage } from "@/components/ecom/pages/sku";
import { ReportsPage } from "@/components/ecom/pages/reports";
import { SettingsPage } from "@/components/ecom/pages/settings";
import { BackupPage } from "@/components/ecom/pages/backup";

type PageKey =
  | "dashboard" | "stores" | "data-entry" | "data-import" | "analytics"
  | "ai-center" | "profit-target" | "cashflow" | "sku" | "reports"
  | "settings" | "backup";

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
  { key: "sku", label: "SKU 分析", icon: Package, group: "analysis" },
  { key: "profit-target", label: "利润目标", icon: Target, group: "analysis" },
  { key: "cashflow", label: "现金流预测", icon: Wallet, group: "ai" },
  { key: "ai-center", label: "AI 经营中心", icon: Bot, group: "ai" },
  { key: "reports", label: "报表中心", icon: FileText, group: "system" },
  { key: "settings", label: "系统设置", icon: Settings, group: "system" },
  { key: "backup", label: "数据备份", icon: Database, group: "system" },
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
  "data-entry": { title: "每日数据录入", subtitle: "录入销售/推广/成本，自动计算利润" },
  "data-import": { title: "Excel 数据导入", subtitle: "批量导入每日经营数据" },
  analytics: { title: "经营分析中心", subtitle: "日/周/月/年多维度数据分析" },
  "ai-center": { title: "AI 经营中心", subtitle: "基于 GLM-4 大模型，生成深度分析与建议" },
  "profit-target": { title: "利润目标管理", subtitle: "设定目标、跟踪进度、AI 预测完成概率" },
  cashflow: { title: "现金流预测", subtitle: "基于历史数据预测未来现金流" },
  sku: { title: "SKU 利润分析", subtitle: "爆款/利润/滞销/高退款多维度 SKU 分析" },
  reports: { title: "报表中心", subtitle: "汇总数据，导出报表" },
  settings: { title: "系统设置", subtitle: "配置 AI 模型、公司信息与预警阈值" },
  backup: { title: "数据备份", subtitle: "保护数据安全，支持手动/自动备份" },
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
    // 所有页面都渲染，通过 display 控制显隐
    // 这样切换页面时不会卸载组件，保留状态和数据
    return (
      <>
        <div style={{ display: activePage === "dashboard" ? "block" : "none" }}>
          <DashboardPage />
        </div>
        <div style={{ display: activePage === "stores" ? "block" : "none" }}>
          <StoresPage />
        </div>
        <div style={{ display: activePage === "data-entry" ? "block" : "none" }}>
          <DataEntryPage />
        </div>
        <div style={{ display: activePage === "data-import" ? "block" : "none" }}>
          <DataImportPage />
        </div>
        <div style={{ display: activePage === "analytics" ? "block" : "none" }}>
          <AnalyticsPage />
        </div>
        <div style={{ display: activePage === "ai-center" ? "block" : "none" }}>
          <AiCenterPage />
        </div>
        <div style={{ display: activePage === "profit-target" ? "block" : "none" }}>
          <ProfitTargetPage />
        </div>
        <div style={{ display: activePage === "cashflow" ? "block" : "none" }}>
          <CashflowPage />
        </div>
        <div style={{ display: activePage === "sku" ? "block" : "none" }}>
          <SkuPage />
        </div>
        <div style={{ display: activePage === "reports" ? "block" : "none" }}>
          <ReportsPage />
        </div>
        <div style={{ display: activePage === "settings" ? "block" : "none" }}>
          <SettingsPage />
        </div>
        <div style={{ display: activePage === "backup" ? "block" : "none" }}>
          <BackupPage />
        </div>
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
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-[#E5E5EA] flex flex-col z-40">
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
      <main className="flex-1 ml-60 min-h-screen">
        <div className="max-w-[1400px] mx-auto p-6 lg:p-8">
          {/* Breadcrumb / Page title (hidden on dashboard, since pages render their own) */}
          <div className="lg:hidden mb-4">
            <h1 className="text-2xl font-bold tracking-tight">{PAGE_TITLES[activePage].title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{PAGE_TITLES[activePage].subtitle}</p>
          </div>
          {renderPage()}
        </div>
      </main>

      {/* 全局导入进度浮窗 - 任何页面都可见 */}
      <ImportProgress />

      {/* 全局立即备份按钮 */}
      <QuickBackupButton />
    </div>
  );
}
