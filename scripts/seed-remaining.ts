/**
 * 补全剩余演示数据：利润目标、月度成本、设置、预警
 * （前半部分：店铺/SKU/每日数据已写入）
 */
import { db } from "../src/lib/db";

const PLATFORM_PROMOTION_FIELDS: Record<string, string[]> = {
  taobao: ["货品全站推广", "关键词推广", "人群推广", "店铺直达", "内容营销", "淘宝客", "其它"],
  tmall: ["货品全站推广", "关键词推广", "人群推广", "店铺直达", "内容营销", "淘宝客", "其它"],
  douyin: ["货品全站推广", "关键词推广", "人群推广", "店铺直达", "内容营销", "淘宝客", "其它"],
};

let seedState = 42;
function rand() {
  seedState = (seedState * 9301 + 49297) % 233280;
  return seedState / 233280;
}
const randRange = (min: number, max: number) => min + rand() * (max - min);
const randInt = (min: number, max: number) => Math.floor(randRange(min, max + 1));

async function main() {
  console.log("开始补全剩余数据...");

  const stores = await db.store.findMany();
  if (stores.length === 0) {
    console.log("❌ 没有店铺数据，请先跑 seed.ts");
    return;
  }
  console.log(`✓ 找到 ${stores.length} 个店铺`);

  // 1. 月度成本（覆盖最近 4 个月）
  const today = new Date();
  const monthsToGenerate: { y: number; m: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    monthsToGenerate.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
  }

  for (const store of stores) {
    const scale = store.platform === "taobao" ? 1.0 : (store.platform === "tmall" ? 0.7 : 0.5);
    for (const { y, m } of monthsToGenerate) {
      const existing = await db.monthlyCost.findUnique({
        where: { storeId_year_month: { storeId: store.id, year: y, month: m } },
      });
      if (existing) continue;

      const monthlySales = 8000 * scale * 30;
      const data = {
        goodsCost: Math.round(monthlySales * 0.45 * 100) / 100,
        redPacket: Math.round(monthlySales * 0.02 * 100) / 100,
        labor: Math.round(9000 * scale * 100) / 100,
        other: Math.round(monthlySales * 0.01 * 100) / 100,
        consumerExperience: Math.round(monthlySales * 0.005 * 100) / 100,
        bnplTechFee: Math.round(monthlySales * 0.003 * 100) / 100,
        basicSoftwareFee: Math.round(monthlySales * 0.004 * 100) / 100,
        redPacketAdvance: Math.round(monthlySales * 0.002 * 100) / 100,
        logistics: Math.round(monthlySales * 0.015 * 100) / 100,
        brandGiftFee: Math.round(monthlySales * 0.002 * 100) / 100,
        charity: Math.round(monthlySales * 0.001 * 100) / 100,
        quickPaymentFee: Math.round(monthlySales * 0.002 * 100) / 100,
        marketingPlatform: Math.round(monthlySales * 0.008 * 100) / 100,
      };
      const totalCost = Math.round(Object.values(data).reduce((a, b) => a + b, 0) * 100) / 100;

      await db.monthlyCost.create({
        data: { storeId: store.id, year: y, month: m, ...data, totalCost },
      });
    }
  }
  console.log(`✓ 月度成本写入完成`);

  // 2. 利润目标
  const mainStore = stores[0];
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const quarter = Math.floor((month - 1) / 3) + 1;

  const existingTargets = await db.profitTarget.count();
  if (existingTargets === 0) {
    await db.profitTarget.createMany({
      data: [
        { storeId: mainStore.id, targetType: "yearly", targetYear: year, targetAmount: 3_000_000 },
        { storeId: mainStore.id, targetType: "quarterly", targetYear: year, targetQuarter: quarter, targetAmount: 800_000 },
        { storeId: mainStore.id, targetType: "monthly", targetYear: year, targetMonth: month, targetAmount: 280_000 },
      ],
    });
    console.log(`✓ 利润目标写入完成`);
  } else {
    console.log(`- 利润目标已存在，跳过`);
  }

  // 3. 默认设置
  const existingSettings = await db.setting.count();
  if (existingSettings === 0) {
    await db.setting.createMany({
      data: [
        { key: "theme", value: "light", description: "主题" },
        { key: "ai_model", value: "glm-4-plus", description: "AI 模型" },
        { key: "auto_backup", value: "weekly", description: "自动备份频率" },
        { key: "currency", value: "CNY", description: "货币" },
        { key: "company_name", value: "我的电商公司", description: "公司名称" },
      ],
    });
    console.log(`✓ 系统设置写入完成`);
  } else {
    console.log(`- 系统设置已存在，跳过`);
  }

  // 4. 历史预警
  const existingAlerts = await db.alert.count();
  if (existingAlerts === 0) {
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
    console.log(`✓ 预警数据写入完成`);
  } else {
    console.log(`- 预警数据已存在，跳过`);
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

  console.log("\n🎉 所有演示数据写入完成！");
}

main()
  .catch((e) => { console.error("失败:", e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
