# -*- coding: utf-8 -*-
"""
Mode bureau (bonus) : meme moteur que le CLI, edition live.
Lancement :  python -m lyrics_fitter.gui_tk melodies/marseillaise.json

A gauche : une zone de texte (un vers par ligne).
A droite : la grille de reference + le compte de syllabes, recolore en direct.
"""
from __future__ import annotations

import sys
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

from . import meter as _meter

_COLORS = {"ok": "#1b7f3b", "slack": "#b58900", "over": "#c0271a",
           "under": "#1f6fb2", "empty": "#999999"}


class App(tk.Tk):
    def __init__(self, melody_path: str):
        super().__init__()
        self.title("lyrics_fitter — calage syllabique")
        self.geometry("980x620")
        self.melody = _meter.load_melody(melody_path)

        top = ttk.Frame(self, padding=8)
        top.pack(fill="x")
        ttk.Label(top, text=f"Melodie : {self.melody.title}  ·  "
                            f"{self.melody.meter} {self.melody.tempo_bpm}bpm  ·  "
                            f"ton {self.melody.key}",
                  font=("Segoe UI", 11, "bold")).pack(side="left")
        self.sung = tk.BooleanVar(value=True)
        ttk.Checkbutton(top, text="comptage chante (e muet compte)",
                        variable=self.sung, command=self.recompute).pack(side="right")

        main = ttk.Frame(self, padding=8)
        main.pack(fill="both", expand=True)

        left = ttk.Frame(main)
        left.pack(side="left", fill="both", expand=True)
        ttk.Label(left, text="Vos paroles (un vers par ligne) :").pack(anchor="w")
        self.text = tk.Text(left, width=44, font=("Consolas", 12), undo=True)
        self.text.pack(fill="both", expand=True)
        self.text.bind("<KeyRelease>", lambda e: self.recompute())

        # pre-remplit avec les vers de reference en commentaire d'aide
        seed = "\n".join(p.ref_text for p in self.melody.all_phrases())
        self.text.insert("1.0", seed)

        right = ttk.Frame(main)
        right.pack(side="right", fill="both", expand=True, padx=(8, 0))
        ttk.Label(right, text="Calage :").pack(anchor="w")
        cols = ("etat", "syl", "cib", "d", "ref")
        self.tree = ttk.Treeview(right, columns=cols, show="headings", height=20)
        for c, w, t in [("etat", 60, "etat"), ("syl", 45, "syl"),
                        ("cib", 45, "cible"), ("d", 45, "d"),
                        ("ref", 260, "vers de reference")]:
            self.tree.heading(c, text=t)
            self.tree.column(c, width=w, anchor="center" if c != "ref" else "w")
        self.tree.pack(fill="both", expand=True)
        for st, col in _COLORS.items():
            self.tree.tag_configure(st, foreground=col)

        self.status = ttk.Label(self, text="", padding=6)
        self.status.pack(fill="x")
        self.recompute()

    def recompute(self):
        text = self.text.get("1.0", "end")
        results, extra = _meter.fit_text(self.melody, text, sung=self.sung.get())
        self.tree.delete(*self.tree.get_children())
        n_ok = 0
        for r in results:
            d = (f"+{r.delta}" if r.delta > 0 else str(r.delta))
            self.tree.insert("", "end",
                             values=(_meter.STATUS_SYMBOL[r.status], r.count,
                                     r.phrase.syllables, d, r.phrase.ref_text),
                             tags=(r.status,))
            if r.status in ("ok", "slack"):
                n_ok += 1
        msg = f"{n_ok}/{len(results)} vers cales."
        if extra:
            msg += f"  /!\\ {len(extra)} ligne(s) en trop."
        self.status.config(text=msg)


def main(argv=None):
    argv = argv or sys.argv[1:]
    if argv:
        path = argv[0]
    else:
        path = filedialog.askopenfilename(
            title="Choisir une melodie (.json)",
            filetypes=[("Melodie JSON", "*.json")])
        if not path:
            return
    App(path).mainloop()


if __name__ == "__main__":
    main()
