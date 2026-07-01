/**
 * 经营分析服务 - 所有统计/聚合逻辑
 */
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// ============== 类型定义 ==============
export interface PeriodSummary {
  period: string;
  salesAmount: number;
  orderCount: number;
  refundAmount: number;
  refundOrderCount: number;
  refundRate: number;
  promotionTotal: number;
  costTotal: number;
  grossProfit: number;
  netProfit: number;
  profitRate: number;
  roi: number;
  avgOrderValue: number;
  profitPerOrder: number;
  promotionRate: number;
  days: number;
}

export interface TrendPoint {
  date: string;
  sales: number;
  profit: number;
  orders: number;
  promotion: number;
  cost: number;
  refund: number;
  roi: number;
  profitRate: number;
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
  profit: number;
  orders: number;
  profitRate: number;
  roi: number;
  refundRate: number;
}

// ============== 主服务 ==============
export class AnalyticsService {
  // ---------- 周期汇总 ----------
  static async getTodaySummary(storeId?: string): Promise<PeriodSummary> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.getPeriodSummary(today, today, "today", storeId);
  }

  static async getWeekSummary(storeId?: string): Promise<PeriodSummary> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monday = new Date(today);
    monday.setDate(monday.getDate() - today.getDay());
    return this.getPeriodSummary(monday, today, "week", storeId);
  }

  static async getMonthSummary(storeId?: string): Promise<PeriodSummary> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return this.getPeriodSummary(firstDay, today, "month", storeId);
  }

  static async getYearSummary(storeId?: string): Promise<PeriodSummary> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDay = new Date(today.getFullYear(), 0, 1);
    return this.getPeriodSummary(firstDay, today, "year", storeId);
  }

  static async getCustomSummary(start: Date, end: Date, storeId?: string): Promise<PeriodSummary> {
    return this.getPeriodSummary(start, end, "custom", storeId);
  }

  static async getPeriodSummary(start: Date, end: Date, period: string, storeId?: string): Promise<PeriodSummary> {
    const where: Prisma.DailyRecordWhereInput = {
      recordDate: { gte: start, lte: end },
    };
    if (storeId) where.storeId = storeId;

    const records = await db.dailyRecord.findMany({ where });

    if (records.length === 0) {
      return {
        period, salesAmount: 0, orderCount: 0, refundAmount: 0, refundOrderCount: 0,
        refundRate: 0, promotionTotal: 0, costTotal: 0, grossProfit: 0, netProfit: 0,
        profitRate: 0, roi: 0, avgOrderValue: 0, profitPerOrder: 0, promotionRate: 0,
        days: 0,
      };
    }

    const sum = records.reduce((acc, r) => ({
      salesAmount: acc.salesAmount + r.salesAmount,
      orderCount: acc.orderCount + r.orderCount,
      refundAmount: acc.refundAmount + r.refundAmount,
      refundOrderCount: acc.refundOrderCount + r.refundOrderCount,
      promotionTotal: acc.promotionTotal + r.promotionTotal,
      costTotal: acc.costTotal + r.costTotal,
      grossProfit: acc.grossProfit + r.grossProfit,
      netProfit: acc.netProfit + r.netProfit,
    }), { salesAmount: 0, orderCount: 0, refundAmount: 0, refundOrderCount: 0, promotionTotal: 0, costTotal: 0, grossProfit: 0, netProfit: 0 });

    const sales = sum.salesAmount;
    const orders = sum.orderCount;
    const promo = sum.promotionTotal;
    const net = sum.netProfit;

    return {
      period,
      salesAmount: Math.round(sales * 100) / 100,
      orderCount: orders,
      refundAmount: Math.round(sum.refundAmount * 100) / 100,
      refundOrderCount: sum.refundOrderCount,
      refundRate: orders > 0 ? Math.round(sum.refundOrderCount / orders * 10000) / 10000 : 0,
      promotionTotal: Math.round(promo * 100) / 100,
      costTotal: Math.round(sum.costTotal * 100) / 100,
      grossProfit: Math.round(sum.grossProfit * 100) / 100,
      netProfit: Math.round(net * 100) / 100,
      profitRate: sales > 0 ? Math.round(net / sales * 10000) / 10000 : 0,
      roi: promo > 0 ? Math.round(sales / promo * 100) / 100 : 0,
      avgOrderValue: orders > 0 ? Math.round(sales / orders * 100) / 100 : 0,
      profitPerOrder: orders > 0 ? Math.round(net / orders * 100) / 100 : 0,
      promotionRate: sales > 0 ? Math.round(promo / sales * 10000) / 10000 : 0,
      days: records.length,
    };
  }

  // ---------- 趋势 ----------
  static async getTrend(days: number, storeId?: string): Promise<TrendPoint[]> {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));

    const where: Prisma.DailyRecordWhereInput = {
      recordDate: { gte: start, lte: end },
    };
    if (storeId) where.storeId = storeId;

    const records = await db.dailyRecord.findMany({
      where,
      orderBy: { recordDate: "asc" },
    });

    // 按日期聚合
    const map = new Map<string, TrendPoint>();
    for (const r of records) {
      const key = r.recordDate.toISOString().slice(0, 10);
      if (!map.has(key)) {
        map.set(key, {
          date: key, sales: 0, profit: 0, orders: 0,
          promotion: 0, cost: 0, refund: 0, roi: 0, profitRate: 0,
        });
      }
      const p = map.get(key)!;
      p.sales += r.salesAmount;
      p.profit += r.netProfit;
      p.orders += r.orderCount;
      p.promotion += r.promotionTotal;
      p.cost += r.costTotal;
      p.refund += r.refundAmount;
    }

    return Array.from(map.values()).map(p => ({
      ...p,
      sales: Math.round(p.sales * 100) / 100,
      profit: Math.round(p.profit * 100) / 100,
      promotion: Math.round(p.promotion * 100) / 100,
      cost: Math.round(p.cost * 100) / 100,
      refund: Math.round(p.refund * 100) / 100,
      roi: p.promotion > 0 ? Math.round(p.sales / p.promotion * 100) / 100 : 0,
      profitRate: p.sales > 0 ? Math.round(p.profit / p.sales * 10000) / 10000 : 0,
    }));
  }

  // ---------- SKU 统计 ----------
  static async getSkuStats(days: number, storeId?: string): Promise<SkuStat[]> {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));

    const where: Prisma.DailySkuWhereInput = {
      recordDate: { gte: start, lte: end },
    };
    if (storeId) where.storeId = storeId;

    const dailySkus = await db.dailySku.findMany({
      where,
      include: { sku: true },
    });

    const map = new Map<string, SkuStat>();
    for (const ds of dailySkus) {
      if (!map.has(ds.skuId)) {
        map.set(ds.skuId, {
          skuId: ds.skuId,
          skuCode: ds.sku.skuCode,
          skuName: ds.sku.skuName,
          category: ds.sku.category || "",
          salesAmount: 0, quantity: 0, orderCount: 0, cost: 0,
          grossProfit: 0, refundAmount: 0, refundRate: 0, roi: 0,
          stock: ds.sku.stock,
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
      const profit = records.reduce((a, r) => a + r.netProfit, 0);
      const orders = records.reduce((a, r) => a + r.orderCount, 0);
      const promo = records.reduce((a, r) => a + r.promotionTotal, 0);
      const refundOrders = records.reduce((a, r) => a + r.refundOrderCount, 0);

      results.push({
        storeId: store.id,
        storeName: store.name,
        platform: store.platform,
        sales: Math.round(sales * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        orders,
        profitRate: sales > 0 ? Math.round(profit / sales * 10000) / 10000 : 0,
        roi: promo > 0 ? Math.round(sales / promo * 100) / 100 : 0,
        refundRate: orders > 0 ? Math.round(refundOrders / orders * 10000) / 10000 : 0,
      });
    }
    return results;
  }

  // ---------- 利润目标进度 ----------
  static async getProfitTargetProgress(storeId?: string) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const quarter = Math.floor((month - 1) / 3) + 1;

    const result: Record<string, any> = {};

    const yearlyTarget = await db.profitTarget.findFirst({
      where: storeId
        ? { targetType: "yearly", targetYear: year, storeId }
        : { targetType: "yearly", targetYear: year },
    });
    if (yearlyTarget) {
      const yearSummary = await this.getYearSummary(storeId);
      result.yearly = {
        target: yearlyTarget.targetAmount,
        actual: yearSummary.netProfit,
        rate: yearlyTarget.targetAmount > 0 ? Math.round(yearSummary.netProfit / yearlyTarget.targetAmount * 10000) / 10000 : 0,
        remaining: Math.round((yearlyTarget.targetAmount - yearSummary.netProfit) * 100) / 100,
      };
    }

    const quarterlyTarget = await db.profitTarget.findFirst({
      where: storeId
        ? { targetType: "quarterly", targetYear: year, targetQuarter: quarter, storeId }
        : { targetType: "quarterly", targetYear: year, targetQuarter: quarter },
    });
    if (quarterlyTarget) {
      const quarterStartMonth = (quarter - 1) * 3 + 1;
      const quarterStart = new Date(year, quarterStartMonth - 1, 1);
      const quarterSummary = await this.getCustomSummary(quarterStart, today, storeId);
      result.quarterly = {
        target: quarterlyTarget.targetAmount,
        actual: quarterSummary.netProfit,
        rate: quarterlyTarget.targetAmount > 0 ? Math.round(quarterSummary.netProfit / quarterlyTarget.targetAmount * 10000) / 10000 : 0,
        remaining: Math.round((quarterlyTarget.targetAmount - quarterSummary.netProfit) * 100) / 100,
      };
    }

    const monthlyTarget = await db.profitTarget.findFirst({
      where: storeId
        ? { targetType: "monthly", targetYear: year, targetMonth: month, storeId }
        : { targetType: "monthly", targetYear: year, targetMonth: month },
    });
    if (monthlyTarget) {
      const monthSummary = await this.getMonthSummary(storeId);
      const monthStart = new Date(year, month - 1, 1);
      const nextMonth = new Date(year, month, 1);
      const daysLeft = Math.ceil((nextMonth.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
      result.monthly = {
        target: monthlyTarget.targetAmount,
        actual: monthSummary.netProfit,
        rate: monthlyTarget.targetAmount > 0 ? Math.round(monthSummary.netProfit / monthlyTarget.targetAmount * 10000) / 10000 : 0,
        remaining: Math.round((monthlyTarget.targetAmount - monthSummary.netProfit) * 100) / 100,
        daysLeft,
      };
    }
    return result;
  }

  // ---------- 推广分布 ----------
  static async getPromotionBreakdown(days: number, storeId?: string): Promise<Record<string, number>> {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));

    const where: Prisma.DailyRecordWhereInput = {
      recordDate: { gte: start, lte: end },
    };
    if (storeId) where.storeId = storeId;

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
    // 排序
    const sorted = Object.entries(breakdown)
      .sort((a, b) => b[1] - a[1])
      .reduce((acc, [k, v]) => { acc[k] = Math.round(v * 100) / 100; return acc; }, {} as Record<string, number>);
    return sorted;
  }

  // ---------- 成本结构 ----------
  static async getCostBreakdown(days: number, storeId?: string): Promise<Record<string, number>> {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));

    const where: Prisma.DailyRecordWhereInput = {
      recordDate: { gte: start, lte: end },
    };
    if (storeId) where.storeId = storeId;

    const records = await db.dailyRecord.findMany({ where, select: { costData: true } });
    const breakdown: Record<string, number> = {};
    for (const r of records) {
      try {
        const data = JSON.parse(r.costData || "{}");
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

  // ---------- 数据上下文（供 AI 使用） ----------
  static async buildDataContext(storeId?: string): Promise<string> {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);

    const [todaySum, yesterdaySum, weekSum, monthSum, yearSum, progress] = await Promise.all([
      this.getTodaySummary(storeId),
      this.getCustomSummary(yesterday, yesterday, storeId),
      this.getWeekSummary(storeId),
      this.getMonthSummary(storeId),
      this.getYearSummary(storeId),
      this.getProfitTargetProgress(storeId),
    ]);

    let storeName = "全店铺汇总";
    if (storeId) {
      const store = await db.store.findUnique({ where: { id: storeId } });
      if (store) storeName = store.name;
    }

    const salesChangePct = yesterdaySum.salesAmount > 0
      ? ((todaySum.salesAmount - yesterdaySum.salesAmount) / yesterdaySum.salesAmount * 100).toFixed(1)
      : "0";
    const profitChangePct = yesterdaySum.netProfit !== 0
      ? ((todaySum.netProfit - yesterdaySum.netProfit) / Math.abs(yesterdaySum.netProfit) * 100).toFixed(1)
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
今日（${today.toISOString().slice(0, 10)}）：销售额¥${todaySum.salesAmount.toLocaleString()}、净利润¥${todaySum.netProfit.toLocaleString()}、订单${todaySum.orderCount}单、利润率${(todaySum.profitRate * 100).toFixed(1)}%、ROI ${todaySum.roi.toFixed(2)}、推广费率${(todaySum.promotionRate * 100).toFixed(1)}%、退款率${(todaySum.refundRate * 100).toFixed(1)}%
昨日（${yesterday.toISOString().slice(0, 10)}）：销售额¥${yesterdaySum.salesAmount.toLocaleString()}、净利润¥${yesterdaySum.netProfit.toLocaleString()}、订单${yesterdaySum.orderCount}单
环比变化：销售额 ${salesChangePct > 0 ? "+" : ""}${salesChangePct}%、净利润 ${profitChangePct > 0 ? "+" : ""}${profitChangePct}%
本周：销售额¥${weekSum.salesAmount.toLocaleString()}、净利润¥${weekSum.netProfit.toLocaleString()}
本月：销售额¥${monthSum.salesAmount.toLocaleString()}、净利润¥${monthSum.netProfit.toLocaleString()}、利润率${(monthSum.profitRate * 100).toFixed(1)}%
本年：销售额¥${yearSum.salesAmount.toLocaleString()}、净利润¥${yearSum.netProfit.toLocaleString()}
利润目标进度：
${progressStr}`;
  }
}
