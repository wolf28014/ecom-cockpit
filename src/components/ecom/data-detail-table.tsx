"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StoreMultiSelect } from "@/components/ecom/store-multi-select";
import { YearTypeSelector } from "@/components/ecom/year-type-selector";
import { Label } from "@/components/ui/label";

/**
 * 数据明细表格组件（生意参谋风格）
 * 可嵌入任意页面
 */
export function DataDetailTable() {
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [yearType, setYearType] = useState<"natural" | "seasonal">("natural");
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const sidParam = storeIds.length > 0 ? `&storeIds=${storeIds.join(",")}` : "";
    fetch(`/api/daily-detail?yearType=${yearType}&year=${year}${sidParam}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [storeIds, yearType, year]);

  const rows: any[] = data?.rows || [];
  const summary: any = data?.summary || {};

  const fmtMoney = (v: number) => v?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || "0";
  const fmtPct = (v: number | null) => v === null || v === undefined ? "—" : `${(v * 100).toFixed(2)}%`;
  const fmtYoy = (v: number | null) => {
    if (v === null || v === undefined) return "—";
    const sign = v >= 0 ? "+" : "";
    return `${sign}${(v * 100).toFixed(1)}%`;
  };

  const yearLabel = yearType === "seasonal" ? "季节年" : "自然年";

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* 顶部控制栏 */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">选择店铺（可多选）</Label>
            <StoreMultiSelect value={storeIds} onChange={setStoreIds} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">统计周期</Label>
            <YearTypeSelector yearType={yearType} setYearType={setYearType} year={year} setYear={setYear} />
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-muted-foreground">{yearLabel}周期</p>
            <p className="text-sm font-medium">{data?.startDate || "—"} ~ {data?.endDate || "—"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">共 {data?.totalDays || 0} 天</p>
          </div>
        </div>

        {/* 数据表格 */}
        <div className="overflow-auto" style={{ maxHeight: "60vh" }}>
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-[#0071E3] text-white">
                <th className="sticky left-0 top-0 z-30 bg-[#0071E3] px-3 py-2.5 text-left font-semibold whitespace-nowrap border-r border-white/20">日期</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">销售额</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">订单量</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">退款金额</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">推广费用</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">访客数</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-[#0058B0]">累积销售额</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-[#0058B0]">累积退款</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-[#34C759]">净销售额</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">退款率</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">同比去年</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">推广占比</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-[#0058B0]">累积推广占比</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-[#34C759]">累积净销售额</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-[#0058B0]">累积推广费</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-[#0058B0]">累积净推广费率</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">投产比</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={17} className="text-center py-12 text-muted-foreground">加载中...</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={17} className="text-center py-12 text-muted-foreground">暂无数据</td></tr>
              )}
              {!loading && rows.map((r, i) => (
                <tr key={r.date} className={i % 2 === 0 ? "bg-white" : "bg-[#F8F8FA]"} style={{ height: "32px" }}>
                  <td className="sticky left-0 z-10 px-3 py-2 text-left whitespace-nowrap border-r border-[#E5E5EA] bg-inherit font-medium">{r.date}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(r.sales)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{r.orders}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-[#FF9500]">{fmtMoney(r.refund)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-[#0071E3]">{fmtMoney(r.promotion)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{r.visitors}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap bg-[#F0F7FF] font-medium">{fmtMoney(r.cumSales)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap bg-[#F0F7FF]">{fmtMoney(r.cumRefund)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap bg-[#F0FFF4] font-medium text-[#34C759]">{fmtMoney(r.netSales)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{fmtPct(r.refundRate)}</td>
                  <td className={`px-3 py-2 text-right whitespace-nowrap font-medium ${r.yoyGrowth === null ? "text-muted-foreground" : r.yoyGrowth >= 0 ? "text-[#34C759]" : "text-[#FF3B30]"}`}>{fmtYoy(r.yoyGrowth)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{fmtPct(r.promotionRate)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap bg-[#F0F7FF]">{fmtPct(r.cumPromotionRate)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap bg-[#F0FFF4] font-medium text-[#34C759]">{fmtMoney(r.cumNetSales)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap bg-[#F0F7FF]">{fmtMoney(r.cumPromotion)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap bg-[#F0F7FF]">{fmtPct(r.cumNetPromotionRate)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap font-semibold text-[#AF52DE]">{r.roi.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="sticky bottom-0 z-20">
                <tr className="bg-[#1D1D1F] text-white font-semibold" style={{ height: "40px" }}>
                  <td className="sticky left-0 bottom-0 z-30 bg-[#1D1D1F] px-3 py-2 text-left border-r border-white/20">汇总</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(summary.sales)}</td>
                  <td className="px-3 py-2 text-right">{summary.orders}</td>
                  <td className="px-3 py-2 text-right text-[#FF9500]">{fmtMoney(summary.refund)}</td>
                  <td className="px-3 py-2 text-right text-[#5BA3FF]">{fmtMoney(summary.promotion)}</td>
                  <td className="px-3 py-2 text-right">{summary.visitors}</td>
                  <td className="px-3 py-2 text-right bg-[#0071E3]">{fmtMoney(summary.cumSales)}</td>
                  <td className="px-3 py-2 text-right bg-[#0071E3]">{fmtMoney(summary.cumRefund)}</td>
                  <td className="px-3 py-2 text-right bg-[#34C759]">{fmtMoney(summary.netSales)}</td>
                  <td className="px-3 py-2 text-right">{fmtPct(summary.refundRate)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                  <td className="px-3 py-2 text-right">{fmtPct(summary.promotionRate)}</td>
                  <td className="px-3 py-2 text-right bg-[#0071E3]">{fmtPct(summary.cumPromotionRate)}</td>
                  <td className="px-3 py-2 text-right bg-[#34C759]">{fmtMoney(summary.cumNetSales)}</td>
                  <td className="px-3 py-2 text-right bg-[#0071E3]">{fmtMoney(summary.cumPromotion)}</td>
                  <td className="px-3 py-2 text-right bg-[#0071E3]">{fmtPct(summary.cumNetPromotionRate)}</td>
                  <td className="px-3 py-2 text-right text-[#AF52DE]">{summary.roi.toFixed(2)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
