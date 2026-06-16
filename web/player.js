/*
 * player.js — lecture audio de la mélodie via Web Audio (aucune dépendance).
 * Synthé simple (onde triangulaire + enveloppe) ; pas de samples.
 */
(function (root) {
  "use strict";

  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function Player(tempoBpm) {
    this.ctx = null;
    this.tempo = tempoBpm || 75;
    this.secPerQuarter = 60 / this.tempo;
    this.timers = [];
    this.playing = false;
  }

  Player.prototype._ensureCtx = function () {
    if (!this.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  };

  // notes = [{midi, ql} | {rest, ql}] ; onNote(index) appelé au début de chaque note
  Player.prototype.play = function (notes, onNote, onEnd) {
    this.stop();
    var ctx = this._ensureCtx();
    var t = ctx.currentTime + 0.08;
    var self = this;
    this.playing = true;
    var startPerf = performance.now();
    var elapsedSec = 0;

    notes.forEach(function (n, i) {
      var dur = n.ql * self.secPerQuarter;
      if (!n.rest) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = midiToFreq(n.midi);
        var a = 0.02, rel = Math.min(0.12, dur * 0.3);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.22, t + a);
        gain.gain.setValueAtTime(0.22, t + Math.max(a, dur - rel));
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      }
      // surlignage synchronisé
      if (onNote) {
        self.timers.push(setTimeout(function () {
          if (self.playing) onNote(i, n);
        }, Math.max(0, elapsedSec * 1000 - (performance.now() - startPerf))));
      }
      elapsedSec += dur;
      t += dur;
    });

    this.timers.push(setTimeout(function () {
      self.playing = false;
      if (onEnd) onEnd();
    }, elapsedSec * 1000 + 200));
  };

  Player.prototype.stop = function () {
    this.playing = false;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    if (this.ctx) { try { this.ctx.close(); } catch (e) {} this.ctx = null; }
  };

  if (typeof module !== "undefined" && module.exports) module.exports = { Player: Player, midiToFreq: midiToFreq };
  else root.LFPlayer = { Player: Player, midiToFreq: midiToFreq };
})(typeof window !== "undefined" ? window : globalThis);
