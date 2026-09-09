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
  },
  {
    name: 'gmail_send',
    description: 'Send a new email to one or more recipients.',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'The recipient email address (or comma-separated addresses)'
        },
        subject: {
          type: 'string',
          description: 'The subject line of the email'
        },
        body: {
          type: 'string',
          description: 'The plain text body content of the email'
        },
        cc: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Optional CC recipient email address(es)'
        },
        bcc: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Optional BCC recipient email address(es)'
        }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'gmail_reply',
    description: 'Send a reply email to an existing Gmail conversation thread.',
    parameters: {
      type: 'object',
      properties: {
        thread_id: {
          type: 'string',
          description: 'The ID of the Gmail thread to reply to'
        },
        body: {
          type: 'string',
          description: 'The plain text body content of the reply'
        }
      },
      required: ['thread_id', 'body']
    }
  },
  {
    name: 'gmail_archive',
    description: 'Archive an email message by removing it from the INBOX (does not delete the email).',
    parameters: {
      type: 'object',
      properties: {
        message_id: {
          type: 'string',
          description: 'The ID of the message to archive'
        }
      },
      required: ['message_id']
    }
  }
];
