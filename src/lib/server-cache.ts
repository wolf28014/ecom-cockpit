/**
 * 服务端内存缓存
 *
 * 原理：同一个 Vercel Serverless 实例内，30秒内重复请求直接返回内存缓存
 * 效果：热访问时 API 响应从 200-500ms 降到 < 5ms
 *
 * 适用场景：
 * - dashboard / analytics / profit 等读取密集型 API
 * - 数据录入后自动清除缓存（调用 invalidate）
 * - 缓存粒度：按 URL 参数组合做 key
 */

interface CacheEntry {
  data: any;
  expiresAt: number;
}

const DEFAULT_TTL = 30 * 1000; // 30 秒
const cache = new Map<string, CacheEntry>();

/**
 * 读取缓存
 */
export function getCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

/**
 * 写入缓存
 */
export function setCache(key: string, data: any, ttl: number = DEFAULT_TTL): void {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

/**
 * 带缓存的异步函数
 * 如果缓存命中直接返回，否则执行 fn 并缓存结果
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> {
  const cached = getCache<T>(key);
  if (cached !== null) return cached;

  const result = await fn();
  setCache(key, result, ttl);
  return result;
}

/**
 * 清除指定前缀的缓存（数据变更后调用）
 */
export function invalidateCache(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/**
 * 清除所有缓存
 */
export function clearAllServerCache(): void {
  cache.clear();
}
