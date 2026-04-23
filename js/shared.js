/* ============================================================
   shared.js — 播放器与 slide 页面共享工具函数
   被 player.html 和 exercise 类型 slide HTML 引用
   ============================================================ */

'use strict';

/* ── postMessage 封装 ─────────────────────────────────────── */

/**
 * 向父窗口（player）发送消息
 * 在 slide iframe 内调用
 */
function postToParent(action, payload) {
  try {
    window.parent.postMessage({ type: 'playerMessage', action, payload }, '*');
  } catch (e) {
    // cross-origin 无操作
  }
}

/**
 * 监听来自 player 的消息（slide 页面使用）
 * @param {string} type - 消息类型（如 'slideData'）
 * @param {Function} callback
 */
function onPlayerMessage(type, callback) {
  window.addEventListener('message', function handler(e) {
    var msg = e.data;
    if (msg && msg.type === type) {
      callback(msg.data, msg);
    }
  });
}

/* ── 音频时间格式化 ────────────────────────────────────────── */

/**
 * 秒数 → m:ss 格式
 * @param {number} secs
 * @returns {string}
 */
function formatTime(secs) {
  if (isNaN(secs) || secs < 0) return '0:00';
  var m = Math.floor(secs / 60);
  var s = Math.floor(secs % 60);
  return m + ':' + (s < 10 ? '0' + s : s);
}

/* ── iframe 等比缩放 ──────────────────────────────────────── */

/**
 * 对单个 iframe 进行等比缩放，使其适配容器
 * @param {HTMLIFrameElement} frame - 要缩放的 iframe
 * @param {HTMLElement} container - 容器元素
 * @param {number} naturalW - iframe 原始宽度（默认 1200）
 * @param {number} naturalH - iframe 原始高度（默认 675）
 */
function applyTransform(frame, container, naturalW, naturalH) {
  naturalW = naturalW || 1200;
  naturalH = naturalH || 675;
  var scaleX = container.offsetWidth  / naturalW;
  var scaleY = container.offsetHeight / naturalH;
  var scale  = Math.min(scaleX, scaleY);
  var scaledW = naturalW * scale;
  var scaledH = naturalH * scale;
  var offsetX = (container.offsetWidth  - scaledW) / 2;
  var offsetY = (container.offsetHeight - scaledH) / 2;
  frame.style.transform =
    'translate(' + offsetX + 'px,' + offsetY + 'px) scale(' + scale + ')';
  frame.style.transformOrigin = 'top left';
}
