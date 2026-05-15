/* ============================================================
   vocab.js — 生词展示页面（vocab 类型）
   水平活页词表版：每行一个词，右侧带播放/录音按钮
   ============================================================ */

'use strict';

/* ── postToParent ─────────────────────────────────────── */
function postToParent(action, payload) {
  try { parent.postMessage({ type: 'playerMessage', action: action, data: payload }, '*'); } catch (e) {}
}

/* ── Sound / Progress / Celebration 初始化 ──────────── */
Sound.init('/systemAssets/audio/');

/* ── VocabHandler ──────────────────────────────────────── */
function VocabHandler() {}

VocabHandler.prototype = {
  _config:    null,
  _callbacks: null,
  _recorder:  null,
  _currentWordAudio: null,

  init: function(config, callbacks) {
    this._config    = config;
    this._callbacks = callbacks;
    this._render();
    this._bindControls();
  },

  /* ── 渲染 — 水平词表行 ─────────────────────────────── */
  _render: function() {
    var grid = document.getElementById('vocabGrid');
    if (!grid) return;
    grid.innerHTML = '';

    var subtitleEl = document.getElementById('exerciseSubtitle');
    if (subtitleEl) subtitleEl.textContent = 'Master Your New Words';

    var vocab   = this._config.vocab || [];
    var showPinyin  = this._config.showPinyin !== false;
    var showEnglish = this._config.showEnglish !== false;
    var self = this;

    vocab.forEach(function(w) {
      var row = document.createElement('div');
      row.className = 'vocab-item';
      row.dataset.id = w.id;

      // 汉字
      var hanzi = document.createElement('div');
      hanzi.className = 'vocab-hanzi';
      hanzi.textContent = w.hanzi || '';

      // 拼音（col2）
      var pinyin = document.createElement('div');
      pinyin.className = 'vocab-pinyin vocab-pinyin-toggle-' + w.id;
      pinyin.textContent = showPinyin ? (w.pinyin || '') : '';

      // 词性（col3）
      var pos = document.createElement('div');
      pos.className = 'vocab-pos';
      pos.textContent = w.pos || '';

      // 英文（col4）
      var en = document.createElement('div');
      en.className = 'vocab-en vocab-en-toggle-' + w.id;
      en.textContent = showEnglish ? (w.en || '') : '';

      // 操作按钮（col5）
      var actions = document.createElement('div');
      actions.className = 'vocab-actions';

      // 播放音频
      var playBtn = document.createElement('button');
      playBtn.className = 'vocab-audio-btn';
      playBtn.innerHTML = '&#9654;';
      playBtn.title = '播放音频';
      if (w.audio != null) {
        playBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          self._playWordAudio(w, playBtn);
        });
      } else {
        playBtn.style.visibility = 'hidden';
      }

      // 录音
      var recBtn = document.createElement('button');
      recBtn.className = 'vocab-rec-btn';
      recBtn.innerHTML = '&#127908;';
      recBtn.title = '录音';
      recBtn.dataset.wordId = w.id;

      // 播放录音（初始禁用）
      var playRecBtn = document.createElement('button');
      playRecBtn.className = 'vocab-rec-btn';
      playRecBtn.innerHTML = '&#128266;';
      playRecBtn.title = '播放录音';
      playRecBtn.style.background = 'rgba(0,0,0,0.2)';
      playRecBtn.style.opacity = '0.4';
      playRecBtn.disabled = true;

      actions.appendChild(playBtn);
      actions.appendChild(recBtn);
      actions.appendChild(playRecBtn);

      row.appendChild(hanzi);
      row.appendChild(pinyin);
      row.appendChild(pos);
      row.appendChild(en);
      row.appendChild(actions);

      // 录音事件
      recBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        self._toggleRecord(w.id, recBtn, playRecBtn);
      });
      playRecBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (playRecBtn._recUrl) self._playRecordingUrl(playRecBtn._recUrl, playRecBtn);
      });

      row.addEventListener('click', function() { self._showEnlarge(w); });

      grid.appendChild(row);
    });
  },

  /* ── 绑定控制开关 ─────────────────────────────────── */
  _bindControls: function() {
    var self = this;
    var pinyinToggle = document.getElementById('togglePinyin');
    var englishToggle = document.getElementById('toggleEnglish');

    if (pinyinToggle) {
      pinyinToggle.checked = this._config.showPinyin !== false;
      pinyinToggle.addEventListener('change', function() {
        self._config.showPinyin = pinyinToggle.checked;
        self._updateToggles();
      });
    }
    if (englishToggle) {
      englishToggle.checked = this._config.showEnglish !== false;
      englishToggle.addEventListener('change', function() {
        self._config.showEnglish = englishToggle.checked;
        self._updateToggles();
      });
    }

      },

  /* ── 更新拼音/英文显示 ────────────────────────────── */
  _updateToggles: function() {
    var vocab = this._config.vocab || [];
    var self = this;
    vocab.forEach(function(w) {
      document.querySelectorAll('.vocab-pinyin-toggle-' + w.id).forEach(function(el) {
        el.style.visibility = (self._config.showPinyin !== false) ? '' : 'hidden';
      });
      document.querySelectorAll('.vocab-en-toggle-' + w.id).forEach(function(el) {
        el.style.visibility = (self._config.showEnglish !== false) ? '' : 'hidden';
      });
    });
  },

  /* ── 行内播放音频 ────────────────────────────────── */
  _playWordAudio: function(w, btn) {
    if (this._currentWordAudio) this._currentWordAudio.pause();
    btn.innerHTML = '&#9632;';
    var self = this;
    this._currentWordAudio = new Audio();
    this._currentWordAudio.src = (this._config.audioBase || '') + w.audio;
    this._currentWordAudio.play().catch(function() {});
    this._currentWordAudio.onended = function() { btn.innerHTML = '&#9654;'; };
  },

  /* ── 行内录音 ────────────────────────────────────── */
  _toggleRecord: function(wordId, recBtn, playRecBtn) {
    var self = this;
    if (recBtn.classList.contains('recording')) {
      if (this._recorder && this._recorder.state !== 'inactive') this._recorder.stop();
      recBtn.classList.remove('recording');
      recBtn.innerHTML = '&#127908;';
    } else {
      var getMedia = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices))
          || (navigator.getUserMedia && navigator.getUserMedia.bind(navigator));
      if (!getMedia) { console.warn('Microphone API not available'); alert('Microphone not supported'); return; }
      getMedia({ audio: true }).then(function(stream) {
        var recorder = new MediaRecorder(stream);
        var chunks = [];
        recorder.ondataavailable = function(e) { chunks.push(e.data); };
        recorder.onstop = function() {
          stream.getTracks().forEach(function(t) { t.stop(); });
          var blob = new Blob(chunks, { type: 'audio/webm' });
          playRecBtn._recUrl = URL.createObjectURL(blob);
          playRecBtn.disabled = false;
          playRecBtn.style.opacity = '1';
          playRecBtn.style.background = '#22a86e';
          self._playRecordingUrl(playRecBtn._recUrl, playRecBtn);
        };
        self._recorder = recorder;
        recorder.start();
        recBtn.classList.add('recording');
        recBtn.innerHTML = '&#9632;';
      }).catch(function() { alert('Microphone access denied'); });
    }
  },

  _playRecordingUrl: function(url, playBtn) {
    var audio = new Audio(url);
    audio.play().catch(function() {});
    audio.onended = function() {
      playBtn.innerHTML = '&#128266;';
      playBtn.style.background = 'rgba(0,0,0,0.2)';
      playBtn.style.opacity = '0.4';
    };
  },

  /* ── 点击放大弹层（白色卡片） ─────────────────────── */
  _showEnlarge: function(w) {
    var self = this;
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:pointer;backdrop-filter:blur(4px);';

    var card = document.createElement('div');
    card.style.cssText = 'background:#fff;border-radius:24px;padding:48px 40px;width:480px;max-width:90vw;box-shadow:0 24px 64px rgba(0,0,0,0.25);display:flex;flex-direction:column;align-items:center;gap:12px;cursor:default;';

    var hanzi = document.createElement('div');
    hanzi.style.cssText = 'font-size:5.5rem;font-weight:900;color:#1e293b;letter-spacing:0.05em;line-height:1.1;';
    hanzi.textContent = w.hanzi || '';
    card.appendChild(hanzi);

    var pinyin = document.createElement('div');
    pinyin.style.cssText = 'font-size:1.5rem;color:#22a86e;font-weight:500;letter-spacing:0.04em;';
    pinyin.textContent = w.pinyin || '';
    card.appendChild(pinyin);

    if (w.pos) {
      var posEl = document.createElement('div');
      posEl.style.cssText = 'font-size:0.8rem;font-weight:700;color:#fff;background:#22a86e;padding:3px 14px;border-radius:20px;';
      posEl.textContent = w.pos;
      card.appendChild(posEl);
    }

    var en = document.createElement('div');
    en.style.cssText = 'font-size:1.2rem;color:#64748b;line-height:1.5;text-align:center;';
    en.textContent = w.en || '';
    card.appendChild(en);

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:16px;margin-top:8px;';

    var audioBtn = document.createElement('button');
    audioBtn.style.cssText = 'font-size:1.5rem;background:#22a86e;border:none;color:#fff;border-radius:50%;width:50px;height:50px;cursor:pointer;';
    audioBtn.innerHTML = '&#9654;';

    var recBtn = document.createElement('button');
    recBtn.style.cssText = 'font-size:1.5rem;background:#e55;border:none;color:#fff;border-radius:50%;width:50px;height:50px;cursor:pointer;';
    recBtn.innerHTML = '&#127908;';

    var playRecBtn = document.createElement('button');
    playRecBtn.style.cssText = 'font-size:1.5rem;background:rgba(0,0,0,0.15);border:none;color:rgba(0,0,0,0.35);border-radius:50%;width:50px;height:50px;cursor:not-allowed;';
    playRecBtn.innerHTML = '&#128266;';
    playRecBtn.disabled = true;

    btnRow.appendChild(audioBtn);
    btnRow.appendChild(recBtn);
    btnRow.appendChild(playRecBtn);
    card.appendChild(btnRow);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        if (self._recorder && self._recorder.state === 'recording') { self._recorder.stop(); recBtn.classList.remove('recording'); recBtn.innerHTML = '&#127908;'; recBtn.style.background = '#e55'; }
        if (self._currentWordAudio) self._currentWordAudio.pause();
        overlay.remove();
      }
    });

    if (w.audio) {
      audioBtn.addEventListener('click', function(e) { e.stopPropagation(); self._playWordAudio(w, audioBtn); });
    } else { audioBtn.style.display = 'none'; }

    recBtn.addEventListener('click', function(e) { e.stopPropagation(); self._toggleRecordCard(recBtn, playRecBtn); });

    playRecBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (playRecBtn._recUrl) {
        var a = new Audio(playRecBtn._recUrl);
        a.play().catch(function(){});
        a.onended = function() { playRecBtn.style.color = 'rgba(0,0,0,0.35)'; playRecBtn.style.background = 'rgba(0,0,0,0.15)'; playRecBtn.style.cursor = 'not-allowed'; };
      }
    });
  },

  _toggleRecordCard: function(recBtn, playRecBtn) {
    var self = this;
    if (recBtn.classList.contains('recording')) {
      if (this._recorder && this._recorder.state !== 'inactive') this._recorder.stop();
      recBtn.classList.remove('recording');
      recBtn.innerHTML = '&#127908;';
      recBtn.style.background = '#e55';
    } else {
      var getMedia = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices))
          || (navigator.getUserMedia && navigator.getUserMedia.bind(navigator));
      if (!getMedia) { console.warn('Microphone API not available'); alert('Microphone not supported'); return; }
      getMedia({ audio: true }).then(function(stream) {
        var recorder = new MediaRecorder(stream);
        var chunks = [];
        recorder.ondataavailable = function(e) { chunks.push(e.data); };
        recorder.onstop = function() {
          stream.getTracks().forEach(function(t) { t.stop(); });
          var blob = new Blob(chunks, { type: 'audio/webm' });
          playRecBtn._recUrl = URL.createObjectURL(blob);
          playRecBtn.disabled = false;
          playRecBtn.style.color = '#fff';
          playRecBtn.style.background = '#22a86e';
          playRecBtn.style.cursor = 'pointer';
        };
        self._recorder = recorder;
        recorder.start();
        recBtn.classList.add('recording');
        recBtn.innerHTML = '&#9632;';
        recBtn.style.background = '#c00';
      }).catch(function() { alert('Microphone access denied'); });
    }
  }
};

/* ── postMessage 入口 ───────────────────────────────── */
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'slideData') {
    var handler = new VocabHandler();
    handler.init(e.data.data, {
      onComplete: function() { postToParent('displayComplete', {}); }
    });
  }
});
