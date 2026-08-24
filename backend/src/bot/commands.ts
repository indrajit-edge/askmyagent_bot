import { GoogleConnectorRegistry } from '../connectors/registry';
import { htmlEscape } from '../utils/security';

export class BotCommandHandler {
  /**
   * Generates the Telegram /connectors dashboard message (PRD Section 50).
   */
  static async handleConnectorsCommand(chatId: number): Promise<string> {
    const registry = GoogleConnectorRegistry.getInstance();
    let statuses;
    try {
      statuses = await registry.getUserConnectorsStatus(chatId);
    } catch (err: any) {
      return `⚠️ ${htmlEscape(err.message || 'Google OAuth is not configured on this server.')}`;
    }

    const lines: string[] = ['<b>Your Google Connectors:</b>\n'];

    for (const item of statuses) {
      lines.push(`${item.icon} <b>${item.title}</b>`);
      if (item.connected) {
        lines.push(`✅ Connected <i>(${htmlEscape(item.email || 'Authorized')})</i>`);
        lines.push(`Disconnect: /disconnect${item.name}\n`);
      } else {
        lines.push(`❌ Not connected`);
        lines.push(`👉 Connect: <a href="${item.authUrl}">Authorize ${item.title}</a>\n`);
      }
    }

    lines.push('💡 <i>Each Google service requires independent least-privilege authorization.</i>');
    return lines.join('\n');
  }

  /**
   * Generates a direct connection link for a specific Google Workspace service.
   */
  static handleConnectService(chatId: number, serviceName: string): { success: boolean; message: string; url?: string } {
    const registry = GoogleConnectorRegistry.getInstance();
    const connector = registry.getConnector(serviceName);

    if (!connector) {
      return {
        success: false,
        message: `Unknown Google service "${htmlEscape(serviceName)}". Supported services: gmail, calendar, drive.`
      };
    }

    let authUrl: string;
    try {
      authUrl = connector.getAuthorizationUrl(chatId);
    } catch (err: any) {
      return {
        success: false,
        message: `⚠️ ${htmlEscape(err.message || 'Google OAuth is not configured on this server.')}`
      };
    }

    return {
      success: true,
      message: `🔗 <b>Connect ${connector.title}</b>\n\nClick the link below to link your Google account with AskMyAgent:\n\n<a href="${authUrl}">Click here to Authorize ${connector.title}</a>\n\n<i>This link is secure and valid for 15 minutes.</i>`,
      url: authUrl
    };
  }

  /**
   * Disconnects a specific service for the user (PRD Section 51).
   */
  static async handleDisconnectService(chatId: number, serviceName: string): Promise<{ success: boolean; message: string }> {
    const registry = GoogleConnectorRegistry.getInstance();
    const connector = registry.getConnector(serviceName);

    if (!connector) {
      return {
        success: false,
        message: `Unknown Google service "${htmlEscape(serviceName)}". Supported services: gmail, calendar, drive.`
      };
    }

    const isConnected = await connector.isConnected(chatId);
    if (!isConnected) {
      return {
        success: false,
        message: `ℹ️ ${connector.title} is not currently connected to your account.`
      };
    }

    await connector.disconnect(chatId);
    return {
      success: true,
      message: `✅ Successfully disconnected ${connector.title}. Your stored tokens have been securely removed.`
    };
  }
}
