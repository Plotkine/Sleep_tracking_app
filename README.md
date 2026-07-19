# Agenda de Vigilance et de Sommeil

Application de suivi du sommeil inspirée de l'[agenda du sommeil du Réseau Morphée](https://reseau-morphee.fr/), bilingue (français / anglais). Elle tourne dans un navigateur, servie par un petit serveur Python, **et** comme application Android autonome.

Aucune dépendance réseau : Chart.js est embarqué, rien n'est envoyé nulle part. Les données restent sur la machine.

## Fonctionnalités

- **Saisie** — nuit découpée en périodes (coucher, endormissement, réveil, lever), demi-sommeil, siestes, somnolences, forme de la journée, habitudes, remarques. Un mode rapide permet de n'encoder qu'une durée totale.
- **Tableau de bord** — mascotte commentant la forme prévue du jour, moyennes des trois derniers jours, aperçu des nuits sur une timeline 24 h.
- **Historique** — une ligne par jour sur un axe de dates continu, les jours non encodés restant visibles.
- **Statistiques** — durée et heure d'endormissement en nuages de points avec objectif, carrés de forme et d'habitudes, et un tableau de corrélations (Pearson) entre le sommeil et la forme.
- **Objectifs et habitudes** — durée de sommeil et heure d'endormissement visées, habitudes suivies avec leur effet sur la nuit même ou la suivante.
- **Options** — thème clair/sombre, langue, export et import de la totalité des données dans un fichier JSON.

## Lancer l'application web

```bash
python3 sleep_server.py
```

Ouvre `http://localhost:8742`. Le dossier `data/` est créé automatiquement au premier démarrage.

## Application Android

Un APK de développement est disponible dans les [releases](https://github.com/Plotkine/Sleep_tracking_app/releases). Pour le reconstruire (JDK 17 et Android SDK 34 requis) :

```bash
cd android-app
npm install
npm run sync        # copie frontend/ dans www/
npm run build:apk
```

## Vos données

`data/` **n'est pas versionné** : il contient des données de santé personnelles. Le serveur y écrit `sleep_data.json` et `habits.json`, et les recrée vides s'ils manquent.

Le web et l'application Android ne partagent aucun stockage : l'application Android range tout dans le `localStorage` de sa WebView. L'export/import de l'onglet Options est le seul pont entre les deux — le fichier produit contient les nuits, les habitudes et les objectifs.

## Organisation du code

| Chemin | Rôle |
|---|---|
| `sleep_server.py` | Serveur HTTP minimal : pages, fichiers statiques, API JSON |
| `frontend/sleep_agenda.html` | Balisage : navigation et conteneurs d'onglets |
| `frontend/css/styles.css` | Toutes les feuilles de style |
| `frontend/js/*.js` | L'application, découpée par responsabilité |
| `android-app/` | Empaquetage Capacitor, sans code applicatif propre |

Les scripts JavaScript sont des scripts classiques, pas des modules ES : les fonctions de premier niveau restent globales, ce dont dépendent les gestionnaires `onclick` du balisage.

## Licence

MIT
