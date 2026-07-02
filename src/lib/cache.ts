/**
 * 浏览器 localStorage 缓存工具
 *
 * 缓存策略：
 * - 历史数据（过去日期）：24 小时 TTL — 打开过就缓存，下次不用加载
 * - 实时数据（今日/本周/本月）：30 秒 TTL — 短缓存保证新鲜度
 * - 数据变化后自动清除（录入数据时调用清除）
 */

// 短缓存：用于今日/本周/本月等实时数据
const SHORT_TTL = 30 * 1000; // 30 秒

// 长缓存：用于历史数据（过去的日期/月份/年份）
const LONG_TTL = 24 * 60 * 60 * 1000; // 24 小时

// 默认 TTL（向后兼容）
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
    if (now - item.timestamp > (item.ttl || ttl)) {
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
 * @param key 缓存键
 * @param data 数据
 * @param ttl 过期时间（毫秒），默认 5 分钟
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
 * 写入长缓存（24小时，用于历史数据）
 */
export function setCachedLong<T>(key: string, data: T): void {
  setCached(key, data, LONG_TTL);
}

/**
 * 读取长缓存（24小时，用于历史数据）
 */
export function getCachedLong<T>(key: string): T | null {
  return getCached<T>(key, LONG_TTL);
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

// 导出 TTL 常量供外部使用
export { SHORT_TTL, LONG_TTL, DEFAULT_TTL };
