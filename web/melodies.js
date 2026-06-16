/*
 * melodies.js — catalogue de mélodies pour le calage.
 * Chaque mélodie = métadonnées + grille syllabique (phrases) + notes encodées
 * (pour la lecture Web Audio). Notes : "midi:durée" ou "Rdurée" (silence),
 * durée en temps (quarterLength). Pour ajouter une mélodie : copier ce schéma.
 */
(function (root) {
  "use strict";

  var MARSEILLAISE = {
    id: "marseillaise",
    title: "La Marseillaise",
    composer: "Rouget de Lisle (domaine public)",
    meter: "4/4",
    tempo_bpm: 75,
    key: "F",
    // grille = phrases dans l'ordre (couplet puis refrain)
    sections: [
      {
        label: "Couplet",
        phrases: [
          { id: "c1", ref: "Allons enfants de la Patrie", syl: 9, slack: 1 },
          { id: "c2", ref: "Le jour de gloire est arrivé", syl: 8, slack: 1 },
          { id: "c3", ref: "Contre nous de la tyrannie", syl: 9, slack: 0 },
          { id: "c4", ref: "L'étendard sanglant est levé", syl: 8, slack: 0 },
          { id: "c5", ref: "L'étendard sanglant est levé", syl: 8, slack: 1 },
          { id: "c6", ref: "Entendez-vous dans nos campagnes", syl: 9, slack: 0 },
          { id: "c7", ref: "Mugir ces féroces soldats ?", syl: 8, slack: 0 },
          { id: "c8", ref: "Ils viennent jusque dans vos bras", syl: 8, slack: 0 },
          { id: "c9", ref: "Égorger vos fils, vos compagnes !", syl: 9, slack: 1 }
        ]
      },
      {
        label: "Refrain",
        phrases: [
          { id: "r1", ref: "Aux armes, citoyens", syl: 6, slack: 0 },
          { id: "r2", ref: "Formez vos bataillons", syl: 6, slack: 0 },
          { id: "r3", ref: "Marchons, marchons", syl: 4, slack: 0 },
          { id: "r4", ref: "Qu'un sang impur", syl: 4, slack: 0 },
          { id: "r5", ref: "Abreuve nos sillons", syl: 6, slack: 0 }
        ]
      }
    ],
    // 125 événements extraits de la transcription ABC (music21)
    notes: "60:0.25 60:0.75 60:0.25 65:1.0 65:1.0 67:1.0 67:1.0 72:1.5 69:0.5 65:0.5 R0.25 65:0.25 69:0.75 65:0.25 62:1.0 70:2.0 67:0.75 64:0.25 65:2.0 R1.0 65:0.75 67:0.25 69:1.0 69:1.0 69:1.0 70:0.75 69:0.25 69:1.0 67:1.0 R1.0 67:0.75 69:0.25 70:1.0 70:1.0 70:1.0 72:0.75 70:0.25 69:2.0 R1.0 72:0.75 72:0.25 72:1.0 69:0.75 65:0.25 72:1.0 69:0.75 65:0.25 60:2.0 R0.75 60:0.25 60:0.75 64:0.25 67:2.0 70:1.0 67:0.75 64:0.25 67:1.0 65:1.0 63:2.0 62:1.0 65:0.75 65:0.25 65:1.0 64:0.75 65:0.25 67:3.0 R0.5 67:0.5 68:1.5 69:0.5 69:0.5 69:0.5 70:0.5 72:0.5 67:3.0 68:0.5 67:0.5 65:1.5 65:0.5 65:0.5 68:0.5 67:0.5 65:0.5 65:1.0 64:0.5 R0.5 R1.0 R0.75 72:0.25 72:2.0 72:0.75 72:0.25 69:0.75 65:0.25 67:3.0 R0.75 72:0.25 72:2.0 72:0.75 72:0.25 69:0.75 65:0.25 67:2.0 67:0.5 R0.5 60:1.0 65:2.0 R1.0 67:1.0 69:2.0 R2.0 70:2.0 72:1.0 74:1.0 67:2.0 67:0.5 R0.5 74:1.0 72:2.0 72:0.75 69:0.25 70:0.75 67:0.25 65:2.0 R0.75"
  };

  function phrasesFlat(melody) {
    var out = [];
    melody.sections.forEach(function (s) {
      s.phrases.forEach(function (p) {
        out.push({ id: p.id, ref_text: p.ref, syllables: p.syl,
                   melisma_slack: p.slack, section: s.label });
      });
    });
    return out;
  }

  function parseNotes(enc) {
    return enc.trim().split(/\s+/).map(function (tok) {
      if (tok[0] === "R") return { rest: true, ql: parseFloat(tok.slice(1)) };
      var parts = tok.split(":");
      return { midi: parseInt(parts[0], 10), ql: parseFloat(parts[1]) };
    });
  }

  var API = {
    list: [MARSEILLAISE],
    byId: { marseillaise: MARSEILLAISE },
    phrasesFlat: phrasesFlat,
    parseNotes: parseNotes
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.Melodies = API;
})(typeof window !== "undefined" ? window : globalThis);
