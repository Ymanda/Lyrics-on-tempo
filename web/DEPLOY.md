# Déploiement — espace « Outils » sur safezone-fpv.com

## Pose des fichiers

La version web est **100 % statique et 100 % locale au navigateur** : aucun
back-end, aucune base de données, aucune identification, aucune donnée envoyée.
Copie les 5 fichiers dans un sous-répertoire du domaine, par ex. :

```
safezone-fpv.com/tools/lyrics_fitter/
    ├── index.html
    ├── fitter.js      (moteur de calage syllabique)
    ├── melodies.js    (grille + notes)
    ├── player.js      (lecture Web Audio)
    └── app.js         (interface + exports + mémoire + partage)
```

Le `.htaccess` du site sert les vrais dossiers directement (la réécriture ne vise
que l'inexistant), donc l'outil est accessible à :
**`https://www.safezone-fpv.com/tools/lyrics_fitter/`** (le site force le `www`).

Ça marche aussi en ouvrant simplement `index.html` en local (les `.js` sont
chargés en relatif).

## Ce que fait l'outil (sans aucun compte)

- **Caler les paroles** : comptage syllabique en direct (vert / orange mélisme / rouge).
- **Écouter l'air** : lecture Web Audio de la mélodie.
- **Exporter** : MIDI (.mid) et partition (MusicXML) générés **dans le navigateur** —
  le MusicXML s'ouvre dans MuseScore avec les paroles alignées ; le MIDI s'écoute /
  se réimporte partout.
- **Télécharger les paroles** (.txt).
- **Mémoire** : le dernier texte est conservé automatiquement (localStorage), rien ne
  quitte l'appareil.
- **Lien partageable** : un lien encode les paroles dans l'URL (à mettre en favori ou
  à envoyer) ; à l'ouverture, l'outil recharge ces paroles.

## Souveraineté / RGPD

Aucune identification, aucun cookie de suivi, aucune donnée personnelle : rien à
déclarer, rien à héberger, rien à protéger. Le site reste statique et scale à
l'infini. Pas de proxy Cloudflare nécessaire sur ce chemin.

## Ajouter d'autres mélodies (Bella Ciao, Chant des Partisans…)

Tout est dans `melodies.js` : copie le bloc d'une mélodie (métadonnées + `sections`
de phrases avec le nombre de syllabes cible + la chaîne `notes` encodée
`"midi:durée"`, silences = `"Rdurée"`). Pour générer la chaîne `notes` depuis une
partition ABC/MusicXML, voir le script Python du dépôt (music21).
