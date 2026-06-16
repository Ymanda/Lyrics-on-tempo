# -*- coding: utf-8 -*-
"""
Moteur de calage : compare un texte d'utilisateur a la grille syllabique
d'une melodie (ex. La Marseillaise) et signale les debordements.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import List, Optional

from . import syllables


@dataclass
class Phrase:
    id: str
    ref_text: str
    syllables: int
    melisma_slack: int = 0


@dataclass
class Section:
    id: str
    label: str
    phrases: List[Phrase]


@dataclass
class Melody:
    title: str
    meter: str
    tempo_bpm: int
    key: str
    abc_source: str
    sections: List[Section]
    composer: str = ""
    source_url: str = ""

    def all_phrases(self) -> List[Phrase]:
        return [p for s in self.sections for p in s.phrases]


def load_melody(path: str) -> Melody:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    sections = []
    for s in data["sections"]:
        phrases = [Phrase(**p) for p in s["phrases"]]
        sections.append(Section(id=s["id"], label=s["label"], phrases=phrases))
    return Melody(
        title=data.get("title", ""),
        composer=data.get("composer", ""),
        meter=data.get("meter", ""),
        tempo_bpm=int(data.get("tempo_bpm", 0) or 0),
        key=data.get("key", ""),
        abc_source=data.get("abc_source", ""),
        source_url=data.get("source_url", ""),
        sections=sections,
    )


@dataclass
class FitResult:
    phrase: Phrase
    user_text: str
    count: int
    status: str          # "ok" | "over" | "under" | "slack" | "empty"
    delta: int           # count - target (positif = trop de syllabes)
    suggestion: str = ""


def _suggest(delta: int, slack: int) -> str:
    if delta == 0:
        return "Parfait."
    if delta > 0:
        if delta <= slack:
            return (f"+{delta} syllabe(s), absorbable par un melisme "
                    f"(la melodie tient {slack} note(s) de marge ici).")
        return (f"Excedent de +{delta}. Pistes : elider un 'e' muet, "
                f"contracter (de + le -> du), couper un mot, ou choisir un "
                f"synonyme plus court.")
    # delta < 0
    return (f"Manque {abs(delta)} syllabe(s). Pistes : ajouter un article/adverbe, "
            f"developper un mot (chante -> chantera), ou tenir une voyelle "
            f"(diaerese : 'nation' = na-ti-on).")


def fit_line(phrase: Phrase, user_text: str, sung: bool = True) -> FitResult:
    text = (user_text or "").strip()
    if not text:
        return FitResult(phrase, "", 0, "empty", -phrase.syllables,
                         "(vide) Vers attendu : " + str(phrase.syllables) + " syllabes.")
    count = syllables.count_line(text, sung=sung)
    delta = count - phrase.syllables
    if delta == 0:
        status = "ok"
    elif delta > 0:
        status = "slack" if delta <= phrase.melisma_slack else "over"
    else:
        status = "under"
    return FitResult(phrase, text, count, status, delta,
                     _suggest(delta, phrase.melisma_slack))


def fit_section(section: Section, user_lines: List[str], sung: bool = True) -> List[FitResult]:
    results = []
    for i, phrase in enumerate(section.phrases):
        line = user_lines[i] if i < len(user_lines) else ""
        results.append(fit_line(phrase, line, sung=sung))
    return results


def fit_text(melody: Melody, text: str, sung: bool = True):
    """Cale un bloc de texte. Les lignes vides separent les sections OU on remplit
    sequentiellement phrase par phrase dans l'ordre couplet puis refrain.
    Ici : remplissage sequentiel sur toutes les phrases de la melodie."""
    lines = [l for l in text.splitlines()]
    # on retire les lignes vides de tete/queue mais on garde la structure simple :
    user_lines = [l for l in lines if l.strip() != ""]
    phrases = melody.all_phrases()
    out = []
    for i, phrase in enumerate(phrases):
        line = user_lines[i] if i < len(user_lines) else ""
        out.append(fit_line(phrase, line, sung=sung))
    extra = user_lines[len(phrases):]
    return out, extra


STATUS_SYMBOL = {
    "ok": "OK",
    "slack": "~",
    "over": "X",
    "under": "-",
    "empty": ".",
}
