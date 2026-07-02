"use client";

import { useState, useEffect, useCallback } from "react";
import { getCached, setCached, clearCacheByPrefix, LONG_TTL, SHORT_TTL } from "@/lib/cache";

/**
 * 带缓存的数据获取 Hook
 *
 * @param url 请求 URL
 * @param cacheKey 缓存键
 * @param enabled 是否启用
 * @param longCache 是否使用长缓存（24小时，用于历史数据）
 * @returns { data, loading, error, refresh }
 */
export function useCachedFetch<T = any>(
  url: string | null,
  cacheKey?: string,
  enabled: boolean = true,
  longCache: boolean = false
): { data: T | null; loading: boolean; error: string | null; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const key = cacheKey || `ecom:${url}`;
  const ttl = longCache ? LONG_TTL : SHORT_TTL;

  const loadData = useCallback((force = false) => {
    if (!url || !enabled) {
      setLoading(false);
      return;
    }

    // 1. 先尝试精确缓存（不显示 loading，直接秒显示）
    if (!force) {
      const cached = getCached<T>(key, ttl);
      if (cached) {
        setData(cached);
        setError(null);
        setLoading(false);
        // 长缓存不后台刷新（历史数据不会变）
        if (!longCache) {
          fetch(url)
            .then(r => r.json())
            .then(d => {
              if (d && !d.error) {
                setError(null);
                setData(d);
                setCached(key, d, ttl);
              }
            })
            .catch(() => {});
        }
        return;
      }
    }

    // 2. 无精确缓存：查找同前缀的旧缓存（日期不同但有旧数据）
    if (!force) {
      const prefix = key.split(":").slice(0, -1).join(":");
      const allKeys = Object.keys(localStorage);
      let oldData: T | null = null;
      for (const k of allKeys) {
        if (k.startsWith(prefix + ":") && k !== key) {
          try {
            const item = JSON.parse(localStorage.getItem(k) || "");
            if (item?.data && Date.now() - item.timestamp < (longCache ? LONG_TTL : 30 * 60 * 1000)) {
              oldData = item.data;
              break;
            }
          } catch {}
        }
      }

      if (oldData) {
        setData(oldData);
        setError(null);
        setLoading(false);
        // 后台加载新数据
        fetch(url)
          .then(r => r.json())
          .then(d => {
            if (d && !d.error) {
              setError(null);
              setData(d);
              setCached(key, d, ttl);
              setLoading(false);
            } else {
              setError("加载失败");
              setLoading(false);
            }
          })
          .catch(() => {
            setError("加载失败");
            setLoading(false);
          });
        return;
      }
    }

    // 3. 完全无缓存：显示 loading 并请求
    setLoading(true);
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d && !d.error) {
          setError(null);
          setData(d);
          setCached(key, d, ttl);
        } else {
          setError("加载失败");
        }
        setLoading(false);
      })
      .catch(() => {
        setError("加载失败");
        setLoading(false);
      });
  }, [url, key, enabled, longCache, ttl]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const refresh = useCallback(() => {
    clearCacheByPrefix(key);
    loadData(true);
  }, [key, loadData]);

  return { data, loading, error, refresh };
}

/**
 * 清除所有缓存
 */
export function clearAllAppCache() {
  clearCacheByPrefix("ecom:");
}
