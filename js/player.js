/* ============================================================
   player.js — HSK 课程播放器核心逻辑
   被 player.html 引用，不被任何课程页面引用
   ============================================================ */

'use strict';

/* ─────────────────────────────────────────────────────────
   常量 — 幻灯片设计尺寸和自动切换间隔
   ───────────────────────────────────────────────────────── */
var SLIDE_W     = 1200;   // 幻灯片原始宽度（像素）
var SLIDE_H     = 675;    // 幻灯片原始高度（像素）

/* ─────────────────────────────────────────────────────────
   状态变量
   ───────────────────────────────────────────────────────── */
var course        = null;   // 课程配置（从 course.json 加载）
var current       = 0;      // 当前显示的幻灯片索引（从 0 开始）
var playing       = false;  // 是否处于自动播放状态
var exerciseReady = false;  // 练习题是否已被学生作答
var frames        = [];     // 所有幻灯片 iframe 元素的数组
var audioDuration = 0;      // 当前音频总时长（秒），无音频时为 0
var timerStart    = 0;      // 当前页计时开始时间（Date.now）
var timerTotal    = 0; // 当前音频总时长（秒），无音频时为 0
var intervalId    = null;   // setInterval 的 ID，用于取消计时器
var isTransitioning = false; // 切换锁，防止重复调用
var pendingIndex    = null;  // 过渡期间记录的待切换目标

/* ─────────────────────────────────────────────────────────
   聚光灯（Spotlight）状态
   ───────────────────────────────────────────────────────── */
var spotlightList      = [];   // 当前页聚光灯配置 [{ elementId, at }]
var spotlightFired     = {};   // 已触发记录，{ "slideIdx-elementId": true }
var spotlightIndex     = 0;   // 无音频时的轮询索引
var spotlightIntervalId = null; // 无音频聚光灯轮询定时器 ID
var spotlightClears    = {};   // 待执行的清除计时器，{ "slideIdx-elementId": timeoutId }
var spotlightRafId     = null; // 有音频时的 RAF 循环 ID
var assistantSubtitles     = []; // 当前页字幕 [{at, text}]
var assistantSubtitleIndex = 0;  // 当前字幕索引

/* ─────────────────────────────────────────────────────────
   DOM 元素缓存 — 避免重复查询 DOM
   ───────────────────────────────────────────────────────── */
var $ = function(id) { return document.getElementById(id); };

var loadingScreen    = $('loadingScreen');     // 加载中覆盖层
var errorScreen     = $('errorScreen');      // 错误提示层
var errorMessage    = $('errorMessage');      // 错误信息文本
var playerContainer = $('playerContainer');   // 播放器主容器
var player          = $('player');           // 幻灯片容器（iframe 包裹层）
var courseTitleEl   = $('courseTitle');     // 课程标题
var courseDescEl    = $('courseDesc');      // 课程描述
var dotsEl          = $('dots');            // 圆点导航容器
var statusIndicator = $('statusIndicator'); // 状态指示点（绿/红/黄）
var statusText      = $('statusText');      // 状态文字（播放中/已暂停/请确认答案）
var progressFill    = $('progressFill');     // 进度条填充条
var progressTimeEl  = $('progressTime');     // 进度时间文字
var audioEl         = $('audioEl');         // HTML5 音频元素
var confirmOverlay  = $('confirmOverlay');   // 练习题确认按钮浮层
var confirmBtn      = $('confirmBtn');      // 确认答案按钮
var pauseScreen     = $('pauseScreen');     // 统一遮罩（start/pause）
var loadingCourseName = $('loadingCourseName'); // 加载时显示的课程名

/* ─────────────────────────────────────────────────────────
   控制栏 DOM 元素
   ───────────────────────────────────────────────────────── */
var btnPrev      = $('btnPrev');
var btnPlayPause = $('btnPlayPause');
var btnNext      = $('btnNext');
var btnVolume    = $('btnVolume');
var volumeSlider = $('volumeSlider');
var btnReplay    = $('btnReplay');

// 初始化音量
audioEl.volume = 0.8;
volumeSlider.addEventListener('input', function() {
  audioEl.volume = this.value / 100;
  updateVolumeIcon(this.value);
});

function updateVolumeIcon(vol) {
  btnVolume.textContent = vol == 0 ? '🔇' : vol < 50 ? '🔉' : '🔊';
}

/* ═══════════════════════════════════════════════════════
   INIT — 初始化播放器
   ═══════════════════════════════════════════════════════ */
function init() {
  // 从 URL 参数中获取课程 ID，如 ?course=lesson-thanks
  var params   = new URLSearchParams(window.location.search);
  var courseId = params.get('course') || 'lesson-thanks'; // 默认课程

  loadingCourseName.textContent = courseId; // 加载中显示课程 ID

  // 加载课程配置文件
  fetch('courses/' + courseId + '/course.json')
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function(data) {
      course = data; // 保存课程配置

      // 隐藏加载层，显示播放器
      loadingScreen.classList.add('hidden');
      playerContainer.classList.add('visible');

      // 构建页面元素
      buildDots();       // 生成圆点导航
      buildIframes(courseId); // 创建所有幻灯片 iframe
      applyTransformAll();     // 等比缩放适配窗口

      // 加载第 0 页（第一页）
      loadSlide(0, true);
    })
    .catch(function(err) {
      // 加载失败，显示错误信息
      loadingScreen.classList.add('hidden');
      errorScreen.classList.add('visible');
      errorMessage.textContent = err.message;
    });
}

/* ═══════════════════════════════════════════════════════
   BUILD DOM — 构建页面元素
   ═══════════════════════════════════════════════════════ */

/**
 * buildDots — 根据 slides 数组动态生成底部圆点导航
 * 每个圆点对应一页幻灯片，点击可跳转到对应页
 */
function buildDots() {
  courseTitleEl.textContent = course.title || '';
  courseDescEl.textContent  = course.description || '';
  dotsEl.innerHTML = ''; // 清空现有圆点

  // 为每一页创建一个圆点按钮
  course.slides.forEach(function(slide, i) {
    var btn = document.createElement('button');
    btn.className = 'dot' + (i === 0 ? ' active' : ''); // 第一页圆点高亮
    btn.setAttribute('aria-label', '第' + (i + 1) + '页');
    btn.dataset.index = i;
    btn.addEventListener('click', function(e) {
      e.stopPropagation(); // 阻止冒泡到 player 的点击事件
      goToSlide(i);        // 跳转到指定页
    });
    dotsEl.appendChild(btn);
  });
}

/**
 * buildIframes — 为课程每一页创建一个 iframe 元素
 * 所有 iframe 叠加在同一个位置（通过 z-index 分层），
 * 通过 opacity 过渡实现交叉淡入淡出效果
 *
 * 注意：iframe 在创建时就设置了 src（预加载），但通过 opacity=0
 * 隐藏不可见，只有 active 的 iframe 是可见的
 */
function buildIframes(courseId) {
  // 先清除旧的 iframe
  frames.forEach(function(f) { f.remove(); });
  frames = [];

  course.slides.forEach(function(slide, i) {
    var iframe = document.createElement('iframe');

    // 第一页默认激活（显示）
    iframe.className = 'slide-frame' + (i === 0 ? ' active' : '');
    iframe.dataset.index = i;
    iframe.style.zIndex = i === 0 ? '2' : '1';  // z-index 用内联保留，opacity/pointerEvents 交给 CSS .active 类

    // 设置 iframe 加载的页面路径
    iframe.src = 'courses/' + courseId + '/slides/' + slide.index + '.html';

    // 插入到 player 容器中（confirmOverlay 之前）
    player.insertBefore(iframe, confirmOverlay);
    frames.push(iframe);
  });

  // 监听窗口大小变化，重新计算缩放比例
  window.addEventListener('resize', function() {
    frames.forEach(function(f) { applyTransform(f); });
  });
}

/* ═══════════════════════════════════════════════════════
   TRANSFORM — 等比缩放
   ═══════════════════════════════════════════════════════ */

/**
 * applyTransform — 将固定尺寸的 iframe 等比缩放，适配当前容器宽度
 *
 * 策略：取宽高缩放比例中较小的一个，保证不变形
 *       然后通过 translate 将 iframe 居中
 *
 * @param {HTMLIFrameElement} frame - 要缩放的 iframe
 */
function applyTransform(frame) {
  var scaleX   = player.offsetWidth  / SLIDE_W;  // 宽度缩放比例
  var scaleY   = player.offsetHeight / SLIDE_H; // 高度缩放比例
  var scale    = Math.min(scaleX, scaleY);       // 取较小值（不变形）
  var scaledW  = SLIDE_W * scale;               // 缩放后宽度
  var scaledH  = SLIDE_H * scale;               // 缩放后高度
  var offsetX  = (player.offsetWidth  - scaledW) / 2; // 水平居中偏移
  var offsetY  = (player.offsetHeight - scaledH) / 2; // 垂直居中偏移

  frame.style.transform      = 'translate(' + offsetX + 'px,' + offsetY + 'px) scale(' + scale + ')';
  frame.style.transformOrigin = 'top left'; // 以左上角为基准缩放

  // 同步给 assistant 应用相同缩放，保持位置跟随幻灯片
  var assistantEl = document.getElementById('assistant');
  if (assistantEl) {
    //assistantEl.style.transform = 'scale(' + scale + ')';
    assistantEl.style.transformOrigin = 'bottom right';
  }
}

/**
 * applyTransformAll — 对所有 iframe 批量应用缩放
 * 使用 requestAnimationFrame 在下一帧渲染，避免重复计算
 */
function applyTransformAll() {
  requestAnimationFrame(function() {
    frames.forEach(function(f) { applyTransform(f); });
  });
}

/* ═══════════════════════════════════════════════════════
   TIMER — 无音频时的自动切换计时器
   ═══════════════════════════════════════════════════════ */

/**
 * startTimer — 启动计时器
 *
 * 有聚光灯时：
 *   第一个按 at 触发，之后每个按前一个的 duration 触发
 * 无聚光灯时：
 *   普通 interval，每 100ms 检查是否超时
 */
function startTimer() {
  stopTimer();

  var slide = course.slides[current];

  // 有聚光灯但无音频：按 at + duration 顺序触发
  if (slide.spotlights && slide.spotlights.length > 0 && !slide.audio) {
    spotlightList = slide.spotlights.slice().sort(function(a, b) { return a.at - b.at; });
    spotlightFired = {};
    spotlightIndex = 0;
    timerStart = Date.now();
    runSpotlightSequence();
    return;
  }

  // 无音频无 spotlights：不启动任何计时器，等待用户手动切换
  // （startTimer 不再用于 content 无音频自动跳转）
}

/**
 * stopTimer — 停止计时器，并重置进度条
 */
function stopTimer() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (spotlightIntervalId !== null) {
    clearTimeout(spotlightIntervalId);
    spotlightIntervalId = null;
  }
  progressFill.style.width = '0%'; // 重置进度条
}

/* ═══════════════════════════════════════════════════════
   SLIDE LOADING — 加载/切换幻灯片
   ═══════════════════════════════════════════════════════ */

/**
 * loadSlide — 切换到指定幻灯片
 *
 * @param {number} index  - 目标幻灯片索引
 * @param {boolean} isInit - 是否是首次初始化（首次加载时不执行旧 slide 的淡出动画）
 *
 * 切换流程：
 *   1. 旧 slide：移除 active 类 → opacity 0.6s 淡出，z-index 降为 1
 *   2. 新 slide：添加 active 类 → opacity 0.6s 淡入，z-index 升为 2
 *   3. 向新 slide iframe 发送 postMessage（注入题目数据）
 *   4. 根据 slide 类型启动不同机制：
 *      - content + 有音频：加载音频，audio.onended 触发切换
 *      - content + 无音频：不自动切换，等待用户手动
 *      - exercise：显示确认按钮，等待学生手动确认
 */
function loadSlide(index, isInit) {
  // 防止重复加载同一页（非首次初始化时）
  if (index === current && frames[index] && !isInit) return;

  var prevFrame = frames[current]; // 旧 iframe
  var nextFrame = frames[index];   // 新 iframe

  // 旧 slide 淡出（class 切换触发 CSS transition）
  if (prevFrame && !isInit) {
    prevFrame.classList.remove('active');
    prevFrame.style.zIndex = '1'; // 降到下层（zIndex 不动画，inline 设置无影响）
  }

  // 新 slide 淡入
  if (nextFrame) {
    nextFrame.classList.add('active');
    nextFrame.style.zIndex = '2'; // 升到上层
  }

  // 更新圆点高亮状态
  dotsEl.querySelectorAll('.dot').forEach(function(dot, i) {
    dot.classList.toggle('active', i === index);
  });

  // 更新状态
  current       = index;
  exerciseReady = false; // 重置练习作答状态
  confirmOverlay.classList.remove('visible'); // 隐藏确认按钮
  confirmOverlay.style.pointerEvents = ''; // 重置暂停时设的 none

  // 重置聚光灯状态
  spotlightList = [];
  spotlightFired = {};
  spotlightIndex = 0;
  if (spotlightIntervalId !== null) {
    clearTimeout(spotlightIntervalId);
    spotlightIntervalId = null;
  }
  // 清除所有待执行的聚光灯清除计时器
  Object.keys(spotlightClears).forEach(function(key) {
    clearTimeout(spotlightClears[key]);
    delete spotlightClears[key];
  });

  // 清除旧 iframe 的聚光灯
  if (prevFrame) {
    sendSpotlightClear(prevFrame);
  }

  // 重置伴学助手字幕状态
  assistantSubtitles = (course.slides[index] && course.slides[index].subtitles) ? course.slides[index].subtitles : [];
  assistantSubtitleIndex = 0;
  var subEl = document.getElementById('assistantSubtitle');
  if (subEl) subEl.textContent = '';
  var assistantEl = document.getElementById('assistant-bubble');
  if (assistantEl) {
    if (assistantSubtitles && assistantSubtitles.length > 0 && playing) {
      assistantEl.classList.remove('hidden');
    } else {
      assistantEl.classList.add('hidden');
    }
  }

  // 向 iframe 发送当前页的题目数据
  if (nextFrame) {
    sendSlideData(nextFrame, course.slides[index]);
  }

  // 重置进度条
  progressFill.style.width = '0%';
  progressTimeEl.textContent = formatTime(timerTotal / 1000) + ' / ' + formatTime(timerTotal / 1000);

  var slide = course.slides[index];

  // exercise / display / video 永远不显示遮罩，等过渡完成后再真正隐藏
  if (slide.type === 'exercise' || slide.type === 'display' || slide.type === 'video') {
    pauseScreen.style.opacity = '0';
    pauseScreen.style.pointerEvents = 'none';
    setTimeout(function() { pauseScreen.style.display = 'none'; }, 600);
  } else if (!playing) {
    // content 页面：未播放时显示遮罩
    pauseScreen.style.display = 'flex';
    pauseScreen.style.opacity = '1';
    pauseScreen.style.pointerEvents = '';
  } else {
    // content 页面：播放中隐藏遮罩
    pauseScreen.style.opacity = '0';
    pauseScreen.style.display = 'none';
  }

  // exercise / display / video 页面：让点击穿透到 iframe（选项/按钮可点）
  clickInterceptor.style.pointerEvents = (slide.type === 'exercise' || slide.type === 'display' || slide.type === 'video') ? 'none' : 'auto';

  // ═══ 练习题（exercise）═══
  if (slide.type === 'exercise') {
    // 新型题型（questions 数组）：iframe 自己管理音频和流程
    // legacy 题型（question 字段）：player.js 复用旧的音频+确认按钮流程
    if (slide.questions && slide.audio) {
      // listen 类型有 slides.audio（intro 音频），由 player.js 播放
      loadAudio('courses/' + course.id + '/audio/' + slide.audio, slide);
    } else if (slide.question && slide.audio) {
      // legacy 有题目的 exercise 类型
      loadAudio('courses/' + course.id + '/audio/' + slide.audio, slide);
    }
    // exercise 类型不自动切换，由 iframe 通过 postMessage 控制
    playing = false;
    statusIndicator.className = 'status-indicator waiting';
    statusText.textContent = '请先完成练习';
    stopTimer();
    updateControlBarState();
        isTransitioning = false; // exercise 页面已就绪，释放锁
    // 如果过渡期间有点击被记录，立即处理
    if (pendingIndex !== null && pendingIndex !== current) {
      var next = pendingIndex;
      pendingIndex = null;
      goToSlide(next);
    } else {
      pendingIndex = null;
    }
    return;
  }

  // ═══ 视频页（video）═══
  if (slide.type === 'video') {
    // 视频由 iframe 内部自己管理
    // 播完后 iframe 发 displayComplete → player 翻页
    playing = false;
    statusIndicator.className = 'status-indicator paused';
    statusText.textContent = '播放视频中';
    stopTimer();
    isTransitioning = false;
    if (pendingIndex !== null && pendingIndex !== current) {
      var next = pendingIndex; pendingIndex = null; goToSlide(next);
    } else { pendingIndex = null; }
    return;
  }

  // ═══ 内容页（content）═══
  if (slide.audio) {
    loadAudio('courses/' + course.id + '/audio/' + slide.audio, slide);
  }
  // 遮罩由 loadSlide 顶部的早期 block 统一处理，这里只设状态
  playing = false;
  statusIndicator.className = 'status-indicator paused';
  statusText.textContent = '已暂停';
  isTransitioning = false; // 切换完成，释放锁
  updateControlBarState();

  // 如果过渡期间有点击被记录，立即处理
  if (pendingIndex !== null && pendingIndex !== current) {
    var next = pendingIndex;
    pendingIndex = null;
    goToSlide(next);
  } else {
    pendingIndex = null;
  }
}

/**
 * goToSlide — 跳转到指定页（带边界检查和防重入）
 *
 * @param {number} index - 目标页索引（支持负数，会自动 wrap）
 */
function goToSlide(index) {
  // 防止切到同一页
  if (index === current) return;

  // 过渡期间：记录最新目标，等当前过渡完成后立即切换
  if (isTransitioning) {
    pendingIndex = index;
    return;
  }

  isTransitioning = true;
  // 循环 wrap：-1 → 最后一页，4 → 第 0 页
  if (index < 0) index = course.slides.length - 1;
  if (index >= course.slides.length) index = 0;

  if (index < 0 || index >= course.slides.length) { isTransitioning = false; return; }

  stopTimer();  // 停止当前计时器
  clearAudio(); // 停止当前音频
  loadSlide(index); // 加载新页面
}

/* ═══════════════════════════════════════════════════════
   POSTMESSAGE — 与 iframe 通信（父 → 子）
   ═══════════════════════════════════════════════════════ */

/**
 * sendSlideData — 向 iframe 发送当前页数据（题目/内容信息）
 *
 * 消息格式：
 *   { type: 'slideData', data: { index, type, title, audio, question, options, ... } }
 *
 * @param {HTMLIFrameElement} frame   - 目标 iframe
 * @param {object} slideData          - course.json 中对应 slide 的数据
 */
function sendSlideData(frame, slideData) {
  try {
    // 注入课程路径前缀，供 iframe 拼接音频完整路径
    var payload = Object.assign({}, slideData, {
      courseId: course.id,
      audioBase: '/courses/' + course.id + '/audio/'
    });
    frame.contentWindow.postMessage({ type: 'slideData', data: payload }, '*');
  } catch (e) {
    // 跨域情况下 postMessage 会抛出异常，静默忽略
  }
}

/* ─────────────────────────────────────────────────────────
   SPOTLIGHT — 聚光灯通信（父 → 子）
   ───────────────────────────────────────────────────────── */

/**
 * startSpotlightRaf — 有音频时，启动 RAF 循环检查聚光灯触发与清除
 */
function startSpotlightRaf() {
  cancelAnimationFrame(spotlightRafId);
  function tick() {
    if (!playing) return;
    checkSpotlightsWithClear(audioEl.currentTime);
    spotlightRafId = requestAnimationFrame(tick);
  }
  spotlightRafId = requestAnimationFrame(tick);
}

/**
 * checkSpotlightsWithClear — 有音频时，每帧检查聚光灯触发，并在 duration 结束后清除
 *
 * @param {number} currentTime - 当前音频播放时间（秒）
 */
function checkSpotlightsWithClear(currentTime) {
  var slide = course.slides[current];
  if (!slide.spotlights || slide.spotlights.length === 0) return;

  slide.spotlights.forEach(function(s) {
    var key = current + '-' + s.elementId;
    if (!spotlightFired[key] && currentTime >= s.at) {
      spotlightFired[key] = true;
      sendSpotlight(frames[current], s.elementId);
      // 调度清除：at + duration 秒后恢复暗色
      var clearAt = (s.at + (s.duration || 1.5)) * 1000; // ms
      var wait = clearAt - currentTime * 1000;
      if (wait > 0) {
        spotlightClears[key] = setTimeout(function() {
          if (playing) sendSpotlightClear(frames[current]);
          delete spotlightClears[key];
        }, wait);
      }
    }
  });
}

/**
 * checkAssistantSubtitles — 有音频时，检查字幕触发并更新 DOM + iframe
 */
function checkAssistantSubtitles(currentTime) {
  if (!assistantSubtitles || assistantSubtitles.length === 0) return;
  while (assistantSubtitleIndex < assistantSubtitles.length &&
         assistantSubtitles[assistantSubtitleIndex].at <= currentTime) {
    var sub = assistantSubtitles[assistantSubtitleIndex];
    var subEl = document.getElementById('assistantSubtitle');
    if (subEl) {
      subEl.textContent = sub.text;
      var assistantEl = document.getElementById('assistant-bubble');
      if (assistantEl) assistantEl.classList.remove('hidden');
    }
    if (frames[current]) {
      try {
        frames[current].contentWindow.postMessage({ type: 'assistantSubtitle', text: sub.text }, '*');
      } catch (e) {}
    }
    assistantSubtitleIndex++;
  }
}

/**
 * runSpotlightSequence — 无音频时，按 at + duration 顺序触发聚光灯
 *
 * 触发规则：
 *   spotlight[0] 在 max(at[0], 0) 秒触发
 *   spotlight[i] 在 max(at[i], at[i-1] + duration[i-1]) 秒触发
 *
 * 即：每个聚光灯取"自身 at 时间"和"前一个自然结束时间"中较晚的那个
 */
function runSpotlightSequence() {
  if (!playing) return;

  if (spotlightIndex >= spotlightList.length) {
    goToSlide((current + 1) % course.slides.length);
    return;
  }

  var s = spotlightList[spotlightIndex];
  var key = current + '-' + s.elementId;

  // 计算这个聚光灯的触发时间
  var triggerTime;
  if (spotlightIndex === 0) {
    triggerTime = (s.at || 0) * 1000; // 第一个以 at 为基准
  } else {
    var prev = spotlightList[spotlightIndex - 1];
    var prevEnd = (prev.at || 0) * 1000 + (prev.duration || 1.5) * 1000;
    triggerTime = Math.max((s.at || 0) * 1000, prevEnd);
  }

  var elapsed = Date.now() - timerStart;
  var wait = triggerTime - elapsed;

  if (wait > 0) {
    spotlightIntervalId = setTimeout(runSpotlightSequence, wait);
    return;
  }

  // 触发
  if (!spotlightFired[key]) {
    // 清除前一个聚光灯（触发新 spotlight 时前一个已过 duration）
    if (spotlightIndex > 0) {
      sendSpotlightClear(frames[current]);
    }
    spotlightFired[key] = true;
    sendSpotlight(frames[current], s.elementId);
  }

  spotlightIndex++;
  spotlightIntervalId = setTimeout(runSpotlightSequence, 50); // 立即检查下一个
}

/**
 * sendSpotlight — 向 iframe 发送聚光灯触发指令
 *
 * @param {HTMLIFrameElement} frame     - 目标 iframe
 * @param {string} elementId            - 被聚焦元素的 id
 */
function sendSpotlight(frame, elementId) {
  try {
    frame.contentWindow.postMessage({ type: 'spotlight', elementId: elementId }, '*');
  } catch (e) {}
}

/**
 * sendSpotlightClear — 通知 iframe 清除当前聚光灯
 *
 * @param {HTMLIFrameElement} frame - 目标 iframe
 */
function sendSpotlightClear(frame) {
  try {
    frame.contentWindow.postMessage({ type: 'spotlightClear' }, '*');
  } catch (e) {}
}

/* ═══════════════════════════════════════════════════════
   AUDIO — 音频播放控制
   ═══════════════════════════════════════════════════════ */

/**
 * loadAudio — 加载并播放指定音频文件
 *
 * @param {string} src  - 音频文件路径
 * @param {object} slide - 当前 slide 配置对象
 *
 * 音频事件处理：
 *   onloadedmetadata — 音频加载完成：记录时长，显示时间，开始播放
 *   ontimeupdate      — 播放中：更新进度条
 *   onended           — 播放结束：触发 onAudioEnded 判断后续行为
 *   onerror           — 加载失败：回退到 5 秒自动切换
 */
function loadAudio(src, slide) {
  stopTimer();    // 停止计时器（音频驱动不需要 interval 计时器）
  audioEl.pause(); // 先暂停当前音频
  audioEl.src = src;
  audioEl.load(); // 重新加载

  audioEl.onloadedmetadata = function() {
    console.log('loadedmetadata 触发，duration:', audioEl.duration);
    audioDuration = audioEl.duration; // 保存总时长
    timerTotal    = audioDuration * 1000; // 以音频时长作为总时长
    progressTimeEl.textContent = '0:00 / ' + formatTime(audioDuration);
    // 不在这里 play()，由 click handler 中的 playing=true 时调用
  };

  audioEl.ontimeupdate = function() {
    updateProgressUI(audioEl.currentTime);
    startSpotlightRaf(); // 检查聚光灯时间点
    checkAssistantSubtitles(audioEl.currentTime);
  };

  audioEl.onended = function() {
    updateProgressUI(audioDuration);
    onAudioEnded(slide); // 音频播完，判断后续行为
  };

  audioEl.onerror = function(e) {
    // 音频加载失败：不自动切换，等待用户手动
    audioDuration = 0;
    timerTotal = 0;
    console.warn('音频加载失败:', audioEl.src, audioEl.error);
  };
}

/**
 * clearAudio — 停止并清空当前音频
 * 在切换页面时调用，避免音频继续播放
 */
function clearAudio() {
  audioEl.pause();
  audioEl.src = '';
  audioEl.onloadedmetadata = null;
  audioEl.ontimeupdate = null;
  audioEl.onended = null;
  audioEl.onerror = null;
  audioDuration = 0;
}

/**
 * updateProgressUI — 更新进度条和播放时间显示
 *
 * @param {number} currentTime - 当前播放时间（秒）
 */
function updateProgressUI(currentTime) {
  var dur = audioEl.duration;
  if (dur && isFinite(dur)) {
    audioDuration = dur;
    var pct = (currentTime / dur) * 100;
    progressFill.style.width = pct + '%';
    progressTimeEl.textContent = formatTime(currentTime) + ' / ' + formatTime(dur);
  } else {
    progressTimeEl.textContent = formatTime(currentTime) + ' / --:--';
  }
}

/**
 * formatTime — 将秒数格式化为 m:ss
 *
 * @param {number} secs - 秒数
 * @returns {string} 格式化的字符串，如 "1:05"
 */
function formatTime(secs) {
  if (isNaN(secs) || !isFinite(secs) || secs < 0) return '00:00';
  var m = Math.floor(secs / 60);
  var s = Math.floor(secs % 60);
  return m + ':' + (s < 10 ? '0' + s : s);
}

/* ═══════════════════════════════════════════════════════
   CONTROL BAR — 控制栏状态同步
   ═══════════════════════════════════════════════════════ */

/**
 * updateControlBarState — 根据当前页类型和播放状态更新控制栏按钮
 * 仅 content 页面：播放/暂停、重播可用
 * exercise/display 页面：所有按钮可用，播放/暂停和重播灰显
 */
function updateControlBarState() {
  var slide = course.slides[current];
  var isContentOrVideo = (slide.type === 'content' || slide.type === 'video');

  // 播放/暂停
  btnPlayPause.textContent = playing ? '⏸' : '▶';
  btnPlayPause.classList.toggle('disabled', !isContentOrVideo);

  // 重播
  btnReplay.classList.toggle('disabled', !isContentOrVideo);
}

/* ═══════════════════════════════════════════════════════
   AUDIO ENDED — 音频播完后的决策
   ═══════════════════════════════════════════════════════ */

/**
 * onAudioEnded — 音频自然播完或加载失败后的统一处理入口
 *
 * 决策逻辑：
 *   - content 类型 → 直接自动切换到下一页
 *   - exercise 类型：
 *       - legacy（有 question 字段）：显示确认按钮，等学生手动确认
 *       - 新型（有 questions 数组）：iframe 自己管理，player.js 不做任何事
 */
function onAudioEnded(slide) {
  if (slide.type === 'exercise') {
    if (slide.questions) {
      // 新型 exercise：iframe 自己管理音频和流程，忽略
      return;
    }
    // legacy exercise：音频播完，显示确认按钮
    exerciseReady = true;
    confirmOverlay.classList.add('visible');
    statusIndicator.className = 'status-indicator waiting';
    statusText.textContent = '请确认答案';
    playing = false;
  } else {
    // 内容页：音频播完，自动进入下一页
    goToSlide((current + 1) % course.slides.length);
  }
}

/* ═══════════════════════════════════════════════════════
   CONFIRM BUTTON — 练习题确认按钮
   ═══════════════════════════════════════════════════════ */

/**
 * confirmBtn —"确认答案"按钮
 *
 * 只有 exerciseReady === true 时（学生已完成作答）才响应
 * 点击后隐藏确认按钮，切换到下一页
 */
confirmBtn.addEventListener('click', function() {
  if (!exerciseReady) return; // 未作答时按钮不可用
  exerciseReady = false;
  confirmOverlay.classList.remove('visible');
  goToSlide((current + 1) % course.slides.length);
});

/* ═══════════════════════════════════════════════════════
   PLAYER CLICK — 点击播放器暂停/恢复
   ═══════════════════════════════════════════════════════ */

/**
 * player 点击区域 — 首次点击启动播放，之后点击暂停/恢复
 *
 * 注意：点击圆点（e.target.classList.contains('dot')）和
 *       点击确认按钮（e.target === confirmBtn）由各自独立处理
 */
var started = false; // 是否已完成首次启动

// 统一遮罩点击（start / resume / pause 合一）
pauseScreen.addEventListener('click', function() {
  var slide = course.slides[current];

  if (!started) {
    // 首次启动：开始播放
    started = true;
    pauseScreen.style.opacity = '0';
    pauseScreen.style.pointerEvents = 'none';
    setTimeout(function() { pauseScreen.style.display = 'none'; }, 400);
    playing = true;
    statusIndicator.className = 'status-indicator';
    statusText.textContent = '播放中';
    updateControlBarState();
    if (slide.audio) {
      audioEl.play().catch(function() {});
      startSpotlightRaf();
    } else {
      startTimer();
    }
  } else if (playing) {
    // 播放中：暂停
    if (slide.type === 'exercise' || slide.type === 'display' || slide.type === 'video') return;
    pauseAudio();
  } else {
    // 已暂停：恢复
    if (slide.type === 'exercise' || slide.type === 'display' || slide.type === 'video') return;
    resumeAudio();
  }
});

// 点击 clickInterceptor（暂停/恢复，已启动时）
var clickInterceptor = document.getElementById('clickInterceptor');
clickInterceptor.addEventListener('click', function(e) {
  if (e.target.classList.contains('dot')) return;
  if (e.target === confirmBtn) return;
  if (!started) return; // 忽略
  var slide = course.slides[current];
  if (slide.type === 'exercise' || slide.type === 'display' || slide.type === 'video') return; // 练习/生词/视频页不响应暂停
  if (playing) pauseAudio(); else resumeAudio();
});

/**
 * pauseAudio — 暂停播放
 *   - 停止音频
 *   - 停止计时器
 *   - 状态指示变红
 */
function pauseAudio() {
  playing = false;
  audioEl.pause();
  cancelAnimationFrame(spotlightRafId);
  stopTimer();
  // 隐藏确认按钮，避免被暂停遮罩盖住
  confirmOverlay.style.pointerEvents = 'none';
  // 显示暂停遮罩
  pauseScreen.style.display = 'flex';
  setTimeout(function() { pauseScreen.style.opacity = '1'; }, 10);
  statusIndicator.className = 'status-indicator paused';
  statusText.textContent = '已暂停';
  updateControlBarState();
}

/**
 * resumeAudio — 恢复播放
 *
 * 注意：exercise 类型恢复后不重新播音频（因为 exercise 音频已播完），
 *       只是让状态变回"等待确认"
 */
function resumeAudio() {
  var slide = course.slides[current];

  // exercise / display / video 类型不支持暂停/恢复
  if (slide.type === 'exercise' || slide.type === 'display' || slide.type === 'video') {
    pauseScreen.style.display = 'none';
    return;
  }

  // 隐藏暂停遮罩
  pauseScreen.style.opacity = '0';
  setTimeout(function() { pauseScreen.style.display = 'none'; }, 300);

  playing = true;
  if (slide.audio) {
    audioEl.play().catch(function() {});
    startSpotlightRaf();
  } else {
    startTimer();
  }
  statusIndicator.className = 'status-indicator';
  statusText.textContent = '播放中';
  updateControlBarState();
}

/* ═══════════════════════════════════════════════════════
   CONTROL BAR — 控制栏按钮事件
   ═══════════════════════════════════════════════════════ */

btnPrev.addEventListener('click', function() { goToSlide(current - 1); });
btnNext.addEventListener('click', function() { goToSlide(current + 1); });

btnPlayPause.addEventListener('click', function() {
  var slide = course.slides[current];
  if (slide.type !== 'content' && slide.type !== 'video') return;
  if (playing) pauseAudio(); else resumeAudio();
});

btnReplay.addEventListener('click', function() {
  var slide = course.slides[current];
  if (slide.type !== 'content' && slide.type !== 'video') return;
  if (!slide.audio) return;
  spotlightFired = {};
  audioEl.currentTime = 0;
  if (!playing) resumeAudio();
  audioEl.play().catch(function() {});
  startSpotlightRaf();
});

/* ═══════════════════════════════════════════════════════
   KEYBOARD — 键盘快捷键
   ═══════════════════════════════════════════════════════ */

/**
 * 键盘快捷键：
 *   → / ↓       — 下一页
 *   ← / ↑       — 上一页
 *   Space（空格）— 暂停/恢复
 */
document.addEventListener('keydown', function(e) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    goToSlide(current + 1);
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    goToSlide(current - 1);
  } else if (e.key === ' ') {
    e.preventDefault(); // 阻止页面滚动
    if (course.slides[current].type === 'exercise') return;
    if (playing) pauseAudio(); else resumeAudio();
  }
});

/* ═══════════════════════════════════════════════════════
   POSTMESSAGE — 接收来自 iframe 的消息（子 → 父）
   ═══════════════════════════════════════════════════════ */

/**
 * 监听来自 slide iframe 的 postMessage
 *
 * 支持的 action：
 *   - exerciseDone：legacy 题型（course.json 无 questions 数组）学生作答完毕
 *     → 显示确认按钮，等学生点确认
 *   - exerciseComplete：新型题型（listen/read/arrange/match/trace）全部完成
 *     → 直接翻页
 *   - displayComplete：display 类型（vocab）学完翻页
 *     → 直接翻页
 *   - exerciseNextQuestion：多题内部切换（更新状态即可）
 */
window.addEventListener('message', function(e) {
  var msg = e.data;
  if (!msg || msg.type !== 'playerMessage') return;

  if (msg.action === 'exerciseComplete') {
    // 新型单题型全部完成：显示确认按钮，等学生点确认翻页
    confirmOverlay.classList.remove('visible');
    confirmOverlay.style.pointerEvents = '';
    exerciseReady = true;
    statusIndicator.className = 'status-indicator waiting';
    statusText.textContent = '完成！请确认答案';
    playing = false;
    updateControlBarState();

  } else if (msg.action === 'exerciseAllComplete') {
    // 多题型全部完成：显示确认按钮，等学生点确认翻页
    confirmOverlay.classList.remove('visible');
    confirmOverlay.style.pointerEvents = '';
    exerciseReady = true;
    statusIndicator.className = 'status-indicator waiting';
    statusText.textContent = '完成！请确认答案';
    playing = false;
    updateControlBarState();

  } else if (msg.action === 'displayComplete') {
    // display 类型直接翻页
    goToSlide((current + 1) % course.slides.length);

  } else if (msg.action === 'exerciseDone') {
    // legacy 题型：显示确认按钮，等学生点确认
    exerciseReady = true;
    confirmOverlay.classList.add('visible');
    statusIndicator.className = 'status-indicator waiting';
    statusText.textContent = '请确认答案';
    updateControlBarState();

  } else if (msg.action === 'exerciseNextQuestion') {
    statusIndicator.className = 'status-indicator';
    statusText.textContent = '进行中';
  }
});

/* ═══════════════════════════════════════════════════════
   START — 启动播放器
   ═══════════════════════════════════════════════════════ */
playing = false; // 默认暂停，等待用户首次点击后开始
init();          // 执行初始化
