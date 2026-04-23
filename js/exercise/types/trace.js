/* ============================================================
   trace.js — 汉字描红
   左：演示（自动播放笔画）  右：练习（HanziWriter quiz 检测）
   ============================================================ */

'use strict';

registerType('trace', TraceHandler);

function TraceHandler() {
  this._config     = null;
  this._callbacks  = null;
  this._char       = '';
  this._charPinyin = '';
  this._charEn     = '';
  this._writerDemo = null;
  this._writerQuiz = null;
  this._strokeCount = 0;
  this._quizStrokes = 0;
  this._quizMistakes = 0;
  this._quizQualityScores = [];
  this._quizDone    = false;
  this._starRating  = 0;
}

TraceHandler.prototype = {
  /* ── init ─────────────────────────────────────────────── */
  init: function(config, callbacks) {
    this._config    = config;
    this._callbacks = callbacks;
    var firstQ = config.questions && config.questions[0] ? config.questions[0] : {};
    this._char      = config.char || firstQ.char || '';
    this._charPinyin = firstQ.pinyin || config.pinyin || '';
    this._charEn    = firstQ.en    || config.en    || '';
    this._strokeCount = 0;
    this._quizStrokes = 0;
    this._quizMistakes = 0;
    this._quizQualityScores = [];
    this._quizDone    = false;
    this._starRating  = 0;
    this._stars       = firstQ.stars || config.stars || { '3': 0.85, '2': 0.6, '1': 0.3 };
    this._quizInstanceId = 0;  // Bug 7: instance counter to guard against stale callbacks

    this._render();
  },

  /* ── 渲染 ─────────────────────────────────────────────── */
  _render: function() {
    var area = document.getElementById('traceArea');
    if (!area) return;
    area.style.display = '';
    area.innerHTML = '';

    // 容器
    var container = document.createElement('div');
    container.className = 'trace-area';

    // 左侧：演示
    var demoSide = this._buildSide('demo', 'Demo');
    container.appendChild(demoSide);

    // 右侧：练习
    var quizSide = this._buildSide('quiz', 'Practice');
    container.appendChild(quizSide);

    area.appendChild(container);

    // 初始化 HanziWriter
    var self = this;
    if (window.HanziWriter) {
      // 演示实例（先加载，确保笔画数据就绪）
      this._writerDemo = HanziWriter.create('trace-demo', this._char, {
        showOutline:     true,
        showCharacter:   false,
        showHintAfter:   2000,
        strokeColor:     '#000000',
        outlineColor:    '#d0d8f0',
        strokeWidth:     4,
        drawingWidth:    18,
        drawingColor:    '#000000',
        onLoadCharDataSuccess: function(charData) {
          // charData.strokes 包含笔画数据，直接获取笔画数
          self._strokeCount = charData && charData.strokes ? charData.strokes.length : 0;
          console.log('[Trace] Demo 就绪，笔画数:', self._strokeCount);
          self._initQuiz();
          self._writerDemo.animateCharacter({
            onComplete: function() {
              self._onDemoComplete();
            }
          });
        },
        onLoadCharDataError: function() {
          document.getElementById('trace-demo').innerHTML =
            '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:3rem;color:var(--blue);">' + self._char + '</div>';
          // 即便演示失败，也初始化练习
          self._initQuiz();
        }
      });
    } else {
      // 无 HanziWriter 时显示静态字
      ['demo', 'quiz'].forEach(function(side) {
        var el = document.getElementById('trace-' + side);
        if (el) {
          el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:3rem;color:var(--blue);">' + self._char + '</div>';
        }
      });
    }
  },

  /* ── 构建左右侧 ───────────────────────────────────────── */
  _buildSide: function(type, label) {
    var side = document.createElement('div');
    side.className = 'trace-side';

    var title = document.createElement('div');
    title.className = 'trace-side-title';
    title.textContent = label;
    side.appendChild(title);

    var writerWrap = document.createElement('div');
    writerWrap.className = 'trace-writer';

    var bg = document.createElement('div');
    bg.className = 'trace-writer-bg';
    writerWrap.appendChild(bg);

    var writerEl = document.createElement('div');
    writerEl.id = 'trace-' + type;
    writerEl.style.cssText = 'position:absolute;inset:0;z-index:2;';

    // 练习区域初始禁用，完成演示后启用
    if (type === 'quiz') {
      writerWrap.style.pointerEvents = 'none';
      writerWrap.style.opacity = '0.5';
      writerWrap.id = 'trace-quiz-wrap';
    } else {
      writerEl.style.pointerEvents = 'auto';
    }
    writerWrap.appendChild(writerEl);

    side.appendChild(writerWrap);

    // Demo 侧：汉字信息（拼音、英文）放在写字区下方、按钮上方
    if (type === 'demo' && (this._charPinyin || this._charEn)) {
      var info = document.createElement('div');
      info.className = 'trace-char-info';
      if (this._charPinyin) {
        var pinyinEl = document.createElement('div');
        pinyinEl.className = 'trace-char-pinyin';
        pinyinEl.textContent = this._charPinyin;
        info.appendChild(pinyinEl);
      }
      if (this._charEn) {
        var enEl = document.createElement('div');
        enEl.className = 'trace-char-en';
        enEl.textContent = this._charEn;
        info.appendChild(enEl);
      }
      side.appendChild(info);
    }

    // 练习侧：反馈 + 星级放在写字区下方
    if (type === 'quiz') {
      var feedback = document.createElement('div');
      feedback.id = 'traceFeedback';
      feedback.className = 'trace-feedback';
      side.appendChild(feedback);

      var stars = document.createElement('div');
      stars.id = 'traceStars';
      stars.className = 'trace-stars';
      side.appendChild(stars);
    }

    // 控制按钮
    var controls = document.createElement('div');
    controls.className = 'trace-controls';

    if (type === 'demo') {
      var replayBtn = document.createElement('button');
      replayBtn.className = 'trace-btn';
      replayBtn.id = 'traceReplayBtn';
      replayBtn.textContent = '↺ Replay';
      replayBtn.addEventListener('click', function() {
        this._replayDemo();
      }.bind(this));
      controls.appendChild(replayBtn);
    } else {
      var clearBtn = document.createElement('button');
      clearBtn.className = 'trace-btn';
      clearBtn.id = 'traceRedoBtn';
      clearBtn.textContent = '↺ Redo';
      clearBtn.addEventListener('click', function() {
        this._clearQuiz();
      }.bind(this));
      controls.appendChild(clearBtn);
    }

    side.appendChild(controls);

    return side;
  },

  /* ── 演示播放完毕 ─────────────────────────────────────── */
  _onDemoComplete: function() {
    // 启用练习区域
    var quizWrap = document.getElementById('trace-quiz-wrap');
    if (quizWrap) {
      quizWrap.style.pointerEvents = 'auto';
      quizWrap.style.opacity = '1';
    }
  },

  /* ── 重新播放演示 ─────────────────────────────────────── */
  _replayDemo: function() {
    if (this._writerDemo) {
      this._writerDemo.hideCharacter();
      this._writerDemo.animateCharacter({
        onComplete: function() {
          this._onDemoComplete();
        }.bind(this)
      });
    }
  },

  /* ── 初始化练习实例 ─────────────────────────────────── */
  _initQuiz: function() {
    var self = this;
    var quizEl = document.getElementById('trace-quiz');
    if (!quizEl || !window.HanziWriter) return;

    this._writerQuiz = HanziWriter.create('trace-quiz', this._char, {
      showOutline:   true,
      showCharacter: false,
      strokeColor:   '#000000',
      outlineColor:  '#d0d8f0',
      strokeWidth:   6,
      drawingWidth:  24,
      drawingColor:  '#000000',
      drawingFadeDuration: 0,
      onLoadCharDataSuccess: function(charData) {
        quizEl.setAttribute('data-loaded', 'true');
        // 使用 charData 直接获取笔画数
        self._strokeCount = charData && charData.strokes ? charData.strokes.length : (self._strokeCount || 0);
        console.log('[Trace] Quiz 就绪，笔画数:', self._strokeCount);
        // 调用 quiz() 方法启用练习模式
        if (self._writerQuiz && typeof self._writerQuiz.quiz === 'function') {
          self._writerQuiz.quiz();
          console.log('[Trace] 已调用 quiz() 启用练习模式');
        }
      },
      onLoadCharDataError: function(err) {
        console.error('[Trace] Quiz 加载失败:', err);
        quizEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:2rem;color:#e55;">Failed to load</div>';
      },
      onCorrectStroke: function(strokeData) {
        self._quizStrokes++;
        var mistakes = strokeData.mistakesOnStroke || 0;
        var qualityScore = mistakes === 0 ? 1.0 : mistakes === 1 ? 0.7 : mistakes === 2 ? 0.4 : 0.1;
        self._quizQualityScores.push(qualityScore);
        console.log('[Trace] 正确笔画: stroke=' + self._quizStrokes + ' mistakesOnStroke=' + mistakes + ' quality=' + qualityScore);
        self._updateProgress();
        Sound.play('correct');
      },
      onWrongStroke: function(strokeData) {
        self._quizMistakes++;
        self._quizQualityScores.push(0);
        console.log('[Trace] 错误笔画: mistakes=' + self._quizMistakes + ' mistakesOnStroke=' + (strokeData.mistakesOnStroke || 0));
        self._showFeedback('Wrong stroke, try again', 'wrong');
        Sound.play('wrong');
      },
      onComplete: function() {
        self._quizDone = true;
        self._calcStarRating();
        Sound.play('complete');
        var msgs = ['Keep practicing!', 'Good job!', 'Excellent!'];
        self._showFeedback(msgs[self._starRating - 1] || 'Done!', 'correct');
        self._callbacks.onComplete({ total: 1 });
      }
    });
  },

  /* ── 清除练习 ─────────────────────────────────────────── */
  _clearQuiz: function() {
    if (this._writerQuiz) {
      this._writerQuiz.hideCharacter();
      this._writerQuiz.showOutline();
    }
    var quizEl = document.getElementById('trace-quiz');
    if (quizEl) {
      quizEl.innerHTML = '';
      quizEl.removeAttribute('data-loaded');
    }
    // Bug 7: increment instance ID so any stale onComplete from the old writer is ignored
    this._quizInstanceId++;
    this._quizStrokes = 0;
    this._quizMistakes = 0;
    this._quizQualityScores = [];
    this._starRating = 0;
    this._quizDone = false;
    this._updateProgress();
    var fbEl = document.getElementById('traceFeedback');
    var stEl = document.getElementById('traceStars');
    if (fbEl) fbEl.textContent = '';
    if (stEl) stEl.textContent = '';

    if (quizEl && window.HanziWriter) {
      var self = this;
      var currentId = this._quizInstanceId;  // capture at creation time
      this._writerQuiz = HanziWriter.create('trace-quiz', this._char, {
        showOutline:   true,
        showCharacter: false,
        strokeColor:     '#000000',
        outlineColor:    '#d0d8f0',
        strokeWidth:   6,
        drawingWidth:  24,
        drawingColor:  '#000000',
        drawingFadeDuration: 0,
        onLoadCharDataSuccess: function(charData) {
          quizEl.setAttribute('data-loaded', 'true');
          self._strokeCount = charData && charData.strokes ? charData.strokes.length : (self._strokeCount || 0);
          if (self._writerQuiz && typeof self._writerQuiz.quiz === 'function') {
            self._writerQuiz.quiz();
          }
        },
        onLoadCharDataError: function(err) {
          console.error('[Trace] Quiz 重新加载失败:', err);
        },
        onCorrectStroke: function(strokeData) {
          self._quizStrokes++;
          var mistakes = strokeData.mistakesOnStroke || 0;
          var qualityScore = mistakes === 0 ? 1.0 : mistakes === 1 ? 0.7 : mistakes === 2 ? 0.4 : 0.1;
          self._quizQualityScores.push(qualityScore);
          self._updateProgress();
          Sound.play('correct');
        },
        onWrongStroke: function(_strokeData) {
          self._quizMistakes++;
          self._quizQualityScores.push(0);
          self._showFeedback('Wrong stroke, try again', 'wrong');
          Sound.play('wrong');
        },
        onComplete: function() {
          // Bug 7: guard against stale callbacks from a previous quiz instance
          if (currentId !== self._quizInstanceId) return;
          self._quizDone = true;
          self._calcStarRating();
          Sound.play('complete');
          var msgs = ['Keep practicing!', 'Good job!', 'Excellent!'];
          self._showFeedback(msgs[self._starRating - 1] || 'Done!', 'correct');
          self._callbacks.onComplete({ total: 1 });
        }
      });
    }
  },

  /* ── 更新笔画进度 ─────────────────────────────────────── */
  _updateProgress: function() {
    // 进度显示已移除，保持空实现
  },

  /* ── 显示反馈 ─────────────────────────────────────────── */
  _showFeedback: function(msg, type) {
    var el = document.getElementById('traceFeedback');
    if (el) {
      el.textContent = msg;
      el.className = 'trace-feedback ' + type;
    }
  },

  /* ── 计算星级 ─────────────────────────────────────────── */
  _calcStarRating: function() {
    var stars = this._stars;

    // 1. 完成度分数 (40%)
    var completionScore = this._strokeCount > 0
      ? this._quizStrokes / this._strokeCount
      : 0;

    // 2. 质量分数 (60%) - 基于所有笔画的平均质量
    var qualityAvg = 0;
    if (this._quizQualityScores.length > 0) {
      var sum = this._quizQualityScores.reduce(function(a, b) { return a + b; }, 0);
      qualityAvg = sum / this._quizQualityScores.length;
    }

    // 3. 综合分数
    var combinedScore = completionScore * 0.4 + qualityAvg * 0.6;

    // 4. 根据综合分数评星
    var starCount = combinedScore >= stars['3'] ? 3
                 : combinedScore >= stars['2'] ? 2
                 : combinedScore >= stars['1'] ? 1
                 : 1;

    this._starRating = starCount;

    // 5. 显示星级
    var starsEl = document.getElementById('traceStars');
    if (starsEl) {
      var full = '★'.repeat(starCount);
      var empty = '☆'.repeat(3 - starCount);
      starsEl.innerHTML = '<span class="star-filled">' + full + '</span><span class="star-empty">' + empty + '</span>';
    }

    console.log('[Trace] 星级计算: _strokeCount=' + this._strokeCount + ' _quizStrokes=' + this._quizStrokes + ' _quizMistakes=' + this._quizMistakes + ' _quizQualityScores.length=' + this._quizQualityScores.length + ' 完成度=' + (completionScore*100).toFixed(0) + '% 质量=' + (qualityAvg*100).toFixed(0) + '% 综合=' + (combinedScore*100).toFixed(0) + '%');
  }
};
