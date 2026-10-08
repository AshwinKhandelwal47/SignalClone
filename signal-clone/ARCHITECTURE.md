# Signal Clone — Architecture & Design

> Source of truth: `Scaler_SDE_Fullstack_Assignment_-_Signal_Clone.pdf`. Anything not stated in the PDF is marked **[ASSUMPTION]** or **[OPEN QUESTION]**.

> **Implementation status (2026-10-08):** all core features are implemented and tested. To keep the code small and easy to explain, the build differs from the original design below in these ways:
> - **No Alembic.** Tables are created with `Base.metadata.create_all` at startup (schema in `backend/app/models.py`).
> - **No TanStack Query or Radix.** One Zustand store (`frontend/src/stores/chat.ts`) holds server data and applies WebSocket events. Modals are hand-written.
> - **`conversations.last_message_at`, `system_event` JSON, `last_read_message_id`, `muted_until`, phone-number masking and the bonus tables were dropped.** Activity order, previews and unread counts are computed from `messages` and `message_receipts`. System messages store ready-made text.
> - **Members see messages from `joined_at`** (in addition to the `removed_at` cutoff).
> - **Search and filters run client-side** over the loaded chat list. `/conversations` takes no `q`/`filter` params.
> - **Events.** `message.status` is batched (`{updates: [...]}`). `conversation.removed` is replaced by `conversation.updated` (the client refetches and sees `is_active_member: false`).
> - **Routes.** Onboarding is a single `/onboarding` page with steps. The chat route is `/chats/[conversationId]`.
> - **Not built:** OTP rate limiting, frontend unit tests (covered instead by the backend pytest suite plus manual/Playwright smoke runs), and the optional bonuses besides dark mode, responsive layout and keyboard shortcuts.
> - **Keyboard shortcuts** use `Ctrl/⌘+K` (search) instead of `Ctrl+N`/`Ctrl+F`, which browsers reserve.
>
> See README.md for the final schema, API and assumptions.

---

## 1. Assignment Understanding

Build a **functional clone of Signal Messenger**. It should look and behave like Signal ("look and feel should be exactly the same"), with these working end to end:

- **Mocked onboarding**: register or log in with a phone number or username, verified with a **fixed OTP**. Set a display name and avatar. Sessions persist and the user can log out.
- **Signal's main layout**: a left-hand conversation list (sorted by recent activity, searchable, with unread badges, last-message preview and online/last-seen) next to a chat pane.
- **Contacts**: add a new contact and search contacts.
- **Real-time 1:1 messaging**: text, timestamps, typing indicators, and the full status lifecycle *sending → sent → delivered → read* shown with Signal's check marks. Everything is persisted.
- **Group messaging**: create a group with a name and members, send and receive messages, view members, and let admins add or remove members. Everything is persisted.
- **Signal experience**: bubbles and threading, modals, forms, search, filters, toasts, and settings placeholders (privacy, notifications, appearance).
- **Placeholders** ("Coming Soon"): voice/video calls, stories, linked devices. **E2E encryption is simulated** (UI only).
- **Bonus (optional)**: attachments, reactions, reply/quote, disappearing messages, dark mode, responsive layout, keyboard shortcuts.

**Mandated stack:** Next.js (TypeScript), Python FastAPI or Django, SQLite (own schema), WebSockets or another real-time mechanism.

**Deliverables:** a public GitHub repo with `frontend/` and `backend/`, a README (setup, tech stack, architecture, DB schema, API overview, assumptions), a **seeded** database so the app is usable right away, and a **hosted demo link**. Original work only, since plagiarism disqualifies.

**Evaluated on:** functionality (especially real-time), UI/UX similarity, database design, backend/API design, code quality, modularity, and the ability to explain the code. Estimated effort is about 24 hours.

---

## 2. Requirements

### 2.1 Functional Requirements

| ID | Requirement (from PDF) |
|---|---|
| **AUTH-1** | Register with a phone number or username. Verification is mocked with a fixed OTP. |
| **AUTH-2** | Set a display name and profile avatar. |
| **AUTH-3** | Login / logout. |
| **AUTH-4** | The session persists across reloads. |
| **LIST-1** | Conversation list sorted by most recent activity. |
| **LIST-2** | Search conversations and contacts. |
| **LIST-3** | Add a new contact. |
| **LIST-4** | Unread indicators. |
| **LIST-5** | Last-message preview. |
| **LIST-6** | Online / last-seen indicators (mocking allowed). |
| **DM-1** | Send and receive text messages in real time. |
| **DM-2** | Message timestamps. |
| **DM-3** | Delivery/read receipts using the single/double check UX. |
| **DM-4** | Typing indicators. |
| **DM-5** | Message status: sending, sent, delivered, read. |
| **DM-6** | All messages persist in the DB. |
| **GRP-1** | Create a group with a name and members. |
| **GRP-2** | Send and receive group messages. |
| **GRP-3** | View group members. |
| **GRP-4** | Add / remove members (admin controls). |
| **GRP-5** | All group data and messages persist. |
| **UX-1** | Navigation and layout: conversation list plus chat pane. |
| **UX-2** | Message bubbles and threading. |
| **UX-3** | Forms, modals, search, filters. |
| **UX-4** | Notifications / toasts. |
| **UX-5** | Settings placeholders: privacy, notifications, appearance. |
| **PH-1..4** | "Coming Soon" placeholders for voice/video calls, stories and linked devices. E2EE is simulated or mocked. |
| **SEED-1** | Seed multiple users, conversations and messages. |
| **BONUS-1..7** | Attachments, reactions, reply/quote, disappearing messages, dark mode, responsive layout, keyboard shortcuts. |

### 2.2 Non-Functional Requirements
- **Visual fidelity**: closely match Signal Desktop's layout, colours, typography, spacing, iconography style and micro-interactions. This is the top evaluation criterion after functionality.
- **Real-time latency**: messages, receipts, typing and presence reach other online clients within about 1 second.
- **Persistence and integrity**: SQLite with foreign keys, unique constraints and indexes. No message is lost on reload.
- **Code quality and modularity**: a layered backend (routes → services → models), and on the frontend, reusable components plus hooks for data and real-time.
- **Explainability**: keep the stack small and conventional so every line can be defended in the interview.
- **Deployability**: a hosted demo that is reachable over HTTPS/WSS.
- **Usability**: the seeded demo accounts and fixed OTP are shown on the onboarding screen.
- **Originality**: no code copied from Signal-Desktop or other clone repos. The UI is recreated by hand from observation.
- **Security hygiene**: even with mocked auth, endpoints are authorized, input is validated and output is escaped (see §13).

---

## 3. User Flows

1. **First-time registration**
   Landing → "Continue" → enter phone number (country code + number) **or** username → "Next" → OTP screen (hint: `123456`) → verify → **new user** → profile setup (display name required, avatar optional: upload an image or get the default coloured initials) → main view with the "Messages are end-to-end encrypted" note on empty chats.
2. **Returning login**: same phone/OTP flow. An **existing** user skips profile setup and goes straight to the main view.
3. **Session persistence**: on app load, the stored token is validated with `GET /auth/me`. If valid, go to the main view. If it is invalid or expired, clear it and go to onboarding.
4. **Logout**: Settings → Log out → confirm modal → `POST /auth/logout` (revokes the session) → clear client state → onboarding.
5. **Browse and search the list**: the list is sorted by `last_message_at` desc. Typing in the search box filters conversations by title or member name and also shows a "Contacts" section and a "Groups" section, Signal-style. Filter chips are **All / Unread / Groups** **[ASSUMPTION: Signal's chat filters]**.
6. **Add a contact**: "New chat" (compose icon) → "Find by phone number / username" → look up a registered user → add to contacts (toast "Contact added") → opens or creates the 1:1 conversation.
7. **Start a 1:1 chat**: compose → choose a contact → `POST /conversations` type=direct. This is idempotent and returns the existing chat if there is one → the chat pane opens.
8. **Send a message**: type → typing indicator is emitted (throttled) → Enter → optimistic bubble with the *sending* clock icon → server persists it → **sent** (single check) → recipient's socket receives it → **delivered** (double check) → recipient opens the chat → **read** (filled double check). On failure the bubble shows "Failed to send" with a retry option.
9. **Receive a message**: if the conversation is open and the window is visible, the message is appended and marked read. Otherwise the unread badge increments, the conversation moves to the top, and a toast (plus an optional browser notification) appears.
10. **Create a group**: compose → "New group" → multi-select contacts → Next → group name (+ optional avatar) → Create → system message "You created the group" → the group opens.
11. **Manage a group**: click the header → conversation details panel → member list with "Admin" labels. An admin can "Add members" (picker modal) and "Remove from group" (confirm). Any member can "Leave group". Each change creates a system message in the timeline and is pushed live to all members.
12. **Removed member**: the conversation stays in their list read-only and the composer is replaced by "You are no longer a member of this group."
13. **Settings**: avatar menu / nav rail → Settings modal → Profile (functional edit), Appearance (theme: functional if the dark mode bonus is done), Notifications, Privacy, Chats, Linked devices → placeholders.
14. **Placeholders**: the Calls and Stories nav-rail tabs, the voice/video call header buttons, and Linked devices all show a "Coming Soon" view or toast. "View safety number" shows a mock safety-number modal.

---

## 4. Proposed Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | **Next.js 15 (App Router) + React 19 + TypeScript** | Mandated. The App Router gives file-based routes for onboarding vs app shell. |
| Styling | **Tailwind CSS v4 + CSS custom properties (design tokens)** | Fast, pixel-precise styling. Tailwind v4 is configured CSS-first: tokens live in `src/app/globals.css` (`:root` + `@theme inline`), so there is no `tailwind.config.ts`. Light and dark themes swap by redefining the semantic tokens. |
| UI primitives | **Radix UI** (Dialog, DropdownMenu, Tooltip, Popover) | Accessible, unstyled primitives, so the Signal look can be applied without fighting a design system. |
| Server state | **TanStack Query** | Caching, pagination and refetch-on-reconnect. WebSocket events patch the cache directly. |
| Client state | **Zustand** | Small stores for auth, active conversation, typing/presence and the socket. Easy to explain. |
| Toasts | **sonner** | Lightweight toasts that can be styled like Signal's. |
| Font / icons | **Inter** (Signal Desktop's font), hand-made SVG icons in Signal's style | Visual fidelity without copying Signal's assets. |
| Backend | **FastAPI (Python 3.12)** | Native async WebSockets on the same server as REST, Pydantic validation, auto OpenAPI docs (useful for the "API overview"). Chosen over Django because Channels adds complexity. |
| ORM / migrations | **SQLAlchemy 2.0 + Alembic** | Explicit models and relationships, which the DB design evaluation rewards. Alembic gives versioned schema. |
| DB | **SQLite** (WAL mode, `PRAGMA foreign_keys=ON`) | Mandated. WAL improves concurrent reads during writes. |
| Real-time | **Native WebSockets** (FastAPI ↔ browser `WebSocket`) | Mandated or suggested. No extra infrastructure. |
| Auth | Opaque random session tokens (hashed in DB), Bearer header | Mocked OTP. Server-side sessions make logout a true revocation. |
| Testing | **pytest + httpx/TestClient** (incl. WS), **Vitest + React Testing Library**, optional **Playwright** smoke | Standard for each layer. |
| Hosting | **Vercel** (frontend) + **Render or Railway** (backend with persistent disk for SQLite) | Vercel can't host long-lived WebSockets, so the backend needs a persistent server. |

---

## 5. System Architecture

```
┌──────────────────────── Browser (Next.js SPA-style client) ────────────────────────┐
│  Pages/Layouts ─► Components ─► Hooks (useConversations, useMessages, useSocket)   │
│        │                             │                    │                         │
│   TanStack Query cache ◄── patches ──┘           Zustand stores (auth, typing,      │
│        │  REST (fetch, Bearer token)                       presence, ui)           │
└────────┼───────────────────────────────────────────────────┼───────────────────────┘
         │ HTTPS  /api/v1/*                                   │ WSS /ws?token=…
┌────────▼────────────────────────── FastAPI app ─────────────▼───────────────────────┐
│ Middleware: CORS, error handlers, request logging                                    │
│ Routers (auth, users, contacts, conversations, messages, uploads)  │ WS endpoint      │
│        │  Depends(get_current_user)                                 │                 │
│ Services (business rules, authorization)  ───── emits events ─────► ConnectionManager│
│        │                                                            (user_id → set of│
│ Repositories / SQLAlchemy models                                     sockets, presence)│
└────────┼──────────────────────────────────────────────────────────────────────────────┘
         ▼
     SQLite file (WAL) + /media (avatars, attachments)
```

**Key flows:**
- **Writes go over REST, push goes over the WebSocket.** The client sends a message via `POST /conversations/{id}/messages`. The service persists it in a transaction, then calls `ConnectionManager.broadcast(member_ids, event)`. Validation, auth and testing stay simple, and the HTTP response is the "sent" ack.
- **Ephemeral signals go over the WebSocket only.** Typing start/stop and heartbeats are never persisted.
- **Delivered is set server-side.** When the server pushes `message.new` to at least one live socket of a recipient, or when the recipient fetches messages or the conversation list after reconnecting, it sets `delivered_at` on that recipient's receipt and pushes `message.status` to the sender.
- **Read is client-initiated.** When the chat is open and the document is visible, the client calls `POST /conversations/{id}/read` with the latest message id.
- **Presence**: online = has ≥1 open socket. On the last disconnect, `users.last_seen_at` is updated and `presence` is broadcast to that user's contacts and co-members.
- **Scope note:** `ConnectionManager` is in-memory and runs as a single process. Scaling out would need Redis pub/sub. That's out of scope and documented as a known limitation.

---

## 6. Project Structure

```
/ (repo root)
├── README.md
├── ARCHITECTURE.md
├── frontend/
│   ├── package.json, tsconfig.json, next.config.ts, eslint.config.mjs, postcss.config.mjs, .env.example
│   ├── public/                      # favicon, logo svg
│   └── src/
│       ├── app/
│       │   ├── layout.tsx           # fonts, providers, theme
│       │   ├── providers.tsx        # QueryClient, Toaster, Theme
│       │   ├── (onboarding)/
│       │   │   ├── welcome/page.tsx
│       │   │   ├── register/page.tsx        # phone/username entry
│       │   │   ├── verify/page.tsx          # OTP
│       │   │   └── profile/page.tsx         # name + avatar
│       │   └── (app)/
│       │       ├── layout.tsx               # auth guard, socket connect, NavRail + ConversationList + outlet
│       │       ├── chats/page.tsx           # empty state ("Select a chat")
│       │       ├── chats/[conversationId]/page.tsx
│       │       ├── calls/page.tsx           # Coming Soon
│       │       └── stories/page.tsx         # Coming Soon
│       ├── components/
│       │   ├── ui/              # Avatar, Button, IconButton, Modal, Input, SearchInput, Badge, Spinner, ComingSoon, Icons
│       │   ├── layout/          # NavRail, SplitPane, PaneHeader
│       │   ├── conversations/   # ConversationList, ConversationListItem, FilterChips, SearchResults
│       │   ├── chat/            # ChatHeader, MessageList, MessageBubble, MessageStatusIcon, DateSeparator,
│       │   │                    # SystemMessage, TypingIndicator, Composer, E2EENotice
│       │   ├── contacts/        # NewChatPanel, AddContactModal, ContactPicker
│       │   ├── groups/          # CreateGroupFlow, ConversationDetailsPanel, MemberList, AddMembersModal
│       │   └── settings/        # SettingsModal, ProfileSection, AppearanceSection, PlaceholderSection
│       ├── hooks/               # useAuth, useConversations, useMessages, useSendMessage, useTyping, usePresence, useKeyboardShortcuts
│       ├── lib/
│       │   ├── api/             # client.ts (fetch wrapper + errors), auth.ts, conversations.ts, messages.ts, contacts.ts, users.ts
│       │   ├── socket/          # socket.ts (connect/reconnect/backoff), eventHandlers.ts (patch query cache)
│       │   ├── format.ts        # Signal-style timestamps, phone formatting
│       │   └── constants.ts
│       ├── stores/              # authStore.ts, uiStore.ts, realtimeStore.ts (typing, presence)
│       ├── types/               # api.ts (DTOs mirroring backend schemas), events.ts (WS event union)
│       └── styles/globals.css   # design tokens (light/dark)
│       └── __tests__/
└── backend/
    ├── pyproject.toml / requirements.txt, .env.example, alembic.ini
    ├── alembic/versions/
    ├── app/
    │   ├── main.py              # app factory, CORS, routers, WS route, startup (create dirs, seed-if-empty)
    │   ├── core/                # config.py (pydantic-settings), security.py (token gen/hash), errors.py
    │   ├── db/                  # base.py, session.py (engine, SQLite pragmas, get_db)
    │   ├── models/              # user.py, session.py, contact.py, conversation.py, member.py, message.py, receipt.py, (reaction.py, attachment.py)
    │   ├── schemas/             # Pydantic request/response DTOs per domain
    │   ├── api/
    │   │   ├── deps.py          # get_db, get_current_user, get_member_or_404, require_admin
    │   │   └── routes/          # auth.py, users.py, contacts.py, conversations.py, messages.py, uploads.py
    │   ├── services/            # auth_service, user_service, contact_service, conversation_service, message_service, presence_service
    │   ├── realtime/            # manager.py (ConnectionManager), events.py (event builders/types), ws.py (endpoint + inbound handler)
    │   └── seed/                # seed.py + seed_data.py (users, contacts, DMs, groups, messages w/ mixed statuses)
    ├── media/                   # gitignored; uploaded avatars/attachments
    └── tests/                   # conftest.py (temp SQLite), test_auth.py, test_conversations.py, test_messages.py, test_groups.py, test_ws.py
```

---

## 7. Frontend Architecture

### 7.1 Routing and layout
- `(onboarding)` route group: welcome → register → verify → profile. A guard redirects authenticated users to `/chats`.
- `(app)` route group layout: an **auth guard** (validates the token via `/auth/me`) plus three columns modelled on Signal Desktop:
  1. **NavRail** (narrow, left): Chats, Calls, Stories, and at the bottom the avatar (profile/settings menu).
  2. **Left pane**: header (title "Chats", compose icon, overflow menu) → search box → filter chips → `ConversationList`.
  3. **Main pane**: `/chats/[conversationId]` → `ChatHeader` (avatar, name, presence/members, call/video icons → Coming Soon, details toggle) → `MessageList` → `Composer`. The optional right slide-over is `ConversationDetailsPanel`.
- **Responsive (bonus):** below `md`, show either the list or the chat (route-driven, with a back button in the chat header). The NavRail becomes a bottom tab bar on mobile.

### 7.2 Key components
- `ConversationListItem`: avatar with online dot, title, last-message preview ("You: …", "Alice: …" in groups, "Typing…" when active), Signal-style relative time, unread count badge (ultramarine pill), and the status icon of my last outgoing message.
- `MessageBubble`: outgoing is ultramarine and right-aligned, incoming is grey and left-aligned. Consecutive messages from the same sender within 3 minutes **cluster** (tighter spacing, corner rounding adjusted, sender name and avatar only on the first message of a group cluster). Footer shows time plus `MessageStatusIcon` (clock = sending, ✓ = sent, ✓✓ outline = delivered, ✓✓ filled = read, ⚠ = failed).
- `DateSeparator` ("Today", "Yesterday", weekday, date), `SystemMessage` (group events), `E2EENotice` (lock and "Messages are end-to-end encrypted" mock), `TypingIndicator` (animated three dots in an incoming bubble, plus avatars in groups).
- `Composer`: auto-growing textarea. Enter sends, Shift+Enter adds a newline. Typing events are throttled. Emoji and attach buttons work if the bonus is done, otherwise they show "Coming Soon". The send button appears only when text is non-empty, like Signal.
- Modals: `AddContactModal`, `CreateGroupFlow` (2 steps), `AddMembersModal`, `SettingsModal`, `ConfirmDialog`, `SafetyNumberModal` (mock).

### 7.3 State management
- **Server state (TanStack Query)**: `['me']`, `['conversations']`, `['conversation', id]`, `['messages', id]` (infinite query, cursor = oldest id), `['contacts']`, `['userSearch', q]`.
- **Client state (Zustand)**:
  - `authStore`: token and user. The token is persisted to `localStorage` (see §11).
  - `realtimeStore`: `typing[conversationId] = {userId: expiresAt}`, `presence[userId] = {online, lastSeenAt}`, `socketStatus`.
  - `uiStore`: active filter, search query, details panel open, theme.
- **Optimistic sending**: `useSendMessage` inserts a temporary message (`client_message_id = uuid`, `status='sending'`) into the messages cache and the conversation preview. On success it replaces it with the server message. On error it sets `status='failed'` and offers a retry that reuses the same `client_message_id` (idempotent on the server).

### 7.4 API and real-time integration
- `lib/api/client.ts`: a typed `fetch` wrapper that adds `Authorization: Bearer`, parses `{error:{code,message}}`, and on 401 clears auth and redirects.
- `lib/socket/socket.ts`: one socket per tab (`wss://…/ws?token=`). It sends a heartbeat ping every 25s and reconnects with exponential backoff (1s → 30s). **On reconnect** it invalidates `['conversations']` and the active `['messages', id]` to recover missed events.
- `eventHandlers.ts` maps each server event to a cache patch: `message.new` (append and move the conversation to the top, increment unread if not active, show a toast), `message.status` (update the status icon), `conversation.updated` / `conversation.removed`, `typing`, `presence`, `messages.read`.
- **Read tracking**: when the chat is open, `document.visibilityState === 'visible'` and the newest message is from someone else, call `POST /conversations/{id}/read` (debounced).

### 7.5 Theming and fidelity
- `globals.css` defines Signal's tokens: ultramarine `#2C6BED`, incoming bubble `#E9E9E9` (light) / `#3B3B3B` (dark), backgrounds `#FFFFFF` / `#121212`, secondary text grey, and avatar colour palette. Measurements come from screenshots of Signal Desktop. Font is Inter at 14px base.
- Dark mode uses the `data-theme` attribute plus `prefers-color-scheme`, toggled in Settings → Appearance (System/Light/Dark), and persists in `localStorage`.
- **Keyboard shortcuts (bonus):** `Ctrl/⌘+N` new chat, `Ctrl/⌘+F` focus search, `Ctrl/⌘+Shift+N` new group, `Alt+↑/↓` previous/next chat, `Esc` closes a modal or panel, `Ctrl/⌘+,` opens settings. There is a shortcuts help modal (`Ctrl/⌘+/`) like Signal's.

---

## 8. Backend Architecture

### 8.1 Layers
- **Routes (`api/routes/*`)**: thin. They parse and validate with Pydantic, resolve dependencies, call one service method and return a response schema. They contain no business logic.
- **Dependencies (`api/deps.py`)**:
  - `get_db()`: request-scoped SQLAlchemy session.
  - `get_current_user()`: reads the Bearer token, hashes it, looks up an unexpired `sessions` row, touches `last_used_at`, and returns the user. Otherwise it returns 401.
  - `get_membership(conversation_id)`: 404 if the user is not a member. This avoids leaking that the conversation exists.
  - `require_active_member` / `require_admin`: 403.
- **Services**: own the business rules and transactions, and emit realtime events *after commit*.
  - `AuthService`: request OTP (mock), verify OTP, create user if new, issue and revoke sessions.
  - `UserService`: profile update, avatar, lookup by phone/username, search.
  - `ContactService`: add, list, remove, search contacts.
  - `ConversationService`: get-or-create direct conversation (via `direct_key`), create group, list with unread counts and previews, member add/remove/leave, admin succession, system messages.
  - `MessageService`: send (idempotent on `(sender_id, client_message_id)`), paginate, create receipts for every active recipient, mark delivered/read, compute aggregate status.
  - `PresenceService`: online set and `last_seen_at`.
- **Realtime (`realtime/`)**:
  - `ConnectionManager`: `dict[user_id, set[WebSocket]]` with `send_to_user`, `send_to_users`, `is_online`.
  - `ws.py`: authenticates from the `token` query param (closes with code 4401 if invalid), registers the socket, marks pending messages delivered, broadcasts presence, then loops over inbound events (`typing.start`/`typing.stop`/`ping`). It authorizes `typing` against membership. On disconnect it unregisters and, on the last socket, sets `last_seen_at` and broadcasts presence.
- **Middleware / app-level**: CORS (frontend origin from env), a global exception handler that maps domain errors (`NotFound`, `Forbidden`, `Conflict`, `ValidationError`) to `{error:{code,message}}`, and simple request logging.
- **Validation (Pydantic)**: phone matches E.164 `^\+[1-9]\d{6,14}$` after normalization. Username `^[a-z0-9_.]{3,32}$`, case-insensitive unique. Display name 1–64 chars, trimmed. Message body 1–4000 chars after trim. Group name 1–64 chars. Group members 1–… (≥1 other member) **[ASSUMPTION: no max group size beyond a sanity cap of 100]**. Avatars must be image MIME types (png/jpeg/webp/gif), ≤ 2 MB, with server-side type sniffing.
- **Seeding (`seed/seed.py`)**: run with `python -m app.seed` and also automatically on startup when the DB is empty. It creates about 8 users with distinct avatar colours (a couple with photos), contacts, about 6 DMs and 2–3 groups (with admins), and about 150 messages spread over the past days. Receipts are mixed (some unread, some delivered-only, some read) so every UI state is visible immediately. The demo credentials are printed in the README and shown on the welcome screen.

### 8.2 Message status model
- `sending`: client-only, before the HTTP response. `failed`: client-only.
- `sent`: persisted message, no recipient receipt delivered yet.
- `delivered`: **all** active recipients have `delivered_at`. A 1:1 chat has exactly one recipient.
- `read`: **all** active recipients have `read_at`.
- The aggregate is computed in `MessageService.status_for_sender()` and included in message DTOs for the sender. When it changes, it is pushed as `message.status`. **[ASSUMPTION]** For groups, the status icon reflects *all* recipients, which matches Signal.

---

## 9. Database Design

SQLite with `PRAGMA foreign_keys=ON` and `journal_mode=WAL`. All timestamps are UTC (`DATETIME`, ISO-8601). PKs are integer autoincrement. Public IDs are the same integers, which is fine for this scope.

### 9.1 Entities

**users**
| column | type | constraints |
|---|---|---|
| id | INTEGER | PK |
| phone_number | TEXT | UNIQUE, nullable (E.164) |
| username | TEXT | UNIQUE (stored lowercase), nullable |
| display_name | TEXT | NOT NULL (empty until profile set → `profile_completed` false) |
| about | TEXT | nullable (Signal's "About" line) |
| avatar_url | TEXT | nullable |
| avatar_color | TEXT | NOT NULL (picked from Signal palette at signup) |
| last_seen_at | DATETIME | nullable |
| created_at, updated_at | DATETIME | NOT NULL |
| | | CHECK (phone_number IS NOT NULL OR username IS NOT NULL) |

**sessions**: auth sessions
| id PK | user_id FK→users ON DELETE CASCADE | token_hash TEXT UNIQUE NOT NULL (SHA-256) | created_at | last_used_at | expires_at NOT NULL | user_agent TEXT nullable |

**otp_requests** (optional, mock): `id, identifier, created_at, attempts`. It is only used to show the flow and rate-limit attempts. **[ASSUMPTION]** This can be dropped since the OTP is fixed. Decision: **omit the table** and use a fixed OTP from config (`MOCK_OTP=123456`).

**contacts**: directed "my address book"
| id PK | owner_id FK→users CASCADE | contact_user_id FK→users CASCADE | nickname TEXT nullable | created_at |
- UNIQUE(owner_id, contact_user_id), CHECK(owner_id <> contact_user_id)

**conversations**
| column | type | constraints |
|---|---|---|
| id | INTEGER | PK |
| type | TEXT | NOT NULL, CHECK IN ('direct','group') |
| name | TEXT | nullable; required when type='group' (CHECK) |
| avatar_url | TEXT | nullable |
| direct_key | TEXT | UNIQUE, nullable; `"{min_user_id}:{max_user_id}"` for direct only, which guarantees one DM per pair |
| created_by | INTEGER | FK→users SET NULL |
| last_message_at | DATETIME | nullable, indexed (drives list ordering; fall back to created_at) |
| disappearing_seconds | INTEGER | nullable (bonus) |
| created_at, updated_at | DATETIME | |

**conversation_members**
| id PK | conversation_id FK→conversations CASCADE | user_id FK→users CASCADE | role TEXT CHECK IN ('admin','member') DEFAULT 'member' | joined_at | removed_at DATETIME nullable (soft-remove keeps history visible to removed user) | last_read_message_id INTEGER nullable (fast unread calc) | muted_until nullable (future) |
- UNIQUE(conversation_id, user_id). Index (user_id, removed_at).
- Active member = `removed_at IS NULL`. Re-adding clears `removed_at` and sets a new `joined_at`.

**messages**
| column | type | constraints |
|---|---|---|
| id | INTEGER | PK |
| conversation_id | INTEGER | FK→conversations CASCADE, NOT NULL |
| sender_id | INTEGER | FK→users SET NULL, nullable (NULL for system) |
| type | TEXT | CHECK IN ('text','system','attachment') |
| body | TEXT | nullable for attachment-only |
| system_event | TEXT (JSON) | nullable, e.g. `{"action":"member_added","actor":1,"targets":[4]}`, rendered client-side |
| client_message_id | TEXT | nullable; UNIQUE(sender_id, client_message_id) for idempotent retries |
| reply_to_id | INTEGER | FK→messages SET NULL (bonus) |
| expires_at | DATETIME | nullable (bonus disappearing) |
| created_at | DATETIME | NOT NULL |
| edited_at / deleted_at | DATETIME | nullable (future-proof; not required) |
- Index (conversation_id, id DESC) for cursor pagination. Index (expires_at) only if the disappearing bonus is done.

**message_receipts**: per recipient, per message (supports group receipts)
| message_id FK→messages CASCADE | user_id FK→users CASCADE | delivered_at nullable | read_at nullable |
- PK(message_id, user_id). Index (user_id, read_at) for unread counts. Index (user_id, delivered_at) to flush pending deliveries on connect.
- A row is created for every *active* member except the sender when a message is inserted. System messages get no receipts and never count as unread.

**Bonus tables (only if the bonus is done):**
- **reactions**: `id, message_id FK CASCADE, user_id FK CASCADE, emoji TEXT, created_at`, UNIQUE(message_id, user_id) (Signal allows one reaction per user).
- **attachments**: `id, message_id FK CASCADE, file_url, file_name, mime_type, size_bytes, width, height, created_at`.

### 9.2 Relationships
- User 1—N Session. User 1—N Contact (as owner). Contact N—1 User (as contact).
- Conversation 1—N ConversationMember N—1 User (many-to-many with role).
- Conversation 1—N Message. User 1—N Message (sender).
- Message 1—N MessageReceipt N—1 User. Message 0..1 → Message (reply_to).

### 9.3 Derived data (computed, not stored)
- **Unread count** = `COUNT(*) FROM message_receipts r JOIN messages m … WHERE r.user_id=:me AND r.read_at IS NULL AND m.conversation_id=:c`. The conversation list does this in one grouped query.
- **Last-message preview** = the latest message per conversation, via a correlated subquery or window function. `last_message_at` is denormalised on `conversations` for cheap sorting.
- **Online** comes from the in-memory ConnectionManager. `last_seen_at` is persisted.

### 9.4 Why this design
- A single `conversations` table for direct and group chats removes duplicate message, membership and receipt logic. `direct_key` enforces DM uniqueness at the DB level.
- A per-recipient receipts table is the correct model for group "delivered/read by all" and per-user unread counts. Storing a single status on the message wouldn't work for groups.
- Soft-removing members keeps history and authorization correct (a removed user can read up to removal and can't send).

---

## 10. API Design

Base: `/api/v1`. Format: JSON. Auth: `Authorization: Bearer <token>` unless the endpoint is marked Public. Errors look like `{"error":{"code":"NOT_FOUND","message":"…"}}` with the matching HTTP status (400/401/403/404/409/413/422). Timestamps are ISO-8601 UTC.

### 10.1 Auth
| Method | Endpoint | Purpose | Request | Response | Auth |
|---|---|---|---|---|---|
| POST | `/auth/request-otp` | Start login/registration (mock). Nothing is sent. | `{identifier: "+15550100" \| "alice"}` | `200 {identifier, is_registered: bool, otp_hint?: "123456" (only when DEMO_MODE)}` | Public |
| POST | `/auth/verify-otp` | Verify the fixed OTP. Creates the user if new. Issues a session. | `{identifier, otp}` | `200 {token, user: UserMe, is_new_user: bool}` / `401 INVALID_OTP` | Public |
| GET | `/auth/me` | Validate the session and get the current user | — | `200 UserMe` | Bearer |
| POST | `/auth/logout` | Revoke the current session | — | `204` | Bearer |

### 10.2 Users / Profile
| Method | Endpoint | Purpose | Request | Response | Auth |
|---|---|---|---|---|---|
| PATCH | `/users/me` | Set or update display name, about, username | `{display_name?, about?, username?}` | `200 UserMe` / `409 USERNAME_TAKEN` | Bearer |
| POST | `/users/me/avatar` | Upload avatar | `multipart file` | `200 UserMe` | Bearer |
| DELETE | `/users/me/avatar` | Remove avatar (back to initials) | — | `200 UserMe` | Bearer |
| GET | `/users/lookup?identifier=` | Find a registered user by exact phone or username (for adding a contact) | query | `200 UserPublic` / `404` | Bearer |
| GET | `/users/{id}` | Public profile (name, avatar, about, presence) | — | `200 UserPublic` | Bearer |

`UserPublic = {id, display_name, username?, phone_number?, avatar_url?, avatar_color, about?, is_online, last_seen_at?}`

### 10.3 Contacts
| Method | Endpoint | Purpose | Request | Response | Auth |
|---|---|---|---|---|---|
| GET | `/contacts?q=` | List or search my contacts | query `q?` | `200 [ContactDTO]` | Bearer |
| POST | `/contacts` | Add a contact | `{user_id}` or `{identifier}` + `nickname?` | `201 ContactDTO` / `409 ALREADY_CONTACT` / `404` / `400 CANNOT_ADD_SELF` | Bearer |
| DELETE | `/contacts/{contact_id}` | Remove a contact | — | `204` | Bearer |

### 10.4 Conversations and groups
| Method | Endpoint | Purpose | Request | Response | Auth |
|---|---|---|---|---|---|
| GET | `/conversations?q=&filter=all\|unread\|groups` | List with preview, unread count, members summary. Sorted by `last_message_at` desc. | query | `200 [ConversationSummary]` | Bearer |
| POST | `/conversations` | Create a DM (idempotent) or a group | `{type:"direct", user_id}` or `{type:"group", name, member_ids[]}` | `201`/`200 ConversationDetail` | Bearer |
| GET | `/conversations/{id}` | Details including members and roles | — | `200 ConversationDetail` | Member |
| PATCH | `/conversations/{id}` | Rename group / change avatar / disappearing timer (bonus) | `{name?, disappearing_seconds?}` | `200 ConversationDetail` | Group admin |
| POST | `/conversations/{id}/members` | Add members | `{user_ids[]}` | `200 ConversationDetail` | Group admin |
| DELETE | `/conversations/{id}/members/{user_id}` | Remove a member | — | `200 ConversationDetail` | Group admin (not self) |
| POST | `/conversations/{id}/leave` | Leave the group (promotes the oldest member to admin if the last admin leaves) | — | `204` | Active member |
| PATCH | `/conversations/{id}/members/{user_id}` | Change role (make/remove admin). **Optional** | `{role}` | `200` | Group admin |
| POST | `/conversations/{id}/read` | Mark read up to a message | `{up_to_message_id}` | `200 {unread_count:0}` + WS `messages.read` to senders | Member |

`ConversationSummary = {id, type, title, avatar_url?, avatar_color, last_message?: MessagePreview, last_message_at, unread_count, is_active_member, other_user?: UserPublic (direct)}`

### 10.5 Messages
| Method | Endpoint | Purpose | Request | Response | Auth |
|---|---|---|---|---|---|
| GET | `/conversations/{id}/messages?before_id=&limit=50` | Cursor-paginated history (newest page first) | query | `200 {items:[MessageDTO], next_cursor?}` | Member (incl. removed: up to `removed_at`) |
| POST | `/conversations/{id}/messages` | Send | `{client_message_id: uuid, body, reply_to_id?}` | `201 MessageDTO (status:"sent")`. A duplicate `client_message_id` returns `200` with the existing message. | Active member |
| POST | `/messages/{id}/reactions` | React (bonus) | `{emoji}` | `200` | Member |
| DELETE | `/messages/{id}/reactions` | Remove my reaction (bonus) | — | `204` | Member |
| POST | `/conversations/{id}/attachments` | Upload attachment message (bonus) | multipart | `201 MessageDTO` | Active member |

`MessageDTO = {id, conversation_id, sender_id?, type, body?, system_event?, client_message_id?, reply_to?: {id, sender_id, body_snippet}, created_at, status? (only for own messages), reactions?, attachments?}`

### 10.6 Misc
| GET | `/health` | Liveness for hosting | — | `200 {ok:true}` | Public |
| GET | `/media/{path}` | Static avatars/attachments | — | file | Public **[ASSUMPTION: unguessable UUID filenames are acceptable for a demo]** |

### 10.7 WebSocket: `GET /ws?token=<session token>`
Envelope: `{"type": "...", "data": {...}}`

**Client → server**
| type | data | effect |
|---|---|---|
| `typing.start` / `typing.stop` | `{conversation_id}` | Broadcast to other active members (membership checked). Not persisted. |
| `ping` | `{}` | Server replies `pong`. Keeps proxies from idling the socket. |

**Server → client**
| type | data |
|---|---|
| `message.new` | `MessageDTO` (+ `conversation` summary fields so the list can update without refetching) |
| `message.status` | `{message_id, conversation_id, status: "delivered"\|"read"}` (to the sender only) |
| `messages.read` | `{conversation_id, user_id, up_to_message_id}` (sync my other tabs' unread counts) |
| `typing` | `{conversation_id, user_id, is_typing}` |
| `presence` | `{user_id, is_online, last_seen_at}` |
| `conversation.updated` | `ConversationDetail` (created, renamed, members changed) |
| `conversation.removed` | `{conversation_id}` (you were removed; the client marks it read-only) |
| `reaction.updated` | `{message_id, reactions}` (bonus) |
| `pong` | `{}` |

Close codes: `4401` invalid/expired token. On a normal close the client reconnects with backoff.

---

## 11. Key Technical Decisions

| Decision | Choice | Alternatives considered / rationale |
|---|---|---|
| Backend framework | FastAPI | Django + Channels: heavier, needs ASGI channel layer config. FastAPI has native WS and Pydantic. |
| Send path | REST POST, WS for push | Sending over WS needs a custom ack protocol and validation. REST gives status codes, idempotency and easy tests. The HTTP 201 *is* the "sent" ack. |
| Delivered semantics | Server marks delivered when it pushes to a live recipient socket, or when the recipient fetches after reconnecting | A client-side "delivered" ack is more faithful but adds round trips. The server-side approach is reliable and explainable. **[ASSUMPTION]** acceptable. |
| Auth tokens | Opaque random tokens, SHA-256 hashed in `sessions`, 30-day expiry | JWT: stateless but logout can't revoke without a denylist. Sessions table = true logout and a better schema story. |
| Token storage on client | `localStorage` + Bearer header (WS via query param) | httpOnly cookie: safer against XSS, but cross-site (Vercel ↔ Render) needs `SameSite=None; Secure` and CSRF handling. Bearer keeps it simple. The XSS risk is mitigated by React escaping and no `dangerouslySetInnerHTML`. Documented trade-off. |
| Unified conversations table | `type` direct/group | Separate DM/group tables would duplicate messages and membership. |
| Receipts table | Per recipient | A single status column can't represent group receipts or per-user unread. |
| Removal | Soft (`removed_at`) | Hard delete loses history and Signal-like "no longer a member" UX. |
| Pagination | Cursor (`before_id`) | Offset breaks while new messages are arriving. |
| Optimistic UI + idempotency | `client_message_id` unique per sender | Safe retries, and no duplicate bubbles when the WS echo and HTTP response race. Dedup is by `client_message_id`. |
| State libs | TanStack Query + Zustand | Redux is heavier. Context alone re-renders too much with WS traffic. |
| Presence | In-memory sockets + persisted `last_seen_at` | Real presence (not mocked) at almost no cost. |
| Encryption | UI-only simulation (E2EE notice, mock safety number), plaintext in DB | Explicitly allowed by the PDF. Documented in the README. |
| Hosting | Vercel + Render/Railway (persistent disk) | Vercel serverless can't hold WS connections. SQLite needs a persistent volume. |

---

## 12. Edge Cases and Error Handling

**Auth / onboarding**
- Wrong OTP → 401 with inline error "Incorrect code". Allow retries, with a simple in-memory per-identifier limit (e.g. 5/min) → 429.
- Invalid phone or username format → 422 with an inline field error. Phone is normalized (spaces, dashes, leading `00`).
- User abandons before profile setup → `display_name` is empty → on next login, routed back to profile setup (`profile_completed=false`).
- Expired or revoked token → 401 → client clears state and goes to onboarding. WS closes with 4401 and the client does not reconnect.
- Multiple tabs or devices → multiple sessions and sockets per user. Events fan out to all of them. Logout revokes only the current session.

**Contacts / conversations**
- Adding self → 400. Adding an existing contact → 409, and the UI opens the existing chat. Unknown identifier → 404 "No Signal user found".
- Creating a DM that already exists → returns the existing one (`direct_key`), and a race is handled by catching the unique violation and re-reading.
- DM with a non-contact (e.g. they messaged first) → allowed. The UI shows Signal's "message request"-style banner **[ASSUMPTION: simplified to just showing their phone/username]**.
- Group with an empty name or no other members → 422.
- Accessing a conversation you are not part of → 404 (no existence leak).

**Messaging**
- Empty or whitespace-only message → the send button is hidden and the server returns 422. Over 4000 chars → 422 (the client shows a counter near the limit).
- Network failure while sending → bubble shows "failed" with retry. Retry uses the same `client_message_id` → no duplicate.
- WS disconnected → a banner/indicator appears and sending still works via REST. On reconnect, refetch the list and the active chat, and flush pending deliveries server-side.
- Messages arriving out of order or duplicated (HTTP response vs WS echo) → merge by `id` / `client_message_id` and sort by `(created_at, id)`.
- Read receipts only when the tab is visible and the chat is focused. Never mark your own messages read.
- Typing indicator stuck after a crash → client expires it after 5s without refresh. Server sends `typing.stop` for that user on socket close.
- Very long words/URLs → `overflow-wrap:anywhere` in bubbles. User text is rendered as text, never HTML. Links are linkified safely with `rel="noopener noreferrer"`.
- Timezones → stored in UTC, rendered in local time. Date separators are computed client-side.

**Groups**
- A non-admin trying to add or remove → 403 (the UI also hides the controls).
- Admin removes self → use "Leave" instead (400 on the remove endpoint).
- Last admin leaves → the oldest remaining member is promoted. Last member leaves → the group remains but is inactive **[ASSUMPTION]**.
- Adding an existing active member → no-op/skip. Re-adding a removed member → reactivated, with a new system message.
- A removed member's open chat → `conversation.removed` event switches the composer to the "no longer a member" banner. Their sends return 403.
- A message sent while a member is being removed → receipts only for active members at insert time (handled in the transaction).

**Uploads (avatar / bonus attachments)**
- Wrong type or too large → 413/422 with a toast. Filenames are server-generated UUIDs.

**General**
- Unexpected server error → 500 with a generic message, logged server-side, and the client shows a toast "Something went wrong".
- SQLite "database is locked" under concurrent writes → WAL + `busy_timeout=5000`, with short transactions.

---

## 13. Security Considerations
- **Mocked auth is still enforced auth.** Every non-public endpoint and the WS handshake require a valid session. The fixed OTP is configurable and only advertised when `DEMO_MODE=true`.
- **Session tokens**: 32-byte `secrets.token_urlsafe`. Only the SHA-256 hash is stored. They expire after 30 days and logout revokes them. The WS token in the query string is a known trade-off: it is never logged (log redaction) and always sent over WSS.
- **Authorization**: membership checks on every conversation, message, read and typing operation. Admin checks for member management. A removed member can only see history up to `removed_at`. Contacts are scoped to their owner.
- **Input validation**: Pydantic schemas with length and format limits. Server-side MIME sniffing and size caps for uploads. Parameterized queries via SQLAlchemy (no SQL injection).
- **XSS**: React escapes by default and `dangerouslySetInnerHTML` is never used. Links are sanitized to http/https only.
- **CORS**: an allowlist of the deployed frontend origin plus localhost in dev. WS origin is checked against the same list.
- **Data protection**: no real phone verification, so the README warns not to use real numbers. Phone numbers of non-contacts can be partially masked in search results **[ASSUMPTION: optional]**. Plaintext message storage is documented as the simulated-E2EE assumption.
- **Abuse limits**: simple rate limits on OTP verify and message send (in-memory, per user), and a message length cap.
- **Secrets/config**: `.env` files are gitignored and `.env.example` is committed. No secrets in the frontend bundle except the public API URL.
- **Transport**: HTTPS/WSS in production (provided by Vercel/Render).

---

## 14. Implementation Plan (ordered phases)

| Phase | Scope | Exit criteria |
|---|---|---|
| **0. Groundwork** (≈1h) | Study Signal Desktop and mobile UI (screenshots, colours, spacing). Init the repo with `frontend/`, `backend/`, `.gitignore` and env examples. | Repo skeleton runs a "hello" on both sides. |
| **1. Backend core** (≈3h) | Config, DB session with SQLite pragmas, all models + Alembic initial migration, error handling, CORS, health. | Migration creates the schema and it is inspected. |
| **2. Auth & profile** (≈2h) | request/verify OTP, sessions, `/auth/me`, logout, PATCH me, avatar upload. Tests. | pytest auth suite green. |
| **3. Contacts & conversations API** (≈3h) | Lookup, contacts CRUD, DM get-or-create, group create, list with unread/preview/filter/search, details, members add/remove/leave. Tests. | pytest suite green. |
| **4. Messages + realtime** (≈3h) | Send (idempotent), paginate, receipts, read endpoint, ConnectionManager, WS endpoint (auth, typing, presence, delivery flush), event emission after commit. WS tests. | Two TestClient sockets exchange messages and receipts. |
| **5. Seed data** (≈1h) | Seed script plus auto-seed on empty DB. | Fresh DB → usable demo accounts. |
| **6. Frontend foundation** (≈2h) | Next.js + Tailwind tokens + Inter, API client, auth store, route groups and guards, app shell (NavRail + split pane). | Login flow reaches an empty main view. |
| **7. Onboarding UI** (≈1.5h) | Welcome, phone/username, OTP, profile setup (avatar upload + initials) matching Signal. | Register and login work end to end. |
| **8. Conversation list** (≈2h) | List items, search (conversations + contacts), filter chips, unread badges, presence dots, new chat panel, add contact modal, create group flow. | List matches Signal visually and updates live. |
| **9. Chat pane** (≈3h) | Header, message list (infinite scroll, clustering, date separators, system messages, E2EE notice), bubbles, status icons, composer, typing indicator, optimistic send/retry, read tracking. | Two browsers chat in real time with correct ticks. |
| **10. Group management & UX polish** (≈1.5h) | Details panel, member list, add/remove/leave, admin badges, toasts, notifications, settings modal + placeholders, Calls/Stories/Linked devices "Coming Soon", safety number mock. | All core features done. |
| **11. Bonus (by value/effort)** (≈remaining) | 1) Dark mode, 2) Responsive, 3) Keyboard shortcuts, 4) Reply/quote, 5) Reactions, 6) Attachments, 7) Disappearing messages. Their schema columns already exist. | Each bonus is independently shippable. |
| **12. Deploy & docs** (≈1.5h) | Backend on Render/Railway with a persistent disk, frontend on Vercel, env vars, CORS/WSS check. README (setup, stack, architecture, schema, API, assumptions). Make the repo public. | Hosted link works with seeded data across two browsers. |

---

## 15. Testing Strategy

**Backend (pytest, primary focus):** each test uses a temp SQLite DB fixture.
- *Unit (services)*: DM `direct_key` uniqueness, aggregate status computation (sent/delivered/read across group recipients), unread count, admin succession on leave, idempotent send, phone/username normalization.
- *API (TestClient)*: auth flow (wrong OTP, new vs existing user, logout revokes), authorization matrix (non-member → 404, non-admin → 403, removed member can't send), validation errors (422s), pagination cursors, search and filters.
- *WebSocket (TestClient.websocket_connect)*: invalid token → 4401. Message push to the recipient. Delivered status pushed back to the sender. Read → `message.status read`. Typing relayed only to members. Presence online/offline + `last_seen_at`.
- *Seed*: the seed runs on an empty DB and is idempotent / skipped when data exists.

**Frontend (Vitest + React Testing Library):**
- Pure utils: Signal timestamp formatting, message clustering/grouping, status icon mapping, phone formatting.
- WS event reducers: `message.new` / `message.status` / `typing` patch caches correctly. Dedup by `client_message_id`.
- Components: `MessageBubble` (status icons, own vs other), `ConversationListItem` (unread badge, preview prefix), `Composer` (Enter vs Shift+Enter, hidden send on empty), OTP form validation.

**End-to-end (optional Playwright smoke, two browser contexts):** User A logs in → messages B → B sees it live → B opens the chat → A sees read ticks. Group create → add/remove member reflected for both.

**Manual QA checklist before submission:** walk through §16 on the deployed link with two browsers. Check light/dark, mobile/desktop widths, reload persistence, and logout.

---

## 16. Assignment Checklist

Status legend: ☐ todo. Each row maps a PDF requirement to the implementation task(s) that fulfil it.

### Tech stack (PDF: Technical Stack)
- [ ] Frontend in Next.js + TypeScript → Phase 6
- [ ] Backend in Python FastAPI → Phase 1
- [ ] SQLite with own schema → §9, Phase 1
- [ ] Real-time via WebSockets → §10.7, Phase 4

### 1. Authentication / Onboarding
- [ ] Register with phone number **or** username → `POST /auth/request-otp`, `/auth/verify-otp`, register page
- [ ] Verification mocked with a fixed OTP → `MOCK_OTP` config, OTP page with hint
- [ ] Set display name → profile setup page, `PATCH /users/me`
- [ ] Set profile avatar → avatar upload + initials fallback, `POST /users/me/avatar`
- [ ] Login → same OTP flow for existing users
- [ ] Logout → `POST /auth/logout`, Settings → Log out
- [ ] Session persistence → `sessions` table, token in localStorage, `/auth/me` on load
- [ ] Crypto key exchange mocked → E2EE notice + safety number modal

### 2. Contacts & Conversation List
- [ ] Signal main view with left-hand chat list → `(app)/layout.tsx`, NavRail + ConversationList
- [ ] Sorted by most recent activity → `conversations.last_message_at` index, live reorder on `message.new`
- [ ] Search conversations **and** contacts → `?q=` on `/conversations` + `/contacts`, SearchResults sections
- [ ] Add a new contact → `GET /users/lookup`, `POST /contacts`, AddContactModal
- [ ] Unread indicators → receipts-based `unread_count`, badge in list item
- [ ] Last-message preview → `last_message` in ConversationSummary
- [ ] Online / last-seen indicators → ConnectionManager presence + `users.last_seen_at`, `presence` WS event

### 3. One-on-One Messaging
- [ ] Send/receive text in real time → `POST …/messages` + WS `message.new`
- [ ] Message timestamps → `created_at`, bubble footer, date separators
- [ ] Delivery/read receipts (single/double check) → `message_receipts`, `MessageStatusIcon`
- [ ] Typing indicators → WS `typing.*`, TypingIndicator component
- [ ] Status sending → optimistic client state
- [ ] Status sent → HTTP 201 response
- [ ] Status delivered → server delivery marking + `message.status`
- [ ] Status read → `POST …/read` + `message.status`
- [ ] All messages persisted → `messages` table, reload test

### 4. Group Messaging
- [ ] Create group with name and members → `POST /conversations` type=group, CreateGroupFlow
- [ ] Send/receive group messages → same message pipeline, sender names in bubbles
- [ ] View group members → `GET /conversations/{id}`, ConversationDetailsPanel
- [ ] Add members (admin) → `POST …/members`, AddMembersModal, system message
- [ ] Remove members (admin) → `DELETE …/members/{uid}`, confirm dialog, system message
- [ ] Admin controls enforced → `require_admin` dependency + UI gating
- [ ] All group data and messages persist → `conversations`, `conversation_members`, `messages`

### 5. Signal Experience
- [ ] Navigation and layout (list + chat pane) → NavRail + split pane matching Signal Desktop
- [ ] Message bubbles and threading → MessageBubble clustering, date separators, system messages
- [ ] Forms → onboarding, profile, group name, add contact
- [ ] Modals → Add contact, New group, Add members, Settings, Confirm, Safety number
- [ ] Search → chat list search
- [ ] Filters → All / Unread / Groups chips
- [ ] Notifications / toasts → sonner toasts for incoming messages and actions (+ optional browser Notification)
- [ ] Settings placeholders: privacy, notifications, appearance → SettingsModal sections
- [ ] Feels like Signal, not a generic chat app → design tokens, Inter, Signal colours/icons, empty states, E2EE notice

### Mocked / Placeholder Sections
- [ ] Voice / video calls → Calls tab + header call buttons → "Coming Soon"
- [ ] Stories → Stories tab → "Coming Soon"
- [ ] Linked devices → Settings section → "Coming Soon"
- [ ] E2E encryption simulated → "Messages are end-to-end encrypted" notice, lock icons, mock safety number

### Bonus (optional)
- [ ] Attachments (images/files) → `attachments` table, upload endpoint, image preview bubble
- [ ] Message reactions → `reactions` table, reaction picker, `reaction.updated`
- [ ] Reply-to / quoted messages → `messages.reply_to_id`, quote block in bubble and composer
- [ ] Disappearing messages (functional) → `conversations.disappearing_seconds`, `messages.expires_at`, background cleanup task + client timer
- [ ] Dark mode → CSS tokens + Appearance setting
- [ ] Responsive (mobile/tablet/desktop) → breakpoint layouts, list/chat toggle on mobile
- [ ] Keyboard shortcuts → `useKeyboardShortcuts` + help modal

### Important Notes
- [ ] UI totally resembles Signal → Phase 0 study, design tokens, side-by-side visual review
- [ ] Seed DB with multiple users, conversations and messages → `app/seed`, auto-seed on empty DB
- [ ] Own DB schema (evaluated) → §9 implemented with constraints and indexes
- [ ] README includes setup, tech stack, architecture overview, DB schema, assumptions → Phase 12
- [ ] Original work (no plagiarism) → hand-written code, no copying from Signal-Desktop or clone repos

### Deliverables & Submission
- [ ] Public GitHub repo with `frontend/` and `backend/`
- [ ] README also includes an API overview
- [ ] Hosted working demo link (frontend Vercel, backend Render/Railway)
- [ ] Submit both the repo link and the deployed link

### Evaluation readiness
- [ ] Functionality: all core features + real-time verified on the deployed link with two browsers
- [ ] UI/UX: visual comparison against Signal screenshots
- [ ] DB design: FKs, unique constraints, indexes, documented ERD in README
- [ ] Backend/API: layered routes/services, consistent errors, OpenAPI at `/docs`
- [ ] Code quality and modularity: lint/format (ruff, eslint/prettier), small components, typed DTOs
- [ ] Code understanding: be able to explain each decision in §11

---

## Assumptions & Open Questions

**Assumptions**
1. **Signal Desktop** (three-column: nav rail, chat list, chat pane) is the primary visual reference, since the PDF describes a "left-hand conversation list + chat pane". Mobile layout follows Signal Android/iOS when the responsive bonus is done.
2. One onboarding flow handles both registration and login (Signal has no passwords). Fixed OTP `123456`.
3. Users can register with a phone number *or* a username. Lookup for adding contacts works with either.
4. "Add a new contact" means adding an **existing registered user**, found by phone or username, to my contact list. There is no invite flow for non-users.
5. "Filters" = chat-list filter chips All / Unread / Groups.
6. Delivered is determined server-side (pushed to a live socket, or fetched after reconnect).
7. Group delivered/read ticks require **all** recipients.
8. Group admin = creator. Admins can add and remove. Promoting other admins is optional. Last admin leaving promotes the oldest member.
9. Messages are stored in plaintext. E2EE is UI-simulated only, as the PDF allows.
10. Online/last-seen is real (socket-based) rather than mocked, since it's cheap. Privacy toggles for it are placeholders.
11. Theme preference is stored client-side only (no DB table).
12. Message max length is 4000 characters. Avatar max size is 2 MB.

**Open Questions**
1. **Hosting persistence**: Render's free tier has an ephemeral disk (the SQLite DB and uploads reset on redeploy or spin-down). Options: Render paid disk, a Railway volume, or accept the reset with auto-seed on startup. Which platform/budget?
2. **Which bonus features to prioritise** in the ~24h budget? The proposed order is dark mode → responsive → shortcuts → reply → reactions → attachments → disappearing.
3. GitHub remote: a local git repo exists (`main`), but no remote has been added yet.

**Resolved decisions**
- Backend framework: **FastAPI** (confirmed).
- Fidelity target: **Signal Desktop** (confirmed). Mobile layout only for the responsive bonus.
