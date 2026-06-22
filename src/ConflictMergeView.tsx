import { useState, useEffect, useMemo } from "react";
import {
  DEVELOPMENT_STAGES,
  PRESERVATION_METHODS,
  EXPOSURE_STAGES,
  COLLECTION_METHODS,
  WEATHER_CONDITIONS,
  formatDateTime,
} from "./batchStorage";
import {
  EntityType,
  ConflictFieldDiff,
  ConflictFieldResolution,
  ConflictResolution,
  computeFieldDiffs,
  getFieldLabel,
  resolveConflictWithMerge,
  buildResolvedDataFromFieldChoices,
} from "./offlineSync";

const SELECT_OPTIONS: Record<string, string[]> = {
  developmentStage: DEVELOPMENT_STAGES,
  preservationMethod: PRESERVATION_METHODS,
  exposureStage: EXPOSURE_STAGES,
  insectCollectionMethod: COLLECTION_METHODS,
  weatherCondition: WEATHER_CONDITIONS,
};

const TEXT_FIELD_TYPES: Record<string, "text" | "textarea" | "number" | "datetime-local" | "select"> = {
  sampleNumber: "text",
  insectSpecies: "text",
  developmentStage: "select",
  preservationMethod: "select",
  identificationNotes: "textarea",
  relatedCase: "text",
  samplingLocation: "text",
  environmentTemperature: "number",
  environmentHumidity: "number",
  weatherCondition: "select",
  exposureStage: "select",
  exposureNotes: "textarea",
  insectCount: "text",
  insectCollectionMethod: "select",
  preservationSolution: "text",
  storageTemperature: "number",
  caseNumber: "text",
  samplingTime: "datetime-local",
  fieldNotes: "textarea",
  sampleCount: "number",
};

interface ConflictMergeViewProps {
  entityType: EntityType;
  entityId: string;
  entityLabel: string;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  onBack: () => void;
  onResolved: () => void;
  syncError?: string;
}

export default function ConflictMergeView({
  entityType,
  entityId,
  entityLabel,
  localData,
  serverData,
  onBack,
  onResolved,
  syncError,
}: ConflictMergeViewProps) {
  const fieldDiffs = useMemo(
    () => computeFieldDiffs(entityType, localData, serverData),
    [entityType, localData, serverData]
  );

  const conflictFields = useMemo(
    () => fieldDiffs.filter((f) => f.isConflict),
    [fieldDiffs]
  );

  const allFields = useMemo(
    () => fieldDiffs,
    [fieldDiffs]
  );

  const [resolutions, setResolutions] = useState<Map<string, ConflictFieldResolution>>(
    () => {
      const m = new Map<string, ConflictFieldResolution>();
      for (const f of conflictFields) {
        m.set(f.fieldName, {
          fieldName: f.fieldName,
          strategy: "USE_LOCAL",
        });
      }
      return m;
    }
  );

  const [showOnlyConflicts, setShowOnlyConflicts] = useState(true);
  const [manualField, setManualField] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayFields = showOnlyConflicts ? conflictFields : allFields;

  const resolvedCount = resolutions.size;
  const totalConflictCount = conflictFields.length;
  const unresolvedCount = totalConflictCount - resolvedCount;

  const setFieldStrategy = (fieldName: string, strategy: ConflictFieldResolution["strategy"]) => {
    setResolutions((prev) => {
      const next = new Map(prev);
      const existing = next.get(fieldName);
      next.set(fieldName, {
        fieldName,
        strategy,
        manualValue: strategy === "MANUAL" ? existing?.manualValue : undefined,
      });
      return next;
    });
    if (strategy !== "MANUAL") {
      if (manualField === fieldName) {
        setManualField(null);
        setManualValue("");
      }
    }
  };

  const openManualEdit = (fieldName: string) => {
    const existing = resolutions.get(fieldName);
    const currentVal =
      existing?.strategy === "MANUAL" && existing.manualValue !== undefined
        ? String(existing.manualValue)
        : String(localData[fieldName] ?? "");
    setManualField(fieldName);
    setManualValue(currentVal);
    setFieldStrategy(fieldName, "MANUAL");
  };

  const confirmManualValue = () => {
    if (!manualField) return;
    setResolutions((prev) => {
      const next = new Map(prev);
      next.set(manualField, {
        fieldName: manualField,
        strategy: "MANUAL",
        manualValue: manualValue,
      });
      return next;
    });
    setManualField(null);
    setManualValue("");
  };

  const cancelManualEdit = () => {
    setManualField(null);
    setManualValue("");
  };

  const applyAllStrategy = (strategy: "USE_LOCAL" | "USE_SERVER") => {
    setResolutions(() => {
      const m = new Map<string, ConflictFieldResolution>();
      for (const f of conflictFields) {
        m.set(f.fieldName, {
          fieldName: f.fieldName,
          strategy,
        });
      }
      return m;
    });
    setManualField(null);
    setManualValue("");
  };

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined || val === "") return "—";
    if (typeof val === "string") {
      if (val.includes("T") && !isNaN(Date.parse(val))) {
        try {
          return formatDateTime(val);
        } catch {
          return val;
        }
      }
      return val;
    }
    return JSON.stringify(val);
  };

  const getResolutionStrategy = (fieldName: string): ConflictFieldResolution["strategy"] | null => {
    const r = resolutions.get(fieldName);
    return r ? r.strategy : null;
  };

  const getResolvedDisplay = (diff: ConflictFieldDiff): string => {
    const r = resolutions.get(diff.fieldName);
    if (!r) return "—";
    if (r.strategy === "USE_LOCAL") return formatValue(diff.localValue);
    if (r.strategy === "USE_SERVER") return formatValue(diff.serverValue);
    if (r.strategy === "MANUAL" && r.manualValue !== undefined) {
      return formatValue(r.manualValue);
    }
    return "—";
  };

  const handleConfirmResolve = async () => {
    if (isSubmitting) return;
    if (manualField) {
      alert("请先确认或取消当前字段的手动编辑");
      return;
    }

    const fieldResolutions = Array.from(resolutions.values());
    const resolvedData = buildResolvedDataFromFieldChoices(
      entityType,
      entityId,
      localData,
      serverData,
      fieldResolutions
    );

    const allManualResolved = fieldResolutions.every(
      (fr) => fr.strategy !== "MANUAL" || fr.manualValue !== undefined
    );
    if (!allManualResolved) {
      alert("存在手动合并字段未填写值，请完成所有字段的处理");
      return;
    }

    const hasLocalChoice = fieldResolutions.some((f) => f.strategy === "USE_LOCAL");
    const hasServerChoice = fieldResolutions.some((f) => f.strategy === "USE_SERVER");
    const hasManual = fieldResolutions.some((f) => f.strategy === "MANUAL");

    let overallStrategy: ConflictResolution["overallStrategy"];
    if (hasManual || (hasLocalChoice && hasServerChoice)) {
      overallStrategy = "FIELD_BY_FIELD";
    } else if (hasServerChoice) {
      overallStrategy = "USE_SERVER";
    } else {
      overallStrategy = "USE_LOCAL";
    }

    const resolution: ConflictResolution = {
      entityType,
      entityId,
      overallStrategy,
      fieldResolutions,
      resolvedData,
      localData,
      serverData,
    };

    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    const success = resolveConflictWithMerge(resolution);
    setIsSubmitting(false);

    if (success) {
      onResolved();
    } else {
      alert("冲突解决失败，请重试");
    }
  };

  const renderManualEditor = (diff: ConflictFieldDiff) => {
    const fieldType = TEXT_FIELD_TYPES[diff.fieldName] || "text";
    const options = SELECT_OPTIONS[diff.fieldName];

    if (fieldType === "textarea") {
      return (
        <div className="manual-edit-box">
          <textarea
            className="manual-textarea"
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            rows={4}
            placeholder="请输入手动合并后的值..."
            autoFocus
          />
          <div className="manual-edit-actions">
            <button className="secondary small" onClick={cancelManualEdit}>
              取消
            </button>
            <button className="primary small" onClick={confirmManualValue}>
              ✓ 确认
            </button>
          </div>
        </div>
      );
    }

    if (fieldType === "select" && options) {
      return (
        <div className="manual-edit-box">
          <select
            className="manual-select"
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            autoFocus
          >
            <option value="">请选择</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <div className="manual-edit-actions">
            <button className="secondary small" onClick={cancelManualEdit}>
              取消
            </button>
            <button className="primary small" onClick={confirmManualValue}>
              ✓ 确认
            </button>
          </div>
        </div>
      );
    }

    if (fieldType === "datetime-local") {
      const isoVal = typeof manualValue === "string" && manualValue.includes("T")
        ? manualValue.slice(0, 16)
        : manualValue;
      return (
        <div className="manual-edit-box">
          <input
            type="datetime-local"
            className="manual-input"
            value={isoVal}
            onChange={(e) => setManualValue(e.target.value)}
            autoFocus
          />
          <div className="manual-edit-actions">
            <button className="secondary small" onClick={cancelManualEdit}>
              取消
            </button>
            <button
              className="primary small"
              onClick={() => {
                if (manualValue) {
                  const dt = new Date(manualValue);
                  if (!isNaN(dt.getTime())) {
                    setManualValue(dt.toISOString());
                  }
                }
                confirmManualValue();
              }}
            >
              ✓ 确认
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="manual-edit-box">
        <input
          type={fieldType}
          className="manual-input"
          value={manualValue}
          onChange={(e) => setManualValue(e.target.value)}
          placeholder="请输入手动合并后的值..."
          autoFocus
          step={fieldType === "number" ? "0.1" : undefined}
        />
        <div className="manual-edit-actions">
          <button className="secondary small" onClick={cancelManualEdit}>
            取消
          </button>
          <button className="primary small" onClick={confirmManualValue}>
            ✓ 确认
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="workbench-content conflict-merge-view">
      <div className="content-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="back-button" onClick={onBack}>
            ← 返回同步中心
          </button>
          <div>
            <h2 className="content-title" style={{ color: "#dc2626" }}>
              ⚠ 冲突合并视图
            </h2>
            <p className="content-desc">
              {entityType === "SAMPLE" ? "🧪 样本" : "📦 批次"} · <strong>{entityLabel}</strong>
              {syncError && (
                <span style={{ color: "#dc2626", marginLeft: 8 }}>
                  · {syncError}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="panel merge-summary-panel">
        <div className="merge-stats-bar">
          <div className="merge-stat">
            <span className="merge-stat-label">总字段</span>
            <span className="merge-stat-num">{allFields.length}</span>
          </div>
          <div className="merge-stat" style={{ color: "#dc2626" }}>
            <span className="merge-stat-label">冲突字段</span>
            <span className="merge-stat-num">{totalConflictCount}</span>
          </div>
          <div className="merge-stat" style={{ color: "#059669" }}>
            <span className="merge-stat-label">已处理</span>
            <span className="merge-stat-num">{resolvedCount}</span>
          </div>
          {unresolvedCount > 0 && (
            <div className="merge-stat" style={{ color: "#d97706" }}>
              <span className="merge-stat-label">待处理</span>
              <span className="merge-stat-num">{unresolvedCount}</span>
            </div>
          )}
        </div>

        <div className="merge-quick-actions">
          <span className="quick-label">快速操作：</span>
          <button
            className="secondary"
            onClick={() => applyAllStrategy("USE_LOCAL")}
            disabled={totalConflictCount === 0}
          >
            📱 全部保留本地
          </button>
          <button
            className="secondary"
            onClick={() => applyAllStrategy("USE_SERVER")}
            disabled={totalConflictCount === 0}
          >
            ☁️ 全部采用服务端
          </button>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={showOnlyConflicts}
              onChange={(e) => setShowOnlyConflicts(e.target.checked)}
            />
            只显示冲突字段
          </label>
        </div>
      </div>

      {totalConflictCount === 0 ? (
        <div className="empty-state large">
          <div className="empty-icon">✅</div>
          <h3>无字段冲突</h3>
          <p>本地和服务端数据完全一致，无需合并</p>
          <button className="primary" onClick={onBack}>
            返回同步中心
          </button>
        </div>
      ) : (
        <div className="merge-fields-list">
          {displayFields.map((diff, idx) => {
            const strategy = getResolutionStrategy(diff.fieldName);
            const isManualEditing = manualField === diff.fieldName;
            const rowStatus = !diff.isConflict
              ? "same"
              : strategy === null
              ? "unresolved"
              : strategy;

            return (
              <div
                key={diff.fieldName}
                className={`merge-field-row row-${rowStatus}`}
              >
                <div className="field-index">{String(idx + 1).padStart(2, "0")}</div>

                <div className="field-name-col">
                  <div className="field-name">{diff.label}</div>
                  <div className="field-key-hint">{diff.fieldName}</div>
                  {!diff.isConflict && (
                    <span className="field-badge badge-same">✓ 一致</span>
                  )}
                  {diff.isConflict && (
                    <>
                      {strategy === "USE_LOCAL" && (
                        <span className="field-badge badge-local">📱 保留本地</span>
                      )}
                      {strategy === "USE_SERVER" && (
                        <span className="field-badge badge-server">☁️ 采用服务端</span>
                      )}
                      {strategy === "MANUAL" && (
                        <span className="field-badge badge-manual">✏️ 手动合并</span>
                      )}
                      {strategy === null && (
                        <span className="field-badge badge-unresolved">⚠ 待处理</span>
                      )}
                    </>
                  )}
                </div>

                <div
                  className={`value-col value-local ${
                    strategy === "USE_LOCAL" ? "selected" : ""
                  }`}
                >
                  <div className="value-header">
                    <span className="value-source-icon">📱</span>
                    <span className="value-source-label">本地版本</span>
                    {diff.isConflict && strategy === "USE_LOCAL" && (
                      <span className="value-selected-mark">✓ 已选</span>
                    )}
                  </div>
                  <div className="value-content">{formatValue(diff.localValue)}</div>
                  {diff.isConflict && (
                    <div className="value-actions">
                      <button
                        className={`choice-btn local-btn ${
                          strategy === "USE_LOCAL" ? "active" : ""
                        }`}
                        onClick={() => setFieldStrategy(diff.fieldName, "USE_LOCAL")}
                      >
                        ✓ 保留此值
                      </button>
                    </div>
                  )}
                </div>

                <div className="vs-divider">
                  <span>VS</span>
                </div>

                <div
                  className={`value-col value-server ${
                    strategy === "USE_SERVER" ? "selected" : ""
                  }`}
                >
                  <div className="value-header">
                    <span className="value-source-icon">☁️</span>
                    <span className="value-source-label">服务端版本</span>
                    {diff.isConflict && strategy === "USE_SERVER" && (
                      <span className="value-selected-mark">✓ 已选</span>
                    )}
                  </div>
                  <div className="value-content">{formatValue(diff.serverValue)}</div>
                  {diff.isConflict && (
                    <div className="value-actions">
                      <button
                        className={`choice-btn server-btn ${
                          strategy === "USE_SERVER" ? "active" : ""
                        }`}
                        onClick={() => setFieldStrategy(diff.fieldName, "USE_SERVER")}
                      >
                        ✓ 采用此值
                      </button>
                    </div>
                  )}
                </div>

                <div className="value-col value-merged">
                  <div className="value-header">
                    <span className="value-source-icon">🔀</span>
                    <span className="value-source-label">合并结果</span>
                  </div>
                  <div className="value-content merged-content">
                    {getResolvedDisplay(diff)}
                  </div>
                  {diff.isConflict && (
                    <div className="value-actions">
                      <button
                        className={`choice-btn manual-btn ${
                          strategy === "MANUAL" || isManualEditing ? "active" : ""
                        }`}
                        onClick={() => openManualEdit(diff.fieldName)}
                        disabled={isManualEditing}
                      >
                        ✏️ 手动输入
                      </button>
                    </div>
                  )}
                  {isManualEditing && renderManualEditor(diff)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalConflictCount > 0 && (
        <div className="merge-footer-panel">
          <div className="merge-footer-left">
            <div className="progress-hint">
              处理进度：
              <strong
                style={{
                  color:
                    unresolvedCount === 0 ? "#059669" : "#d97706",
                }}
              >
                {resolvedCount} / {totalConflictCount}
              </strong>{" "}
              个冲突字段
              {unresolvedCount === 0 ? "（全部完成 ✓）" : `（还有 ${unresolvedCount} 个待处理）`}
            </div>
          </div>
          <div className="merge-footer-right">
            <button className="secondary" onClick={onBack} disabled={isSubmitting}>
              稍后处理
            </button>
            <button
              className="primary large"
              onClick={handleConfirmResolve}
              disabled={isSubmitting || unresolvedCount > 0}
            >
              {isSubmitting
                ? "🔄 正在应用合并结果..."
                : unresolvedCount > 0
                ? `还有 ${unresolvedCount} 个字段未处理`
                : "✓ 确认并完成合并"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
