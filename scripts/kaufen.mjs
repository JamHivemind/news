// Baustein "Kaufen" (config.json → kaufen): Fahrzeug als Schnellwahl, Eckdaten einstellen, daraus fertige
// Suchlinks zu AutoScout24 und Kleinanzeigen sowie ein Claude-Link. Läuft komplett im Browser: kein Server,
// kein Schlüssel, keine Daten an uns. Die letzte Suche merkt sich nur der Browser des Besuchers (localStorage).

const esc = (s = "") => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function renderKaufen(cfg) {
  const K = cfg.kaufen;
  if (!K?.liste?.length) return "";
  const chips = K.liste.map((x, i) =>
    `<label class="k-chip"><input type="radio" name="k-fz" value="${i}"${i ? "" : " checked"} data-name="${esc(x.name)}" data-as24="${esc(x.as24)}" data-text="${esc(x.text)}" ` +
    `data-von="${esc(x.von ?? "")}" data-bis="${esc(x.bis ?? "")}" data-preis="${esc(x.preis ?? "")}" data-km="${esc(x.km ?? "")}" ` +
    `data-mehr="${esc(JSON.stringify(x.mehr || []))}"><span><b>${esc(x.name)}</b><i>${esc(x.sub || "")}</i></span></label>`).join("");
  const feld = (id, label, step) => `<label>${label}<input id="k-${id}" type="number" inputmode="numeric" min="0" step="${step}" placeholder="egal"></label>`;
  const karte = (id, cls, name, sub) => `<a id="k-${id}" class="k-card ${cls}" href="#" target="_blank" rel="noopener"><b>${name}</b><span>${sub}</span><i aria-hidden="true">→</i></a>`;
  return `<section class="kaufen" id="kaufen" data-claude="${esc(K.claudeText || "")}">
  <h2>${esc(K.titel || "Kaufen")}</h2>
  <p class="mintro">${esc(K.text || "")}</p>
  <div class="k-step"><span>1</span>Fahrzeug wählen</div>
  <div class="k-chips" role="radiogroup" aria-label="Fahrzeug">${chips}</div>
  <div class="k-step"><span>2</span>Eckdaten einstellen</div>
  <form class="k-form" onsubmit="return false">
    ${feld("von", "Baujahr ab", 1)}${feld("bis", "Baujahr bis", 1)}
    ${feld("preis", "Preis bis (€)", 1000)}${feld("km", "Kilometer bis", 5000)}
  </form>
  <div class="k-step"><span>3</span>Suche öffnen</div>
  <div class="k-sum" id="k-sum" aria-live="polite"></div>
  <div class="k-cards">
    ${karte("as24", "", "AutoScout24", "Größte Auswahl, Händler und privat")}
    ${karte("ka", "", "Kleinanzeigen", "Viele Privatverkäufer, oft günstiger")}
    ${karte("claude", "k-claude", "Mit Claude vergleichen", "Schwachstellen, faire Preise, Checkliste")}
  </div>
  <div class="k-mehr" id="k-mehr"></div>
  <p class="mhint">${esc(K.hinweis || "")}</p>
  <script>
  (function () {
    var $ = function (i) { return document.getElementById(i); }, root = $("kaufen");
    var radios = Array.prototype.slice.call(root.querySelectorAll("input[name=k-fz]"));
    var f = { von: $("k-von"), bis: $("k-bis"), preis: $("k-preis"), km: $("k-km") };
    function cur() { return radios.filter(function (r) { return r.checked; })[0] || radios[0]; }
    function num(el) { var v = parseInt(el.value, 10); return isFinite(v) && v > 0 ? v : ""; }
    function pt(n) { return Number(n).toLocaleString("de-DE"); }
    function load() { try { var s = JSON.parse(localStorage.getItem("kaufen") || "null"); if (s && radios[s.i]) { radios[s.i].checked = true; for (var k in f) f[k].value = s[k] || ""; return true; } } catch (e) {} return false; }
    function preset() { var o = cur(); for (var k in f) f[k].value = o.getAttribute("data-" + k) || ""; }
    function build() {
      var o = cur(), v = num(f.von), b = num(f.bis), p = num(f.preis), km = num(f.km), name = o.getAttribute("data-name"), NL = String.fromCharCode(10);
      var q = "atype=C&cy=D" + (v ? "&fregfrom=" + v : "") + (b ? "&fregto=" + b : "") + (p ? "&priceto=" + p : "") + (km ? "&kmto=" + km : "");
      $("k-as24").href = "https://www.autoscout24.de/lst/" + o.getAttribute("data-as24") + "?" + q;
      var t = encodeURIComponent(o.getAttribute("data-text")).replace(/%20/g, "-").toLowerCase();
      $("k-ka").href = "https://www.kleinanzeigen.de/s-autos/" + (p ? "preis::" + p + "/" : "") + t + "/k0c216" +
        (v || b ? "+autos.ez_i:" + (v || 1950) + ":" + (b || "") : "") + (km ? "+autos.km_i:0:" + km : "");
      var tx = (root.getAttribute("data-claude") || "Hilf mir bei der Autosuche.") + NL + NL + "Fahrzeug: " + name +
        (v || b ? NL + "Baujahr: " + (v || "egal") + " bis " + (b || "egal") : "") + (p ? NL + "Preis bis: " + p + " €" : "") + (km ? NL + "Kilometer bis: " + km : "");
      $("k-claude").href = "https://claude.ai/new?q=" + encodeURIComponent(tx);
      var teile = [name];
      if (v || b) teile.push(v && b ? v + "–" + b : v ? "ab " + v : "bis " + b);
      if (p) teile.push("bis " + pt(p) + " €");
      if (km) teile.push("bis " + pt(km) + " km");
      $("k-sum").textContent = teile.join(" · ");
      var mehr = [], box = $("k-mehr"); try { mehr = JSON.parse(o.getAttribute("data-mehr") || "[]"); } catch (e) {}
      box.textContent = "";
      if (mehr.length) { var l = document.createElement("span"); l.textContent = "Spezialbörsen:"; box.appendChild(l); }
      mehr.forEach(function (m) { if (String(m.url).indexOf("https://") !== 0) return; var a = document.createElement("a"); a.href = m.url; a.target = "_blank"; a.rel = "noopener"; a.textContent = m.name + " →"; box.appendChild(a); });
      try { localStorage.setItem("kaufen", JSON.stringify({ i: radios.indexOf(o), von: f.von.value, bis: f.bis.value, preis: f.preis.value, km: f.km.value })); } catch (e) {}
    }
    radios.forEach(function (r) { r.addEventListener("change", function () { preset(); build(); }); });
    for (var k in f) f[k].addEventListener("input", build);
    if (!load()) preset();
    build();
  })();
  </script>
</section>`;
}
