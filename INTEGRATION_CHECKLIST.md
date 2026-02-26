# Phase Board + To-Do List Integration Checklist

## ✅ Implementation Complete

All components, hooks, and API endpoints are ready for integration.

## Pre-Integration Setup

### 1. Install Dependencies
```bash
cd /Users/vincent/.openclaw/workspace/vessel_mission_control
npm install
```

This adds:
- `socket.io@^4.7.2` — WebSocket library (ready for future use)
- `socket.io-client@^4.7.2` — Client-side WebSocket

### 2. Verify File Structure
Check that these files exist:

```
✅ src/components/PhaseBoard.tsx                    (16KB)
✅ src/components/EnhancedTodoList.tsx              (15KB)
✅ src/hooks/useTaskSync.ts                         (2.5KB)
✅ src/app/api/clients/[slug]/phase-board/route.ts  (updated)
✅ src/app/api/clients/[slug]/todos/route.ts        (3KB - NEW)
✅ src/app/api/clients/[slug]/todos/[id]/route.ts   (3KB - NEW)
✅ src/app/api/sync/ws/route.ts                     (2.7KB - NEW)
✅ PHASE_TODO_SYNC_GUIDE.md                         (comprehensive guide)
✅ INTEGRATION_CHECKLIST.md                         (this file)
```

## Integration Steps

### Step 1: Update Client Page Component
**File**: `src/app/(dashboard)/clients/[slug]/page.tsx`

Find the section where tabs are rendered (search for "phase-board" or "Project Management").

**Add imports at the top**:
```tsx
import { PhaseBoard } from '@/components/PhaseBoard';
import { EnhancedTodoList } from '@/components/EnhancedTodoList';
```

**Add Phase Board tab** (if not already present):
```tsx
{
  id: 'phase-board',
  label: 'Project Management',
}
```

**In the tab content section**, add:
```tsx
{activeTab === 'phase-board' && (
  <div className="space-y-4">
    <PhaseBoard clientSlug={slug} />
  </div>
)}
```

**Add To-Do List tab** (create new or update existing):
```tsx
{
  id: 'todos',
  label: 'Working Tasks',
}
```

**In the tab content section**, add:
```tsx
{activeTab === 'todos' && (
  <div className="space-y-4">
    <EnhancedTodoList clientSlug={slug} />
  </div>
)}
```

### Step 2: Verify Data Files
When you first load a client page:
- Phase Board automatically seeds with defaults if `PHASE_BOARD.json` doesn't exist
- To-Do List creates `TODO_LIST.json` on first POST to `/api/clients/[slug]/todos`

**Expected file locations**:
```
clients/
└── [client-slug]/
    ├── PHASE_BOARD.json      (auto-created if missing)
    ├── TODO_LIST.json        (created on first use)
    ├── CLIENT_INFO.json
    ├── VALUE_LADDER.json
    └── ... (other files)
```

### Step 3: Build and Test
```bash
# From the project root
npm run build

# If successful, start dev server
npm run dev
```

### Step 4: Test in Browser
1. **Navigate to**: `http://localhost:3000/clients/[client-slug]`
2. **Click "Project Management" tab** → Phase Board loads
3. **Click "Working Tasks" tab** → To-Do List loads

### Step 5: Test Features

#### Phase Board
- [ ] Click assign button → modal opens
- [ ] Select "Bobby" → badge shows "B"
- [ ] Click priority selector → select "High" → 🔴 appears
- [ ] Click "By Status" toggle → view switches to columns
- [ ] Drag task between columns → task moves
- [ ] Complete task → greyed out + strikethrough

#### To-Do List
- [ ] View shows "Swimlanes" → 3 lanes (Bobby, Sarah, Client)
- [ ] Click "Kanban" toggle → 3 tabs × 4 columns
- [ ] Click "Bobby" tab → shows only Bobby's tasks
- [ ] Drag task between columns → status updates
- [ ] Click trash icon → task deleted from To-Do
- [ ] Click "Sort by Priority" → tasks reorder

#### Real-Time Sync
- [ ] Open two browser windows with same client
- [ ] Assign task in Phase Board (window 1)
- [ ] Wait 3 seconds → task appears in To-Do (window 2)
- [ ] Drag task in Kanban (window 2)
- [ ] Watch status update in Phase Board (window 1)

## Troubleshooting

### Issue: "Cannot find module" errors
**Solution**: Run `npm install` again
```bash
cd /Users/vincent/.openclaw/workspace/vessel_mission_control
npm install --legacy-peer-deps
```

### Issue: Phase Board shows "No phase board found"
**Solution**: Check client slug is correct in URL
- URL should be: `/clients/[slug]` where `[slug]` matches a folder in `clients/`
- Example: `/clients/lindsay-little`

### Issue: To-Do List shows empty after creation
**Solution**: 
1. Create a task from old To-Do UI if it exists
2. Or manually create `TODO_LIST.json` in client folder:
```json
{
  "tasks": []
}
```

### Issue: Sync not working between windows
**Solution**:
1. Check browser console for errors
2. Verify client slug is the same in both windows
3. Hard refresh (Cmd+Shift+R) to clear cache
4. Check that `/api/sync/ws` endpoint is accessible

### Issue: WebSocket error (expected for now)
**Solution**: This is normal — we use polling fallback. Errors are caught gracefully.
- Real WebSocket server will be added in future
- Current system works fine with 3-second polling

## API Testing

### Test Phase Board API
```bash
# Get Phase Board
curl http://localhost:3000/api/clients/lindsay-little/phase-board

# Update Phase Board (requires full board JSON body)
curl -X PUT http://localhost:3000/api/clients/lindsay-little/phase-board \
  -H "Content-Type: application/json" \
  -d '{...full board data...}'
```

### Test To-Do API
```bash
# Get To-Do tasks
curl http://localhost:3000/api/clients/lindsay-little/todos

# Create To-Do task
curl -X POST http://localhost:3000/api/clients/lindsay-little/todos \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Test Task",
    "assignee": "bobby",
    "priority": "high",
    "status": "assigned"
  }'

# Update task status
curl -X PATCH http://localhost:3000/api/clients/lindsay-little/todos/[task-id] \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'

# Delete task
curl -X DELETE http://localhost:3000/api/clients/lindsay-little/todos/[task-id]
```

### Test Sync API
```bash
# Emit sync event
curl -X POST http://localhost:3000/api/sync/ws \
  -H "Content-Type: application/json" \
  -d '{
    "event": "task_assigned",
    "clientSlug": "lindsay-little",
    "taskId": "p1-ccsp",
    "data": {"assignee": "bobby"},
    "timestamp": "'$(date -Iseconds)'"
  }'
```

## Documentation

- **`PHASE_TODO_SYNC_GUIDE.md`** — Complete feature documentation + API reference
- **`INTEGRATION_CHECKLIST.md`** — This file
- **Component code comments** — Inline documentation in `.tsx` files

## Performance Notes

### Polling vs WebSocket
- **Current**: Polling every 3 seconds (fallback)
- **Future**: True WebSocket for sub-second updates
- **Impact**: Minimal — polling is efficient for this use case

### Data Storage
- **Format**: JSON files (simple, human-readable)
- **Future**: Consider SQLite migration for large datasets
- **Current performance**: Suitable for 100+ tasks per client

### Component Size
- **PhaseBoard.tsx**: 16KB (with styles + logic)
- **EnhancedTodoList.tsx**: 15KB
- **useTaskSync.ts**: 2.5KB
- **Total**: ~33KB new code

## Rollback Plan

If issues arise:

1. **Revert components**: Delete PhaseBoard.tsx and EnhancedTodoList.tsx
2. **Revert hooks**: Delete useTaskSync.ts
3. **Revert APIs**: Delete `/api/clients/[slug]/todos/` directory
4. **Revert package.json**: Remove socket.io and socket.io-client
5. **Run**: `npm install` to restore original state

## Next: Production Upgrades

Once integrated and tested, consider:

1. **WebSocket Server** — Replace polling with true Socket.io
2. **Database** — Move from JSON to SQLite/PostgreSQL
3. **Notifications** — Toast alerts for incoming changes
4. **Offline Support** — Queue sync events, sync when online
5. **Comments** — Thread discussions on tasks
6. **Time Tracking** — Log hours per task
7. **Analytics** — Burndown, cycle time, velocity charts

## Questions?

Refer to:
- **PHASE_TODO_SYNC_GUIDE.md** — Full implementation details
- **Component code comments** — Inline explanations
- **API endpoint comments** — Route-level documentation

---

**Status**: ✅ Ready for integration and testing
**Created**: February 25, 2026
**Component**: Phase Board + To-Do List Real-Time Sync System
