"use client";

import { useState, useEffect, useCallback } from "react";
import { getCached, setCached, clearCacheByPrefix } from "@/lib/cache";

/**
 * 带缓存的数据获取 Hook
 *
 * 功能：
 * - 首次加载显示 loading
 * - 再次访问优先用缓存秒显示，后台静默刷新
 * - 支持手动刷新（跳过缓存）
 * - 支持 key 变化自动重新加载
 *
 * @param url 请求 URL
 * @param cacheKey 缓存键（默认等于 url）
 * @param enabled 是否启用（false 时不加载）
 * @returns { data, loading, refresh }
 */
export function useCachedFetch<T = any>(
  url: string | null,
  cacheKey?: string,
  enabled: boolean = true
): { data: T | null; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  const key = cacheKey || `ecom:${url}`;

  const loadData = useCallback((force = false) => {
    if (!url || !enabled) {
      setLoading(false);
      return;
    }

    // 1. 先尝试缓存
    if (!force) {
      const cached = getCached<T>(key);
      if (cached) {
        setData(cached);
        setLoading(false);
        // 后台静默刷新（不显示 loading）
        fetch(url)
          .then(r => r.json())
          .then(d => {
            if (d && !d.error) {
              setData(d);
              setCached(key, d);
            }
          })
          .catch(() => {});
        return;
      }
    }

    // 2. 无缓存或强制刷新：显示 loading 并请求
    setLoading(true);
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d && !d.error) {
          setData(d);
          setCached(key, d);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [url, key, enabled]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const refresh = useCallback(() => {
    clearCacheByPrefix(key);
    loadData(true);
  }, [key, loadData]);

  return { data, loading, refresh };
}

/**
 * 清除所有缓存
 */
export function clearAllAppCache() {
  clearCacheByPrefix("ecom:");
}
