import { useMemo } from "react";
import {
  TemperatureRecord,
  getSortedTemperatureRecords,
  calculateTemperatureStats,
  formatDateTime,
  isAbnormalTemperature,
} from "./batchStorage";

interface ChartSeries {
  sampleNumber: string;
  records: TemperatureRecord[];
}

const SERIES_COLORS = [
  "#2563eb",
  "#a16207",
  "#dc2626",
  "#7c3aed",
  "#059669",
  "#d946ef",
  "#ea580c",
  "#0891b2",
];

interface TemperatureChartProps {
  records: TemperatureRecord[];
  series?: ChartSeries[];
  title?: string;
}

export default function TemperatureChart({
  records,
  series,
  title = "温度记录图",
}: TemperatureChartProps) {
  const isMultiSeries = series && series.length > 0;

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

  const singleSeriesData = useMemo(() => {
    if (isMultiSeries) return null;
    const sortedRecords = getSortedTemperatureRecords(records);
    if (sortedRecords.length === 0) return { points: [], yTicks: [], xLabels: [], sortedRecords: [] };

    const temps = sortedRecords
      .map((r) => parseFloat(r.temperature))
      .filter((t) => !isNaN(t));
    if (temps.length === 0) return { points: [], yTicks: [], xLabels: [], sortedRecords };

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
      const x = paddingLeft + (sortedRecords.length === 1 ? innerWidth / 2 : (innerWidth * index) / (sortedRecords.length - 1));
      const y = paddingTop + innerHeight - ((temp - minTemp) / tempRange) * innerHeight;
      return { x, y, record, temp };
    });

    const maxLabels = 6;
    const step = Math.max(1, Math.ceil(sortedRecords.length / maxLabels));
    const xLabels = sortedRecords
      .map((record, index) => ({
        record,
        index,
        x: paddingLeft + (sortedRecords.length === 1 ? innerWidth / 2 : (innerWidth * index) / (sortedRecords.length - 1)),
      }))
      .filter((_, i) => i % step === 0 || i === sortedRecords.length - 1);

    return { points: points.filter(Boolean), yTicks, xLabels, sortedRecords };
  }, [records, isMultiSeries, innerWidth, innerHeight, paddingLeft, paddingTop]);

  const multiSeriesData = useMemo(() => {
    if (!isMultiSeries) return null;

    const allTemps: number[] = [];
    const allTimestamps: number[] = [];

    series!.forEach((s) => {
      s.records.forEach((r) => {
        const t = parseFloat(r.temperature);
        if (!isNaN(t)) allTemps.push(t);
        const ts = new Date(r.timestamp).getTime();
        if (!isNaN(ts)) allTimestamps.push(ts);
      });
    });

    if (allTemps.length === 0) return { lines: [], yTicks: [], xLabels: [] };

    const minTemp = Math.floor(Math.min(...allTemps) - 2);
    const maxTemp = Math.ceil(Math.max(...allTemps) + 2);
    const tempRange = maxTemp - minTemp || 1;

    const yTickCount = 5;
    const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => {
      const value = minTemp + (tempRange * i) / yTickCount;
      return {
        value: Math.round(value * 10) / 10,
        y: paddingTop + innerHeight - (innerHeight * i) / yTickCount,
      };
    });

    const globalMinTs = Math.min(...allTimestamps);
    const globalMaxTs = Math.max(...allTimestamps);
    const tsRange = globalMaxTs - globalMinTs || 1;

    const lines = series!.map((s, seriesIdx) => {
      const color = SERIES_COLORS[seriesIdx % SERIES_COLORS.length];
      const sorted = getSortedTemperatureRecords(s.records);
      const points = sorted.map((record) => {
        const temp = parseFloat(record.temperature);
        const ts = new Date(record.timestamp).getTime();
        if (isNaN(temp) || isNaN(ts)) return null;
        const x = paddingLeft + ((ts - globalMinTs) / tsRange) * innerWidth;
        const y = paddingTop + innerHeight - ((temp - minTemp) / tempRange) * innerHeight;
        return { x, y, record, temp };
      }).filter(Boolean);

      const pathD = points.length >= 2
        ? points.map((p, i) => (i === 0 ? `M ${p!.x} ${p!.y}` : `L ${p!.x} ${p!.y}`)).join(" ")
        : "";

      const areaD = points.length >= 2
        ? `M ${points[0]!.x} ${paddingTop + innerHeight} L ${points[0]!.x} ${points[0]!.y} ${pathD.substring(1)} L ${points[points.length - 1]!.x} ${paddingTop + innerHeight} Z`
        : "";

      return { sampleNumber: s.sampleNumber, color, points, pathD, areaD };
    });

    const maxLabels = 6;
    const allSortedRecords = getSortedTemperatureRecords(records);
    const step = Math.max(1, Math.ceil(allSortedRecords.length / maxLabels));
    const xLabels = allSortedRecords
      .map((record) => {
        const ts = new Date(record.timestamp).getTime();
        if (isNaN(ts)) return null;
        return {
          record,
          x: paddingLeft + ((ts - globalMinTs) / tsRange) * innerWidth,
        };
      })
      .filter((_, i) => _ !== null && (i % step === 0 || i === allSortedRecords.length - 1))
      .map((item) => item!);

    return { lines, yTicks, xLabels };
  }, [series, records, isMultiSeries, innerWidth, innerHeight, paddingLeft, paddingTop]);

  const yTicks = isMultiSeries ? multiSeriesData!.yTicks : singleSeriesData!.yTicks;
  const xLabels = isMultiSeries ? multiSeriesData!.xLabels : singleSeriesData!.xLabels;

  const formatXLabel = (timestamp: string) => {
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${month}/${day} ${hours}:${minutes}`;
  };

  const hasData = records.length > 0;

  return (
    <div className="temperature-chart-container">
      {title && (
        <div className="chart-header">
          <h3 className="section-title">{title}</h3>
          <span className="chart-record-count">
            共 {records.length} 条记录
          </span>
        </div>
      )}

      {!hasData ? (
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
                  <stop offset="0%" stopColor="#365314" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#365314" stopOpacity="0.02" />
                </linearGradient>
                {isMultiSeries && multiSeriesData!.lines.map((line, i) => (
                  <linearGradient key={i} id={`areaGradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={line.color} stopOpacity="0.15" />
                    <stop offset="100%" stopColor={line.color} stopOpacity="0.02" />
                  </linearGradient>
                ))}
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

              {isMultiSeries ? (
                <>
                  {multiSeriesData!.lines.map((line, lineIdx) => (
                    <g key={lineIdx}>
                      {line.areaD && (
                        <path d={line.areaD} fill={`url(#areaGradient-${lineIdx})`} />
                      )}
                      {line.pathD && (
                        <path
                          d={line.pathD}
                          fill="none"
                          stroke={line.color}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                      {line.points.map((point, pi) => (
                        <g key={pi}>
                          <circle
                            cx={point!.x}
                            cy={point!.y}
                            r={isAbnormalTemperature(point!.temp) ? 6 : 4}
                            fill={isAbnormalTemperature(point!.temp) ? "#dc2626" : "#ffffff"}
                            stroke={isAbnormalTemperature(point!.temp) ? "#dc2626" : line.color}
                            strokeWidth="2"
                            className="chart-point"
                          />
                          <title>
                            {line.sampleNumber} · {formatDateTime(point!.record.timestamp)}: {point!.temp}℃
                            {point!.record.note ? ` - ${point!.record.note}` : ""}
                            {isAbnormalTemperature(point!.temp) ? " (异常值)" : ""}
                          </title>
                        </g>
                      ))}
                    </g>
                  ))}
                </>
              ) : (
                <>
                  {singleSeriesData!.points.length >= 2 && (() => {
                    const pts = singleSeriesData!.points;
                    const pathD = pts.map((p, i) => (i === 0 ? `M ${p!.x} ${p!.y}` : `L ${p!.x} ${p!.y}`)).join(" ");
                    const bottomY = paddingTop + innerHeight;
                    const areaD = `M ${pts[0]!.x} ${bottomY} L ${pts[0]!.x} ${pts[0]!.y} ${pathD.substring(1)} L ${pts[pts.length - 1]!.x} ${bottomY} Z`;
                    return (
                      <>
                        <path d={areaD} fill="url(#areaGradient)" />
                        <path
                          d={pathD}
                          fill="none"
                          stroke="#365314"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </>
                    );
                  })()}
                  {singleSeriesData!.points.map((point, i) => (
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
                </>
              )}

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

          {isMultiSeries && (
            <div className="chart-legend">
              {multiSeriesData!.lines.map((line, i) => (
                <div key={i} className="legend-item">
                  <span
                    className="legend-color"
                    style={{ backgroundColor: line.color }}
                  />
                  <span className="legend-label">{line.sampleNumber}</span>
                </div>
              ))}
            </div>
          )}

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
