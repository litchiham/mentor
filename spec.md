# 产品需求文档 (PRD): Mentor

## 1. 产品概述

| 属性 | 描述 |
| :--- | :--- |
| **名称** | **Mentor** |
| **核心理念** | 像写 Word 文档一样做科研。线性历史，所见即所得，AI 全程代理。 |
| **目标用户** | 学生、研究员、数据科学家。 |
| **核心价值** | 消除实验试错成本，防止大数据重跑，专注逻辑而非调试。 |
| **设计风格** | **极简浅色 (Minimalist Light Mode)**。类 Apple/HIG 风格，内容为王。 |

---

## 2. 界面布局 (UI Layout)

采用经典的**左右分栏**布局，配合极简顶栏。


+---------------------------------------------------------------------------------+
Menu Bar (File, Edit, View, Run, Mentorship)
+--------------+------------------------------------------------------------------+

Notebook AI Chat (Mentor Agent)

Editor [ "Tell Mentor what to do..." ]

(Left)

[ 🔒 Freeze ]

+--------------+------------------------------------------------------------------+


### 2.1 左半栏：实验记录本 (The Paper)
*   **背景**: 纯白 (`#FFFFFF`)。
*   **Cell 样式**: 无边框或极细边框，代码区背景为极淡灰 (`#FAFAFA`)。
*   **Checkpoint 标记**: 位于 Cell 之间，视觉上是一条带有 ✻ 符号和时间戳的细分割线（例如：`———— ✻ Checkpoint: Raw Data (14:20) ————`）。

### 2.2 右半栏：Agent 控制台 (The Agent)
*   **背景**: 极淡灰 (`#F5F5F7`)，与左侧形成区分。
*   **交互**: 纯文本对话。Agent 接收指令并汇报执行结果。
*   **约束**: Agent **只能**修改或创建当前选中 Cell **及以后**的内容。

### 2.3 顶栏 (Menu Bar)
*   **风格**: 扁平化文字菜单，无图标。
*   **功能**: `File` (打开/保存), `Edit` (Undo/Redo), `View`, `Run`, `Mentorship`。

### 2.4 底部工具栏
*   **位置**: 左下角悬浮。
*   **按钮**: `[ 🔒 Freeze ]` (Outline 风格，点击后变绿)。

---

## 3. 核心交互逻辑

### 3.1 右键菜单 (Context Menu)
在 Cell 上右键点击，提供极简的编辑功能（仅 4 项）：
1.  **Insert Cell Above** (⌘⇧A)
2.  **Copy Cell** (⌘C)
3.  **Paste Cell Below** (⌘V)
4.  **Delete Cell** (⌫)

### 3.2 Checkpoint 链表 (Linked List)
这是产品的灵魂，采用**线性历史**结构，拒绝复杂的 Git 式分叉。

*   **数据结构**: 单向链表。`Head` 指向最新节点，每个节点包含 `prev` 指针、内存快照和 Cell 索引。
*   **覆盖规则 (Truncation)**:
    *   假设历史为 `A -> B -> C` (Current)。
    *   用户点击 Checkpoint B 回退。
    *   用户新建 Checkpoint D。
    *   **结果**: `A -> B -> D` (Current)。**C 自动失效**。
*   **读档 (Checkout)**: 点击 Checkpoint 标记，代码瞬间回退，Kernel 内存瞬间恢复（无需重跑）。

### 3.3 Agent 全权代理 (Agent Tooling)
**核心原则**: 凡是手动能做的，Agent 都能通过语音指令完成。

| 用户指令 (Voice) | Agent 执行动作 (Action) |
| :--- | :--- |
| "Freeze this state." / "打个快照" | 调用 `mentor.freeze()`，创建 Checkpoint。 |
| "Go back to [Name]." / "回退到..." | 调用 `mentor.checkout(id)`，恢复环境。 |
| "Add a new cell below." | 插入新 Cell。 |
| "Delete this cell." | 删除当前 Cell。 |
| "Undo that." | 触发 Jupyter Undo 并同步 Kernel 状态。 |
| "Plot a histogram of df." | 生成并执行代码。 |

---

## 4. 用户场景流 (User Flow)

1.  **加载**: 用户拖入数据或写代码加载。
2.  **存档**: 点击 `[ 🔒 Freeze ]` 或告诉 Agent "Freeze it"。命名为 "Raw Data"。
3.  **探索**: 让 Agent "Clean the null values" 或 "Train a model"。
4.  **失误**: Agent 生成了错误的代码，搞砸了 `df`。
5.  **回退**: 点击左侧的 "Raw Data" Checkpoint，瞬间回到加载完数据的状态。
6.  **重来**: 让 Agent "Try a different approach"，生成新代码。
7.  **覆盖**: 由于回退后新建了 Checkpoint，之前的错误尝试自动从历史中抹去。

---

## 5. 技术实施要点

<!-- 
  此处留空。
  请在开发阶段根据实际情况填写技术栈选型、架构图、API 设计等内容。
-->

---

## 6. 非功能需求

*   **性能**: v0.1 允许全量 Pickle (Naive)，后续版本需优化为 Arrow IPC + COW。


---