# Vessel Mission Control — Architecture Guide

Technical overview of Mission Control's architecture and how it integrates with OpenClaw.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser (React Frontend)                                         │
│ ├─ Dashboard                                                     │
│ ├─ Agent Monitor                                                 │
│ ├─ Cost Tracker                                                  │
│ ├─ Terminal                                                      │
│ └─ File Browser                                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP + WebSocket
┌──────────────────────────▼──────────────────────────────────────┐
│ Next.js Server (Node.js + TypeScript)                           │
│ ├─ API Routes                                                    │
│ │  ├─ /api/agents/* (Agent status)                             │
│ │  ├─ /api/costs/* (Cost tracking)                             │
│ │  ├─ /api/system/* (System metrics)                           │
│ │  ├─ /api/files/* (File operations)                           │
│ │  ├─ /api/terminal/* (Command execution)                      │
│ │  ├─ /api/memory/* (Knowledge base)                           │
│ │  ├─ /api/logs/* (Event logging)                              │
│ │  └─ /api/* (Other endpoints)                                 │
│ ├─ Database Layer (SQLite)                                      │
│ │  ├─ activities.db (Event log)                                │
│ │  └─ memory.db (Knowledge base)                               │
│ └─ OpenClaw Integration Layer                                   │
│    ├─ Local filesystem access                                   │
│    ├─ HTTP client for Gateway API                              │
│    └─ WebSocket for real-time updates                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
        ┌──────────────────┴───────────────────┐
        │                                      │
   Local OpenClaw              Remote OpenClaw Gateway
   ├─ ~/.openclaw/             ├─ Agent Status API
   │  ├─ workspace/            ├─ Cost Tracking API
   │  ├─ .config/              ├─ Terminal Execution
   │  └─ memory.db             └─ WebSocket Updates
   │
   └─ Agents (Running)
      ├─ Cody (Agent A)
      ├─ Main (Agent B)
      └─ Subagents...
```

---

## Data Flow

### 1. Dashboard Load (Page Initialization)

```
Browser Load Dashboard
        ↓
Server renders React page
        ↓
useEffect() triggers API calls
        ↓
Fetch /api/agents (Agent list)
Fetch /api/costs/summary (Cost data)
Fetch /api/system/stats (System info)
        ↓
Display components with data
        ↓
Setup WebSocket listeners for real-time updates
```

### 2. Agent Status Update (Real-time)

```
OpenClaw Agent executes task
        ↓
Agent logs activity
        ↓
Mission Control WebSocket listener detects change
        ↓
Server broadcasts update to all connected clients
        ↓
Browser receives update via WebSocket
        ↓
React re-renders with new status
```

### 3. Cost Tracking

```
OpenClaw API call (to Anthropic, etc.)
        ↓
OpenClaw logs cost (tokens × rate)
        ↓
OpenClaw writes to cost database
        ↓
Mission Control /api/costs polls database
        ↓
Calculates daily/monthly totals
        ↓
Displays in Cost Tracker dashboard
```

### 4. Terminal Command

```
User types command in Terminal UI
        ↓
Browser sends POST to /api/terminal
        ↓
Server executes command via OpenClaw CLI
        ↓
Captures STDOUT/STDERR
        ↓
Streams output back to browser in real-time
        ↓
User sees live output
```

### 5. File Operations

```
User browses /files in UI
        ↓
Browser requests /api/files?path=/some/path
        ↓
Server lists directory from OpenClaw workspace
        ↓
Returns file tree to browser
        ↓
User clicks to view file
        ↓
Server reads file content
        ↓
Browser displays with syntax highlighting
```

---

## Component Structure

### Page Routes (`src/app/(dashboard)`)

Each page corresponds to a feature:

```
(dashboard)/
├── page.tsx              → Dashboard home
├── agents/page.tsx       → Agent monitoring
├── costs/page.tsx        → Cost tracking
├── activity/page.tsx     → Activity feed
├── logs/page.tsx         → Live logs
├── terminal/page.tsx     → Command terminal
├── files/page.tsx        → File browser
├── memory/page.tsx       → Knowledge base search
├── system/page.tsx       → System metrics
├── git/page.tsx          → Git status
├── cron/page.tsx         → Scheduled jobs
├── sessions/page.tsx     → Agent sessions
├── skills/page.tsx       → Skill browser
├── workflows/page.tsx    → Workflow manager
├── analytics/page.tsx    → Analytics
├── reports/page.tsx      → Reports
├── settings/page.tsx     → Settings
├── search/page.tsx       → Global search
└── about/page.tsx        → About page
```

### API Routes (`src/app/api`)

API endpoints for data operations:

```
api/
├── agents/               → Agent status
├── activities/           → Activity events
├── costs/                → Cost tracking
├── system/               → System monitoring
├── files/                → File operations
├── terminal/             → Command execution
├── memory/               → Knowledge base
├── logs/                 → Event logs
├── sessions/             → Session tracking
├── skills/               → Skill info
├── git/                  → Git operations
├── cron/                 → Cron job management
├── search/               → Global search
├── auth/                 → Authentication
└── health/               → Health checks
```

### Components (`src/components`)

Reusable React components:

```
components/
├── Sidebar.tsx           → Navigation
├── Dashboard/            → Dashboard-specific
│   ├── StatsCard.tsx
│   ├── AgentList.tsx
│   └── ActivityFeed.tsx
├── Agent/
│   ├── AgentRow.tsx
│   ├── AgentStatus.tsx
│   └── AgentMetrics.tsx
├── FileTree.tsx          → File browser tree
├── Terminal.tsx          → Terminal UI
├── MarkdownEditor.tsx    → Editor component
├── Charts/               → Chart components
└── ... (more components)
```

### Configuration (`src/config`)

Application settings:

```
config/
├── branding.ts           → Colors, names, titles
└── (other config)
```

### Libraries & Utils (`src/lib`)

Business logic and utilities:

```
lib/
├── activities-db.ts      → Activity database
├── activity-logger.ts    → Event logging
├── usage-collector.ts    → Cost tracking
├── cron-parser.ts        → Cron scheduling
├── skill-parser.ts       → Skill parsing
└── (other utilities)
```

---

## API Specifications

### Agent Status

**GET /api/agents**

Returns list of agents with status.

```json
[
  {
    "id": "main",
    "name": "Main Agent",
    "emoji": "🤖",
    "status": "idle|running|error",
    "lastActivity": "2026-02-24T12:34:56Z",
    "cpuUsage": 2.5,
    "memoryUsage": 145600000,
    "tasksCompleted": 234,
    "tasksRunning": 2
  }
]
```

**GET /api/agents/[id]/status**

Returns detailed status for single agent.

```json
{
  "id": "main",
  "status": "running",
  "currentTask": "processing email",
  "progress": 45,
  "metrics": {
    "cpuPercent": 12,
    "memoryMB": 256,
    "uptime": 3600
  }
}
```

### Cost Data

**GET /api/costs/summary**

Returns cost overview.

```json
{
  "today": 0.45,
  "thisWeek": 2.15,
  "thisMonth": 8.32,
  "yearToDate": 45.67,
  "budget": 1000,
  "percentUsed": 4.56,
  "costByModel": {
    "claude-3-5-sonnet": 5.20,
    "claude-3-5-haiku": 3.12
  }
}
```

### Activities/Events

**GET /api/activities?limit=50&offset=0**

Returns recent activities.

```json
{
  "data": [
    {
      "id": "evt-123",
      "timestamp": "2026-02-24T12:34:56Z",
      "type": "message|command|file|search",
      "agent": "main",
      "message": "Description of activity",
      "metadata": {
        "model": "claude-3-5-haiku",
        "tokens": 1523,
        "cost": 0.0023
      }
    }
  ],
  "total": 1523,
  "hasMore": true
}
```

### System Stats

**GET /api/system/stats**

Returns system metrics.

```json
{
  "cpu": {
    "percent": 23.4,
    "cores": 8
  },
  "memory": {
    "used": 4823449600,
    "total": 16884901888,
    "percentUsed": 28.6
  },
  "disk": {
    "used": 102030000000,
    "total": 536870912000,
    "percentUsed": 19.0
  },
  "uptime": 86400
}
```

### Files

**GET /api/files?path=/some/path**

Lists files in directory.

```json
{
  "path": "/Users/user/.openclaw/workspace",
  "items": [
    {
      "name": "agents",
      "type": "directory",
      "size": 0,
      "modified": "2026-02-24T10:00:00Z"
    },
    {
      "name": "README.md",
      "type": "file",
      "size": 1234,
      "modified": "2026-02-24T10:00:00Z"
    }
  ]
}
```

### Terminal

**POST /api/terminal**

Execute command.

```json
{
  "command": "ls -la",
  "timeout": 30
}
```

Response (streaming):

```
total 48
drwxr-xr-x  12 user  staff    384 Feb 24 10:00 .
drwxr-xr-x  13 user  staff    416 Feb 24 09:00 ..
...
```

---

## Database Schema

### activities.db

```sql
CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL,     -- message, command, file, search, etc
  message TEXT NOT NULL,
  metadata JSON,          -- model, tokens, cost, etc
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_timestamp ON activities(timestamp DESC);
CREATE INDEX idx_agent ON activities(agent_id);
CREATE INDEX idx_type ON activities(type);
```

### memory.db

```sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,          -- person, event, task, etc
  embedding BLOB,         -- Vector embedding (future)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE knowledge_base (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## OpenClaw Integration Details

### Local File Access

Mission Control reads from OpenClaw's directory structure:

```
~/.openclaw/
├── workspace/           → User workspace files
│   ├── agents/
│   ├── projects/
│   ├── memory/
│   └── ...
├── .config/
│   └── openclaw.json    → Configuration
└── gateway.log          → Gateway logs
```

Node.js filesystem API (`fs` module) directly accesses these paths.

### HTTP API Integration

For remote OpenClaw Gateway:

```javascript
// src/lib/openclaw-client.ts
class OpenClawClient {
  async getAgentStatus(agentId) {
    return fetch(`${GATEWAY_URL}/api/agents/${agentId}/status`, {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    });
  }

  async executeCommand(cmd) {
    return fetch(`${GATEWAY_URL}/api/exec`, {
      method: 'POST',
      body: JSON.stringify({ command: cmd })
    });
  }
}
```

### WebSocket Real-time Updates

For live agent status:

```javascript
// Browser-side
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'agent_status') {
    updateAgentUI(data.agent);
  }
};
```

---

## Authentication & Security

### Session Management

1. User logs in with `ADMIN_PASSWORD`
2. Server creates JWT token
3. Token stored in secure HTTP-only cookie
4. Subsequent requests validated against token

```javascript
// Middleware: src/middleware.ts
export async function middleware(request) {
  const token = request.cookies.get('sessionToken');
  if (!token) {
    return redirect('/login');
  }
  // Verify token signature
  const verified = verifyJWT(token, AUTH_SECRET);
  if (!verified) {
    return redirect('/login');
  }
}
```

### Environment Secrets

Never hardcoded in code:

```
✅ GOOD:  ADMIN_PASSWORD=${process.env.ADMIN_PASSWORD}
❌ BAD:   ADMIN_PASSWORD="hardcoded-password"
```

---

## Performance Optimization

### Frontend

- **Code Splitting** — Pages loaded on-demand
- **Image Optimization** — Next.js Image component
- **Caching** — Browser cache headers, SWR for data
- **Lazy Loading** — Components loaded when needed

### Backend

- **Database Indexing** — Fast queries on timestamps, agent_id
- **Pagination** — Activities limited to recent 50
- **Compression** — Gzip response compression
- **Connection Pooling** — SQLite connection reuse

### Monitoring

Use Performance tab in browser DevTools:

```
DevTools → Performance → Record → Interact → Stop
```

Check for:
- Long tasks (> 50ms)
- Slow network requests
- Excessive re-renders

---

## Testing

### Unit Tests

```bash
# Create test file
src/__tests__/lib/activity-logger.test.ts

# Run tests
npm test
```

### Integration Tests

Test API endpoints:

```javascript
// src/__tests__/api/agents.test.ts
describe('GET /api/agents', () => {
  it('returns agent list', async () => {
    const res = await fetch('/api/agents');
    const data = await res.json();
    expect(data).toHaveLength(> 0);
  });
});
```

### E2E Tests (Future)

Use Playwright for full integration testing.

---

## Scalability

### Current Architecture

- Single Node.js process
- SQLite (single-file database)
- Scales to ~1000 agents before bottleneck

### For Larger Scale

1. **Database** → PostgreSQL (multi-user, ACID)
2. **Caching** → Redis (session, cost cache)
3. **Queue** → Bull/RabbitMQ (background jobs)
4. **Load Balancer** → Nginx upstream groups
5. **CDN** → Cloudflare, CloudFront (static assets)

```
[Load Balancer (Nginx)]
    ├─ Mission Control 1
    ├─ Mission Control 2
    └─ Mission Control 3
         ↓
   [PostgreSQL (replicated)]
         ↓
   [Redis (cache)]
         ↓
[OpenClaw Gateway Cluster]
```

---

## Deployment Architecture

### Vercel

```
GitHub Repo → Vercel → Edge Functions → Serverless Database
```

### Self-Hosted

```
Git Server → CI/CD → Build Server → Nginx (reverse proxy) → Node.js → SQLite
                        ↓
                    PM2 (process manager)
```

### Docker

```
Docker Registry → Docker Daemon → Container → Nginx → App → Database
```

---

## Future Enhancements

1. **Real-time Collaboration** — Multiple users on dashboard
2. **Agent Scheduling** — Calendar UI for agent tasks
3. **Custom Dashboards** — User-defined metrics
4. **Webhooks** — Integration with Slack, Discord
5. **Agent Analytics** — ML-based insights
6. **Multi-tenant** — Support multiple OpenClaw instances

---

## Troubleshooting by Layer

### Frontend (Browser Issues)

- Check DevTools Console for errors
- Verify API responses in Network tab
- Check localStorage for corrupted data

### Backend (Server Issues)

- Check PM2 logs: `pm2 logs`
- Check database: `sqlite3 data/activities.db ".tables"`
- Verify environment variables: `echo $OPENCLAW_DIR`

### OpenClaw Integration

- Check OpenClaw is running: `openclaw status`
- Verify paths: `ls -la $OPENCLAW_DIR`
- Test connectivity: `curl http://localhost:8080/api/health`

---

## References

- [Next.js Architecture](https://nextjs.org/docs/app/building-your-application/routing/colocation)
- [SQLite Best Practices](https://www.sqlite.org/bestpractice.html)
- [WebSocket Real-time Data](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

---

**Questions? Check the README or open an issue.**
