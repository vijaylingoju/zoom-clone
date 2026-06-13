# PLAN-V3 — Meeting Room Parity with Real Zoom

> Based on a live walkthrough of the actual Zoom Workplace meeting room
> (joined `82922346655`, June 2026). **Plan only — nothing implemented until approved.**
> Captures in `zoom-real-room.png`, `zoom-view-menu.png`, `zoom-react-menu.png`, `zoom-more-menu.png`.

---

## A. What the real Zoom room has vs our V2 room

| Area | Real Zoom (observed) | Our V2 room | Gap |
|------|----------------------|-------------|-----|
| Top bar | "zoom Workplace" wordmark left; right = green **encryption shield**, **View** button, avatar | none (only a floating shield top-left of stage) | **Add room top bar** |
| Layout | **Speaker View** default: thumbnail filmstrip on top + large active-speaker tile; **Gallery**, **Multi-speaker** options | Gallery grid only | **Add Speaker view + View menu** |
| Active speaker | **green border** on whoever is talking; auto-promoted to main stage | none | **Active-speaker detection** |
| Control bar | Mute▴ · Video▴ · Participants▴(count) · Chat▴ · **React** · Share · **AI Companion** · **More** · red **Leave** | Mute · Video · Participants · Chat · Share · End/Leave | **Add React, More, device chevrons** |
| React | emoji reactions (👏👍😂😮❤️🎉), **Raise Hand**, **Be right back** | none | **Add reactions + raise hand** |
| More menu | Captions, Whiteboards, Settings, Stop Incoming Video, Reset | none | **Add More menu (device settings real, rest stub)** |
| Device pick | ▴ chevrons on Mute/Video → choose mic / camera / speaker | none | **Add device pickers** |
| Tile | name label + red mic-slash (✓ we match) | ✓ | minor: add raised-hand badge |
| Pin | double-click / hover → Pin to main | none | **Add pin** |

---

## B. Architecture question — room "within the UI" vs standalone

**What the user observed:** the room should feel "within the UI" when the host starts
it from Home, but standalone for guests joining via a link.

**What real Zoom actually does (verified):** the meeting room is **full-screen for
everyone** — host and guest alike. It does **not** keep the Home sidebar
(Home/Meetings/Chat) visible during a meeting. It only keeps the **"zoom Workplace"
top bar** (wordmark + View + encryption + avatar). The host's meeting "feels integrated"
purely because it opens in the same window with that same top bar.

**Recommendation (not blindly embedding):**
- **Do NOT** wrap the room in the Home sidebar shell — that diverges from Zoom and
  cramps the stage.
- **DO** give the room its own **Zoom Workplace top bar** (same wordmark/avatar styling
  as the app, plus View + encryption shield). This is what makes it "feel within the UI"
  for the host, and it's also correct for guests.
- Guest-via-link experience stays exactly as now (full-screen room), just gains that top bar.
- Net: one consistent full-screen room for all, with product chrome. Matches Zoom; honors
  the user's intent without the downside of a sidebar stealing meeting space.

→ **Open decision for you:** accept this (one full-screen room + Workplace top bar for all),
or insist on conditionally showing the Home sidebar only for the host (achievable, but
un-Zoom-like — I'd advise against).

---

## C. Implementable now — prioritized

Reuses existing seams: WS (`SignalingClient`/room manager) for reactions/raise-hand/pin,
`useLocalMedia` for device switching, `PeerManager` unchanged. No backend schema changes
needed except none — all ephemeral over WS.

### Tier 1 — high impact, clearly in scope
1. **Room top bar** — "zoom Workplace" wordmark, right side: encryption shield (reuse
   MeetingInfoPopover), **View** button, avatar. Pure UI.
2. **Speaker View + View menu** — toggle Speaker / Gallery (default Speaker like Zoom);
   menu also: Hide Self View, Fullscreen (browser Fullscreen API). Speaker view = filmstrip
   of thumbnails + large main tile.
3. **Active-speaker detection** — Web Audio `AnalyserNode` on each stream's audio track →
   volume; highlight loudest with green border, and auto-promote in Speaker view.
   (Pure client-side; no server.)
4. **React + Raise Hand** — control-bar **React** button → emoji tray + Raise Hand + Be
   right back. Broadcast over WS (`reaction`, `raise-hand` messages); floating emoji
   animation on the sender's tile; raised-hand badge on tile + roster, host can lower.
5. **Device pickers** — ▴ chevrons on Mute/Video via `enumerateDevices()`; switch mic/
   camera with `getUserMedia` + `replaceTrack` (PeerManager already supports track swap).

### Tier 2 — nice, moderate effort
6. **Pin** — hover tile / double-click → Pin; pinned tile fills main stage (local only).
7. **More menu** — Settings (device picker dupe), **Stop Incoming Video** (detach remote
   video, keep audio), Captions/Whiteboards as labelled stubs.
8. **Speaker/mic level ring** — subtle pulsing ring on active speaker tile.

### Tier 3 — stub for fidelity (button present, "Not available in this demo")
9. **AI Companion**, **Captions**, **Whiteboards**, **Backgrounds** (virtual bg needs
   segmentation — out of scope), **Multi-speaker view**.

---

## D. Suggested build order (each verified in two tabs before next)

| Step | Scope | Exit check |
|------|-------|-----------|
| R1 | Room top bar (wordmark + View button shell + shield + avatar) | top bar renders; shield popover works |
| R2 | View menu + Speaker/Gallery layouts + Hide Self + Fullscreen | toggle switches layout; speaker view shows filmstrip + main |
| R3 | Active-speaker detection (green border + promote) | talking peer gets border + main stage |
| R4 | React tray + Raise Hand over WS (float emoji, hand badge, host lower-all) | reaction appears on both tabs; hand raises/lowers |
| R5 | Device pickers (mic/camera chevrons) + More menu (Stop Incoming Video real, rest stub) | switch camera mid-call; stop incoming hides remote video |
| R6 | Pin + level ring + polish; responsive recheck | pin fills stage; mobile control bar still fits |

Tier-3 stubs land alongside R5 (just labelled buttons).

---

## E. Out of scope (and why)
- **Virtual backgrounds / blur** — needs ML segmentation (MediaPipe); heavy, not core.
- **Live captions** — real STT infra; Web Speech API is Chrome-only + flaky. Stub only.
- **Recording, breakout rooms, polls, whiteboard canvas** — large features, not in the brief.
- **Multi-speaker view** — Speaker + Gallery already cover the requirement.
