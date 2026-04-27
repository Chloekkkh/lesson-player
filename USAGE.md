# HSK 课程播放器 — 使用说明

## 项目概述

HSK 课程播放器是一个**纯静态**的幻灯片课程系统，支持：

- 语音旁白驱动幻灯片自动切换
- 聚光灯（Spotlight）聚焦效果，在指定时间高亮页面元素
- 交互式练习题（选择题、判断题、填空题、连词成句、连线配对、汉字描红）
- 伴学助手字幕提示
- 响应式缩放，适配不同屏幕尺寸

---

## 快速开始

### 1. 启动本地服务器

```bash
cd /e/HSK课程/hsk-player
node tools/serve.js
```

然后访问：
- **课程列表**：http://localhost:3000/
- **播放器**（以 lesson-thanks 为例）：http://localhost:3000/player.html?course=lesson-thanks
- **课程制作**：http://localhost:3000/admin.html

> 注意：必须通过服务器访问，直接打开 `file://` 路径会导致 iframe 和音频无法正常加载。

---

## 目录结构

```
hsk-player/
├── index.html              # 课程列表首页
├── player.html             # 播放器外壳
├── admin.html              # 课程制作工具（可视化编辑）
├── js/
│   ├── player.js           # 播放器核心逻辑
│   ├── spotlight.js        # 聚光灯效果（SVG mask）
│   ├── exercise.js          # 练习题入口
│   ├── shared.js           # 通用工具函数
│   ├── templates.js        # 幻灯片 HTML 模板
│   └── exercise/
│       ├── types/          # 各题型实现（choice, truefalse, arrange, match, fill, trace）
│       ├── progress.js     # 星星评分动画
│       ├── celebration.js   # 答对庆祝动画
│       └── sound.js        # 音效
├── css/
│   ├── player.css          # 播放器样式
│   ├── exercise.css        # 练习题样式
│   └── shared.css          # 全局 CSS 变量 + reset
├── tools/
│   ├── serve.js            # 本地服务器（含 API）
│   ├── new-course.js       # 创建新课程脚手架
│   ├── add-slide.js        # 添加 / 删除幻灯片
│   ├── author-api.js        # 课程制作 API 路由
│   └── schema.js           # course.json 字段参考文档
└── courses/                # 所有课程数据
    └── <course-id>/
        ├── course.json     # 课程配置（幻灯片顺序、音频、题目）
        ├── slides/         # 每页幻灯片 HTML 文件（1.html, 2.html, ...）
        ├── audio/          # 音频文件（narration/、vocab/、exercise/、video/）
        └── pptimg/        # 背景图 / 原始图片
```

---

## 创建新课程

```bash
node tools/new-course.js <course-id> --title "课程标题" [--desc "课程描述"]
```

示例：

```bash
node tools/new-course.js lesson-greeting --title "问候语" --desc "HSK1 问候语学习"
```

这会在 `courses/lesson-greeting/` 下创建：

```
courses/lesson-greeting/
├── course.json          # 空课程配置（包含第 1 页脚手架）
├── slides/1.html        # 第 1 页 HTML
├── audio/
└── originals/
```

---

## 添加幻灯片

### 添加内容页

```bash
node tools/new-course.js <course-id> --type content --index N
```

### 添加练习题页

```bash
node tools/new-course.js <course-id> --type exercise --exerciseType <type> --index N
```

**exerciseType 可选值：**

| exerciseType | 说明 |
|---|---|
| `choice` | 选择题（传统题型，player.js 控制） |
| `listen` | 听音识词（播放音频后选词） |
| `read` | 阅读理解（选择题） |
| `truefalse` | 判断题（对/错） |
| `arrange` | 连词成句（拖拽词语排成句子） |
| `match` / `matching` | 连线配对（左右词语一一对应，兼容两种名称） |
| `fill` | 填空练习 |
| `trace` | 汉字描红（使用 hanzi-writer） |

> **注意**：`index` 为插入位置。如果该位置已有幻灯片，后续所有页面会自动后移。

### 删除幻灯片

```bash
node tools/add-slide.js <course-id> --delete --index N
```

---

## course.json 字段参考

### 内容页（content）

```json
{
  "index": 1,
  "type": "content",
  "title": "谢谢 — Expressing Thanks",
  "audio": "narration/1.mp3",
  "backgroundImage": "pptimg/bg1.png",
  "spotlights": [
    { "elementId": "word-xie", "at": 1, "duration": 2 },
    { "elementId": "tone-4",  "at": 10, "duration": 2 }
  ],
  "spotlightZones": [
    { "elementId": "zone-1", "x": 4.2, "y": 25.2, "w": 27.3, "h": 28.2 }
  ],
  "subtitles": [
    { "at": 1.0, "text": "大家好，今天我们学习谢谢怎么说" }
  ]
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `index` | 是 | 页码（从 1 开始，与 HTML 文件名对应） |
| `type` | 是 | 固定为 `content` |
| `audio` | 否 | 相对路径，如 `narration/1.mp3`。有音频则音频播完自动翻页，无音频则 5 秒计时器自动翻页 |
| `backgroundImage` | 否 | 背景图路径（相对于课程根目录，如 `pptimg/bg.png`） |
| `spotlights` | 否 | 聚光灯配置数组 |
| `spotlights[].elementId` | 是 | HTML 页面中**元素的 id**（必须完全一致） |
| `spotlights[].at` | 是 | 触发时间（秒），相对于音频开始播放的时间 |
| `spotlights[].duration` | 否 | 聚光灯持续时间（秒），默认 1.5 秒 |
| `spotlightZones` | 否 | 热区坐标（百分比），供 admin 热区编辑器使用 |
| `subtitles` | 否 | 伴学助手字幕，在对应时间显示 |

### 练习题页（exercise）

#### 新型题型（questions 数组）

```json
{
  "index": 4,
  "type": "exercise",
  "exerciseType": "read",
  "audio": "intro.mp3",
  "questions": [
    {
      "id": "q1",
      "type": "choice",
      "question": "当别人帮助了你，你应该说什么？",
      "options": [
        { "id": "A", "text": "你好" },
        { "id": "B", "text": "谢谢" },
        { "id": "C", "text": "再见" }
      ],
      "answer": "B"
    }
  ]
}
```

#### 旧式题型（legacy）

```json
{
  "index": 4,
  "type": "exercise",
  "exerciseType": "choice",
  "audio": "intro.mp3",
  "question": "当别人帮助了你，你应该说什么？",
  "options": [
    { "id": "A", "text": "你好" },
    { "id": "B", "text": "谢谢" },
    { "id": "C", "text": "再见" }
  ],
  "answer": "B"
}
```

旧式使用 `question`（单题）而非 `questions[]`（多题数组），系统兼容两种格式。

#### 连词成句（arrange）

```json
{
  "id": "q2",
  "type": "arrange",
  "question": "排列成正确的句子",
  "words": ["请问", "你", "叫", "什么", "名字"],
  "pinyinMap": {
    "请问": "qǐng wèn",
    "你": "nǐ"
  },
  "answer": ["请问", "你", "叫", "什么", "名字"]
}
```

#### 连线配对（match）

```json
{
  "id": "q3",
  "type": "match",
  "pairs": [
    { "left": "谢谢", "right": "thank you" },
    { "left": "不客气", "right": "you're welcome" }
  ]
}
```

#### 填空（fill）

```json
{
  "id": "q4",
  "type": "fill",
  "question": "请问，你叫什么 _____ ？",
  "answer": "名字"
}
```

#### 汉字描红（trace）

```json
{
  "id": "q5",
  "type": "trace",
  "char": "三",
  "stars": { "1": 0.3, "2": 0.6, "3": 0.85 }
}
```

#### 生词页（display）

```json
{
  "index": 2,
  "type": "display",
  "title": "生词学习",
  "vocab": [
    { "id": "w1", "hanzi": "请问", "pinyin": "qǐng wèn", "pos": "v.", "en": "excuse me", "audio": "vocab/w1.wav" }
  ],
  "showPinyin": true,
  "showEnglish": true,
  "hasRecording": true
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `vocab[].id` | 是 | 词汇唯一标识 |
| `vocab[].hanzi` | 是 | 汉字 |
| `vocab[].pinyin` | 是 | 拼音 |
| `vocab[].pos` | 否 | 词性（如 `v.`） |
| `vocab[].en` | 否 | 英文释义 |
| `vocab[].audio` | 否 | 发音音频路径 |
| `showPinyin` | 否 | 是否显示拼音，默认 `true` |
| `showEnglish` | 否 | 是否显示英文，默认 `true` |
| `hasRecording` | 否 | 是否启用录音跟读功能，默认 `false` |

### 对话课（dialogue）

```json
{
  "index": 6,
  "type": "dialogue",
  "title": "情景对话",
  "audio": "dialogue/1.mp3",
  "speakers": [
    { "id": "A", "name": "老师", "avatar": "avatars/teacher.png" },
    { "id": "B", "name": "学生", "avatar": "avatars/student.png" }
  ],
  "image": "pptimg/content1.PNG",
  "showText": true,
  "showPinyin": true,
  "showEnglish": false,
  "hasRolePlay": true,
  "lines": [
    { "speaker": "A", "start": 0.0, "end": 3.5, "hanzi": "你好！我叫王明。",
      "pinyin": "nǐ hǎo! wǒ jiào wáng míng.", "en": "Hello! My name is Wang Ming." }
  ],
  "vocabList": [
    { "hanzi": "叫", "pinyin": "jiào", "pos": "v.", "en": "be called as" }
  ]
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `type` | 是 | 固定为 `dialogue` |
| `speakers` | 是 | 角色数组，`id` 与 `lines[].speaker` 对应 |
| `lines[].speaker` | 是 | 所属角色 ID |
| `lines[].start / end` | 是 | 该句在音频中的起止时间（秒） |
| `lines[].hanzi / pinyin / en` | 是 | 台词内容 |
| `showText / showPinyin / showEnglish` | 否 | 控制显示开关，默认均为 `true` |
| `hasRolePlay` | 否 | 是否显示角色扮演练习按钮，默认 `true` |
| `vocabList` | 否 | 词汇表（点击高亮用） |

> 对话课由 iframe 自己管理音频，播完后发送 `displayComplete`；角色扮演完成后发送 `rolePlayComplete` 触发自动翻页。

### 视频课（video）

```json
{
  "index": 5,
  "type": "video",
  "video": "video/demo.mp4",
  "title": "视频学习"
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `type` | 是 | 固定为 `video` |
| `video` | 是 | 视频路径（相对于 `audio/` 目录，如 `video/demo.mp4`） |

> video 类型 iframe **延迟加载**，切换到该页时才设置 `src`。播完后自动触发下一页。

---

## 播放器操作指南

### 基本操作

| 操作 | 方法 |
|---|---|
| 首次启动播放 | 点击幻灯片或遮罩 |
| 暂停 / 恢复 | 点击幻灯片，或点击控制栏播放按钮 |
| 上一页 | 点击 `◀` 按钮，或按 `←` / `↑` |
| 下一页 | 点击 `▶` 按钮，或按 `→` / `↓` |
| 重播当前页 | 点击控制栏 `↺` 按钮 |
| 跳转指定页 | 点击底部圆点导航 |
| 静音 / 调音量 | 使用音量滑块 |
| 键盘空格键 | 暂停 / 恢复（仅 content 页有效） |

### 三种自动切换模式

| 页面类型 | 有无音频 | 行为 |
|---|---|---|
| content | 有音频 | 音频 `onended` 自动触发下一页 |
| content | 无音频 | 5 秒计时器自动切换；聚光灯按 `at` 时间顺序触发 |
| exercise | — | 音频播完显示"确认答案"按钮，学生手动点确认翻页 |
| video | — | 视频播完后自动触发下一页 |

### 聚光灯（Spotlight）

聚光灯在指定时间将页面其他区域变暗，只突出显示一个 HTML 元素。

**使用条件：**
1. `course.json` 的 slide 中配置 `spotlights` 数组
2. 幻灯片 HTML 中对应元素有**相同的 id**
3. HTML 中引入 `/js/spotlight.js` 并调用 `Spotlight.init()`

```html
<div class="main-word-block" id="word-xie">...</div>
```

```js
// course.json
{ "elementId": "word-xie", "at": 1, "duration": 2 }
```

---

## 幻灯片 HTML 规范

幻灯片是完全独立的 HTML 文件，由播放器通过 `postMessage` 注入数据。

### 必须包含的代码

```html
<script src="/js/spotlight.js"></script>
<script>
  Spotlight.init({
    dimness: 0.75,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.8)',
    container: document.body
  });

  window.addEventListener('message', function(e) {
    var msg = e.data;
    if (!msg) return;

    if (msg.type === 'slideData') {
      // 使用 msg.data 中的数据渲染内容
      console.log('收到数据:', msg.data);
    }

    if (msg.type === 'spotlight') {
      Spotlight.spotlight(msg.elementId);
    }

    if (msg.type === 'spotlightClear') {
      Spotlight.clear();
    }
  });
</script>
```

### 关键约束

- **不要**在 slide HTML 中管理音频或计时器 — 这些由 `player.js` 统一控制
- **iframe 预加载**：播放器在初始化时已将所有 iframe 的 `src` 设置好，后续只用 CSS `opacity` 控制显隐，不要改变 `src`。**video 类型除外**——视频页延迟到切换到该页时才设置 `src`。
- **id 必须一致**：聚光灯的 `elementId` 必须与 HTML 中的 `id` 属性完全一致

---

## 伴学助手

播放器右下角有一个可拖拽的机器人图标 🤖，用于显示字幕提示。

字幕内容在 `course.json` 的 `subtitles` 字段中配置：

```json
"subtitles": [
  { "at": 1.0, "text": "大家好，今天我们学习谢谢怎么说" },
  { "at": 5.5, "text": "谢谢是感谢的意思" }
]
```

---

## 常见问题

**Q: 播放器显示"加载失败"？**
确认 `course.json` 存在且格式正确，课程目录路径为 `courses/<course-id>/course.json`。

**Q: 音频播完没有自动翻页？**
检查 `course.json` 中该页是否配置了 `audio` 字段，且文件路径正确（相对于 `courses/<course-id>/audio/` 目录）。

**Q: 聚光灯没有触发？**
1. 确认 HTML 元素有对应 id
2. 确认 `course.json` 的 `at` 时间值合理
3. 确认 `spotlights` 数组写在 `type: "content"` 的 slide 中

**Q: 如何自定义幻灯片样式？**
直接在对应 `courses/<course-id>/slides/n.html` 中编写 CSS，播放器不会覆盖 slide 内部样式。

**Q: 对话课（dialogue）如何播放？**
对话课由音频驱动，点击台词可跳转对应时间点。配置 `hasRolePlay: true` 可开启角色扮演练习，完成后自动翻页。

**Q: 如何添加视频页（video 类型）？**
在 `course.json` 中使用 `type: "video"`，并指定 `video` 字段路径，如 `"video/demo.mp4"`（相对于 `audio/` 目录）。

**Q: 多题型练习如何计分？**
多题练习完成后会显示统计页面（正确率、每题对错列表），学生点击"继续"按钮才翻页。

**Q: 角色扮演完成后如何自动翻页？**
对话角色扮演完成后，slide 发送 `{ type: 'playerMessage', action: 'rolePlayComplete' }`，播放器自动翻页。

---

## 部署

本项目是纯静态应用，可部署到任意静态服务器（如 Nginx、GitHub Pages、Vercel、Cloudflare Pages）。确保：

1. 所有路径使用相对路径或绝对路径（以 `/` 开头）
2. 音频文件支持 CORS 跨域（如使用 iframe 加载）
3. 文件名使用中文没有问题，但建议统一使用英文或数字命名避免编码问题
