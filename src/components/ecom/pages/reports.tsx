"use client";

import { useState, useEffect } from "react";
import { KpiRow, SectionCard } from "@/components/ecom/kpi";
import { StoreSelector, RefreshButton } from "@/components/ecom/store-selector";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  FileSpreadsheet, FileText, Presentation, FileDown, Printer,
} from "lucide-react";
import { toast } from "sonner";

const fmtMoney = (v: number) => `¥${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

const PERIOD_OPTIONS = [
  { value: "today", label: "今日" },
  { value: "week", label: "本周" },
  { value: "month", label: "本月" },
  { value: "year", label: "本年" },
];

export function ReportsPage() {
  const [storeId, setStoreId] = useState("all");
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    const sid = storeId === "all" ? "" : `&storeId=${storeId}`;
    fetch(`/api/reports?${sid.slice(1)}&period=${period}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { toast.error("加载失败"); setLoading(false); });
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData(); }, [storeId, period]);

  const summary = data?.summary || {};
  const trend = data?.trend || [];
  const skuTop10 = data?.skuTop10 || [];
  const periodLabel = data?.periodLabel || "";

  const handleExportExcel = async () => {
    try {
      const sid = storeId === "all" ? "" : `&storeId=${storeId}`;
      const url = `/api/reports?${sid.slice(1)}&period=${period}&format=excel`;
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Excel 已开始下载");
    } catch {
      toast.error("导出失败");
    }
  };

  const handlePrint = () => {
    toast.info("已准备好打印版报表，请使用浏览器打印功能保存为 PDF/Word/PPT");
    setTimeout(() => window.print(), 500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">报表中心</h1>
          <p className="text-sm text-muted-foreground mt-1">汇总数据，导出报表，支持 Excel/打印</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StoreSelector value={storeId} onChange={setStoreId} />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <RefreshButton onClick={loadData} loading={loading} />
        </div>
      </div>

      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold">{data?.storeName} - {periodLabel}经营报表</h1>
        <p className="text-sm text-muted-foreground">生成时间：{new Date().toLocaleString("zh-CN")}</p>
      </div>

      <div className="print:hidden">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 px-1">{periodLabel}核心指标</h2>
        <KpiRow cards={[
          { title: "销售额", value: fmtMoney(summary.salesAmount || 0), subtitle: `${summary.orderCount || 0} 单`, accent: "#0071E3" },
          { title: "净利润", value: fmtMoney(summary.netProfit || 0), subtitle: `利润率 ${fmtPct(summary.profitRate || 0)}`, accent: "#34C759" },
          { title: "ROI", value: (summary.roi || 0).toFixed(2), subtitle: `推广费率 ${fmtPct(summary.promotionRate || 0)}`, accent: "#AF52DE" },
          { title: "客单价", value: fmtMoney(summary.avgOrderValue || 0), subtitle: `单均利润 ${fmtMoney(summary.profitPerOrder || 0)}`, accent: "#FF9500" },
          { title: "退款率", value: fmtPct(summary.refundRate || 0), subtitle: `退款 ${fmtMoney(summary.refundAmount || 0)}`, accent: "#FF3B30" },
        ]} />
      </div>

      <SectionCard
        title="导出报表"
        subtitle="选择格式导出当前数据"
        className="print:hidden"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button variant="outline" className="h-20 flex-col gap-1" onClick={handleExportExcel}>
            <FileSpreadsheet className="size-6 text-[#34C759]" />
            <span className="text-sm">导出 Excel</span>
            <span className="text-xs text-muted-foreground">CSV 格式</span>
          </Button>
          <Button variant="outline" className="h-20 flex-col gap-1" onClick={handlePrint}>
            <FileText className="size-6 text-[#0071E3]" />
            <span className="text-sm">导出 PDF</span>
            <span className="text-xs text-muted-foreground">打印为 PDF</span>
          </Button>
          <Button variant="outline" className="h-20 flex-col gap-1" onClick={handlePrint}>
            <FileDown className="size-6 text-[#AF52DE]" />
            <span className="text-sm">导出 Word</span>
            <span className="text-xs text-muted-foreground">打印版</span>
          </Button>
          <Button variant="outline" className="h-20 flex-col gap-1" onClick={handlePrint}>
            <Presentation className="size-6 text-[#FF9500]" />
            <span className="text-sm">导出 PPT</span>
            <span className="text-xs text-muted-foreground">打印版</span>
          </Button>
        </div>
        <div className="mt-3 p-3 bg-[#F0F7FF] rounded-lg flex items-start gap-2 text-xs text-muted-foreground">
          <Printer className="size-4 mt-0.5 text-[#0071E3] shrink-0" />
          <p>提示：浏览器打印（Ctrl/Cmd + P）支持保存为 PDF；高级 Word/PPT 编辑请复制明细表数据到对应软件中处理。</p>
        </div>
      </SectionCard>

      <SectionCard title="近 30 天每日明细" subtitle="按日期倒序">
        <div className="max-h-[480px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>日期</TableHead>
                <TableHead className="text-right">销售额</TableHead>
                <TableHead className="text-right">订单</TableHead>
                <TableHead className="text-right">推广</TableHead>
                <TableHead className="text-right">成本</TableHead>
                <TableHead className="text-right">利润</TableHead>
                <TableHead className="text-right">利润率</TableHead>
                <TableHead className="text-right">ROI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trend.map((p: any) => (
                <TableRow key={p.date}>
                  <TableCell className="font-medium">{p.date}</TableCell>
                  <TableCell className="text-right">{fmtMoney(p.sales)}</TableCell>
                  <TableCell className="text-right">{p.orders}</TableCell>
                  <TableCell className="text-right">{fmtMoney(p.promotion)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(p.cost)}</TableCell>
                  <TableCell className="text-right" style={{ color: p.profit >= 0 ? "#34C759" : "#FF3B30" }}>{fmtMoney(p.profit)}</TableCell>
                  <TableCell className="text-right">{fmtPct(p.profitRate)}</TableCell>
                  <TableCell className="text-right">{p.roi.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {trend.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">暂无数据</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <SectionCard title="Top 10 SKU" subtitle="按销售额排序">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>排名</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">销售额</TableHead>
              <TableHead className="text-right">销量</TableHead>
              <TableHead className="text-right">毛利</TableHead>
              <TableHead className="text-right">ROI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {skuTop10.map((s: any, i: number) => (
              <TableRow key={s.skuId || i}>
                <TableCell><Badge variant="secondary">{i + 1}</Badge></TableCell>
                <TableCell>
                  <div className="font-medium">{s.skuName}</div>
                  <div className="text-xs text-muted-foreground font-mono">{s.skuCode}</div>
                </TableCell>
                <TableCell className="text-right font-semibold text-[#0071E3]">{fmtMoney(s.salesAmount)}</TableCell>
                <TableCell className="text-right">{s.quantity}</TableCell>
                <TableCell className="text-right" style={{ color: s.grossProfit >= 0 ? "#34C759" : "#FF3B30" }}>{fmtMoney(s.grossProfit)}</TableCell>
                <TableCell className="text-right">{s.roi.toFixed(2)}</TableCell>
              </TableRow>
            ))}
            {skuTop10.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">暂无数据</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}
