/**
 * Central Google Workspace OAuth Scopes Dictionary.
 * Follows the principle of least privilege (PRD Section 49).
 */

export const WORKSPACE_SCOPES: Record<string, string[]> = {
  gmail: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
  ],
  calendar: [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email'
  ],
  drive: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
  ],
  docs: [
    'https://www.googleapis.com/auth/documents.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
  ],
  sheets: [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
  ],
  slides: [
    'https://www.googleapis.com/auth/presentations.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
  ],
  tasks: [
    'https://www.googleapis.com/auth/tasks.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
  ],
  people: [
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
  ],
  meet: [
    'https://www.googleapis.com/auth/meetings.space.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
  ],
  forms: [
    'https://www.googleapis.com/auth/forms.responses.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
  ],
  chat: [
    'https://www.googleapis.com/auth/chat.spaces.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
  ],
  keep: [
    'https://www.googleapis.com/auth/keep.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
  ]
};

export function getScopesForProvider(provider: string): string[] {
  return WORKSPACE_SCOPES[provider.toLowerCase()] || ['https://www.googleapis.com/auth/userinfo.email'];
}
