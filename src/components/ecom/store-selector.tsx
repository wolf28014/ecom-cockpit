"use client";

import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Store {
  id: string;
  name: string;
  platform: string;
}

export function useStores() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stores")
      .then(r => r.json())
      .then(data => {
        setStores(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return { stores, loading };
}

export function StoreSelector({
  value,
  onChange,
  allowAll = true,
}: {
  value: string;
  onChange: (v: string) => void;
  allowAll?: boolean;
}) {
  const { stores, loading } = useStores();

  return (
    <Select value={value} onValueChange={onChange} disabled={loading}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="选择店铺" />
      </SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value="all">全店铺汇总</SelectItem>}
        {stores.map(s => (
          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function RefreshButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <Button variant="outline" onClick={onClick} disabled={loading} size="sm">
      {loading ? "刷新中..." : "刷新"}
    </Button>
  );
}
