import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserStoreIds } from "@/lib/auth";
import { invalidateCache } from "@/lib/server-cache";

/**
 * SKU 批量导入 API（聚水潭格式）
 * 接收前端解析的 SKU 数据数组，批量创建/更新 SKU 及每日销售数据
 *
 * 聚水潭导出格式（前端解析后传入）：
 * { storeId, date, items: [{ skuCode, skuName, quantity, salesAmount, refundAmount, refundQuantity, stock, cost }] }
 */
export async function POST(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json();
  const { storeId, date, items } = body;

  if (!storeId || !userStoreIds.includes(storeId)) {
    return NextResponse.json({ error: "无权限或未选择店铺" }, { status: 403 });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "无数据" }, { status: 400 });
  }

  const recordDate = new Date(date);
  recordDate.setHours(0, 0, 0, 0);

  // 查找或创建当天的 DailyRecord（如果没有）
  let dailyRecord = await db.dailyRecord.findUnique({
    where: { storeId_recordDate: { storeId, recordDate } },
  });

  if (!dailyRecord) {
    dailyRecord = await db.dailyRecord.create({
      data: { storeId, recordDate },
    });
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const { skuCode, skuName, quantity, salesAmount, refundAmount, refundQuantity, stock, cost } = item;
    if (!skuCode || !skuName) { skipped++; continue; }

    // 查找或创建 SKU
    let sku = await db.sku.findUnique({
      where: { storeId_skuCode: { storeId, skuCode } },
    });

    if (!sku) {
      sku = await db.sku.create({
        data: {
          storeId,
          skuCode,
          skuName,
          stock: Number(stock) || 0,
          unitCost: Number(cost) > 0 && Number(quantity) > 0 ? Number(cost) / Number(quantity) : 0,
        },
      });
      created++;
    } else {
      // 更新库存
      if (stock !== undefined) {
        await db.sku.update({ where: { id: sku.id }, data: { stock: Number(stock) } });
      }
      updated++;
    }

    // 创建或更新 DailySku
    const existingDailySku = await db.dailySku.findUnique({
      where: { dailyRecordId_skuId: { dailyRecordId: dailyRecord.id, skuId: sku.id } },
    });

    const salesNum = Number(salesAmount) || 0;
    const refundNum = Number(refundAmount) || 0;
    const qty = Number(quantity) || 0;
    const costNum = Number(cost) || 0;
    const orders = Math.max(1, Math.floor(qty / 1.5)); // 估算订单数
    const grossProfit = salesNum - costNum - refundNum;

    if (existingDailySku) {
      await db.dailySku.update({
        where: { id: existingDailySku.id },
        data: {
          salesAmount: salesNum,
          orderCount: orders,
          refundAmount: refundNum,
          refundOrderCount: Number(refundQuantity) || 0,
          quantity: qty,
          cost: costNum,
          grossProfit,
          roi: costNum > 0 ? Math.round(salesNum / costNum * 100) / 100 : 0,
          refundRate: salesNum > 0 ? Math.round(refundNum / salesNum * 10000) / 10000 : 0,
        },
      });
    } else {
      await db.dailySku.create({
        data: {
          dailyRecordId: dailyRecord.id,
          skuId: sku.id,
          storeId,
          recordDate,
          salesAmount: salesNum,
          orderCount: orders,
          refundAmount: refundNum,
          refundOrderCount: Number(refundQuantity) || 0,
          quantity: qty,
          cost: costNum,
          grossProfit,
          roi: costNum > 0 ? Math.round(salesNum / costNum * 100) / 100 : 0,
          refundRate: salesNum > 0 ? Math.round(refundNum / salesNum * 10000) / 10000 : 0,
        },
      });
    }
  }

  invalidateCache("dash:");
  invalidateCache("analytics:");
  invalidateCache("profit:");

  return NextResponse.json({
    ok: true,
    total: items.length,
    created,
    updated,
    skipped,
  });
}
