export interface SampleBatch {
  id: string;
  caseNumber: string;
  samplingLocation: string;
  samplingTime: string;
  environmentTemperature: string;
  exposureStage: string;
  fieldNotes: string;
  sampleCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemperatureRecord {
  id: string;
  timestamp: string;
  temperature: string;
  note?: string;
}

export type SampleStatus =
  | "PENDING_IDENTIFICATION"
  | "NEEDS_REVIEW"
  | "PHOTO_COMPLETED"
  | "CONFIRMED";

export interface StatusHistoryRecord {
  id: string;
  oldStatus: SampleStatus | null;
  newStatus: SampleStatus;
  timestamp: string;
  operator: string;
  note: string;
}

export interface Sample {
  id: string;
  sampleNumber: string;
  insectSpecies: string;
  developmentStage: string;
  preservationMethod: string;
  identificationNotes: string;
  relatedCase: string;
  samplingLocation: string;
  environmentTemperature: string;
  temperatureRecords: TemperatureRecord[];
  status: SampleStatus;
  statusHistory: StatusHistoryRecord[];
  createdAt: string;
  updatedAt: string;
}

export const SAMPLE_STATUS_LABELS: Record<SampleStatus, string> = {
  PENDING_IDENTIFICATION: "待鉴定",
  NEEDS_REVIEW: "需复核种属",
  PHOTO_COMPLETED: "已完成拍照",
  CONFIRMED: "已确认",
};

export const SAMPLE_STATUS_COLORS: Record<SampleStatus, string> = {
  PENDING_IDENTIFICATION: "#dc2626",
  NEEDS_REVIEW: "#a16207",
  PHOTO_COMPLETED: "#2563eb",
  CONFIRMED: "#365314",
};

export const STATUS_TRANSITIONS: Record<SampleStatus, SampleStatus[]> = {
  PENDING_IDENTIFICATION: ["NEEDS_REVIEW", "PHOTO_COMPLETED", "CONFIRMED"],
  NEEDS_REVIEW: ["PHOTO_COMPLETED", "CONFIRMED", "PENDING_IDENTIFICATION"],
  PHOTO_COMPLETED: ["CONFIRMED", "NEEDS_REVIEW"],
  CONFIRMED: ["NEEDS_REVIEW", "PENDING_IDENTIFICATION"],
};

const STORAGE_KEY = "forensic_entomology_batches";
const SAMPLE_STORAGE_KEY = "forensic_entomology_samples";

export function loadBatches(): SampleBatch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBatches(batches: SampleBatch[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
}

export function generateBatchId(): string {
  return "BATCH-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getBatchSummary(batch: SampleBatch): string {
  const parts: string[] = [];
  if (batch.exposureStage) parts.push(batch.exposureStage);
  if (batch.environmentTemperature) parts.push(`${batch.environmentTemperature}℃`);
  return parts.length > 0 ? parts.join(" · ") : "暂无详细信息";
}

export function loadSamples(): Sample[] {
  try {
    const raw = localStorage.getItem(SAMPLE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((s) => ({
      ...s,
      samplingLocation: s.samplingLocation || "",
      environmentTemperature: s.environmentTemperature || "",
      temperatureRecords: s.temperatureRecords || [],
      status: s.status || "PENDING_IDENTIFICATION",
      statusHistory: s.statusHistory || [],
    }));
  } catch {
    return [];
  }
}

export function saveSamples(samples: Sample[]): void {
  localStorage.setItem(SAMPLE_STORAGE_KEY, JSON.stringify(samples));
}

export function generateSampleId(): string {
  return "SAMPLE-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function getSampleById(samples: Sample[], id: string): Sample | undefined {
  return samples.find((s) => s.id === id);
}

export function updateSample(samples: Sample[], id: string, updates: Partial<Sample>): Sample[] {
  const now = new Date().toISOString();
  return samples.map((s) =>
    s.id === id ? { ...s, ...updates, updatedAt: now } : s
  );
}

export function getSampleByNumber(samples: Sample[], sampleNumber: string): Sample | undefined {
  return samples.find((s) => s.sampleNumber === sampleNumber);
}

export function generateTemperatureRecordId(): string {
  return "TEMP-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function generateStatusHistoryId(): string {
  return "STATUS-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function getSamplesByStatus(samples: Sample[], status: SampleStatus): Sample[] {
  return samples.filter((s) => s.status === status);
}

export function updateSampleStatus(
  samples: Sample[],
  sampleId: string,
  newStatus: SampleStatus,
  note: string,
  operator: string = "系统管理员"
): Sample[] {
  const now = new Date().toISOString();
  return samples.map((s) => {
    if (s.id !== sampleId) return s;
    const historyRecord: StatusHistoryRecord = {
      id: generateStatusHistoryId(),
      oldStatus: s.status,
      newStatus,
      timestamp: now,
      operator,
      note,
    };
    return {
      ...s,
      status: newStatus,
      statusHistory: [...s.statusHistory, historyRecord],
      updatedAt: now,
    };
  });
}

export function getSortedTemperatureRecords(records: TemperatureRecord[]): TemperatureRecord[] {
  return [...records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function calculateTemperatureStats(records: TemperatureRecord[]): {
  max: number | null;
  min: number | null;
  avg: number | null;
  count: number;
} {
  const validTemps = records
    .map((r) => parseFloat(r.temperature))
    .filter((t) => !isNaN(t));

  if (validTemps.length === 0) {
    return { max: null, min: null, avg: null, count: 0 };
  }

  const max = Math.max(...validTemps);
  const min = Math.min(...validTemps);
  const avg = validTemps.reduce((sum, t) => sum + t, 0) / validTemps.length;

  return { max, min, avg, count: validTemps.length };
}

export function isAbnormalTemperature(temperature: number): boolean {
  return temperature < -10 || temperature > 50;
}

export function getSamplesByCase(samples: Sample[], caseNumber: string): Sample[] {
  return samples.filter((s) => s.relatedCase === caseNumber);
}

export function getAllCaseNumbers(batches: SampleBatch[], samples: Sample[]): string[] {
  const caseSet = new Set<string>();
  batches.forEach((b) => {
    if (b.caseNumber.trim()) {
      caseSet.add(b.caseNumber.trim());
    }
  });
  samples.forEach((s) => {
    if (s.relatedCase.trim()) {
      caseSet.add(s.relatedCase.trim());
    }
  });
  return Array.from(caseSet).sort();
}

export function getUnassociatedSamples(samples: Sample[]): Sample[] {
  return samples.filter((s) => !s.relatedCase.trim());
}

export function getBatchesByCase(batches: SampleBatch[], caseNumber: string): SampleBatch[] {
  return batches.filter((b) => b.caseNumber === caseNumber);
}

export interface CaseInfo {
  caseNumber: string;
  batches: SampleBatch[];
  samples: Sample[];
  totalSamples: number;
  totalBatches: number;
}

export function buildCaseInfo(
  batches: SampleBatch[],
  samples: Sample[],
  caseNumber: string
): CaseInfo {
  const caseBatches = getBatchesByCase(batches, caseNumber);
  const caseSamples = getSamplesByCase(samples, caseNumber);
  return {
    caseNumber,
    batches: caseBatches,
    samples: caseSamples,
    totalSamples: caseSamples.length,
    totalBatches: caseBatches.length,
  };
}

export function associateSampleToCase(
  samples: Sample[],
  sampleId: string,
  caseNumber: string
): Sample[] {
  return updateSample(samples, sampleId, { relatedCase: caseNumber });
}

export function unassociateSampleFromCase(
  samples: Sample[],
  sampleId: string
): Sample[] {
  return updateSample(samples, sampleId, { relatedCase: "" });
}
