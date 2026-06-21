import { useState, useMemo } from "react";
import {
  Sample,
  PRESERVATION_METHODS,
  SAMPLE_STATUS_LABELS,
} from "./batchStorage";

interface DevelopmentStageFilterProps {
  samples: Sample[];
  onBack: () => void;
  onViewDetail: (sampleId: string) => void;
}

const STAGE_FILTERS = [
  { key: "卵", label: "卵", icon: "🥚" },
  { key: "幼虫", label: "幼虫", icon: "🐛" },
  { key: "蛹", label: "蛹", icon: "🦋" },
  { key: "成虫", label: "成虫", icon: "🪰" },
];

const REVIEW_STATUS_OPTIONS = [
  { key: "all", label: "全部状态" },
  { key: "pending", label: "待复核" },
  { key: "confirmed", label: "已确认" },
];

const EMPTY_ICONS: Record<string, string> = {
  卵: "🥚",
  幼虫: "🐛",
  蛹: "🦋",
  成虫: "🪰",
};

function isPendingReview(sample: Sample): boolean {
  return sample.status === "NEEDS_REVIEW";
}

function isConfirmed(sample: Sample): boolean {
  return sample.status === "CONFIRMED";
}

function matchDevelopmentStage(
  developmentStage: string,
  filterKey: string
): boolean {
  if (!developmentStage) return false;
  if (filterKey === "幼虫") {
    return developmentStage.includes("幼虫");
  }
  return developmentStage.includes(filterKey);
}

export default function DevelopmentStageFilter({
  samples,
  onBack,
  onViewDetail,
}: DevelopmentStageFilterProps) {
  const [activeFilter, setActiveFilter] = useState<string>("卵");
  const [preservationFilter, setPreservationFilter] = useState<string>("");
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>("all");

  const hasActiveFilters = preservationFilter || reviewStatusFilter !== "all";

  const filteredSamples = useMemo(() => {
    return samples.filter((sample) => {
      if (!matchDevelopmentStage(sample.developmentStage, activeFilter)) {
        return false;
      }
      if (
        preservationFilter &&
        sample.preservationMethod !== preservationFilter
      ) {
        return false;
      }
      if (reviewStatusFilter !== "all") {
        if (reviewStatusFilter === "pending" && !isPendingReview(sample))
          return false;
        if (reviewStatusFilter === "confirmed" && !isConfirmed(sample))
          return false;
      }
      return true;
    });
  }, [samples, activeFilter, preservationFilter, reviewStatusFilter]);

  const sampleCards = useMemo(() => {
    return filteredSamples.map((sample) => ({
      sample,
      pendingReview: isPendingReview(sample),
      statusLabel: SAMPLE_STATUS_LABELS[sample.status],
    }));
  }, [filteredSamples]);

  const handleClearFilters = () => {
    setPreservationFilter("");
    setReviewStatusFilter("all");
  };

  const getFilterDescription = () => {
    const parts: string[] = [];
    if (preservationFilter) {
      parts.push(`保存方式：${preservationFilter}`);
    }
    if (reviewStatusFilter === "pending") {
      parts.push("状态：待复核");
    } else if (reviewStatusFilter === "confirmed") {
      parts.push("状态：已确认");
    }
    return parts.join(" · ");
  };

  return (
    <div className="filter-page">
      <div className="filter-header">
        <button className="back-button" onClick={onBack}>
          ← 返回
        </button>
        <h1 className="filter-page-title">发育阶段筛选</h1>
        <div style={{ width: 80 }} />
      </div>

      <div className="filter-tabs">
        {STAGE_FILTERS.map((stage) => (
          <button
            key={stage.key}
            className={`filter-tab ${
              activeFilter === stage.key ? "active" : ""
            }`}
            onClick={() => setActiveFilter(stage.key)}
          >
            <span className="filter-tab-icon">{stage.icon}</span>
            <span className="filter-tab-label">{stage.label}</span>
          </button>
        ))}
      </div>

      <div className="secondary-filter-bar">
        <div className="filter-group">
          <label className="filter-label">保存方式</label>
          <select
            className="filter-select"
            value={preservationFilter}
            onChange={(e) => setPreservationFilter(e.target.value)}
          >
            <option value="">全部保存方式</option>
            {PRESERVATION_METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">复核状态</label>
          <select
            className="filter-select"
            value={reviewStatusFilter}
            onChange={(e) => setReviewStatusFilter(e.target.value)}
          >
            {REVIEW_STATUS_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {hasActiveFilters && (
          <button
            className="clear-filters-button"
            onClick={handleClearFilters}
            title="清空筛选条件"
          >
            ✕ 清空筛选
          </button>
        )}
      </div>

      <div className="filter-results-info">
        共找到 <strong>{filteredSamples.length}</strong> 个
        <strong>{activeFilter}</strong> 阶段样本
        {hasActiveFilters && (
          <span className="filter-active-tags"> · {getFilterDescription()}</span>
        )}
      </div>

      {sampleCards.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{EMPTY_ICONS[activeFilter]}</div>
          <h3>暂无匹配的{activeFilter}阶段样本</h3>
          <p>
            {hasActiveFilters
              ? `当前筛选条件（${getFilterDescription()}）下没有匹配的样本，请尝试调整筛选条件或选择其他发育阶段`
              : `当前筛选条件下没有匹配的样本，请尝试其他发育阶段`}
          </p>
          {hasActiveFilters && (
            <button
              className="primary clear-empty-filters"
              onClick={handleClearFilters}
            >
              清除二级筛选条件
            </button>
          )}
        </div>
      ) : (
        <div className="sample-card-grid">
          {sampleCards.map(({ sample, pendingReview, statusLabel }) => (
            <article
              key={sample.id}
              className="sample-filter-card"
              onClick={() => onViewDetail(sample.id)}
            >
              <div className="sample-card-header">
                <div className="sample-card-title-section">
                  <h3 className="sample-card-number">{sample.sampleNumber}</h3>
                  {pendingReview && (
                    <span className="pending-review-badge">待复核</span>
                  )}
                </div>
                <span className="sample-card-stage">{sample.developmentStage}</span>
              </div>

              <div className="sample-card-body">
                <div className="sample-info-row">
                  <span className="info-icon">📍</span>
                  <span className="info-label">采样地点</span>
                  <span className="info-value">
                    {sample.samplingLocation || "—"}
                  </span>
                </div>
                <div className="sample-info-row">
                  <span className="info-icon">🌡️</span>
                  <span className="info-label">温度</span>
                  <span className="info-value">
                    {sample.environmentTemperature
                      ? `${sample.environmentTemperature}℃`
                      : "—"}
                  </span>
                </div>
                <div className="sample-info-row">
                  <span className="info-icon">🧪</span>
                  <span className="info-label">保存方式</span>
                  <span className="info-value">
                    {sample.preservationMethod || "—"}
                  </span>
                </div>
                <div className="sample-info-row">
                  <span className="info-icon">
                    {pendingReview ? "⚠️" : "✅"}
                  </span>
                  <span className="info-label">状态</span>
                  <span
                    className={`info-value status-value ${
                      pendingReview ? "status-pending" : "status-normal"
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>
              </div>

              {sample.insectSpecies && (
                <div className="sample-card-footer">
                  <span className="species-tag">{sample.insectSpecies}</span>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
