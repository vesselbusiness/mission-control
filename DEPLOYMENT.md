# Vessel Mission Control — Deployment Guide

Production deployment strategies for Mission Control.

---

## Overview

Three main deployment options:

1. **Vercel** (Recommended) — Serverless, auto-scaling, free tier available
2. **Self-Hosted** — Full control, Linux server required
3. **Docker** — Containerized, portable across platforms

Choose based on your infrastructure preferences.

---

## Option 1: Vercel Deployment ⭐ Recommended

Easiest path to production. Vercel auto-handles scaling, SSL, CI/CD.

### Prerequisites

- GitHub/GitLab/Bitbucket account with your repository
- [Vercel account](https://vercel.com/) (free tier available)

### Step-by-Step

#### 1. Push Code to Git Repository

```bash
cd vessel-mission-control

# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit: Vessel Mission Control"

# Add remote and push
git remote add origin https://github.com/your-username/vessel-mission-control.git
git branch -M main
git push -u origin main
```

#### 2. Import Project on Vercel

1. Go to [vercel.com](https://vercel.com/)
2. Click **"New Project"**
3. Select your repository (GitHub/GitLab/Bitbucket)
4. Click **"Import"**

#### 3. Set Environment Variables

In Vercel dashboard:

1. Go to your project → **Settings** → **Environment Variables**
2. Add these variables:

```
ADMIN_PASSWORD                 = your-strong-password
AUTH_SECRET                    = your-32-char-secret
OPENCLAW_DIR                   = /path/to/.openclaw
OPENCLAW_WORKSPACE            = /path/to/.openclaw/workspace
NEXT_PUBLIC_AGENT_NAME        = Vessel Command
NEXT_PUBLIC_AGENT_EMOJI       = ⛵
NEXT_PUBLIC_COMPANY_NAME      = VESSEL BUSINESS
NEXT_PUBLIC_APP_TITLE         = Vessel Mission Control
```

> **Note:** Production environment variables can differ from development. You can set different values per environment (Production, Preview, Development).

#### 4. Deploy

Click **"Deploy"** in Vercel dashboard. Build takes 2-3 minutes.

Once complete, you get a public URL like: `vessel-mission-control-abc123.vercel.app`

#### 5. Custom Domain (Optional)

In Vercel dashboard → **Settings** → **Domains**:

```
1. Enter your domain (e.g., mission.vessel.business)
2. Update DNS records as shown in Vercel
3. SSL certificate auto-provisioned
```

### Auto-Deployments

After initial setup, Vercel auto-deploys on every `git push`:

```bash
# Make code changes locally
# Commit and push
git add .
git commit -m "Update theme colors"
git push origin main

# Vercel auto-builds and deploys (watch in dashboard)
```

### Monitoring

In Vercel dashboard:

- **Deployments** — View build logs, rollback if needed
- **Analytics** — Page performance, response times
- **Environment** — Manage secrets and variables
- **Logs** — Real-time server logs

### Pros & Cons

✅ **Pros:**
- Serverless (no server management)
- Auto-scaling
- Free tier (great for dev/testing)
- Free SSL, CDN included
- Automatic deployments
- 99.9% uptime SLA (pro plan)

❌ **Cons:**
- Limited to Vercel platform
- Some startup latency on cold boot
- Filesystem ephemeral (data lost on restart)

> **Note:** For persistent data (SQLite databases), use Vercel KV or external database.

---

## Option 2: Self-Hosted (Linux/macOS)

Full control over your infrastructure. Requires managing your own server.

### Prerequisites

- Linux server (Ubuntu 22.04+ recommended)
- Node.js 20.x installed
- Domain name with DNS access
- SSL certificate (Let's Encrypt free)
- Reverse proxy (nginx recommended)
- Process manager (PM2)

### Step-by-Step

#### 1. SSH into Server

```bash
ssh user@your-server.com

# Update system
sudo apt update && sudo apt upgrade -y
```

#### 2. Install Node.js

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # v20.x.x
npm --version   # 10.x.x
```

#### 3. Clone Repository

```bash
# Clone into /opt or /home/user/apps
cd /opt
sudo git clone https://github.com/your-username/vessel-mission-control.git
cd vessel-mission-control
sudo chown -R $USER:$USER .
```

#### 4. Install Dependencies & Build

```bash
npm install
npm run build

# Verify build succeeded
ls -la .next/  # Should exist
```

#### 5. Create Environment File

```bash
cp .env.example .env.production

# Edit with production values
nano .env.production
```

Configure:

```bash
ADMIN_PASSWORD=your-strong-prod-password
AUTH_SECRET=your-32-char-secret
OPENCLAW_DIR=/home/user/.openclaw
OPENCLAW_WORKSPACE=/home/user/.openclaw/workspace
NODE_ENV=production
```

#### 6. Install PM2 (Process Manager)

```bash
sudo npm install -g pm2

# Start the app
pm2 start npm --name "mission-control" -- start

# View status
pm2 status

# Save PM2 config to auto-start on reboot
pm2 startup
pm2 save
```

#### 7. Setup Nginx Reverse Proxy

```bash
sudo apt install -y nginx

# Create nginx config
sudo nano /etc/nginx/sites-available/mission-control
```

Paste this configuration:

```nginx
upstream mission_control {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name mission.vessel.business;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mission.vessel.business;

    # SSL Certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/mission.vessel.business/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mission.vessel.business/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Proxy to Node.js
    location / {
        proxy_pass http://mission_control;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/mission-control /etc/nginx/sites-enabled/
sudo nginx -t  # Test config
sudo systemctl restart nginx
```

#### 8. Setup SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --nginx -d mission.vessel.business

# Auto-renewal (already enabled by default)
sudo systemctl status certbot.timer
```

#### 9. Verify Deployment

```bash
# Check processes
pm2 status

# Check nginx
sudo systemctl status nginx

# Test URL
curl https://mission.vessel.business

# View logs
pm2 logs mission-control
```

### Monitoring & Maintenance

```bash
# View real-time logs
pm2 monit

# Restart app
pm2 restart mission-control

# Update code
cd /opt/vessel-mission-control
git pull origin main
npm install
npm run build
pm2 restart mission-control

# Check disk usage
du -sh .
```

### Backup & Recovery

```bash
# Backup database
cp data/activities.db /backup/activities-$(date +%Y%m%d).db

# Backup environment
cp .env.production /backup/.env.production-$(date +%Y%m%d)

# Setup cron for automated backups
crontab -e

# Add line:
# 0 2 * * * cp /opt/vessel-mission-control/data/activities.db /backup/activities-$(date +\%Y\%m\%d).db
```

### Pros & Cons

✅ **Pros:**
- Full control
- No vendor lock-in
- Persistent data
- Flexible configuration

❌ **Cons:**
- Server management required
- SSL certificate renewal
- Security patching
- Monitoring & backups

---

## Option 3: Docker Deployment

Containerized deployment for consistency across environments.

### Prerequisites

- Docker installed ([install guide](https://docs.docker.com/get-docker/))
- Docker Hub account (for image registry, optional)

### Step-by-Step

#### 1. Create Dockerfile

File is already included: `Dockerfile`

Verify it exists and inspect:

```bash
cat Dockerfile
```

Should contain:

```dockerfile
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

#### 2. Build Docker Image

```bash
# Build image
docker build -t vessel-mission-control:latest .

# Verify
docker images | grep vessel

# You should see:
# vessel-mission-control    latest    abc123def456    2 minutes ago    250MB
```

#### 3. Create Environment File

```bash
cp .env.example .env.docker

# Edit with production values
nano .env.docker
```

#### 4. Run Container

```bash
docker run -d \
  --name mission-control \
  -p 3000:3000 \
  --env-file .env.docker \
  -v /home/user/.openclaw:/home/user/.openclaw \
  -v mission-control-data:/app/data \
  --restart unless-stopped \
  vessel-mission-control:latest

# Verify it's running
docker ps

# View logs
docker logs -f mission-control

# Open browser
# http://localhost:3000
```

#### 5. Setup with Docker Compose (Recommended)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  mission-control:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: mission-control
    ports:
      - "3000:3000"
    environment:
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - AUTH_SECRET=${AUTH_SECRET}
      - OPENCLAW_DIR=/openclaw
      - OPENCLAW_WORKSPACE=/openclaw/workspace
      - NODE_ENV=production
    volumes:
      - /home/user/.openclaw:/openclaw
      - mission-control-data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  mission-control-data:
```

Run with Docker Compose:

```bash
docker-compose up -d

# View logs
docker-compose logs -f mission-control

# Stop
docker-compose down
```

#### 6. Push to Docker Registry (Optional)

For deployment on multiple servers:

```bash
# Login to Docker Hub
docker login

# Tag image
docker tag vessel-mission-control:latest username/vessel-mission-control:latest

# Push
docker push username/vessel-mission-control:latest

# On another server, pull and run
docker run -d \
  --name mission-control \
  -p 3000:3000 \
  --env-file .env.docker \
  -v openclaw:/home/user/.openclaw \
  username/vessel-mission-control:latest
```

#### 7. Setup Reverse Proxy (Nginx)

Same as self-hosted option (see above).

### Common Docker Commands

```bash
# View running containers
docker ps

# Stop container
docker stop mission-control

# Restart container
docker restart mission-control

# View logs
docker logs mission-control

# Execute command inside container
docker exec -it mission-control npm run build

# Remove container
docker rm mission-control

# Update image and redeploy
docker pull vessel-mission-control:latest
docker stop mission-control
docker run -d --name mission-control ...
```

### Pros & Cons

✅ **Pros:**
- Consistent across dev/prod
- Easy to scale
- Simple rollback
- Environment isolation

❌ **Cons:**
- Docker learning curve
- Image size (~250MB)
- Requires Docker infrastructure

---

## Comparison Table

| Feature | Vercel | Self-Hosted | Docker |
|---------|--------|-------------|--------|
| **Ease** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Cost** | Free tier → $20/mo | ~$5-50/mo | ~$5-50/mo |
| **Scaling** | Automatic | Manual | Requires orchestration |
| **SSL/HTTPS** | Free | Free (Let's Encrypt) | Manual |
| **Control** | Limited | Full | Full |
| **Data Persistence** | Limited | Full | Full |
| **Monitoring** | Built-in | Manual | Manual |

---

## Post-Deployment Checklist

- [ ] Application loads and responds
- [ ] Admin login works
- [ ] OpenClaw connection successful
- [ ] Agents status visible
- [ ] Costs tracking displayed
- [ ] SSL certificate valid
- [ ] Automatic backups configured
- [ ] Monitoring/alerts setup
- [ ] Domain DNS configured
- [ ] Performance acceptable (< 2s load time)

---

## Monitoring & Alerting

### Vercel

Built-in analytics and error tracking.

### Self-Hosted & Docker

Setup monitoring:

```bash
# Install monitoring tools
sudo apt install htop iotop

# Monitor in real-time
htop

# Check service status
pm2 status

# Or use external service like Uptime Robot
# https://uptimerobot.com
```

### Health Check Endpoint

Both options include health check:

```bash
curl https://your-domain.com/api/health

# Returns: {"status":"ok"}
```

Setup monitoring to ping this endpoint regularly.

---

## Scaling

### Vercel

Auto-scales automatically. No action needed.

### Self-Hosted

For high traffic, add load balancer:

```nginx
upstream mission_control_servers {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

server {
    location / {
        proxy_pass http://mission_control_servers;
        proxy_set_header Host $host;
    }
}
```

Run multiple PM2 instances:

```bash
pm2 start npm --name "mc1" -- start --port 3000
pm2 start npm --name "mc2" -- start --port 3001
pm2 start npm --name "mc3" -- start --port 3002
```

### Docker

Use Docker Compose with multiple replicas:

```yaml
services:
  mission-control:
    deploy:
      replicas: 3
```

Or use Kubernetes for production orchestration.

---

## Troubleshooting

### Application Won't Start

```bash
# Check logs
pm2 logs mission-control

# Check Node.js version
node --version  # Must be 18+

# Check dependencies
npm list

# Rebuild
npm install
npm run build
```

### High CPU Usage

Check what's consuming CPU:

```bash
pm2 monit
top
```

Restart if needed:

```bash
pm2 restart mission-control
```

### Out of Disk Space

```bash
df -h

# Clear old logs
pm2 flush

# Remove old deployments (if self-hosted)
rm -rf .next
npm run build
```

### OpenClaw Connection Fails

```bash
# Check OPENCLAW_DIR path
echo $OPENCLAW_DIR
ls -la $OPENCLAW_DIR

# Check file permissions
stat data/activities.db
```

---

## Next Steps

After deployment:

1. **Monitor Performance** — Check response times, error rates
2. **Customize UI** — Update colors, branding for production
3. **Setup Backups** — Regular database backups
4. **Security Hardening** — SSH keys, firewall rules
5. **Team Access** — Add additional admin users if needed

---

## Recommended Next: Monitor in Production

See **MONITORING.md** for production monitoring setup.

---

**Questions? Check the troubleshooting sections or open a GitHub issue.**
