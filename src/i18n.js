// Glossary. English and Japanese follow this table. Chinese stays with the kid rewrite.
// 站名: 防疫島大冒險 | Outbreak Island Adventure | ぼうえき島の大冒険
// 主標: 病菌想登陸台灣？先過這 14 座島！ | Germs want to land in Taiwan? They have to get past 14 islands first! | ばい菌が台湾に上陸したい？まずは14の島を突破しなきゃ！
// 主角: 琵琵隊長（黑面琵鷺） | Captain Pipi, a black-faced spoonbill | ピピ隊長（クロツラヘラサギ）
// 疫情中心: 疫情中心 | Outbreak Command Center | 感染症情報センター
// 運送路線: 運送路線 | Delivery route | おとどけルート
// 任務: 任務 | Mission | ミッション
// 小隊: 偵察隊／守門隊／盾牌隊／照護隊／後勤隊 | Scouts／Gatekeepers／Protectors／Healers／Reserves (S/G/P/H/R) | 見張り隊／門番隊／盾の隊／手当て隊／備え隊
// 階段: 正在做／2027 年前／2030 年前／2035 年前 | Now／By 2027／By 2030／By 2035 | いま／2027年まで／2030年まで／2035年まで
// 看全島: 看全島 | Overview | 全体を見る
// 時段: 晨／午／晚／夜 | Dawn／Noon／Dusk／Night | 朝／昼／夕／夜
// 整備: 整備 | Preparedness | 備え（全文。不用「整備」）
// 應變: 應變 | Response | 対応
// 冷鏈: 冷鏈 | Cold chain | コールドチェーン
// 都治: 都治（關懷員陪吃藥） | DOTS (a health worker watches each dose) | DOTS（服薬を毎日見守る）
// 你可以做的事: 你可以做的事 | You can help | きみにもできること
// 你知道嗎？: 你知道嗎？ | Did you know? | しってた？
// Japanese prose uses です・ます. Lot release is 国家検定, not 封緘.

import { dayNotes, flows, islands, phaseLabel, phases, pillars } from "./data.js";
import { applyPlain, plain } from "./plain.js";

const LANG_KEY = "cdc-island-lang";

export const THEME_MINUTES = {
  morning: 8 * 60 + 20,
  noon: 12 * 60 + 30,
  evening: 18 * 60 + 40,
  night: 22 * 60,
};

export function themeFromMinutes(minutes) {
  const hour = (((minutes % 1440) + 1440) % 1440) / 60;
  if (hour >= 5 && hour < 10.5) return "morning";
  if (hour >= 10.5 && hour < 16) return "noon";
  if (hour >= 16 && hour < 19.75) return "evening";
  return "night";
}

const ui = {
  zh: {
    brandKicker: "防疫互動地圖",
    brandTitle: "防疫島大冒險",
    title: "防疫島大冒險｜台灣防疫互動地圖（非官方）",
    description: "病菌想登陸台灣？跟著防疫小隊長琵琵巡邏 14 座島，看醫生、檢驗員和里長伯怎麼接力把病菌擋下來。依疾管署公開資料整理的非官方互動地圖。",
    badge: "非官方",
    badgeLabel: "本站非疾病管制署官方網站，內容依公開資料整理",
    compass: "北",
    compassTitle: "北方",
    home: "看全島",
    list: "清單",
    help: "操作說明",
    sound: "音效",
    heroTitle: "病菌想登陸台灣？\n先過這 14 座島！",
    heroLead: "每座島都有一群人在守門。\n點一座島，看他們怎麼接力擋病菌。",
    eyebrow: "",
    ledgerTitle: "島嶼任務清單",
    ledgerLead: "每座島負責一件防疫大事。點進去看看島上的人在忙什麼、把東西送給誰。",
    search: "搜尋：蚊子、疫苗、洗手…",
    searchLabel: "搜尋島、蚊子、疫苗、洗手",
    selectedName: "已選取：{name}",
    foundIslands: "找到 {n} 座島",
    foundFlows: "找到 {n} 條運送路線",
    tabsLabel: "清單分頁",
    tabIslands: "島嶼",
    tabLife: "我想知道…",
    tabAll: "全部的島",
    scenarioLead: "選一個跟你有關的情況，島會告訴你可以做什麼。",
    backstage: "看政府在背後做什麼",
    emptyTry: "找不到。試試看：蚊子、出國、打疫苗",
    scenarioShot: "我要打疫苗",
    scenarioTravel: "我要出國",
    scenarioKid: "家裡有小小孩",
    scenarioElder: "家裡有長輩",
    scenarioMosq: "蚊子、積水",
    scenarioCough: "咳嗽很久",
    scenarioSex: "篩檢與性健康",
    scenarioDrug: "抗生素怎麼吃",
    tabFlows: "運送路線 {n}",
    tabLog: "送貨紀錄",
    disclaimerShort: "非官方網站・依疾管署公開資料整理",
    dataAsOf: "資料截至 {date}",
    aboutTitle: "關於這張地圖",
    aboutKicker: "說明",
    about1: "本站依疾病管制署公開資料整理，非官方網站。資料截至 2026 年 10 月。",
    about2: "島的位置和海上的病菌是為了好懂而畫的比喻。",
    about3: "最新資訊與防疫諮詢請洽疾管署網站或 1922 防疫專線。",
    adultSummary: "給大人看：政策背景、計畫名稱、年份與原文",
    youCan: "你可以做的事",
    didYouKnow: "你知道嗎？",
    hotline: "有疑問？撥 1922 防疫專線（免付費）",
    toolClean: "清積水",
    toolCheck: "入境檢疫",
    toolShield: "打疫苗",
    toolWash: "洗手",
    toolFinish: "吃完藥",
    threatTip: "點一下，幫島上的人{action}",
    repelCount: "已擊退 {n}",
    repelToast: "{action}成功：{name}把病原擋在外海",
    germWhatLabel: "這是什麼",
    germHowLabel: "怎麼傳",
    germDoLabel: "你可以做的事",
    germWhatDengue: "埃及斑蚊和白線斑蚊會傳登革熱，白天也叮人。",
    germHowDengue: "蚊子叮了生病的人，再叮下一個人，病毒就跟著過去。",
    germDoDengue: "下雨後幫忙「巡、倒、清、刷」：花盆底盤、瓶罐、廢輪胎的積水都倒掉。",
    germWhatBorder: "斑蚊會叮人，也可能跟著旅遊進到這座島。",
    germHowBorder: "在國外被叮的人回來後，本地的蚊子再叮，病就可能留下。",
    germDoBorder: "出國回來如果發燒或拉肚子，入境時主動告訴機場檢疫人員。",
    germWhatFlu: "流感病毒會讓人發燒、咳嗽、全身痠痛。",
    germHowFlu: "咳嗽的飛沫，還有手上的病毒摸到口鼻，都會傳給別人。",
    germDoFlu: "咳嗽、打噴嚏時用手肘遮住口鼻；生病了就在家休息。",
    germWhatEntero: "腸病毒常在小朋友之間，靠手口傳開。",
    germHowEntero: "手碰到口水，再摸眼睛或嘴巴，病毒就進去了。",
    germDoEntero: "家裡有弟弟妹妹，如果他一直想睡、手腳突然抽動或一直吐，要馬上告訴大人帶去看醫生。",
    germWhatTb: "結核桿菌會讓人咳很久，要給醫生看。",
    germHowTb: "病人咳嗽時，病菌飄在空氣裡，別人吸進去就可能生病。",
    germDoTb: "咳嗽超過兩週，要請大人帶你去看醫生。",
    sourceLink: "資料來源",
    panelDay: "防疫的 24 小時",
    panelPhase: "從現在到 2035",
    panelPillar: "五支小隊",
    play: "快轉一天",
    pause: "停下來",
    dayLabel: "防疫的一天，以分鐘計",
    pillarNote: "可以選好幾隊。都不選，就看全部 14 座島。",
    toggleNames: "島名",
    toggleFlows: "運送路線",
    toggleBird: "鳥瞰",
    viewMenu: "顯示",
    chapterBy: "琵琵：",
    plateFlu: "噴嚏怪",
    plateEntero: "髒手怪",
    plateAedes: "斑斑蚊",
    plateTb: "頑固菌",
    dutyStart: "{nick}・{item} 開始值班",
    togglesLabel: "顯示",
    close: "關閉",
    flowEyebrow: "運送路線",
    carried: "這條線上搬的是「{what}」。",
    outTitle: "這座島會送東西給…",
    carry: "攜帶 {what}",
    emptyFlow: "沒有符合的運送路線。",
    emptyLog: "還沒有人送貨喔！打開「運送路線」，看他們把檢體和疫苗送去哪裡。",
    emptyIsland: "沒有符合的島。",
    stats: "{islands} 座島・{items} 個任務・{flows} 條運送路線",
    onDuty: "現在有 {n} 座島的人正在上班",
    handoff: "{from} 把{what}送到 {to}，接力成功！",
    allPillars: "全部",
    next: "下一步",
    start: "出發！",
    skip: "略過",
    gotIt: "知道了",
    helpKicker: "操作",
    helpTitle: "怎麼玩",
    helpBody: "拖曳旋轉，滾輪或兩指拉近。點島或房子打開說明，點海面回到看全島。運送路線在時間軸旁邊，島名在齒輪選單裡，鳥瞰在上方工具列。語言也在上方。一天的滑桿會連著清晨、正午、黃昏、夜裡的光。",
    veil: "琵琵隊長正在巡島，馬上就好…",
    canvas: "十四座島排成臺灣的形狀。完整說明在清單裡。",
    fallback: "這台瀏覽器畫不了立體島嶼，請用清單閱讀。",
    mapLabel: "地圖",
    langLabel: "語言",
    themeLabel: "佈景",
    themeMorning: "晨",
    themeNoon: "午",
    themeEvening: "晚",
    themeNight: "夜",
    langZh: "中",
    langEn: "EN",
    langJa: "日",
    filter: "篩選",
    tabPhase: "時間",
    tabPillar: "小隊",
    roleOfficer: "防疫員",
    roleNurse: "護理師",
    roleLab: "檢驗師",
    roleChief: "里長",
    roleKid: "學童",
    roleElder: "長者",
    roleCourier: "物流",
    roleLineOfficer: "把名單送到下一座島的值班桌。",
    roleLineNurse: "把要打針的人帶到接種的隊伍。",
    roleLineLab: "檢體要在天黑前送到實驗室。",
    roleLineChief: "提著噴霧桶，去社區把積水倒掉。",
    roleLineKid: "書包裡是學校的洗手記錄。",
    roleLineElder: "拄著拐杖，把社區的消息帶去。",
    roleLineCourier: "保冷箱裡是要準時送到的疫苗。",
    personSending: "正在送 {what}",
    personFrom: "從 {name}",
    personTo: "到 {name}",
    personGoing: "正在前往 {name}",
    personHandoff: "在 {name} 交接中",
    personStay: "留在 {name}",
    personBubble: "正在送 {what}",
    personProgress: "{n}%",
    carryQueue: "接種隊伍",
    carryDump: "社區積水",
    carryWash: "洗手紀錄",
    carryPhone: "疫情消息",
    carrySit: "社區消息",
    guideName: "琵琵隊長",
    guideTitle: "嗨！我是琵琵隊長",
    guideMark: "琵",
    guideHello: "我是一隻黑面琵鷺，每年冬天都飛來台灣。這次我要帶你巡邏 14 座防疫島。病菌每天都想偷偷登陸台灣，島上的人就是要把它們擋下來！",
    guideGo: "出發！",
    stampLabel: "已巡",
    passportCount: "{n} / 14",
    passportStats: "已讀 {items} / {itemTotal} 個任務 · 已看 {flows} / {flowTotal} 條運送路線",
    missionKicker: "小任務",
    mission1: "點一座島，看島上在做什麼",
    mission2: "找到最北邊的島",
    mission3: "點一棟房子，讀一個任務",
    mission4: "幫島上的人擋下 3 隻病原",
    mission5: "看一次送貨送到",
    mission6: "把時間撥到 20:00，看誰還在值班",
    mission7: "搜尋「蚊子」，找到它在哪座島",
    mission8: "巡完 14 座島",
    missionDone: "完成！",
    mile1: "第一站完成！繼續往下一座島飛吧。",
    mile7: "一半了！你已經比很多大人更懂防疫了。",
    gradTitle: "14 座島全部巡完！",
    gradBody: "你剛剛看到的，就是每天在台灣發生、但你可能從沒注意過的接力賽。從今天起，你也是防疫小隊員了：洗手、倒積水、咳嗽遮口鼻，就是你的任務！",
    gradAgain: "再巡一次",
    gradReset: "重置護照",
    gradResetAsk: "要把巡島紀錄清掉，回到 0 / 14 嗎？",
    gradRepel: "已擊退 {n}",
  },
  en: {
    brandKicker: "Public-health map",
    brandTitle: "Outbreak Island Adventure",
    title: "Outbreak Island Adventure | Taiwan public-health map (unofficial)",
    description: "Germs want to land in Taiwan? Patrol 14 islands with Captain Pipi, a black-faced spoonbill. See how doctors, lab teams, and neighborhood leads pass the work along. An unofficial map made from public Taiwan CDC pages.",
    badge: "Unofficial",
    badgeLabel: "This is not an official Taiwan CDC website. It is arranged from public material.",
    compass: "N",
    compassTitle: "North",
    home: "Overview",
    list: "List",
    help: "How to read this",
    sound: "Sound",
    heroTitle: "Germs want to land in Taiwan?\nThey have to get past 14 islands first!",
    heroLead: "Every island has a crew at the gate.\nPick one and see how they pass the work along to stop the germs.",
    eyebrow: "14 ISLANDS",
    ledgerTitle: "Island mission list",
    ledgerLead: "Each island handles one big prevention job. Open it and see what the people there are doing, and who they send things to.",
    search: "Search: mosquitoes, vaccines, handwashing…",
    searchLabel: "Search islands, mosquitoes, vaccines, handwashing",
    selectedName: "Selected: {name}",
    foundIslands: "Found {n} islands.",
    foundFlows: "Found {n} routes.",
    tabsLabel: "List tabs",
    tabIslands: "Islands",
    tabLife: "I want to know…",
    tabAll: "All the islands",
    scenarioLead: "Pick a situation that fits you. The island shows what you can do.",
    backstage: "See what the government does behind the scenes",
    emptyTry: "Nothing matched. Try: mosquitoes, travel, vaccines",
    scenarioShot: "I need a vaccine",
    scenarioTravel: "I am going abroad",
    scenarioKid: "A small child at home",
    scenarioElder: "An older person at home",
    scenarioMosq: "Mosquitoes and puddles",
    scenarioCough: "A long cough",
    scenarioSex: "Testing and sexual health",
    scenarioDrug: "How to take an antibiotic",
    tabFlows: "Delivery routes {n}",
    tabLog: "Delivery log",
    disclaimerShort: "Not an official Taiwan CDC site · built from public data",
    dataAsOf: "Data as of {date}",
    aboutTitle: "About this map",
    aboutKicker: "Note",
    about1: "Arranged from public Taiwan CDC material. Not an official site. Data as of October 2026.",
    about2: "Island positions and the germs offshore are drawn so the connections are easier to see.",
    about3: "For the latest information or health advice, use the Taiwan CDC website or the 1922 hotline.",
    adultSummary: "For adults: background, plan names, years, and the original wording",
    youCan: "You can help",
    didYouKnow: "Did you know?",
    hotline: "Questions? Call 1922 (toll-free).",
    toolClean: "Empty water",
    toolCheck: "Screening",
    toolShield: "Get vaccinated",
    toolWash: "Wash hands",
    toolFinish: "Finish the meds",
    threatTip: "Tap once to help the island: {action}",
    repelCount: "Turned back {n}",
    repelToast: "{action} worked: {name} kept the pathogen offshore",
    germWhatLabel: "What it is",
    germHowLabel: "How it spreads",
    germDoLabel: "What you can do",
    germWhatDengue: "Aedes mosquitoes spread dengue and also bite in the daytime.",
    germHowDengue: "A mosquito bites a sick person, then bites someone else, and the virus goes along.",
    germDoDengue: "After rain, help tip, empty, clean, and scrub water in saucers, jars, and old tires.",
    germWhatBorder: "These mosquitoes bite people and can arrive with travelers.",
    germHowBorder: "Someone bitten abroad comes home, a local mosquito bites them, and the illness can stay.",
    germDoBorder: "If you come home with a fever or diarrhea, tell the airport screening staff.",
    germWhatFlu: "Influenza virus brings fever, cough, and aching muscles.",
    germHowFlu: "Cough droplets, and virus on a hand that then touches a mouth, pass it on.",
    germDoFlu: "Cover a cough with your elbow, and stay home when you are ill.",
    germWhatEntero: "Enterovirus moves among children by hands and mouths.",
    germHowEntero: "A hand that touched saliva, then an eye or a mouth, carries the virus in.",
    germDoEntero: "If a younger child is very sleepy, jerks, or keeps vomiting, tell an adult right away.",
    germWhatTb: "Tuberculosis bacteria can cause a cough that lasts, so a doctor should see it.",
    germHowTb: "When a sick person coughs, the bacteria float in the air and someone else can breathe them in.",
    germDoTb: "A cough that lasts more than two weeks needs an adult to take you to a doctor.",
    sourceLink: "Sources",
    panelDay: "24 hours of prevention",
    panelPhase: "From now to 2035",
    panelPillar: "Five squads",
    play: "Fast-forward the day",
    pause: "Stop",
    dayLabel: "A prevention day, in minutes",
    pillarNote: "You can pick several squads. Pick none, and you see all 14 islands.",
    toggleNames: "Island names",
    toggleFlows: "Delivery routes",
    toggleBird: "Overhead",
    viewMenu: "View",
    chapterBy: "Pipi: ",
    plateFlu: "Sneezer",
    plateEntero: "Grimy",
    plateAedes: "Stripey",
    plateTb: "Stubborn Bug",
    dutyStart: "{nick} · {item} starts a shift",
    togglesLabel: "Display",
    close: "Close",
    flowEyebrow: "Route",
    carried: "What moves on this line: “{what}”.",
    outTitle: "This island sends things to…",
    carry: "Carries {what}",
    emptyFlow: "No route matches.",
    emptyLog: "Nobody has made a delivery yet! Open “Routes” and see where specimens and vaccines go.",
    emptyIsland: "No island matches.",
    stats: "{islands} islands · {items} tasks · {flows} routes",
    onDuty: "{n} islands have people at work right now",
    handoff: "{from} delivered {what} to {to}. The relay worked!",
    allPillars: "All",
    next: "Next",
    start: "Let's go!",
    skip: "Skip",
    gotIt: "Got it",
    helpKicker: "How",
    helpTitle: "How to play",
    helpBody: "Drag to turn the map. Scroll or pinch to come closer. Click an island or a building. Click the sea to go back. Delivery routes sit by the timeline. Island names are in the gear menu. The overhead view is in the top tools. Language is up there too. The day slider moves the light through Dawn, Noon, Dusk, and Night.",
    veil: "Captain Pipi is touring the islands. One moment…",
    canvas: "Fourteen islands in the shape of Taiwan. The full text is in the list.",
    fallback: "This browser cannot draw the islands. Read the list instead.",
    mapLabel: "Map",
    langLabel: "Language",
    themeLabel: "Light",
    themeMorning: "Dawn",
    themeNoon: "Noon",
    themeEvening: "Dusk",
    themeNight: "Night",
    langZh: "中",
    langEn: "EN",
    langJa: "日",
    filter: "Filter",
    tabPhase: "Time",
    tabPillar: "Squads",
    roleOfficer: "Health officer",
    roleNurse: "Public-health nurse",
    roleLab: "Lab technician",
    roleChief: "Neighborhood lead",
    roleKid: "Student",
    roleElder: "Elder",
    roleCourier: "Courier",
    roleLineOfficer: "Carries the list to the next island's duty desk.",
    roleLineNurse: "Walks people over to the vaccine line.",
    roleLineLab: "Gets the sample to the lab before dark.",
    roleLineChief: "Tips out standing water around the neighborhood.",
    roleLineKid: "The backpack holds the class handwashing log.",
    roleLineElder: "Brings neighborhood news, cane in hand.",
    roleLineCourier: "The cooler holds vaccines due on time.",
    personSending: "Carrying {what}",
    personFrom: "From {name}",
    personTo: "To {name}",
    personGoing: "Heading to {name}",
    personHandoff: "Handing off at {name}",
    personStay: "Staying on {name}",
    personBubble: "Carrying {what}",
    personProgress: "{n}%",
    carryQueue: "a vaccine line",
    carryDump: "standing water",
    carryWash: "a handwashing round",
    carryPhone: "a health alert",
    carrySit: "neighborhood news",
    guideName: "Captain Pipi",
    guideTitle: "Hi! I'm Captain Pipi",
    guideMark: "P",
    guideHello: "I'm a black-faced spoonbill. I fly to Taiwan every winter. This time I'll patrol the 14 prevention islands with you. Germs try to land every day, and the people on the islands are here to stop them!",
    guideGo: "Let's go!",
    stampLabel: "Seen",
    passportCount: "{n} / 14",
    passportStats: "Read {items} / {itemTotal} tasks · Seen {flows} / {flowTotal} routes",
    missionKicker: "Quest",
    mission1: "Open an island and see what it does",
    mission2: "Find the island farthest north",
    mission3: "Open a building and read one task",
    mission4: "Help the islanders stop 3 germs",
    mission5: "Watch one delivery arrive",
    mission6: "Set the time to 20:00 and see who is still on duty",
    mission7: "Search for “mosquito” and find its island",
    mission8: "Visit all 14 islands",
    missionDone: "Done!",
    mile1: "First stop done! Fly on to the next island.",
    mile7: "Halfway! You already know more about prevention than a lot of grown-ups.",
    gradTitle: "All 14 islands visited!",
    gradBody: "What you just saw happens in Taiwan every day, even when nobody points it out. From today you are on the prevention squad: wash your hands, tip out standing water, and cover a cough. That is your task.",
    gradAgain: "Patrol again",
    gradReset: "Reset passport",
    gradResetAsk: "Clear the passport and go back to 0 / 14?",
    gradRepel: "Turned back {n}",
  },
  ja: {
    brandKicker: "ぼうえきの地図",
    brandTitle: "ぼうえき島の大冒険",
    title: "ぼうえき島の大冒険｜台湾のぼうえきマップ（非公式）",
    description: "ばい菌が台湾に上陸したい？ピピ隊長（クロツラヘラサギ）と14の島をパトロールします。お医者さん、検査の人、町の人が、どうバトンを渡して止めるかを見ます。台湾CDCの公開資料で作った、公式ではない地図です。",
    badge: "非公式",
    badgeLabel: "本サイトは疾病管制署の公式サイトではありません。公開資料を整理したものです。",
    compass: "北",
    compassTitle: "北",
    home: "全体を見る",
    list: "一覧",
    help: "見方",
    sound: "効果音",
    heroTitle: "ばい菌が台湾に上陸したい？\nまずは14の島を突破しなきゃ！",
    heroLead: "どの島にも、門を守る人たちがいます。\n島を押して、どうバトンを渡してばい菌を止めるか見てください。",
    eyebrow: "",
    ledgerTitle: "島のミッション一覧",
    ledgerLead: "島ごとに、大きなぼうえきの仕事がひとつあります。開いて、島の人が何をしていて、だれに物を届けるか見てください。",
    search: "検索：蚊、ワクチン、手洗い…",
    searchLabel: "島、蚊、ワクチン、手洗いを検索",
    selectedName: "{name}を選択しました。",
    foundIslands: "{n}の島が見つかりました。",
    foundFlows: "{n}つのおとどけルートが見つかりました。",
    tabsLabel: "一覧のタブ",
    tabIslands: "島",
    tabLife: "知りたいこと…",
    tabAll: "すべての島",
    scenarioLead: "自分に関係ある状況を選んでください。島が、できることを教えます。",
    backstage: "国が裏でしていることを見る",
    emptyTry: "見つかりません。試しに、蚊、旅行、ワクチン。",
    scenarioShot: "ワクチンを打ちたい",
    scenarioTravel: "外国へ行きたい",
    scenarioKid: "家に小さな子どもがいる",
    scenarioElder: "家に高齢の人がいる",
    scenarioMosq: "蚊と水たまり",
    scenarioCough: "せきが長く続く",
    scenarioSex: "検査と性の健康",
    scenarioDrug: "抗生物質の飲み方",
    tabFlows: "おとどけルート {n}",
    tabLog: "配達の記録",
    disclaimerShort: "台湾CDCの公式サイトではありません・公開資料より作成",
    dataAsOf: "資料時点 {date}",
    aboutTitle: "この地図について",
    aboutKicker: "説明",
    about1: "本サイトは台湾疾病管制署の公開資料を整理したもので、公式サイトではありません。資料は2026年10月時点です。",
    about2: "島の位置と海上の病原体は、つながりをわかりやすくするための比喩です。",
    about3: "最新の情報と相談は、台湾CDCのサイトか、無料の1922へ電話してください。",
    adultSummary: "おとな向け：政策の背景、計画の名前、年、原文",
    youCan: "きみにもできること",
    didYouKnow: "しってた？",
    hotline: "わからないときは、1922（無料）に電話してください。",
    toolClean: "水を捨てる",
    toolCheck: "検疫",
    toolShield: "接種",
    toolWash: "手洗い",
    toolFinish: "薬を飲み切る",
    threatTip: "タップして、島の人を手伝って：{action}",
    repelCount: "追い返した {n}",
    repelToast: "{action}ができた：{name}が病原を海の外で止めた",
    germWhatLabel: "これは何",
    germHowLabel: "どううつる",
    germDoLabel: "きみにもできること",
    germWhatDengue: "ネッタイシマカとヒトスジシマカはデング熱を運び、昼も人を刺します。",
    germHowDengue: "蚊が病気の人を刺し、次の人を刺すと、ウイルスが一緒に移ります。",
    germDoDengue: "雨のあと、受け皿や空き瓶、古タイヤの水を捨てて、中を洗ってください。",
    germWhatBorder: "この蚊は人を刺し、旅の荷物や人と一緒に島へ来ることがあります。",
    germHowBorder: "海外で刺された人が帰り、地元の蚊がまた刺すと、病気が残ることがあります。",
    germDoBorder: "帰国後に熱や下痢があるときは、到着時に検疫の人へ自分から伝えてください。",
    germWhatFlu: "インフルエンザウイルスは、熱とせきと体の痛みを起こします。",
    germHowFlu: "せきのしぶきや、手についたウイルスが口や鼻に触れると、次の人へ移ります。",
    germDoFlu: "せきやくしゃみはひじで口を覆い、具合が悪い日は家で休んでください。",
    germWhatEntero: "エンテロウイルスは、子どもの手と口を通って広がります。",
    germHowEntero: "唾液に触れた手が目や口に触れると、ウイルスが体に入ります。",
    germDoEntero: "弟や妹がずっと眠い、手足が急にぴくつく、吐き続けるときは、すぐ大人に伝えてください。",
    germWhatTb: "結核菌は長引くせきの原因になるので、医師に見てもらいます。",
    germHowTb: "病人がせきをすると菌が空気に浮かび、ほかの人が吸い込むことがあります。",
    germDoTb: "せきが二週間を超えたら、大人に頼んで病院へ行ってください。",
    sourceLink: "出典",
    panelDay: "ぼうえきの24時間",
    panelPhase: "いまから2035年まで",
    panelPillar: "五つの隊",
    play: "一日を早送り",
    pause: "止める",
    dayLabel: "ぼうえきの一日。分単位",
    pillarNote: "隊はいくつでも選べます。何も選ばなければ、14の島が全部見えます。",
    toggleNames: "島の名前",
    toggleFlows: "おとどけルート",
    toggleBird: "俯瞰",
    viewMenu: "表示",
    chapterBy: "ピピ：",
    plateFlu: "クシャミン",
    plateEntero: "ヨゴレン",
    plateAedes: "シマカちゃん",
    plateTb: "ガンコ菌",
    dutyStart: "{nick}・{item}の当番開始",
    togglesLabel: "表示",
    close: "閉じる",
    flowEyebrow: "おとどけルート",
    carried: "この線で運ぶのは「{what}」です。",
    outTitle: "この島が届ける先…",
    carry: "運ぶもの {what}",
    emptyFlow: "合うおとどけルートはありません。",
    emptyLog: "まだだれも配達していません。「おとどけルート」を開いて、検体とワクチンがどこへ行くか見てください。",
    emptyIsland: "合う島はありません。",
    stats: "島 {islands}・ミッション {items}・おとどけルート {flows}",
    onDuty: "いま {n} の島で人が仕事をしています",
    handoff: "{from} が{what}を {to} に届けた。リレー成功！",
    allPillars: "すべて",
    next: "次へ",
    start: "出発！",
    skip: "飛ばす",
    gotIt: "わかった",
    helpKicker: "操作",
    helpTitle: "あそび方",
    helpBody: "ドラッグで回し、ホイールかピンチで近づきます。島か建物を押し、海を押すと全体に戻ります。おとどけルートは時間軸のそば、島の名前は歯車メニュー、俯瞰は上の道具列にあります。言語も上です。一日のつまみに合わせて、朝、昼、夕、夜の光が変わります。",
    veil: "ピピ隊長が島を見回しています。もうすぐです…",
    canvas: "台湾のかたちに並んだ14の島です。全文は一覧にあります。",
    fallback: "このブラウザでは立体の島を描けない。一覧を読んでください。",
    mapLabel: "地図",
    langLabel: "言語",
    themeLabel: "光",
    themeMorning: "朝",
    themeNoon: "昼",
    themeEvening: "夕",
    themeNight: "夜",
    langZh: "中",
    langEn: "EN",
    langJa: "日",
    filter: "絞り込み",
    tabPhase: "時間",
    tabPillar: "隊",
    roleOfficer: "ぼうえき担当",
    roleNurse: "保健師",
    roleLab: "検査技師",
    roleChief: "町内会長",
    roleKid: "児童",
    roleElder: "年長者",
    roleCourier: "配達",
    roleLineOfficer: "名簿を次の島の当番机まで届けます。",
    roleLineNurse: "接種の列まで人を案内します。",
    roleLineLab: "日が暮れる前に検体を検査室へ届けます。",
    roleLineChief: "噴霧器を持って水たまりを空にします。",
    roleLineKid: "ランドセルは学校の手洗い記録です。",
    roleLineElder: "杖をつき、町の知らせを届けます。",
    roleLineCourier: "保冷箱は、時間どおり届けるワクチンです。",
    personSending: "{what}を届けている",
    personFrom: "{name}から",
    personTo: "{name}へ",
    personGoing: "{name}へ向かっている",
    personHandoff: "{name}で受け渡し中",
    personStay: "{name}にいる",
    personBubble: "{what}を配達中",
    personProgress: "{n}%",
    carryQueue: "接種の列",
    carryDump: "水たまり",
    carryWash: "手洗い",
    carryPhone: "発生情報",
    carrySit: "町の知らせ",
    guideName: "ピピ隊長",
    guideTitle: "こんにちは。ピピ隊長です",
    guideMark: "ピ",
    guideHello: "わたしはクロツラヘラサギです。毎年冬に台湾へ飛んできます。今回は14のぼうえき島をいっしょにパトロールします。ばい菌は毎日こっそり上陸しようとします。島の人たちがそれを止めています。",
    guideGo: "出発！",
    stampLabel: "巡済",
    passportCount: "{n} / 14",
    passportStats: "読んだミッション {items} / {itemTotal} · 見たおとどけルート {flows} / {flowTotal}",
    missionKicker: "小さなミッション",
    mission1: "島をひとつ開いて、そこで何をしているか見てください",
    mission2: "いちばん北の島を見つけてください",
    mission3: "建物を押して、ミッションをひとつ読んでください",
    mission4: "島の人を手伝って、ばい菌を3匹止めてください",
    mission5: "配達が届くところを一度見てください",
    mission6: "時間を20:00にして、だれがまだ当番か見てください",
    mission7: "「蚊」を検索して、どの島にいるか見つけてください",
    mission8: "14の島をぜんぶ巡ってください",
    missionDone: "できました",
    mile1: "最初の島が終わりました。次の島へ飛んでください。",
    mile7: "半分まで来ました。ぼうえきのこと、ずいぶん詳しくなりました。",
    gradTitle: "14の島を、全部巡りました",
    gradBody: "いま見たのは、台湾で毎日起きているリレーです。今日からきみもぼうえき隊員です。手を洗う、水たまりを空にする、せきをするときは口と鼻を覆う。それがきみのミッションです。",
    gradAgain: "もう一度巡る",
    gradReset: "手帳をリセット",
    gradResetAsk: "巡った記録を消して、0 / 14 に戻しますか？",
    gradRepel: "追い返した数 {n}",
  },
};

const intro = {
  zh: [
    { kicker: "1 / 4", title: "嗨！我是琵琵隊長", body: "我是一隻黑面琵鷺，每年冬天都飛來台灣。這次我要帶你巡邏 14 座防疫島。病菌每天都想偷偷登陸台灣，島上的人就是要把它們擋下來！" },
    { kicker: "2 / 4", title: "看到海上的壞傢伙了嗎？", body: "紅紅刺刺的是噴嚏怪，有條紋的是斑斑蚊。島上的人會用洗手、倒積水、打疫苗、把藥吃完，把它們擋在外面。點一座島，看看那裡的人在忙什麼！" },
    { kicker: "3 / 4", title: "防疫是一場接力賽", body: "島和島之間的彩色弧線是運送路線。港口抓到可疑的病人，就要把檢體快遞到偵探島。只要有一棒掉了，病菌就會溜進來！", showFlows: true },
    { kicker: "4 / 4", title: "準備好了嗎？", body: "下面的時間軸可以快轉一天：半夜誰還在值班？上學時間誰最忙？我們從最北邊的港口守門島開始！" },
  ],
  en: [
    { kicker: "1 / 4", title: "Hi! I'm Captain Pipi", body: "I'm a black-faced spoonbill. I fly to Taiwan every winter. This time I'll patrol the 14 prevention islands with you. Germs try to land every day, and the people on the islands are here to stop them!" },
    { kicker: "2 / 4", title: "See the troublemakers at sea?", body: "The spiky red one is Sneezer. The striped one is Stripey. People on the islands stop them by washing hands, tipping out standing water, getting vaccines, and finishing the medicine. Click an island and see what the people there are doing!" },
    { kicker: "3 / 4", title: "Prevention is a relay", body: "The colored arcs between islands are delivery routes. When the harbor finds a traveler who might be ill, the specimen has to race to Detective Island. Drop one baton, and a germ slips in!", showFlows: true },
    { kicker: "4 / 4", title: "Ready?", body: "The timeline below can fast-forward a whole day. Who is still on duty at midnight? Who is busiest when school starts? We begin at Harbor Gate Island, the one farthest north!" },
  ],
  ja: [
    { kicker: "1 / 4", title: "こんにちは。ピピ隊長です", body: "わたしはクロツラヘラサギです。毎年冬に台湾へ飛んできます。今回は14のぼうえき島をいっしょにパトロールします。ばい菌は毎日こっそり上陸しようとします。島の人たちがそれを止めています。" },
    { kicker: "2 / 4", title: "海のわるいのが見えますか", body: "赤くてトゲトゲなのはクシャミンです。しましまなのはシマカちゃんです。島の人は、手洗い、水たまりを空にすること、ワクチン、薬を飲みきることで、外に止めています。島を押して、そこで何をしているか見てください。" },
    { kicker: "3 / 4", title: "ぼうえきはリレーです", body: "島と島のあいだの色の弧は、おとどけルートです。港で具合の悪そうな人を見つけたら、検体をたんていの島へ急いで届けます。一棒でも落とすと、ばい菌が入ってきます。", showFlows: true },
    { kicker: "4 / 4", title: "準備はいいですか", body: "下の時間軸で、一日を早送りできます。夜中はだれが当番ですか。学校の時間はだれがいちばん忙しいですか。いちばん北の港の門番島から始めます。" },
  ],
};

const pillarsCopy = {
  en: { sentinel: ["S", "Scouts"], gate: ["G", "Gatekeepers"], shield: ["P", "Protectors"], care: ["H", "Healers"], ready: ["R", "Reserves"] },
  ja: { sentinel: ["哨", "見張り隊"], gate: ["門", "門番隊"], shield: ["盾", "盾の隊"], care: ["治", "手当て隊"], ready: ["備", "備え隊"] },
};

const phasesCopy = {
  en: {
    all: ["All years", "See every mission from now through 2035 together.", "2025–2035"],
    now: ["Now", "People do these today. They report illness, give vaccines, dump standing water, run tests, and store supplies.", "2025–2026"],
    near: ["By 2027", "Finish this in the next two years. Get airports and ports ready, and treat tuberculosis sooner.", "to 2027"],
    mid: ["By 2030", "Reach these goals by 2030. More HIV testing, stronger labs, and a fight against superbugs.", "to 2030"],
    far: ["By 2035", "The farthest goal: by 2035 tuberculosis is almost gone, and dumping standing water is a habit in every home.", "to 2035"],
    labels: { now: "Now", near: "By 2027", mid: "By 2030", far: "By 2035" },
  },
  ja: {
    all: ["すべての年", "いまから2035年までのミッションを、まとめて見ます。", "2025–2035"],
    now: ["いま", "今日だれかがしていることです。病気を知らせる、ワクチンを打つ、水たまりを空にする、検査をする、備える。", "2025–2026"],
    near: ["2027年まで", "これから2年で終える仕事です。空港と港の検疫を備え、結核をもっと早く治します。", "2027まで"],
    mid: ["2030年まで", "2030年までの目標です。HIVの検査を受ける人を増やし、検査室を強くし、スーパー耐性菌と戦います。", "2030まで"],
    far: ["2035年まで", "いちばん遠い目標です。2035年までに結核をほとんどなくし、水たまりを空にすることを、どの家の習慣にもします。", "2035まで"],
    labels: { now: "いま", near: "2027年まで", mid: "2030年まで", far: "2035年まで" },
  },
};

const dayCopy = {
  en: [
    ["You are asleep", "The lights at the Outbreak Command Center are still on. People on duty watch news from here and abroad. At the port, someone still watches ships that dock at night."],
    ["It’s light!", "The night shift hands unfinished work to the morning shift. The neighborhood lead starts checking ditches and tipping standing water. The airport meets the first travelers coming home."],
    ["The school bell", "Schools take roll, clinics see patients, and the vaccine clinic opens. This is the lookout’s busiest stretch, and case reports come in one after another."],
    ["Detective time after lunch", "This morning’s specimens reach the laboratory, and the detectives start looking for the cause. Care visitors go out and sit with tuberculosis patients while they take their medicine."],
    ["School is out", "The tip-the-water team goes out for a second round. Care homes also report: are many of the grandparents coughing today?"],
    ["Dinner time", "The anonymous testing site opens. When there is important prevention news, this is often when it is explained."],
    ["You are getting ready for bed", "The red-eye flights are still landing. Countries on the other side of the world are just starting the workday, and more international reports come in."],
  ],
  ja: [
    ["夜中、あなたは寝ています", "感染症情報センターの明かりは、まだついています。当番の人は国内と外国の知らせを見ます。港でも、夜に着く船を見守っています。"],
    ["夜が明けました", "夜の当番は、残った仕事を朝の当番に渡します。町の人が水路を回り、水たまりを捨て始めます。空港は、最初に帰ってくる人を迎えます。"],
    ["授業の鐘", "学校は出席を取り、診療所は診察し、ワクチンの外来が開きます。見張り塔がいちばん忙しい時間で、病気の報告が次々に入ります。"],
    ["昼食のあとのたんてい時間", "午前に採った検体が検査室に届き、たんていたちが原因を探し始めます。ケアの人が出かけ、結核の患者さんに薬を飲むところを見守ります。"],
    ["放課後", "水たまりを捨てる隊が、二回目に出ます。介護の施設も報告します。今日は、せきをしているおじいちゃん、おばあちゃんが多いかを見ます。"],
    ["夕食の時間", "名前を残さない検査所が開きます。大事なぼうえきの知らせは、この時間に説明されることが多いです。"],
    ["もう寝る時間", "深夜の飛行機は、まだ降りています。地球の反対側の国は、ちょうど仕事が始まり、外国からの情報がまた増えます。"],
  ],
};

const nickCopy = {
  en: {
    watch: "Lookout Island",
    border: "Harbor Gate Island",
    lab: "Germ Detective Island",
    vax: "Vaccine Shield Island",
    flu: "Sneeze Island",
    entero: "Handwash School Island",
    dengue: "No-Puddle Island",
    tb: "Finish-the-Pills Island",
    hiv: "Red Ribbon Island",
    hepa: "Liver Guard Island",
    ipc: "Clean Hospital Island",
    amr: "Superbug Island",
    ready: "Emergency Warehouse Island",
    global: "World Radio Island",
  },
  ja: {
    watch: "見張り塔の島",
    border: "港の門番島",
    lab: "病原体たんていの島",
    vax: "ワクチンの盾の島",
    flu: "くしゃみの島",
    entero: "手洗い学校の島",
    dengue: "水たまりゼロの島",
    tb: "薬を飲みきる島",
    hiv: "レッドリボンの島",
    hepa: "肝臓を守る島",
    ipc: "清潔な病院の島",
    amr: "スーパー耐性菌の島",
    ready: "備えの倉庫島",
    global: "世界とつながる電波の島",
  },
};

const sayCopy = {
  en: {
    watch: "This is the lookout! When a doctor finds an infectious disease, the news comes here. The lights stay on all 24 hours.",
    border: "Planes and ships from abroad have to pass this gate first. I'm a migratory bird, and I fly in through here every year too!",
    lab: "Welcome to Detective Island! When a doctor says someone is ill, this is where we find out who did it.",
    vax: "A vaccine is like showing your body the wanted poster first. When the real germ arrives, the body recognizes it right away!",
    flu: "Achoo! Every winter, Sneezer comes to give everyone a test. This island helps people pass.",
    entero: "Enterovirus loves to hide on toys and little hands. Children under five are the ones it can make very sick.",
    dengue: "Stripey is here! Instead of swatting mosquitoes, keep them from hatching at all.",
    tb: "Stubborn Bug really is stubborn. The medicine has to be taken for more than 6 months, with not a single day off.",
    hiv: "There is good medicine for HIV now. Get tested early, take the medicine, and you can go to school and work like everyone else.",
    hepa: "The liver is a quiet organ. It can be ill without hurting much, so a test is how you find the problem.",
    ipc: "Hospitals have the most patients, so germs spread most easily there. That is why the people here wash their hands the most carefully.",
    amr: "Careful! Some bacteria have met so many antibiotics that they trained into superbugs that will not go down.",
    ready: "This is the prevention warehouse. Masks, gowns, and medicine are stored on ordinary days, so a big outbreak does not turn into a scramble.",
    global: "Germs don't need a passport to go abroad! That is why we trade news with countries around the world.",
  },
  ja: {
    watch: "ここは見張り塔です。お医者さんが見つけた感染症の知らせは、ここに届きます。この明かりは24時間ついています。",
    border: "外国から来る飛行機と船は、まずこの門を通ります。わたしは渡り鳥です。毎年ここから飛んで入ります。",
    lab: "たんていの島へようこそ。お医者さんが「だれか病気だ」と言ったら、ここで「犯人はだれか」を調べます。",
    vax: "ワクチンは、体に先に「指名手配の写真」を見せるようなものです。本物のばい菌が来たら、体はすぐにわかります。",
    flu: "ハックション。毎年冬、クシャミンがテストを受けに来ます。この島は、みんなが合格できるようにします。",
    entero: "エンテロウイルスは、おもちゃと小さな手に隠れるのが大好きです。5歳未満の子どもがいちばん重症になりやすいです。",
    dengue: "シマカちゃんが来ました。蚊を叩くより、そもそも生まれないようにします。",
    tb: "ガンコ菌は本当にがんこです。薬は6か月以上、一日も休まず飲み続けます。",
    hiv: "エイズのウイルスには、いま良い薬があります。早く検査して、きちんと飲めば、みんなと同じように学校へ行けますし、働けます。",
    hepa: "肝臓はとても静かな臓器です。病気でもあまり痛まないので、検査で見つけます。",
    ipc: "病院は患者さんが一番多いです。ばい菌も広がりやすいです。だからここの人は、手洗いがいちばん丁寧です。",
    amr: "気をつけてください。抗生物質に会いすぎた細菌が、倒れないスーパー耐性菌になることがあります。",
    ready: "ここはぼうえきの倉庫です。ふだんからマスク、防護衣、薬をしまっておきます。大きな流行のとき、あわてずにすみます。",
    global: "ばい菌はパスポートなしで外国へ出ます。だから世界の国々と情報を交換します。",
  },
};

function item(name, text, keywords) {
  return { name, text, keywords };
}

const body = {
  en: {
    watch: {
      name: "Surveillance", pin: "Lookout",
      blurb: "Signals from inside and outside the country have to land on one duty screen before testing, stockpiles, and public explanation can connect. This island sits in the north-center because it is the knot of the net.",
      source: "Phase IV of acute infectious-disease risk monitoring and management (2025–2028). A four-year umbrella: risk monitoring, vectors and breeding sites, surveillance, laboratories, training, early care, vaccination completion, cross-agency work, and smart monitoring. Vaccine procurement sits in the vaccine fund.",
      hrefLabel: "Open the national statistics system",
      items: {
        "watch-notify": item("Statutory notification", "Clinicians and laboratories report within the deadlines in the Communicable Disease Control Act. The center needs the reports complete, not another form.", ["notification", "statutory", "clinician"]),
        "watch-duty": item("Outbreak Command Center duty", "Someone watches alerts from Taiwan and from abroad, and someone takes the next shift. A danger line starts an investigation the same night.", ["duty", "24 hours", "command center"]),
        "watch-signal": item("More than case reports", "Emergency and outpatient trends move before individual confirmations. Wastewater and other environmental signals, if added, fill the delay in notification. They do not replace cases.", ["visits", "ILI", "wastewater", "alert"]),
        "watch-level": item("A level a county can use", "Surveillance indicators become a risk level a locality can use this week: more vaccination, more breeding-site work, or a facility cluster.", ["level", "alert", "local"]),
      },
    },
    border: {
      name: "Border quarantine", pin: "Harbor Gate",
      blurb: "A pathogen from abroad reaches the airport and the port before it reaches a neighborhood. Taiwan has sea on every side, and this island meets no other country by land. Quarantine sits on the northernmost cell, as the door for flights and ships, not as a wall by itself.",
      source: "Preparedness and border quarantine for emerging infections and an influenza pandemic (2022–2027)",
      hrefLabel: "Taiwan CDC home (search border quarantine)",
      items: {
        "border-port": item("Airport and seaport", "Travelers, crews, and ships are questioned and assessed for symptoms. An abnormality is diverted and sampled. The queue itself must not become the risk.", ["airport", "seaport", "quarantine", "temperature"]),
        "border-travel": item("Travel history and symptoms", "Fever, a cough, and travel through a mosquito area have to become a list the Outbreak Command Center can see the same day.", ["travel history", "entry", "fever"]),
        "border-surge": item("Quarantine capacity", "Routes, isolation space, and shift staffing have to exist in ordinary time so they can expand for a novel pathogen or an influenza pandemic. This item sits in the 2022–2027 preparedness program. The plan says this period is preparation before an outbreak, not the mobilization once one has begun.", ["isolation", "staffing", "pandemic"]),
        "border-vector": item("Vectors on conveyances", "Aircraft and ships are checked for vectors and environmental hygiene. Dengue should not wait for a neighborhood case before anyone notices that the mosquitoes landed first.", ["ship", "aircraft", "vector", "dengue"]),
      },
    },
    lab: {
      name: "Laboratory network", pin: "Detective",
      blurb: "Surveillance without a type only says that people are ill. It does not say what is spreading. The laboratory sits against the surveillance island so specimens do not get lost between two programs.",
      source: "Post-COVID laboratory testing network (2025–2030); Ministry of Health and Welfare prevention-center construction (2021–2032)",
      hrefLabel: "Taiwan CDC home (search the lab network)",
      items: {
        "lab-net": item("Who tests what", "Routine specimens stay local. Unusual pathogens go to a reference laboratory. The division of labor has to name the pathogen and the laboratory level.", ["testing", "reference laboratory", "contract"]),
        "lab-seq": item("Genomic sequencing", "Circulating strains of influenza, COVID-19, enterovirus, and other pathogens have to be identifiable. The network program runs to 2030. Sequencing is capacity to hold, not a one-off project.", ["sequencing", "genome", "influenza", "COVID"]),
        "lab-biosafety": item("Biosafety and security", "High-risk pathogens are handled, stored, and staffed by biosafety level. When capacity grows, that system has to grow with it.", ["biosafety", "pathogen", "inventory"]),
        "lab-campus": item("A new outbreak headquarters", "Taiwan is building a new outbreak headquarters with super-safe labs for studying the most dangerous germs. It should be ready by 2032.", ["headquarters", "high-containment laboratory", "2032"]),
      },
    },
    vax: {
      name: "Vaccination", pin: "Shield",
      blurb: "Vaccination sits on the populated western side of the north. The vaccine fund is about being able to buy, ship, and give the dose. The industry program is a different plan: being able to make doses, and to surge.",
      source: "Phase IV of the national vaccine fund and population-immunity program (2024–2028); national vaccine-industry resilience program (2026–2030)",
      hrefLabel: "Taiwan CDC home (search vaccines)",
      items: {
        "vax-routine": item("Routine public vaccines", "The routine schedule for infants and existing groups has to hold. Measles and Japanese encephalitis stay controlled because each birth cohort is still vaccinated.", ["public vaccine", "measles", "Japanese encephalitis", "infant"]),
        "vax-season": item("Seasonal influenza and COVID-19", "Each season opens with people at higher risk and older adults first, to reduce severe disease and death. Opening day is not the end. Stock and coverage are.", ["influenza vaccine", "COVID", "older adults", "high risk"]),
        "vax-cold": item("Cold chain and transfer", "From lot release and cold storage to the county health bureau, temperature and stock have to be visible, and doses have to move between counties.", ["cold chain", "lot release", "health bureau", "stock"]),
        "vax-fund": item("A fund that outlasts the phase", "The official name of phase IV is the program to replenish the national vaccine fund and raise population immunity. It runs through 2028. What has to remain is the financing and emergency procurement. This line buys, ships, and gives. It is not the industry program.", ["vaccine fund", "financing", "emergency procurement"]),
        "vax-industry": item("Vaccine-industry resilience", "A separate plan from the fund, from 1 January 2026 through 31 December 2030, run by the Ministry of Health and Welfare with the Ministry of Economic Affairs. The work is pandemic-vaccine preparedness and advance purchase, research, resilience of domestic supply, and international industry links. The fund buys. This item is about being able to make doses and to surge.", ["vaccine industry", "advance purchase", "research", "2026"]),
      },
    },
    flu: {
      name: "Influenza and respiratory", pin: "Sneeze",
      blurb: "Seasonal influenza is the stress test that arrives every year. The same surveillance, antivirals, and facility response are what pandemic preparedness looks like on the community end.",
      source: "Standing work at the boundary of the preparedness and border-quarantine program (2022–2027) and phase IV of acute surveillance (2025–2028)",
      hrefLabel: "Taiwan CDC home (search influenza)",
      items: {
        "flu-severe": item("Severe influenza", "Track severe cases, deaths, and virus type to judge how hard this season is, not only how crowded the clinics are.", ["influenza", "severe", "type"]),
        "flu-drug": item("Antiviral drugs", "Contract hospitals have to be able to move stock and watch expiry during the season. Drugs and vaccines are two supply lines. One does not stand in for the other.", ["antiviral", "contract hospital", "stock"]),
        "flu-cluster": item("Facility clusters", "When a nursing home, a school, or a correctional institution has a cluster, it gets sampling, treatment, and isolation advice, and the signal goes back to surveillance.", ["nursing home", "cluster", "school"]),
        "flu-novel": item("A script for a new respiratory virus", "Surveillance, drugs, and a communication script are held for an influenza pandemic or a new respiratory virus. The preparedness program runs to 2027. The script has to be rehearsable before then.", ["pandemic", "emerging", "script"]),
      },
    },
    entero: {
      name: "Enterovirus and schools", pin: "Handwash",
      blurb: "Severe enterovirus is in young children. Transmission is in classrooms and households. This island sits in the middle of the lived map because a school feels the wave before a laboratory does.",
      source: "The enterovirus and enteric-disease chapters of phase IV of acute infectious-disease risk monitoring and management (2025–2028). The start of term is still done with schools and childcare.",
      hrefLabel: "Taiwan CDC home (search enterovirus)",
      items: {
        "entero-sign": item("Warning signs for parents", "Parents are told to recognize drowsiness, myoclonic jerks, and persistent vomiting, and to seek care. The message has to be out before the wave rises, not after the news.", ["drowsiness", "myoclonus", "vomiting", "parents"]),
        "entero-school": item("Schools and childcare", "Absences, closures, and clusters in preschools and primary schools are reported to the health authority. This is the front of surveillance, not a school’s internal statistic.", ["preschool", "closure", "absence"]),
        "entero-hand": item("Hands and surfaces", "Soap and water, and disinfection of toys and frequently touched surfaces. Enterovirus is held by that routine more reliably than by a closure notice.", ["handwashing", "disinfection", "soap"]),
        "entero-term": item("One school routine at term start", "Around the start of term, enterovirus, influenza, and mosquito precautions become one set of actions a school can actually do, instead of three separate memos.", ["term", "influenza", "COVID"]),
      },
    },
    dengue: {
      name: "Dengue and vectors", pin: "No-Puddle",
      blurb: "Community control is clearing breeding sites, not waiting for a confirmed case before spraying. The south carries the highest risk, so this island is the southern tip of the outline.",
      source: "Vector monitoring and breeding-site clearance in phase IV of acute infectious-disease risk monitoring and management (2025–2028). Clearing standing water in neighborhoods remains standing work.",
      hrefLabel: "Taiwan CDC home (search dengue)",
      items: {
        "dengue-source": item("Breeding sites", "Containers, flower pots, and standing water are inspected and emptied. The gap after rain decides the next week’s index more often than the stock of insecticide.", ["standing water", "container", "flower pot"]),
        "dengue-index": item("Mosquito density", "Density is how this area’s risk is read. When the index rises and there is still no local case, clearing comes first. Confirmation does not.", ["ovitrap", "index", "adult mosquito"]),
        "dengue-crew": item("The neighborhood crew", "Neighborhood leaders, cleanup crews, and health workers team up. Spraying kills today's mosquitoes. Dumping water stops the next generation.", ["neighborhood", "cleanup", "health workers"]),
        "dengue-routine": item("Routine, not a mobilization", "What has to remain is clearing water as ordinary municipal work. Emergency spraying and medical surge are added when transmission rises. They are not the steady state.", ["routine", "municipal"]),
      },
    },
    tb: {
      name: "TB elimination", pin: "Finish the Pills",
      blurb: "Phase III runs from 2026 to 2030. Finding people, and finishing the medicine, lowers incidence more than printing another handbook.",
      source: "Phase III of the plan aimed at the 2035 end-TB goal (2026–2030). The year 2035 in the name is the goal year. It is not a claim of WHO membership, and elimination has not been reached.",
      hrefLabel: "Open the tuberculosis pages",
      items: {
        "tb-find": item("Active case finding", "Find people who are ill among contacts and higher-risk groups, instead of waiting until symptoms reach a clinic on their own.", ["contacts", "screening", "high risk"]),
        "tb-dots": item("DOTS and completion", "Directly observed treatment and follow-up exist for completion, not for a check-in. An unfinished course leaves resistance in the community.", ["DOTS", "completion"]),
        "tb-ltbi": item("Latent TB treatment", "Offer treatment of latent infection to contacts, to reduce later disease. This is work phase III still has to push. It is not a finished routine.", ["latent", "LTBI", "contacts"]),
        "tb-2035": item("Holding the elimination line", "After the 2030 program ends, someone in 2035 still has to watch incidence and drug-resistant TB. A faster molecular test shortens the diagnostic gap. It does not replace follow-up.", ["2035", "incidence", "resistance"]),
      },
    },
    hiv: {
      name: "HIV elimination", pin: "Red Ribbon",
      blurb: "Phase I of Taiwan’s HIV elimination program runs through 2026. Screening, PrEP, and treatment have to land in this phase. The 2030 elimination goal is still ahead, so this island has a visible mid-course.",
      source: "Phase I of the 2030 HIV-elimination program (2022–2026). The elimination goal is aligned with 2030. Phase I is not finished.",
      hrefLabel: "Taiwan CDC home (search HIV)",
      items: {
        "hiv-test": item("Wider testing", "Anonymous testing, self-testing, and testing offered in care are there to find people who do not yet know they are infected.", ["anonymous", "self-test", "screening"]),
        "hiv-prep": item("PrEP", "People at risk of infection are offered PrEP and regular follow-up. It is prevention in addition to treatment. It does not replace condoms or testing.", ["PrEP"]),
        "hiv-treat": item("Treatment as prevention", "Treatment soon after diagnosis, and an undetectable viral load, are what lower onward transmission. The slow part is usually the handoff, not the drug.", ["U=U", "viral load", "treatment"]),
        "hiv-2030": item("Coverage before 2030", "Phase I ends in 2026. 2030 is still the goal, not an elimination already reached. The 2025 review still records people who do not know they are infected, and delayed diagnosis. If stigma is still there, the people who most need to enter do not appear in the statistics.", ["2030", "stigma", "coverage"]),
      },
    },
    hepa: {
      name: "Viral hepatitis", pin: "Liver Guard",
      blurb: "Hepatitis B is held by the vaccinated birth cohorts. Hepatitis C is held by finding people and finishing treatment. This island sits in the south because screening and treatment have to follow where people live, not stop at a medical-center clinic.",
      source: "Standing hepatitis work: the hepatitis B vaccine cohort, and hepatitis C oral antivirals plus referral. The major-policy list has no standalone hepatitis program.",
      hrefLabel: "Taiwan CDC home (search viral hepatitis)",
      items: {
        "hepa-b": item("The hepatitis B vaccine cohort", "Infant hepatitis B vaccination continues, holding down chronic carriage that has already fallen. This dose and the vaccine fund are different diseases on one cold chain.", ["hepatitis B", "infant", "carriage"]),
        "hepa-c": item("Hepatitis C treatment", "Hepatitis C is treated with oral antivirals. A positive screen has to reach a clinic that can prescribe. It should not stop on a laboratory report.", ["hepatitis C", "oral antiviral"]),
        "hepa-screen": item("Screening by age and risk", "Hepatitis B and C screening is offered at set ages and risks, so it does not depend on someone feeling ill. By the time there are symptoms, it is often past the point public health needed.", ["screening", "age"]),
        "hepa-follow": item("Someone still watches after treatment", "After a course ends, new infections and people who need follow-up still need a door. Elimination is not a closed file. It is an incidence that does not climb back.", ["follow-up", "reinfection"]),
      },
    },
    ipc: {
      name: "Infection control", pin: "Clean Hospital",
      blurb: "Hospitals and long-term care are where a pathogen gets amplified. Infection control sits on the eastern care belt: cluster reports on one side, antibiotic use passed to the offshore resistance island on the other.",
      source: "The communicable-disease care network in the preparedness program, and infection prevention in the AMR action plan. Hospital and long-term-care inspections remain standing work.",
      hrefLabel: "Open the infection-control page",
      items: {
        "ipc-hospital": item("Hospital infection control", "Isolation space, protective equipment, and cluster notification have to meet the ward. An inspection looks at whether it can be done, not at whether the plan mentions the chapter.", ["hospital", "isolation", "inspection"]),
        "ipc-ltc": item("Clusters in long-term care", "Influenza, gastrointestinal, and respiratory clusters need early detection, cohorting, and a visit. One late report inside a facility becomes a week on the surveillance island.", ["long-term care", "nursing home", "cluster"]),
        "ipc-hand": item("Hands at the point of care", "Sinks and compliance are the cheapest measure and the one that fails most often. In a hospital this one does not go off duty, because the shift change itself is the riskiest seam.", ["handwashing", "compliance"]),
        "ipc-route": item("A route for an unusual pathogen", "The route, the protection, and the receiving hospital for an unusual pathogen have to be agreed beforehand. Looking for a negative-pressure room after the patient reaches the emergency department is not preparedness.", ["route", "transfer", "isolation"]),
      },
    },
    amr: {
      name: "AMR, One Health", pin: "Superbug",
      blurb: "Resistance does not live in one department. Human medicine, animals, and the environment each hold a share, so this island sits offshore and bridges back to the laboratory and the hospital instead of being built on the hospital roof.",
      source: "National One Health antimicrobial-resistance action plan (2025–2029, revised March 2026); Executive Yuan national One Health joint-action program (2026–2030)",
      hrefLabel: "Open the resistance surveillance page",
      items: {
        "amr-steward": item("Stewardship in human medicine", "Hospital antibiotic-stewardship programs cut unnecessary broad-spectrum use. The input is the prescription, not a slogan.", ["antibiotic", "stewardship", "hospital"]),
        "amr-watch": item("Resistance surveillance", "The resistance share of clinical isolates is fed back to hospitals by organism. Without a continuous upload of susceptibilities, the action plan is an empty percentage.", ["resistance", "isolate", "THAS"]),
        "amr-animal": item("Animals and the environment", "Align animal-use medicines and environmental resistance with agriculture and environment agencies. The near-term job is to connect data from outside human medicine.", ["One Health", "animal", "environment"]),
        "amr-joint": item("One cross-ministry table", "On 30 April 2025 the Executive Yuan approved the national One Health policy council. The joint-action program covers 2026 through 2030 and puts human medicine, animals, food, and the environment at one table. It is wider than resistance. The AMR action plan is the resistance slice, through 2029, revised in March 2026. Core capacities stay a self-review or an external review against international tools.", ["policy council", "joint action", "2029", "self-review"]),
      },
    },
    ready: {
      name: "Preparedness", pin: "Warehouse",
      blurb: "Supplies, the command structure, and exercises sit east of the laboratory. When surveillance crosses a threshold, this island changes from stock to deployment. It does not start by writing the first plan.",
      source: "Preparedness and border quarantine for emerging infections and an influenza pandemic (2022–2027); resilient public-health information base (2026–2030)",
      hrefLabel: "Open the preparedness page",
      items: {
        "ready-stock": item("Stockpiles", "Personal protective equipment, test reagents, and treatments need a safety stock, an expiry date, and an order of release. An expired stockpile is no stockpile.", ["supplies", "PPE", "reagents", "expiry"]),
        "ready-command": item("Command and the information line", "When several ministries are needed, the Outbreak Command Center has to be able to grow into a wider command center. Who does what is written down before the day of the event.", ["command center", "authority"]),
        "ready-beds": item("Agreed medical capacity", "ICU beds, testing staff, and nurses are agreed with hospitals ahead of time. One new germ should not shut the emergency room.", ["ICU beds", "sampling", "emergency"]),
        "ready-drill": item("Exercises", "Like a school fire drill, health workers practice a fake outbreak to find what goes wrong before it really happens.", ["exercise", "practice", "outbreak"]),
        "ready-info": item("Information base", "The information-base program runs from 2026 through 2030. Five strategies: a resilient and secure information base, including a security-standard machine room tied to the prevention-center building; data governance; exchange and notification standards; artificial intelligence in prevention services; and information staff. This item is the information on the preparedness island. It does not replace exercises.", ["information", "security", "data governance", "AI"]),
      },
    },
    global: {
      name: "International health", pin: "World Radio",
      blurb: "A report from outside has to reach the duty screen before a domestic case appears. This island sits in the northeast, facing outward. Taiwan reviews itself against the core capacities of the International Health Regulations and exchanges information with partners.",
      source: "Standing international cooperation and the IHR national focal point",
      hrefLabel: "Open the IHR focal-point page",
      items: {
        "global-intel": item("Exchanging outbreak news", "News from partner countries has to reach the Outbreak Command Center duty desk. It should not stop in a forwarded newsletter.", ["intelligence", "neighbors", "exchange"]),
        "global-ihr": item("Core-capacity review", "A self-review against IHR core capacities: detection, notification, response, and points of entry. The joint-action program also says self-review or external review against international tools. The focal point needs a name and a roster, not only a mailbox.", ["IHR", "core capacities", "focal point"]),
        "global-people": item("People and technical cooperation", "Field training and technical cooperation are channels to keep in the near term. A network of people outlasts an ad-hoc video call.", ["training", "FETP", "technical"]),
        "global-say": item("One set of facts, inside and out", "What is said to the public and what is reported to partners has to be the same set of facts. Two versions of a number will be noticed at home first.", ["risk communication", "briefing"]),
      },
    },
  },
  ja: {
    watch: {
      name: "流行の見はり", pin: "見張り塔",
      blurb: "国内と外国の合図は、ひとつの当番画面に着いてから、検査と備蓄と説明につながります。この島を北のまん中に置いたのは、網の結び目だからです。",
      source: "急性感染症の流行リスクを見て管理する第4期（2025–2028）です。4年の大きな計画で、危険の見はり、蚊と水たまり、届け出と調査、検査、人の育成、早い診療、接種の完了、機関をまたぐ仕事、賢い見はりが入ります。ワクチンを買うお金は、ワクチン基金のほうです。",
      hrefLabel: "全国の感染症統計を開く",
      items: {
        "watch-notify": item("法律で決まった届け出", "お医者さんと検査機関は、台湾の伝染病防治法の期限内に届けます。感染症情報センターが欲しいのは、揃った届け出です。紙を一枚増やすことではありません。", ["届け出", "法律", "医師"]),
        "watch-duty": item("感染症情報センターの当番", "国内と外国の警報を見る人がいて、次の人に渡す人もいます。危ないラインを超えたら、その夜に調べ始めます。次の出勤日には回しません。", ["当番", "24時間", "感染症情報センター"]),
        "watch-signal": item("患者名簿より早い合図", "救急と外来が忙しくなるのは、一人ひとりの確定より早いことがあります。下水の合図を足すのは、届け出の遅れを埋めるためです。患者の代わりにはなりません。", ["受診", "下水", "警報"]),
        "watch-level": item("今週使える危険の等級", "見はりの数字を、町が今週使える等級にします。足すのは接種か、水たまりを空にすることか、施設の集団発生への対応かです。", ["等級", "警報", "町"]),
      },
    },
    border: {
      name: "水際の検疫", pin: "港の門番",
      blurb: "外国から来たばい菌は、町に入る前に空港と港へ着きます。台湾は海に囲まれていて、陸では他の国と接しません。検疫はいちばん北に置き、飛行機と船の扉にします。",
      source: "新しい感染症とインフルエンザ大流行への対応と備え、および水際検疫の計画（2022–2027）です。",
      hrefLabel: "台湾CDCのトップ（水際検疫を検索）",
      items: {
        "border-port": item("空港と港の検疫", "入国する人、乗務員、船に質問し、症状を見ます。異常があれば列から外し、検体を採ります。列そのものを危険にしません。", ["空港", "港", "検疫", "体温"]),
        "border-travel": item("渡航歴と症状", "熱、せき、蚊の多い土地への渡航歴は、その日のうちに感染症情報センターが見られる名簿になります。", ["渡航歴", "入国", "熱"]),
        "border-surge": item("検疫を広げる余力", "動線、離す部屋、交代の人は、ふだんから残しておきます。新しい病原体やインフルエンザの大流行で、広げられるようにします。この項目は2022年から2027年の備えの計画に入ります。計画は、この期間を発生前の準備と書き、発生後の動員とは書いていません。", ["隔離", "人員", "大流行"]),
        "border-vector": item("乗り物に乗る蚊", "飛行機と船に、病気を運ぶ蚊がいないか、環境が清潔かを調べます。デング熱は、町で患者が出てから、蚊が先に降りていたと気づくものではありません。", ["船", "飛行機", "蚊", "デング熱"]),
      },
    },
    lab: {
      name: "検査室の網", pin: "病原体たんてい",
      blurb: "型がわからなければ、見はりは「人が病気だ」としか言えません。何が広がっているかはわかりません。検査室を見はりの島のそばに置いたのは、検体が二つの計画のあいだで迷わないようにするためです。",
      source: "新型コロナのあとの感染症検査網計画（2025–2030）と、衛生福利部のぼうえき本部の建設（2021–2032）です。",
      hrefLabel: "台湾CDCのトップ（検査網を検索）",
      items: {
        "lab-net": item("どの検査をどこでするか", "ふつうの検体は地元で行い、めずらしい病原体は上位の検査室へ送ります。分担は、どの病原体をどの等級の検査室が行うかまで書けます。", ["検査", "上位の検査室", "契約"]),
        "lab-seq": item("遺伝子を読む", "インフルエンザ、新型コロナ、エンテロウイルスなどの流行株を見分けられます。網の計画は2030年までです。読む力は残す能力であり、一度きりの仕事ではありません。", ["解析", "ゲノム", "インフルエンザ", "新型コロナ"]),
        "lab-biosafety": item("検査室の安全", "危ない病原体の扱い、保管、人の管理は、安全の等級によります。力を大きくするときは、この仕組みも一緒に大きくします。", ["安全", "病原体", "在庫"]),
        "lab-campus": item("新しいぼうえき本部", "台湾は、いちばん危ないばい菌を安全に調べる検査室つきの、新しいぼうえき本部を建てています。2032年に使える予定です。", ["本部", "高防護の検査室", "2032"]),
      },
    },
    vax: {
      name: "予防接種", pin: "ワクチンの盾",
      blurb: "接種は、人が多い北西側に置きます。ワクチン基金が担うのは、買える、届けられる、打てることです。産業の計画は別で、作れることと、急ぐときに広げられることです。",
      source: "国家ワクチン基金を満たし、国民の免疫を高める第4期（2024–2028）と、国家ワクチン産業の強靭性計画（2026–2030）です。",
      hrefLabel: "台湾CDCのトップ（ワクチンを検索）",
      items: {
        "vax-routine": item("定期の公費ワクチン", "赤ちゃんと、今までの対象の定期日程を守ります。麻疹や日本脳炎のように抑えられた病気は、生まれた世代が打ち続けることで守られます。", ["公費", "麻疹", "日本脳炎", "乳児"]),
        "vax-season": item("季節のインフルエンザと新型コロナ", "毎シーズン、危ない人と高齢者を先に打ちます。重症と死亡を減らすためです。開始日が終わりではありません。在庫と、打った人の割合が終わりです。", ["インフルエンザワクチン", "新型コロナ", "高齢者"]),
        "vax-cold": item("コールドチェーンと融通", "国家検定と冷蔵保管から、県や市の衛生局まで、温度と在庫が見えます。県と市のあいだで動かせます。", ["コールドチェーン", "国家検定", "衛生局", "在庫"]),
        "vax-fund": item("期を越えて残る基金", "第4期の正式な名前は、国家ワクチン基金を満たし、国民の免疫を高める計画です。2028年までです。長く残すのは、お金の出どころと緊急の購入です。この線は買い、届け、打ちます。産業の計画とは別です。", ["ワクチン基金", "財源", "緊急の購入"]),
        "vax-industry": item("ワクチン産業の強さ", "基金とは別の計画です。2026年1月1日から2030年12月31日まで、衛生福利部と経済部が一緒に行います。仕事は、大流行ワクチンの備えと事前購入、研究、国内で作る力、産業の国際的なつながりです。基金は買います。この項目は、作れることと、急ぐときに広げられることです。", ["ワクチン産業", "事前購入", "研究", "2026"]),
      },
    },
    flu: {
      name: "インフルエンザと呼吸器", pin: "くしゃみ",
      blurb: "季節のインフルエンザは、毎年来る負荷の試験です。同じ見はり、治療薬、施設の対応が、大流行への備えの、町側のかたちでもあります。",
      source: "常設の仕事です。新しい感染症とインフルエンザ大流行への対応と備え、および水際検疫の計画（2022–2027）と、急性の見はり第4期（2025–2028）の境にあります。",
      hrefLabel: "台湾CDCのトップ（インフルエンザを検索）",
      items: {
        "flu-severe": item("重症インフルエンザの見はり", "重症、死亡、ウイルスの型を追い、この季節の厳しさを判断します。外来の混雑だけは見ません。", ["インフルエンザ", "重症", "型"]),
        "flu-drug": item("抗ウイルス薬", "契約病院の在庫と使用期限は、流行期に動かせます。薬とワクチンは二本の補給線で、互いに代わりません。", ["抗ウイルス", "契約病院", "在庫"]),
        "flu-cluster": item("施設の集団発生", "介護施設、学校、矯正施設で集団発生があれば、検体、投薬、離す助言を出し、見はりへ戻します。", ["介護施設", "集団", "学校"]),
        "flu-novel": item("新しい呼吸器ウイルスの脚本", "インフルエンザの大流行や、新しい呼吸器ウイルスのために、見はり、薬、説明の脚本を残します。備えの計画は2027年までです。それより前に、練習できる脚本でなければなりません。", ["大流行", "新しい", "脚本"]),
      },
    },
    entero: {
      name: "エンテロウイルスと学校", pin: "手洗い学校",
      blurb: "エンテロウイルスの重症は小さい子どもにあり、広がりは教室と家庭にあります。この島を生活の帯のまん中に置いたのは、検査室より学校の方が先に波を感じるからです。",
      source: "急性感染症の流行リスクを見て管理する第4期（2025–2028）のうち、エンテロウイルスと腸の感染症の章です。学期の始めは、今も学校と保育と一緒に進めます。",
      hrefLabel: "台湾CDCのトップ（エンテロウイルスを検索）",
      items: {
        "entero-sign": item("重症の前ぶれ", "保護者に、ずっと眠い、手足が急にぴくつく、吐き続ける、を見分けて、早く受診するよう伝えます。知らせは流行が上がる前にあり、ニュースのあとではありません。", ["傾眠", "嘔吐", "保護者"]),
        "entero-school": item("保育と学校の見はり", "幼稚園と小学校の欠席、休校、集団発生は、衛生の機関に戻します。これは見はりの前段であり、学校の中だけの数字ではありません。", ["幼稚園", "休校", "欠席"]),
        "entero-hand": item("手と身の回り", "石けんで手を洗い、おもちゃとよく触る面を消毒します。エンテロウイルスは、休校のお知らせより、この一式の方が頼りになります。", ["手洗い", "消毒", "石けん"]),
        "entero-term": item("学期始めの一つの動作", "学期の前後に、エンテロウイルス、インフルエンザ、蚊の対策を、学校が実行できる一つの動作にまとめます。三つの文書が、別々に話しません。", ["学期", "インフルエンザ", "新型コロナ"]),
      },
    },
    dengue: {
      name: "デング熱と蚊", pin: "水たまりゼロ",
      blurb: "町の対策の本体は、蚊が卵を産む水たまりをなくすことです。確定を待ってから薬をまくことではありません。南の危険がいちばん高いので、この島は輪郭のいちばん南に置きます。",
      source: "急性感染症の流行リスクを見て管理する第4期（2025–2028）のうち、蚊の見はりと、卵を産む水たまりの除去です。町の水たまり掃除は、今も常設の仕事です。",
      hrefLabel: "台湾CDCのトップ（デング熱を検索）",
      items: {
        "dengue-source": item("卵を産む水をなくす", "容器、植木鉢、水たまりを見回り、空にします。雨のあとの空白は、殺虫剤の在庫より、次の週の指数を決めることが多いです。", ["水たまり", "容器", "植木鉢"]),
        "dengue-index": item("蚊の密度", "密度で、この区域の危険を見ます。指数が上がり、まだ国内の患者がいないとき、先に水を空にします。確定は待ちません。", ["誘卵", "指数", "成虫"]),
        "dengue-crew": item("町の人たち", "町の世話役、清掃の人、衛生の人が一緒に除きます。薬をまくと、今日の蚊は死にます。水を捨てると、次の世代は生まれません。", ["町", "清掃", "衛生"]),
        "dengue-routine": item("日常の仕事", "長く残すのは、水たまりを空にすることが、ごみを出すのと同じ日常になることです。緊急の散布と医療の増強は、流行が上がったときの追加です。平常そのものではありません。", ["日常", "市政"]),
      },
    },
    tb: {
      name: "結核をほとんどなくす", pin: "薬を飲みきる",
      blurb: "第3期は2026年から2030年です。発生を下げるのは、見つけて薬を飲み切ることです。手引をもう一冊刷ることではありません。",
      source: "2035年の結核終息の目標に向ける第3期計画（2026–2030）です。名前の2035年は目標の年です。WHO加盟の主張ではなく、終息にもまだ達していません。",
      hrefLabel: "結核対策のページを開く",
      items: {
        "tb-find": item("こちらから見つける", "接触した人と、危ない人のなかから、発病した人を見つけます。症状が自分で外来に来るのを待ちません。", ["接触者", "検査", "高リスク"]),
        "tb-dots": item("DOTS（服薬を毎日見守る）", "直接見て飲む確認とケアは、飲み切るためです。ハンコを押すためではありません。飲み残した治療は、薬が効きにくい菌を町に残します。", ["DOTS", "完了"]),
        "tb-ltbi": item("まだせきが出ない結核", "接触した人に、潜んでいる感染の治療を出し、あとで発病するのを減らします。これは第3期がまだ進める仕事であり、終わった日常ではありません。", ["潜在", "LTBI", "接触者"]),
        "tb-2035": item("終息の線を守る", "2030年の計画が終わったあとも、2035年には発生と、薬が効きにくい結核を見る人が要ります。早い遺伝子検査が縮めるのは、診断までの空白です。そのあとの追跡の代わりにはなりません。", ["2035", "発生", "耐性"]),
      },
    },
    hiv: {
      name: "HIVをなくす", pin: "レッドリボン",
      blurb: "台湾のHIVをなくす第1期は2026年までです。検査、PrEP、治療をこの期に着地させます。2030年の目標はまだ先にあります。",
      source: "2030年にHIVをなくす第1期計画（2022–2026）です。なくす目標は2030年に合わせます。第1期はまだ終わっていません。",
      hrefLabel: "台湾CDCのトップ（HIVを検索）",
      items: {
        "hiv-test": item("検査を広げる", "名前を残さない検査、自分でする検査、受診のときに出す検査は、自分が感染しているとまだ知らない人を見つけるためです。", ["匿名", "自己検査", "検査"]),
        "hiv-prep": item("PrEP", "感染の危ない人に、PrEPと定期的な追跡を出します。治療以外の予防であり、コンドームや検査の代わりではありません。", ["PrEP", "暴露前"]),
        "hiv-treat": item("治療が予防になる", "診断のあとすぐに治療し、ウイルス量が検出されなければ、次の感染を下げられます。遅れる区間は、たいてい薬ではなく、つなぎです。", ["U=U", "ウイルス量", "治療"]),
        "hiv-2030": item("2030年までのカバー", "第1期は2026年に終わります。2030年は今も目標であり、すでになくなったのではありません。2025年の点検にも、自分が感染していると知らない人と、診断の遅れが残っています。笑いものにされる恐れが残っていれば、いちばん入るべき人は統計に現れません。", ["2030", "偏見", "カバー"]),
      },
    },
    hepa: {
      name: "ウイルス性肝炎", pin: "肝臓を守る",
      blurb: "B型は、ワクチンを打った世代で守ります。C型は、見つけて治療を終えます。この島を南に置いたのは、検査と治療が人のいる場所についていき、大きな病院の外来だけで止まらないようにするためです。",
      source: "肝炎対策の常設の仕事です。B型ワクチンの世代と、C型の飲む抗ウイルス薬と紹介です。大きな政策の一覧に、肝炎だけの計画はありません。",
      hrefLabel: "台湾CDCのトップ（ウイルス性肝炎を検索）",
      items: {
        "hepa-b": item("B型肝炎ワクチンの世代", "赤ちゃんのB型接種を続け、すでに下がった慢性の保有を守ります。この一件とワクチン基金は、同じコールドチェーンの、別の病気です。", ["B型", "乳児", "保有"]),
        "hepa-c": item("C型肝炎の治療", "C型は、飲む抗ウイルス薬で治療します。検査が陽性なら、薬を出せる医療機関までつなぎます。検査の紙で止めません。", ["C型", "経口", "抗ウイルス"]),
        "hepa-screen": item("年齢と危険による検査", "決めた年齢と危険でB型とC型を調べ、自覚症状だけに頼りません。症状が出たときは、公衆衛生が欲しかった時点を過ぎていることが多いです。", ["検査", "年齢"]),
        "hepa-follow": item("治療のあとも見る人がいる", "一区切りのあとにも、新しい感染と、追跡が要る人に出口が要ります。なくすことは、ファイルを閉じることではありません。発生が戻り上がらないことです。", ["追跡", "再燃", "新しい感染"]),
      },
    },
    ipc: {
      name: "感染を防ぐ", pin: "清潔な病院",
      blurb: "病院と介護施設は、病原体が増える場所です。感染を防ぐ仕事は東側の医療の帯に置き、一方で集団発生の届け出を受け、もう一方で抗菌薬の使い方を、沖の耐性の島へ渡します。",
      source: "備えの計画のなかの感染症医療網と、耐性の行動計画のなかの感染予防です。病院と介護施設の点検は、常設の仕事です。",
      hrefLabel: "感染対策のページを開く",
      items: {
        "ipc-hospital": item("病院で感染を防ぐ", "離す部屋、防護具、集団発生の届け出が、病棟につながっていなければなりません。点検が見るのは、今日できるかです。計画書にその章があるかではありません。", ["病院", "隔離", "点検"]),
        "ipc-ltc": item("介護施設の集団発生", "インフルエンザ、お腹、呼吸器の集団発生は、早く見つけ、区画し、訪ねます。施設の一つの遅い届け出は、見はりの島の一週間になります。", ["介護", "施設", "集団"]),
        "ipc-hand": item("ケアの場の手洗い", "洗い場と、実際に洗うことは、いちばん安く、いちばんよく抜ける対策です。病院では、当番が終わっても手洗いは続きます。引き継ぎそのものが、いちばん危ない継ぎ目だからです。", ["手洗い", "遵守"]),
        "ipc-route": item("めずらしい病原体の動線", "めずらしい病原体の患者の動線、防護、受け取る病院は、先に決めておきます。救急に着いてから陰圧の部屋を探すのは、備えではありません。", ["動線", "転送", "隔離"]),
      },
    },
    amr: {
      name: "薬剤耐性 One Health", pin: "スーパー耐性菌",
      blurb: "耐性は、一つの診療科のなかだけにはありません。人の医療、動物、環境が、それぞれ一份を持ちます。だからこの島は沖にあり、病院の屋根ではなく、検査室と病院へ橋を架けます。",
      source: "国のワンヘルスによる抗菌薬耐性の管理行動計画（2025–2029、2026年3月改訂）と、行政院のワンヘルス共同行動方案（2026–2030）です。",
      hrefLabel: "耐性の見はりのページを開く",
      items: {
        "amr-steward": item("人の医療での抗菌薬管理", "病院の抗菌薬管理は、不要な広い薬を減らします。入力は処方であり、標語ではありません。", ["抗菌薬", "管理", "病院"]),
        "amr-watch": item("耐性の見はり", "臨床で分けた菌の耐性の割合を、菌の種類ごとに病院へ返します。薬が効くかのデータが続き上がらなければ、行動計画は割合の空欄だけになります。", ["耐性", "菌株", "THAS"]),
        "amr-animal": item("動物と環境", "動物に使う薬と、環境のなかの耐性を、農業と環境の部門と揃えます。近い仕事は、人の医療以外のデータをつなぐことです。", ["One Health", "動物", "環境"]),
        "amr-joint": item("省庁をまたぐ一つの席", "行政院は2025年4月30日に、国のワンヘルス政策会議を承認しました。共同行動方案は2026年から2030年で、人の医療、動物、食品、環境を一つの席に置きます。範囲は耐性より広いです。耐性の行動計画はその耐性の切片で、2029年まで、2026年3月に改訂しました。中核能力は、国際的な道具に照らした自己点検か、外部の評価のままです。", ["政策会議", "共同行動", "2029", "自己点検"]),
      },
    },
    ready: {
      name: "ぼうえきの備え", pin: "備えの倉庫",
      blurb: "物資、指揮の枠、練習は、検査室の東に置きます。見はりが危ないラインを超えたとき、ここは在庫の状態から、配置の状態に変わります。最初の計画書を書き始める場所ではありません。",
      source: "新しい感染症とインフルエンザ大流行への対応と備え、および水際検疫の計画（2022–2027）と、折れにくいぼうえきの情報基盤計画（2026–2030）です。",
      hrefLabel: "備えのページを開く",
      items: {
        "ready-stock": item("ぼうえき物資の備蓄", "個人の防護具、検査の試薬、治療薬には、安全な在庫、使用期限、払い出す順が要ります。期限切れの備蓄は、備蓄がないのと同じです。", ["物資", "防護", "試薬", "期限"]),
        "ready-command": item("指揮と情報の枠", "省庁をまたぐときは、日常の感染症情報センターから、指揮中心へ上げられます。だれが何をするかは、先に書いておきます。事案の当日に発明しません。", ["指揮中心", "感染症情報センター", "権限"]),
        "ready-beds": item("医療の力の取り決め", "ICUのベッド、検体を採る人、看護師を、医療網と先に決めておきます。一つの病原体で救急が潰れないようにします。これは備えのうち、まだ日常になりきっていない部分です。", ["ICU", "検体", "救急"]),
        "ready-drill": item("練習", "学校の避難訓練のように、ぼうえきの人は偽の流行を練習し、本当に起きる前に、どこが詰まるかを見つけます。", ["練習", "卓上", "実動"]),
        "ready-info": item("ぼうえきの情報基盤", "情報基盤の計画は2026年から2030年です。五つの戦略は、折れにくく安全な情報の基礎（本部の建設に合わせた、安全基準の機械室を含む）、データの統治、交換と届け出の標準、ぼうえきサービスのなかの人工知能、情報の人です。この項目は備えの島の情報であり、練習の代わりではありません。", ["情報", "安全", "データ", "AI"]),
      },
    },
    global: {
      name: "国際保健", pin: "電波",
      blurb: "外の流行情報は、国内で患者が出る前に当番画面へ入ります。この島は北東に置き、外に向けます。台湾は国際保健規則の中核能力で自らを点検し、協力先と情報を交換します。",
      source: "国際協力と、IHRの国家窓口の常設の仕事です。",
      hrefLabel: "IHR窓口のページを開く",
      items: {
        "global-intel": item("国際の流行情報", "協力する国と近くの事案は、感染症情報センターの当番に入ります。転送された便りで止まりません。", ["情報", "近く", "交換"]),
        "global-ihr": item("中核能力の点検", "国際保健規則の中核能力で、自ら点検します。見つける、知らせる、対応する、入国地点です。共同行動方案が書くのも、国際的な道具に照らした自己点検か、外部の評価です。窓口には名前と当番表が要ります。メール箱一つでは足りません。", ["IHR", "中核能力", "窓口"]),
        "global-people": item("人と技術の協力", "ぼうえきの訓練と技術協力は、近い時期に保つ経路です。人の網は、その場限りのテレビ会議より長持ちします。", ["研修", "FETP", "技術"]),
        "global-say": item("内と外で同じ事実", "みんなへの説明と、協力先への通報は、同じ事実でなければなりません。二つの版の数字は、まず国内で見つかります。", ["リスクの説明", "説明"]),
      },
    },
  },
};
const flowCopy = {
  en: {
    f01: ["Entry signals into surveillance", "travel-history list", "Fever and travel history at the border become a signal the Outbreak Command Center can see the same day."],
    f02: ["Identifying a cross-border specimen", "specimen", "A specimen taken at the border goes to a reference laboratory, to confirm a known pathogen or a novel one that needs a higher level of handling."],
    f03: ["Notification, then a test", "specimen", "If surveillance rises without a laboratory type, the only known fact is that people are ill, not which pathogen is spreading."],
    f04: ["An alert starts preparedness", "alert", "Once surveillance crosses the threshold, supplies, beds, and the communication script move from stock to deployment."],
    f05: ["Seasonal immunity", "vaccine", "Influenza vaccine goes to the higher-risk groups that severe-disease surveillance points to, rather than checking severity only after the campaign."],
    f06: ["Moving antivirals", "medicine", "When contract hospitals run short during the season, the stockpile moves along the severe-disease curve."],
    f07: ["Both ends of a pandemic", "preparedness plan", "Influenza-pandemic preparedness is one plan: antivirals in the community at one end, expanded quarantine at the border at the other."],
    f08: ["A report from school", "absences", "Closures and absences in preschools tell the surveillance net that a wave has started, earlier than an individual severe case."],
    f09: ["The same handwashing", "guidance", "Hand hygiene in a school and hand hygiene in a hospital are the same measure, for different people."],
    f10: ["Density before cases", "density", "When the mosquito index rises and there is still no local case, breeding sites are cleared first. Confirmation is not the start."],
    f11: ["Vectors do not get to enter", "inspection", "While neighborhoods clear standing water, conveyance quarantine has to stop mosquitoes from abroad."],
    f12: ["One screen, two eliminations", "screening form", "The people at risk for HIV and for viral hepatitis overlap. Screening and referral can use one route."],
    f13: ["Genotype finds the cluster", "isolate", "A TB contact investigation plus a genotype can tell one chain of transmission from a coincidence."],
    f14: ["Resistance needs an isolate", "isolate", "The percentage on a stewardship plan comes from susceptibilities the laboratory keeps uploading."],
    f15: ["Control data feeds stewardship", "usage", "Clusters and antibiotic use seen by hospital infection control are the human-medicine input to One Health."],
    f16: ["Warnings from abroad", "report", "When an outbreak starts in another country, World Radio Island tells Lookout Island right away."],
    f17: ["Sequences inform the judgment", "sequence", "The genome of a domestic strain is the basis for what is said outward and for the risk judgment, not only a domestic news item."],
    f18: ["Cold chain, then emergency allocation", "cold chain", "The vaccine fund’s ordinary cold chain has to be able to become the distribution net for emergency vaccination in a pandemic."],
  },
  ja: {
    f01: ["入国の合図を見はりへ", "渡航歴の名簿", "水際の熱と渡航歴は、その日のうちに感染症情報センターが見られる合図になります。"],
    f02: ["国境を越えた検体を見分ける", "検体", "水際で採った検体は上位の検査室へ行き、知っている病原体か、もっと慎重に扱う新しいものかを確かめます。"],
    f03: ["届け出の次は検査", "検体", "見はりが上がっても型がなければ、人が病気だとはわかっても、何が広がっているかはわかりません。"],
    f04: ["警報が備えを起こす", "警報", "見はりが危ないラインを超えると、物資、ベッド、説明の脚本は、在庫から配置に変わります。"],
    f05: ["季節の免疫", "ワクチン", "インフルエンザワクチンは、重症の見はりが指した危ない人へ打ちます。打ち終えてから厳しさを見に戻りません。"],
    f06: ["抗ウイルス薬を動かす", "薬剤", "流行期に契約病院の薬が足りなければ、備蓄は重症の増え方に合わせて移します。"],
    f07: ["大流行の両端", "備えの計画", "インフルエンザ大流行への備えは、一つの計画です。一方は町の薬、一方は水際で検疫を広げることです。"],
    f08: ["学校からの報告", "欠席", "幼稚園の休校と欠席は、一人の重症届け出より早く、見はりの網にこの波の始まりを知らせます。"],
    f09: ["同じ手洗い", "知らせ", "学校の手洗いと病院の手洗いは、同じ対策です。対象が違います。"],
    f10: ["患者より先に密度", "密度", "蚊の指数が上がり、まだ国内の患者がいないとき、卵を産む水を先に空にします。確定は待ちません。"],
    f11: ["蚊を入れない", "点検", "町が水たまりを空にするあいだ、乗り物の検疫は外国からの蚊を止めます。"],
    f12: ["一度の検査で二つの病気", "検査票", "HIVとウイルス性肝炎の危ない人は重なります。検査と紹介は、同じ動線を通せます。"],
    f13: ["遺伝子で同じ群れを見つける", "菌株", "結核の接触者調査に遺伝子の型を足して、同じ伝播の鎖か、偶然かを分けます。"],
    f14: ["耐性には菌株が要る", "菌株", "管理計画の割合は、検査室が上げ続ける、薬が効くかのデータから来ます。"],
    f15: ["対策のデータが管理を養う", "使用量", "病院の感染対策が見た集団発生と抗菌薬の使用は、ワンヘルスの、人の医療側の入力です。"],
    f16: ["外国からの警報", "情報", "他の国で流行が始まると、世界とつながる電波の島が、見張り塔の島へすぐ知らせます。"],
    f17: ["配列が判断を支える", "配列", "国内の流行株の遺伝子は、外への説明と危険の判断の根拠です。国内のニュース一つだけではありません。"],
    f18: ["コールドチェーンと緊急の配送", "コールドチェーン", "ワクチン基金のふだんのコールドチェーンは、大流行のとき、緊急接種の配送網に変えられます。"],
  },
};

let lang = "zh";
let shot = null;

function snapshot() {
  if (shot) return;
  shot = {
    pillars: pillars.map((pillar) => ({ mark: pillar.mark, name: pillar.name })),
    phases: phases.map((phase) => ({ label: phase.label, note: phase.note, years: phase.years })),
    phaseLabel: { ...phaseLabel },
    dayNotes: dayNotes.map((note) => ({ title: note.title, text: note.text })),
    islands: Object.fromEntries(islands.map((island) => [island.id, {
      name: island.name,
      pin: island.pin,
      nick: island.nick,
      say: island.say,
      blurb: island.blurb,
      blurbKid: island.blurbKid,
      fact: island.fact,
      actions: island.actions.map((row) => ({ ...row })),
      source: island.source,
      hrefLabel: island.hrefLabel,
      items: Object.fromEntries(island.items.map((itemRow) => [itemRow.id, {
        name: itemRow.name,
        detail: itemRow.detail,
        kid: itemRow.kid,
        keywords: [...(itemRow.keywords ?? [])],
      }])),
    }])),
    flows: Object.fromEntries(flows.map((flow) => [flow.id, {
      title: flow.title,
      text: flow.text,
      carried: flow.carried,
      kidTitle: flow.kidTitle,
      kid: flow.kid,
    }])),
  };
}

function restore() {
  pillars.forEach((pillar, index) => Object.assign(pillar, shot.pillars[index]));
  phases.forEach((phase, index) => Object.assign(phase, shot.phases[index]));
  Object.assign(phaseLabel, shot.phaseLabel);
  dayNotes.forEach((note, index) => Object.assign(note, shot.dayNotes[index]));
  for (const island of islands) {
    const saved = shot.islands[island.id];
    island.name = saved.name;
    island.pin = saved.pin;
    island.nick = saved.nick;
    island.say = saved.say;
    island.blurb = saved.blurb;
    island.blurbKid = saved.blurbKid;
    island.fact = saved.fact;
    island.actions = saved.actions.map((row) => ({ ...row }));
    island.source = saved.source;
    island.hrefLabel = saved.hrefLabel;
    for (const itemRow of island.items) {
      const savedItem = saved.items[itemRow.id];
      itemRow.name = savedItem.name;
      itemRow.detail = savedItem.detail;
      itemRow.kid = savedItem.kid;
      delete itemRow.text;
      itemRow.keywords = [...savedItem.keywords];
    }
  }
  for (const flow of flows) {
    Object.assign(flow, shot.flows[flow.id]);
    flow._alias = "";
  }
}

function paint(code) {
  for (const pillar of pillars) {
    const [mark, name] = pillarsCopy[code][pillar.id];
    pillar.mark = mark;
    pillar.name = name;
  }
  const phasePack = phasesCopy[code];
  for (const phase of phases) {
    const [label, note, years] = phasePack[phase.id];
    phase.label = label;
    phase.note = note;
    if (years) phase.years = years;
  }
  Object.assign(phaseLabel, phasePack.labels);
  dayCopy[code].forEach(([title, text], index) => {
    dayNotes[index].title = title;
    dayNotes[index].text = text;
  });
  const islandPack = body[code];
  for (const island of islands) {
    const row = islandPack[island.id];
    island.name = row.name;
    island.pin = row.pin;
    island.nick = nickCopy[code][island.id];
    island.say = sayCopy[code][island.id];
    island.blurb = row.blurb;
    island.source = row.source;
    island.hrefLabel = row.hrefLabel;
    const savedIsland = shot.islands[island.id];
    for (const itemRow of island.items) {
      const translated = row.items[itemRow.id];
      const saved = savedIsland.items[itemRow.id];
      itemRow.name = translated.name;
      itemRow.detail = translated.text;
      delete itemRow.text;
      itemRow.keywords = [...translated.keywords, ...saved.keywords, saved.name, saved.kid];
    }
    island.items[0].keywords.push(savedIsland.name, savedIsland.pin, savedIsland.nick);
  }
  applyPlain(islands, flows, plain[code]);
  for (const flow of flows) {
    const [title, carried, text] = flowCopy[code][flow.id];
    const saved = shot.flows[flow.id];
    flow.title = title;
    flow.carried = carried;
    flow.text = text;
    flow._alias = [saved.title, saved.kidTitle, saved.carried, saved.text, saved.kid].join(" ");
  }
}

export function getLang() {
  return lang;
}

export function t(key, vars = {}) {
  let value = ui[lang]?.[key] ?? ui.zh[key] ?? key;
  for (const [name, replacement] of Object.entries(vars)) value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}

export function introSteps() {
  return intro[lang] ?? intro.zh;
}

let jaFontsLinked = false;
function ensureJaFonts() {
  if (jaFontsLinked || document.getElementById("ja-fonts")) return;
  jaFontsLinked = true;
  const link = document.createElement("link");
  link.id = "ja-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&family=Noto+Serif+JP:wght@700&display=swap";
  document.head.appendChild(link);
}

export function applyLocale(next) {
  snapshot();
  lang = next === "en" || next === "ja" ? next : "zh";
  if (lang === "zh") restore();
  else paint(lang);
  if (lang === "ja") ensureJaFonts();
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* private mode */ }
  return lang;
}

export function savedLang() {
  try {
    const value = localStorage.getItem(LANG_KEY);
    return value === "en" || value === "ja" ? value : "zh";
  } catch {
    return "zh";
  }
}

export function localeGaps(code) {
  const gaps = [];
  const islandPack = body[code];
  if (!islandPack) return ["missing pack"];
  for (const island of islands) {
    const row = islandPack[island.id];
    if (!row) {
      gaps.push(island.id);
      continue;
    }
    for (const itemRow of island.items) {
      if (!row.items[itemRow.id]) gaps.push(itemRow.id);
      if (!plain[code]?.item?.[itemRow.id]) gaps.push(`${itemRow.id}.kid`);
    }
    if (!plain[code]?.blurbKid?.[island.id]) gaps.push(`${island.id}.blurbKid`);
    if (!plain[code]?.fact?.[island.id]) gaps.push(`${island.id}.fact`);
    if (!plain[code]?.actions?.[island.id]) gaps.push(`${island.id}.actions`);
    if (!sayCopy[code]?.[island.id]) gaps.push(`${island.id}.say`);
  }
  for (const flow of flows) {
    if (!flowCopy[code][flow.id]) gaps.push(flow.id);
    if (!plain[code]?.flow?.[flow.id]) gaps.push(`${flow.id}.kid`);
  }
  return gaps;
}
