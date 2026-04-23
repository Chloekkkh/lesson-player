# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 项目概述

HSK 课程播放器 — 一个纯静态的幻灯片播放器，支持语音旁白驱动切换、练习题交互、聚光灯聚焦效果。所有课程数据存储在 `course.json` 中，由一个通用播放器加载。

---

## 常用命令

```bash
# 启动本地服务器（必须在 hsk-player 目录下）
cd /e/HSK课程/hsk-player
node tools/serve.js

# 创建新课程
node tools/new-course.js <course-id> --title "标题" [--desc "描述"]

# 添加内容页
node tools/add-slide.js <course-id> --type content --index N

# 添加练习题
node tools/add-slide.js <course-id> --type exercise --exerciseType choice --index N
# exerciseType: choice | truefalse | fill | matching

# 访问地址
http://localhost:3000/                         # 课程列表
http://localhost:3000/player.html?course=<id>  # 播放指定课程
```

---

## 架构概览

### 播放器（player.html + js/player.js）

- **iframe 叠加**：所有 slide 同时预加载为 iframe，叠加在同一个 1200×675 容器中
- **交叉淡入淡出**：CSS `transition: opacity 0.6s ease` + `z-index` 分层（active=2, inactive=1）
- **父→子通信**：`postMessage` 发送 `{ type: 'slideData' | 'spotlight' | 'spotlightClear' }`
- **子→父通信**：slide 通过 `{ type: 'playerMessage', action: 'exerciseDone' }` 回报

### 三种自动切换模式

| slide 类型 | 音频 | 行为 |
|-----------|------|------|
| content | 有 | 音频 `onended` 触发下一页 |
| content | 无 | 5 秒计时器自动切换，聚光灯按 `at` 时间顺序触发 |
| exercise | - | 音频播完显示确认按钮，学生手动点确认才切换 |

### 聚光灯（spotlight.js）

- 有音频：`audio.ontimeupdate` 中调用 `checkSpotlights(currentTime)`，到达 `at` 秒数触发
- 无音频：`runSpotlightSequence()` 按 `at` 顺序轮询触发
- 切换页面时 player 发送 `spotlightClear` 清除
- Spotlight 的容器是 `document.body`，覆盖在整个 slide 上

### course.json 结构

```json
{
  "id": "course-slug",
  "title": "标题",
  "slides": [
    {
      "index": 1,
      "type": "content",
      "audio": "1.mp3",
      "spotlights": [
        { "elementId": "html元素的id", "at": 1.5 }
      ]
    },
    {
      "index": 2,
      "type": "exercise",
      "exerciseType": "choice",
      "question": "题目",
      "options": [{ "id": "A", "text": "选项" }],
      "answer": "A"
    }
  ]
}
```

`spotlights[]` 只在 content 类型下使用，`at` 单位为秒。

---

## 关键设计决策

1. **slide HTML 是完全独立的**：不管理音频、不处理切换逻辑，只负责展示。数据由 player 通过 postMessage 注入。
2. **iframe 预加载**：`buildIframes` 时即设置所有 iframe 的 `src`，后续只用 CSS class 控制显隐。改变这个逻辑会破坏淡入淡出。
3. **`playing` 全局标志**：所有计时器、轮询、音频恢复都必须检查 `if (!playing) return`。这是暂停/恢复机制的核心。
4. **聚光灯 `elementId` 必须与 HTML 中 `id` 属性完全一致**，player 直接透传给 `Spotlight.spotlight(elementId)`。
5. **工具脚本是 Node.js 但应用本身是纯静态**：无构建步骤，任何静态服务器都能部署。

---

## 目录结构

```
hsk-player/
├── player.html          # 播放器外壳
├── index.html           # 课程列表
├── js/
│   ├── player.js        # 核心逻辑（iframe、音频、计时器、postMessage）
│   ├── spotlight.js     # 聚光灯效果（SVG mask）
│   ├── exercise.js      # 练习题交互
│   └── shared.js        # 通用工具
├── css/
│   ├── player.css       # 播放器样式
│   ├── exercise.css     # 练习题样式
│   └── shared.css       # CSS 变量 + reset
├── tools/
│   ├── serve.js         # 本地服务器
│   ├── new-course.js    # 创建新课程
│   ├── add-slide.js     # 添加幻灯片
│   └── schema.js        # course.json schema 文档
└── courses/             # 所有课程数据
    └── <course-id>/
        ├── course.json
        ├── slides/
        │   └── n.html
        └── audio/
```
