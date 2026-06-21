import { useState, useEffect } from "react";
import {
  Sample,
  formatDateTime,
  updateSample,
} from "./batchStorage";

interface SampleDetailProps {
  sample: Sample;
  onBack: () => void;
  onSave: (updatedSample: Sample) => void;
}

const DEVELOPMENT_STAGES = [
  "卵",
  "幼虫一龄",
  "幼虫二龄",
  "幼虫三龄",
  "蛹",
  "成虫",
];

const PRESERVATION_METHODS = [
  "乙醇保存",
  "福尔马林保存",
  "冷冻保存",
  "干制标本",
  "活体饲养",
  "其他",
];

export default function SampleDetail({ sample, onBack, onSave }: SampleDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Sample>(sample);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setFormData(sample);
    setHasChanges(false);
  }, [sample]);

  useEffect(() => {
    const changed = Object.keys(formData).some(
      (key) =>
        formData[key as keyof Sample] !== sample[key as keyof Sample]
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
    onSave(formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData(sample);
    setIsEditing(false);
    setHasChanges(false);
  };

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
    <div className="sample-detail">
      <div className="detail-header">
        <button className="back-button" onClick={onBack}>
          ← 返回
        </button>
        <div className="detail-actions">
          {isEditing ? (
            <>
              <button className="secondary" onClick={handleCancel}>
                取消
              </button>
              <button
                className="primary"
                onClick={handleSave}
                disabled={!hasChanges}
              >
                保存修改
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
          <p className="detail-badge">样本详情</p>
          <h1 className="detail-title">
            {isEditing ? (
              <input
                type="text"
                className="title-input"
                value={formData.sampleNumber}
                onChange={(e) => handleChange("sampleNumber", e.target.value)}
                placeholder="样本编号"
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
          </p>
        </div>
      </div>

      <div className="detail-content">
        <div className="detail-grid">
          <InfoItem
            label="昆虫种类"
            value={formData.insectSpecies}
            field="insectSpecies"
          />
          <InfoItem
            label="发育阶段"
            value={formData.developmentStage}
            field="developmentStage"
            type="select"
            options={DEVELOPMENT_STAGES}
          />
          <InfoItem
            label="采样地点"
            value={formData.samplingLocation}
            field="samplingLocation"
          />
          <InfoItem
            label="环境温度"
            value={formData.environmentTemperature}
            field="environmentTemperature"
          />
          <InfoItem
            label="保存方式"
            value={formData.preservationMethod}
            field="preservationMethod"
            type="select"
            options={PRESERVATION_METHODS}
          />
          <InfoItem
            label="关联案件"
            value={formData.relatedCase}
            field="relatedCase"
          />
        </div>

        <div className="detail-section">
          <h3 className="section-title">鉴定备注</h3>
          <InfoItem
            label=""
            value={formData.identificationNotes}
            field="identificationNotes"
            type="textarea"
          />
        </div>
      </div>
    </div>
  );
}
