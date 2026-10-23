import { DATA_AS_OF, dayNote, hourCovers, itemCount, phaseLabel, phases, pillars, SOURCE_INDEX } from "./data.js";
import { applyLocale, getLang, introSteps, t, themeFromMinutes } from "./i18n.js";

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
  let lastFocus = null;

  function buildFilters() {
    $("phase-buttons").innerHTML = phases.map((phase) => {
      const on = phase.id === state.phase;
      return `<button type="button" class="btn ${on ? "on" : ""}" data-phase="${phase.id}" aria-pressed="${on}">${esc(phase.label)}<span class="dim">・${esc(phase.years)}</span></button>`;
    }).join("");
    const allOn = state.pillars.size === 0;
    $("pillar-buttons").innerHTML = `<button type="button" class="btn ${allOn ? "on" : ""}" data-pillar="all" aria-pressed="${allOn}">${esc(t("allPillars"))}</button>` + pillars.map((pillar) => {
      const on = state.pillars.has(pillar.id);
      return `<button type="button" class="btn ${on ? "on" : ""}" data-pillar="${pillar.id}" aria-pressed="${on}" style="--c:${pillar.color}"><b>${esc(pillar.mark)}</b>${esc(pillar.name)}</button>`;
    }).join("");
  }

  function langName(code) {
    return t(code === "en" ? "langEn" : code === "ja" ? "langJa" : "langZh");
  }

  function paintLangButton() {
    const pop = $("lang-pop");
    const button = $("lang-btn");
    button.textContent = `${langName(getLang())} ▾`;
    button.setAttribute("aria-label", t("langLabel"));
    button.setAttribute("aria-expanded", String(!pop.hidden));
    pop.innerHTML = [["zh", "langZh"], ["en", "langEn"], ["ja", "langJa"]].map(([id, key]) => {
      const on = id === getLang();
      return `<button type="button" class="btn ${on ? "on" : ""}" data-lang="${id}" aria-pressed="${on}">${esc(t(key))}</button>`;
    }).join("");
  }

  function selectedIslandId() {
    if (state.selected?.type === "item") return state.selected.islandId;
    if (state.selected?.type === "island") return state.selected.id;
    return null;
  }

  function paintRail() {
    const picked = selectedIslandId();
    $("rail").innerHTML = ordered.map((island) => {
      const on = picked === island.id;
      return `<button type="button" class="btn ${on ? "on" : ""}" data-rail="${island.id}" data-name="${esc(island.name)}" style="--c:${island.accent}" aria-pressed="${on}" aria-label="${esc(island.name)}">${esc(island.no)}</button>`;
    }).join("");
  }

  function syncDrawerButton() {
    const open = ledger.classList.contains("open") || ledger.classList.contains("half");
    $("list").setAttribute("aria-expanded", String(open));
  }

  function paintChrome() {
    document.documentElement.lang = getLang() === "zh" ? "zh-Hant" : getLang();
    document.title = t("title");
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = t("description");
    $("brand-title").textContent = t("brandTitle");
    const badge = $("badge");
    badge.textContent = t("badge");
    badge.title = t("badgeLabel");
    badge.setAttribute("aria-label", t("badgeLabel"));
    $("disclaimer-short").textContent = t("disclaimerShort");
    $("disclaimer-peek").textContent = t("disclaimerShort");
    $("data-as-of").textContent = t("dataAsOf", { date: DATA_AS_OF });
    $("about").textContent = t("aboutTitle");
    $("compass-rose").querySelector("b").textContent = t("compass");
    $("compass-rose").parentElement.title = t("compassTitle");
    $("home").textContent = t("home");
    $("list").textContent = t("list");
    $("help").setAttribute("aria-label", t("help"));
    $("hero-title").innerHTML = esc(t("heroTitle")).replaceAll("\n", "<br>");
    $("hero-lead").innerHTML = esc(t("heroLead")).replaceAll("\n", "<br>");
    search.placeholder = t("search");
    search.setAttribute("aria-label", t("searchLabel"));
    $("tab-islands").textContent = t("tabIslands");
    $("tab-flows").textContent = t("tabFlows", { n: flows.length });
    $("tab-log").textContent = t("tabLog");
    $("tab-phase").textContent = t("tabPhase");
    $("tab-pillar").textContent = t("tabPillar");
    $("source-link").textContent = t("sourceLink");
    $("filter").textContent = t("filter");
    day.setAttribute("aria-label", t("dayLabel"));
    $("pillar-note").textContent = t("pillarNote");
    document.querySelector(".toggles")?.setAttribute("aria-label", t("togglesLabel"));
    document.querySelector(".tools")?.setAttribute("aria-label", t("mapLabel"));
    const veilText = $("veil-text");
    if (veilText) veilText.textContent = t("veil");
    $("c")?.setAttribute("aria-label", t("canvas"));
    paintLangButton();
    for (const button of document.querySelectorAll("[data-toggle]")) button.textContent = t(toggleKey[button.dataset.toggle]);
    buildFilters();
    paintRail();
    stats.textContent = t("stats", { islands: islands.length, items: itemCount(), flows: flows.length });
    syncDrawerButton();
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
    const nextMinute = String(Math.floor(state.minutes));
    if (day.value !== nextMinute) day.value = nextMinute;
    const join = getLang() === "en" ? ". " : "。";
    dayNoteEl.textContent = `${note.title}${join}${note.text}`;
    status.textContent = t("onDuty", { n: awake });
    scene.setMinutes(state.minutes);
    const theme = themeFromMinutes(state.minutes);
    document.documentElement.dataset.theme = theme;
    const themeColor = { morning: "#f6e3c8", noon: "#d5eee8", evening: "#3a1844", night: "#070b12" };
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = themeColor[theme];
    pokeCaption();
  }

  function renderList() {
    const q = state.query.trim().toLowerCase().replace(/\s+/g, "");
    if (state.tab === "flows") {
      const rows = flows.filter((flow) => !q || [flow.title, flow.text, flow.carried, flow._alias, byId.get(flow.a).name, byId.get(flow.b).name].join(" ").toLowerCase().replace(/\s+/g, "").includes(q));
      tree.innerHTML = rows.length ? rows.map((flow) => {
        const on = state.selected?.type === "flow" && state.selected.id === flow.id;
        return `<button type="button" class="btn flow ${on ? "on" : ""}" data-flow="${flow.id}"><b>${esc(flow.title)}</b><span>${esc(byId.get(flow.a).name)} → ${esc(byId.get(flow.b).name)}</span><small>${esc(t("carry", { what: flow.carried }))}</small></button>`;
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
        return `<button type="button" class="btn sub ${on ? "on" : ""}" data-item="${item.id}" data-island="${island.id}"><span>${esc(item.name)}</span><small>${esc(phaseLabel[item.phase])}</small></button>`;
      }).join("");
      return `<section class="island ${open ? "open" : ""}"><button type="button" class="btn head ${open ? "on" : ""}" data-island="${island.id}"><i style="--c:${island.accent}">${esc(island.no)}</i><span><b>${esc(island.name)}</b><small>${esc(island.pin)}</small></span></button><div class="subs">${items}</div></section>`;
    }).join("") : `<p class="empty">${esc(t("emptyIsland"))}</p>`;
  }

  function renderSheet() {
    const selected = state.selected;
    if (!selected) {
      sheet.hidden = true;
      document.body.classList.remove("detail");
      measureSafe();
      return;
    }
    document.body.classList.add("detail");
    sheet.hidden = false;
    if (selected.type === "flow") {
      const flow = selected.flow;
      sheet.innerHTML = `<button type="button" class="btn x" data-close aria-label="${esc(t("close"))}">×</button><p class="eyebrow">${esc(t("flowEyebrow"))}</p><h2>${esc(flow.title)}</h2><p class="route">${esc(byId.get(flow.a).name)} → ${esc(byId.get(flow.b).name)}</p><p>${esc(flow.text)}</p><p class="carried">${esc(t("carried", { what: flow.carried }))}</p>`;
      return;
    }
    const island = byId.get(selected.type === "item" ? selected.islandId : selected.id);
    const related = flows.filter((flow) => flow.a === island.id || flow.b === island.id);
    const items = island.items.map((item) => {
      const on = selected.type === "item" && selected.itemId === item.id;
      return `<button type="button" class="btn detail-item ${on ? "on" : ""}" data-item="${item.id}" data-island="${island.id}"><span><b>${esc(item.name)}</b><small>${esc(phaseLabel[item.phase])}</small></span><em>${esc(item.text)}</em></button>`;
    }).join("");
    const links = related.map((flow) => `<button type="button" class="btn" data-flow="${flow.id}">${esc(flow.title)}</button>`).join("");
    sheet.innerHTML = `<button type="button" class="btn x" data-close aria-label="${esc(t("close"))}">×</button><p class="eyebrow">${esc(island.no)}　${pillarChips(island.pillars)}</p><h2>${esc(island.name)}</h2><p>${esc(island.blurb)}</p><p class="jump"><a href="${esc(island.href)}" target="_blank" rel="noopener noreferrer">${esc(island.hrefLabel)}</a></p><div class="detail-items">${items}</div><h3>${esc(t("outTitle"))}</h3><div class="related">${links}</div><details class="adult"><summary>${esc(t("adultSummary"))}</summary><p class="asof">${esc(t("dataAsOf", { date: DATA_AS_OF }))}</p><p class="source">${esc(island.source)}</p></details>`;
    const current = sheet.querySelector(".detail-item.on");
    current?.scrollIntoView({ block: "nearest" });
    measureSafe();
  }

  function selectIsland(id) {
    if (!byId.has(id)) return;
    state.selected = { type: "island", id };
    scene.focusIslands([id]);
    scene.setHotItem(null);
    writeHash();
    renderList();
    renderSheet();
    paintRail();
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
    paintRail();
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
    paintRail();
  }

  function clearSelection() {
    state.selected = null;
    scene.overview();
    scene.setHotItem(null);
    writeHash();
    renderList();
    renderSheet();
    paintRail();
  }

  function syncToggles() {
    for (const button of document.querySelectorAll("[data-toggle]")) {
      button.setAttribute("aria-pressed", String(state[button.dataset.toggle]));
    }
    const play = $("play");
    play.textContent = state.playing ? "❚❚" : "▶";
    play.setAttribute("aria-label", state.playing ? t("pause") : t("play"));
    play.setAttribute("aria-pressed", String(state.playing));
  }

  function placeCoach(index) {
    const card = modal.querySelector(".modal-card");
    card.classList.remove("step-1", "step-2", "step-3", "step-4", "mode-static");
    document.querySelectorAll(".head.pulse").forEach((el) => el.classList.remove("pulse"));
    const mode = modal.dataset.mode;
    const dots = $("modal-dots");
    if (mode === "help" || mode === "about") {
      card.classList.add("mode-static");
      document.body.classList.remove("intro");
      dots.hidden = true;
      measureSafe();
      return;
    }
    card.classList.add(`step-${index + 1}`);
    document.body.classList.add("intro");
    dots.hidden = false;
    if (index === 1) document.querySelector("#tree .head")?.classList.add("pulse");
    const desktop = window.matchMedia("(min-width: 981px)").matches;
    if (index === 1 && desktop) ledger.classList.add("open");
    else ledger.classList.remove("open", "half");
    syncDrawerButton();
    measureSafe();
  }

  function paintDots(index, total) {
    $("modal-dots").innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i === index ? "on" : ""}"></i>`).join("");
  }

  function openModal() {
    if (modal.hidden) {
      const active = document.activeElement;
      lastFocus = active && active !== document.body ? active : null;
    }
    modal.hidden = false;
    $("modal-next").focus();
  }

  function showIntro(index) {
    introIndex = index;
    modal.dataset.mode = "";
    const steps = introSteps();
    const step = steps[index];
    $("modal-kicker").textContent = `${index + 1} / ${steps.length}`;
    $("modal-title").textContent = step.title;
    $("modal-body").textContent = step.body;
    $("modal-next").textContent = index === steps.length - 1 ? t("start") : t("next");
    $("modal-skip").textContent = t("skip");
    $("modal-skip").hidden = index === steps.length - 1;
    paintDots(index, steps.length);
    placeCoach(index);
    openModal();
    if (step.showFlows) {
      state.flows = true;
      scene.setShowAllFlows(true);
      syncToggles();
    }
  }

  function showAbout() {
    modal.dataset.mode = "about";
    $("modal-kicker").textContent = t("aboutKicker");
    $("modal-title").textContent = t("aboutTitle");
    $("modal-body").innerHTML = `<ul class="about-lines"><li>${esc(t("about1"))}</li><li>${esc(t("about2"))}</li><li>${esc(t("about3"))}</li></ul>`;
    $("modal-next").textContent = t("gotIt");
    $("modal-skip").hidden = true;
    placeCoach(0);
    openModal();
  }

  function closeModal() {
    const wasIntro = document.body.classList.contains("intro");
    modal.hidden = true;
    modal.dataset.mode = "";
    document.body.classList.remove("intro");
    document.querySelectorAll(".head.pulse").forEach((el) => el.classList.remove("pulse"));
    if (wasIntro) {
      ledger.classList.remove("open", "half");
      syncDrawerButton();
    }
    sessionStorage.setItem(INTRO_KEY, "1");
    const back = lastFocus && document.contains(lastFocus) ? lastFocus : $("help");
    back.focus();
    measureSafe();
  }

  function refreshModal() {
    if (modal.hidden) return;
    if (modal.dataset.mode === "help") {
      $("modal-kicker").textContent = t("helpKicker");
      $("modal-title").textContent = t("helpTitle");
      $("modal-body").textContent = t("helpBody");
      $("modal-next").textContent = t("gotIt");
      $("modal-skip").hidden = true;
      placeCoach(0);
      return;
    }
    if (modal.dataset.mode === "about") {
      showAbout();
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
    if (state.log.length > 12) state.log.length = 12;
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

  for (const button of document.querySelectorAll(".tabs button")) {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      if (tab === "phase" || tab === "pillar") {
        showFilter(tab);
        return;
      }
      setPane(tab);
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
    for (const item of $("phase-buttons").querySelectorAll("button")) {
      const on = item === button;
      item.classList.toggle("on", on);
      item.setAttribute("aria-pressed", String(on));
    }
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
      const on = id === "all" ? state.pillars.size === 0 : state.pillars.has(id);
      item.classList.toggle("on", on);
      item.setAttribute("aria-pressed", String(on));
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
    pokeCaption();
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
    if (ledger.classList.contains("open")) {
      ledger.classList.remove("open", "half");
    } else {
      ledger.classList.remove("half");
      ledger.classList.add("open");
      if (window.matchMedia("(pointer: fine)").matches) search.focus();
    }
    syncDrawerButton();
    measureSafe();
  });
  $("rail").addEventListener("click", (event) => {
    const button = event.target.closest("[data-rail]");
    if (button) selectIsland(button.dataset.rail);
  });
  $("filter").addEventListener("click", (event) => {
    event.stopPropagation();
    showFilter("filter");
  });
  $("lang-btn").addEventListener("click", (event) => {
    event.stopPropagation();
    const pop = $("lang-pop");
    pop.hidden = !pop.hidden;
    paintLangButton();
  });
  $("help").addEventListener("click", () => {
    modal.dataset.mode = "help";
    $("modal-kicker").textContent = t("helpKicker");
    $("modal-title").textContent = t("helpTitle");
    $("modal-body").textContent = t("helpBody");
    $("modal-next").textContent = t("gotIt");
    $("modal-skip").hidden = true;
    placeCoach(0);
    openModal();
  });
  $("about").addEventListener("click", showAbout);
  $("modal-skip").addEventListener("click", closeModal);
  modal.querySelector(".modal-card").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.tagName !== "BUTTON") {
      event.preventDefault();
      $("modal-next").click();
      return;
    }
    if (event.key !== "Tab") return;
    const items = [...modal.querySelectorAll(".modal-card button")].filter((el) => !el.hidden);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  $("modal-next").addEventListener("click", () => {
    if (modal.dataset.mode === "help" || modal.dataset.mode === "about") {
      closeModal();
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
      if (!$("lang-pop").hidden) {
        $("lang-pop").hidden = true;
        paintLangButton();
      } else if (!$("filter-pop").hidden) {
        $("filter-pop").hidden = true;
        $("filter").setAttribute("aria-expanded", "false");
        setPane(state.tab);
      } else if (!modal.hidden) closeModal();
      else if (state.selected) clearSelection();
    }
  });
  $("lang-pop").addEventListener("click", (event) => {
    const button = event.target.closest("[data-lang]");
    if (!button || button.dataset.lang === getLang()) return;
    applyLocale(button.dataset.lang);
    $("lang-pop").hidden = true;
    scene.relabel?.();
    paintChrome();
    phaseNote.textContent = phases.find((phase) => phase.id === state.phase).note;
    syncToggles();
    paintClock();
    renderList();
    renderSheet();
    refreshModal();
  });

  function visibleBox(el) {
    if (!el || el.hidden) return null;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return null;
    if (rect.right < 0 || rect.bottom < 0 || rect.left > innerWidth || rect.top > innerHeight) return null;
    return rect;
  }

  let safeFrame = 0;
  function measureSafe() {
    cancelAnimationFrame(safeFrame);
    safeFrame = requestAnimationFrame(() => {
      const width = innerWidth;
      const height = innerHeight;
      let top = 0;
      let bottom = height;
      let left = 0;
      let right = width;
      const nodes = [
        document.querySelector(".brand"),
        document.querySelector("#disclaimer-short"),
        document.querySelector(".rail"),
        ledger,
        sheet,
        document.querySelector(".dial"),
      ];
      for (const el of nodes) {
        const desktopDrawer = el === ledger && ledger.classList.contains("open") && !window.matchMedia("(max-width: 980px)").matches;
        let box = null;
        if (desktopDrawer) {
          const style = getComputedStyle(ledger);
          if (style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0) {
            const wide = 360;
            box = { top: 16, bottom: height - 16, left: width - 16 - wide, right: width - 16, width: wide, height: height - 32 };
          }
        } else box = visibleBox(el);
        if (!box) continue;
        const tall = box.height > height * 0.45;
        const wide = box.width > width * 0.55;
        if (tall && !wide && box.left > width * 0.45) {
          right = Math.min(right, box.left - 8);
          continue;
        }
        if (tall && !wide && box.right < width * 0.55) {
          left = Math.max(left, box.right + 8);
          continue;
        }
        const midY = box.top + box.height / 2;
        if (midY > height * 0.55) {
          bottom = Math.min(bottom, box.top - 8);
          continue;
        }
        if (box.bottom < height * 0.42) top = Math.max(top, box.bottom + 8);
      }
      scene.setSafeRect?.({ top, right, bottom, left });
    });
  }

  function setPane(tab) {
    state.tab = tab;
    ledger.dataset.pane = tab;
    $("filter-pop").hidden = true;
    $("filter").setAttribute("aria-expanded", "false");
    for (const item of document.querySelectorAll(".tabs button")) {
      const on = item.dataset.tab === tab;
      item.classList.toggle("on", on);
      item.setAttribute("aria-selected", String(on));
    }
    renderList();
  }

  function showFilter(from) {
    const pop = $("filter-pop");
    const same = !pop.hidden && pop.dataset.from === from;
    pop.hidden = same;
    pop.dataset.from = same ? "" : from;
    $("filter").setAttribute("aria-expanded", String(!pop.hidden));
    for (const item of document.querySelectorAll(".tabs button")) {
      const kind = item.dataset.tab;
      const on = kind === "phase" || kind === "pillar" ? !pop.hidden && kind === from : kind === state.tab;
      item.classList.toggle("on", on);
      item.setAttribute("aria-selected", String(on));
    }
  }

  let captionTimer = 0;
  let captionText = "";
  function pokeCaption() {
    const cap = $("caption");
    if (!cap) return;
    const text = cap.textContent;
    const changed = text !== captionText;
    captionText = text;
    if (state.playing) {
      cap.classList.remove("idle");
      window.clearTimeout(captionTimer);
      captionTimer = 0;
      return;
    }
    if (!changed && captionTimer) return;
    cap.classList.remove("idle");
    window.clearTimeout(captionTimer);
    captionTimer = window.setTimeout(() => {
      captionTimer = 0;
      if (!state.playing) cap.classList.add("idle");
    }, 4000);
  }

  const titleCard = $("title-card");
  let titleGone = false;
  function dismissTitle() {
    if (titleGone || !titleCard) return;
    titleGone = true;
    titleCard.classList.add("gone");
    window.setTimeout(() => { titleCard.hidden = true; }, 700);
  }
  window.setTimeout(dismissTitle, 3000);
  document.addEventListener("pointerdown", dismissTitle, { once: true });

  let dragY = null;
  let dragId = null;
  ledger.addEventListener("pointerdown", (event) => {
    if (!window.matchMedia("(max-width: 980px)").matches) return;
    if (window.matchMedia("(max-height: 500px) and (orientation: landscape)").matches) return;
    if (event.target.closest("button, input, a, .ledger-scroll")) return;
    dragY = event.clientY;
    dragId = event.pointerId;
  });
  window.addEventListener("pointerup", (event) => {
    if (dragId == null || event.pointerId !== dragId) return;
    const dy = dragY - event.clientY;
    dragId = null;
    const levels = ["peek", "half", "open"];
    const index = levels.indexOf(ledger.classList.contains("open") ? "open" : ledger.classList.contains("half") ? "half" : "peek");
    if (Math.abs(dy) <= 24) {
      ledger.classList.remove("open", "half");
      const next = levels[(index + 1) % levels.length];
      if (next === "half") ledger.classList.add("half");
      if (next === "open") ledger.classList.add("open");
    } else if (dy > 40 && index < levels.length - 1) {
      const next = levels[index + 1];
      ledger.classList.remove("open", "half");
      if (next !== "peek") ledger.classList.add(next);
    } else if (dy < -40 && index > 0) {
      const next = levels[index - 1];
      ledger.classList.remove("open", "half");
      if (next !== "peek") ledger.classList.add(next);
    } else return;
    syncDrawerButton();
    measureSafe();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!$("lang-pop").hidden && !event.target.closest("#lang-pop, #lang-btn")) {
      $("lang-pop").hidden = true;
      paintLangButton();
    }
    if (!$("filter-pop").hidden && !event.target.closest("#filter-pop, #filter, #tab-phase, #tab-pillar")) {
      $("filter-pop").hidden = true;
      $("filter").setAttribute("aria-expanded", "false");
      setPane(state.tab);
    }
  });
  const watcher = new ResizeObserver(() => measureSafe());
  for (const el of [document.querySelector(".brand"), document.querySelector(".dial"), ledger, sheet, document.querySelector(".rail"), document.querySelector("#disclaimer-short")]) {
    if (el) watcher.observe(el);
  }
  window.addEventListener("resize", measureSafe);

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
  measureSafe();

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
