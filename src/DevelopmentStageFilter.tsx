import { useState, useMemo } from "react";
import { Sample } from "./batchStorage";

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

const EMPTY_ICONS: Record<string, string> = {
  卵: "🥚",
  幼虫: "🐛",
  蛹: "🦋",
  成虫: "🪰",
};

function isPendingReview(sample: Sample): boolean {
  return (
    sample.identificationNotes.includes("需复核") ||
    sample.identificationNotes.includes("复核") ||
    sample.identificationNotes.includes("待复核")
  );
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

  const filteredSamples = useMemo(() => {
    return samples.filter((sample) =>
      matchDevelopmentStage(sample.developmentStage, activeFilter)
    );
  }, [samples, activeFilter]);

  const sampleCards = useMemo(() => {
    return filteredSamples.map((sample) => ({
      sample,
      pendingReview: isPendingReview(sample),
    }));
  }, [filteredSamples]);

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

      <div className="filter-results-info">
        共找到 <strong>{filteredSamples.length}</strong> 个
        <strong>{activeFilter}</strong> 阶段样本
      </div>

      {sampleCards.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{EMPTY_ICONS[activeFilter]}</div>
          <h3>暂无{activeFilter}阶段样本</h3>
          <p>当前筛选条件下没有匹配的样本，请尝试其他发育阶段</p>
        </div>
      ) : (
        <div className="sample-card-grid">
          {sampleCards.map(({ sample, pendingReview }) => (
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
                    {pendingReview ? "待复核" : "已确认"}
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
