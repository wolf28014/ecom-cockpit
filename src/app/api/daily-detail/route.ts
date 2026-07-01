import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * 每日数据明细 + 自动计算累积指标
 * 返回生意参谋风格的数据表格
 *
 * 计算字段：
 * - 累积销售额/累积退款/累积推广费：从周期第一天累加
 * - 净销售额 = 销售 - 退款
 * - 退款率 = 退款 / 销售
 * - 推广占比 = 推广 / 销售
 * - 累积推广占比 = 累积推广 / 累积销售
 * - 累积净销售额 = 累积销售 - 累积退款
 * - 累积净推广费率 = 累积推广 / 累积净销售
 * - 投产比 = 销售 / 推广
 * - 同比去年 = (今年销售 - 去年同期销售) / 去年同期销售
 */
export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId");
  const yearType = (req.nextUrl.searchParams.get("yearType") || "natural") as "natural" | "seasonal";
  const days = parseInt(req.nextUrl.searchParams.get("days") || "90");

  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 });

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  // 根据年类型确定起止日期
  let startDate: Date;
  if (yearType === "seasonal") {
    // 季节年：7/1 - 次年 6/30
    const m = today.getMonth() + 1;
    const seasonYear = m >= 7 ? today.getFullYear() : today.getFullYear() - 1;
    startDate = new Date(seasonYear, 6, 1); // 7月1日
  } else {
    // 自然年：1/1 - 12/31
    startDate = new Date(today.getFullYear(), 0, 1);
  }
  startDate.setHours(0, 0, 0, 0);

  // 查询今年数据
  const records = await db.dailyRecord.findMany({
    where: {
      storeId,
      recordDate: { gte: startDate, lte: today },
    },
    orderBy: { recordDate: "asc" },
  });

  // 查询去年同期数据（用于计算同比）
  const lastYearStart = new Date(startDate);
  lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);
  const lastYearEnd = new Date(today);
  lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1);

  const lastYearRecords = await db.dailyRecord.findMany({
    where: {
      storeId,
      recordDate: { gte: lastYearStart, lte: lastYearEnd },
    },
    orderBy: { recordDate: "asc" },
  });

  // 构建去年同期数据映射 { "MM-DD": salesAmount }
  const lastYearMap = new Map<string, number>();
  for (const r of lastYearRecords) {
    const key = `${r.recordDate.getMonth() + 1}-${r.recordDate.getDate()}`;
    lastYearMap.set(key, r.salesAmount);
  }

  // 计算累积指标
  let cumSales = 0;
  let cumRefund = 0;
  let cumPromotion = 0;

  const rows = records.map((r) => {
    const promotion = r.promotionManualTotal ?? r.promotionTotal;
    cumSales += r.salesAmount;
    cumRefund += r.refundAmount;
    cumPromotion += promotion;

    const netSales = r.salesAmount - r.refundAmount;
    const refundRate = r.salesAmount > 0 ? r.refundAmount / r.salesAmount : 0;
    const promotionRate = r.salesAmount > 0 ? promotion / r.salesAmount : 0;
    const roi = promotion > 0 ? r.salesAmount / promotion : 0;

    const cumNetSales = cumSales - cumRefund;
    const cumPromotionRate = cumSales > 0 ? cumPromotion / cumSales : 0;
    const cumNetPromotionRate = cumNetSales > 0 ? cumPromotion / cumNetSales : 0;

    // 同比去年
    const dateKey = `${r.recordDate.getMonth() + 1}-${r.recordDate.getDate()}`;
    const lastYearSales = lastYearMap.get(dateKey) || 0;
    const yoyGrowth = lastYearSales > 0 ? (r.salesAmount - lastYearSales) / lastYearSales : null;

    return {
      date: r.recordDate.toISOString().slice(0, 10),
      // 原始数据
      sales: Math.round(r.salesAmount * 100) / 100,
      orders: r.orderCount,
      refund: Math.round(r.refundAmount * 100) / 100,
      promotion: Math.round(promotion * 100) / 100,
      visitors: r.visitors,
      // 累积
      cumSales: Math.round(cumSales * 100) / 100,
      cumRefund: Math.round(cumRefund * 100) / 100,
      cumPromotion: Math.round(cumPromotion * 100) / 100,
      cumNetSales: Math.round(cumNetSales * 100) / 100,
      // 比率
      netSales: Math.round(netSales * 100) / 100,
      refundRate: Math.round(refundRate * 10000) / 10000,
      yoyGrowth: yoyGrowth !== null ? Math.round(yoyGrowth * 10000) / 10000 : null,
      promotionRate: Math.round(promotionRate * 10000) / 10000,
      cumPromotionRate: Math.round(cumPromotionRate * 10000) / 10000,
      cumNetPromotionRate: Math.round(cumNetPromotionRate * 10000) / 10000,
      roi: Math.round(roi * 100) / 100,
    };
  });

  // 反序（最新日期在前）
  rows.reverse();

  // 汇总行
  const summary = {
    date: "汇总",
    sales: rows.reduce((a, r) => a + r.sales, 0),
    orders: rows.reduce((a, r) => a + r.orders, 0),
    refund: rows.reduce((a, r) => a + r.refund, 0),
    promotion: rows.reduce((a, r) => a + r.promotion, 0),
    visitors: rows.reduce((a, r) => a + r.visitors, 0),
    cumSales: rows.length > 0 ? rows[0].cumSales : 0, // 最新一条的累积值就是总和
    cumRefund: rows.length > 0 ? rows[0].cumRefund : 0,
    cumPromotion: rows.length > 0 ? rows[0].cumPromotion : 0,
    cumNetSales: rows.length > 0 ? rows[0].cumNetSales : 0,
  };
  summary.netSales = Math.round((summary.sales - summary.refund) * 100) / 100;
  summary.refundRate = summary.sales > 0 ? Math.round(summary.refund / summary.sales * 10000) / 10000 : 0;
  summary.promotionRate = summary.sales > 0 ? Math.round(summary.promotion / summary.sales * 10000) / 10000 : 0;
  summary.cumPromotionRate = summary.cumSales > 0 ? Math.round(summary.cumPromotion / summary.cumSales * 10000) / 10000 : 0;
  summary.cumNetPromotionRate = summary.cumNetSales > 0 ? Math.round(summary.cumPromotion / summary.cumNetSales * 10000) / 10000 : 0;
  summary.roi = summary.promotion > 0 ? Math.round(summary.sales / summary.promotion * 100) / 100 : 0;
  summary.yoyGrowth = null;
  summary.sales = Math.round(summary.sales * 100) / 100;
  summary.refund = Math.round(summary.refund * 100) / 100;
  summary.promotion = Math.round(summary.promotion * 100) / 100;
  summary.cumSales = Math.round(summary.cumSales * 100) / 100;
  summary.cumRefund = Math.round(summary.cumRefund * 100) / 100;
  summary.cumPromotion = Math.round(summary.cumPromotion * 100) / 100;
  summary.cumNetSales = Math.round(summary.cumNetSales * 100) / 100;

  return NextResponse.json({
    yearType,
    startDate: startDate.toISOString().slice(0, 10),
    endDate: today.toISOString().slice(0, 10),
    rows,
    summary,
    totalDays: rows.length,
  });
}
