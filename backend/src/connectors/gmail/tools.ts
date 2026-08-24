import { ToolDefinition } from '../base';

export const GMAIL_TOOLS: ToolDefinition[] = [
  {
    name: 'gmail_search',
    description: 'Search the user’s Gmail messages by query (e.g. from sender, subject, keywords, or "is:unread").',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query matching standard Gmail search syntax (e.g., "from:Rahul", "subject:project", "is:unread")'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of messages to return (default 5, max 10)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'gmail_read',
    description: 'Read the full details and body content of a specific email message using its message ID.',
    parameters: {
      type: 'object',
      properties: {
        messageId: {
          type: 'string',
          description: 'The unique Gmail message ID to retrieve'
        }
      },
      required: ['messageId']
    }
  },
  {
    name: 'gmail_thread',
    description: 'Read all email messages in a conversation thread using the thread ID.',
    parameters: {
      type: 'object',
      properties: {
        threadId: {
          type: 'string',
          description: 'The unique Gmail thread ID to retrieve'
        }
      },
      required: ['threadId']
    }
  }
];
