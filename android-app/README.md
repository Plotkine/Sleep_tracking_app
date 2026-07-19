# Agenda du Sommeil — empaquetage Android (Capacitor)

Ce répertoire ne contient **aucun code applicatif**. Il n'existe que pour emballer le
frontend (`../frontend`) dans une application Android. Le code source n'est jamais
modifié : `scripts/sync-www.js` le recopie tel quel dans `www/`, en renommant
seulement `sleep_agenda.html` en `index.html`, nom qu'exige Capacitor.

```
android-app/
├── capacitor.config.json   identifiant, nom, schéma http://localhost
├── scripts/sync-www.js     ../frontend → www/  (jamais l'inverse)
├── www/                    copie générée — ne rien y éditer, tout y est écrasé
└── android/                projet Android (Gradle) généré par Capacitor
```

## Pourquoi l'app fonctionne sans le serveur Python

Sur Android il n'y a pas de `sleep_server.py`. Deux mécanismes rendent ça possible,
tous deux dans le frontend, donc partagés avec la version web :

- **`js/storage.js`** teste `/api/entries` au démarrage. Sans réponse, il bascule sur
  le `localStorage` du WebView. Les données restent donc sur le téléphone.
- **`js/app.js`** navigue par ancres (`#/summary`) quand il n'y a pas de serveur : le
  serveur local de Capacitor ne sait pas rediriger une route inconnue vers
  `index.html`, et un rechargement sur `/summary` renverrait un 404.

Chart.js est embarqué (`js/chart.umd.min.js`) et non chargé depuis un CDN, pour que
l'application fonctionne hors ligne.

Les deux installations ne partagent aucun stockage : le passage de l'une à l'autre se
fait par l'onglet **Objectifs et habitudes → Sauvegarde** (export puis import du
fichier JSON).

## État : APK construit ✅

`dist/agenda-sommeil-debug.apk` (3,8 Mo) — construit et vérifié le 18/07/2026.
`package=be.plotkine.agendasommeil`, minSdk 22 (Android 5.1+), targetSdk 34.

La chaîne d'outils est installée **dans le home, sans droits root** :

```bash
export JAVA_HOME=~/tools/jdk17
export ANDROID_HOME=~/tools/android-sdk
export PATH=$JAVA_HOME/bin:$PATH
```

`android/local.properties` pointe déjà sur ce SDK. Exporter ces trois variables
suffit pour relancer un build.

## Prérequis (déjà installés ici)

| Outil | Version | Pourquoi |
|-------|---------|----------|
| JDK | 17 | Gradle 8.2.1 ne démarre pas sans |
| Android SDK | platform 34 + build-tools 34 | `compileSdkVersion = 34` |

Les deux ont été installés dans `~/tools` (voir ci-dessus). Pour refaire cette
installation ailleurs :

### Installation sans droits root

```bash
# 1. JDK 17 (Temurin), dans le home
mkdir -p ~/tools && cd ~/tools
curl -L -o jdk.tar.gz https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse
tar xzf jdk.tar.gz && mv jdk-17* jdk17
export JAVA_HOME=~/tools/jdk17 && export PATH=$JAVA_HOME/bin:$PATH

# 2. Android SDK (outils en ligne de commande)
mkdir -p ~/tools/android-sdk/cmdline-tools && cd ~/tools/android-sdk/cmdline-tools
curl -L -o cli.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q cli.zip && mv cmdline-tools latest
export ANDROID_HOME=~/tools/android-sdk
export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$PATH
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

Compter environ **1,5 Go** une fois tout installé (JDK, SDK, distribution Gradle et
son cache de dépendances).

## Construire l'APK

```bash
cd android-app
npm run sync          # recopie le frontend puis met à jour le projet Android
npm run build:apk     # Gradle : assembleDebug
```

L'APK sort dans :

```
android-app/android/app/build/outputs/apk/debug/app-debug.apk
```

À installer sur un téléphone (débogage USB activé) :

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

> `npm run build:apk` produit un APK **de débogage**, signé avec la clé de debug
> d'Android. Il s'installe et fonctionne, mais ne peut pas être publié sur le Play
> Store — cela demanderait `assembleRelease` et une clé de signature à vous.

## Après chaque modification du frontend

`www/` et `android/app/src/main/assets/` sont des copies : elles ne se mettent pas à
jour toutes seules.

```bash
npm run sync
```
