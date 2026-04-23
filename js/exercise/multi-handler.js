/* ============================================================
   multi-handler.js — 多题型协调器
   管理多个不同类型题目的切换、进度、庆祝
   ============================================================ */

'use strict';

/**
 * MultiQuestionHandler — 协调多个异质题目
 *
 * 数据结构：
 * config.questions = [
 *   { id: 'q1', type: 'read', question: ..., options: ..., answer: ... },
 *   { id: 'q2', type: 'match', pairs: [...] },
 *   { id: 'q3', type: 'fill', question: ..., answer: ... }
 * ]
 *
 * 流程：
 *   1. 创建 progress bar（总题数）
 *   2. init 第 0 题
 *   3. 第 N 题答对 → 学生手动点"下一题"按钮切换
 *   4. 最后一题完成 → full 庆祝（2.5s） → 统计结果页 → 点 Continue → exerciseAllComplete
 */
function MultiQuestionHandler() {
  this._config      = null;
  this._callbacks   = null;
  this._handlers    = [];   // 每个 question 一个 handler 实例
  this._currentIdx  = 0;
  this._completed   = 0;
  this._total       = 0;
  this._results     = [];  // [{ correct, selected, answer }, ...]
  this._questionDone = []; // [bool, ...] 每题是否已完成（onComplete 触发）
}

MultiQuestionHandler.prototype = {
  /* ── init ─────────────────────────────────────────────── */
  init: function(config, callbacks) {
    this._config    = config;
    this._callbacks = callbacks;
    this._handlers  = [];
    this._currentIdx = 0;
    this._completed = 0;
    this._total     = config.questions ? config.questions.length : 0;
    this._results   = [];
    this._questionDone = [];

    if (this._total === 0) {
      this._callbacks.onError('No questions found');
      return;
    }

    // 初始化进度条
    Progress.init(this._total);

    var self = this;
    var prevBtn = document.getElementById('prevBtn');
    var nextBtn = document.getElementById('nextBtn');
    if (prevBtn) prevBtn.addEventListener('click', function() { self._goToQuestion(self._currentIdx - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function() { self._goToQuestion(self._currentIdx + 1); });

    // 监听 toggle switch
    var pinyinToggle = document.getElementById('togglePinyin');
    var englishToggle = document.getElementById('toggleEnglish');
    if (pinyinToggle) {
      pinyinToggle.addEventListener('change', function() {
        self._config.showPinyin = pinyinToggle.checked;
      });
    }
    if (englishToggle) {
      englishToggle.addEventListener('change', function() {
        self._config.showEnglish = englishToggle.checked;
      });
    }

    // init 第 0 题
    this._initQuestion(0);
  },

  /* ── 根据题型创建 handler（新题新建，不复用）──────────── */
  _createHandler: function(question) {
    var type = question.type || 'choice';
    if (TypeHandlers[type]) {
      return new TypeHandlers[type]();
    }
    console.warn('[multi] No handler for type:', type);
    return { init: function() {} };
  },

  /* ── 初始化第 N 题 ─────────────────────────────────────── */
  _initQuestion: function(idx) {
    var question = this._config.questions[idx];
    if (!question) return;

    var self = this;

    // 清空各容器内容
    // questionText/optionsContainer 等在各类型自我重建中处理
    var clearIds = ['question-container', 'choiceArea',
                    'arrangeArea', 'arrangeAnswer', 'arrangePool',
                    'matchArea', 'fillArea', 'traceArea'];
    clearIds.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        el.innerHTML = '';
        el.style.minHeight = '0';
      }
    });

    // 更新副标题
    var typeLabels = {
      'read':    { title: '📖 Read',             subtitle: 'Read and choose the correct answer' },
      'listen':  { title: '🎧 Listen',          subtitle: 'Listen and choose the correct word' },
      'fill':    { title: '✏️ Fill',             subtitle: 'Type the word to complete the sentence' },
      'arrange': { title: '🔄 Arrange',          subtitle: 'Drag the words into the right order' },
      'match':   { title: '🔗 Match',            subtitle: 'Connect each item with its pair' },
      'trace':   { title: '✍️ Trace',            subtitle: 'Follow the strokes and practice writing' }
    };
    var qType = question.type || 'choice';
    var label = typeLabels[qType] || { title: 'Practice', subtitle: '' };
    var subtitleEl = document.getElementById('exerciseSubtitle');
    if (subtitleEl) subtitleEl.textContent = label.subtitle;
    var cardH2 = document.querySelector('.exercise-card h2');
    if (cardH2) cardH2.textContent = label.title;

    // 切换题目时重置播放按钮
    var playBtn = document.getElementById('playAudioBtn');
    if (playBtn) {
      playBtn.style.display = 'none';
      playBtn.disabled = false;
      playBtn.innerHTML = '<span class="play-icon">▶</span>';
    }

    // 展开当前题型所需的容器
    var type = question.type;
    var expandIds = {
      arrange: ['arrangeArea'],
      match:   ['matchArea'],
      trace:   ['traceArea']
    };
    (expandIds[type] || []).forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.minHeight = '';
    });

    // 读取 toggle switch 状态
    var pinyinToggle = document.getElementById('togglePinyin');
    var englishToggle = document.getElementById('toggleEnglish');
    if (pinyinToggle) this._config.showPinyin = pinyinToggle.checked;
    if (englishToggle) this._config.showEnglish = englishToggle.checked;

    // 统一传单题 config：multi-handler 控制所有题间的导航
    var configForHandler = {
      questions: [question],
      type:        question.type,
      audioBase:  this._config.audioBase,
      showHint:   this._config.showHint,
      showPinyin: this._config.showPinyin
    };

    // 每道题新建 handler 实例（单题单例），不复用
    var handler = this._createHandler(question);
    this._handlers[idx] = handler;

    handler.init(configForHandler, {
      onDone:     function(data) { self._onDone(idx, data); },
      onNextQuestion: function(data) { self._onNextQuestion(idx, data); },
      onComplete: function(data) { self._onQuestionComplete(idx, data); },
      onError:    function(msg)  { self._onError(msg); }
    });

    this._updateNavButtons();
  },

  /* ── 上一题 / 下一题按钮状态 ──────────────────────────── */
  _updateNavButtons: function() {
    var prevBtn = document.getElementById('prevBtn');
    var nextBtn = document.getElementById('nextBtn');
    var isFirst = this._currentIdx === 0;
    var isLast  = this._currentIdx === this._total - 1;
    var currentDone = !!this._questionDone[this._currentIdx];
    if (prevBtn) prevBtn.disabled = isFirst;
    if (nextBtn) nextBtn.disabled = isLast || !currentDone;
  },

  /* ── 跳转到指定题 ─────────────────────────────────────── */
  _goToQuestion: function(idx) {
    if (idx < 0 || idx >= this._total || idx === this._currentIdx) return;
    this._currentIdx = idx;
    Progress.setProgress(idx + 1, this._total);
    this._initQuestion(idx);
    this._callbacks.onNextQuestion({
      current: idx + 1,
      total:   this._total
    });
  },

  /* ── 为 arrange/match/fill 构造单题 config ─────────────── */
  _buildSingleQuestionConfig: function(fullConfig, idx) {
    return {
      questions: [fullConfig.questions[idx]],
      // 透传其他字段（audioBase、showHint 等）
      type:       fullConfig.type,
      audioBase:  fullConfig.audioBase,
      showHint:   fullConfig.showHint
    };
  },

  /* ── 第 N 题答对（收集结果） ──────────────────────────── */
  _onDone: function(idx, data) {
    this._results[idx] = {
      correct:  data.correct === true,
      selected: data.selected || null,
      answer:   data.answer   || null
    };
  },

  /* ── 第 N 题完成（onComplete 触发） ──────────────────── */
  _onQuestionComplete: function(idx, data) {
    if (idx < this._currentIdx) return;

    // 标记该题已完成，解锁下一题按钮
    this._questionDone[idx] = true;
    this._updateNavButtons();

    this._completed++;
    Progress.setProgress(this._completed, this._total);

    if (this._completed >= this._total) {
      this._renderStats();
      Celebration.show('full');
    }
  },

  /* ── 渲染统计结果页 ─────────────────────────────────── */
  _renderStats: function() {
    var card = document.querySelector('.exercise-card');
    if (!card) return;

    Array.prototype.slice.call(card.children).forEach(function(el) {
      if (el.classList && el.classList.contains('exercise-preserved')) return;
      el.style.display = 'none';
    });

    var correctCount = this._results.filter(function(r) { return r && r.correct; }).length;
    var total = this._total;
    var accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    var self = this;

    var statsWrap = document.createElement('div');
    statsWrap.id = 'exercise-stats-wrap';

    var header = document.createElement('div');
    header.className = 'stats-header';
    header.innerHTML =
      '<div class="stats-accuracy">' +
        '<span class="stats-accuracy-num">' + accuracy + '%</span>' +
        '<span class="stats-accuracy-label">Accuracy</span>' +
      '</div>' +
      '<div class="stats-summary">' + correctCount + ' / ' + total + ' correct</div>';
    statsWrap.appendChild(header);

    var list = document.createElement('div');
    list.className = 'stats-list';
    this._results.forEach(function(result, i) {
      var item = document.createElement('div');
      item.className = 'stats-item ' + (result.correct ? 'stats-correct' : 'stats-wrong');
      item.innerHTML =
        '<span class="stats-icon">' + (result.correct ? '✓' : '✗') + '</span>' +
        '<span class="stats-num">Q' + (i + 1) + '</span>';
      list.appendChild(item);
    });
    statsWrap.appendChild(list);

    var btnRow = document.createElement('div');
    btnRow.className = 'stats-btn-row';

    var restartBtn = document.createElement('button');
    restartBtn.className = 'stats-btn stats-btn-restart';
    restartBtn.textContent = 'Restart';
    restartBtn.addEventListener('click', function() { self._restart(); });
    btnRow.appendChild(restartBtn);

    var continueBtn = document.createElement('button');
    continueBtn.className = 'stats-btn stats-btn-continue';
    continueBtn.textContent = 'Continue';
    continueBtn.addEventListener('click', function() {
      self._callbacks.onAllComplete({ total: self._total, results: self._results });
    });
    btnRow.appendChild(continueBtn);

    statsWrap.appendChild(btnRow);
    card.appendChild(statsWrap);
  },

  /* ── 重新开始 ─────────────────────────────────────────── */
  _restart: function() {
    this._currentIdx = 0;
    this._completed = 0;
    this._results = [];
    this._questionDone = [];
    Progress.setProgress(0, this._total);
    this._initQuestion(0);
  },

  /* ── 多题内部切换 ──────────────────────────────────────── */
  _onNextQuestion: function(idx, data) {
    // 各 handler 在答对后已自行处理 nextQuestion 回调
    // 这里由 MultiQuestionHandler 统一协调，不需要额外处理
  },

  /* ── 错误 ─────────────────────────────────────────────── */
  _onError: function(msg) {
    this._callbacks.onError(msg);
  }
};
