/*
 * app.js — interface de l'outil de calage (front statique, sans aucune identification).
 * Dépend de fitter.js, melodies.js, player.js. Tout est local au navigateur :
 * aucune donnée n'est envoyée à un serveur.
 */
(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var state = { melody: null, phrases: [], sung: true, player: null };
  var SAVE_KEY = "lot_lyrics_v1";
  // Texte affiché par défaut à la première arrivée (création « pouvoir au peuple »).
  var DEFAULT_LYRICS = [
    "Allons enfants de la Patrie",
    "Le jour de gloire s'est envolé=",
    "Contre nous de la tyrannie",
    "L'étendard des sans dents= est levé",
    "L'étendard des brav'= gens poing levé",
    "Entendez-vous dans nos campagnes",
    "Souffrir nos vaillants paysans+",
    "Qualité,= santé les pieds devant",
    "Sacrifiés pour l'Europe occupée",
    "Aux urnes, citoyens",
    "Votons c'est le chemin",
    "Votons constituons=",
    "Sus à l'IMPUNI==TE",
    "Vive=la souverain'té"
  ].join("\n");
  // Textes considérés « par défaut » (remplaçables sans détruire le travail du visiteur).
  var knownDefaults = {};
  knownDefaults[DEFAULT_LYRICS] = true;
  function maybeSetLyrics(text) {
    if (!text) return;
    var cur = $("#lyrics").value;
    if (cur.trim() === "" || knownDefaults[cur]) {
      $("#lyrics").value = text; knownDefaults[text] = true; render();
    }
  }

  /* ---------- syllabation simple (pour aligner les paroles à l'export) ---------- */
  function syllabify(line) {
    var out = [];
    line.trim().split(/\s+/).forEach(function (w) {
      if (!w) return;
      var m = w.match(/[^aeiouyàâäéèêëîïôöùûüœæ]*[aeiouyàâäéèêëîïôöùûüœæ]+/gi);
      (m || [w]).forEach(function (s) {
        out.push(s.replace(/[^a-zàâäéèêëîïôöùûüœæ']/gi, "") || s);
      });
    });
    return out;
  }
  function flattenSylls() {
    var lines = $("#lyrics").value.split(/\r?\n/).filter(function (l) { return l.trim(); });
    var out = [];
    lines.forEach(function (l) { out = out.concat(syllabify(l)); });
    return out;
  }

  /* ---------------------------- export MIDI (Type-0) ---------------------------- */
  function vlq(n) { var b = [n & 0x7f]; n = Math.floor(n / 128);
    while (n > 0) { b.unshift((n & 0x7f) | 0x80); n = Math.floor(n / 128); } return b; }
  function toMIDI(notes, bpm) {
    var div = 480, usq = Math.round(60000000 / bpm), trk = [];
    trk.push.apply(trk, vlq(0).concat([0xFF, 0x51, 0x03, (usq >> 16) & 255, (usq >> 8) & 255, usq & 255]));
    var pend = 0;
    notes.forEach(function (n) {
      var t = Math.round(n.ql * div);
      if (n.rest) { pend += t; return; }
      trk.push.apply(trk, vlq(pend).concat([0x90, n.midi, 80]));
      trk.push.apply(trk, vlq(t).concat([0x80, n.midi, 0]));
      pend = 0;
    });
    trk.push.apply(trk, vlq(pend).concat([0xFF, 0x2F, 0x00]));
    var L = trk.length;
    var head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (div >> 8) & 255, div & 255,
                0x4d, 0x54, 0x72, 0x6b, (L >> 24) & 255, (L >> 16) & 255, (L >> 8) & 255, L & 255];
    return Uint8Array.from(head.concat(trk));
  }

  /* ---------------------------- export MusicXML --------------------------------- */
  var SINGLE = { 1: ["16th", 0], 2: ["eighth", 0], 3: ["eighth", 1], 4: ["quarter", 0],
                 6: ["quarter", 1], 8: ["half", 0], 12: ["half", 1], 16: ["whole", 0] };
  function splitDur(d) { var out = [], vals = [16, 12, 8, 6, 4, 3, 2, 1];
    while (d > 0) { for (var i = 0; i < vals.length; i++) if (vals[i] <= d) { out.push(vals[i]); d -= vals[i]; break; } } return out; }
  var STEP = { 0: ["C", 0], 2: ["D", 0], 4: ["E", 0], 5: ["F", 0], 7: ["G", 0], 9: ["A", 0],
               11: ["B", 0], 10: ["B", -1], 3: ["E", -1], 8: ["A", -1], 6: ["G", -1], 1: ["D", -1] };
  function esc(s) { return (s || "").replace(/[&<>]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function toMusicXML(notes, sylls) {
    var DIV = 4, CAP = 16, pos = 0, allParts = [], si = 0;
    notes.forEach(function (n) {
      var rem = Math.round(n.ql * DIV), isRest = !!n.rest, np = [];
      while (rem > 0) {
        var space = CAP - pos, take = Math.min(rem, space);
        splitDur(take).forEach(function (p) { np.push({ divs: p, closes: false }); });
        pos += take; rem -= take;
        if (pos >= CAP) { np[np.length - 1].closes = true; pos = 0; }
      }
      var syl = (!isRest && si < sylls.length) ? sylls[si++] : null;
      np.forEach(function (pt, i) {
        pt.isRest = isRest; pt.midi = n.midi;
        pt.tieStop = !isRest && i > 0; pt.tieStart = !isRest && i < np.length - 1;
        pt.lyric = (i === 0) ? syl : null;
      });
      allParts = allParts.concat(np);
    });
    function noteXML(pt) {
      var d = SINGLE[pt.divs], type = d[0], dots = d[1], s = "<note>";
      if (pt.isRest) s += "<rest/>";
      else { var st = STEP[pt.midi % 12];
        s += "<pitch><step>" + st[0] + "</step>" + (st[1] ? "<alter>" + st[1] + "</alter>" : "") +
             "<octave>" + (Math.floor(pt.midi / 12) - 1) + "</octave></pitch>"; }
      s += "<duration>" + pt.divs + "</duration>";
      if (pt.tieStart) s += '<tie type="start"/>';
      if (pt.tieStop) s += '<tie type="stop"/>';
      s += "<type>" + type + "</type>" + new Array(dots + 1).join("<dot/>");
      var notn = "";
      if (pt.tieStart) notn += '<tied type="start"/>';
      if (pt.tieStop) notn += '<tied type="stop"/>';
      if (notn) s += "<notations>" + notn + "</notations>";
      if (pt.lyric) s += "<lyric><syllabic>single</syllabic><text>" + esc(pt.lyric) + "</text></lyric>";
      return s + "</note>";
    }
    var measures = [], cur = [], mnum = 1;
    allParts.forEach(function (pt) {
      cur.push(noteXML(pt));
      if (pt.closes) {
        measures.push('<measure number="' + mnum + '">' + (mnum === 1 ?
          "<attributes><divisions>" + DIV + "</divisions><key><fifths>0</fifths></key>" +
          "<time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>" : "") +
          cur.join("") + "</measure>");
        mnum++; cur = [];
      }
    });
    if (cur.length) measures.push('<measure number="' + mnum + '">' + cur.join("") + "</measure>");
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n' +
      '<score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Chant</part-name></score-part></part-list>' +
      '<part id="P1">' + measures.join("") + "</part></score-partwise>";
  }

  /* ------------------------------ téléchargement -------------------------------- */
  function download(filename, content, mime) {
    var blob = (content instanceof Uint8Array) ? new Blob([content], { type: mime })
                                               : new Blob([content], { type: mime + ";charset=utf-8" });
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  function slug() {
    var first = ($("#lyrics").value.split(/\r?\n/)[0] || "chant").trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
    return first || "chant";
  }

  /* ------------------------------ calage live ----------------------------------- */
  var LABEL = { ok: "OK", slack: "mélisme", over: "déborde", under: "manque", empty: "vide" };
  function escHtml(s) { return esc(s).replace(/"/g, "&quot;"); }
  function render() {
    var res = Fitter.fitText(state.phrases, $("#lyrics").value, state.sung);
    var tbody = $("#grid tbody"); tbody.innerHTML = ""; var nFit = 0;
    res.results.forEach(function (r) {
      var tr = document.createElement("tr"); tr.className = "st-" + r.status;
      var d = r.delta > 0 ? "+" + r.delta : "" + r.delta;
      tr.innerHTML =
        '<td class="ref">' + escHtml(r.phrase.ref_text) + "</td>" +
        '<td class="num">' + r.phrase.syllables + "</td>" +
        '<td class="usr">' + (r.userText ? escHtml(r.userText) : "<i>—</i>") + "</td>" +
        '<td class="num strong">' + (r.userText ? r.count : "") + "</td>" +
        '<td class="num strong">' + (r.userText ? d : "") + "</td>" +
        '<td class="badge">' + LABEL[r.status] + "</td>";
      tbody.appendChild(tr);
      if (r.status === "ok" || r.status === "slack") nFit++;
    });
    var msg = nFit + "/" + state.phrases.length + " vers calés";
    if (res.extra.length) msg += " · ⚠ " + res.extra.length + " ligne(s) en trop";
    $("#summary").textContent = msg;
    saveLocal();
  }

  /* ------------------------------ mélodie / lecture ----------------------------- */
  function loadMelody(id) {
    state.melody = Melodies.byId[id];
    state.songLyrics = (id === "marseillaise") ? DEFAULT_LYRICS : "";
    state.phrases = Melodies.phrasesFlat(state.melody);
    state.player = new LFPlayer.Player(state.melody.tempo_bpm);
    $("#melody-meta").textContent = state.melody.composer + " · " + state.melody.meter +
      " · " + state.melody.tempo_bpm + " bpm · ton " + state.melody.key;
    render();
  }
  function playMelody() {
    if (!state.player) return;
    if (state.player.playing) { state.player.stop(); $("#play").textContent = "▶ Écouter l'air"; return; }
    $("#play").textContent = "■ Stop";
    state.player.play(Melodies.parseNotes(state.melody.notes), null,
      function () { $("#play").textContent = "▶ Écouter l'air"; });
  }
  function loadTemplate() {
    $("#lyrics").value = state.phrases.map(function (p) { return p.ref_text; }).join("\n");
    render();
  }
  // Recharge les paroles d'exemple/création de l'air courant (ou, à défaut, les vers de référence).
  function loadSongLyrics() {
    var t = state.songLyrics;
    if (!t) { loadTemplate(); return; }
    var cur = $("#lyrics").value;
    if (cur.trim() !== "" && !knownDefaults[cur] &&
        !window.confirm("Remplacer le texte actuel par les paroles d'exemple ?")) return;
    $("#lyrics").value = t; knownDefaults[t] = true; render();
  }

  /* ------------------------------ import MIDI ----------------------------------- */
  function encodeEvents(events) {
    return events.map(function (e) { return e.rest ? ("R" + e.ql) : (e.midi + ":" + e.ql); }).join(" ");
  }
  function autoGrid(events) {
    var phrases = [], count = 0, idx = 1;
    events.forEach(function (e) {
      if (e.rest) {
        if (e.ql >= 0.75 && count > 0) { phrases.push({ id: "p" + idx, ref: "Phrase " + idx, syl: count, slack: 1 }); idx++; count = 0; }
      } else count++;
    });
    if (count > 0) phrases.push({ id: "p" + idx, ref: "Phrase " + idx, syl: count, slack: 1 });
    if (!phrases.length) phrases.push({ id: "p1", ref: "Mélodie", syl: 0, slack: 0 });
    return [{ label: "Mélodie importée", phrases: phrases }];
  }
  function loadMelodyFromBuffer(buf, name) {
    var res = LFMidi.readMIDI(buf);
    if (!res.events.length) { toast("MIDI vide ou illisible."); return; }
    Melodies.byId._import = {
      id: "_import", title: "🎵 " + String(name || "MIDI").replace(/\.midi?$/i, ""),
      composer: "MIDI importé — vérifie les droits", meter: "?",
      tempo_bpm: res.tempo || 100, key: "?",
      sections: autoGrid(res.events), notes: encodeEvents(res.events)
    };
    var sel = $("#melody-select");
    if (!sel.querySelector('option[value="_import"]')) {
      var o = document.createElement("option"); o.value = "_import"; o.textContent = "🎵 MIDI importé"; sel.appendChild(o);
    }
    sel.value = "_import";
    loadMelody("_import");
    var nn = res.events.filter(function (e) { return !e.rest; }).length;
    toast("MIDI chargé (" + nn + " notes). Écoute pour vérifier l'air.");
  }
  function importMIDI(file) {
    var rd = new FileReader();
    rd.onload = function () { try { loadMelodyFromBuffer(rd.result, file.name); } catch (e) { toast("Import impossible : " + e.message); } };
    rd.readAsArrayBuffer(file);
  }
  function loadMIDIFromUrl(url, name, lyrics) {
    toast("Chargement…");
    fetch(url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); })
      .then(function (buf) { loadMelodyFromBuffer(buf, name || url.split("/").pop()); maybeSetLyrics(lyrics); })
      .catch(function () { toast("Échec (CORS ou réseau). Télécharge le fichier puis dépose-le sur la page."); });
  }
  function populateReadyMidis() {
    var box = $("#ready-midis"); if (!box) return;
    fetch("midis/list.json").then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
      (list || []).forEach(function (m) {
        var b = document.createElement("button"); b.type = "button"; b.className = "ready-btn";
        b.textContent = "▶ " + m.label;
        b.title = (m.composer || "") + (m.note ? (" — " + m.note) : "");
        b.addEventListener("click", function () {
          loadMIDIFromUrl("midis/" + m.file, m.label);
          var base = m.file.replace(/\.[^.]+$/, "");
          fetch("midis/" + base + ".txt").then(function (r) { return r.ok ? r.text() : null; })
            .then(function (t) { if (t) { state.songLyrics = t.replace(/\r\n/g, "\n").replace(/\s+$/, ""); maybeSetLyrics(state.songLyrics); } })
            .catch(function () {});
        });
        box.appendChild(b);
      });
    }).catch(function () {});
  }

  /* --------------------- vérificateur « domaine public » ------------------------ */
  function pdCheck() {
    var composer = ($("#pd-composer").value || "").trim();
    var death = parseInt($("#pd-death").value, 10);
    var v = $("#pd-verdict");
    if (!composer || !isFinite(death)) {
      v.className = "warn";
      v.textContent = "Renseigne le compositeur ET son année de décès (obligatoires).";
      return;
    }
    var diff = new Date().getFullYear() - death;
    if (death >= 1940 && death <= 1956) {
      v.className = "warn";
      v.textContent = "À VÉRIFIER : décès en " + death + " — des prorogations de guerre / « mort pour la France » peuvent prolonger la protection.";
    } else if (diff > 70) {
      v.className = "ok";
      v.textContent = "Probablement LIBRE : " + composer + " décédé il y a " + diff + " ans (plus de 70). Vérifie quand même.";
    } else {
      v.className = "no";
      v.textContent = "Probablement PROTÉGÉ : décès il y a " + diff + " ans (moins de 70). Libre vers " + (death + 71) + ".";
    }
  }

  /* ------------------------------ mémoire + partage ----------------------------- */
  function saveLocal() { try { localStorage.setItem(SAVE_KEY, $("#lyrics").value); } catch (e) {} }
  function b64encode(s) { return btoa(unescape(encodeURIComponent(s))); }
  function b64decode(s) { try { return decodeURIComponent(escape(atob(s))); } catch (e) { return ""; } }
  function initialText() {
    var h = location.hash.match(/[#&]t=([^&]+)/);
    if (h) { var t = b64decode(decodeURIComponent(h[1])); if (t) return t; }
    try { var s = localStorage.getItem(SAVE_KEY); if (s !== null) return s; } catch (e) {}
    return DEFAULT_LYRICS; // première visite : on montre la création par défaut
  }
  function shareLink() {
    var payload = "m=" + state.melody.id + "&t=" + encodeURIComponent(b64encode($("#lyrics").value));
    var url = location.origin + location.pathname + "#" + payload;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        function () { toast("Lien copié dans le presse-papier !"); },
        function () { location.hash = payload; toast("Lien dans la barre d'adresse — copie-le."); });
    } else { location.hash = payload; toast("Lien dans la barre d'adresse — copie-le."); }
  }
  var toastT;
  function toast(msg) { var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("show"); }, 2600); }

  /* ------------------------------ init ------------------------------------------ */
  function init() {
    var sel = $("#melody-select");
    Melodies.list.forEach(function (m) {
      var o = document.createElement("option"); o.value = m.id; o.textContent = m.title; sel.appendChild(o);
    });
    var hm = location.hash.match(/[#&]m=([^&]+)/);
    var startId = (hm && Melodies.byId[hm[1]]) ? hm[1] : Melodies.list[0].id;
    sel.value = startId;
    sel.addEventListener("change", function () { loadMelody(sel.value); });

    $("#lyrics").value = initialText();
    $("#lyrics").addEventListener("input", render);
    $("#sung").addEventListener("change", function () { state.sung = $("#sung").checked; render(); });
    $("#play").addEventListener("click", playMelody);
    $("#tpl").addEventListener("click", loadSongLyrics);

    $("#dl-midi").addEventListener("click", function () {
      download(slug() + ".mid", toMIDI(Melodies.parseNotes(state.melody.notes), state.melody.tempo_bpm), "audio/midi");
      toast("MIDI téléchargé.");
    });
    $("#dl-xml").addEventListener("click", function () {
      download(slug() + ".musicxml", toMusicXML(Melodies.parseNotes(state.melody.notes), flattenSylls()), "application/vnd.recordare.musicxml+xml");
      toast("Partition (MusicXML) téléchargée.");
    });
    $("#dl-txt").addEventListener("click", function () {
      download(slug() + ".txt", $("#lyrics").value, "text/plain"); toast("Paroles téléchargées.");
    });
    $("#share").addEventListener("click", shareLink);
    $("#fine").addEventListener("click", function () {
      try {
        localStorage.setItem("lot_calage_session", JSON.stringify({
          notes: state.melody.notes, tempo: state.melody.tempo_bpm,
          title: state.melody.title, text: $("#lyrics").value
        }));
      } catch (e) {}
      location.href = "calage.html";
    });
    var imp = $("#import-midi");
    if (imp) imp.addEventListener("change", function (ev) {
      if (ev.target.files && ev.target.files[0]) importMIDI(ev.target.files[0]);
      ev.target.value = "";
    });
    var pdc = $("#pd-check");
    if (pdc) pdc.addEventListener("click", pdCheck);

    populateReadyMidis();
    var urlBtn = $("#url-load");
    if (urlBtn) urlBtn.addEventListener("click", function () {
      var u = ($("#url-input").value || "").trim(); if (u) loadMIDIFromUrl(u);
    });
    var dz = document.body;
    ["dragenter", "dragover"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("dragging"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove("dragging"); });
    });
    dz.addEventListener("drop", function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f && /\.midi?$/i.test(f.name)) importMIDI(f);
    });

    loadMelody(startId);
  }
  document.addEventListener("DOMContentLoaded", init);
})();
