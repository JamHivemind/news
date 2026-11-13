// Baustein "Kaufen" (config.json → kaufen): Suchformular, das im Browser fertige Suchlinks zu AutoScout24 und
// Kleinanzeigen sowie einen Claude-Link baut. Läuft komplett im Browser: kein Server, kein Schlüssel, keine Daten
// an uns. Die zuletzt gewählte Suche merkt sich nur der Browser des Besuchers (localStorage).

const esc = (s = "") => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function renderKaufen(cfg) {
  const K = cfg.kaufen;
  if (!K?.liste?.length) return "";
  const opts = K.liste.map((x, i) =>
    `<option value="${i}" data-as24="${esc(x.as24)}" data-text="${esc(x.text)}" data-von="${esc(x.von ?? "")}" data-bis="${esc(x.bis ?? "")}" data-preis="${esc(x.preis ?? "")}" data-km="${esc(x.km ?? "")}">${esc(x.name)}</option>`).join("");
  const feld = (id, label, ph, extra = "") => `<label>${label}<input id="k-${id}" type="number" inputmode="numeric" min="0" placeholder="${ph}" ${extra}></label>`;
  return `<section class="kaufen" id="kaufen" data-claude="${esc(K.claudeText || "")}">
  <h2>${esc(K.titel || "Kaufen")}</h2>
  <p class="mintro">${esc(K.text || "")}</p>
  <form class="k-form" onsubmit="return false">
    <label class="k-wide">Fahrzeug<select id="k-fz">${opts}</select></label>
    ${feld("von", "Baujahr ab", "z. B. 2019")}${feld("bis", "Baujahr bis", "z. B. 2021")}
    ${feld("preis", "Preis bis (€)", "z. B. 35000")}${feld("km", "Kilometer bis", "z. B. 100000")}
  </form>
  <div class="k-links">
    <a id="k-as24" class="k-btn" href="#" target="_blank" rel="noopener">AutoScout24 →</a>
    <a id="k-ka" class="k-btn" href="#" target="_blank" rel="noopener">Kleinanzeigen →</a>
    <a id="k-claude" class="k-btn k-claude" href="#" target="_blank" rel="noopener">Mit Claude vergleichen →</a>
  </div>
  <p class="mhint">${esc(K.hinweis || "")}</p>
  <script>
  (function () {
    var $ = function (i) { return document.getElementById(i); }, fz = $("k-fz"), root = $("kaufen");
    var f = { von: $("k-von"), bis: $("k-bis"), preis: $("k-preis"), km: $("k-km") };
    function num(el) { var v = parseInt(el.value, 10); return isFinite(v) && v > 0 ? v : ""; }
    function load() { try { var s = JSON.parse(localStorage.getItem("kaufen") || "null"); if (s && s.i < fz.options.length) { fz.selectedIndex = s.i; for (var k in f) f[k].value = s[k] || ""; return true; } } catch (e) {} return false; }
    function preset() { var o = fz.options[fz.selectedIndex]; for (var k in f) f[k].value = o.getAttribute("data-" + k) || ""; }
    function build() {
      var o = fz.options[fz.selectedIndex], v = num(f.von), b = num(f.bis), p = num(f.preis), km = num(f.km);
      var q = "atype=C&cy=D" + (v ? "&fregfrom=" + v : "") + (b ? "&fregto=" + b : "") + (p ? "&priceto=" + p : "") + (km ? "&kmto=" + km : "");
      $("k-as24").href = "https://www.autoscout24.de/lst/" + o.getAttribute("data-as24") + "?" + q;
      var t = encodeURIComponent(o.getAttribute("data-text")).replace(/%20/g, "-").toLowerCase();
      var path = "/s-autos/" + (p ? "preis::" + p + "/" : "") + t + "/k0c216" + (v || b ? "+autos.ez_i:" + (v || 1950) + ":" + (b || "") : "") + (km ? "+autos.km_i:0:" + km : "");
      $("k-ka").href = "https://www.kleinanzeigen.de" + path;
      var tx = (root.getAttribute("data-claude") || "Hilf mir bei der Autosuche.") + "\\n\\nFahrzeug: " + o.text +
        (v || b ? "\\nBaujahr: " + (v || "egal") + " bis " + (b || "egal") : "") + (p ? "\\nPreis bis: " + p + " €" : "") + (km ? "\\nKilometer bis: " + km : "");
      $("k-claude").href = "https://claude.ai/new?q=" + encodeURIComponent(tx);
      try { localStorage.setItem("kaufen", JSON.stringify({ i: fz.selectedIndex, von: f.von.value, bis: f.bis.value, preis: f.preis.value, km: f.km.value })); } catch (e) {}
    }
    fz.addEventListener("change", function () { preset(); build(); });
    for (var k in f) f[k].addEventListener("input", build);
    if (!load()) preset();
    build();
  })();
  </script>
</section>`;
}
