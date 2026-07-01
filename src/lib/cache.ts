/**
 * 浏览器 localStorage 缓存工具
 * 用于缓存 API 响应，减少加载时间
 *
 * 缓存策略：
 * - 默认 5 分钟过期
 * - 支持手动清除
 * - 数据变化后自动失效
 */

const DEFAULT_TTL = 5 * 60 * 1000; // 5 分钟

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * 从缓存读取数据
 * @param key 缓存键
 * @param ttl 过期时间（毫秒），默认 5 分钟
 * @returns 缓存数据或 null（无缓存或已过期）
 */
export function getCached<T>(key: string, ttl: number = DEFAULT_TTL): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const item: CacheItem<T> = JSON.parse(raw);
    const now = Date.now();
    if (now - item.timestamp > ttl) {
      // 已过期，清除
      localStorage.removeItem(key);
      return null;
    }
    return item.data;
  } catch {
    return null;
  }
}

/**
 * 写入缓存
 */
export function setCached<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
  if (typeof window === "undefined") return;
  try {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    localStorage.setItem(key, JSON.stringify(item));
  } catch (e) {
    // localStorage 满了或被禁用，忽略
    console.warn("Cache write failed:", e);
  }
}

/**
 * 清除指定缓存
 */
export function removeCached(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {}
}

/**
 * 清除所有以 prefix 开头的缓存
 */
export function clearCacheByPrefix(prefix: string): void {
  if (typeof window === "undefined") return;
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
}

/**
 * 清除所有 ecom-cockpit 相关缓存
 */
export function clearAllCache(): void {
  clearCacheByPrefix("ecom:");
}

/**
 * 带缓存的 fetch
 * - 优先返回缓存（即使过期，先显示，后台再刷新）
 * - 然后后台请求最新数据
 *
 * @param url 请求 URL
 * @param cacheKey 缓存键（默认等于 url）
 * @param ttl 缓存 TTL
 * @param onData 有新数据时回调
 * @returns 返回缓存数据（如有），同时后台请求新数据
 */
export async function fetchWithCache<T>(
  url: string,
  cacheKey?: string,
  ttl: number = DEFAULT_TTL,
  onData?: (data: T, fromCache: boolean) => void
): Promise<T | null> {
  const key = cacheKey || `ecom:${url}`;
  const cached = getCached<T>(key, ttl);

  // 后台请求最新数据
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json() as T;
      setCached(key, data, ttl);
      onData?.(data, false);
      return data;
    }
  } catch (e) {
    // 请求失败，如果有缓存就用缓存
    if (cached && onData) {
      onData(cached, true);
    }
  }

  // 如果有缓存但请求失败，返回缓存
  if (cached && onData) {
    onData(cached, true);
  }
  return cached;
}
