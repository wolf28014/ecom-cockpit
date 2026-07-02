/**
 * 演示数据 Seed 脚本 V2
 * - 新增 visitors 字段
 * - 推广固定 7 项：货品全站推广/关键词推广/人群推广/店铺直达/内容营销/淘宝客/其它
 * - 月度成本 12 项明细
 * - 生成 90 天每日数据 + 4 个月度成本（覆盖 90 天所在月份）
 */
import { db } from "../src/lib/db";

// 固定 7 个推广渠道
const PROMOTION_FIELDS = [
  "货品全站推广",
  "关键词推广",
  "人群推广",
  "店铺直达",
  "内容营销",
  "淘宝客",
  "其它",
];

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
  console.log("开始 seed 演示数据 V2...");

  const existing = await db.store.count();
  if (existing > 0) {
    console.log(`数据库已有 ${existing} 个店铺，跳过 seed`);
    return;
  }

  // 0. 创建默认用户（demo@ecom.com / demo123）
  const crypto = await import("crypto");
  const salt = "ecom-cockpit-pro-2026";
  const passwordHash = crypto.createHash("sha256").update(salt + "demo123").digest("hex");
  const defaultUser = await db.user.create({
    data: {
      email: "demo@ecom.com",
      passwordHash,
      name: "演示用户",
    },
  });
  console.log(`✓ 创建默认用户: demo@ecom.com (密码: demo123)`);

  // 1. 创建店铺（关联到默认用户）
  for (const s of DEMO_STORES) {
    await db.store.create({ data: { ...s, userId: defaultUser.id } });
  }
  const stores = await db.store.findMany();
  console.log(`✓ 创建 ${stores.length} 个店铺`);

  // 2. SKU
  for (const store of stores) {
    for (const sku of DEMO_SKUS) {
      await db.sku.create({
        data: { ...sku, storeId: store.id, stock: randInt(50, 500) },
      });
    }
  }
  console.log(`✓ 创建 ${DEMO_SKUS.length * stores.length} 个 SKU`);

  // 3. 90 天每日数据
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 收集需要生成月度成本的月份
  const monthsToGenerate = new Set<string>();

  for (const store of stores) {
    const skus = await db.sku.findMany({ where: { storeId: store.id } });
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
      // 访客数：转化率约 1.5%-3%
      const conversionRate = randRange(0.015, 0.03);
      const visitors = Math.max(orderCount, Math.floor(orderCount / conversionRate));
      const refundRate = randRange(0.03, 0.09);
      const refundAmount = Math.round(salesAmount * refundRate * 100) / 100;

      // 推广 7 项
      const promoTotalRate = randRange(0.15, 0.25);
      const promoTotal = Math.round(salesAmount * promoTotalRate * 100) / 100;
      const promoData = splitPromotion(promoTotal);

      // 自动计算
      const netSales = Math.round((salesAmount - refundAmount) * 100) / 100;
      const refundRateCalculated = salesAmount > 0 ? Math.round(refundAmount / salesAmount * 10000) / 10000 : 0;
      const promotionRate = salesAmount > 0 ? Math.round(promoTotal / salesAmount * 10000) / 10000 : 0;
      const roi = promoTotal > 0 ? Math.round(salesAmount / promoTotal * 100) / 100 : 0;
      const avgOrderValue = orderCount > 0 ? Math.round(salesAmount / orderCount * 100) / 100 : 0;
      const conversionRateCalculated = visitors > 0 ? Math.round(orderCount / visitors * 10000) / 10000 : 0;

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

      // 收集月份
      const y = recordDate.getFullYear();
      const m = recordDate.getMonth() + 1;
      monthsToGenerate.add(`${y}-${m}`);

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
    }
  }
  console.log(`✓ 创建 90 天每日数据（含访客数、新推广字段）`);

  // 4. 月度成本（为每个有数据的月份生成）
  for (const store of stores) {
    const scale = store.platform === "taobao" ? 1.0 : (store.platform === "tmall" ? 0.7 : 0.5);
    for (const monthKey of monthsToGenerate) {
      const [y, m] = monthKey.split("-").map(Number);
      // 估算当月销售额（按 30 天 × 日均）
      const monthlySales = 8000 * scale * 30;
      const goodsCost = Math.round(monthlySales * 0.45 * 100) / 100;
      const redPacket = Math.round(monthlySales * 0.02 * 100) / 100;
      const labor = Math.round(9000 * scale * 100) / 100;
      const other = Math.round(monthlySales * 0.01 * 100) / 100;
      const consumerExperience = Math.round(monthlySales * 0.005 * 100) / 100;
      const bnplTechFee = Math.round(monthlySales * 0.003 * 100) / 100;
      const basicSoftwareFee = Math.round(monthlySales * 0.004 * 100) / 100;
      const redPacketAdvance = Math.round(monthlySales * 0.002 * 100) / 100;
      const logistics = Math.round(monthlySales * 0.015 * 100) / 100;
      const brandGiftFee = Math.round(monthlySales * 0.002 * 100) / 100;
      const charity = Math.round(monthlySales * 0.001 * 100) / 100;
      const quickPaymentFee = Math.round(monthlySales * 0.002 * 100) / 100;
      const marketingPlatform = Math.round(monthlySales * 0.008 * 100) / 100;

      const totalCost = Math.round((goodsCost + redPacket + labor + other + consumerExperience + bnplTechFee + basicSoftwareFee + redPacketAdvance + logistics + brandGiftFee + charity + quickPaymentFee + marketingPlatform) * 100) / 100;

      await db.monthlyCost.create({
        data: {
          storeId: store.id,
          year: y,
          month: m,
          goodsCost,
          redPacket,
          labor,
          other,
          consumerExperience,
          bnplTechFee,
          basicSoftwareFee,
          redPacketAdvance,
          logistics,
          brandGiftFee,
          charity,
          quickPaymentFee,
          marketingPlatform,
          totalCost,
        },
      });
    }
  }
  console.log(`✓ 创建 ${monthsToGenerate.size} 个月的成本数据`);

  // 5. 利润目标
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

  // 6. 设置
  await db.setting.createMany({
    data: [
      { key: "theme", value: "light", description: "主题" },
      { key: "ai_model", value: "glm-4-plus", description: "AI 模型" },
      { key: "auto_backup", value: "weekly", description: "自动备份频率" },
      { key: "currency", value: "CNY", description: "货币" },
      { key: "company_name", value: "我的电商公司", description: "公司名称" },
    ],
  });

  // 7. 预警
  const now = new Date();
  await db.alert.createMany({
    data: [
      {
        storeId: mainStore.id, alertType: "refund_rate_high", level: "warning",
        title: "退款率连续 3 天超过阈值",
        content: `店铺【${mainStore.name}】退款率连续 3 天超过 8%，请关注产品质量和售后服务。`,
        triggeredAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        storeId: mainStore.id, alertType: "promotion_roi_low", level: "critical",
        title: "推广投产比偏低",
        content: "推广投产比低于 4，建议优化关键词和出价策略。",
        triggeredAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
    ],
  });
  console.log(`✓ 创建预警数据`);

  console.log("\n🎉 演示数据 V2 写入完成！");
}

main()
  .catch((e) => { console.error("Seed 失败:", e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
