# -*- coding: utf-8 -*-
"""
Syllabation francaise orientee CHANT.

Le comptage de syllabes en francais chante differe du francais parle :
le 'e' muet final est souvent CHANTE (une note lui est donnee), sauf
quand il s'elide devant une voyelle (liaison/elision).

Ce module fournit :
  - syllabify(word)        -> liste de syllabes (jolie coupure, via pyphen si dispo)
  - count_line(text, sung) -> nombre de syllabes CHANTEES d'un vers
  - count_word(word, ...)  -> nombre de syllabes d'un mot isole

Le comptage du francais est intrinsequement ambigu (synerese/dierese :
"hier" = 1 ou 2 ? "lion" = 1 ou 2 ?). On vise une heuristique RAISONNABLE
et on laisse l'humain trancher via des marqueurs manuels :

  *  ou  +   apres une syllabe        -> force une syllabe en PLUS (dierese)   ex: "li+on"
  _ (souligne) entre deux voyelles    -> force une coupure                     ex: "pa_ys"
  =  colle deux voyelles en une       -> force une synerese (1 syllabe)        ex: "li=on"
  | (barre)  -> coupure de mesure imposee par l'utilisateur (ignoree au comptage)

L'elision automatique du 'e' muet final devant voyelle suit la regle classique.
"""
from __future__ import annotations

import re
import unicodedata

try:
    import pyphen  # type: ignore
    _DIC = pyphen.Pyphen(lang="fr_FR")
except Exception:  # pyphen absent -> fallback interne
    _DIC = None

VOYELLES = set("aeiouyàâäéèêëîïôöùûüœæ")
# voyelles qui declenchent l'elision du 'e' muet du mot precedent
_VOY_LIAISON = set("aeiouyàâäéèêëîïôöùûüœæh")

_APOSTROPHE = "'’"


def strip_accents_lower(s: str) -> str:
    s = s.lower()
    return s


def _is_vowel(c: str) -> bool:
    return c in VOYELLES


def _clean_token(word: str) -> str:
    """Garde lettres + apostrophes + marqueurs manuels."""
    return word.strip()


def syllabify(word: str):
    """Decoupe un mot en syllabes pour AFFICHAGE (pas pour comptage exact).
    Utilise pyphen si disponible, sinon un decoupeur par groupes de voyelles."""
    w = re.sub(r"[*+_=|]", "", word)
    if not w:
        return [word]
    if _DIC is not None:
        out = _DIC.inserted(w).split("-")
        return [s for s in out if s]
    # fallback : coupe apres chaque groupe de voyelles suivi d'une consonne
    sylls, cur = [], ""
    prev_v = False
    for c in w:
        cur += c
        v = _is_vowel(c)
        if prev_v and not v:
            # consonne apres voyelle : on coupera avant la prochaine voyelle
            pass
        prev_v = v
    # simple : retombe sur pyphen-like par regex
    parts = re.findall(r"[^aeiouyàâäéèêëîïôöùûüœæ]*[aeiouyàâäéèêëîïôöùûüœæ]+", w, re.I)
    return parts or [w]


def _count_vowel_groups(word: str) -> int:
    """Compte les groupes de voyelles = noyaux syllabiques (approximation).
    Un 'y' ENTRE deux voyelles agit comme une consonne (/j/) et separe les
    noyaux : citoyens = ci-to-yens (3), voyez = vo-yez (2)."""
    w = re.sub(
        r"(?<=[aeiouàâäéèêëîïôöùûüœæ])y(?=[aeiouàâäéèêëîïôöùûüœæ])",
        "j", word, flags=re.I)
    return len(re.findall(r"[aeiouyàâäéèêëîïôöùûüœæ]+", w, re.I))


def _apply_manual_markers(word: str):
    """Retourne (mot_nettoye, delta) ou delta = ajustement manuel de syllabes.
       * ou + : +1 (dierese)   ; = : -1 (synerese)   ; _ : +1 (coupure forcee)."""
    delta = word.count("*") + word.count("+") + word.count("_") - word.count("=")
    clean = re.sub(r"[*+_=|]", "", word)
    return clean, delta


def count_word(word: str, sung: bool = True, next_starts_with_vowel: bool = False) -> int:
    """Nombre de syllabes d'un mot isole, oriente chant."""
    raw = _clean_token(word)
    clean, delta = _apply_manual_markers(raw)
    clean_l = clean.lower()
    # enleve la ponctuation de bord
    clean_l = clean_l.strip(".,;:!?()[]\"«»…")
    if not clean_l:
        return 0

    n = _count_vowel_groups(clean_l)
    if n == 0:
        n = 1  # mot sans voyelle ecrite (rare) compte pour 1

    if sung:
        # hiatus '-ie' (pa-tri-e, tyran-ni-e) : le e muet est une syllabe CHANTEE
        # (il avait ete fusionne dans le groupe vocalique 'ie').
        if len(clean_l) >= 2 and clean_l.endswith("ie") and not next_starts_with_vowel:
            n += 1
        elif (_ends_with_mute_e(clean_l) and next_starts_with_vowel
              and _mute_e_preceded_by_consonant(clean_l)):
            # elision du e PROPRE (precede d'une consonne) devant voyelle : fran-c'_
            n -= 1
    else:
        # francais parle : on retire le e muet seulement s'il forme son propre noyau
        if _ends_with_mute_e(clean_l) and _mute_e_preceded_by_consonant(clean_l):
            n -= 1

    return max(0, n + delta)


def _mute_e_preceded_by_consonant(w: str) -> bool:
    """Le 'e' muet final est-il precede d'une consonne (noyau propre : fran-ce) ?
    Si precede d'une voyelle (pa-tri-e), il a ete fusionne dans le groupe vocalique.
    Cas 'qu'/'gu' : le 'u' apres q/g est muet -> traite comme une consonne (que = 1)."""
    if w.endswith("ent") and len(w) > 3:
        idx = len(w) - 3
    elif w.endswith("es") and len(w) > 2:
        idx = len(w) - 2
    elif w.endswith("e") and len(w) > 1:
        idx = len(w) - 1
    else:
        return False
    if idx - 1 < 0:
        return False
    prev = w[idx - 1]
    if prev == "u" and idx - 2 >= 0 and w[idx - 2] in ("q", "g"):
        return True
    return prev not in VOYELLES


def _ends_with_mute_e(w: str) -> bool:
    """Heuristique : le mot finit-il par un 'e' (ou -es/-ent) potentiellement muet ?"""
    if w.endswith("ent") and len(w) > 3:
        # peut etre une terminaison verbale muette (-ent) -> traite comme e muet
        return True
    if w.endswith("es") and len(w) > 2:
        return True
    if w.endswith("e") and len(w) > 1:
        # 'e' final non accentue
        return True
    return False


def _word_starts_with_vowel(word: str) -> bool:
    w = re.sub(r"[*+_=|]", "", word).lower().lstrip(".,;:!?()[]\"«»…" + _APOSTROPHE)
    if not w:
        return False
    # h muet : on considere que h initial autorise l'elision (approximation)
    if w[0] == "h":
        return True
    return w[0] in VOYELLES


def split_words(text: str):
    """Separe un vers en mots, en gerant les apostrophes (l', d', qu')."""
    text = text.strip()
    # on garde l'apostrophe collee au mot suivant : "l'etendard" reste un token
    tokens = re.split(r"\s+", text)
    return [t for t in tokens if t]


def count_line(text: str, sung: bool = True) -> int:
    """Nombre total de syllabes CHANTEES d'un vers."""
    words = split_words(text)
    total = 0
    for i, w in enumerate(words):
        nxt = words[i + 1] if i + 1 < len(words) else ""
        next_v = _word_starts_with_vowel(nxt) if nxt else False
        # cas d'une apostrophe interne : "l'etendard" -> elision deja ecrite,
        # on compte le mot tel quel (l' n'ajoute pas de syllabe).
        if any(a in w for a in _APOSTROPHE):
            w = re.sub(r"^[a-z]+['’]", "", w, flags=re.I) or w
        total += count_word(w, sung=sung, next_starts_with_vowel=next_v)
    return total


def annotate_line(text: str, sung: bool = True):
    """Retourne une liste [(mot, n_syllabes, [syllabes...])] pour l'affichage."""
    words = split_words(text)
    out = []
    for i, w in enumerate(words):
        nxt = words[i + 1] if i + 1 < len(words) else ""
        next_v = _word_starts_with_vowel(nxt) if nxt else False
        wc = w
        if any(a in w for a in _APOSTROPHE):
            wc = re.sub(r"^[a-z]+['’]", "", w, flags=re.I) or w
        n = count_word(wc, sung=sung, next_starts_with_vowel=next_v)
        out.append((w, n, syllabify(w)))
    return out


if __name__ == "__main__":
    tests = [
        "Allons enfants de la Patrie",
        "Le jour de gloire est arrive",
        "Rendons enfin le pouvoir au peuple",
        "Que parle enfin la nation",
    ]
    for t in tests:
        print(f"{count_line(t):2d}  {t}")
