/*
 * fitter.js — moteur de calage syllabique francais (port JS de lyrics_fitter).
 * Fonctionne dans le navigateur (global window.Fitter) ET sous Node (module.exports).
 * Aucune dependance.
 */
(function (root) {
  "use strict";

  var VOY = "aeiouyàâäéèêëîïôöùûüœæ";          // voyelles (avec y)
  var VOY_NOY = "aeiouàâäéèêëîïôöùûüœæ";        // voyelles "noyau" hors y (pour la regle du y)
  var APO = "'’";
  var PUNCT = ".,;:!?()[]\"«»…";

  var reYInter = new RegExp("(?<=[" + VOY_NOY + "])y(?=[" + VOY_NOY + "])", "gi");
  var reGroups = new RegExp("[" + VOY + "]+", "gi");
  var reMarkers = /[*+_=|]/g;

  function vowelGroups(word) {
    // 'y' entre deux voyelles agit comme une consonne (/j/) : citoyens = ci-to-yens
    var w = word.replace(reYInter, "j");
    var m = w.match(reGroups);
    return m ? m.length : 0;
  }

  function stripBorderPunct(s) {
    // retire la ponctuation de bord
    var i = 0, j = s.length;
    while (i < j && PUNCT.indexOf(s[i]) >= 0) i++;
    while (j > i && PUNCT.indexOf(s[j - 1]) >= 0) j--;
    return s.slice(i, j);
  }

  function endsWithMuteE(w) {
    if (w.length > 3 && w.endsWith("ent")) return true;   // -ent verbal muet
    if (w.length > 2 && w.endsWith("es")) return true;
    if (w.length > 1 && w.endsWith("e")) return true;
    return false;
  }

  // Le 'e' muet final est-il PRECEDE d'une consonne (donc noyau propre : fran-ce) ?
  // Si precede d'une voyelle (pa-tri-e), il a ete fusionne dans le groupe vocalique.
  // Cas 'qu'/'gu' : le 'u' apres q/g est muet -> traite comme une consonne (que = 1).
  function muteEPrecededByConsonant(w) {
    var idx;
    if (w.length > 3 && w.endsWith("ent")) idx = w.length - 3;
    else if (w.length > 2 && w.endsWith("es")) idx = w.length - 2;
    else if (w.length > 1 && w.endsWith("e")) idx = w.length - 1;
    else return false;
    if (idx - 1 < 0) return false;
    var prev = w[idx - 1];
    if ((prev === "u") && idx - 2 >= 0 && (w[idx - 2] === "q" || w[idx - 2] === "g"))
      return true;                       // qu/gu : u muet
    return VOY_NOY.indexOf(prev) < 0;    // consonne avant le e
  }

  function applyMarkers(word) {
    var plus = (word.match(/[*+_]/g) || []).length;
    var minus = (word.match(/=/g) || []).length;
    var clean = word.replace(reMarkers, "");
    return { clean: clean, delta: plus - minus };
  }

  function wordStartsWithVowel(word) {
    var w = word.replace(reMarkers, "").toLowerCase();
    // retire ponctuation + apostrophes en tete
    var i = 0;
    while (i < w.length && (PUNCT.indexOf(w[i]) >= 0 || APO.indexOf(w[i]) >= 0)) i++;
    w = w.slice(i);
    if (!w) return false;
    if (w[0] === "h") return true;          // h muet (approximation)
    return VOY.indexOf(w[0]) >= 0;
  }

  function countWord(word, sung, nextStartsWithVowel) {
    var ap = applyMarkers(word);
    var clean = stripBorderPunct(ap.clean.toLowerCase());
    if (!clean) return 0;
    var n = vowelGroups(clean);
    if (n === 0) n = 1;
    if (sung) {
      // hiatus '-ie' (pa-tri-e, tyran-ni-e) : le e muet est une syllabe chantee
      if (clean.length >= 2 && clean.endsWith("ie") && !nextStartsWithVowel) {
        n += 1;
      } else if (endsWithMuteE(clean) && nextStartsWithVowel
                 && muteEPrecededByConsonant(clean)) {
        n -= 1;                          // elision du e propre devant voyelle (fran-c'_)
      }
    } else {
      // parle : on retire le e muet seulement s'il forme son propre noyau (fran-ce -> 1)
      if (endsWithMuteE(clean) && muteEPrecededByConsonant(clean)) n -= 1;
    }
    return Math.max(0, n + ap.delta);
  }

  function splitWords(text) {
    return text.trim().split(/\s+/).filter(Boolean);
  }

  function countLine(text, sung) {
    if (sung === undefined) sung = true;
    var words = splitWords(text || "");
    var total = 0;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var nxt = i + 1 < words.length ? words[i + 1] : "";
      var nextV = nxt ? wordStartsWithVowel(nxt) : false;
      // apostrophe interne : "l'etendard" -> on retire le prefixe "x'" (n'ajoute pas de syllabe)
      if (/['’]/.test(w)) {
        var stripped = w.replace(/^[a-zàâäéèêëîïôöùûüœæ]+['’]/i, "");
        if (stripped) w = stripped;
      }
      total += countWord(w, sung, nextV);
    }
    return total;
  }

  // Cale un texte (un vers par ligne) sur une grille de melodie.
  // grille = [{id, ref_text, syllables, melisma_slack}, ...] (ordre couplet puis refrain).
  function fitText(phrases, text, sung) {
    if (sung === undefined) sung = true;
    var lines = (text || "").split(/\r?\n/).filter(function (l) { return l.trim() !== ""; });
    var out = [];
    for (var i = 0; i < phrases.length; i++) {
      var p = phrases[i];
      var line = i < lines.length ? lines[i] : "";
      out.push(fitLine(p, line, sung));
    }
    var extra = lines.slice(phrases.length);
    return { results: out, extra: extra };
  }

  function fitLine(phrase, userText, sung) {
    var text = (userText || "").trim();
    if (!text) {
      return { phrase: phrase, userText: "", count: 0, status: "empty",
               delta: -phrase.syllables, suggestion: "À remplir (" + phrase.syllables + " syllabes)." };
    }
    var count = countLine(text, sung);
    var delta = count - phrase.syllables;
    var status;
    if (delta === 0) status = "ok";
    else if (delta > 0) status = (delta <= (phrase.melisma_slack || 0)) ? "slack" : "over";
    else status = "under";
    return { phrase: phrase, userText: text, count: count, status: status,
             delta: delta, suggestion: suggest(delta, phrase.melisma_slack || 0) };
  }

  function suggest(delta, slack) {
    if (delta === 0) return "Parfait.";
    if (delta > 0) {
      if (delta <= slack) return "+" + delta + " absorbable par un mélisme.";
      return "Excédent de +" + delta + " : élider un « e » muet, contracter, ou raccourcir.";
    }
    return "Manque " + Math.abs(delta) + " : ajouter un mot, ou tenir une voyelle (diérèse).";
  }

  var API = {
    countLine: countLine, countWord: countWord, vowelGroups: vowelGroups,
    splitWords: splitWords, fitText: fitText, fitLine: fitLine
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.Fitter = API;
})(typeof window !== "undefined" ? window : globalThis);
