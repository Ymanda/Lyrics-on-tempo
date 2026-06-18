/*
 * midi.js — lecteur MIDI minimal (navigateur), extrait la voix supérieure (mélodie)
 * en séquence monophonique [{midi,ql} | {rest,ql}], + tempo. Aucune dépendance.
 * Tout reste local au navigateur : rien n'est envoyé sur un serveur.
 */
(function (root) {
  "use strict";

  function readMIDI(buf) {
    var dv = new DataView(buf), p = 0;
    function u32() { var v = dv.getUint32(p); p += 4; return v; }
    function u16() { var v = dv.getUint16(p); p += 2; return v; }
    function u8() { return dv.getUint8(p++); }
    function vlq() { var v = 0, b; do { b = u8(); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; }

    if (u32() !== 0x4d546864) throw new Error("Fichier MIDI invalide.");
    u32(); u16(); var ntrk = u16(); var div = u16();
    if (div & 0x8000) div = 480; // SMPTE non géré -> défaut
    var onoff = [], tempo = 500000; // µs/noire (120 bpm par défaut)

    for (var t = 0; t < ntrk; t++) {
      if (u32() !== 0x4d54726b) break;
      var len = u32(), endp = p + len, abs = 0, status = 0;
      while (p < endp) {
        abs += vlq();
        var b = u8();
        if (b & 0x80) status = b; else p--; // running status
        var hi = status & 0xf0;
        if (status === 0xff) {
          var meta = u8(), ml = vlq();
          if (meta === 0x51 && ml === 3) {
            tempo = (dv.getUint8(p) << 16) | (dv.getUint8(p + 1) << 8) | dv.getUint8(p + 2);
          }
          p += ml;
        } else if (status === 0xf0 || status === 0xf7) {
          p += vlq();
        } else if (hi === 0x90) {
          var n = u8(), v = u8(); onoff.push({ t: abs, on: v > 0, note: n });
        } else if (hi === 0x80) {
          var n2 = u8(); u8(); onoff.push({ t: abs, on: false, note: n2 });
        } else if (hi === 0xc0 || hi === 0xd0) {
          u8();
        } else {
          u8(); u8();
        }
      }
      p = endp;
    }

    // voix supérieure : à chaque instant, la note active la plus haute
    onoff.sort(function (a, b) { return a.t - b.t || (a.on ? 1 : 0) - (b.on ? 1 : 0); });
    var active = {}, segs = [], curTop = null, segStart = 0;
    function top() { var m = null, k, n; for (k in active) { if (active[k] > 0) { n = +k; if (m === null || n > m) m = n; } } return m; }
    for (var i = 0; i < onoff.length; i++) {
      var e = onoff[i];
      if (e.t > segStart) { segs.push({ from: segStart, to: e.t, note: curTop }); segStart = e.t; }
      if (e.on) active[e.note] = (active[e.note] || 0) + 1;
      else active[e.note] = Math.max(0, (active[e.note] || 0) - 1);
      curTop = top();
    }

    var bpm = Math.round(60000000 / tempo), events = [];
    for (var s = 0; s < segs.length; s++) {
      var ql = Math.round((segs[s].to - segs[s].from) / div * 4) / 4; // au 1/4 de temps
      if (ql <= 0) continue;
      events.push(segs[s].note === null ? { rest: true, ql: ql } : { midi: segs[s].note, ql: ql });
    }
    // fusionne seulement les silences consécutifs (jamais les notes répétées)
    var outv = [];
    for (var j = 0; j < events.length; j++) {
      var ev = events[j], last = outv[outv.length - 1];
      if (last && ev.rest && last.rest) last.ql = Math.round((last.ql + ev.ql) * 4) / 4;
      else outv.push({ rest: ev.rest, midi: ev.midi, ql: ev.ql });
    }
    return { events: outv.filter(function (e) { return e.ql > 0; }), tempo: bpm, division: div };
  }

  var API = { readMIDI: readMIDI };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.LFMidi = API;
})(typeof window !== "undefined" ? window : globalThis);
