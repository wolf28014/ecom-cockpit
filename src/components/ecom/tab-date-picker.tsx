"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type DateMode = "today" | "day" | "week" | "month" | "custom";

interface TabDatePickerProps {
  mode: DateMode;
  onModeChange: (mode: DateMode) => void;
  date: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
  label?: string; // 如 "日分析"、"周分析"
}

const MODE_BUTTONS: { key: DateMode; label: string }[] = [
  { key: "today", label: "实时" },
  { key: "day", label: "日" },
  { key: "week", label: "周" },
  { key: "month", label: "月" },
  { key: "custom", label: "自定义" },
];

/**
 * Tab 级日期选择器
 * 样式参考截图：输入框 + 快捷按钮组（实时/日/周/月/自定义）
 * 点击输入框弹出日历
 */
export function TabDatePicker({ mode, onModeChange, date, onDateChange, label }: TabDatePickerProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部关闭日历
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // 日期变化时更新日历月份
  useEffect(() => {
    const d = new Date(date);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [date]);

  const today = new Date().toISOString().slice(0, 10);
  const todayDate = new Date();

  // 日历渲染
  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = (firstDay.getDay() + 6) % 7; // 周一为首日
  const daysInMonth = lastDay.getDate();

  const weeks: (number | null)[][] = [];
  let currentDay = 1;
  for (let w = 0; w < 6; w++) {
    const week: (number | null)[] = [];
    for (let d = 0; d < 7; d++) {
      if (w === 0 && d < startWeekday) {
        week.push(null);
      } else if (currentDay > daysInMonth) {
        week.push(null);
      } else {
        week.push(currentDay);
        currentDay++;
      }
    }
    weeks.push(week);
  }

  const selectDate = (day: number) => {
    const selected = new Date(year, month, day);
    onDateChange(selected.toISOString().slice(0, 10));
    setShowCalendar(false);
  };

  const isSelected = (day: number) => {
    const d = new Date(year, month, day);
    return d.toISOString().slice(0, 10) === date;
  };

  const isToday = (day: number) => {
    const d = new Date(year, month, day);
    return d.toISOString().slice(0, 10) === today;
  };

  return (
    <div ref={ref} className="relative flex items-center gap-1">
      {label && <span className="text-xs text-muted-foreground mr-1">{label}</span>}
      {/* 日期输入框 */}
      <div className="relative">
        <Input
          type="text"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          onClick={() => setShowCalendar(true)}
          readOnly
          className="h-8 w-[130px] text-xs cursor-pointer pr-8 bg-[#F5F5F7] border-[#E5E5EA]"
        />
        <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
      </div>

      {/* 快捷按钮组 */}
      <div className="flex items-center bg-[#F5F5F7] rounded-lg p-0.5">
        {MODE_BUTTONS.map(btn => (
          <button
            key={btn.key}
            onClick={() => onModeChange(btn.key)}
            className={cn(
              "px-2.5 py-1 text-xs rounded-md transition-colors",
              mode === btn.key
                ? "bg-white text-[#0071E3] font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* 日历弹窗 */}
      {showCalendar && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-white rounded-xl shadow-lg border border-border p-3 w-[280px]">
          {/* 头部导航 */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setCalMonth(new Date(year, month - 1, 1))}
              className="p-1 rounded hover:bg-[#F5F5F7]"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-semibold">{year}年 {month + 1}月</span>
            <button
              onClick={() => setCalMonth(new Date(year, month + 1, 1))}
              className="p-1 rounded hover:bg-[#F5F5F7]"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          {/* 星期标题 */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["一", "二", "三", "四", "五", "六", "日"].map(d => (
              <div key={d} className="text-center text-[10px] text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          {/* 日期网格 */}
          <div className="grid grid-cols-7 gap-1">
            {weeks.flat().map((day, i) => (
              <button
                key={i}
                onClick={() => day && selectDate(day)}
                disabled={!day}
                className={cn(
                  "aspect-square text-xs rounded-lg transition-colors flex items-center justify-center",
                  !day && "invisible",
                  day && isSelected(day) && "bg-[#0071E3] text-white font-medium",
                  day && !isSelected(day) && isToday(day) && "bg-[#F0F7FF] text-[#0071E3]",
                  day && !isSelected(day) && !isToday(day) && "hover:bg-[#F5F5F7] text-foreground"
                )}
              >
                {day}
              </button>
            ))}
          </div>
          {/* 快捷操作 */}
          <div className="flex justify-between mt-3 pt-2 border-t">
            <button
              onClick={() => { onDateChange(today); setShowCalendar(false); }}
              className="text-xs text-[#0071E3] hover:underline"
            >
              今天
            </button>
            <button
              onClick={() => setShowCalendar(false)}
              className="text-xs text-muted-foreground hover:underline"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
