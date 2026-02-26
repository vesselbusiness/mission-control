/**
 * instrumentation.ts
 * Next.js instrumentation hook — runs once on server startup.
 * Initializes vessel.db and todos.db, runs seed if tables are empty.
 */

export async function register() {
  // Only run on the Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getTodosDb, getVesselDb } = await import('./lib/vessel-db');
    const { seedVesselData } = await import('./lib/seed-vessel');

    // Initialize databases (creates tables if they don't exist)
    getTodosDb();
    getVesselDb();

    // Seed with sample data if tables are empty
    seedVesselData();

    console.log('[instrumentation] Vessel databases initialized');
  }
}
