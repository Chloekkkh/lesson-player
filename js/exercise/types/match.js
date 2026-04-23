/* ============================================================
   match.js — 连线配对题
   中英文卡片点击配对，Canvas 画线
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
  _matchedLeft:    {},    // leftIdx → true
  _matchedRight:   {},    // rightIdx → true
  _leftSelected:   null,
  _lines:          [],    // [{leftIdx, rightIdx}, ...]
  _canvas:         null,
  _ctx:            null,
  _pinyinMap:      {},

  /* ── init ─────────────────────────────────────────────── */
  init: function(config, callbacks) {
    this._config    = config;
    this._callbacks = callbacks;
    this._pairs     = config.pairs || (config.questions && config.questions[0] && config.questions[0].pairs) || [];
    this._matchedLeft  = {};
    this._matchedRight = {};
    this._leftSelected = null;
    this._lines = [];
    this._resizeHandler = null;  // Bug 3: track resize listener for cleanup

    // pinyin 映射（支持顶层 config 或 questions[0] 两种来源）
    if (config.pinyinMap) {
      this._pinyinMap = config.pinyinMap;
    } else if (config.questions && config.questions[0] && config.questions[0].pinyinMap) {
      this._pinyinMap = config.questions[0].pinyinMap;
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

    // 列容器
    var colsWrap = document.createElement('div');
    colsWrap.style.cssText = 'position:relative;z-index:2;display:flex;flex-direction: column;gap:48px;justify-content:center;';

    var leftCol = document.createElement('div');
    leftCol.className = 'match-col';

    var rightCol = document.createElement('div');
    rightCol.className = 'match-col';

    var self = this;

    // 左列
    this._pairs.forEach(function(pair, i) {
      var btn = self._makeBtn(pair.left, 'left', i, self._config.showPinyin && self._pinyinMap[pair.left]);
      leftCol.appendChild(btn);
      self._leftBtns[i] = btn;
    });

    // 右列（乱序）
    var shuffled = this._shuffle(this._pairs.map(function(_, i) { return i; }));
    shuffled.forEach(function(pairIdx) {
      var pair = self._pairs[pairIdx];
      var btn = self._makeBtn(pair.right, 'right', pairIdx, false);
      rightCol.appendChild(btn);
      self._rightBtns[pairIdx] = btn;
    });

    colsWrap.appendChild(leftCol);
    colsWrap.appendChild(rightCol);

    area.style.position = 'relative';
    area.appendChild(colsWrap);
    area.appendChild(canvasWrap);

    // 洗牌重玩按钮
    var reshuffleBtn = document.createElement('button');
    reshuffleBtn.className = 'match-reshuffle-btn';
    reshuffleBtn.textContent = 'Shuffle';
    reshuffleBtn.addEventListener('click', function() { self._reshuffle(); });
    area.appendChild(reshuffleBtn);

    // 拼音开关按钮
    var pinyinToggle = document.createElement('button');
    pinyinToggle.className = 'match-pinyin-toggle' + (this._config.showPinyin ? ' active' : '');
    pinyinToggle.textContent = '拼音';
    var self2 = this;
    pinyinToggle.addEventListener('click', function() {
      self2._config.showPinyin = !self2._config.showPinyin;
      pinyinToggle.classList.toggle('active', self2._config.showPinyin);
      self2._refreshButtons();
    });
    area.appendChild(pinyinToggle);

    // 隐藏 submitBtn（match 无需提交）
    var submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.style.display = 'none';

    // Bug 3: remove stale resize listener before adding new one
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    this._resizeHandler = function() { self._resizeCanvas(); };
    window.addEventListener('resize', this._resizeHandler);
  },

  _makeBtn: function(text, side, idx, pinyinText) {
    var btn = document.createElement('button');
    btn.className = 'match-btn';
    btn.dataset.side = side;
    btn.dataset.idx = idx;
    if (pinyinText) {
      btn.innerHTML = '<span class="match-pinyin">' + pinyinText + '</span>' +
                      '<span class="match-text">' + text + '</span>';
    } else {
      btn.innerHTML = '<span class="match-text">' + text + '</span>';
    }
    var self = this;
    btn.addEventListener('click', function() {
      if (side === 'left') self._onLeftClick(idx, btn);
      else                self._onRightClick(idx, btn);
    });
    return btn;
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

  /* ── 左列点击 ─────────────────────────────────────────── */
  _onLeftClick: function(leftIdx, btn) {
    if (this._matchedLeft[leftIdx]) return; // 已配对
    if (this._leftSelected === leftIdx) {
      // 再次点击：取消选中
      this._leftSelected = null;
      btn.style.borderColor = '';
    } else {
      // 选中
      if (this._leftSelected !== null) {
        this._leftBtns[this._leftSelected].style.borderColor = '';
      }
      this._leftSelected = leftIdx;
      btn.style.borderColor = 'var(--blue)';
    }
    this._redrawLines();
  },

  /* ── 右列点击 ─────────────────────────────────────────── */
  _onRightClick: function(rightIdx) {
    if (this._leftSelected === null) return; // 没选左词
    if (this._matchedRight[rightIdx]) return; // 右词已配对

    var leftIdx = this._leftSelected;

    // 校验是否匹配
    var isCorrect = (this._pairs[leftIdx].right === this._pairs[rightIdx].right);

    if (!isCorrect) {
      // 错误配对：左右按钮抖动+变红，清除选中，不记录连线
      var leftBtn = this._leftBtns[leftIdx];
      var rightBtn = this._rightBtns[rightIdx];
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
    this._matchedLeft[leftIdx]   = rightIdx;
    this._matchedRight[rightIdx] = leftIdx;
    this._lines.push({ leftIdx: leftIdx, rightIdx: rightIdx });

    // 样式更新
    this._leftBtns[leftIdx].style.borderColor   = 'var(--green)';
    this._rightBtns[rightIdx].style.borderColor = 'var(--green)';
    this._leftBtns[leftIdx].classList.add('paired');
    this._rightBtns[rightIdx].classList.add('paired');

    Sound.play('correct');

    // 清除选中
    this._leftBtns[leftIdx].style.borderColor = '';
    this._leftSelected = null;
    this._redrawLines();

    // 检查全部完成
    if (Object.keys(this._matchedLeft).length === this._pairs.length) {
      this._callbacks.onDone({ correct: true });
      this._callbacks.onComplete({ correct: true });
    }
  },

  /* ── 刷新按钮拼音显示 ─────────────────────────────── */
  _refreshButtons: function() {
    var self = this;
    // 左列按钮
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
    // 右列按钮（英文无拼音，不变）
  },

  /* ── 重玩（洗牌） ─────────────────────────────────────── */
  _reshuffle: function() {
    this._matchedLeft  = {};
    this._matchedRight = {};
    this._lines = [];
    this._leftSelected = null;

    var area = document.getElementById('matchArea');
    if (area) {
      var colsWrap = area.querySelector('div[style*="relative"]');
      if (colsWrap) {
        var leftCol  = colsWrap.querySelectorAll('.match-col')[0];
        var rightCol = colsWrap.querySelectorAll('.match-col')[1];
        var self = this;

        // 左侧打乱
        if (leftCol) {
          var shuffledLeft = this._shuffle(this._pairs.map(function(_, i) { return i; }));
          leftCol.innerHTML = '';
          self._leftBtns = {};
          shuffledLeft.forEach(function(pairIdx) {
            var pair = self._pairs[pairIdx];
            var pinyinText = self._config.showPinyin && self._pinyinMap[pair.left];
            var btn = self._makeBtn(pair.left, 'left', pairIdx, pinyinText);
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
            var btn = self._makeBtn(pair.right, 'right', pairIdx, false);
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

  /* ── 画线 ─────────────────────────────────────────────── */
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

      var x1 = lRect.left  + lRect.width / 2 - cRect.left;
      var y1 = lRect.bottom - cRect.top;
      var x2 = rRect.left  + rRect.width / 2 - cRect.left;
      var y2 = rRect.top    - cRect.top;

      ctx.beginPath();
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1, y1 + 30, x2, y2 - 30, x2, y2);
      ctx.stroke();
    });

    // 画当前选中的临时线
    if (this._leftSelected !== null) {
      var leftBtn = this._leftBtns[this._leftSelected];
      if (leftBtn) {
        var lRect = leftBtn.getBoundingClientRect();
        var cRect = canvas.getBoundingClientRect();
        var x1 = lRect.left + lRect.width / 2 - cRect.left;
        var y1 = lRect.bottom - cRect.top;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(74,130,239,0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1, y1 + 20);
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
