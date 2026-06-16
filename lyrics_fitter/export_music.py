# -*- coding: utf-8 -*-
"""
Export MusicXML + MIDI via music21.

On parse le fichier ABC de reference (melodie faisant autorite, domaine public),
puis on peut REMPLACER les paroles d'origine par le texte de l'utilisateur,
aligne syllabe par syllabe sur les notes.

music21 est optionnel : si absent, les fonctions levent une erreur claire.
"""
from __future__ import annotations

import os
from typing import List, Optional

from . import syllables as _syl


def _require_music21():
    try:
        import music21  # noqa
        return music21
    except Exception as e:  # pragma: no cover
        raise RuntimeError(
            "music21 n'est pas installe. Installe-le avec :\n"
            "    pip install music21\n"
            "(les exports MusicXML/MIDI en dependent ; le calage syllabique, lui, "
            "fonctionne sans.)"
        ) from e


def load_score(abc_path: str):
    """Charge la partition ABC dans un Score music21."""
    m21 = _require_music21()
    with open(abc_path, "r", encoding="utf-8") as f:
        abc = f.read()
    return m21.converter.parse(abc, format="abc")


def _flatten_user_syllables(user_lines: List[str]) -> List[str]:
    """Transforme des vers en une liste plate de syllabes a poser sur les notes."""
    out: List[str] = []
    for line in user_lines:
        line = line.strip()
        if not line:
            continue
        for word in _syl.split_words(line):
            sy = _syl.syllabify(word)
            # marque la derniere syllabe d'un mot par un trait de fin implicite
            out.extend(sy)
    return out


def relyric(score, user_lines: List[str]):
    """Remplace les paroles des notes par les syllabes de l'utilisateur (1 note = 1 syll).
    Les notes en trop deviennent des melismes (pas de syllabe)."""
    m21 = _require_music21()
    syl = _flatten_user_syllables(user_lines)
    notes = list(score.recurse().notes)
    for i, n in enumerate(notes):
        # efface les paroles existantes
        n.lyrics = []
        if i < len(syl):
            n.addLyric(syl[i])
    return score


def export(abc_path: str, out_basepath: str,
           user_lines: Optional[List[str]] = None,
           formats: Optional[List[str]] = None) -> List[str]:
    """
    Exporte la melodie.
      - abc_path     : melodie de reference
      - out_basepath : chemin de sortie SANS extension
      - user_lines   : si fourni, remplace les paroles
      - formats      : liste parmi {"musicxml", "midi"} ; defaut = les deux
    Retourne la liste des fichiers ecrits.
    """
    formats = formats or ["musicxml", "midi"]
    score = load_score(abc_path)
    if user_lines:
        relyric(score, user_lines)

    written = []
    if "musicxml" in formats:
        p = out_basepath + ".musicxml"
        score.write("musicxml", fp=p)
        written.append(p)
    if "midi" in formats:
        p = out_basepath + ".mid"
        score.write("midi", fp=p)
        written.append(p)
    return written
