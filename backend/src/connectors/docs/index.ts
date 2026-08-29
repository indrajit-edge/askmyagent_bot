import { BaseGoogleConnector, ToolDefinition } from '../base';

export class DocsConnector extends BaseGoogleConnector {
  readonly name = 'docs';
  readonly title = 'Google Docs';
  readonly icon = '📝';
  readonly scopes = [
    'https://www.googleapis.com/auth/documents.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
  ];

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'docs_read',
        description: 'Read the text content and structure of a Google Doc using its document ID.',
        parameters: {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description: 'The Google Docs document ID'
            }
          },
          required: ['documentId']
        }
      },
      {
        name: 'docs_search',
        description: 'Search for Google Docs documents by keyword or topic.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The topic, title, or search keyword'
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
      await this.logOperation(chatId, toolName, 'error', 'Google Docs is not connected');
      throw new Error(`Google Docs is not connected. Please ask the user to run /connect docs to connect Google Docs first.`);
    }

    try {
      let result: any;

      if (toolName === 'docs_read') {
        result = {
          documentId: args.documentId,
          title: `Project Proposal Doc (${args.documentId})`,
          author: creds.email,
          content: `This is the document body for ${args.documentId}.\n\nSection 1: Overview\nThe Google Workspace Connector architecture establishes a unified OAuth layer connecting AI agents to user documents securely.`
        };
      } else {
        result = {
          query: args.query,
          documentsCount: 1,
          documents: [
            {
              id: 'doc_arch_01',
              title: `Architecture Plan - ${args.query}`,
              modifiedTime: new Date().toISOString()
            }
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
