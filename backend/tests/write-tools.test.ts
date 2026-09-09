import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let db: any;
let dbPath: string;

beforeAll(async () => {
  process.env.NODE_ENV = 'development';
  dbPath = path.join(os.tmpdir(), `write-tools-test-${Date.now()}.sqlite`);
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

describe('Remaining Google Workspace Write Tools', () => {
  it('exposes all new write tools in getAllTools()', async () => {
    const { GoogleConnectorRegistry } = await import('../src/connectors/registry');
    const registry = GoogleConnectorRegistry.getInstance();
    const tools = registry.getAllTools();
    const toolNames = tools.map((t) => t.name);

    // Gmail write tools
    expect(toolNames).toContain('gmail_send');
    expect(toolNames).toContain('gmail_reply');
    expect(toolNames).toContain('gmail_archive');

    // Drive write tools
    expect(toolNames).toContain('drive_create_folder');
    expect(toolNames).toContain('drive_upload_text_file');

    // Sheets write tools
    expect(toolNames).toContain('sheets_append_values');
    expect(toolNames).toContain('sheets_update_values');

    // Docs write tools
    expect(toolNames).toContain('docs_append_text');
    expect(toolNames).toContain('docs_create');

    // Tasks write tools
    expect(toolNames).toContain('tasks_update');
    expect(toolNames).toContain('tasks_delete');
  });

  describe('Gmail write operations', () => {
    const CHAT_ID = 71110001;

    it('rejects unauthenticated executeTool calls with friendly connect prompt', async () => {
      const { GoogleConnectorRegistry } = await import('../src/connectors/registry');
      const registry = GoogleConnectorRegistry.getInstance();
      await expect(
        registry.executeTool(999999991, 'gmail_send', {
          to: 'test@example.com',
          subject: 'Hello',
          body: 'World'
        })
      ).rejects.toThrow('Gmail is not connected. Please ask the user to run /connect gmail to connect Gmail first.');
    });

    it('successfully executes gmail_send, gmail_reply, and gmail_archive with mock credentials', async () => {
      const { GoogleConnectorRegistry } = await import('../src/connectors/registry');
      const { GoogleTokenStore } = await import('../src/oauth/tokenStore');
      const registry = GoogleConnectorRegistry.getInstance();

      await GoogleTokenStore.storeCredentials(
        CHAT_ID,
        'gmail',
        'user@example.com',
        'mock_refresh',
        'mock_access',
        new Date(Date.now() + 3600000),
        ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.modify']
      );

      // gmail_send
      const sendRes = await registry.executeTool(CHAT_ID, 'gmail_send', {
        to: 'recipient@example.com',
        subject: 'Weekly Status',
        body: 'Here is the report.',
        cc: ['manager@example.com']
      });
      expect(sendRes.sent).toBe(true);
      expect(sendRes.to).toBe('recipient@example.com');
      expect(sendRes.message_id).toBeDefined();

      // gmail_reply
      const replyRes = await registry.executeTool(CHAT_ID, 'gmail_reply', {
        thread_id: 'th_12345',
        body: 'Acknowledged and looks good.'
      });
      expect(replyRes.replied).toBe(true);
      expect(replyRes.thread_id).toBe('th_12345');

      // gmail_archive
      const archiveRes = await registry.executeTool(CHAT_ID, 'gmail_archive', {
        message_id: 'msg_98765'
      });
      expect(archiveRes.archived).toBe(true);
      expect(archiveRes.message_id).toBe('msg_98765');
    });
  });

  describe('Drive write operations', () => {
    const CHAT_ID = 71110002;

    it('rejects unauthenticated drive tool calls', async () => {
      const { GoogleConnectorRegistry } = await import('../src/connectors/registry');
      const registry = GoogleConnectorRegistry.getInstance();
      await expect(
        registry.executeTool(999999992, 'drive_create_folder', { name: 'Projects' })
      ).rejects.toThrow('Google Drive is not connected. Please ask the user to run /connect drive to connect Google Drive first.');
    });

    it('successfully executes drive_create_folder and drive_upload_text_file with mock credentials', async () => {
      const { GoogleConnectorRegistry } = await import('../src/connectors/registry');
      const { GoogleTokenStore } = await import('../src/oauth/tokenStore');
      const registry = GoogleConnectorRegistry.getInstance();

      await GoogleTokenStore.storeCredentials(
        CHAT_ID,
        'drive',
        'user@example.com',
        'mock_refresh',
        'mock_access',
        new Date(Date.now() + 3600000),
        ['https://www.googleapis.com/auth/drive.file']
      );

      // drive_create_folder
      const folderRes = await registry.executeTool(CHAT_ID, 'drive_create_folder', {
        name: 'Client Presentations'
      });
      expect(folderRes.created).toBe(true);
      expect(folderRes.name).toBe('Client Presentations');
      expect(folderRes.folder_id).toBeDefined();

      // drive_upload_text_file
      const fileRes = await registry.executeTool(CHAT_ID, 'drive_upload_text_file', {
        name: 'meeting-notes.md',
        content: '# Notes\nDiscussed requirements.',
        folder_id: folderRes.folder_id
      });
      expect(fileRes.created).toBe(true);
      expect(fileRes.name).toBe('meeting-notes.md');
      expect(fileRes.file_id).toBeDefined();
    });
  });

  describe('Sheets write operations', () => {
    const CHAT_ID = 71110003;

    it('rejects unauthenticated sheets tool calls', async () => {
      const { GoogleConnectorRegistry } = await import('../src/connectors/registry');
      const registry = GoogleConnectorRegistry.getInstance();
      await expect(
        registry.executeTool(999999993, 'sheets_append_values', {
          spreadsheet_id: 'sheet_xyz',
          range: 'Sheet1!A1',
          values: [['a', 'b']]
        })
      ).rejects.toThrow('Google Sheets is not connected. Please ask the user to run /connect sheets to connect Google Sheets first.');
    });

    it('successfully executes sheets_append_values and sheets_update_values with mock credentials', async () => {
      const { GoogleConnectorRegistry } = await import('../src/connectors/registry');
      const { GoogleTokenStore } = await import('../src/oauth/tokenStore');
      const registry = GoogleConnectorRegistry.getInstance();

      await GoogleTokenStore.storeCredentials(
        CHAT_ID,
        'sheets',
        'user@example.com',
        'mock_refresh',
        'mock_access',
        new Date(Date.now() + 3600000),
        ['https://www.googleapis.com/auth/spreadsheets']
      );

      // sheets_append_values
      const appendRes = await registry.executeTool(CHAT_ID, 'sheets_append_values', {
        spreadsheet_id: 'sheet_001',
        range: 'Expenses!A1',
        values: [
          ['Coffee', '$5.00'],
          ['Lunch', '$15.00']
        ]
      });
      expect(appendRes.appended).toBe(true);
      expect(appendRes.spreadsheet_id).toBe('sheet_001');
      expect(appendRes.updated_rows).toBe(2);

      // sheets_update_values
      const updateRes = await registry.executeTool(CHAT_ID, 'sheets_update_values', {
        spreadsheet_id: 'sheet_001',
        range: 'Expenses!A1:B1',
        values: [['Item', 'Amount']]
      });
      expect(updateRes.updated).toBe(true);
      expect(updateRes.spreadsheet_id).toBe('sheet_001');
      expect(updateRes.updated_rows).toBe(1);
    });
  });

  describe('Docs write operations', () => {
    const CHAT_ID = 71110004;

    it('rejects unauthenticated docs tool calls', async () => {
      const { GoogleConnectorRegistry } = await import('../src/connectors/registry');
      const registry = GoogleConnectorRegistry.getInstance();
      await expect(
        registry.executeTool(999999994, 'docs_create', { title: 'New Doc' })
      ).rejects.toThrow('Google Docs is not connected. Please ask the user to run /connect docs to connect Google Docs first.');
    });

    it('successfully executes docs_create and docs_append_text with mock credentials', async () => {
      const { GoogleConnectorRegistry } = await import('../src/connectors/registry');
      const { GoogleTokenStore } = await import('../src/oauth/tokenStore');
      const registry = GoogleConnectorRegistry.getInstance();

      await GoogleTokenStore.storeCredentials(
        CHAT_ID,
        'docs',
        'user@example.com',
        'mock_refresh',
        'mock_access',
        new Date(Date.now() + 3600000),
        ['https://www.googleapis.com/auth/documents']
      );

      // docs_create
      const createRes = await registry.executeTool(CHAT_ID, 'docs_create', {
        title: 'Project Brief',
        initial_text: 'Initial project overview.'
      });
      expect(createRes.created).toBe(true);
      expect(createRes.title).toBe('Project Brief');
      expect(createRes.document_id).toBeDefined();

      // docs_append_text
      const appendRes = await registry.executeTool(CHAT_ID, 'docs_append_text', {
        document_id: createRes.document_id,
        text: 'Additional section details.'
      });
      expect(appendRes.appended).toBe(true);
      expect(appendRes.document_id).toBe(createRes.document_id);
      expect(appendRes.length).toBeGreaterThan(0);
    });
  });

  describe('Tasks write operations', () => {
    const CHAT_ID = 71110005;

    it('rejects unauthenticated tasks tool calls', async () => {
      const { GoogleConnectorRegistry } = await import('../src/connectors/registry');
      const registry = GoogleConnectorRegistry.getInstance();
      await expect(
        registry.executeTool(999999995, 'tasks_delete', { task_id: 'task_abc' })
      ).rejects.toThrow('Google Tasks is not connected. Please ask the user to run /connect tasks to connect Google Tasks first.');
    });

    it('successfully executes tasks_update and tasks_delete with mock credentials', async () => {
      const { GoogleConnectorRegistry } = await import('../src/connectors/registry');
      const { GoogleTokenStore } = await import('../src/oauth/tokenStore');
      const registry = GoogleConnectorRegistry.getInstance();

      await GoogleTokenStore.storeCredentials(
        CHAT_ID,
        'tasks',
        'user@example.com',
        'mock_refresh',
        'mock_access',
        new Date(Date.now() + 3600000),
        ['https://www.googleapis.com/auth/tasks']
      );

      // tasks_update
      const updateRes = await registry.executeTool(CHAT_ID, 'tasks_update', {
        task_id: 'task_001',
        title: 'Updated Task Title',
        status: 'completed'
      });
      expect(updateRes.updated).toBe(true);
      expect(updateRes.task_id).toBe('task_001');
      expect(updateRes.status).toBe('completed');

      // tasks_delete
      const deleteRes = await registry.executeTool(CHAT_ID, 'tasks_delete', {
        task_id: 'task_001'
      });
      expect(deleteRes.deleted).toBe(true);
      expect(deleteRes.task_id).toBe('task_001');
    });
  });
});
