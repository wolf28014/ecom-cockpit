"use client";

import { useState, useEffect, useRef } from "react";
import { Check, ChevronDown, Store as StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Store {
  id: string;
  name: string;
  platform: string;
}

const PLATFORM_LABEL: Record<string, string> = {
  taobao: "淘宝",
  tmall: "天猫",
  douyin: "抖店",
  pinduoduo: "拼多多",
};

interface StoreMultiSelectProps {
  value: string[];                    // 选中的 storeId 数组
  onChange: (ids: string[]) => void;
  allowAll?: boolean;                 // 是否允许"全店铺"选项
  placeholder?: string;
  className?: string;
}

export function StoreMultiSelect({
  value,
  onChange,
  allowAll = true,
  placeholder = "选择店铺",
  className,
}: StoreMultiSelectProps) {
  const [stores, setStores] = useState<Store[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/stores")
      .then(r => r.json())
      .then(data => setStores(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isAllSelected = value.length === 0 || (allowAll && value.length === stores.length);

  const toggleAll = () => {
    onChange([]); // 空数组表示全选
  };

  const toggleStore = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter(v => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  // 显示文本
  const getDisplayText = () => {
    if (isAllSelected) return "全店铺汇总";
    if (value.length === 1) {
      const s = stores.find(s => s.id === value[0]);
      return s ? s.name : "1 个店铺";
    }
    return `${value.length} 个店铺汇总`;
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(!open)}
        className="w-[220px] justify-between font-normal"
      >
        <span className="flex items-center gap-2 truncate">
          <StoreIcon className="size-3.5 text-muted-foreground" />
          <span className="truncate">{getDisplayText()}</span>
        </span>
        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-[260px] bg-white rounded-lg border border-border shadow-lg max-h-[320px] overflow-y-auto">
          {allowAll && (
            <label className="flex items-center gap-2 px-3 py-2 hover:bg-[#F5F5F7] cursor-pointer border-b border-border/50">
              <div className={cn(
                "size-4 rounded border flex items-center justify-center",
                isAllSelected ? "bg-[#0071E3] border-[#0071E3]" : "border-input"
              )}>
                {isAllSelected && <Check className="size-3 text-white" />}
              </div>
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={toggleAll}
                className="sr-only"
              />
              <span className="text-sm font-medium">全店铺汇总</span>
              <span className="ml-auto text-xs text-muted-foreground">{stores.length} 个</span>
            </label>
          )}
          {stores.map(s => (
            <label
              key={s.id}
              className="flex items-center gap-2 px-3 py-2 hover:bg-[#F5F5F7] cursor-pointer"
            >
              <div className={cn(
                "size-4 rounded border flex items-center justify-center",
                value.includes(s.id) ? "bg-[#0071E3] border-[#0071E3]" : "border-input"
              )}>
                {value.includes(s.id) && <Check className="size-3 text-white" />}
              </div>
              <input
                type="checkbox"
                checked={value.includes(s.id)}
                onChange={() => toggleStore(s.id)}
                className="sr-only"
              />
              <span className="text-sm">{s.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {PLATFORM_LABEL[s.platform] || s.platform}
              </span>
            </label>
          ))}
          {stores.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              暂无店铺
            </div>
          )}
        </div>
      )}
    </div>
  );
}
