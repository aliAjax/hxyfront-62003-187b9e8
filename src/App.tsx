import { useState, useEffect, useRef, useCallback } from "react";
import "./styles.css";
import BatchForm from "./BatchForm";
import BatchList from "./BatchList";
import SampleDetail from "./SampleDetail";
import DevelopmentStageFilter from "./DevelopmentStageFilter";
import CaseAssociationWorkspace from "./CaseAssociationWorkspace";
import IdentificationQueue from "./IdentificationQueue";
import {
  SampleBatch,
  Sample,
  SampleStatus,
  StatusHistoryRecord,
  loadBatches,
  saveBatches,
  loadSamples,
  saveSamples,
  generateSampleId,
  generateStatusHistoryId,
  getSampleById,
  updateSample,
  updateSampleStatus,
  associateSampleToCase,
  unassociateSampleFromCase,
  getAllCaseNumbers,
  updateBatch,
  isAbnormalTemperature,
  formatDateTime,
  getSortedTemperatureRecords,
} from "./batchStorage";
import SampleFormWizard from "./SampleFormWizard";
import SampleExportSummary from "./SampleExportSummary";
import OfflineWorkbench from "./OfflineWorkbench";
import TimelineAnalysis from "./TimelineAnalysis";

const project = {
  "sourceNo": 5,
  "id": "hxyfront-62003",
  "port": 62003,
  "title": "法医昆虫学样本记录",
  "domain": "法医昆虫学",
  "prompt": "做一个法医昆虫学样本记录前端工具，用来记录采样地点、环境温度、尸体暴露阶段、昆虫种类、发育阶段、采样时间、保存方式和鉴定备注。页面需要有样本批次列表、发育阶段筛选、温度记录图、案件样本关联页和单个样本详情卡片。",
  "palette": [
    "#365314",
    "#a16207",
    "#dc2626"
  ],
  "metrics": [
    "样本批次",
    "平均温度",
    "发育阶段",
    "待鉴定"
  ],
  "filters": [
    "卵",
    "幼虫",
    "蛹",
    "成虫"
  ],
  "fields": [
    "采样地点",
    "环境温度",
    "暴露阶段",
    "昆虫种类",
    "发育阶段",
    "保存方式"
  ],
  "records": [
    [
      "CASE-042-A",
      "室外草地",
      "幼虫三龄，28.6℃",
      "乙醇保存"
    ],
    [
      "CASE-042-B",
      "阴影区域",
      "蛹期样本",
      "需复核种属"
    ],
    [
      "CASE-051-A",
      "水沟边缘",
      "成虫采集",
      "已完成拍照"
    ]
  ]
};

type ViewMode = "list" | "detail" | "filter" | "association" | "queue" | "wizard" | "export" | "offline" | "timeline";

function App() {
  const [batches, setBatches] = useState<SampleBatch[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [previousViewMode, setPreviousViewMode] = useState<ViewMode>("list");
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [selectedCaseForTimeline, setSelectedCaseForTimeline] = useState<string>("CASE-042");
  const [timelineMockSamples, setTimelineMockSamples] = useState<Sample[]>([]);

  const dirtyCheckerRef = useRef<() => boolean>(() => false);

  const registerDirtyChecker = useCallback((checker: () => boolean) => {
    dirtyCheckerRef.current = checker;
  }, []);

  const confirmDiscardBeforeNavigate = (): boolean => {
    if (viewMode !== "detail") return true;
    const isDirty = dirtyCheckerRef.current();
    if (!isDirty) return true;
    return window.confirm("您有未保存的修改，确定要离开当前页面吗？未保存的内容将丢失。");
  };

  useEffect(() => {
    const loadedBatches = loadBatches();
    let loadedSamples = loadSamples();

    const extractTempFromRecordInfo = (info: string): string => {
      const match = info.match(/([\d.]+)\s*℃/);
      return match ? match[1] : "";
    };

    const recordData: Record<string, { location: string; temperature: string }> = {
      "CASE-042-A": { location: "室外草地", temperature: "28.6" },
      "CASE-042-B": { location: "阴影区域", temperature: "25.3" },
      "CASE-051-A": { location: "水沟边缘", temperature: "22.8" },
    };

    if (loadedSamples.length === 0) {
      const now = new Date().toISOString();
      const initialStatuses: SampleStatus[] = ["PENDING_IDENTIFICATION", "NEEDS_REVIEW", "PHOTO_COMPLETED"];
      const initialSamples: Sample[] = project.records.map((record, index) => {
        const status: SampleStatus = initialStatuses[index] || "PENDING_IDENTIFICATION";
        const statusHistory: StatusHistoryRecord[] = [{
          id: generateStatusHistoryId(),
          oldStatus: null,
          newStatus: status,
          timestamp: now,
          operator: "系统初始化",
          note: "样本创建，初始状态设置",
        }];
        return {
          id: generateSampleId(),
          sampleNumber: record[0],
          insectSpecies: "",
          developmentStage: index === 0 ? "幼虫三龄" : index === 1 ? "蛹" : "成虫",
          preservationMethod: index === 0 ? "乙醇保存" : "",
          identificationNotes: index === 1 ? "需复核种属" : index === 2 ? "已完成拍照" : "",
          relatedCase: record[0].split("-").slice(0, 2).join("-"),
          samplingLocation: recordData[record[0]]?.location || record[1] || "",
          environmentTemperature: recordData[record[0]]?.temperature || extractTempFromRecordInfo(record[2]) || "",
          environmentHumidity: "",
          weatherCondition: "",
          exposureStage: "",
          exposureNotes: "",
          insectCount: "",
          insectCollectionMethod: "",
          preservationSolution: "",
          storageTemperature: "",
          temperatureRecords: [],
          status,
          statusHistory,
          createdAt: now,
          updatedAt: now,
        };
      });
      loadedSamples = initialSamples;
      saveSamples(initialSamples);
    } else {
      const now = new Date().toISOString();
      let needsMigration = false;
      const migratedSamples = loadedSamples.map((sample) => {
        let changed = false;
        const newSample = { ...sample };
        const record = recordData[sample.sampleNumber];
        if (!newSample.samplingLocation) {
          if (record?.location) {
            newSample.samplingLocation = record.location;
            changed = true;
          } else {
              const batch = loadedBatches.find((b) => b.caseNumber === sample.relatedCase);
              if (batch?.samplingLocation) {
                newSample.samplingLocation = batch.samplingLocation;
                changed = true;
              }
          }
        }
        if (!newSample.environmentTemperature) {
          if (record?.temperature) {
            newSample.environmentTemperature = record.temperature;
            changed = true;
          } else {
            const batch = loadedBatches.find((b) => b.caseNumber === sample.relatedCase);
            if (batch?.environmentTemperature) {
              newSample.environmentTemperature = batch.environmentTemperature;
              changed = true;
            }
          }
        }
        if (!newSample.temperatureRecords) {
          newSample.temperatureRecords = [];
          changed = true;
        }
        if (!newSample.status) {
          let inferredStatus: SampleStatus = "PENDING_IDENTIFICATION";
          if (sample.identificationNotes?.includes("需复核种属")) {
            inferredStatus = "NEEDS_REVIEW";
          } else if (sample.identificationNotes?.includes("已完成拍照")) {
            inferredStatus = "PHOTO_COMPLETED";
          } else if (sample.identificationNotes?.includes("已确认")) {
            inferredStatus = "CONFIRMED";
          }
          newSample.status = inferredStatus;
          changed = true;
        }
        if (!newSample.statusHistory || newSample.statusHistory.length === 0) {
          newSample.statusHistory = [{
            id: generateStatusHistoryId(),
            oldStatus: null,
            newStatus: newSample.status,
            timestamp: sample.createdAt || now,
            operator: "数据迁移",
            note: "系统自动推断初始状态",
          }];
          changed = true;
        }
        if (changed) {
          newSample.updatedAt = now;
          needsMigration = true;
        }
        return newSample;
      });
      if (needsMigration) {
        loadedSamples = migratedSamples;
        saveSamples(migratedSamples);
      }
    }

    setBatches(loadedBatches);
    setSamples(loadedSamples);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      saveBatches(batches);
    }
  }, [batches, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      saveSamples(samples);
    }
  }, [samples, isLoaded]);

  const handleViewDetail = (sampleId: string) => {
    if (!confirmDiscardBeforeNavigate()) return;
    setPreviousViewMode(viewMode);
    setSelectedSampleId(sampleId);
    setViewMode("detail");
  };

  const handleBackFromDetail = () => {
    setViewMode(previousViewMode);
    setSelectedSampleId(null);
  };

  const handleSaveSample = (updatedSample: Sample) => {
    setSamples((prev) => updateSample(prev, updatedSample.id, updatedSample));
  };

  const handleCreateBatch = (newBatch: SampleBatch) => {
    setBatches((prev) => [newBatch, ...prev]);
  };

  const handleDeleteBatch = (id: string) => {
    setBatches((prev) => prev.filter((b) => b.id !== id));
  };

  const handleUpdateBatch = (id: string, updates: Partial<SampleBatch>) => {
    setBatches((prev) => updateBatch(prev, id, updates));
  };

  const handleOpenFilter = () => {
    if (!confirmDiscardBeforeNavigate()) return;
    setViewMode("filter");
  };

  const handleBackFromFilter = () => {
    setViewMode("list");
  };

  const handleOpenAssociation = () => {
    if (!confirmDiscardBeforeNavigate()) return;
    setViewMode("association");
  };

  const handleBackFromAssociation = () => {
    setViewMode("list");
  };

  const handleAssociateSample = (sampleId: string, caseNumber: string) => {
    setSamples((prev) => associateSampleToCase(prev, sampleId, caseNumber));
  };

  const handleUnassociateSample = (sampleId: string) => {
    setSamples((prev) => unassociateSampleFromCase(prev, sampleId));
  };

  const handleOpenQueue = () => {
    if (!confirmDiscardBeforeNavigate()) return;
    setViewMode("queue");
  };

  const handleBackFromQueue = () => {
    setViewMode("list");
  };

  const handleUpdateSampleStatus = (
    sampleId: string,
    newStatus: SampleStatus,
    note: string
  ) => {
    setSamples((prev) => updateSampleStatus(prev, sampleId, newStatus, note));
  };

  const handleOpenWizard = () => {
    if (!confirmDiscardBeforeNavigate()) return;
    setPreviousViewMode(viewMode);
    setViewMode("wizard");
  };

  const handleBackFromWizard = () => {
    setViewMode(previousViewMode);
  };

  const handleCreateSampleFromWizard = (newSample: Sample) => {
    setSamples((prev) => [newSample, ...prev]);
    setViewMode("list");
  };

  const handleOpenExport = () => {
    if (!confirmDiscardBeforeNavigate()) return;
    setViewMode("export");
  };

  const handleBackFromExport = () => {
    setViewMode("list");
  };

  const handleOpenOffline = () => {
    if (!confirmDiscardBeforeNavigate()) return;
    setViewMode("offline");
  };

  const handleBackFromOffline = () => {
    setViewMode("list");
  };

  const handleOpenTimeline = (caseNumber?: string) => {
    if (!confirmDiscardBeforeNavigate()) return;
    if (caseNumber) {
      setSelectedCaseForTimeline(caseNumber);
    }
    setPreviousViewMode(viewMode);
    setViewMode("timeline");
  };

  const handleBackFromTimeline = () => {
    setViewMode(previousViewMode);
  };

  const handleTimelineMockSamplesReady = (mockSamples: Sample[]) => {
    setTimelineMockSamples(mockSamples);
  };

  const totalSamples = batches.reduce((sum, b) => sum + b.sampleCount, 0);
  const avgTemp = batches.length > 0
    ? (
        batches
          .map((b) => parseFloat(b.environmentTemperature))
          .filter((t) => !isNaN(t))
          .reduce((sum, t, _, arr) => sum + t / arr.length, 0)
      ).toFixed(1)
    : "—";

  const dynamicMetrics = [
    { label: project.metrics[0], value: batches.length },
    { label: project.metrics[1], value: avgTemp },
    { label: project.metrics[2], value: new Set(batches.map((b) => b.exposureStage).filter(Boolean)).size },
    { label: project.metrics[3], value: totalSamples },
  ];

  const selectedSample = selectedSampleId
    ? getSampleById([...samples, ...timelineMockSamples], selectedSampleId)
    : null;

  if (viewMode === "filter") {
    return (
      <main className="app">
        <DevelopmentStageFilter
          samples={samples}
          onBack={handleBackFromFilter}
          onViewDetail={handleViewDetail}
        />
      </main>
    );
  }

  if (viewMode === "association") {
    return (
      <main className="app">
        <CaseAssociationWorkspace
          batches={batches}
          samples={samples}
          onBack={handleBackFromAssociation}
          onAssociate={handleAssociateSample}
          onUnassociate={handleUnassociateSample}
          onViewSampleDetail={handleViewDetail}
        />
      </main>
    );
  }

  if (viewMode === "detail" && selectedSample) {
    return (
      <main className="app">
        <SampleDetail
          sample={selectedSample}
          allSamples={samples}
          onBack={handleBackFromDetail}
          onSave={handleSaveSample}
          onNavigateToSample={handleViewDetail}
          registerDirtyChecker={registerDirtyChecker}
        />
      </main>
    );
  }

  if (viewMode === "queue") {
    return (
      <main className="app">
        <IdentificationQueue
          samples={samples}
          onBack={handleBackFromQueue}
          onViewDetail={handleViewDetail}
          onUpdateStatus={handleUpdateSampleStatus}
        />
      </main>
    );
  }

  if (viewMode === "wizard") {
    return (
      <main className="app">
        <SampleFormWizard
          onBack={handleBackFromWizard}
          onSubmit={handleCreateSampleFromWizard}
          existingCaseNumbers={getAllCaseNumbers(batches, samples)}
        />
      </main>
    );
  }

  if (viewMode === "export") {
    return (
      <main className="app">
        <SampleExportSummary
          samples={samples}
          batches={batches}
          onBack={handleBackFromExport}
        />
      </main>
    );
  }

  if (viewMode === "offline") {
    return <OfflineWorkbench />;
  }

  if (viewMode === "timeline") {
    return (
      <main className="app">
        <TimelineAnalysis
          samples={samples}
          caseNumber={selectedCaseForTimeline}
          onBack={handleBackFromTimeline}
          onViewSampleDetail={handleViewDetail}
          onMockSamplesReady={handleTimelineMockSamplesReady}
        />
      </main>
    );
  }

  return (
    <main className="app">
      <section className="hero">
        <p>{project.id} · 源提示词{project.sourceNo} · Port {project.port}</p>
        <h1>{project.title}</h1>
        <span>{project.prompt}</span>
      </section>

      <section className="metrics">
        {dynamicMetrics.map((item, index: number) => (
          <article key={item.label}>
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="workspace">
        <aside className="panel">
          <h2>{project.domain}筛选</h2>
          <div className="chips">
            {project.filters.map((item: string) => (
              <button key={item} onClick={handleOpenFilter}>
                {item}
              </button>
            ))}
          </div>
          <div className="association-entry" style={{ marginTop: "16px" }}>
            <button
              className="primary full-width"
              onClick={handleOpenAssociation}
            >
              📁 案件样本关联
            </button>
          </div>
          <div className="association-entry" style={{ marginTop: "10px" }}>
            <button
              className="primary full-width"
              onClick={handleOpenQueue}
              style={{ background: "#a16207", borderColor: "#a16207" }}
            >
              🔬 鉴定复核队列
            </button>
          </div>
          <div className="association-entry" style={{ marginTop: "10px" }}>
            <button
              className="primary full-width"
              onClick={handleOpenWizard}
              style={{ background: "#1e40af", borderColor: "#1e40af" }}
            >
              📋 现场采样表单向导
            </button>
          </div>
          <div className="association-entry" style={{ marginTop: "10px" }}>
            <button
              className="primary full-width"
              onClick={handleOpenExport}
              style={{ background: "#7c3aed", borderColor: "#7c3aed" }}
            >
              📤 样本导出摘要
            </button>
          </div>
          <div className="association-entry" style={{ marginTop: "10px" }}>
            <button
              className="primary full-width"
              onClick={handleOpenOffline}
              style={{ background: "linear-gradient(135deg, #0ea5e9, #0891b2)", borderColor: "#0ea5e9" }}
            >
              🌐 离线优先工作台
            </button>
          </div>
          <div className="association-entry" style={{ marginTop: "10px" }}>
            <button
              className="primary full-width"
              onClick={() => handleOpenTimeline()}
              style={{ background: "linear-gradient(135deg, #059669, #047857)", borderColor: "#059669" }}
            >
              ⏱️ 时间线分析
            </button>
          </div>
        </aside>

        <BatchForm onSubmit={handleCreateBatch} />
      </section>

      {isLoaded && <BatchList batches={batches} onDelete={handleDeleteBatch} onUpdate={handleUpdateBatch} />}

      {(() => {
        const allAbnormalRecords = samples.flatMap((s) =>
          getSortedTemperatureRecords(s.temperatureRecords)
            .filter((r) => {
              const temp = parseFloat(r.temperature);
              return !isNaN(temp) && isAbnormalTemperature(temp);
            })
            .map((r) => ({
              ...r,
              sampleId: s.id,
              sampleNumber: s.sampleNumber,
              relatedCase: s.relatedCase,
            }))
        ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        if (allAbnormalRecords.length === 0) return null;

        return (
          <section className="panel global-abnormal-panel" style={{ marginTop: "18px" }}>
            <div className="heading">
              <div>
                <p style={{ color: "#dc2626" }}>温度预警</p>
                <h2>温度异常概览</h2>
              </div>
              <div className="global-abnormal-stats">
                <span className="global-abnormal-count">
                  ⚠️ 共 {allAbnormalRecords.length} 条异常记录
                </span>
              </div>
            </div>
            <div className="global-abnormal-table">
              <div className="global-abnormal-head">
                <div className="g-abnormal-col-type">类型</div>
                <div className="g-abnormal-col-sample">样本编号</div>
                <div className="g-abnormal-col-case">关联案件</div>
                <div className="g-abnormal-col-time">异常时间</div>
                <div className="g-abnormal-col-temp">温度值</div>
                <div className="g-abnormal-col-note">备注</div>
                <div className="g-abnormal-col-action">操作</div>
              </div>
              <div className="global-abnormal-body">
                {allAbnormalRecords.slice(0, 10).map((record) => {
                  const temp = parseFloat(record.temperature);
                  const isHigh = temp > 50;
                  return (
                    <div
                      key={`global-${record.id}`}
                      className={`global-abnormal-row ${isHigh ? "high" : "low"}`}
                    >
                      <div className="g-abnormal-col-type">
                        <span className={`abnormal-type-tag ${isHigh ? "high" : "low"}`}>
                          {isHigh ? "🔥 高温" : "❄️ 低温"}
                        </span>
                      </div>
                      <div className="g-abnormal-col-sample">
                        <span className="g-abnormal-sample-number">
                          {record.sampleNumber}
                        </span>
                      </div>
                      <div className="g-abnormal-col-case">
                        {record.relatedCase || <span className="no-case">未关联</span>}
                      </div>
                      <div className="g-abnormal-col-time">
                        {formatDateTime(record.timestamp)}
                      </div>
                      <div className="g-abnormal-col-temp">
                        <span className="abnormal-temp-value-small">
                          {record.temperature}℃
                        </span>
                      </div>
                      <div className="g-abnormal-col-note">
                        {record.note || <span className="no-note">—</span>}
                      </div>
                      <div className="g-abnormal-col-action">
                        <button
                          className="primary navigate-to-sample-btn"
                          onClick={() => handleViewDetail(record.sampleId)}
                          style={{ minHeight: "32px", padding: "0 12px", fontSize: "12px" }}
                        >
                          查看样本 →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {allAbnormalRecords.length > 10 && (
              <div className="global-abnormal-more">
                ...还有 {allAbnormalRecords.length - 10} 条异常记录，点击各样本详情查看完整列表
              </div>
            )}
          </section>
        );
      })()}

      <section className="panel" style={{ marginTop: "18px" }}>
        <div className="heading">
          <div>
            <p>历史记录</p>
            <h2>近期工作台</h2>
          </div>
          <button onClick={handleOpenExport}>导出摘要</button>
        </div>
        <div className="records">
          {samples.map((sample, index: number) => (
            <article
              key={sample.id}
              className="record-item"
              onClick={() => handleViewDetail(sample.id)}
            >
              <b>{String(index + 1).padStart(2, "0")}</b>
              <div>
                <h3>{sample.sampleNumber}</h3>
                <p>
                  {[
                    sample.developmentStage,
                    sample.preservationMethod,
                    sample.identificationNotes,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "点击查看详情"}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
