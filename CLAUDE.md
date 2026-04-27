# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

HSK 课程播放器 — 纯静态幻灯片播放器，支持语音旁白驱动切换、聚光灯聚焦效果、交互式练习题。所有课程数据存储在 `course.json` 中，由通用播放器加载。

---

## 常用命令

```bash
# 启动本地服务器（必须在 hsk-player 目录下）
cd /e/HSK课程/hsk-player
node tools/serve.js

# 创建新课程
node tools/new-course.js <course-id> --title "标题" [--desc "描述"]

# 添加幻灯片
node tools/add-slide.js <course-id> --type content --index N        # 内容页
node tools/add-slide.js <course-id> --type exercise --exerciseType choice --index N  # 练习题
node tools/add-slide.js <course-id> --type display --index N        # 生词页

# 删除幻灯片
node tools/add-slide.js <course-id> --delete --index N
```

**exerciseType**: `choice` | `listen` | `read` | `arrange` | `match` | `fill` | `trace`

**访问地址**:
- 课程列表：http://localhost:3000/
- 播放器：http://localhost:3000/player.html?course=<id>
- 课程制作：http://localhost:3000/admin.html

---

## 架构概览

### 播放器（player.html + js/player.js）

- **iframe 叠加**：所有 slide 预加载为 iframe，叠加在同一个 1200×675 容器中（video 类型延迟到切换时加载）
- **交叉淡入淡出**：CSS `transition: opacity 0.6s ease` + `z-index` 分层（active=2, inactive=1）
- **父→子通信**：`postMessage` 发送 `{ type: 'slideData' | 'spotlight' | 'spotlightClear' }`
- **子→父通信**：slide 通过 `{ type: 'playerMessage', action: 'exerciseDone' }` 回报

### 三种自动切换模式

| slide 类型 | 音频 | 行为 |
|-----------|------|------|
| content | 有 | 音频 `onended` 触发下一页 |
| content | 无 | 5 秒计时器自动切换，聚光灯按 `at` 时间顺序触发 |
| exercise | — | 音频播完显示确认按钮，学生手动点确认才切换 |

### 聚光灯（spotlight.js）

- 有音频：`audio.ontimeupdate` 中调用 `checkSpotlights(currentTime)`，到达 `at` 秒数触发
- 无音频：`runSpotlightSequence()` 按 `at` 顺序轮询触发
- 切换页面时 player 发送 `spotlightClear` 清除
- Spotlight 的容器是 `document.body`，覆盖在整个 slide 上

### 伴学助手（subtitles）

课程页可配置 `subtitles` 数组，在指定时间显示字幕提示：

```json
"subtitles": [{ "at": 1.0, "text": "字幕文本" }]
```

---

## course.json 结构

```json
{
  "id": "course-slug",
  "title": "标题",
  "slides": [
    {
      "index": 1,
      "type": "content",
      "title": "第 1 页",
      "audio": "narration/1.mp3",
      "backgroundImage": "pptimg/bg1.png",
      "spotlights": [{ "elementId": "zone-1", "at": 0, "duration": 2 }],
      "spotlightZones": [{ "elementId": "zone-1", "x": 10, "y": 20, "w": 25, "h": 30 }],
      "subtitles": [{ "at": 1.0, "text": "字幕" }]
    },
    {
      "index": 2,
      "type": "exercise",
      "exerciseType": "choice",
      "audio": "intro.mp3",
      "questions": [{
        "id": "q1",
        "type": "choice",
        "question": "题目",
        "options": [{ "id": "A", "text": "选项" }],
        "answer": "A"
      }]
    },
    {
      "index": 3,
      "type": "display",
      "vocab": [{ "id": "w1", "hanzi": "请问", "pinyin": "qǐng wèn", "pos": "v.", "en": "excuse me", "audio": "vocab/w1.wav" }],
      "showPinyin": true,
      "showEnglish": true
    }
  ]
}
```

**content 类型字段说明：**
- `audio`：旁白音频路径（相对于 `audio/` 目录）
- `backgroundImage`：背景图路径（相对于课程根目录，如 `pptimg/bg.png`）
- `spotlights[]`：聚光灯触发配置，`at` 单位为秒
- `spotlightZones[]`：热区坐标（百分比），供 admin 热区编辑器使用
- `subtitles[]`：伴学助手字幕

**注意：** `originals/` 目录已改名为 `pptimg/`。

---

## 关键设计决策

1. **slide HTML 是完全独立的**：不管理音频、不处理切换逻辑，只负责展示。数据由 player 通过 postMessage 注入。
2. **iframe 懒加载**：普通 slide 在 `buildIframes` 时设置 `src`；video 类型延迟到切换到该页时才设置 `src`。改变这个逻辑会破坏淡入淡出。
3. **`playing` 全局标志**：所有计时器、轮询、音频恢复都必须检查 `if (!playing) return`。这是暂停/恢复机制的核心。
4. **聚光灯 `elementId` 必须与 HTML 中 `id` 属性完全一致**，player 直接透传给 `Spotlight.spotlight(elementId)`。
5. **工具脚本是 Node.js 但应用本身是纯静态**：无构建步骤，任何静态服务器都能部署。

---

## 目录结构

```
hsk-player/
├── player.html           # 播放器外壳
├── index.html            # 课程列表
├── admin.html            # 课程制作工具（可视化编辑）
├── js/
│   ├── player.js         # 核心逻辑（iframe、音频、计时器、postMessage）
│   ├── spotlight.js      # 聚光灯效果（SVG mask）
│   ├── exercise.js       # 练习题入口
│   ├── shared.js         # 通用工具
│   ├── templates.js      # 幻灯片 HTML 模板
│   └── exercise/
│       ├── types/        # 各题型实现（choice, arrange, match, trace, fill）
│       ├── progress.js   # 星星评分动画
│       ├── celebration.js # 答对庆祝动画
│       └── sound.js      # 音效
├── css/
│   ├── player.css        # 播放器样式
│   ├── admin.css         # 制作工具样式
│   ├── exercise.css      # 练习题样式
│   └── shared.css        # CSS 变量 + reset
├── tools/
│   ├── serve.js          # 本地服务器（含 API）
│   ├── new-course.js     # 创建新课程脚手架
│   ├── add-slide.js      # 添加 / 删除幻灯片
│   ├── author-api.js     # 课程制作 API 路由
│   └── schema.js         # course.json 字段参考
└── courses/              # 所有课程数据
    └── <course-id>/
        ├── course.json
        ├── slides/       # 每页幻灯片 HTML（n.html）
        ├── audio/        # 音频文件（narration/, vocab/, exercise/, video/）
        └── pptimg/       # 背景图 / 原始图片
```