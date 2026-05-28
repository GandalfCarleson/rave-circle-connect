# RaveCircle Demo Checklist

## Recommended Demo Account Flow

- Use a real Supabase email/password account for the full Friday demo.
- Optional local prefill: set `VITE_DEMO_EMAIL` and `VITE_DEMO_PASSWORD` in `.env.local` for development/demo builds. This only fills the login form and still uses normal Supabase auth.
- Do not hardcode demo credentials in source files.
- Do not use Dev Mode for the full event and social workflow.

## Demo Path

1. Login with the real demo account.
2. Open Feed and show event discovery.
3. Adjust date/genre/radius filters if useful.
4. Open an event detail page.
5. Mark the event as Interested or Going.
6. Save/pin the event.
7. Share the event to a crew.
8. Open crew chat and confirm the event appears.
9. React, reply, and pin/vote on the shared event.
10. Show the crew Events tab and vote threshold state.
11. Open Profile and Saved events.

## What Not To Use

- Dev Mode is limited to local auth/profile preview.
- Dev Mode does not support the full Supabase-backed event, saved-event, crew, chat, invite, or voting flows.

## API Fallback

- If Ticketmaster, Tickster, or Last.fm are unavailable, curated RaveCircle Picks remain available.
- Refresh the Feed once before demoing if providers were rate-limited shortly before the walkthrough.

## Location Fallback

- Never rely on auto-location for the demo.
- If location permission fails or times out, continue with the saved/default fallback:
  - City: Malmo
  - Radius: Full Send / 1500 km
- Permission denial should not clear the feed.

## iPhone Demo Notes

- Confirm Feed loads with the notch/Dynamic Island clear of the header.
- Confirm bottom navigation is fixed and visible above the home indicator.
- Confirm date filters, filter chips, and location/radius controls are tappable after scrolling.
- Deny location permission once and confirm Feed keeps the saved/default city and radius.
- Open Event Detail and tap Get Tickets; it should open Safari/default browser outside the app.
- Return to RaveCircle and confirm state is still usable.
- Open crew chat and confirm the composer remains reachable when the keyboard opens.
- With a real Supabase session, verify share, pin, vote, and crew Events tab.

## Android Demo Notes

- Confirm bottom navigation is visible above the Android system nav bar.
- Confirm Feed content has enough bottom padding and cards are not hidden behind nav.
- Open a ticket link and verify it leaves to the system/default browser.
- Return to the app and confirm event/detail state is still usable.
- Keep a real demo account already signed in on the phone when possible.

## Manual Test Before Expo

- Real Supabase login works.
- iPhone Feed loads.
- iPhone bottom nav is visible.
- iPhone filter buttons are usable.
- iPhone location denial does not break Feed.
- iPhone Event Detail opens.
- iPhone Get Tickets opens Safari/default browser.
- iPhone crew chat input works with keyboard.
- iPhone share/pin/vote works with a real Supabase session.
- Feed loads curated and relevant API events.
- Irrelevant provider events are hidden.
- Location failure does not break Feed.
- Event detail opens.
- Get Tickets opens an external browser and the app can be returned to.
- Interested/Going works.
- Save/pin works.
- Share to crew works.
- Crew chat shows the shared event.
- Crew pin/vote works.
- Crew Events tab works.
- Profile and Saved events work.
- Bottom nav is visible and stable on the demo phone.
