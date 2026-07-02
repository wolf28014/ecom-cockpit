"use client";

import { useState, useEffect } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type DateRange = { start: string; end: string };

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

const PRESETS: { label: string; days: number }[] = [
  { label: "近 7 天", days: 7 },
  { label: "近 30 天", days: 30 },
  { label: "近 90 天", days: 90 },
  { label: "近 1 年", days: 365 },
];

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-range-picker]")) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    onChange({ start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
    setOpen(false);
  };

  const applyCustom = () => {
    onChange({ ...value });
    setOpen(false);
  };

  const displayText = () => {
    return `${value.start} ~ ${value.end}`;
  };

  return (
    <div data-range-picker className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(!open)}
        className="justify-start font-normal"
      >
        <Calendar className="size-3.5 text-muted-foreground mr-1" />
        <span className="text-xs">{displayText()}</span>
        <ChevronDown className={cn("size-3.5 ml-auto text-muted-foreground transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <div className="absolute top-full mt-1 right-0 z-50 w-64 bg-white rounded-lg border border-border shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border/50">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">快捷选择</p>
            <div className="grid grid-cols-2 gap-1">
              {PRESETS.map(p => (
                <button
                  key={p.days}
                  onClick={() => applyPreset(p.days)}
                  className="px-2 py-1.5 text-xs rounded hover:bg-[#F5F5F7] transition-colors text-left"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="p-2 border-b border-border/50">
            <button
              onClick={() => setCustomMode(!customMode)}
              className="w-full px-2 py-1.5 text-xs text-left text-[#0071E3] font-medium"
            >
              {customMode ? "收起自定义" : "自定义范围 ▾"}
            </button>
            {customMode && (
              <div className="space-y-2 mt-2 px-1">
                <div>
                  <label className="text-[10px] text-muted-foreground">开始日期</label>
                  <Input
                    type="date"
                    value={value.start}
                    max={value.end}
                    onChange={e => onChange({ ...value, start: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">结束日期</label>
                  <Input
                    type="date"
                    value={value.end}
                    max={today}
                    onChange={e => onChange({ ...value, end: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <Button size="sm" className="w-full h-7 text-xs" onClick={applyCustom}>
                  应用
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
