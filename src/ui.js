import { DATA_AS_OF, dayNote, hourCovers, itemCount, phaseLabel, phases, pillars, SOURCE_INDEX } from "./data.js";
import { applyLocale, getLang, introSteps, t, themeFromMinutes } from "./i18n.js";
import { MISSIONS } from "./missions.js";
import { load as loadPassport, markFlow as stampFlow, markItem as stampItem, markMission, reset as resetPassport, save as savePassport, stampIsland } from "./passport.js";

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

  const toggleKey = { names: "toggleNames", cargo: "toggleCargo", flows: "toggleFlows", freeze: "toggleFreeze", bird: "toggleBird" };
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
  guide.innerHTML = `<div class="guide-face" id="guide-face"></div><p class="guide-say" id="guide-say"></p><button type="button" class="btn btn--solid" id="guide-go"></button>`;
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
    guide.querySelector("#guide-say").textContent = t("guideHello");
    guide.querySelector("#guide-go").textContent = t("guideGo");
    if (!mile.hidden && mile.dataset.key) mile.textContent = t(mile.dataset.key);
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
    mile.textContent = t(key);
    window.clearTimeout(mileTimer);
    mileTimer = window.setTimeout(() => { mile.hidden = true; }, 2400);
  }

  function playStamp() {
    document.dispatchEvent(new CustomEvent("cdc-cue", { detail: "stamp" }));
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
    const seals = ordered.map((island) => `<i class="seal" style="--c:${island.accent}">${esc(island.pin)}</i>`).join("");
    $("modal-body").innerHTML = `<p>${esc(t("gradBody"))}</p><div class="seals">${seals}</div><p>${esc(t("gradRepel", { n: game.total }))}</p>`;
    $("modal-next").textContent = t("gradAgain");
    $("modal-skip").hidden = false;
    $("modal-skip").textContent = t("gradReset");
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
    markMission(book, current.id);
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
    paintScore();
    if (toastInfo && !toast.hidden) showToast(toastInfo);
    $("c")?.setAttribute("aria-label", t("canvas"));
    paintLangButton();
    for (const button of document.querySelectorAll("[data-toggle]")) button.textContent = t(toggleKey[button.dataset.toggle]);
    buildFilters();
    paintRail();
    paintPassport(false);
    paintGuideCopy();
    paintMission();
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
    const themeColor = { morning: "#fbe3c8", noon: "#dff3f6", evening: "#3b2a5c", night: "#0b1426" };
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = themeColor[theme];
    pokeCaption();
    advanceMissions();
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
    const fresh = stampFreshId === island.id;
    const seal = book.islands[island.id]
      ? `<i class="stamp${fresh ? " fresh" : ""}" style="--c:${island.accent}">${esc(t("stampLabel"))}</i>`
      : "";
    sheet.innerHTML = `<button type="button" class="btn x" data-close aria-label="${esc(t("close"))}">×</button>${seal}<p class="eyebrow">${esc(island.no)}　${pillarChips(island.pillars)}</p><h2>${esc(island.name)}</h2><p>${esc(island.blurb)}</p><p class="jump"><a href="${esc(island.href)}" target="_blank" rel="noopener noreferrer">${esc(island.hrefLabel)}</a></p><div class="detail-items">${items}</div><h3>${esc(t("outTitle"))}</h3><div class="related">${links}</div><details class="adult"><summary>${esc(t("adultSummary"))}</summary><p class="asof">${esc(t("dataAsOf", { date: DATA_AS_OF }))}</p><p class="source">${esc(island.source)}</p></details>`;
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

  function selectIsland(id) {
    if (!byId.has(id)) return;
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
  }

  function selectItem(islandId, itemId) {
    const island = byId.get(islandId);
    if (!island?.items.some((item) => item.id === itemId)) return;
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
  }

  function selectFlow(id) {
    const flow = flows.find((item) => item.id === id);
    if (!flow) return;
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
  }

  function clearSelection() {
    dismissPerson();
    closeGerm();
    cancelStamp();
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
  scene.onArrive((event) => {
    if (!event) return;
    if (event.flow?.id && state.selected?.type === "flow" && state.selected.id === event.flow.id) {
      if (stampFlow(book, event.flow.id)) {
        paintPassport(false);
        advanceMissions();
      }
    }
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
      if (state.person) closePerson();
      else clearSelection();
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
  search.addEventListener("input", () => {
    state.query = search.value;
    noteMosquito(search.value);
    scene.setQuery(search.value);
    renderList();
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
  function helpHtml() {
    const steps = introSteps().map((step) => `<p><b>${esc(step.title)}</b><br>${esc(step.body)}</p>`).join("");
    return `<p>${esc(t("helpBody"))}</p>${steps}`;
  }
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
      if (!window.confirm(t("gradResetAsk"))) return;
      resetPassport(book);
      stampFreshId = null;
      flipping = false;
      paintPassport(true);
      paintPins();
      paintMission();
      closeModal();
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
      paintPins();
    },
  };

  function syncBirdOnly() {
    const button = document.querySelector('[data-toggle="bird"]');
    if (button) button.setAttribute("aria-pressed", String(state.bird));
  }
}
