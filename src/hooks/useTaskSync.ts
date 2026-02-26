'use client';

import { useCallback, useEffect, useRef } from 'react';

export type SyncEvent = 
  | 'task_assigned'
  | 'task_priority_changed'
  | 'task_status_changed'
  | 'task_deleted';

export interface SyncMessage {
  event: SyncEvent;
  clientSlug: string;
  taskId: string;
  data: Record<string, any>;
  timestamp: string;
}

type SyncListener = (message: SyncMessage) => void;

class TaskSyncManager {
  private listeners = new Map<string, Set<SyncListener>>();
  private lastEventTime = new Map<string, number>();
  private pollIntervals = new Map<string, NodeJS.Timeout>();

  subscribe(clientSlug: string, listener: SyncListener): () => void {
    const key = `sync:${clientSlug}`;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
      this.startPolling(clientSlug);
    }
    
    this.listeners.get(key)!.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(key)?.delete(listener);
      if (this.listeners.get(key)?.size === 0) {
        this.stopPolling(clientSlug);
      }
    };
  }

  private startPolling(clientSlug: string) {
    // Poll for new events every 3 seconds
    const interval = setInterval(() => {
      this.checkForUpdates(clientSlug);
    }, 3000);
    
    this.pollIntervals.set(clientSlug, interval);
  }

  private stopPolling(clientSlug: string) {
    const interval = this.pollIntervals.get(clientSlug);
    if (interval) {
      clearInterval(interval);
      this.pollIntervals.delete(clientSlug);
    }
  }

  private async checkForUpdates(clientSlug: string) {
    // In a real implementation, this would check with the server for new events
    // For now, it's a placeholder for polling-based sync
    try {
      // Fetch current state to check if anything changed
      const lastTime = this.lastEventTime.get(clientSlug) || 0;
      // Could compare timestamps to detect changes
      // This is where polling would check: /api/clients/[slug]/todos and /api/clients/[slug]/phase-board
    } catch (err) {
      console.error('Polling error:', err);
    }
  }

  async emit(message: SyncMessage) {
    const key = `sync:${message.clientSlug}`;
    const listeners = this.listeners.get(key);
    
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(message);
        } catch (err) {
          console.error('Listener error:', err);
        }
      });
    }
    
    // Also send to server to broadcast to other clients
    try {
      await fetch('/api/sync/ws', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
    } catch (err) {
      console.error('Failed to broadcast sync event:', err);
    }
  }
}

// Global instance
const syncManager = new TaskSyncManager();

export function useTaskSync(clientSlug: string) {
  const callbackRef = useRef<SyncListener | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const onSync = useCallback((callback: SyncListener) => {
    callbackRef.current = callback;
  }, []);

  const emit = useCallback(async (event: SyncEvent, taskId: string, data: Record<string, any>) => {
    await syncManager.emit({
      event,
      clientSlug,
      taskId,
      data,
      timestamp: new Date().toISOString(),
    });
  }, [clientSlug]);

  useEffect(() => {
    if (callbackRef.current) {
      unsubscribeRef.current = syncManager.subscribe(clientSlug, callbackRef.current);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [clientSlug]);

  return { onSync, emit };
}
