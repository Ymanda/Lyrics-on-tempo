/*
 * calage.js — écran de calage fin (grille par temps).
 * Dépend de player.js, midi.js. Session passée par l'écran principal via
 * localStorage "lot_calage_session" = { notes, tempo, title, text }.
 * Sinon : chargement direct (MIDI + texte). Tout reste local au navigateur.
 */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var SKEY = "lot_calage_session";
  var st = { title: "", tempo: 100, notesStr: "", lines: [], textLines: [], player: null, loopIdx: -1, looping: false };

  function parseNotes(enc) {
    return (enc || "").trim().split(/\s+/).filter(Boolean).map(function (t) {
      return t[0] === "R" ? { rest: true, ql: parseFloat(t.slice(1)) }
                          : { midi: parseInt(t.split(":")[0], 10), ql: parseFloat(t.split(":")[1]) };
    });
  }
  function splitLines(events) {
    var lines = [], cur = [];
    events.forEach(function (e) {
      if (e.rest && e.ql >= 0.5) { if (cur.length) { lines.push(cur); cur = []; } }
      else cur.push(e);
    });
    if (cur.length) lines.push(cur);
    return lines;
  }
  function groupBeats(lineEvents) {
    var beats = [], pos = 0;
    lineEvents.forEach(function (e) {
      var b = Math.floor(pos + 1e-6);
      if (!beats[b]) beats[b] = { slots: [] };
      if (!e.rest) beats[b].slots.push(e.midi);
      pos += e.ql;
    });
    var out = [];
    for (var i = 0; i < beats.length; i++) out.push(beats[i] || { slots: [] });
    return out;
  }
  function syllabify(word) {
    var clean = word.replace(/[*+_=|]/g, "");
    var re = /[^aeiouyàâäéèêëîïôöùûüœæ]*[aeiouyàâäéèêëîïôöùûüœæ]+/gi;
    var out = [], m, last = 0;
    while ((m = re.exec(clean)) !== null) { out.push(m[0]); last = re.lastIndex; }
    if (!out.length) return [clean];
    if (last < clean.length) out[out.length - 1] += clean.slice(last);
    return out;
  }
  function lineSyllables(textLine) {
    var out = [];
    (textLine || "").trim().split(/\s+/).filter(Boolean).forEach(function (w) {
      syllabify(w).forEach(function (s) { out.push(s); });
    });
    return out;
  }

  function build() {
    var ev = parseNotes(st.notesStr);
    st.lines = splitLines(ev).map(function (le) {
      var pos = 0, notes = [];
      le.forEach(function (e) { if (!e.rest) notes.push({ startQ: pos, ql: e.ql, midi: e.midi }); pos += e.ql; });
      return { events: le, notes: notes, totalQ: pos || 1, slots: notes.length, gaps: {} };
    });
    st.player = new LFPlayer.Player(st.tempo);
    render();
  }
  function currentTextLines() { return ($("#lyrics-area").value || "").split(/\r?\n/); }
  function placement(lineIdx) {
    var L = st.lines[lineIdx];
    var sl = lineSyllables(currentTextLines()[lineIdx] || "");
    var cells = [], si = 0, slot = 0, total = L.slots;
    for (slot = 0; slot < total; slot++) {
      if (L.gaps[slot]) cells.push({ syl: null, gap: true });
      else { cells.push({ syl: si < sl.length ? sl[si] : null }); si++; }
    }
    return { cells: cells, used: si, overflow: sl.slice(si) };
  }

  function render() {
    var host = $("#grid"); host.innerHTML = "";
    var tl = currentTextLines();
    st.lines.forEach(function (L, i) {
      var place = placement(i);
      var nsyl = lineSyllables(tl[i] || "").length;
      var row = document.createElement("div"); row.className = "cl-row"; row.dataset.i = i;
      var head = document.createElement("div"); head.className = "cl-head";
      var d = nsyl - L.slots, cls = d === 0 ? "ok" : (d > 0 ? "over" : "under");
      head.innerHTML = '<button class="cl-play" data-i="' + i + '">▶</button>' +
        '<span class="cl-text">' + esc(tl[i] || "") + '</span>' +
        '<span class="cl-badge ' + cls + '">' + nsyl + "/" + L.slots + "</span>";
      row.appendChild(head);
      var grid = document.createElement("div"); grid.className = "cl-beats";
      var UNIT = 0.25;
      var nCells = Math.max(1, Math.round(L.totalQ / UNIT));
      for (var c = 0; c < nCells; c++) {
        var bc = document.createElement("div");
        bc.className = "cl-qcell" + (Math.floor(c / 4) % 2 ? " odd" : "") + (c % 4 === 0 ? " beat" : "");
        bc.style.left = (c * UNIT / L.totalQ * 100) + "%";
        bc.style.width = (UNIT / L.totalQ * 100) + "%";
        grid.appendChild(bc);
      }
      L.notes.forEach(function (n, k) {
        var info = place.cells[k] || {};
        var sl = document.createElement("div");
        sl.className = "cl-slot" + (info.gap ? " gap" : "") + (info.syl ? " filled" : "");
        sl.style.left = (n.startQ / L.totalQ * 100) + "%";
        sl.style.width = (n.ql / L.totalQ * 100) + "%";
        sl.textContent = info.syl || (info.gap ? "·" : "");
        sl.title = "Clic : insérer/retirer un blanc ici";
        sl.dataset.i = i; sl.dataset.s = k;
        grid.appendChild(sl);
      });
      row.appendChild(grid);
      var ph = document.createElement("div"); ph.className = "cl-ph"; grid.appendChild(ph);
      if (place.overflow.length) {
        var ov = document.createElement("div"); ov.className = "cl-over";
        ov.textContent = "déborde : " + place.overflow.join("·");
        row.appendChild(ov);
      }
      host.appendChild(row);
    });
    $("#summary").textContent = st.lines.length + " lignes · " + st.title;
  }
  function esc(s) { return (s || "").replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }

  function onGridClick(e) {
    var slot = e.target.closest ? e.target.closest(".cl-slot") : null;
    if (slot) {
      var i = +slot.dataset.i, s = +slot.dataset.s, L = st.lines[i];
      if (L.gaps[s]) delete L.gaps[s]; else L.gaps[s] = true;
      render(); return;
    }
    var pb = e.target.closest ? e.target.closest(".cl-play") : null;
    if (pb) loopLine(+pb.dataset.i);
  }

  function lineDurationSec(L) { var q = 0; L.events.forEach(function (e) { q += e.ql; }); return q * (60 / st.tempo); }
  function stopLoop() {
    st.looping = false;
    if (st.player) st.player.stop();
    document.querySelectorAll(".cl-row.active").forEach(function (r) { r.classList.remove("active"); });
    document.querySelectorAll(".cl-ph.run").forEach(function (p) { p.classList.remove("run"); p.style.animation = "none"; });
    $("#loop-state").textContent = "";
  }
  function loopLine(i) {
    if (st.looping && st.loopIdx === i) { stopLoop(); return; }
    stopLoop();
    st.loopIdx = i; st.looping = true;
    var row = document.querySelector('.cl-row[data-i="' + i + '"]');
    if (row) row.classList.add("active");
    var ph = row ? row.querySelector(".cl-ph") : null;
    var durSec = lineDurationSec(st.lines[i]);
    $("#loop-state").textContent = "▶ ligne " + (i + 1) + " (boucle)";
    function once() {
      if (!st.looping || st.loopIdx !== i) return;
      if (ph) { ph.style.animation = "none"; void ph.offsetWidth; ph.style.animation = "clPh " + durSec + "s linear"; ph.classList.add("run"); }
      st.player.play(st.lines[i].events, null, function () { if (st.looping && st.loopIdx === i) setTimeout(once, 80); });
    }
    once();
  }

  function vlq(n) { var b = [n & 0x7f]; n = Math.floor(n / 128); while (n > 0) { b.unshift((n & 0x7f) | 0x80); n = Math.floor(n / 128); } return b; }
  function toMIDI(notes, bpm) {
    var div = 480, usq = Math.round(60000000 / bpm), trk = [];
    trk.push.apply(trk, vlq(0).concat([0xFF, 0x51, 0x03, (usq >> 16) & 255, (usq >> 8) & 255, usq & 255]));
    var pend = 0;
    notes.forEach(function (n) {
      var t = Math.round(n.ql * div);
      if (n.rest) { pend += t; return; }
      trk.push.apply(trk, vlq(pend).concat([0x90, n.midi, 80]));
      trk.push.apply(trk, vlq(t).concat([0x80, n.midi, 0])); pend = 0;
    });
    trk.push.apply(trk, vlq(pend).concat([0xFF, 0x2F, 0x00]));
    var L = trk.length;
    return Uint8Array.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (div >> 8) & 255, div & 255,
      0x4d, 0x54, 0x72, 0x6b, (L >> 24) & 255, (L >> 16) & 255, (L >> 8) & 255, L & 255].concat(trk));
  }
  function download(name, content, mime) {
    var blob = (content instanceof Uint8Array) ? new Blob([content], { type: mime }) : new Blob([content], { type: mime + ";charset=utf-8" });
    var u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(u); }, 1500);
  }
  function slug() { return (st.title || "chant").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "chant"; }
  function calageText() {
    var out = [];
    st.lines.forEach(function (L, i) {
      var p = placement(i);
      out.push(p.cells.map(function (c) { return c.gap ? "-" : (c.syl || "·"); }).join(" "));
    });
    return out.join("\n");
  }
  function saveAll() {
    var s = slug();
    download(s + ".mid", toMIDI(parseNotes(st.notesStr), st.tempo), "audio/midi");
    download(s + ".txt", $("#lyrics-area").value.replace(/[*+_=|]/g, ""), "text/plain"); // texte brut
    download(s + ".calage.txt", calageText(), "text/plain"); // texte calé (slots + blancs)
  }

  function loadSession() { try { var raw = localStorage.getItem(SKEY); if (!raw) return null; return JSON.parse(raw); } catch (e) { return null; } }
  function start(sess) {
    st.title = sess.title || "Sans titre"; st.tempo = sess.tempo || 100; st.notesStr = sess.notes || "";
    $("#lyrics-area").value = sess.text || ""; $("#title-in").value = st.title;
    $("#loader").style.display = "none"; $("#editor").style.display = "block";
    build();
  }
  function init() {
    $("#grid").addEventListener("click", onGridClick);
    $("#lyrics-area").addEventListener("input", function () { render(); });
    $("#title-in").addEventListener("input", function () { st.title = $("#title-in").value; });
    $("#stop").addEventListener("click", stopLoop);
    $("#save").addEventListener("click", saveAll);
    $("#back").addEventListener("click", function () { location.href = "index.html"; });
    $("#imp").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var r = LFMidi.readMIDI(rd.result);
          st.notesStr = r.events.map(function (x) { return x.rest ? ("R" + x.ql) : (x.midi + ":" + x.ql); }).join(" ");
          st.tempo = r.tempo || 100;
          $("#loader").style.display = "none"; $("#editor").style.display = "block";
          st.title = $("#title-in").value || f.name.replace(/\.midi?$/i, "");
          build();
        } catch (err) { alert("MIDI illisible : " + err.message); }
      };
      rd.readAsArrayBuffer(f);
    });
    $("#start-direct").addEventListener("click", function () {
      if (!st.notesStr) { alert("Charge d'abord un MIDI."); return; }
      st.title = $("#title-in").value || "Sans titre"; build();
    });
    var sess = loadSession();
    if (sess && sess.notes) start(sess);
    else { $("#loader").style.display = "block"; $("#editor").style.display = "none"; }
  }
  document.addEventListener("DOMContentLoaded", init);
})();
