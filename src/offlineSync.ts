import {
  SampleBatch,
  Sample,
  TemperatureRecord,
  StatusHistoryRecord,
  loadBatches,
  loadSamples,
  saveBatches,
  saveSamples,
} from "./batchStorage";

export type SyncStatus = "SYNCED" | "PENDING" | "CONFLICT" | "FAILED";

export const SYNC_STATUS_LABELS: Record<SyncStatus, string> = {
  SYNCED: "已同步",
  PENDING: "待同步",
  CONFLICT: "冲突",
  FAILED: "同步失败",
};

export const SYNC_STATUS_COLORS: Record<SyncStatus, string> = {
  SYNCED: "#059669",
  PENDING: "#d97706",
  CONFLICT: "#dc2626",
  FAILED: "#7c3aed",
};

export interface SyncMetadata {
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  lastModifiedAt: string;
  version: number;
  serverVersion: number | null;
  syncError?: string;
  pendingOperations: PendingOperation[];
}

export type EntityType = "BATCH" | "SAMPLE";

export type OperationType = "CREATE" | "UPDATE" | "DELETE";

export interface PendingOperation {
  id: string;
  entityType: EntityType;
  entityId: string;
  operationType: OperationType;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
}

export interface OperationLog {
  id: string;
  entityType: EntityType;
  entityId: string;
  operationType: OperationType;
  fieldName?: string;
  oldValue?: unknown;
  newValue?: unknown;
  operator: string;
  timestamp: string;
  description: string;
  syncStatus: SyncStatus;
}

export interface SyncedSampleBatch extends SampleBatch {
  syncMeta: SyncMetadata;
}

export interface SyncedSample extends Sample {
  syncMeta: SyncMetadata;
}

export interface ConflictFieldResolution {
  fieldName: string;
  strategy: "USE_LOCAL" | "USE_SERVER" | "MANUAL";
  manualValue?: unknown;
}

export interface ConflictResolution {
  entityType: EntityType;
  entityId: string;
  overallStrategy: "USE_LOCAL" | "USE_SERVER" | "FIELD_BY_FIELD";
  fieldResolutions: ConflictFieldResolution[];
  resolvedData: Record<string, unknown>;
}

const SYNCED_BATCHES_KEY = "forensic_entomology_synced_batches_v2";
const SYNCED_SAMPLES_KEY = "forensic_entomology_synced_samples_v2";
const OPERATION_LOG_KEY = "forensic_entomology_operation_log_v2";
const PENDING_OPS_KEY = "forensic_entomology_pending_ops_v2";
const SERVER_DATA_KEY = "forensic_entomology_server_mock_v2";

export const SAMPLE_COMPARABLE_FIELDS: (keyof Sample)[] = [
  "sampleNumber",
  "insectSpecies",
  "developmentStage",
  "preservationMethod",
  "identificationNotes",
  "relatedCase",
  "samplingLocation",
  "environmentTemperature",
  "environmentHumidity",
  "weatherCondition",
  "exposureStage",
  "exposureNotes",
  "insectCount",
  "insectCollectionMethod",
  "preservationSolution",
  "storageTemperature",
];

export const BATCH_COMPARABLE_FIELDS: (keyof SampleBatch)[] = [
  "caseNumber",
  "samplingLocation",
  "samplingTime",
  "environmentTemperature",
  "exposureStage",
  "fieldNotes",
  "sampleCount",
];

export function generateOpId(): string {
  return "OP-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function generatePendingOpId(): string {
  return "PEND-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function createDefaultSyncMeta(): SyncMetadata {
  return {
    syncStatus: "PENDING",
    lastSyncedAt: null,
    lastModifiedAt: new Date().toISOString(),
    version: 1,
    serverVersion: null,
    pendingOperations: [],
  };
}

export function migrateToSyncedBatches(batches: SampleBatch[]): SyncedSampleBatch[] {
  return batches.map((b) => ({
    ...b,
    syncMeta: {
      ...createDefaultSyncMeta(),
      syncStatus: "SYNCED",
      lastSyncedAt: b.updatedAt || new Date().toISOString(),
      lastModifiedAt: b.updatedAt || b.createdAt || new Date().toISOString(),
    },
  }));
}

export function migrateToSyncedSamples(samples: Sample[]): SyncedSample[] {
  return samples.map((s) => ({
    ...s,
    syncMeta: {
      ...createDefaultSyncMeta(),
      syncStatus: "SYNCED",
      lastSyncedAt: s.updatedAt || new Date().toISOString(),
      lastModifiedAt: s.updatedAt || s.createdAt || new Date().toISOString(),
    },
  }));
}

export function loadSyncedBatches(): SyncedSampleBatch[] {
  try {
    const raw = localStorage.getItem(SYNCED_BATCHES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
    const oldBatches = loadBatches();
    const migrated = migrateToSyncedBatches(oldBatches);
    saveSyncedBatches(migrated);
    return migrated;
  } catch {
    return [];
  }
}

export function saveSyncedBatches(batches: SyncedSampleBatch[]): void {
  localStorage.setItem(SYNCED_BATCHES_KEY, JSON.stringify(batches));
  const plainBatches: SampleBatch[] = batches.map(({ syncMeta, ...rest }) => rest);
  saveBatches(plainBatches);
}

export function loadSyncedSamples(): SyncedSample[] {
  try {
    const raw = localStorage.getItem(SYNCED_SAMPLES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
    const oldSamples = loadSamples();
    const migrated = migrateToSyncedSamples(oldSamples);
    saveSyncedSamples(migrated);
    return migrated;
  } catch {
    return [];
  }
}

export function saveSyncedSamples(samples: SyncedSample[]): void {
  localStorage.setItem(SYNCED_SAMPLES_KEY, JSON.stringify(samples));
  const plainSamples: Sample[] = samples.map(({ syncMeta, ...rest }) => rest);
  saveSamples(plainSamples);
}

export function loadOperationLogs(): OperationLog[] {
  try {
    const raw = localStorage.getItem(OPERATION_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOperationLogs(logs: OperationLog[]): void {
  localStorage.setItem(OPERATION_LOG_KEY, JSON.stringify(logs));
}

export function loadPendingOperations(): PendingOperation[] {
  try {
    const raw = localStorage.getItem(PENDING_OPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePendingOperations(ops: PendingOperation[]): void {
  localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(ops));
}

function loadServerMockData(): { batches: SampleBatch[]; samples: Sample[] } {
  try {
    const raw = localStorage.getItem(SERVER_DATA_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  const batches = loadBatches();
  const samples = loadSamples();
  const serverData = { batches, samples };
  localStorage.setItem(SERVER_DATA_KEY, JSON.stringify(serverData));
  return serverData;
}

function saveServerMockData(data: { batches: SampleBatch[]; samples: Sample[] }): void {
  localStorage.setItem(SERVER_DATA_KEY, JSON.stringify(data));
}

export function addOperationLog(
  log: Omit<OperationLog, "id" | "timestamp" | "syncStatus">
): OperationLog {
  const newLog: OperationLog = {
    ...log,
    id: generateOpId(),
    timestamp: new Date().toISOString(),
    syncStatus: "PENDING",
  };
  const logs = loadOperationLogs();
  logs.unshift(newLog);
  saveOperationLogs(logs.slice(0, 500));
  return newLog;
}

export function addPendingOperation(
  op: Omit<PendingOperation, "id" | "createdAt" | "retryCount">
): PendingOperation {
  const newOp: PendingOperation = {
    ...op,
    id: generatePendingOpId(),
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  const ops = loadPendingOperations();
  ops.push(newOp);
  savePendingOperations(ops);
  return newOp;
}

export function removePendingOperations(ids: string[]): void {
  const ops = loadPendingOperations().filter((o) => !ids.includes(o.id));
  savePendingOperations(ops);
}

export function updatePendingOperationRetry(opId: string): void {
  const ops = loadPendingOperations();
  const idx = ops.findIndex((o) => o.id === opId);
  if (idx >= 0) {
    ops[idx].retryCount += 1;
    savePendingOperations(ops);
  }
}

export function createSyncedBatch(batch: SampleBatch): SyncedSampleBatch {
  return {
    ...batch,
    syncMeta: createDefaultSyncMeta(),
  };
}

export function createSyncedSample(sample: Sample): SyncedSample {
  return {
    ...sample,
    syncMeta: createDefaultSyncMeta(),
  };
}

export function markModified(meta: SyncMetadata): SyncMetadata {
  return {
    ...meta,
    syncStatus: "PENDING",
    lastModifiedAt: new Date().toISOString(),
    version: meta.version + 1,
    syncError: undefined,
  };
}

export function markSynced(meta: SyncMetadata): SyncMetadata {
  return {
    ...meta,
    syncStatus: "SYNCED",
    lastSyncedAt: new Date().toISOString(),
    serverVersion: meta.version,
    syncError: undefined,
    pendingOperations: [],
  };
}

export function markConflict(meta: SyncMetadata, error: string): SyncMetadata {
  return {
    ...meta,
    syncStatus: "CONFLICT",
    syncError: error,
  };
}

export function markFailed(meta: SyncMetadata, error: string): SyncMetadata {
  return {
    ...meta,
    syncStatus: "FAILED",
    syncError: error,
  };
}

export interface SyncResult {
  syncedCount: number;
  conflictCount: number;
  failedCount: number;
  pendingCount: number;
  messages: string[];
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function shallowDiff(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const changed: string[] = [];
  for (const k of keys) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
      changed.push(k);
    }
  }
  return changed;
}

export function runSyncSimulation(): SyncResult {
  const result: SyncResult = {
    syncedCount: 0,
    conflictCount: 0,
    failedCount: 0,
    pendingCount: 0,
    messages: [],
  };

  let batches = loadSyncedBatches();
  let samples = loadSyncedSamples();
  const serverData = loadServerMockData();
  const pendingOps = loadPendingOperations();

  const shouldRandomFail = () => Math.random() < 0.08;
  const shouldRandomConflict = () => Math.random() < 0.05;

  const processedOpIds: string[] = [];

  for (const op of pendingOps) {
    if (op.retryCount >= 3) {
      result.failedCount++;
      result.messages.push(`${op.entityType} ${op.entityId} 超过最大重试次数，标记为失败`);
      if (op.entityType === "BATCH") {
        batches = batches.map((b) =>
          b.id === op.entityId
            ? { ...b, syncMeta: markFailed(b.syncMeta, "超过最大重试次数") }
            : b
        );
      } else {
        samples = samples.map((s) =>
          s.id === op.entityId
            ? { ...s, syncMeta: markFailed(s.syncMeta, "超过最大重试次数") }
            : s
        );
      }
      processedOpIds.push(op.id);
      continue;
    }

    if (shouldRandomFail()) {
      updatePendingOperationRetry(op.id);
      result.failedCount++;
      result.messages.push(`${op.entityType} ${op.entityId} 网络超时，将自动重试`);
      if (op.entityType === "BATCH") {
        batches = batches.map((b) =>
          b.id === op.entityId
            ? { ...b, syncMeta: markFailed(b.syncMeta, "网络超时，正在重试") }
            : b
        );
      } else {
        samples = samples.map((s) =>
          s.id === op.entityId
            ? { ...s, syncMeta: markFailed(s.syncMeta, "网络超时，正在重试") }
            : s
        );
      }
      continue;
    }

    if (shouldRandomConflict()) {
      if (op.entityType === "BATCH") {
        batches = batches.map((b) =>
          b.id === op.entityId
            ? { ...b, syncMeta: markConflict(b.syncMeta, "服务端数据已被他人修改") }
            : b
        );
      } else {
        samples = samples.map((s) =>
          s.id === op.entityId
            ? { ...s, syncMeta: markConflict(s.syncMeta, "服务端数据已被他人修改") }
            : s
        );
      }
      updatePendingOperationRetry(op.id);
      result.conflictCount++;
      result.messages.push(`${op.entityType} ${op.entityId} 检测到数据冲突，需要手动处理`);
      continue;
    }

    if (op.entityType === "BATCH") {
      const localIdx = batches.findIndex((b) => b.id === op.entityId);
      if (localIdx < 0) {
        processedOpIds.push(op.id);
        continue;
      }
      const localBatch = batches[localIdx];
      const serverIdx = serverData.batches.findIndex((b) => b.id === op.entityId);

      if (op.operationType === "CREATE") {
        if (serverIdx < 0) {
          const { syncMeta, ...plainBatch } = localBatch;
          serverData.batches.push(plainBatch);
        }
      } else if (op.operationType === "UPDATE") {
        if (serverIdx >= 0) {
          const { syncMeta, ...plainBatch } = localBatch;
          serverData.batches[serverIdx] = plainBatch;
        } else {
          const { syncMeta, ...plainBatch } = localBatch;
          serverData.batches.push(plainBatch);
        }
      } else if (op.operationType === "DELETE") {
        serverData.batches = serverData.batches.filter((b) => b.id !== op.entityId);
      }
      batches[localIdx] = { ...localBatch, syncMeta: markSynced(localBatch.syncMeta) };
      result.syncedCount++;
      processedOpIds.push(op.id);
    } else {
      const localIdx = samples.findIndex((s) => s.id === op.entityId);
      if (localIdx < 0) {
        processedOpIds.push(op.id);
        continue;
      }
      const localSample = samples[localIdx];
      const serverIdx = serverData.samples.findIndex((s) => s.id === op.entityId);

      if (op.operationType === "CREATE") {
        if (serverIdx < 0) {
          const { syncMeta, ...plainSample } = localSample;
          serverData.samples.push(plainSample);
        }
      } else if (op.operationType === "UPDATE") {
        if (serverIdx >= 0) {
          const { syncMeta, ...plainSample } = localSample;
          serverData.samples[serverIdx] = plainSample;
        } else {
          const { syncMeta, ...plainSample } = localSample;
          serverData.samples.push(plainSample);
        }
      } else if (op.operationType === "DELETE") {
        serverData.samples = serverData.samples.filter((s) => s.id !== op.entityId);
      }
      samples[localIdx] = { ...localSample, syncMeta: markSynced(localSample.syncMeta) };
      result.syncedCount++;
      processedOpIds.push(op.id);
    }
  }

  for (let i = 0; i < batches.length; i++) {
    const b = batches[i];
    if (b.syncMeta.syncStatus === "PENDING") {
      const hasOp = pendingOps.some(
        (o) => o.entityType === "BATCH" && o.entityId === b.id
      );
      if (!hasOp) {
        batches[i] = { ...b, syncMeta: markSynced(b.syncMeta) };
        result.syncedCount++;
      }
    }
  }

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s.syncMeta.syncStatus === "PENDING") {
      const hasOp = pendingOps.some(
        (o) => o.entityType === "SAMPLE" && o.entityId === s.id
      );
      if (!hasOp) {
        samples[i] = { ...s, syncMeta: markSynced(s.syncMeta) };
        result.syncedCount++;
      }
    }
  }

  const logs = loadOperationLogs();
  const updatedLogs = logs.map((l) => {
    if (l.syncStatus === "PENDING" && Math.random() < 0.7) {
      return { ...l, syncStatus: "SYNCED" as SyncStatus };
    }
    return l;
  });

  saveSyncedBatches(batches);
  saveSyncedSamples(samples);
  saveServerMockData(serverData);
  removePendingOperations(processedOpIds);
  saveOperationLogs(updatedLogs);

  const remainingOps = loadPendingOperations();
  result.pendingCount = remainingOps.length;

  if (result.messages.length === 0) {
    result.messages.push(`同步完成：成功 ${result.syncedCount} 条`);
  }

  return result;
}

export function resolveConflict(
  entityType: EntityType,
  entityId: string,
  strategy: "USE_LOCAL" | "USE_SERVER"
): boolean {
  const batches = loadSyncedBatches();
  const samples = loadSyncedSamples();
  const serverData = loadServerMockData();

  if (entityType === "BATCH") {
    const idx = batches.findIndex((b) => b.id === entityId);
    if (idx < 0) return false;

    if (strategy === "USE_LOCAL") {
      const { syncMeta, ...plain } = batches[idx];
      const sIdx = serverData.batches.findIndex((b) => b.id === entityId);
      if (sIdx >= 0) {
        serverData.batches[sIdx] = plain;
      } else {
        serverData.batches.push(plain);
      }
      batches[idx] = { ...batches[idx], syncMeta: markSynced(batches[idx].syncMeta) };
    } else {
      const sIdx = serverData.batches.findIndex((b) => b.id === entityId);
      if (sIdx >= 0) {
        batches[idx] = {
          ...serverData.batches[sIdx],
          syncMeta: markSynced(batches[idx].syncMeta),
        };
      }
    }
    saveSyncedBatches(batches);
    saveServerMockData(serverData);
    return true;
  } else {
    const idx = samples.findIndex((s) => s.id === entityId);
    if (idx < 0) return false;

    if (strategy === "USE_LOCAL") {
      const { syncMeta, ...plain } = samples[idx];
      const sIdx = serverData.samples.findIndex((s) => s.id === entityId);
      if (sIdx >= 0) {
        serverData.samples[sIdx] = plain;
      } else {
        serverData.samples.push(plain);
      }
      samples[idx] = { ...samples[idx], syncMeta: markSynced(samples[idx].syncMeta) };
    } else {
      const sIdx = serverData.samples.findIndex((s) => s.id === entityId);
      if (sIdx >= 0) {
        samples[idx] = {
          ...serverData.samples[sIdx],
          syncMeta: markSynced(samples[idx].syncMeta),
        };
      }
    }
    saveSyncedSamples(samples);
    saveServerMockData(serverData);
    return true;
  }
}

export function retryFailed(entityType: EntityType, entityId: string): void {
  const batches = loadSyncedBatches();
  const samples = loadSyncedSamples();

  if (entityType === "BATCH") {
    const idx = batches.findIndex((b) => b.id === entityId);
    if (idx >= 0) {
      batches[idx] = { ...batches[idx], syncMeta: markModified(batches[idx].syncMeta) };
      addPendingOperation({
        entityType: "BATCH",
        entityId,
        operationType: "UPDATE",
        payload: batches[idx] as unknown as Record<string, unknown>,
      });
      saveSyncedBatches(batches);
    }
  } else {
    const idx = samples.findIndex((s) => s.id === entityId);
    if (idx >= 0) {
      samples[idx] = { ...samples[idx], syncMeta: markModified(samples[idx].syncMeta) };
      addPendingOperation({
        entityType: "SAMPLE",
        entityId,
        operationType: "UPDATE",
        payload: samples[idx] as unknown as Record<string, unknown>,
      });
      saveSyncedSamples(samples);
    }
  }
}

export function getSyncStats(): {
  totalBatches: number;
  totalSamples: number;
  synced: number;
  pending: number;
  conflict: number;
  failed: number;
} {
  const batches = loadSyncedBatches();
  const samples = loadSyncedSamples();
  const all = [...batches, ...samples];
  return {
    totalBatches: batches.length,
    totalSamples: samples.length,
    synced: all.filter((e) => e.syncMeta.syncStatus === "SYNCED").length,
    pending: all.filter((e) => e.syncMeta.syncStatus === "PENDING").length,
    conflict: all.filter((e) => e.syncMeta.syncStatus === "CONFLICT").length,
    failed: all.filter((e) => e.syncMeta.syncStatus === "FAILED").length,
  };
}

export function getServerEntityData(
  entityType: EntityType,
  entityId: string
): Record<string, unknown> | null {
  const serverData = loadServerMockData();
  if (entityType === "BATCH") {
    const b = serverData.batches.find((x) => x.id === entityId);
    return b ? (b as unknown as Record<string, unknown>) : null;
  } else {
    const s = serverData.samples.find((x) => x.id === entityId);
    return s ? (s as unknown as Record<string, unknown>) : null;
  }
}

export function getLocalEntityData(
  entityType: EntityType,
  entityId: string
): Record<string, unknown> | null {
  if (entityType === "BATCH") {
    const batches = loadSyncedBatches();
    const b = batches.find((x) => x.id === entityId);
    if (!b) return null;
    const { syncMeta: _m, ...plain } = b;
    return plain as unknown as Record<string, unknown>;
  } else {
    const samples = loadSyncedSamples();
    const s = samples.find((x) => x.id === entityId);
    if (!s) return null;
    const { syncMeta: _m, ...plain } = s;
    return plain as unknown as Record<string, unknown>;
  }
}

export interface ConflictFieldDiff {
  fieldName: string;
  label: string;
  localValue: unknown;
  serverValue: unknown;
  isConflict: boolean;
}

export const FIELD_LABELS: Record<string, string> = {
  sampleNumber: "样本编号",
  insectSpecies: "昆虫种类",
  developmentStage: "发育阶段",
  preservationMethod: "保存方式",
  identificationNotes: "鉴定备注",
  relatedCase: "关联案件",
  samplingLocation: "采样地点",
  environmentTemperature: "环境温度(℃)",
  environmentHumidity: "相对湿度(%)",
  weatherCondition: "天气情况",
  exposureStage: "暴露阶段",
  exposureNotes: "暴露情况备注",
  insectCount: "采集数量",
  insectCollectionMethod: "采集方法",
  preservationSolution: "保存溶液/试剂",
  storageTemperature: "存储温度(℃)",
  temperatureRecords: "温度记录",
  status: "样本状态",
  priority: "复核优先级",
  caseNumber: "案件编号",
  samplingTime: "采样时间",
  fieldNotes: "现场备注",
  sampleCount: "样本数量",
};

export function getFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field;
}

export function getComparableFields(entityType: EntityType): string[] {
  if (entityType === "BATCH") {
    return BATCH_COMPARABLE_FIELDS as string[];
  }
  return SAMPLE_COMPARABLE_FIELDS as string[];
}

export function computeFieldDiffs(
  entityType: EntityType,
  localData: Record<string, unknown>,
  serverData: Record<string, unknown>
): ConflictFieldDiff[] {
  const fields = getComparableFields(entityType);
  return fields.map((f) => {
    const localVal = localData[f];
    const serverVal = serverData[f];
    const isConflict =
      JSON.stringify(localVal) !== JSON.stringify(serverVal);
    return {
      fieldName: f,
      label: getFieldLabel(f),
      localValue: localVal,
      serverValue: serverVal,
      isConflict,
    };
  });
}

function applyFieldResolutions(
  baseData: Record<string, unknown>,
  localData: Record<string, unknown>,
  serverData: Record<string, unknown>,
  fieldResolutions: ConflictFieldResolution[]
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...baseData };
  for (const fr of fieldResolutions) {
    if (fr.strategy === "USE_LOCAL") {
      result[fr.fieldName] = localData[fr.fieldName];
    } else if (fr.strategy === "USE_SERVER") {
      result[fr.fieldName] = serverData[fr.fieldName];
    } else if (fr.strategy === "MANUAL" && fr.manualValue !== undefined) {
      result[fr.fieldName] = fr.manualValue;
    }
  }
  return result;
}

export function addConflictResolutionLog(
  entityType: EntityType,
  entityId: string,
  entityLabel: string,
  resolution: ConflictResolution,
  operator: string = "现场勘查员"
): void {
  const strategyDesc =
    resolution.overallStrategy === "USE_LOCAL"
      ? "全部采用本地版本"
      : resolution.overallStrategy === "USE_SERVER"
      ? "全部采用服务端版本"
      : `逐字段合并（${resolution.fieldResolutions.length} 个字段）`;

  addOperationLog({
    entityType,
    entityId,
    operationType: "UPDATE",
    fieldName: resolution.fieldResolutions.map((f) => f.fieldName).join(","),
    oldValue: resolution.fieldResolutions.reduce(
      (acc, f) => ({ ...acc, [f.fieldName]: { local: f.manualValue ?? undefined, server: undefined } }),
      {}
    ),
    newValue: resolution.resolvedData,
    operator,
    description: `冲突解决：${entityLabel} · ${strategyDesc}`,
  });

  for (const fr of resolution.fieldResolutions) {
    const strategyText =
      fr.strategy === "USE_LOCAL"
        ? "保留本地"
        : fr.strategy === "USE_SERVER"
        ? "采用服务端"
        : "手动合并";
    addOperationLog({
      entityType,
      entityId,
      operationType: "UPDATE",
      fieldName: fr.fieldName,
      oldValue:
        fr.strategy === "USE_SERVER"
          ? { local: (resolution as any)._localRef?.[fr.fieldName], server: (resolution as any)._serverRef?.[fr.fieldName] }
          : undefined,
      newValue: fr.manualValue,
      operator,
      description: `冲突字段 [${getFieldLabel(fr.fieldName)}]：${strategyText}`,
    });
  }
}

export function resolveConflictWithMerge(
  resolution: ConflictResolution,
  operator: string = "现场勘查员"
): boolean {
  const { entityType, entityId, resolvedData, fieldResolutions } = resolution;
  const batches = loadSyncedBatches();
  const samples = loadSyncedSamples();
  const serverData = loadServerMockData();
  const pendingOps = loadPendingOperations();

  let entityLabel = entityId;

  if (entityType === "BATCH") {
    const idx = batches.findIndex((b) => b.id === entityId);
    if (idx < 0) return false;
    const originalBatch = batches[idx];
    entityLabel = originalBatch.caseNumber || entityId;

    const mergedBatch: SampleBatch = {
      ...(originalBatch as unknown as Record<string, unknown>),
      ...resolvedData,
      id: entityId,
      updatedAt: new Date().toISOString(),
    } as unknown as SampleBatch;

    batches[idx] = {
      ...mergedBatch,
      syncMeta: markSynced(markModified(originalBatch.syncMeta)),
    };

    const sIdx = serverData.batches.findIndex((b) => b.id === entityId);
    if (sIdx >= 0) {
      serverData.batches[sIdx] = mergedBatch;
    } else {
      serverData.batches.push(mergedBatch);
    }

    saveSyncedBatches(batches);
  } else {
    const idx = samples.findIndex((s) => s.id === entityId);
    if (idx < 0) return false;
    const originalSample = samples[idx];
    entityLabel = originalSample.sampleNumber || entityId;

    const mergedSample: Sample = {
      ...(originalSample as unknown as Record<string, unknown>),
      ...resolvedData,
      id: entityId,
      updatedAt: new Date().toISOString(),
    } as unknown as Sample;

    samples[idx] = {
      ...mergedSample,
      syncMeta: markSynced(markModified(originalSample.syncMeta)),
    };

    const sIdx = serverData.samples.findIndex((s) => s.id === entityId);
    if (sIdx >= 0) {
      serverData.samples[sIdx] = mergedSample;
    } else {
      serverData.samples.push(mergedSample);
    }

    saveSyncedSamples(samples);
  }

  saveServerMockData(serverData);

  const relatedPendingIds = pendingOps
    .filter((op) => op.entityType === entityType && op.entityId === entityId)
    .map((op) => op.id);
  if (relatedPendingIds.length > 0) {
    removePendingOperations(relatedPendingIds);
  }

  addConflictResolutionLog(entityType, entityId, entityLabel, resolution, operator);
  return true;
}

export function buildResolvedDataFromFieldChoices(
  entityType: EntityType,
  entityId: string,
  localData: Record<string, unknown>,
  serverData: Record<string, unknown>,
  fieldResolutions: ConflictFieldResolution[]
): Record<string, unknown> {
  const baseLocal = getLocalEntityData(entityType, entityId) || {};
  return applyFieldResolutions(baseLocal, localData, serverData, fieldResolutions);
}

export { deepClone, shallowDiff };
