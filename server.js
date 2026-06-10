const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const N8N_BASE = 'n8n.srv1631602.hstgr.cloud';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlNTM3ZDI5MS1mY2EzLTRmZTctOWNjZS04MjdhMjRkYjY4OWEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTA0NTJjMzctZDk2Yi00M2MwLWFmYmEtMWEwOTY4NDM2ZGRiIiwiaWF0IjoxNzgwODMxMTYwfQ.AEBc3DSFmcr944PBsMZjnSra-XnuXA1T9AOvg3NwVng';
const TOKEN_TABLE_ID = 'EEA42hEpo8qqU5yS';
const TELEGRAM_TOKEN = '8856908311:AAH6mq-Tvs7mNsHQsDf6S70bz5LNq4ORtYA';
const TELEGRAM_CHAT_ID = '542701742';

function getISTDateString() {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split('T')[0];
}

function httpsGet(hostname, path, headers) {
  return new Promise((resolve) => {
    const opts = { hostname, port: 443, path, method: 'GET', headers: { ...headers } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.end();
  });
}

function httpsPost(hostname, path, body, headers) {
  return new Promise((resolve) => {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const opts = {
      hostname, port: 443, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr), ...headers }
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.write(bodyStr);
    req.end();
  });
}

function httpsPatch(hostname, path, body, headers) {
  return new Promise((resolve) => {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const opts = {
      hostname, port: 443, path, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr), ...headers }
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.write(bodyStr);
    req.end();
  });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json' };

http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // ── Upstox Token Relay ─────────────────────────────────────────────────
  if (url === '/upstox-token' && req.method === 'POST') {
    let rawBody = '';
    req.on('data', chunk => { rawBody += chunk.toString(); });
    req.on('end', async () => {
      console.log('[Token Relay] Received:', rawBody.substring(0, 200));

      // Respond to Upstox immediately
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'received' }));

      let payload = {};
      try { payload = JSON.parse(rawBody); } catch(e) { console.error('Parse error:', e); return; }

      // FIX: Upstox sends accessToken (camelCase) not access_token
      const token = payload.accessToken || payload.access_token || payload.token || '';
      if (!token || token.length < 20) {
        console.error('[Token Relay] No valid token. Keys received:', Object.keys(payload).join(', '));
        // Send Telegram alert so we know it failed
        await httpsPost('api.telegram.org', `/bot${TELEGRAM_TOKEN}/sendMessage`,
          { chat_id: TELEGRAM_CHAT_ID, text: `⚠️ Upstox webhook hit but no token found.\nPayload keys: ${Object.keys(payload).join(', ')}\nRaw: ${rawBody.substring(0, 200)}` });
        return;
      }

      // FIX: Use IST date, not UTC date
      const today = getISTDateString();
      const expiresAt = new Date(Date.now() + 86400000).toISOString();

      try {
        // FIX: Check if today's token already exists — PATCH instead of POST (dedup)
        const existingResp = await httpsGet(
          N8N_BASE,
          `/api/v1/data-tables/${TOKEN_TABLE_ID}/rows?limit=20`,
          { 'X-N8N-API-KEY': N8N_API_KEY }
        );

        const rows = (existingResp.body && existingResp.body.data) ? existingResp.body.data : [];
        const todayRow = rows.find(r => r.token_date === today && r.access_token && r.access_token.length > 20);

        if (todayRow) {
          // Already have a valid token today — patch it with the new one
          const patchResult = await httpsPatch(
            N8N_BASE,
            `/api/v1/data-tables/${TOKEN_TABLE_ID}/rows/${todayRow.id}`,
            { access_token: token, expires_at: expiresAt, status: 'active' },
            { 'X-N8N-API-KEY': N8N_API_KEY }
          );
          console.log('[Token Relay] Patched existing row:', patchResult.status);
        } else {
          // Insert new row for today
          const insertResult = await httpsPost(
            N8N_BASE,
            `/api/v1/data-tables/${TOKEN_TABLE_ID}/rows`,
            { rows: [{ token_date: today, access_token: token, expires_at: expiresAt, status: 'active' }] },
            { 'X-N8N-API-KEY': N8N_API_KEY }
          );
          console.log('[Token Relay] Inserted new row:', insertResult.status);
        }

        // Telegram confirmation
        const timeIST = new Date(Date.now() + 5.5*60*60*1000).toISOString().replace('T',' ').substring(0,19) + ' IST';
        await httpsPost('api.telegram.org', `/bot${TELEGRAM_TOKEN}/sendMessage`,
          { chat_id: TELEGRAM_CHAT_ID, text: `✅ Upstox token saved for ${today}\n\nTime: ${timeIST}\nWF1 fires at 9:30 AM ✅\nPreview: ${token.substring(0, 25)}...` });

      } catch(e) {
        console.error('[Token Relay] DB error:', e.message);
      }
    });
    return;
  }

  // ── Health ─────────────────────────────────────────────────────────────
  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', relay: '/upstox-token', version: '2.0' }));
    return;
  }

  // ── Static files ───────────────────────────────────────────────────────
  const allowed = ['/backtest.html'];
  const filePath = allowed.includes(url) ? path.join(__dirname, url.slice(1)) : path.join(__dirname, 'index.html');
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Frame-Options': 'SAMEORIGIN' });
    res.end(data);
  });

}).listen(PORT, () => {
  console.log(`Dashboard on port ${PORT} | Token relay v2.0: POST /upstox-token`);
});
