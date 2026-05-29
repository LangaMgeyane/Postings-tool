# POSTINGS — UPDATE INSTRUCTIONS v3.3

## UI, Navigation Logic, Pinboard, Annotation, and Persistence

This document describes updates to apply to the existing working build.
Do not rebuild from scratch. Preserve all currently working behaviour.

Instructions are written as guiding logic, not file references —
the implementation knows its own structure better than this document does.
Read each section fully before implementing it.

Tags: [FIX] = broken thing, [CHANGE] = modify existing, [ADD] = new behaviour.

-----

## PART 1 — NAVIGATION AND WORKSPACE LOGIC

### [FIX] Subspace transitions must close and clear the active post

When the user navigates between any subspaces — from Main Journal to
My Journal, from either journal to the Pin Board, or from the Pin Board
back to a journal — the currently open post must be fully closed and
cleared from session state before the new subspace loads.

Do not attempt to restore the previously open post when re-entering a
subspace. Every subspace entry starts with no post selected. The feed
loads fresh, the content panel is empty, and nothing is pre-selected.

This is a hard reset on subspace change. It is the cleanest solution
to prevent cross-subspace content bleed.

-----

### [FIX] My Journal must only show posts authored by the current user

My Journal is a personal workspace. It must enforce a strict authorship
boundary. Every post that appears in the My Journal feed, and every post
that can be opened in My Journal, must belong to the currently signed-in
user. There are no exceptions.

If a post authored by someone else is somehow present in session state
when My Journal loads — from a previous navigation or a stale session —
it must be cleared. The content panel opens empty.

This boundary is enforced at the feed level (filter by current user’s
authorId before rendering) and at the post-open level (check authorship
before displaying content). A post that fails the authorship check in
My Journal is simply not opened — it does not produce an error, it
produces silence and an empty content panel.

-----

## PART 2 — JOURNAL LAYOUT (MAIN JOURNAL + MY JOURNAL)

These layout rules apply to both journal subspaces equally.

### [CHANGE] Feed-first: content panel hidden on subspace entry

When a user enters a journal subspace, the layout opens with:

- The feed panel visible and full-width on the left
- The content panel hidden (not rendered, not partially visible)
- The ANB panel hidden (it has nothing to show yet)

This is the resting state. The user sees the feed and nothing else.

-----

### [CHANGE] Post selected: feed collapses, ANB appears

When the user selects a post from the feed, the layout transitions to:

- The feed panel collapses — on desktop it narrows to a slim rail on
  the left edge. On mobile it slides off-screen entirely.
- The content panel slides in and fills the available space.
- The ANB panel slides in from the right.

All three of these happen together as one coordinated transition.
Use CSS transitions so the panels slide — they do not pop or flash.

When the user navigates back from a post (back button or equivalent),
the transition reverses: content panel out, ANB panel out, feed expands.

-----

### [FIX] Remove duplicate Board link

There are currently two entry points to the Pin Board visible at the
same time in the journal views. One of them needs to be removed.

The correct single entry point is described below. Any additional
Board button, link, or tab that appears separately — particularly
anything visible inside the ANB panel while also appearing in the main
toolbar — should be removed.

-----

### [CHANGE] Board / Annotate — one button, two states

In the journal views, there is a single action button whose label and
function changes based on whether a post is currently open.

**State 1 — Feed view (no post open):**
The button reads “Board”. Pressing it navigates to the Pin Board (C3)
subspace. This gives the user a way to reach the board from the feed
without opening a post first.

**State 2 — Post open (Member View / viewer mode):**
The button reads “Annotate”. Pressing it opens the annotation overlay
for the currently viewed post.

The button does not appear in the Post Editor (D2 / My Journal author
view). It only appears when viewing someone else’s post, or a submitted
post in read-only mode.

This is one button that switches label and action. It is not two
separate buttons toggled by visibility. Do not add new buttons.

-----

## PART 3 — PIN BOARD NAVIGATION

### [CHANGE] Entering the Pin Board from inside a post must focus that post’s pin

When the user navigates to the Pin Board while a post is currently open,
the board must scroll and center on the pin that corresponds to that post.
The pin should be visually highlighted (selected state / orange glow)
so it is immediately identifiable.

This applies whether the user arrived via the Board button in feed view
(with a post previously selected in session) or directly from inside
a post in Member View.

If no post is selected in session, the board opens at its default view
with no automatic centering.

-----

### [FIX] Pin Board state is not persisting across navigation

Currently, changes made on the Pin Board (moving cards, creating groups,
adding sticky notes) are lost when the user navigates away and returns.
The board reverts to its previous state. This is the core persistence bug.

The board state — all cards, their positions, groups, connections, and
sticky notes — must be saved to the server when the user exits edit mode
or navigates away from the Pin Board. When the board is next loaded,
it must read from that saved state, not from the seed data or a default.

Think of this like a cloud editing canvas: the last saved state is
always what loads. Saving overwrites the previous state entirely.

The save must happen automatically — the user should not need to press
a manual save button. Save on edit mode exit and on subspace navigation
away from C3.

The in-memory server store is acceptable for now. When a database is
connected later, this same save/load interface will be rewired to it
without changing the frontend behaviour.

-----

### [FIX] Sticky notes are not appearing on the Pin Board

All sticky notes that have been created and saved must render on the
Pin Board canvas. They are full participants in the board — they appear,
they can be selected, dragged, grouped, and filtered the same as post pins.

If sticky notes exist in the board state but are not rendering, the
card rendering logic is not handling the sticky note type. Fix the
render function to draw sticky notes with their correct visual treatment:
warm amber/dark background, top amber stripe, yellow text, fold-corner
triangle in the bottom-right corner.

-----

### [ADD] ANB Board tab — show current post and its group context

The Board tab in the ANB panel (right sidebar) currently shows a generic
mini-snapshot of the entire board. This needs to change.

When a post is open, the ANB Board tab must show a close-up preview
centered on the pin for that specific post. If the post belongs to a
group on the board, the preview includes all other pins in that group
and the connection lines between them.

The preview is read-only. It is not interactive. It functions like a
screenshot — a static snapshot of that post’s neighbourhood on the board.

If the post has no pin on the board yet, the Board tab shows an empty
state with a prompt to visit the full board.

The “Expand → C3” button remains, and navigates to the Pin Board with
the post’s pin centered and selected (as described above).

-----

## PART 4 — PIN BOARD GROUPS (CLUSTERS)

### [CHANGE] Groups are bounding containers, not just labels

A pin group must visually contain its member cards. The group is
rendered as a bounding shape — a rounded rectangle — that automatically
expands to wrap all cards assigned to it, with consistent internal
padding on all sides.

When a new card is added to a group, the bounding shape grows to
include it. When a card is dragged within the group, the shape adjusts
in real time. When a card is dragged out of the group, the shape shrinks.

The bounding shape is drawn behind the cards, not on top of them.
It is a visual container, not an overlay. Think of it as a bubble
in the sense of a spatial enclosure — the cards live inside it,
and the bubble breathes with its contents.

Cards can be brought closer together inside the group to reduce the
size of the enclosure. The bubble has no fixed size — it is always
the minimum bounding rectangle of its members, plus padding.

-----

### [ADD] Pin group names are editable after creation

Currently, a group can only be named at creation time. After creation,
the group name cannot be changed.

Add the ability to rename a group after it has been created. The rename
interaction is triggered by double-clicking the group name label on the
board, or by a rename option in the group context bar. This produces an
inline text input in place of the label. Pressing Enter or clicking away
commits the new name. Pressing Escape cancels.

-----

## PART 5 — ANNOTATION TOOL

### [FIX] Text tool: the input must appear at the cursor position

The text tool is broken because the floating input element is not being
placed at the correct position on screen, or is not being placed at all.

The correct behaviour:
When the text tool is active and the user clicks on the annotation
canvas, a small input element must appear at the exact screen position
of the click — not in a fixed location, not at the top of the canvas,
not in a sidebar. It appears where the user clicked.

The input is positioned absolutely, relative to the canvas container,
at the pixel coordinates of the click event. It is small, auto-sizing,
with a minimal paper-toned appearance. The user types and presses Enter
to commit, or Escape to cancel.

On commit, the text is drawn onto the canvas at that position and the
input element is removed. The text annotation is stored with its
position in normalized (0–1) percentage coordinates so it scales
correctly across screen sizes.

The most common reason this fails: the input is created but appended
to the wrong parent element, or positioned relative to the wrong
containing element, so it appears off-screen or at coordinate (0, 0).
Verify that the input’s `position: absolute` is relative to the
annotation overlay container, and that `left` and `top` are set to
the click’s offset coordinates within that container — not the page
coordinates.

-----

### [ADD] Annotation tack previews in ANB Notes tab

In the ANB Notes tab, each annotation entry has a small tack/pin icon.
Currently these tacks are decorative only — clicking them does nothing.

Each tack must now open a preview of the annotation it represents:

- For drawing annotations: show a small thumbnail of the strokes
  rendered on a dark background.
- For text annotations: show the text content in a small popover.

The preview is a lightweight floating element — not a full modal.
It appears on click or hover of the tack, and dismisses on click-away
or a close button. It does not navigate the user anywhere.

-----

## PART 6 — RESPONSIVE LAYOUT

The app currently has no working responsive behaviour. The three-panel
layout is fixed-width and breaks on any screen smaller than a wide
desktop. This entire section must be implemented.

### [ADD] Breakpoints

The layout has three modes:

- **Mobile** (below 768px): single panel at a time, bottom-sheet ANB
- **Tablet** (768px – 1023px): two panels, ANB as overlay
- **Desktop** (1024px and above): full three-panel layout

Use `100dvh` for all full-height containers — not `100vh`. This
prevents mobile browser chrome from clipping the layout.

-----

### [ADD] Mobile layout behaviour

On mobile, the three panels never appear simultaneously.
One panel is visible at a time. Navigation between panels uses
slide transitions — left/right for feed/content, up for ANB.

**Feed view (resting state):**
The feed panel fills the full screen. A bottom navigation bar
is present with tabs: Feed · Read · Board.

**Post selected:**
Selecting a post automatically transitions to the Read panel — the
content panel slides in from the right and fills the screen. The user
does not need to tap a tab. The transition is automatic.

**ANB access:**
The ANB panel slides up as a bottom sheet. It is triggered by a
visible handle or tab, not a hidden gesture. All three ANB tabs
(Notes, Comments, Board) are accessible within the bottom sheet.

**Pin Board:**
The Pin Board fills the full screen. The ANB bottom sheet is still
accessible.

All interactive targets — buttons, tabs, cards, toolbar items —
must be a minimum of 44px in their tap area on mobile.

-----

### [ADD] Annotation toolbar — mobile layout

On mobile, when the annotation overlay is active, the annotation
toolbar docks to the bottom of the screen. It spans the full width.
Each tool button (Draw, Text, Undo, Clear, Discard, Apply) has a
minimum 44px touch target. The toolbar does not overlap the canvas
content in a way that makes the bottom portion of the post inaccessible.

-----

## PART 7 — DATA PERSISTENCE (ARCHITECTURE NOTE)

This section describes the intended persistence model. It does not
require a database connection now — the in-memory server store is
the interim solution. But the architecture must be built to support
a database swap later without frontend changes.

All data that the user creates or modifies — posts, annotations, notes,
comments, board state — must be saved to the server and retrieved from
the server. Nothing critical lives only in the browser.

The in-memory store is the current implementation of the server-side
store. When a database is connected, the in-memory store is replaced
with database queries. The API routes and the frontend are unchanged.

Specifically for the Pin Board: the full board state (card positions,
group assignments, connections, sticky note content) must be saved to
the server on every meaningful edit-mode exit or navigation away.
When the board is next loaded, it reads from the server. The board
never resets to seed data after the first user edit.

-----

## SUMMARY CHECKLIST

|# |Description                                                |Type  |
|--|-----------------------------------------------------------|------|
|1 |Close active post on every subspace transition             |FIX   |
|2 |My Journal hard-filters to current user’s posts only       |FIX   |
|3 |Feed-first layout: content panel hidden on subspace entry  |CHANGE|
|4 |Post selection triggers coordinated 3-panel transition     |CHANGE|
|5 |Remove duplicate Board link/button                         |FIX   |
|6 |Board/Annotate — one button, two states                    |CHANGE|
|7 |Pin Board entry centers and selects current post’s pin     |CHANGE|
|8 |Pin Board state persists across navigation                 |FIX   |
|9 |Sticky notes render on Pin Board canvas                    |FIX   |
|10|ANB Board tab shows current post’s pin and group context   |ADD   |
|11|Groups render as auto-sizing bounding containers           |CHANGE|
|12|Pin group names editable after creation                    |ADD   |
|13|Annotation text tool input appears at cursor position      |FIX   |
|14|Annotation tacks open drawing/text preview on click        |ADD   |
|15|Mobile responsive layout — breakpoints + single-panel      |ADD   |
|16|Mobile bottom navigation bar (Feed · Read · Board)         |ADD   |
|17|Mobile ANB as bottom sheet                                 |ADD   |
|18|Mobile annotation toolbar docked to bottom                 |ADD   |
|19|All server-side data survives navigation (persistence arch)|FIX   |