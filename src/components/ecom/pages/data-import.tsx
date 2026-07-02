"use client";

import { useState, useRef } from "react";
import { KpiRow, SectionCard } from "@/components/ecom/kpi";
import { StoreSelector, useStores } from "@/components/ecom/store-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  UploadCloud, FileSpreadsheet, Download, CheckCircle2, AlertCircle, Loader2, Package,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { importManager } from "@/lib/import-task";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
          <p>3. <span className="text-[#0071E3] font-medium">同一店铺同一日期数据将自动覆盖</span>，重复导入不会产生重复数据，直接更新为最新值；</p>
          <p>4. 数值字段留空将视为 0；</p>
          <p>5. 支持的模板：通用模板（推荐）/ 生意参谋 / 直通车 / 万相台 / 财务模板。</p>
        </div>
      </SectionCard>

      {/* 聚水潭 SKU 销量导入 */}
      <SkuImportSection storeId={storeId} />

      {/* 月度成本导入 */}
      <CostImportSection storeId={storeId} />
    </div>
  );
}

// =================== 聚水潭 SKU 导入 ===================
function SkuImportSection({ storeId }: { storeId: string }) {
  const [skuFile, setSkuFile] = useState<File | null>(null);
  const [skuDate, setSkuDate] = useState(new Date().toISOString().slice(0, 10));
  const [skuPreview, setSkuPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  const handleSkuFile = async (file: File) => {
    setSkuFile(file);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws);

      // 聚水潭导出格式字段映射（模糊匹配）
      const findKey = (row: any, aliases: string[]): string | null => {
        for (const key of Object.keys(row)) {
          if (aliases.some(a => key.includes(a))) return key;
        }
        return null;
      };

      const parsed = rows.map(row => {
        const skuCodeKey = findKey(row, ["SKU", "商品编码", "货号"]);
        const skuNameKey = findKey(row, ["商品名称", "组合名称", "品名", "名称"]);
        const qtyKey = findKey(row, ["销售数量", "销量", "数量"]);
        const salesKey = findKey(row, ["销售金额", "销售额", "金额"]);
        const refundQtyKey = findKey(row, ["退款数量", "退货数量"]);
        const refundKey = findKey(row, ["退款金额", "退货金额"]);
        const stockKey = findKey(row, ["库存", "可用库存"]);
        const costKey = findKey(row, ["成本", "商品成本"]);

        return {
          skuCode: skuCodeKey ? String(row[skuCodeKey] || "") : "",
          skuName: skuNameKey ? String(row[skuNameKey] || "") : "",
          quantity: qtyKey ? Number(row[qtyKey]) || 0 : 0,
          salesAmount: salesKey ? Number(row[salesKey]) || 0 : 0,
          refundQuantity: refundQtyKey ? Number(row[refundQtyKey]) || 0 : 0,
          refundAmount: refundKey ? Number(row[refundKey]) || 0 : 0,
          stock: stockKey ? Number(row[stockKey]) || 0 : 0,
          cost: costKey ? Number(row[costKey]) || 0 : 0,
        };
      }).filter(r => r.skuCode && r.skuName);

      setSkuPreview(parsed);
      toast.success(`解析到 ${parsed.length} 条 SKU 数据`);
    } catch {
      toast.error("文件解析失败");
    }
  };

  const handleSkuImport = async () => {
    if (storeId === "all") { toast.error("请先选择店铺"); return; }
    if (skuPreview.length === 0) { toast.error("无数据"); return; }
    setImporting(true);
    try {
      const res = await fetch("/api/sku-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, date: skuDate, items: skuPreview }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`SKU 导入完成`, {
          description: `新增 ${data.created} · 更新 ${data.updated} · 跳过 ${data.skipped}`,
        });
        setSkuPreview([]);
        setSkuFile(null);
      } else {
        toast.error(data.error || "导入失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setImporting(false);
    }
  };

  return (
    <SectionCard title="聚水潭 SKU 销量导入" subtitle="上传聚水潭导出的 SKU 销量数据">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">数据日期</Label>
            <Input type="date" value={skuDate} onChange={e => setSkuDate(e.target.value)} className="w-[180px]" />
          </div>
          <div className="space-y-1.5 flex-1">
            <Label className="text-xs">选择聚水潭导出的 Excel 文件</Label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={e => e.target.files?.[0] && handleSkuFile(e.target.files[0])}
              className="block w-full text-sm text-muted-foreground
                file:mr-3 file:py-2 file:px-4 file:rounded-lg
                file:border-0 file:text-sm file:font-medium
                file:bg-[#0071E3] file:text-white
                hover:file:bg-[#0058B0] file:cursor-pointer"
            />
          </div>
          <Button
            onClick={handleSkuImport}
            disabled={importing || skuPreview.length === 0 || storeId === "all"}
          >
            {importing ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Package className="size-4 mr-1" />}
            导入 {skuPreview.length > 0 ? `(${skuPreview.length}条)` : ""}
          </Button>
        </div>

        {skuFile && (
          <p className="text-xs text-muted-foreground">已选择：{skuFile.name}</p>
        )}

        {skuPreview.length > 0 && (
          <div className="max-h-[300px] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU编码</TableHead>
                  <TableHead>商品名称</TableHead>
                  <TableHead className="text-right">销量</TableHead>
                  <TableHead className="text-right">销售额</TableHead>
                  <TableHead className="text-right">成本</TableHead>
                  <TableHead className="text-right">库存</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skuPreview.slice(0, 20).map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-mono">{s.skuCode}</TableCell>
                    <TableCell>{s.skuName}</TableCell>
                    <TableCell className="text-right">{s.quantity}</TableCell>
                    <TableCell className="text-right">¥{s.salesAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-right">¥{s.cost.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{s.stock}</TableCell>
                  </TableRow>
                ))}
                {skuPreview.length > 20 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-xs text-muted-foreground">
                      还有 {skuPreview.length - 20} 条数据...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="rounded-lg bg-[#F5F5F7] p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">聚水潭导出格式说明：</p>
          <p>支持自动识别以下字段（模糊匹配列名）：</p>
          <p>• SKU编码（商品SKU/商品编码/货号） · 商品名称（组合名称/品名）</p>
          <p>• 销售数量 · 销售金额 · 退款数量 · 退款金额 · 库存 · 成本</p>
          <p>导入后自动创建/更新 SKU 并生成当日销售数据。</p>
        </div>
      </div>
    </SectionCard>
  );
}

// =================== 月度成本导入（业务大类格式） ===================
// 导入格式：月份 | 业务大类 | 扣费金额合计(元)
// 不能分类的自动归到"其它"
function CostImportSection({ storeId }: { storeId: string }) {
  const [costFile, setCostFile] = useState<File | null>(null);
  const [costPreview, setCostPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  // 业务大类 → 数据库字段映射
  const CATEGORY_MAP: Record<string, string> = {
    "货品成本": "goodsCost",
    "商品成本": "goodsCost",
    "红包": "redPacket",
    "人工": "labor",
    "消费者体验提升计划服务费": "consumerExperience",
    "消费者体验": "consumerExperience",
    "先用后付技术服务费": "bnplTechFee",
    "先用后付": "bnplTechFee",
    "基础软件服务费": "basicSoftwareFee",
    "限时红包代商家垫付扣回": "redPacketAdvance",
    "红包垫付": "redPacketAdvance",
    "商家集运物流服务费": "logistics",
    "集运物流": "logistics",
    "物流": "logistics",
    "品牌新享淘宝礼金软件服务费": "brandGiftFee",
    "品牌礼金": "brandGiftFee",
    "公益宝贝": "charity",
    "淘宝极速回款手动回款服务费": "quickPaymentFee",
    "极速回款": "quickPaymentFee",
    "营销平台": "marketingPlatform",
    "税务": "tax",
  };

  // 模糊匹配业务大类
  function matchCategory(label: string): string {
    const trimmed = label.trim();
    // 精确匹配
    if (CATEGORY_MAP[trimmed]) return CATEGORY_MAP[trimmed];
    // 模糊匹配
    for (const [key, field] of Object.entries(CATEGORY_MAP)) {
      if (trimmed.includes(key) || key.includes(trimmed)) return field;
    }
    return "other"; // 不能分类的归到"其它"
  }

  const handleCostFile = async (file: File) => {
    setCostFile(file);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws);

      // 模糊匹配列名
      const findKey = (row: any, aliases: string[]): string | null => {
        for (const key of Object.keys(row)) {
          if (aliases.some(a => key.includes(a))) return key;
        }
        return null;
      };

      // 按月份+大类分组
      const grouped: Record<string, Record<string, number>> = {}; // { "2026-07": { goodsCost: 100, other: 50 } }

      for (const row of rows) {
        const monthKey = findKey(row, ["月份", "月", "时间"]);
        const categoryKey = findKey(row, ["业务大类", "大类", "类目", "项目", "类型"]);
        const amountKey = findKey(row, ["扣费金额合计", "扣费金额", "金额", "费用"]);

        if (!monthKey || !categoryKey || !amountKey) continue;

        let monthStr = String(row[monthKey] || "").trim();
        // 处理各种月份格式：2026-07 / 2026年7月 / 202607 / Excel日期
        if (typeof row[monthKey] === "number") {
          // Excel 日期序列
          const date = XLSX.SSF.parse_date_code(row[monthKey]);
          if (date) monthStr = `${date.y}-${String(date.m).padStart(2, "0")}`;
        }
        monthStr = monthStr.replace(/年|月/g, "-").replace(/-/g, "-").replace(/^(\d{4})-(\d{1,2})$/, (m, y, mo) => `${y}-${mo.padStart(2, "0")}`);
        if (!/^\d{4}-\d{2}$/.test(monthStr)) continue;

        const categoryLabel = String(row[categoryKey] || "").trim();
        const field = matchCategory(categoryLabel);
        const amount = Number(row[amountKey]) || 0;

        if (!grouped[monthStr]) grouped[monthStr] = {};
        grouped[monthStr][field] = (grouped[monthStr][field] || 0) + amount;
      }

      // 转成预览数组
      const preview = Object.entries(grouped).map(([month, costs]) => ({
        month,
        ...costs,
        total: Object.values(costs).reduce((a: number, b: number) => a + b, 0),
      })).sort((a, b) => a.month.localeCompare(b.month));

      setCostPreview(preview);
      toast.success(`解析到 ${preview.length} 个月的成本数据`);
    } catch {
      toast.error("文件解析失败");
    }
  };

  const handleCostImport = async () => {
    if (storeId === "all") { toast.error("请先选择店铺"); return; }
    if (costPreview.length === 0) { toast.error("无数据"); return; }
    setImporting(true);
    try {
      let ok = 0;
      let fail = 0;
      for (const item of costPreview) {
        const [year, month] = item.month.split("-");
        const res = await fetch("/api/monthly-cost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId,
            year: Number(year),
            month: Number(month),
            goodsCost: item.goodsCost || 0,
            redPacket: item.redPacket || 0,
            labor: item.labor || 0,
            other: item.other || 0,
            consumerExperience: item.consumerExperience || 0,
            bnplTechFee: item.bnplTechFee || 0,
            basicSoftwareFee: item.basicSoftwareFee || 0,
            redPacketAdvance: item.redPacketAdvance || 0,
            logistics: item.logistics || 0,
            brandGiftFee: item.brandGiftFee || 0,
            charity: item.charity || 0,
            quickPaymentFee: item.quickPaymentFee || 0,
            marketingPlatform: item.marketingPlatform || 0,
            tax: item.tax || 0,
          }),
        });
        if (res.ok) {
          ok++;
        } else {
          fail++;
          const err = await res.json().catch(() => ({}));
          console.error(`导入 ${item.month} 失败:`, err);
        }
      }
      if (fail === 0) {
        toast.success(`成本导入完成：${ok} 个月`);
      } else {
        toast.warning(`导入完成：成功 ${ok}，失败 ${fail}`);
      }
      setCostPreview([]);
      setCostFile(null);
    } catch (e: any) {
      toast.error("导入失败", { description: e.message?.slice(0, 100) });
    } finally {
      setImporting(false);
    }
  };

  const FIELD_LABELS: Record<string, string> = {
    goodsCost: "货品成本", redPacket: "红包", labor: "人工", other: "其它",
    consumerExperience: "消费者体验", bnplTechFee: "先用后付", basicSoftwareFee: "基础软件费",
    redPacketAdvance: "红包垫付", logistics: "集运物流", brandGiftFee: "品牌礼金",
    charity: "公益宝贝", quickPaymentFee: "极速回款", marketingPlatform: "营销平台", tax: "税务",
  };

  return (
    <SectionCard title="月度成本导入" subtitle="格式：月份 | 业务大类 | 扣费金额合计">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5 flex-1">
            <Label className="text-xs">选择成本明细 Excel 文件</Label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={e => e.target.files?.[0] && handleCostFile(e.target.files[0])}
              className="block w-full text-sm text-muted-foreground
                file:mr-3 file:py-2 file:px-4 file:rounded-lg
                file:border-0 file:text-sm file:font-medium
                file:bg-[#34C759] file:text-white
                hover:file:bg-[#2BB24C] file:cursor-pointer"
            />
          </div>
          <Button
            onClick={handleCostImport}
            disabled={importing || costPreview.length === 0 || storeId === "all"}
          >
            {importing ? <Loader2 className="size-4 mr-1 animate-spin" /> : <FileSpreadsheet className="size-4 mr-1" />}
            导入 {costPreview.length > 0 ? `(${costPreview.length}月)` : ""}
          </Button>
        </div>

        {costFile && <p className="text-xs text-muted-foreground">已选择：{costFile.name}</p>}

        {costPreview.length > 0 && (
          <div className="max-h-[400px] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>月份</TableHead>
                  {Object.entries(FIELD_LABELS).map(([key, label]) => (
                    <TableHead key={key} className="text-right">{label}</TableHead>
                  ))}
                  <TableHead className="text-right font-bold">合计</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costPreview.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{item.month}</TableCell>
                    {Object.entries(FIELD_LABELS).map(([key]) => (
                      <TableCell key={key} className="text-right text-xs">
                        {item[key] ? `¥${Number(item[key]).toLocaleString()}` : "—"}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-bold text-[#FF3B30]">¥{item.total.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="rounded-lg bg-[#F5F5F7] p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">导入格式说明：</p>
          <p>Excel 需包含 3 列：<b>月份</b> | <b>业务大类</b> | <b>扣费金额合计(元)</b></p>
          <p>月份格式：2026-07 / 2026年7月 / 202607 均可</p>
          <p>业务大类自动匹配以下分类（模糊匹配）：</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1 mt-1">
            {Object.entries(FIELD_LABELS).map(([key, label]) => (
              <span key={key} className="text-[10px]">• {label}</span>
            ))}
          </div>
          <p className="mt-1 text-[#FF9500]">⚠ 不能匹配的业务大类自动归到「其它」</p>
          <p>同月数据重复导入将自动覆盖。</p>
        </div>
      </div>
    </SectionCard>
  );
}
