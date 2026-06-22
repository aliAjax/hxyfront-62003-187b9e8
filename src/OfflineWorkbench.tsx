import { useState, useEffect, useCallback, useMemo } from "react";
import {
  SampleBatch,
  Sample,
  TemperatureRecord,
  SampleStatus,
  ReviewPriority,
  StatusHistoryRecord,
  SAMPLE_STATUS_LABELS,
  SAMPLE_STATUS_COLORS,
  STATUS_TRANSITIONS,
  formatDateTime,
  generateSampleId,
  generateBatchId,
  generateTemperatureRecordId,
  generateStatusHistoryId,
  getSortedTemperatureRecords,
  calculateTemperatureStats,
  isAbnormalTemperature,
  DEVELOPMENT_STAGES,
  PRESERVATION_METHODS,
  EXPOSURE_STAGES,
  COLLECTION_METHODS,
  WEATHER_CONDITIONS,
  updateSampleStatus as baseUpdateSampleStatus,
} from "./batchStorage";
import {
  SyncStatus,
  SYNC_STATUS_LABELS,
  SYNC_STATUS_COLORS,
  SyncedSampleBatch,
  SyncedSample,
  OperationLog,
  PendingOperation,
  EntityType,
  OperationType,
  loadSyncedBatches,
  saveSyncedBatches,
  loadSyncedSamples,
  saveSyncedSamples,
  loadOperationLogs,
  loadPendingOperations,
  addOperationLog,
  addPendingOperation,
  createSyncedBatch,
  createSyncedSample,
  markModified,
  runSyncSimulation,
  resolveConflict,
  retryFailed,
  getSyncStats,
  SyncResult,
  getServerEntityData,
  getLocalEntityData,
} from "./offlineSync";
import {
  BatchListView,
  BatchEditView,
  SampleDetailView,
  OperationLogView,
  SyncCenterView,
} from "./OfflineWorkbenchViews";
import ConflictMergeView from "./ConflictMergeView";

type WorkbenchView =
  | "BATCH_LIST"
  | "BATCH_EDIT"
  | "SAMPLE_DETAIL"
  | "OPERATION_LOG"
  | "SYNC_CENTER"
  | "CONFLICT_MERGE";

interface ConflictMergeContext {
  entityType: EntityType;
  entityId: string;
  entityLabel: string;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  syncError?: string;
}

interface SyncStats {
  totalBatches: number;
  totalSamples: number;
  synced: number;
  pending: number;
  conflict: number;
  failed: number;
}

export default function OfflineWorkbench() {
  const [batches, setBatches] = useState<SyncedSampleBatch[]>([]);
  const [samples, setSamples] = useState<SyncedSample[]>([]);
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const [pendingOps, setPendingOps] = useState<PendingOperation[]>([]);
  const [syncStats, setSyncStats] = useState<SyncStats>({
    totalBatches: 0,
    totalSamples: 0,
    synced: 0,
    pending: 0,
    conflict: 0,
    failed: 0,
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [view, setView] = useState<WorkbenchView>("BATCH_LIST");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning" | "info";
    message: string;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState<SyncStatus | "ALL">("ALL");
  const [conflictMergeContext, setConflictMergeContext] =
    useState<ConflictMergeContext | null>(null);

  const showNotification = useCallback(
    (type: "success" | "error" | "warning" | "info", message: string) => {
      setNotification({ type, message });
      setTimeout(() => setNotification(null), 3500);
    },
    []
  );

  useEffect(() => {
    const loadedBatches = loadSyncedBatches();
    const loadedSamples = loadSyncedSamples();
    const loadedLogs = loadOperationLogs();
    const loadedPending = loadPendingOperations();

    if (loadedBatches.length === 0 && loadedSamples.length === 0) {
      const now = new Date().toISOString();
      const demoBatch: SampleBatch = {
        id: generateBatchId(),
        caseNumber: "CASE-2026-001",
        samplingLocation: "东郊森林公园A区",
        samplingTime: now,
        environmentTemperature: "26.5",
        exposureStage: "腐败期",
        fieldNotes: "现场发现大量蝇类幼虫活动",
        sampleCount: 3,
        createdAt: now,
        updatedAt: now,
      };
      const demoBatches = [createSyncedBatch(demoBatch)];
      demoBatches[0].syncMeta.syncStatus = "SYNCED";
      demoBatches[0].syncMeta.lastSyncedAt = now;

      const initialStatuses: SampleStatus[] = [
        "PENDING_IDENTIFICATION",
        "NEEDS_REVIEW",
        "CONFIRMED",
      ];
      const initialPriorities: ReviewPriority[] = ["HIGH", "MEDIUM", "LOW"];
      const demoSamples: SyncedSample[] = [
        {
          id: generateSampleId(),
          sampleNumber: "CASE-2026-001-A",
          insectSpecies: "丝光绿蝇",
          developmentStage: "幼虫三龄",
          preservationMethod: "乙醇保存",
          identificationNotes: "待显微镜下进一步确认种属",
          relatedCase: "CASE-2026-001",
          samplingLocation: "东郊森林公园A区",
          environmentTemperature: "26.5",
          environmentHumidity: "72",
          weatherCondition: "多云",
          exposureStage: "腐败期",
          exposureNotes: "尸体位于树荫下，湿度较高",
          insectCount: "约200头",
          insectCollectionMethod: "镊子夹取",
          preservationSolution: "75%乙醇",
          storageTemperature: "4",
          temperatureRecords: [
            {
              id: generateTemperatureRecordId(),
              timestamp: now,
              temperature: "26.5",
              note: "现场采样时环境温度",
            },
          ],
          status: initialStatuses[0],
          priority: initialPriorities[0],
          statusHistory: [
            {
              id: generateStatusHistoryId(),
              oldStatus: null,
              newStatus: initialStatuses[0],
              oldPriority: null,
              newPriority: initialPriorities[0],
              timestamp: now,
              operator: "系统初始化",
              note: "创建样本，初始状态",
            },
          ],
          createdAt: now,
          updatedAt: now,
          syncMeta: {
            syncStatus: "SYNCED",
            lastSyncedAt: now,
            lastModifiedAt: now,
            version: 1,
            serverVersion: 1,
            pendingOperations: [],
          },
        },
        {
          id: generateSampleId(),
          sampleNumber: "CASE-2026-001-B",
          insectSpecies: "",
          developmentStage: "蛹",
          preservationMethod: "活体饲养",
          identificationNotes: "蛹期样本，需等待羽化成虫后鉴定",
          relatedCase: "CASE-2026-001",
          samplingLocation: "东郊森林公园A区",
          environmentTemperature: "25.8",
          environmentHumidity: "68",
          weatherCondition: "多云",
          exposureStage: "腐败期",
          exposureNotes: "",
          insectCount: "约50个",
          insectCollectionMethod: "直接采集",
          preservationSolution: "",
          storageTemperature: "25",
          temperatureRecords: [],
          status: initialStatuses[1],
          priority: initialPriorities[1],
          statusHistory: [
            {
              id: generateStatusHistoryId(),
              oldStatus: null,
              newStatus: initialStatuses[1],
              oldPriority: null,
              newPriority: initialPriorities[1],
              timestamp: now,
              operator: "系统初始化",
              note: "蛹期样本需复核",
            },
          ],
          createdAt: now,
          updatedAt: now,
          syncMeta: {
            syncStatus: "PENDING",
            lastSyncedAt: null,
            lastModifiedAt: now,
            version: 1,
            serverVersion: null,
            pendingOperations: [],
          },
        },
      ];

      setBatches(demoBatches);
      setSamples(demoSamples);
      saveSyncedBatches(demoBatches);
      saveSyncedSamples(demoSamples);
    } else {
      setBatches(loadedBatches);
      setSamples(loadedSamples);
    }

    setOperationLogs(loadedLogs);
    setPendingOps(loadedPending);
    setSyncStats(getSyncStats());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      saveSyncedBatches(batches);
      saveSyncedSamples(samples);
      setSyncStats(getSyncStats());
    }
  }, [batches, samples, isLoaded]);

  useEffect(() => {
    setOperationLogs(loadOperationLogs());
  }, [batches, samples]);

  useEffect(() => {
    setPendingOps(loadPendingOperations());
  }, [batches, samples]);

  const recordOperation = useCallback(
    (params: {
      entityType: EntityType;
      entityId: string;
      operationType: OperationType;
      description: string;
      fieldName?: string;
      oldValue?: unknown;
      newValue?: unknown;
      operator?: string;
    }) => {
      addOperationLog({
        entityType: params.entityType,
        entityId: params.entityId,
        operationType: params.operationType,
        fieldName: params.fieldName,
        oldValue: params.oldValue,
        newValue: params.newValue,
        operator: params.operator || "现场勘查员",
        description: params.description,
      });

      addPendingOperation({
        entityType: params.entityType,
        entityId: params.entityId,
        operationType: params.operationType,
        payload: {
          fieldName: params.fieldName,
          oldValue: params.oldValue,
          newValue: params.newValue,
        },
      });
    },
    []
  );

  const handleCreateBatch = useCallback(() => {
    const now = new Date().toISOString();
    const newBatch: SampleBatch = {
      id: generateBatchId(),
      caseNumber: "",
      samplingLocation: "",
      samplingTime: now,
      environmentTemperature: "",
      exposureStage: "",
      fieldNotes: "",
      sampleCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    const synced = createSyncedBatch(newBatch);
    setBatches((prev) => [synced, ...prev]);
    setSelectedBatchId(synced.id);
    setView("BATCH_EDIT");

    recordOperation({
      entityType: "BATCH",
      entityId: synced.id,
      operationType: "CREATE",
      description: "创建新的样本批次",
    });
    showNotification("success", "已创建新批次（待同步）");
  }, [recordOperation, showNotification]);

  const handleUpdateBatch = useCallback(
    (batchId: string, updates: Partial<SampleBatch>) => {
      setBatches((prev) =>
        prev.map((b) => {
          if (b.id !== batchId) return b;
          const updated: SampleBatch = {
            ...b,
            ...updates,
            updatedAt: new Date().toISOString(),
          };
          const changedFields: string[] = [];
          for (const key of Object.keys(updates)) {
            if (
              JSON.stringify((b as unknown as Record<string, unknown>)[key]) !==
              JSON.stringify(updates[key as keyof SampleBatch])
            ) {
              changedFields.push(key);
            }
          }
          if (changedFields.length > 0) {
            recordOperation({
              entityType: "BATCH",
              entityId: batchId,
              operationType: "UPDATE",
              description: `更新批次字段: ${changedFields.join(", ")}`,
              fieldName: changedFields.join(","),
              newValue: updates,
            });
          }
          return {
            ...updated,
            syncMeta: markModified(b.syncMeta),
          };
        })
      );
    },
    [recordOperation]
  );

  const handleDeleteBatch = useCallback(
    (batchId: string) => {
      if (!confirm("确定要删除该批次吗？相关样本不会被删除。")) return;
      setBatches((prev) => prev.filter((b) => b.id !== batchId));
      recordOperation({
        entityType: "BATCH",
        entityId: batchId,
        operationType: "DELETE",
        description: "删除样本批次",
      });
      if (selectedBatchId === batchId) {
        setSelectedBatchId(null);
        setView("BATCH_LIST");
      }
      showNotification("info", "批次已标记删除（待同步）");
    },
    [recordOperation, selectedBatchId, showNotification]
  );

  const handleCreateSample = useCallback(
    (batchId: string) => {
      const batch = batches.find((b) => b.id === batchId);
      const now = new Date().toISOString();
      const historyRecord: StatusHistoryRecord = {
        id: generateStatusHistoryId(),
        oldStatus: null,
        newStatus: "PENDING_IDENTIFICATION",
        oldPriority: null,
        newPriority: "MEDIUM",
        timestamp: now,
        operator: "现场勘查员",
        note: "创建样本",
      };
      const newSample: Sample = {
        id: generateSampleId(),
        sampleNumber: batch
          ? `${batch.caseNumber || "CASE"}-${String(samples.length + 1).padStart(3, "0")}`
          : "",
        insectSpecies: "",
        developmentStage: "",
        preservationMethod: "",
        identificationNotes: "",
        relatedCase: batch?.caseNumber || "",
        samplingLocation: batch?.samplingLocation || "",
        environmentTemperature: batch?.environmentTemperature || "",
        environmentHumidity: "",
        weatherCondition: "",
        exposureStage: batch?.exposureStage || "",
        exposureNotes: "",
        insectCount: "",
        insectCollectionMethod: "",
        preservationSolution: "",
        storageTemperature: "",
        temperatureRecords: [],
        status: "PENDING_IDENTIFICATION",
        priority: "MEDIUM",
        statusHistory: [historyRecord],
        createdAt: now,
        updatedAt: now,
      };
      const synced = createSyncedSample(newSample);
      setSamples((prev) => [synced, ...prev]);
      setSelectedSampleId(synced.id);
      setView("SAMPLE_DETAIL");

      recordOperation({
        entityType: "SAMPLE",
        entityId: synced.id,
        operationType: "CREATE",
        description: `创建新样本 ${newSample.sampleNumber}`,
      });
      showNotification("success", `已创建样本 ${newSample.sampleNumber}（待同步）`);
    },
    [batches, samples.length, recordOperation, showNotification]
  );

  const handleUpdateSample = useCallback(
    (sampleId: string, updates: Partial<Sample>) => {
      setSamples((prev) =>
        prev.map((s) => {
          if (s.id !== sampleId) return s;
          const updated: Sample = {
            ...s,
            ...updates,
            updatedAt: new Date().toISOString(),
          };
          const changedFields: string[] = [];
          for (const key of Object.keys(updates)) {
            if (
              JSON.stringify((s as unknown as Record<string, unknown>)[key]) !==
              JSON.stringify(updates[key as keyof Sample])
            ) {
              changedFields.push(key);
            }
          }
          if (changedFields.length > 0) {
            recordOperation({
              entityType: "SAMPLE",
              entityId: sampleId,
              operationType: "UPDATE",
              description: `更新样本 ${s.sampleNumber} 字段: ${changedFields.join(", ")}`,
              fieldName: changedFields.join(","),
              newValue: updates,
            });
          }
          return {
            ...updated,
            syncMeta: markModified(s.syncMeta),
          };
        })
      );
    },
    [recordOperation]
  );

  const handleUpdateSampleStatus = useCallback(
    (sampleId: string, newStatus: SampleStatus, note: string, newPriority?: ReviewPriority) => {
      setSamples((prev) => {
        const updated = baseUpdateSampleStatus(prev, sampleId, newStatus, note, "系统管理员", newPriority);
        return updated.map((s) => {
          const previous = prev.find((p) => p.id === s.id);
          if (!previous) return s as SyncedSample;
          return {
            ...s,
            syncMeta:
              s.id === sampleId ? markModified(previous.syncMeta) : previous.syncMeta,
          };
        });
      });
      const sample = samples.find((s) => s.id === sampleId);
      recordOperation({
        entityType: "SAMPLE",
        entityId: sampleId,
        operationType: "UPDATE",
        description: `样本状态变更: ${sample?.status || ""} → ${newStatus}${newPriority ? `，优先级调整: ${sample?.priority || ""} → ${newPriority}` : ""}`,
        fieldName: "status" + (newPriority ? ",priority" : ""),
        oldValue: { status: sample?.status, priority: sample?.priority },
        newValue: { status: newStatus, priority: newPriority },
      });
    },
    [samples, recordOperation]
  );

  const handleAddTemperatureRecord = useCallback(
    (sampleId: string, record: Omit<TemperatureRecord, "id">) => {
      const newRecord: TemperatureRecord = {
        ...record,
        id: generateTemperatureRecordId(),
      };
      setSamples((prev) =>
        prev.map((s) => {
          if (s.id !== sampleId) return s;
          return {
            ...s,
            temperatureRecords: [...s.temperatureRecords, newRecord],
            updatedAt: new Date().toISOString(),
            syncMeta: markModified(s.syncMeta),
          };
        })
      );
      recordOperation({
        entityType: "SAMPLE",
        entityId: sampleId,
        operationType: "UPDATE",
        description: `添加温度记录 ${record.temperature}℃`,
        fieldName: "temperatureRecords",
        newValue: newRecord,
      });
    },
    [recordOperation]
  );

  const handleDeleteTemperatureRecord = useCallback(
    (sampleId: string, recordId: string) => {
      setSamples((prev) =>
        prev.map((s) => {
          if (s.id !== sampleId) return s;
          return {
            ...s,
            temperatureRecords: s.temperatureRecords.filter((r) => r.id !== recordId),
            updatedAt: new Date().toISOString(),
            syncMeta: markModified(s.syncMeta),
          };
        })
      );
      recordOperation({
        entityType: "SAMPLE",
        entityId: sampleId,
        operationType: "UPDATE",
        description: "删除温度记录",
        fieldName: "temperatureRecords",
      });
    },
    [recordOperation]
  );

  const handleRunSync = useCallback(async () => {
    setIsSyncing(true);
    await new Promise((r) => setTimeout(r, 1200));
    const result = runSyncSimulation();
    setLastSyncResult(result);
    setBatches(loadSyncedBatches());
    setSamples(loadSyncedSamples());
    setPendingOps(loadPendingOperations());
    setIsSyncing(false);

    if (result.conflictCount > 0) {
      showNotification(
        "warning",
        `同步完成：${result.syncedCount} 成功，${result.conflictCount} 冲突，${result.failedCount} 失败`
      );
    } else if (result.failedCount > 0) {
      showNotification(
        "warning",
        `同步完成：${result.syncedCount} 成功，${result.failedCount} 失败待重试`
      );
    } else {
      showNotification("success", `同步成功：${result.syncedCount} 条数据已上传`);
    }
  }, [showNotification]);

  const handleResolveConflict = useCallback(
    (entityType: EntityType, entityId: string, strategy: "USE_LOCAL" | "USE_SERVER") => {
      const success = resolveConflict(entityType, entityId, strategy);
      if (success) {
        setBatches(loadSyncedBatches());
        setSamples(loadSyncedSamples());
        showNotification(
          "success",
          strategy === "USE_LOCAL" ? "已采用本地版本" : "已采用服务端版本"
        );
      }
    },
    [showNotification]
  );

  const handleRetryFailed = useCallback(
    (entityType: EntityType, entityId: string) => {
      retryFailed(entityType, entityId);
      setBatches(loadSyncedBatches());
      setSamples(loadSyncedSamples());
      setPendingOps(loadPendingOperations());
      showNotification("info", "已重新加入同步队列");
    },
    [showNotification]
  );

  const handleOpenMergeView = useCallback(
    (entityType: EntityType, entityId: string) => {
      const localData = getLocalEntityData(entityType, entityId);
      const serverData = getServerEntityData(entityType, entityId);

      if (!localData || !serverData) {
        showNotification(
          "error",
          "无法获取本地或服务端数据，无法打开冲突合并视图"
        );
        return;
      }

      let entityLabel = entityId;
      let syncError: string | undefined;

      if (entityType === "BATCH") {
        const b = batches.find((x) => x.id === entityId);
        if (b) {
          entityLabel = b.caseNumber || entityId;
          syncError = b.syncMeta.syncError;
        }
      } else {
        const s = samples.find((x) => x.id === entityId);
        if (s) {
          entityLabel = s.sampleNumber || entityId;
          syncError = s.syncMeta.syncError;
        }
      }

      setConflictMergeContext({
        entityType,
        entityId,
        entityLabel,
        localData,
        serverData,
        syncError,
      });
      setView("CONFLICT_MERGE");
    },
    [batches, samples, showNotification]
  );

  const handleMergeResolved = useCallback(() => {
    setConflictMergeContext(null);
    setBatches(loadSyncedBatches());
    setSamples(loadSyncedSamples());
    setPendingOps(loadPendingOperations());
    setOperationLogs(loadOperationLogs());
    setView("SYNC_CENTER");
    showNotification("success", "冲突已解决，数据已同步");
  }, [showNotification]);

  const handleCloseMergeView = useCallback(() => {
    setConflictMergeContext(null);
    setView("SYNC_CENTER");
  }, []);

  const filteredBatches = useMemo(() => {
    if (statusFilter === "ALL") return batches;
    return batches.filter((b) => b.syncMeta.syncStatus === statusFilter);
  }, [batches, statusFilter]);

  const filteredSamples = useMemo(() => {
    if (statusFilter === "ALL") return samples;
    return samples.filter((s) => s.syncMeta.syncStatus === statusFilter);
  }, [samples, statusFilter]);

  const selectedBatch = selectedBatchId
    ? batches.find((b) => b.id === selectedBatchId) || null
    : null;

  const selectedSample = selectedSampleId
    ? samples.find((s) => s.id === selectedSampleId) || null
    : null;

  const batchSamples = selectedBatchId
    ? samples.filter((s) => s.relatedCase === selectedBatch?.caseNumber)
    : [];

  if (!isLoaded) {
    return (
      <main className="app">
        <div className="empty-state large">
          <div className="empty-icon">🔄</div>
          <h3>正在加载离线工作台...</h3>
          <p>正在初始化本地数据层</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app offline-workbench">
      {notification && (
        <div className={`workbench-notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}

      <section className="workbench-hero">
        <div className="workbench-hero-left">
          <p className="workbench-badge">🌐 离线优先模式</p>
          <h1 className="workbench-title">案件样本工作台</h1>
          <p className="workbench-subtitle">
            所有操作先写入本地存储，支持断网工作，联网后自动同步
          </p>
        </div>
        <div className="workbench-hero-right">
          <div className="sync-mini-stats">
            <div className="mini-stat" style={{ color: SYNC_STATUS_COLORS.SYNCED }}>
              <span className="mini-stat-num">{syncStats.synced}</span>
              <span className="mini-stat-label">已同步</span>
            </div>
            <div className="mini-stat" style={{ color: SYNC_STATUS_COLORS.PENDING }}>
              <span className="mini-stat-num">{syncStats.pending}</span>
              <span className="mini-stat-label">待同步</span>
            </div>
            <div className="mini-stat" style={{ color: SYNC_STATUS_COLORS.CONFLICT }}>
              <span className="mini-stat-num">{syncStats.conflict}</span>
              <span className="mini-stat-label">冲突</span>
            </div>
            <div className="mini-stat" style={{ color: SYNC_STATUS_COLORS.FAILED }}>
              <span className="mini-stat-num">{syncStats.failed}</span>
              <span className="mini-stat-label">失败</span>
            </div>
          </div>
          <button
            className="primary sync-button"
            onClick={handleRunSync}
            disabled={isSyncing}
          >
            {isSyncing ? "🔄 同步中..." : "☁️ 立即同步"}
          </button>
        </div>
      </section>

      <section className="workbench-nav">
        <button
          className={`nav-tab ${view === "BATCH_LIST" ? "active" : ""}`}
          onClick={() => setView("BATCH_LIST")}
        >
          📋 批次列表 <span className="tab-count">{batches.length}</span>
        </button>
        <button
          className={`nav-tab ${view === "OPERATION_LOG" ? "active" : ""}`}
          onClick={() => setView("OPERATION_LOG")}
        >
          📝 操作日志 <span className="tab-count">{operationLogs.length}</span>
        </button>
        <button
          className={`nav-tab ${view === "SYNC_CENTER" ? "active" : ""}`}
          onClick={() => setView("SYNC_CENTER")}
        >
          🔄 同步中心{" "}
          {(syncStats.pending + syncStats.conflict + syncStats.failed) > 0 && (
            <span className="tab-count tab-count-warn">
              {syncStats.pending + syncStats.conflict + syncStats.failed}
            </span>
          )}
        </button>
      </section>

      <section className="status-filter-bar">
        <span className="filter-label">同步状态筛选：</span>
        {(["ALL", "SYNCED", "PENDING", "CONFLICT", "FAILED"] as const).map((s) => (
          <button
            key={s}
            className={`status-chip ${statusFilter === s ? "active" : ""}`}
            style={
              s !== "ALL" && statusFilter === s
                ? {
                    background: SYNC_STATUS_COLORS[s as SyncStatus],
                    color: "#fff",
                    borderColor: SYNC_STATUS_COLORS[s as SyncStatus],
                  }
                : s !== "ALL"
                ? {
                    color: SYNC_STATUS_COLORS[s as SyncStatus],
                    borderColor: SYNC_STATUS_COLORS[s as SyncStatus],
                  }
                : undefined
            }
            onClick={() => setStatusFilter(s)}
          >
            {s === "ALL" ? "全部" : SYNC_STATUS_LABELS[s as SyncStatus]}
          </button>
        ))}
      </section>

      {view === "BATCH_LIST" && (
        <BatchListView
          batches={filteredBatches}
          samples={filteredSamples}
          onCreateBatch={handleCreateBatch}
          onEditBatch={(id) => {
            setSelectedBatchId(id);
            setView("BATCH_EDIT");
          }}
          onDeleteBatch={handleDeleteBatch}
          onViewSample={(id) => {
            setSelectedSampleId(id);
            setView("SAMPLE_DETAIL");
          }}
          onCreateSample={handleCreateSample}
        />
      )}

      {view === "BATCH_EDIT" && selectedBatch && (
        <BatchEditView
          batch={selectedBatch}
          samples={batchSamples}
          onBack={() => {
            setSelectedBatchId(null);
            setView("BATCH_LIST");
          }}
          onUpdate={handleUpdateBatch}
          onViewSample={(id) => {
            setSelectedSampleId(id);
            setView("SAMPLE_DETAIL");
          }}
          onCreateSample={() => handleCreateSample(selectedBatch.id)}
        />
      )}

      {view === "SAMPLE_DETAIL" && selectedSample && (
        <SampleDetailView
          sample={selectedSample}
          allSamples={samples}
          onBack={() => {
            setSelectedSampleId(null);
            setView(selectedBatchId ? "BATCH_EDIT" : "BATCH_LIST");
          }}
          onUpdate={handleUpdateSample}
          onUpdateStatus={handleUpdateSampleStatus}
          onAddTempRecord={handleAddTemperatureRecord}
          onDeleteTempRecord={handleDeleteTemperatureRecord}
        />
      )}

      {view === "OPERATION_LOG" && (
        <OperationLogView logs={operationLogs} samples={samples} batches={batches} />
      )}

      {view === "SYNC_CENTER" && (
        <SyncCenterView
          batches={batches}
          samples={samples}
          pendingOps={pendingOps}
          lastResult={lastSyncResult}
          onSync={handleRunSync}
          isSyncing={isSyncing}
          onResolveConflict={handleResolveConflict}
          onRetryFailed={handleRetryFailed}
          onOpenMergeView={handleOpenMergeView}
        />
      )}

      {view === "CONFLICT_MERGE" && conflictMergeContext && (
        <ConflictMergeView
          entityType={conflictMergeContext.entityType}
          entityId={conflictMergeContext.entityId}
          entityLabel={conflictMergeContext.entityLabel}
          localData={conflictMergeContext.localData}
          serverData={conflictMergeContext.serverData}
          syncError={conflictMergeContext.syncError}
          onBack={handleCloseMergeView}
          onResolved={handleMergeResolved}
        />
      )}
    </main>
  );
}

export function SyncStatusBadge({
  status,
  error,
}: {
  status: SyncStatus;
  error?: string;
}) {
  const icons: Record<SyncStatus, string> = {
    SYNCED: "✓",
    PENDING: "⟳",
    CONFLICT: "⚠",
    FAILED: "✕",
  };
  return (
    <span
      className={`sync-badge sync-${status.toLowerCase()}`}
      title={error || SYNC_STATUS_LABELS[status]}
    >
      <span className="sync-badge-icon">{icons[status]}</span>
      <span className="sync-badge-label">{SYNC_STATUS_LABELS[status]}</span>
    </span>
  );
}
