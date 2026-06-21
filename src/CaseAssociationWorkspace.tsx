import { useState, useMemo, useEffect } from "react";
import {
  Sample,
  SampleBatch,
  CaseInfo,
  getAllCaseNumbers,
  buildCaseInfo,
  getUnassociatedSamples,
  formatDateTime,
  getBatchSummary,
} from "./batchStorage";

interface CaseAssociationWorkspaceProps {
  batches: SampleBatch[];
  samples: Sample[];
  onBack: () => void;
  onAssociate: (sampleId: string, caseNumber: string) => void;
  onUnassociate: (sampleId: string) => void;
  onViewSampleDetail: (sampleId: string) => void;
}

export default function CaseAssociationWorkspace({
  batches,
  samples,
  onBack,
  onAssociate,
  onUnassociate,
  onViewSampleDetail,
}: CaseAssociationWorkspaceProps) {
  const allCaseNumbers = useMemo(
    () => getAllCaseNumbers(batches, samples),
    [batches, samples]
  );

  const unassociatedSamples = useMemo(
    () => getUnassociatedSamples(samples),
    [samples]
  );

  const [selectedCase, setSelectedCase] = useState<string | null>(
    allCaseNumbers.length > 0 ? allCaseNumbers[0] : null
  );

  const [showAssociateDialog, setShowAssociateDialog] = useState(false);

  useEffect(() => {
    if (selectedCase !== null && !allCaseNumbers.includes(selectedCase)) {
      setSelectedCase(
        allCaseNumbers.length > 0 ? allCaseNumbers[0] : null
      );
    }
  }, [allCaseNumbers, selectedCase]);

  const caseInfos = useMemo(() => {
    return allCaseNumbers.map((cn) => buildCaseInfo(batches, samples, cn));
  }, [allCaseNumbers, batches, samples]);

  const selectedCaseInfo: CaseInfo | null = useMemo(() => {
    if (!selectedCase) return null;
    return buildCaseInfo(batches, samples, selectedCase);
  }, [selectedCase, batches, samples]);

  const handleAssociateSample = (sampleId: string, caseNumber: string) => {
    onAssociate(sampleId, caseNumber);
    setShowAssociateDialog(false);
  };

  const handleUnassociateSample = (sampleId: string, sampleNumber: string) => {
    if (confirm(`确定要将样本「${sampleNumber}」从案件中解除关联吗？`)) {
      onUnassociate(sampleId);
    }
  };

  return (
    <div className="case-workspace">
      <div className="workspace-header">
        <button className="back-button" onClick={onBack}>
          ← 返回
        </button>
        <h1 className="workspace-title">📁 案件样本关联工作区</h1>
        <div style={{ width: 80 }} />
      </div>

      <div className="case-workspace-body">
        <aside className="case-list-panel">
          <div className="panel-header">
            <h2>案件列表</h2>
            <span className="case-count-badge">{allCaseNumbers.length}</span>
          </div>

          {allCaseNumbers.length === 0 ? (
            <div className="empty-state compact">
              <div className="empty-icon">📂</div>
              <h3>暂无案件</h3>
              <p>先创建批次或在样本中设置关联案件</p>
            </div>
          ) : (
            <div className="case-list">
              {caseInfos.map((info) => (
                <button
                  key={info.caseNumber}
                  className={`case-list-item ${
                    selectedCase === info.caseNumber ? "active" : ""
                  }`}
                  onClick={() => setSelectedCase(info.caseNumber)}
                >
                  <div className="case-item-main">
                    <div className="case-item-icon">📋</div>
                    <div className="case-item-info">
                      <div className="case-item-number">{info.caseNumber}</div>
                      <div className="case-item-meta">
                        {info.totalBatches} 个批次 · {info.totalSamples} 个样本
                      </div>
                    </div>
                  </div>
                  {selectedCase === info.caseNumber && (
                    <div className="case-item-arrow">›</div>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="unassociated-section">
            <div className="panel-header">
              <h3>未关联样本</h3>
              <span className="case-count-badge warn">
                {unassociatedSamples.length}
              </span>
            </div>
            {unassociatedSamples.length === 0 ? (
              <div className="empty-state compact">
                <div className="empty-icon">✅</div>
                <p>所有样本已关联案件</p>
              </div>
            ) : (
              <div className="unassociated-list">
                {unassociatedSamples.map((sample) => (
                  <div
                    key={sample.id}
                    className="unassociated-sample-item"
                  >
                    <div
                      className="unassociated-sample-info"
                      onClick={() => onViewSampleDetail(sample.id)}
                    >
                      <div className="unassociated-sample-number">
                        {sample.sampleNumber}
                      </div>
                      <div className="unassociated-sample-meta">
                        {sample.developmentStage || "未设置阶段"}
                        {sample.samplingLocation &&
                          ` · ${sample.samplingLocation}`}
                      </div>
                    </div>
                    <div className="unassociated-actions">
                      {allCaseNumbers.length > 0 ? (
                        <select
                          className="mini-select"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAssociateSample(
                                sample.id,
                                e.target.value
                              );
                            }
                          }}
                        >
                          <option value="" disabled>
                            关联到...
                          </option>
                          {allCaseNumbers.map((cn) => (
                            <option key={cn} value={cn}>
                              {cn}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="no-case-hint">无案件可选</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {unassociatedSamples.length > 0 && (
              <button
                className="secondary full-width"
                style={{ marginTop: "10px" }}
                onClick={() => setShowAssociateDialog(true)}
              >
                批量关联
              </button>
            )}
          </div>
        </aside>

        <section className="case-detail-panel">
          {!selectedCaseInfo ? (
            <div className="empty-state large">
              <div className="empty-icon">📂</div>
              <h3>请选择一个案件</h3>
              <p>从左侧列表中选择案件查看详情和管理关联样本</p>
            </div>
          ) : (
            <>
              <div className="case-detail-header">
                <div className="case-detail-title-row">
                  <div className="case-detail-icon">📁</div>
                  <div>
                    <h2>{selectedCaseInfo.caseNumber}</h2>
                    <div className="case-detail-stats">
                      <span className="stat-pill">
                        🧪 {selectedCaseInfo.totalBatches} 个批次
                      </span>
                      <span className="stat-pill">
                        🔬 {selectedCaseInfo.totalSamples} 个样本
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  className="primary"
                  onClick={() => setShowAssociateDialog(true)}
                >
                  + 关联样本
                </button>
              </div>

              {selectedCaseInfo.batches.length > 0 && (
                <div className="case-section">
                  <div className="section-header">
                    <h3>📦 样本批次</h3>
                    <span className="section-count">
                      {selectedCaseInfo.batches.length}
                    </span>
                  </div>
                  <div className="batch-cards">
                    {selectedCaseInfo.batches.map((batch, idx) => (
                      <div key={batch.id} className="case-batch-card">
                        <div className="case-batch-header">
                          <b className="batch-index-mini">
                            {String(idx + 1).padStart(2, "0")}
                          </b>
                          <div className="case-batch-title">
                            {batch.samplingLocation || "未设置地点"}
                          </div>
                        </div>
                        <div className="case-batch-summary">
                          {getBatchSummary(batch)}
                        </div>
                        <div className="case-batch-meta">
                          {batch.samplingTime && (
                            <span>
                              🕐 {formatDateTime(batch.samplingTime)}
                            </span>
                          )}
                          <span>
                            🧪 {batch.sampleCount > 0
                              ? `${batch.sampleCount} 个样本`
                              : "待添加"}
                          </span>
                        </div>
                        {batch.fieldNotes && (
                          <div className="case-batch-notes">
                            📝 {batch.fieldNotes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="case-section">
                <div className="section-header">
                  <h3>🔬 关联样本</h3>
                  <span className="section-count">
                    {selectedCaseInfo.samples.length}
                  </span>
                </div>
                {selectedCaseInfo.samples.length === 0 ? (
                  <div className="empty-state compact">
                    <div className="empty-icon">🔬</div>
                    <h3>暂无关联样本</h3>
                    <p>点击右上角「关联样本」添加样本到此案件</p>
                  </div>
                ) : (
                  <div className="case-samples-table">
                    <div className="table-header">
                      <div className="th-col col-no">序号</div>
                      <div className="th-col col-number">样本编号</div>
                      <div className="th-col col-stage">发育阶段</div>
                      <div className="th-col col-location">采样地点</div>
                      <div className="th-col col-species">昆虫种类</div>
                      <div className="th-col col-temp">温度</div>
                      <div className="th-col col-actions">操作</div>
                    </div>
                    <div className="table-body">
                      {selectedCaseInfo.samples.map((sample, idx) => (
                        <div key={sample.id} className="table-row">
                          <div className="td-col col-no">
                            {String(idx + 1).padStart(2, "0")}
                          </div>
                          <div
                            className="td-col col-number clickable"
                            onClick={() => onViewSampleDetail(sample.id)}
                          >
                            {sample.sampleNumber}
                          </div>
                          <div className="td-col col-stage">
                            {sample.developmentStage ? (
                              <span className="stage-tag">
                                {sample.developmentStage}
                              </span>
                            ) : (
                              "—"
                            )}
                          </div>
                          <div className="td-col col-location">
                            {sample.samplingLocation || "—"}
                          </div>
                          <div className="td-col col-species">
                            {sample.insectSpecies ? (
                              <span className="species-tag-mini">
                                {sample.insectSpecies}
                              </span>
                            ) : (
                              "—"
                            )}
                          </div>
                          <div className="td-col col-temp">
                            {sample.environmentTemperature
                              ? `${sample.environmentTemperature}℃`
                              : "—"}
                          </div>
                          <div className="td-col col-actions">
                            <button
                              className="icon-btn"
                              title="查看详情"
                              onClick={() => onViewSampleDetail(sample.id)}
                            >
                              👁️
                            </button>
                            <button
                              className="icon-btn danger"
                              title="解除关联"
                              onClick={() =>
                                handleUnassociateSample(
                                  sample.id,
                                  sample.sampleNumber
                                )
                              }
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {showAssociateDialog && (
        <AssociateDialog
          unassociatedSamples={unassociatedSamples}
          allCaseNumbers={allCaseNumbers}
          defaultCaseNumber={selectedCase || ""}
          onCancel={() => setShowAssociateDialog(false)}
          onConfirm={(sampleIds, caseNumber) => {
            sampleIds.forEach((sid) => onAssociate(sid, caseNumber));
            setShowAssociateDialog(false);
          }}
        />
      )}
    </div>
  );
}

interface AssociateDialogProps {
  unassociatedSamples: Sample[];
  allCaseNumbers: string[];
  defaultCaseNumber: string;
  onCancel: () => void;
  onConfirm: (sampleIds: string[], caseNumber: string) => void;
}

function AssociateDialog({
  unassociatedSamples,
  allCaseNumbers,
  defaultCaseNumber,
  onCancel,
  onConfirm,
}: AssociateDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetCase, setTargetCase] = useState(defaultCaseNumber);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === unassociatedSamples.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unassociatedSamples.map((s) => s.id)));
    }
  };

  const handleConfirm = () => {
    if (selectedIds.size === 0) {
      alert("请选择要关联的样本");
      return;
    }
    if (!targetCase) {
      alert("请选择目标案件");
      return;
    }
    onConfirm(Array.from(selectedIds), targetCase);
  };

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>关联样本到案件</h3>
          <button className="dialog-close" onClick={onCancel}>
            ✕
          </button>
        </div>
        <div className="dialog-body">
          <div className="dialog-form-row">
            <label>
              <span>目标案件 *</span>
              <select
                className="select-field"
                value={targetCase}
                onChange={(e) => setTargetCase(e.target.value)}
              >
                <option value="">请选择案件</option>
                {allCaseNumbers.map((cn) => (
                  <option key={cn} value={cn}>
                    {cn}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="dialog-form-row">
            <div className="select-all-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={
                    unassociatedSamples.length > 0 &&
                    selectedIds.size === unassociatedSamples.length
                  }
                  onChange={toggleSelectAll}
                />
                <span>
                  全选（{selectedIds.size}/
                  {unassociatedSamples.length} 已选）
                </span>
              </label>
            </div>
          </div>

          {unassociatedSamples.length === 0 ? (
            <div className="empty-state compact">
              <div className="empty-icon">🎉</div>
              <p>没有未关联的样本</p>
            </div>
          ) : (
            <div className="sample-checklist">
              {unassociatedSamples.map((sample) => (
                <label
                  key={sample.id}
                  className={`sample-check-item ${
                    selectedIds.has(sample.id) ? "checked" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(sample.id)}
                    onChange={() => toggleSelect(sample.id)}
                  />
                  <div className="sample-check-info">
                    <div className="sample-check-number">
                      {sample.sampleNumber}
                    </div>
                    <div className="sample-check-meta">
                      {[
                        sample.developmentStage,
                        sample.samplingLocation,
                        sample.preservationMethod,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "无详细信息"}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="dialog-footer">
          <button className="secondary" onClick={onCancel}>
            取消
          </button>
          <button
            className="primary"
            onClick={handleConfirm}
            disabled={selectedIds.size === 0 || !targetCase}
          >
            确认关联 ({selectedIds.size})
          </button>
        </div>
      </div>
    </div>
  );
}
