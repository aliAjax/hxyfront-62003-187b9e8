import { useState, useEffect } from "react";
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
  REVIEW_PRIORITY_LABELS,
  REVIEW_PRIORITY_COLORS,
  REVIEW_PRIORITIES,
  formatDateTime,
  getSortedTemperatureRecords,
  calculateTemperatureStats,
  isAbnormalTemperature,
  DEVELOPMENT_STAGES,
  PRESERVATION_METHODS,
  EXPOSURE_STAGES,
  COLLECTION_METHODS,
  WEATHER_CONDITIONS,
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
  SyncResult,
} from "./offlineSync";
import TemperatureChart from "./TemperatureChart";
import { SyncStatusBadge } from "./OfflineWorkbench";

export function BatchListView({
  batches,
  samples,
  onCreateBatch,
  onEditBatch,
  onDeleteBatch,
  onViewSample,
  onCreateSample,
}: {
  batches: SyncedSampleBatch[];
  samples: SyncedSample[];
  onCreateBatch: () => void;
  onEditBatch: (id: string) => void;
  onDeleteBatch: (id: string) => void;
  onViewSample: (id: string) => void;
  onCreateSample: (batchId: string) => void;
}) {
  return (
    <div className="workbench-content">
      <div className="content-header">
        <div>
          <h2 className="content-title">样本批次</h2>
          <p className="content-desc">
            共 {batches.length} 个批次，{samples.length} 个样本
          </p>
        </div>
        <button className="primary large" onClick={onCreateBatch}>
          + 新建批次
        </button>
      </div>

      {batches.length === 0 ? (
        <div className="empty-state large">
          <div className="empty-icon">📦</div>
          <h3>暂无批次</h3>
          <p>点击上方按钮创建第一个样本批次</p>
        </div>
      ) : (
        <div className="batch-grid">
          {batches.map((batch, idx) => {
            const batchSamples = samples.filter(
              (s) => s.relatedCase === batch.caseNumber
            );
            return (
              <article key={batch.id} className="workbench-batch-card">
                <div className="batch-card-header">
                  <div className="batch-index">{String(idx + 1).padStart(2, "0")}</div>
                  <div className="batch-card-title">
                    <h3>{batch.caseNumber || "未命名案件"}</h3>
                    <p>{batch.samplingLocation || "未设置采样地点"}</p>
                  </div>
                  <SyncStatusBadge
                    status={batch.syncMeta.syncStatus}
                    error={batch.syncMeta.syncError}
                  />
                </div>

                <div className="batch-card-meta">
                  <span className="meta-pill">
                    📍 {batch.exposureStage || "未设置阶段"}
                  </span>
                  {batch.environmentTemperature && (
                    <span className="meta-pill">🌡️ {batch.environmentTemperature}℃</span>
                  )}
                  <span className="meta-pill">🧪 {batchSamples.length} 个样本</span>
                </div>

                {batchSamples.length > 0 && (
                  <div className="batch-samples-preview">
                    {batchSamples.slice(0, 3).map((s) => (
                      <div
                        key={s.id}
                        className="sample-preview-chip"
                        onClick={() => onViewSample(s.id)}
                      >
                        <span
                          className="sample-preview-dot"
                          style={{ background: SYNC_STATUS_COLORS[s.syncMeta.syncStatus] }}
                        />
                        <span className="sample-preview-number">{s.sampleNumber}</span>
                        <span
                          className="sample-preview-status"
                          style={{ color: SAMPLE_STATUS_COLORS[s.status] }}
                        >
                          {SAMPLE_STATUS_LABELS[s.status]}
                        </span>
                      </div>
                    ))}
                    {batchSamples.length > 3 && (
                      <span className="sample-more">+{batchSamples.length - 3} 更多</span>
                    )}
                  </div>
                )}

                {batch.fieldNotes && (
                  <div className="batch-card-notes">
                    <strong>📝 现场备注：</strong>
                    {batch.fieldNotes}
                  </div>
                )}

                <div className="batch-card-footer">
                  <span className="update-time">
                    更新于 {formatDateTime(batch.syncMeta.lastModifiedAt)}
                  </span>
                  <div className="batch-card-actions">
                    <button className="secondary" onClick={() => onCreateSample(batch.id)}>
                      + 样本
                    </button>
                    <button className="secondary" onClick={() => onEditBatch(batch.id)}>
                      ✏️ 编辑
                    </button>
                    <button className="danger-btn" onClick={() => onDeleteBatch(batch.id)}>
                      🗑
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function BatchEditView({
  batch,
  samples,
  onBack,
  onUpdate,
  onViewSample,
  onCreateSample,
}: {
  batch: SyncedSampleBatch;
  samples: SyncedSample[];
  onBack: () => void;
  onUpdate: (id: string, updates: Partial<SampleBatch>) => void;
  onViewSample: (id: string) => void;
  onCreateSample: () => void;
}) {
  const [formData, setFormData] = useState(batch);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setFormData(batch);
    setHasChanges(false);
  }, [batch]);

  useEffect(() => {
    const changed = Object.keys(formData).some(
      (k) =>
        JSON.stringify((formData as unknown as Record<string, unknown>)[k]) !==
        JSON.stringify((batch as unknown as Record<string, unknown>)[k])
    );
    setHasChanges(changed);
  }, [formData, batch]);

  const handleChange = (field: keyof SampleBatch, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onUpdate(batch.id, formData);
    setHasChanges(false);
  };

  return (
    <div className="workbench-content">
      <div className="content-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="back-button" onClick={onBack}>
            ← 返回列表
          </button>
          <div>
            <h2 className="content-title">编辑批次</h2>
            <p className="content-desc">
              版本 v{batch.syncMeta.version} · {formatDateTime(batch.syncMeta.lastModifiedAt)}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SyncStatusBadge
            status={batch.syncMeta.syncStatus}
            error={batch.syncMeta.syncError}
          />
          <button className="primary" onClick={handleSave} disabled={!hasChanges}>
            💾 保存修改
          </button>
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>📍 批次信息</h3>
        <div className="field-grid">
          <label>
            <span>案件编号</span>
            <input
              type="text"
              value={formData.caseNumber}
              onChange={(e) => handleChange("caseNumber", e.target.value)}
              placeholder="如 CASE-2026-001"
            />
          </label>
          <label>
            <span>采样地点</span>
            <input
              type="text"
              value={formData.samplingLocation}
              onChange={(e) => handleChange("samplingLocation", e.target.value)}
              placeholder="详细地址"
            />
          </label>
          <label>
            <span>采样时间</span>
            <input
              type="datetime-local"
              value={formData.samplingTime?.slice(0, 16) || ""}
              onChange={(e) =>
                handleChange("samplingTime", new Date(e.target.value).toISOString())
              }
            />
          </label>
          <label>
            <span>环境温度 (℃)</span>
            <input
              type="number"
              step="0.1"
              value={formData.environmentTemperature}
              onChange={(e) => handleChange("environmentTemperature", e.target.value)}
            />
          </label>
          <label>
            <span>尸体暴露阶段</span>
            <select
              className="select-field"
              value={formData.exposureStage}
              onChange={(e) => handleChange("exposureStage", e.target.value)}
            >
              <option value="">请选择</option>
              {EXPOSURE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>样本数量</span>
            <input
              type="number"
              min="0"
              value={formData.sampleCount}
              onChange={(e) => handleChange("sampleCount", parseInt(e.target.value) || 0)}
            />
          </label>
          <label className="full-width">
            <span>现场备注</span>
            <textarea
              className="textarea-field"
              value={formData.fieldNotes}
              onChange={(e) => handleChange("fieldNotes", e.target.value)}
              placeholder="记录现场观察到的情况..."
            />
          </label>
        </div>
      </div>

      <div className="panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h3 style={{ margin: 0 }}>🧪 关联样本 ({samples.length})</h3>
          <button className="primary" onClick={onCreateSample}>
            + 添加样本
          </button>
        </div>
        {samples.length === 0 ? (
          <div className="empty-state compact">
            <div className="empty-icon">🧪</div>
            <h3>暂无样本</h3>
            <p>点击上方按钮添加样本到此批次</p>
          </div>
        ) : (
          <div className="sample-mini-list">
            {samples.map((s) => (
              <div
                key={s.id}
                className="sample-mini-item"
                onClick={() => onViewSample(s.id)}
              >
                <SyncStatusBadge
                  status={s.syncMeta.syncStatus}
                  error={s.syncMeta.syncError}
                />
                <div className="sample-mini-info">
                  <strong>{s.sampleNumber || "未命名样本"}</strong>
                  <span>
                    {[s.developmentStage, s.insectSpecies, SAMPLE_STATUS_LABELS[s.status]]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <span
                  className="sample-mini-status"
                  style={{ color: SAMPLE_STATUS_COLORS[s.status] }}
                >
                  {SAMPLE_STATUS_LABELS[s.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function SampleDetailView({
  sample,
  allSamples,
  onBack,
  onUpdate,
  onUpdateStatus,
  onAddTempRecord,
  onDeleteTempRecord,
}: {
  sample: SyncedSample;
  allSamples: SyncedSample[];
  onBack: () => void;
  onUpdate: (id: string, updates: Partial<Sample>) => void;
  onUpdateStatus: (id: string, newStatus: SampleStatus, note: string, newPriority?: ReviewPriority) => void;
  onAddTempRecord: (sampleId: string, record: Omit<TemperatureRecord, "id">) => void;
  onDeleteTempRecord: (sampleId: string, recordId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Sample>(sample);
  const [hasChanges, setHasChanges] = useState(false);
  const [newTempValue, setNewTempValue] = useState("");
  const [newTempTime, setNewTempTime] = useState("");
  const [newTempNote, setNewTempNote] = useState("");
  const [tempWarning, setTempWarning] = useState("");
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [statusDialogNote, setStatusDialogNote] = useState("");
  const [statusDialogTarget, setStatusDialogTarget] = useState<SampleStatus | null>(null);
  const [statusDialogPriority, setStatusDialogPriority] = useState<ReviewPriority | null>(null);

  useEffect(() => {
    setFormData(sample);
    setHasChanges(false);
  }, [sample]);

  useEffect(() => {
    const changed = Object.keys(formData).some(
      (k) =>
        JSON.stringify((formData as unknown as Record<string, unknown>)[k]) !==
        JSON.stringify((sample as unknown as Record<string, unknown>)[k])
    );
    setHasChanges(changed);
  }, [formData, sample]);

  const handleChange = (field: keyof Sample, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!formData.sampleNumber.trim()) {
      alert("样本编号不能为空");
      return;
    }
    onUpdate(sample.id, formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData(sample);
    setIsEditing(false);
    setHasChanges(false);
  };

  const handleTempValueChange = (value: string) => {
    setNewTempValue(value);
    const temp = parseFloat(value);
    if (!isNaN(temp) && isAbnormalTemperature(temp)) {
      setTempWarning("温度值异常（低于-10℃或高于50℃），请确认");
    } else {
      setTempWarning("");
    }
  };

  const handleAddTemp = () => {
    if (!newTempValue.trim()) {
      alert("请输入温度值");
      return;
    }
    const temp = parseFloat(newTempValue);
    if (isNaN(temp)) {
      alert("请输入有效的温度数值");
      return;
    }
    if (isAbnormalTemperature(temp)) {
      if (!confirm(`温度值 ${temp}℃ 异常，是否仍然保存？`)) return;
    }
    onAddTempRecord(sample.id, {
      timestamp: newTempTime || new Date().toISOString(),
      temperature: newTempValue.trim(),
      note: newTempNote.trim() || undefined,
    });
    setNewTempValue("");
    setNewTempTime("");
    setNewTempNote("");
    setTempWarning("");
  };

  const handleStatusChangeClick = (target: SampleStatus) => {
    setStatusDialogTarget(target);
    setStatusDialogNote("");
    setStatusDialogPriority(sample.priority);
    setShowStatusDialog(true);
  };

  const handleConfirmStatusChange = () => {
    if (statusDialogTarget) {
      onUpdateStatus(sample.id, statusDialogTarget, statusDialogNote || "状态变更", statusDialogPriority ?? undefined);
      setShowStatusDialog(false);
      setStatusDialogTarget(null);
      setStatusDialogPriority(null);
    }
  };

  const sortedTempRecords = getSortedTemperatureRecords(sample.temperatureRecords);
  const tempStats = calculateTemperatureStats(sample.temperatureRecords);
  const availableStatuses = STATUS_TRANSITIONS[sample.status] || [];

  const InfoItem = ({
    label,
    value,
    field,
    type = "text",
    options,
  }: {
    label: string;
    value: string;
    field: keyof Sample;
    type?: "text" | "textarea" | "select";
    options?: string[];
  }) => (
    <div className="detail-item">
      <label className="detail-label">{label}</label>
      {isEditing ? (
        type === "textarea" ? (
          <textarea
            className="detail-textarea"
            value={value}
            onChange={(e) => handleChange(field, e.target.value)}
            rows={4}
          />
        ) : type === "select" ? (
          <select
            className="detail-select"
            value={value}
            onChange={(e) => handleChange(field, e.target.value)}
          >
            <option value="">请选择</option>
            {options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            className="detail-input"
            value={value}
            onChange={(e) => handleChange(field, e.target.value)}
          />
        )
      ) : (
        <div className="detail-value">{value || "—"}</div>
      )}
    </div>
  );

  return (
    <div className="sample-detail workbench-content">
      <div className="detail-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="back-button" onClick={onBack}>
            ← 返回
          </button>
          <SyncStatusBadge
            status={sample.syncMeta.syncStatus}
            error={sample.syncMeta.syncError}
          />
        </div>
        <div className="detail-actions">
          {isEditing ? (
            <>
              <button className="secondary" onClick={handleCancel}>
                取消
              </button>
              <button className="primary" onClick={handleSave} disabled={!hasChanges}>
                💾 保存修改
              </button>
            </>
          ) : (
            <button className="primary" onClick={() => setIsEditing(true)}>
              ✏️ 编辑
            </button>
          )}
        </div>
      </div>

      <div className="detail-hero">
        <div className="detail-hero-icon">🔬</div>
        <div className="detail-hero-info">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <p className="detail-badge">样本详情</p>
            <span
              className="queue-status-badge"
              style={{
                background: `color-mix(in srgb, ${SAMPLE_STATUS_COLORS[sample.status]} 12%, #ffffff)`,
                color: SAMPLE_STATUS_COLORS[sample.status],
                borderColor: SAMPLE_STATUS_COLORS[sample.status],
              }}
            >
              {SAMPLE_STATUS_LABELS[sample.status]}
            </span>
          </div>
          <h1 className="detail-title">
            {isEditing ? (
              <input
                type="text"
                className="title-input"
                value={formData.sampleNumber}
                onChange={(e) => handleChange("sampleNumber", e.target.value)}
              />
            ) : (
              sample.sampleNumber
            )}
          </h1>
          <p className="detail-meta">
            创建于 {formatDateTime(sample.createdAt)}
            {sample.updatedAt !== sample.createdAt && (
              <> · 更新于 {formatDateTime(sample.updatedAt)}</>
            )}
            {" · 版本 v"}
            {sample.syncMeta.version}
          </p>
        </div>
      </div>

      <div className="panel status-transition-panel">
        <h3 className="section-title" style={{ marginTop: 0 }}>
          🔬 鉴定复核操作
        </h3>
        <p style={{ color: "#64748b", margin: "0 0 14px 0", fontSize: 13 }}>
          当前状态：
          <strong style={{ color: SAMPLE_STATUS_COLORS[sample.status] }}>
            {SAMPLE_STATUS_LABELS[sample.status]}
          </strong>
        </p>
        <div className="status-transition-btns">
          {availableStatuses.length === 0 ? (
            <span style={{ color: "#94a3b8" }}>暂无可转换状态</span>
          ) : (
            availableStatuses.map((st) => (
              <button
                key={st}
                className="status-transition-btn"
                style={{
                  borderColor: SAMPLE_STATUS_COLORS[st],
                  color: SAMPLE_STATUS_COLORS[st],
                }}
                onClick={() => handleStatusChangeClick(st)}
              >
                → {SAMPLE_STATUS_LABELS[st]}
              </button>
            ))
          )}
        </div>
        {sample.statusHistory.length > 0 && (
          <div className="status-history-mini">
            <p style={{ fontSize: 12, color: "#64748b", margin: "14px 0 8px 0" }}>
              状态历史：
            </p>
            {sample.statusHistory.slice(-3).map((h) => (
              <div key={h.id} className="history-mini-item">
                <span
                  className="history-mini-dot"
                  style={{ background: SAMPLE_STATUS_COLORS[h.newStatus] }}
                />
                <span className="history-mini-text">
                  {h.oldStatus
                    ? `${SAMPLE_STATUS_LABELS[h.oldStatus]} → ${SAMPLE_STATUS_LABELS[h.newStatus]}`
                    : `初始：${SAMPLE_STATUS_LABELS[h.newStatus]}`}
                  {" · "}
                  {h.operator}
                  {" · "}
                  {formatDateTime(h.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="detail-content">
        <div className="detail-section">
          <h3 className="section-title">📍 采样地点</h3>
          <div className="detail-grid">
            <InfoItem label="样本编号" value={formData.sampleNumber} field="sampleNumber" />
            <InfoItem
              label="采样地点"
              value={formData.samplingLocation}
              field="samplingLocation"
            />
            <InfoItem label="关联案件" value={formData.relatedCase} field="relatedCase" />
          </div>
        </div>

        <div className="detail-section">
          <h3 className="section-title">🌡️ 环境条件</h3>
          <div className="detail-grid">
            <InfoItem
              label="环境温度 (℃)"
              value={formData.environmentTemperature}
              field="environmentTemperature"
            />
            <InfoItem
              label="相对湿度 (%)"
              value={formData.environmentHumidity}
              field="environmentHumidity"
            />
            <InfoItem
              label="天气情况"
              value={formData.weatherCondition}
              field="weatherCondition"
              type="select"
              options={WEATHER_CONDITIONS}
            />
          </div>
        </div>

        <div className="detail-section">
          <h3 className="section-title">💀 尸体暴露阶段</h3>
          <div className="detail-grid">
            <InfoItem
              label="暴露阶段"
              value={formData.exposureStage}
              field="exposureStage"
              type="select"
              options={EXPOSURE_STAGES}
            />
            <InfoItem
              label="暴露情况备注"
              value={formData.exposureNotes}
              field="exposureNotes"
              type="textarea"
            />
          </div>
        </div>

        <div className="detail-section">
          <h3 className="section-title">🪰 昆虫信息</h3>
          <div className="detail-grid">
            <InfoItem
              label="昆虫种类"
              value={formData.insectSpecies}
              field="insectSpecies"
            />
            <InfoItem label="采集数量" value={formData.insectCount} field="insectCount" />
            <InfoItem
              label="发育阶段"
              value={formData.developmentStage}
              field="developmentStage"
              type="select"
              options={DEVELOPMENT_STAGES}
            />
            <InfoItem
              label="采集方法"
              value={formData.insectCollectionMethod}
              field="insectCollectionMethod"
              type="select"
              options={COLLECTION_METHODS}
            />
          </div>
        </div>

        <div className="detail-section">
          <h3 className="section-title">🧪 保存方式</h3>
          <div className="detail-grid">
            <InfoItem
              label="保存方式"
              value={formData.preservationMethod}
              field="preservationMethod"
              type="select"
              options={PRESERVATION_METHODS}
            />
            <InfoItem
              label="保存溶液 / 试剂"
              value={formData.preservationSolution}
              field="preservationSolution"
            />
            <InfoItem
              label="存储温度 (℃)"
              value={formData.storageTemperature}
              field="storageTemperature"
            />
          </div>
        </div>

        <div className="detail-section">
          <h3 className="section-title">📝 鉴定备注</h3>
          <InfoItem
            label=""
            value={formData.identificationNotes}
            field="identificationNotes"
            type="textarea"
          />
        </div>

        <div className="detail-section">
          <div className="chart-header">
            <h3 className="section-title">🌡️ 温度记录</h3>
            <span className="chart-record-count">
              共 {sortedTempRecords.length} 条记录
            </span>
          </div>

          <div className="temp-input-section">
            <div className="temp-input-row">
              <div className="temp-input-item">
                <label className="temp-input-label">温度值 (℃)</label>
                <input
                  type="number"
                  step="0.1"
                  className="temp-input"
                  value={newTempValue}
                  onChange={(e) => handleTempValueChange(e.target.value)}
                  placeholder="例如: 25.6"
                />
              </div>
              <div className="temp-input-item">
                <label className="temp-input-label">记录时间</label>
                <input
                  type="datetime-local"
                  className="temp-input"
                  value={newTempTime}
                  onChange={(e) => setNewTempTime(e.target.value)}
                />
              </div>
              <div className="temp-input-item">
                <label className="temp-input-label">备注</label>
                <input
                  type="text"
                  className="temp-input"
                  value={newTempNote}
                  onChange={(e) => setNewTempNote(e.target.value)}
                  placeholder="可选"
                />
              </div>
              <div className="temp-input-item temp-add-btn-wrapper">
                <button className="primary temp-add-btn" onClick={handleAddTemp}>
                  + 添加记录
                </button>
              </div>
            </div>
            {tempWarning && <div className="temp-warning">⚠️ {tempWarning}</div>}
          </div>

          <TemperatureChart records={sample.temperatureRecords} />

          {tempStats.count > 0 && (
            <div className="temperature-stats">
              <div className="stat-card stat-max">
                <span className="stat-label">最高温</span>
                <span className="stat-value">
                  {tempStats.max !== null ? `${tempStats.max.toFixed(1)}℃` : "—"}
                </span>
              </div>
              <div className="stat-card stat-min">
                <span className="stat-label">最低温</span>
                <span className="stat-value">
                  {tempStats.min !== null ? `${tempStats.min.toFixed(1)}℃` : "—"}
                </span>
              </div>
              <div className="stat-card stat-avg">
                <span className="stat-label">平均温度</span>
                <span className="stat-value">
                  {tempStats.avg !== null ? `${tempStats.avg.toFixed(1)}℃` : "—"}
                </span>
              </div>
              <div className="stat-card stat-count">
                <span className="stat-label">总记录</span>
                <span className="stat-value">{tempStats.count}</span>
              </div>
            </div>
          )}

          {sortedTempRecords.length > 0 && (
            <div className="temp-records-list">
              <h4 className="temp-list-title">记录明细</h4>
              <div className="temp-record-items">
                {sortedTempRecords.map((record) => {
                  const temp = parseFloat(record.temperature);
                  const abnormal = !isNaN(temp) && isAbnormalTemperature(temp);
                  return (
                    <div
                      key={record.id}
                      className={`temp-record-item ${abnormal ? "abnormal" : ""}`}
                    >
                      <div className="temp-record-time">
                        {formatDateTime(record.timestamp)}
                      </div>
                      <div className="temp-record-value">
                        <span className="temp-number">{record.temperature}℃</span>
                        {abnormal && <span className="temp-abnormal-tag">异常</span>}
                      </div>
                      {record.note && <div className="temp-record-note">{record.note}</div>}
                      <button
                        className="temp-delete-btn"
                        onClick={() => onDeleteTempRecord(sample.id, record.id)}
                        title="删除记录"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {showStatusDialog && statusDialogTarget && (
        <div className="dialog-overlay" onClick={() => setShowStatusDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>确认状态变更</h3>
              <button className="dialog-close" onClick={() => setShowStatusDialog(false)}>
                ✕
              </button>
            </div>
            <div className="dialog-body">
              <div className="status-change-info">
                <div className="status-change-row">
                  <span className="status-change-label">当前状态</span>
                  <span
                    className="status-change-value"
                    style={{ color: SAMPLE_STATUS_COLORS[sample.status] }}
                  >
                    {SAMPLE_STATUS_LABELS[sample.status]}
                  </span>
                </div>
                <div className="status-change-arrow">↓</div>
                <div className="status-change-row">
                  <span className="status-change-label">目标状态</span>
                  <span
                    className="status-change-value"
                    style={{ color: SAMPLE_STATUS_COLORS[statusDialogTarget] }}
                  >
                    {SAMPLE_STATUS_LABELS[statusDialogTarget]}
                  </span>
                </div>
                <div className="status-change-row">
                  <span className="status-change-label">当前优先级</span>
                  <span
                    className="status-change-value"
                    style={{ color: REVIEW_PRIORITY_COLORS[sample.priority] }}
                  >
                    {REVIEW_PRIORITY_LABELS[sample.priority]}
                  </span>
                </div>
              </div>
              <div className="dialog-form-row">
                <label>
                  <span>调整复核优先级</span>
                  <div className="priority-selector">
                    {REVIEW_PRIORITIES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`priority-option ${statusDialogPriority === p ? "selected" : ""}`}
                        style={{
                          "--priority-color": REVIEW_PRIORITY_COLORS[p],
                        } as React.CSSProperties}
                        onClick={() => setStatusDialogPriority(p)}
                      >
                        <span className="priority-option-icon">
                          {p === "HIGH" ? "🔴" : p === "MEDIUM" ? "🟡" : "🔵"}
                        </span>
                        <span className="priority-option-label">
                          {REVIEW_PRIORITY_LABELS[p]}
                        </span>
                      </button>
                    ))}
                  </div>
                </label>
              </div>
              <div className="dialog-form-row">
                <label>
                  <span>变更备注</span>
                  <textarea
                    className="textarea-field"
                    value={statusDialogNote}
                    onChange={(e) => setStatusDialogNote(e.target.value)}
                    placeholder="请输入状态变更原因..."
                    rows={3}
                  />
                </label>
              </div>
            </div>
            <div className="dialog-footer">
              <button className="secondary" onClick={() => setShowStatusDialog(false)}>
                取消
              </button>
              <button className="primary" onClick={handleConfirmStatusChange}>
                确认变更
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function OperationLogView({
  logs,
  samples,
  batches,
}: {
  logs: OperationLog[];
  samples: SyncedSample[];
  batches: SyncedSampleBatch[];
}) {
  const getEntityLabel = (log: OperationLog): string => {
    if (log.entityType === "SAMPLE") {
      const s = samples.find((x) => x.id === log.entityId);
      return s?.sampleNumber || log.entityId.slice(0, 12);
    } else {
      const b = batches.find((x) => x.id === log.entityId);
      return b?.caseNumber || log.entityId.slice(0, 12);
    }
  };

  const opTypeLabels: Record<OperationType, string> = {
    CREATE: "创建",
    UPDATE: "修改",
    DELETE: "删除",
  };

  const opTypeColors: Record<OperationType, string> = {
    CREATE: "#059669",
    UPDATE: "#2563eb",
    DELETE: "#dc2626",
  };

  return (
    <div className="workbench-content">
      <div className="content-header">
        <div>
          <h2 className="content-title">操作日志</h2>
          <p className="content-desc">所有本地操作均已记录，支持离线追溯</p>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="empty-state large">
          <div className="empty-icon">📝</div>
          <h3>暂无操作记录</h3>
          <p>开始操作后，所有变更将记录在此处</p>
        </div>
      ) : (
        <div className="operation-log-list">
          {logs.map((log) => (
            <div key={log.id} className="log-item">
              <div
                className="log-op-type"
                style={{ background: opTypeColors[log.operationType] }}
              >
                {opTypeLabels[log.operationType]}
              </div>
              <div className="log-main">
                <div className="log-header">
                  <span className="log-entity-type">
                    {log.entityType === "SAMPLE" ? "🧪 样本" : "📦 批次"}
                  </span>
                  <strong className="log-entity-name">{getEntityLabel(log)}</strong>
                  <span className="log-desc">{log.description}</span>
                </div>
                <div className="log-meta">
                  <span>👤 {log.operator}</span>
                  <span>🕒 {formatDateTime(log.timestamp)}</span>
                  <SyncStatusBadge status={log.syncStatus} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SyncCenterView({
  batches,
  samples,
  pendingOps,
  lastResult,
  onSync,
  isSyncing,
  onResolveConflict,
  onRetryFailed,
}: {
  batches: SyncedSampleBatch[];
  samples: SyncedSample[];
  pendingOps: PendingOperation[];
  lastResult: SyncResult | null;
  onSync: () => void;
  isSyncing: boolean;
  onResolveConflict: (
    entityType: EntityType,
    entityId: string,
    strategy: "USE_LOCAL" | "USE_SERVER"
  ) => void;
  onRetryFailed: (entityType: EntityType, entityId: string) => void;
}) {
  const pendingItems = [...batches, ...samples].filter(
    (e) => e.syncMeta.syncStatus !== "SYNCED"
  );
  const conflictItems = pendingItems.filter((e) => e.syncMeta.syncStatus === "CONFLICT");
  const failedItems = pendingItems.filter((e) => e.syncMeta.syncStatus === "FAILED");
  const pendingOnlyItems = pendingItems.filter(
    (e) => e.syncMeta.syncStatus === "PENDING"
  );

  const getItemLabel = (entityType: EntityType, entityId: string): string => {
    if (entityType === "SAMPLE") {
      const s = samples.find((x) => x.id === entityId);
      return s?.sampleNumber || entityId.slice(0, 14);
    } else {
      const b = batches.find((x) => x.id === entityId);
      return b?.caseNumber || entityId.slice(0, 14);
    }
  };

  return (
    <div className="workbench-content">
      <div className="content-header">
        <div>
          <h2 className="content-title">同步中心</h2>
          <p className="content-desc">
            {pendingItems.length} 条待处理 · {pendingOps.length} 项操作队列
          </p>
        </div>
        <button className="primary large" onClick={onSync} disabled={isSyncing}>
          {isSyncing ? "🔄 同步中..." : "☁️ 立即同步所有"}
        </button>
      </div>

      {lastResult && (
        <div className="panel sync-result-panel">
          <h3 style={{ marginTop: 0 }}>📊 上次同步结果</h3>
          <div className="sync-result-grid">
            <div
              className="sync-result-item"
              style={{ color: SYNC_STATUS_COLORS.SYNCED }}
            >
              <span className="sync-result-num">{lastResult.syncedCount}</span>
              <span>成功</span>
            </div>
            <div
              className="sync-result-item"
              style={{ color: SYNC_STATUS_COLORS.PENDING }}
            >
              <span className="sync-result-num">{lastResult.pendingCount}</span>
              <span>队列中</span>
            </div>
            <div
              className="sync-result-item"
              style={{ color: SYNC_STATUS_COLORS.CONFLICT }}
            >
              <span className="sync-result-num">{lastResult.conflictCount}</span>
              <span>冲突</span>
            </div>
            <div
              className="sync-result-item"
              style={{ color: SYNC_STATUS_COLORS.FAILED }}
            >
              <span className="sync-result-num">{lastResult.failedCount}</span>
              <span>失败</span>
            </div>
          </div>
          {lastResult.messages.length > 0 && (
            <ul className="sync-result-messages">
              {lastResult.messages.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {conflictItems.length > 0 && (
        <div className="panel conflict-panel">
          <h3 style={{ marginTop: 0, color: SYNC_STATUS_COLORS.CONFLICT }}>
            ⚠ 数据冲突 ({conflictItems.length})
          </h3>
          <p style={{ color: "#64748b", margin: "0 0 14px 0" }}>
            本地和服务端数据不一致，请选择保留哪个版本
          </p>
          <div className="conflict-list">
            {conflictItems.map((item) => {
              const entityType: EntityType =
                "sampleNumber" in item ? "SAMPLE" : "BATCH";
              const label = getItemLabel(
                entityType,
                ("sampleNumber" in item ? item : (item as unknown as SampleBatch)).id
              );
              return (
                <div key={item.syncMeta.version + Math.random()} className="conflict-item">
                  <div className="conflict-item-info">
                    <span className="conflict-entity-type">
                      {entityType === "SAMPLE" ? "🧪 样本" : "📦 批次"}
                    </span>
                    <strong>{label}</strong>
                    {item.syncMeta.syncError && (
                      <span className="conflict-error">{item.syncMeta.syncError}</span>
                    )}
                  </div>
                  <div className="conflict-actions">
                    <button
                      className="primary"
                      onClick={() => onResolveConflict(entityType, (item as { id: string }).id, "USE_LOCAL")}
                    >
                      ✓ 使用本地版本
                    </button>
                    <button
                      className="secondary"
                      onClick={() => onResolveConflict(entityType, (item as { id: string }).id, "USE_SERVER")}
                    >
                      ← 使用服务端版本
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {failedItems.length > 0 && (
        <div className="panel failed-panel">
          <h3 style={{ marginTop: 0, color: SYNC_STATUS_COLORS.FAILED }}>
            ✕ 同步失败 ({failedItems.length})
          </h3>
          <p style={{ color: "#64748b", margin: "0 0 14px 0" }}>
            网络或其他问题导致同步失败，可手动重试
          </p>
          <div className="failed-list">
            {failedItems.map((item) => {
              const entityType: EntityType =
                "sampleNumber" in item ? "SAMPLE" : "BATCH";
              const label = getItemLabel(
                entityType,
                ("sampleNumber" in item ? item : (item as unknown as SampleBatch)).id
              );
              return (
                <div key={(item as { id: string }).id} className="failed-item">
                  <div className="failed-item-info">
                    <span className="conflict-entity-type">
                      {entityType === "SAMPLE" ? "🧪 样本" : "📦 批次"}
                    </span>
                    <strong>{label}</strong>
                    {item.syncMeta.syncError && (
                      <span className="conflict-error">{item.syncMeta.syncError}</span>
                    )}
                  </div>
                  <button
                    className="primary"
                    onClick={() =>
                      onRetryFailed(entityType, (item as { id: string }).id)
                    }
                  >
                    ⟳ 重新同步
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pendingOnlyItems.length > 0 && (
        <div className="panel pending-panel">
          <h3 style={{ marginTop: 0, color: SYNC_STATUS_COLORS.PENDING }}>
            ⟳ 待同步队列 ({pendingOnlyItems.length})
          </h3>
          <div className="pending-list">
            {pendingOnlyItems.map((item) => {
              const entityType: EntityType =
                "sampleNumber" in item ? "SAMPLE" : "BATCH";
              const label = getItemLabel(
                entityType,
                ("sampleNumber" in item ? item : (item as unknown as SampleBatch)).id
              );
              return (
                <div key={(item as { id: string }).id} className="pending-item">
                  <SyncStatusBadge status="PENDING" />
                  <span className="conflict-entity-type">
                    {entityType === "SAMPLE" ? "🧪 样本" : "📦 批次"}
                  </span>
                  <strong>{label}</strong>
                  <span className="pending-time">
                    最后修改: {formatDateTime(item.syncMeta.lastModifiedAt)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pendingOps.length > 0 && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>📋 操作队列详情 ({pendingOps.length})</h3>
          <div className="ops-queue-list">
            {pendingOps.slice(0, 30).map((op) => (
              <div key={op.id} className="ops-queue-item">
                <span className={`op-type-tag op-${op.operationType.toLowerCase()}`}>
                  {op.operationType === "CREATE"
                    ? "创建"
                    : op.operationType === "UPDATE"
                    ? "修改"
                    : "删除"}
                </span>
                <span>{getItemLabel(op.entityType, op.entityId)}</span>
                <span className="ops-time">{formatDateTime(op.createdAt)}</span>
                {op.retryCount > 0 && (
                  <span className="retry-count">重试 {op.retryCount} 次</span>
                )}
              </div>
            ))}
            {pendingOps.length > 30 && (
              <p style={{ color: "#94a3b8", textAlign: "center", padding: 8 }}>
                ...还有 {pendingOps.length - 30} 条操作
              </p>
            )}
          </div>
        </div>
      )}

      {pendingItems.length === 0 && pendingOps.length === 0 && (
        <div className="empty-state large">
          <div className="empty-icon">✅</div>
          <h3>全部已同步</h3>
          <p>所有本地变更都已成功同步到服务端</p>
        </div>
      )}
    </div>
  );
}
