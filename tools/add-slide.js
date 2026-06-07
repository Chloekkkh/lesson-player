#!/usr/bin/env node
/**
 * add-slide.js — 添加 / 删除幻灯片
 *
 * 用法:
 *   node tools/add-slide.js <course-id> --type content --index 3
 *   node tools/add-slide.js <course-id> --type exercise --exerciseType choice --index 4
 *   node tools/add-slide.js <course-id> --delete --index 3
 *
 * 示例:
 *   node tools/add-slide.js lesson-thanks --type content --index 3
 *   node tools/add-slide.js lesson-thanks --type exercise --exerciseType choice --index 4
 *   node tools/add-slide.js lesson-thanks --delete --index 3
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      args[key] = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')
        ? argv[++i] : true;
    } else {
      args._ = args._ || [];
      args._.push(a);
    }
  }
  return args;
}

const templates = require('../js/templates.js');

// ── Slide HTML 模板 ───────────────────────────────────────

function contentTemplate(slideNum, courseTitle) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${courseTitle} - 第${slideNum}页</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Microsoft YaHei UI","PingFang SC",sans-serif;
      width: 1200px;
      height: 675px;
      position: relative;
      overflow: hidden;
    }
    .slide-bg {
      position: absolute;
      inset: 0;
      width: 1200px;
      height: 675px;
      background-size: cover;
      background-position: center;
      background-color: #f5f5f5;
    }
    .hotspot {
      position: absolute;
      background: transparent;
    }
  </style>
</head>
<body>
  <div class="slide-bg"></div>
  <div id="hotspot-container"></div>

  <script src="/js/spotlight.js"></script>
  <script>
    Spotlight.init({ dimness: 0.75, container: document.body });

    function renderHotspots(zones) {
      var container = document.getElementById('hotspot-container');
      zones.forEach(function(zone) {
        var div = document.createElement('div');
        div.id = zone.elementId;
        div.className = 'hotspot';
        div.style.cssText = 'position:absolute;left:' + zone.x + '%;top:' + zone.y + '%;width:' + zone.w + '%;height:' + zone.h + '%;';
        container.appendChild(div);
      });
    }

    var zonesRendered = false;

    window.addEventListener('message', function(e) {
      var msg = e.data;
      if (!msg) return;

      if (msg.spotlightZones && !zonesRendered) {
        zonesRendered = true;
        renderHotspots(msg.spotlightZones);
      }

      if (msg.type === 'slideData') {
        if (msg.data.backgroundImage) {
          var bg = document.querySelector('.slide-bg');
          if (bg) bg.style.backgroundImage = 'url(/courses/' + msg.data.courseId + '/' + msg.data.backgroundImage + ')';
        }
        if (msg.data.spotlightZones && !zonesRendered) {
          zonesRendered = true;
          renderHotspots(msg.data.spotlightZones);
        }
      }
      if (msg.type === 'spotlight') Spotlight.spotlight(msg.elementId);
      if (msg.type === 'spotlightClear') Spotlight.clear();
    });
  </script>
</body>
</html>`;
}

function videoTemplate(slideNum, courseTitle) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${courseTitle} - 视频 ${slideNum}</title>
  <link rel="stylesheet" href="/css/shared.css">
  <link rel="stylesheet" href="/css/exercise.css">
</head>
<body>
  <div class="video-slide">
    <video id="videoEl" playsinline></video>
    <div class="video-end-overlay" id="videoEndOverlay">
      <button class="video-btn video-btn-replay" id="btnReplay">&#8634; 重播</button>
      <button class="video-btn video-btn-next"   id="btnNext">&#9654;&#9654; 下一页</button>
    </div>
  </div>

  <script src="/js/spotlight.js"></script>
  <script>
    Spotlight.init({ dimness: 0.75, container: document.body });

    function postToParent(action) {
      try { parent.postMessage({ type: 'playerMessage', action: action }, '*'); } catch(e) {}
    }

    var videoEl   = document.getElementById('videoEl');
    var overlay   = document.getElementById('videoEndOverlay');
    var btnReplay = document.getElementById('btnReplay');
    var btnNext   = document.getElementById('btnNext');

    btnReplay.addEventListener('click', function(e) {
      e.stopPropagation();
      videoEl.currentTime = 0;
      videoEl.play();
      overlay.style.display = 'none';
    });

    btnNext.addEventListener('click', function(e) {
      e.stopPropagation();
      postToParent('displayComplete');
    });

    videoEl.addEventListener('ended', function() {
      overlay.style.display = 'flex';
    });

    window.addEventListener('message', function(e) {
      var msg = e.data;
      if (!msg) return;
      if (msg.type === 'slideData') {
        if (msg.data.video) {
          videoEl.src = '/courses/' + msg.data.courseId + '/' + msg.data.video;
          videoEl.play();
        }
      }
      if (msg.type === 'spotlight') Spotlight.spotlight(msg.elementId);
      if (msg.type === 'spotlightClear') Spotlight.clear();
    });
  </script>
</body>
</html>`;
}

/**
 * 练习题 HTML 模板
 * 新架构：exercise.js 做分发中心，公共模块各自管理
 */
function exerciseTemplate(slideNum, exerciseType, courseTitle) {
  const listenBody = `
    <div class="exercise-card">
      <button class="play-audio-btn" id="playAudioBtn" style="display:none">▶ 听一听</button>
      <p class="question-text" id="questionText">请听音频，选择正确的词</p>
      <div class="options" id="optionsContainer"></div>
      <button class="submit-btn" id="submitBtn">确认答案</button>
    </div>`;

  const readBody = `
    <div class="exercise-card">
      <p class="question-text" id="questionText">请选择正确答案</p>
      <div class="options" id="optionsContainer"></div>
      <button class="submit-btn" id="submitBtn">确认答案</button>
    </div>`;

  const arrangeBody = `
    <div class="exercise-card">
      <h2>连词成句</h2>
      <p class="question-text" id="questionText">将词语排列成正确的句子</p>
      <div class="arrange-area" id="arrangeArea"></div>
      <button class="submit-btn" id="submitBtn">确认答案</button>
    </div>`;

  const matchBody = `
    <div class="exercise-card">
      <h2>连线配对</h2>
      <div class="match-area" id="matchArea"></div>
      <button class="submit-btn" id="submitBtn">确认答案</button>
    </div>`;

  const traceBody = `
    <div class="exercise-card">
      <h2>汉字描红</h2>
      <p class="question-text">请先观看左侧演示，再在右侧书写练习</p>
      <div class="trace-area" id="traceArea"></div>
    </div>`;

  const displayBody = `
    <div class="exercise-card">
      <div class="page-header">
        <h2 id="exerciseTitle">📚 词汇学习 New Words</h2>
        <div class="header-toggles">
          <label class="toggle-switch">
            <input type="checkbox" id="togglePinyin" checked>
            <span class="toggle-slider"></span>
            <span>拼音</span>
          </label>
          <label class="toggle-switch">
            <input type="checkbox" id="toggleEnglish" checked>
            <span class="toggle-slider"></span>
            <span>英文</span>
          </label>
        </div>
      </div>
      <p id="exerciseSubtitle" class="exercise-subtitle"></p>
      <div class="vocab-grid" id="vocabGrid"></div>
      <button class="vocab-next-btn" id="nextBtn">next page</button>
    </div>`;

  const legacyBody = `
    <div class="exercise-card">
      <h2>练一练</h2>
      <p class="question-text" id="questionText">题目加载中...</p>
      <div class="options" id="optionsContainer"></div>
      <button class="submit-btn" id="submitBtn">确认答案</button>
    </div>`;

  const bodyMap = {
    listen:   listenBody,
    read:     readBody,
    arrange:  arrangeBody,
    match:    matchBody,
    trace:    traceBody,
    display:  displayBody,
    fill:     readBody,
    // 兼容旧类型
    choice:   legacyBody,
    truefalse:legacyBody,
    matching: legacyBody,
  };

  const body = bodyMap[exerciseType] || legacyBody;

  // 根据题型加载对应的类型模块
  const typeModules = {
    listen:   '/js/exercise/types/choice.js',
    read:     '/js/exercise/types/choice.js',
    arrange:  '/js/exercise/types/arrange.js',
    match:    '/js/exercise/types/match.js',
    trace:    '/js/exercise/types/trace.js',
    display:  null,
    fill:     '/js/exercise/types/fill.js',
  };

  const typeModule = typeModules[exerciseType] || '';

  // vocab / display 类型使用独立的 JS 文件
  const isVocab = exerciseType === 'vocab';
  const isDisplay = exerciseType === 'display';

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${courseTitle} - ${exerciseType} ${slideNum}</title>
  <link rel="stylesheet" href="/css/shared.css">
  <link rel="stylesheet" href="/css/exercise.css">
</head>
<body>
${body}
  <script src="/js/exercise/sound.js"></script>
  <script src="/js/exercise/progress.js"></script>
  <script src="/js/exercise/celebration.js"></script>
  ${isVocab ? '<script src="/js/vocab.js"></script>' :
                isDisplay ? '<script src="/js/display.js"></script>' :
                '<script src="/js/exercise/exercise.js"></script>\n  <script src="/js/exercise/multi-handler.js"></script>\n  ' + (typeModule ? '<script src="' + typeModule + '"></script>' : '')}
  ${exerciseType === 'trace' ? '<script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js"></script>' : ''}
  <script src="/js/spotlight.js"></script>
  <script>
    Spotlight.init({ dimness: 0.75, container: document.body });
    window.addEventListener('message', function(e) {
      var msg = e.data;
      if (!msg) return;
      if (msg.type === 'spotlight') Spotlight.spotlight(msg.elementId);
      if (msg.type === 'spotlightClear') Spotlight.clear();
    });
  </script>
</body>
</html>`;
}

/**
 * 生词页 HTML 模板
 */
function vocabTemplate(slideNum, courseTitle) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${courseTitle} - 生词 ${slideNum}</title>
  <link rel="stylesheet" href="/css/shared.css">
  <link rel="stylesheet" href="/css/exercise.css">
  <link rel="stylesheet" href="/css/vocab.css">
</head>
<body>
  <div class="exercise-card">
    <div class="page-header">
      <h2 id="exerciseTitle">📚 词汇学习 New Words</h2>
      <div class="header-toggles">
        <label class="toggle-switch">
          <input type="checkbox" id="togglePinyin" checked>
          <span class="toggle-slider"></span>
          <span>拼音</span>
        </label>
        <label class="toggle-switch">
          <input type="checkbox" id="toggleEnglish" checked>
          <span class="toggle-slider"></span>
          <span>英文</span>
        </label>
      </div>
    </div>
    <p id="exerciseSubtitle" class="exercise-subtitle">Master Your New Words</p>
    <div class="vocab-grid" id="vocabGrid"></div>
    <div class="vocab-nav-row">
      <button class="vocab-next-btn" id="nextBtn">下一页 →</button>
    </div>
  </div>
  <script src="/js/exercise/sound.js"></script>
  <script src="/js/exercise/progress.js"></script>
  <script src="/js/exercise/celebration.js"></script>
  <script src="/js/vocab.js"></script>
</body>
</html>`;
}

/**
 * 生词与例句页 HTML 模板
 */
function displayTemplate(slideNum, courseTitle) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${courseTitle} - 生词与例句 ${slideNum}</title>
  <link rel="stylesheet" href="/css/shared.css">
  <link rel="stylesheet" href="/css/exercise.css">
  <link rel="stylesheet" href="/css/display.css">
</head>
<body>
  <div class="exercise-card">
    <div class="page-header">
      <h2 id="exerciseTitle">生词与例句</h2>
      <div class="header-toggles">
        <label class="toggle-switch">
          <input type="checkbox" id="togglePinyin" checked>
          <span class="toggle-slider"></span>
          <span>拼音</span>
        </label>
        <label class="toggle-switch">
          <input type="checkbox" id="toggleEnglish" checked>
          <span class="toggle-slider"></span>
          <span>英文</span>
        </label>
      </div>
    </div>
    <div class="display-layout">
      <div class="display-vocab-col">
        <div class="display-col-title">生词 New Words</div>
        <div id="vocabCol"></div>
      </div>
      <div class="display-example-col">
        <div class="display-col-title">例句 Examples</div>
        <div id="exampleCol"></div>
      </div>
    </div>
    <div class="vocab-next-row">
      <button class="vocab-next-btn" id="nextBtn">下一页 →</button>
    </div>
  </div>
  <script src="/js/exercise/sound.js"></script>
  <script src="/js/exercise/progress.js"></script>
  <script src="/js/exercise/celebration.js"></script>
  <script src="/js/display.js"></script>
</body>
</html>`;
}

// ── buildSlideEntry — 根据类型生成 course.json 条目 ─────────

function buildSlideEntry(slideType, exerciseType, slideNum) {
  var entry = {
    index: slideNum,
    type:  slideType,
    title: slideType === 'vocab' ? '生词学习' : (slideType === 'display' ? '生词与例句' : (slideType === 'exercise' ? '练习 ' + slideNum : '第 ' + slideNum + ' 页'))
  };

  if (slideType === 'exercise') {
    entry.exerciseType = exerciseType;
    entry.title = exerciseType === 'listen' ? '听音识词' :
                   exerciseType === 'read'   ? '阅读理解' :
                   exerciseType === 'arrange' ? '连词成句' :
                   exerciseType === 'match'   ? '连线配对' :
                   exerciseType === 'trace'   ? '汉字描红' :
                   exerciseType === 'fill'   ? '填空练习' : '练习 ' + slideNum;

    if (exerciseType === 'listen' || exerciseType === 'read') {
      entry.questions = [
        {
          options: [
            { id: 'A', text: '选项 A' },
            { id: 'B', text: '选项 B' },
            { id: 'C', text: '选项 C' },
            { id: 'D', text: '选项 D' }
          ],
          answer: 'A'
        }
      ];
      if (exerciseType === 'listen') entry.questions[0].audio = 'q1.wav';
    } else if (exerciseType === 'arrange') {
      entry.questions = [{ words: ['我', '爱', '你'], answer: ['我', '爱', '你'] }];
    } else if (exerciseType === 'match') {
      entry.pairs = [{ left: '谢谢', right: 'thank you' }];
    } else if (exerciseType === 'trace') {
      entry.char = '谢';
      entry.stars = { '3': 0.85, '2': 0.6, '1': 0.3 };
    } else if (exerciseType === 'fill') {
      entry.questions = [
        { type: 'fill', question: '请填空 _____', answer: '答案' }
      ];
      entry.sharedOptions = [];
    } else {
      // 旧题型兼容
      entry.question = '请在此输入题目';
      entry.options = [{ id: 'A', text: '选项 A' }, { id: 'B', text: '选项 B' }];
      entry.answer = 'A';
    }
  } else if (slideType === 'vocab') {
    entry.vocab = [
      { id: 'w1', hanzi: '谢谢', pinyin: 'xiè xie', pos: 'verb', en: 'thank you', audio: 'w1.wav' },
      { id: 'w2', hanzi: '你好', pinyin: 'nǐ hǎo',   pos: 'verb', en: 'hello',     audio: 'w2.wav' }
    ];
    entry.showPinyin = true;
    entry.showEnglish = true;
    entry.hasRecording = true;
  } else if (slideType === 'display') {
    entry.vocab = [
      { id: 'w1', hanzi: '请问', pinyin: 'qǐng wèn', pos: 'v.', en: 'excuse me', audio: '', image: '' }
    ];
    entry.examples = [
      { id: 'e1', hanzi: '请问，去图书馆怎么走？', pinyin: 'qǐng wèn, qù tú shū guǎn zěn me zǒu?', en: 'Excuse me, how do I get to the library?', audio: '' }
    ];
    entry.showPinyin = true;
    entry.showEnglish = true;
  } else if (slideType === 'video') {
    entry.video = 'video/demo.mp4';
    entry.title = '视频学习';
  } else if (slideType === 'dialogue') {
    entry.title = '情景对话';
    entry.audio = 'dialogue/1.mp3';
    entry.speakers = [
      { id: 'A', name: '角色A', avatar: 'avatars/A.png' },
      { id: 'B', name: '角色B', avatar: 'avatars/B.png' }
    ];
    entry.showText = true;
    entry.showPinyin = true;
    entry.showEnglish = false;
    entry.hasRolePlay = true;
    entry.image = '';
    entry.lines = [
      { speaker: 'A', start: 0, end: 3, hanzi: '你好！', pinyin: 'nǐ hǎo', en: 'Hello', vocab: [] },
      { speaker: 'B', start: 3, end: 6, hanzi: '你好！', pinyin: 'nǐ hǎo', en: 'Hello', vocab: [] }
    ];
    entry.vocabList = [];
  }

  return entry;
}

// ── Main ───────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv);
  const [courseId] = args._ || [];

  if (!courseId) {
    console.error('用法: node tools/add-slide.js <course-id> --type content --index N');
    console.error('       node tools/add-slide.js <course-id> --type exercise --exerciseType choice --index N');
    process.exit(1);
  }

  const courseDir = path.join(ROOT, 'courses', courseId);
  const courseJsonPath = path.join(courseDir, 'course.json');

  if (!fs.existsSync(courseJsonPath)) {
    console.error(`错误: 课程 ${courseId} 不存在（找不到 course.json）`);
    process.exit(1);
  }

  const raw = fs.readFileSync(courseJsonPath, 'utf8');
  let course;
  try {
    course = JSON.parse(raw);
  } catch (e) {
    console.error('错误: course.json 格式错误', e.message);
    process.exit(1);
  }

  const slideType    = args.delete ? 'delete' : (args.type  || 'content');
  const exerciseType = args.exerciseType || undefined;
  const index        = parseInt(args.index, 10);

  if (!index || index < 1) {
    console.error('错误: 必须指定 --index <数字>（从 1 开始）');
    process.exit(1);
  }

  const slidesDir = path.join(courseDir, 'slides');
  if (!fs.existsSync(slidesDir)) fs.mkdirSync(slidesDir, { recursive: true });

  // ── Delete mode ──────────────────────────────────────────
  if (slideType === 'delete') {
    const existing = course.slides.find(s => s.index === index);
    if (!existing) {
      console.error(`错误: 第 ${index} 页不存在`);
      process.exit(1);
    }

    // Delete HTML file
    const slideHtmlPath = path.join(slidesDir, `${index}.html`);
    if (fs.existsSync(slideHtmlPath)) {
      fs.unlinkSync(slideHtmlPath);
      console.log(`  删除: slides/${index}.html`);
    }

    // Rename subsequent HTML files (shift index -1)
    const slidesToShift = course.slides
      .filter(s => s.index > index)
      .sort((a, b) => a.index - b.index);

    slidesToShift.forEach(s => {
      const oldPath = path.join(slidesDir, `${s.index}.html`);
      const newPath = path.join(slidesDir, `${s.index - 1}.html`);
      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
        console.log(`  重命名: slides/${s.index}.html → slides/${s.index - 1}.html`);
      }
      s.index--;
    });

    // Remove slide entry from array
    course.slides = course.slides.filter(s => s.index !== index);
    course.slides.sort((a, b) => a.index - b.index);

    fs.writeFileSync(courseJsonPath, JSON.stringify(course, null, 2), 'utf8');
    console.log(`✓ 删除第 ${index} 页（后续页已前移）`);
    return;
  }

  // ── Insert / Add mode ─────────────────────────────────────
  if (!['content', 'exercise', 'vocab', 'display', 'video', 'dialogue'].includes(slideType)) {
    console.error('错误: --type 必须是 content / exercise / vocab / display / video / dialogue');
    process.exit(1);
  }

  const validExerciseTypes = ['listen', 'read', 'arrange', 'match', 'trace', 'choice', 'truefalse', 'fill', 'matching'];
  if (slideType === 'exercise' && !validExerciseTypes.includes(exerciseType)) {
    console.error('错误: --exerciseType 必须是 listen / read / arrange / match / trace / fill');
    process.exit(1);
  }
  if (slideType !== 'exercise' && exerciseType) {
    console.error('错误: --exerciseType 只适用于 --type exercise');
    process.exit(1);
  }

  const slideNum = index;

  // Check index collision
  const existing = course.slides.find(s => s.index === index);
  if (existing) {
    // 插入：从 index 往后的全部 +1，顺便重命名对应的 HTML 文件
    console.log(`  第 ${index} 页已存在，自动将后续页码后移…`);
    course.slides.forEach(s => {
      if (s.index >= index) {
        const oldPath = path.join(slidesDir, `${s.index}.html`);
        const newPath = path.join(slidesDir, `${s.index + 1}.html`);
        if (fs.existsSync(oldPath)) {
          fs.renameSync(oldPath, newPath);
          console.log(`    ${s.index}.html → ${s.index + 1}.html`);
        }
        s.index++;
      }
    });
  }

  // Build slide entry
  const slideEntry = buildSlideEntry(slideType, exerciseType, slideNum);

  // Insert in order
  course.slides.push(slideEntry);
  course.slides.sort((a, b) => a.index - b.index);

  // Write slide HTML
  const htmlMap = {
    exercise: exerciseTemplate(slideNum, exerciseType, course.title || courseId),
    video:    videoTemplate(slideNum, course.title || courseId),
    dialogue: templates.dialogueTemplate(slideNum, course.title || courseId),
    vocab:    vocabTemplate(slideNum, course.title || courseId),
    display:  displayTemplate(slideNum, course.title || courseId),
  };
  const slideHtml = htmlMap[slideType] || contentTemplate(slideNum, course.title || courseId);

  fs.writeFileSync(path.join(slidesDir, `${slideNum}.html`), slideHtml, 'utf8');

  // Write updated course.json
  fs.writeFileSync(courseJsonPath, JSON.stringify(course, null, 2), 'utf8');

  const action = existing ? '插入（后续页已后移）' : '添加';
  console.log(`✓ ${action}第 ${slideNum} 页（type=${slideType}${exerciseType ? ', exerciseType=' + exerciseType : ''}）`);
  console.log(`  文件: courses/${courseId}/slides/${slideNum}.html`);
}

main();
