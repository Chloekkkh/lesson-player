#!/usr/bin/env node
/**
 * new-course.js — 创建新课程脚手架
 *
 * 用法:
 *   node tools/new-course.js <course-id> --title "课程标题" [--desc "描述"]
 *
 * 示例:
 *   node tools/new-course.js lesson-daily --title "日常对话" --desc "HSK 日常用语"
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

function main() {
  const args = parseArgs(process.argv);
  const [courseId] = args._ || [];

  if (!courseId) {
    console.error('用法: node tools/new-course.js <course-id> --title "标题" [--desc "描述"]');
    process.exit(1);
  }

  const title = args.title || courseId;
  const desc  = args.desc  || '';
  const date  = new Date().toISOString().slice(0, 10);

  const courseDir   = path.join(ROOT, 'courses', courseId);
  const slidesDir   = path.join(courseDir, 'slides');
  const audioDir    = path.join(courseDir, 'audio');
  const originalsDir = path.join(courseDir, 'originals');

  if (fs.existsSync(courseDir)) {
    console.error(`错误: 课程 ${courseId} 已存在`);
    process.exit(1);
  }

  // Create directories
  fs.mkdirSync(slidesDir,   { recursive: true });
  fs.mkdirSync(audioDir,    { recursive: true });
  fs.mkdirSync(path.join(audioDir, 'narration'), { recursive: true });
  fs.mkdirSync(path.join(audioDir, 'vocab'),     { recursive: true });
  fs.mkdirSync(path.join(audioDir, 'exercise'),  { recursive: true });
  fs.mkdirSync(path.join(audioDir, 'video'),     { recursive: true });
  fs.mkdirSync(originalsDir, { recursive: true });

  // course.json
  const courseJson = {
    id:          courseId,
    title,
    description: desc,
    author:      '',
    created:     date,
    slides: [],
  };

  fs.writeFileSync(
    path.join(courseDir, 'course.json'),
    JSON.stringify(courseJson, null, 2), 'utf8'
  );

  // First slide template
  const slide1 = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - 第1页</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Microsoft YaHei UI","PingFang SC",sans-serif;
      background: #fff;
      display: flex; align-items: center; justify-content: center;
      height: 100vh; padding: 40px;
    }
    .slide {
      max-width: 800px; text-align: center;
    }
    h1 { font-size: 3rem; color: #2a3446; margin-bottom: 20px; }
    p  { font-size: 1.4rem; color: #4d586f; line-height: 1.8; }
  </style>
</head>
<body>
  <div class="slide">
    <h1>${title}</h1>
    <p>第 1 页内容</p>
  </div>

  <script>
    // 接收来自 player.html 的 postMessage 数据
    window.addEventListener('message', e => {
      const msg = e.data;
      if (msg && msg.type === 'slideData') {
        // 使用 msg.data 渲染内容
        console.log('slideData received:', msg.data);
      }
    });
  </script>
</body>
</html>
`;

  fs.writeFileSync(path.join(slidesDir, '1.html'), slide1, 'utf8');

  // Update course.json with first slide
  courseJson.slides.push({
    index: 1,
    type:  'content',
    title: '第 1 页',
    audio: '',
  });

  fs.writeFileSync(
    path.join(courseDir, 'course.json'),
    JSON.stringify(courseJson, null, 2), 'utf8'
  );

  console.log(`✓ 课程创建完成: ${courseId}`);
  console.log(`  目录: courses/${courseId}/`);
  console.log(`  访问: player.html?course=${courseId}`);
}

main();
