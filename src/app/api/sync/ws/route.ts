import { NextRequest, NextResponse } from 'next/server';

// In-memory event store (for real-time sync across clients)
// For production, this would use Redis or a proper WebSocket server
const eventListeners = new Map<string, Set<(event: any) => void>>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, clientSlug, taskId, data, timestamp } = body;
    
    if (!event || !clientSlug || !taskId) {
      return NextResponse.json(
        { error: 'event, clientSlug, and taskId required' },
        { status: 400 }
      );
    }
    
    const syncEvent = {
      event,
      clientSlug,
      taskId,
      data,
      timestamp: timestamp || new Date().toISOString(),
    };
    
    // Broadcast to listeners for this client
    const key = `sync:${clientSlug}`;
    const listeners = eventListeners.get(key);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(syncEvent);
        } catch (err) {
          console.error('Listener error:', err);
        }
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Sync POST error:', err);
    return NextResponse.json({ error: 'Failed to process sync event' }, { status: 500 });
  }
}

// Export listeners map for use in components/hooks
export { eventListeners };
