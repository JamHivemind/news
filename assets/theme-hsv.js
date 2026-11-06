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
      if (flag && !box.hasAttribute("data-on")) {
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

  // Live-Ticker: ab Anpfiff jede Minute Spielstand und Tore von OpenLigaDB holen (direkt im Browser, ohne Neubau der Seite)
  var live = box && box.querySelector("[data-live]");
  if (live && box.getAttribute("data-league")) {
    var team = Number(box.getAttribute("data-team"));
    var url = "https://api.openligadb.de/getmatchdata/" + box.getAttribute("data-league") + "/" + box.getAttribute("data-season") + "/" + box.getAttribute("data-day");
    var count = box.querySelector("[data-count]"), lflag = box.querySelector("[data-flag]");
    var done = false, seen = null, busy = false;
    var esc = function (t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; };

    // Spielminute schätzen (OpenLigaDB liefert keine laufende Uhr): 45 + ~3 Nachspielzeit + 15 Pause
    var minute = function (lastGoal) {
      var e = Math.floor((Date.now() - kick) / 6e4), txt;
      if (e < 45) txt = (e + 1) + ".";
      else if (e < 48) txt = "45.+";
      else if (e < 63) txt = "Halbzeit";
      else if (e < 108) txt = (e - 17) + ".";
      else txt = "90.+";
      // Liegt das letzte Tor später, ist die Schätzung zu niedrig: dann mindestens dessen Minute
      if (lastGoal && /^\d+\.$/.test(txt) && lastGoal > parseInt(txt, 10)) txt = lastGoal + ".";
      return txt;
    };

    var render = function (m) {
      var us1 = m.team1.teamId === team;
      var goals = (m.goals || []).slice().sort(function (a, b) { return (a.goalID || 0) - (b.goalID || 0); });
      var end = (m.matchResults || []).filter(function (r) { return r.resultTypeID === 2; })[0];
      var g1 = 0, g2 = 0;
      if (goals.length) { g1 = goals[goals.length - 1].scoreTeam1; g2 = goals[goals.length - 1].scoreTeam2; }
      if (m.matchIsFinished && end) { g1 = end.pointsTeam1; g2 = end.pointsTeam2; }
      var own = us1 ? g1 : g2, opp = us1 ? g2 : g1;

      // Neues HSV-Tor seit dem letzten Abruf? Dann jubeln.
      if (seen !== null && own > seen && !document.hidden) { var b = document.getElementById("fan-goal"); if (b) b.click(); }
      seen = own;

      var lastMin = goals.length ? goals[goals.length - 1].matchMinute : null;
      var state = m.matchIsFinished ? "Abpfiff" : minute(lastMin);
      var p1 = 0, p2 = 0;
      var rows = goals.map(function (g) {
        var side1 = g.scoreTeam1 > p1; p1 = g.scoreTeam1; p2 = g.scoreTeam2;
        var mine = side1 === us1, tags = [];
        if (g.isPenalty) tags.push("Elfmeter"); if (g.isOwnGoal) tags.push("Eigentor"); if (g.isOvertime) tags.push("Verlängerung");
        return '<li class="' + (mine ? "us" : "them") + '"><span class="m">' + (g.matchMinute != null ? esc(g.matchMinute) + "'" : "–") + "</span>" +
          '<span class="n">' + (mine ? "⚽ " : "") + esc(g.goalGetterName || "Tor") + (tags.length ? " <i>(" + tags.join(", ") + ")</i>" : "") +
          ' <i>· ' + esc(side1 ? m.team1.shortName : m.team2.shortName) + "</i></span>" +
          '<b>' + g.scoreTeam1 + ":" + g.scoreTeam2 + "</b></li>";
      }).join("");

      live.innerHTML =
        '<div class="fan-live-head"><span class="fan-live-dot' + (m.matchIsFinished ? " off" : "") + '">' + (m.matchIsFinished ? "Endstand" : "Live") + "</span>" +
        '<span class="fan-live-min">' + esc(state) + (m.matchIsFinished || state === "Halbzeit" ? "" : ' <i>(ca.)</i>') + "</span></div>" +
        '<div class="fan-live-score"><span>' + esc(m.team1.shortName) + "</span><b>" + g1 + ":" + g2 + "</b><span>" + esc(m.team2.shortName) + "</span></div>" +
        (rows ? '<ul class="fan-live-goals">' + rows + "</ul>" : '<div class="fan-live-empty">Noch keine Tore.</div>') +
        '<div class="fan-live-src">Daten: OpenLigaDB (Community), Abruf jede Minute · Stand ' +
        new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(new Date()) + " Uhr</div>";
      live.hidden = false;
      if (count) count.hidden = true;
      box.setAttribute("data-on", "");
      if (lflag) {
        var verdict = own > opp ? "Sieg!" : own < opp ? "Niederlage" : "Remis";
        lflag.textContent = m.matchIsFinished ? "Abpfiff · " + own + ":" + opp + " " + verdict : "Live · " + state;
        lflag.className = m.matchIsFinished ? "fan-flag" : "fan-flag hot";
      }
      if (m.matchIsFinished) done = true;
    };

    var poll = function () {
      var e = Date.now() - kick;
      if (done || busy || document.hidden || e < -60000 || e > 12 * 36e5) return;
      busy = true;
      fetch(url, { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
        var m = (list || []).filter(function (x) { return x.team1.teamId === team || x.team2.teamId === team; })[0];
        if (m) render(m);
      }).catch(function () {}).then(function () { busy = false; });
    };
    poll(); setInterval(poll, 60000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) poll(); });
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
