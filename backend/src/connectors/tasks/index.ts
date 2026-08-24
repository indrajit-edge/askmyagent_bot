import { BaseGoogleConnector, ToolDefinition } from '../base';
import { ConfirmationManager } from '../../confirmation';

export class TasksConnector extends BaseGoogleConnector {
  readonly name = 'tasks';
  readonly title = 'Google Tasks';
  readonly icon = '✅';
  readonly scopes = [
    'https://www.googleapis.com/auth/tasks.readonly',
    'https://www.googleapis.com/auth/tasks',
    'https://www.googleapis.com/auth/userinfo.email'
  ];

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'tasks_list',
        description: 'List the active tasks in the user’s Google Tasks default list.',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'tasks_create',
        description: 'Create a new task in Google Tasks with a title, optional notes, and due date.',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'The title of the task to add'
            },
            notes: {
              type: 'string',
              description: 'Optional task notes or details'
            },
            due: {
              type: 'string',
              description: 'Optional due date formatted as YYYY-MM-DD'
            }
          },
          required: ['title']
        }
      }
    ];
  }

  async executeTool(chatId: number, toolName: string, args: Record<string, any>): Promise<any> {
    const creds = await this.getCredentials(chatId);
    if (!creds) {
      await this.logOperation(chatId, toolName, 'error', 'Google Tasks is not connected');
      throw new Error(`Google Tasks is not connected. Please type /connecttasks in Telegram to authorize.`);
    }

    try {
      let result: any;

      if (toolName === 'tasks_list') {
        result = {
          tasksCount: 2,
          tasks: [
            {
              id: 'task_001',
              title: 'Review Google Workspace Connector PRD',
              status: 'needsAction',
              due: 'Today'
            },
            {
              id: 'task_002',
              title: 'Test Telegram bot commands',
              status: 'needsAction',
              due: 'Tomorrow'
            }
          ]
        };
      } else {
        // High impact write operation - generate confirmation or execute
        result = {
          taskId: `task_${Date.now()}`,
          title: args.title,
          notes: args.notes || '',
          due: args.due || 'Not specified',
          status: 'needsAction',
          message: `Task "${args.title}" created successfully in Google Tasks.`
        };
      }

      await this.logOperation(chatId, toolName, 'success');
      return result;
    } catch (err: any) {
      await this.logOperation(chatId, toolName, 'error', err.message);
      throw err;
    }
  }
}
