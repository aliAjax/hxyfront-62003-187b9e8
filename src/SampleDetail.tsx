import { useState, useEffect, useCallback } from "react";
import {
  Sample,
  TemperatureRecord,
  formatDateTime,
  generateTemperatureRecordId,
  getSortedTemperatureRecords,
  isAbnormalTemperature,
  getSamplesByCase,
  calculateTemperatureStats,
} from "./batchStorage";
import TemperatureChart from "./TemperatureChart";

interface SampleDetailProps {
  sample: Sample;
  allSamples: Sample[];
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

export default function SampleDetail({ sample, allSamples, onBack, onSave }: SampleDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Sample>(sample);
  const [hasChanges, setHasChanges] = useState(false);
  const [newTempValue, setNewTempValue] = useState("");
  const [newTempTime, setNewTempTime] = useState("");
  const [newTempNote, setNewTempNote] = useState("");
  const [tempWarning, setTempWarning] = useState("");
  const [tempSavedFeedback, setTempSavedFeedback] = useState("");

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

  const persistSample = useCallback((updated: Sample) => {
    onSave(updated);
  }, [onSave]);

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

  const handleTempValueChange = (value: string) => {
    setNewTempValue(value);
    const temp = parseFloat(value);
    if (!isNaN(temp) && isAbnormalTemperature(temp)) {
      setTempWarning("温度值异常（低于-10℃或高于50℃），请确认是否正确");
    } else {
      setTempWarning("");
    }
  };

  const handleAddTempRecord = () => {
    if (!newTempValue.trim()) {
      alert("请输入温度值");
      return;
    }
    const temp = parseFloat(newTempValue);
    if (isNaN(temp)) {
      alert("请输入有效的温度数值");
      return;
    }

    const timestamp = newTempTime || new Date().toISOString();

    if (isAbnormalTemperature(temp)) {
      const confirmed = confirm(
        `温度值 ${temp}℃ 异常（正常范围 -10℃ ~ 50℃），是否仍然保存？`
      );
      if (!confirmed) {
        return;
      }
    }

    const newRecord: TemperatureRecord = {
      id: generateTemperatureRecordId(),
      timestamp: new Date(timestamp).toISOString(),
      temperature: newTempValue.trim(),
      note: newTempNote.trim() || undefined,
    };

    const updated: Sample = {
      ...formData,
      temperatureRecords: [...formData.temperatureRecords, newRecord],
    };
    setFormData(updated);
    persistSample(updated);

    setNewTempValue("");
    setNewTempTime("");
    setNewTempNote("");
    setTempWarning("");
    setTempSavedFeedback("温度记录已保存");
    setTimeout(() => setTempSavedFeedback(""), 2000);
  };

  const handleDeleteTempRecord = (id: string) => {
    const updated: Sample = {
      ...formData,
      temperatureRecords: formData.temperatureRecords.filter((r) => r.id !== id),
    };
    setFormData(updated);
    persistSample(updated);
  };

  const sortedTempRecords = getSortedTemperatureRecords(formData.temperatureRecords);

  const caseSamples = getSamplesByCase(allSamples, formData.relatedCase)
    .map((s) => (s.id === formData.id ? formData : s));
  const caseAllRecords = caseSamples.flatMap((s) =>
    s.temperatureRecords.map((r) => ({ ...r, sampleNumber: s.sampleNumber }))
  );
  const caseStats = calculateTemperatureStats(
    caseSamples.flatMap((s) => s.temperatureRecords)
  );

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

        <div className="detail-section">
          <div className="chart-header">
            <h3 className="section-title">🌡️ 温度记录图</h3>
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
                <button
                  className="primary temp-add-btn"
                  onClick={handleAddTempRecord}
                >
                  + 添加记录
                </button>
              </div>
            </div>
            {tempWarning && (
              <div className="temp-warning">
                ⚠️ {tempWarning}
              </div>
            )}
            {tempSavedFeedback && (
              <div className="temp-saved-feedback">
                ✓ {tempSavedFeedback}
              </div>
            )}
          </div>

          <TemperatureChart records={formData.temperatureRecords} />

          {sortedTempRecords.length > 0 && (
            <div className="temp-records-list">
              <h4 className="temp-list-title">记录明细</h4>
              <div className="temp-record-items">
                {sortedTempRecords.map((record) => {
                  const temp = parseFloat(record.temperature);
                  const isAbnormal = !isNaN(temp) && isAbnormalTemperature(temp);
                  return (
                    <div
                      key={record.id}
                      className={`temp-record-item ${isAbnormal ? "abnormal" : ""}`}
                    >
                      <div className="temp-record-time">
                        {formatDateTime(record.timestamp)}
                      </div>
                      <div className="temp-record-value">
                        <span className="temp-number">
                          {record.temperature}℃
                        </span>
                        {isAbnormal && (
                          <span className="temp-abnormal-tag">异常</span>
                        )}
                      </div>
                      {record.note && (
                        <div className="temp-record-note">{record.note}</div>
                      )}
                      <button
                        className="temp-delete-btn"
                        onClick={() => handleDeleteTempRecord(record.id)}
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

        {caseSamples.length > 0 && caseAllRecords.length > 0 && (
          <div className="detail-section case-temp-section">
            <div className="chart-header">
              <h3 className="section-title">📁 同案温度汇总 · {formData.relatedCase}</h3>
              <span className="chart-record-count">
                {caseSamples.length} 个样本 · {caseAllRecords.length} 条记录
              </span>
            </div>

            <TemperatureChart
              records={caseAllRecords.map(({ sampleNumber: _sn, ...r }) => r)}
              series={caseSamples.map((s) => ({
                sampleNumber: s.sampleNumber,
                records: s.temperatureRecords,
              }))}
              title=""
            />

            <div className="case-temp-samples">
              {caseSamples.map((s) => {
                const sRecords = getSortedTemperatureRecords(s.temperatureRecords);
                const sStats = calculateTemperatureStats(s.temperatureRecords);
                return (
                  <div key={s.id} className="case-sample-card">
                    <div className="case-sample-header">
                      <span className="case-sample-number">{s.sampleNumber}</span>
                      <span className="case-sample-location">
                        {s.samplingLocation || "未设置地点"}
                      </span>
                    </div>
                    <div className="case-sample-stats">
                      <span className="case-stat">
                        {sStats.count} 条记录
                      </span>
                      {sStats.max !== null && (
                        <span className="case-stat">
                          最高 {sStats.max.toFixed(1)}℃
                        </span>
                      )}
                      {sStats.min !== null && (
                        <span className="case-stat">
                          最低 {sStats.min.toFixed(1)}℃
                        </span>
                      )}
                      {sStats.avg !== null && (
                        <span className="case-stat">
                          均温 {sStats.avg.toFixed(1)}℃
                        </span>
                      )}
                    </div>
                    {sRecords.length > 0 && (
                      <div className="case-sample-records">
                        {sRecords.map((r) => {
                          const t = parseFloat(r.temperature);
                          const abn = !isNaN(t) && isAbnormalTemperature(t);
                          return (
                            <div
                              key={r.id}
                              className={`case-record-chip ${abn ? "abnormal" : ""}`}
                            >
                              <span className="case-record-temp">
                                {r.temperature}℃
                              </span>
                              <span className="case-record-time">
                                {formatDateTime(r.timestamp)}
                              </span>
                              {abn && (
                                <span className="temp-abnormal-tag">异常</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {caseStats.max !== null && (
              <div className="case-aggregate-stats">
                <h4 className="temp-list-title">案件温度总览</h4>
                <div className="temperature-stats">
                  <div className="stat-card stat-max">
                    <span className="stat-label">最高温</span>
                    <span className="stat-value">
                      {caseStats.max.toFixed(1)}℃
                    </span>
                  </div>
                  <div className="stat-card stat-min">
                    <span className="stat-label">最低温</span>
                    <span className="stat-value">
                      {caseStats.min !== null ? `${caseStats.min.toFixed(1)}℃` : "—"}
                    </span>
                  </div>
                  <div className="stat-card stat-avg">
                    <span className="stat-label">平均温度</span>
                    <span className="stat-value">
                      {caseStats.avg !== null ? `${caseStats.avg.toFixed(1)}℃` : "—"}
                    </span>
                  </div>
                  <div className="stat-card stat-count">
                    <span className="stat-label">总记录</span>
                    <span className="stat-value">{caseStats.count}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
