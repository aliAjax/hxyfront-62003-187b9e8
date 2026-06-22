import { useState, useMemo } from "react";
import {
  Sample,
  formatDateTime,
  getSortedTemperatureRecords,
  calculateTemperatureStats,
  getAllCaseNumbers,
  getSamplesByCase,
  DEVELOPMENT_STAGES,
  EXPOSURE_STAGES,
  SAMPLE_STATUS_LABELS,
} from "./batchStorage";
import TemperatureChart from "./TemperatureChart";

interface CaseComparisonProps {
  samples: Sample[];
  onBack: () => void;
  onViewSampleDetail: (sampleId: string) => void;
}

interface DeviationNode {
  id: string;
  caseIndex: 0 | 1;
  type: "temperature" | "development" | "exposure" | "unreviewed";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  sampleId?: string;
  sampleNumber?: string;
  timestamp?: string;
}

const STAGE_ORDER: Record<string, number> = {
  "卵": 0,
  "幼虫一龄": 1,
  "幼虫二龄": 2,
  "幼虫三龄": 3,
  "蛹": 4,
  "成虫": 5,
};

const EXPOSURE_ORDER: Record<string, number> = {
  "新鲜期": 0,
  "肿胀期": 1,
  "腐败期": 2,
  "后腐败期": 3,
  "干化期": 4,
};

const CASE_COLORS = ["#2563eb", "#dc2626"];
const CASE_LABELS = ["案件 A", "案件 B"];

export default function CaseComparison({
  samples,
  onBack,
  onViewSampleDetail,
}: CaseComparisonProps) {
  const allCaseNumbers = useMemo(
    () => {
      const caseSet = new Set<string>();
      samples.forEach((s) => {
        if (s.relatedCase.trim()) caseSet.add(s.relatedCase.trim());
      });
      return Array.from(caseSet).sort();
    },
    [samples]
  );

  const [selectedCases, setSelectedCases] = useState<[string, string]>(
    allCaseNumbers.length >= 2
      ? [allCaseNumbers[0], allCaseNumbers[1]]
      : allCaseNumbers.length === 1
        ? [allCaseNumbers[0], ""]
        : ["", ""]
  );

  const [activeTab, setActiveTab] = useState<"timeline" | "temperature" | "development" | "unreviewed">("timeline");

  const caseData = useMemo(() => {
    return selectedCases.map((cn) => {
      if (!cn) return { caseNumber: "", samples: [] as Sample[] };
      return {
        caseNumber: cn,
        samples: getSamplesByCase(samples, cn),
      };
    }) as [{ caseNumber: string; samples: Sample[] }, { caseNumber: string; samples: Sample[] }];
  }, [selectedCases, samples]);

  const bothSelected = caseData[0].caseNumber && caseData[1].caseNumber;

  const caseTempStats = useMemo(() => {
    return caseData.map((cd) =>
      calculateTemperatureStats(cd.samples.flatMap((s) => s.temperatureRecords))
    );
  }, [caseData]);

  const deviations = useMemo<DeviationNode[]>(() => {
    if (!bothSelected) return [];
    const results: DeviationNode[] = [];

    const [caseA, caseB] = caseData;
    const statsA = caseTempStats[0];
    const statsB = caseTempStats[1];

    if (statsA.avg !== null && statsB.avg !== null) {
      const diff = Math.abs(statsA.avg - statsB.avg);
      if (diff > 5) {
        const hotterIdx: 0 | 1 = statsA.avg > statsB.avg ? 0 : 1;
        const coolerIdx: 0 | 1 = hotterIdx === 0 ? 1 : 0;
        results.push({
          id: "temp-avg-diff",
          caseIndex: hotterIdx,
          type: "temperature",
          severity: diff > 10 ? "high" : "medium",
          title: "平均温度明显偏离",
          description: `${caseData[hotterIdx].caseNumber} 平均温度 ${caseTempStats[hotterIdx].avg!.toFixed(1)}℃ vs ${caseData[coolerIdx].caseNumber} ${caseTempStats[coolerIdx].avg!.toFixed(1)}℃，差异 ${diff.toFixed(1)}℃`,
        });
      }
    }

    if (statsA.max !== null && statsB.max !== null) {
      const diff = Math.abs(statsA.max - statsB.max);
      if (diff > 8) {
        const higherIdx: 0 | 1 = statsA.max > statsB.max ? 0 : 1;
        results.push({
          id: "temp-max-diff",
          caseIndex: higherIdx,
          type: "temperature",
          severity: diff > 15 ? "high" : "medium",
          title: "最高温度差异显著",
          description: `${caseData[higherIdx].caseNumber} 最高温 ${caseTempStats[higherIdx].max!.toFixed(1)}℃ vs ${caseData[higherIdx === 0 ? 1 : 0].caseNumber} ${caseTempStats[higherIdx === 0 ? 1 : 0].max!.toFixed(1)}℃，差异 ${diff.toFixed(1)}℃`,
        });
      }
    }

    const devStagesA = caseA.samples.map((s) => STAGE_ORDER[s.developmentStage]).filter((v) => v !== undefined) as number[];
    const devStagesB = caseB.samples.map((s) => STAGE_ORDER[s.developmentStage]).filter((v) => v !== undefined) as number[];

    if (devStagesA.length > 0 && devStagesB.length > 0) {
      const avgA = devStagesA.reduce((a, b) => a + b, 0) / devStagesA.length;
      const avgB = devStagesB.reduce((a, b) => a + b, 0) / devStagesB.length;
      if (Math.abs(avgA - avgB) > 1.5) {
        const advancedIdx: 0 | 1 = avgA > avgB ? 0 : 1;
        const stageNamesA = caseA.samples.map((s) => s.developmentStage).filter(Boolean);
        const stageNamesB = caseB.samples.map((s) => s.developmentStage).filter(Boolean);
        results.push({
          id: "dev-stage-diff",
          caseIndex: advancedIdx,
          type: "development",
          severity: Math.abs(avgA - avgB) > 3 ? "high" : "medium",
          title: "发育阶段分布差异显著",
          description: `${caseData[advancedIdx].caseNumber} 发育阶段偏后（${[...new Set(advancedIdx === 0 ? stageNamesA : stageNamesB)].join("、")}）vs ${caseData[advancedIdx === 0 ? 1 : 0].caseNumber}（${[...new Set(advancedIdx === 0 ? stageNamesB : stageNamesA)].join("、")}）`,
        });
      }
    }

    const expStagesA = caseA.samples.map((s) => EXPOSURE_ORDER[s.exposureStage]).filter((v) => v !== undefined) as number[];
    const expStagesB = caseB.samples.map((s) => EXPOSURE_ORDER[s.exposureStage]).filter((v) => v !== undefined) as number[];

    if (expStagesA.length > 0 && expStagesB.length > 0) {
      const avgExpA = expStagesA.reduce((a, b) => a + b, 0) / expStagesA.length;
      const avgExpB = expStagesB.reduce((a, b) => a + b, 0) / expStagesB.length;
      if (Math.abs(avgExpA - avgExpB) > 1) {
        const laterIdx: 0 | 1 = avgExpA > avgExpB ? 0 : 1;
        results.push({
          id: "exposure-stage-diff",
          caseIndex: laterIdx,
          type: "exposure",
          severity: Math.abs(avgExpA - avgExpB) > 2 ? "high" : "medium",
          title: "暴露阶段分布差异",
          description: `${caseData[laterIdx].caseNumber} 暴露阶段偏晚 vs ${caseData[laterIdx === 0 ? 1 : 0].caseNumber}`,
        });
      }
    }

    [0, 1].forEach((idx) => {
      const unreviewed = caseData[idx].samples.filter(
        (s) => s.status === "NEEDS_REVIEW" || s.status === "PENDING_IDENTIFICATION"
      );
      const otherIdx = idx === 0 ? 1 : 0;
      const otherUnreviewed = caseData[otherIdx].samples.filter(
        (s) => s.status === "NEEDS_REVIEW" || s.status === "PENDING_IDENTIFICATION"
      );

      if (unreviewed.length > 0 && unreviewed.length !== otherUnreviewed.length) {
        const ratio = caseData[idx].samples.length > 0
          ? unreviewed.length / caseData[idx].samples.length
          : 0;
        const otherRatio = caseData[otherIdx].samples.length > 0
          ? otherUnreviewed.length / caseData[otherIdx].samples.length
          : 0;

        if (Math.abs(ratio - otherRatio) > 0.3) {
          results.push({
            id: `unreviewed-diff-${idx}`,
            caseIndex: idx as 0 | 1,
            type: "unreviewed",
            severity: ratio > 0.5 ? "high" : "medium",
            title: "未复核样本比例差异",
            description: `${caseData[idx].caseNumber} 有 ${unreviewed.length} 个未复核样本（${(ratio * 100).toFixed(0)}%）vs ${caseData[otherIdx].caseNumber} ${otherUnreviewed.length} 个（${(otherRatio * 100).toFixed(0)}%）`,
          });
        }
      }
    });

    caseData.forEach((cd, idx) => {
      cd.samples.forEach((sample) => {
        const temps = getSortedTemperatureRecords(sample.temperatureRecords);
        if (temps.length > 1) {
          for (let i = 0; i < temps.length - 1; i++) {
            const gapMs = new Date(temps[i + 1].timestamp).getTime() - new Date(temps[i].timestamp).getTime();
            const gapHours = gapMs / (1000 * 60 * 60);
            if (gapHours > 8) {
              results.push({
                id: `temp-gap-${idx}-${sample.id}-${i}`,
                caseIndex: idx as 0 | 1,
                type: "temperature",
                severity: gapHours > 24 ? "high" : "low",
                title: `温度记录缺口：${sample.sampleNumber}`,
                description: `间隔约 ${gapHours.toFixed(1)} 小时`,
                sampleId: sample.id,
                sampleNumber: sample.sampleNumber,
                timestamp: temps[i].timestamp,
              });
            }
          }
        }
      });
    });

    caseData.forEach((cd, idx) => {
      const sorted = [...cd.samples].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      for (let i = 0; i < sorted.length - 1; i++) {
        const earlier = sorted[i];
        const later = sorted[i + 1];
        const earlierStage = STAGE_ORDER[earlier.developmentStage];
        const laterStage = STAGE_ORDER[later.developmentStage];
        if (earlierStage !== undefined && laterStage !== undefined && earlierStage > laterStage) {
          results.push({
            id: `dev-conflict-${idx}-${earlier.id}-${later.id}`,
            caseIndex: idx as 0 | 1,
            type: "development",
            severity: "high",
            title: `发育阶段冲突：${earlier.sampleNumber} vs ${later.sampleNumber}`,
            description: `较早采集的样本发育阶段更高级`,
            sampleId: earlier.id,
            sampleNumber: earlier.sampleNumber,
            timestamp: earlier.createdAt,
          });
        }
      }
    });

    return results;
  }, [bothSelected, caseData, caseTempStats]);

  const severityColors: Record<string, string> = {
    high: "#dc2626",
    medium: "#a16207",
    low: "#2563eb",
  };

  const severityLabels: Record<string, string> = {
    high: "高",
    medium: "中",
    low: "低",
  };

  const deviationTypeLabels: Record<string, string> = {
    temperature: "🌡️ 温度",
    development: "🪰 发育",
    exposure: "💀 暴露",
    unreviewed: "⚠️ 未复核",
  };

  const handleCaseSelect = (index: 0 | 1, value: string) => {
    setSelectedCases((prev) => {
      const next: [string, string] = [...prev];
      next[index] = value;
      return next;
    });
  };

  const renderTimelineColumn = (caseIdx: 0 | 1) => {
    const cd = caseData[caseIdx];
    if (!cd.caseNumber) {
      return (
        <div className="comparison-empty-col">
          <div className="empty-icon">📂</div>
          <p>请选择案件</p>
        </div>
      );
    }

    if (cd.samples.length === 0) {
      return (
        <div className="comparison-empty-col">
          <div className="empty-icon">🔍</div>
          <p>该案件暂无样本</p>
        </div>
      );
    }

    const sorted = [...cd.samples].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const events: { id: string; icon: string; title: string; time: string; color: string; sampleId: string }[] = [];
    sorted.forEach((s) => {
      events.push({
        id: `s-${s.id}`,
        icon: "🧫",
        title: `采集：${s.sampleNumber}`,
        time: formatDateTime(s.createdAt),
        color: "#365314",
        sampleId: s.id,
      });
      if (s.exposureStage) {
        events.push({
          id: `e-${s.id}`,
          icon: "💀",
          title: `暴露：${s.exposureStage}`,
          time: formatDateTime(s.createdAt),
          color: "#dc2626",
          sampleId: s.id,
        });
      }
      if (s.developmentStage) {
        events.push({
          id: `d-${s.id}`,
          icon: "🪰",
          title: `发育：${s.developmentStage}`,
          time: formatDateTime(s.createdAt),
          color: "#a16207",
          sampleId: s.id,
        });
      }
      const deviatedSampleIds = deviations
        .filter((d) => d.caseIndex === caseIdx && d.sampleId)
        .map((d) => d.sampleId);
      const isDeviated = deviatedSampleIds.includes(s.id);

      if (isDeviated) {
        events.push({
          id: `dev-mark-${s.id}`,
          icon: "⚠️",
          title: "检测到偏离",
          time: formatDateTime(s.updatedAt),
          color: "#dc2626",
          sampleId: s.id,
        });
      }
    });

    return (
      <div className="comparison-timeline-col">
        <div className="comparison-col-header" style={{ borderBottomColor: CASE_COLORS[caseIdx] }}>
          <span className="comparison-col-badge" style={{ background: CASE_COLORS[caseIdx] }}>
            {CASE_LABELS[caseIdx]}
          </span>
          <span className="comparison-col-case-number">{cd.caseNumber}</span>
          <span className="comparison-col-count">{cd.samples.length} 个样本</span>
        </div>
        <div className="comparison-timeline-events">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="comparison-timeline-event"
              style={{ borderLeftColor: ev.color }}
              onClick={() => onViewSampleDetail(ev.sampleId)}
            >
              <div className="comparison-event-icon" style={{ background: `${ev.color}15`, color: ev.color }}>
                {ev.icon}
              </div>
              <div className="comparison-event-body">
                <div className="comparison-event-title">{ev.title}</div>
                <div className="comparison-event-time">{ev.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTemperatureColumn = (caseIdx: 0 | 1) => {
    const cd = caseData[caseIdx];
    if (!cd.caseNumber || cd.samples.length === 0) {
      return (
        <div className="comparison-empty-col">
          <div className="empty-icon">🌡️</div>
          <p>{!cd.caseNumber ? "请选择案件" : "暂无温度数据"}</p>
        </div>
      );
    }

    const allRecords = cd.samples.flatMap((s) => s.temperatureRecords);
    const stats = caseTempStats[caseIdx];
    const series = cd.samples.map((s) => ({
      sampleNumber: s.sampleNumber,
      records: s.temperatureRecords,
    }));

    return (
      <div className="comparison-temp-col">
        <div className="comparison-col-header" style={{ borderBottomColor: CASE_COLORS[caseIdx] }}>
          <span className="comparison-col-badge" style={{ background: CASE_COLORS[caseIdx] }}>
            {CASE_LABELS[caseIdx]}
          </span>
          <span className="comparison-col-case-number">{cd.caseNumber}</span>
        </div>
        <div className="comparison-temp-stats">
          <div className="comparison-stat-pill">
            <span className="comparison-stat-label">最高</span>
            <span className="comparison-stat-value">{stats.max !== null ? `${stats.max.toFixed(1)}℃` : "—"}</span>
          </div>
          <div className="comparison-stat-pill">
            <span className="comparison-stat-label">最低</span>
            <span className="comparison-stat-value">{stats.min !== null ? `${stats.min.toFixed(1)}℃` : "—"}</span>
          </div>
          <div className="comparison-stat-pill">
            <span className="comparison-stat-label">均温</span>
            <span className="comparison-stat-value">{stats.avg !== null ? `${stats.avg.toFixed(1)}℃` : "—"}</span>
          </div>
          <div className="comparison-stat-pill">
            <span className="comparison-stat-label">记录</span>
            <span className="comparison-stat-value">{stats.count}</span>
          </div>
        </div>
        <TemperatureChart
          records={allRecords}
          series={series}
          title=""
        />
      </div>
    );
  };

  const renderDevelopmentColumn = (caseIdx: 0 | 1) => {
    const cd = caseData[caseIdx];
    if (!cd.caseNumber || cd.samples.length === 0) {
      return (
        <div className="comparison-empty-col">
          <div className="empty-icon">🪰</div>
          <p>{!cd.caseNumber ? "请选择案件" : "暂无发育数据"}</p>
        </div>
      );
    }

    const stageCounts: Record<string, number> = {};
    DEVELOPMENT_STAGES.forEach((stage) => { stageCounts[stage] = 0; });
    cd.samples.forEach((s) => {
      if (s.developmentStage && stageCounts[s.developmentStage] !== undefined) {
        stageCounts[s.developmentStage]++;
      }
    });
    const maxCount = Math.max(...Object.values(stageCounts), 1);

    const exposureCounts: Record<string, number> = {};
    EXPOSURE_STAGES.forEach((stage) => { exposureCounts[stage] = 0; });
    cd.samples.forEach((s) => {
      if (s.exposureStage && exposureCounts[s.exposureStage] !== undefined) {
        exposureCounts[s.exposureStage]++;
      }
    });

    return (
      <div className="comparison-dev-col">
        <div className="comparison-col-header" style={{ borderBottomColor: CASE_COLORS[caseIdx] }}>
          <span className="comparison-col-badge" style={{ background: CASE_COLORS[caseIdx] }}>
            {CASE_LABELS[caseIdx]}
          </span>
          <span className="comparison-col-case-number">{cd.caseNumber}</span>
        </div>

        <div className="comparison-stage-section">
          <h4 className="comparison-stage-title">🪰 发育阶段分布</h4>
          <div className="comparison-stage-bars">
            {DEVELOPMENT_STAGES.map((stage) => {
              const count = stageCounts[stage] || 0;
              const pct = (count / maxCount) * 100;
              const deviatedDevs = deviations.filter(
                (d) => d.caseIndex === caseIdx && d.type === "development"
              );
              const isMarked = deviatedDevs.length > 0 && count > 0;
              return (
                <div key={stage} className={`comparison-stage-row ${isMarked ? "deviated" : ""}`}>
                  <span className="comparison-stage-name">{stage}</span>
                  <div className="comparison-stage-bar-track">
                    <div
                      className="comparison-stage-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: CASE_COLORS[caseIdx],
                      }}
                    />
                  </div>
                  <span className="comparison-stage-count">{count}</span>
                  {isMarked && <span className="comparison-deviation-mark" title="偏离标记">⚠️</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="comparison-stage-section">
          <h4 className="comparison-stage-title">💀 暴露阶段分布</h4>
          <div className="comparison-stage-bars">
            {EXPOSURE_STAGES.map((stage) => {
              const count = exposureCounts[stage] || 0;
              const pct = (count / maxCount) * 100;
              return (
                <div key={stage} className="comparison-stage-row">
                  <span className="comparison-stage-name">{stage}</span>
                  <div className="comparison-stage-bar-track">
                    <div
                      className="comparison-stage-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: CASE_COLORS[caseIdx],
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="comparison-stage-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="comparison-samples-list">
          <h4 className="comparison-stage-title">📋 样本发育详情</h4>
          {cd.samples.map((s) => {
            const isDeviated = deviations.some(
              (d) => d.caseIndex === caseIdx && d.sampleId === s.id && d.type === "development"
            );
            return (
              <div
                key={s.id}
                className={`comparison-sample-row ${isDeviated ? "deviated" : ""}`}
                onClick={() => onViewSampleDetail(s.id)}
              >
                <span className="comparison-sample-number">{s.sampleNumber}</span>
                <span className="comparison-sample-dev-stage">
                  {DEVELOPMENT_STAGES.map((stage) => {
                    const order = STAGE_ORDER[stage];
                    const current = STAGE_ORDER[s.developmentStage];
                    return (
                      <span
                        key={stage}
                        className={`comparison-dev-dot ${
                          current !== undefined && order !== undefined && order <= current ? "filled" : ""
                        } ${stage === s.developmentStage ? "current" : ""}`}
                        title={stage}
                      />
                    );
                  })}
                </span>
                <span className="comparison-sample-stage-label">{s.developmentStage || "—"}</span>
                {isDeviated && <span className="comparison-deviation-mark" title="偏离标记">⚠️</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderUnreviewedColumn = (caseIdx: 0 | 1) => {
    const cd = caseData[caseIdx];
    if (!cd.caseNumber || cd.samples.length === 0) {
      return (
        <div className="comparison-empty-col">
          <div className="empty-icon">⚠️</div>
          <p>{!cd.caseNumber ? "请选择案件" : "暂无样本"}</p>
        </div>
      );
    }

    const unreviewed = cd.samples.filter(
      (s) => s.status === "NEEDS_REVIEW" || s.status === "PENDING_IDENTIFICATION"
    );
    const reviewed = cd.samples.filter(
      (s) => s.status === "CONFIRMED" || s.status === "PHOTO_COMPLETED"
    );
    const otherIdx = caseIdx === 0 ? 1 : 0;
    const otherUnreviewed = caseData[otherIdx].samples.filter(
      (s) => s.status === "NEEDS_REVIEW" || s.status === "PENDING_IDENTIFICATION"
    );
    const hasDiff = deviations.some(
      (d) => d.type === "unreviewed" && d.caseIndex === caseIdx
    );

    return (
      <div className="comparison-unreviewed-col">
        <div className="comparison-col-header" style={{ borderBottomColor: CASE_COLORS[caseIdx] }}>
          <span className="comparison-col-badge" style={{ background: CASE_COLORS[caseIdx] }}>
            {CASE_LABELS[caseIdx]}
          </span>
          <span className="comparison-col-case-number">{cd.caseNumber}</span>
        </div>

        <div className="comparison-unreviewed-summary">
          <div className={`comparison-unreviewed-stat ${unreviewed.length > 0 ? "has-unreviewed" : ""}`}>
            <span className="comparison-unreviewed-count">{unreviewed.length}</span>
            <span className="comparison-unreviewed-label">未复核</span>
          </div>
          <div className="comparison-unreviewed-stat reviewed">
            <span className="comparison-unreviewed-count">{reviewed.length}</span>
            <span className="comparison-unreviewed-label">已复核</span>
          </div>
          <div className="comparison-unreviewed-stat total">
            <span className="comparison-unreviewed-count">{cd.samples.length}</span>
            <span className="comparison-unreviewed-label">总计</span>
          </div>
        </div>

        {hasDiff && (
          <div className="comparison-unreviewed-diff-notice">
            ⚠️ 与 {caseData[otherIdx].caseNumber || "另一案件"} 相比，未复核比例差异显著（{unreviewed.length} vs {otherUnreviewed.length}）
          </div>
        )}

        {unreviewed.length > 0 ? (
          <div className="comparison-unreviewed-list">
            {unreviewed.map((s) => (
              <div
                key={s.id}
                className="comparison-unreviewed-item"
                onClick={() => onViewSampleDetail(s.id)}
              >
                <div className="comparison-unreviewed-item-header">
                  <span className="comparison-unreviewed-item-number">{s.sampleNumber}</span>
                  <span
                    className="comparison-unreviewed-item-status"
                    style={{
                      background: s.status === "NEEDS_REVIEW" ? "#fef3c7" : "#fee2e2",
                      color: s.status === "NEEDS_REVIEW" ? "#a16207" : "#dc2626",
                    }}
                  >
                    {SAMPLE_STATUS_LABELS[s.status]}
                  </span>
                </div>
                <div className="comparison-unreviewed-item-meta">
                  {s.developmentStage || "未设置阶段"} · {s.samplingLocation || "未设置地点"}
                </div>
                <div className="comparison-unreviewed-item-time">
                  更新于 {formatDateTime(s.updatedAt)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="comparison-unreviewed-all-clear">
            ✅ 所有样本均已复核
          </div>
        )}
      </div>
    );
  };

  const renderActiveTab = () => {
    if (!bothSelected) {
      return (
        <div className="comparison-select-prompt">
          <div className="empty-icon">⚖️</div>
          <h3>请选择两个案件进行对照分析</h3>
          <p>从上方下拉框中选择需要对比的两个案件编号</p>
        </div>
      );
    }

    const renderCol = (caseIdx: 0 | 1) => {
      switch (activeTab) {
        case "timeline": return renderTimelineColumn(caseIdx);
        case "temperature": return renderTemperatureColumn(caseIdx);
        case "development": return renderDevelopmentColumn(caseIdx);
        case "unreviewed": return renderUnreviewedColumn(caseIdx);
      }
    };

    return (
      <div className="comparison-panels">
        <div className="comparison-panel">{renderCol(0)}</div>
        <div className="comparison-divider">
          <div className="comparison-divider-line" />
          <span className="comparison-divider-label">VS</span>
          <div className="comparison-divider-line" />
        </div>
        <div className="comparison-panel">{renderCol(1)}</div>
      </div>
    );
  };

  const tabs = [
    { key: "timeline" as const, label: "时间线", icon: "⏱️" },
    { key: "temperature" as const, label: "温度趋势", icon: "🌡️" },
    { key: "development" as const, label: "发育阶段", icon: "🪰" },
    { key: "unreviewed" as const, label: "未复核差异", icon: "⚠️" },
  ];

  return (
    <div className="case-comparison">
      <div className="comparison-header">
        <button className="back-button" onClick={onBack}>
          ← 返回
        </button>
        <div className="comparison-title-section">
          <h1 className="comparison-title">⚖️ 案件间对照分析</h1>
          <p className="comparison-subtitle">并排对比两个案件的时间线、温度、发育阶段和未复核情况</p>
        </div>
        <div className="comparison-deviation-badge">
          {deviations.length > 0 && (
            <span className="deviation-count-badge">
              ⚠️ {deviations.length} 个偏离
            </span>
          )}
        </div>
      </div>

      <div className="comparison-case-selector">
        <div className="comparison-select-group">
          <label className="comparison-select-label">
            <span className="comparison-select-badge" style={{ background: CASE_COLORS[0] }}>
              {CASE_LABELS[0]}
            </span>
            <select
              className="comparison-select"
              value={selectedCases[0]}
              onChange={(e) => handleCaseSelect(0, e.target.value)}
            >
              <option value="">选择案件</option>
              {allCaseNumbers
                .filter((cn) => cn !== selectedCases[1])
                .map((cn) => (
                  <option key={cn} value={cn}>{cn}</option>
                ))}
            </select>
          </label>
        </div>

        <div className="comparison-vs-badge">
          <span>VS</span>
        </div>

        <div className="comparison-select-group">
          <label className="comparison-select-label">
            <span className="comparison-select-badge" style={{ background: CASE_COLORS[1] }}>
              {CASE_LABELS[1]}
            </span>
            <select
              className="comparison-select"
              value={selectedCases[1]}
              onChange={(e) => handleCaseSelect(1, e.target.value)}
            >
              <option value="">选择案件</option>
              {allCaseNumbers
                .filter((cn) => cn !== selectedCases[0])
                .map((cn) => (
                  <option key={cn} value={cn}>{cn}</option>
                ))}
            </select>
          </label>
        </div>
      </div>

      {bothSelected && (
        <div className="comparison-summary-row">
          {caseData.map((cd, idx) => {
            const stats = caseTempStats[idx];
            return (
              <div
                key={cd.caseNumber}
                className="comparison-summary-card"
                style={{ borderTopColor: CASE_COLORS[idx] }}
              >
                <div className="comparison-summary-case">{cd.caseNumber}</div>
                <div className="comparison-summary-stats">
                  <span>{cd.samples.length} 样本</span>
                  <span>{stats.count} 温度记录</span>
                  <span>{stats.avg !== null ? `均温 ${stats.avg.toFixed(1)}℃` : "无温度数据"}</span>
                  <span>
                    {cd.samples.filter((s) => s.status === "NEEDS_REVIEW" || s.status === "PENDING_IDENTIFICATION").length} 未复核
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="comparison-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`comparison-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="comparison-tab-icon">{tab.icon}</span>
            <span className="comparison-tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {renderActiveTab()}

      {bothSelected && deviations.length > 0 && (
        <div className="comparison-deviation-section">
          <div className="comparison-deviation-header">
            <h3>⚠️ 偏离节点检测</h3>
            <span className="deviation-count-badge">{deviations.length} 项</span>
          </div>
          <p className="comparison-deviation-disclaimer">
            以下偏离标记仅作为分析参考，不修改任何原始样本数据
          </p>
          <div className="comparison-deviation-list">
            {deviations.map((dev) => (
              <div
                key={dev.id}
                className="comparison-deviation-card"
                style={{ borderLeftColor: severityColors[dev.severity] }}
              >
                <div className="comparison-deviation-card-header">
                  <span
                    className="comparison-deviation-severity"
                    style={{ background: severityColors[dev.severity] }}
                  >
                    {severityLabels[dev.severity]}
                  </span>
                  <span className="comparison-deviation-type">
                    {deviationTypeLabels[dev.type]}
                  </span>
                  <span
                    className="comparison-deviation-case-tag"
                    style={{ background: `${CASE_COLORS[dev.caseIndex]}15`, color: CASE_COLORS[dev.caseIndex] }}
                  >
                    {caseData[dev.caseIndex].caseNumber}
                  </span>
                </div>
                <h4 className="comparison-deviation-title">{dev.title}</h4>
                <p className="comparison-deviation-desc">{dev.description}</p>
                {dev.sampleNumber && (
                  <button
                    className="comparison-deviation-link"
                    onClick={() => {
                      if (dev.sampleId) onViewSampleDetail(dev.sampleId);
                    }}
                  >
                    查看样本 {dev.sampleNumber} →
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
