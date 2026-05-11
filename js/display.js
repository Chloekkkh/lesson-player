/* ============================================================
   display.js — 生词与例句双栏展示页（display 类型）
   左侧生词列表，右侧例句列表
   支持拼音/英文 toggle
   ============================================================ */

'use strict';

/* ── postToParent ─────────────────────────────────────── */
function postToParent(action, payload) {
  try { parent.postMessage({ type: 'playerMessage', action: action, data: payload }, '*'); } catch (e) {}
}

/* ── DisplayHandler ──────────────────────────────────── */
function DisplayHandler() {}

DisplayHandler.prototype = {
  _config: null,
  _callbacks: null,
  _currentExampleAudio: null,
  _recorder: null,
  _currentRecordingUrl: null,

  init: function(config, callbacks) {
    this._config = config;
    this._callbacks = callbacks;
    this._render();
    this._bindEvents();
  },

  /* ── 渲染生词和例句列表 ─────────────────────────────── */
  _render: function() {
    var self = this;
    var showPinyin = this._config.showPinyin !== false;
    var showEnglish = this._config.showEnglish !== false;

    // 左栏 — 只渲染第一个生词
    var vocabCol = document.getElementById('vocabCol');
    if (vocabCol) {
      vocabCol.innerHTML = '';
      var vocabList = this._config.vocab || [];
      if (vocabList.length > 0) {
        vocabCol.appendChild(self._buildVocabItem(vocabList[0], showPinyin, showEnglish));
      }
    }

    // 右栏 — 该词对应的所有例句
    var exampleCol = document.getElementById('exampleCol');
    if (exampleCol) {
      exampleCol.innerHTML = '';
      var examples = this._config.examples || [];
      examples.forEach(function(ex) {
        exampleCol.appendChild(self._buildExampleItem(ex, showPinyin, showEnglish));
      });
    }
  },

  /* ── 生词项 ─────────────────────────────────────────── */
  _buildVocabItem: function(w, showPinyin, showEnglish) {
    var item = document.createElement('div');
    item.className = 'display-item';

    var spine = document.createElement('div');
    spine.className = 'vocab-spine';

    var body = document.createElement('div');
    body.className = 'vocab-body';

    var hanzi = document.createElement('div');
    hanzi.className = 'vocab-hanzi';
    hanzi.textContent = w.hanzi || '';

    var pinyinEl = document.createElement('div');
    pinyinEl.className = 'vocab-pinyin';
    pinyinEl.textContent = showPinyin ? (w.pinyin || '') : '';

    var pos = document.createElement('div');
    pos.className = 'vocab-pos';
    pos.textContent = w.pos || '';

    var en = document.createElement('div');
    en.className = 'vocab-en';
    en.textContent = showEnglish ? (w.en || '') : '';

    body.appendChild(hanzi);
    if (showPinyin) body.appendChild(pinyinEl);
    if (w.pos) body.appendChild(pos);
    if (showEnglish) body.appendChild(en);

    item.appendChild(spine);
    item.appendChild(body);

    // 控制按钮
    var controls = document.createElement('div');
    controls.className = 'item-controls';

    var playBtn = document.createElement('button');
    playBtn.className = 'ctrl-btn-sm';
    playBtn.innerHTML = '&#9654;';
    if (w.audio) {
      playBtn.title = '播放音频';
      var self = this;
      playBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        self._playAudio(w.audio, playBtn);
      });
    } else {
      playBtn.style.visibility = 'hidden';
    }

    var recBtn = document.createElement('button');
    recBtn.className = 'ctrl-btn-sm rec-btn';
    recBtn.innerHTML = '&#127908;';
    recBtn.title = '录音';
    recBtn.dataset.id = w.id;

    var playRecBtn = document.createElement('button');
    playRecBtn.className = 'ctrl-btn-sm';
    playRecBtn.innerHTML = '&#128266;';
    playRecBtn.title = '播放录音';
    playRecBtn.disabled = true;

    controls.appendChild(playBtn);
    controls.appendChild(recBtn);
    controls.appendChild(playRecBtn);
    item.appendChild(controls);

    var self = this;
    recBtn.addEventListener('click', function() { self._toggleRecord(recBtn, playRecBtn); });
    playRecBtn.addEventListener('click', function() {
      if (self._currentRecordingUrl) self._playRecordingUrl(self._currentRecordingUrl, playRecBtn);
    });

    return item;
  },

  /* ── 例句项 ─────────────────────────────────────────── */
  _buildExampleItem: function(ex, showPinyin, showEnglish) {
    var self = this;
    var item = document.createElement('div');
    item.className = 'example-item';

    var topRow = document.createElement('div');
    topRow.style.display = 'flex';
    topRow.style.alignItems = 'center';
    topRow.style.justifyContent = 'space-between';

    var textCol = document.createElement('div');
    textCol.style.flex = '1';

    var hanzi = document.createElement('div');
    hanzi.className = 'example-hanzi';
    hanzi.textContent = ex.hanzi || '';

    var pinyinEl = document.createElement('div');
    pinyinEl.className = 'example-pinyin';
    pinyinEl.textContent = showPinyin ? (ex.pinyin || '') : '';

    var en = document.createElement('div');
    en.className = 'example-en';
    en.textContent = showEnglish ? (ex.en || '') : '';

    textCol.appendChild(hanzi);
    textCol.appendChild(pinyinEl);
    textCol.appendChild(en);

    var controls = document.createElement('div');
    controls.className = 'example-controls';

    var playBtn = document.createElement('button');
    playBtn.className = 'ctrl-btn-sm';
    playBtn.innerHTML = '&#9654;';
    if (ex.audio) {
      playBtn.title = '播放音频';
      playBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        self._playExampleAudio(ex.audio, playBtn);
      });
    } else {
      playBtn.style.visibility = 'hidden';
    }

    var recBtn = document.createElement('button');
    recBtn.className = 'ctrl-btn-sm rec-btn';
    recBtn.innerHTML = '&#127908;';
    recBtn.title = '录音';
    recBtn.dataset.exampleId = ex.id;

    var playRecBtn = document.createElement('button');
    playRecBtn.className = 'ctrl-btn-sm';
    playRecBtn.innerHTML = '&#128266;';
    playRecBtn.title = '播放录音';
    playRecBtn.disabled = true;

    controls.appendChild(playBtn);
    controls.appendChild(recBtn);
    controls.appendChild(playRecBtn);

    topRow.appendChild(textCol);
    topRow.appendChild(controls);

    item.appendChild(topRow);

    // 录音事件
    recBtn.addEventListener('click', function() { self._toggleRecord(recBtn, playRecBtn); });

    playRecBtn.addEventListener('click', function() {
      if (self._currentRecordingUrl) self._playRecordingUrl(self._currentRecordingUrl, playRecBtn);
    });

    return item;
  },

  /* ── 例句音频 ────────────────────────────────────────── */
  _playExampleAudio: function(audioFile, btn) {
    if (this._currentExampleAudio) this._currentExampleAudio.pause();
    btn.innerHTML = '&#9632;';
    var self = this;
    this._currentExampleAudio = new Audio();
    this._currentExampleAudio.src = (this._config.audioBase || '') + audioFile;
    this._currentExampleAudio.play().catch(function() {});
    this._currentExampleAudio.onended = function() { btn.innerHTML = '&#9654;'; };
  },

  /* ── 录音切换 ────────────────────────────────────────── */
  _toggleRecord: function(recBtn, playRecBtn) {
    var self = this;
    if (recBtn.classList.contains('recording')) {
      if (this._recorder && this._recorder.state !== 'inactive') this._recorder.stop();
      recBtn.classList.remove('recording');
      recBtn.innerHTML = '&#127908;';
    } else {
      var getMedia = navigator.mediaDevices && navigator.mediaDevices.getUserMedia
        || navigator.getUserMedia.bind(navigator);
      getMedia({ audio: true }).then(function(stream) {
        var recorder = new MediaRecorder(stream);
        var chunks = [];
        recorder.ondataavailable = function(e) { chunks.push(e.data); };
        recorder.onstop = function() {
          stream.getTracks().forEach(function(t) { t.stop(); });
          var blob = new Blob(chunks, { type: 'audio/webm' });
          self._currentRecordingUrl = URL.createObjectURL(blob);
          playRecBtn.disabled = false;
          playRecBtn.style.opacity = '1';
          self._playRecordingUrl(self._currentRecordingUrl, playRecBtn);
        };
        self._recorder = recorder;
        recorder.start();
        recBtn.classList.add('recording');
        recBtn.innerHTML = '&#9632;';
      }).catch(function() { alert('Microphone access denied'); });
    }
  },

  _playRecordingUrl: function(url, btn) {
    var audio = new Audio(url);
    audio.play().catch(function() {});
    var self = this;
    audio.onended = function() { btn.innerHTML = '&#127908;'; };
  },

  /* ── 播放音频 ────────────────────────────────────────── */
  _playAudio: function(audioFile, btn) {
    if (this._currentAudio) this._currentAudio.pause();
    btn.innerHTML = '&#9632;';
    var self = this;
    this._currentAudio = new Audio();
    this._currentAudio.src = (this._config.audioBase || '') + audioFile;
    this._currentAudio.play().catch(function() {});
    this._currentAudio.onended = function() { btn.innerHTML = '&#9654;'; };
  },

  /* ── 绑定 toggle 和 next 事件 ───────────────────────── */
  _bindEvents: function() {
    var self = this;

    // 拼音 toggle
    var pinyinToggle = document.getElementById('togglePinyin');
    if (pinyinToggle) {
      pinyinToggle.checked = this._config.showPinyin !== false;
      pinyinToggle.addEventListener('change', function() {
        self._config.showPinyin = pinyinToggle.checked;
        self._render();
      });
    }

    // 英文 toggle
    var englishToggle = document.getElementById('toggleEnglish');
    if (englishToggle) {
      englishToggle.checked = this._config.showEnglish !== false;
      englishToggle.addEventListener('change', function() {
        self._config.showEnglish = englishToggle.checked;
        self._render();
      });
    }

    // 下一页按钮
    var nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
      nextBtn.onclick = function() { self._callbacks.onComplete(); };
    }
  }
};

/* ── postMessage 入口 ───────────────────────────────── */
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'slideData') {
    var handler = new DisplayHandler();
    handler.init(e.data.data, {
      onComplete: function() { postToParent('displayComplete', {}); }
    });
  }
});