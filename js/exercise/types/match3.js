/* ============================================================
   match3.js — 录音-图片-文字三排匹配
   链式配对：点击音频 → 点击图片 → 点击文字，连成一条链
   ============================================================ */

'use strict';

registerType('match3', Match3Handler);

function Match3Handler() {}

Match3Handler.prototype = {
  _config:     null,
  _callbacks:  null,
  _pairs:      [],     // [{audio, image, text}] — original order
  _audioBtns:  [],     // audio buttons by pairIdx
  _imageBtns:  [],     // image buttons by pairIdx
  _textBtns:   [],     // text buttons by pairIdx

  // Chain state machine:
  // step 0 = awaiting audio click
  // step 1 = awaiting image click (audio selected)
  // step 2 = awaiting text click (audio+image selected)
  _chainStep:  0,
  _chainPairIdx: null,  // pair being built
  _chainLines: [],     // completed chains: [{pairIdx}, ...]
  _submitted:  false,
  _audioBase:  '',
  _playingAudio: null,
  _canvas:     null,
  _ctx:        null,
  _resizeHandler: null,

  /* ── init ─────────────────────────────────────────────── */
  init: function(config, callbacks) {
    this._config    = config;
    this._callbacks = callbacks;
    this._submitted = false;
    this._chainStep = 0;
    this._chainPairIdx = null;
    this._chainLines = [];
    this._playingAudio = null;

    var q0 = config.questions && config.questions[0];
    this._pairs = q0 ? (q0.pairs || []) : (config.pairs || []);
    this._audioBase = (q0 && q0.audioBase) || config.audioBase || '';

    this._render();
    this._initCanvas();
  },

  /* ── 渲染 ─────────────────────────────────────────────── */
  _render: function() {
    var area = document.getElementById('matchArea');
    if (!area) return;
    area.style.display = '';
    area.innerHTML = '';

    var self = this;

    // Canvas 层
    var canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;';
    var canvas = document.createElement('canvas');
    canvas.id = 'matchCanvas';
    canvas.style.cssText = 'width:100%;height:100%;';
    canvasWrap.appendChild(canvas);
    this._canvas = canvas;

    // 主容器：三列纵向
    var mainWrap = document.createElement('div');
    mainWrap.style.cssText = 'position:relative;z-index:2;display:flex;flex-direction:column;gap:48px;justify-content:center;align-items:center;width:100%;';

    var pairCount = this._pairs.length;

    // ── 第一排：音频行 ────────────────────────────────
    var audioRow = document.createElement('div');
    audioRow.className = 'match3-row';
    audioRow.style.cssText = 'display:flex;gap:24px;justify-content:center;align-items:center;';
    this._pairs.forEach(function(pair, i) {
      var btn = self._makeAudioBtn(pair, i);
      audioRow.appendChild(btn);
      self._audioBtns[i] = btn;
    });

    // ── 第二排：图片行 ────────────────────────────────
    var imageRow = document.createElement('div');
    imageRow.className = 'match3-row';
    imageRow.style.cssText = 'display:flex;gap:24px;justify-content:center;align-items:center;';
    var shuffledImg = this._shuffle(this._pairs.map(function(_, i) { return i; }));
    shuffledImg.forEach(function(pairIdx) {
      var btn = self._makeImageBtn(self._pairs[pairIdx].image, pairIdx);
      imageRow.appendChild(btn);
      self._imageBtns[pairIdx] = btn;
    });

    // ── 第三排：文字行 ────────────────────────────────
    var textRow = document.createElement('div');
    textRow.className = 'match3-row';
    textRow.style.cssText = 'display:flex;gap:24px;justify-content:center;align-items:center;';
    var shuffledTxt = this._shuffle(this._pairs.map(function(_, i) { return i; }));
    shuffledTxt.forEach(function(pairIdx) {
      var btn = self._makeTextBtn(self._pairs[pairIdx].text, pairIdx);
      textRow.appendChild(btn);
      self._textBtns[pairIdx] = btn;
    });

    mainWrap.appendChild(audioRow);
    mainWrap.appendChild(imageRow);
    mainWrap.appendChild(textRow);

    area.style.position = 'relative';
    area.appendChild(mainWrap);
    area.appendChild(canvasWrap);

    var submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.style.display = 'none';

    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    this._resizeHandler = function() { self._resizeCanvas(); };
    window.addEventListener('resize', this._resizeHandler);
  },

  /* ── 音频按钮 ─────────────────────────────────────────── */
  _makeAudioBtn: function(pair, pairIdx) {
    var btn = document.createElement('button');
    btn.className = 'match-btn match-btn-audio';
    btn.dataset.pairIdx = pairIdx;
    btn.innerHTML = '<span class="match-audio-icon">&#9658;</span>' +
                    '<span class="match-text">' + (pair.audioText || pair.audio || '') + '</span>';
    var self = this;
    btn.addEventListener('click', function() { self._onAudioClick(pairIdx, btn, pair.audio); });
    return btn;
  },

  /* ── 图片按钮 ─────────────────────────────────────────── */
  _makeImageBtn: function(src, pairIdx) {
    var btn = document.createElement('button');
    btn.className = 'match-btn match-btn-img';
    btn.dataset.pairIdx = pairIdx;
    var img = document.createElement('img');
    img.src = src;
    img.style.cssText = 'max-width:80px;max-height:80px;border-radius:8px;pointer-events:none;';
    btn.appendChild(img);
    var self = this;
    btn.addEventListener('click', function() { self._onImageClick(pairIdx, btn); });
    return btn;
  },

  /* ── 文字按钮 ─────────────────────────────────────────── */
  _makeTextBtn: function(text, pairIdx) {
    var btn = document.createElement('button');
    btn.className = 'match-btn';
    btn.dataset.pairIdx = pairIdx;
    btn.innerHTML = '<span class="match-text">' + text + '</span>';
    var self = this;
    btn.addEventListener('click', function() { self._onTextClick(pairIdx, btn); });
    return btn;
  },

  /* ── 链式点击 ─────────────────────────────────────────── */
  _onAudioClick: function(pairIdx, btn) {
    if (this._isPaired(pairIdx)) return;
    // 先停止上一个音频
    if (this._playingAudio) {
      this._playingAudio.pause();
      this._playingAudio = null;
      document.querySelectorAll('.audio-playing').forEach(function(b) { b.classList.remove('audio-playing'); });
    }
    // 播放音频
    var pair = this._pairs[pairIdx];
    if (pair && pair.audio) {
      var audio = new Audio(this._audioBase + pair.audio);
      audio.addEventListener('ended', function() { btn.classList.remove('audio-playing'); });
      btn.classList.add('audio-playing');
      audio.play();
      this._playingAudio = audio;
    }
    // 清除之前的高亮
    this._clearHighlights();
    // 选中的链高亮音频
    this._chainStep = 1;
    this._chainPairIdx = pairIdx;
    btn.style.borderColor = 'var(--blue)';
    this._redrawLines();
  },

  _onImageClick: function(pairIdx, btn) {
    if (this._chainStep < 1) return; // 还没选音频
    if (this._isPaired(pairIdx)) return;

    if (pairIdx !== this._chainPairIdx) {
      // 错误：抖屏
      btn.classList.add('shake');
      Sound.play('wrong');
      setTimeout(function() { btn.classList.remove('shake'); }, 400);
      return;
    }
    // 正确：链进入下一步
    this._chainStep = 2;
    btn.style.borderColor = 'var(--blue)';
    this._redrawLines();
  },

  _onTextClick: function(pairIdx, btn) {
    if (this._chainStep < 2) return; // 还没选图片
    if (this._isPaired(pairIdx)) return;

    if (pairIdx !== this._chainPairIdx) {
      btn.classList.add('shake');
      Sound.play('wrong');
      setTimeout(function() { btn.classList.remove('shake'); }, 400);
      return;
    }
    // 完整链建立！
    this._completeChain(pairIdx);
  },

  _isPaired: function(pairIdx) {
    return this._chainLines.indexOf(pairIdx) !== -1;
  },

  _clearHighlights: function() {
    [this._audioBtns, this._imageBtns, this._textBtns].forEach(function(btns) {
      Object.keys(btns).forEach(function(k) {
        var b = btns[k];
        if (b) b.style.borderColor = '';
      });
    });
    this._chainStep = 0;
    this._chainPairIdx = null;
  },

  _completeChain: function(pairIdx) {
    // 标记三个按钮为已配对
    var ab = this._audioBtns[pairIdx];
    var ib = this._imageBtns[pairIdx];
    var tb = this._textBtns[pairIdx];
    ab.style.borderColor = 'var(--green)';
    ib.style.borderColor = 'var(--green)';
    tb.style.borderColor = 'var(--green)';
    ab.classList.add('paired');
    ib.classList.add('paired');
    tb.classList.add('paired');

    Sound.play('correct');

    this._chainLines.push(pairIdx);
    this._chainStep = 0;
    this._chainPairIdx = null;
    this._redrawLines();

    // 检查全部完成
    if (this._chainLines.length === this._pairs.length) {
      this._callbacks.onDone({ correct: true });
      this._callbacks.onComplete({ correct: true });
    }
  },

  /* ── Canvas ────────────────────────────────────────────── */
  _initCanvas: function() {
    var canvas = this._canvas;
    if (!canvas) return;
    this._ctx = canvas.getContext('2d');
    this._resizeCanvas();
  },

  _resizeCanvas: function() {
    var canvas = this._canvas;
    if (!canvas) return;
    var rect = canvas.parentNode.getBoundingClientRect();
    canvas.width  = rect.width;
    canvas.height = rect.height;
    this._redrawLines();
  },

  /* ── 画线 ─────────────────────────────────────────────── */
  _redrawLines: function() {
    var ctx = this._ctx;
    if (!ctx) return;
    var canvas = this._canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var cRect = canvas.getBoundingClientRect();

    var self = this;

    // 画已完成的链
    this._chainLines.forEach(function(pairIdx) {
      var ab = self._audioBtns[pairIdx];
      var ib = self._imageBtns[pairIdx];
      var tb = self._textBtns[pairIdx];
      if (!ab || !ib || !tb) return;

      var aRect = ab.getBoundingClientRect();
      var iRect = ib.getBoundingClientRect();
      var tRect = tb.getBoundingClientRect();

      // 音频 → 图片（S型曲线，从音频底部到图片顶部）
      var x1 = aRect.left + aRect.width / 2 - cRect.left;
      var y1 = aRect.bottom - cRect.top;
      var x2 = iRect.left + iRect.width / 2 - cRect.left;
      var y2 = iRect.top - cRect.top;

      ctx.beginPath();
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1, y1 + 40, x2, y2 - 40, x2, y2);
      ctx.stroke();

      // 图片 → 文字（S型曲线，从图片底部到文字顶部）
      var x3 = iRect.left + iRect.width / 2 - cRect.left;
      var y3 = iRect.bottom - cRect.top;
      var x4 = tRect.left + tRect.width / 2 - cRect.left;
      var y4 = tRect.top - cRect.top;

      ctx.beginPath();
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 2.5;
      ctx.moveTo(x3, y3);
      ctx.bezierCurveTo(x3, y3 + 40, x4, y4 - 40, x4, y4);
      ctx.stroke();
    });

    // 画当前进行中的链（虚线）
    if (this._chainPairIdx !== null) {
      var ab = this._audioBtns[this._chainPairIdx];
      if (ab && this._chainStep >= 1) {
        var aRect = ab.getBoundingClientRect();
        var x1 = aRect.left + aRect.width / 2 - cRect.left;
        var y1 = aRect.bottom - cRect.top;
        var ib = this._imageBtns[this._chainPairIdx];
        if (ib && this._chainStep >= 2) {
          var iRect = ib.getBoundingClientRect();
          var x2 = iRect.left + iRect.width / 2 - cRect.left;
          var y2 = iRect.top - cRect.top;
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(74,130,239,0.5)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.moveTo(x1, y1);
          ctx.bezierCurveTo(x1, y1 + 40, x2, y2 - 40, x2, y2);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (ib) {
          // 音频已选，图片未选：画虚线到中间
          var iRect = ib.getBoundingClientRect();
          var x2 = iRect.left + iRect.width / 2 - cRect.left;
          var midY = (aRect.bottom + iRect.top) / 2 - cRect.top;
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(74,130,239,0.4)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.moveTo(x1, y1);
          ctx.lineTo(x1, midY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
  },

  /* ── 洗牌重玩 ─────────────────────────────────────────── */
  _reshuffle: function() {
    this._chainLines = [];
    this._chainStep = 0;
    this._chainPairIdx = null;

    var area = document.getElementById('matchArea');
    if (!area) return;
    var mainWrap = area.querySelector('.match3-row');
    if (!mainWrap) return;

    // 重新生成图片行和文字行（音频行固定顺序）
    var rows = area.querySelectorAll('.match3-row');
    var imageRow = rows[1]; // 第二排：图片
    var textRow  = rows[2]; // 第三排：文字

    var self = this;

    // 图片行洗牌
    if (imageRow) {
      var shuffledImg = this._shuffle(this._pairs.map(function(_, i) { return i; }));
      imageRow.innerHTML = '';
      this._imageBtns = {};
      shuffledImg.forEach(function(pairIdx) {
        var btn = self._makeImageBtn(self._pairs[pairIdx].image, pairIdx);
        imageRow.appendChild(btn);
        self._imageBtns[pairIdx] = btn;
      });
    }

    // 文字行洗牌
    if (textRow) {
      var shuffledTxt = this._shuffle(this._pairs.map(function(_, i) { return i; }));
      textRow.innerHTML = '';
      this._textBtns = {};
      shuffledTxt.forEach(function(pairIdx) {
        var btn = self._makeTextBtn(self._pairs[pairIdx].text, pairIdx);
        textRow.appendChild(btn);
        self._textBtns[pairIdx] = btn;
      });
    }

    document.querySelectorAll('.match-btn').forEach(function(b) {
      b.classList.remove('paired');
      b.style.borderColor = '';
    });
    this._redrawLines();
  },

  /* ── 洗牌工具 ─────────────────────────────────────────── */
  _shuffle: function(arr) {
    arr = arr.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }
};
