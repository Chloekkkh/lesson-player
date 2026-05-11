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

    // 左栏 — 生词列表
    var vocabCol = document.getElementById('vocabCol');
    if (vocabCol) {
      vocabCol.innerHTML = '';
      var vocabList = this._config.vocab || [];
      vocabList.forEach(function(w) {
        vocabCol.appendChild(self._buildVocabItem(w, showPinyin, showEnglish));
      });
    }

    // 右栏 — 例句列表
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

    var main = document.createElement('div');
    main.className = 'vocab-main';

    var hanzi = document.createElement('div');
    hanzi.className = 'vocab-hanzi';
    hanzi.textContent = w.hanzi || '';

    var meta = document.createElement('div');
    meta.className = 'vocab-meta';

    var pinyinEl = document.createElement('div');
    pinyinEl.className = 'vocab-pinyin';
    pinyinEl.textContent = showPinyin ? (w.pinyin || '') : '';

    var pos = document.createElement('div');
    pos.className = 'vocab-pos';
    pos.textContent = w.pos || '';

    var en = document.createElement('div');
    en.className = 'vocab-en';
    en.textContent = showEnglish ? (w.en || '') : '';

    meta.appendChild(pinyinEl);
    if (w.pos) meta.appendChild(pos);
    meta.appendChild(en);

    main.appendChild(hanzi);
    main.appendChild(meta);
    item.appendChild(main);

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

    controls.appendChild(playBtn);
    controls.appendChild(recBtn);
    item.appendChild(controls);

    return item;
  },

  /* ── 例句项 ─────────────────────────────────────────── */
  _buildExampleItem: function(ex, showPinyin, showEnglish) {
    var item = document.createElement('div');
    item.className = 'example-item';

    var hanzi = document.createElement('div');
    hanzi.className = 'example-hanzi';
    hanzi.textContent = ex.hanzi || '';

    var pinyinEl = document.createElement('div');
    pinyinEl.className = 'example-pinyin';
    pinyinEl.textContent = showPinyin ? (ex.pinyin || '') : '';

    var en = document.createElement('div');
    en.className = 'example-en';
    en.textContent = showEnglish ? (ex.en || '') : '';

    item.appendChild(hanzi);
    item.appendChild(pinyinEl);
    item.appendChild(en);

    return item;
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