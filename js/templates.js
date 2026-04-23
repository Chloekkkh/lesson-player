/**
 * templates.js — 幻灯片 HTML 模板字符串
 * 从 tools/add-slide.js 提取，供 author-api.js 调用
 */

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
      background: #fff;
      display: flex; align-items: center; justify-content: center;
      height: 100vh; padding: 40px;
    }
    .slide { max-width: 800px; text-align: center; }
    h1 { font-size: 3rem; color: #2a3446; margin-bottom: 20px; }
    p  { font-size: 1.4rem; color: #4d586f; line-height: 1.8; }
  </style>
</head>
<body>
  <div class="slide">
    <h1>第 ${slideNum} 页</h1>
    <p>内容页</p>
  </div>
  <script src="/js/spotlight.js"></script>
  <script>
    Spotlight.init({ dimness: 0.75, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.8)', container: document.body });
    window.addEventListener('message', function(e) {
      var msg = e.data;
      if (!msg) return;
      if (msg.type === 'slideData') console.log('slideData:', msg.data);
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
    <video id="videoEl" playsinline controls></video>
    <div class="video-end-overlay" id="videoEndOverlay">
      <button class="video-btn video-btn-replay" id="btnReplay">&#8634; 重播</button>
      <button class="video-btn video-btn-next"   id="btnNext">&#9654;&#9654; 下一页</button>
    </div>
  </div>
  <script src="/js/spotlight.js"></script>
  <script>
    Spotlight.init({ dimness: 0.75, borderWidth: 0.5, container: document.body });
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
          videoEl.src = '/courses/' + msg.data.courseId + '/audio/' + msg.data.video;
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
 * 通用 exercise shell — 加载所有类型模块，由 questions[].type 驱动
 * 不指定 exerciseType，用于多题混合场景
 */
function exerciseTemplate(slideNum, courseTitle) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${courseTitle} - 练习 ${slideNum}</title>
  <link rel="stylesheet" href="/css/shared.css">
  <link rel="stylesheet" href="/css/exercise.css">
</head>
<body>

  <div class="exercise-card">
    <div class="page-header">
      <h2 id="exerciseTitle">练习 ${slideNum}</h2>
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
    <div id="exerciseAreas">
      <div id="choiceArea" style="display:none">
        <p class="question-text" id="questionText">Loading...</p>
        <div id="playAudioWrap" style="display:none;text-align:center;margin: 16px 0;">
          <button class="play-audio-btn" id="playAudioBtn">▶</button>
        </div>
        <div class="options" id="optionsContainer"></div>
      </div>
      <div class="arrange-area" id="arrangeArea"></div>
      <div class="match-area" id="matchArea"></div>
      <div class="fill-area" id="fillArea"></div>
      <div class="trace-area" id="traceArea"></div>
    </div>
    <div class="action-row">
      <button class="nav-btn" id="prevBtn" aria-label="上一题">&#8592;</button>
      <button class="submit-btn" id="submitBtn">Submit</button>
      <button class="nav-btn" id="nextBtn" aria-label="下一题" disabled>&#8594;</button>
    </div>
  </div>

  <script src="/js/exercise/sound.js"></script>
  <script src="/js/exercise/progress.js"></script>
  <script src="/js/exercise/celebration.js"></script>
  <script src="/js/exercise/multi-handler.js"></script>
  <script src="/js/exercise/exercise.js"></script>
  <script src="/js/exercise/types/choice.js"></script>
  <script src="/js/exercise/types/arrange.js"></script>
  <script src="/js/exercise/types/match.js"></script>
  <script src="/js/exercise/types/fill.js"></script>
<script src="/js/exercise/types/trace.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js"></script>
  <script>
    Spotlight.init({ dimness: 0.75, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.8)', container: document.body });
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

function displayTemplate(slideNum, courseTitle) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${courseTitle} - 生词 ${slideNum}</title>
  <link rel="stylesheet" href="/css/shared.css">
  <link rel="stylesheet" href="/css/exercise.css">
</head>
<body>
<div class="exercise-card">
    <div class="page-header">
      <h2 id="exerciseTitle">📚 词汇学习</h2>
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
    <div class="vocab-grid" id="vocabGrid"></div>
    <button class="vocab-next-btn" id="nextBtn">next page</button>
  </div>
  <script src="/js/exercise/sound.js"></script>
  <script src="/js/exercise/progress.js"></script>
  <script src="/js/exercise/celebration.js"></script>
  <script src="/js/exercise/exercise.js"></script>
  <script src="/js/exercise/types/vocab.js"></script>
  <script src="/js/spotlight.js"></script>
  <script>
    Spotlight.init({ dimness: 0.75, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.8)', container: document.body });
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
 * 生成 course.json 中空的 slide 条目
 */
function buildSlideEntry(slideType, slideNum) {
  var entry = {
    index: slideNum,
    type:  slideType,
    title: slideType === 'display' ? '生词学习' : (slideType === 'exercise' ? '练习' : '第 ' + slideNum + ' 页')
  };

  if (slideType === 'exercise') {
    entry.title = '练习';
    entry.questions = [];
  } else if (slideType === 'display') {
    entry.vocab = [];
    entry.showPinyin = true;
    entry.showEnglish = true;
    entry.hasRecording = true;
  } else if (slideType === 'video') {
    entry.video = '';
    entry.title = '视频学习';
  }

  return entry;
}

module.exports = {
  contentTemplate,
  videoTemplate,
  exerciseTemplate,
  displayTemplate,
  buildSlideEntry,
};