import { useState, useEffect } from "react";
import {
  SampleBatch,
  formatDateTime,
  getBatchSummary,
  EXPOSURE_STAGES,
} from "./batchStorage";

interface BatchListProps {
  batches: SampleBatch[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<SampleBatch>) => void;
}

interface BatchFormState {
  caseNumber: string;
  samplingLocation: string;
  samplingTime: string;
  environmentTemperature: string;
  exposureStage: string;
  fieldNotes: string;
}

function toLocalInputValue(isoString: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getInitialFormState(batch: SampleBatch): BatchFormState {
  return {
    caseNumber: batch.caseNumber,
    samplingLocation: batch.samplingLocation,
    samplingTime: toLocalInputValue(batch.samplingTime),
    environmentTemperature: batch.environmentTemperature,
    exposureStage: batch.exposureStage,
    fieldNotes: batch.fieldNotes,
  };
}

function hasFormChanged(
  formState: BatchFormState,
  batch: SampleBatch
): boolean {
  return (
    formState.caseNumber.trim() !== batch.caseNumber ||
    formState.samplingLocation.trim() !== batch.samplingLocation ||
    formState.samplingTime !== toLocalInputValue(batch.samplingTime) ||
    formState.environmentTemperature.trim() !== batch.environmentTemperature ||
    formState.exposureStage !== batch.exposureStage ||
    formState.fieldNotes.trim() !== batch.fieldNotes
  );
}

export default function BatchList({
  batches,
  onDelete,
  onUpdate,
}: BatchListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<BatchFormState | null>(null);

  useEffect(() => {
    if (editingId && formState === null) {
      const batch = batches.find((b) => b.id === editingId);
      if (batch) {
        setFormState(getInitialFormState(batch));
      }
    }
  }, [editingId, formState, batches]);

  const handleStartEdit = (batch: SampleBatch) => {
    setEditingId(batch.id);
    setFormState(getInitialFormState(batch));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormState(null);
  };

  const handleFormChange = (field: keyof BatchFormState, value: string) => {
    setFormState((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSaveEdit = (batch: SampleBatch) => {
    if (!formState) return;
    if (!formState.caseNumber.trim()) {
      alert("案件编号不能为空");
      return;
    }
    const updates: Partial<SampleBatch> = {};
    if (formState.caseNumber.trim() !== batch.caseNumber) {
      updates.caseNumber = formState.caseNumber.trim();
    }
    if (formState.samplingLocation.trim() !== batch.samplingLocation) {
      updates.samplingLocation = formState.samplingLocation.trim();
    }
    const newSamplingTimeIso = formState.samplingTime
      ? new Date(formState.samplingTime).toISOString()
      : "";
    if (newSamplingTimeIso !== batch.samplingTime) {
      updates.samplingTime = newSamplingTimeIso;
    }
    if (
      formState.environmentTemperature.trim() !== batch.environmentTemperature
    ) {
      updates.environmentTemperature =
        formState.environmentTemperature.trim();
    }
    if (formState.exposureStage !== batch.exposureStage) {
      updates.exposureStage = formState.exposureStage;
    }
    if (formState.fieldNotes.trim() !== batch.fieldNotes) {
      updates.fieldNotes = formState.fieldNotes.trim();
    }
    if (Object.keys(updates).length === 0) {
      setEditingId(null);
      setFormState(null);
      return;
    }
    onUpdate(batch.id, updates);
    setEditingId(null);
    setFormState(null);
  };

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>批次列表</p>
          <h2>所有样本批次 ({batches.length})</h2>
        </div>
        <button className="ghost-button" disabled={batches.length === 0}>
          导出批次
        </button>
      </div>

      {batches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>暂无批次记录</h3>
          <p>使用上方表单创建第一个样本批次开始记录</p>
        </div>
      ) : (
        <div className="batch-list">
          {batches.map((batch, index) => {
            const isEditing = editingId === batch.id;
            const currentForm = isEditing ? formState : null;
            const changed =
              isEditing && currentForm
                ? hasFormChanged(currentForm, batch)
                : false;

            return (
              <article
                key={batch.id}
                className={`batch-card ${isEditing ? "editing" : ""}`}
              >
                <div className="batch-card-header">
                  <b className="batch-index">
                    {String(index + 1).padStart(2, "0")}
                  </b>
                  <div className="batch-title">
                    {isEditing && currentForm ? (
                      <input
                        type="text"
                        className="batch-edit-title-input"
                        value={currentForm.caseNumber}
                        onChange={(e) =>
                          handleFormChange("caseNumber", e.target.value)
                        }
                        placeholder="案件编号"
                      />
                    ) : (
                      <>
                        <h3>{batch.caseNumber}</h3>
                        {batch.samplingLocation && !isEditing && (
                          <p className="batch-location">
                            📍 {batch.samplingLocation}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <div className="batch-card-actions">
                    {isEditing ? (
                      <>
                        <button
                          className="secondary small"
                          onClick={handleCancelEdit}
                          title="取消编辑"
                        >
                          取消
                        </button>
                        <button
                          className="primary small"
                          onClick={() => handleSaveEdit(batch)}
                          disabled={!changed}
                          title="保存修改"
                        >
                          保存
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="edit-button"
                          onClick={() => handleStartEdit(batch)}
                          title="编辑批次"
                        >
                          ✏️
                        </button>
                        <button
                          className="delete-button"
                          onClick={() => {
                            if (
                              confirm(
                                `确定要删除批次「${batch.caseNumber}」吗？`
                              )
                            ) {
                              onDelete(batch.id);
                            }
                          }}
                          title="删除批次"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isEditing && currentForm ? (
                  <div className="batch-edit-form">
                    <div className="field-grid">
                      <label>
                        <span>案件编号 *</span>
                        <input
                          type="text"
                          value={currentForm.caseNumber}
                          onChange={(e) =>
                            handleFormChange("caseNumber", e.target.value)
                          }
                          placeholder="如：CASE-2026-001"
                        />
                      </label>
                      <label>
                        <span>采样地点</span>
                        <input
                          type="text"
                          value={currentForm.samplingLocation}
                          onChange={(e) =>
                            handleFormChange("samplingLocation", e.target.value)
                          }
                          placeholder="如：室外草地、阴影区域"
                        />
                      </label>
                      <label>
                        <span>采样时间</span>
                        <input
                          type="datetime-local"
                          value={currentForm.samplingTime}
                          onChange={(e) =>
                            handleFormChange("samplingTime", e.target.value)
                          }
                        />
                      </label>
                      <label>
                        <span>环境温度 (℃)</span>
                        <input
                          type="number"
                          step="0.1"
                          min="-50"
                          max="60"
                          value={currentForm.environmentTemperature}
                          onChange={(e) =>
                            handleFormChange(
                              "environmentTemperature",
                              e.target.value
                            )
                          }
                          placeholder="如：28.6"
                        />
                      </label>
                      <label>
                        <span>暴露阶段</span>
                        <select
                          value={currentForm.exposureStage}
                          onChange={(e) =>
                            handleFormChange("exposureStage", e.target.value)
                          }
                          className="select-field"
                        >
                          <option value="">请选择暴露阶段</option>
                          {EXPOSURE_STAGES.map((stage) => (
                            <option key={stage} value={stage}>
                              {stage}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="full-width">
                        <span>现场备注</span>
                        <textarea
                          value={currentForm.fieldNotes}
                          onChange={(e) =>
                            handleFormChange("fieldNotes", e.target.value)
                          }
                          placeholder="记录现场特殊情况、观察发现等..."
                          rows={3}
                          className="textarea-field"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="batch-summary-row">
                      <div className="summary-tag">
                        <span className="tag-label">摘要</span>
                        <span className="tag-value">
                          {getBatchSummary(batch)}
                        </span>
                      </div>
                    </div>

                    <div className="batch-meta">
                      <div className="meta-item">
                        <span className="meta-icon">🧪</span>
                        <span className="meta-label">样本数量</span>
                        <span className="meta-value sample-count-badge">
                          {batch.sampleCount > 0
                            ? `${batch.sampleCount} 个`
                            : "待添加"}
                        </span>
                      </div>
                      {batch.samplingTime && (
                        <div className="meta-item">
                          <span className="meta-icon">🕐</span>
                          <span className="meta-label">采样时间</span>
                          <span className="meta-value">
                            {formatDateTime(batch.samplingTime)}
                          </span>
                        </div>
                      )}
                      <div className="meta-item updated">
                        <span className="meta-icon">✏️</span>
                        <span className="meta-label">最近更新</span>
                        <span className="meta-value">
                          {formatDateTime(batch.updatedAt)}
                        </span>
                      </div>
                    </div>

                    {batch.fieldNotes && (
                      <div className="batch-notes">
                        <strong>现场备注：</strong>
                        <span>{batch.fieldNotes}</span>
                      </div>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
