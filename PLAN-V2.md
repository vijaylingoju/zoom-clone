# Zoom Clone V2 — Replicate the Real Zoom Workplace Web App

> **Source of truth:** live walkthrough of the logged-in Zoom Workplace web app (app.zoom.us, June 2026),
> captured in `zoom-ref/*.png`. Every spec below cites what was actually observed.
> **Goal:** V1 satisfied F1–F4 functionally; V2 makes the app *look and flow* like the real
> Zoom web app — same shell, same screens, same copy — while keeping V1's backend/WebRTC core.
> **Status: PLAN ONLY — nothing here is implemented until you approve it.**

---

## 1. Gap analysis — V1 vs real Zoom Workplace


| Area               | V1 (what we built)                                              | Real Zoom web app (observed)                                                                                                                                                                                                                                                         | Verdict                    |
| ------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| App shell          | White top navbar, gray page, centered cards                     | **Left icon sidebar** (Home, Meetings, Chat, More, Settings at bottom) + **top bar** with back/forward/history, centered **Search Ctrl+K** pill, "Upgrade to Pro", avatar with green presence dot                                                                                    | Rebuild shell              |
| Dashboard          | 2×2 action tiles in a card + clock card + upcoming/recent cards | Big centered **clock + date**, three round-square buttons (**New meeting** orange with dropdown chevron, **Join** blue, **Schedule** blue), calendar-connect banner, **"Today" agenda** with date navigation and beach-umbrella empty state                                          | Rebuild Home               |
| Meetings list      | Dashboard cards only                                            | Dedicated **Meetings tab, master-detail**: left list (Upcoming, PMI card pinned top), right detail pane with **Start / Copy Invitation / Edit** + "Show Meeting Invitation"                                                                                                          | New screen                 |
| PMI                | Doesn't exist                                                   | **Personal Meeting ID** (formatted `434 760 6497`): pinned card, "New meeting" dropdown has "Use my Personal Meeting ID (PMI)" checkbox, PMI room restartable                                                                                                                        | New concept (schema + API) |
| Join               | Card on gray page, name field next to ID                        | In-shell page: heading **"Join Meeting"**, single input **"Meeting ID or Personal Link Name"**, Cancel + Join (disabled until input). Name is asked later (guests only)                                                                                                              | Rebuild                    |
| Schedule           | Modal on dashboard                                              | **Full-page form**: Topic + "Add Description", When (date/time/AM-PM), Duration (hr+min selects), Time Zone, Recurring checkbox, Invitees, **Meeting ID: ⦿ Generate Automatically / ○ PMI**, Security (Passcode, Waiting Room), Video (Host on/off, Participant on/off), Save/Cancel | Rebuild as page            |
| Pre-join           | Custom lobby w/ preview + name + toggles                        | **Permission card flow** on dark stage: "Do you want people to **see** you…?" → [Use microphone and camera] / "Continue without…", then "…**hear** you…?" step; logged-in users never type a name                                                                                    | Rebuild flow               |
| Room stage         | Our grid + header text                                          | Dark stage, **square initial-avatar tile** when video off, name label bottom-left with red mic-slash, **green shield (meeting info) top-left**, **View top-right**, device-permission **toast banner** top-center                                                                    | Re-skin                    |
| Control bar        | Static bar: mute/video/participants/leave                       | **Auto-hiding** bar: Mute˄ · Video˄ ｜ Participants(count)˄ · Chat˄ · React · Share˄ · Host tools · AI Companion · More ｜ red **End**                                                                                                                                                 | Rebuild                    |
| Meeting info       | Header text + copy icon                                         | Shield popover: Meeting ID, Host, Passcode, Invite Link + **Copy Link**, Encryption                                                                                                                                                                                                  | New popover                |
| Participants panel | Light-on-dark list + invite                                     | Dark dock: "Participants (N)" + collapse/pop-out/close, rows `Name (Host, me)` + mic/cam state icons, footer **Invite / Mute All / More**                                                                                                                                            | Re-skin + host controls    |
| Chat               | Not built                                                       | **Meeting Chat** panel stacked under Participants: "to: Everyone" pill, "Type message here …", emoji/file toolbar, send                                                                                                                                                              | New feature                |
| End flow           | Leave → "You left" page                                         | End button → menu: **End Meeting for All** / **Leave Meeting** / Cancel                                                                                                                                                                                                              | New menu                   |


Out of scope but visible in real Zoom (will be **visual placeholders or omitted**, listed in README):
Chat tab contents, More menu apps (Docs/Whiteboards/Clips), AI Companion functionality, calendar
OAuth connect, React(ions) sending, Share screen (button present, disabled like V1), recurring
meetings (checkbox disabled), invitee emails, Upgrade-to-Pro flow, Search functionality.

---

## 2. V2 screen specs (from `zoom-ref/` captures)

### 2.1 App shell (every page)

- **Top bar (white, h≈52px):** left "zoom Workplace" wordmark; center group: ‹ › history arrows (disabled), clock-history icon, **Search pill** (gray `#ECECEC`, magnifier, "Search Ctrl+K" — opens a stub palette); right: blue **Upgrade to Pro** button (links nowhere / toast), **avatar** (initials, green presence dot) → menu (name/email, Settings, Sign out — stubs).x
- **Left sidebar (white, w≈84px, icon over 11px label):** Home, Meetings, Chat (placeholder pane "Chat is coming soon" or hidden roster), **More** (popover listing Docs/Whiteboards/Notes — non-functional), gear **Settings** pinned bottom. Active tab = light-gray rounded square highlight.
- Content area has a subtle 1px border / rounded top-left like the PWA frame.

### 2.2 Home tab (`zoom-ref/more-menu.png` = canonical)

- Centered **clock** (~48px semibold) + "Friday, June 12" below.
- Three centered actions (~64px rounded-2xl squares, label *below*):
  1. **New meeting** — orange `#FF742E`, camera icon, **chevron** opens dropdown with ☑ "Use my Personal Meeting ID (PMI) 434 760 6497"; clicking the tile starts an instant meeting (with PMI if checked) → room.
  2. **Join** — Zoom blue, `+` icon → `/join` page.
  3. **Schedule** — Zoom blue, calendar icon → `/schedule` page.
- Info banner: ⓘ "You haven't connected your calendar yet. **Connect now** …" (link → toast "Not available in this demo").
- **Agenda card:** header "Today, Jun {d} ˅" + pop-out icon; toolbar `[📅 Today] ‹ ›` + "…"; body = meetings for the selected day (time, title, Start button on hover) or the **empty state**: umbrella illustration + "No meetings scheduled."
→ satisfies "Upcoming meetings section" (F1). **Recent** lives in Meetings→Previous (2.3) + History icon opens a small "Recent meetings" dropdown — keeps the requirement while staying Zoom-faithful.

### 2.3 Meetings tab (`zoom-ref/meetings-tab2.png`)

- **Left pane (w≈360px):** refresh icon; segmented tabs **Upcoming / Previous** (Previous = our recent list — Zoom shows Upcoming only for free accounts, we add Previous to satisfy F1-recent); pinned **PMI card** (blue when selected: big formatted code + "My Personal Meeting ID (PMI)"); list items: date group headers, title + time; "No upcoming meetings" centered when empty; bottom link "Add a calendar" (stub).
- **Right detail pane:** H1 = meeting title ("My Personal Meeting ID (PMI)" for PMI), code line, buttons: **Start** (blue, or **Edit/Delete** for scheduled), **Copy Invitation** (copies block), **Edit**; link "Show Meeting Invitation" → expandable invitation text block (`Join Zoom Meeting\n{link}\nMeeting ID: … Passcode: …`).

### 2.4 Join page (`zoom-ref/join-page.png`)

- In-shell, content centered-left: H1 **"Join Meeting"**, one rounded input "Meeting ID or Personal Link Name" (accepts `abc-defg-hjk`, PMI digits, or pasted link), buttons right-aligned: Cancel (→ Home) + **Join** (disabled until non-empty). Errors inline below input ("Meeting not found", "has ended").

### 2.5 Schedule page (`zoom-ref/schedule-form-full.png`, simplified to relevant rows)

Full-page form ("Schedule Meeting" H1, labeled rows, Save/Cancel after Meeting ID section):

- **Topic** (default "My Meeting") + "+ Add Description" toggle reveals textarea.
- **When**: date picker + time + AM/PM; **Duration**: `hr` + `min` selects (0–24h / 0,15,30,45).
- **Time Zone**: select, default browser TZ (display + stored).
- ☐ Recurring meeting (disabled, tooltip "Not in demo").
- **Meeting ID**: ⦿ Generate Automatically ○ Personal Meeting ID {pmi}.
- **Security**: **Passcode** (default on, random 6-char, editable) — enforced at join; ☐ **Waiting Room** (functional = bonus, see §5; otherwise store + show only).
- **Video**: Host on/off, Participant on/off radios (sets initial camera state in room).
- **Save** → Meetings tab with the new meeting selected (detail pane), like Zoom's redirect.

### 2.6 Pre-join + guest name (`zoom-ref/room-prejoin.png`)

- Route `/meeting/{code}` renders the **dark stage immediately** with name label bottom-left; centered **white card**: illustration, "**Do you want people to see you in the meeting?**", subtitle "You can still turn off your microphone and camera anytime in the meeting", blue **[📹 Use microphone and camera]**, link "Continue without microphone and camera". (Single combined step — Zoom's second "hear you" card is a browser-permission artifact we don't need.)
- **Guests** (no session): before the permission card, Zoom-style name screen: "Enter your name to join", input, ☐ Remember my name, **Join** button.
- Passcode-protected links missing `?pwd=` → passcode entry screen.

### 2.7 Meeting room (`zoom-ref/room-ingame.png`, `room-controlbar` a11y tree, `room-info.png`, `room-end-dialog.png`)

- **Stage:** near-black `#1A1A1A` center, darker `#0F0F0F` gutters; video-off participant = centered **square tile** (~96px, generated solid color, white initial); with video = our existing tile grid; name label chip bottom-left of stage/tile with red mic-slash icon when muted; top-center **toast** "Please enable access to your microphone and camera … ×" when devices skipped.
- **Top of stage:** left = green **shield** → **Meeting info popover**: rows Meeting ID / Host / Passcode / Invite Link (+ blue **Copy Link**) / Encryption "Enabled"; right = "View" button (Gallery/Speaker toggle — stretch, default Gallery).
- **Control bar** (auto-hide after ~3s idle, reappear on mousemove; h≈64px, `#1A1A1A`):
left `Mute˄ | Video˄` · center `Participants(badge)˄ · Chat˄ · React · Share˄ · Host tools · AI Companion · More` · right red **End**. Chevrons open device-pick menus (functional for mic/cam via `enumerateDevices`); React/Share/Host tools/AI Companion render but show "Not available" tooltip or minimal menus (Host tools → mute all / remove come from §5 if time).
- **End menu:** anchored popover: red **End Meeting for All** (host; ends meeting server-side for everyone) / **Leave Meeting** / Cancel. Non-hosts get a red **Leave** button directly.
- **Participants panel** (right dock, `#232323`, w≈400px): header "Participants (N)" + collapse/pop-out(×) icons; rows: round avatar, "Name (Host, me)", hover → host actions; right-aligned mic + camera state icons (red slash variants); footer **Invite** (copies invite link, toast) / **Mute All** (host) / **More**.
- **Meeting Chat panel** stacks below Participants (both open simultaneously, observed): header "Meeting Chat" + same icon set; messages list (sender name, time, text); footer "Who can see your messages?" hint row, "to: **Everyone**" pill, input "Type message here …", emoji/file icons (stubs), send icon. Messages persist to `chat_messages` + broadcast over the existing WS.

---

## 3. Schema deltas (consistent with PLAN.md §3 rules)


| Change                                                                                                                                                                                                                      | Why (observed feature)                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `users.pmi_code TEXT UNIQUE` (10-digit numeric, display-formatted `xxx xxx xxxx`)                                                                                                                                           | PMI card, dropdown checkbox, PMI scheduling option |
| `meetings.is_pmi INTEGER DEFAULT 0` + allow re-activating an `ended` PMI meeting on Start                                                                                                                                   | PMI room is persistent/restartable                 |
| `meetings.passcode TEXT` (plaintext, replaces use of `passcode_hash` for now — **deliberate deviation**: Zoom shows the passcode in info popover & invitation, so it must be retrievable; production note: encrypt at rest) | Security section, info popover, Copy Invitation    |
| `meetings.timezone TEXT`                                                                                                                                                                                                    | Schedule form Time Zone row                        |
| `meeting_settings.host_video_on INTEGER DEFAULT 1`, `participant_video_on INTEGER DEFAULT 1`                                                                                                                                | Video host/participant radios                      |
| `chat_messages` — no change (already designed)                                                                                                                                                                              | Meeting Chat                                       |
| Seed: default user gets `pmi_code`; PMI meeting row; sample scheduled meetings keep agenda non-empty                                                                                                                        | Demo-clean dashboard                               |


API deltas: `GET /api/meetings/previous` (alias of recent), `POST /api/meetings/{code}/start` (re-activate PMI/scheduled), `GET/POST /api/meetings/{code}/chat`, `GET /api/me` now returns `pmi_code`; create-meeting accepts `use_pmi`, `passcode`, `timezone`, video defaults; join validates passcode (`?pwd=` or entry screen). WS adds `chat` and host-control messages (`host-mute-all`, `host-remove`) — already in PLAN.md §2.8 catalog.

---

## 4. Build order (each step lands working + verified before the next)


| #    | Step                         | Scope                                                                                                          | Exit criterion                                                                       |
| ---- | ---------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| V2.1 | **App shell**                | Sidebar + top bar + tab routing, stub Chat/More/Search/avatar menu                                             | Navigate Home↔Meetings in the new shell                                              |
| V2.2 | **Backend deltas**           | Schema changes + PMI + passcode + start/chat endpoints + seed; tests updated                                   | pytest green; curl-through of new endpoints                                          |
| V2.3 | **Home tab**                 | Clock, 3 buttons + New-meeting dropdown w/ PMI, banner, agenda day-navigator + empty state                     | Click-through: instant meeting (±PMI) → room; agenda shows seeded meeting on its day |
| V2.4 | **Meetings tab**             | Master-detail, Upcoming/Previous, PMI card, Start/Copy Invitation/Edit/Delete, Show Meeting Invitation         | Schedule → appears in list → Start → room; invitation block copies                   |
| V2.5 | **Schedule + Join pages**    | Full form (incl. Meeting ID radio, passcode, video defaults) + new Join page                                   | F3/F4 flows in new UI incl. passcode join                                            |
| V2.6 | **Room re-skin**             | Permission-card pre-join, guest name screen, stage/tiles/labels, auto-hide control bar, info popover, End menu | Two browsers: full Zoom-look meeting end-to-end                                      |
| V2.7 | **Panels**                   | Participants dock (+ Invite) and **Meeting Chat** (persisted, live) ; host **Mute All / Remove** via WS        | Two browsers: chat both ways; host mutes/removes the guest                           |
| V2.8 | **Polish + deploy + README** | Responsive pass, empty/error states, Vercel+Render, README v2 with placeholder disclosure                      | Deployed link demo-clean                                                             |


Reused from V1 unchanged: `PeerManager`, `SignalingClient`, `useMeetingConnection`, `useLocalMedia`
(minus the lobby UI), repositories/services layering, meeting-code generator, UTC handling.
V2 is ~80% frontend re-skin, ~20% backend additions.

**Honesty note on scope:** V2.1–V2.6 ≈ one focused day; V2.7–V2.8 ≈ half a day more. If the
submission deadline bites, the demo is coherent after **V2.6** (panels from V1 still work,
just less Zoom-styled).

---

## 5. Bonus coverage after V2

- **Host controls** (assignment bonus): Mute All + Remove participant land in V2.7 via the existing WS seam — server validates `role == host`.
- **Responsive** (bonus): V2.8 pass; sidebar collapses to bottom bar on mobile like the PWA.
- **Auth** (bonus): unchanged seam (`get_current_user()`); not part of V2 unless asked.

## 6. Open questions for review

1. **Recent meetings placement** — agreed to put them under Meetings → "Previous" (+ History icon dropdown)? Or also keep a small "Recent" card on Home (less Zoom-faithful, more literal to the requirement doc)?
2. **Waiting room** — store/display only (fast) or functional admit flow (host sees "X is waiting → Admit") in V2.7 (adds ~1–2h)?
3. **Passcode** — default ON for scheduled meetings (like real Zoom) or OFF to keep demo joins frictionless?
4. **Chat tab** in sidebar — hide it, or show with an empty "team chat" placeholder pane?

