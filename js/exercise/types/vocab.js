/* ============================================================
   vocab.js — 生词展示（display 类型）
   6 词网格，音频播放 / 跟读录音 / 拼音英文开关 / 下一页
   ============================================================ */

'use strict';

registerType('display', VocabHandler);

function VocabHandler() {}

VocabHandler.prototype = {
  _config:    null,
  _callbacks: null,
  _recorder:  null,
  _currentWordAudio: null,
  _currentRecordingUrl: null,

  init: function(config, callbacks) {
    this._config    = config;
    this._callbacks = callbacks;
    this._render();
  },

  /* ── 渲染 ────────────────────────────────────────────── */
  _render: function() {
    var grid = document.getElementById('vocabGrid');
    if (!grid) return;
    grid.innerHTML = '';

    var vocab = this._config.vocab || [];
    var self = this;

    vocab.forEach(function(w) {
      var card = document.createElement('div');
      card.className = 'vocab-card';
      card.dataset.id = w.id;

      // 汉字
      var hanzi = document.createElement('div');
      hanzi.className = 'vocab-hanzi';
      hanzi.textContent = w.hanzi || '';

      // 拼音
      var pinyin = document.createElement('div');
      pinyin.className = 'vocab-pinyin vocab-pinyin-toggle-' + w.id;
      pinyin.textContent = (self._config.showPinyin !== false) ? (w.pinyin || '') : '';

      // 词性
      var pos = document.createElement('div');
      pos.className = 'vocab-pos';
      pos.textContent = w.pos || '';

      // 英文
      var en = document.createElement('div');
      en.className = 'vocab-en vocab-en-toggle-' + w.id;
      en.textContent = (self._config.showEnglish !== false) ? (w.en || '') : '';

      var meta = document.createElement('div');
      meta.className = 'vocab-meta';
      meta.appendChild(pinyin);
      meta.appendChild(pos);
      meta.appendChild(en);

      card.appendChild(hanzi);
      card.appendChild(meta);

      card.addEventListener('click', function() { self._showEnlarge(w); });

      grid.appendChild(card);
    });

    // 监听 toggle switch
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

    var nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
      nextBtn.className = 'vocab-next-btn';
      nextBtn.onclick = function() { self._callbacks.onComplete(); };
    }
  },

  /* ── 更新拼音/英文显示 ───────────────────────────────── */
  _updateToggles: function() {
    var vocab = this._config.vocab || [];
    var self = this;
    vocab.forEach(function(w) {
      document.querySelectorAll('.vocab-pinyin-toggle-' + w.id).forEach(function(el) {
        el.style.display = (self._config.showPinyin !== false) ? '' : 'none';
      });
      document.querySelectorAll('.vocab-en-toggle-' + w.id).forEach(function(el) {
        el.style.display = (self._config.showEnglish !== false) ? '' : 'none';
      });
    });
  },

  /* ── 点击放大 ──────────────────────────────────────────── */
  _showEnlarge: function(w) {
    var self = this;
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;cursor:pointer;';

    var html =
      '<div style="font-size:8rem;color:#fff;text-align:center;line-height:1.2;margin-bottom:0.3em">' + (w.hanzi||'') + '</div>' +
      '<div style="font-size:2rem;color:rgba(255,255,255,0.8);margin-bottom:0.2em">' + (w.pinyin||'') + '</div>' +
      (w.pos ? '<div style="font-size:1.2rem;color:rgba(255,255,255,0.5);margin-bottom:0.3em">' + w.pos + '</div>' : '') +
      '<div style="font-size:1.5rem;color:rgba(255,255,255,0.6);margin-bottom:0.8em">' + (w.en||'') + '</div>';

    // 三个功能按钮
    html += '<div style="display:flex;gap:1.5rem">';
    html += '<button id="enlargeAudioBtn" style="font-size:1.8rem;background:rgba(255,255,255,0.15);border:none;color:#fff;border-radius:50%;width:56px;height:56px;cursor:pointer">&#9654;</button>';
    html += '<button id="enlargeRecBtn" style="font-size:1.8rem;background:rgba(255,255,255,0.15);border:none;color:#fff;border-radius:50%;width:56px;height:56px;cursor:pointer">&#127908;</button>';
    html += '<button id="enlargePlayRecBtn" disabled style="font-size:1.8rem;background:rgba(255,255,255,0.08);border:none;color:rgba(255,255,255,0.4);border-radius:50%;width:56px;height:56px;cursor:not-allowed">&#128266;</button>';
    html += '</div>';

    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    // 点击 overlay 背景关闭
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        if (self._recorder && self._recorder.state === 'recording') self._stopRecordingEnlarge(overlay.querySelector('#enlargeRecBtn'));
        if (self._currentWordAudio) self._currentWordAudio.pause();
        overlay.remove();
      }
    });

    // 播放音频
    if (w.audio) {
      document.getElementById('enlargeAudioBtn').addEventListener('click', function(e) {
        e.stopPropagation();
        self._playWordAudioEnlarge(w.audio, this);
      });
    } else {
      document.getElementById('enlargeAudioBtn').style.display = 'none';
    }

    // 录音
    document.getElementById('enlargeRecBtn').addEventListener('click', function(e) {
      e.stopPropagation();
      self._toggleRecordEnlarge(w.id, this);
    });

    // 播放录音
    document.getElementById('enlargePlayRecBtn').addEventListener('click', function(e) {
      e.stopPropagation();
      if (self._currentRecordingUrl) self._playRecordingUrl(self._currentRecordingUrl, this);
    });
  },

  /* ── 放大弹窗：播放音频 ─────────────────────────────── */
  _playWordAudioEnlarge: function(audioFile, btn) {
    if (this._currentWordAudio) this._currentWordAudio.pause();
    btn.innerHTML = '&#9632;';
    this._currentWordAudio = new Audio();
    this._currentWordAudio.src = (this._config.audioBase||'') + audioFile;
    this._currentWordAudio.play().catch(function(){});
    this._currentWordAudio.onended = function() { btn.innerHTML = '&#9654;'; };
  },

  /* ── 放大弹窗：录音 ───────────────────────────────── */
  _toggleRecordEnlarge: function(wordId, btn) {
    var self = this;
    if (btn.classList.contains('recording')) {
      this._stopRecordingEnlarge(btn);
    } else {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
        var recorder = new MediaRecorder(stream);
        var chunks = [];
        recorder.ondataavailable = function(e) { chunks.push(e.data); };
        recorder.onstop = function() {
          stream.getTracks().forEach(function(t) { t.stop(); });
          var blob = new Blob(chunks, { type: 'audio/webm' });
          self._currentRecordingUrl = URL.createObjectURL(blob);
          var playBtn = document.getElementById('enlargePlayRecBtn');
          playBtn.disabled = false;
          playBtn.style.background = 'rgba(255,255,255,0.15)';
          playBtn.style.color = '#fff';
          playBtn.style.cursor = 'pointer';
          self._playRecordingUrl(self._currentRecordingUrl, btn);
        };
        self._recorder = recorder;
        recorder.start();
        btn.classList.add('recording');
        btn.innerHTML = '&#9632;';
      }).catch(function(err) { alert('Microphone access denied'); });
    }
  },

  _stopRecordingEnlarge: function(btn) {
    if (this._recorder && this._recorder.state !== 'inactive') this._recorder.stop();
    btn.classList.remove('recording');
    btn.innerHTML = '&#127908;';
  },

  _playRecordingUrl: function(url, btn) {
    var audio = new Audio(url);
    audio.play().catch(function(){});
    audio.onended = function() { btn.innerHTML = '&#127908;'; };
  }
};
