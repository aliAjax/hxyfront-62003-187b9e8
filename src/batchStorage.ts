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
  createdAt: string;
  updatedAt: string;
}

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
