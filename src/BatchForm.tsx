import { useState } from "react";
import { SampleBatch, generateBatchId } from "./batchStorage";

interface BatchFormProps {
  onSubmit: (batch: SampleBatch) => void;
}

const EXPOSURE_STAGES = [
  "新鲜期",
  "肿胀期",
  "腐败期",
  "后腐败期",
  "干化期",
];

export default function BatchForm({ onSubmit }: BatchFormProps) {
  const [caseNumber, setCaseNumber] = useState("");
  const [samplingLocation, setSamplingLocation] = useState("");
  const [samplingTime, setSamplingTime] = useState("");
  const [environmentTemperature, setEnvironmentTemperature] = useState("");
  const [exposureStage, setExposureStage] = useState("");
  const [fieldNotes, setFieldNotes] = useState("");

  const resetForm = () => {
    setCaseNumber("");
    setSamplingLocation("");
    setSamplingTime("");
    setEnvironmentTemperature("");
    setExposureStage("");
    setFieldNotes("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseNumber.trim()) {
      alert("请填写案件编号");
      return;
    }

    const now = new Date().toISOString();
    const newBatch: SampleBatch = {
      id: generateBatchId(),
      caseNumber: caseNumber.trim(),
      samplingLocation: samplingLocation.trim(),
      samplingTime: samplingTime,
      environmentTemperature: environmentTemperature.trim(),
      exposureStage,
      fieldNotes: fieldNotes.trim(),
      sampleCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    onSubmit(newBatch);
    resetForm();
  };

  return (
    <section className="panel form-panel">
      <div className="heading">
        <div>
          <p>批次管理</p>
          <h2>新建样本批次</h2>
        </div>
        <button type="button" className="secondary" onClick={resetForm}>
          重置表单
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="field-grid">
          <label>
            <span>案件编号 *</span>
            <input
              type="text"
              placeholder="如：CASE-2026-001"
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              required
            />
          </label>
          <label>
            <span>采样地点</span>
            <input
              type="text"
              placeholder="如：室外草地、阴影区域"
              value={samplingLocation}
              onChange={(e) => setSamplingLocation(e.target.value)}
            />
          </label>
          <label>
            <span>采样时间</span>
            <input
              type="datetime-local"
              value={samplingTime}
              onChange={(e) => setSamplingTime(e.target.value)}
            />
          </label>
          <label>
            <span>环境温度 (℃)</span>
            <input
              type="number"
              step="0.1"
              min="-50"
              max="60"
              placeholder="如：28.6"
              value={environmentTemperature}
              onChange={(e) => setEnvironmentTemperature(e.target.value)}
            />
          </label>
          <label>
            <span>暴露阶段</span>
            <select
              value={exposureStage}
              onChange={(e) => setExposureStage(e.target.value)}
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
              placeholder="记录现场特殊情况、观察发现等..."
              rows={3}
              value={fieldNotes}
              onChange={(e) => setFieldNotes(e.target.value)}
              className="textarea-field"
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="primary large">
            创建批次
          </button>
        </div>
      </form>
    </section>
  );
}
