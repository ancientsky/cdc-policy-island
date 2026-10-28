// Kid-layer counts for the island card.
// 字 = characters after removing whitespace (spaces, newlines, ideographic spaces).
// Punctuation counts. A paragraph is a slice split on newlines. A blurbKid's
// first sentence ends at the first 。！？.
// The 19 mandated rewrites are compared verbatim. If one of them is longer
// than 60 字, the table wins and that string is exempt from the paragraph cap.

import { flows, islands, validate } from "../src/data.js";

validate();

const mandated = {
  "watch.blurbKid": "這裡是防疫的瞭望塔。全台灣的醫生一發現傳染病，消息就會傳到這裡。值班的人 24 小時盯著，哪裡病例突然變多，就馬上派人去查。",
  "watch-notify": "醫生發現病人得了會傳染的病，法律規定要在時限內回報，有些病要在 24 小時內。越早回報，防疫人員就能越早出動。",
  "watch-duty": "疫情中心晚上也有人值班。一旦發現危險訊號，半夜也會馬上開始調查，不用等到明天。",
  "border.blurbKid": "從國外來的病菌，一定先經過機場和港口。檢疫人員就是台灣的守門員，用熱像儀量體溫，發現發燒的旅客就請他做檢查。",
  "lab.blurbKid": "醫生只知道「有人生病了」，實驗室負責查出「兇手是誰」。檢驗員用病人的口水、血液這些檢體，找出是哪一種病毒或細菌。",
  "lab-campus": "台灣正在蓋一棟新的防疫總部大樓，裡面有指揮中心和最高等級的防護實驗室，可以安全研究最危險的病菌。預計 2032 年完工，那時你可能已經上大學了！",
  "vax-season": "每年秋天開打流感疫苗，爺爺奶奶和容易重症的人先打。打的人越多，冬天住院的人就越少。",
  "vax-cold": "疫苗很怕熱，要一路冰在 2–8°C，從倉庫送到衛生所再到你的手臂。這條一路冰著的運送路線叫「冷鏈」。",
  "entero-term": "開學時，老師會帶大家做三件事：用肥皂洗手、生病在家休息、清掉教室的積水。一次擋下腸病毒、流感和登革熱！",
  "dengue-source": "一個瓶蓋大小的積水，就能養出一窩蚊子！下過雨後記得「巡、倒、清、刷」：巡視家裡、倒掉積水、清掉容器、刷掉蚊子卵。",
  "dengue-crew": "里長、清潔隊和衛生所的人一起出動。噴藥只能殺死現在的蚊子，倒掉積水，下一代蚊子才生不出來。",
  "tb.blurbKid": "結核病是很古老的傳染病，會透過咳嗽在空氣中傳播。它的藥要連續吃 6 個月以上，少吃幾天，細菌就可能變得更難打。台灣的目標是 2035 年前讓它幾乎消失。",
  "tb-dots": "「都治」就是關懷員每天陪病人把藥吃下去。口號是：送藥到手、服藥入口、吞了再走！",
  "hiv-2030": "有些人感染了愛滋病毒卻不知道。如果大家害怕被笑、被排擠，就不敢去檢查。不歧視，才能讓更多人早點檢查、早點治療。",
  "ipc-hand": "在醫院，洗手是最便宜也最有效的防疫方法。醫生護理師每碰一位病人前後都要洗手，一天可能要洗上百次。",
  "amr-joint": "細菌變強不只發生在醫院。養雞養豬用的抗生素、流進河裡的藥，也會讓細菌變強。所以醫院、農場和環境的人要坐同一張桌子開會，這叫「同一健康（One Health）」。",
  "ready-drill": "就像學校的防災演習，防疫人員也會假裝疫情爆發來練習，找出哪裡會卡住，真的發生時才不會手忙腳亂。",
  "hepa-follow": "吃完藥、肝炎好了，也要定期回去檢查，確定病毒沒有再回來。",
  "global-ihr": "台灣有專人負責和其他國家聯絡，有疫情消息就能馬上通知對方，也能收到對方的警報。",
};

const action0 = {
  watch: "看醫生時說實話：告訴醫生你最近去過哪裡、跟誰在一起。",
  border: "出國回來如果發燒或拉肚子，入境時主動告訴機場檢疫人員。",
  lab: "醫護人員請你採檢（例如用棉棒刷鼻子）時，忍耐幾秒鐘，偵探就有線索了。",
  vax: "翻翻你的兒童健康手冊，看看該打的疫苗是不是都打齊了。",
  flu: "咳嗽、打噴嚏時用手肘遮住口鼻；生病了就在家休息。",
  entero: "家裡有弟弟妹妹，如果他一直想睡、手腳突然抽動或一直吐，要馬上告訴大人帶去看醫生。",
  dengue: "下雨後幫忙「巡、倒、清、刷」：花盆底盤、瓶罐、廢輪胎的積水都倒掉。",
  tb: "咳嗽超過兩週，要請大人帶你去看醫生。",
  hiv: "不取笑、不排擠任何人。大家都不怕被歧視，生病的人才敢去檢查。",
  hepa: "問問爸媽：家裡的大人做過 B 肝、C 肝檢查了嗎？",
  ipc: "去醫院探病，進出病房都要洗手；自己感冒時就先別去探病。",
  amr: "醫生開的抗生素要照指示吃完，不要自己停藥，也不要把剩下的藥給別人吃。",
  ready: "跟家人一起準備「防疫小包」：口罩、體溫計和常用藥。",
  global: "出國前查查目的地有沒有傳染病，需要的話先打疫苗。",
};

const flowKid = {
  f03: ["查出兇手", "瞭望塔發現有人生病，就把檢體送去偵探島，查出是哪種病毒。"],
  f10: ["蚊子變多先警告", "倒積水島發現蚊子變多，就先通知瞭望塔，不用等到有人生病。"],
  f12: ["一次檢查，查兩種病", "抽一次血，可以同時檢查愛滋和肝炎，省時間也省力氣。"],
  f16: ["國外的警報", "其他國家發生疫情，世界電台島會第一時間通知瞭望塔。"],
};

const banned = ["量能", "權責", "傘狀", "結點", "對口", "效期", "調撥", "封緘", "順從度", "分艙", "管考", "常設業務", "交件"];

function chars(value) {
  return [...String(value).replace(/\s/g, "")].length;
}

function paragraphs(value) {
  return String(value).split(/\n+/).filter((part) => part.trim());
}

function firstSentence(value) {
  const match = String(value).split(/(?<=[。！？])/);
  return match[0] || String(value);
}

function countWord(value, word) {
  return String(value).split(word).length - 1;
}

const rows = [];
for (const island of islands) rows.push({ id: `${island.id}.blurbKid`, kind: "blurb", text: island.blurbKid });
for (const island of islands) {
  for (const item of island.items) rows.push({ id: item.id, kind: "item", text: item.kid });
}
for (const flow of flows) {
  rows.push({ id: `${flow.id}.kidTitle`, kind: "flow", text: flow.kidTitle });
  rows.push({ id: `${flow.id}.kid`, kind: "flow", text: flow.kid });
}

const exempt = new Set(Object.values(mandated));
const failures = [];
let notBlurb = 0;
let notAll = 0;
let rocHits = 0;
const bannedHits = [];
const over = [];

for (const row of rows) {
  const text = row.text ?? "";
  notAll += countWord(text, "不是");
  if (row.kind === "blurb") {
    notBlurb += countWord(text, "不是");
    const first = firstSentence(text);
    const n = chars(first);
    if (n > 40) failures.push(`${row.id} first sentence ${n} > 40`);
  }
  if (!exempt.has(text)) {
    for (const para of paragraphs(text)) {
      const n = chars(para);
      if (n > 60) over.push(`${row.id} ${n}`);
    }
  }
  const roc = text.match(/1[01]\d\s?年/g);
  if (roc) {
    rocHits += roc.length;
    failures.push(`${row.id} ROC ${roc.join(",")}`);
  }
  for (const word of banned) {
    if (text.includes(word)) bannedHits.push(`${row.id} ${word}`);
  }
}
if (over.length) failures.push(`paragraph > 60: ${over.join("; ")}`);
if (notBlurb !== 0) failures.push(`blurbKid 不是 = ${notBlurb}`);
if (notAll > 3) failures.push(`kid-layer 不是 = ${notAll}`);
if (bannedHits.length) failures.push(`banned: ${bannedHits.join("; ")}`);

const seen = new Set();
for (const [key, expect] of Object.entries(mandated)) {
  const island = islands.find((item) => `${item.id}.blurbKid` === key);
  const item = islands.flatMap((row) => row.items).find((row) => row.id === key);
  const actual = island ? island.blurbKid : item?.kid;
  seen.add(key);
  if (actual !== expect) failures.push(`mismatch ${key}`);
}
if (seen.size !== 19) failures.push(`mandated keys ${seen.size}`);

for (const [id, expect] of Object.entries(action0)) {
  const island = islands.find((item) => item.id === id);
  if (island?.actions?.[0]?.label !== expect) failures.push(`action0 ${id}`);
}
for (const [id, [title, text]] of Object.entries(flowKid)) {
  const flow = flows.find((item) => item.id === id);
  if (flow?.kidTitle !== title || flow?.kid !== text) failures.push(`flow ${id}`);
}

const adultPlan = islands.find((item) => item.id === "dengue")?.source ?? "";
if (!adultPlan.includes("急性傳染病流行風險監控與管理第四期計畫")) failures.push("dengue adult source lost the plan name");
const borderBlurb = islands.find((item) => item.id === "border")?.blurb ?? "";
if (!borderBlurb.includes("四面環海")) failures.push("border adult blurb lost the open-sea sentence");

console.log(`islands ${islands.length}  items ${rows.filter((row) => row.kind === "item").length}  flows ${flows.length}`);
console.log(`blurbKid 不是 ${notBlurb}`);
console.log(`kid-layer 不是 ${notAll}`);
console.log(`ROC /1[01]\\d\\s?年/ ${rocHits}`);
console.log(`banned ${bannedHits.length}`);
console.log(`paragraph > 60 (mandated exempt) ${over.length}`);
for (const island of islands) {
  const first = chars(firstSentence(island.blurbKid));
  const all = chars(island.blurbKid);
  console.log(`blurb ${island.id} first ${first} all ${all}${exempt.has(island.blurbKid) ? " mandated" : ""}`);
}
if (failures.length) {
  console.log("FAIL");
  for (const line of failures) console.log(line);
  process.exit(1);
}
console.log("PASS");
