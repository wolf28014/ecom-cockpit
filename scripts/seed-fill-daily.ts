/**
 * 补全单个店铺（抖店）的缺失每日数据
 * 用 Prisma 的 findUnique 而非日期字符串比较
 */
import { db } from "../src/lib/db";

const PROMOTION_FIELDS = [
  "货品全站推广", "关键词推广", "人群推广", "店铺直达", "内容营销", "淘宝客", "其它",
];

let seedState = 42;
function rand() {
  seedState = (seedState * 9301 + 49297) % 233280;
  return seedState / 233280;
}
const randRange = (min: number, max: number) => min + rand() * (max - min);
const randInt = (min: number, max: number) => Math.floor(randRange(min, max + 1));
function pick<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(rand() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

function splitPromotion(total: number): Record<string, number> {
  const weights = PROMOTION_FIELDS.map(() => randRange(0.5, 1.5));
  const sum = weights.reduce((a, b) => a + b, 0);
  const result: Record<string, number> = {};
  PROMOTION_FIELDS.forEach((f, i) => {
    result[f] = Math.round((total * weights[i] / sum) * 100) / 100;
  });
  return result;
}

async function main() {
  console.log("开始补全抖店数据...");

  // 找到数据不足的店铺
  const stores = await db.store.findMany();
  for (const store of stores) {
    const count = await db.dailyRecord.count({ where: { storeId: store.id } });
    if (count >= 90) {
      console.log(`✓ ${store.name}: 已有 ${count} 条，跳过`);
      continue;
    }
    console.log(`\n处理 ${store.name}: 现有 ${count} 条，需要补全`);

    const skus = await db.sku.findMany({ where: { storeId: store.id } });
    const scale = store.platform === "taobao" ? 1.0 : (store.platform === "tmall" ? 0.7 : 0.5);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let inserted = 0;
    let skipped = 0;
    for (let i = 89; i >= 0; i--) {
      const recordDate = new Date(today);
      recordDate.setDate(recordDate.getDate() - i);
      // 关键：强制设置时间为 00:00:00.000 UTC，避免时区/微秒差异
      recordDate.setUTCHours(0, 0, 0, 0);

      // 用 findUnique 检查是否已存在
      const existing = await db.dailyRecord.findUnique({
        where: { storeId_recordDate: { storeId: store.id, recordDate } },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const weekday = recordDate.getDay();
      const weekendBoost = weekday >= 5 ? 1.3 : 1.0;
      const monthEndBoost = recordDate.getDate() >= 28 ? 1.4 : 1.0;
      const monthIdx = Math.floor((89 - i) / 30);
      const trendBoost = 1.0 + monthIdx * 0.05;
      const noise = randRange(0.85, 1.15);

      const salesAmount = Math.round(8000 * scale * weekendBoost * monthEndBoost * trendBoost * noise * 100) / 100;
      const avgPrice = 130;
      const orderCount = Math.max(1, Math.floor(salesAmount / avgPrice));
      const conversionRate = randRange(0.015, 0.03);
      const visitors = Math.max(orderCount, Math.floor(orderCount / conversionRate));
      const refundRate = randRange(0.03, 0.09);
      const refundAmount = Math.round(salesAmount * refundRate * 100) / 100;

      const promoTotalRate = randRange(0.15, 0.25);
      const promoTotal = Math.round(salesAmount * promoTotalRate * 100) / 100;
      const promoData = splitPromotion(promoTotal);

      const netSales = Math.round((salesAmount - refundAmount) * 100) / 100;
      const refundRateCalculated = salesAmount > 0 ? Math.round(refundAmount / salesAmount * 10000) / 10000 : 0;
      const promotionRate = salesAmount > 0 ? Math.round(promoTotal / salesAmount * 10000) / 10000 : 0;
      const roi = promoTotal > 0 ? Math.round(salesAmount / promoTotal * 100) / 100 : 0;
      const avgOrderValue = orderCount > 0 ? Math.round(salesAmount / orderCount * 100) / 100 : 0;
      const conversionRateCalculated = visitors > 0 ? Math.round(orderCount / visitors * 10000) / 10000 : 0;

      try {
        const record = await db.dailyRecord.create({
          data: {
            storeId: store.id,
            recordDate,
            salesAmount,
            orderCount,
            refundAmount,
            visitors,
            promotionData: JSON.stringify(promoData),
            promotionTotal: promoTotal,
            netSales,
            refundRate: refundRateCalculated,
            promotionRate,
            roi,
            avgOrderValue,
            conversionRate: conversionRateCalculated,
          },
        });

        // SKU 销售数据
        const activeCount = randInt(4, 6);
        const activeSkus = pick(skus, Math.min(activeCount, skus.length));
        const weights = activeSkus.length > 2
          ? [0.4, 0.3, ...Array(activeSkus.length - 2).fill(0.3 / (activeSkus.length - 2))]
          : Array(activeSkus.length).fill(0.5);

        for (let j = 0; j < activeSkus.length; j++) {
          const sku = activeSkus[j];
          const w = weights[j] || 0.1;
          const skuSales = Math.round(salesAmount * w * randRange(0.9, 1.1) * 100) / 100;
          const skuOrders = Math.max(1, Math.floor(orderCount * w));
          const skuQty = Math.max(1, Math.floor(skuOrders * randRange(1.0, 1.5)));
          const skuCost = Math.round(sku.unitCost * skuQty * 100) / 100;
          const skuRefund = Math.round(skuSales * refundRate * 100) / 100;
          const skuGross = Math.round((skuSales - skuCost - skuRefund) * 100) / 100;

          await db.dailySku.create({
            data: {
              dailyRecordId: record.id,
              skuId: sku.id,
              storeId: store.id,
              recordDate,
              salesAmount: skuSales,
              orderCount: skuOrders,
              refundAmount: skuRefund,
              quantity: skuQty,
              cost: skuCost,
              grossProfit: skuGross,
              roi: skuCost > 0 ? Math.round(skuSales / skuCost * 100) / 100 : 0,
              refundRate: Math.round(refundRate * 10000) / 10000,
            },
          });
        }

        inserted++;
        if (inserted % 10 === 0) console.log(`  已写入 ${inserted} 条...`);
      } catch (e: any) {
        // 唯一约束冲突，跳过
        if (e.code === "P2002") {
          skipped++;
          continue;
        }
        throw e;
      }
    }
    console.log(`✓ ${store.name}: 新增 ${inserted} 条, 跳过 ${skipped} 条已存在`);
  }

  // 最终统计
  const stats = {
    stores: await db.store.count(),
    skus: await db.sku.count(),
    dailyRecords: await db.dailyRecord.count(),
    dailySkus: await db.dailySku.count(),
    monthlyCosts: await db.monthlyCost.count(),
    profitTargets: await db.profitTarget.count(),
    alerts: await db.alert.count(),
    settings: await db.setting.count(),
  };
  console.log("\n📊 最终数据库统计:");
  Object.entries(stats).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log("\n🎉 数据补全完成！");
}

main()
  .catch((e) => { console.error("失败:", e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
