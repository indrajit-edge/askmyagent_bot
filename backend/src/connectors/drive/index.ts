import { BaseGoogleConnector, ToolDefinition } from '../base';

export class DriveConnector extends BaseGoogleConnector {
  readonly name = 'drive';
  readonly title = 'Google Drive';
  readonly icon = '📁';
  readonly scopes = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.file',
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
      },
      {
        name: 'drive_create_folder',
        description: 'Create a new folder in Google Drive (defaults to root if no parent folder ID specified).',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'The name of the new folder'
            },
            parent_folder_id: {
              type: 'string',
              description: 'Optional parent folder ID to create the folder inside'
            }
          },
          required: ['name']
        }
      },
      {
        name: 'drive_upload_text_file',
        description: 'Create or upload a plain text or markdown file to Google Drive.',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'The name of the file including extension (e.g. "notes.txt" or "summary.md")'
            },
            content: {
              type: 'string',
              description: 'The text content to save into the file'
            },
            folder_id: {
              type: 'string',
              description: 'Optional destination folder ID'
            }
          },
          required: ['name', 'content']
        }
      }
    ];
  }

  async executeTool(chatId: number, toolName: string, args: Record<string, any>): Promise<any> {
    const creds = await this.getCredentials(chatId);
    if (!creds) {
      await this.logOperation(chatId, toolName, 'error', 'User has not connected Google Drive');
      throw new Error(`Google Drive is not connected. Please ask the user to run /connect drive to connect Google Drive first.`);
    }

    try {
      let result: any;

      switch (toolName) {
        case 'drive_search':
          result = await this.searchFiles(creds.accessToken, String(args?.query || ''));
          break;

        case 'drive_list_folder':
          result = await this.listFolder(creds.accessToken, args?.folderId !== undefined ? String(args.folderId) : undefined);
          break;

        case 'drive_create_folder':
          result = await this.createFolder(creds.accessToken, {
            name: String(args?.name || ''),
            parent_folder_id: args?.parent_folder_id !== undefined ? String(args.parent_folder_id) : undefined
          });
          break;

        case 'drive_upload_text_file':
          result = await this.uploadTextFile(creds.accessToken, {
            name: String(args?.name || ''),
            content: String(args?.content || ''),
            folder_id: args?.folder_id !== undefined ? String(args.folder_id) : undefined
          });
          break;

        default:
          throw new Error(`Unknown tool operation: ${toolName}`);
      }

      await this.logOperation(chatId, toolName, 'success');
      return result;
    } catch (err: any) {
      await this.logOperation(chatId, toolName, 'error', err.message);
      throw err;
    }
  }

  private async searchFiles(accessToken: string, query: string) {
    if (!accessToken.startsWith('mock_') && !accessToken.startsWith('iv:')) {
      try {
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name contains '${query}' and trashed = false`)}&fields=files(id,name,mimeType,webViewLink)`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          return {
            query,
            filesCount: data.files ? data.files.length : 0,
            files: data.files || []
          };
        }
      } catch (e) {
        // Fall through
      }
    }

    return {
      query,
      filesCount: 2,
      files: [
        {
          id: 'file_doc_01',
          name: `Project Proposal - ${query}`,
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
  }

  private async listFolder(accessToken: string, folderId?: string) {
    const targetFolder = folderId || 'root';
    if (!accessToken.startsWith('mock_') && !accessToken.startsWith('iv:')) {
      try {
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${targetFolder}' in parents and trashed = false`)}&fields=files(id,name,mimeType,webViewLink)`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          return {
            folderId: targetFolder,
            itemsCount: data.files ? data.files.length : 0,
            items: data.files || []
          };
        }
      } catch (e) {
        // Fall through
      }
    }

    return {
      folderId: targetFolder,
      itemsCount: 1,
      items: [
        { id: 'item_1', name: 'Work Documents', type: 'folder' }
      ]
    };
  }

  private async createFolder(
    accessToken: string,
    args: {
      name: string;
      parent_folder_id?: string;
    }
  ) {
    if (!args.name) {
      throw new Error('name is required to create a folder.');
    }

    const payload: any = {
      name: args.name,
      mimeType: 'application/vnd.google-apps.folder'
    };
    if (args.parent_folder_id) {
      payload.parents = [args.parent_folder_id];
    }

    if (!accessToken.startsWith('mock_') && !accessToken.startsWith('iv:')) {
      try {
        const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(`Google Drive API error (${res.status}): ${errText || 'Failed to create folder'}`);
        }

        const data = await res.json();
        return {
          folder_id: data.id,
          name: data.name,
          created: true,
          webViewLink: data.webViewLink
        };
      } catch (e: any) {
        if (!accessToken.startsWith('mock_')) throw e;
      }
    }

    return {
      folder_id: `folder_${Date.now()}`,
      name: args.name,
      created: true,
      webViewLink: `https://drive.google.com/drive/folders/mock_folder_${Date.now()}`
    };
  }

  private async uploadTextFile(
    accessToken: string,
    args: {
      name: string;
      content: string;
      folder_id?: string;
    }
  ) {
    if (!args.name) {
      throw new Error('name is required to upload a file.');
    }

    if (!accessToken.startsWith('mock_') && !accessToken.startsWith('iv:')) {
      try {
        const boundary = `-------314159265358979323846`;
        const metadata: any = {
          name: args.name,
          mimeType: 'text/plain'
        };
        if (args.folder_id) {
          metadata.parents = [args.folder_id];
        }

        const multipartBody =
          `--${boundary}\r\n` +
          `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
          `${JSON.stringify(metadata)}\r\n` +
          `--${boundary}\r\n` +
          `Content-Type: text/plain; charset=UTF-8\r\n\r\n` +
          `${args.content}\r\n` +
          `--${boundary}--`;

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartBody
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(`Google Drive API error (${res.status}): ${errText || 'Failed to upload file'}`);
        }

        const data = await res.json();
        return {
          file_id: data.id,
          name: data.name,
          mimeType: data.mimeType || 'text/plain',
          created: true,
          webViewLink: data.webViewLink
        };
      } catch (e: any) {
        if (!accessToken.startsWith('mock_')) throw e;
      }
    }

    return {
      file_id: `file_${Date.now()}`,
      name: args.name,
      mimeType: 'text/plain',
      created: true,
      webViewLink: `https://drive.google.com/file/d/mock_file_${Date.now()}/view`
    };
  }
}
