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

  <!-- 页面标题 -->
  <div class="page-header">
    <h2 id="ctrlTitle"></h2>
  </div>

  <!-- ═══ 全局导航条（三视图共享） ════════════════════ -->
  <div class="dlg-nav-bar" id="dlgNavBar">
    <button class="nav-back-btn" id="navBackBtn">← Back</button>
    <span class="stage-badge" id="stageBadge">Intensive Reading · 精读课</span>
    <span class="nav-progress" id="navProgress"></span>
  </div>

  <!-- ═══ 视图1：课文精读 ═══════════════════════════════ -->
  <div class="dlg-view dlg-view-text" id="dlgMainView">

    <!-- 左侧控制面板（单卡片） -->
    <div class="dlg-left-panel">
      <div class="dlg-ctrl-panel">
        <!-- 播放按钮（居中大圆） -->
        <button class="ctrl-play-btn" id="playBtn">
          <span id="playIcon">▶</span>
        </button>
        <!-- 进度条 + 时间 -->
        <div class="ctrl-progress-bar">
          <div class="ctrl-progress-fill" id="audioProgressFill"></div>
        </div>
        <div class="ctrl-audio-time">
          <span id="audioCurTime">0:00</span> / <span id="audioDur">0:00</span>
        </div>
        <!-- 语速 + 开关组 -->
        <div class="controls-group">
          <div class="speed-row">
            <span class="speed-label">Speed</span>
            <input type="range" id="speedSlider" class="speed-slider" min="0.8" max="1.4" step="0.1" value="1.0">
            <span class="speed-current" id="speedCurrent">1.0x</span>
          </div>
          <div class="lang-row">
            <div class="control-row">
              <span class="control-label">Pinyin</span>
              <label class="toggle-switch">
                <input type="checkbox" id="pinyinToggle" checked>
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="control-row">
              <span class="control-label">English</span>
              <label class="toggle-switch">
                <input type="checkbox" id="englishToggle" checked>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
        <!-- 按钮区 -->
        <button class="enter-practice-btn" id="enterPracticeBtn">
          🎭 进入角色扮演 →
        </button>
        <button class="ctrl-text-toggle" id="textToggle">
          <span id="textToggleLabel">Show transcript</span>
        </button>
      </div>
    </div>

    <!-- 右侧内容面板 -->
    <div class="dlg-right-panel" id="dlgRightPanel">
      <div class="scene-card" id="sceneCard">
        <div class="scene-top">
          <div class="scene-section">
            <img class="scene-img" id="sceneImg" alt="场景">
          </div>
          <div class="speakers-row" id="speakersRow"></div>
        </div>
        <div class="text-section" id="textSection">
          <div class="dlg-text-list" id="dlgTextList"></div>
        </div>
      </div>
    </div>
  </div><!-- /dlgMainView -->

  <!-- ═══ 视图2：选择角色（全屏） ═══════════════════════ -->
  <div class="dlg-view dlg-role-select-view" id="dlgRoleSelectView">
    <div class="role-select-content">
      <h2 class="role-select-heading">🎭 选择你的角色</h2>
      <p class="role-select-sub">Choose your role for this conversation</p>
      <div class="role-select-cards">
        <button class="role-card" id="rpChooseA">
          <img class="role-card-avatar" id="rpChooseAvatarA" src="">
          <div class="role-card-name" id="rpChooseNameA"></div>
        </button>
        <div class="role-vs">
          <span class="role-vs-line"></span>
          <span class="role-vs-text">VS</span>
          <span class="role-vs-line"></span>
        </div>
        <button class="role-card" id="rpChooseB">
          <img class="role-card-avatar" id="rpChooseAvatarB" src="">
          <div class="role-card-name" id="rpChooseNameB"></div>
        </button>
      </div>
      <p class="role-select-hint" id="rpTotalHint">共 <span id="rpTotal">1</span> 句对话</p>
    </div>
  </div><!-- /dlgRoleSelectView -->

  <!-- ═══ 视图3：对话练习（全屏） ═══════════════════════ -->
  <div class="dlg-view dlg-practice-view" id="dlgPracticeView">
    <div class="practice-layout">
      <!-- 左侧面板 -->
      <div class="rp-left-panel">
        <!-- 我的角色 -->
        <div class="rp-role-section">
          <img class="rp-my-avatar" id="rpMyAvatar" src="">
          <div class="rp-my-name" id="rpMyName"></div>
          <div class="rp-my-pinyin" id="rpMyPinyin"></div>
        </div>
        <!-- 进度圆点 -->
        <div class="rp-progress-section">
          <div class="rp-progress-dots" id="rpProgressDots"></div>
          <div class="rp-progress-label">第 <span id="rpCur">1</span> / <span id="rpTotal2">1</span> 句</div>
        </div>
        <!-- 开关 -->
        <div class="rp-toggles-section">
          <div class="control-row">
            <span class="control-label">Pinyin</span>
            <label class="toggle-switch">
              <input type="checkbox" id="rpPinyinToggle" checked>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="control-row">
            <span class="control-label">English</span>
            <label class="toggle-switch">
              <input type="checkbox" id="rpEnglishToggle" checked>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
        <!-- 放弃 -->
        <button class="rp-giveup-btn" id="rpGiveupBtn">Quit</button>
      </div>

      <!-- 右侧对话区 -->
      <div class="rp-right-panel">
        <div class="chat-container" id="chatContainer"></div>
        <div class="rp-action-bar" id="rpActionBar">
          <!-- 练习进行中 -->
          <div class="rp-practice-controls" id="rpPracticeControls" style="display:none">
            <div class="record-sentence" id="rpRecordSentence" style="display:none">
              <span class="record-sentence-label">轮到你了</span>
              <span class="record-sentence-text" id="rpRecordHanzi"></span>
            </div>
            <div class="record-area-new" id="rpRecordArea" style="display:none">
              <button class="record-btn" id="recordBtn">
                <span class="record-icon">🎤</span>
              </button>
              <span class="record-hint-text">按住录音 · 松开停止</span>
            </div>
            <div class="record-actions" id="rpRecordActions" style="display:none">
              <button class="play-rec-btn" id="playRecBtn">🔊 回放</button>
              <button class="rp-action-done" id="rpActionDone" disabled>✓ 读完了</button>
            </div>
          </div>
          <!-- 结束反馈 -->
          <div class="rp-result-overlay" id="rpResultOverlay" style="display:none">
            <div class="rp-result-icon">✓</div>
            <div class="rp-result-title">Practice Complete!</div>
            <div class="rp-result-btns">
              <button class="rp-result-btn rp-result-again" id="rpAgainBtn">Retry</button>
              <button class="rp-result-btn rp-result-done" id="rpDoneBtn">Finish</button>
            </div>
          </div>
          <!-- 完成确认弹窗 -->
          <div class="rp-finish-overlay" id="rpFinishOverlay" style="display:none">
            <div class="rp-finish-card">
              <div class="rp-finish-icon">🎉</div>
              <div class="rp-finish-title">完成练习</div>
              <div class="rp-finish-sub">确定要结束本次对话练习吗？</div>
              <div class="rp-finish-btns">
                <button class="rp-finish-cancel" id="rpFinishCancel">继续练习</button>
                <button class="rp-finish-confirm" id="rpFinishConfirm">确定完成</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div><!-- /practice-layout -->
  </div><!-- /dlgPracticeView -->

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