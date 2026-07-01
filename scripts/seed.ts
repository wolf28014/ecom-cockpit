/**
 * 演示数据 Seed 脚本
 * 运行: bun run db:seed
 */
import { db } from "../src/lib/db";

const PLATFORM_PROMOTION_FIELDS: Record<string, string[]> = {
  taobao: ["直通车", "万相台", "引力魔方", "淘宝客", "其他"],
  tmall: ["直通车", "万相台", "引力魔方", "淘宝客", "品牌专区", "其他"],
  douyin: ["千川投放", "小店随心推", "达人推广", "直播投放", "其他"],
  pinduoduo: ["多多搜索", "多多场景", "多多进宝", "明星店铺", "其他"],
};

const DEMO_STORES = [
  { name: "潮流数码旗舰店", platform: "taobao", shopUrl: "https://shop12345.taobao.com", contact: "张老板", note: "主营数码配件、智能家居" },
  { name: "美妆精选天猫店", platform: "tmall", shopUrl: "https://meizhuang.tmall.com", contact: "李老板", note: "美妆个护品类" },
  { name: "潮流服饰抖店", platform: "douyin", shopUrl: "https://douyin.com/shop/fushi", contact: "王老板", note: "女装直播带货" },
];

const DEMO_SKUS = [
  { skuCode: "SP-001", skuName: "无线蓝牙耳机 Pro", category: "数码", unitCost: 65, unitPrice: 199 },
  { skuCode: "SP-002", skuName: "便携充电宝 20000mAh", category: "数码", unitCost: 45, unitPrice: 129 },
  { skuCode: "SP-003", skuName: "智能手表运动版", category: "数码", unitCost: 120, unitPrice: 359 },
  { skuCode: "SP-004", skuName: "Type-C 数据线 3米", category: "数码", unitCost: 5, unitPrice: 29 },
  { skuCode: "SP-005", skuName: "便携蓝牙音箱", category: "数码", unitCost: 80, unitPrice: 219 },
  { skuCode: "SP-006", skuName: "手机支架铝合金", category: "数码", unitCost: 12, unitPrice: 49 },
  { skuCode: "SP-007", skuName: "智能台灯护眼", category: "智能家居", unitCost: 55, unitPrice: 159 },
  { skuCode: "SP-008", skuName: "加湿器 4L 大容量", category: "智能家居", unitCost: 38, unitPrice: 109 },
  { skuCode: "SP-009", skuName: "电动牙刷声波", category: "个护", unitCost: 28, unitPrice: 99 },
  { skuCode: "SP-010", skuName: "车载空气净化器", category: "智能家居", unitCost: 75, unitPrice: 229 },
  { skuCode: "SP-011", skuName: "USB 拓展坞 7合1", category: "数码", unitCost: 35, unitPrice: 99 },
  { skuCode: "SP-012", skuName: "无线鼠标静音", category: "数码", unitCost: 18, unitPrice: 59 },
];

let seedState = 42;
function rand(): number {
  seedState = (seedState * 9301 + 49297) % 233280;
  return seedState / 233280;
}
function randRange(min: number, max: number) {
  return min + rand() * (max - min);
}
function randInt(min: number, max: number) {
  return Math.floor(randRange(min, max + 1));
}
function pick<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(rand() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

function splitPromotion(total: number, fields: string[]): Record<string, number> {
  const weights = fields.map(() => randRange(0.5, 1.5));
  const sum = weights.reduce((a, b) => a + b, 0);
  const result: Record<string, number> = {};
  fields.forEach((f, i) => {
    result[f] = Math.round((total * weights[i] / sum) * 100) / 100;
  });
  return result;
}

async function main() {
  console.log("开始 seed 演示数据...");

  const existing = await db.store.count();
  if (existing > 0) {
    console.log(`数据库已有 ${existing} 个店铺，跳过 seed`);
    return;
  }

  // 1. 创建店铺
  for (const s of DEMO_STORES) {
    await db.store.create({ data: s });
  }
  const stores = await db.store.findMany();
  console.log(`✓ 创建 ${stores.length} 个店铺`);

  // 2. 为每个店铺创建 SKU
  for (const store of stores) {
    for (const sku of DEMO_SKUS) {
      await db.sku.create({
        data: {
          ...sku,
          storeId: store.id,
          stock: randInt(50, 500),
        },
      });
    }
  }
  console.log(`✓ 创建 ${DEMO_SKUS.length * stores.length} 个 SKU`);

  // 3. 生成 90 天历史数据
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const store of stores) {
    const skus = await db.sku.findMany({ where: { storeId: store.id } });
    const platformFields = PLATFORM_PROMOTION_FIELDS[store.platform] || ["其他"];
    const scale = store.platform === "taobao" ? 1.0 : (store.platform === "tmall" ? 0.7 : 0.5);

    for (let i = 89; i >= 0; i--) {
      const recordDate = new Date(today);
      recordDate.setDate(recordDate.getDate() - i);

      const weekday = recordDate.getDay();
      const weekendBoost = weekday >= 5 ? 1.3 : 1.0;
      const monthEndBoost = recordDate.getDate() >= 28 ? 1.4 : 1.0;
      const monthIdx = Math.floor((89 - i) / 30);
      const trendBoost = 1.0 + monthIdx * 0.05;
      const noise = randRange(0.85, 1.15);

      const salesAmount = Math.round(8000 * scale * weekendBoost * monthEndBoost * trendBoost * noise * 100) / 100;
      const avgPrice = 130;
      const orderCount = Math.max(1, Math.floor(salesAmount / avgPrice));
      const refundRate = randRange(0.03, 0.09);
      const refundAmount = Math.round(salesAmount * refundRate * 100) / 100;
      const refundOrderCount = Math.floor(orderCount * refundRate);

      const promoTotalRate = randRange(0.15, 0.25);
      const promoTotal = Math.round(salesAmount * promoTotalRate * 100) / 100;
      const promoData = splitPromotion(promoTotal, platformFields);

      const goodsCost = Math.round(salesAmount * 0.45 * 100) / 100;
      const shippingCost = Math.round(orderCount * randRange(3, 5) * 100) / 100;
      const packageCost = Math.round(orderCount * randRange(0.8, 1.5) * 100) / 100;
      const laborCost = Math.round(300 * scale * 100) / 100;
      const rentCost = Math.round(200 * scale * 100) / 100;
      const otherCost = Math.round(salesAmount * 0.02 * 100) / 100;

      const costData = {
        "商品成本": goodsCost,
        "运费": shippingCost,
        "包装": packageCost,
        "人工": laborCost,
        "房租": rentCost,
        "其他": otherCost,
      };
      const costTotal = Math.round(Object.values(costData).reduce((a, b) => a + b, 0) * 100) / 100;

      const grossProfit = Math.round((salesAmount - goodsCost - refundAmount) * 100) / 100;
      const netProfit = Math.round((grossProfit - promoTotal - shippingCost - packageCost - laborCost - rentCost - otherCost) * 100) / 100;
      const profitRate = salesAmount > 0 ? Math.round(netProfit / salesAmount * 10000) / 10000 : 0;
      const roi = promoTotal > 0 ? Math.round(salesAmount / promoTotal * 100) / 100 : 0;
      const avgOrderValue = orderCount > 0 ? Math.round(salesAmount / orderCount * 100) / 100 : 0;
      const profitPerOrder = orderCount > 0 ? Math.round(netProfit / orderCount * 100) / 100 : 0;

      const record = await db.dailyRecord.create({
        data: {
          storeId: store.id,
          recordDate,
          salesAmount,
          orderCount,
          refundAmount,
          refundOrderCount,
          promotionData: JSON.stringify(promoData),
          promotionTotal: promoTotal,
          costData: JSON.stringify(costData),
          costTotal,
          grossProfit,
          netProfit,
          profitRate,
          roi,
          avgOrderValue,
          profitPerOrder,
          refundRate: Math.round(refundRate * 10000) / 10000,
          promotionRate: Math.round(promoTotalRate * 10000) / 10000,
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
            refundOrderCount: Math.floor(skuOrders * refundRate),
            quantity: skuQty,
            cost: skuCost,
            grossProfit: skuGross,
            roi: skuCost > 0 ? Math.round(skuSales / skuCost * 100) / 100 : 0,
            refundRate: Math.round(refundRate * 10000) / 10000,
          },
        });
      }
    }
  }
  console.log(`✓ 创建 90 天每日数据`);

  // 4. 利润目标
  const mainStore = stores[0];
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const quarter = Math.floor((month - 1) / 3) + 1;
  await db.profitTarget.createMany({
    data: [
      { storeId: mainStore.id, targetType: "yearly", targetYear: year, targetAmount: 3_000_000 },
      { storeId: mainStore.id, targetType: "quarterly", targetYear: year, targetQuarter: quarter, targetAmount: 800_000 },
      { storeId: mainStore.id, targetType: "monthly", targetYear: year, targetMonth: month, targetAmount: 280_000 },
    ],
  });
  console.log(`✓ 创建利润目标`);

  // 5. 默认设置
  await db.setting.createMany({
    data: [
      { key: "theme", value: "light", description: "主题" },
      { key: "ai_model", value: "glm-4-plus", description: "AI 模型" },
      { key: "auto_backup", value: "weekly", description: "自动备份频率" },
      { key: "currency", value: "CNY", description: "货币" },
      { key: "company_name", value: "我的电商公司", description: "公司名称" },
    ],
  });

  // 6. 历史预警
  const now = new Date();
  await db.alert.createMany({
    data: [
      {
        storeId: mainStore.id,
        alertType: "refund_rate_high",
        level: "warning",
        title: "退款率连续 3 天超过阈值",
        content: `店铺【${mainStore.name}】退款率连续 3 天超过 8%，请关注产品质量和售后服务。`,
        triggeredAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        storeId: mainStore.id,
        alertType: "promotion_roi_low",
        level: "critical",
        title: "直通车 ROI 偏低",
        content: "直通车 ROI 低于 1.5，建议优化关键词和出价策略。",
        triggeredAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        storeId: mainStore.id,
        alertType: "profit_decline",
        level: "warning",
        title: "昨日净利润环比下降 18%",
        content: "昨日净利润环比下降 18%，主要受推广成本上升影响。",
        triggeredAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      },
    ],
  });
  console.log(`✓ 创建预警数据`);

  console.log("\n🎉 演示数据写入完成！");
}

main()
  .catch((e) => {
    console.error("Seed 失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
