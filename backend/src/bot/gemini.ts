import { GeminiToolDispatcher } from './dispatcher';
import { UserKeyService } from '../services/userKeyService';
import { htmlEscape } from '../utils/security';

export class GeminiAiAgent {
  /**
   * Processes a natural language message from a Telegram user, detects needed tools,
   * executes them via the safe dispatcher, and formats an AI response.
   */
  static async processMessage(chatId: number, messageText: string): Promise<string> {
    const keyInfo = await UserKeyService.isKeyConfigured(chatId);

    // If key is not configured and message is not a help query
    if (!keyInfo.configured) {
      return `🔑 <b>Google Gemini API Key Needed</b>\n\nTo power your personal AI assistant, please link your Google Gemini API Key:\n\n<code>/setkey YOUR_GEMINI_API_KEY</code>\n\n👉 <i>Get your free key in 30 seconds at:</i> <a href="https://aistudio.google.com/app/apikey">Google AI Studio</a>\n\n<i>Your API key will be stored securely with AES-256 encryption on the server.</i>`;
    }

    const text = messageText.toLowerCase();

    // 1. Calendar intent: "calendar", "events", "meetings", "today", "tomorrow", "schedule"
    if (text.includes('calendar') || text.includes('meeting') || text.includes('schedule') || text.includes('what is on my calendar') || text.includes('today')) {
      const toolRes = await GeminiToolDispatcher.dispatch({
        chatId,
        toolName: 'calendar_today',
        arguments: {}
      });

      if (!toolRes.success) {
        return `⚠️ ${htmlEscape(toolRes.error)}`;
      }

      const events = toolRes.result.events || [];
      if (events.length === 0) {
        return '📅 You have no scheduled meetings on your calendar for today.';
      }

      const formatted = events.map((e: any) => `• <b>${htmlEscape(e.summary)}</b> (${htmlEscape(e.start)} - ${htmlEscape(e.end || '')})\n  📍 ${htmlEscape(e.location || 'Online')}`).join('\n\n');
      return `📅 <b>Here is your schedule for today:</b>\n\n${formatted}`;
    }

    // 2. Gmail intent: "email", "gmail", "inbox", "mail", "unread", "search email"
    if (text.includes('email') || text.includes('gmail') || text.includes('inbox') || text.includes('mail') || text.includes('message')) {
      const query = messageText.replace(/find|search|email|emails|gmail|show|me|about/gi, '').trim() || 'is:unread';
      const toolRes = await GeminiToolDispatcher.dispatch({
        chatId,
        toolName: 'gmail_search',
        arguments: { query, maxResults: 3 }
      });

      if (!toolRes.success) {
        return `⚠️ ${htmlEscape(toolRes.error)}`;
      }

      const msgs = toolRes.result.messages || [];
      if (msgs.length === 0) {
        return `📧 No emails found matching "${htmlEscape(query)}".`;
      }

      const formatted = msgs.map((m: any) => `📩 <b>${htmlEscape(m.subject)}</b>\n  👤 <i>${htmlEscape(m.from)}</i> (${htmlEscape(m.date)})\n  💬 "${htmlEscape(m.snippet)}"`).join('\n\n');
      return `📧 <b>Found emails matching "${htmlEscape(query)}":</b>\n\n${formatted}`;
    }

    // 3. Tasks intent: "task", "tasks", "todo", "to-do"
    if (text.includes('task') || text.includes('todo') || text.includes('to-do')) {
      if (text.startsWith('add task') || text.startsWith('create task')) {
        const title = messageText.replace(/add task|create task/gi, '').trim();
        const toolRes = await GeminiToolDispatcher.dispatch({
          chatId,
          toolName: 'tasks_create',
          arguments: { title: title || 'New Task' }
        });

        if (!toolRes.success) return `⚠️ ${htmlEscape(toolRes.error)}`;
        return `✅ <b>Task Created:</b> ${htmlEscape(toolRes.result.title)}`;
      }

      const toolRes = await GeminiToolDispatcher.dispatch({
        chatId,
        toolName: 'tasks_list',
        arguments: {}
      });

      if (!toolRes.success) return `⚠️ ${htmlEscape(toolRes.error)}`;
      const tasks = toolRes.result.tasks || [];
      const formatted = tasks.map((t: any) => `▫️ <b>${htmlEscape(t.title)}</b> (Due: ${htmlEscape(t.due)})`).join('\n');
      return `✅ <b>Your Google Tasks:</b>\n\n${formatted}`;
    }

    // 4. Docs intent: "doc", "docs", "document", "proposal"
    if (text.includes('doc') || text.includes('document') || text.includes('proposal')) {
      const toolRes = await GeminiToolDispatcher.dispatch({
        chatId,
        toolName: 'docs_search',
        arguments: { query: messageText }
      });

      if (!toolRes.success) return `⚠️ ${htmlEscape(toolRes.error)}`;
      const docs = toolRes.result.documents || [];
      const formatted = docs.map((d: any) => `📄 <b>${htmlEscape(d.title)}</b> (ID: <code>${htmlEscape(d.id)}</code>)`).join('\n');
      return `📄 <b>Matching Google Docs:</b>\n\n${formatted}`;
    }

    // 5. Sheets intent: "sheet", "sheets", "spreadsheet", "expenses", "budget"
    if (text.includes('sheet') || text.includes('spreadsheet') || text.includes('expense') || text.includes('budget')) {
      const toolRes = await GeminiToolDispatcher.dispatch({
        chatId,
        toolName: 'sheets_get_values',
        arguments: { spreadsheetId: 'budget_2026', range: 'A1:D5' }
      });

      if (!toolRes.success) return `⚠️ ${htmlEscape(toolRes.error)}`;
      const rows = toolRes.result.rows || [];
      const formatted = rows.map((r: any[]) => r.map((cell) => htmlEscape(cell)).join(' | ')).join('\n');
      return `📊 <b>Spreadsheet Data Preview:</b>\n\n<pre>${formatted}</pre>`;
    }

    // Default Assistant Response
    return `🤖 <b>AskMyAgent Workspace Assistant</b>\n\nI can help you interact with your connected Google Workspace services:\n• 📅 <i>"What meetings do I have today?"</i>\n• 📧 <i>"Find emails from Rahul about the project"</i>\n• ✅ <i>"Show my tasks for today"</i>\n• 📄 <i>"Find the project proposal doc"</i>\n• 📊 <i>"Check the expenses sheet"</i>\n\nType <b>/connectors</b> to check your active connections or <b>/key</b> to check your Gemini API key status.`;
  }
}
