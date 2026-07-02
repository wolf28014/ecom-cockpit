import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserStoreIds } from "@/lib/auth";
import { db } from "@/lib/db";

// 成本明细列表：返回所有月度成本记录（含店铺名）
export async function GET(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const storeIdsParam = req.nextUrl.searchParams.get("storeIds");
  let storeIdArray = storeIdsParam
    ? storeIdsParam.split(",").filter(Boolean).filter(id => userStoreIds.includes(id))
    : userStoreIds;
  if (storeIdArray.length === 0) storeIdArray = userStoreIds;

  const costs = await db.monthlyCost.findMany({
    where: { storeId: { in: storeIdArray } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  // 查店铺名
  const stores = await db.store.findMany({
    where: { id: { in: storeIdArray } },
    select: { id: true, name: true },
  });
  const storeNameMap = new Map(stores.map(s => [s.id, s.name]));

  const result = costs.map(c => ({
    ...c,
    storeName: storeNameMap.get(c.storeId) || "—",
  }));

  return NextResponse.json(result);
}
