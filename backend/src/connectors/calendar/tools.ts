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
  },
  {
    name: 'calendar_create_event',
    description: 'Create a new Google Calendar event or meeting.',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Title or summary of the event'
        },
        start: {
          type: 'string',
          description: 'Start datetime in RFC3339 format (e.g. "2026-08-29T18:00:00Z" or "2026-08-29T18:00:00+05:30")'
        },
        end: {
          type: 'string',
          description: 'End datetime in RFC3339 format (e.g. "2026-08-29T19:00:00Z" or "2026-08-29T19:00:00+05:30")'
        },
        description: {
          type: 'string',
          description: 'Optional description or agenda of the meeting'
        },
        location: {
          type: 'string',
          description: 'Optional event location or meeting link'
        },
        attendees: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Optional list of attendee email addresses'
        },
        timeZone: {
          type: 'string',
          description: 'Optional timezone (e.g. "Asia/Kolkata", "America/New_York")'
        }
      },
      required: ['summary', 'start', 'end']
    }
  },
  {
    name: 'calendar_update_event',
    description: 'Update an existing Google Calendar event by its ID. Updates only provided fields and preserves others.',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'The ID of the event to update (must be a valid event_id from calendar_today, calendar_week, or calendar_search)'
        },
        summary: {
          type: 'string',
          description: 'Optional new title or summary for the event'
        },
        start: {
          type: 'string',
          description: 'Optional new start datetime in RFC3339 format'
        },
        end: {
          type: 'string',
          description: 'Optional new end datetime in RFC3339 format'
        },
        description: {
          type: 'string',
          description: 'Optional new description or agenda'
        },
        location: {
          type: 'string',
          description: 'Optional new location or meeting link'
        },
        timeZone: {
          type: 'string',
          description: 'Optional timezone'
        }
      },
      required: ['event_id']
    }
  },
  {
    name: 'calendar_delete_event',
    description: 'Delete an existing Google Calendar event by its ID.',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'The ID of the event to delete (must be a valid event_id from calendar_today, calendar_week, or calendar_search)'
        }
      },
      required: ['event_id']
    }
  }
];
