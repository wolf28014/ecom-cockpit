"use client";

import { useState, useRef } from "react";
import { KpiRow, SectionCard } from "@/components/ecom/kpi";
import { StoreSelector, useStores } from "@/components/ecom/store-selector";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  UploadCloud, FileSpreadsheet, Download, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { importManager } from "@/lib/import-task";

const TEMPLATE_HEADERS = [
  "日期", "销售额", "订单数", "退款金额", "退款订单数",
  "推广费", "商品成本", "运费", "包装", "人工", "房租", "其他",
];

const TEMPLATE_TYPES: Record<string, string> = {
  general: "通用模板",
  shengyi: "生意参谋",
  zhixiaoche: "直通车",
  wanxiangtai: "万相台",
  finance: "财务模板",
};

interface PreviewRow {
  日期: string;
  销售额: number;
  订单数: number;
  退款金额: number;
  退款订单数: number;
  推广费: number;
  商品成本: number;
  运费: number;
  包装: number;
  人工: number;
  房租: number;
  其他: number;
  _status?: "pending" | "ok" | "error";
  _msg?: string;
}

export function DataImportPage() {
  const { stores } = useStores();
  const [storeId, setStoreId] = useState("all");
  const [templateType, setTemplateType] = useState("general");
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("请上传 .xlsx / .xls / .csv 文件");
      return;
    }
    if (storeId === "all") {
      toast.error("请先选择店铺");
      return;
    }
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (rows.length === 0) {
        toast.error("文件无数据");
        return;
      }
      // 自动匹配列名（支持中文表头）
      const parsed: PreviewRow[] = rows.map((r) => {
        const get = (keys: string[]) => {
          for (const k of keys) {
            for (const rk of Object.keys(r)) {
              if (rk.includes(k)) return r[rk];
            }
          }
          return 0;
        };
        const dateRaw = get(["日期", "date", "时间"]) || "";
        let dateStr = "";
        if (dateRaw instanceof Date) dateStr = dateRaw.toISOString().slice(0, 10);
        else if (typeof dateRaw === "number") {
          // Excel serial date
          const d = XLSX.SSF ? new Date(Math.round((dateRaw - 25569) * 86400 * 1000)) : new Date(dateRaw);
          dateStr = d.toISOString().slice(0, 10);
        } else {
          dateStr = String(dateRaw).trim().replace(/\//g, "-");
          // 兼容 yyyy.mm.dd
          if (/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(dateStr)) {
            const [y, m, d] = dateStr.split(".");
            dateStr = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
          }
        }
        const num = (v: any) => Number(v) || 0;
        return {
          日期: dateStr,
          销售额: num(get(["销售额", "sales"])),
          订单数: num(get(["订单数", "订单", "orders"])),
          退款金额: num(get(["退款金额", "退款"])),
          退款订单数: num(get(["退款订单", "退款单"])),
          推广费: num(get(["推广费", "推广"])),
          商品成本: num(get(["商品成本", "商品"])),
          运费: num(get(["运费"])),
          包装: num(get(["包装"])),
          人工: num(get(["人工"])),
          房租: num(get(["房租"])),
          其他: num(get(["其他"])),
          _status: "pending",
        };
      }).filter(r => r.日期);

      setPreviewData(parsed);
      setImportedCount(0);
      setErrorCount(0);
      toast.success(`已解析 ${parsed.length} 行数据`);
    } catch (e) {
      console.error(e);
      toast.error("文件解析失败");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "数据模板");
    XLSX.writeFile(wb, `电商数据模板_${templateType}.xlsx`);
    toast.success("模板已下载");
  };

  const handleImport = async () => {
    if (storeId === "all") { toast.error("请先选择店铺"); return; }
    if (previewData.length === 0) { toast.error("暂无数据"); return; }

    // 获取店铺名
    const storeName = stores.find(s => s.id === storeId)?.name || "店铺";

    // 创建导入任务（全局可见，即使离开页面也能看到进度）
    const taskId = importManager.addTask(storeId, storeName, previewData.length);
    setImporting(true);
    let ok = 0, fail = 0;
    const updated = [...previewData];

    toast.success(`开始后台导入 ${previewData.length} 条数据`, {
      description: "您可以继续操作其他页面，右上角显示进度",
      duration: 3000,
    });

    // 后台异步执行，不阻塞 UI
    (async () => {
      for (let i = 0; i < updated.length; i++) {
        const row = updated[i];
        try {
          const promotionData = { "通用推广": row.推广费 };
          const costData = {
            "商品成本": row.商品成本,
            "运费": row.运费,
            "包装": row.包装,
            "人工": row.人工,
            "房租": row.房租,
            "其他": row.其他,
          };
          const res = await fetch("/api/data-entry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              storeId,
              recordDate: row.日期,
              salesAmount: row.销售额,
              orderCount: row.订单数,
              refundAmount: row.退款金额,
              refundOrderCount: row.退款订单数,
              promotionData,
              costData,
            }),
          });
          if (res.ok) {
            ok++;
            updated[i] = { ...row, _status: "ok" as const };
          } else {
            fail++;
            updated[i] = { ...row, _status: "error" as const, _msg: "保存失败" };
          }
        } catch {
          fail++;
          updated[i] = { ...row, _status: "error" as const, _msg: "网络错误" };
        }
        // 更新全局任务进度
        importManager.updateProgress(taskId, ok, fail);
        // 每 5 条更新一次本地 UI
        if (i % 5 === 0 || i === updated.length - 1) {
          setPreviewData([...updated]);
          setImportedCount(ok);
          setErrorCount(fail);
        }
      }
      setImporting(false);
      importManager.completeTask(taskId, fail === 0 ? "completed" : "failed");
      if (fail === 0) {
        toast.success(`导入完成：成功 ${ok} 条`, { description: "可前往「数据明细」查看" });
      } else {
        toast.warning(`导入完成：成功 ${ok}，失败 ${fail}`);
      }
    })();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Excel 数据导入</h1>
          <p className="text-sm text-muted-foreground mt-1">批量导入每日经营数据，支持 Excel/CSV</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StoreSelector value={storeId} onChange={setStoreId} allowAll={false} />
          <Select value={templateType} onValueChange={setTemplateType}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TEMPLATE_TYPES).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="size-4 mr-1" /> 下载模板
          </Button>
        </div>
      </div>

      <KpiRow cards={[
        { title: "已解析行数", value: String(previewData.length), subtitle: "待导入", accent: "#0071E3" },
        { title: "已导入", value: String(importedCount), subtitle: "成功", accent: "#34C759" },
        { title: "失败", value: String(errorCount), subtitle: "需要检查", accent: errorCount > 0 ? "#FF3B30" : "#6E6E73" },
        { title: "当前店铺", value: storeId === "all" ? "未选择" : "已选择", subtitle: storeId === "all" ? "请先选择" : "可导入", accent: storeId === "all" ? "#FF9500" : "#34C759" },
      ]} />

      <SectionCard title="上传文件" subtitle="拖拽文件到下方区域，或点击选择">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
            ${dragOver ? "border-[#0071E3] bg-[#F0F7FF]" : "border-[#E5E5EA] hover:border-[#0071E3]/60 hover:bg-muted/30"}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleSelectFile}
            className="hidden"
          />
          <UploadCloud className="size-10 mx-auto text-[#0071E3] mb-3" />
          {fileName ? (
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2 text-sm font-medium">
                <FileSpreadsheet className="size-4 text-[#34C759]" />
                {fileName}
              </div>
              <p className="text-xs text-muted-foreground">点击重新选择文件</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-medium">点击或拖拽 Excel 文件到此区域</p>
              <p className="text-xs text-muted-foreground">支持 .xlsx / .xls / .csv，最大 10MB</p>
            </div>
          )}
        </div>
      </SectionCard>

      {previewData.length > 0 && (
        <SectionCard
          title="数据预览"
          subtitle={`共 ${previewData.length} 行，确认无误后点击导入`}
          action={
            <Button size="sm" onClick={handleImport} disabled={importing || storeId === "all"}>
              {importing ? <><Loader2 className="size-4 mr-1 animate-spin" /> 导入中...</> : <>开始导入</>}
            </Button>
          }
        >
          <div className="max-h-[480px] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-12">状态</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead className="text-right">销售额</TableHead>
                  <TableHead className="text-right">订单</TableHead>
                  <TableHead className="text-right">退款</TableHead>
                  <TableHead className="text-right">推广费</TableHead>
                  <TableHead className="text-right">商品成本</TableHead>
                  <TableHead className="text-right">运费</TableHead>
                  <TableHead className="text-right">其他成本</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      {row._status === "ok" ? <CheckCircle2 className="size-4 text-[#34C759]" /> :
                       row._status === "error" ? <AlertCircle className="size-4 text-[#FF3B30]" /> :
                       <span className="text-xs text-muted-foreground">待</span>}
                    </TableCell>
                    <TableCell className="font-medium">{row.日期}</TableCell>
                    <TableCell className="text-right">{row.销售额.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{row.订单数}</TableCell>
                    <TableCell className="text-right">{row.退款金额.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{row.推广费.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{row.商品成本.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{row.运费.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{(row.包装 + row.人工 + row.房租 + row.其他).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}

      <SectionCard title="导入说明" subtitle="请按模板格式整理数据">
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>1. 推广费将统一归类为「通用推广」，如需细分请使用「数据录入」页手动录入；</p>
          <p>2. 日期格式支持 yyyy-mm-dd、yyyy/mm/dd、yyyy.mm.dd 及 Excel 日期序列；</p>
          <p>3. 同一店铺同一日期数据将自动覆盖，请确认后再导入；</p>
          <p>4. 数值字段留空将视为 0；</p>
          <p>5. 支持的模板：通用模板（推荐）/ 生意参谋 / 直通车 / 万相台 / 财务模板。</p>
        </div>
      </SectionCard>
    </div>
  );
}
