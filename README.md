# HYPE/USDT Grid Engine

Automated grid trading system with paper trading, trend detection, and live Bybit integration.

---

## What This Does

```
Price ranging sideways  →  Grid active, profits from every bounce
Price trending up/down  →  Grid pauses, system monitors
Range restores          →  Grid auto-resumes at new price center
Price exits grid range  →  Grid auto-rebalances to new center
```

---

## Quick Start

### 1. Database (Neon)
```bash
# Go to neon.tech → create project → copy connection string
cd backend
cp .env.example .env
# Fill in DATABASE_URL
npm install
npm run migrate
```

### 2. Start Backend (Paper Mode)
```bash
cd backend
PAPER_TRADING=true npm start
# or: npm run paper
```

### 3. Start Frontend
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

### 4. Start the Grid
- Open dashboard → Grid tab
- Set Capital, Levels, Leverage
- Click **▶ Start Grid**
- Watch fills come in on Overview tab

---

## TradingView Setup

1. Open TradingView → New Chart
2. Set symbol to `BYBIT:HYPEUSDT.P` (perpetual)
3. Set timeframe to `5m`
4. Pine Script Editor → paste `tradingview/HYPE_Grid_Strategy.pine`
5. Click **Add to chart**
6. Go to **Strategy Tester** tab → see backtest results

**What to look for:**
- Net profit positive
- Win rate > 50%
- Max drawdown < 20%
- Profit factor > 1.3

**Tune parameters if needed:**
- Wider grid range → fewer rebalances, less profit per bounce
- More levels → smaller profit per fill but more fills
- ADX threshold → controls how sensitive trend detection is

---

## Configuration

### `backend/.env`

```
PAPER_TRADING=true          # ALWAYS start with true

BYBIT_API_KEY=              # From Bybit → API Management
BYBIT_SECRET=               # Needs Derivatives Read + Trade perms
BYBIT_TESTNET=false         # true = use testnet

DATABASE_URL=               # Neon PostgreSQL connection string
API_SECRET=                 # Any random string for dashboard auth

TELEGRAM_BOT_TOKEN=         # Optional: @BotFather
TELEGRAM_CHAT_ID=           # Optional: your chat ID

SYMBOL=HYPEUSDT
GRID_CAPITAL=4000
GRID_LEVELS=20
LEVERAGE=5
PORT=3001
```

### `frontend/.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_API_KEY=your_api_secret
```

---

## How Grid Levels Work

```
$22.00  ──── SELL ────  (fills when price rises here)
$21.50  ──── SELL ────
$21.00  ──── SELL ────
$20.75  ──── ● CURRENT PRICE
$20.50  ──── BUY  ────  (fills when price drops here)
$20.00  ──── BUY  ────
$19.50  ──── BUY  ────

When BUY fills at $20.50:
  → Counter SELL placed at $21.00
  → Profit = $21.00 - $20.50 = $0.50 per unit
```

---

## API Endpoints

All require header `x-api-key: YOUR_API_SECRET`

| Method | Path | Description |
|---|---|---|
| GET | `/api/state` | Full engine state |
| GET | `/api/status` | API/WS health |
| POST | `/api/grid/start` | Start grid |
| POST | `/api/grid/stop` | Stop grid |
| POST | `/api/grid/pause` | Pause (keeps config) |
| POST | `/api/grid/resume` | Resume |
| POST | `/api/grid/rebuild` | Rebuild at current price |
| GET/PUT | `/api/config` | Grid config |
| GET | `/api/trades` | Fill history |
| GET | `/api/trades/stats` | PnL stats |
| GET | `/api/market` | Current market analysis |
| GET | `/api/paper/state` | Paper account state |
| POST | `/api/paper/reset` | Reset paper balance |

---

## Going Live (After Paper Testing)

1. Test paper mode for at least **2 weeks**
2. Verify consistent daily PnL
3. Set `PAPER_TRADING=false` in `.env`
4. Start with small capital first ($500)
5. Monitor for 48 hours
6. Scale up gradually

---

## Deployment (VPS)

```bash
# Install PM2
npm install -g pm2

# Backend
cd backend
pm2 start src/index.js --name hype-grid
pm2 save

# Frontend (build)
cd frontend
npm run build
pm2 start npm --name hype-grid-ui -- start
```

---

## ⚠️ Risk Warning

This system trades real money in live mode. Always:
- Test paper mode first
- Start small
- Set appropriate stop loss
- Monitor daily
- Never invest more than you can afford to lose
