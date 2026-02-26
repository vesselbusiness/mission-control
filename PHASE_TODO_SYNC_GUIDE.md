# Phase Board + To-Do List Real-Time Sync Implementation Guide

## Overview

This implementation provides a **bidirectional sync system** between Phase Board (source of truth) and To-Do List (working board) with real-time updates across multiple views.

## Architecture

### Data Model

#### Phase Board Tasks
- **Source of truth** for all project tasks
- Structure (enhanced):
  ```json
  {
    "id": "task-id",
    "label": "Task name",
    "completed": false,
    "completedAt": null,
    "assignee": "bobby|sarah|client|null",
    "priority": "low|mid|high|null",
    "status": "assigned|in_progress|review|completed",
    "linkedPhaseTaskId": "reference-id",
    "subtasks": []
  }
  ```
- **Immutable order** — Phase Board sequence never changes, even if tasks complete out of order
- **No deletions** — Tasks marked as completed, never removed
- **Stored in**: `clients/[slug]/PHASE_BOARD.json`

#### To-Do Tasks
- **Working copies** of Phase Board tasks
- Reference Phase Board via `linkedPhaseTaskId`
- Inherit assignment & priority from Phase Board
- Can be deleted from To-Do (doesn't affect Phase Board)
- **Stored in**: `clients/[slug]/TODO_LIST.json`

#### Unassigned Tasks
- Exist on Phase Board with a status but no assignee
- Do NOT appear in To-Do swimlanes or Kanban
- Only tracked by status on Phase Board
- Can be assigned later

### Client Scope
- All changes are scoped to the current client (e.g., Lindsay Little)
- Client swimlane only shows that client's tasks
- Each client has separate PHASE_BOARD.json and TODO_LIST.json

## Features

### 1. Phase Board Enhancements

#### Assign Task Button
- **Icon**: Person + arrow (minimal, icon-only)
- **Action**: Opens modal with 3 radio options (Bobby / Sarah / Client)
- **Badge**: Shows assignee initials in top-right corner (B, S, C)
- **Fallback**: Initials if no profile image available

#### Priority Levels
- **Options**: Low 🟢 / Mid 🟡 / High 🔴
- **Appearance**: Greyed out until selected
- **Location**: Phase Board only (not in assignment modal)
- **Inheritance**: To-Do tasks inherit priority from Phase Board

#### Status Columns Toggle
- **Toggle**: "All Tasks" vs. "By Status"
- **Columns** (when "By Status"):
  - Assigned
  - In Progress
  - Review
  - Completed
- **Drag-drop**: Tasks can move between columns out of order
- **Order independence**: Reordering status doesn't change Phase Board sequence

#### Phase Board Order Locked
- Phase Board displays tasks in the suggested order
- Order never changes, even if tasks complete out of sequence
- All tasks always visible (archive view)
- Completed tasks: grey background + light strikethrough

#### No Deletions
- Tasks never deleted from Phase Board
- Only marked as completed
- Completed tasks stay in the archive

### 2. To-Do List Enhancements

#### View A: Overall (All Tasks by Swimlane)
```
┌─ Bobby (3 tasks) ─────────────┐
│ • Task 1 (🟢)                 │
│ • Task 2 (🟡)                 │
│ • Task 3                       │
└───────────────────────────────┘

┌─ Sarah (2 tasks) ─────────────┐
│ • Task 4 (🔴)                 │
│ • Task 5                       │
└───────────────────────────────┘

┌─ Client (1 task) ─────────────┐
│ • Task 6                       │
└───────────────────────────────┘
```

- **Swimlanes**: Bobby / Sarah / Client
- **Expandable**: Each lane collapses/expands
- **Sorting**: Toggle by Phase Board order OR Priority
- **Priority inheritance**: Shows 🟢🟡🔴 from Phase Board

#### View B: Individual Kanban Tabs
```
Tabs: [Bobby] [Sarah] [Client]

┌─ Assigned ──┬─ In Progress ─┬─ Review ─────┬─ Completed ──┐
│             │               │              │              │
│ Task 1 (🟡) │ Task 2 (🟡)   │ Task 3       │ Task 4       │
│             │               │              │ (greyed out) │
│ Task 5      │               │              │              │
└─────────────┴───────────────┴──────────────┴──────────────┘
```

- **3 tabs**: Bobby / Sarah / Client
- **4 columns**: Assigned → In Progress → Review → Completed
- **Drag-drop**: Move tasks between columns
- **Status sync**: Column position updates status in Phase Board
- **Priority toggle**: Same as Overall view

#### Unassigned Tasks
- Can exist on Phase Board with a status
- **Never appear** in To-Do swimlanes or Kanban
- Only tracked by status on Phase Board
- Can be assigned later (will then appear in To-Do)

#### Deletions
- Tasks **can** be deleted from To-Do
- **Cannot** be deleted from Phase Board
- Deletion from To-Do doesn't affect Phase Board (stays as completed)

#### Drag-Drop & Status
- Moving task between Kanban columns updates its status
- Status changes sync back to Phase Board instantly
- Phase Board order remains unchanged

## Real-Time Sync (WebSocket)

### Bidirectional Events

```
Assignment Change (Phase Board → To-Do)
Task Assignment Modal → emit task_assigned → To-Do lane updates

Priority Change (Phase Board ↔ To-Do)
Phase Board priority selector → emit task_priority_changed → To-Do inherits

Status Change (Phase Board ↔ To-Do, Kanban drag-drop)
Kanban column drop → emit task_status_changed → Phase Board status updates
Phase Board status toggle → emit task_status_changed → To-Do Kanban updates

Deletion (To-Do only)
Delete button in To-Do → emit task_deleted → removed from To-Do, stays on Phase Board
```

### Sync Events

```typescript
type SyncEvent = 
  | 'task_assigned'        // Assignment change
  | 'task_priority_changed' // Priority change
  | 'task_status_changed'   // Status change
  | 'task_deleted';         // Task deleted from To-Do

interface SyncMessage {
  event: SyncEvent;
  clientSlug: string;
  taskId: string;
  data: Record<string, any>;
  timestamp: string;
}
```

### Implementation

**Endpoint**: `POST /api/sync/ws`

Sync events are emitted via POST (fallback to WebSocket when available).

**Connected pages auto-update** without refresh:
- Component A assigns task → event emitted
- Component B receives event via polling
- Component B re-fetches state → UI updates instantly

### Polling Fallback

When WebSocket isn't available:
- Components poll `useTaskSync` hook every 3 seconds
- Hook emits events via `/api/sync/ws` POST endpoint
- Listeners re-fetch data and update UI

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── clients/[slug]/
│   │   │   ├── phase-board/
│   │   │   │   └── route.ts          # GET/PUT Phase Board
│   │   │   └── todos/
│   │   │       ├── route.ts          # GET/POST To-Do tasks
│   │   │       └── [id]/
│   │   │           └── route.ts      # PATCH/DELETE individual tasks
│   │   └── sync/
│   │       └── ws/
│   │           └── route.ts          # Sync event hub (WebSocket fallback)
│   ├── (dashboard)/
│   │   └── clients/[slug]/
│   │       └── page.tsx              # Client workspace (includes Phase Board + To-Do tabs)
│   └── ...
├── components/
│   ├── PhaseBoard.tsx                # Enhanced Phase Board component
│   ├── EnhancedTodoList.tsx          # Enhanced To-Do List component
│   └── ...
├── hooks/
│   ├── useTaskSync.ts                # Real-time sync hook
│   └── ...
└── ...
```

## Usage in Client Page

```tsx
import { PhaseBoard } from '@/components/PhaseBoard';
import { EnhancedTodoList } from '@/components/EnhancedTodoList';

export default function ClientPage({ params }: { params: { slug: string } }) {
  return (
    <>
      {/* Phase Board Tab */}
      <PhaseBoard clientSlug={params.slug} />

      {/* To-Do List Tab */}
      <EnhancedTodoList clientSlug={params.slug} />
    </>
  );
}
```

## API Endpoints

### Phase Board

#### GET `/api/clients/[slug]/phase-board`
Fetch all phases and tasks with assignments, priorities, statuses.

**Response**:
```json
{
  "phases": [
    {
      "id": "phase-1",
      "label": "Phase 1 — Foundation",
      "tasks": [
        {
          "id": "p1-ccsp",
          "label": "Core Calling Super Prompt",
          "completed": false,
          "assignee": "bobby",
          "priority": "high",
          "status": "in_progress"
        }
      ]
    }
  ]
}
```

#### PUT `/api/clients/[slug]/phase-board`
Save updated Phase Board (assignments, priorities, statuses, completions).

**Body**: Full Phase Board data structure (same as GET response).

### To-Do Tasks

#### GET `/api/clients/[slug]/todos`
Fetch all To-Do tasks for this client.

**Response**:
```json
{
  "tasks": [
    {
      "id": "uuid",
      "linkedPhaseTaskId": "p1-ccsp",
      "label": "Core Calling Super Prompt",
      "assignee": "bobby",
      "priority": "high",
      "status": "in_progress",
      "createdAt": "2026-02-25T...",
      "completedAt": null
    }
  ]
}
```

#### POST `/api/clients/[slug]/todos`
Create new To-Do task (linked to Phase Board task).

**Body**:
```json
{
  "label": "Task name",
  "assignee": "bobby|sarah|client",
  "priority": "low|mid|high",
  "status": "assigned|in_progress|review|completed",
  "linkedPhaseTaskId": "phase-task-id"
}
```

#### PATCH `/api/clients/[slug]/todos/[id]`
Update task status, priority, or assignment.

**Body**:
```json
{
  "status": "in_progress",
  "priority": "mid",
  "assignee": "sarah"
}
```

#### DELETE `/api/clients/[slug]/todos/[id]`
Delete task from To-Do (Phase Board task remains).

### Sync Events

#### POST `/api/sync/ws`
Emit sync event to notify all connected clients.

**Body**:
```json
{
  "event": "task_assigned|task_priority_changed|task_status_changed|task_deleted",
  "clientSlug": "lindsay-little",
  "taskId": "p1-ccsp",
  "data": {
    "assignee": "bobby",
    "priority": "high",
    "status": "in_progress"
  },
  "timestamp": "2026-02-25T..."
}
```

## Data Flow Example

### Scenario: Assigning Task on Phase Board

1. **User clicks** assign button on Phase Board task
2. **Modal opens** with Bobby / Sarah / Client options
3. **User selects** "Bobby" and clicks Confirm
4. **Phase Board component**:
   - Updates local state
   - Emits `task_assigned` event via `/api/sync/ws`
   - PUTs updated Phase Board to `/api/clients/[slug]/phase-board`
5. **To-Do List component**:
   - Receives sync event (or polls and re-fetches)
   - Updates local state
   - Bobby's swimlane now shows the task
6. **Both pages auto-update** without refresh ✓

### Scenario: Drag-Drop in Kanban

1. **User drags** task from "Assigned" → "In Progress" column
2. **Drop handler** updates task status to "in_progress"
3. **To-Do component**:
   - Updates local state
   - Emits `task_status_changed` event
   - PATCHes `/api/clients/[slug]/todos/[id]`
4. **Phase Board component**:
   - Receives sync event
   - Updates local state
   - Task now shows in "In Progress" column (if "By Status" view active)
5. **Both pages auto-update** without refresh ✓

## Testing Checklist

### Phase Board
- [ ] Assign task → badge appears with initials
- [ ] Set priority → emoji shows (🟢🟡🔴)
- [ ] Toggle view → switches between "All Tasks" and "By Status"
- [ ] Drag task in "By Status" → status updates, Phase Board order unchanged
- [ ] Complete task → grey background + strikethrough
- [ ] Multiple clients → data isolated per client

### To-Do List
- [ ] Swimlanes view → shows Bobby/Sarah/Client lanes
- [ ] Collapse/expand → lanes toggle correctly
- [ ] Kanban tabs → switching tabs shows correct assignee's tasks
- [ ] Drag-drop → moves task between status columns
- [ ] Delete task → removed from To-Do, stays on Phase Board
- [ ] Priority toggle → sorts tasks correctly

### Real-Time Sync
- [ ] Assign on Phase Board → appears in To-Do instantly
- [ ] Drag in Kanban → Phase Board status updates
- [ ] Delete from To-Do → Phase Board unchanged
- [ ] Two browsers → changes sync across both
- [ ] Offline → sync queues and catches up when online

## Dependencies

- **socket.io**: Real-time sync (planned for production)
- **socket.io-client**: Client-side WebSocket
- **next**: Framework with API routes
- **react**: UI components
- **lucide-react**: Icons

## Future Enhancements

1. **Proper WebSocket**: Replace polling with true Socket.io server
2. **Offline Support**: Queue sync events, sync when online
3. **Real-time Collaboration**: See other users' cursors/edits
4. **Notifications**: Toast alerts for incoming changes
5. **Undo/Redo**: Revert accidental changes
6. **Comments**: Thread discussions on tasks
7. **Time Tracking**: Log hours spent on tasks
8. **Analytics**: Burndown charts, cycle time metrics
