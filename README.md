# Intraday Dashboard — Railway Deployment

## Files in this package
- `index.html` — Full dashboard (5 pages: Brief, Scores, Log, History, Perf)
- `server.js` — Lightweight Node.js server
- `package.json` — Node config
- `railway.toml` — Railway deployment config

## One-time setup after deploy
1. Open `index.html` in a text editor
2. Find: `CONFIGURE_N8N_API_KEY`
3. Replace with your n8n API key
4. Re-upload OR update via GitHub

## n8n Workflows (already live)
- WF1: 0OQRBaPb6YSki8ob — Morning Brief (8:45 AM)
- WF2: dKVxelavUNGOZxQy — EOD Report (3:35 PM)
- WF3: u4ljRx3wHvgIve4S — Trade Logger (webhook)

## WhatsApp (RML)
- Open WF1, WF2, WF3 in n8n
- Find "Send via RML WhatsApp API" node
- Replace `PASTE_YOUR_RML_JWT_TOKEN_HERE` with your JWT
