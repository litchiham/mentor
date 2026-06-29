# Mentor

像写 Word 文档一样做科研。线性历史，所见即所得，AI 全程代理。

## 安装

```bash
pip install mentor
```

开发模式：

```bash
pip install -e .
jupyter labextension develop . --overwrite
```

## 启动

```bash
jupyter lab
```

## 功能

- **Checkpoint 快照** — 点击 🔒 Freeze 一键保存内核状态，无需重跑
- **瞬间回退** — 点击 checkpoint 标记，代码和环境瞬间恢复
- **线性历史** — 回退后新建 checkpoint，旧分支自动失效
- **Agent 对话** — 右侧面板与 AI 对话，Agent 可操作当前 cell 及之后的内容

## 技术栈

- 前端：TypeScript + React + JupyterLab 4.x Extension API
- 后端：Python + Jupyter Server Extension
- 内核状态：dill 序列化
