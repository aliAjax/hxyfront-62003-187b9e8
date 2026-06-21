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

export interface Sample {
  id: string;
  sampleNumber: string;
  insectSpecies: string;
  developmentStage: string;
  preservationMethod: string;
  identificationNotes: string;
  relatedCase: string;
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
    return Array.isArray(parsed) ? parsed : [];
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
