// Welt-Monitor: drehbarer Globus. Lädt d3 und die Weltkarte erst, wenn die Karte aufgeklappt wird
// (am Handy zu, am großen Bildschirm offen). Ziehen dreht, Antippen zeigt Details und springt zur Meldung.
(function () {
  var box = document.querySelector("[data-globus]");
  if (!box) return;
  var marks = [];
  try { marks = JSON.parse(box.querySelector("[data-marks]").textContent); } catch (e) { return; }
  var FARBE = { konflikt: "#e24b4a", katastrophe: "#ef9f27", politik: "#7f77dd", wirtschaft: "#378add", hamburg: "#1d9e75" };
  var NAME = { konflikt: "Konflikt", katastrophe: "Katastrophe", politik: "Weltpolitik", wirtschaft: "Wirtschaft", hamburg: "Hamburg" };
  var started = false;

  function load(src) {
    return new Promise(function (ok, fail) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
  }
  function esc(s) { return String(s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function start() {
    if (started) return; started = true;
    load("https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js")
      .then(function () { return load("https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js"); })
      .then(function () { return fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json"); })
      .then(function (r) { return r.json(); })
      .then(draw)
      .catch(function () { box.querySelector("[data-info]").innerHTML = "Die Karte konnte nicht geladen werden. Die Brennpunkte oben funktionieren trotzdem."; });
  }

  function draw(topo) {
    var d3 = window.d3, land = window.topojson.feature(topo, topo.objects.land);
    var svg = d3.select(box.querySelector("svg")), info = box.querySelector("[data-info]");
    var proj = d3.geoOrthographic().scale(190).translate([200, 200]).clipAngle(90).rotate([-20, -30]);
    var path = d3.geoPath(proj);
    svg.append("circle").attr("class", "meer").attr("cx", 200).attr("cy", 200).attr("r", 190);
    var netz = svg.append("path").datum(d3.geoGraticule10()).attr("class", "netz");
    var erde = svg.append("path").datum(land).attr("class", "land");
    var pg = svg.append("g"), aktiv = null, spin = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function sichtbar(m) { var r = proj.rotate(); return d3.geoDistance([m.lon, m.lat], [-r[0], -r[1]]) < Math.PI / 2 - 0.02; }
    function render() {
      netz.attr("d", path); erde.attr("d", path);
      var sel = pg.selectAll("circle").data(marks.filter(sichtbar), function (m) { return m.n + m.lat; });
      sel.exit().remove();
      sel.enter().append("circle").attr("class", "pkt").attr("r", function (m) { return m.t === "hamburg" ? 5 : 7; })
        .attr("fill", function (m) { return FARBE[m.t] || FARBE.politik; })
        .on("click", function (ev, m) { spin = false; zeige(m); })
        .merge(sel)
        .classed("on", function (m) { return m === aktiv; })
        .attr("cx", function (m) { return proj([m.lon, m.lat])[0]; })
        .attr("cy", function (m) { return proj([m.lon, m.lat])[1]; });
    }
    function zeige(m) {
      aktiv = m;
      var link = !m.href ? "" : m.ext ? '<a href="' + esc(m.href) + '" target="_blank" rel="noopener">Zur Warnung →</a>'
        : '<a href="' + esc(m.href) + '">Zur Meldung ↓</a>';
      info.innerHTML = '<div class="art" style="color:' + (FARBE[m.t] || "") + '">' + esc(NAME[m.t] || "") + '</div>' +
        '<div class="t">' + esc(m.n) + '</div><div>' + esc(m.title) + '</div>' +
        (m.hh ? '<div style="margin-top:6px"><b>Für Hamburg:</b> ' + esc(m.hh) + '</div>' : "") +
        (link ? '<div style="margin-top:8px">' + link + '</div>' : "");
      render();
    }
    svg.call(d3.drag().on("start", function () { spin = false; }).on("drag", function (ev) {
      var r = proj.rotate();
      proj.rotate([r[0] + ev.dx * 0.4, Math.max(-75, Math.min(75, r[1] - ev.dy * 0.4))]);
      render();
    }));
    // Langsam drehen, bis jemand die Karte anfasst
    d3.timer(function () { if (!spin || !box.open) return; var r = proj.rotate(); proj.rotate([r[0] + 0.12, r[1]]); render(); });
    render();
  }

  box.addEventListener("toggle", function () { if (box.open) start(); });
  // Großer Bildschirm: Karte gleich offen. Handy: zu, die Brennpunkte reichen zum Springen.
  if (window.matchMedia("(min-width: 760px)").matches) { box.open = true; start(); }
})();
