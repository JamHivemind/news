// Die Garage: Startampel und Wertometer-Nadel, Countdown, Lichthupe bei „Zur Quelle“, Reinfahren beim Scrollen.
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var needles = document.querySelectorAll(".g-needle");
  var sweep = function () { needles.forEach(function (n) { n.classList.add("on"); }); };

  // Startampel: fünf rote Lichter gehen nacheinander an, dann alle aus – und die Nadel dreht hoch.
  // Nur beim ersten Öffnen pro Sitzung, danach steht die Nadel gleich.
  var lights = document.querySelector(".g-lights");
  var shown = false;
  try { shown = sessionStorage.getItem("garage-start") === "1"; sessionStorage.setItem("garage-start", "1"); } catch (e) {}
  if (lights && !reduce && !shown) {
    var dots = lights.querySelectorAll("i"), k = 0;
    var step = setInterval(function () {
      if (k < dots.length) { dots[k++].classList.add("on"); return; }
      clearInterval(step);
      setTimeout(function () {
        dots.forEach(function (d) { d.classList.remove("on"); });
        lights.classList.add("go");
        sweep();
      }, 300 + Math.random() * 500);
    }, 380);
  } else {
    if (lights) lights.classList.add("go");
    setTimeout(sweep, 150);
  }

  // Klick aufs Wertometer: kurzer Gasstoß in den roten Bereich
  document.querySelectorAll(".g-meter").forEach(function (m) {
    m.addEventListener("click", function () {
      var n = m.querySelector(".g-needle"); if (!n) return;
      n.style.transform = "rotate(116deg)";
      setTimeout(function () { n.style.transform = "rotate(104deg)"; }, 450);
      setTimeout(function () { n.style.transform = ""; }, 700);
    });
  });

  // Countdown bis zum nächsten Termin
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

  // Lichthupe: Klick auf „Zur Quelle“ lässt die Meldung kurz aufblitzen (Link öffnet in neuem Tab)
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest(".item .meta a, .top-card .meta a");
    if (!a || reduce) return;
    var card = a.closest(".item, .top-card");
    card.classList.remove("g-flash"); void card.offsetWidth; card.classList.add("g-flash");
    setTimeout(function () { card.classList.remove("g-flash"); }, 700);
  });

  // Reinfahren beim Scrollen: Top 3 nacheinander vom Startplatz, Balken füllen sich
  if (!reduce && "IntersectionObserver" in window) {
    document.body.classList.add("g-anim");
    var io = new IntersectionObserver(function (list) {
      list.forEach(function (x) {
        if (!x.isIntersecting) return;
        var t = x.target, i = Array.prototype.indexOf.call(t.parentNode.children, t);
        setTimeout(function () { t.classList.add("g-in"); }, t.classList.contains("top-card") ? i * 160 : 0);
        io.unobserve(t);
      });
    }, { threshold: 0.2 });
    document.querySelectorAll(".top-card, .panel, .g-radar").forEach(function (n) { io.observe(n); });
  }
})();
