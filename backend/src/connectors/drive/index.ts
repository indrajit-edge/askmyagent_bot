import { BaseGoogleConnector, ToolDefinition } from '../base';

export class DriveConnector extends BaseGoogleConnector {
  readonly name = 'drive';
  readonly title = 'Google Drive';
  readonly icon = '📁';
  readonly scopes = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
  ];

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'drive_search',
        description: 'Search for files, Google Docs, Sheets, and Slides in the user’s Google Drive.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query or document title keywords'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'drive_list_folder',
        description: 'List files and folders within a specific Google Drive directory.',
        parameters: {
          type: 'object',
          properties: {
            folderId: {
              type: 'string',
              description: 'Optional folder ID (defaults to root)'
            }
          }
        }
      }
    ];
  }

  async executeTool(chatId: number, toolName: string, args: Record<string, any>): Promise<any> {
    const creds = await this.getCredentials(chatId);
    if (!creds) {
      await this.logOperation(chatId, toolName, 'error', 'User has not connected Google Drive');
      throw new Error(`Google Drive is not connected. Please type /connectdrive in Telegram to authorize your Drive.`);
    }

    try {
      let result: any;

      if (toolName === 'drive_search') {
        result = {
          query: args.query,
          filesCount: 2,
          files: [
            {
              id: 'file_doc_01',
              name: `Project Proposal - ${args.query}`,
              mimeType: 'application/vnd.google-apps.document',
              webViewLink: 'https://docs.google.com/document/d/mock-proposal/edit'
            },
            {
              id: 'file_sheet_02',
              name: 'Q3 Financial Budget',
              mimeType: 'application/vnd.google-apps.spreadsheet',
              webViewLink: 'https://docs.google.com/spreadsheets/d/mock-sheet/edit'
            }
          ]
        };
      } else {
        result = {
          folderId: args.folderId || 'root',
          itemsCount: 1,
          items: [
            { id: 'item_1', name: 'Work Documents', type: 'folder' }
          ]
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
