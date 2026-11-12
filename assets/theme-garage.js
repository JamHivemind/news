// Die Garage: Wertometer-Nadel, Countdown zum nächsten Termin und der „Gummi geben“-Knopf.
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };

  // Nadel hochdrehen lassen, wenn die Seite steht
  var needles = document.querySelectorAll(".g-needle");
  setTimeout(function () { needles.forEach(function (n) { n.classList.add("on"); }); }, 250);

  // Countdown bis zum nächsten Termin (Ortszeit Berlin, Angabe ohne Zeitzone = Browserzeit)
  var ev = document.querySelector(".g-event[data-start]");
  if (ev) {
    var start = Date.parse(ev.getAttribute("data-start")), end = Date.parse(ev.getAttribute("data-end"));
    var count = ev.querySelector("[data-count]"), live = ev.querySelector("[data-live]");
    var el = function (k) { return ev.querySelector("[data-" + k + "]"); };
    var tick = function () {
      var now = Date.now();
      if (now >= start && now <= end) { count.hidden = true; live.hidden = false; return; }
      if (now > end) { count.hidden = true; live.hidden = false; live.textContent = "Vorbei – nächster Termin morgen früh"; return; }
      var s = Math.floor((start - now) / 1000);
      el("d").textContent = Math.floor(s / 86400);
      el("h").textContent = pad(Math.floor(s / 3600) % 24);
      el("m").textContent = pad(Math.floor(s / 60) % 60);
    };
    tick(); setInterval(tick, 15000);
  }

  // Motorsound aus dem Browser (Web Audio, keine Datei): Leerlauf, Gasstoß bis in den Begrenzer, Abfallen
  var rev = function () {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      var ac = new AC(), t = ac.currentTime;
      var out = ac.createGain(); out.gain.value = 0.0001; out.connect(ac.destination);
      var lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 6; lp.connect(out);
      var o1 = ac.createOscillator(), o2 = ac.createOscillator();
      o1.type = "sawtooth"; o2.type = "square"; o2.detune.value = -1200;
      o1.connect(lp); o2.connect(lp);
      // Drehzahl: 900 → 7.800 U/min (Frequenz ~ U/min / 60 * 3 für einen Sechszylinder)
      var f = function (rpm) { return rpm / 20; };
      [o1, o2].forEach(function (o) {
        o.frequency.setValueAtTime(f(900), t);
        o.frequency.exponentialRampToValueAtTime(f(7800), t + 1.0);
        o.frequency.setValueAtTime(f(7400), t + 1.08);   // Begrenzer
        o.frequency.setValueAtTime(f(7800), t + 1.16);
        o.frequency.setValueAtTime(f(7400), t + 1.24);
        o.frequency.exponentialRampToValueAtTime(f(1000), t + 2.4);
        o.start(t); o.stop(t + 2.6);
      });
      lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(2600, t + 1.0); lp.frequency.exponentialRampToValueAtTime(500, t + 2.4);
      out.gain.exponentialRampToValueAtTime(0.18, t + 0.08);
      out.gain.setValueAtTime(0.18, t + 1.3);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 2.55);
      setTimeout(function () { ac.close(); }, 3000);
    } catch (e) {}
  };

  var btn = document.getElementById("g-gas");
  if (btn) btn.addEventListener("click", function () {
    rev();
    var boom = document.createElement("div");
    boom.className = "g-boom"; boom.innerHTML = "<b>VROOOOM!</b>";
    document.body.appendChild(boom);
    setTimeout(function () { boom.remove(); }, 1900);
    // Nadeln einmal in den roten Bereich
    needles.forEach(function (n) {
      n.style.transform = "rotate(118deg)";
      setTimeout(function () { n.style.transform = ""; }, 1100);
    });
    if (reduce) return;
    var wrap = document.querySelector(".wrap");
    if (wrap) { wrap.classList.remove("g-shake"); void wrap.offsetWidth; wrap.classList.add("g-shake"); }
    for (var i = 0; i < 26; i++) {
      var p = document.createElement("span"), size = 60 + Math.random() * 90;
      p.className = "g-smoke";
      p.style.width = p.style.height = size + "px";
      p.style.left = (Math.random() < 0.5 ? Math.random() * 30 : 70 + Math.random() * 30) + "vw";
      p.style.setProperty("--dx", (Math.random() * 30 - 15) + "vw");
      p.style.animationDuration = 1.8 + Math.random() * 1.6 + "s";
      p.style.animationDelay = Math.random() * 0.6 + "s";
      document.body.appendChild(p);
      setTimeout(function (x) { return function () { x.remove(); }; }(p), 4200);
    }
  });
})();
