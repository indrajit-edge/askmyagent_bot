# PRD Extension: Google Workspace Connector Platform

## 43. Google Workspace Connector Strategy

Gmail must NOT be implemented as a completely isolated OAuth system.

The application should establish a reusable Google OAuth and connector architecture that can support multiple Google Workspace APIs in the future.

The long-term goal is:

Telegram
    ↓
SaaS Backend
    ↓
Gemini
    ↓
Google Connector Layer
    ├── Gmail
    ├── Calendar
    ├── Drive
    ├── Docs
    ├── Sheets
    ├── Slides
    ├── Tasks
    ├── Contacts / People
    ├── Meet
    ├── Forms
    ├── Keep
    └── Google Chat

OAuth should be implemented once and reused by the Google connectors.

---

# 44. Google APIs to Support

The architecture should be prepared for the following Google APIs.

## Tier 1: Implement First

These provide the highest value for an AI personal assistant.

### Gmail

API:

gmail.googleapis.com

Potential capabilities:

- Search email
- Read email
- Read threads
- Summarize emails
- Find attachments
- Draft emails
- Send emails in a future phase
- Organize email in a future phase

Phase 1:

READ ONLY

Scope:

https://www.googleapis.com/auth/gmail.readonly

Do not implement sending or modification initially.

---

### Google Calendar

API:

calendar-json.googleapis.com

The existing Calendar connector already exists.

DO NOT rewrite it unnecessarily.

Future architecture should migrate it toward the same reusable Google OAuth/connector architecture when appropriate.

Potential capabilities:

- List calendars
- Read events
- Create events
- Update events
- Delete events
- Find free/busy times
- Schedule meetings
- Search events
- Create recurring events

Existing Calendar functionality must continue working during Gmail development.

---

### Google Drive

API:

drive.googleapis.com

Potential capabilities:

- Search files
- List folders
- Read file metadata
- Read Google Docs
- Read Google Sheets
- Read Google Slides
- Create files
- Upload files
- Create folders
- Move files
- Share files

Initial Drive phase:

READ ONLY

Recommended initial scope:

https://www.googleapis.com/auth/drive.readonly

Do not request full Drive modification permissions until a later phase.

Example AI requests:

"Find my project proposal."

"Show me the files I edited yesterday."

"Find the PDF about my internship."

"Summarize the project proposal in Drive."

---

### Google Docs

API:

docs.googleapis.com

Potential capabilities:

- Read documents
- Search document content
- Create documents
- Append text
- Update documents

Initial phase:

READ ONLY where possible.

Example:

"Summarize my project report."

"Find the section about authentication."

"Read my internship document."

---

### Google Sheets

API:

sheets.googleapis.com

Potential capabilities:

- Read spreadsheets
- Read ranges
- Search sheets
- Read rows
- Create spreadsheets
- Update cells
- Append rows
- Generate reports

Initial phase:

READ ONLY.

Example:

"What is the total revenue in my spreadsheet?"

"Read the expenses sheet."

"Find all rows containing Rahul."

Later:

"Add this expense to my spreadsheet."

---

### Google Slides

API:

slides.googleapis.com

Potential capabilities:

- Read presentations
- Read slides
- Extract text
- Create presentations
- Add slides
- Update presentations

Initial phase:

READ ONLY.

Example:

"Summarize my presentation."

"What is slide 8 about?"

Later:

"Create a presentation from this report."

---

### Google Tasks

API:

tasks.googleapis.com

Potential capabilities:

- List task lists
- List tasks
- Create tasks
- Update tasks
- Complete tasks
- Delete tasks

Example:

"Show my tasks for today."

"Add a task to finish my project."

"Mark the database assignment complete."

This connector may eventually integrate with Calendar and reminders.

---

## Tier 2: Add Later

### Google Meet

API:

meet.googleapis.com

Potential capabilities:

- Find meetings
- Read meeting information
- Access meeting artifacts where permitted
- Create/manage meetings where supported
- Integrate meeting information with Calendar

Example:

"What meetings do I have today?"

"Create a Google Meet for tomorrow's project meeting."

"Find the Meet from yesterday."

Important:

Meet API capabilities depend on the user's account and applicable Google Workspace permissions.

Do not assume every personal Google account has every Meet feature.

---

### Google People API

API:

people.googleapis.com

Potential capabilities:

- Read contacts
- Search contacts
- Read contact information
- Create/update contacts where supported

Example:

"Find Rahul's phone number."

"What's Ankit's email?"

"Find my contact for Microsoft."

Use the appropriate People API scopes.

Do not request contact modification permissions in the initial implementation.

---

### Google Forms

API:

forms.googleapis.com

Potential capabilities:

- Read forms
- Read questions
- Read responses
- Create forms
- Update forms

Example:

"Show me my project feedback form."

"Summarize the responses."

This should be implemented later because it has lower priority for the initial AI assistant.

---

### Google Chat

API:

chat.googleapis.com

Potential capabilities depend heavily on whether the user is using Google Workspace Chat.

Potential capabilities:

- Read accessible spaces
- Read messages
- Send messages
- Search available conversations
- Interact with Chat apps

This should be treated as a separate Google Workspace connector because authorization and account requirements differ from ordinary personal Google usage.

---

### Google Keep

API:

Keep API

Potential capabilities:

- Read notes
- Search notes
- Create notes
- Update notes
- Delete notes

Example:

"Find my note about the project."

"Create a note called shopping list."

Keep should be treated as a later connector.

---

# 45. Google API Priority

Implementation priority:

1. Gmail
2. Calendar
3. Drive
4. Docs
5. Sheets
6. Tasks
7. Slides
8. People / Contacts
9. Meet
10. Forms
11. Google Chat
12. Google Keep

The priority may change based on user demand.

---

# 46. Reusable Google OAuth System

Do NOT create:

gmail_oauth.py
calendar_oauth.py
drive_oauth.py
docs_oauth.py
sheets_oauth.py

with duplicated authentication logic.

Instead create a reusable OAuth layer.

Recommended structure:

google_oauth/
    __init__.py
    config.py
    state.py
    authorization.py
    callback.py
    token_store.py
    scopes.py

Example:

get_google_authorization_url(
    chat_id,
    provider,
    scopes
)

get_google_credentials(
    chat_id,
    provider
)

store_google_credentials(
    chat_id,
    provider,
    credentials
)

disconnect_google_service(
    chat_id,
    provider
)

---

# 47. Google Connector Registry

Create a central registry.

Conceptually:

```python
GOOGLE_CONNECTORS = {
    "gmail": GmailConnector,
    "calendar": CalendarConnector,
    "drive": DriveConnector,
    "docs": DocsConnector,
    "sheets": SheetsConnector,
    "slides": SlidesConnector,
    "tasks": TasksConnector,
    "people": PeopleConnector,
    "meet": MeetConnector,
    "forms": FormsConnector,
    "chat": ChatConnector,
    "keep": KeepConnector,
}

Each connector should define:

name
API
OAuth scopes
authentication requirements
available tools
connection status
disconnect behavior
48. Connector Interface

Use a common interface.

Conceptually:

class GoogleConnector:
    name = None
    scopes = []

    def is_connected(self, chat_id):
        ...

    def connect(self, chat_id):
        ...

    def disconnect(self, chat_id):
        ...

    def get_credentials(self, chat_id):
        ...

    def get_tools(self):
        ...

Individual connectors implement their own API operations.

Do not force every connector to expose identical operations.

49. Scope Management

OAuth scopes must be requested only when needed.

Do NOT request every Google permission during initial Gmail connection.

Bad:

Gmail

Calendar
Drive
Contacts
Sheets
Docs
Meet
Tasks
Forms

all requested at once.

This creates an unnecessarily scary consent screen and violates the principle of least privilege.

Instead:

User selects:

"Connect Gmail"

Request only Gmail scopes.

Later:

"Connect Google Drive"

Request Drive scopes.

Later:

"Connect Google Calendar"

Request Calendar scopes.

Each connector should therefore define its own scopes.

50. Google Connection Dashboard

The future /connectors command should display:

Your Google connectors:

📧 Gmail
❌ Not connected

📅 Google Calendar
✅ Connected

📁 Google Drive
❌ Not connected

📝 Google Docs
❌ Not connected

📊 Google Sheets
❌ Not connected

📽 Google Slides
❌ Not connected

✅ Google Tasks
❌ Not connected

👤 Google Contacts
❌ Not connected

🎥 Google Meet
❌ Not connected

📝 Google Forms
❌ Not connected

💬 Google Chat
❌ Not connected

Keep the UI compact.

51. Connection Commands

Eventually support:

/connectgmail

/connectcalendar

/connectdrive

/connectdocs

/connectsheets

/connectslides

/connecttasks

/connectcontacts

/connectmeet

/connectforms

/connectchat

/connectkeep

And:

/disconnectgmail

/disconnectcalendar

/disconnectdrive

/disconnectdocs

/disconnectsheets

/disconnectslides

/disconnecttasks

/disconnectcontacts

/disconnectmeet

/disconnectforms

/disconnectchat

/disconnectkeep

Do not implement all commands immediately.

The architecture should make adding each one straightforward.

52. Shared Google Credential Storage

Credentials should be stored by:

chat_id + provider

Conceptually:

google_connections

chat_id
provider
email
encrypted_refresh_token
encrypted_access_token
token_expiry
scopes
created_at
updated_at

Example:

chat_id = 12345
provider = gmail

chat_id = 12345
provider = drive

chat_id = 12345
provider = calendar

Each connection is independent.

53. Shared Google OAuth

A user may connect Gmail without connecting Drive.

Example:

User:

/connectgmail

Result:

Gmail: ✅ Connected
Drive: ❌ Not connected
Calendar: ❌ Not connected

Later:

/connectdrive

Result:

Gmail: ✅ Connected
Drive: ✅ Connected
Calendar: ❌ Not connected

The application must not assume that connecting one Google service automatically authorizes every other service.

54. Gemini Tool Namespaces

Tools should eventually use clear namespaces.

Examples:

gmail_search
gmail_read
gmail_thread

calendar_today
calendar_week
calendar_create_event
calendar_update_event
calendar_delete_event

drive_search
drive_read
drive_list_folder

docs_read
docs_search
docs_create

sheets_read
sheets_search
sheets_append

tasks_list
tasks_create
tasks_complete

slides_read
slides_search

people_search
people_read

meet_list
meet_create

This prevents tool names from becoming ambiguous as the number of connectors grows.

55. Tool Security

Gemini must never control:

chat_id
Google account
OAuth token
refresh token
credential path
encryption key

Gemini only controls safe tool arguments.

The backend determines:

Current Telegram user
↓
Authenticated Google account
↓
Available connector
↓
API operation

56. Read vs Write Operations

Every connector should distinguish between:

READ

and:

WRITE

Examples:

READ:

gmail_search
gmail_read
drive_search
calendar_today

WRITE:

gmail_send
drive_create
calendar_create_event
sheets_append
tasks_create

Phase 1 should prioritize READ operations.

WRITE operations should require additional confirmation.

Example:

User:

"Send this email to Rahul."

Bot:

"You're about to send this email to recipient@example.invalid.

[ Confirm Send ]
[ Cancel ]"

Do not allow high-impact actions to happen silently.

57. Confirmation Framework

Build a reusable confirmation mechanism.

Conceptually:

request_confirmation(
chat_id,
action,
parameters
)

Examples:

"Send email"

"Delete calendar event"

"Delete Drive file"

"Modify spreadsheet"

"Create task"

The confirmation must be associated with the authenticated chat_id.

Never allow one user's pending confirmation to be executed by another user.

58. API Availability and Cost

Google Workspace APIs should be treated as:

"Free within applicable standard quotas."

Do not describe them as permanently unlimited or universally free.

Google states that API usage can be subject to quotas and that some APIs have billing requirements or charges beyond applicable free/courtesy usage.

Google's 2026 Workspace API changes also introduce a standardized usage model affecting APIs including Gmail, Calendar, and Drive, with later changes to quota increases and billing for usage above standard thresholds.

Therefore:

Implement API quota handling.
Implement retry/backoff.
Track API errors.
Avoid unnecessary API requests.
Cache safe metadata where appropriate.
Never assume unlimited usage.
Do not promise users unlimited Google API access.
59. Google API Enablement

The Google Cloud project should enable only APIs that are actually being used.

Initial:

Gmail API
Calendar API

Later:

Drive API
Docs API
Sheets API
Slides API
Tasks API
People API
Meet API
Forms API
Chat API
Keep API

Google provides a centralized Workspace API enablement process and lists the available APIs through its developer documentation.

Do not blindly enable every Google API just because it exists.

Enable APIs as connectors are implemented.

60. API Quota Management

The backend should monitor:

requests
API errors
429 responses
quota errors
per-user usage
per-project usage

Use exponential backoff for transient failures.

Do not retry indefinitely.

Google documents quota controls across Workspace APIs, and quotas can differ by API and project.

61. Connector Development Pattern

Each new connector should follow:

Enable API.
Define OAuth scopes.
Add connector configuration.
Add authentication.
Add credential retrieval.
Add API client.
Add tool definitions.
Add execute_tool integration.
Add /connect<service>.
Add /disconnect<service>.
Add /connectors status.
Add user isolation tests.
Add API error handling.
Add quota handling.
Add security tests.

This pattern should be reusable.

62. Future Google Workspace Assistant

The long-term goal is for a user to be able to ask:

"What's on my calendar tomorrow?"

Gemini:

calendar_today / calendar_week

"Find the email from Rahul about the project."

Gemini:

gmail_search

"Find the project proposal in Drive and summarize it."

Gemini:

drive_search
↓
drive_read
↓
Gemini summary

"Check the spreadsheet and tell me the total expenses."

Gemini:

sheets_search
↓
sheets_read
↓
calculation
↓
response

"Add the meeting from my email to Calendar."

Gemini:

gmail_search
↓
gmail_read
↓
calendar_create_event
↓
confirmation
↓
event created

"Create a task for tomorrow based on this email."

Gemini:

gmail_read
↓
tasks_create
↓
confirmation
↓
task created

This is the long-term product direction.

63. Future Connector Roadmap

Phase 1:

Gmail
Calendar

Phase 2:

Drive
Docs
Sheets

Phase 3:

Tasks
Slides
People

Phase 4:

Meet
Forms
Google Chat

Phase 5:

Keep
Advanced Workspace integrations

The roadmap can be adjusted based on actual user demand.

64. Architecture Principle

The system must follow:

ONE OAuth system
+
ONE credential storage mechanism
+
ONE connector registry
+
ONE tool execution layer
+
MANY Google connectors

Do NOT create:

ONE OAuth implementation per connector.

The purpose of the Gmail implementation is to establish the foundation for the entire Google Workspace integration layer.


### My recommendation for the actual build

Don't have Antigravity implement all 12 connectors now. **Build the reusable OAuth/connector framework + Gmail + your existing Calendar first.** Then Drive is the next one.

That's because Google officially exposes a pretty broad Workspace API surface, including Gmail, Calendar, Drive, Docs, Sheets, Slides, Tasks, Meet, Forms, Chat, People, and more. :contentReference[oaicite:6]{index=6}

The smart architecture is therefore:

**one Google OAuth → many connectors**, not **12 separate OAuth systems**. Otherwise six months from now you'll be maintaining a small zoo of nearly-identical authentication code, which is exactly the sort of thing software engineers invent and later regret. 🫠

Also, Google says standard Gmail API usage is currently available at no additional cost within its quotas, but quota/billing rules are evolving in 2026, so your product should enforce its own limits rather than promising users "unlimited free Google APIs." :contentReference[oaicite:7]{index=7}
