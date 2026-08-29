import { GoogleTokenStore, StoredCredentials } from '../oauth/tokenStore';
import { GoogleOAuthService } from '../oauth/oauthService';
import db from '../database/connection';

export interface ToolParameter {
  type: string;
  description: string;
  required?: boolean;
  enum?: string[];
  items?: {
    type: string;
    description?: string;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

export abstract class BaseGoogleConnector {
  abstract readonly name: string;
  abstract readonly title: string;
  abstract readonly icon: string;
  abstract readonly scopes: string[];

  /**
   * Check if a specific Telegram user has authorized this connector.
   */
  async isConnected(chatId: number): Promise<boolean> {
    return GoogleTokenStore.isConnected(chatId, this.name);
  }

  /**
   * Generate an authorization link for the Telegram user.
   */
  getAuthorizationUrl(chatId: number): string {
    return GoogleOAuthService.getAuthorizationUrl(chatId, this.name);
  }

  /**
   * Disconnect this connector for the given Telegram user.
   */
  async disconnect(chatId: number): Promise<boolean> {
    return GoogleTokenStore.disconnectService(chatId, this.name);
  }

  /**
   * Retrieve active credentials for this connector.
   */
  async getCredentials(chatId: number): Promise<StoredCredentials | null> {
    return GoogleTokenStore.getCredentials(chatId, this.name);
  }

  /**
   * Retrieves a valid, automatically refreshed access token for this connector.
   */
  async getValidAccessToken(chatId: number): Promise<string | null> {
    return GoogleTokenStore.getValidAccessToken(chatId, this.name);
  }

  /**
   * Log an API tool execution in api_logs.
   */
  protected async logOperation(
    chatId: number,
    operation: string,
    status: 'success' | 'error' | 'quota_limit',
    errorMessage?: string
  ): Promise<void> {
    try {
      await db('api_logs').insert({
        chat_id: chatId,
        connector: this.name,
        operation,
        status,
        error_message: errorMessage || null
      });
    } catch (e) {
      console.warn(`[Connector:${this.name}] Failed to log operation:`, e);
    }
  }

  /**
   * Returns list of Gemini AI tool definitions exposed by this connector.
   */
  abstract getTools(): ToolDefinition[];

  /**
   * Executes a specific tool for the user with credential authorization and safety guards.
   */
  abstract executeTool(chatId: number, toolName: string, args: Record<string, any>): Promise<any>;
}
