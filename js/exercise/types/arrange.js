/* ============================================================
   arrange.js — 连词成句
   下方词池 → 点击/拖拽到上方答题区 → 排列成完整句子
   ============================================================ */

'use strict';

registerType('arrange', ArrangeHandler);

function ArrangeHandler() {
  this._config    = null;
  this._callbacks = null;
  this._q          = null;   // 单题
  this._pool       = [];     // 词池（原单词索引），乱序
  this._answer     = [];     // 答题区中的词（原单词索引）
  this._submitted  = false;
  this._pinyinMap   = {};
  this._draggedWordIdx = null;
}

ArrangeHandler.prototype = {
  /* ── init ─────────────────────────────────────────────── */
  init: function(config, callbacks) {
    this._config    = config;
    this._callbacks = callbacks;

    this._pinyinMap = {};
    var q = config.questions && config.questions[0];
    if (q && q.pinyinMap) {
      var self = this;
      Object.keys(q.pinyinMap).forEach(function(k) {
        self._pinyinMap[k] = q.pinyinMap[k];
      });
    }

    this._q       = q || null;
    this._pool    = [];
    this._answer  = [];
    this._submitted = false;
    this._draggedWordIdx = null;

    if (this._q && this._q.words) {
      for (var pi = 0; pi < this._q.words.length; pi++) {
        this._pool.push(pi);
      }
      this._shuffle(this._pool);
    }

    this._render();
  },

  /* ── 渲染 ──────────────────────────────────────────────── */
  _render: function() {
    var q = this._q;
    if (!q) return;

    this._submitted = false;
    this._answer = [];

    // 重新洗牌词池
    this._pool = [];
    for (var pi = 0; pi < q.words.length; pi++) {
      this._pool.push(pi);
    }
    this._shuffle(this._pool);

    var area = document.getElementById('arrangeArea');
    if (!area) return;
    area.style.display = '';
    area.innerHTML =
      '<div class="question-text" id="questionText">' +
      '<p class="question-main">' + (q.question || 'Arrange the words into a correct sentence') + '</p>' +
      '</div>' +
      '<div id="arrangeAnswer" class="arrange-answer"></div>' +
      '<div id="arrangePool" class="arrange-pool"></div>' +
      '<div id="arrangeControls" style="text-align:center"></div>';

    var self = this;

    // ── 上方：答题区事件 ─────────────────────────────────
    var answerDiv = document.getElementById('arrangeAnswer');
    answerDiv.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      answerDiv.classList.add('drag-over');
    });
    answerDiv.addEventListener('dragleave', function() {
      answerDiv.classList.remove('drag-over');
    });
    answerDiv.addEventListener('drop', function(e) {
      e.preventDefault();
      answerDiv.classList.remove('drag-over');
      var wordIdx = self._draggedWordIdx;
      if (wordIdx === null || wordIdx === undefined) return;
      self._draggedWordIdx = null;
      self._moveToAnswer(wordIdx);
    });
    answerDiv.addEventListener('click', function(e) {
      var btn = e.target.closest('.arrange-answer-btn');
      if (!btn) return;
      var answerIdx = parseInt(btn.dataset.answerIdx, 10);
      self._moveToPool(answerIdx);
    });

    this._updateDisplay();

    // 提交按钮
    var submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.className = 'submit-btn';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submit';
      submitBtn.style.display = '';
      submitBtn.onclick = function() { self._submit(); };
    }

    // 拼音开关按钮
    var ctrlDiv = document.getElementById('arrangeControls');
    if (ctrlDiv) {
      var pinyinToggle = document.createElement('button');
      pinyinToggle.className = 'arrange-pinyin-toggle' + (this._config.showPinyin ? ' active' : '');
      pinyinToggle.textContent = '拼音';
      pinyinToggle.addEventListener('click', function() {
        self._config.showPinyin = !self._config.showPinyin;
        pinyinToggle.classList.toggle('active', self._config.showPinyin);
        self._updateDisplay();
      });
      ctrlDiv.appendChild(pinyinToggle);
    }
  },

  /* ── 将词从词池移入答题区 ─────────────────────────────── */
  _moveToAnswer: function(wordIdx) {
    if (this._submitted) return;
    var poolIdx = this._pool.indexOf(wordIdx);
    if (poolIdx !== -1) {
      this._pool.splice(poolIdx, 1);
    }
    if (this._answer.indexOf(wordIdx) !== -1) return;
    this._answer.push(wordIdx);
    this._updateDisplay();
  },

  /* ── 将词从答题区移回词池 ────────────────────────────── */
  _moveToPool: function(answerIdx) {
    if (this._submitted) return;
    var wordIdx = this._answer[answerIdx];
    if (wordIdx === undefined) return;
    this._answer.splice(answerIdx, 1);
    var insertAt = Math.floor(Math.random() * (this._pool.length + 1));
    this._pool.splice(insertAt, 0, wordIdx);
    this._updateDisplay();
  },

  /* ── 更新显示 ─────────────────────────────────────────── */
  _updateDisplay: function() {
    var q = this._q;
    var self = this;

    // 更新答题区
    var answerDiv = document.getElementById('arrangeAnswer');
    if (answerDiv) {
      answerDiv.innerHTML = '';
      this._answer.forEach(function(wordIdx, ai) {
        var word = q.words[wordIdx];
        var btn = document.createElement('button');
        btn.className = 'arrange-answer-btn';
        btn.dataset.answerIdx = ai;
        btn.dataset.wordIdx = wordIdx;
        btn.draggable = true;
        var pinyinText = self._config.showPinyin && self._pinyinMap[word];
        if (pinyinText) {
          btn.innerHTML = '<span class="arrange-pinyin">' + pinyinText + '</span>' +
                          '<span class="arrange-text">' + word + '</span>';
        } else {
          btn.innerHTML = '<span class="arrange-text">' + word + '</span>';
        }

        btn.addEventListener('dragstart', function(e) {
          self._draggedWordIdx = wordIdx;
          e.dataTransfer.effectAllowed = 'move';
          btn.classList.add('dragging');
        });
        btn.addEventListener('dragend', function() {
          btn.classList.remove('dragging');
          self._draggedWordIdx = null;
        });
        btn.addEventListener('dragover', function(e) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
        });
        btn.addEventListener('drop', function(e) {
          e.preventDefault();
          e.stopPropagation();
          var targetWordIdx = self._answer[ai];
          var fromAnswerIdx = self._answer.indexOf(self._draggedWordIdx);
          if (fromAnswerIdx !== -1) {
            self._answer.splice(fromAnswerIdx, 1);
          }
          self._answer.splice(ai, 0, self._draggedWordIdx);
          self._draggedWordIdx = null;
          self._updateDisplay();
        });

        answerDiv.appendChild(btn);
      });
      answerDiv.classList.toggle('has-words', this._answer.length > 0);
    }

    // 更新词池
    var poolDiv = document.getElementById('arrangePool');
    if (poolDiv) {
      poolDiv.innerHTML = '';
      this._pool.forEach(function(wordIdx) {
        var word = q.words[wordIdx];
        var btn = document.createElement('button');
        btn.className = 'arrange-pool-btn';
        btn.dataset.wordIdx = wordIdx;
        btn.draggable = true;
        var pinyinText = self._config.showPinyin && self._pinyinMap[word];
        if (pinyinText) {
          btn.innerHTML = '<span class="arrange-pinyin">' + pinyinText + '</span>' +
                          '<span class="arrange-text">' + word + '</span>';
        } else {
          btn.innerHTML = '<span class="arrange-text">' + word + '</span>';
        }

        btn.addEventListener('dragstart', function(e) {
          self._draggedWordIdx = wordIdx;
          e.dataTransfer.effectAllowed = 'move';
          btn.classList.add('dragging');
        });
        btn.addEventListener('dragend', function() {
          btn.classList.remove('dragging');
          self._draggedWordIdx = null;
        });
        btn.addEventListener('dragover', function(e) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        });
        btn.addEventListener('drop', function(e) {
          e.preventDefault();
          var fromPoolIdx = self._pool.indexOf(self._draggedWordIdx);
          var toPoolIdx = self._pool.indexOf(wordIdx);
          if (fromPoolIdx !== -1 && toPoolIdx !== -1) {
            var tmp = self._pool[fromPoolIdx];
            self._pool[fromPoolIdx] = self._pool[toPoolIdx];
            self._pool[toPoolIdx] = tmp;
          }
          self._draggedWordIdx = null;
          self._updateDisplay();
        });

        btn.addEventListener('click', function() {
          self._moveToAnswer(wordIdx);
        });

        poolDiv.appendChild(btn);
      });
    }

    // 启用提交按钮（答题区词数等于题目词数）
    var submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      var allPlaced = this._answer.length === q.words.length;
      submitBtn.disabled = !allPlaced;
      submitBtn.classList.toggle('enabled', allPlaced);
    }
  },

  /* ── 提交 ─────────────────────────────────────────────── */
  _submit: function() {
    if (this._submitted || !this._q) return;
    this._submitted = true;

    var q = this._q;
    var correct = this._answer.length === q.words.length;
    if (correct) {
      for (var i = 0; i < q.words.length; i++) {
        if (this._answer[i] !== i) { correct = false; break; }
      }
    }

    Sound.play(correct ? 'correct' : 'wrong');

    if (correct) {
      document.querySelectorAll('.arrange-answer-btn').forEach(function(b) {
        b.classList.add('answer-correct');
      });
      this._callbacks.onDone({ correct: true });
      this._callbacks.onComplete({ correct: true });
    } else {
      var area = document.getElementById('arrangeArea');
      if (area) {
        area.classList.add('shake');
        setTimeout(function() { area.classList.remove('shake'); }, 500);
      }
      this._submitted = false;
      var submitBtn = document.getElementById('submitBtn');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
      }
    }
  },

  /* ── Fisher-Yates 洗牌 ───────────────────────────────── */
  _shuffle: function(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }
};
