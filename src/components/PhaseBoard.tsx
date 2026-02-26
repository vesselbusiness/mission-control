'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { User, ChevronDown, ChevronRight } from 'lucide-react';
import { useTaskSync } from '@/hooks/useTaskSync';

interface PhaseBoardTask {
  id: string;
  label: string;
  completed: boolean;
  completedAt: string | null;
  assignee: 'bobby' | 'sarah' | 'client' | null;
  priority: 'low' | 'mid' | 'high' | null;
  status: 'assigned' | 'in_progress' | 'review' | 'completed';
  subtasks?: PhaseBoardTask[];
}

interface PhaseBoardPhase {
  id: string;
  label: string;
  tasks: PhaseBoardTask[];
}

interface PhaseBoardData {
  phases: PhaseBoardPhase[];
}

interface PhaseBoardProps {
  slug: string;
}

const PRIORITY_EMOJI: Record<string, string> = {
  low: '🟢',
  mid: '🟡',
  high: '🔴',
};

const ASSIGNEE_INITIALS: Record<string, string> = {
  bobby: 'B',
  sarah: 'S',
  client: 'C',
};

const ASSIGNEE_COLORS: Record<string, string> = {
  bobby: '#3B82F6',
  sarah: '#EC4899',
  client: '#F59E0B',
};

export function PhaseBoard({ slug }: PhaseBoardProps) {
  const [board, setBoard] = useState<PhaseBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhase, setSelectedPhase] = useState<string>('phase-1');
  const [funnelType, setFunnelType] = useState<'mate' | 'community'>('mate'); // For Phase 3
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set()); // Track collapsed/expanded parent tasks
  const [assignModal, setAssignModal] = useState<{ taskId: string } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { emit } = useTaskSync(slug);

  const loadBoard = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${slug}/phase-board`);
      if (!res.ok) return null;
      const data = await res.json() as PhaseBoardData;
      setBoard(data);
      return data;
    } catch (err) {
      console.error('Failed to load phase board:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void (async () => {
      const data = await loadBoard();
      if (data) {
        // Auto-expand all parent tasks
        const parentIds = new Set<string>();
        const collectParents = (tasks: PhaseBoardTask[]) => {
          tasks.forEach(task => {
            if (task.subtasks && task.subtasks.length > 0) {
              parentIds.add(task.id);
              collectParents(task.subtasks);
            }
          });
        };
        data.phases.forEach(phase => collectParents(phase.tasks));
        setExpandedParents(parentIds);
      }
    })();
  }, [loadBoard]);

  const saveBoard = useCallback((data: PhaseBoardData) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void fetch(`/api/clients/${slug}/phase-board`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    }, 500);
  }, [slug]);

  const updateTask = (taskId: string, updater: (t: PhaseBoardTask) => PhaseBoardTask) => {
    if (!board) return;

    const updateInPhases = (phases: PhaseBoardPhase[]): PhaseBoardPhase[] => {
      return phases.map(phase => ({
        ...phase,
        tasks: updateInTasks(phase.tasks, taskId, updater),
      }));
    };

    const updateInTasks = (tasks: PhaseBoardTask[], taskId: string, updater: (t: PhaseBoardTask) => PhaseBoardTask): PhaseBoardTask[] => {
      return tasks.map(task => {
        if (task.id === taskId) return updater(task);
        if (task.subtasks) {
          return {
            ...task,
            subtasks: updateInTasks(task.subtasks, taskId, updater),
          };
        }
        return task;
      });
    };

    const newBoard = { phases: updateInPhases(board.phases) };
    setBoard(newBoard);
    saveBoard(newBoard);
  };

  // Check if all subtasks are done
  const allSubtasksDone = (task: PhaseBoardTask): boolean => {
    if (!task.subtasks || task.subtasks.length === 0) return true;
    return task.subtasks.every(st => st.completed && allSubtasksDone(st));
  };

  const toggleTaskCompletion = (taskId: string, task: PhaseBoardTask) => {
    // If parent task with subtasks, only allow completion if all subtasks are done
    if (task.subtasks && task.subtasks.length > 0 && !task.completed) {
      if (!allSubtasksDone(task)) return; // Don't allow unchecking
    }
    
    updateTask(taskId, t => ({
      ...t,
      completed: !t.completed,
      completedAt: !t.completed ? new Date().toISOString() : null,
    }));
  };

  const setTaskAssignee = async (taskId: string, assignee: 'bobby' | 'sarah' | 'client') => {
    updateTask(taskId, task => ({
      ...task,
      assignee,
    }));
    await emit('task_assigned', taskId, { assignee });
    setAssignModal(null);
  };

  const setTaskPriority = (taskId: string, priority: string) => {
    if (priority === 'low' || priority === 'mid' || priority === 'high') {
      updateTask(taskId, task => ({
        ...task,
        priority,
      }));
    }
  };

  const toggleParentExpanded = (taskId: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  if (loading) {
    return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Loading phase board...</div>;
  }

  if (!board || board.phases.length === 0) {
    return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>No phases found</div>;
  }

  // Handle Phase 3 toggle: map funnelType to actual phase ID
  let activePhaseId = selectedPhase;
  if (selectedPhase === 'phase-3') {
    activePhaseId = funnelType === 'mate' ? 'phase-3a' : 'phase-3b';
  }

  const currentPhase = board.phases.find(p => p.id === activePhaseId);
  if (!currentPhase) {
    return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Phase not found</div>;
  }

  const isPhase3 = selectedPhase === 'phase-3';

  const renderTask = (task: PhaseBoardTask, depth = 0) => {
    const isParent = task.subtasks && task.subtasks.length > 0;
    const isSubtask = depth > 0;
    const canCheck = !isParent || allSubtasksDone(task);
    const isExpanded = expandedParents.has(task.id);
    const indent = depth * 16;

    // Different styling for parent vs subtasks
    const bgColor = isSubtask ? 'var(--bg)' : 'var(--surface)';
    const textColor = task.completed ? 'var(--text-muted)' : 'var(--text-primary)';
    const padding = isSubtask ? '8px' : '10px';
    const fontSize = isSubtask ? '12px' : '13px';
    const fontWeight = isSubtask ? 400 : 500;

    return (
      <div key={task.id}>
        <div
          style={{
            marginLeft: `${indent}px`,
            padding,
            backgroundColor: task.completed ? 'transparent' : bgColor,
            border: `1px solid var(--border)`,
            borderRadius: '6px',
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            opacity: task.completed ? 0.5 : 1,
          }}
        >
          {/* Chevron for parent tasks only */}
          {isParent && (
            <button
              onClick={() => toggleParentExpanded(task.id)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--text-muted)',
                flexShrink: 0,
              }}
            >
              {isExpanded ? (
                <ChevronDown style={{ width: '16px', height: '16px' }} />
              ) : (
                <ChevronRight style={{ width: '16px', height: '16px' }} />
              )}
            </button>
          )}
          
          {/* Checkbox - only for subtasks, NOT for parent tasks */}
          {!isParent && (
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => toggleTaskCompletion(task.id, task)}
              disabled={!canCheck}
              style={{
                cursor: canCheck ? 'pointer' : 'not-allowed',
                width: '16px',
                height: '16px',
                flexShrink: 0,
                opacity: canCheck ? 1 : 0.5,
              }}
              title={!canCheck ? 'Complete all subtasks first' : ''}
            />
          )}
          
          {/* For parent tasks, show auto-completed status */}
          {isParent && (
            <div
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '3px',
                backgroundColor: allSubtasksDone(task) ? 'var(--positive)' : 'var(--border)',
                flexShrink: 0,
              }}
            />
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                color: textColor,
                textDecoration: task.completed || (isParent && allSubtasksDone(task)) ? 'line-through' : 'none',
                fontWeight,
                fontSize,
              }}
            >
              {task.label}
            </div>
          </div>

          {/* Priority Selector - only for subtasks */}
          {!isParent && (
            <select
              value={task.priority || ''}
              onChange={(e) => setTaskPriority(task.id, e.target.value)}
              style={{
                padding: '3px 5px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)',
                color: 'var(--text-primary)',
                fontSize: '11px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <option value="">—</option>
              <option value="low">🟢</option>
              <option value="mid">🟡</option>
              <option value="high">🔴</option>
            </select>
          )}

          {/* Assignee Badge - only for subtasks */}
          {!isParent && task.assignee && (
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: ASSIGNEE_COLORS[task.assignee],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
              }}
              onClick={() => setAssignModal({ taskId: task.id })}
              title={`Assigned to ${task.assignee}`}
            >
              {ASSIGNEE_INITIALS[task.assignee]}
            </div>
          )}

          {/* Assign Button - only for subtasks */}
          {!isParent && (
            <button
              onClick={() => setAssignModal({ taskId: task.id })}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                flexShrink: 0,
                padding: 0,
              }}
              title="Assign task"
            >
              <User style={{ width: '12px', height: '12px' }} />
            </button>
          )}
        </div>

        {isParent && isExpanded && (
          <div>
            {task.subtasks!.map(subtask => renderTask(subtask, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Phase Selector */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: '8px',
      }}>
        <div style={{ 
          display: 'flex', 
          gap: '6px', 
          padding: '12px',
          backgroundColor: 'var(--surface)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          flexWrap: 'nowrap',
          overflow: 'auto',
        }}>
          {[
            { id: 'phase-1', label: 'Phase 1: Foundation' },
            { id: 'phase-2', label: 'Phase 2: Build the MATE' },
            { id: 'phase-3', label: 'Phase 3: Funnel Build' },
            { id: 'phase-4', label: 'Phase 4: Validate' },
          ].map(btnPhase => (
            <button
              key={btnPhase.id}
              onClick={() => {
                setSelectedPhase(btnPhase.id);
                if (btnPhase.id === 'phase-3') setFunnelType('mate');
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                backgroundColor: selectedPhase === btnPhase.id ? 'var(--accent)' : 'transparent',
                color: selectedPhase === btnPhase.id ? '#fff' : 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: selectedPhase === btnPhase.id ? 600 : 500,
                transition: 'all 150ms ease',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {btnPhase.label}
            </button>
          ))}
        </div>

        {/* Funnel Type Toggle (only show for Phase 3) */}
        {isPhase3 && (
          <div style={{ 
            display: 'flex', 
            gap: '6px', 
            padding: '8px 12px',
            backgroundColor: 'var(--bg)',
            borderRadius: '6px',
            border: '1px solid var(--border)',
          }}>
            <button
              onClick={() => setFunnelType('mate')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                backgroundColor: funnelType === 'mate' ? 'var(--accent)' : 'transparent',
                color: funnelType === 'mate' ? '#fff' : 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: funnelType === 'mate' ? 600 : 500,
                transition: 'all 150ms ease',
              }}
            >
              MATE LTO Funnel
            </button>
            <button
              onClick={() => setFunnelType('community')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                backgroundColor: funnelType === 'community' ? 'var(--accent)' : 'transparent',
                color: funnelType === 'community' ? '#fff' : 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: funnelType === 'community' ? 600 : 500,
                transition: 'all 150ms ease',
              }}
            >
              Community Upsell Funnel
            </button>
          </div>
        )}
      </div>

      {/* Current Phase Tasks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {currentPhase.tasks.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            No tasks in this phase
          </div>
        ) : (
          currentPhase.tasks.map(task => renderTask(task))
        )}
      </div>

      {/* Assign Modal */}
      {assignModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setAssignModal(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '24px',
              minWidth: '300px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>
              Assign Task
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(['bobby', 'sarah', 'client'] as const).map(assignee => (
                <label
                  key={assignee}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <input
                    type="radio"
                    name="assignee"
                    checked={true}
                    onChange={() => void setTaskAssignee(assignModal.taskId, assignee)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>{assignee.charAt(0).toUpperCase() + assignee.slice(1)}</span>
                </label>
              ))}
            </div>

            <button
              onClick={() => setAssignModal(null)}
              style={{
                width: '100%',
                marginTop: '16px',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
