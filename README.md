# Cleaning Schedule

A mobile-first task scheduler. Shows today's tasks grouped by morning /
afternoon / evening, with a toggle to switch to a full weekly view. Tasks
are created from the "Schedule" button (bottom right): name, notes,
duration, time of day, an icon (pick a preset or upload your own photo),
and whether it repeats (daily, weekly on a chosen day, monthly on a chosen
date) or happens just once on a specific date you pick.

Completed tasks turn green with a checkmark instead of disappearing. If a
daily/weekly/monthly task isn't done in time, it carries over to today with
a red "Delayed by N days" note until it's checked off.

The UI is in Dutch.

## Household sharing ("House" button, top right)

Tapping "House" lets you create a household (generates a short code) or
join one with a code someone shared with you. While connected, the task
list and completions live in a shared Firestore document instead of
`localStorage`, synced in real time (via `onSnapshot`) to everyone with
that code — so a change on one phone shows up on another within seconds.
The code you're connected to is remembered per browser (`localStorage`),
so reopening the app reconnects automatically. Leaving a household falls
back to that device's own local list.

Uses the same Firebase project as `flashcard-maker`/`all-you-can-play`
(Firestore, `households` collection — see that project's
`firestore.rules`, which also holds this app's rules), but its own
collection, so it doesn't interfere with their data. There's no auth: the
code itself is the access control, and Firestore rules cap document size
and field shape to prevent abuse. Custom-uploaded icons are downscaled to
128×128 JPEGs client-side before saving, to keep shared documents small.

Without a household, data is stored in the browser's `localStorage` only
— nothing is sent anywhere, and each device/browser has its own list.

Has a home-screen icon (`icon-*.png`, generated from `icon-192.png`'s
checkmark design) and a `manifest.json` so "Add to Home Screen" on iPhone
(or "Install app" on Android/Chrome) gets a proper icon and opens without
Safari's browser chrome.

Published automatically via GitHub Pages on every push to `main`.
