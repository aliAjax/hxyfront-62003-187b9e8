import { useState } from "react";
import {
  Sample,
  SampleStatus,
  StatusHistoryRecord,
  ReviewPriority,
  SAMPLE_STATUS_LABELS,
  SAMPLE_STATUS_COLORS,
  STATUS_TRANSITIONS,
  REVIEW_PRIORITY_LABELS,
  REVIEW_PRIORITY_COLORS,
  REVIEW_PRIORITIES,
  formatDateTime,
  sortSamplesByPriorityAndTime,
} from "./batchStorage";

interface IdentificationQueueProps {
  samples: Sample[];
  onBack: () => void;
  onViewDetail: (sampleId: string) => void;
  onUpdateStatus: (
    sampleId: string,
    newStatus: SampleStatus,
    note: string,
    newPriority?: ReviewPriority
  ) => void;
}

const STATUS_ICONS: Record<SampleStatus, string> = {
  PENDING_IDENTIFICATION: "🔍",
  NEEDS_REVIEW: "⚠️",
  PHOTO_COMPLETED: "📷",
  CONFIRMED: "✅",
};

const STATUS_ORDER: SampleStatus[] = [
  "PENDING_IDENTIFICATION",
  "NEEDS_REVIEW",
  "PHOTO_COMPLETED",
  "CONFIRMED",
];

export default function IdentificationQueue({
  samples,
  onBack,
  onViewDetail,
  onUpdateStatus,
}: IdentificationQueueProps) {
  const [selectedStatus, setSelectedStatus] = useState<SampleStatus | "ALL">(
    "ALL"
  );
  const [statusDialog, setStatusDialog] = useState<{
    sample: Sample;
    targetStatus: SampleStatus;
  } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<ReviewPriority | null>(null);
  const [historyDialog, setHistoryDialog] = useState<Sample | null>(null);

  const getSamplesByStatus = (status: SampleStatus) =>
    sortSamplesByPriorityAndTime(samples.filter((s) => s.status === status));

  const statusCounts: Record<SampleStatus, number> = {
    PENDING_IDENTIFICATION: getSamplesByStatus("PENDING_IDENTIFICATION").length,
    NEEDS_REVIEW: getSamplesByStatus("NEEDS_REVIEW").length,
    PHOTO_COMPLETED: getSamplesByStatus("PHOTO_COMPLETED").length,
    CONFIRMED: getSamplesByStatus("CONFIRMED").length,
  };

  const filteredSamples =
    selectedStatus === "ALL"
      ? sortSamplesByPriorityAndTime(samples)
      : sortSamplesByPriorityAndTime(samples.filter((s) => s.status === selectedStatus));

  const handleOpenStatusDialog = (
    sample: Sample,
    targetStatus: SampleStatus,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setStatusDialog({ sample, targetStatus });
    setReviewNote("");
    setSelectedPriority(sample.priority);
  };

  const handleConfirmStatusChange = () => {
    if (!statusDialog) return;
    onUpdateStatus(
      statusDialog.sample.id,
      statusDialog.targetStatus,
      reviewNote.trim(),
      selectedPriority ?? undefined
    );
    setStatusDialog(null);
    setReviewNote("");
    setSelectedPriority(null);
  };

  const PriorityBadge = ({ priority }: { priority: ReviewPriority }) => (
    <span
      className="queue-priority-badge"
      style={{
        backgroundColor: `${REVIEW_PRIORITY_COLORS[priority]}15`,
        color: REVIEW_PRIORITY_COLORS[priority],
        borderColor: `${REVIEW_PRIORITY_COLORS[priority]}40`,
      }}
    >
      {priority === "HIGH" ? "🔴" : priority === "MEDIUM" ? "🟡" : "🔵"} {REVIEW_PRIORITY_LABELS[priority]}
    </span>
  );

  const StatusBadge = ({ status }: { status: SampleStatus }) => (
    <span
      className="queue-status-badge"
      style={{
        backgroundColor: `${SAMPLE_STATUS_COLORS[status]}15`,
        color: SAMPLE_STATUS_COLORS[status],
        borderColor: `${SAMPLE_STATUS_COLORS[status]}40`,
      }}
    >
      {STATUS_ICONS[status]} {SAMPLE_STATUS_LABELS[status]}
    </span>
  );

  const SampleCard = ({ sample }: { sample: Sample }) => {
    const availableTransitions = STATUS_TRANSITIONS[sample.status] || [];

    return (
      <div
        className="queue-sample-card"
        onClick={() => onViewDetail(sample.id)}
      >
        <div className="queue-card-header">
          <div className="queue-card-title-section">
            <h3 className="queue-card-number">{sample.sampleNumber}</h3>
            <div className="queue-card-badges">
              <StatusBadge status={sample.status} />
              <PriorityBadge priority={sample.priority} />
            </div>
          </div>
          <button
            className="queue-history-btn"
            onClick={(e) => {
              e.stopPropagation();
              setHistoryDialog(sample);
            }}
            title="查看状态历史"
          >
            📋
          </button>
        </div>

        <div className="queue-card-body">
          <div className="queue-info-row">
            <span className="queue-info-icon">🐛</span>
            <span className="queue-info-label">发育阶段</span>
            <span className="queue-info-value">
              {sample.developmentStage || "未设置"}
            </span>
          </div>
          <div className="queue-info-row">
            <span className="queue-info-icon">📍</span>
            <span className="queue-info-label">采样地点</span>
            <span className="queue-info-value">
              {sample.samplingLocation || "未设置"}
            </span>
          </div>
          <div className="queue-info-row">
            <span className="queue-info-icon">🔬</span>
            <span className="queue-info-label">昆虫种类</span>
            <span className="queue-info-value">
              {sample.insectSpecies || "待鉴定"}
            </span>
          </div>
          <div className="queue-info-row">
            <span className="queue-info-icon">📁</span>
            <span className="queue-info-label">关联案件</span>
            <span className="queue-info-value">
              {sample.relatedCase || "未关联"}
            </span>
          </div>
        </div>

        {sample.identificationNotes && (
          <div className="queue-card-notes">
            <span className="queue-notes-label">鉴定备注：</span>
            {sample.identificationNotes}
          </div>
        )}

        <div className="queue-card-footer">
          <div className="queue-card-time">
            更新于 {formatDateTime(sample.updatedAt)}
          </div>
          <div className="queue-actions">
            {availableTransitions.map((targetStatus) => (
              <button
                key={targetStatus}
                className="queue-action-btn"
                style={{
                  backgroundColor: `${SAMPLE_STATUS_COLORS[targetStatus]}15`,
                  color: SAMPLE_STATUS_COLORS[targetStatus],
                  borderColor: `${SAMPLE_STATUS_COLORS[targetStatus]}40`,
                }}
                onClick={(e) => handleOpenStatusDialog(sample, targetStatus, e)}
              >
                转{SAMPLE_STATUS_LABELS[targetStatus]}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="identification-queue">
      <div className="queue-header">
        <div className="queue-header-left">
          <button className="back-button" onClick={onBack}>
            ← 返回
          </button>
          <h1 className="queue-title">🔬 鉴定复核队列</h1>
        </div>
        <div className="queue-header-stats">
          共 {samples.length} 个样本
        </div>
      </div>

      <div className="queue-status-tabs">
        <button
          className={`queue-status-tab ${selectedStatus === "ALL" ? "active" : ""}`}
          onClick={() => setSelectedStatus("ALL")}
        >
          <span className="queue-tab-icon">📊</span>
          <span className="queue-tab-label">全部</span>
          <span className="queue-tab-count">{samples.length}</span>
        </button>
        {STATUS_ORDER.map((status) => (
          <button
            key={status}
            className={`queue-status-tab ${selectedStatus === status ? "active" : ""}`}
            onClick={() => setSelectedStatus(status)}
            style={{
              "--tab-color": SAMPLE_STATUS_COLORS[status],
            } as React.CSSProperties}
          >
            <span className="queue-tab-icon">{STATUS_ICONS[status]}</span>
            <span className="queue-tab-label">
              {SAMPLE_STATUS_LABELS[status]}
            </span>
            <span className="queue-tab-count">{statusCounts[status]}</span>
          </button>
        ))}
      </div>

      <div className="queue-content">
        {selectedStatus === "ALL" ? (
          <div className="queue-columns">
            {STATUS_ORDER.map((status) => (
              <div key={status} className="queue-column">
                <div
                  className="queue-column-header"
                  style={{
                    borderLeftColor: SAMPLE_STATUS_COLORS[status],
                  }}
                >
                  <div className="queue-column-title">
                    <span className="queue-column-icon">
                      {STATUS_ICONS[status]}
                    </span>
                    <span>{SAMPLE_STATUS_LABELS[status]}</span>
                  </div>
                  <span
                    className="queue-column-count"
                    style={{
                      backgroundColor: `${SAMPLE_STATUS_COLORS[status]}15`,
                      color: SAMPLE_STATUS_COLORS[status],
                    }}
                  >
                    {statusCounts[status]}
                  </span>
                </div>
                <div className="queue-column-content">
                  {getSamplesByStatus(status).length === 0 ? (
                    <div className="queue-empty">
                      <div className="queue-empty-icon">📭</div>
                      <p>暂无样本</p>
                    </div>
                  ) : (
                    getSamplesByStatus(status).map((sample) => (
                      <SampleCard key={sample.id} sample={sample} />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="queue-list-view">
            <div className="queue-list-header">
              <h2>
                {STATUS_ICONS[selectedStatus]}{" "}
                {SAMPLE_STATUS_LABELS[selectedStatus]}
              </h2>
              <span>共 {filteredSamples.length} 个样本</span>
            </div>
            {filteredSamples.length === 0 ? (
              <div className="queue-empty large">
                <div className="queue-empty-icon">📭</div>
                <h3>暂无该状态的样本</h3>
                <p>样本在状态变更后会显示在这里</p>
              </div>
            ) : (
              <div className="queue-sample-grid">
                {filteredSamples.map((sample) => (
                  <SampleCard key={sample.id} sample={sample} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {statusDialog && (
        <div className="dialog-overlay" onClick={() => setStatusDialog(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>状态变更确认</h3>
              <button
                className="dialog-close"
                onClick={() => setStatusDialog(null)}
              >
                ✕
              </button>
            </div>
            <div className="dialog-body">
              <div className="status-change-info">
                <div className="status-change-row">
                  <span className="status-change-label">样本编号</span>
                  <span className="status-change-value">
                    {statusDialog.sample.sampleNumber}
                  </span>
                </div>
                <div className="status-change-row">
                  <span className="status-change-label">当前状态</span>
                  <StatusBadge status={statusDialog.sample.status} />
                </div>
                <div className="status-change-arrow">↓</div>
                <div className="status-change-row">
                  <span className="status-change-label">目标状态</span>
                  <StatusBadge status={statusDialog.targetStatus} />
                </div>
                <div className="status-change-row">
                  <span className="status-change-label">当前优先级</span>
                  <PriorityBadge priority={statusDialog.sample.priority} />
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
                        className={`priority-option ${selectedPriority === p ? "selected" : ""}`}
                        style={{
                          "--priority-color": REVIEW_PRIORITY_COLORS[p],
                        } as React.CSSProperties}
                        onClick={() => setSelectedPriority(p)}
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
                  <span>复核意见 / 操作备注</span>
                  <textarea
                    className="textarea-field"
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="请输入状态变更的原因或复核意见（可选）"
                    rows={4}
                    autoFocus
                  />
                </label>
              </div>
            </div>
            <div className="dialog-footer">
              <button
                className="secondary"
                onClick={() => setStatusDialog(null)}
              >
                取消
              </button>
              <button className="primary" onClick={handleConfirmStatusChange}>
                确认变更
              </button>
            </div>
          </div>
        </div>
      )}

      {historyDialog && (
        <div className="dialog-overlay" onClick={() => setHistoryDialog(null)}>
          <div
            className="dialog dialog-wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-header">
              <h3>
                📋 状态历史记录 · {historyDialog.sampleNumber}
              </h3>
              <button
                className="dialog-close"
                onClick={() => setHistoryDialog(null)}
              >
                ✕
              </button>
            </div>
            <div className="dialog-body">
              {historyDialog.statusHistory.length === 0 ? (
                <div className="queue-empty compact">
                  <div className="queue-empty-icon">📭</div>
                  <p>暂无状态变更记录</p>
                </div>
              ) : (
                <div className="status-timeline">
                  {[...historyDialog.statusHistory]
                    .sort(
                      (a, b) =>
                        new Date(b.timestamp).getTime() -
                        new Date(a.timestamp).getTime()
                    )
                    .map((record, index, arr) => (
                      <div
                        key={record.id}
                        className={`timeline-item ${index === 0 ? "latest" : ""}`}
                      >
                        <div className="timeline-left">
                          <div
                            className="timeline-dot"
                            style={{
                              backgroundColor:
                                record.oldStatus
                                  ? SAMPLE_STATUS_COLORS[record.newStatus]
                                  : record.newPriority
                                    ? REVIEW_PRIORITY_COLORS[record.newPriority]
                                    : SAMPLE_STATUS_COLORS[record.newStatus],
                            }}
                          />
                          {index < arr.length - 1 && (
                            <div className="timeline-line" />
                          )}
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-header">
                            <div className="timeline-statuses">
                              {record.oldStatus && (
                                <>
                                  <span
                                    className="timeline-status"
                                    style={{
                                      backgroundColor: `${SAMPLE_STATUS_COLORS[record.oldStatus]}15`,
                                      color: SAMPLE_STATUS_COLORS[record.oldStatus],
                                    }}
                                  >
                                    {SAMPLE_STATUS_LABELS[record.oldStatus]}
                                  </span>
                                  <span className="timeline-arrow">→</span>
                                </>
                              )}
                              {record.oldStatus || record.newStatus ? (
                                <span
                                  className="timeline-status"
                                  style={{
                                    backgroundColor: `${SAMPLE_STATUS_COLORS[record.newStatus]}15`,
                                    color: SAMPLE_STATUS_COLORS[record.newStatus],
                                  }}
                                >
                                  {SAMPLE_STATUS_LABELS[record.newStatus]}
                                </span>
                              ) : null}
                              {record.oldPriority && (
                                <>
                                  {record.oldStatus && <span className="timeline-separator">·</span>}
                                  <span
                                    className="timeline-status"
                                    style={{
                                      backgroundColor: `${REVIEW_PRIORITY_COLORS[record.oldPriority]}15`,
                                      color: REVIEW_PRIORITY_COLORS[record.oldPriority],
                                    }}
                                  >
                                    {REVIEW_PRIORITY_LABELS[record.oldPriority]}
                                  </span>
                                  <span className="timeline-arrow">→</span>
                                </>
                              )}
                              {record.newPriority && (
                                <span
                                  className="timeline-status"
                                  style={{
                                    backgroundColor: `${REVIEW_PRIORITY_COLORS[record.newPriority]}15`,
                                    color: REVIEW_PRIORITY_COLORS[record.newPriority],
                                  }}
                                >
                                  {REVIEW_PRIORITY_LABELS[record.newPriority]}
                                </span>
                              )}
                            </div>
                            {index === 0 && (
                              <span className="timeline-latest-tag">最新</span>
                            )}
                          </div>
                          <div className="timeline-meta">
                            <span className="timeline-time">
                              🕐 {formatDateTime(record.timestamp)}
                            </span>
                            <span className="timeline-operator">
                              👤 {record.operator}
                            </span>
                            {(record.oldStatus || record.oldPriority) && (
                              <span className="timeline-change-type">
                                {record.oldStatus && record.oldPriority
                                  ? "状态 & 优先级变更"
                                  : record.oldPriority
                                    ? "优先级调整"
                                    : "状态变更"}
                              </span>
                            )}
                          </div>
                          {record.note && (
                            <div className="timeline-note">
                              <span className="timeline-note-label">备注：</span>
                              {record.note}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
            <div className="dialog-footer">
              <button
                className="primary"
                onClick={() => setHistoryDialog(null)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
