# Lyrics-on-tempo

> Dépôt : https://github.com/Ymanda/Lyrics-on-tempo · paquet Python : `lyrics_fitter`

Caler du texte sur une mélodie, en français, syllabe par syllabe — et exporter
la partition (MusicXML) et l'audio (MIDI). Conçu pour réécrire des hymnes
militants (ex. nouvelles paroles « Le pouvoir au peuple » sur l'air de *La
Marseillaise*), puis réutilisable avec **n'importe quelle autre mélodie**
(Bella Ciao, Le Chant des Partisans, hymnes régionaux…).

## Principe

Une mélodie = un fichier `.json` qui décrit la **grille métrique** (combien de
syllabes chantées par vers) + un fichier `.abc` qui contient la **mélodie réelle**
(notes, durées) pour l'audio. Tu écris ton texte, l'outil compte les syllabes
chantées de chaque vers et signale en couleur ce qui **déborde** ou **manque**.

```
lyrics_fitter/
├── melodies/
│   ├── marseillaise.abc      # mélodie de référence (domaine public)
│   └── marseillaise.json     # grille syllabique éditable (source de vérité du calage)
├── exemples/
│   └── pouvoir_au_peuple.txt # brouillon de paroles calé sur la grille
├── lyrics_fitter/
│   ├── syllables.py          # syllabation française orientée chant
│   ├── meter.py              # moteur de calage texte ↔ grille
│   ├── report_html.py        # rapport HTML coloré
│   ├── export_music.py       # export MusicXML + MIDI (music21)
│   ├── cli.py / __main__.py  # ligne de commande
│   └── gui_tk.py             # interface bureau bonus (tkinter)
├── web/                      # VERSION NAVIGATEUR (statique, sans Python)
│   ├── index.html / fitter.js / melodies.js / player.js / app.js
│   └── DEPLOY.md             # pose sur safezone-fpv.com /outils
├── LICENSE                   # MIT (code uniquement)
└── requirements.txt
```

## Version web (navigateur, pour tout le monde)

Le dossier `web/` contient une version **100 % statique et locale au navigateur**,
utilisable sans rien installer et **sans aucun compte** : on tape ses paroles, le
calage syllabe par syllabe s'affiche en direct (vert / orange mélisme / rouge), on
écoute l'air (Web Audio). Tout est libre : **export MIDI et partition (MusicXML)
générés dans le navigateur**, téléchargement des paroles (.txt), mémoire automatique
(localStorage) et lien partageable (paroles encodées dans l'URL). Aucune donnée
n'est envoyée à un serveur. Même moteur que la version Python, porté en JavaScript
(parité vérifiée). Déploiement : voir `web/DEPLOY.md`. Pour essayer tout de suite :
ouvrir `web/index.html`.

## Installation

```bash
pip install -r requirements.txt
```

`pyphen` (syllabation) et `music21` (exports) sont recommandés mais optionnels :
le calage fonctionne sans eux (fallback interne) ; seuls les exports MusicXML/MIDI
exigent `music21`. `tkinter` est livré avec Python (sur Debian/Ubuntu :
`apt install python3-tk`).

## Utilisation

Afficher la grille métrique d'une mélodie :

```bash
python -m lyrics_fitter grid melodies/marseillaise.json
```

Caler un texte (un vers par ligne) et ouvrir le rapport coloré :

```bash
python -m lyrics_fitter fit melodies/marseillaise.json exemples/pouvoir_au_peuple.txt --open
```

Recalcul automatique à chaque sauvegarde du fichier texte (quasi temps réel) :

```bash
python -m lyrics_fitter fit melodies/marseillaise.json mon_texte.txt --watch
```

Exporter la partition + l'audio avec tes paroles posées sur la mélodie :

```bash
python -m lyrics_fitter export melodies/marseillaise.json \
    --lyrics mon_texte.txt --out sorties/mon_chant --musicxml --midi
```

Mode bureau (édition live, même moteur) :

```bash
python -m lyrics_fitter.gui_tk melodies/marseillaise.json
```

## Marqueurs manuels (le français est ambigu)

Le comptage des syllabes chantées est une **heuristique** (synérèse/diérèse :
« nation » = 2 ou 3 ? « hier » = 1 ou 2 ?). Tu gardes la main avec des marqueurs
collés au mot :

| Marqueur | Effet | Exemple |
|----------|-------|---------|
| `+` ou `*` | force une syllabe en **plus** (diérèse) | `na+tion` → 3 |
| `=` | force une **synérèse** (1 syllabe en moins) | `li=on` → 1 |
| `_` | force une **coupure** entre deux voyelles | `pa_ys` → 2 |

Règles automatiques appliquées : le `e` muet final **compte** en chant (mode par
défaut) sauf élision devant une voyelle ; le `y` entre deux voyelles agit comme
une consonne (`citoyens` = ci-to-yens = 3). Mode parlé disponible avec `--parle`.

## Ajouter une autre mélodie (chanson)

**Quelles chansons ?** Seule la *mélodie* compte (tes paroles sont à toi). Une
mélodie est utilisable si son **compositeur est mort depuis plus de 70 ans**
(domaine public FR/UE), si elle est **traditionnelle/anonyme**, ou sous **licence
libre**. Repère de prudence : compositeur mort avant ~1940 = sûr ; 1940–1956 = à
vérifier (prorogations de guerre / mort pour la France) ; après = protégé. Donc
oui pour L'Internationale (libre depuis 2017), Le Temps des cerises, La Carmagnole,
Le Chant du départ, le folklore… mais **non** pour Brel/Brassens/Ferré/Trenet et
**non** pour Le Chant des Partisans (protégé jusqu'en 2077).

**Comment l'ajouter — avec l'importeur :**

1. Récupère la mélodie en **MIDI ou MusicXML** depuis une source libre (MuseScore
   domaine public, IMSLP, Mutopia).
2. Écris un fichier paroles de référence (un vers par ligne) pour la grille.
3. Lance :
   ```bash
   pip install music21
   python import_song.py ma_melodie.musicxml --lyrics paroles.txt \
       --id mon_air --title "Mon Air" --composer "X (domaine public)" --key C
   ```
4. Colle le bloc affiché dans `web/melodies.js` (et la copie du site), et ajoute
   l'air à `Melodies.list` / `Melodies.byId`.
5. **Vérifie à l'oreille** avec le bouton « Écouter l'air » : si le tempo/les notes
   ne collent pas, ajuste le fichier source ou `tempo_bpm`.

(Alternative manuelle : un couple `melodies/X.abc` + grille JSON, comme pour la
Marseillaise.)

## Source de la partition

*La Marseillaise* (Rouget de Lisle, **domaine public**), transcription ABC :
https://abcnotation.com/tunePage?a=serpent.serpentpublications.org/~lconrad/music/delisle/marseillaise/0000

Les **paroles** que tu écris t'appartiennent. La mélodie de *La Marseillaise* est
dans le domaine public ; tu peux y poser de nouvelles paroles librement.

## Limites connues

- L'alignement des paroles sur les notes (export) est **1 syllabe = 1 note** via
  la coupure pyphen ; les notes en surplus deviennent des mélismes. Pour un rendu
  fin, ouvre le MusicXML dans MuseScore et ajuste à l'oreille.
- La syllabation pour l'**affichage** (pyphen) peut légèrement différer du
  **comptage chanté** sur les cas de diérèse — d'où les marqueurs manuels.
