'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Trash2, Plus } from 'lucide-react';
import { useTaskSync } from '@/hooks/useTaskSync';

interface TodoTask {
  id: string;
  linkedPhaseTaskId: string;
  label: string;
  assignee: 'bobby' | 'sarah' | 'client' | null;
  priority: 'low' | 'mid' | 'high' | null;
  status: 'assigned' | 'in_progress' | 'review' | 'completed';
  createdAt: string;
  completedAt: string | null;
}

interface EnhancedTodoListProps {
  slug: string;
}

type ViewMode = 'swimlanes' | 'kanban';
type KanbanTab = 'bobby' | 'sarah' | 'client';

const PRIORITY_EMOJI: Record<string, string> = {
  low: '🟢',
  mid: '🟡',
  high: '🔴',
};

export function EnhancedTodoList({ slug }: EnhancedTodoListProps) {
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('swimlanes');
  const [kanbanTab, setKanbanTab] = useState<KanbanTab>('bobby');
  const [expandedLanes, setExpandedLanes] = useState<Set<KanbanTab>>(new Set(['bobby', 'sarah', 'client']));
  const [sortByPriority, setSortByPriority] = useState(false);
  const { onSync, emit } = useTaskSync(slug);

  // Load todos
  const loadTodos = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${slug}/todos`);
      if (!res.ok) return;
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error('Failed to load todos:', err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadTodos();
  }, [loadTodos]);

  // Listen for sync events
  useEffect(() => {
    onSync((message) => {
      if (message.event === 'task_assigned' || 
          message.event === 'task_status_changed' ||
          message.event === 'task_priority_changed') {
        void loadTodos();
      } else if (message.event === 'task_deleted') {
        setTasks(prev => prev.filter(t => t.id !== message.taskId));
      }
    });
  }, [onSync, loadTodos]);

  const toggleLane = (assignee: KanbanTab) => {
    setExpandedLanes(prev => {
      const next = new Set(prev);
      if (next.has(assignee)) next.delete(assignee);
      else next.add(assignee);
      return next;
    });
  };

  const deleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/clients/${slug}/todos/${taskId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setTasks(prev => prev.filter(t => t.id !== taskId));
        await emit('task_deleted', taskId, {});
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/clients/${slug}/todos/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
        await emit('task_status_changed', taskId, { status: newStatus });
      }
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const getTasksByAssignee = (assignee: KanbanTab | null) => {
    return tasks.filter(t => t.assignee === assignee);
  };

  const getTasksByStatus = (assignee: KanbanTab, status: string) => {
    return tasks.filter(t => t.assignee === assignee && t.status === status);
  };

  const TaskCard = ({ task }: { task: TodoTask }) => (
    <div
      style={{
        padding: '12px',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
          {task.priority && PRIORITY_EMOJI[task.priority]} {task.label}
        </div>
      </div>
      <button
        onClick={() => void deleteTask(task.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
        }}
        title="Delete task"
      >
        <Trash2 style={{ width: '14px', height: '14px' }} />
      </button>
    </div>
  );

  if (loading) {
    return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Loading...</div>;
  }

  // ─── SWIMLANES VIEW ───────────────────────────────────────────────────

  if (viewMode === 'swimlanes') {
    const sortTasks = (taskList: TodoTask[]) => {
      if (sortByPriority) {
        const priorityOrder = { high: 0, mid: 1, low: 2 };
        return [...taskList].sort((a, b) => {
          const aOrder = a.priority ? priorityOrder[a.priority] : 3;
          const bOrder = b.priority ? priorityOrder[b.priority] : 3;
          return aOrder - bOrder;
        });
      }
      return taskList;
    };

    const lanes: KanbanTab[] = ['bobby', 'sarah', 'client'];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-primary)' }}>
            <input
              type="checkbox"
              checked={sortByPriority}
              onChange={(e) => setSortByPriority(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Sort by Priority
          </label>
        </div>

        {lanes.map(assignee => {
          const laneTasks = sortTasks(getTasksByAssignee(assignee));
          const isExpanded = expandedLanes.has(assignee);
          const displayName = assignee.charAt(0).toUpperCase() + assignee.slice(1);

          return (
            <div key={assignee} style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
              <button
                onClick={() => toggleLane(assignee)}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: 'var(--surface)',
                  border: 'none',
                  borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {isExpanded ? <ChevronUp style={{ width: '16px', height: '16px' }} /> : <ChevronDown style={{ width: '16px', height: '16px' }} />}
                {displayName} ({laneTasks.length})
              </button>

              {isExpanded && (
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {laneTasks.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
                      No tasks assigned
                    </div>
                  ) : (
                    laneTasks.map(task => <TaskCard key={task.id} task={task} />)
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ─── KANBAN VIEW ──────────────────────────────────────────────────────

  const kanbanTabs: KanbanTab[] = ['bobby', 'sarah', 'client'];
  const statusColumns = ['assigned', 'in_progress', 'review', 'completed'];
  const statusLabels: Record<string, string> = {
    assigned: 'Assigned',
    in_progress: 'In Progress',
    review: 'Review',
    completed: 'Completed',
  };

  const tabTasks = getTasksByAssignee(kanbanTab);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
        {kanbanTabs.map(tab => (
          <button
            key={tab}
            onClick={() => setKanbanTab(tab)}
            style={{
              padding: '8px 12px',
              border: 'none',
              backgroundColor: kanbanTab === tab ? 'var(--accent)' : 'transparent',
              color: kanbanTab === tab ? '#fff' : 'var(--text-primary)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: kanbanTab === tab ? 600 : 500,
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {statusColumns.map(status => (
          <div
            key={status}
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '12px',
              minHeight: '300px',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
              {statusLabels[status]}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {getTasksByStatus(kanbanTab, status).map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragEnd={async () => {
                    // In a full implementation, would detect drop target
                    // For now, manual status update via buttons
                  }}
                  style={{
                    padding: '10px',
                    backgroundColor: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    cursor: 'grab',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                    {task.priority && PRIORITY_EMOJI[task.priority]} {task.label}
                  </div>
                  {status !== 'completed' && (
                    <select
                      value={status}
                      onChange={(e) => void updateTaskStatus(task.id, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '4px',
                        fontSize: '11px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--bg)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="assigned">→ Assigned</option>
                      <option value="in_progress">→ In Progress</option>
                      <option value="review">→ Review</option>
                      <option value="completed">→ Completed</option>
                    </select>
                  )}
                </div>
              ))}
              {getTasksByStatus(kanbanTab, status).length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
                  No tasks
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setViewMode('swimlanes')}
        style={{
          padding: '8px 12px',
          backgroundColor: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          marginTop: '8px',
          alignSelf: 'flex-start',
        }}
      >
        ← Back to Swimlanes
      </button>
    </div>
  );
}
