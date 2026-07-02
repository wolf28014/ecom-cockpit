"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: number; // -1 to 1
  trendLabel?: string;
  accent?: string; // hex color
  icon?: React.ReactNode;
}

export function KpiCard({ title, value, subtitle, trend, trendLabel = "环比", accent = "#1D1D1F", icon }: KpiCardProps) {
  return (
    <Card className="overflow-hidden border-border/60 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          {icon && <div className="text-muted-foreground/60">{icon}</div>}
        </div>
        <p className="text-3xl font-bold tracking-tight" style={{ color: accent }}>
          {value}
        </p>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-muted-foreground">{subtitle}</p>
          {trend !== undefined && trend !== 0 && (
            <span
              className={cn(
                "text-xs font-semibold flex items-center gap-0.5",
                trend > 0 ? "text-[#34C759]" : "text-[#FF3B30]"
              )}
            >
              {trend > 0 ? "▲" : "▼"} {trendLabel} {trend > 0 ? "+" : ""}{(trend * 100).toFixed(1)}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface KpiRowProps {
  cards: KpiCardProps[];
}

export function KpiRow({ cards }: KpiRowProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {cards.map((c, i) => (
        <KpiCard key={i} {...c} />
      ))}
    </div>
  );
}

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function SectionCard({ title, subtitle, children, className, action }: SectionCardProps) {
  return (
    <Card className={cn("border-border/60 shadow-sm", className)}>
      {(title || action) && (
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              {title && <CardTitle className="text-base font-semibold">{title}</CardTitle>}
              {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            </div>
            {action}
          </div>
        </CardHeader>
      )}
      <CardContent className={title ? "pt-0" : "p-6"}>{children}</CardContent>
    </Card>
  );
}
