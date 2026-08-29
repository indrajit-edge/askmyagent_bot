import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let db: any;
let dbPath: string;

beforeAll(async () => {
  process.env.NODE_ENV = 'development';
  dbPath = path.join(os.tmpdir(), `calendar-tools-test-${Date.now()}.sqlite`);
  process.env.DATABASE_PATH = dbPath;

  db = (await import('../src/database/connection')).default;

  const m1 = await import('../src/database/migrations/20260824000000_init_schema');
  const m2 = await import('../src/database/migrations/20260824010000_align_users_telegram_schema');
  const m3 = await import('../src/database/migrations/20260824020000_add_chat_id_column');
  const m4 = await import('../src/database/migrations/20260824030000_add_indexes');
  const m5 = await import('../src/database/migrations/20260824040000_postgres_indexes_and_types');
  for (const m of [m1, m2, m3, m4, m5]) await m.up(db);
});

afterAll(async () => {
  if (db) await db.destroy();
  if (dbPath) fs.rmSync(dbPath, { force: true });
});

describe('Google Calendar write tools', () => {
  it('exposes the 3 new write tools in getAllTools()', async () => {
    const { GoogleConnectorRegistry } = await import('../src/connectors/registry');
    const registry = GoogleConnectorRegistry.getInstance();
    const tools = registry.getAllTools();
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain('calendar_create_event');
    expect(toolNames).toContain('calendar_update_event');
    expect(toolNames).toContain('calendar_delete_event');
  });

  it('throws a friendly /connect calendar error when user is not connected', async () => {
    const { GoogleConnectorRegistry } = await import('../src/connectors/registry');
    const registry = GoogleConnectorRegistry.getInstance();
    const calendarConnector = registry.getConnector('calendar')!;

    await expect(
      calendarConnector.executeTool(999999999, 'calendar_create_event', {
        summary: 'Test Meeting',
        start: '2026-08-29T18:00:00Z',
        end: '2026-08-29T19:00:00Z'
      })
    ).rejects.toThrow('Google Calendar is not connected. Please ask the user to run /connect calendar to connect Google Calendar first.');
  });

  it('handles calendar_create_event with mock token', async () => {
    const { GoogleConnectorRegistry } = await import('../src/connectors/registry');
    const { GoogleTokenStore } = await import('../src/oauth/tokenStore');
    const registry = GoogleConnectorRegistry.getInstance();
    const CHAT_ID = 8888888888;

    await GoogleTokenStore.storeCredentials(
      CHAT_ID,
      'calendar',
      'test@example.com',
      'mock_refresh',
      'mock_access',
      new Date(Date.now() + 3600000),
      ['https://www.googleapis.com/auth/calendar.events']
    );

    const createResult = await registry.executeTool(CHAT_ID, 'calendar_create_event', {
      summary: 'Project Kickoff',
      start: '2026-08-29T18:00:00Z',
      end: '2026-08-29T19:00:00Z',
      location: 'Zoom',
      description: 'Discuss Q3 milestones'
    });

    expect(createResult.created).toBe(true);
    expect(createResult.summary).toBe('Project Kickoff');
    expect(createResult.event_id).toBeDefined();

    const updateResult = await registry.executeTool(CHAT_ID, 'calendar_update_event', {
      event_id: createResult.event_id,
      summary: 'Project Kickoff (Rescheduled)',
      location: 'Google Meet'
    });

    expect(updateResult.updated).toBe(true);
    expect(updateResult.summary).toBe('Project Kickoff (Rescheduled)');

    const deleteResult = await registry.executeTool(CHAT_ID, 'calendar_delete_event', {
      event_id: createResult.event_id
    });

    expect(deleteResult.deleted).toBe(true);
    expect(deleteResult.event_id).toBe(createResult.event_id);
  });
});
