/* ============================================================
   choice.js — 选择题（listen 听音识词 / read 阅读理解）
   ============================================================ */

'use strict';

registerType('listen', ChoiceHandler);
registerType('read',   ChoiceHandler);

function ChoiceHandler() {}

ChoiceHandler.prototype = {
  _config:      null,
  _callbacks:   null,
  _q:           null,   // 单题（_questions[0]）
  _selectedId:  null,
  _audio:       null,
  _submitted:   false,

  /* ── init ─────────────────────────────────────────────── */
  init: function(config, callbacks) {
    this._config    = config;
    this._callbacks = callbacks;
    this._q         = config.questions[0] || null;
    this._audio     = null;
    this._audioTimeout = null;
    this._submitted = false;
    this._selectedId = null;
    this._render();
  },

  /* ── 渲染 ─────────────────────────────────────────────── */
  _render: function() {
    var q = this._q;
    if (!q) return;

    var choiceArea = document.getElementById('choiceArea');
    if (choiceArea) {
      choiceArea.style.display = '';
      // 自我重建内部结构，不依赖 HTML 预设子元素
      // listen：按钮在题目上方；read：按钮隐藏，题目在上
      choiceArea.innerHTML =
        '<div id="playAudioWrap" style="display:none;text-align:center;margin:0 0 16px">' +
        '  <button class="play-audio-btn" id="playAudioBtn">▶</button>' +
        '</div>' +
        '<p class="question-text" id="questionText"></p>' +
        '<div class="options" id="optionsContainer"></div>';
    }

    this._selectedId = null;
    this._submitted   = false;

    var questionEl = document.getElementById('questionText');
    if (questionEl) {
      questionEl.innerHTML = '<p class="question-main">' + (q.question || '') + '</p>';
    }

    // 渲染选项
    var container = document.getElementById('optionsContainer');
    if (container) {
      container.innerHTML = '';
      var self = this;
      (q.options || []).forEach(function(opt) {
        var btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.dataset.id = opt.id;
        var idSpan = document.createElement('span');
        idSpan.className = 'option-id';
        idSpan.textContent = opt.id;
        var textSpan = document.createElement('span');
        textSpan.className = 'option-text';
        textSpan.textContent = opt.text;
        btn.appendChild(idSpan);
        btn.appendChild(textSpan);
        btn.addEventListener('click', function() {
          if (!self._submitted) self._select(opt.id, btn);
        });
        container.appendChild(btn);
      });
    }

    // listen：显示播放按钮；read：隐藏
    var playBtn = document.getElementById('playAudioBtn');
    var playWrap = document.getElementById('playAudioWrap');
    if (playBtn && playWrap) {
      if (this._config.type === 'listen') {
        playWrap.style.display = '';
        playBtn.className = 'play-audio-btn';
        playBtn.innerHTML = '<span class="play-icon">▶</span>';
        playBtn.disabled = false;
        playBtn.onclick = function() { self._playAudio(q.audio); };
      } else {
        playWrap.style.display = 'none';
      }
    }

    // 确认按钮
    var submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.className = 'submit-btn';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submit';
      submitBtn.style.display = '';
      submitBtn.onclick = function() { self._submit(); };
    }

    // listen：自动播放
    if (this._config.type === 'listen' && q.audio) {
      var self2 = this;
      setTimeout(function() { self2._playAudio(q.audio); }, 400);
    }
  },

  /* ── 停止音频 ─────────────────────────────────────────── */
  _stopAudio: function() {
    if (this._audioTimeout) {
      clearTimeout(this._audioTimeout);
      this._audioTimeout = null;
    }
    if (this._audio) {
      this._audio.pause();
      this._audio.onended = null;
      this._audio = null;
    }
    var playBtn = document.getElementById('playAudioBtn');
    if (playBtn) {
      playBtn.disabled = false;
      playBtn.classList.remove('playing');
      playBtn.innerHTML = '<span class="play-icon">▶</span>';
    }
  },

  /* ── 播放音频 ──────────────────────────────────────────── */
  _playAudio: function(audioFile) {
    if (!audioFile) return;
    this._stopAudio();
    var base = this._config.audioBase || '';
    var src = base + audioFile;
    var playBtn = document.getElementById('playAudioBtn');
    if (playBtn) {
      playBtn.disabled = true;
      playBtn.innerHTML = '<span class="play-icon">◼</span>';
      playBtn.classList.remove('playing');
    }
    var self = this;
    var audioScheduled = Date.now();
    this._audioTimeout = setTimeout(function() {
      // 切题后旧超时作废
      if (self._audio && self._audio._scheduledAt !== audioScheduled) return;
      self._audio = new Audio();
      self._audio._scheduledAt = audioScheduled;
      self._audio.src = src;
      var btn = document.getElementById('playAudioBtn');
      if (btn) btn.classList.add('playing');
      self._audio.play().catch(function() {
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('playing');
          btn.innerHTML = '<span class="play-icon">▶</span> Listen';
        }
      });
      self._audio.onended = function() {
        var endBtn = document.getElementById('playAudioBtn');
        if (endBtn) {
          endBtn.disabled = false;
          endBtn.classList.remove('playing');
          endBtn.innerHTML = '<span class="play-icon">▶</span>';
        }
        self._audioTimeout = null;
      };
    }, 400);
  },

  /* ── 选择选项 ──────────────────────────────────────────── */
  _select: function(id, btn) {
    this._selectedId = id;
    document.querySelectorAll('.option-btn').forEach(function(b) {
      b.classList.remove('selected', 'correct', 'wrong');
    });
    btn.classList.add('selected');
    var submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.add('enabled');
    }
  },

  /* ── 提交 ─────────────────────────────────────────────── */
  _submit: function() {
    if (this._submitted || !this._selectedId) return;
    this._submitted = true;

    var self = this;
    var q = this._q;
    var correct = this._selectedId === q.answer;

    if (correct) {
      this._showResult();
      Sound.play('correct');
      this._callbacks.onDone({ selected: this._selectedId, answer: q.answer, correct: true });
      this._callbacks.onComplete({ correct: true });
    } else {
      Sound.play('wrong');
      document.querySelectorAll('.option-btn').forEach(function(b) {
        if (b.dataset.id === self._selectedId) b.classList.add('wrong');
        b.classList.remove('selected');
      });
      this._submitted = false;
      this._selectedId = null;
      var submitBtn = document.getElementById('submitBtn');
      if (submitBtn) {
        submitBtn.className = 'submit-btn';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submit';
      }
    }
  },

  /* ── 显示对错样式 ─────────────────────────────────────── */
  _showResult: function() {
    var q = this._q;
    document.querySelectorAll('.option-btn').forEach(function(b) {
      if (b.dataset.id === q.answer) b.classList.add('correct');
      else if (b.classList.contains('selected')) b.classList.add('wrong');
    });
    var submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.style.display = 'none';
  }
};
