import { useState, useMemo } from "react";
import {
  Sample,
  SampleBatch,
  SampleStatus,
  SAMPLE_STATUS_LABELS,
  DEVELOPMENT_STAGES,
  PRESERVATION_METHODS,
  getAllCaseNumbers,
  calculateTemperatureStats,
} from "./batchStorage";

interface SampleExportSummaryProps {
  samples: Sample[];
  batches: SampleBatch[];
  onBack: () => void;
}

type ReviewStatusOption = "ALL" | "PENDING" | "NEEDS_REVIEW" | "PHOTO_COMPLETED" | "CONFIRMED";

const REVIEW_STATUS_OPTIONS: Array<{ value: ReviewStatusOption; label: string }> = [
  { value: "ALL", label: "全部状态" },
  { value: "PENDING", label: "待鉴定" },
  { value: "NEEDS_REVIEW", label: "需复核种属" },
  { value: "PHOTO_COMPLETED", label: "已完成拍照" },
  { value: "CONFIRMED", label: "已确认" },
];

type ExportTemplate = "FIELD_REPORT" | "LAB_HANDOVER" | "CASE_ARCHIVE";

const EXPORT_TEMPLATES: Array<{ value: ExportTemplate; label: string; icon: string; description: string }> = [
  { value: "FIELD_REPORT", label: "现场快速汇报", icon: "🚓", description: "简洁突出现场情况，适用于案情通报" },
  { value: "LAB_HANDOVER", label: "实验室交接", icon: "🧪", description: "强调保存条件与待处理项，适用于样本转交" },
  { value: "CASE_ARCHIVE", label: "案件归档", icon: "📁", description: "信息完整格式规范，适用于档案留存" },
];

export default function SampleExportSummary({
  samples,
  batches,
  onBack,
}: SampleExportSummaryProps) {
  const [selectedCase, setSelectedCase] = useState<string>("");
  const [selectedDevelopmentStage, setSelectedDevelopmentStage] = useState<string>("");
  const [selectedPreservationMethod, setSelectedPreservationMethod] = useState<string>("");
  const [selectedReviewStatus, setSelectedReviewStatus] = useState<ReviewStatusOption>("ALL");
  const [selectedTemplate, setSelectedTemplate] = useState<ExportTemplate>("FIELD_REPORT");
  const [copyFeedback, setCopyFeedback] = useState("");

  const allCaseNumbers = useMemo(() => getAllCaseNumbers(batches, samples), [batches, samples]);

  const filteredSamples = useMemo(() => {
    return samples.filter((s) => {
      if (selectedCase && s.relatedCase !== selectedCase) return false;
      if (selectedDevelopmentStage && s.developmentStage !== selectedDevelopmentStage) return false;
      if (selectedPreservationMethod && s.preservationMethod !== selectedPreservationMethod) return false;
      if (selectedReviewStatus !== "ALL") {
        if (selectedReviewStatus === "PENDING" && s.status !== "PENDING_IDENTIFICATION") return false;
        if (selectedReviewStatus === "NEEDS_REVIEW" && s.status !== "NEEDS_REVIEW") return false;
        if (selectedReviewStatus === "PHOTO_COMPLETED" && s.status !== "PHOTO_COMPLETED") return false;
        if (selectedReviewStatus === "CONFIRMED" && s.status !== "CONFIRMED") return false;
      }
      return true;
    });
  }, [samples, selectedCase, selectedDevelopmentStage, selectedPreservationMethod, selectedReviewStatus]);

  const getTemperatureRange = (sample: Sample): string => {
    const stats = calculateTemperatureStats(sample.temperatureRecords);
    const envTemp = sample.environmentTemperature ? parseFloat(sample.environmentTemperature) : null;

    const temps: number[] = [];
    if (stats.min !== null) temps.push(stats.min);
    if (stats.max !== null) temps.push(stats.max);
    if (envTemp !== null && !isNaN(envTemp)) temps.push(envTemp);

    if (temps.length === 0) return "无记录";
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    if (min === max) return `${min.toFixed(1)}℃`;
    return `${min.toFixed(1)}℃ ~ ${max.toFixed(1)}℃`;
  };

  const getPendingItems = (sample: Sample): string[] => {
    const items: string[] = [];
    if (sample.status === "PENDING_IDENTIFICATION") items.push("待鉴定");
    if (sample.status === "NEEDS_REVIEW") items.push("需复核种属");
    if (sample.status === "PHOTO_COMPLETED") items.push("拍照完成，待归档");
    if (!sample.insectSpecies?.trim()) items.push("未填写昆虫种类");
    if (!sample.identificationNotes?.trim()) items.push("未填写鉴定备注");
    return items;
  };

  const getFilterHeader = (): string[] => {
    const lines: string[] = [];
    if (selectedCase) lines.push(`  - 案件: ${selectedCase}`);
    if (selectedDevelopmentStage) lines.push(`  - 发育阶段: ${selectedDevelopmentStage}`);
    if (selectedPreservationMethod) lines.push(`  - 保存方式: ${selectedPreservationMethod}`);
    const statusLabel = REVIEW_STATUS_OPTIONS.find((o) => o.value === selectedReviewStatus)?.label;
    if (statusLabel && selectedReviewStatus !== "ALL") lines.push(`  - 复核状态: ${statusLabel}`);
    lines.push(`  - 样本总数: ${filteredSamples.length} 条`);
    return lines;
  };

  const getFieldReportSummary = (): string => {
    if (filteredSamples.length === 0) return "";
    const lines: string[] = [];
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const templateInfo = EXPORT_TEMPLATES.find((t) => t.value === "FIELD_REPORT")!;

    lines.push("═".repeat(56));
    lines.push(`【${templateInfo.icon} ${templateInfo.label}】`);
    lines.push(`生成时间: ${dateStr}`);
    lines.push(`筛选范围:`);
    lines.push(...getFilterHeader());
    lines.push("═".repeat(56));
    lines.push("");

    filteredSamples.forEach((sample, index) => {
      const pendingItems = getPendingItems(sample);
      const hasUrgent = pendingItems.length > 0;
      lines.push(`■ 样本${index + 1} · ${sample.sampleNumber}${hasUrgent ? "  ⚠️待跟进" : ""}`);
      lines.push("─".repeat(48));
      lines.push(`  【现场位置】${sample.samplingLocation || "（未记录）"}`);
      lines.push(`  【关联案件】${sample.relatedCase || "（待关联）"}`);
      lines.push(`  【暴露阶段】${sample.exposureStage || "（未填写）"}  ·  环境温度 ${sample.environmentTemperature ? sample.environmentTemperature + "℃" : "无记录"}`);
      const species = sample.insectSpecies?.trim();
      lines.push(`  【发现虫种】${species || "尚未鉴定"}${sample.insectCount ? `  数量约 ${sample.insectCount}` : ""}`);
      lines.push(`  【发育阶段】${sample.developmentStage || "（未填写）"}  ·  采集方式 ${sample.insectCollectionMethod || "未记录"}`);
      lines.push(`  【初步处理】${sample.preservationMethod || "（未填写）"}${sample.preservationSolution ? ` / ${sample.preservationSolution}` : ""}`);
      if (hasUrgent) {
        lines.push(`  【⚠️ 待处理】${pendingItems.join(" → ")}`);
      }
      const notes = sample.identificationNotes?.trim();
      if (notes) {
        lines.push(`  【现场备注】${notes}`);
      }
      lines.push("");
    });

    const totalPending = filteredSamples.reduce((acc, s) => acc + getPendingItems(s).length, 0);
    lines.push("═".repeat(56));
    lines.push(`▲ 汇总: ${filteredSamples.length} 份样本${totalPending > 0 ? `，共 ${totalPending} 项待跟进` : "，无待办项"}`);
    lines.push("═".repeat(56));

    return lines.join("\n");
  };

  const getLabHandoverSummary = (): string => {
    if (filteredSamples.length === 0) return "";
    const lines: string[] = [];
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const templateInfo = EXPORT_TEMPLATES.find((t) => t.value === "LAB_HANDOVER")!;

    lines.push("╔" + "═".repeat(54) + "╗");
    lines.push(`║  ${templateInfo.icon} ${templateInfo.label}`.padEnd(56) + "║");
    lines.push(`║  交接时间: ${dateStr}`.padEnd(56) + "║");
    lines.push(`║  交接清单: 共 ${filteredSamples.length} 份样本`.padEnd(56) + "║");
    lines.push("╚" + "═".repeat(54) + "╝");
    lines.push("");
    lines.push("── 筛选条件 ──");
    lines.push(...getFilterHeader());
    lines.push("");

    filteredSamples.forEach((sample, index) => {
      const pendingItems = getPendingItems(sample);
      lines.push(`┌─ 样本 ${String(index + 1).padStart(2, "0")} ─ ${sample.sampleNumber} ─┐`);
      lines.push(`│ 案件编号: ${sample.relatedCase || "—"}`);
      lines.push(`│ 采样来源: ${sample.samplingLocation || "—"}`);
      lines.push(`│`);
      lines.push(`│ ◆ 保存信息`);
      lines.push(`│   保存方式: ${sample.preservationMethod || "未填写"}`);
      if (sample.preservationSolution?.trim()) {
        lines.push(`│   保存溶液: ${sample.preservationSolution}`);
      }
      lines.push(`│   存储温度: ${sample.storageTemperature ? sample.storageTemperature + "℃" : "未指定"}`);
      lines.push(`│   温度记录: ${getTemperatureRange(sample)}（共 ${sample.temperatureRecords.length} 条）`);
      lines.push(`│`);
      lines.push(`│ ◆ 样本内容`);
      lines.push(`│   昆虫种类: ${sample.insectSpecies?.trim() || "未鉴定"}`);
      lines.push(`│   发育阶段: ${sample.developmentStage || "未填写"}`);
      lines.push(`│   采集数量: ${sample.insectCount || "未记录"}`);
      lines.push(`│   采集方法: ${sample.insectCollectionMethod || "未记录"}`);
      lines.push(`│`);
      lines.push(`│ ◆ 交接状态`);
      lines.push(`│   当前状态: ${SAMPLE_STATUS_LABELS[sample.status]}`);
      if (pendingItems.length > 0) {
        lines.push(`│   ⚠ 实验室待办:`);
        pendingItems.forEach((item) => lines.push(`│     · ${item}`));
      } else {
        lines.push(`│   ✓ 无待办事项`);
      }
      const notes = sample.identificationNotes?.trim();
      if (notes) {
        lines.push(`│`);
        lines.push(`│ ◆ 鉴定备注: ${notes}`);
      }
      lines.push(`└${"─".repeat(42)}┘`);
      lines.push("");
    });

    const labPendingCount = filteredSamples.filter((s) => getPendingItems(s).length > 0).length;
    lines.push("═══ 交接确认 ═══");
    lines.push(`  样本总数: ${filteredSamples.length} 份`);
    lines.push(`  需处理样本: ${labPendingCount} 份`);
    lines.push(`  已齐备样本: ${filteredSamples.length - labPendingCount} 份`);
    lines.push(`  交接人: ____________    接收人: ____________`);
    lines.push(`  交接日期: ${dateStr.split(" ")[0]}`);

    return lines.join("\n");
  };

  const getCaseArchiveSummary = (): string => {
    if (filteredSamples.length === 0) return "";
    const lines: string[] = [];
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const templateInfo = EXPORT_TEMPLATES.find((t) => t.value === "CASE_ARCHIVE")!;
    const year = now.getFullYear();

    const archiveNumber = `GA-FEI-${year}-${String(filteredSamples.length).padStart(4, "0")}`;

    lines.push("┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓");
    lines.push(`┃  ${templateInfo.icon} ${templateInfo.label}`);
    lines.push(`┃  档案编号: ${archiveNumber}`);
    lines.push(`┃  归档日期: ${dateStr}`);
    lines.push(`┃  样本数量: ${filteredSamples.length} 份`);
    lines.push("┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛");
    lines.push("");
    lines.push("━━━ 检索条件 ━━━");
    lines.push(...getFilterHeader());
    lines.push("");

    const groupedByCase = filteredSamples.reduce<Record<string, Sample[]>>((acc, s) => {
      const key = s.relatedCase?.trim() || "未关联案件";
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    }, {});

    Object.entries(groupedByCase).forEach(([caseKey, caseSamples], caseIdx) => {
      lines.push(`┌──────────────────────────────────────────────────────┐`);
      lines.push(`│ 卷宗 ${String(caseIdx + 1).padStart(2, "0")}: ${caseKey}  （${caseSamples.length} 份样本）`);
      lines.push(`└──────────────────────────────────────────────────────┘`);
      lines.push("");

      caseSamples.forEach((sample, idx) => {
        lines.push(`  【档案条目 ${String(caseIdx + 1).padStart(2, "0")}-${String(idx + 1).padStart(2, "0")}】`);
        lines.push(`  ──────────────────────────────────────`);
        lines.push(`  1. 样本标识`);
        lines.push(`     · 样本编号: ${sample.sampleNumber}`);
        lines.push(`     · 关联案件: ${caseKey}`);
        lines.push(`     · 创建时间: ${sample.createdAt ? new Date(sample.createdAt).toLocaleString("zh-CN") : "无记录"}`);
        lines.push("");
        lines.push(`  2. 采样信息`);
        lines.push(`     · 采样地点: ${sample.samplingLocation || "未记录"}`);
        lines.push(`     · 环境温度: ${sample.environmentTemperature ? sample.environmentTemperature + "℃" : "未记录"}`);
        lines.push(`     · 相对湿度: ${sample.environmentHumidity ? sample.environmentHumidity + "%" : "未记录"}`);
        lines.push(`     · 天气状况: ${sample.weatherCondition || "未记录"}`);
        lines.push(`     · 暴露阶段: ${sample.exposureStage || "未填写"}`);
        if (sample.exposureNotes?.trim()) {
          lines.push(`     · 暴露备注: ${sample.exposureNotes}`);
        }
        lines.push("");
        lines.push(`  3. 昆虫学数据`);
        lines.push(`     · 昆虫种类: ${sample.insectSpecies?.trim() || "未鉴定"}`);
        lines.push(`     · 发育阶段: ${sample.developmentStage || "未填写"}`);
        lines.push(`     · 采集数量: ${sample.insectCount || "未记录"}`);
        lines.push(`     · 采集方法: ${sample.insectCollectionMethod || "未记录"}`);
        lines.push("");
        lines.push(`  4. 保存与存储`);
        lines.push(`     · 保存方式: ${sample.preservationMethod || "未填写"}`);
        lines.push(`     · 保存溶液: ${sample.preservationSolution?.trim() || "无"}`);
        lines.push(`     · 存储温度: ${sample.storageTemperature ? sample.storageTemperature + "℃" : "未指定"}`);
        lines.push(`     · 温控记录: ${getTemperatureRange(sample)}（${sample.temperatureRecords.length} 条记录）`);
        lines.push("");
        lines.push(`  5. 流程状态`);
        lines.push(`     · 复核状态: ${SAMPLE_STATUS_LABELS[sample.status]}`);
        const pendingItems = getPendingItems(sample);
        lines.push(`     · 待完善项: ${pendingItems.length > 0 ? pendingItems.join("；") : "无"}`);
        lines.push("");
        const notes = sample.identificationNotes?.trim();
        lines.push(`  6. 鉴定备注归档`);
        lines.push(`     ${notes ? notes : "（无备注内容）"}`);
        lines.push("");
      });
    });

    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("◆ 归档统计汇总");
    lines.push(`   · 案件卷宗数: ${Object.keys(groupedByCase).length} 宗`);
    lines.push(`   · 样本总份数: ${filteredSamples.length} 份`);
    const confirmedCount = filteredSamples.filter((s) => s.status === "CONFIRMED").length;
    lines.push(`   · 已确认归档: ${confirmedCount} 份`);
    lines.push(`   · 流程中样本: ${filteredSamples.length - confirmedCount} 份`);
    const totalNotes = filteredSamples.filter((s) => s.identificationNotes?.trim()).length;
    lines.push(`   · 含鉴定备注: ${totalNotes} 份`);
    lines.push("");
    lines.push(`归档员签字: ______________    日期: ${dateStr.split(" ")[0]}`);
    lines.push(`审核人签字: ______________    日期: ______________`);
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return lines.join("\n");
  };

  const getSummaryText = (): string => {
    switch (selectedTemplate) {
      case "FIELD_REPORT":
        return getFieldReportSummary();
      case "LAB_HANDOVER":
        return getLabHandoverSummary();
      case "CASE_ARCHIVE":
        return getCaseArchiveSummary();
      default:
        return getFieldReportSummary();
    }
  };

  const summaryText = useMemo(getSummaryText, [
    filteredSamples,
    selectedCase,
    selectedDevelopmentStage,
    selectedPreservationMethod,
    selectedReviewStatus,
    selectedTemplate,
  ]);

  const handleCopy = async () => {
    if (!summaryText) return;
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopyFeedback("已复制到剪贴板 ✓");
      setTimeout(() => setCopyFeedback(""), 2500);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = summaryText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopyFeedback("已复制到剪贴板 ✓");
      setTimeout(() => setCopyFeedback(""), 2500);
    }
  };

  const handleReset = () => {
    setSelectedCase("");
    setSelectedDevelopmentStage("");
    setSelectedPreservationMethod("");
    setSelectedReviewStatus("ALL");
  };

  const hasFilters = selectedCase || selectedDevelopmentStage || selectedPreservationMethod || selectedReviewStatus !== "ALL";

  return (
    <div className="export-summary-page">
      <div className="export-header">
        <div className="export-header-left">
          <button className="back-button" onClick={onBack}>
            ← 返回
          </button>
          <div>
            <h1 className="export-title">样本导出摘要</h1>
            <p className="export-subtitle">
              筛选记录后生成结构化文本摘要，支持一键复制
            </p>
          </div>
        </div>
      </div>

      <div className="export-filter-panel panel">
        <div className="panel-heading-row">
          <h2 className="panel-heading-title">🔍 筛选条件</h2>
          {hasFilters && (
            <button className="secondary" onClick={handleReset}>
              重置筛选
            </button>
          )}
        </div>
        <div className="filter-grid">
          <label>
            <span>案件</span>
            <select
              className="select-field"
              value={selectedCase}
              onChange={(e) => setSelectedCase(e.target.value)}
            >
              <option value="">全部案件</option>
              {allCaseNumbers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>发育阶段</span>
            <select
              className="select-field"
              value={selectedDevelopmentStage}
              onChange={(e) => setSelectedDevelopmentStage(e.target.value)}
            >
              <option value="">全部阶段</option>
              {DEVELOPMENT_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>保存方式</span>
            <select
              className="select-field"
              value={selectedPreservationMethod}
              onChange={(e) => setSelectedPreservationMethod(e.target.value)}
            >
              <option value="">全部方式</option>
              {PRESERVATION_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>复核状态</span>
            <select
              className="select-field"
              value={selectedReviewStatus}
              onChange={(e) => setSelectedReviewStatus(e.target.value as ReviewStatusOption)}
            >
              {REVIEW_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="filter-info-bar">
          <span>
            匹配 <strong className="highlight-num">{filteredSamples.length}</strong> / {samples.length} 条样本
          </span>
        </div>
      </div>

      <div className="export-template-panel panel">
        <div className="panel-heading-row">
          <h2 className="panel-heading-title">📑 导出模板</h2>
          <span className="template-current-badge">
            当前: {EXPORT_TEMPLATES.find((t) => t.value === selectedTemplate)?.icon}{" "}
            {EXPORT_TEMPLATES.find((t) => t.value === selectedTemplate)?.label}
          </span>
        </div>
        <div className="template-selector-grid">
          {EXPORT_TEMPLATES.map((tpl) => {
            const isActive = selectedTemplate === tpl.value;
            return (
              <button
                key={tpl.value}
                className={`template-card ${isActive ? "active" : ""}`}
                onClick={() => setSelectedTemplate(tpl.value)}
              >
                <div className="template-card-icon">{tpl.icon}</div>
                <div className="template-card-body">
                  <div className="template-card-title">{tpl.label}</div>
                  <div className="template-card-desc">{tpl.description}</div>
                </div>
                {isActive && <div className="template-card-check">✓</div>}
              </button>
            );
          })}
        </div>
      </div>

      {filteredSamples.length > 0 && (
        <div className="export-preview-panel panel">
          <div className="panel-heading-row">
            <h2 className="panel-heading-title">
              📄 摘要预览
              <span className="preview-template-tag">
                {EXPORT_TEMPLATES.find((t) => t.value === selectedTemplate)?.icon}{" "}
                {EXPORT_TEMPLATES.find((t) => t.value === selectedTemplate)?.label}
              </span>
            </h2>
            <div className="preview-actions">
              {copyFeedback && <span className="copy-feedback">{copyFeedback}</span>}
              <button className="primary" onClick={handleCopy}>
                📋 复制摘要
              </button>
            </div>
          </div>
          <textarea
            className="summary-textarea"
            value={summaryText}
            readOnly
            rows={24}
          />
        </div>
      )}

      {filteredSamples.length > 0 && (
        <div className="export-samples-panel panel">
          <div className="panel-heading-row">
            <h2 className="panel-heading-title">📋 筛选结果明细</h2>
            <span className="result-count-badge">{filteredSamples.length} 条</span>
          </div>
          <div className="samples-summary-table">
            <div className="summary-table-header">
              <div className="sth-col sth-no">序号</div>
              <div className="sth-col sth-number">批次编号</div>
              <div className="sth-col sth-case">案件</div>
              <div className="sth-col sth-location">采样地点</div>
              <div className="sth-col sth-temp">温度范围</div>
              <div className="sth-col sth-species">主要昆虫种类</div>
              <div className="sth-col sth-pending">待处理项</div>
              <div className="sth-col sth-status">复核状态</div>
            </div>
            <div className="summary-table-body">
              {filteredSamples.map((sample, idx) => {
                const pendingItems = getPendingItems(sample);
                return (
                  <div key={sample.id} className="summary-table-row">
                    <div className="stc-col stc-no">{String(idx + 1).padStart(2, "0")}</div>
                    <div className="stc-col stc-number">
                      <strong>{sample.sampleNumber}</strong>
                    </div>
                    <div className="stc-col stc-case">{sample.relatedCase || "—"}</div>
                    <div className="stc-col stc-location">{sample.samplingLocation || "—"}</div>
                    <div className="stc-col stc-temp">{getTemperatureRange(sample)}</div>
                    <div className="stc-col stc-species">
                      {sample.insectSpecies?.trim() || (
                        <span className="muted-text">未鉴定</span>
                      )}
                    </div>
                    <div className="stc-col stc-pending">
                      {pendingItems.length > 0 ? (
                        <div className="pending-chips">
                          {pendingItems.map((item, i) => (
                            <span key={i} className="pending-chip">
                              {item}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="ok-text">无</span>
                      )}
                    </div>
                    <div className="stc-col stc-status">
                      <StatusBadge status={sample.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {filteredSamples[0]?.identificationNotes && (
            <div className="notes-section">
              <h3 className="notes-title">📝 鉴定备注摘录</h3>
              <div className="notes-list">
                {filteredSamples
                  .filter((s) => s.identificationNotes?.trim())
                  .map((sample) => (
                    <div key={sample.id} className="note-item">
                      <div className="note-header">
                        <strong>{sample.sampleNumber}</strong>
                        <span className="note-case">{sample.relatedCase || "未关联案件"}</span>
                      </div>
                      <div className="note-content">{sample.identificationNotes}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {filteredSamples.length === 0 && (
        <div className="empty-state large">
          <div className="empty-icon">🔍</div>
          <h3>没有匹配的样本</h3>
          <p>请调整筛选条件，或确认样本数据是否存在</p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: SampleStatus }) {
  const colorMap: Record<SampleStatus, string> = {
    PENDING_IDENTIFICATION: "status-pending",
    NEEDS_REVIEW: "status-review",
    PHOTO_COMPLETED: "status-photo",
    CONFIRMED: "status-confirmed",
  };
  return (
    <span className={`status-badge ${colorMap[status]}`}>
      {SAMPLE_STATUS_LABELS[status]}
    </span>
  );
}
