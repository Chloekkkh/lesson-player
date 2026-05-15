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
    slides:      { type: 'array',  required: true,  desc: '幻灯片列表（按 index 顺序排列）' },
  },

  // ── slide 公共字段 ─────────────────────────────────────
  slideCommon: {
    index: { type: 'number', required: true,  desc: '幻灯片编号（从 1 开始）' },
    type:  { type: 'enum',   required: true,  values: ['content', 'exercise', 'display', 'video', 'dialogue'], desc: '页面类型' },
    title: { type: 'string', required: false, desc: '页面标题' },
    audio: { type: 'string', required: false, desc: '音频文件路径，相对于课程根目录，如 assets/ppt/audio/ppt_1.mp3' },
  },

  // ── type: content ──────────────────────────────────────
  // 旁白驱动型内容页。音频播放完毕自动切换下一页。
  contentSlide: {
    // 继承 slideCommon
    backgroundImage: { type: 'string', required: false, desc: '背景图路径，相对于课程根目录，如 assets/ppt/img/bg.png' },
    spotlightZones:  { type: 'array',  required: false, desc: '热区坐标数组，供 admin 热区编辑器使用', item: { elementId: 'string', x: 'number', y: 'number', w: 'number', h: 'number' } },
    spotlights:      { type: 'array',  required: false, desc: '聚光灯触发配置', item: { elementId: 'string', at: 'number', duration: 'number' } },
    subtitles:       { type: 'array',  required: false, desc: '伴学助手字幕，指定时间显示提示文本', item: { at: 'number', text: 'string' } },
    // audio 有值 → audio.ontimeupdate 驱动 spotlight；无 audio → setInterval 轮询 spotlight
  },

  // ── type: video ───────────────────────────────────────
  // 视频播放页。播完后显示重播和下一页按钮。
  videoSlide: {
    // 继承 slideCommon
    video: { type: 'string', required: true, desc: '视频文件路径，相对于课程根目录，如 assets/vedio/demo.mp4' },
  },

  // ── type: display ──────────────────────────────────────
  // 生词展示页，可选带例句。
  displaySlide: {
    // 继承 slideCommon
    vocab: {
      type:     'array',
      required: true,
      desc:     '生词列表',
      item: {
        id:     { type: 'string', required: true,  desc: '生词唯一 ID' },
        hanzi:  { type: 'string', required: true,  desc: '汉字' },
        pinyin: { type: 'string', required: true,  desc: '拼音' },
        pos:    { type: 'string', required: false, desc: '词性，如 verb / noun / adj' },
        en:     { type: 'string', required: true,  desc: '英文释义' },
        image:  { type: 'string', required: false, desc: '配图路径（可选）' },
        audio:  { type: 'string', required: false, desc: '发音音频路径，相对于课程根目录，如 assets/vocab/gei.mp3' },
      }
    },
    examples: {
      type:     'array',
      required: false,
      desc:     '例句列表（可选）',
      item: {
        id:     { type: 'string', required: false, desc: '例句 ID' },
        hanzi:  { type: 'string', required: true,  desc: '例句汉字' },
        pinyin: { type: 'string', required: false, desc: '例句拼音' },
        en:     { type: 'string', required: false, desc: '例句英文' },
        audio:  { type: 'string', required: false, desc: '例句音频路径' },
      }
    },
    showPinyin:  { type: 'boolean', required: false, default: true,  desc: '默认显示拼音' },
    showEnglish: { type: 'boolean', required: false, default: true,  desc: '默认显示英文' },
    hasRecording: { type: 'boolean', required: false, default: false, desc: '是否启用跟读录音功能' },
  },

  // ── type: exercise ─────────────────────────────────────
  // 练习题页。根据 exerciseType 决定具体题型。
  exerciseSlide: {
    // 继承 slideCommon
    exerciseType: {
      type:     'enum',
      required: true,
      values:   ['choice', 'listen', 'read', 'arrange', 'match', 'fill', 'trace'],
      desc:     '练习题型'
    },
    // 题型说明：
    //   choice    — 单选题（4 选 1）
    //   listen    — 听力题（播音频选答案）
    //   read      — 阅读题（读句选答案）
    //   arrange   — 排序题（将乱序词语组成正确句子）
    //   match     — 配对题（左右两组词连线）
    //   fill      — 选词填空题（多题版：N道题+M个共享选项池，点击空格后选词填入）
    //   trace     — 描图题（SVG 描红）

    question:   { type: 'string', required: true,  desc: '题目文本（题干），用 _____ 作为待填空格' },
    options: {
      type:     'array',
      required: false,
      desc:     '选项列表（choice / listen / read 用）',
      item: { id: 'string', text: 'string', image: 'string' }
    },
    layout: { type: 'string', required: false, desc: '选项排列方式：vertical 纵向 / horizontal 横向（listen/choice/read 用）' },
    sharedOptions: {
      type:     'array',
      required: false,
      desc:     '选词填空共享选项池（fill 用，所有题目共用）',
      item: 'string'
    },
    placeholder: { type: 'string', required: false, desc: '输入框占位文字（fill 自由输入模式用）' },
    pairs: {
      type:     'array',
      required: false,
      desc:     '配对题词对（match 用）',
      item: { left: 'string', right: 'string' }
    },
    answer: { type: 'string', required: true, desc: '正确答案（评分用，客户端不展示）' },
  },

  // ── type: dialogue ──────────────────────────────────────
  // 情景对话页：课文精读 + 角色扮演练习。
  dialogueSlide: {
    // 继承 slideCommon
    subtitle:    { type: 'string', required: false, desc: '副标题，如"情景对话"' },
    sceneImage:  { type: 'string', required: false, desc: '场景背景图路径，相对于课程根目录' },
    speakers: {
      type:     'array',
      required: true,
      desc:     '参与对话的角色列表',
      item: {
        id:     { type: 'string', required: true,  desc: '角色 ID，如 A / B' },
        name:   { type: 'string', required: true,  desc: '角色名称' },
        pinyin: { type: 'string', required: false, desc: '角色名称拼音' },
        avatar: { type: 'string', required: true,  desc: '头像图片路径，相对于课程根目录' },
      }
    },
    showPinyin:  { type: 'boolean', required: false, default: true,  desc: '默认显示拼音' },
    showEnglish: { type: 'boolean', required: false, default: true,  desc: '默认显示英文' },
    hasRolePlay: { type: 'boolean', required: false, default: true,  desc: '是否启用角色扮演练习' },
    lines: {
      type:     'array',
      required: true,
      desc:     '对话句子数组，按播放顺序排列',
      item: {
        speaker: { type: 'string', required: true,  desc: '说话人 ID（对应 speakers[].id）' },
        start:   { type: 'number', required: true,  desc: '该句在音频中的开始时间（秒）' },
        end:     { type: 'number', required: true,  desc: '该句在音频中的结束时间（秒）' },
        hanzi:   { type: 'string', required: true,  desc: '汉字原文' },
        pinyin:  { type: 'string', required: true,  desc: '拼音' },
        en:      { type: 'string', required: true,  desc: '英文翻译' },
        vocab: {
          type:     'array',
          required: false,
          desc:     '高亮词汇（点击可弹层查看释义），start/end 为字符偏移（基于 hanzi 字符串）',
          item: { start: 'number', end: 'number', word: 'string' }
        }
      }
    },
    vocabList: {
      type:     'array',
      required: false,
      desc:     '全局词汇表，供词汇弹层使用（对应 lines.vocab 中的 word）',
      item: {
        hanzi:  { type: 'string', required: true,  desc: '汉字' },
        pinyin: { type: 'string', required: false, desc: '拼音' },
        pos:    { type: 'string', required: false, desc: '词性' },
        en:     { type: 'string', required: true,  desc: '英文释义' },
      }
    },
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
        audio: 'assets/ppt/audio/ppt_1.mp3',
        backgroundImage: 'assets/ppt/img/ppt_1.PNG',
        spotlights: [{ elementId: 'zone-1', at: 0, duration: 2 }],
        spotlightZones: [{ elementId: 'zone-1', x: 10, y: 20, w: 25, h: 30 }],
      },
      {
        index: 2,
        type:  'exercise',
        exerciseType: 'choice',
        title:   '练习：选词填空',
        audio:   'intro.mp3',
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
        type:  'display',
        title: '生词与例句',
        vocab: [
          { id: 'w1', hanzi: '谢谢', pinyin: 'xiè xiè', pos: 'verb', en: 'thank you', audio: 'assets/vocab/gei.mp3' },
          { id: 'w2', hanzi: '你好', pinyin: 'nǐ hǎo', pos: 'verb', en: 'hello', audio: 'assets/vocab/rang.mp3' },
        ],
        examples: [
          { id: 'e1', hanzi: '谢谢你的帮助。', pinyin: 'xiè xiè nǐ de bāng zhù', en: 'Thank you for your help.' },
        ],
        showPinyin: true,
        showEnglish: true,
        hasRecording: false,
      },
      {
        index: 4,
        type:  'dialogue',
        title: '第 1 课',
        subtitle: '情景对话',
        audio: 'dialogue/1.mp3',
        sceneImage: 'img/dialogue/scene1.png',
        speakers: [
          { id: 'A', name: '老师', pinyin: 'lǎo shī', avatar: 'img/dialogue/teacher.png' },
          { id: 'B', name: '学生', pinyin: 'xué shēng', avatar: 'img/dialogue/student.png' },
        ],
        showPinyin: true,
        showEnglish: true,
        hasRolePlay: true,
        lines: [
          { speaker: 'A', start: 0, end: 3, hanzi: '你好！', pinyin: 'nǐ hǎo', en: 'Hello!', vocab: [] },
          { speaker: 'B', start: 3, end: 6, hanzi: '你好！请问，你叫什么名字？', pinyin: 'nǐ hǎo, qǐng wèn, nǐ jiào shén me míng zi', en: 'Hello, what\'s your name?', vocab: [] },
        ],
        vocabList: [],
      },
    ],
  },

};