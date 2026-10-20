import { groupCars, matches, openCompare, openDetail, renderGroups } from "./catalog.js";

const store = (() => { try { return window.localStorage; } catch { return null; } })();

// Wires the search box, group-by chips and filter chips to a list of cars.
export function mountBrowser({ cars, byId, root, dialog, newIds, detailExtra }) {
  const q = root.querySelector("[data-search]");
  const out = root.querySelector("[data-groups]");
  const state = { mode: store?.getItem("groupBy") || "brand", limited: false, collectible: false };
  const params = new URLSearchParams(location.search);
  if (params.get("q")) q.value = params.get("q");

  const sync = () => {
    root.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode)));
    root.querySelectorAll("[data-flag]").forEach((b) => b.setAttribute("aria-pressed", String(state[b.dataset.flag])));
    const shown = cars.filter((c) => matches(c, q.value.trim(), state));
    renderGroups(out, groupCars(shown, state.mode), { newIds });
  };
  root.addEventListener("click", (e) => {
    const mode = e.target.closest("[data-mode]");
    const flag = e.target.closest("[data-flag]");
    const card = e.target.closest(".card");
    if (mode) { state.mode = mode.dataset.mode; try { store?.setItem("groupBy", state.mode); } catch {} sync(); }
    if (flag) { state[flag.dataset.flag] = !state[flag.dataset.flag]; sync(); }
    if (card) {
      const car = byId.get(Number(card.dataset.id));
      if (comparing && comparing.id !== car.id) { openCompare(dialog, comparing, car); setComparing(null); }
      else openDetail(dialog, car, detailExtra ? detailExtra(car) : "");
    }
  });
  // Compare: pick the first car in its dialog, then tap any other card.
  let comparing = null;
  const banner = document.createElement("div");
  banner.className = "compare-banner";
  banner.hidden = true;
  document.body.append(banner);
  const setComparing = (car) => {
    comparing = car;
    banner.hidden = !car;
    if (car) banner.innerHTML = `Pick a car to compare with <b>${car.brand.name} ${car.model}</b> <button class="chip" type="button">Cancel</button>`;
  };
  banner.addEventListener("click", (e) => { if (e.target.closest("button")) setComparing(null); });
  dialog.addEventListener("click", (e) => {
    const b = e.target.closest("[data-compare]");
    if (b) { setComparing(byId.get(Number(b.dataset.compare))); dialog.close(); }
  });
  let t;
  q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(sync, 80); });
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  sync();
}

export const TOOLS = `
  <div class="tools">
    <label class="search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input type="search" data-search placeholder="Search make, model, year" aria-label="Search cars"></label>
    <div class="row"><span class="label">GROUP BY</span>
      <button class="chip" data-mode="brand">Brand</button><button class="chip" data-mode="year">Year</button><button class="chip" data-mode="hp">Horsepower</button>
      <span class="label" style="margin-left:8px">SHOW</span>
      <button class="chip" data-flag="limited">Limited</button><button class="chip" data-flag="collectible">Collectible</button>
    </div>
  </div>
  <div data-groups></div>`;
