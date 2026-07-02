import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserStoreIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCache, setCache } from "@/lib/server-cache";

/**
 * 利润计算 API
 *
 * 利润公式：
 *   净销售额 = 销售额 - 退款金额
 *   毛利润 = 净销售额 - 货品成本
 *   净利润 = 毛利润 - 推广费 - 其他成本(红包+人工+其他+各项服务费)
 *   利润率 = 净利润 / 净销售额
 *
 * 支持维度：day / month / naturalYear / seasonalYear
 */
export async function GET(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const storeIdsParam = req.nextUrl.searchParams.get("storeIds");
  let storeIdArray: string[];
  if (storeIdsParam) {
    storeIdArray = storeIdsParam.split(",").filter(Boolean).filter(id => userStoreIds.includes(id));
    if (storeIdArray.length === 0) storeIdArray = userStoreIds;
  } else {
    storeIdArray = userStoreIds;
  }

  // 参数
  const dayDate = req.nextUrl.searchParams.get("day") || new Date().toISOString().slice(0, 10);
  const monthYear = parseInt(req.nextUrl.searchParams.get("monthYear") || String(new Date().getFullYear()));
  const monthMonth = parseInt(req.nextUrl.searchParams.get("monthMonth") || String(new Date().getMonth() + 1));
  const naturalYear = parseInt(req.nextUrl.searchParams.get("naturalYear") || String(new Date().getFullYear()));
  const seasonalYear = parseInt(req.nextUrl.searchParams.get("seasonalYear") || String(new Date().getFullYear()));

  // 服务端内存缓存（30秒TTL）
  const cacheKey = `profit:${storeIdArray.join(",")}:${dayDate}:${monthYear}-${monthMonth}:N${naturalYear}:S${seasonalYear}`;
  const cached = getCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  const today = new Date();

  // 查各店铺的货品成本比例
  const stores = await db.store.findMany({
    where: { id: { in: storeIdArray } },
    select: { id: true, goodsCostRatio: true },
  });
  const storeRatioMap = new Map(stores.map(s => [s.id, s.goodsCostRatio || 0.63]));

  // 辅助：查指定日期范围的每日数据 + 对应月份的月度成本
  async function getProfitData(start: Date, end: Date) {
    // 1. 查每日经营数据
    const records = await db.dailyRecord.findMany({
      where: { storeId: { in: storeIdArray }, recordDate: { gte: start, lte: end } },
    });

    const sales = records.reduce((a, r) => a + r.salesAmount, 0);
    const refund = records.reduce((a, r) => a + r.refundAmount, 0);
    const orders = records.reduce((a, r) => a + r.orderCount, 0);
    const visitors = records.reduce((a, r) => a + r.visitors, 0);
    const promo = records.reduce((a, r) => a + (r.promotionManualTotal ?? r.promotionTotal), 0);

    // 2. 查覆盖该范围的月度成本
    const costStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const costEnd = new Date(end.getFullYear(), end.getMonth() + 1, 0);
    const monthlyCosts = await db.monthlyCost.findMany({
      where: {
        storeId: { in: storeIdArray },
        OR: buildMonthFilter(costStart, costEnd),
      },
    });

    // 3. 货品成本：优先用月度成本中的实际值，无月度成本时按店铺比例自动算
    let goodsCost = monthlyCosts.reduce((a, c) => a + c.goodsCost, 0);
    let goodsCostSource = "monthly"; // 来源：monthly=月度成本 actual=按比例

    if (goodsCost === 0 && sales > 0) {
      // 没有月度成本数据，按各店铺的 goodsCostRatio 自动算
      // 货品成本 = 净销售额 × 比例（净销售额 = 销售额 - 退款）
      const netSalesByStore = new Map<string, number>();
      for (const r of records) {
        const net = r.salesAmount - r.refundAmount;
        netSalesByStore.set(r.storeId, (netSalesByStore.get(r.storeId) || 0) + net);
      }
      for (const [storeId, storeNetSales] of netSalesByStore) {
        const ratio = storeRatioMap.get(storeId) || 0.63;
        goodsCost += storeNetSales * ratio;
      }
      goodsCostSource = "ratio";
    }

    // 4. 汇总其他成本
    const redPacket = monthlyCosts.reduce((a, c) => a + c.redPacket, 0);
    const labor = monthlyCosts.reduce((a, c) => a + c.labor, 0);
    const other = monthlyCosts.reduce((a, c) => a + c.other, 0);
    const consumerExperience = monthlyCosts.reduce((a, c) => a + c.consumerExperience, 0);
    const bnplTechFee = monthlyCosts.reduce((a, c) => a + c.bnplTechFee, 0);
    const basicSoftwareFee = monthlyCosts.reduce((a, c) => a + c.basicSoftwareFee, 0);
    const redPacketAdvance = monthlyCosts.reduce((a, c) => a + c.redPacketAdvance, 0);
    const logistics = monthlyCosts.reduce((a, c) => a + c.logistics, 0);
    const brandGiftFee = monthlyCosts.reduce((a, c) => a + c.brandGiftFee, 0);
    const charity = monthlyCosts.reduce((a, c) => a + c.charity, 0);
    const quickPaymentFee = monthlyCosts.reduce((a, c) => a + c.quickPaymentFee, 0);
    const marketingPlatform = monthlyCosts.reduce((a, c) => a + c.marketingPlatform, 0);
    const monthlyTotalCost = monthlyCosts.reduce((a, c) => a + c.totalCost, 0);

    // 如果货品成本是按比例算的，总成本 = 货品成本(比例) + 其他月度成本(不含货品)
    const totalCost = goodsCostSource === "ratio"
      ? goodsCost + (monthlyTotalCost - monthlyCosts.reduce((a, c) => a + c.goodsCost, 0))
      : monthlyTotalCost;

    // 5. 计算利润
    const netSales = sales - refund;
    const grossProfit = netSales - goodsCost;
    const otherCosts = totalCost - goodsCost;
    const netProfit = netSales - totalCost - promo;
    const profitRate = netSales > 0 ? netProfit / netSales : 0;
    const roi = promo > 0 ? sales / promo : 0;

    return {
      // 收入
      salesAmount: Math.round(sales * 100) / 100,
      refundAmount: Math.round(refund * 100) / 100,
      netSales: Math.round(netSales * 100) / 100,
      orderCount: orders,
      visitors,
      // 推广
      promotionTotal: Math.round(promo * 100) / 100,
      roi: Math.round(roi * 100) / 100,
      // 成本明细
      goodsCost: Math.round(goodsCost * 100) / 100,
      redPacket: Math.round(redPacket * 100) / 100,
      labor: Math.round(labor * 100) / 100,
      other: Math.round(other * 100) / 100,
      consumerExperience: Math.round(consumerExperience * 100) / 100,
      bnplTechFee: Math.round(bnplTechFee * 100) / 100,
      basicSoftwareFee: Math.round(basicSoftwareFee * 100) / 100,
      redPacketAdvance: Math.round(redPacketAdvance * 100) / 100,
      logistics: Math.round(logistics * 100) / 100,
      brandGiftFee: Math.round(brandGiftFee * 100) / 100,
      charity: Math.round(charity * 100) / 100,
      quickPaymentFee: Math.round(quickPaymentFee * 100) / 100,
      marketingPlatform: Math.round(marketingPlatform * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      otherCosts: Math.round(otherCosts * 100) / 100,
      // 利润
      grossProfit: Math.round(grossProfit * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      profitRate: Math.round(profitRate * 10000) / 10000,
      // 货品成本来源
      goodsCostSource, // "monthly"=月度实际值 "ratio"=按比例自动算
    };
  }

  // 构建月份查询条件
  function buildMonthFilter(start: Date, end: Date) {
    const conditions = [];
    let y = start.getFullYear();
    let m = start.getMonth() + 1;
    const ey = end.getFullYear();
    const em = end.getMonth() + 1;
    while (y < ey || (y === ey && m <= em)) {
      conditions.push({ year: y, month: m });
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return conditions;
  }

  // 日分析
  const dayStart = new Date(dayDate); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayDate); dayEnd.setHours(23, 59, 59, 999);
  const dayProfit = await getProfitData(dayStart, dayEnd);

  // 月分析
  const monthStart = new Date(monthYear, monthMonth - 1, 1);
  const monthEnd = new Date(monthYear, monthMonth, 0); monthEnd.setHours(23, 59, 59, 999);
  const monthProfit = await getProfitData(monthStart, monthEnd);

  // 自然年
  const natStart = new Date(naturalYear, 0, 1);
  const natEnd = naturalYear < today.getFullYear() ? new Date(naturalYear, 11, 31) : today;
  natEnd.setHours(23, 59, 59, 999);
  const naturalYearProfit = await getProfitData(natStart, natEnd);

  // 季节年
  const seaStart = new Date(seasonalYear, 6, 1);
  const seaEnd = new Date(seasonalYear + 1, 5, 30); seaEnd.setHours(23, 59, 59, 999);
  const seaActualEnd = (seasonalYear < today.getFullYear() || (seasonalYear === today.getFullYear() && today.getMonth() < 6)) ? seaEnd : today;
  const seasonalYearProfit = await getProfitData(seaStart, seaActualEnd);

  const result = {
    dayProfit,
    monthProfit,
    naturalYearProfit,
    seasonalYearProfit,
  };
  setCache(cacheKey, result);
  return NextResponse.json(result);
}
