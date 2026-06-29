# Mentor Agent 能力拓展规划

## a. 命令执行

当前 Agent 不支持。需要新增 `run_command` action 类型，命令转发给 kernel 或后端执行，输出回流到 cell。

## b. Plugin 系统

### 架构

采用类 MCP 协议：

```
Agent (LLM)
  ↓ tool calls
Tool Registry (mentor server)
  ├── built-in tools
  └── plugins/
      ├── plugin-name/
      │     ├── plugin.json       # metadata
      │     ├── tools/            # Python 工具函数、ONNX 模型
      │     └── data/             # 本地数据文件
      └── ...
```

### plugin.json 统一格式

```json
{
  "name": "planetary-science",
  "version": "1.0.0",
  "description": "Crater dating, spectral analysis, DEM processing",
  "tools": [
    {
      "name": "crater_dating",
      "description": "Estimate surface age from crater SFD using Neukum chronology",
      "parameters": {
        "type": "object",
        "properties": {
          "diameter_km": { "type": "number" },
          "count_per_area": { "type": "number" }
        },
        "required": ["diameter_km", "count_per_area"]
      }
    }
  ],
  "data_sources": [
    {
      "name": "mola_dem",
      "type": "raster",
      "description": "MOLA elevation map, 463m/pixel",
      "uri": "file://./data/mola_463m.tif"
    }
  ],
  "nn_models": [
    {
      "name": "crater_classifier",
      "framework": "onnx",
      "description": "CNN crater detection in THEMIS imagery",
      "uri": "file://./models/classifier.onnx",
      "input_shape": [1, 3, 256, 256],
      "labels": ["crater", "no_crater"]
    }
  ],
  "requires": ["numpy", "onnxruntime", "rasterio"]
}
```

- metadata 同时用于 Python 端加载和注入 LLM system prompt 作为 tool definition
- 启动时扫描所有 plugin.json，校验并加载
- 卸载仅需移除目录
- 工具执行建议独立进程隔离（subprocess/docker），超时 kill

## c. 上下文管理与缓存优化

### 前缀结构（最大化缓存命中）

```
[System Prompt — 不变]
  ↑ 永久缓存

[Tool Definitions — 当前启用的 plugins schemas]
  ↑ 仅 plugins 变化时 invalidate

[Notebook State Summary — cells 概览]
  ↑ 每轮更新

[Conversation — 压缩历史 + 最近消息]
  ↑ 动态变化
```

### 对话压缩

- 超出阈值时保留最近 N 轮完整消息
- 更早消息用 LLM 摘要替代
- Notebook cells 仅在变化时包含完整内容

### 窗口管理

```
window = [
  system_prompt,        # ~2K tokens
  tool_definitions,     # ~1-3K tokens
  notebook_summary,     # ~0.5-2K tokens
  compressed_history,   # 填充剩余空间
  recent_messages,      # 最近 5 轮
]
```

## d. Agent 行动实时展示

从单一 JSON 回复改为 SSE 流式事件：

```
event: thinking     → 灰色可折叠文字
event: tool_call    → 工具卡片（spinner / done / error）
event: tool_result  → 工具结果
event: cell_edit    → "Added cell [4]" 可点击跳转
event: message      → 对话气泡
```

前端 `chatStore` 支持流式追加，不同类型用不同组件渲染。

## 实施优先级

1. **上下文管理 (c)** — 改动小、影响大
2. **流式展示 (d)** — SSE 改造 + UI 组件
3. **Plugin 系统 (b)** — 先单 tool MVP → 单 plugin → 泛化
4. **命令执行 (a)** — 做 b/d 时自然覆盖
