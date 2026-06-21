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

export default function SampleExportSummary({
  samples,
  batches,
  onBack,
}: SampleExportSummaryProps) {
  const [selectedCase, setSelectedCase] = useState<string>("");
  const [selectedDevelopmentStage, setSelectedDevelopmentStage] = useState<string>("");
  const [selectedPreservationMethod, setSelectedPreservationMethod] = useState<string>("");
  const [selectedReviewStatus, setSelectedReviewStatus] = useState<ReviewStatusOption>("ALL");
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

  const getSummaryText = (): string => {
    if (filteredSamples.length === 0) return "";

    const lines: string[] = [];
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    lines.push("=" .repeat(60));
    lines.push("法医昆虫学样本导出摘要");
    lines.push(`导出时间: ${dateStr}`);
    lines.push(`筛选条件:`);
    if (selectedCase) lines.push(`  - 案件: ${selectedCase}`);
    if (selectedDevelopmentStage) lines.push(`  - 发育阶段: ${selectedDevelopmentStage}`);
    if (selectedPreservationMethod) lines.push(`  - 保存方式: ${selectedPreservationMethod}`);
    const statusLabel = REVIEW_STATUS_OPTIONS.find((o) => o.value === selectedReviewStatus)?.label;
    if (statusLabel && selectedReviewStatus !== "ALL") lines.push(`  - 复核状态: ${statusLabel}`);
    lines.push(`  - 样本总数: ${filteredSamples.length} 条`);
    lines.push("=".repeat(60));
    lines.push("");

    filteredSamples.forEach((sample, index) => {
      lines.push(`【样本 ${index + 1}】${sample.sampleNumber}`);
      lines.push("-" .repeat(50));
      lines.push(`  批次编号: ${sample.sampleNumber}`);
      lines.push(`  采样地点: ${sample.samplingLocation || "未填写"}`);
      lines.push(`  关联案件: ${sample.relatedCase || "未关联"}`);
      lines.push(`  温度范围: ${getTemperatureRange(sample)}`);

      const species = sample.insectSpecies?.trim();
      lines.push(`  主要昆虫种类: ${species || "未鉴定"}`);

      lines.push(`  发育阶段: ${sample.developmentStage || "未填写"}`);
      lines.push(`  保存方式: ${sample.preservationMethod || "未填写"}`);
      if (sample.preservationSolution?.trim()) {
        lines.push(`  保存溶液: ${sample.preservationSolution}`);
      }
      lines.push(`  复核状态: ${SAMPLE_STATUS_LABELS[sample.status]}`);

      const pendingItems = getPendingItems(sample);
      lines.push(`  待处理项: ${pendingItems.length > 0 ? pendingItems.join("、") : "无"}`);

      const notes = sample.identificationNotes?.trim();
      lines.push(`  鉴定备注: ${notes || "无"}`);

      lines.push("");
    });

    lines.push("=".repeat(60));
    lines.push(`摘要结束 · 共 ${filteredSamples.length} 条记录`);
    lines.push("=".repeat(60));

    return lines.join("\n");
  };

  const summaryText = useMemo(getSummaryText, [filteredSamples, selectedCase, selectedDevelopmentStage, selectedPreservationMethod, selectedReviewStatus]);

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

      {filteredSamples.length > 0 && (
        <div className="export-preview-panel panel">
          <div className="panel-heading-row">
            <h2 className="panel-heading-title">📄 摘要预览</h2>
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
