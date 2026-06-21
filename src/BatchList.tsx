import { SampleBatch, formatDateTime, getBatchSummary } from "./batchStorage";

interface BatchListProps {
  batches: SampleBatch[];
  onDelete: (id: string) => void;
}

export default function BatchList({ batches, onDelete }: BatchListProps) {
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
          {batches.map((batch, index) => (
            <article key={batch.id} className="batch-card">
              <div className="batch-card-header">
                <b className="batch-index">{String(index + 1).padStart(2, "0")}</b>
                <div className="batch-title">
                  <h3>{batch.caseNumber}</h3>
                  {batch.samplingLocation && (
                    <p className="batch-location">📍 {batch.samplingLocation}</p>
                  )}
                </div>
                <button
                  className="delete-button"
                  onClick={() => {
                    if (confirm(`确定要删除批次「${batch.caseNumber}」吗？`)) {
                      onDelete(batch.id);
                    }
                  }}
                  title="删除批次"
                >
                  ✕
                </button>
              </div>

              <div className="batch-summary-row">
                <div className="summary-tag">
                  <span className="tag-label">摘要</span>
                  <span className="tag-value">{getBatchSummary(batch)}</span>
                </div>
              </div>

              <div className="batch-meta">
                <div className="meta-item">
                  <span className="meta-icon">🧪</span>
                  <span className="meta-label">样本数量</span>
                  <span className="meta-value sample-count-badge">
                    {batch.sampleCount > 0 ? `${batch.sampleCount} 个` : "待添加"}
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
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
