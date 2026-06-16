/*
 * app.js — interface de l'outil de calage (front statique).
 * Dépend de fitter.js, melodies.js, player.js (chargés avant).
 */
(function () {
  "use strict";

  // ----- Configuration (à adapter au déploiement) -------------------------
  var CONFIG = {
    SIGNUP_URL: "https://la-commune-2-point-zero.org/inscription",   // compte C2.0
    DISCORD_URL: "https://discord.gg/VOTRE_INVITE",                  // Discord 2.0
    INTRO_MODE: "day",            // "day" = animation 1x/jour, "session" = 1x/session, "off"
    INTRO_MIN_MS: 1600            // durée mini d'affichage du sas avant de pouvoir entrer
  };

  var $ = function (s) { return document.querySelector(s); };
  var state = { melody: null, phrases: [], sung: true, player: null };

  // ----- Sas d'animation (Garuda/Hanuman), 1x/jour ------------------------
  function introAlreadyShown() {
    if (CONFIG.INTRO_MODE === "off") return true;
    try {
      if (CONFIG.INTRO_MODE === "session")
        return sessionStorage.getItem("sz_intro") === "1";
      var today = new Date().toISOString().slice(0, 10);
      return localStorage.getItem("sz_intro_day") === today;
    } catch (e) { return false; }
  }
  function markIntroShown() {
    try {
      if (CONFIG.INTRO_MODE === "session") sessionStorage.setItem("sz_intro", "1");
      else localStorage.setItem("sz_intro_day", new Date().toISOString().slice(0, 10));
    } catch (e) {}
  }
  function runIntro(done) {
    var gate = $("#intro");
    if (introAlreadyShown()) { gate.remove(); return done(); }
    gate.style.display = "flex";
    // POINT D'INTÉGRATION : branche ici l'animation réelle de l'index.
    // Si une fonction globale window.szGarudaIntro(container) existe, on l'utilise ;
    // sinon on affiche l'animation de repli (logo + halo) définie en CSS.
    if (typeof window.szGarudaIntro === "function") {
      try { window.szGarudaIntro($("#intro-stage")); } catch (e) {}
    }
    var canEnter = false;
    setTimeout(function () { canEnter = true; $("#intro-skip").classList.add("ready"); },
              CONFIG.INTRO_MIN_MS);
    function enter() {
      if (!canEnter) return;
      markIntroShown();
      gate.classList.add("fade");
      setTimeout(function () { gate.remove(); done(); }, 480);
    }
    gate.addEventListener("click", enter);
    $("#intro-skip").addEventListener("click", function (e) { e.stopPropagation(); canEnter = true; enter(); });
  }

  // ----- Calage live ------------------------------------------------------
  var LABEL = { ok: "OK", slack: "mélisme", over: "déborde", under: "manque", empty: "vide" };

  function render() {
    var text = $("#lyrics").value;
    var res = Fitter.fitText(state.phrases, text, state.sung);
    var tbody = $("#grid tbody");
    tbody.innerHTML = "";
    var nFit = 0;
    res.results.forEach(function (r) {
      var tr = document.createElement("tr");
      tr.className = "st-" + r.status;
      var d = r.delta > 0 ? "+" + r.delta : "" + r.delta;
      tr.innerHTML =
        '<td class="ref">' + esc(r.phrase.ref_text) + "</td>" +
        '<td class="num">' + r.phrase.syllables + "</td>" +
        '<td class="usr">' + (r.userText ? esc(r.userText) : "<i>—</i>") + "</td>" +
        '<td class="num strong">' + (r.userText ? r.count : "") + "</td>" +
        '<td class="num strong">' + (r.userText ? d : "") + "</td>" +
        '<td class="badge">' + LABEL[r.status] + "</td>";
      tbody.appendChild(tr);
      if (r.status === "ok" || r.status === "slack") nFit++;
    });
    var msg = nFit + "/" + state.phrases.length + " vers calés";
    if (res.extra.length) msg += " · ⚠ " + res.extra.length + " ligne(s) en trop";
    $("#summary").textContent = msg;
  }

  function esc(s) {
    return (s || "").replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // ----- Mélodie / lecture ------------------------------------------------
  function loadMelody(id) {
    state.melody = Melodies.byId[id];
    state.phrases = Melodies.phrasesFlat(state.melody);
    state.player = new LFPlayer.Player(state.melody.tempo_bpm);
    $("#melody-meta").textContent =
      state.melody.composer + " · " + state.melody.meter + " · " +
      state.melody.tempo_bpm + " bpm · ton " + state.melody.key;
    render();
  }

  function playMelody() {
    if (!state.player) return;
    if (state.player.playing) { state.player.stop(); $("#play").textContent = "▶ Écouter l'air"; return; }
    var notes = Melodies.parseNotes(state.melody.notes);
    $("#play").textContent = "■ Stop";
    state.player.play(notes, null, function () { $("#play").textContent = "▶ Écouter l'air"; });
  }

  function loadTemplate() {
    $("#lyrics").value = state.phrases.map(function (p) { return p.ref_text; }).join("\n");
    render();
  }

  // ----- Actions gatées (export / sauvegarde) -----------------------------
  function openSignup(reason) {
    $("#signup-reason").textContent = reason || "";
    $("#signup").style.display = "flex";
  }
  function closeSignup() { $("#signup").style.display = "none"; }

  // ----- Init -------------------------------------------------------------
  function init() {
    // sélecteur de mélodie
    var sel = $("#melody-select");
    Melodies.list.forEach(function (m) {
      var o = document.createElement("option");
      o.value = m.id; o.textContent = m.title; sel.appendChild(o);
    });
    sel.addEventListener("change", function () { loadMelody(sel.value); });

    $("#lyrics").addEventListener("input", render);
    $("#sung").addEventListener("change", function () { state.sung = $("#sung").checked; render(); });
    $("#play").addEventListener("click", playMelody);
    $("#tpl").addEventListener("click", loadTemplate);

    $("#export").addEventListener("click", function () {
      openSignup("L'export MIDI / partition est réservé aux membres.");
    });
    $("#save").addEventListener("click", function () {
      openSignup("La sauvegarde de tes paroles est réservée aux membres.");
    });
    $("#signup-c2").href = CONFIG.SIGNUP_URL;
    $("#signup-discord").href = CONFIG.DISCORD_URL;
    $("#signup-close").addEventListener("click", closeSignup);
    $("#signup").addEventListener("click", function (e) { if (e.target === $("#signup")) closeSignup(); });

    loadMelody(Melodies.list[0].id);
  }

  document.addEventListener("DOMContentLoaded", function () {
    runIntro(init);
  });
})();
