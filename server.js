const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// n8n webhook URL — Upstox token will be forwarded here
const N8N_TOKEN_WEBHOOK = 'https://n8n.srv1631602.hstgr.cloud/webhook/upstox-token-receiver';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

function forwardToN8N(body) {
  return new Promise((resolve) => {
    const url = new URL(N8N_TOKEN_WEBHOOK);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve({ ok: true, status: res.statusCode }));
    });
    req.on('error', (e) => {
      console.error('Forward to n8n failed:', e.message);
      resolve({ ok: false, error: e.message });
    });
    req.write(body);
    req.end();
  });
}

http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // ── Upstox Token Relay Endpoint ──────────────────────────────────────────────
  // Upstox POSTs the fresh access_token here after user taps Approve.
  // We forward it to n8n and respond with 200 so Upstox is satisfied.
  if (url === '/upstox-token' && req.method === 'POST') {
    let rawBody = '';
    req.on('data', chunk => { rawBody += chunk.toString(); });
    req.on('end', async () => {
      console.log('[Upstox Token Relay] Received payload:', rawBody.substring(0, 200));
      // Respond to Upstox immediately with 200 (required)
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'received' }));
      // Forward to n8n asynchronously
      const result = await forwardToN8N(rawBody);
      console.log('[Upstox Token Relay] Forwarded to n8n:', result);
    });
    return;
  }

  // ── Health check ─────────────────────────────────────────────────────────────
  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', upstoxRelay: '/upstox-token' }));
    return;
  }

  // ── Static file serving ───────────────────────────────────────────────────────
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
  console.log(`Upstox token relay ready at POST /upstox-token`);
});
