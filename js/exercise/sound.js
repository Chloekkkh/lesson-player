/* ============================================================
   sound.js — 音效系统
   被 exercise iframe 内所有类型模块共享
   ============================================================ */

'use strict';

var Sound = {
  _cache: {},

  /**
   * init — 预加载音效文件
   * @param {string} basePath  音效文件目录，默认 /audio/
   */
  init: function(basePath) {
    basePath = basePath || '/audio/system/';
    ['correct', 'wrong', 'complete'].forEach(function(name) {
      var audio = new Audio();
      audio.src = basePath + name + '.wav';
      audio.preload = 'auto';
      Sound._cache[name] = audio;
    });
  },

  /**
   * play — 播放指定音效
   * @param {string} name  'correct' | 'wrong' | 'complete'
   */
  play: function(name) {
    var audio = Sound._cache[name];
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(function() {});
  },

  /**
   * setVolume — 调整音量（0.0 ~ 1.0）
   */
  setVolume: function(name, vol) {
    var audio = Sound._cache[name];
    if (!audio) return;
    audio.volume = Math.max(0, Math.min(1, vol));
  }
};
