# Sleep & Vigilance Diary

A sleep-tracking app modelled on the [Réseau Morphée sleep diary](https://reseau-morphee.fr/), in French and English. The same app runs **on an Android phone** and **in a browser**.

No network dependency: Chart.js is vendored, nothing is ever sent anywhere, and your data never leaves the device.

> **⚠️ This project is still in testing.**
> It is a personal project under active development, not a finished product. Expect rough edges, and expect things to change. The Android build is a **debug** build — it is not on the Play Store and is not signed for distribution. There is no guarantee that data recorded today survives a future version, so **export your data regularly** (Settings tab) if you rely on it.

## Trying it out

Two ways, independent of each other. Neither requires an account, and both work offline.

### On your phone — download the APK

Nothing to compile, no toolchain to install.

1. From the phone, open [releases](https://github.com/Plotkine/Sleep_tracking_app/releases) and download `agenda-sommeil-v1.0-debug.apk`. (Downloading on a computer and transferring the file works too.)
2. Tap the downloaded file.
3. Android blocks the first attempt — *"your phone is not allowed to install unknown apps from this source"*. Tap **Settings** in that dialog, allow installation for the app you used (Files, Chrome, Gmail…), then tap the APK again.
4. Play Protect may warn you as well, since the app is not signed by a Play Store key: **More details → Install anyway**.

It appears in your launcher as **Agenda du Sommeil**, works fully offline, and starts with an empty diary.

Because this is a debug build, a future signed release cannot update it in place — Android refuses to update an app whose signing certificate changed. You would have to uninstall first, which wipes its data. Export beforehand.

### In a browser — run the Python server

Python 3 is all you need; there are no dependencies to install.

```bash
git clone https://github.com/Plotkine/Sleep_tracking_app.git
cd Sleep_tracking_app
python3 sleep_server.py
```

It opens `http://localhost:8742` automatically. The `data/` folder is created on first launch. Stop with `Ctrl+C`.

### Moving data between the two

The phone and the browser **share no storage**: the Android app keeps everything in its WebView's `localStorage`, the web version in `data/*.json`. The **Export / Import** buttons in the Settings tab are the only bridge — the file carries nights, habits and targets.

## Features

- **Entry** — a night split into periods (bedtime, falling asleep, waking, getting up), half-sleep, naps, drowsiness, day form, habits and notes. A quick mode records a total duration only.
- **Dashboard** — a meerkat commenting on the day's predicted form, three-day averages, and a preview of recent nights on a 24 h timeline.
- **History** — one row per day on a continuous date axis, so unrecorded days stay visible instead of silently vanishing.
- **Statistics** — sleep duration and onset time as dot charts with a target line, form and habit squares, and a Pearson correlation table linking sleep to how you felt.
- **Goals and habits** — target sleep duration and bedtime, plus tracked habits marked as affecting the same night or the next one.
- **Settings** — light/dark theme, language, and export/import of everything to a single JSON file.

## Your data

`data/` is **not versioned** — it holds personal health data. The server writes `sleep_data.json` and `habits.json` there, and recreates them empty if missing.

## Rebuilding the Android app

Only needed if you change the code. Requires JDK 17 and Android SDK 34:

```bash
cd android-app
npm install
npm run sync        # copies frontend/ into www/
npm run build:apk   # -> android-app/dist/agenda-sommeil-debug.apk
```

## Code layout

| Path | Role |
|---|---|
| `sleep_server.py` | Minimal HTTP server: pages, static files, JSON API |
| `frontend/sleep_agenda.html` | Markup: navigation and tab containers |
| `frontend/css/styles.css` | All styles |
| `frontend/js/*.js` | The app, split by responsibility |
| `android-app/` | Capacitor packaging, with no app code of its own |

The JavaScript files are classic scripts, not ES modules: top-level functions stay global, which is what the markup's `onclick` handlers rely on.

## Licence

[MIT](LICENSE) — Copyright (c) 2026 Plotkine.

You may use, modify and redistribute this code, including in closed-source
products, as long as the copyright notice and the licence text travel with it.
