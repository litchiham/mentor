# Mentor

像写 Word 文档一样做科研。线性历史，所见即所得，AI 全程代理。

## 架构

```
mentor (CLI) ──启动──→ Jupyter Server (后端) + Vite Dev Server (前端)
                            │                         │
                        Python kernel              React SPA
                        .ipynb / .mentor/          浏览器访问 localhost:5173
```

- 前端：TypeScript + React + Vite（独立 SPA，非 JupyterLab 插件）
- 后端：Jupyter Server Extension（Tornado handlers）
- 内核状态：dill 序列化
- 通信：REST API + WebSocket（kernel）

## 安装

```bash
cd web && npm install
pip install -e .
```

## 启动

```bash
mentor
```

浏览器打开 `http://localhost:5173`。

## 功能

### 工作区

- **打开文件夹**：Ctrl+O 选择工作区目录，自动创建 `.mentor/` 存储元数据
- **自动恢复**：重启后自动打开上次工作区
- **保存**：Ctrl+S 保存 `.ipynb`（含 outputs）、工作区状态、聊天记录

### Notebook

- **Code 和 Markdown 单元格**：Alt+N 添加，Shift+Enter 执行
- **Cell 输出**：stream、display_data、execute_result、error，支持图片

### 执行模型（线性）

- **逐步执行 (▶)**：执行 red-line 处的下一个单元格
- **从头执行 (▶▶)**：执行从第一个单元格到当前位置
- **从 Checkpoint 执行 (⏭)**：从最近 checkpoint 恢复到当前位置
- **Shift+Enter**：触发"从 checkpoint 执行到此处"
- **Red-line**：标记下一个待执行单元格位置

### Blue-line（AI 可编辑边界）

- Blue-line 以上的单元格对 AI 只读，以下可编辑
- **拖拽** blue-line handle 调整位置
- **右键** blue-line：移动到顶端 / 底端
- **右键** 单元格：移动 blue-line 到该单元格之前
- Blue-line 可置于最后一个单元格之后（全部可编辑）

### Checkpoint 快照

- 点击 🔒 Freeze：保存当前内核状态（dill 序列化），标记在 red-line 上方
- 点击 checkpoint 标记：瞬间恢复内核状态 + 移动 red-line
- 恢复时自动截断后续 checkpoint（线性历史），清理孤儿 dill 文件
- 同一位置重复 freeze 无效

### Agent 对话

- 右侧面板与 AI 对话（支持 OpenAI 兼容 API）
- Agent 可添加/修改单元格、执行代码
- Blue-line 强制约束：Agent 不能修改线以上的单元格
- 设置中配置 API Key、Base URL、Model、Temperature

### 内核管理

- 底部状态栏显示内核连接状态
- 支持多内核规格（Python、R 等）
- 一键中断 / 重连内核

## 目录结构

```
{workspace}/
  .mentor/
    checkpoints/          # dill 快照 + checkpoints.json
    workspace.json        # blueLine + redLine 位置
    chat.json             # 聊天历史
  *.ipynb                 # notebook 文件
```

用户级配置：`~/.jupyter/mentor/config.json`（记录上次工作区路径）

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+O | 打开工作区 |
| Ctrl+S | 保存 |
| Alt+N | 新建单元格 |
| Shift+Enter | Run to Cell（从 checkpoint 执行到此处）|
| Ctrl+Shift+Enter | Run All |
| Ctrl+Z / Ctrl+Shift+Z | 撤销 / 重做 |
| Ctrl+\ | 切换 Agent 面板 |
