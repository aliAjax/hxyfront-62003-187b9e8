import { useState, useEffect, useCallback } from "react";
import {
  Sample,
  SampleFormDraft,
  generateSampleId,
  generateStatusHistoryId,
  upsertDraft,
  deleteDraft,
  createEmptyDraft,
  loadDrafts,
  EXPOSURE_STAGES,
  DEVELOPMENT_STAGES,
  PRESERVATION_METHODS,
  WEATHER_CONDITIONS,
  COLLECTION_METHODS,
  WIZARD_STEPS,
  REQUIRED_FIELDS,
  getMissingFields,
  formatDateTime,
} from "./batchStorage";

interface SampleFormWizardProps {
  onBack: () => void;
  onSubmit: (sample: Sample) => void;
  existingCaseNumbers: string[];
  initialDraft?: SampleFormDraft;
}

export default function SampleFormWizard({
  onBack,
  onSubmit,
  existingCaseNumbers,
  initialDraft,
}: SampleFormWizardProps) {
  const [draft, setDraft] = useState<SampleFormDraft>(
    initialDraft || createEmptyDraft()
  );
  const [currentStep, setCurrentStep] = useState<number>(
    initialDraft?.currentStep || 0
  );
  const [drafts, setDrafts] = useState<SampleFormDraft[]>([]);
  const [showDraftList, setShowDraftList] = useState<boolean>(!initialDraft);
  const [saveFeedback, setSaveFeedback] = useState<string>("");

  useEffect(() => {
    setDrafts(loadDrafts());
  }, []);

  const updateField = useCallback(
    (field: keyof SampleFormDraft, value: string) => {
      setDraft((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSaveDraft = useCallback(() => {
    const toSave = { ...draft, currentStep };
    const updated = upsertDraft(toSave);
    setDrafts(updated);
    setSaveFeedback("草稿已保存");
    setTimeout(() => setSaveFeedback(""), 2000);
  }, [draft, currentStep]);

  const handleLoadDraft = (d: SampleFormDraft) => {
    setDraft(d);
    setCurrentStep(d.currentStep);
    setShowDraftList(false);
  };

  const handleDeleteDraft = (draftId: string) => {
    if (!confirm("确定要删除这个草稿吗？")) return;
    const updated = deleteDraft(draftId);
    setDrafts(updated);
  };

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleGoToStep = (index: number) => {
    if (index >= 0 && index < WIZARD_STEPS.length) {
      setCurrentStep(index);
    }
  };

  const handleSubmit = () => {
    const missing = getMissingFields(draft);
    if (missing.length > 0) {
      alert(
        `以下必填项未填写：\n${missing.join("、")}\n请返回补充后再提交。`
      );
      const firstMissing = REQUIRED_FIELDS.find(
        (f) => !draft[f.key]?.trim()
      );
      if (firstMissing) {
        const stepMap: Record<string, number> = {
          sampleNumber: 0,
          samplingLocation: 0,
          exposureStage: 2,
          developmentStage: 3,
          preservationMethod: 4,
        };
        const targetStep = stepMap[firstMissing.key as string];
        if (targetStep !== undefined) {
          setCurrentStep(targetStep);
        }
      }
      return;
    }

    if (!confirm("确认提交该样本记录？提交后可在详情页继续编辑。")) {
      return;
    }

    const now = new Date().toISOString();
    const newSample: Sample = {
      id: generateSampleId(),
      sampleNumber: draft.sampleNumber.trim(),
      insectSpecies: draft.insectSpecies.trim(),
      developmentStage: draft.developmentStage,
      preservationMethod: draft.preservationMethod,
      identificationNotes: [
        draft.identificationNotes.trim(),
        draft.exposureNotes.trim() ? `暴露备注：${draft.exposureNotes.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      relatedCase: draft.relatedCase.trim(),
      samplingLocation: draft.samplingLocation.trim(),
      environmentTemperature: draft.environmentTemperature.trim(),
      temperatureRecords: [],
      status: "PENDING_IDENTIFICATION",
      statusHistory: [
        {
          id: generateStatusHistoryId(),
          oldStatus: null,
          newStatus: "PENDING_IDENTIFICATION",
          timestamp: now,
          operator: "系统",
          note: "通过表单向导创建样本",
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    onSubmit(newSample);
    deleteDraft(draft.id);
  };

  const handleStartNew = () => {
    setDraft(createEmptyDraft());
    setCurrentStep(0);
    setShowDraftList(false);
  };

  if (showDraftList) {
    return (
      <div className="wizard-page">
        <div className="wizard-header">
          <button className="back-button" onClick={onBack}>
            ← 返回
          </button>
          <h1 className="wizard-title">现场采样记录向导</h1>
          <div style={{ width: 80 }} />
        </div>

        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="heading">
            <div>
              <p>开始填写</p>
              <h2>选择操作</h2>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="primary large" onClick={handleStartNew}>
              ✨ 新建采样记录
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="heading">
            <div>
              <p>继续填写</p>
              <h2>未完成的草稿 ({drafts.length})</h2>
            </div>
          </div>
          {drafts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>暂无草稿</h3>
              <p>新建采样记录后，可以随时保存草稿稍后继续</p>
            </div>
          ) : (
            <div className="draft-list">
              {drafts.map((d) => (
                <div key={d.id} className="draft-card">
                  <div className="draft-card-main">
                    <div className="draft-card-title">
                      {d.sampleNumber || "未命名样本"}
                    </div>
                    <div className="draft-card-meta">
                      <span>
                        进度：{WIZARD_STEPS[d.currentStep]?.title || "第 1 步"}
                      </span>
                      <span>保存于 {formatDateTime(d.savedAt)}</span>
                      {d.samplingLocation && <span>📍 {d.samplingLocation}</span>}
                    </div>
                  </div>
                  <div className="draft-card-actions">
                    <button
                      className="primary"
                      onClick={() => handleLoadDraft(d)}
                    >
                      继续填写
                    </button>
                    <button
                      className="secondary"
                      onClick={() => handleDeleteDraft(d.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const missingFields = getMissingFields(draft);
  const isPreviewStep = currentStep === WIZARD_STEPS.length - 1;

  return (
    <div className="wizard-page">
      <div className="wizard-header">
        <button
          className="back-button"
          onClick={() => {
            if (confirm("返回草稿列表？当前进度不会自动保存。")) {
              setShowDraftList(true);
            }
          }}
        >
          ← 草稿列表
        </button>
        <h1 className="wizard-title">
          现场采样记录 · {WIZARD_STEPS[currentStep].title}
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          {saveFeedback && (
            <span className="wizard-feedback">✓ {saveFeedback}</span>
          )}
          <button className="secondary" onClick={handleSaveDraft}>
            💾 保存草稿
          </button>
        </div>
      </div>

      <div className="wizard-steps">
        {WIZARD_STEPS.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          const isClickable = index <= currentStep || isCompleted;
          return (
            <button
              key={step.key}
              className={`wizard-step ${isActive ? "active" : ""} ${
                isCompleted ? "completed" : ""
              }`}
              onClick={() => isClickable && handleGoToStep(index)}
              disabled={!isClickable}
            >
              <div className="wizard-step-icon">{step.icon}</div>
              <div className="wizard-step-label">{step.title}</div>
              {index < WIZARD_STEPS.length - 1 && (
                <div className="wizard-step-connector" />
              )}
            </button>
          );
        })}
      </div>

      <div className="wizard-content">
        <div className="panel wizard-form-panel">
          {currentStep === 0 && (
            <StepLocation draft={draft} updateField={updateField} />
          )}
          {currentStep === 1 && (
            <StepEnvironment draft={draft} updateField={updateField} />
          )}
          {currentStep === 2 && (
            <StepExposure draft={draft} updateField={updateField} />
          )}
          {currentStep === 3 && (
            <StepInsect draft={draft} updateField={updateField} />
          )}
          {currentStep === 4 && (
            <StepPreservation draft={draft} updateField={updateField} />
          )}
          {currentStep === 5 && (
            <StepNotes
              draft={draft}
              updateField={updateField}
              existingCaseNumbers={existingCaseNumbers}
            />
          )}
          {currentStep === 6 && (
            <StepPreview
              draft={draft}
              missingFields={missingFields}
              onGoToStep={handleGoToStep}
            />
          )}
        </div>

        <div className="wizard-footer">
          <button
            className="secondary"
            onClick={handlePrev}
            disabled={currentStep === 0}
          >
            ← 上一步
          </button>
          <div className="wizard-progress">
            第 {currentStep + 1} / {WIZARD_STEPS.length} 步
          </div>
          {isPreviewStep ? (
            <button
              className="primary large"
              onClick={handleSubmit}
              disabled={missingFields.length > 0}
              style={
                missingFields.length > 0
                  ? { opacity: 0.6, cursor: "not-allowed" }
                  : {}
              }
            >
              {missingFields.length > 0
                ? `还有 ${missingFields.length} 项必填`
                : "✓ 提交样本"}
            </button>
          ) : (
            <button className="primary large" onClick={handleNext}>
              下一步 →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function WizardField({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="wizard-field">
      <span className="wizard-field-label">
        {label}
        {required && <span className="wizard-required"> *</span>}
      </span>
      {children}
      {hint && <span className="wizard-field-hint">{hint}</span>}
    </label>
  );
}

function StepLocation({
  draft,
  updateField,
}: {
  draft: SampleFormDraft;
  updateField: (field: keyof SampleFormDraft, value: string) => void;
}) {
  return (
    <div>
      <div className="wizard-section-header">
        <div className="wizard-section-icon">📍</div>
        <div>
          <h2 className="wizard-section-title">采样地点信息</h2>
          <p className="wizard-section-desc">
            记录样本编号和现场采集的具体位置
          </p>
        </div>
      </div>
      <div className="field-grid">
        <WizardField label="样本编号" required>
          <input
            type="text"
            placeholder="如：CASE-2026-001-A"
            value={draft.sampleNumber}
            onChange={(e) => updateField("sampleNumber", e.target.value)}
            className="select-field"
          />
        </WizardField>
        <WizardField label="采样地点" required hint="如：室外草地、阴影区域">
          <input
            type="text"
            placeholder="请输入详细采样地点"
            value={draft.samplingLocation}
            onChange={(e) => updateField("samplingLocation", e.target.value)}
            className="select-field"
          />
        </WizardField>
      </div>
    </div>
  );
}

function StepEnvironment({
  draft,
  updateField,
}: {
  draft: SampleFormDraft;
  updateField: (field: keyof SampleFormDraft, value: string) => void;
}) {
  return (
    <div>
      <div className="wizard-section-header">
        <div className="wizard-section-icon">🌡️</div>
        <div>
          <h2 className="wizard-section-title">环境条件</h2>
          <p className="wizard-section-desc">
            记录采样时的温度、湿度和天气情况
          </p>
        </div>
      </div>
      <div className="field-grid">
        <WizardField label="环境温度 (℃)" hint="如：28.6">
          <input
            type="number"
            step="0.1"
            min="-50"
            max="60"
            placeholder="请输入温度数值"
            value={draft.environmentTemperature}
            onChange={(e) =>
              updateField("environmentTemperature", e.target.value)
            }
            className="select-field"
          />
        </WizardField>
        <WizardField label="相对湿度 (%)" hint="如：65">
          <input
            type="number"
            min="0"
            max="100"
            placeholder="请输入湿度数值"
            value={draft.environmentHumidity}
            onChange={(e) => updateField("environmentHumidity", e.target.value)}
            className="select-field"
          />
        </WizardField>
        <label className="full-width">
          <span>天气情况</span>
          <select
            value={draft.weatherCondition}
            onChange={(e) => updateField("weatherCondition", e.target.value)}
            className="select-field"
          >
            <option value="">请选择天气情况</option>
            {WEATHER_CONDITIONS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function StepExposure({
  draft,
  updateField,
}: {
  draft: SampleFormDraft;
  updateField: (field: keyof SampleFormDraft, value: string) => void;
}) {
  return (
    <div>
      <div className="wizard-section-header">
        <div className="wizard-section-icon">💀</div>
        <div>
          <h2 className="wizard-section-title">尸体暴露阶段</h2>
          <p className="wizard-section-desc">
            判断并记录尸体当前所处的腐败阶段
          </p>
        </div>
      </div>
      <div className="field-grid">
        <label className="full-width">
          <span>
            暴露阶段 <span className="wizard-required">*</span>
          </span>
          <div className="stage-options">
            {EXPOSURE_STAGES.map((stage) => (
              <button
                key={stage}
                type="button"
                className={`stage-option ${
                  draft.exposureStage === stage ? "selected" : ""
                }`}
                onClick={() => updateField("exposureStage", stage)}
              >
                {stage}
              </button>
            ))}
          </div>
        </label>
        <label className="full-width">
          <span>暴露情况备注</span>
          <textarea
            placeholder="描述尸体状态、周围环境、特殊情况等..."
            rows={4}
            value={draft.exposureNotes}
            onChange={(e) => updateField("exposureNotes", e.target.value)}
            className="textarea-field"
          />
        </label>
      </div>
    </div>
  );
}

function StepInsect({
  draft,
  updateField,
}: {
  draft: SampleFormDraft;
  updateField: (field: keyof SampleFormDraft, value: string) => void;
}) {
  return (
    <div>
      <div className="wizard-section-header">
        <div className="wizard-section-icon">🪰</div>
        <div>
          <h2 className="wizard-section-title">昆虫信息</h2>
          <p className="wizard-section-desc">
            记录采集到的昆虫种类、数量和发育阶段
          </p>
        </div>
      </div>
      <div className="field-grid">
        <WizardField label="昆虫种类">
          <input
            type="text"
            placeholder="如：大头金蝇、丝光绿蝇"
            value={draft.insectSpecies}
            onChange={(e) => updateField("insectSpecies", e.target.value)}
            className="select-field"
          />
        </WizardField>
        <WizardField label="采集数量">
          <input
            type="text"
            placeholder="如：约 50 只、3 只幼虫"
            value={draft.insectCount}
            onChange={(e) => updateField("insectCount", e.target.value)}
            className="select-field"
          />
        </WizardField>
        <label>
          <span>
            发育阶段 <span className="wizard-required">*</span>
          </span>
          <select
            value={draft.developmentStage}
            onChange={(e) => updateField("developmentStage", e.target.value)}
            className="select-field"
          >
            <option value="">请选择发育阶段</option>
            {DEVELOPMENT_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>采集方法</span>
          <select
            value={draft.insectCollectionMethod}
            onChange={(e) =>
              updateField("insectCollectionMethod", e.target.value)
            }
            className="select-field"
          >
            <option value="">请选择采集方法</option>
            {COLLECTION_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function StepPreservation({
  draft,
  updateField,
}: {
  draft: SampleFormDraft;
  updateField: (field: keyof SampleFormDraft, value: string) => void;
}) {
  return (
    <div>
      <div className="wizard-section-header">
        <div className="wizard-section-icon">🧪</div>
        <div>
          <h2 className="wizard-section-title">保存方式</h2>
          <p className="wizard-section-desc">
            选择并记录样本的保存方法和存储条件
          </p>
        </div>
      </div>
      <div className="field-grid">
        <label className="full-width">
          <span>
            保存方式 <span className="wizard-required">*</span>
          </span>
          <div className="stage-options">
            {PRESERVATION_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                className={`stage-option ${
                  draft.preservationMethod === m ? "selected" : ""
                }`}
                onClick={() => updateField("preservationMethod", m)}
              >
                {m}
              </button>
            ))}
          </div>
        </label>
        <WizardField label="保存溶液 / 试剂">
          <input
            type="text"
            placeholder="如：75% 乙醇、KAAD 固定液"
            value={draft.preservationSolution}
            onChange={(e) => updateField("preservationSolution", e.target.value)}
            className="select-field"
          />
        </WizardField>
        <WizardField label="存储温度 (℃)" hint="如：-20、4、室温">
          <input
            type="text"
            placeholder="请输入存储温度"
            value={draft.storageTemperature}
            onChange={(e) => updateField("storageTemperature", e.target.value)}
            className="select-field"
          />
        </WizardField>
      </div>
    </div>
  );
}

function StepNotes({
  draft,
  updateField,
  existingCaseNumbers,
}: {
  draft: SampleFormDraft;
  updateField: (field: keyof SampleFormDraft, value: string) => void;
  existingCaseNumbers: string[];
}) {
  return (
    <div>
      <div className="wizard-section-header">
        <div className="wizard-section-icon">📝</div>
        <div>
          <h2 className="wizard-section-title">鉴定备注与关联</h2>
          <p className="wizard-section-desc">
            添加备注信息并关联到已有案件（可选）
          </p>
        </div>
      </div>
      <div className="field-grid">
        {existingCaseNumbers.length > 0 && (
          <label>
            <span>关联案件</span>
            <select
              value={draft.relatedCase}
              onChange={(e) => updateField("relatedCase", e.target.value)}
              className="select-field"
            >
              <option value="">不关联（可选）</option>
              {existingCaseNumbers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={existingCaseNumbers.length === 0 ? "full-width" : ""}>
          <span>案件编号（新建或手动输入）</span>
          <input
            type="text"
            placeholder="如：CASE-2026-001，留空则不关联"
            value={draft.relatedCase}
            onChange={(e) => updateField("relatedCase", e.target.value)}
            className="select-field"
          />
        </label>
        <label className="full-width">
          <span>鉴定备注</span>
          <textarea
            placeholder="记录形态观察、鉴定过程、待确认事项等..."
            rows={5}
            value={draft.identificationNotes}
            onChange={(e) => updateField("identificationNotes", e.target.value)}
            className="textarea-field"
          />
        </label>
      </div>
    </div>
  );
}

function StepPreview({
  draft,
  missingFields,
  onGoToStep,
}: {
  draft: SampleFormDraft;
  missingFields: string[];
  onGoToStep: (step: number) => void;
}) {
  const isMissing = (label: string) => missingFields.includes(label);

  const PreviewItem = ({
    label,
    value,
    step,
    required,
  }: {
    label: string;
    value: string;
    step: number;
    required?: boolean;
  }) => (
    <div
      className={`preview-item ${isMissing(label) ? "missing" : ""}`}
      onClick={() => onGoToStep(step)}
    >
      <div className="preview-item-label">
        {label}
        {required && <span className="wizard-required"> *</span>}
        {isMissing(label) && (
          <span className="preview-missing-tag">缺失</span>
        )}
      </div>
      <div className="preview-item-value">{value || "— 未填写 —"}</div>
    </div>
  );

  return (
    <div className="preview-content">
      <div className="wizard-section-header">
        <div className="wizard-section-icon">✅</div>
        <div>
          <h2 className="wizard-section-title">完整预览</h2>
          <p className="wizard-section-desc">
            请核对所有信息，缺失项以红色标出，点击可跳转至对应步骤
          </p>
        </div>
      </div>

      {missingFields.length > 0 && (
        <div className="preview-warning">
          ⚠️ 还有 {missingFields.length} 项必填字段未填写：
          <strong>{missingFields.join("、")}</strong>
        </div>
      )}

      <div className="preview-section">
        <h3 className="preview-section-title">📍 采样地点</h3>
        <div className="preview-grid">
          <PreviewItem
            label="样本编号"
            value={draft.sampleNumber}
            step={0}
            required
          />
          <PreviewItem
            label="采样地点"
            value={draft.samplingLocation}
            step={0}
            required
          />
        </div>
      </div>

      <div className="preview-section">
        <h3 className="preview-section-title">🌡️ 环境条件</h3>
        <div className="preview-grid">
          <PreviewItem
            label="环境温度"
            value={draft.environmentTemperature ? `${draft.environmentTemperature}℃` : ""}
            step={1}
          />
          <PreviewItem
            label="相对湿度"
            value={draft.environmentHumidity ? `${draft.environmentHumidity}%` : ""}
            step={1}
          />
          <PreviewItem
            label="天气情况"
            value={draft.weatherCondition}
            step={1}
          />
        </div>
      </div>

      <div className="preview-section">
        <h3 className="preview-section-title">💀 尸体暴露阶段</h3>
        <div className="preview-grid">
          <PreviewItem
            label="暴露阶段"
            value={draft.exposureStage}
            step={2}
            required
          />
          <PreviewItem
            label="暴露情况备注"
            value={draft.exposureNotes}
            step={2}
          />
        </div>
      </div>

      <div className="preview-section">
        <h3 className="preview-section-title">🪰 昆虫信息</h3>
        <div className="preview-grid">
          <PreviewItem label="昆虫种类" value={draft.insectSpecies} step={3} />
          <PreviewItem label="采集数量" value={draft.insectCount} step={3} />
          <PreviewItem
            label="发育阶段"
            value={draft.developmentStage}
            step={3}
            required
          />
          <PreviewItem
            label="采集方法"
            value={draft.insectCollectionMethod}
            step={3}
          />
        </div>
      </div>

      <div className="preview-section">
        <h3 className="preview-section-title">🧪 保存方式</h3>
        <div className="preview-grid">
          <PreviewItem
            label="保存方式"
            value={draft.preservationMethod}
            step={4}
            required
          />
          <PreviewItem
            label="保存溶液 / 试剂"
            value={draft.preservationSolution}
            step={4}
          />
          <PreviewItem
            label="存储温度"
            value={draft.storageTemperature ? `${draft.storageTemperature}℃` : ""}
            step={4}
          />
        </div>
      </div>

      <div className="preview-section">
        <h3 className="preview-section-title">📝 鉴定备注</h3>
        <div className="preview-grid">
          <PreviewItem label="关联案件" value={draft.relatedCase} step={5} />
          <PreviewItem
            label="鉴定备注"
            value={draft.identificationNotes}
            step={5}
          />
        </div>
      </div>
    </div>
  );
}
