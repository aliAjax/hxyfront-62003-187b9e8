import { useState, useMemo, useEffect } from "react";
import {
  Sample,
  TemperatureRecord,
  formatDateTime,
  getSortedTemperatureRecords,
  DEVELOPMENT_STAGES,
  EXPOSURE_STAGES,
  SAMPLE_STATUS_LABELS,
  SAMPLE_STATUS_COLORS,
} from "./batchStorage";

interface TimelineAnalysisProps {
  samples: Sample[];
  caseNumber: string;
  onBack: () => void;
  onViewSampleDetail: (sampleId: string) => void;
  onMockSamplesReady?: (mockSamples: Sample[]) => void;
}

interface TimelineEvent {
  id: string;
  type: "sample" | "temperature" | "exposure" | "development" | "note";
  timestamp: string;
  title: string;
  description: string;
  sampleId?: string;
  sampleNumber?: string;
  temperature?: string;
  exposureStage?: string;
  developmentStage?: string;
  icon: string;
  color: string;
}

interface Anomaly {
  id: string;
  type: "temperature_gap" | "development_conflict" | "unreviewed_sample";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  relatedSampleIds: string[];
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

function generateMockSamples(caseNumber: string): Sample[] {
  const baseTime = new Date("2024-06-15T08:00:00").getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  const makeTempRecords = (startHour: number, count: number, baseTemp: number): TemperatureRecord[] => {
    const records: TemperatureRecord[] = [];
    for (let i = 0; i < count; i++) {
      const time = new Date(baseTime + startHour * 60 * 60 * 1000 + i * 4 * 60 * 60 * 1000);
      records.push({
        id: `TEMP-MOCK-${startHour}-${i}`,
        timestamp: time.toISOString(),
        temperature: (baseTemp + Math.random() * 5 - 2.5).toFixed(1),
        note: i === 2 ? "午后高温时段" : undefined,
      });
    }
    return records;
  };

  const samples: Sample[] = [
    {
      id: "SAMPLE-MOCK-001",
      sampleNumber: `${caseNumber}-A01`,
      insectSpecies: "红头丽蝇",
      developmentStage: "幼虫一龄",
      preservationMethod: "乙醇保存",
      identificationNotes: "样本采集自尸体口鼻腔，幼虫活性良好，需进一步鉴定至种。",
      relatedCase: caseNumber,
      samplingLocation: "室外草地-尸体头部",
      environmentTemperature: "26.5",
      environmentHumidity: "65",
      weatherCondition: "晴朗",
      exposureStage: "新鲜期",
      exposureNotes: "尸体新鲜，未见明显腐败迹象，昆虫定殖初期。",
      insectCount: "约50只",
      insectCollectionMethod: "镊子夹取",
      preservationSolution: "75%乙醇",
      storageTemperature: "4",
      temperatureRecords: makeTempRecords(0, 6, 26),
      status: "CONFIRMED",
      priority: "LOW",
      statusHistory: [],
      createdAt: new Date(baseTime + 2 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(baseTime + 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "SAMPLE-MOCK-002",
      sampleNumber: `${caseNumber}-A02`,
      insectSpecies: "大头金蝇",
      developmentStage: "幼虫二龄",
      preservationMethod: "活体饲养",
      identificationNotes: "样本采集自伤口处，疑似死后12-24小时定殖。",
      relatedCase: caseNumber,
      samplingLocation: "室外草地-尸体伤口",
      environmentTemperature: "28.3",
      environmentHumidity: "60",
      weatherCondition: "晴朗",
      exposureStage: "新鲜期",
      exposureNotes: "轻度肿胀开始出现。",
      insectCount: "约30只",
      insectCollectionMethod: "吸虫管",
      preservationSolution: "",
      storageTemperature: "25",
      temperatureRecords: makeTempRecords(8, 5, 28),
      status: "PHOTO_COMPLETED",
      priority: "MEDIUM",
      statusHistory: [],
      createdAt: new Date(baseTime + 10 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(baseTime + 10 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "SAMPLE-MOCK-003",
      sampleNumber: `${caseNumber}-B01`,
      insectSpecies: "丝光绿蝇",
      developmentStage: "幼虫三龄",
      preservationMethod: "乙醇保存",
      identificationNotes: "",
      relatedCase: caseNumber,
      samplingLocation: "阴影区域-尸体胸腹部",
      environmentTemperature: "24.8",
      environmentHumidity: "70",
      weatherCondition: "多云",
      exposureStage: "肿胀期",
      exposureNotes: "尸体明显肿胀，腐败气体产生。",
      insectCount: "约100只",
      insectCollectionMethod: "镊子夹取",
      preservationSolution: "75%乙醇",
      storageTemperature: "4",
      temperatureRecords: (() => {
        const records: TemperatureRecord[] = [];
        const startHour = 24;
        const baseTemp = 25;
        for (let i = 0; i < 2; i++) {
          const time = new Date(baseTime + startHour * 60 * 60 * 1000 + i * 4 * 60 * 60 * 1000);
          records.push({
            id: `TEMP-MOCK-B01-${i}`,
            timestamp: time.toISOString(),
            temperature: (baseTemp + Math.random() * 3 - 1.5).toFixed(1),
          });
        }
        const gapTime = new Date(baseTime + startHour * 60 * 60 * 1000 + 2 * 4 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);
        records.push({
          id: `TEMP-MOCK-B01-GAP`,
          timestamp: gapTime.toISOString(),
          temperature: (baseTemp + 1.5).toFixed(1),
          note: "记录中断后恢复，中间约12小时无数据",
        });
        for (let i = 0; i < 1; i++) {
          const time = new Date(gapTime.getTime() + (i + 1) * 4 * 60 * 60 * 1000);
          records.push({
            id: `TEMP-MOCK-B01-AFTER-${i}`,
            timestamp: time.toISOString(),
            temperature: (baseTemp + Math.random() * 3 - 1.5).toFixed(1),
          });
        }
        return records;
      })(),
      status: "NEEDS_REVIEW",
      priority: "HIGH",
      statusHistory: [],
      createdAt: new Date(baseTime + 1 * dayMs + 6 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(baseTime + 1 * dayMs + 6 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "SAMPLE-MOCK-004",
      sampleNumber: `${caseNumber}-B02`,
      insectSpecies: "铜绿蝇",
      developmentStage: "幼虫三龄",
      preservationMethod: "冷冻保存",
      identificationNotes: "需复核种属，疑似与B01为不同种。",
      relatedCase: caseNumber,
      samplingLocation: "阴影区域-尸体背部",
      environmentTemperature: "23.5",
      environmentHumidity: "72",
      weatherCondition: "多云",
      exposureStage: "肿胀期",
      exposureNotes: "背部昆虫密度较腹部低。",
      insectCount: "约60只",
      insectCollectionMethod: "扫网",
      preservationSolution: "",
      storageTemperature: "-20",
      temperatureRecords: [],
      status: "NEEDS_REVIEW",
      priority: "MEDIUM",
      statusHistory: [],
      createdAt: new Date(baseTime + 1 * dayMs + 8 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(baseTime + 1 * dayMs + 8 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "SAMPLE-MOCK-005",
      sampleNumber: `${caseNumber}-C01`,
      insectSpecies: "厩腐蝇",
      developmentStage: "蛹",
      preservationMethod: "干制标本",
      identificationNotes: "蛹壳样本，需进一步羽化鉴定。",
      relatedCase: caseNumber,
      samplingLocation: "尸体周围土壤",
      environmentTemperature: "22.1",
      environmentHumidity: "75",
      weatherCondition: "小雨",
      exposureStage: "腐败期",
      exposureNotes: "尸体进入腐败期，组织液化明显。",
      insectCount: "约20个",
      insectCollectionMethod: "土壤筛取",
      preservationSolution: "",
      storageTemperature: "室温",
      temperatureRecords: makeTempRecords(48, 3, 23),
      status: "PENDING_IDENTIFICATION",
      priority: "HIGH",
      statusHistory: [],
      createdAt: new Date(baseTime + 2 * dayMs + 12 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(baseTime + 2 * dayMs + 12 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "SAMPLE-MOCK-006",
      sampleNumber: `${caseNumber}-D01`,
      insectSpecies: "幼虫-疑似丽蝇科",
      developmentStage: "幼虫二龄",
      preservationMethod: "乙醇保存",
      identificationNotes: "可疑样本，后期采集却为低龄幼虫，需复核采样时间记录。",
      relatedCase: caseNumber,
      samplingLocation: "尸体下方土壤",
      environmentTemperature: "25.0",
      environmentHumidity: "55",
      weatherCondition: "晴朗",
      exposureStage: "后腐败期",
      exposureNotes: "后期腐败阶段，样本发育阶段与时间不符。",
      insectCount: "8只",
      insectCollectionMethod: "土壤筛取",
      preservationSolution: "75%乙醇",
      storageTemperature: "4",
      temperatureRecords: makeTempRecords(72, 2, 25),
      status: "NEEDS_REVIEW",
      priority: "HIGH",
      statusHistory: [],
      createdAt: new Date(baseTime + 3 * dayMs + 10 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(baseTime + 3 * dayMs + 10 * 60 * 60 * 1000).toISOString(),
    },
  ];

  return samples;
}

export default function TimelineAnalysis({
  samples: propSamples,
  caseNumber,
  onBack,
  onViewSampleDetail,
  onMockSamplesReady,
}: TimelineAnalysisProps) {
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const mockSamples = useMemo(() => generateMockSamples(caseNumber), [caseNumber]);

  const realCaseSamples = useMemo(() => {
    return propSamples.filter((s) => s.relatedCase === caseNumber);
  }, [propSamples, caseNumber]);

  const hasSufficientRealData = useMemo(() => {
    if (realCaseSamples.length < 2) return false;
    const hasTempRecords = realCaseSamples.some(
      (s) => s.temperatureRecords && s.temperatureRecords.length >= 3
    );
    const hasDevelopmentStages = realCaseSamples.some((s) => s.developmentStage);
    const hasExposureStages = realCaseSamples.some((s) => s.exposureStage);
    return hasTempRecords && hasDevelopmentStages && hasExposureStages;
  }, [realCaseSamples]);

  const caseSamples = useMemo(() => {
    return hasSufficientRealData ? realCaseSamples : mockSamples;
  }, [hasSufficientRealData, realCaseSamples, mockSamples]);

  useEffect(() => {
    if (!hasSufficientRealData && onMockSamplesReady) {
      onMockSamplesReady(mockSamples);
    } else if (onMockSamplesReady) {
      onMockSamplesReady([]);
    }
  }, [hasSufficientRealData, mockSamples, onMockSamplesReady]);

  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = [];

    caseSamples.forEach((sample) => {
      events.push({
        id: `sample-${sample.id}`,
        type: "sample",
        timestamp: sample.createdAt,
        title: `样本采集：${sample.sampleNumber}`,
        description: `${sample.samplingLocation} · ${sample.insectCount || "数量未知"}`,
        sampleId: sample.id,
        sampleNumber: sample.sampleNumber,
        icon: "🧫",
        color: "#365314",
      });

      if (sample.exposureStage) {
        events.push({
          id: `exposure-${sample.id}`,
          type: "exposure",
          timestamp: sample.createdAt,
          title: `暴露阶段：${sample.exposureStage}`,
          description: sample.exposureNotes || "无备注",
          sampleId: sample.id,
          sampleNumber: sample.sampleNumber,
          exposureStage: sample.exposureStage,
          icon: "💀",
          color: "#dc2626",
        });
      }

      if (sample.developmentStage) {
        events.push({
          id: `dev-${sample.id}`,
          type: "development",
          timestamp: sample.createdAt,
          title: `发育阶段：${sample.developmentStage}`,
          description: sample.insectSpecies || "物种未鉴定",
          sampleId: sample.id,
          sampleNumber: sample.sampleNumber,
          developmentStage: sample.developmentStage,
          icon: "🪰",
          color: "#a16207",
        });
      }

      if (sample.identificationNotes) {
        events.push({
          id: `note-${sample.id}`,
          type: "note",
          timestamp: sample.updatedAt,
          title: "鉴定备注",
          description: sample.identificationNotes,
          sampleId: sample.id,
          sampleNumber: sample.sampleNumber,
          icon: "📝",
          color: "#2563eb",
        });
      }

      const sortedTemps = getSortedTemperatureRecords(sample.temperatureRecords);
      sortedTemps.forEach((record) => {
        events.push({
          id: `temp-${record.id}`,
          type: "temperature",
          timestamp: record.timestamp,
          title: `温度记录：${record.temperature}℃`,
          description: record.note || sample.sampleNumber,
          sampleId: sample.id,
          sampleNumber: sample.sampleNumber,
          temperature: record.temperature,
          icon: "🌡️",
          color: "#0891b2",
        });
      });
    });

    return events.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [caseSamples]);

  const filteredEvents = useMemo(() => {
    if (activeFilter === "all") return timelineEvents;
    return timelineEvents.filter((e) => e.type === activeFilter);
  }, [timelineEvents, activeFilter]);

  const anomalies = useMemo<Anomaly[]>(() => {
    const results: Anomaly[] = [];

    caseSamples.forEach((sample) => {
      const temps = getSortedTemperatureRecords(sample.temperatureRecords);
      if (temps.length > 1) {
        for (let i = 0; i < temps.length - 1; i++) {
          const gap =
            new Date(temps[i + 1].timestamp).getTime() -
            new Date(temps[i].timestamp).getTime();
          const gapHours = gap / (1000 * 60 * 60);
          if (gapHours > 8) {
            results.push({
              id: `gap-${sample.id}-${i}`,
              type: "temperature_gap",
              severity: gapHours > 24 ? "high" : "medium",
              title: `温度记录缺口：${sample.sampleNumber}`,
              description: `第${i + 1}条与第${i + 2}条记录间隔约${gapHours.toFixed(1)}小时，超出建议的8小时监测间隔。`,
              relatedSampleIds: [sample.id],
              timestamp: temps[i].timestamp,
            });
          }
        }
      }
    });

    const sortedByTime = [...caseSamples].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    for (let i = 0; i < sortedByTime.length - 1; i++) {
      const earlier = sortedByTime[i];
      const later = sortedByTime[i + 1];
      const earlierStage = STAGE_ORDER[earlier.developmentStage];
      const laterStage = STAGE_ORDER[later.developmentStage];
      if (
        earlierStage !== undefined &&
        laterStage !== undefined &&
        earlierStage > laterStage
      ) {
        results.push({
          id: `conflict-${earlier.id}-${later.id}`,
          type: "development_conflict",
          severity: "high",
          title: `发育阶段冲突：${earlier.sampleNumber} vs ${later.sampleNumber}`,
          description: `采集时间较早的${earlier.sampleNumber}（${earlier.developmentStage}）比采集时间较晚的${later.sampleNumber}（${later.developmentStage}）发育阶段更高级，可能存在采样时间记录错误或物种差异。`,
          relatedSampleIds: [earlier.id, later.id],
          timestamp: earlier.createdAt,
        });
      }
    }

    caseSamples.forEach((sample) => {
      if (sample.status === "NEEDS_REVIEW" || sample.status === "PENDING_IDENTIFICATION") {
        results.push({
          id: `review-${sample.id}`,
          type: "unreviewed_sample",
          severity: sample.status === "PENDING_IDENTIFICATION" ? "medium" : "low",
          title: `未复核样本：${sample.sampleNumber}`,
          description: `样本状态为「${SAMPLE_STATUS_LABELS[sample.status]}」，需及时处理。`,
          relatedSampleIds: [sample.id],
          timestamp: sample.updatedAt,
        });
      }
    });

    return results;
  }, [caseSamples]);

  const timeRange = useMemo(() => {
    if (timelineEvents.length === 0) {
      return { start: new Date(), end: new Date(), duration: 0 };
    }
    const start = new Date(timelineEvents[0].timestamp);
    const end = new Date(timelineEvents[timelineEvents.length - 1].timestamp);
    const duration = end.getTime() - start.getTime();
    return { start, end, duration };
  }, [timelineEvents]);

  const getPosition = (timestamp: string): number => {
    if (timeRange.duration === 0) return 50;
    const time = new Date(timestamp).getTime();
    return ((time - timeRange.start.getTime()) / timeRange.duration) * 100;
  };

  const filterOptions = [
    { key: "all", label: "全部", icon: "📊" },
    { key: "sample", label: "样本采集", icon: "🧫" },
    { key: "temperature", label: "温度记录", icon: "🌡️" },
    { key: "exposure", label: "暴露阶段", icon: "💀" },
    { key: "development", label: "发育阶段", icon: "🪰" },
    { key: "note", label: "鉴定备注", icon: "📝" },
  ];

  const anomalyTypeLabels: Record<string, string> = {
    temperature_gap: "温度记录缺口",
    development_conflict: "发育阶段冲突",
    unreviewed_sample: "未复核样本",
  };

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

  return (
    <div className="timeline-analysis">
      <div className="timeline-header">
        <button className="back-button" onClick={onBack}>
          ← 返回
        </button>
        <div className="timeline-title-section">
          <h1 className="timeline-title">⏱️ 法医昆虫学时间线分析</h1>
          <p className="timeline-subtitle">案件：{caseNumber}</p>
        </div>
        <div className="timeline-stats-badge">
          <span className="timeline-event-count">{timelineEvents.length} 个事件</span>
        </div>
      </div>

      <div className="timeline-summary-cards">
        <div className="summary-card summary-samples">
          <div className="summary-card-icon">🧫</div>
          <div className="summary-card-info">
            <span className="summary-card-label">样本数量</span>
            <strong className="summary-card-value">{caseSamples.length}</strong>
          </div>
        </div>
        <div className="summary-card summary-temp">
          <div className="summary-card-icon">🌡️</div>
          <div className="summary-card-info">
            <span className="summary-card-label">温度记录</span>
            <strong className="summary-card-value">
              {caseSamples.reduce((sum, s) => sum + s.temperatureRecords.length, 0)}
            </strong>
          </div>
        </div>
        <div className="summary-card summary-stage">
          <div className="summary-card-icon">🪰</div>
          <div className="summary-card-info">
            <span className="summary-card-label">发育阶段</span>
            <strong className="summary-card-value">
              {new Set(caseSamples.map((s) => s.developmentStage).filter(Boolean)).size}
            </strong>
          </div>
        </div>
        <div className="summary-card summary-anomaly">
          <div className="summary-card-icon">⚠️</div>
          <div className="summary-card-info">
            <span className="summary-card-label">异常检测</span>
            <strong className="summary-card-value">{anomalies.length}</strong>
          </div>
        </div>
      </div>

      <div className="timeline-filters">
        {filterOptions.map((opt) => (
          <button
            key={opt.key}
            className={`timeline-filter-btn ${activeFilter === opt.key ? "active" : ""}`}
            onClick={() => setActiveFilter(opt.key)}
          >
            <span className="filter-icon">{opt.icon}</span>
            <span className="filter-label">{opt.label}</span>
            <span className="filter-count">
              {opt.key === "all"
                ? timelineEvents.length
                : timelineEvents.filter((e) => e.type === opt.key).length}
            </span>
          </button>
        ))}
      </div>

      {anomalies.length > 0 && (
        <div className="anomaly-section">
          <div className="anomaly-section-header">
            <h3 className="anomaly-section-title">⚠️ 异常检测结果</h3>
            <span className="anomaly-count-badge">{anomalies.length} 项</span>
          </div>
          <div className="anomaly-list">
            {anomalies.map((anomaly) => (
              <div
                key={anomaly.id}
                className="anomaly-card"
                style={{ borderLeftColor: severityColors[anomaly.severity] }}
              >
                <div className="anomaly-card-header">
                  <span
                    className="anomaly-severity-badge"
                    style={{ background: severityColors[anomaly.severity] }}
                  >
                    {severityLabels[anomaly.severity]}
                  </span>
                  <span className="anomaly-type">
                    {anomalyTypeLabels[anomaly.type]}
                  </span>
                </div>
                <h4 className="anomaly-title">{anomaly.title}</h4>
                <p className="anomaly-description">{anomaly.description}</p>
                <div className="anomaly-samples">
                  {anomaly.relatedSampleIds.map((sid) => {
                    const s = caseSamples.find((sample) => sample.id === sid);
                    return s ? (
                      <button
                        key={sid}
                        className="anomaly-sample-tag"
                        onClick={() => onViewSampleDetail(sid)}
                      >
                        {s.sampleNumber}
                      </button>
                    ) : null;
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="timeline-container">
        <div className="timeline-axis">
          <div className="timeline-axis-start">
            {formatDateTime(timeRange.start.toISOString())}
          </div>
          <div className="timeline-axis-end">
            {formatDateTime(timeRange.end.toISOString())}
          </div>
        </div>

        <div className="timeline-track">
          <div className="timeline-line" />
          {filteredEvents.map((event) => (
            <div
              key={event.id}
              className={`timeline-node ${selectedEvent?.id === event.id ? "selected" : ""}`}
              style={{
                left: `${getPosition(event.timestamp)}%`,
                "--node-color": event.color,
              } as React.CSSProperties}
              onClick={() =>
                setSelectedEvent(selectedEvent?.id === event.id ? null : event)
              }
              title={`${event.title} - ${formatDateTime(event.timestamp)}`}
            >
              <div className="timeline-node-dot">
                <span className="timeline-node-icon">{event.icon}</span>
              </div>
              <div className="timeline-node-label">{event.title}</div>
            </div>
          ))}
        </div>

        <div className="timeline-events-list">
          <h3 className="timeline-list-title">📋 事件列表</h3>
          <div className="timeline-events-scroll">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className={`timeline-event-item ${
                  selectedEvent?.id === event.id ? "active" : ""
                }`}
                style={{ borderLeftColor: event.color }}
                onClick={() =>
                  setSelectedEvent(selectedEvent?.id === event.id ? null : event)
                }
              >
                <div className="event-item-left">
                  <div
                    className="event-item-icon"
                    style={{ background: `${event.color}15`, color: event.color }}
                  >
                    {event.icon}
                  </div>
                  <div className="event-item-content">
                    <div className="event-item-title">{event.title}</div>
                    <div className="event-item-desc">{event.description}</div>
                  </div>
                </div>
                <div className="event-item-right">
                  <div className="event-item-time">
                    {formatDateTime(event.timestamp)}
                  </div>
                  {event.sampleNumber && (
                    <button
                      className="event-sample-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (event.sampleId) onViewSampleDetail(event.sampleId);
                      }}
                    >
                      查看样本 →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedEvent && (
        <div className="timeline-detail-panel">
          <div className="detail-panel-header">
            <div className="detail-panel-title-row">
              <span
                className="detail-panel-icon"
                style={{ background: `${selectedEvent.color}15`, color: selectedEvent.color }}
              >
                {selectedEvent.icon}
              </span>
              <div>
                <h3 className="detail-panel-title">{selectedEvent.title}</h3>
                <p className="detail-panel-time">
                  {formatDateTime(selectedEvent.timestamp)}
                </p>
              </div>
            </div>
            <button
              className="detail-panel-close"
              onClick={() => setSelectedEvent(null)}
            >
              ✕
            </button>
          </div>

          <div className="detail-panel-body">
            <div className="detail-panel-section">
              <label className="detail-panel-label">描述</label>
              <div className="detail-panel-value">{selectedEvent.description}</div>
            </div>

            {selectedEvent.sampleNumber && (
              <div className="detail-panel-section">
                <label className="detail-panel-label">关联样本</label>
                <button
                  className="detail-sample-card"
                  onClick={() => {
                    if (selectedEvent.sampleId) {
                      onViewSampleDetail(selectedEvent.sampleId);
                    }
                  }}
                >
                  <span className="detail-sample-number">
                    {selectedEvent.sampleNumber}
                  </span>
                  <span className="detail-sample-arrow">查看详情 →</span>
                </button>
              </div>
            )}

            {selectedEvent.temperature && (
              <div className="detail-panel-section">
                <label className="detail-panel-label">温度值</label>
                <div className="detail-temp-value">
                  {selectedEvent.temperature}
                  <span className="detail-temp-unit">℃</span>
                </div>
              </div>
            )}

            {selectedEvent.developmentStage && (
              <div className="detail-panel-section">
                <label className="detail-panel-label">发育阶段</label>
                <div className="detail-stage-display">
                  {DEVELOPMENT_STAGES.map((stage, idx) => (
                    <div
                      key={stage}
                      className={`stage-step ${
                        stage === selectedEvent.developmentStage ? "current" : ""
                      } ${
                        STAGE_ORDER[stage] <
                        (STAGE_ORDER[selectedEvent.developmentStage!] ?? -1)
                          ? "passed"
                          : ""
                      }`}
                    >
                      <div className="stage-step-dot" />
                      <span className="stage-step-label">{stage}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedEvent.exposureStage && (
              <div className="detail-panel-section">
                <label className="detail-panel-label">尸体暴露阶段</label>
                <div className="detail-exposure-display">
                  {EXPOSURE_STAGES.map((stage) => (
                    <div
                      key={stage}
                      className={`exposure-step ${
                        stage === selectedEvent.exposureStage ? "current" : ""
                      } ${
                        EXPOSURE_ORDER[stage] <
                        (EXPOSURE_ORDER[selectedEvent.exposureStage!] ?? -1)
                          ? "passed"
                          : ""
                      }`}
                    >
                      {stage}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
