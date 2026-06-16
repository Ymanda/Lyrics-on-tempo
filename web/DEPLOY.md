# Déploiement — espace « Outils » sur safezone-fpv.com

## Pose des fichiers

La version web est **100 % statique** : aucun back-end requis pour le mode
« jeu libre ». Copie le dossier `web/` dans un sous-répertoire du domaine, par ex. :

```
safezone-fpv.com/outils/caleur/
    ├── index.html
    ├── fitter.js
    ├── melodies.js
    ├── player.js
    └── app.js
```

URL d'accès : `https://safezone-fpv.com/outils/caleur/` (rappel souveraineté :
**sans www**, et pas de proxy Cloudflare sur ce chemin si tu veux rester cohérent).

Les fichiers `.js` sont chargés en **relatif** (même dossier), donc ça marche
aussi en local en ouvrant simplement `index.html` dans un navigateur (file://).

## Le sas d'animation (Garuda / Hanuman)

Le sas est géré dans `app.js` (objet `CONFIG`) :

- `INTRO_MODE` : `"day"` (1×/jour, défaut), `"session"` (1×/session) ou `"off"`.
- `INTRO_MIN_MS` : durée mini d'affichage avant de pouvoir entrer.

**Brancher ta vraie animation** : la page cherche une fonction globale
`window.szGarudaIntro(container)` et, si elle existe, l'appelle en lui passant
le conteneur `#intro-stage`. Donc :

1. Mets ton script d'animation de l'index dans un fichier partagé, ex.
   `outils/garuda-intro.js`, qui définit `window.szGarudaIntro = function(el){ ... }`
   (il dessine/anime dans `el`, idéalement une seule source réutilisée par l'index).
2. Ajoute `<script src="../garuda-intro.js"></script>` AVANT `app.js` dans `index.html`.

Sans ça, un sas de repli (logo + halo doré) s'affiche — à remplacer par ton anim.
La mémorisation « vu aujourd'hui » se fait en `localStorage` (clé `sz_intro_day`),
donc le visiteur n'est pas harcelé.

## Le funnel d'inscription (jeu libre, export/save gatés)

Toujours dans `CONFIG` (`app.js`) :

- `SIGNUP_URL` : page d'inscription La Commune 2.0 (à remplacer par l'URL réelle).
- `DISCORD_URL` : invitation de ton Discord 2.0.

Modèle retenu : **jouer/caler du texte = libre et illimité**, sans compte.
Les boutons **Exporter** (MIDI/partition) et **Sauvegarder** ouvrent la modale
d'inscription. C'est le levier d'inscription, sans bloquer le jeu.

### Quand brancher un back-end (plus tard)

L'export réel (MIDI/MusicXML) et la sauvegarde nécessiteront un endpoint serveur.
Deux options sur ce serveur qui héberge déjà FastAPI :

- réutiliser l'API existante avec une route `/outils/caleur/export` (music21) +
  `/save` (lié au compte C2.0 / OAuth Discord) ;
- ou un micro-service séparé.

C'est **là** — et seulement là — qu'un éventuel plafond de « slots » a un sens
(les workers d'export consomment du CPU), pas sur le jeu client-side.

## Ajouter d'autres mélodies (Bella Ciao, Chant des Partisans…)

Tout est dans `melodies.js` : copie le bloc d'une mélodie (métadonnées + `sections`
de phrases + chaîne `notes` encodée `"midi:durée"`). Pour générer la chaîne `notes`
depuis une partition ABC, voir le script Python du dépôt (music21).
