# Vessel Mission Control

**Mission Control for Vessel Business** — Navigate expert businesses to success with real-time agent monitoring, OpenClaw Gateway integration, and modern dashboard UI.

Built on [tenacitOS](https://github.com/carlosazaustre/tenacitOS), stripped of 3D visualization and customized for Vessel's warm, spacious, human-centered vibe.

![Vessel Mission Control](./docs/screenshot.png)

## Features

✨ **Core Features (Retained from tenacitOS)**

- **Dashboard** — Real-time agent activity, system stats, cost tracking
- **Agent Monitoring** — Live agent status, activity feed, performance metrics
- **Terminal Interface** — Execute commands, view logs, debug systems
- **File Browser** — Navigate and manage workspace files
- **Memory Management** — Search agent memory, view knowledge base
- **Cron Jobs** — Schedule and monitor background tasks
- **Analytics** — Activity heatmaps, success rates, hourly breakdown
- **Git Integration** — View repository status, recent commits
- **Workflow Management** — Monitor and trigger agent workflows
- **Cost Tracking** — Real-time API usage and token costs
- **Skills Browser** — Discover and manage agent skills
- **Live Logs** — Stream logs in real-time, filter by type
- **Session Management** — Track active agent sessions

🎨 **Design (Customized for Vessel)**

- Blue-grey primary with warm gold accents (#D4922F)
- Light, spacious UI with generous whitespace
- Clean typography with improved readability
- 4px spacing scale for consistent rhythm
- Soft, subtle shadows for depth
- Modern, human-centered aesthetic

🔌 **OpenClaw Integration**

- WebSocket connectivity to OpenClaw Gateway
- Real-time agent status updates
- Cost tracking from OpenClaw API
- Workspace file browsing
- Activity logging and monitoring

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (recommend 20+)
- **npm** 9+
- **OpenClaw** instance running locally or remotely

### Installation

```bash
# Clone or download the repository
git clone <your-repo-url> vessel-mission-control
cd vessel-mission-control

# Install dependencies
npm install

# Copy environment variables and customize
cp .env.example .env.local

# Configure OpenClaw paths (if different from defaults)
# Edit .env.local with your setup
```

### Environment Variables

**.env.local** — Essential configuration:

```bash
# Authentication
ADMIN_PASSWORD=your-strong-password-here
AUTH_SECRET=your-32-char-secret-key

# OpenClaw Gateway (optional if using local OpenClaw)
# OPENCLAW_GATEWAY_URL=http://localhost:8080
# OPENCLAW_API_TOKEN=your-token

# OpenClaw Paths (adjust to your system)
OPENCLAW_DIR=/Users/yourname/.openclaw
OPENCLAW_WORKSPACE=/Users/yourname/.openclaw/workspace

# Branding (Vessel defaults provided)
NEXT_PUBLIC_AGENT_NAME=Vessel Command
NEXT_PUBLIC_AGENT_EMOJI=⛵
NEXT_PUBLIC_COMPANY_NAME=VESSEL BUSINESS
NEXT_PUBLIC_APP_TITLE=Vessel Mission Control
```

### Development

```bash
# Start development server (hot reload)
npm run dev

# Open in browser
# → http://localhost:3000
```

### Production Build

```bash
# Build optimized production bundle
npm run build

# Start production server
npm start

# Or use Vercel for hosting (see Deployment below)
```

---

## 📁 Project Structure

```
vessel-mission-control/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (dashboard)/        # Main dashboard pages
│   │   │   ├── page.tsx        # Dashboard home
│   │   │   ├── agents/         # Agent monitoring
│   │   │   ├── activity/       # Activity feed
│   │   │   ├── costs/          # Cost tracking
│   │   │   ├── logs/           # Live logs
│   │   │   ├── terminal/       # Terminal interface
│   │   │   ├── files/          # File browser
│   │   │   └── [more pages]
│   │   ├── api/                # API routes
│   │   │   ├── agents/         # Agent status endpoints
│   │   │   ├── costs/          # Cost tracking API
│   │   │   ├── system/         # System monitoring
│   │   │   └── [more endpoints]
│   │   └── layout.tsx          # Root layout
│   │
│   ├── components/             # React components
│   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   ├── Dashboard/          # Dashboard components
│   │   ├── AgentMonitoring/    # Agent-specific
│   │   └── [shared components]
│   │
│   ├── config/
│   │   └── branding.ts         # Vessel branding (colors, names)
│   │
│   ├── lib/                    # Utilities
│   │   ├── usage-collector.ts  # Cost tracking
│   │   ├── activity-logger.ts  # Event logging
│   │   └── [helpers]
│   │
│   └── app/globals.css         # Global styles (Vessel theme)
│
├── public/
│   ├── manifest.json
│   ├── apple-touch-icon.png
│   └── [assets]
│
├── data/                       # SQLite databases
│   ├── activities.db           # Activity log
│   └── memory.db               # Knowledge base
│
├── .env.example                # Environment template
├── package.json                # Dependencies
├── tailwind.config.js          # Tailwind CSS
├── tsconfig.json               # TypeScript config
└── next.config.mjs             # Next.js config
```

---

## 🎨 Customization

### Colors & Theme

Edit **src/app/globals.css** to adjust the color scheme:

```css
:root {
  /* Primary - Blue-grey */
  --bg: #F8F9FB;
  --surface: #FFFFFF;
  
  /* Accent - Warm gold */
  --accent: #D4922F;
  --accent-hover: #E8A84D;
  
  /* Text */
  --text-primary: #1A2332;
  --text-secondary: #5A6B7F;
}
```

### Branding

Edit **src/config/branding.ts** to customize:

```typescript
export const BRANDING = {
  agentName: "Vessel Command",
  agentEmoji: "⛵",
  companyName: "VESSEL BUSINESS",
  appTitle: "Vessel Mission Control",
  // ... more options
};
```

Or use environment variables (**.env.local**):

```bash
NEXT_PUBLIC_AGENT_NAME=Your Agent Name
NEXT_PUBLIC_COMPANY_NAME=Your Company
```

---

## 🔌 OpenClaw Integration

Mission Control connects to your OpenClaw instance via HTTP/WebSocket APIs.

### How It Works

1. **Agent Status** — Polls `/api/agents/[id]/status` for real-time updates
2. **Cost Tracking** — Reads token usage from OpenClaw usage database
3. **Activity Logging** — Monitors agent actions, logs events
4. **Terminal Commands** — Executes commands via OpenClaw CLI
5. **File Browsing** — Accesses workspace filesystem

### Configuration

Update **.env.local**:

```bash
# Local OpenClaw (default)
OPENCLAW_DIR=/Users/username/.openclaw
OPENCLAW_WORKSPACE=/Users/username/.openclaw/workspace

# Remote OpenClaw Gateway
OPENCLAW_GATEWAY_URL=http://gateway.example.com:8080
OPENCLAW_API_TOKEN=your-secure-token
```

---

## 📦 Stack

- **Framework:** Next.js 16.1.6 (App Router, TypeScript)
- **Styling:** Tailwind CSS 4 + CSS Variables
- **Database:** SQLite (better-sqlite3) for local data
- **Editor:** Monaco Editor (VS Code-style)
- **Charts:** Recharts
- **UI Icons:** Lucide React
- **Runtime:** Node.js 18+

### Removed Dependencies

The following 3D/visualization packages have been removed from tenacitOS:

- ❌ `react-three-fiber` — 3D rendering
- ❌ `three` — 3D library
- ❌ `@react-three/drei` — 3D helpers
- ❌ `@react-three/rapier` — Physics engine

---

## 🚢 Deployment

### Vercel (Recommended)

Easiest path for serverless deployment:

```bash
# 1. Push code to GitHub (or GitLab, Bitbucket)
git push origin main

# 2. Connect repo to Vercel
# → vercel.com/new → Select your repo

# 3. Set Environment Variables in Vercel dashboard
ADMIN_PASSWORD=***
AUTH_SECRET=***
OPENCLAW_DIR=/path/to/.openclaw
OPENCLAW_WORKSPACE=/path/to/.openclaw/workspace

# 4. Deploy
# Vercel auto-deploys on git push
```

### Self-Hosted (Linux/macOS)

```bash
# 1. Clone repo on server
git clone <your-repo-url> mission-control
cd mission-control

# 2. Install and build
npm install
npm run build

# 3. Start with PM2 (process manager)
npm install -g pm2
pm2 start npm --name "mission-control" -- start

# 4. Setup reverse proxy (nginx)
# Configure nginx to forward requests to http://localhost:3000

# 5. Enable auto-start on reboot
pm2 startup
pm2 save
```

**Nginx Example:**

```nginx
server {
    listen 80;
    server_name mission.vessel.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Docker (Optional)

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t vessel-mission-control .
docker run -p 3000:3000 \
  -e ADMIN_PASSWORD=your-password \
  -e OPENCLAW_DIR=/home/user/.openclaw \
  -v /home/user/.openclaw:/home/user/.openclaw \
  vessel-mission-control
```

---

## 🏗️ Architecture

### Data Flow

```
[Vessel Agents (OpenClaw)]
         ↓
[OpenClaw Gateway / API]
         ↓
[Mission Control (Next.js)]
         ├→ Real-time Status (WebSocket)
         ├→ Cost Tracking (HTTP polling)
         ├→ File System (Node.js FS)
         └→ Database (SQLite)
         ↓
[Browser Dashboard (React)]
```

### Key Components

1. **Dashboard** (`src/app/(dashboard)/page.tsx`)
   - Agent status overview
   - Recent activity
   - System stats
   - Cost summary

2. **Agents Monitor** (`src/app/(dashboard)/agents/page.tsx`)
   - Real-time agent list
   - Individual agent status
   - Performance metrics

3. **Cost Tracker** (`src/app/(dashboard)/costs/page.tsx`)
   - Token usage over time
   - Cost breakdown by model/agent
   - Budget alerts

4. **Terminal** (`src/app/(dashboard)/terminal/page.tsx`)
   - Execute OpenClaw commands
   - Real-time output
   - History

5. **File Browser** (`src/app/(dashboard)/files/page.tsx`)
   - Navigate workspace
   - Create/delete files
   - Inline preview

---

## 🔐 Security

- **Admin Password** — Set strong password in `.env.local`
- **Auth Secret** — 32+ character random string for session tokens
- **Environment Variables** — Never commit `.env.local`
- **OpenClaw Integration** — Use API tokens for remote connections
- **No Secrets in Code** — All sensitive data via environment variables

### Recommended Security Practices

1. Use strong, unique `ADMIN_PASSWORD`
2. Generate cryptographically secure `AUTH_SECRET` (32+ chars)
3. Rotate API tokens regularly
4. Use HTTPS in production (Vercel/nginx with SSL)
5. Restrict network access to Mission Control (firewall)
6. Keep dependencies updated (`npm audit`, `npm update`)

---

## 📊 Cost Tracking

Mission Control monitors OpenClaw's token usage and costs:

- **Real-time Display** — Current costs, daily/monthly totals
- **Breakdown** — Costs by model (Haiku, Sonnet, etc.)
- **Agent Metrics** — Token usage per agent
- **Budget Alerts** — Warning at 75% of monthly budget

Powered by OpenClaw's built-in cost tracking.

---

## 🛠️ Development

### Running Locally

```bash
npm run dev

# → http://localhost:3000
# → Hot reload enabled
```

### Linting & Type Checking

```bash
npm run lint          # Run ESLint
```

TypeScript checks run automatically during build.

### Building for Production

```bash
npm run build         # Create optimized bundle
npm start             # Run production server
```

---

## 📝 License

This project is based on [tenacitOS](https://github.com/carlosazaustre/tenacitOS) and maintains the same license. See **LICENSE** file.

---

## 🔗 Resources

- **OpenClaw** — https://github.com/openclaw/openclaw
- **Next.js Docs** — https://nextjs.org/docs
- **Tailwind CSS** — https://tailwindcss.com
- **tenacitOS** — https://github.com/carlosazaustre/tenacitOS

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📧 Support

For issues, questions, or suggestions:

- **GitHub Issues** — Report bugs and request features
- **Discussions** — Ask questions, share ideas
- **Email** — hello@vessel.business

---

**Built with ⛵ for Vessel Business — Empowering experts to build legitimate online businesses.**
