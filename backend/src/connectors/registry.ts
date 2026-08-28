import { BaseGoogleConnector, ToolDefinition } from './base';
import { GmailConnector } from './gmail';
import { CalendarConnector } from './calendar';
import { DriveConnector } from './drive';
import { DocsConnector } from './docs';
import { SheetsConnector } from './sheets';
import { TasksConnector } from './tasks';

export class GoogleConnectorRegistry {
  private static instance: GoogleConnectorRegistry;
  private connectors: Map<string, BaseGoogleConnector> = new Map();
  private toolMap: Map<string, BaseGoogleConnector> = new Map();

  private constructor() {
    this.register(new GmailConnector());
    this.register(new CalendarConnector());
    this.register(new DriveConnector());
    this.register(new DocsConnector());
    this.register(new SheetsConnector());
    this.register(new TasksConnector());
  }

  static getInstance(): GoogleConnectorRegistry {
    if (!GoogleConnectorRegistry.instance) {
      GoogleConnectorRegistry.instance = new GoogleConnectorRegistry();
    }
    return GoogleConnectorRegistry.instance;
  }

  register(connector: BaseGoogleConnector): void {
    this.connectors.set(connector.name.toLowerCase(), connector);
    for (const tool of connector.getTools()) {
      this.toolMap.set(tool.name, connector);
    }
  }

  getConnector(provider: string): BaseGoogleConnector | undefined {
    return this.connectors.get(provider.toLowerCase());
  }

  getAllConnectors(): BaseGoogleConnector[] {
    return Array.from(this.connectors.values());
  }

  /**
   * Aggregates all tool definitions across registered Workspace connectors.
   */
  getAllTools(): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    for (const connector of this.connectors.values()) {
      tools.push(...connector.getTools());
    }
    return tools;
  }

  /**
   * Finds the connector responsible for a tool name and executes it safely (O(1) indexed).
   */
  async executeTool(chatId: number, toolName: string, args: Record<string, any>): Promise<any> {
    const connector = this.toolMap.get(toolName);
    if (connector) {
      return connector.executeTool(chatId, toolName, args);
    }

    throw new Error(`Tool "${toolName}" is not registered in any Google Workspace connector.`);
  }

  /**
   * Generates the status overview of all connectors for a specific user.
   */
  async getUserConnectorsStatus(chatId: number): Promise<{
    name: string;
    title: string;
    icon: string;
    connected: boolean;
    email: string | null;
    authUrl: string;
  }[]> {
    const statuses = [];

    for (const connector of this.connectors.values()) {
      const creds = await connector.getCredentials(chatId);
      const isConnected = !!creds;
      statuses.push({
        name: connector.name,
        title: connector.title,
        icon: connector.icon,
        connected: isConnected,
        email: creds ? creds.email : null,
        authUrl: connector.getAuthorizationUrl(chatId)
      });
    }

    return statuses;
  }
}
