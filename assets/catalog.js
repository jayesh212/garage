// Shared by the catalog page and shared-garage page. No dependencies.
const ROOT = new URL("..", import.meta.url);

export const HP_BANDS = [
  { id: "1000", label: "1,000+ hp", min: 1000 },
  { id: "700", label: "700–999 hp", min: 700 },
  { id: "500", label: "500–699 hp", min: 500 },
  { id: "300", label: "300–499 hp", min: 300 },
  { id: "0", label: "Under 300 hp", min: 0 },
];

export async function loadCatalog() {
  const res = await fetch(new URL("data/catalog.json", ROOT), { cache: "no-cache" });
  const raw = await res.json();
  const brands = new Map(raw.brands.map(([id, name, slug]) => [id, { id, name, slug }]));
  const f = Object.fromEntries(raw.fields.map((k, i) => [k, i]));
  const cars = raw.cars.map((r) => {
    const car = {
      id: r[f.id], brand: brands.get(r[f.brand_id]), model: r[f.model], yearStart: r[f.year_start],
      yearEnd: r[f.year_end], body: r[f.body], engine: r[f.engine], hp: r[f.hp], torque: r[f.torque_nm],
      top: r[f.top_speed_kmh], zero100: r[f.zero_100_s], production: r[f.production], collectible: !!r[f.collectible],
      image: r[f.image] ? new URL(r[f.image], ROOT).href : null, credit: r[f.credit],
      license: r[f.license] != null ? raw.licenses[r[f.license]] : null, wiki: r[f.wiki],
      values: f.values != null ? r[f.values] || [] : [],
    };
    car.search = `${car.brand.name} ${car.model} ${car.yearStart}`.toLowerCase();
    return car;
  });
  const sets = (raw.sets || []).map(([name, detail, ids]) => ({ name, detail, ids }));
  return { version: raw.version, brands: [...brands.values()], cars, sets, byId: new Map(cars.map((c) => [c.id, c])) };
}

export function matches(car, query, flags) {
  if (flags.limited && car.production == null) return false;
  if (flags.collectible && !car.collectible) return false;
  if (!query) return true;
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((w) => car.search.includes(w));
}

export function hpBand(hp) {
  return HP_BANDS.find((b) => (hp ?? 0) >= b.min);
}

export function groupCars(cars, mode) {
  const groups = new Map();
  const add = (key, label, car, order) => {
    if (!groups.has(key)) groups.set(key, { key, label, order, cars: [] });
    groups.get(key).cars.push(car);
  };
  for (const car of cars) {
    if (mode === "year") {
      const d = Math.floor(car.yearStart / 10) * 10;
      add(d, `${d}s`, car, -d);
    } else if (mode === "hp") {
      if (car.hp == null) add("none", "Power not listed", car, 1);
      else { const b = hpBand(car.hp); add(b.id, b.label, car, -b.min); }
    } else {
      add(car.brand.id, car.brand.name, car, car.brand.name);
    }
  }
  const sorter = {
    brand: (a, b) => a.yearStart - b.yearStart || a.model.localeCompare(b.model),
    year: (a, b) => a.yearStart - b.yearStart || a.brand.name.localeCompare(b.brand.name),
    hp: (a, b) => (b.hp ?? 0) - (a.hp ?? 0),
  }[mode] || (() => 0);
  return [...groups.values()]
    .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
    .map((g) => ({ ...g, cars: g.cars.sort(sorter) }));
}

export function rarity(car) {
  const p = car.production;
  if (p == null) return null;
  return p <= 10 ? "Unicorn" : p <= 100 ? "Ultra rare" : p <= 500 ? "Very rare" : p <= 2000 ? "Rare" : "Limited";
}

export const fmt = (n) => (n == null ? "—" : n.toLocaleString("en-US"));
export const years = (c) => (c.yearEnd == null ? `${c.yearStart}–` : c.yearEnd === c.yearStart ? `${c.yearStart}` : `${c.yearStart}–${c.yearEnd}`);
// One decimal at most, halves round up (same rule as Int.money in the app).
const short = (x) => String(Math.round(x * 10) / 10);
export const money = (n) => (n == null ? "—" : n >= 1e9 ? `$${short(n / 1e9)}B` : n >= 1e6 ? `$${short(n / 1e6)}M` : `$${Math.round(n / 1000)}k`);

// Estimated value of one car in a given year, interpolated between known points.
export function valueAt(car, year) {
  const v = car.values;
  if (!v.length) return null;
  if (year <= v[0][0]) return v[0][1];
  for (let i = 1; i < v.length; i++) {
    if (year <= v[i][0]) {
      const [y0, p0] = v[i - 1], [y1, p1] = v[i];
      return Math.round(p0 + ((p1 - p0) * (year - y0)) / (y1 - y0));
    }
  }
  return v[v.length - 1][1];
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
export { esc };

export function silhouette(fill = "#a9aeb4") {
  return `<svg viewBox="0 0 200 72" aria-hidden="true"><path d="M8 54 C8 46 14 42 26 40 L60 35 C72 25 90 19 110 19 C130 19 144 25 156 35 L182 39 C192 41 196 47 196 54 L196 58 L8 58 Z" fill="${fill}" stroke="#0b0c0d" stroke-width="1.5"/><path d="M70 35 C80 27 94 23 110 23 C124 23 134 27 146 35 Z" fill="#20252a"/><circle cx="50" cy="58" r="11" fill="#0b0c0d"/><circle cx="158" cy="58" r="11" fill="#0b0c0d"/></svg>`;
}

function photo(car, cls = "") {
  return car.image
    ? `<img class="${cls}" src="${esc(car.image)}" alt="" loading="lazy" decoding="async">`
    : silhouette();
}

export function cardHTML(car, opts = {}) {
  const badge = opts.isNew ? `<span class="badge">NEW</span>`
    : car.production != null ? `<span class="badge dark">${fmt(car.production)} built</span>` : "";
  return `<button class="card" data-id="${car.id}" aria-label="${esc(car.brand.name)} ${esc(car.model)}, ${esc(years(car))}">
    ${badge}<div class="stage">${photo(car)}</div>
    <div class="meta"><span>${esc(car.brand.name)}</span><span>${esc(years(car))}</span></div>
    <div class="name">${esc(car.model)}</div>
    <div class="hp">${car.hp ? fmt(car.hp) : "—"}<small>hp</small></div>
  </button>`;
}

export function renderGroups(el, groups, opts = {}) {
  if (!groups.length) {
    el.innerHTML = `<p class="empty">No cars match that search.</p>`;
    return;
  }
  // Big result sets show the first cards of each group; "Show all" fills in the rest on demand.
  const total = groups.reduce((n, g) => n + g.cars.length, 0);
  const cap = total > 120 ? 8 : Infinity;
  el.innerHTML = groups.map((g, i) => {
    const hp = g.cars.reduce((s, c) => s + (c.hp || 0), 0);
    const shown = g.cars.slice(0, cap);
    const more = g.cars.length - shown.length;
    return `<section class="group"><h2>${esc(g.label)} <span>${g.cars.length} car${g.cars.length === 1 ? "" : "s"} · ${fmt(hp)} hp combined</span></h2>
      <div class="grid">${shown.map((c) => cardHTML(c, { isNew: opts.newIds?.has(c.id) })).join("")}</div>
      ${more > 0 ? `<button class="chip more" data-more="${i}">Show all ${g.cars.length}</button>` : ""}</section>`;
  }).join("");
  el.onclick = (e) => {
    const b = e.target.closest("[data-more]");
    if (!b) return;
    const g = groups[Number(b.dataset.more)];
    b.previousElementSibling.insertAdjacentHTML("beforeend", g.cars.slice(cap).map((c) => cardHTML(c, { isNew: opts.newIds?.has(c.id) })).join(""));
    b.remove();
  };
}

export function openDetail(dialog, car, extra = "", opts = {}) {
  const row = (k, v) => (v == null || v === "" ? "" : `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`);
  const now = valueAt(car, new Date().getFullYear());
  dialog.innerHTML = `<div class="d-hero">
      <div class="row"><span class="tag">${car.production != null ? `${rarity(car)} · ${fmt(car.production)} built` : car.collectible ? "Collectible" : esc(car.body || "")}</span>
      <form method="dialog"><button class="pill icon-btn" aria-label="Close">✕</button></form></div>
      <div class="sub">${esc(car.brand.name)} · ${esc(years(car))}</div>
      <h3>${esc(car.model)}</h3>${photo(car)}
    </div>
    <div class="d-body">
      <div class="tiles">
        <div class="tile"><span>Power</span><span>${car.hp ? fmt(car.hp) + " hp" : "—"}</span></div>
        <div class="tile"><span>0–100 km/h</span><span>${car.zero100 ? car.zero100 + " s" : "—"}</span></div>
        <div class="tile accent"><span>${now ? "Est. value" : "Top speed"}</span><span>${now ? money(now) : car.top ? car.top + " km/h" : "—"}</span></div>
      </div>
      <dl class="specs">${row("Engine", car.engine)}${row("Torque", car.torque && `${fmt(car.torque)} Nm`)}${row("Top speed", car.top && `${car.top} km/h`)}${row("Body", car.body && car.body.replace("_", " "))}${row("Built", car.production != null ? `${fmt(car.production)} units` : null)}</dl>
      ${extra}
      ${valueChart(car)}
      <div class="d-actions">
        <button class="btn" data-dream="${car.id}" aria-pressed="${dream.has(car.id)}">${dream.has(car.id) ? "✓ In your dream garage" : "+ Dream garage"}</button>
        <button class="btn" data-link="${car.id}">Copy link</button>
      </div>
      ${opts.compare === false ? "" : `<button class="btn" data-compare="${car.id}" style="justify-content:center">Compare with another car</button>`}
      ${car.image ? `<p class="credit">Photo: ${esc(car.credit)} · ${esc(car.license)} · Wikimedia Commons, background removed</p>` : ""}
    </div>`;
  if (!dialog.open) dialog.showModal();
  // Deep link: the address bar always names the open car, so it can be copied or shared.
  history.replaceState(null, "", `#car-${car.id}`);
  if (!dialog.dataset.wired) {
    dialog.dataset.wired = "1";
    dialog.addEventListener("close", () => { if (location.hash.startsWith("#car-")) history.replaceState(null, "", location.pathname + location.search); });
    dialog.addEventListener("click", async (e) => {
      const d = e.target.closest("[data-dream]"), l = e.target.closest("[data-link]");
      if (d) {
        const on = dream.toggle(Number(d.dataset.dream));
        d.setAttribute("aria-pressed", String(on));
        d.textContent = on ? "✓ In your dream garage" : "+ Dream garage";
        document.dispatchEvent(new CustomEvent("dream"));
      }
      if (l) {
        const url = `${location.origin}${location.pathname}${location.search}#car-${l.dataset.link}`;
        try { await navigator.clipboard.writeText(url); l.textContent = "Link copied"; } catch { l.textContent = "Copy from the address bar"; }
      }
    });
  }
}

/** Opens the car named in the address (#car-123) once the catalog has loaded. */
export function openFromHash(dialog, byId, opts = {}) {
  const m = location.hash.match(/^#car-(\d+)$/);
  const car = m && byId.get(Number(m[1]));
  if (car) openDetail(dialog, car, "", opts);
}

/** Estimated value over time as a small inline chart; empty when there's under two points. */
export function valueChart(car) {
  const v = car.values;
  if (!v || v.length < 2) return "";
  const W = 460, H = 120, pad = 6;
  const x0 = v[0][0], x1 = v[v.length - 1][0];
  const lo = Math.min(...v.map((p) => p[1])), hi = Math.max(...v.map((p) => p[1]));
  const x = (y) => pad + ((y - x0) / Math.max(1, x1 - x0)) * (W - pad * 2);
  const y = (u) => H - pad - ((u - lo) / Math.max(1, hi - lo)) * (H - pad * 2 - 14);
  const line = v.map((p) => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ");
  const first = v[0][1], last = v[v.length - 1][1];
  const change = Math.round(((last - first) / first) * 100);
  return `<figure class="vchart" aria-label="Estimated value from ${x0} to ${x1}: ${money(first)} to ${money(last)}">
    <figcaption><span>Estimated value</span><b>${change >= 0 ? "+" : ""}${change}% since ${x0}</b></figcaption>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <polygon points="${x(x0)},${H} ${line} ${x(x1)},${H}" class="area"/><polyline points="${line}" class="line"/>
    </svg>
    <div class="vchart-axis">${v.map((p) => `<span>${p[0]}<br>${money(p[1])}</span>`).join("")}</div>
  </figure>`;
}

/** The visitor's dream garage: car ids kept in this browser only. */
export const dream = (() => {
  const KEY = "dreamGarage";
  const read = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set(); } };
  let ids = read();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...ids])); } catch {} };
  return {
    has: (id) => ids.has(id),
    ids: () => [...ids],
    toggle(id) { if (ids.has(id)) ids.delete(id); else ids.add(id); save(); return ids.has(id); },
    replace(list) { ids = new Set(list); save(); },
  };
})();

/** Site navigation; `here` is "catalog", "market" or "dream". */
export function navHTML(here) {
  const link = (key, path, label) => `<a class="pill${here === key ? " on" : ""}" href="${new URL(path, ROOT).href}"${here === key ? ' aria-current="page"' : ""}>${label}</a>`;
  const n = dream.ids().length;
  return link("catalog", "./", "Catalog") + link("market", "market/", "Market") + link("dream", "dream/", `Dream garage${n ? ` <span class="count" data-dream-count>${n}</span>` : ' <span class="count" data-dream-count hidden></span>'}`);
}
document.addEventListener("dream", () => {
  const n = dream.ids().length;
  document.querySelectorAll("[data-dream-count]").forEach((el) => { el.textContent = n; el.hidden = !n; });
});

// Change in estimated value over the last `years` years, as a fraction (0.5 = +50%).
export function growth(car, years = 5) {
  const now = new Date().getFullYear();
  const a = valueAt(car, now - years), b = valueAt(car, now);
  if (!a || !b || car.values.length < 2 || car.values[0][0] > now - years) return null;
  return (b - a) / a;
}

// Side-by-side table; the better value in each row gets the accent.
export function openCompare(dialog, a, b) {
  const now = new Date().getFullYear();
  const rows = [
    ["Power", a.hp, b.hp, (v) => `${fmt(v)} hp`, 1],
    ["Torque", a.torque, b.torque, (v) => `${fmt(v)} Nm`, 1],
    ["0–100 km/h", a.zero100, b.zero100, (v) => `${v} s`, -1],
    ["Top speed", a.top, b.top, (v) => `${v} km/h`, 1],
    ["Built", a.production, b.production, (v) => fmt(v), -1],
    ["Est. value", valueAt(a, now), valueAt(b, now), money, 1],
  ];
  const cell = (v, other, f, dir) => {
    const win = v != null && other != null && v !== other && (v > other) === (dir > 0);
    return `<td class="${win ? "win" : ""}">${v == null ? "—" : esc(f(v))}</td>`;
  };
  const head = (c) => `<th><div class="stage">${c.image ? `<img src="${esc(c.image)}" alt="">` : silhouette()}</div>
    <div class="meta"><span>${esc(c.brand.name)}</span><span>${esc(years(c))}</span></div><div class="name">${esc(c.model)}</div></th>`;
  dialog.innerHTML = `<div class="d-body" style="padding-top:20px">
    <div class="row" style="justify-content:space-between"><b class="name">Compare</b><form method="dialog"><button class="pill icon-btn" aria-label="Close">✕</button></form></div>
    <table class="compare"><thead><tr><th></th>${head(a)}${head(b)}</tr></thead><tbody>
    ${rows.map(([k, x, y, f, d]) => `<tr><th scope="row">${k}</th>${cell(x, y, f, d)}${cell(y, x, f, d)}</tr>`).join("")}
    </tbody></table></div>`;
  if (!dialog.open) dialog.showModal();
}
