# Sleep & Vigilance Diary

A sleep-tracking app modelled on the [Réseau Morphée sleep diary](https://reseau-morphee.fr/), in French and English. It runs in a browser, served by a small Python server, **and** as a standalone Android app.

No network dependency: Chart.js is vendored, nothing is ever sent anywhere. Your data stays on your machine.

## Features

- **Entry** — a night split into periods (bedtime, falling asleep, waking, getting up), half-sleep, naps, drowsiness, day form, habits and notes. A quick mode records a total duration only.
- **Dashboard** — a meerkat commenting on the day's predicted form, three-day averages, and a preview of recent nights on a 24 h timeline.
- **History** — one row per day on a continuous date axis, so unrecorded days stay visible instead of silently vanishing.
- **Statistics** — sleep duration and onset time as dot charts with a target line, form and habit squares, and a Pearson correlation table linking sleep to how you felt.
- **Goals and habits** — target sleep duration and bedtime, plus tracked habits marked as affecting the same night or the next one.
- **Settings** — light/dark theme, language, and export/import of everything to a single JSON file.

## Running the web app

```bash
python3 sleep_server.py
```

Opens `http://localhost:8742`. The `data/` folder is created on first launch.

## Android app

### Installing it — just download the APK

While the app is in development it is not on the Play Store, so there is nothing to build and no toolchain to set up. **Download the APK and open it on your phone:**

1. Go to [releases](https://github.com/Plotkine/Sleep_tracking_app/releases) and download `agenda-sommeil-v1.0-debug.apk`, straight from the phone's browser or transferred from a computer.
2. Tap the downloaded file.
3. Android blocks the first attempt — *"your phone is not allowed to install unknown apps from this source"*. Tap **Settings** in that dialog and allow installation for whichever app you used (Files, Chrome, Gmail…), then tap the APK again.
4. Play Protect may also warn you, since the app is not signed by a Play Store key: **More details → Install anyway**.

It then shows up in your launcher as **Agenda du Sommeil**. It works fully offline and starts with an empty diary.

This is a **debug build**: installable and it never expires, but it cannot be published to the Play Store. If a signed release build ever replaces it you will have to uninstall this one first — Android refuses to update an app whose signing certificate changed — and uninstalling wipes its data, so export it beforehand.

### Rebuilding it yourself

Only needed if you change the code. Requires JDK 17 and Android SDK 34:

```bash
cd android-app
npm install
npm run sync        # copies frontend/ into www/
npm run build:apk   # -> android-app/dist/agenda-sommeil-debug.apk
```

## Your data

`data/` is **not versioned** — it holds personal health data. The server writes `sleep_data.json` and `habits.json` there, and recreates them empty if missing.

The web and Android versions share no storage: the Android app keeps everything in its WebView's `localStorage`. Export/import in the Settings tab is the only bridge between them — the file carries nights, habits and targets.

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
