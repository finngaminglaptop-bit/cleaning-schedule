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

A "House" button (top right) is the UI shell for sharing a schedule across
a household via a short code — not wired to a backend yet.

Data is stored in the browser's `localStorage` only — nothing is sent
anywhere, and each device/browser has its own list.

Has a home-screen icon (`icon-*.png`, generated from `icon-192.png`'s
checkmark design) and a `manifest.json` so "Add to Home Screen" on iPhone
(or "Install app" on Android/Chrome) gets a proper icon and opens without
Safari's browser chrome.

Published automatically via GitHub Pages on every push to `main`.
