/**
 * 经营分析服务 V2
 * - 新增访客数、净销售额、投产比、累积指标
 * - 支持自然年（1/1 - 12/31）和季节年（7/1 - 次年 6/30）
 * - 月度成本按月查询
 */
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// ============== 类型定义 ==============
export interface PeriodSummary {
  period: string;
  yearType?: "natural" | "seasonal"; // 自然年 | 季节年
  salesAmount: number;
  orderCount: number;
  refundAmount: number;
  visitors: number;
  refundRate: number;
  promotionTotal: number;
  promotionRate: number;
  netSales: number;        // 净销售额 = 销售 - 退款
  roi: number;             // 投产比 = 销售 / 推广
  avgOrderValue: number;
  conversionRate: number;  // 转化率 = 订单 / 访客
  days: number;
}

export interface CumulativeStats {
  // 累积指标（年度累计）
  cumulativeSales: number;       // 累积销售额
  cumulativeRefund: number;      // 累积退款
  cumulativeNetSales: number;    // 累积净销售额
  cumulativePromotion: number;   // 累积推广费
  cumulativeRefundRate: number;  // 累积退款率
  cumulativePromotionRate: number; // 累积推广占比（推广/销售）
  cumulativeNetPromotionRate: number; // 累积净推广费率（推广/净销售）
  yoyGrowth: number;             // 同比去年（销售额）
  yoyProfitGrowth: number;       // 同比去年（净销售）
}

export interface TrendPoint {
  date: string;
  sales: number;
  refund: number;
  netSales: number;
  orders: number;
  visitors: number;
  promotion: number;
  roi: number;
  refundRate: number;
  promotionRate: number;
  conversionRate: number;
}

export interface SkuStat {
  skuId: string;
  skuCode: string;
  skuName: string;
  category: string;
  salesAmount: number;
  quantity: number;
  orderCount: number;
  cost: number;
  grossProfit: number;
  refundAmount: number;
  refundRate: number;
  roi: number;
  stock: number;
}

export interface StoreComparison {
  storeId: string;
  storeName: string;
  platform: string;
  sales: number;
  refund: number;
  netSales: number;
  orders: number;
  visitors: number;
  promotion: number;
  roi: number;
  refundRate: number;
  conversionRate: number;
}

export interface MonthlyCostData {
  id?: string;
  storeId: string;
  year: number;
  month: number;
  goodsCost: number;
  redPacket: number;
  labor: number;
  other: number;
  consumerExperience: number;
  bnplTechFee: number;
  basicSoftwareFee: number;
  redPacketAdvance: number;
  logistics: number;
  brandGiftFee: number;
  charity: number;
  quickPaymentFee: number;
  marketingPlatform: number;
  totalCost: number;
  note?: string | null;
}

// ============== 店铺筛选类型 ==============
// string: 单店铺; string[]: 多店铺汇总; undefined: 全店铺
export type StoreFilter = string | string[] | undefined;

// 把 StoreFilter 转换为 Prisma where 子句
function applyStoreFilter(where: any, storeFilter: StoreFilter, field = "storeId"): any {
  if (!storeFilter) return where;
  if (typeof storeFilter === "string") {
    return { ...where, [field]: storeFilter };
  }
  if (Array.isArray(storeFilter) && storeFilter.length > 0) {
    return { ...where, [field]: { in: storeFilter } };
  }
  return where;
}

// ============== 季节年工具 ==============
export function getSeasonalYearRange(date: Date): { start: Date; end: Date; year: number } {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  // 季节年：7/1 开始，次年 6/30 结束
  // 如果当前月份 >= 7，则属于本年开始的季节年
  // 否则属于去年开始的季节年
  const seasonYear = m >= 7 ? y : y - 1;
  const start = new Date(seasonYear, 6, 1); // 7月1日（month 是 0-based）
  const end = new Date(seasonYear + 1, 5, 30); // 次年6月30日
  end.setHours(23, 59, 59, 999);
  return { start, end, year: seasonYear };
}

export function getNaturalYearRange(date: Date): { start: Date; end: Date; year: number } {
  const y = date.getFullYear();
  const start = new Date(y, 0, 1);
  const end = new Date(y, 11, 31);
  end.setHours(23, 59, 59, 999);
  return { start, end, year: y };
}

// ============== 主服务 ==============
export class AnalyticsService {
  // ---------- 今日/本周/本月 ----------
  static async getTodaySummary(storeFilter?: StoreFilter): Promise<PeriodSummary> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.getPeriodSummary(today, today, "today", storeFilter);
  }

  static async getWeekSummary(storeFilter?: StoreFilter): Promise<PeriodSummary> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monday = new Date(today);
    monday.setDate(monday.getDate() - today.getDay());
    return this.getPeriodSummary(monday, today, "week", storeFilter);
  }

  static async getMonthSummary(storeFilter?: StoreFilter): Promise<PeriodSummary> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return this.getPeriodSummary(firstDay, today, "month", storeFilter);
  }

  // 自然年
  static async getNaturalYearSummary(storeFilter?: StoreFilter): Promise<PeriodSummary> {
    const today = new Date();
    const { start, end, year } = getNaturalYearRange(today);
    const s = await this.getPeriodSummary(start, end, "year", storeFilter);
    return { ...s, yearType: "natural" };
  }

  // 季节年
  static async getSeasonalYearSummary(storeFilter?: StoreFilter): Promise<PeriodSummary> {
    const today = new Date();
    const { start, end, year } = getSeasonalYearRange(today);
    const s = await this.getPeriodSummary(start, end, "year", storeFilter);
    return { ...s, yearType: "seasonal" };
  }

  static async getCustomSummary(start: Date, end: Date, storeFilter?: StoreFilter): Promise<PeriodSummary> {
    return this.getPeriodSummary(start, end, "custom", storeFilter);
  }

  static async getPeriodSummary(start: Date, end: Date, period: string, storeFilter?: StoreFilter): Promise<PeriodSummary> {
    const where: Prisma.DailyRecordWhereInput = applyStoreFilter({
      recordDate: { gte: start, lte: end },
    }, storeFilter);

    const records = await db.dailyRecord.findMany({ where });

    if (records.length === 0) {
      return {
        period, salesAmount: 0, orderCount: 0, refundAmount: 0, visitors: 0,
        refundRate: 0, promotionTotal: 0, promotionRate: 0, netSales: 0,
        roi: 0, avgOrderValue: 0, conversionRate: 0, days: 0,
      };
    }

    const sum = records.reduce((acc, r) => ({
      salesAmount: acc.salesAmount + r.salesAmount,
      orderCount: acc.orderCount + r.orderCount,
      refundAmount: acc.refundAmount + r.refundAmount,
      visitors: acc.visitors + r.visitors,
      promotionTotal: acc.promotionTotal + (r.promotionManualTotal ?? r.promotionTotal),
    }), { salesAmount: 0, orderCount: 0, refundAmount: 0, visitors: 0, promotionTotal: 0 });

    const sales = sum.salesAmount;
    const refund = sum.refundAmount;
    const promo = sum.promotionTotal;
    const orders = sum.orderCount;
    const visitors = sum.visitors;
    const netSales = sales - refund;

    return {
      period,
      salesAmount: Math.round(sales * 100) / 100,
      orderCount: orders,
      refundAmount: Math.round(refund * 100) / 100,
      visitors,
      refundRate: sales > 0 ? Math.round(refund / sales * 10000) / 10000 : 0,
      promotionTotal: Math.round(promo * 100) / 100,
      promotionRate: sales > 0 ? Math.round(promo / sales * 10000) / 10000 : 0,
      netSales: Math.round(netSales * 100) / 100,
      roi: promo > 0 ? Math.round(sales / promo * 100) / 100 : 0,
      avgOrderValue: orders > 0 ? Math.round(sales / orders * 100) / 100 : 0,
      conversionRate: visitors > 0 ? Math.round(orders / visitors * 10000) / 10000 : 0,
      days: records.length,
    };
  }

  // ---------- 累积指标（年度） ----------
  static async getCumulativeStats(storeFilter?: StoreFilter, yearType: "natural" | "seasonal" = "natural"): Promise<CumulativeStats> {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const currentRange = yearType === "seasonal" ? getSeasonalYearRange(today) : getNaturalYearRange(today);

    // 今年累计
    const thisYearSummary = await this.getPeriodSummary(currentRange.start, today, "cumulative", storeFilter);

    // 去年同期
    const daysPassed = Math.floor((today.getTime() - currentRange.start.getTime()) / (24 * 60 * 60 * 1000));
    const lastStart = new Date(currentRange.start);
    lastStart.setFullYear(lastStart.getFullYear() - 1);
    const lastEnd = new Date(lastStart);
    lastEnd.setDate(lastEnd.getDate() + daysPassed);
    const lastYearSummary = await this.getPeriodSummary(lastStart, lastEnd, "last_year", storeFilter);

    const yoyGrowth = lastYearSummary.salesAmount > 0
      ? (thisYearSummary.salesAmount - lastYearSummary.salesAmount) / lastYearSummary.salesAmount : 0;
    const yoyProfitGrowth = lastYearSummary.netSales > 0
      ? (thisYearSummary.netSales - lastYearSummary.netSales) / lastYearSummary.netSales : 0;

    return {
      cumulativeSales: thisYearSummary.salesAmount,
      cumulativeRefund: thisYearSummary.refundAmount,
      cumulativeNetSales: thisYearSummary.netSales,
      cumulativePromotion: thisYearSummary.promotionTotal,
      cumulativeRefundRate: thisYearSummary.refundRate,
      cumulativePromotionRate: thisYearSummary.promotionRate,
      cumulativeNetPromotionRate: thisYearSummary.netSales > 0
        ? Math.round(thisYearSummary.promotionTotal / thisYearSummary.netSales * 10000) / 10000 : 0,
      yoyGrowth,
      yoyProfitGrowth,
    };
  }

  // ---------- 趋势 ----------
  static async getTrend(days: number, storeFilter?: StoreFilter): Promise<TrendPoint[]> {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));

    const where: Prisma.DailyRecordWhereInput = applyStoreFilter({
      recordDate: { gte: start, lte: end },
    }, storeFilter);

    const records = await db.dailyRecord.findMany({
      where,
      orderBy: { recordDate: "asc" },
    });

    const map = new Map<string, TrendPoint>();
    for (const r of records) {
      const key = r.recordDate.toISOString().slice(0, 10);
      if (!map.has(key)) {
        map.set(key, {
          date: key, sales: 0, refund: 0, netSales: 0, orders: 0,
          visitors: 0, promotion: 0, roi: 0, refundRate: 0,
          promotionRate: 0, conversionRate: 0,
        });
      }
      const p = map.get(key)!;
      p.sales += r.salesAmount;
      p.refund += r.refundAmount;
      p.orders += r.orderCount;
      p.visitors += r.visitors;
      p.promotion += (r.promotionManualTotal ?? r.promotionTotal);
    }

    return Array.from(map.values()).map(p => {
      const promotion = p.promotion;
      const sales = p.sales;
      const refund = p.refund;
      const orders = p.orders;
      const visitors = p.visitors;
      return {
        ...p,
        sales: Math.round(sales * 100) / 100,
        refund: Math.round(refund * 100) / 100,
        netSales: Math.round((sales - refund) * 100) / 100,
        promotion: Math.round(promotion * 100) / 100,
        roi: promotion > 0 ? Math.round(sales / promotion * 100) / 100 : 0,
        refundRate: sales > 0 ? Math.round(refund / sales * 10000) / 10000 : 0,
        promotionRate: sales > 0 ? Math.round(promotion / sales * 10000) / 10000 : 0,
        conversionRate: visitors > 0 ? Math.round(orders / visitors * 10000) / 10000 : 0,
      };
    });
  }

  // ---------- SKU 统计 ----------
  static async getSkuStats(days: number, storeFilter?: StoreFilter): Promise<SkuStat[]> {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));

    const where: Prisma.DailySkuWhereInput = applyStoreFilter({
      recordDate: { gte: start, lte: end },
    }, storeFilter);

    const dailySkus = await db.dailySku.findMany({
      where,
      include: { sku: true },
    });

    const map = new Map<string, SkuStat>();
    for (const ds of dailySkus) {
      if (!map.has(ds.skuId)) {
        map.set(ds.skuId, {
          skuId: ds.skuId, skuCode: ds.sku.skuCode, skuName: ds.sku.skuName,
          category: ds.sku.category || "",
          salesAmount: 0, quantity: 0, orderCount: 0, cost: 0,
          grossProfit: 0, refundAmount: 0, refundRate: 0, roi: 0, stock: ds.sku.stock,
        });
      }
      const s = map.get(ds.skuId)!;
      s.salesAmount += ds.salesAmount;
      s.quantity += ds.quantity;
      s.orderCount += ds.orderCount;
      s.cost += ds.cost;
      s.grossProfit += ds.grossProfit;
      s.refundAmount += ds.refundAmount;
    }

    return Array.from(map.values())
      .map(s => ({
        ...s,
        salesAmount: Math.round(s.salesAmount * 100) / 100,
        cost: Math.round(s.cost * 100) / 100,
        grossProfit: Math.round(s.grossProfit * 100) / 100,
        refundAmount: Math.round(s.refundAmount * 100) / 100,
        refundRate: s.salesAmount > 0 ? Math.round(s.refundAmount / s.salesAmount * 10000) / 10000 : 0,
        roi: s.cost > 0 ? Math.round(s.salesAmount / s.cost * 100) / 100 : 0,
      }))
      .sort((a, b) => b.salesAmount - a.salesAmount);
  }

  // ---------- 店铺对比 ----------
  static async getStoreComparison(days: number): Promise<StoreComparison[]> {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));

    const stores = await db.store.findMany({ where: { isActive: true } });
    const results: StoreComparison[] = [];

    for (const store of stores) {
      const records = await db.dailyRecord.findMany({
        where: { storeId: store.id, recordDate: { gte: start, lte: end } },
      });
      if (records.length === 0) continue;

      const sales = records.reduce((a, r) => a + r.salesAmount, 0);
      const refund = records.reduce((a, r) => a + r.refundAmount, 0);
      const orders = records.reduce((a, r) => a + r.orderCount, 0);
      const visitors = records.reduce((a, r) => a + r.visitors, 0);
      const promo = records.reduce((a, r) => a + (r.promotionManualTotal ?? r.promotionTotal), 0);

      results.push({
        storeId: store.id, storeName: store.name, platform: store.platform,
        sales: Math.round(sales * 100) / 100,
        refund: Math.round(refund * 100) / 100,
        netSales: Math.round((sales - refund) * 100) / 100,
        orders, visitors,
        promotion: Math.round(promo * 100) / 100,
        roi: promo > 0 ? Math.round(sales / promo * 100) / 100 : 0,
        refundRate: sales > 0 ? Math.round(refund / sales * 10000) / 10000 : 0,
        conversionRate: visitors > 0 ? Math.round(orders / visitors * 10000) / 10000 : 0,
      });
    }
    return results;
  }

  // ---------- 利润目标进度 ----------
  // 多店铺场景下，利润目标按"第一个店铺"或"无店铺"查找
  static async getProfitTargetProgress(storeFilter?: StoreFilter) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const quarter = Math.floor((month - 1) / 3) + 1;

    // 单店铺时按 storeId 查目标；多店铺或全店铺时不返回目标（避免查 null 报错）
    const targetStoreId = typeof storeFilter === "string" ? storeFilter : undefined;
    if (!targetStoreId) {
      return {}; // 多店铺场景暂不支持利润目标查询
    }

    const result: Record<string, any> = {};

    const yearlyTarget = await db.profitTarget.findFirst({
      where: { targetType: "yearly", targetYear: year, storeId: targetStoreId },
    });
    if (yearlyTarget) {
      const yearSummary = await this.getNaturalYearSummary(storeFilter);
      result.yearly = {
        target: yearlyTarget.targetAmount,
        actual: yearSummary.netSales,
        rate: yearlyTarget.targetAmount > 0 ? Math.round(yearSummary.netSales / yearlyTarget.targetAmount * 10000) / 10000 : 0,
        remaining: Math.round((yearlyTarget.targetAmount - yearSummary.netSales) * 100) / 100,
      };
    }

    const quarterlyTarget = await db.profitTarget.findFirst({
      where: { targetType: "quarterly", targetYear: year, targetQuarter: quarter, storeId: targetStoreId },
    });
    if (quarterlyTarget) {
      const quarterStartMonth = (quarter - 1) * 3 + 1;
      const quarterStart = new Date(year, quarterStartMonth - 1, 1);
      const quarterSummary = await this.getCustomSummary(quarterStart, today, storeFilter);
      result.quarterly = {
        target: quarterlyTarget.targetAmount,
        actual: quarterSummary.netSales,
        rate: quarterlyTarget.targetAmount > 0 ? Math.round(quarterSummary.netSales / quarterlyTarget.targetAmount * 10000) / 10000 : 0,
        remaining: Math.round((quarterlyTarget.targetAmount - quarterSummary.netSales) * 100) / 100,
      };
    }

    const monthlyTarget = await db.profitTarget.findFirst({
      where: { targetType: "monthly", targetYear: year, targetMonth: month, storeId: targetStoreId },
    });
    if (monthlyTarget) {
      const monthSummary = await this.getMonthSummary(storeFilter);
      const monthStart = new Date(year, month - 1, 1);
      const nextMonth = new Date(year, month, 1);
      const daysLeft = Math.ceil((nextMonth.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
      result.monthly = {
        target: monthlyTarget.targetAmount,
        actual: monthSummary.netSales,
        rate: monthlyTarget.targetAmount > 0 ? Math.round(monthSummary.netSales / monthlyTarget.targetAmount * 10000) / 10000 : 0,
        remaining: Math.round((monthlyTarget.targetAmount - monthSummary.netSales) * 100) / 100,
        daysLeft,
      };
    }
    return result;
  }

  // ---------- 推广分布 ----------
  static async getPromotionBreakdown(days: number, storeFilter?: StoreFilter): Promise<Record<string, number>> {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));

    const where: Prisma.DailyRecordWhereInput = applyStoreFilter({
      recordDate: { gte: start, lte: end },
    }, storeFilter);

    const records = await db.dailyRecord.findMany({ where, select: { promotionData: true } });
    const breakdown: Record<string, number> = {};
    for (const r of records) {
      try {
        const data = JSON.parse(r.promotionData || "{}");
        for (const [k, v] of Object.entries(data)) {
          breakdown[k] = (breakdown[k] || 0) + (v as number);
        }
      } catch {}
    }
    const sorted = Object.entries(breakdown)
      .sort((a, b) => b[1] - a[1])
      .reduce((acc, [k, v]) => { acc[k] = Math.round(v * 100) / 100; return acc; }, {} as Record<string, number>);
    return sorted;
  }

  // ---------- 月度成本 ----------
  static async getMonthlyCost(storeId: string, year: number, month: number): Promise<MonthlyCostData | null> {
    const cost = await db.monthlyCost.findUnique({
      where: { storeId_year_month: { storeId, year, month } },
    });
    if (!cost) return null;
    return cost as MonthlyCostData;
  }

  static async getMonthlyCosts(storeFilter?: StoreFilter, year?: number): Promise<MonthlyCostData[]> {
    const where: any = applyStoreFilter({}, storeFilter);
    if (year) where.year = year;
    const costs = await db.monthlyCost.findMany({
      where,
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    return costs as MonthlyCostData[];
  }

  static async saveMonthlyCost(data: MonthlyCostData): Promise<MonthlyCostData> {
    const totalCost = Math.round((
      data.goodsCost + data.redPacket + data.labor + data.other +
      data.consumerExperience + data.bnplTechFee + data.basicSoftwareFee +
      data.redPacketAdvance + data.logistics + data.brandGiftFee +
      data.charity + data.quickPaymentFee + data.marketingPlatform
    ) * 100) / 100;

    const existing = await db.monthlyCost.findUnique({
      where: { storeId_year_month: { storeId: data.storeId, year: data.year, month: data.month } },
    });

    if (existing) {
      const updated = await db.monthlyCost.update({
        where: { id: existing.id },
        data: { ...data, totalCost },
      });
      return updated as MonthlyCostData;
    } else {
      const created = await db.monthlyCost.create({
        data: { ...data, totalCost },
      });
      return created as MonthlyCostData;
    }
  }

  // ---------- 数据上下文（供 AI 使用） ----------
  static async buildDataContext(storeFilter?: StoreFilter): Promise<string> {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);

    const [todaySum, yesterdaySum, weekSum, monthSum, naturalYearSum, seasonalYearSum, progress] = await Promise.all([
      this.getTodaySummary(storeFilter),
      this.getCustomSummary(yesterday, yesterday, storeFilter),
      this.getWeekSummary(storeFilter),
      this.getMonthSummary(storeFilter),
      this.getNaturalYearSummary(storeFilter),
      this.getSeasonalYearSummary(storeFilter),
      this.getProfitTargetProgress(storeFilter),
    ]);

    let storeName = "全店铺汇总";
    if (typeof storeFilter === "string") {
      const store = await db.store.findUnique({ where: { id: storeFilter } });
      if (store) storeName = store.name;
    } else if (Array.isArray(storeFilter) && storeFilter.length === 1) {
      const store = await db.store.findUnique({ where: { id: storeFilter[0] } });
      if (store) storeName = store.name;
    } else if (Array.isArray(storeFilter) && storeFilter.length > 1) {
      storeName = `${storeFilter.length} 个店铺汇总`;
    }

    const salesChangePct = yesterdaySum.salesAmount > 0
      ? ((todaySum.salesAmount - yesterdaySum.salesAmount) / yesterdaySum.salesAmount * 100).toFixed(1)
      : "0";
    const netSalesChangePct = yesterdaySum.netSales !== 0
      ? ((todaySum.netSales - yesterdaySum.netSales) / Math.abs(yesterdaySum.netSales) * 100).toFixed(1)
      : "0";

    let progressStr = "暂未设置利润目标";
    if (Object.keys(progress).length > 0) {
      const lines: string[] = [];
      for (const [k, v] of Object.entries(progress)) {
        const labelZh: Record<string, string> = { yearly: "年度", quarterly: "季度", monthly: "月度" };
        lines.push(`  - ${labelZh[k] || k}: 目标¥${(v as any).target.toLocaleString()}, 已完成¥${Math.round((v as any).actual).toLocaleString()} (${((v as any).rate * 100).toFixed(1)}%)`);
      }
      progressStr = lines.join("\n");
    }

    return `当前店铺：${storeName}
今日（${today.toISOString().slice(0, 10)}）：销售额¥${todaySum.salesAmount.toLocaleString()}、退款¥${todaySum.refundAmount.toLocaleString()}、净销售额¥${todaySum.netSales.toLocaleString()}、订单${todaySum.orderCount}单、访客${todaySum.visitors}人、退款率${(todaySum.refundRate * 100).toFixed(1)}%、推广费¥${todaySum.promotionTotal.toLocaleString()}、推广占比${(todaySum.promotionRate * 100).toFixed(1)}%、投产比${todaySum.roi.toFixed(2)}、转化率${(todaySum.conversionRate * 100).toFixed(2)}%
昨日（${yesterday.toISOString().slice(0, 10)}）：销售额¥${yesterdaySum.salesAmount.toLocaleString()}、净销售额¥${yesterdaySum.netSales.toLocaleString()}、订单${yesterdaySum.orderCount}单
环比变化：销售额 ${salesChangePct > 0 ? "+" : ""}${salesChangePct}%、净销售额 ${netSalesChangePct > 0 ? "+" : ""}${netSalesChangePct}%
本周：销售额¥${weekSum.salesAmount.toLocaleString()}、净销售额¥${weekSum.netSales.toLocaleString()}、投产比${weekSum.roi.toFixed(2)}
本月：销售额¥${monthSum.salesAmount.toLocaleString()}、净销售额¥${monthSum.netSales.toLocaleString()}、推广占比${(monthSum.promotionRate * 100).toFixed(1)}%
自然年（${today.getFullYear()}年）：销售额¥${naturalYearSum.salesAmount.toLocaleString()}、净销售额¥${naturalYearSum.netSales.toLocaleString()}、推广费¥${naturalYearSum.promotionTotal.toLocaleString()}
季节年（${getSeasonalYearRange(today).year}-${getSeasonalYearRange(today).year + 1}）：销售额¥${seasonalYearSum.salesAmount.toLocaleString()}、净销售额¥${seasonalYearSum.netSales.toLocaleString()}
利润目标进度：
${progressStr}`;
  }
}

// 导出推广字段常量
export const PROMOTION_FIELDS = [
  "货品全站推广",
  "关键词推广",
  "人群推广",
  "店铺直达",
  "内容营销",
  "淘宝客",
  "其它",
];

// 月度成本字段定义
export const MONTHLY_COST_FIELDS = [
  { key: "goodsCost", label: "货品成本" },
  { key: "redPacket", label: "红包" },
  { key: "labor", label: "人工" },
  { key: "other", label: "其它" },
  { key: "consumerExperience", label: "消费者体验提升计划服务费" },
  { key: "bnplTechFee", label: "先用后付技术服务费" },
  { key: "basicSoftwareFee", label: "基础软件服务费" },
  { key: "redPacketAdvance", label: "限时红包代商家垫付扣回" },
  { key: "logistics", label: "商家集运物流服务费" },
  { key: "brandGiftFee", label: "品牌新享淘宝礼金软件服务费" },
  { key: "charity", label: "公益宝贝" },
  { key: "quickPaymentFee", label: "淘宝极速回款手动回款服务费" },
  { key: "marketingPlatform", label: "营销平台" },
] as const;
