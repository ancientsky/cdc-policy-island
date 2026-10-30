import { DATA_AS_OF, backstageIds, dayNote, dayNotes, hourCovers, itemCount, phaseLabel, phases, pillars, scenarios, SOURCE_INDEX } from "./data.js";
import { applyLocale, getLang, introSteps, t, themeFromMinutes } from "./i18n.js";
import { MISSIONS } from "./missions.js";
import { load as loadPassport, markFlow as stampFlow, markItem as stampItem, markMission, save as savePassport, stampIsland } from "./passport.js";
import { isOn, play as playSfx, toggle as toggleSound } from "./sfx.js";

const SOUND_ON = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 9.5h3.2L12 5.2v13.6l-4.8-4.3H4z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M15.2 9.2a3.6 3.6 0 0 1 0 5.6M17.6 7a6.4 6.4 0 0 1 0 10"/></svg>`;
const SOUND_OFF = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 9.5h3.2L12 5.2v13.6l-4.8-4.3H4z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M16 9.2l5 5.6M21 9.2l-5 5.6"/></svg>`;
const ICON_CHECK = `<svg class="act-ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 8.2 6.4 12 13 4.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_PHONE = `<svg class="act-ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M3.2 2.6h2.1l1 2.4-1.3.9a8.2 8.2 0 0 0 3.7 3.7l.9-1.3 2.4 1v2.1c0 .6-.5 1.1-1.1 1.1C6.4 12.5 3.5 9.6 3.5 3.7c0-.6.5-1.1 1.1-1.1z"/></svg>`;
const SCENARIO_ICON = {
  syringe: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M14 4l6 6M8 10l6 6M5 15l4 4M9 9l6 6"/></svg>`,
  plane: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M3 13.2 21 4.5l-6.2 15.2-2.6-5.2L3 13.2z"/></svg>`,
  child: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="12" cy="7" r="2.4" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M8 20v-3.2a4 4 0 0 1 8 0V20"/></svg>`,
  elder: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="9" cy="7" r="2.3" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M5.5 20v-2.8a3.5 3.5 0 0 1 7 0V20M16 8.5v10M16 8.5c1.6 0 2.5-1.2 2.5-2.6"/></svg>`,
  mosquito: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><ellipse cx="12" cy="13" rx="2.2" ry="4" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M12 9V4M8 12c-3-2-4-5-4-5M16 12c3-2 4-5 4-5M9 16l-3 4M15 16l3 4"/></svg>`,
  mask: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M5 9.5c2.2 1.2 4.4 1.8 7 1.8s4.8-.6 7-1.8v5.2c0 2.4-3.1 4.3-7 4.3s-7-1.9-7-4.3V9.5z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M8 12.2h8"/></svg>`,
  ribbon: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M12 11c-2.2 0-4-1.7-4-3.8S9.2 4 12 8.2C14.8 4 16 5.1 16 7.2S14.2 11 12 11z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M9.2 10.6 7 20M14.8 10.6 17 20"/></svg>`,
  pill: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-28 12 12)" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M12 6.2v11.6"/></svg>`,
};
const SCENARIO_KEY = {
  shot: "scenarioShot",
  travel: "scenarioTravel",
  kid: "scenarioKid",
  elder: "scenarioElder",
  mosq: "scenarioMosq",
  cough: "scenarioCough",
  sex: "scenarioSex",
  drug: "scenarioDrug",
};

const INTRO_KEY = "cdc-policy-island-intro-v1";

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function fmt(minutes) {
  const value = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function toneStyle(swatch) {
  const accent = swatch.accent || swatch.color;
  return `--c:${accent};--c-ink:${swatch.accentInk};--c-on-dark:${swatch.accentOnDark}`;
}

function pillarChips(ids) {
  return ids.map((id) => {
    const pillar = pillars.find((item) => item.id === id);
    return `<i class="chip" style="${toneStyle(pillar)}">${esc(pillar.mark)} ${esc(pillar.name)}</i>`;
  }).join("");
}

export function mount({ scene, islands, flows }) {
  const byId = new Map(islands.map((island) => [island.id, island]));
  const ordered = [...islands].sort((a, b) => a.no.localeCompare(b.no));
  const state = {
    phase: "all",
    pillars: new Set(),
    query: "",
    tab: "life",
    scenario: null,
    selected: null,
    minutes: 8 * 60 + 20,
    playing: false,
    names: true,
    cargo: false,
    flows: false,
    bird: false,
    log: [],
    person: null,
    germ: null,
  };

  const $ = (id) => document.getElementById(id);
  const stats = $("stats");
  const tree = $("tree");
  const sheet = $("sheet");
  const germ = document.createElement("aside");
  germ.id = "germ";
  germ.className = "germ";
  germ.hidden = true;
  document.querySelector(".hud").append(germ);
  const GAME_KEY = "cdc-island-game-v1";
  const toolKey = { clean: "toolClean", check: "toolCheck", shield: "toolShield", wash: "toolWash", finish: "toolFinish" };
  const germSuffix = { dengue: "Dengue", border: "Border", flu: "Flu", entero: "Entero", tb: "Tb" };
  function readGame() {
    try {
      const raw = JSON.parse(localStorage.getItem(GAME_KEY) || "");
      if (!raw || raw.v !== 1 || typeof raw.repelled !== "object" || raw.repelled === null) throw new Error("bad");
      return { v: 1, repelled: { ...raw.repelled }, total: Number(raw.total) || 0 };
    } catch {
      return { v: 1, repelled: {}, total: 0 };
    }
  }
  function writeGame(next) {
    try { localStorage.setItem(GAME_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  }
  let game = readGame();
  const counter = document.createElement("p");
  counter.id = "repel-count";
  counter.className = "repel-count";
  counter.innerHTML = "<span></span>";
  const toast = document.createElement("div");
  toast.id = "repel-toast";
  toast.className = "repel-toast";
  toast.hidden = true;
  document.querySelector(".hud").append(counter, toast);
  let toastTimer = 0;
  let toastInfo = null;
  function paintScore() {
    const chip = counter.querySelector("span");
    if (chip) chip.textContent = t("repelCount", { n: game.total });
  }
  function showToast(info) {
    toastInfo = info;
    const island = byId.get(info.islandId);
    const suffix = germSuffix[info.islandId];
    const action = t(toolKey[info.tool] || "toolClean");
    toast.innerHTML = `<b>${esc(t("repelToast", { action, name: island?.pin || "" }))}</b><span>${esc(suffix ? t(`germDo${suffix}`) : "")}</span>`;
    toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
      toastTimer = 0;
    }, 2400);
  }
  const clock = $("clock");
  const day = $("day");
  const dayNoteEl = $("day-note");
  const phaseNote = $("phase-note");
  const status = $("status");
  const compass = $("compass-rose");
  const search = $("search");
  const modal = $("modal");
  const ledger = $("ledger");

  const toggleKey = { names: "toggleNames", flows: "toggleFlows", bird: "toggleBird" };
  let chapterHold = 0;
  let chapterShown = null;
  let chapterTimer = 0;
  let introIndex = 0;
  let lastFocus = null;
  const quiet = new URLSearchParams(location.search).has("quiet");
  let book = loadPassport();
  let stampFreshId = null;
  let stampTimer = 0;
  let flipping = false;
  let mileTimer = 0;
  let finaleTimer = 0;
  const hud = document.querySelector(".hud");
  const passportHud = document.createElement("div");
  passportHud.className = "passport-hud";
  passportHud.innerHTML = `<b class="passport-count" id="passport-count"></b><span class="passport-bar" id="passport-bar"></span>`;
  hud.append(passportHud);
  const guide = document.createElement("section");
  guide.id = "guide";
  guide.className = "guide";
  guide.hidden = true;
  guide.innerHTML = `<div class="guide-face" id="guide-face"></div><div class="guide-copy"><b class="guide-title" id="guide-title"></b><p class="guide-say" id="guide-say"></p></div><button type="button" class="btn btn--solid" id="guide-go"></button>`;
  const mission = document.createElement("section");
  mission.id = "mission";
  mission.className = "mission";
  mission.hidden = true;
  mission.setAttribute("aria-live", "polite");
  mission.innerHTML = `<div class="mission-rotator"><div class="mission-face mission-front"><b class="mission-kicker"></b><p class="mission-text"></p></div><div class="mission-face mission-back"><b class="mission-done"></b><p class="mission-next"></p></div></div>`;
  const mile = document.createElement("p");
  mile.id = "mile";
  mile.className = "mile";
  mile.hidden = true;
  hud.append(guide, mission, mile);
  guide.querySelector("#guide-go").addEventListener("click", () => {
    book.welcome = Date.now();
    savePassport(book);
    sessionStorage.setItem(INTRO_KEY, "1");
    guide.hidden = true;
    paintMission();
    paintPins();
    advanceMissions();
    selectIsland("border");
  });

  function placePassport() {
    const narrow = window.matchMedia("(max-width: 980px)").matches;
    const head = document.querySelector(".ledger-head");
    if (narrow && head) head.prepend(passportHud);
    else hud.insertBefore(passportHud, hud.querySelector(".disclaimer-short") || hud.children[1] || null);
  }

  function paintPassport(pop) {
    const view = {
      islands: Object.keys(book.islands).length,
      items: Object.keys(book.items).length,
      flows: Object.keys(book.flows).length,
    };
    const count = passportHud.querySelector(".passport-count");
    count.textContent = t("passportCount", { n: view.islands });
    if (pop) {
      count.classList.remove("pop");
      void count.offsetWidth;
      count.classList.add("pop");
    }
    passportHud.querySelector(".passport-bar").innerHTML = ordered.map((island) => (
      book.islands[island.id] ? `<i style="background:${island.accent}"></i>` : "<i></i>"
    )).join("");
    stats.textContent = t("passportStats", {
      items: view.items,
      itemTotal: itemCount(),
      flows: view.flows,
      flowTotal: flows.length,
    });
  }

  function paintPins() {
    const current = MISSIONS.find((row) => !book.missions[row.id]);
    const ping = Boolean(book.welcome) && current?.id === "m1";
    for (const el of document.querySelectorAll(".pin")) {
      el.classList.toggle("stamped", Boolean(book.islands[el.dataset.island]));
      el.classList.toggle("ping", ping && el.dataset.island === "watch");
    }
  }

  function paintGuideCopy() {
    guide.querySelector("#guide-face").textContent = t("guideMark");
    guide.querySelector("#guide-title").textContent = t("guideTitle");
    guide.querySelector("#guide-say").textContent = t("guideHello");
    guide.querySelector("#guide-go").textContent = t("guideGo");
    const capFace = $("caption-face");
    if (capFace) capFace.textContent = t("guideMark");
    if (!mile.hidden && mile.dataset.key) {
      mile.innerHTML = `<i class="caption-face">${esc(t("guideMark"))}</i><span>${esc(t(mile.dataset.key))}</span>`;
    }
  }

  function showGuide() {
    guide.hidden = false;
    mission.hidden = true;
    paintGuideCopy();
    const titleCard = document.querySelector("#title-card");
    if (titleCard) {
      titleCard.classList.add("gone");
      titleCard.hidden = true;
    }
  }

  function paintMission() {
    const current = MISSIONS.find((row) => !book.missions[row.id]);
    const show = Boolean(book.welcome) && Boolean(current);
    mission.hidden = !show;
    mission.dataset.id = current ? current.id : "";
    if (!current) return;
    mission.querySelector(".mission-kicker").textContent = t("missionKicker");
    mission.querySelector(".mission-text").textContent = t(current.key);
  }

  function noteMosquito(value) {
    const q = String(value || "").toLowerCase();
    if (q.includes("蚊子") || q.includes("mosquito") || q.includes("蚊")) state.mosquito = true;
  }

  function showMile(key) {
    mile.dataset.key = key;
    mile.hidden = false;
    mile.innerHTML = `<i class="caption-face">${esc(t("guideMark"))}</i><span>${esc(t(key))}</span>`;
    window.clearTimeout(mileTimer);
    mileTimer = window.setTimeout(() => { mile.hidden = true; }, 2400);
  }

  function playStamp() {
    document.dispatchEvent(new CustomEvent("cdc-cue", { detail: "stamp" }));
    playSfx("stamp");
  }

  function cancelStamp() {
    window.clearTimeout(stampTimer);
    stampTimer = 0;
  }

  function ribbonList() {
    return [...ordered].sort((a, b) => a.row - b.row || a.no.localeCompare(b.no)).map((island) => ({
      id: island.id,
      accent: island.accent,
      row: island.row,
    }));
  }

  function beginFinale() {
    cancelStamp();
    state.selected = null;
    scene.setHotItem?.(null);
    writeHash();
    renderList();
    renderSheet();
    paintRail();
    scene.celebrate(ribbonList(), showGrad);
  }

  function showGrad() {
    mission.hidden = true;
    modal.dataset.mode = "grad";
    $("modal-kicker").textContent = t("guideName");
    $("modal-title").textContent = t("gradTitle");
    const seals = ordered.map((island) => `<i class="seal" style="${toneStyle(island)}">${esc(island.pin)}</i>`).join("");
    $("modal-body").innerHTML = `<div class="sheet-say"><div class="guide-face">${esc(t("guideMark"))}</div><p class="guide-say">${esc(t("gradBody"))}</p></div><div class="seals">${seals}</div><p>${esc(t("gradRepel", { n: game.total }))}</p>`;
    $("modal-next").textContent = t("gradAgain");
    $("modal-skip").hidden = false;
    $("modal-skip").textContent = t("home");
    $("modal-dots").hidden = true;
    placeCoach(0);
    openModal();
  }

  function applyStamp(id) {
    const fresh = stampIsland(book, id);
    if (!fresh) return false;
    stampFreshId = id;
    paintPassport(true);
    paintPins();
    playStamp();
    const seen = Object.keys(book.islands).length;
    if (seen === 1 || seen === 7) showMile(seen === 1 ? "mile1" : "mile7");
    if (seen === 14 && !book.done) {
      book.done = true;
      savePassport(book);
      window.clearTimeout(finaleTimer);
      finaleTimer = window.setTimeout(beginFinale, 420);
    }
    return true;
  }

  function armStamp(id) {
    cancelStamp();
    stampTimer = window.setTimeout(() => {
      stampTimer = 0;
      if (selectedIslandId() !== id) return;
      if (applyStamp(id)) renderSheet();
      advanceMissions();
    }, 1500);
  }

  function missionUi() {
    return { minutes: state.minutes, mosquito: Boolean(state.mosquito) };
  }

  function advanceMissions() {
    if (flipping || !book.welcome) return;
    const current = MISSIONS.find((row) => !book.missions[row.id]);
    if (!current || !current.check(book, game, missionUi())) return;
    if (!markMission(book, current.id)) return;
    playSfx("mission");
    paintPins();
    const next = MISSIONS.find((row) => !book.missions[row.id]);
    flipping = true;
    mission.hidden = false;
    mission.querySelector(".mission-done").textContent = t("missionDone");
    mission.querySelector(".mission-next").textContent = next ? t(next.key) : t("gradTitle");
    mission.classList.remove("instant");
    mission.classList.add("flip");
    window.setTimeout(() => {
      mission.classList.add("instant");
      mission.classList.remove("flip");
      paintMission();
      paintPins();
      flipping = false;
      advanceMissions();
    }, 1320);
  }

  function buildFilters() {
    $("phase-buttons").innerHTML = phases.map((phase) => {
      const on = phase.id === state.phase;
      return `<button type="button" class="btn ${on ? "on" : ""}" data-phase="${phase.id}" aria-pressed="${on}">${esc(phase.label)}</button>`;
    }).join("");
    const allOn = state.pillars.size === 0;
    $("pillar-buttons").innerHTML = `<button type="button" class="btn ${allOn ? "on" : ""}" data-pillar="all" aria-pressed="${allOn}">${esc(t("allPillars"))}</button>` + pillars.map((pillar) => {
      const on = state.pillars.has(pillar.id);
      return `<button type="button" class="btn ${on ? "on" : ""}" data-pillar="${pillar.id}" aria-pressed="${on}" style="${toneStyle(pillar)}"><b>${esc(pillar.mark)}</b>${esc(pillar.name)}</button>`;
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
      return `<button type="button" class="btn ${on ? "on" : ""}" data-rail="${island.id}" data-name="${esc(island.nick)}" style="${toneStyle(island)}" aria-pressed="${on}" aria-label="${esc(island.nick)}">${esc(island.no)}</button>`;
    }).join("");
  }

  function syncDrawerButton() {
    const open = ledger.classList.contains("open") || ledger.classList.contains("half");
    const button = $("list");
    button.setAttribute("aria-controls", "ledger");
    button.setAttribute("aria-expanded", String(open));
  }

  function paintSound() {
    const button = $("sound");
    if (!button) return;
    const on = isOn();
    button.setAttribute("aria-pressed", String(on));
    button.setAttribute("aria-label", t("sound"));
    button.innerHTML = on ? SOUND_ON : SOUND_OFF;
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
    paintSound();
    $("hero-title").innerHTML = esc(t("heroTitle")).replaceAll("\n", "<br>");
    $("hero-lead").innerHTML = esc(t("heroLead")).replaceAll("\n", "<br>");
    search.placeholder = t("search");
    search.setAttribute("aria-label", t("searchLabel"));
    $("tab-life").textContent = t("tabLife");
    $("tab-islands").textContent = t("tabAll");
    $("tab-flows").textContent = t("tabFlows", { n: flows.length });
    $("tab-log").textContent = t("tabLog");
    $("tab-phase").textContent = t("tabPhase");
    $("tab-pillar").textContent = t("tabPillar");
    $("source-link").textContent = t("sourceLink");
    $("filter").textContent = t("filter");
    day.setAttribute("aria-label", t("dayLabel"));
    $("pillar-note").textContent = t("pillarNote");
    const phaseKicker = $("phase-kicker");
    if (phaseKicker) phaseKicker.textContent = t("panelPhase");
    const pillarKicker = $("pillar-kicker");
    if (pillarKicker) pillarKicker.textContent = t("panelPillar");
    $("rail")?.setAttribute("aria-label", t("tabIslands"));
    $("ledger")?.setAttribute("aria-label", t("ledgerTitle"));
    document.querySelector(".tools")?.setAttribute("aria-label", t("mapLabel"));
    $("view-btn")?.setAttribute("aria-label", t("viewMenu"));
    const veilText = $("veil-text");
    if (veilText) veilText.textContent = t("veil");
    paintScore();
    if (toastInfo && !toast.hidden) showToast(toastInfo);
    $("c")?.setAttribute("role", "img");
    $("c")?.setAttribute("aria-label", t("canvas"));
    document.querySelector(".tabs")?.setAttribute("aria-label", t("tabsLabel"));
    paintLangButton();
    for (const button of document.querySelectorAll("[data-toggle]")) {
      const key = toggleKey[button.dataset.toggle];
      if (!key) continue;
      if (button.id === "bird") button.setAttribute("aria-label", t(key));
      else button.textContent = t(key);
    }
    paintTicks();
    paintChapter();
    buildFilters();
    paintRail();
    paintPassport(false);
    paintGuideCopy();
    paintMission();
    syncDrawerButton();
    markTabs(activeTabMark());
    armFactLine();
  }

  const factMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  let factIndex = 0;
  let factTimer = 0;
  function paintFactLine() {
    const button = $("fact-tick");
    const island = ordered[factIndex];
    if (!button || !island) return;
    button.dataset.island = island.id;
    button.querySelector("b").textContent = t("didYouKnow");
    button.querySelector("span").textContent = island.fact;
  }
  function armFactLine() {
    if (factTimer) clearInterval(factTimer);
    factTimer = 0;
    if (!ordered.length) return;
    if (factMedia.matches) factIndex = 0;
    if (factIndex >= ordered.length) factIndex = 0;
    paintFactLine();
    if (factMedia.matches || ordered.length < 2) return;
    factTimer = setInterval(() => {
      let next = factIndex;
      while (next === factIndex) next = Math.floor(Math.random() * ordered.length);
      factIndex = next;
      paintFactLine();
    }, 8000);
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
    const titled = /[。！？!?]$/.test(note.title);
    const gap = titled ? (getLang() === "en" ? " " : "") : (getLang() === "en" ? ". " : "。");
    const capFace = $("caption-face");
    if (capFace) capFace.textContent = t("guideMark");
    dayNoteEl.textContent = `${t("chapterBy")}${note.title}${gap}${note.text}`;
    status.textContent = t("onDuty", { n: awake });
    scene.setMinutes(state.minutes);
    paintTicks();
    const theme = themeFromMinutes(state.minutes);
    document.documentElement.dataset.theme = theme;
    const themeColor = { morning: "#fbe3c8", noon: "#dff3f6", evening: "#3b2a5c", night: "#0b1426" };
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = themeColor[theme];
    pokeCaption();
    advanceMissions();
  }

  let lastTrigger = null;

  function rememberTrigger(node) {
    const button = node?.closest?.("button");
    if (!button) return;
    if (tree.contains(button)) {
      if (button.dataset.item) lastTrigger = { root: "tree", selector: `[data-item="${CSS.escape(button.dataset.item)}"]` };
      else if (button.dataset.flow) lastTrigger = { root: "tree", selector: `[data-flow="${CSS.escape(button.dataset.flow)}"]` };
      else if (button.classList.contains("head") && button.dataset.island) lastTrigger = { root: "tree", selector: `.head[data-island="${CSS.escape(button.dataset.island)}"]` };
      else if (button.dataset.scenario) lastTrigger = { root: "tree", selector: `[data-scenario="${CSS.escape(button.dataset.scenario)}"]` };
      return;
    }
    if (button.dataset.rail && $("rail")?.contains(button)) {
      lastTrigger = { root: "rail", selector: `[data-rail="${CSS.escape(button.dataset.rail)}"]` };
    }
  }

  function listFocusKey() {
    const current = document.activeElement;
    if (!current || !tree.contains(current)) return null;
    if (current.dataset.item) return `[data-item="${CSS.escape(current.dataset.item)}"]`;
    if (current.dataset.flow) return `[data-flow="${CSS.escape(current.dataset.flow)}"]`;
    if (current.classList.contains("head") && current.dataset.island) return `.head[data-island="${CSS.escape(current.dataset.island)}"]`;
    if (current.dataset.scenario) return `[data-scenario="${CSS.escape(current.dataset.scenario)}"]`;
    return null;
  }

  function restoreListFocus(key) {
    if (!key) return;
    tree.querySelector(key)?.focus({ preventScroll: true });
  }

  function sayStatus(text) {
    const el = $("sr-status");
    if (!el) return;
    const next = text || "";
    if (el.textContent === next) {
      el.textContent = "";
      requestAnimationFrame(() => { el.textContent = next; });
      return;
    }
    el.textContent = next;
  }

  function selectedLabel() {
    const selected = state.selected;
    if (!selected) return "";
    if (selected.type === "flow") return selected.flow.kidTitle || selected.flow.title;
    const id = selected.type === "item" ? selected.islandId : selected.id;
    return byId.get(id)?.nick || "";
  }

  function announceSelection() {
    const name = selectedLabel();
    if (name) sayStatus(t("selectedName", { name }));
  }

  function announceSearch() {
    const query = state.query.trim();
    if (!query || state.tab === "log") {
      sayStatus("");
      return;
    }
    if (state.tab === "flows") {
      sayStatus(t("foundFlows", { n: tree.querySelectorAll("[data-flow]").length }));
      return;
    }
    sayStatus(t("foundIslands", { n: tree.querySelectorAll(".island").length }));
  }

  function focusSheetIfNeeded(event) {
    const keyboard = !!event && event.detail === 0;
    const covered = window.matchMedia("(max-width: 980px)").matches;
    if (!keyboard && !covered) return;
    const title = sheet.querySelector("h2");
    if (!title) return;
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }

  function renderList() {
    const focusKey = listFocusKey();
    const q = state.query.trim().toLowerCase().replace(/\s+/g, "");
    if (state.tab === "flows") {
      const rows = flows.filter((flow) => !q || [flow.title, flow.kidTitle, flow.text, flow.kid, flow.carried, flow._alias, byId.get(flow.a).name, byId.get(flow.b).name, byId.get(flow.a).nick, byId.get(flow.b).nick].join(" ").toLowerCase().replace(/\s+/g, "").includes(q));
      tree.innerHTML = rows.length ? rows.map((flow) => {
        const on = state.selected?.type === "flow" && state.selected.id === flow.id;
        return `<button type="button" class="btn flow ${on ? "on" : ""}" data-flow="${flow.id}"><b>${esc(flow.kidTitle || flow.title)}</b><span>${esc(byId.get(flow.a).nick)} → ${esc(byId.get(flow.b).nick)}</span><small>${esc(t("carry", { what: flow.carried }))}</small></button>`;
      }).join("") : `<p class="empty">${esc(t("emptyFlow"))}</p>`;
      restoreListFocus(focusKey);
      return;
    }
    if (state.tab === "log") {
      tree.innerHTML = state.log.length
        ? `<ol class="loglist">${state.log.map((row) => `<li><time>${esc(row.time)}</time>${esc(row.text)}</li>`).join("")}</ol>`
        : `<p class="empty">${esc(t("emptyLog"))}</p>`;
      restoreListFocus(focusKey);
      return;
    }
    if (state.tab === "life" && !q) {
      const buttons = scenarios.map((scenario) => {
        const on = state.scenario === scenario.id;
        return `<button type="button" class="scenario${on ? " on" : ""}" data-scenario="${scenario.id}">${SCENARIO_ICON[scenario.icon] ?? ""}<span>${esc(t(SCENARIO_KEY[scenario.id]))}</span></button>`;
      }).join("");
      const behind = backstageIds.map((id) => islandCard(byId.get(id))).join("");
      tree.innerHTML = `<p class="scenario-lead">${esc(t("scenarioLead"))}</p><div class="scenarios">${buttons}</div><h3 class="backstage-title">${esc(t("backstage"))}</h3>${behind}`;
      restoreListFocus(focusKey);
      return;
    }
    const cards = ordered.filter((island) => {
      if (!q) return true;
      const blob = [island.name, island.nick, island.pin, island.blurb, island.blurbKid, island.source, ...island.items.flatMap((item) => [item.name, item.detail, item.kid, ...(item.keywords ?? [])])].join(" ").toLowerCase().replace(/\s+/g, "");
      return blob.includes(q);
    });
    tree.innerHTML = cards.length ? cards.map((island) => islandCard(island)).join("") : emptySearch();
    restoreListFocus(focusKey);
  }

  function islandCard(island) {
    const open = state.selected && ((state.selected.type === "island" && state.selected.id === island.id) || (state.selected.type === "item" && state.selected.islandId === island.id) || (state.selected.type === "flow" && (state.selected.flow.a === island.id || state.selected.flow.b === island.id)));
    const items = island.items.map((item) => {
      const on = state.selected?.type === "item" && state.selected.itemId === item.id;
      return `<button type="button" class="btn sub ${on ? "on" : ""}" data-item="${item.id}" data-island="${island.id}"><span>${esc(item.name)}</span><small>${esc(phaseLabel[item.phase])}</small></button>`;
    }).join("");
    return `<section class="island ${open ? "open" : ""}"><button type="button" class="btn head ${open ? "on" : ""}" data-island="${island.id}" aria-expanded="${open ? "true" : "false"}"><i style="${toneStyle(island)}">${esc(island.no)}</i><span><b>${esc(island.nick)}</b><small class="official">${esc(island.name)}</small></span></button><div class="subs">${items}</div></section>`;
  }

  function emptySearch() {
    const tries = ["mosq", "travel", "shot"].map((id) => {
      const scenario = scenarios.find((item) => item.id === id);
      return `<button type="button" class="scenario" data-scenario="${id}">${SCENARIO_ICON[scenario.icon] ?? ""}<span>${esc(t(SCENARIO_KEY[id]))}</span></button>`;
    }).join("");
    return `<div class="empty-search"><p class="empty">${esc(t("emptyTry"))}</p><div class="scenarios">${tries}</div></div>`;
  }

  let personTimer = 0;

  function personStatus(info) {
    if (info.ambient) return t("personStay", { name: info.placeName });
    if (info.handing) return t("personHandoff", { name: info.placeName });
    return t("personGoing", { name: info.placeName });
  }

  function dismissPerson() {
    state.person = null;
    if (personTimer) {
      clearInterval(personTimer);
      personTimer = 0;
    }
    scene.clearPersonFocus?.();
  }

  function closePerson() {
    dismissPerson();
    renderSheet();
  }

  function closeGerm() {
    state.germ = null;
    germ.hidden = true;
    germ.innerHTML = "";
  }

  function renderGerm() {
    const info = state.germ;
    if (!info) return;
    const live = scene.threatInfo(info.index) || info;
    const suffix = { dengue: "Dengue", border: "Border", flu: "Flu", entero: "Entero", tb: "Tb" }[live.islandId];
    if (!suffix) return;
    germ.hidden = false;
    germ.innerHTML = `<button type="button" class="btn x" data-germ-close aria-label="${esc(t("close"))}">×</button><p class="k">${esc(t("germWhatLabel"))}</p><p>${esc(t(`germWhat${suffix}`))}</p><p class="k">${esc(t("germHowLabel"))}</p><p>${esc(t(`germHow${suffix}`))}</p><p class="k">${esc(t("germDoLabel"))}</p><p class="do">${esc(t(`germDo${suffix}`))}</p>`;
  }

  function openGerm(index) {
    const info = scene.threatInfo(index);
    if (!info) return;
    dismissPerson();
    state.germ = info;
    renderGerm();
  }

  function paintPersonLive() {
    if (!state.person) return;
    const info = scene.personInfo(state.person.index);
    if (!info) return;
    state.person = info;
    const bar = sheet.querySelector(".person-bar span");
    const pct = sheet.querySelector(".person-pct");
    const status = sheet.querySelector(".person-status span");
    const n = Math.round(info.progress * 100);
    if (bar) bar.style.width = `${n}%`;
    if (pct) pct.textContent = t("personProgress", { n });
    if (status) status.textContent = personStatus(info);
  }

  function renderPerson(info) {
    document.body.classList.add("detail");
    sheet.hidden = false;
    const carried = info.carried || t(info.carryKey || "carrySit");
    const n = Math.round(info.progress * 100);
    const photo = scene.personPortrait(info.index) || "";
    sheet.innerHTML = `<button type="button" class="btn x" data-close aria-label="${esc(t("close"))}">×</button><img class="person-photo" width="160" height="160" alt="${esc(t(info.roleKey))}" ${photo ? `src="${photo}"` : ""}><p class="eyebrow">${esc(info.flowTitle || "")}</p><h2>${esc(t(info.roleKey))}</h2><p class="person-line">${esc(t(info.lineKey))}</p><div class="person-cells"><div style="--c:${esc(info.toAccent)}">${esc(t("personSending", { what: carried }))}</div><div style="--c:${esc(info.fromAccent)}">${esc(t("personFrom", { name: info.fromName }))}</div><div style="--c:${esc(info.toAccent)}">${esc(t("personTo", { name: info.toName }))}</div></div><p class="person-status"><i class="breathe"></i><span>${esc(personStatus(info))}</span></p><div class="person-bar"><span style="width:${n}%"></span></div><p class="person-pct">${esc(t("personProgress", { n }))}</p>`;
    measureSafe();
  }

  function openPerson(index) {
    const info = scene.personInfo(index);
    if (!info) return;
    closeGerm();
    state.person = info;
    scene.focusPerson(index);
    if (info.flowId) scene.markFlow(info.flowId);
    renderPerson(info);
    if (personTimer) clearInterval(personTimer);
    personTimer = setInterval(paintPersonLive, 250);
  }

  function renderSheet() {
    if (state.person) {
      const info = scene.personInfo(state.person.index) || state.person;
      state.person = info;
      renderPerson(info);
      return;
    }
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
      sheet.innerHTML = `<button type="button" class="btn x" data-close aria-label="${esc(t("close"))}">×</button><p class="eyebrow">${esc(t("flowEyebrow"))}</p><h2>${esc(flow.kidTitle || flow.title)}</h2><p class="route">${esc(byId.get(flow.a).nick)} → ${esc(byId.get(flow.b).nick)}</p><p>${esc(flow.kid || flow.text)}</p><p class="carried">${esc(t("carried", { what: flow.carried }))}</p><details class="adult"><summary>${esc(t("adultSummary"))}</summary><p><b>${esc(flow.title)}</b></p><p>${esc(flow.text)}</p></details>`;
      return;
    }
    const island = byId.get(selected.type === "item" ? selected.islandId : selected.id);
    const related = flows.filter((flow) => flow.a === island.id || flow.b === island.id);
    const items = island.items.map((item) => {
      const on = selected.type === "item" && selected.itemId === item.id;
      return `<button type="button" class="btn detail-item ${on ? "on" : ""}" data-item="${item.id}" data-island="${island.id}"><span><b>${esc(item.name)}</b></span><em>${esc(item.kid)}</em></button>`;
    }).join("");
    const links = related.map((flow) => `<button type="button" class="btn" data-flow="${flow.id}">${esc(flow.kidTitle || flow.title)}</button>`).join("");
    const actions = (island.actions ?? []).map((action) => {
      const icon = action.icon === "phone" ? ICON_PHONE : ICON_CHECK;
      const body = `<span><b>${esc(action.label)}</b>${action.detail ? `<small>${esc(action.detail)}</small>` : ""}</span>`;
      const inner = `${icon}${body}`;
      return action.href
        ? `<li><a href="${esc(action.href)}">${inner}</a></li>`
        : `<li><div class="act">${inner}</div></li>`;
    }).join("");
    const adultItems = island.items.map((item) => `<p><b>${esc(item.name)}</b><small>${esc(phaseLabel[item.phase])}</small><br>${esc(item.detail)}</p>`).join("");
    const fresh = stampFreshId === island.id;
    const seal = book.islands[island.id]
      ? `<i class="stamp${fresh ? " fresh" : ""}" style="${toneStyle(island)}">${esc(t("stampLabel"))}</i>`
      : "";
    const say = island.say
      ? `<div class="sheet-say"><div class="guide-face">${esc(t("guideMark"))}</div><p class="guide-say">${esc(island.say)}</p></div>`
      : "";
    sheet.style.setProperty("--c", island.accent);
    const body = `<button type="button" class="btn x" data-close aria-label="${esc(t("close"))}">×</button>${seal}<p class="eyebrow">${esc(island.no)}　${pillarChips(island.pillars)}</p><h2>${esc(island.nick)}</h2><p class="official">${esc(island.name)}</p>${say}<section class="todo"><h3>${esc(t("youCan"))}</h3><ol>${actions}</ol></section><aside class="fact"><h3>${esc(t("didYouKnow"))}</h3><p>${esc(island.fact)}</p></aside><p class="kid-blurb">${esc(island.blurbKid)}</p><div class="detail-items">${items}</div><h3 class="out-title">${esc(t("outTitle"))}</h3><div class="related">${links}</div><details class="adult"><summary>${esc(t("adultSummary"))}</summary><p class="asof">${esc(t("dataAsOf", { date: DATA_AS_OF }))}</p><p>${esc(island.blurb)}</p><p class="source">${esc(island.source)}</p><div class="adult-items">${adultItems}</div><p class="jump"><a href="${esc(island.href)}" target="_blank" rel="noopener noreferrer">${esc(island.hrefLabel)}</a></p></details>`;
    sheet.innerHTML = `<div class="sheet-scroll">${body}</div><a class="hotline" href="tel:1922">${ICON_PHONE}<span>${esc(t("hotline"))}</span></a>`;
    if (fresh) {
      stampFreshId = null;
      sheet.classList.remove("bump");
      void sheet.offsetWidth;
      sheet.classList.add("bump");
    }
    const current = sheet.querySelector(".detail-item.on");
    current?.scrollIntoView({ block: "nearest" });
    measureSafe();
  }

  function selectScenario(id, event) {
    const scenario = scenarios.find((item) => item.id === id);
    if (!scenario) return;
    const first = scenario.islands[0];
    playSfx("select");
    dismissPerson();
    closeGerm();
    state.scenario = id;
    state.selected = { type: "island", id: first };
    scene.focusIslands(scenario.islands);
    scene.setSpotlight(scenario.islands);
    scene.setHotItem(null);
    writeHash();
    renderList();
    renderSheet();
    paintRail();
    armStamp(first);
    advanceMissions();
    focusSheetIfNeeded(event);
    announceSelection();
  }

  function selectIsland(id, event) {
    if (!byId.has(id)) return;
    state.scenario = null;
    playSfx("select");
    dismissPerson();
    closeGerm();
    state.selected = { type: "island", id };
    scene.focusIslands([id]);
    scene.setHotItem(null);
    writeHash();
    renderList();
    renderSheet();
    paintRail();
    armStamp(id);
    advanceMissions();
    focusSheetIfNeeded(event);
    announceSelection();
  }

  function selectItem(islandId, itemId, event) {
    const island = byId.get(islandId);
    if (!island?.items.some((item) => item.id === itemId)) return;
    state.scenario = null;
    playSfx("item");
    dismissPerson();
    closeGerm();
    cancelStamp();
    state.selected = { type: "item", islandId, itemId };
    scene.focusIslands([islandId]);
    scene.setHotItem(itemId);
    writeHash();
    if (stampItem(book, itemId)) paintPassport(false);
    applyStamp(islandId);
    renderList();
    renderSheet();
    paintRail();
    advanceMissions();
    focusSheetIfNeeded(event);
    announceSelection();
  }

  function selectFlow(id, event) {
    const flow = flows.find((item) => item.id === id);
    if (!flow) return;
    state.scenario = null;
    dismissPerson();
    closeGerm();
    cancelStamp();
    state.selected = { type: "flow", id, flow };
    scene.focusIslands([flow.a, flow.b]);
    scene.setHotItem(null);
    writeHash();
    if (stampFlow(book, id)) paintPassport(false);
    renderList();
    renderSheet();
    paintRail();
    advanceMissions();
    focusSheetIfNeeded(event);
    announceSelection();
  }

  function clearSelection() {
    const active = document.activeElement;
    const returnFocus = !active || active === document.body || active === document.documentElement || sheet.contains(active);
    dismissPerson();
    closeGerm();
    cancelStamp();
    state.scenario = null;
    state.selected = null;
    scene.overview();
    scene.setHotItem(null);
    writeHash();
    renderList();
    renderSheet();
    paintRail();
    if (!returnFocus || !lastTrigger) return;
    const root = lastTrigger.root === "rail" ? $("rail") : tree;
    root?.querySelector(lastTrigger.selector)?.focus({ preventScroll: true });
  }

  function paintTicks() {
    const host = $("chapter-ticks");
    if (!host) return;
    if (host.childElementCount !== dayNotes.length) {
      host.innerHTML = dayNotes.map((_note, index) => `<button type="button" class="tick" data-chapter="${index}"></button>`).join("");
    }
    const current = dayNote(state.minutes);
    dayNotes.forEach((note, index) => {
      const button = host.children[index];
      const on = current === note;
      button.style.left = `${(note.from / 24) * 100}%`;
      button.setAttribute("aria-label", note.title);
      button.classList.toggle("on", on);
      button.setAttribute("aria-current", on ? "true" : "false");
    });
  }

  function paintChapter() {
    if (!chapterShown) return;
    $("chapter-face").textContent = t("guideMark");
    $("chapter-title").textContent = chapterShown.title;
    $("chapter-body").textContent = `${t("chapterBy")}${chapterShown.text}`;
  }

  function hideChapter() {
    const card = $("chapter");
    if (!card) return;
    chapterShown = null;
    card.classList.remove("show");
    window.clearTimeout(chapterTimer);
    chapterTimer = window.setTimeout(() => {
      if (!chapterShown) card.hidden = true;
    }, 240);
  }

  function showChapter(note) {
    const card = $("chapter");
    if (!card || !note) return;
    chapterShown = note;
    window.clearTimeout(chapterTimer);
    card.hidden = false;
    paintChapter();
    card.classList.remove("show");
    void card.offsetWidth;
    card.classList.add("show");
    if (note.focus) scene.focusIslands([note.focus]);
  }

  function jumpChapter(index) {
    const note = dayNotes[index];
    if (!note) return;
    state.minutes = note.from * 60;
    chapterHold = 1.8;
    showChapter(note);
    paintClock();
    syncToggles();
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
    card.classList.remove("step-1", "step-2", "step-3", "step-4", "mode-static", "mode-grad");
    document.querySelectorAll(".head.pulse").forEach((el) => el.classList.remove("pulse"));
    const mode = modal.dataset.mode;
    const dots = $("modal-dots");
    if (mode === "help" || mode === "about" || mode === "grad") {
      card.classList.add("mode-static");
      if (mode === "grad") card.classList.add("mode-grad");
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
    $("modal-next").textContent = index === steps.length - 1 ? t("guideGo") : t("next");
    $("modal-skip").textContent = t("skip");
    $("modal-skip").hidden = index === steps.length - 1;
    paintDots(index, steps.length);
    placeCoach(index);
    openModal();
    if (step.showFlows) {
      state.flows = true;
      state.cargo = true;
      scene.setShowAllFlows(true);
      scene.setCargo(true);
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
      $("modal-body").innerHTML = helpHtml();
      $("modal-next").textContent = t("gotIt");
      $("modal-skip").hidden = true;
      placeCoach(0);
      return;
    }
    if (modal.dataset.mode === "grad") {
      showGrad();
      return;
    }
    if (modal.dataset.mode === "about") {
      showAbout();
      return;
    }
    showIntro(introIndex);
  }

  const cardAt = new Map();
  scene.onStrike((info) => {
    if (!info) return;
    const prev = cardAt.get(info.islandId);
    if (prev != null && performance.now() - prev < 20000) return;
    cardAt.set(info.islandId, performance.now());
    openGerm(info.index);
  });
  scene.onRepel((info) => {
    if (!info) return;
    game.repelled[info.islandId] = (Number(game.repelled[info.islandId]) || 0) + 1;
    game.total += 1;
    writeGame(game);
    paintScore();
    advanceMissions();
    counter.classList.remove("pop");
    void counter.offsetWidth;
    counter.classList.add("pop");
    showToast(info);
  });
  scene.onMarkFlow((id) => {
    if (stampFlow(book, id)) {
      paintPassport(false);
      advanceMissions();
    }
  });
  scene.onPick((hit) => {
    if (!hit) {
      clearSelection();
      return;
    }
    if (hit.kind === "person") {
      openPerson(hit.index);
      return;
    }
    if (hit.kind === "item") selectItem(hit.islandId, hit.itemId);
    else selectIsland(hit.islandId);
  });
  scene.onDuty((event) => {
    if (!event) return;
    const island = byId.get(event.islandId);
    const text = t("dutyStart", { nick: island?.nick || "", item: event.item || "" });
    state.log.unshift({ time: fmt(state.minutes), text });
    if (state.log.length > 12) state.log.length = 12;
    if (state.tab === "log") renderList();
  });
  scene.onArrive((event) => {
    if (!event) return;
    if (event.flow?.id && state.selected?.type === "flow" && state.selected.id === event.flow.id) {
      if (stampFlow(book, event.flow.id)) {
        paintPassport(false);
        advanceMissions();
      }
    }
    const text = t("handoff", { from: byId.get(event.from).nick, what: event.carried, to: byId.get(event.to).nick });
    state.log.unshift({ time: fmt(state.minutes), text });
    if (state.log.length > 12) state.log.length = 12;
    if (state.tab === "log") renderList();
  });

  tree.addEventListener("click", (event) => {
    rememberTrigger(event.target);
    const scenario = event.target.closest("[data-scenario]");
    if (scenario) {
      selectScenario(scenario.dataset.scenario, event);
      return;
    }
    const item = event.target.closest("[data-item]");
    if (item) {
      selectItem(item.dataset.island, item.dataset.item, event);
      return;
    }
    const flow = event.target.closest("[data-flow]");
    if (flow) {
      selectFlow(flow.dataset.flow, event);
      return;
    }
    const island = event.target.closest("[data-island]");
    if (island) selectIsland(island.dataset.island, event);
  });
  sheet.addEventListener("click", (event) => {
    if (event.target.closest("[data-close]")) {
      if (state.person) closePerson();
      else clearSelection();
      return;
    }
    const item = event.target.closest("[data-item]");
    if (item) {
      selectItem(item.dataset.island, item.dataset.item, event);
      return;
    }
    const flow = event.target.closest("[data-flow]");
    if (flow) selectFlow(flow.dataset.flow, event);
  });
  germ.addEventListener("click", (event) => {
    if (event.target.closest("[data-germ-close]")) closeGerm();
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
  document.querySelector(".tabs")?.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const current = event.target.closest?.("[role=tab]");
    if (!current || !current.closest(".tabs")) return;
    const tabs = visibleTabs();
    const index = tabs.indexOf(current);
    if (index < 0 || !tabs.length) return;
    event.preventDefault();
    let next = current;
    if (event.key === "Home") next = tabs[0];
    else if (event.key === "End") next = tabs[tabs.length - 1];
    else if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
    else next = tabs[(index - 1 + tabs.length) % tabs.length];
    if (next.dataset.tab === "phase" || next.dataset.tab === "pillar") showFilter(next.dataset.tab, { force: true });
    else setPane(next.dataset.tab);
    next.focus();
  });
  search.addEventListener("input", () => {
    state.query = search.value;
    noteMosquito(search.value);
    scene.setQuery(search.value);
    renderList();
    announceSearch();
    advanceMissions();
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
    chapterHold = 0;
    hideChapter();
    state.minutes = Number(day.value);
    syncToggles();
    paintClock();
  });
  $("chapter-ticks").addEventListener("click", (event) => {
    const button = event.target.closest("[data-chapter]");
    if (!button) return;
    jumpChapter(Number(button.dataset.chapter));
  });
  $("play").addEventListener("click", () => {
    state.playing = !state.playing;
    syncToggles();
    pokeCaption();
  });
  for (const button of document.querySelectorAll("[data-toggle]")) {
    button.addEventListener("click", () => {
      const key = button.dataset.toggle;
      if (!toggleKey[key]) return;
      state[key] = !state[key];
      if (key === "names") scene.setNames(state.names);
      if (key === "flows") {
        state.cargo = state.flows;
        scene.setShowAllFlows(state.flows);
        scene.setCargo(state.flows);
      }
      if (key === "bird") scene.setBird(state.bird);
      syncToggles();
    });
  }
  $("home").addEventListener("click", clearSelection);
  factMedia.addEventListener("change", armFactLine);
  $("fact-tick").addEventListener("click", (event) => {
    const id = $("fact-tick").dataset.island;
    if (id) selectIsland(id, event);
  });
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
    if (button) {
      rememberTrigger(button);
      selectIsland(button.dataset.rail, event);
    }
  });
  $("filter").addEventListener("click", (event) => {
    event.stopPropagation();
    showFilter("filter");
  });
  $("view-btn").addEventListener("click", (event) => {
    event.stopPropagation();
    const menu = $("view-menu");
    menu.hidden = !menu.hidden;
    $("view-btn").setAttribute("aria-expanded", String(!menu.hidden));
  });
  $("lang-btn").addEventListener("click", (event) => {
    event.stopPropagation();
    const pop = $("lang-pop");
    pop.hidden = !pop.hidden;
    paintLangButton();
  });
  function helpHtml() {
    const steps = introSteps().slice(1).map((step) => `<p><b>${esc(step.title)}</b><br>${esc(step.body)}</p>`).join("");
    return `<p>${esc(t("helpBody"))}</p>${steps}`;
  }
  $("sound").addEventListener("click", () => {
    toggleSound();
    paintSound();
  });
  $("help").addEventListener("click", () => {
    modal.dataset.mode = "help";
    $("modal-kicker").textContent = t("helpKicker");
    $("modal-title").textContent = t("helpTitle");
    $("modal-body").innerHTML = helpHtml();
    $("modal-next").textContent = t("gotIt");
    $("modal-skip").hidden = true;
    placeCoach(0);
    openModal();
  });
  $("about").addEventListener("click", showAbout);
  $("modal-skip").addEventListener("click", () => {
    if (modal.dataset.mode === "grad") {
      closeModal();
      clearSelection();
      paintMission();
      return;
    }
    closeModal();
  });
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
    if (modal.dataset.mode === "help" || modal.dataset.mode === "about" || modal.dataset.mode === "grad") {
      const grad = modal.dataset.mode === "grad";
      closeModal();
      if (grad) paintMission();
      return;
    }
    if (introIndex >= introSteps().length - 1) {
      closeModal();
      selectIsland("border");
    } else showIntro(introIndex + 1);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
      event.preventDefault();
      $("help").click();
    } else if (!event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing && (event.key === "m" || event.key === "M")) {
      const el = event.target;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      toggleSound();
      paintSound();
    } else if (event.key === "Escape") {
      if (!$("lang-pop").hidden) {
        $("lang-pop").hidden = true;
        paintLangButton();
      } else if (!$("view-menu").hidden) {
        $("view-menu").hidden = true;
        $("view-btn").setAttribute("aria-expanded", "false");
      } else if (!$("filter-pop").hidden) {
        $("filter-pop").hidden = true;
        $("filter").setAttribute("aria-expanded", "false");
        setPane(state.tab);
      } else if (!modal.hidden) closeModal();
      else if (state.germ) closeGerm();
      else if (state.person) closePerson();
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
    renderGerm();
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
        document.querySelector(".passport-hud"),
        document.querySelector("#guide"),
        document.querySelector("#mission"),
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

  function activeTabMark() {
    const pop = $("filter-pop");
    const from = pop?.dataset.from;
    if (pop && !pop.hidden && (from === "phase" || from === "pillar")) return from;
    return state.tab;
  }

  function visibleTabs() {
    return [...document.querySelectorAll(".tabs [role=tab]")].filter((button) => {
      if (button.hidden || button.closest("[hidden]")) return false;
      const style = getComputedStyle(button);
      return style.display !== "none" && style.visibility !== "hidden";
    });
  }

  function markTabs(active) {
    for (const item of document.querySelectorAll(".tabs button")) {
      const on = item.dataset.tab === active;
      item.setAttribute("role", "tab");
      const controls = item.dataset.tab === "phase" || item.dataset.tab === "pillar" ? "filter-pop" : "tree";
      item.setAttribute("aria-controls", controls);
      item.setAttribute("aria-selected", String(on));
      item.tabIndex = on ? 0 : -1;
      item.classList.toggle("on", on);
    }
    const content = active === "phase" || active === "pillar" ? state.tab : active;
    tree.setAttribute("role", "tabpanel");
    tree.setAttribute("aria-labelledby", `tab-${content}`);
    const pop = $("filter-pop");
    if (!pop) return;
    if (active === "phase" || active === "pillar") {
      pop.setAttribute("role", "tabpanel");
      pop.setAttribute("aria-labelledby", `tab-${active}`);
    } else {
      pop.removeAttribute("role");
      pop.removeAttribute("aria-labelledby");
      pop.setAttribute("aria-label", t("filter"));
    }
  }

  function setPane(tab) {
    state.tab = tab;
    ledger.dataset.pane = tab;
    const pop = $("filter-pop");
    pop.hidden = true;
    pop.dataset.from = "";
    $("filter").setAttribute("aria-expanded", "false");
    markTabs(tab);
    renderList();
  }

  function showFilter(from, options = {}) {
    const pop = $("filter-pop");
    const same = !pop.hidden && pop.dataset.from === from;
    const close = options.force ? false : same;
    pop.hidden = close;
    pop.dataset.from = close ? "" : from;
    $("filter").setAttribute("aria-expanded", String(!pop.hidden));
    const tab = !pop.hidden && (from === "phase" || from === "pillar") ? from : state.tab;
    markTabs(tab);
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
  document.addEventListener("cdc-revealed", () => {
    window.setTimeout(dismissTitle, 3200);
  }, { once: true });
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
    if (!$("view-menu").hidden && !event.target.closest("#view-menu, #view-btn")) {
      $("view-menu").hidden = true;
      $("view-btn").setAttribute("aria-expanded", "false");
    }
  });
  const watcher = new ResizeObserver(() => measureSafe());
  for (const el of [document.querySelector(".brand"), document.querySelector(".dial"), ledger, sheet, document.querySelector(".rail"), document.querySelector("#disclaimer-short"), guide, mission]) {
    if (el) watcher.observe(el);
  }
  window.addEventListener("resize", measureSafe);

  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const deepLink = Boolean(params.get("item") || params.get("flow") || params.get("island"));
  if (deepLink && !book.welcome) {
    book.welcome = Date.now();
    savePassport(book);
  }
  scene.setNames(state.names);
  scene.setCargo(state.flows);
  paintChrome();
  paintClock();
  phaseNote.textContent = phases[0].note;
  syncToggles();
  renderList();
  if (params.get("item") && params.get("island")) selectItem(params.get("island"), params.get("item"));
  else if (params.get("flow")) selectFlow(params.get("flow"));
  else if (params.get("island")) selectIsland(params.get("island"));
  placePassport();
  window.addEventListener("resize", placePassport);
  if (!quiet && !book.welcome && !deepLink) showGuide();
  else paintMission();

  $("source-link").href = SOURCE_INDEX;
  measureSafe();

  if (import.meta.env.DEV) {
    window.__day = {
      note: () => {
        const note = dayNote(state.minutes);
        return { from: note.from, focus: note.focus, title: note.title };
      },
      hold: () => chapterHold,
      wakes: () => scene.wakeState?.() ?? { live: [], queued: 0 },
    };
  }

  return {
    tick(dt) {
      if (chapterHold > 0) {
        chapterHold = Math.max(0, chapterHold - dt);
        if (chapterHold === 0) hideChapter();
      } else if (state.playing) {
        const prev = dayNote(state.minutes);
        let nextMin = state.minutes + dt * 30;
        if (nextMin >= 1440) nextMin %= 1440;
        const next = dayNote(nextMin);
        if (next !== prev) {
          state.minutes = next.from * 60;
          chapterHold = 1.8;
          showChapter(next);
        } else state.minutes = nextMin;
        paintClock();
      }
      if (!state.bird && scene.isBird()) state.bird = false;
      state.bird = scene.isBird();
      syncBirdOnly();
      compass.style.transform = `rotate(${scene.getTheta()}rad)`;
      paintPins();
    },
  };

  function syncBirdOnly() {
    const button = document.querySelector('[data-toggle="bird"]');
    if (button) button.setAttribute("aria-pressed", String(state.bird));
  }
}
