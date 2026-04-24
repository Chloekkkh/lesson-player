#!/usr/bin/env node
/**
 * batch-convert-images.js — 将 originals 文件夹中的图片批量转换为 HTML slide
 *
 * 用法:
 *   node tools/batch-convert-images.js <course-id>
 *
 * 示例:
 *   node tools/batch-convert-images.js lesson-thanks
 *
 * 图片支持: PNG / JPG / JPEG / GIF / WebP
 * 转换后保存到 originals/ 目录下（HTML 与图片同名）
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      args[key] = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')
        ? argv[++i] : true;
    } else {
      args._ = args._ || [];
      args._.push(a);
    }
  }
  return args;
}

function buildSlideHTML(courseId, filename, imagePath) {
  // 文件名（不含扩展名）作为页面标题
  const title = path.basename(filename, path.extname(filename));
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="/css/shared.css">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%; height: 100%;
      background: #f9fbff;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
    }
    .slide {
      width: 1200px;
      height: 675px;
      border-radius: 26px;
      box-shadow: 0 28px 60px rgba(32,55,102,0.08);
      overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      background: #fff;
    }
    .slide img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  </style>
</head>
<body>
  <div class="slide">
    <img src="${imagePath}" alt="${title}">
  </div>

  <script src="/js/spotlight.js"></script>
  <script>
    Spotlight.init({
      dimness: 0.75,
      borderWidth: 0.5,
      borderColor: 'rgba(255,255,255,0.8)',
      container: document.body,
    });

    window.addEventListener('message', function(e) {
      var msg = e.data;
      if (!msg) return;

      if (msg.type === 'spotlight') {
        Spotlight.spotlight(msg.elementId);
      }
      if (msg.type === 'spotlightClear') {
        Spotlight.clear();
      }
      if (msg.type === 'assistantSubtitle') {
        var el = document.getElementById('assistantSubtitle');
        if (el) el.textContent = msg.text;
      }
    });
  </script>
</body>
</html>`;
}

function main() {
  const args     = parseArgs(process.argv);
  const [courseId] = args._ || [];

  if (!courseId) {
    console.error('用法: node tools/batch-convert-images.js <course-id>');
    process.exit(1);
  }

  const originalsDir = path.join(ROOT, 'courses', courseId, 'pptimg');

  if (!fs.existsSync(originalsDir)) {
    console.error(`错误: pptimg 目录不存在: ${originalsDir}`);
    process.exit(1);
  }

  const SUPPORTED_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  const files = fs.readdirSync(originalsDir).filter(f =>
    SUPPORTED_EXT.includes(path.extname(f).toLowerCase())
  );

  if (files.length === 0) {
    console.log('未找到图片文件（支持: PNG/JPG/GIF/WebP）');
    return;
  }

  // 按文件名排序（保证顺序一致）
  files.sort();

  files.forEach(file => {
    const imagePath = './' + file; // 相对路径，HTML 在 originals/ 内，图片同目录
    const htmlPath  = path.join(originalsDir, path.basename(file, path.extname(file)) + '.html');
    const html      = buildSlideHTML(courseId, file, imagePath);
    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log(`✓ ${file} → ${path.basename(htmlPath)}`);
  });

  console.log(`\n共转换 ${files.length} 个文件`);
}

main();
