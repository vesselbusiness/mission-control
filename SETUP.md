# Vessel Mission Control — Setup Guide

Complete setup instructions for running Mission Control on your system.

---

## Prerequisites

Before starting, ensure you have:

- **Node.js** 18.x or 20.x ([download](https://nodejs.org/))
- **npm** 9.0+ (comes with Node.js)
- **OpenClaw** installed and running ([setup guide](https://github.com/openclaw/openclaw))
- **Git** for cloning the repository

### Check Your Environment

```bash
node --version    # Should be v18.0.0 or higher
npm --version     # Should be 9.0.0 or higher
```

---

## Installation Steps

### 1. Clone the Repository

```bash
# Option A: HTTPS
git clone https://github.com/your-username/vessel-mission-control.git
cd vessel-mission-control

# Option B: SSH
git clone git@github.com:your-username/vessel-mission-control.git
cd vessel-mission-control
```

### 2. Install Dependencies

```bash
npm install
```

This installs all required packages. You'll see something like:

```
added 520 packages in 6s
```

### 3. Create Environment File

```bash
# Copy the example environment file
cp .env.example .env.local
```

### 4. Configure Environment Variables

Open `.env.local` and customize these values:

#### Authentication

```bash
# Set a strong admin password (at least 12 characters)
ADMIN_PASSWORD=your-super-secret-password-12-chars-min

# Generate a random 32-character secret for sessions
# On macOS/Linux: openssl rand -hex 16
AUTH_SECRET=paste-your-32-char-random-string-here
```

#### OpenClaw Paths (Required)

Adjust these to match your system:

**macOS:**
```bash
OPENCLAW_DIR=/Users/your-username/.openclaw
OPENCLAW_WORKSPACE=/Users/your-username/.openclaw/workspace
```

**Linux:**
```bash
OPENCLAW_DIR=/home/your-username/.openclaw
OPENCLAW_WORKSPACE=/home/your-username/.openclaw/workspace
```

**Windows (with WSL):**
```bash
OPENCLAW_DIR=/home/your-username/.openclaw
OPENCLAW_WORKSPACE=/home/your-username/.openclaw/workspace
```

#### Remote OpenClaw Gateway (Optional)

If using a remote OpenClaw instance instead of local:

```bash
OPENCLAW_GATEWAY_URL=http://openclaw-gateway.example.com:8080
OPENCLAW_API_TOKEN=your-api-token-from-openclaw-admin
```

#### Branding (Optional - Vessel defaults provided)

```bash
NEXT_PUBLIC_AGENT_NAME=Your Agent Name
NEXT_PUBLIC_AGENT_EMOJI=🎯
NEXT_PUBLIC_COMPANY_NAME=Your Company Name
NEXT_PUBLIC_APP_TITLE=Your Dashboard Title
NEXT_PUBLIC_OWNER_EMAIL=you@company.com
```

### 5. Verify Installation

```bash
# Run the build to check for any issues
npm run build

# You should see:
# ✓ Compiled successfully in 2.2s
```

If the build succeeds, you're ready to run!

---

## Running Locally

### Development Server (with Hot Reload)

```bash
npm run dev
```

You'll see:

```
  ▲ Next.js 16.1.6
  - Local:        http://localhost:3000
  - Environments: .env.local

✓ Ready in 1.2s
```

**Open in browser:** http://localhost:3000

**Login:** Use the `ADMIN_PASSWORD` you set in `.env.local`

### Production Server

```bash
# Build optimized bundle
npm run build

# Start production server
npm start
```

Open http://localhost:3000

---

## Troubleshooting

### "Cannot find module" Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### OpenClaw Connection Issues

Check that your `OPENCLAW_DIR` path is correct:

```bash
# Verify the directory exists
ls -la $OPENCLAW_DIR

# You should see:
# .config, .git, workspace, ...
```

If the path is wrong, update `.env.local`:

```bash
# Find your OpenClaw directory
find ~/ -maxdepth 2 -type d -name ".openclaw"

# Then update .env.local with the correct path
```

### "Port 3000 already in use"

If port 3000 is already in use, specify a different port:

```bash
npm run dev -- -p 3001
```

Then open http://localhost:3001

### TypeScript Errors

If you see TypeScript errors during build:

```bash
# Make sure you're using Node 18+
node --version

# If older, update Node.js first
# https://nodejs.org/

# Then clear and reinstall
rm -rf node_modules
npm install
npm run build
```

### Cannot Access Dashboard

1. Check your `ADMIN_PASSWORD` in `.env.local`
2. Try logging out and logging back in
3. Clear browser cookies (Settings → Privacy)
4. Try a different browser or incognito mode

---

## Docker Setup (Optional)

If you prefer Docker:

### 1. Build Docker Image

```bash
docker build -t vessel-mission-control .
```

### 2. Create Environment File

```bash
cp .env.example .env.docker
# Edit .env.docker with your settings
```

### 3. Run Container

```bash
docker run -p 3000:3000 \
  --env-file .env.docker \
  -v /Users/your-username/.openclaw:/home/user/.openclaw \
  vessel-mission-control
```

**For Linux, adjust the volume path:**

```bash
docker run -p 3000:3000 \
  --env-file .env.docker \
  -v /home/your-username/.openclaw:/home/user/.openclaw \
  vessel-mission-control
```

---

## Verification Checklist

Before considering your setup complete:

- [ ] Node.js version is 18.0.0 or higher
- [ ] `npm install` completed without errors
- [ ] `.env.local` file exists and is configured
- [ ] OpenClaw directory paths are correct
- [ ] `npm run build` completes successfully
- [ ] `npm run dev` starts without errors
- [ ] Dashboard loads at http://localhost:3000
- [ ] Admin login works with your password
- [ ] Agent status shows in dashboard (if agents are running)

---

## Next Steps

Once setup is complete:

1. **Explore the Dashboard** — Review available features
2. **Monitor Agents** — Check agent status and activity
3. **Review Costs** — View token usage and API costs
4. **Customize Branding** — Update colors, logos, titles to match your brand
5. **Deploy to Production** — See DEPLOYMENT.md for Vercel, self-hosted, or Docker options

---

## Common Tasks

### Change Admin Password

Edit `.env.local`:

```bash
ADMIN_PASSWORD=your-new-strong-password
```

Restart the server:

```bash
# Press Ctrl+C to stop
# Then restart
npm run dev
```

### Update OpenClaw Path

If you move your OpenClaw directory:

```bash
# Update in .env.local
OPENCLAW_DIR=/new/path/to/.openclaw
OPENCLAW_WORKSPACE=/new/path/to/.openclaw/workspace

# Restart server
```

### Customize Theme Colors

Edit `src/app/globals.css`:

```css
:root {
  --accent: #D4922F;        /* Change this color */
  --text-primary: #1A2332;  /* And this */
  /* ... more colors */
}
```

Then restart: `npm run dev`

### Add New Dashboard Page

1. Create a new file: `src/app/(dashboard)/my-page/page.tsx`
2. Add navigation link in `src/components/Sidebar.tsx`
3. Restart development server

---

## Performance Tips

### Development Server is Slow?

Enable Turbopack for faster builds (Next.js 16):

Already enabled by default — you're good!

### Dashboard Loads Slowly?

1. Check browser DevTools (F12) → Network tab
2. Look for slow API calls
3. Verify OpenClaw is responsive:
   ```bash
   curl http://localhost:8080/api/health
   ```

### High Memory Usage?

Restart the development server:

```bash
# Press Ctrl+C
npm run dev
```

---

## Getting Help

### Debug Mode

See verbose logs:

```bash
# Set debug environment variable
DEBUG=* npm run dev
```

### Check Logs

```bash
# View database
sqlite3 data/activities.db ".tables"

# View recent activities
sqlite3 data/activities.db "SELECT * FROM activities ORDER BY timestamp DESC LIMIT 10;"
```

### Verify Network Connectivity

```bash
# Check OpenClaw is accessible
curl http://localhost:8080/api/health

# Should return: {"status":"ok"}
```

---

## Security Reminders

1. **Never commit `.env.local`** — It contains passwords!
2. **Use strong passwords** — At least 12 random characters
3. **Rotate API tokens** — If using remote OpenClaw gateway
4. **Keep dependencies updated** — Run `npm audit` regularly
5. **Use HTTPS in production** — Essential for security

---

## Next Document

For deployment to production, see **DEPLOYMENT.md**

---

**Ready? Start with:** `npm install && cp .env.example .env.local && npm run dev`
