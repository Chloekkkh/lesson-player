/* ============================================================
   exercise.js — 练习题分发中心
   被所有 exercise 类型 slide HTML 引用

   职责：
   - 接收 player.js 的 slideData postMessage
   - 根据 exerciseType 分发到对应类型模块
   - 管理公共 UI（sound / progress / celebration）
   - 向 player.js 回传 exerciseDone / exerciseComplete
   ============================================================ */

'use strict';

/* ── 工具函数 ───────────────────────────────────────────── */
function $(id) { return document.getElementById(id); }

function postToParent(action, payload) {
  try {
    parent.postMessage({ type: 'playerMessage', action: action, data: payload }, '*');
  } catch (e) {}
}

/* ── 音效初始化（自动） ─────────────────────────────────── */
Sound.init('/audio/system/');

/* ── 类型处理器映射表 ────────────────────────────────────── */
var TypeHandlers = {};

function registerType(type, handler) {
  TypeHandlers[type] = handler;
}

/* ── Exercise 主对象 ─────────────────────────────────────── */
var Exercise = {
  _config: null,
  _handler: null,

  /**
   * init — 接收 player 传来的 slideData，初始化对应类型
   * @param {object} config  slideConfig 对象
   */
  init: function(config) {
    this._config = config;
    var self = this;

    // display 类型走独立流程
    if (config.type === 'display') {
      this._initDisplay(config);
      return;
    }

    // ── 统一 Start 页面 ────────────────────────────────
    this._renderStartPage(config);
  },

  /* ── 渲染统一 Start 页面 ───────────────────────────── */
  _renderStartPage: function(config) {
    var self = this;
    var card = document.querySelector('.exercise-card');
    if (!card) return;

    // 隐藏原有 exercise 内容（保留 DOM 结构供后续使用）
    var children = Array.prototype.slice.call(card.children);
    children.forEach(function(el) {
      el.style.display = 'none';
      el.classList && el.classList.add('exercise-preserved');
    });

    var startWrap = document.createElement('div');
    startWrap.id = 'exercise-start-wrap';

    var icon = document.createElement('div');
    icon.className = 'exercise-start-icon';
    icon.textContent = '✏️';

    var title = document.createElement('h2');
    title.className = 'exercise-start-title';
    title.textContent = config.title || 'Practice';

    var subtitle = document.createElement('p');
    subtitle.className = 'exercise-start-subtitle';
    var qCount = (config.questions && config.questions.length) || 1;
    var estMinutes = Math.max(1, Math.round(qCount * 0.5));
    subtitle.textContent = qCount + ' Questions \u00b7 ~' + estMinutes + ' min';

    var startBtn = document.createElement('button');
    startBtn.className = 'exercise-start-btn';
    startBtn.textContent = 'Start Practice';
    startBtn.addEventListener('click', function() {
      self._hideStartPage(function() {
        self._initHandler(config);
      });
    });

    startWrap.appendChild(icon);
    startWrap.appendChild(title);
    startWrap.appendChild(subtitle);
    startWrap.appendChild(startBtn);
    card.appendChild(startWrap);
  },

  /* ── 隐藏 Start 页面，恢复 exercise 内容 ───────────── */
  _hideStartPage: function(onHidden) {
    var card = document.querySelector('.exercise-card');
    var startWrap = document.getElementById('exercise-start-wrap');
    if (startWrap) {
      startWrap.style.opacity = '0';
      startWrap.style.transition = 'opacity 0.3s';
      setTimeout(function() {
        startWrap.remove();
        // 恢复 exercise 内容可见性
        Array.prototype.slice.call(card.children).forEach(function(el) {
          if (el.classList && el.classList.contains('exercise-preserved')) {
            el.style.display = '';
            el.classList.remove('exercise-preserved');
          }
        });
        if (onHidden) onHidden();
      }, 300);
    } else {
      if (onHidden) onHidden();
    }
  },

  /* ── 分发到各类型处理器 ────────────────────────────── */
  _initHandler: function(config) {
    var self = this;

    // ── 更新练习页标题 ─────────────────────────────────
    var exerciseType = config.type || 'choice';
    var firstQType = (config.questions && config.questions[0] && config.questions[0].type) || exerciseType;

    var typeLabels = {
      'read':    { title: '📖 Read',             subtitle: 'Read and choose the correct answer' },
      'listen':  { title: '🎧 Listen',          subtitle: 'Listen and choose the correct word' },
      'fill':    { title: '✏️ Fill',             subtitle: 'Type the word to complete the sentence' },
      'arrange': { title: '🔄 Arrange',          subtitle: 'Drag the words into the right order' },
      'match':   { title: '🔗 Match',            subtitle: 'Connect each item with its pair' },
      'trace':   { title: '✍️ Trace',            subtitle: 'Follow the strokes and practice writing' }
    };

    var label = typeLabels[firstQType] || { title: 'Practice', subtitle: '' };
    var cardH2 = document.querySelector('.exercise-card h2');
    if (cardH2) cardH2.textContent = label.title;

    var questionText = document.getElementById('questionText');
    if (questionText) {
      questionText.dataset.subtitle = label.subtitle;
    }

    var subtitleEl = document.getElementById('exerciseSubtitle');
    if (subtitleEl) subtitleEl.textContent = label.subtitle;

    // ── 多题型检测 ─────────────────────────────────────
    if (config.questions && config.questions.length > 0) {
      var types = config.questions.map(function(q) {
        return q.type || 'choice';
      });
      var isMulti = types.some(function(t, i) { return t !== types[0]; });
      if (isMulti) {
        this._handler = new MultiQuestionHandler();
        this._handler.init(config, {
          onDone:        function(data) { self._onDone(data); },
          onAllComplete: function(data) { self._onAllComplete(data); },
          onNextQuestion: function(data) { self._onNextQuestion(data); },
          onError:       function(msg)  { self._onError(msg); }
        });
        return;
      }
    }

    var exerciseType = config.type || 'choice';

    if (!TypeHandlers[exerciseType]) {
      console.warn('[exercise] Unknown exerciseType:', exerciseType);
      return;
    }

    this._handler = new TypeHandlers[exerciseType]();
    this._handler.init(config, {
      onDone:        function(data) { self._onDone(data); },
      onComplete:    function(data) { self._onComplete(data); },
      onNextQuestion: function(data) { self._onNextQuestion(data); },
      onError:       function(msg)  { self._onError(msg); }
    });
  },

  /* ── display 类型 ────────────────────────────────────── */
  _initDisplay: function(config) {
    var self = this;
    if (TypeHandlers.display) {
      this._handler = new TypeHandlers.display();
      this._handler.init(config, {
        onComplete: function() { postToParent('displayComplete', {}); }
      });
    }
  },

  /* ── 回调：学生提交答案 ───────────────────────────────── */
  _onDone: function(data) {
    postToParent('exerciseDone', data || {});
  },

  /* ── 回调：全部完成 ───────────────────────────────────── */
  _onComplete: function(data) {
    postToParent('exerciseComplete', data || {});
  },

  /* ── 回调：多题型全部完成 ─────────────────────────────── */
  _onAllComplete: function(data) {
    postToParent('exerciseAllComplete', data || {});
  },

  /* ── 回调：多题切换 ───────────────────────────────────── */
  _onNextQuestion: function(data) {
    postToParent('exerciseNextQuestion', data || {});
  },

  /* ── 回调：错误 ───────────────────────────────────────── */
  _onError: function(msg) {
    postToParent('exerciseError', { message: msg });
  }
};

/* ── postMessage 监听（接收 player 传来的 slideData）─────── */
window.addEventListener('message', function handler(e) {
  var msg = e.data;
  if (!msg || msg.type !== 'slideData') return;
  window.removeEventListener('message', handler);
  Exercise.init(msg.data);
});

/* ── 暴露全局 ───────────────────────────────────────────── */
window.Exercise   = Exercise;
window.registerType = registerType;
window.Sound      = Sound;
window.Progress   = Progress;
window.Celebration = Celebration;
