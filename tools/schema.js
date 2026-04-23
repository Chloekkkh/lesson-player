/**
 * course.json Schema 定义
 *
 * 每个课程的配置结构，存放于 courses/<course-id>/course.json
 */

module.exports = {

  // ── 根对象 ──────────────────────────────────────────────
  root: {
    id:          { type: 'string', required: true,  desc: '课程唯一 ID（URL slug）' },
    title:       { type: 'string', required: true,  desc: '课程标题' },
    description: { type: 'string', required: false, desc: '课程描述' },
    author:      { type: 'string', required: false, desc: '作者' },
    created:     { type: 'string', required: false, desc: '创建日期 YYYY-MM-DD' },
    slides:      { type: 'array',  required: true,  desc: '幻灯片列表（有序）' },
  },

  // ── slide 公共字段 ─────────────────────────────────────
  slideCommon: {
    index: { type: 'number', required: true, desc: '幻灯片编号（从 1 开始）' },
    type:  { type: 'enum',   required: true, values: ['content', 'exercise', 'display', 'video'], desc: '页面类型' },
    title:  { type: 'string', required: false, desc: '页面标题（可选）' },
    audio:  { type: 'string', required: false, desc: '音频文件名，如 1.mp3' },
  },

  // ── type: content ──────────────────────────────────────
  contentSlide: {
    // 继承 slideCommon
    // audio 播放完后自动切换到下一页
  },

  // ── type: video ────────────────────────────────────────
  videoSlide: {
    // 继承 slideCommon
    video: { type: 'string', required: true, desc: '视频文件路径，相对于 courses/<id>/audio/，如 video/demo.mp4' },
    // 播完后显示重播和下一页按钮，点击下一页触发 player 翻页
  },

  // ── type: exercise ─────────────────────────────────────
  exerciseSlide: {
    // 继承 slideCommon
    exerciseType: {
      type:     'enum',
      required: true,
      values:   ['read', 'listen', 'truefalse', 'fill', 'matching', 'arrange', 'trace'],
      desc:     '练习题型'
    },
    question: { type: 'string', required: true, desc: '题目文本' },

    // choice / truefalse 选项
    options: {
      type:     'array',
      required: false,
      desc:     '选项列表（choice/truefalse 用）',
      item: {
        id:   { type: 'string', desc: '选项 ID，如 A/B/C/D 或 true/false' },
        text: { type: 'string', desc: '选项文字' },
      }
    },

    // fill 填空
    placeholder: { type: 'string', required: false, desc: '输入框占位文字（fill 用）' },

    // matching 配对
    pairs: {
      type:     'array',
      required: false,
      desc:     '配对题 pairs（matching 用）',
      item: {
        left:  { type: 'string', desc: '左侧词' },
        right: { type: 'string', desc: '右侧词（可乱序）' },
      }
    },

    answer: { type: 'string', required: true, desc: '正确答案（评分用，客户端不展示）' },
  },

  // ── 示例 course.json ───────────────────────────────────
  example: {
    id:          'lesson-thanks',
    title:       '谢谢播放器',
    description: 'HSK 课程示例',
    author:      'teacher-name',
    created:     '2026-04-14',
    slides: [
      {
        index: 1,
        type:  'content',
        title: '第一页',
        audio: '1.mp3',
      },
      {
        index: 2,
        type:  'exercise',
        exerciseType: 'read',
        title:   '练习：选词填空',
        audio:   '2.mp3',
        question: '请问这个词是什么意思？',
        options: [
          { id: 'A', text: '谢谢' },
          { id: 'B', text: '你好' },
          { id: 'C', text: '再见' },
          { id: 'D', text: '对不起' },
        ],
        answer: 'A',
      },
      {
        index: 3,
        type:  'video',
        title: '对话演示',
        video: 'video/dialogue1.mp4',
      },
    ],
  },

};
