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
    Spotlight.init({ dimness: 0.75, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.8)', glow: true, glowColor: 'rgba(34,168,110,1)', container: document.body });

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
    <video id="videoEl" playsinline controls></video>
    <div class="video-end-overlay" id="videoEndOverlay">
      <button class="video-btn video-btn-replay" id="btnReplay">&#8634; 重播</button>
      <button class="video-btn video-btn-next"   id="btnNext">&#9654;&#9654; 下一页</button>
    </div>
  </div>
  <script src="/js/spotlight.js"></script>
  <script>
    Spotlight.init({ dimness: 0.75, borderWidth: 0.5, glow: true, glowColor: 'rgba(34,168,110,1)', container: document.body });
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
</body>
</html>`;
}

function dialogueTemplate(slideNum, courseTitle) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${courseTitle} - Dialogue ${slideNum}</title>
  <link rel="stylesheet" href="/css/shared.css">
  <link rel="stylesheet" href="/css/exercise.css">
  <link rel="stylesheet" href="/css/dialogue.css">
</head>
<body>
  <div class="dlg-card">
    <div class="page-header">
      <h2 id="exerciseTitle">Dialogue</h2>
      <div class="header-toggles">
        <label class="toggle-switch">
          <input type="checkbox" id="pinyinToggle" checked>
          <span class="toggle-slider"></span>
          <span>拼音</span>
        </label>
        <label class="toggle-switch">
          <input type="checkbox" id="englishToggle" checked>
          <span class="toggle-slider"></span>
          <span>英文</span>
        </label>
      </div>
    </div>
    <p id="exerciseSubtitle" class="exercise-subtitle"></p>

    <div class="dlg-content-row">
      <div class="dlg-speakers" id="dlgSpeakers"></div>

      <div class="dlg-flip-card" id="dlgFlipCard">
        <div class="dlg-flip-inner">
          <div class="dlg-flip-front">
            <img class="flip-scene-img" id="flipSceneImg">
            <div class="flip-hint">Tap to show text</div>
          </div>
          <div class="dlg-flip-back">
            <div class="flip-back-header">📖 对话文本</div>
            <div class="dlg-text-list" id="dlgTextList"></div>
          </div>
        </div>
      </div>
    </div>

<div class="dlg-toolbar">
      <div class="audio-player">
        <button class="audio-play-btn" id="playBtn">
          <span id="playIcon">▶</span>
        </button>
        <div class="audio-progress-wrap">
          <div class="audio-progress-bar">
            <div class="audio-progress-fill" id="audioProgressFill"></div>
          </div>
          <div class="audio-time">
            <span id="audioCurTime">0:00</span> / <span id="audioDur">0:00</span>
          </div>
        </div>
      </div>
      <button class="dlg-btn-toggle" id="textToggle">Hide Text</button>
      <button class="dlg-btn-practice" id="practiceBtn">Role Play</button>
      <button class="dlg-btn-next" id="nextBtn">下一页 →</button>
    </div>

  <!-- 角色扮演浮层 -->
  <div class="rp-overlay" id="rpOverlay">
    <div class="rp-panel">
      <div class="rp-avatars">
        <img class="rp-avatar" id="rpAvatarA">
        <img class="rp-avatar B" id="rpAvatarB">
      </div>
      <div class="rp-status" id="rpStatus">Choose your role</div>
      <div class="rp-role-btns" id="rpRoleBtns">
        <button class="rp-role-btn" id="rpChooseA">Play A</button>
        <button class="rp-role-btn B" id="rpChooseB">Play B</button>
      </div>
      <div class="rp-progress">Line <span id="rpCur">1</span> / <span id="rpTotal">1</span></div>
      <div class="rp-controls">
        <button class="rp-btn rp-btn-hint" id="rpPlayHint">🔊 Hint</button>
        <button class="rp-btn rp-btn-answer" id="rpPlayAnswer">🔊 Answer</button>
        <button class="rp-btn rp-btn-next" id="rpNextLine">Next →</button>
      </div>
      <button class="rp-exit" id="rpExit">Exit</button>
    </div>
  </div>

  <!-- 词汇浮层 -->
  <div class="dlg-vocab-popup" id="vocabPopup">
    <div class="vp-hanzi" id="vpHanzi"></div>
    <div class="vp-pinyin" id="vpPinyin"></div>
    <div class="vp-pos"   id="vpPos"></div>
    <div class="vp-en"    id="vpEn"></div>
  </div>

  <script defer src="/js/dialogue.js"></script>
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
  </div>
  <script src="/js/exercise/sound.js"></script>
  <script src="/js/exercise/progress.js"></script>
  <script src="/js/exercise/celebration.js"></script>
  <script src="/js/exercise/exercise.js"></script>
    <script src="/js/exercise/types/vocab.js"></script>
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
  } else if (slideType === 'dialogue') {
    entry.title = 'Dialogue';
    entry.audio = 'dialogue/1.mp3';
    entry.speakers = [
      { id: 'A', name: '角色A', pinyin: 'jué sè A', avatar: 'avatars/A.png' },
      { id: 'B', name: '角色B', pinyin: 'jué sè B', avatar: 'avatars/B.png' }
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

module.exports = {
  contentTemplate,
  videoTemplate,
  exerciseTemplate,
  displayTemplate,
  dialogueTemplate,
  buildSlideEntry,
};