# -*- coding: utf-8 -*-
"""
Interface ligne de commande de lyrics_fitter.

Exemples :
  # afficher la grille d'une melodie
  python -m lyrics_fitter grid melodies/marseillaise.json

  # caler un texte et ouvrir le rapport HTML
  python -m lyrics_fitter fit melodies/marseillaise.json exemples/pouvoir_au_peuple.txt --open

  # recalcul automatique a chaque sauvegarde du fichier texte
  python -m lyrics_fitter fit melodies/marseillaise.json mon_texte.txt --watch

  # exporter MusicXML + MIDI avec les paroles de l'utilisateur
  python -m lyrics_fitter export melodies/marseillaise.json --lyrics mon_texte.txt --out sortie/chant
"""
from __future__ import annotations

import argparse
import os
import sys
import time
import webbrowser

from . import meter as _meter
from . import report_html as _report


def _print_text_report(melody, results, extra):
    width = max((len(r.phrase.ref_text) for r in results), default=20)
    print(f"\n  {melody.title} — {melody.meter} {melody.tempo_bpm}bpm ton {melody.key}\n")
    print(f"  {'etat':5} {'syl':>3} {'cib':>3} {'d':>3}  vers de reference")
    print("  " + "-" * (28 + width))
    for r in results:
        sym = _meter.STATUS_SYMBOL[r.status]
        d = (f"+{r.delta}" if r.delta > 0 else str(r.delta))
        print(f"  {sym:5} {r.count:>3} {r.phrase.syllables:>3} {d:>3}  "
              f"{r.phrase.ref_text}")
        if r.user_text:
            print(f"        -> {r.user_text}")
        if r.status in ("over", "under"):
            print(f"        !  {r.suggestion}")
    if extra:
        print("\n  /!\\ Lignes en trop :")
        for e in extra:
            print(f"        {e}")
    print()


def _do_fit(args):
    melody = _meter.load_melody(args.melody)
    with open(args.text, "r", encoding="utf-8") as f:
        text = f.read()
    results, extra = _meter.fit_text(melody, text, sung=not args.parle)

    html = _report.render(melody, results, extra)
    out_html = args.html or (os.path.splitext(args.text)[0] + "_calage.html")
    with open(out_html, "w", encoding="utf-8") as f:
        f.write(html)

    _print_text_report(melody, results, extra)
    print(f"  Rapport HTML : {out_html}")
    if args.open:
        webbrowser.open("file://" + os.path.abspath(out_html))
    return out_html


def _do_watch(args):
    out_html = _do_fit(args)
    if args.open:
        webbrowser.open("file://" + os.path.abspath(out_html))
    print("  [watch] surveillance de", args.text, "— Ctrl-C pour arreter.")
    last = os.path.getmtime(args.text)
    try:
        while True:
            time.sleep(0.6)
            m = os.path.getmtime(args.text)
            if m != last:
                last = m
                print("  [watch] changement detecte, recalcul...")
                _do_fit(argparse.Namespace(**{**vars(args), "open": False}))
    except KeyboardInterrupt:
        print("\n  [watch] arret.")


def _do_grid(args):
    melody = _meter.load_melody(args.melody)
    print(f"\n  {melody.title} — {melody.meter} {melody.tempo_bpm}bpm ton {melody.key}")
    for s in melody.sections:
        counts = [p.syllables for p in s.phrases]
        print(f"\n  [{s.label}]  metrique = {counts}")
        for p in s.phrases:
            slack = f"  (+{p.melisma_slack} melisme)" if p.melisma_slack else ""
            print(f"     {p.syllables:>2} syll  | {p.ref_text}{slack}")
    print()


def _do_export(args):
    from . import export_music
    user_lines = None
    if args.lyrics:
        with open(args.lyrics, "r", encoding="utf-8") as f:
            user_lines = [l for l in f.read().splitlines() if l.strip()]
    melody = _meter.load_melody(args.melody)
    abc_path = os.path.join(os.path.dirname(args.melody), melody.abc_source)
    out = args.out or os.path.splitext(args.melody)[0]
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    formats = []
    if args.musicxml:
        formats.append("musicxml")
    if args.midi:
        formats.append("midi")
    written = export_music.export(abc_path, out, user_lines=user_lines,
                                  formats=formats or None)
    for p in written:
        print("  ecrit :", p)


def build_parser():
    p = argparse.ArgumentParser(prog="lyrics_fitter",
                                description="Caler du texte sur une melodie.")
    sub = p.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("grid", help="afficher la grille metrique d'une melodie")
    g.add_argument("melody", help="fichier .json de melodie")
    g.set_defaults(func=_do_grid)

    f = sub.add_parser("fit", help="caler un texte et generer un rapport")
    f.add_argument("melody", help="fichier .json de melodie")
    f.add_argument("text", help="fichier texte (un vers par ligne)")
    f.add_argument("--html", help="chemin du rapport HTML de sortie")
    f.add_argument("--open", action="store_true", help="ouvrir le rapport dans le navigateur")
    f.add_argument("--watch", action="store_true", help="recalcul a chaque sauvegarde")
    f.add_argument("--parle", action="store_true",
                   help="comptage francais PARLE (e muet non compte) au lieu de chante")
    f.set_defaults(func=lambda a: _do_watch(a) if a.watch else _do_fit(a))

    e = sub.add_parser("export", help="exporter MusicXML / MIDI")
    e.add_argument("melody", help="fichier .json de melodie")
    e.add_argument("--lyrics", help="fichier texte a poser sur la melodie")
    e.add_argument("--out", help="chemin de sortie SANS extension")
    e.add_argument("--musicxml", action="store_true", help="exporter MusicXML")
    e.add_argument("--midi", action="store_true", help="exporter MIDI")
    e.set_defaults(func=_do_export)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
