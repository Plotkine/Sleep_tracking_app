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

A debug APK is available under [releases](https://github.com/Plotkine/Sleep_tracking_app/releases). To rebuild it (JDK 17 and Android SDK 34 required):

```bash
cd android-app
npm install
npm run sync        # copies frontend/ into www/
npm run build:apk
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

MIT
