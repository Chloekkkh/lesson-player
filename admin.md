# 课程制作工具（admin.html）

可视化编辑 HSK 课程内容，支持所有类型的幻灯片配置。

---

## 访问

```
http://localhost:3000/admin.html
```

---

## 课程管理

### 创建课程

1. 点击侧边栏 **+ 新建课程**
2. 填写课程 ID（唯一标识，用于 URL）和标题

### 课程列表

- 点击课程卡片进入课程详情页
- 悬停显示删除按钮

---

## 幻灯片类型

| 类型 | 说明 |
|------|------|
| **content** | 内容页，带音频、字幕、聚光灯、热区编辑器 |
| **exercise** | 练习题页，支持多种题型 |
| **display** | 生词展示页 |
| **video** | 视频页 |

---

## Content 页编辑器

### 音频

- 从下拉框选择已有音频文件
- 点击 **上传到 narration/** 按钮上传新音频（自动分块上传）
- 上传后右侧显示 `<audio>` 播放器，可直接播放预览
- 切换下拉选项时播放器自动更新

### 字幕（伴学助手）

在指定时间显示提示字幕：

| 字段 | 说明 |
|------|------|
| 时间(s) | 字幕显示时间（秒） |
| 文本 | 字幕内容 |

点击 **+ 添加字幕** 增加条目。

### 聚光灯

按时间顺序依次触发高亮区域：

| 字段 | 说明 |
|------|------|
| 元素 ID | 热区 div 的 id（对应 spotlightZones 中的 elementId） |
| 触发时间(s) | 聚光灯开始时间（秒） |
| 持续(s) | 高亮持续时间（秒） |

### 热区编辑器（背景图热点）

用于在背景图上定义可被 spotlight 聚焦的区域。

#### 上传背景图

1. 点击 **上传背景图** 按钮
2. 选择图片文件（自动上传到 `pptimg/` 目录）
3. 上传成功后图片预览显示在画布中

#### 添加热区

1. 在图片上**鼠标拖拽**画出一个矩形
2. 系统自动计算百分比坐标（x/y/w/h）
3. 在右侧列表中填写该热区的 **元素 ID**（用于 spotlight 触发）
4. 可手动调整坐标值，画布实时同步显示

#### 热区列表

每行显示一个热区：
- **ID**：元素标识符
- **x/y/w/h**：百分比坐标（可直接编辑）

#### 预览 Spotlight

点击 **▶ 预览 Spotlight** 在新窗口打开播放器，预览聚光灯效果。

#### 数据保存

保存时 `spotlightZones` 和 `spotlights` 一起写入 `course.json`。

### 幻灯片 HTML

- 点击 **加载 HTML** 读取当前 slide 的 HTML 源码
- 点击 **保存 HTML** 将编辑器内容写入文件

---

## Exercise 页编辑器

支持题型：`read` `listen` `arrange` `match` `fill` `trace`

### read / listen（选择题）

- 题目文本、选项 A-D、正确答案
- listen 类型可上传独立音频

### arrange（词语排序）

- 按正确顺序排列词语

### match（词语配对）

- 左右两侧词语一一对应

### fill（填空）

- 题目（含 `_____` 占位符）、正确答案

### trace（临摹）

- 汉字、拼音、英文释义
- 星级阈值（影响评分动画）

---

## Display 页编辑器

- 词汇表：汉字、拼音、词性、英文释义
- 可上传词汇音频（vocab 目录）
- 录音按钮开关

---

## Video 页编辑器

- 选择视频文件（上传到 `video/` 目录）

---

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/courses` | 课程列表 |
| POST | `/api/courses` | 创建课程 |
| GET | `/api/courses/:id` | 课程详情 |
| PATCH | `/api/courses/:id` | 更新课程信息 |
| DELETE | `/api/courses/:id` | 删除课程 |
| GET | `/api/courses/:id/slides` | 幻灯片列表 |
| POST | `/api/courses/:id/slides` | 添加幻灯片 |
| PATCH | `/api/courses/:id/slides/:index` | 更新幻灯片配置 |
| DELETE | `/api/courses/:id/slides/:index` | 删除幻灯片 |
| POST | `/api/courses/:id/slides/:index/regenerate` | 重新生成 HTML |
| GET | `/api/courses/:id/slides/:index/html` | 读取 HTML 源码 |
| PUT | `/api/courses/:id/slides/:index/html` | 保存 HTML 源码 |
| POST | `/api/courses/:id/audio-files` | 上传音频/图片（分块） |
| GET | `/api/courses/:id/audio-files` | 音频文件列表 |

**音频文件分类（sub）**：`narration` `vocab` `exercise` `video` `pptimg`

---

## 目录结构约定

```
courses/<course-id>/
├── course.json       # 课程配置
├── slides/
│   ├── 1.html        # 第1页（由模板生成，可手动编辑）
│   └── 2.html
├── audio/
│   ├── narration/    # 旁白音频
│   ├── vocab/        # 词汇音频
│   ├── exercise/     # 练习音频
│   └── video/        # 视频文件
└── pptimg/          # 背景图 / 原始图片
```
