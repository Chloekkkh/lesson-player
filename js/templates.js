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
  <link rel="stylesheet" href="/css/common.css">
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
  <link rel="stylesheet" href="/css/common.css">
  <link rel="stylesheet" href="/css/dialogue.css">
</head>
<body>
<div class="dlg-card">

  <!-- ── 主视图：课文精读 ─────────────────────────────── -->
  <div class="dlg-main-view" id="dlgMainView">

    <!-- 左侧控制面板 -->
    <div class="dlg-left-panel">
      <!-- 卡片1：课程信息+音频控制 -->
      <div class="ctrl-card">
        <div class="ctrl-theme" id="ctrlTheme">情景对话</div>
        <div class="ctrl-audio-player">
          <button class="ctrl-play-btn" id="playBtn">
            <span id="playIcon">▶</span>
          </button>
          <div class="ctrl-audio-body">
            <div class="ctrl-progress-bar">
              <div class="ctrl-progress-fill" id="audioProgressFill"></div>
            </div>
            <div class="ctrl-audio-time">
              <span id="audioCurTime">0:00</span> / <span id="audioDur">0:00</span>
            </div>
          </div>
        </div>
        <button class="ctrl-text-toggle" id="textToggle">
          <span id="textToggleLabel">显示课文内容</span>
        </button>
      </div>

      <!-- 卡片2：工具栏 -->
      <div class="tool-card">
        <div class="speed-slider-wrap">
          <span class="speed-label">0.8x</span>
          <input type="range" id="speedSlider" class="speed-slider" min="0.8" max="1.4" step="0.1" value="1.0">
          <span class="speed-label">1.4x</span>
          <span class="speed-current" id="speedCurrent">1.0x</span>
        </div>
        <div class="lang-row">
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
        <button class="enter-practice-btn" id="enterPracticeBtn">
          进入对话练习 →
        </button>
      </div>
    </div>

    <!-- 右侧内容面板：场景模拟+课文精读整合卡片 -->
    <div class="dlg-right-panel" id="dlgRightPanel">
      <div class="scene-card" id="sceneCard">
        <!-- 场景顶部：图片+头像，始终显示 -->
        <div class="scene-top">
          <div class="scene-section">
            <img class="scene-img" id="sceneImg" alt="场景">
          </div>
          <div class="speakers-row" id="speakersRow"></div>
        </div>
        <!-- 课文文本：解锁后显示，可通过"显示/隐藏课文内容"切换 -->
        <div class="text-section" id="textSection">
          <div class="dlg-text-list" id="dlgTextList"></div>
        </div>
      </div>
    </div>
  </div><!-- /dlg-main-view -->

  <!-- ── 角色扮演浮层 ─────────────────────────────────── -->
  <div class="rp-overlay" id="rpOverlay">

    <!-- 左上角返回按钮 -->
    <button class="rp-back-btn" id="rpBackBtn">← 返回精读</button>

    <div class="rp-layout">

      <!-- 左侧面板 -->
      <div class="rp-left-panel">
        <div class="rp-my-role" id="rpMyRole">
          <img class="rp-my-avatar" id="rpMyAvatar" src="">
          <div class="rp-my-name" id="rpMyName"></div>
        </div>
        <div class="rp-progress-bar-wrap">
          <div class="rp-progress-label">第 <span id="rpCur">1</span> 句 / 共 <span id="rpTotal">1</span> 句</div>
          <div class="rp-progress-track">
            <div class="rp-progress-fill" id="rpProgressFill"></div>
          </div>
        </div>
        <div class="rp-lang-toggles">
          <label class="toggle-switch">
            <input type="checkbox" id="rpPinyinToggle" checked>
            <span class="toggle-slider"></span>
            <span>拼音</span>
          </label>
          <label class="toggle-switch">
            <input type="checkbox" id="rpEnglishToggle" checked>
            <span class="toggle-slider"></span>
            <span>英文</span>
          </label>
        </div>
        <button class="rp-giveup-btn" id="rpGiveupBtn">放弃当前练习</button>
      </div>

      <!-- 右侧对话区 -->
      <div class="rp-right-panel">
        <div class="chat-container" id="chatContainer"></div>
        <div class="rp-action-bar" id="rpActionBar">
          <!-- 角色选择阶段 -->
          <div class="rp-role-select" id="rpRoleSelect">
            <p class="rp-role-prompt">请选择你要扮演的角色：</p>
            <div class="rp-role-options">
              <button class="rp-role-opt" id="rpChooseA">
                <img class="rp-opt-avatar" id="rpChooseAvatarA" src="">
                <span id="rpChooseNameA"></span>
              </button>
              <button class="rp-role-opt" id="rpChooseB">
                <img class="rp-opt-avatar" id="rpChooseAvatarB" src="">
                <span id="rpChooseNameB"></span>
              </button>
            </div>
          </div>
          <!-- 练习进行中 -->
          <div class="rp-practice-controls" id="rpPracticeControls" style="display:none">
            <div class="record-hint" id="rpRecordHint" style="display:none">
              轮到你了：<span class="record-hanzi" id="rpRecordHanzi"></span>
            </div>
            <div class="record-area" id="rpRecordArea" style="display:none">
              <button class="record-btn" id="recordBtn">
                <span class="record-icon">🎙</span>
              </button>
              <button class="play-rec-btn" id="playRecBtn" style="display:none">🔊 回放录音</button>
            </div>
            <button class="rp-action-done" id="rpActionDone" disabled>我读完了 ✓</button>
          </div>
          <!-- 结束反馈 -->
          <div class="rp-result-overlay" id="rpResultOverlay" style="display:none">
            <div class="rp-result-icon">✓</div>
            <div class="rp-result-title">练习完成！</div>
            <div class="rp-result-btns">
              <button class="rp-result-btn rp-result-again" id="rpAgainBtn">再次练习</button>
              <button class="rp-result-btn rp-result-done" id="rpDoneBtn">完成成果</button>
            </div>
          </div>
        </div>
      </div>

    </div><!-- /rp-layout -->
  </div><!-- /rp-overlay -->

  <!-- 词汇浮层 -->
  <div class="dlg-vocab-popup" id="vocabPopup">
    <div class="vp-hanzi" id="vpHanzi"></div>
    <div class="vp-pinyin" id="vpPinyin"></div>
    <div class="vp-pos"   id="vpPos"></div>
    <div class="vp-en"   id="vpEn"></div>
  </div>

  <script defer src="/js/dialogue.js"></script>
</body>
</html>`;
}

function vocabTemplate(slideNum, courseTitle) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${courseTitle} - 生词 ${slideNum}</title>
  <link rel="stylesheet" href="/css/shared.css">
  <link rel="stylesheet" href="/css/common.css">
  <link rel="stylesheet" href="/css/vocab.css">
</head>
<body>
  <div class="vocab-card">
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
  </div>
  <script src="/js/exercise/sound.js"></script>
  <script src="/js/exercise/progress.js"></script>
  <script src="/js/exercise/celebration.js"></script>
  <script src="/js/vocab.js"></script>
</body>
</html>`;
}

/**
 * display — 生词 + 例句 双栏展示
 */
function displayTemplate(slideNum, courseTitle) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${courseTitle} - 生词与例句 ${slideNum}</title>
  <link rel="stylesheet" href="/css/shared.css">
  <link rel="stylesheet" href="/css/common.css">
  <link rel="stylesheet" href="/css/display.css">
</head>
<body>
  <div class="display-card">
    <div class="page-header">
      <h2 id="exerciseTitle">📚 生词与例句 New Words</h2>
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
    <div class="display-layout">
      <div class="display-vocab-col">
        <div id="vocabCol"></div>
      </div>
      <div class="display-example-col">
        <div id="exampleCol"></div>
      </div>
    </div>
    <div class="vocab-next-row">
  </div>
  <script src="/js/exercise/sound.js"></script>
  <script src="/js/exercise/progress.js"></script>
  <script src="/js/exercise/celebration.js"></script>
  <script src="/js/display.js"></script>
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
    title: slideType === 'vocab' ? '生词学习' : (slideType === 'display' ? '生词与例句' : (slideType === 'exercise' ? '练习' : '第 ' + slideNum + ' 页'))
  };

  if (slideType === 'exercise') {
    entry.title = '练习';
    entry.questions = [];
  } else if (slideType === 'vocab') {
    entry.vocab = [];
    entry.showPinyin = true;
    entry.showEnglish = true;
    entry.hasRecording = true;
  } else if (slideType === 'display') {
    entry.vocab = [];
    entry.examples = [];
    entry.showPinyin = true;
    entry.showEnglish = true;
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
  vocabTemplate,
  displayTemplate,
  dialogueTemplate,
  buildSlideEntry,
};