import { useMemo } from "react";
import {
  TemperatureRecord,
  getSortedTemperatureRecords,
  calculateTemperatureStats,
  formatDateTime,
  isAbnormalTemperature,
} from "./batchStorage";

interface TemperatureChartProps {
  records: TemperatureRecord[];
  title?: string;
}

export default function TemperatureChart({
  records,
  title = "温度记录图",
}: TemperatureChartProps) {
  const sortedRecords = useMemo(
    () => getSortedTemperatureRecords(records),
    [records]
  );

  const stats = useMemo(
    () => calculateTemperatureStats(records),
    [records]
  );

  const chartWidth = 700;
  const chartHeight = 280;
  const paddingLeft = 56;
  const paddingRight = 24;
  const paddingTop = 24;
  const paddingBottom = 48;
  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const { points, yTicks, xLabels } = useMemo(() => {
    if (sortedRecords.length === 0) {
      return { points: [], yTicks: [], xLabels: [] };
    }

    const temps = sortedRecords
      .map((r) => parseFloat(r.temperature))
      .filter((t) => !isNaN(t));

    if (temps.length === 0) {
      return { points: [], yTicks: [], xLabels: [] };
    }

    const minTemp = Math.floor(Math.min(...temps) - 2);
    const maxTemp = Math.ceil(Math.max(...temps) + 2);
    const tempRange = maxTemp - minTemp || 1;

    const yTickCount = 5;
    const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => {
      const value = minTemp + (tempRange * i) / yTickCount;
      return {
        value: Math.round(value * 10) / 10,
        y: paddingTop + innerHeight - (innerHeight * i) / yTickCount,
      };
    });

    const points = sortedRecords.map((record, index) => {
      const temp = parseFloat(record.temperature);
      if (isNaN(temp)) return null;

      const x =
        paddingLeft +
        (sortedRecords.length === 1
          ? innerWidth / 2
          : (innerWidth * index) / (sortedRecords.length - 1));
      const y =
        paddingTop +
        innerHeight -
        ((temp - minTemp) / tempRange) * innerHeight;

      return { x, y, record, temp };
    });

    const maxLabels = 6;
    const step = Math.max(1, Math.ceil(sortedRecords.length / maxLabels));
    const xLabels = sortedRecords
      .map((record, index) => ({
        record,
        index,
        x:
          paddingLeft +
          (sortedRecords.length === 1
            ? innerWidth / 2
            : (innerWidth * index) / (sortedRecords.length - 1)),
      }))
      .filter((_, i) => i % step === 0 || i === sortedRecords.length - 1);

    return { points: points.filter(Boolean), yTicks, xLabels };
  }, [sortedRecords, innerWidth, innerHeight, paddingLeft, paddingTop]);

  const pathD = useMemo(() => {
    if (points.length < 2) return "";
    return points
      .map((p, i) => (i === 0 ? `M ${p!.x} ${p!.y}` : `L ${p!.x} ${p!.y}`))
      .join(" ");
  }, [points]);

  const areaD = useMemo(() => {
    if (points.length < 2) return "";
    const bottomY = paddingTop + innerHeight;
    const firstPoint = points[0]!;
    const lastPoint = points[points.length - 1]!;
    return `M ${firstPoint.x} ${bottomY} L ${firstPoint.x} ${firstPoint.y} ${pathD.substring(1)} L ${lastPoint.x} ${bottomY} Z`;
  }, [points, pathD, paddingTop, innerHeight]);

  const formatXLabel = (timestamp: string) => {
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${month}/${day} ${hours}:${minutes}`;
  };

  return (
    <div className="temperature-chart-container">
      <div className="chart-header">
        <h3 className="section-title">{title}</h3>
        <span className="chart-record-count">
          共 {sortedRecords.length} 条记录
        </span>
      </div>

      {sortedRecords.length === 0 ? (
        <div className="chart-empty">
          <div className="empty-icon">📊</div>
          <p>暂无温度记录数据</p>
        </div>
      ) : (
        <>
          <div className="chart-wrapper">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="temperature-svg"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#365314" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#365314" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {yTicks.map((tick, i) => (
                <g key={i}>
                  <line
                    x1={paddingLeft}
                    y1={tick.y}
                    x2={chartWidth - paddingRight}
                    y2={tick.y}
                    stroke="#e2e8f0"
                    strokeDasharray="4,4"
                  />
                  <text
                    x={paddingLeft - 10}
                    y={tick.y + 4}
                    textAnchor="end"
                    className="chart-axis-text"
                  >
                    {tick.value}℃
                  </text>
                </g>
              ))}

              <line
                x1={paddingLeft}
                y1={paddingTop}
                x2={paddingLeft}
                y2={paddingTop + innerHeight}
                stroke="#cbd5e1"
                strokeWidth="1"
              />
              <line
                x1={paddingLeft}
                y1={paddingTop + innerHeight}
                x2={chartWidth - paddingRight}
                y2={paddingTop + innerHeight}
                stroke="#cbd5e1"
                strokeWidth="1"
              />

              {areaD && (
                <path d={areaD} fill="url(#areaGradient)" />
              )}

              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#365314"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {points.map((point, i) => (
                <g key={i}>
                  <circle
                    cx={point!.x}
                    cy={point!.y}
                    r={isAbnormalTemperature(point!.temp) ? 7 : 5}
                    fill={isAbnormalTemperature(point!.temp) ? "#dc2626" : "#ffffff"}
                    stroke={isAbnormalTemperature(point!.temp) ? "#dc2626" : "#365314"}
                    strokeWidth="2.5"
                    className="chart-point"
                  />
                  <title>
                    {formatDateTime(point!.record.timestamp)}: {point!.temp}℃
                    {point!.record.note ? ` - ${point!.record.note}` : ""}
                    {isAbnormalTemperature(point!.temp) ? " (异常值)" : ""}
                  </title>
                </g>
              ))}

              {xLabels.map((item, i) => (
                <text
                  key={i}
                  x={item.x}
                  y={paddingTop + innerHeight + 20}
                  textAnchor="middle"
                  className="chart-axis-text"
                >
                  {formatXLabel(item.record.timestamp)}
                </text>
              ))}
            </svg>
          </div>

          <div className="temperature-stats">
            <div className="stat-card stat-max">
              <span className="stat-label">最高温</span>
              <span className="stat-value">
                {stats.max !== null ? `${stats.max.toFixed(1)}℃` : "—"}
              </span>
            </div>
            <div className="stat-card stat-min">
              <span className="stat-label">最低温</span>
              <span className="stat-value">
                {stats.min !== null ? `${stats.min.toFixed(1)}℃` : "—"}
              </span>
            </div>
            <div className="stat-card stat-avg">
              <span className="stat-label">平均温度</span>
              <span className="stat-value">
                {stats.avg !== null ? `${stats.avg.toFixed(1)}℃` : "—"}
              </span>
            </div>
            <div className="stat-card stat-count">
              <span className="stat-label">有效记录</span>
              <span className="stat-value">{stats.count}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
