"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Calendar } from "lucide-react";

/**
 * 年份类型选择器（自然年/季节年 + 年份下拉）
 * 支持选择最近 5 年
 */
export function YearTypeSelector({
  yearType,
  setYearType,
  year,
  setYear,
}: {
  yearType: "natural" | "seasonal";
  setYearType: (v: "natural" | "seasonal") => void;
  year: number;
  setYear: (y: number) => void;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="flex items-center gap-2">
      <ToggleGroup type="single" value={yearType} onValueChange={(v) => v && setYearType(v as "natural" | "seasonal")}>
        <ToggleGroupItem value="natural" className="text-xs">自然年</ToggleGroupItem>
        <ToggleGroupItem value="seasonal" className="text-xs">季节年</ToggleGroupItem>
      </ToggleGroup>
      <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
        <SelectTrigger className="w-[100px] h-8">
          <Calendar className="size-3 mr-1 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map(y => (
            <SelectItem key={y} value={String(y)}>{y}年</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
