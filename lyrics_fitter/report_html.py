# -*- coding: utf-8 -*-
"""Rapport HTML colore du calage syllabique."""
from __future__ import annotations

import html
from typing import List

from .meter import FitResult, Melody

_COLORS = {
    "ok": "#1b7f3b",
    "slack": "#b58900",
    "over": "#c0271a",
    "under": "#1f6fb2",
    "empty": "#888888",
}
_BG = {
    "ok": "#e7f6ec",
    "slack": "#fbf3d8",
    "over": "#fbe3e0",
    "under": "#e3effb",
    "empty": "#f0f0f0",
}
_LABEL = {
    "ok": "OK",
    "slack": "melisme",
    "over": "deborde",
    "under": "manque",
    "empty": "vide",
}


def render(melody: Melody, results: List[FitResult], extra: List[str] | None = None,
           title: str = "Calage syllabique") -> str:
    rows = []
    for r in results:
        c = _COLORS[r.status]
        bg = _BG[r.status]
        delta = ("+%d" % r.delta) if r.delta > 0 else ("%d" % r.delta if r.delta else "0")
        user = html.escape(r.user_text) if r.user_text else "<i>(a remplir)</i>"
        rows.append(f"""
        <tr style="background:{bg}">
          <td class="ref">{html.escape(r.phrase.ref_text)}</td>
          <td class="tgt">{r.phrase.syllables}</td>
          <td class="usr">{user}</td>
          <td class="cnt" style="color:{c};font-weight:700">{r.count}</td>
          <td class="dlt" style="color:{c};font-weight:700">{delta}</td>
          <td class="st"  style="color:{c};font-weight:700">{_LABEL[r.status]}</td>
          <td class="sug">{html.escape(r.suggestion)}</td>
        </tr>""")

    extra_html = ""
    if extra:
        items = "".join(f"<li>{html.escape(e)}</li>" for e in extra)
        extra_html = f"""
        <div class="warn">
          <b>Lignes en trop</b> (au-dela de la structure de la melodie) :
          <ul>{items}</ul>
        </div>"""

    src = ""
    if melody.source_url:
        src = f'<a href="{html.escape(melody.source_url)}">source de la partition</a>'

    return f"""<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} — {html.escape(melody.title)}</title>
<style>
  body {{ font-family: -apple-system, Segoe UI, Roboto, sans-serif; margin: 2rem auto;
         max-width: 1000px; color:#1a1a1a; padding:0 1rem; }}
  h1 {{ font-size: 1.4rem; margin-bottom:.2rem; }}
  .meta {{ color:#666; margin-bottom:1.2rem; font-size:.9rem; }}
  table {{ border-collapse: collapse; width:100%; font-size:.95rem; }}
  th, td {{ padding:.5rem .6rem; text-align:left; vertical-align:top;
           border-bottom:1px solid #e3e3e3; }}
  th {{ background:#1a1a1a; color:#fff; font-weight:600; position:sticky; top:0; }}
  td.tgt, td.cnt, td.dlt {{ text-align:center; font-variant-numeric: tabular-nums; }}
  td.ref {{ color:#555; font-style:italic; max-width:230px; }}
  td.sug {{ color:#444; font-size:.85rem; max-width:300px; }}
  .legend span {{ display:inline-block; padding:.15rem .5rem; border-radius:4px;
                 margin-right:.4rem; font-size:.8rem; }}
  .warn {{ background:#fbe3e0; border:1px solid #c0271a; padding:.6rem 1rem;
           border-radius:6px; margin-top:1rem; }}
  footer {{ margin-top:1.5rem; color:#888; font-size:.8rem; }}
</style></head>
<body>
  <h1>{html.escape(title)}</h1>
  <div class="meta">
    Melodie : <b>{html.escape(melody.title)}</b> — {html.escape(melody.composer)} ·
    {html.escape(melody.meter)} · {melody.tempo_bpm} bpm · ton {html.escape(melody.key)} · {src}
  </div>
  <div class="legend">
    <span style="background:{_BG['ok']};color:{_COLORS['ok']}">OK = pile</span>
    <span style="background:{_BG['slack']};color:{_COLORS['slack']}">melisme = +1 absorbable</span>
    <span style="background:{_BG['over']};color:{_COLORS['over']}">deborde</span>
    <span style="background:{_BG['under']};color:{_COLORS['under']}">manque</span>
  </div>
  <p></p>
  <table>
    <tr><th>Vers de reference</th><th>Cible</th><th>Votre texte</th>
        <th>Syll.</th><th>&Delta;</th><th>Etat</th><th>Suggestion</th></tr>
    {''.join(rows)}
  </table>
  {extra_html}
  <footer>
    Genere par lyrics_fitter. Le comptage de syllabes chantees est une heuristique :
    marqueurs manuels possibles (+ dierese, = synerese, _ coupure).
  </footer>
</body></html>"""
