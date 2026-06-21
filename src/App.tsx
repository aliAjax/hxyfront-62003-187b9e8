import { useState, useEffect } from "react";
import "./styles.css";
import BatchForm from "./BatchForm";
import BatchList from "./BatchList";
import {
  SampleBatch,
  loadBatches,
  saveBatches,
} from "./batchStorage";

const project = {
  "sourceNo": 5,
  "id": "hxyfront-62003",
  "port": 62003,
  "title": "法医昆虫学样本记录",
  "domain": "法医昆虫学",
  "prompt": "做一个法医昆虫学样本记录前端工具，用来记录采样地点、环境温度、尸体暴露阶段、昆虫种类、发育阶段、采样时间、保存方式和鉴定备注。页面需要有样本批次列表、发育阶段筛选、温度记录图、案件样本关联页和单个样本详情卡片。",
  "palette": [
    "#365314",
    "#a16207",
    "#dc2626"
  ],
  "metrics": [
    "样本批次",
    "平均温度",
    "发育阶段",
    "待鉴定"
  ],
  "filters": [
    "卵",
    "幼虫",
    "蛹",
    "成虫"
  ],
  "fields": [
    "采样地点",
    "环境温度",
    "暴露阶段",
    "昆虫种类",
    "发育阶段",
    "保存方式"
  ],
  "records": [
    [
      "CASE-042-A",
      "室外草地",
      "幼虫三龄，28.6℃",
      "乙醇保存"
    ],
    [
      "CASE-042-B",
      "阴影区域",
      "蛹期样本",
      "需复核种属"
    ],
    [
      "CASE-051-A",
      "水沟边缘",
      "成虫采集",
      "已完成拍照"
    ]
  ]
};

function App() {
  const [batches, setBatches] = useState<SampleBatch[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setBatches(loadBatches());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      saveBatches(batches);
    }
  }, [batches, isLoaded]);

  const handleCreateBatch = (newBatch: SampleBatch) => {
    setBatches((prev) => [newBatch, ...prev]);
  };

  const handleDeleteBatch = (id: string) => {
    setBatches((prev) => prev.filter((b) => b.id !== id));
  };

  const totalSamples = batches.reduce((sum, b) => sum + b.sampleCount, 0);
  const avgTemp = batches.length > 0
    ? (
        batches
          .map((b) => parseFloat(b.environmentTemperature))
          .filter((t) => !isNaN(t))
          .reduce((sum, t, _, arr) => sum + t / arr.length, 0)
      ).toFixed(1)
    : "—";

  const dynamicMetrics = [
    { label: project.metrics[0], value: batches.length },
    { label: project.metrics[1], value: avgTemp },
    { label: project.metrics[2], value: new Set(batches.map((b) => b.exposureStage).filter(Boolean)).size },
    { label: project.metrics[3], value: totalSamples },
  ];

  return (
    <main className="app">
      <section className="hero">
        <p>{project.id} · 源提示词{project.sourceNo} · Port {project.port}</p>
        <h1>{project.title}</h1>
        <span>{project.prompt}</span>
      </section>

      <section className="metrics">
        {dynamicMetrics.map((item, index: number) => (
          <article key={item.label}>
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="workspace">
        <aside className="panel">
          <h2>{project.domain}筛选</h2>
          <div className="chips">
            {project.filters.map((item: string) => (
              <button key={item}>{item}</button>
            ))}
          </div>
        </aside>

        <BatchForm onSubmit={handleCreateBatch} />
      </section>

      {isLoaded && <BatchList batches={batches} onDelete={handleDeleteBatch} />}

      <section className="panel" style={{ marginTop: "18px" }}>
        <div className="heading">
          <div>
            <p>历史记录</p>
            <h2>近期工作台</h2>
          </div>
          <button>导出摘要</button>
        </div>
        <div className="records">
          {project.records.map((record: string[], index: number) => (
            <article key={record.join("-")}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <div>
                <h3>{record[0]}</h3>
                <p>{record.slice(1).join(" · ")}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
