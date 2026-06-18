#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
import_song.py — ajoute une chanson à l'outil de calage.

Prend une MÉLODIE (fichier .mid / .musicxml / .xml / .abc, idéalement libre de
droits : MuseScore domaine public, IMSLP, Mutopia…) + un fichier de PAROLES de
référence (un vers par ligne) et produit le bloc JavaScript à coller dans
`web/melodies.js` (ou `tools/lyrics_fitter/melodies.js`).

  pip install music21
  python import_song.py internationale.musicxml --lyrics internationale.txt \\
      --id internationale --title "L'Internationale" --composer "Pierre De Geyter (domaine public)"

- La chaîne de notes (pour la lecture audio) vient du fichier mélodie.
- La grille (nombre de syllabes par vers) vient du comptage des paroles de
  référence, avec les mêmes règles que l'outil (e muet chanté, y intervocalique,
  hiatus -ie, marqueurs + = _).
Vérifie toujours le résultat à l'oreille via le bouton « Écouter l'air ».
"""
import argparse
import re
import sys

# --------- comptage syllabique francais (identique au moteur de l'outil) ---------
VOY = "aeiouyàâäéèêëîïôöùûüœæ"
VOY_NOY = "aeiouàâäéèêëîïôöùûüœæ"
APO = "'’"
PUNCT = ".,;:!?()[]\"«»…"
_re_y = re.compile(r"(?<=[" + VOY_NOY + r"])y(?=[" + VOY_NOY + r"])", re.I)
_re_groups = re.compile(r"[" + VOY + r"]+", re.I)


def _vowel_groups(w):
    return len(_re_groups.findall(_re_y.sub("j", w)))


def _ends_mute_e(w):
    return ((len(w) > 3 and w.endswith("ent")) or
            (len(w) > 2 and w.endswith("es")) or
            (len(w) > 1 and w.endswith("e")))


def _mute_e_after_consonant(w):
    if len(w) > 3 and w.endswith("ent"):
        idx = len(w) - 3
    elif len(w) > 2 and w.endswith("es"):
        idx = len(w) - 2
    elif len(w) > 1 and w.endswith("e"):
        idx = len(w) - 1
    else:
        return False
    if idx - 1 < 0:
        return False
    prev = w[idx - 1]
    if prev == "u" and idx - 2 >= 0 and w[idx - 2] in ("q", "g"):
        return True
    return prev not in VOY_NOY


def _starts_vowel(word):
    w = re.sub(r"[*+_=|]", "", word).lower().lstrip(PUNCT + APO)
    if not w:
        return False
    return w[0] == "h" or w[0] in VOY


def count_line(text, sung=True):
    words = [w for w in text.strip().split() if w]
    total = 0
    for i, w in enumerate(words):
        nxt = words[i + 1] if i + 1 < len(words) else ""
        next_v = _starts_vowel(nxt) if nxt else False
        if re.search(r"['’]", w):
            stripped = re.sub(r"^[a-zàâäéèêëîïôöùûüœæ]+['’]", "", w, flags=re.I)
            if stripped:
                w = stripped
        delta = (w.count("*") + w.count("+") + w.count("_")) - w.count("=")
        clean = re.sub(r"[*+_=|]", "", w).lower().strip(PUNCT)
        if not clean:
            continue
        n = _vowel_groups(clean) or 1
        if sung:
            if len(clean) >= 2 and clean.endswith("ie") and not next_v:
                n += 1
            elif _ends_mute_e(clean) and next_v and _mute_e_after_consonant(clean):
                n -= 1
        else:
            if _ends_mute_e(clean) and _mute_e_after_consonant(clean):
                n -= 1
        total += max(0, n + delta)
    return total


# ------------------------------- mélodie -> notes -------------------------------
def melody_events(path):
    import music21
    sc = music21.converter.parse(path)
    tempo = 0
    for mm in sc.recurse().getElementsByClass("MetronomeMark"):
        if mm.number:
            tempo = int(round(mm.number))
            break
    events = []
    for el in sc.recurse().notesAndRests:
        ql = round(float(el.quarterLength), 4)
        if ql <= 0:
            continue
        if el.isRest:
            events.append(("R", ql))
        else:
            midi = el.pitches[-1].midi if el.isChord else el.pitch.midi
            events.append((midi, ql))
    return events, tempo


def fmt(q):
    return str(int(q)) if float(q).is_integer() else str(q)


def encode_notes(events):
    return " ".join(("R" + fmt(q)) if k == "R" else (str(k) + ":" + fmt(q)) for k, q in events)


# ------------------------------- sortie JS --------------------------------------
def js_block(mid, title, composer, meter, tempo, key, phrases, notes):
    lines = []
    lines.append("  var %s = {" % mid.upper().replace("-", "_"))
    lines.append("    id: %s," % js_str(mid))
    lines.append("    title: %s," % js_str(title))
    lines.append("    composer: %s," % js_str(composer))
    lines.append("    meter: %s," % js_str(meter))
    lines.append("    tempo_bpm: %d," % tempo)
    lines.append("    key: %s," % js_str(key))
    lines.append("    sections: [")
    lines.append("      {")
    lines.append("        label: \"Couplet\",")
    lines.append("        phrases: [")
    for p in phrases:
        lines.append("          { id: %s, ref: %s, syl: %d, slack: 0 }," %
                      (js_str(p["id"]), js_str(p["ref"]), p["syl"]))
    lines.append("        ]")
    lines.append("      }")
    lines.append("    ],")
    lines.append("    notes: %s" % js_str(notes))
    lines.append("  };")
    lines.append("  // -> ajoute %s à Melodies.list et Melodies.byId.%s dans melodies.js" % (mid.upper(), mid))
    return "\n".join(lines)


def js_str(s):
    return '"' + str(s).replace("\\", "\\\\").replace('"', '\\"') + '"'


def main():
    ap = argparse.ArgumentParser(description="Ajoute une chanson à l'outil de calage.")
    ap.add_argument("melody", help="fichier mélodie (.mid/.musicxml/.xml/.abc)")
    ap.add_argument("--lyrics", help="fichier paroles de référence (un vers par ligne)")
    ap.add_argument("--id", required=True, help="identifiant court (ex: internationale)")
    ap.add_argument("--title", required=True)
    ap.add_argument("--composer", default="domaine public")
    ap.add_argument("--meter", default="4/4")
    ap.add_argument("--key", default="C")
    ap.add_argument("--tempo", type=int, default=0, help="bpm (sinon lu dans le fichier)")
    ap.add_argument("--parle", action="store_true", help="comptage parlé au lieu de chanté")
    args = ap.parse_args()

    events, tempo_file = melody_events(args.melody)
    tempo = args.tempo or tempo_file or 100
    notes = encode_notes(events)
    n_notes = sum(1 for k, _ in events if k != "R")

    phrases = []
    if args.lyrics:
        with open(args.lyrics, encoding="utf-8") as f:
            verses = [l for l in f.read().splitlines() if l.strip()]
        for i, v in enumerate(verses, 1):
            phrases.append({"id": "p%d" % i, "ref": v.strip(),
                            "syl": count_line(v, sung=not args.parle)})

    sys.stderr.write("OK : %d notes, %d silences, tempo %d, %d vers de grille.\n"
                     % (n_notes, len(events) - n_notes, tempo, len(phrases)))
    print(js_block(args.id, args.title, args.composer, args.meter, tempo, args.key, phrases, notes))


if __name__ == "__main__":
    main()
