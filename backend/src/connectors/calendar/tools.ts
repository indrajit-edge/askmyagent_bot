import { ToolDefinition } from '../base';

export const CALENDAR_TOOLS: ToolDefinition[] = [
  {
    name: 'calendar_today',
    description: 'Get all scheduled Google Calendar events and meetings for today.',
    parameters: {
      type: 'object',
      properties: {
        timeZone: {
          type: 'string',
          description: 'Optional timezone (e.g. "Asia/Kolkata", "America/New_York")'
        }
      }
    }
  },
  {
    name: 'calendar_week',
    description: 'Get all scheduled Google Calendar events for the upcoming 7 days.',
    parameters: {
      type: 'object',
      properties: {
        timeZone: {
          type: 'string',
          description: 'Optional timezone'
        }
      }
    }
  },
  {
    name: 'calendar_search',
    description: 'Search for specific calendar events or meetings by query string or keyword.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search keyword or participant name'
        }
      },
      required: ['query']
    }
  }
];
