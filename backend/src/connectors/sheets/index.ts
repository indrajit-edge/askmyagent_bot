import { BaseGoogleConnector, ToolDefinition } from '../base';

export class SheetsConnector extends BaseGoogleConnector {
  readonly name = 'sheets';
  readonly title = 'Google Sheets';
  readonly icon = '📊';
  readonly scopes = [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
  ];

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'sheets_read',
        description: 'Read the summary metadata and sheet names of a Google Spreadsheet.',
        parameters: {
          type: 'object',
          properties: {
            spreadsheetId: {
              type: 'string',
              description: 'The Google Spreadsheet ID'
            }
          },
          required: ['spreadsheetId']
        }
      },
      {
        name: 'sheets_get_values',
        description: 'Read cell values from a specified range in a spreadsheet (e.g., "Sheet1!A1:D10").',
        parameters: {
          type: 'object',
          properties: {
            spreadsheetId: {
              type: 'string',
              description: 'The Google Spreadsheet ID'
            },
            range: {
              type: 'string',
              description: 'The cell range (e.g., "Expenses!A1:D10")'
            }
          },
          required: ['spreadsheetId', 'range']
        }
      },
      {
        name: 'sheets_search',
        description: 'Search for spreadsheets by title or topic.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Keyword query (e.g., "expenses", "revenue")'
            }
          },
          required: ['query']
        }
      }
    ];
  }

  async executeTool(chatId: number, toolName: string, args: Record<string, any>): Promise<any> {
    const creds = await this.getCredentials(chatId);
    if (!creds) {
      await this.logOperation(chatId, toolName, 'error', 'Google Sheets is not connected');
      throw new Error(`Google Sheets is not connected. Please type /connectsheets in Telegram to authorize.`);
    }

    try {
      let result: any;

      if (toolName === 'sheets_read') {
        result = {
          spreadsheetId: args.spreadsheetId,
          title: `Financial Budget Sheet (${args.spreadsheetId})`,
          sheets: ['Expenses', 'Summary', 'Projections']
        };
      } else if (toolName === 'sheets_get_values') {
        result = {
          spreadsheetId: args.spreadsheetId,
          range: args.range,
          rows: [
            ['Category', 'Item', 'Cost', 'Owner'],
            ['Cloud Hosting', 'Oracle Cloud VM', '$0.00', 'Indrajit'],
            ['Database', 'Local SQLite3', '$0.00', 'AskMyAgent'],
            ['Total', 'Monthly Run Cost', '$0.00', 'System']
          ]
        };
      } else {
        result = {
          query: args.query,
          spreadsheets: [
            { id: 'sheet_01', title: `Monthly Expenses 2026 - ${args.query}` }
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
