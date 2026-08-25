import { GoogleConnectorRegistry } from '../connectors/registry';
import { ToolDefinition } from '../connectors/base';

export interface ToolExecutionRequest {
  chatId: number;
  toolName: string;
  arguments: Record<string, any>;
}

export interface ToolExecutionResponse {
  success: boolean;
  toolName: string;
  result?: any;
  error?: string;
}

export class GeminiToolDispatcher {
  /**
   * Returns all available Google Workspace tool schemas for registration with Gemini AI.
   */
  static getAvailableTools(): ToolDefinition[] {
    return GoogleConnectorRegistry.getInstance().getAllTools();
  }

  /**
   * Dispatches an LLM tool call with strict user isolation (PRD Section 55).
   * Ensures the AI cannot manipulate credentials, foreign user IDs, or raw tokens.
   */
  static async dispatch(request: ToolExecutionRequest): Promise<ToolExecutionResponse> {
    const { chatId, toolName, arguments: rawArgs } = request;

    if (!chatId || typeof chatId !== 'number') {
      return {
        success: false,
        toolName,
        error: 'Invalid or missing user context (chatId required).'
      };
    }

    if (!toolName || typeof toolName !== 'string') {
      return {
        success: false,
        toolName: 'unknown',
        error: 'Tool name must be a valid string.'
      };
    }

    // Sanitize arguments: strip any malicious/injected identity or token overrides from LLM output
    const safeArgs: Record<string, any> = {};
    const disallowedKeys = ['chatId', 'chat_id', 'userId', 'user_id', 'token', 'accessToken', 'refreshToken', 'credentialPath', 'credentials'];

    if (rawArgs && typeof rawArgs === 'object') {
      for (const [key, value] of Object.entries(rawArgs)) {
        if (!disallowedKeys.includes(key)) {
          safeArgs[key] = value;
        }
      }
    }

    try {
      const registry = GoogleConnectorRegistry.getInstance();
      const result = await registry.executeTool(chatId, toolName, safeArgs);

      return {
        success: true,
        toolName,
        result
      };
    } catch (err: any) {
      return {
        success: false,
        toolName,
        error: err.message || `An error occurred while executing ${toolName}.`
      };
    }
  }
}
