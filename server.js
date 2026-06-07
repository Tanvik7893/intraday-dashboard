const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

http.createServer((req, res) => {
  // Serve backtest.html if requested, otherwise index.html
  const url = req.url.split('?')[0];
  const allowed = ['/backtest.html'];
  const filePath = allowed.includes(url)
    ? path.join(__dirname, url.slice(1))
    : path.join(__dirname, 'index.html');

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Frame-Options': 'SAMEORIGIN',
    });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`Intraday dashboard running on port ${PORT}`);
});
