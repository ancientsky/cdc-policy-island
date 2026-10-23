import { dayNote, hourCovers, itemCount, phaseLabel, phases, pillars, SOURCE_INDEX } from "./data.js";
import { applyLocale, getLang, introSteps, t, THEME_MINUTES, themeFromMinutes } from "./i18n.js";

const INTRO_KEY = "cdc-policy-island-intro-v1";

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function fmt(minutes) {
  const value = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function pillarChips(ids) {
  return ids.map((id) => {
    const pillar = pillars.find((item) => item.id === id);
    return `<i class="chip" style="--c:${pillar.color}">${esc(pillar.mark)} ${esc(pillar.name)}</i>`;
  }).join("");
}

export function mount({ scene, islands, flows }) {
  const byId = new Map(islands.map((island) => [island.id, island]));
  const ordered = [...islands].sort((a, b) => a.no.localeCompare(b.no));
  const state = {
    phase: "all",
    pillars: new Set(),
    query: "",
    tab: "islands",
    selected: null,
    minutes: 8 * 60 + 20,
    playing: false,
    names: false,
    cargo: true,
    flows: false,
    freeze: false,
    bird: false,
    log: [],
  };

  const $ = (id) => document.getElementById(id);
  const stats = $("stats");
  const tree = $("tree");
  const sheet = $("sheet");
  const clock = $("clock");
  const day = $("day");
  const dayNoteEl = $("day-note");
  const phaseNote = $("phase-note");
  const status = $("status");
  const compass = $("compass-rose");
  const search = $("search");
  const modal = $("modal");
  const ledger = $("ledger");

  const toggleKey = { names: "toggleNames", cargo: "toggleCargo", flows: "toggleFlows", freeze: "toggleFreeze", bird: "toggleBird" };
  let introIndex = 0;

  function buildFilters() {
    $("phase-buttons").innerHTML = phases.map((phase) => (
      `<button type="button" data-phase="${phase.id}" class="${phase.id === state.phase ? "on" : ""}">${esc(phase.label)}<small>${esc(phase.years)}</small></button>`
    )).join("");
    $("pillar-buttons").innerHTML = `<button type="button" data-pillar="all" class="${state.pillars.size === 0 ? "on" : ""}">${esc(t("allPillars"))}</button>` + pillars.map((pillar) => (
      `<button type="button" data-pillar="${pillar.id}" class="${state.pillars.has(pillar.id) ? "on" : ""}" style="--c:${pillar.color}"><b>${esc(pillar.mark)}</b>${esc(pillar.name)}</button>`
    )).join("");
  }

  function paintChrome() {
    document.documentElement.lang = getLang() === "zh" ? "zh-Hant" : getLang();
    document.title = t("title");
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = t("description");
    $("brand-kicker").textContent = t("brandKicker");
    $("brand-title").textContent = t("brandTitle");
    $("compass-rose").querySelector("b").textContent = t("compass");
    $("compass-rose").parentElement.title = t("compassTitle");
    $("home").textContent = t("home");
    $("list").textContent = t("list");
    $("help").setAttribute("aria-label", t("help"));
    $("hero-title").innerHTML = esc(t("heroTitle")).replaceAll("\n", "<br>");
    $("hero-lead").innerHTML = esc(t("heroLead")).replaceAll("\n", "<br>");
    $("ledger-kicker").textContent = t("eyebrow");
    $("ledger-title").textContent = t("ledgerTitle");
    $("ledger-lead").textContent = t("ledgerLead");
    search.placeholder = t("search");
    search.setAttribute("aria-label", t("searchLabel"));
    $("tab-islands").textContent = t("tabIslands");
    $("tab-flows").textContent = t("tabFlows", { n: flows.length });
    $("tab-log").textContent = t("tabLog");
    $("disclaimer").textContent = t("disclaimer");
    $("source-link").textContent = t("sourceLink");
    $("panel-tab-day").textContent = t("panelDay");
    $("panel-tab-phase").textContent = t("panelPhase");
    $("panel-tab-pillar").textContent = t("panelPillar");
    day.setAttribute("aria-label", t("dayLabel"));
    $("pillar-note").textContent = t("pillarNote");
    document.querySelector(".toggles")?.setAttribute("aria-label", t("togglesLabel"));
    document.querySelector(".tools")?.setAttribute("aria-label", t("mapLabel"));
    const veilText = $("veil-text");
    if (veilText) veilText.textContent = t("veil");
    $("c")?.setAttribute("aria-label", t("canvas"));
    const langBox = $("lang-switch");
    langBox.setAttribute("aria-label", t("langLabel"));
    langBox.innerHTML = [["zh", "langZh"], ["en", "langEn"], ["ja", "langJa"]].map(([id, key]) => (
      `<button type="button" data-lang="${id}" class="${id === getLang() ? "on" : ""}" aria-pressed="${id === getLang()}">${esc(t(key))}</button>`
    )).join("");
    const themeBox = $("theme-switch");
    themeBox.setAttribute("aria-label", t("themeLabel"));
    themeBox.innerHTML = ["morning", "noon", "evening", "night"].map((id) => (
      `<button type="button" data-theme-pick="${id}">${esc(t(`theme${id[0].toUpperCase()}${id.slice(1)}`))}</button>`
    )).join("");
    for (const button of document.querySelectorAll("[data-toggle]")) button.textContent = t(toggleKey[button.dataset.toggle]);
    buildFilters();
    stats.textContent = t("stats", { islands: islands.length, items: itemCount(), flows: flows.length });
  }

  function writeHash() {
    const params = new URLSearchParams();
    const selected = state.selected;
    if (selected?.type === "island") params.set("island", selected.id);
    if (selected?.type === "item") {
      params.set("island", selected.islandId);
      params.set("item", selected.itemId);
    }
    if (selected?.type === "flow") params.set("flow", selected.id);
    const next = params.toString();
    history.replaceState(null, "", next ? `#${next}` : location.pathname + location.search);
  }

  function paintClock() {
    const note = dayNote(state.minutes);
    const hour = state.minutes / 60;
    const awake = islands.filter((island) => island.items.some((item) => hourCovers(item.hours, hour))).length;
    clock.textContent = fmt(state.minutes);
    day.value = String(Math.floor(state.minutes));
    const join = getLang() === "en" ? ". " : "。";
    dayNoteEl.textContent = `${note.title}${join}${note.text}`;
    status.textContent = t("onDuty", { n: awake });
    scene.setMinutes(state.minutes);
    const theme = themeFromMinutes(state.minutes);
    document.documentElement.dataset.theme = theme;
    const themeColor = { morning: "#f6e3c8", noon: "#d5eee8", evening: "#3a1844", night: "#070b12" };
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = themeColor[theme];
    for (const button of document.querySelectorAll("[data-theme-pick]")) {
      const on = button.dataset.themePick === theme;
      button.classList.toggle("on", on);
      button.setAttribute("aria-pressed", String(on));
    }
  }

  function renderList() {
    const q = state.query.trim().toLowerCase().replace(/\s+/g, "");
    if (state.tab === "flows") {
      const rows = flows.filter((flow) => !q || [flow.title, flow.text, flow.carried, flow._alias, byId.get(flow.a).name, byId.get(flow.b).name].join(" ").toLowerCase().replace(/\s+/g, "").includes(q));
      tree.innerHTML = rows.length ? rows.map((flow) => {
        const on = state.selected?.type === "flow" && state.selected.id === flow.id;
        return `<button type="button" class="flow ${on ? "on" : ""}" data-flow="${flow.id}"><b>${esc(flow.title)}</b><span>${esc(byId.get(flow.a).name)} → ${esc(byId.get(flow.b).name)}</span><small>${esc(t("carry", { what: flow.carried }))}</small></button>`;
      }).join("") : `<p class="empty">${esc(t("emptyFlow"))}</p>`;
      return;
    }
    if (state.tab === "log") {
      tree.innerHTML = state.log.length
        ? `<ol class="loglist">${state.log.map((row) => `<li><time>${esc(row.time)}</time>${esc(row.text)}</li>`).join("")}</ol>`
        : `<p class="empty">${esc(t("emptyLog"))}</p>`;
      return;
    }
    const cards = ordered.filter((island) => {
      if (!q) return true;
      const blob = [island.name, island.pin, island.blurb, island.source, ...island.items.flatMap((item) => [item.name, item.text, ...(item.keywords ?? [])])].join(" ").toLowerCase().replace(/\s+/g, "");
      return blob.includes(q);
    });
    tree.innerHTML = cards.length ? cards.map((island) => {
      const open = state.selected && ((state.selected.type === "island" && state.selected.id === island.id) || (state.selected.type === "item" && state.selected.islandId === island.id) || (state.selected.type === "flow" && (state.selected.flow.a === island.id || state.selected.flow.b === island.id)));
      const items = island.items.map((item) => {
        const on = state.selected?.type === "item" && state.selected.itemId === item.id;
        return `<button type="button" class="sub ${on ? "on" : ""}" data-item="${item.id}" data-island="${island.id}"><span>${esc(item.name)}</span><small>${esc(phaseLabel[item.phase])}</small></button>`;
      }).join("");
      return `<section class="island ${open ? "open" : ""}"><button type="button" class="head ${open ? "on" : ""}" data-island="${island.id}"><i style="--c:${island.accent}">${esc(island.no)}</i><span><b>${esc(island.name)}</b><small>${esc(island.pin)}</small></span></button><div class="subs">${items}</div></section>`;
    }).join("") : `<p class="empty">${esc(t("emptyIsland"))}</p>`;
  }

  function renderSheet() {
    const selected = state.selected;
    if (!selected) {
      sheet.hidden = true;
      document.body.classList.remove("detail");
      return;
    }
    document.body.classList.add("detail");
    sheet.hidden = false;
    if (selected.type === "flow") {
      const flow = selected.flow;
      sheet.innerHTML = `<button type="button" class="x" data-close aria-label="${esc(t("close"))}">×</button><p class="eyebrow">${esc(t("flowEyebrow"))}</p><h2>${esc(flow.title)}</h2><p class="route">${esc(byId.get(flow.a).name)} → ${esc(byId.get(flow.b).name)}</p><p>${esc(flow.text)}</p><p class="carried">${esc(t("carried", { what: flow.carried }))}</p><p class="fine">${esc(t("flowFine"))}</p>`;
      return;
    }
    const island = byId.get(selected.type === "item" ? selected.islandId : selected.id);
    const related = flows.filter((flow) => flow.a === island.id || flow.b === island.id);
    const items = island.items.map((item) => {
      const on = selected.type === "item" && selected.itemId === item.id;
      return `<button type="button" class="detail-item ${on ? "on" : ""}" data-item="${item.id}" data-island="${island.id}"><span><b>${esc(item.name)}</b><small>${esc(phaseLabel[item.phase])}</small></span><em>${esc(item.text)}</em></button>`;
    }).join("");
    const links = related.map((flow) => `<button type="button" data-flow="${flow.id}">${esc(flow.title)}</button>`).join("");
    sheet.innerHTML = `<button type="button" class="x" data-close aria-label="${esc(t("close"))}">×</button><p class="eyebrow">${esc(island.no)}　${pillarChips(island.pillars)}</p><h2>${esc(island.name)}</h2><p>${esc(island.blurb)}</p><p class="source">${esc(island.source)}</p><p class="jump"><a href="${esc(island.href)}" target="_blank" rel="noopener noreferrer">${esc(island.hrefLabel)}</a></p><div class="detail-items">${items}</div><h3>${esc(t("outTitle"))}</h3><div class="related">${links}</div>`;
    const current = sheet.querySelector(".detail-item.on");
    current?.scrollIntoView({ block: "nearest" });
  }

  function selectIsland(id) {
    if (!byId.has(id)) return;
    state.selected = { type: "island", id };
    scene.focusIslands([id]);
    scene.setHotItem(null);
    writeHash();
    renderList();
    renderSheet();
  }

  function selectItem(islandId, itemId) {
    const island = byId.get(islandId);
    if (!island?.items.some((item) => item.id === itemId)) return;
    state.selected = { type: "item", islandId, itemId };
    scene.focusIslands([islandId]);
    scene.setHotItem(itemId);
    writeHash();
    renderList();
    renderSheet();
  }

  function selectFlow(id) {
    const flow = flows.find((item) => item.id === id);
    if (!flow) return;
    state.selected = { type: "flow", id, flow };
    scene.focusIslands([flow.a, flow.b]);
    scene.setHotItem(null);
    writeHash();
    renderList();
    renderSheet();
  }

  function clearSelection() {
    state.selected = null;
    scene.overview();
    scene.setHotItem(null);
    writeHash();
    renderList();
    renderSheet();
  }

  function syncToggles() {
    for (const button of document.querySelectorAll("[data-toggle]")) {
      button.setAttribute("aria-pressed", String(state[button.dataset.toggle]));
    }
    $("play").textContent = state.playing ? t("pause") : t("play");
    $("play").setAttribute("aria-pressed", String(state.playing));
  }

  function showIntro(index) {
    introIndex = index;
    modal.dataset.mode = "";
    const steps = introSteps();
    const step = steps[index];
    $("modal-kicker").textContent = step.kicker;
    $("modal-title").textContent = step.title;
    $("modal-body").textContent = step.body;
    $("modal-next").textContent = index === steps.length - 1 ? t("start") : t("next");
    $("modal-skip").textContent = t("skip");
    $("modal-skip").hidden = index === steps.length - 1;
    modal.hidden = false;
    if (step.showFlows) {
      state.flows = true;
      scene.setShowAllFlows(true);
      syncToggles();
    }
  }

  function closeModal() {
    modal.hidden = true;
    sessionStorage.setItem(INTRO_KEY, "1");
  }

  function refreshModal() {
    if (modal.hidden) return;
    if (modal.dataset.mode === "help") {
      $("modal-kicker").textContent = t("helpKicker");
      $("modal-title").textContent = t("helpTitle");
      $("modal-body").textContent = t("helpBody");
      $("modal-next").textContent = t("gotIt");
      return;
    }
    showIntro(introIndex);
  }

  scene.onPick((hit) => {
    if (!hit) {
      clearSelection();
      return;
    }
    if (hit.kind === "item") selectItem(hit.islandId, hit.itemId);
    else selectIsland(hit.islandId);
  });
  scene.onArrive((event) => {
    if (!event) return;
    const text = t("handoff", { from: byId.get(event.from).name, what: event.carried, to: byId.get(event.to).name });
    state.log.unshift({ time: fmt(state.minutes), text });
    state.log.length = 12;
    if (state.tab === "log") renderList();
  });

  tree.addEventListener("click", (event) => {
    const item = event.target.closest("[data-item]");
    if (item) {
      selectItem(item.dataset.island, item.dataset.item);
      return;
    }
    const flow = event.target.closest("[data-flow]");
    if (flow) {
      selectFlow(flow.dataset.flow);
      return;
    }
    const island = event.target.closest("[data-island]");
    if (island) selectIsland(island.dataset.island);
  });
  sheet.addEventListener("click", (event) => {
    if (event.target.closest("[data-close]")) {
      clearSelection();
      return;
    }
    const item = event.target.closest("[data-item]");
    if (item) {
      selectItem(item.dataset.island, item.dataset.item);
      return;
    }
    const flow = event.target.closest("[data-flow]");
    if (flow) selectFlow(flow.dataset.flow);
  });

  for (const button of document.querySelectorAll(".dial-tabs button")) {
    button.addEventListener("click", () => {
      for (const tab of document.querySelectorAll(".dial-tabs button")) tab.classList.toggle("on", tab === button);
      for (const panel of document.querySelectorAll(".dial .panel")) {
        panel.classList.toggle("on", panel.id === `panel-${button.dataset.panel}`);
      }
    });
  }
  for (const button of document.querySelectorAll(".tabs button")) {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      for (const tab of document.querySelectorAll(".tabs button")) tab.classList.toggle("on", tab === button);
      renderList();
    });
  }
  search.addEventListener("input", () => {
    state.query = search.value;
    scene.setQuery(search.value);
    renderList();
  });
  $("phase-buttons").addEventListener("click", (event) => {
    const button = event.target.closest("[data-phase]");
    if (!button) return;
    state.phase = button.dataset.phase;
    for (const item of $("phase-buttons").querySelectorAll("button")) item.classList.toggle("on", item === button);
    phaseNote.textContent = phases.find((phase) => phase.id === state.phase).note;
    scene.setPhase(state.phase);
    renderList();
  });
  $("pillar-buttons").addEventListener("click", (event) => {
    const button = event.target.closest("[data-pillar]");
    if (!button) return;
    if (button.dataset.pillar === "all") state.pillars.clear();
    else if (state.pillars.has(button.dataset.pillar)) state.pillars.delete(button.dataset.pillar);
    else state.pillars.add(button.dataset.pillar);
    for (const item of $("pillar-buttons").querySelectorAll("button")) {
      const id = item.dataset.pillar;
      item.classList.toggle("on", id === "all" ? state.pillars.size === 0 : state.pillars.has(id));
    }
    scene.setPillars(state.pillars);
  });
  day.addEventListener("input", () => {
    state.playing = false;
    state.minutes = Number(day.value);
    syncToggles();
    paintClock();
  });
  $("play").addEventListener("click", () => {
    state.playing = !state.playing;
    syncToggles();
  });
  for (const button of document.querySelectorAll("[data-toggle]")) {
    button.addEventListener("click", () => {
      const key = button.dataset.toggle;
      state[key] = !state[key];
      if (key === "names") scene.setNames(state.names);
      if (key === "cargo") scene.setCargo(state.cargo);
      if (key === "flows") scene.setShowAllFlows(state.flows);
      if (key === "freeze") {
        scene.setFreeze(state.freeze);
        if (state.freeze) state.playing = false;
      }
      if (key === "bird") scene.setBird(state.bird);
      syncToggles();
    });
  }
  $("home").addEventListener("click", clearSelection);
  $("list").addEventListener("click", () => {
    ledger.classList.toggle("open");
    search.focus();
  });
  $("help").addEventListener("click", () => {
    $("modal-kicker").textContent = t("helpKicker");
    $("modal-title").textContent = t("helpTitle");
    $("modal-body").textContent = t("helpBody");
    $("modal-next").textContent = t("gotIt");
    $("modal-skip").hidden = true;
    modal.hidden = false;
    modal.dataset.mode = "help";
  });
  $("modal-skip").addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });
  $("modal-next").addEventListener("click", () => {
    if (modal.dataset.mode === "help") {
      modal.hidden = true;
      modal.dataset.mode = "";
      return;
    }
    if (introIndex >= introSteps().length - 1) closeModal();
    else showIntro(introIndex + 1);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
      event.preventDefault();
      $("help").click();
    } else if (event.key === "Escape") {
      if (!modal.hidden) closeModal();
      else if (state.selected) clearSelection();
    }
  });
  $("lang-switch").addEventListener("click", (event) => {
    const button = event.target.closest("[data-lang]");
    if (!button || button.dataset.lang === getLang()) return;
    applyLocale(button.dataset.lang);
    scene.relabel?.();
    paintChrome();
    phaseNote.textContent = phases.find((phase) => phase.id === state.phase).note;
    syncToggles();
    paintClock();
    renderList();
    renderSheet();
    refreshModal();
  });
  $("theme-switch").addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-pick]");
    if (!button) return;
    state.playing = false;
    state.minutes = THEME_MINUTES[button.dataset.themePick];
    syncToggles();
    paintClock();
  });

  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  paintChrome();
  paintClock();
  phaseNote.textContent = phases[0].note;
  syncToggles();
  renderList();
  if (params.get("item") && params.get("island")) selectItem(params.get("island"), params.get("item"));
  else if (params.get("flow")) selectFlow(params.get("flow"));
  else if (params.get("island")) selectIsland(params.get("island"));
  else if (!new URLSearchParams(location.search).has("quiet") && !sessionStorage.getItem(INTRO_KEY)) showIntro(0);

  $("source-link").href = SOURCE_INDEX;

  return {
    tick(dt) {
      if (state.playing && !state.freeze) {
        state.minutes = (state.minutes + dt * 42) % 1440;
        paintClock();
      }
      if (!state.bird && scene.isBird()) state.bird = false;
      state.bird = scene.isBird();
      syncBirdOnly();
      compass.style.transform = `rotate(${scene.getTheta()}rad)`;
    },
  };

  function syncBirdOnly() {
    const button = document.querySelector('[data-toggle="bird"]');
    if (button) button.setAttribute("aria-pressed", String(state.bird));
  }
}
