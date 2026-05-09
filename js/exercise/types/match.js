/* ============================================================
   match.js — 连线配对题
   中英文卡片点击配对，Canvas 画线

   支持三种模式（通过 config.leftType / config.rightType 区分）：
   - text / text   ：传统文本连线（默认）
   - audio / image ：听音配图片（点击音频播放，选中后再点图片配对）
   - text  / image ：文本配图片
   ============================================================ */

'use strict';

registerType('match', MatchHandler);

function MatchHandler() {}

MatchHandler.prototype = {
  _config:         null,
  _callbacks:      null,
  _pairs:          [],
  _leftBtns:       [],
  _rightBtns:      [],
  _matchedLeft:    {},    // pairIdx → true
  _matchedRight:   {},    // pairIdx → true
  _leftSelected:   null,   // pairIdx of currently selected left item
  _lines:          [],    // [{leftIdx, rightIdx}, ...]
  _canvas:         null,
  _ctx:            null,
  _pinyinMap:      {},
  _leftType:       'text',
  _rightType:      'text',
  _audioBase:      '',
  _playingAudio:   null,
  _direction:      'vertical',  // 'vertical' = 上下排列（默认）, 'horizontal' = 左右排列

  /* ── init ─────────────────────────────────────────────── */
  init: function(config, callbacks) {
    this._config    = config;
    this._callbacks = callbacks;
    this._pairs     = config.pairs || (config.questions && config.questions[0] && config.questions[0].pairs) || [];
    this._matchedLeft  = {};
    this._matchedRight = {};
    this._leftSelected = null;
    this._lines = [];
    this._resizeHandler = null;
    this._playingAudio = null;

    // leftType / rightType：支持 questions[0] 或顶层
    var q0 = config.questions && config.questions[0];
    this._leftType  = (q0 && q0.leftType)  || config.leftType  || 'text';
    this._rightType = (q0 && q0.rightType) || config.rightType || 'text';
    this._audioBase = (q0 && q0.audioBase) || config.audioBase || '';
    this._direction = (q0 && q0.direction) || config.direction || 'vertical';

    // pinyin 映射（支持顶层 config 或 questions[0] 两种来源）
    if (config.pinyinMap) {
      this._pinyinMap = config.pinyinMap;
    } else if (q0 && q0.pinyinMap) {
      this._pinyinMap = q0.pinyinMap;
    }

    this._render();
    this._initCanvas();
  },

  /* ── 渲染 ─────────────────────────────────────────────── */
  _render: function() {
    var area = document.getElementById('matchArea');
    if (!area) return;
    area.style.display = '';
    area.innerHTML = '';

    // Canvas 层（absolute，透明背景，浮在各列上方）
    var canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;';
    var canvas = document.createElement('canvas');
    canvas.id = 'matchCanvas';
    canvas.style.cssText = 'width:100%;height:100%;';
    canvasWrap.appendChild(canvas);
    this._canvas = canvas;

    // 列容器：根据 direction 决定方向
    var colsWrap = document.createElement('div');
    if (this._direction === 'horizontal') {
      // 左右并排（横向）
      colsWrap.style.cssText = 'position:relative;z-index:2;display:flex;flex-direction:row;gap:80px;justify-content:center;align-items:center;';
    } else {
      // 上下堆叠（纵向）
      colsWrap.style.cssText = 'position:relative;z-index:2;display:flex;flex-direction:column;gap:48px;justify-content:center;';
    }

    var leftCol = document.createElement('div');
    leftCol.className = 'match-col';
    if (this._direction === 'horizontal') {
      leftCol.style.cssText = 'display:flex;flex-direction:column;gap:16px;align-items:center;';
    } else {
      leftCol.style.cssText = 'display:flex;flex-direction:row;gap:12px;min-width:160px;justify-content:center;';
    }

    var rightCol = document.createElement('div');
    rightCol.className = 'match-col';
    if (this._direction === 'horizontal') {
      rightCol.style.cssText = 'display:flex;flex-direction:column;gap:16px;align-items:center;';
    } else {
      rightCol.style.cssText = 'display:flex;flex-direction:row;gap:12px;min-width:160px;justify-content:center;';
    }

    var self = this;

    // 左列渲染
    if (this._leftType === 'audio') {
      // 听音模式：音频卡片，点击播放 + 选中
      this._pairs.forEach(function(pair, i) {
        var btn = self._makeAudioBtn(pair, 'left', i);
        leftCol.appendChild(btn);
        self._leftBtns[i] = btn;
      });
    } else {
      // 文本模式：复用原有逻辑
      this._pairs.forEach(function(pair, i) {
        var btn = self._makeTextBtn(pair.left, 'left', i, self._config.showPinyin && self._pinyinMap[pair.left]);
        leftCol.appendChild(btn);
        self._leftBtns[i] = btn;
      });
    }

    // 右列渲染（乱序）
    var shuffled = this._shuffle(this._pairs.map(function(_, i) { return i; }));
    shuffled.forEach(function(pairIdx) {
      var pair = self._pairs[pairIdx];
      var btn;
      if (self._rightType === 'image') {
        btn = self._makeImageBtn(pair.right, 'right', pairIdx);
      } else {
        btn = self._makeTextBtn(pair.right, 'right', pairIdx, false);
      }
      rightCol.appendChild(btn);
      self._rightBtns[pairIdx] = btn;
    });

    colsWrap.appendChild(leftCol);
    colsWrap.appendChild(rightCol);

    area.style.position = 'relative';
    area.appendChild(colsWrap);
    area.appendChild(canvasWrap);

    // 隐藏 submitBtn（match 无需提交）
    var submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.style.display = 'none';

    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    this._resizeHandler = function() { self._resizeCanvas(); };
    window.addEventListener('resize', this._resizeHandler);
  },

  /* ── 文本按钮 ─────────────────────────────────────────── */
  _makeTextBtn: function(text, side, pairIdx, pinyinText) {
    var btn = document.createElement('button');
    btn.className = 'match-btn';
    btn.dataset.side = side;
    btn.dataset.pairIdx = pairIdx;
    if (pinyinText) {
      btn.innerHTML = '<span class="match-pinyin">' + pinyinText + '</span>' +
                      '<span class="match-text">' + text + '</span>';
    } else {
      btn.innerHTML = '<span class="match-text">' + text + '</span>';
    }
    var self = this;
    btn.addEventListener('click', function() {
      if (side === 'left') self._onLeftClick(pairIdx, btn);
      else                self._onRightClick(pairIdx, btn);
    });
    return btn;
  },

  /* ── 图片按钮 ─────────────────────────────────────────── */
  _makeImageBtn: function(src, side, pairIdx) {
    var btn = document.createElement('button');
    btn.className = 'match-btn match-btn-img';
    btn.dataset.side = side;
    btn.dataset.pairIdx = pairIdx;
    var img = document.createElement('img');
    img.src = src;
    img.style.cssText = 'max-width:80px;max-height:80px;border-radius:8px;pointer-events:none;';
    btn.appendChild(img);
    var self = this;
    btn.addEventListener('click', function() {
      if (side === 'left') self._onLeftClick(pairIdx, btn);
      else                self._onRightClick(pairIdx, btn);
    });
    return btn;
  },

  /* ── 音频卡片按钮 ─────────────────────────────────────── */
  _makeAudioBtn: function(pair, side, pairIdx) {
    var btn = document.createElement('button');
    btn.className = 'match-btn match-btn-audio';
    btn.dataset.side = side;
    btn.dataset.pairIdx = pairIdx;

    // pair.left = 音频路径，pair.text = 显示的听力文本（可选）
    var displayText = pair.text || pair.left;
    btn.innerHTML = '<span class="match-audio-icon">&#9658;</span>' +
                    '<span class="match-text">' + displayText + '</span>';

    var self = this;
    btn.addEventListener('click', function() { self._onAudioClick(pairIdx, btn, pair.left); });
    return btn;
  },

  /* ── 音频点击 ─────────────────────────────────────────── */
  _onAudioClick: function(pairIdx, btn, audioPath) {
    if (this._matchedLeft[pairIdx]) return; // 已配对
    if (this._playingAudio) {
      this._playingAudio.pause();
      this._playingAudio = null;
    }
    if (audioPath) {
      var audio = new Audio(this._audioBase + audioPath);
      audio.addEventListener('ended', function() { btn.classList.remove('audio-playing'); });
      btn.classList.add('audio-playing');
      audio.play();
      this._playingAudio = audio;
    }
    // 选中该音频卡片
    if (this._leftSelected !== null) {
      this._leftBtns[this._leftSelected].style.borderColor = '';
    }
    this._leftSelected = pairIdx;
    btn.style.borderColor = 'var(--blue)';
    this._redrawLines();
  },

  /* ── Canvas 初始化 ────────────────────────────────────── */
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

  /* ── 左列点击（文本模式）────────────────────────────── */
  _onLeftClick: function(pairIdx, btn) {
    if (this._matchedLeft[pairIdx]) return; // 已配对
    if (this._leftSelected === pairIdx) {
      this._leftSelected = null;
      btn.style.borderColor = '';
    } else {
      if (this._leftSelected !== null) {
        this._leftBtns[this._leftSelected].style.borderColor = '';
      }
      this._leftSelected = pairIdx;
      btn.style.borderColor = 'var(--blue)';
    }
    this._redrawLines();
  },

  /* ── 右列点击 ─────────────────────────────────────────── */
  _onRightClick: function(pairIdx) {
    if (this._leftSelected === null) return; // 没选左词
    if (this._matchedRight[pairIdx]) return; // 右词已配对

    var leftPairIdx = this._leftSelected;

    // 校验是否同属一组（pairIdx 相同 = 配对正确）
    var isCorrect = (leftPairIdx === pairIdx);

    if (!isCorrect) {
      var leftBtn  = this._leftBtns[leftPairIdx];
      var rightBtn = this._rightBtns[pairIdx];
      leftBtn.style.borderColor = 'var(--red)';
      rightBtn.style.borderColor = 'var(--red)';
      leftBtn.classList.add('shake');
      rightBtn.classList.add('shake');
      setTimeout(function() {
        leftBtn.classList.remove('shake');
        rightBtn.classList.remove('shake');
        leftBtn.style.borderColor = '';
        rightBtn.style.borderColor = '';
      }, 400);
      Sound.play('wrong');
      this._leftSelected = null;
      this._redrawLines();
      return;
    }

    // 配对
    this._matchedLeft[leftPairIdx]   = pairIdx;
    this._matchedRight[pairIdx] = leftPairIdx;
    this._lines.push({ leftIdx: leftPairIdx, rightIdx: pairIdx });

    this._leftBtns[leftPairIdx].style.borderColor   = 'var(--green)';
    this._rightBtns[pairIdx].style.borderColor = 'var(--green)';
    this._leftBtns[leftPairIdx].classList.add('paired');
    this._rightBtns[pairIdx].classList.add('paired');

    Sound.play('correct');

    this._leftBtns[leftPairIdx].style.borderColor = '';
    this._leftSelected = null;
    this._redrawLines();

    if (Object.keys(this._matchedLeft).length === this._pairs.length) {
      this._callbacks.onDone({ correct: true });
      this._callbacks.onComplete({ correct: true });
    }
  },

  /* ── 刷新按钮拼音显示 ─────────────────────────────── */
  _refreshButtons: function() {
    var self = this;
    if (this._leftType === 'audio') return; // 音频按钮不需要刷新
    this._pairs.forEach(function(pair, i) {
      var btn = self._leftBtns[i];
      if (!btn) return;
      var pinyinText = self._config.showPinyin && self._pinyinMap[pair.left];
      if (pinyinText) {
        btn.innerHTML = '<span class="match-pinyin">' + pinyinText + '</span>' +
                        '<span class="match-text">' + pair.left + '</span>';
      } else {
        btn.innerHTML = '<span class="match-text">' + pair.left + '</span>';
      }
    });
  },

  /* ── 重玩（洗牌） ─────────────────────────────────────── */
  _reshuffle: function() {
    this._matchedLeft  = {};
    this._matchedRight = {};
    this._lines = [];
    this._leftSelected = null;

    var area = document.getElementById('matchArea');
    if (area) {
      // 找到列容器（有 z-index:2 的那个 div）
      var colsWrap = area.querySelector('div[style*="z-index:2"]');
      if (colsWrap) {
        var leftCol  = colsWrap.querySelectorAll('.match-col')[0];
        var rightCol = colsWrap.querySelectorAll('.match-col')[1];
        var self = this;

        // 左侧打乱（仅文本模式，音频模式不打乱）
        if (leftCol && self._leftType !== 'audio') {
          var shuffledLeft = this._shuffle(this._pairs.map(function(_, i) { return i; }));
          leftCol.innerHTML = '';
          self._leftBtns = {};
          shuffledLeft.forEach(function(pairIdx) {
            var pair = self._pairs[pairIdx];
            var pinyinText = self._config.showPinyin && self._pinyinMap[pair.left];
            var btn = self._makeTextBtn(pair.left, 'left', pairIdx, pinyinText);
            leftCol.appendChild(btn);
            self._leftBtns[pairIdx] = btn;
          });
        }

        // 右侧打乱
        if (rightCol) {
          var shuffledRight = this._shuffle(this._pairs.map(function(_, i) { return i; }));
          rightCol.innerHTML = '';
          self._rightBtns = {};
          shuffledRight.forEach(function(pairIdx) {
            var pair = self._pairs[pairIdx];
            var btn;
            if (self._rightType === 'image') {
              btn = self._makeImageBtn(pair.right, 'right', pairIdx);
            } else {
              btn = self._makeTextBtn(pair.right, 'right', pairIdx, false);
            }
            rightCol.appendChild(btn);
            self._rightBtns[pairIdx] = btn;
          });
        }
      }
    }

    document.querySelectorAll('.match-btn').forEach(function(b) {
      b.classList.remove('paired');
      b.style.borderColor = '';
    });
    this._redrawLines();
  },

  /* ── 画线（根据 direction 动态计算控制点）─────────────── */
  _redrawLines: function() {
    var ctx = this._ctx;
    if (!ctx) return;
    var canvas = this._canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var self = this;
    this._lines.forEach(function(line) {
      var leftBtn  = self._leftBtns[line.leftIdx];
      var rightBtn = self._rightBtns[line.rightIdx];
      if (!leftBtn || !rightBtn) return;

      var lRect = leftBtn.getBoundingClientRect();
      var rRect = rightBtn.getBoundingClientRect();
      var cRect = canvas.getBoundingClientRect();

      var isH = self._direction === 'horizontal';
      var x1, y1, x2, y2, cp1x, cp1y, cp2x, cp2y;

      if (isH) {
        // 横向：左按钮右边缘 → 右按钮左边缘，S 曲线水平延伸
        x1 = lRect.right - cRect.left;
        y1 = lRect.top + lRect.height / 2 - cRect.top;
        x2 = rRect.left - cRect.left;
        y2 = rRect.top + rRect.height / 2 - cRect.top;
        cp1x = x1 + 40;  cp1y = y1;
        cp2x = x2 - 40;  cp2y = y2;
      } else {
        // 纵向：左按钮底部 → 右按钮顶部，S 曲线垂直延伸
        x1 = lRect.left + lRect.width / 2 - cRect.left;
        y1 = lRect.bottom - cRect.top;
        x2 = rRect.left + rRect.width / 2 - cRect.left;
        y2 = rRect.top - cRect.top;
        cp1x = x1;  cp1y = y1 + 30;
        cp2x = x2;  cp2y = y2 - 30;
      }

      ctx.beginPath();
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
      ctx.stroke();
    });

    // 画当前选中的临时线
    if (this._leftSelected !== null) {
      var leftBtn = this._leftBtns[this._leftSelected];
      if (leftBtn) {
        var lRect = leftBtn.getBoundingClientRect();
        var cRect = canvas.getBoundingClientRect();
        var x1, y1, x2, y2;
        if (this._direction === 'horizontal') {
          x1 = lRect.right - cRect.left;
          y1 = lRect.top + lRect.height / 2 - cRect.top;
          x2 = x1 + 20;  y2 = y1;
        } else {
          x1 = lRect.left + lRect.width / 2 - cRect.left;
          y1 = lRect.bottom - cRect.top;
          x2 = x1;  y2 = y1 + 20;
        }
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(74,130,239,0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  },

  /* ── 洗牌 ─────────────────────────────────────────────── */
  _shuffle: function(arr) {
    arr = arr.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }
};
