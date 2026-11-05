// HSV-Zentrale: Countdown bis zum Anpfiff, Spieltags-Alarm und Torjubel-Knopf.
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var berlinDay = function (d) { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(d); };

  // Countdown
  var box = document.querySelector("[data-kickoff]");
  if (box) {
    var kick = Date.parse(box.getAttribute("data-kickoff")), flag = box.querySelector("[data-flag]");
    var el = function (k) { return box.querySelector("[data-" + k + "]"); };
    var tick = function () {
      var now = Date.now(), diff = kick - now;
      if (flag) {
        var today = berlinDay(new Date(now)), tomorrow = berlinDay(new Date(now + 864e5)), day = berlinDay(new Date(kick));
        if (diff <= 0 && diff > -115 * 6e4) { flag.textContent = "Läuft gerade – Daumen drücken!"; flag.className = "fan-flag hot"; }
        else if (diff <= 0) { flag.textContent = "Abgepfiffen – Ergebnis kommt morgen früh"; flag.className = "fan-flag"; }
        else if (day === today) { flag.textContent = "Heute ist Spieltag!!!"; flag.className = "fan-flag hot"; }
        else if (day === tomorrow) { flag.textContent = "Morgen ist Spieltag!"; flag.className = "fan-flag hot"; }
      }
      diff = Math.max(0, diff);
      var s = Math.floor(diff / 1000);
      el("d").textContent = Math.floor(s / 86400);
      el("h").textContent = pad(Math.floor(s / 3600) % 24);
      el("m").textContent = pad(Math.floor(s / 60) % 60);
      el("s").textContent = pad(s % 60);
    };
    tick(); setInterval(tick, 1000);
  }

  // Tage seit der Gründung live
  document.querySelectorAll("[data-since]").forEach(function (n) {
    var d = Math.floor((Date.now() - Date.parse(n.getAttribute("data-since"))) / 864e5);
    n.textContent = d.toLocaleString("de-DE");
  });

  // Torjubel
  var btn = document.getElementById("fan-goal");
  if (btn) btn.addEventListener("click", function () {
    var boom = document.createElement("div");
    boom.className = "fan-boom"; boom.innerHTML = "<b>TOOOR!</b>";
    document.body.appendChild(boom);
    setTimeout(function () { boom.remove(); }, 1700);
    if (reduce) return;
    var bits = ["⚽", "💙", "🤍", "🖤", "🔷", "⚽", "🎉"];
    for (var i = 0; i < 60; i++) {
      var b = document.createElement("span");
      b.className = "fan-bit";
      b.textContent = bits[i % bits.length];
      b.style.left = Math.random() * 100 + "vw";
      b.style.animationDuration = 1.8 + Math.random() * 1.8 + "s";
      b.style.animationDelay = Math.random() * 0.5 + "s";
      b.style.fontSize = 18 + Math.random() * 22 + "px";
      document.body.appendChild(b);
      setTimeout(function (x) { return function () { x.remove(); }; }(b), 4200);
    }
  });
})();
