#!/usr/bin/env node
/**
 * serve.js — 本地开发服务器
 *
 * 用法:
 *   node tools/serve.js
 *   node tools/serve.js --port 8080
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { handleApi } = require('./author-api.js');

const ROOT   = path.resolve(__dirname, '..');
const PORT   = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || '3000');
const HOST   = 'localhost';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.mp3':  'audio/mpeg',
  '.mp4':  'video/mp4',
  '.wav':  'audio/wav',
  '.ogg':  'audio/ogg',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
};

function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  // Normalise URL, strip query string
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  // API route handler first
  if (urlPath.startsWith('/api/')) {
    const handled = handleApi(req, res, urlPath);
    if (handled !== false) return;
  }

  const filePath = path.join(ROOT, urlPath);

  // Security: stay within ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end(`Not Found: ${urlPath}`);
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
      return;
    }
    res.writeHead(200, {
      'Content-Type':  getMime(filePath),
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`HSK 课程播放器已启动`);
  console.log(`  课程列表: http://${HOST}:${PORT}/index.html`);
  console.log(`  课程制作: http://${HOST}:${PORT}/admin.html`);
  console.log(`  示例课程: http://${HOST}:${PORT}/player.html?course=lesson-thanks`);
  console.log();
  console.log(`按 Ctrl+C 停止服务器`);
});
