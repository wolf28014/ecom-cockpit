"use client";

import { useState, useEffect } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KpiItem {
  key: string;
  title: string;
  value: string;
  subtitle?: string;
  color?: string;
  isCumulative?: boolean;
}

/**
 * 可拖拽排序的 KPI 卡片网格
 * 支持拖拽调整顺序，顺序保存到 localStorage
 */
export function DraggableKpiGrid({
  items,
  storageKey,
  columns = 4,
}: {
  items: KpiItem[];
  storageKey: string; // localStorage 键，用于保存排序
  columns?: number;
}) {
  const [orderedItems, setOrderedItems] = useState<KpiItem[]>(items);

  // 从 localStorage 恢复排序
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const savedKeys: string[] = JSON.parse(saved);
        const sorted: KpiItem[] = [];
        const remaining: KpiItem[] = [];
        for (const key of savedKeys) {
          const item = items.find(i => i.key === key);
          if (item) sorted.push(item);
        }
        for (const item of items) {
          if (!savedKeys.includes(item.key)) remaining.push(item);
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOrderedItems([...sorted, ...remaining]);
      } catch {
         
        setOrderedItems(items);
      }
    } else {
       
      setOrderedItems(items);
    }
  }, [items, storageKey]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedItems(items => {
        const oldIndex = items.findIndex(i => i.key === active.id);
        const newIndex = items.findIndex(i => i.key === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        // 保存到 localStorage
        localStorage.setItem(storageKey, JSON.stringify(newOrder.map(i => i.key)));
        return newOrder;
      });
    }
  };

  // Tailwind 无法识别动态拼接的类名，需用静态查找表
  const gridClassMap: Record<number, string> = {
    3: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4",
    4: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
    5: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6",
  };
  const gridCols = gridClassMap[columns] || gridClassMap[4];

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedItems.map(i => i.key)} strategy={rectSortingStrategy}>
        <div className={gridCols}>
          {orderedItems.map(item => (
            <SortableKpiCard key={item.key} item={item} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableKpiCard({ item }: { item: KpiItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-border/60 shadow-sm hover:shadow-md transition-shadow cursor-default",
        item.isCumulative && "bg-[#F0F7FF]/50"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-1">
          <p className="text-xs text-muted-foreground font-medium">{item.title}</p>
          <button
            {...attributes}
            {...listeners}
            className="text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
            title="拖拽排序"
          >
            <GripVertical className="size-3.5" />
          </button>
        </div>
        <p className="text-xl font-bold tracking-tight" style={{ color: item.color || "#1D1D1F" }}>
          {item.value}
        </p>
        {item.subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
