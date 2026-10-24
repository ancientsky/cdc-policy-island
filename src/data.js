// Public CDC programs, arranged as a policy map. Not an official CDC site.
// Flagship titles follow the major-policy list on cdc.gov.tw (MPage, read 2026-10).
// Standing disease work stays labeled as such. The ministry plan and annual review
// are governance, not a fifteenth island.

export const SOURCE_INDEX = "https://www.cdc.gov.tw/Category/MPage/kVzFWokFW3l9_YeB8idzuw";
export const DATA_AS_OF = "2026-10";
const CDC_HOME = "https://www.cdc.gov.tw/";

export const pillars = [
  { id: "sentinel", mark: "哨", name: "監測預警", color: "#5c81bc" },
  { id: "gate", mark: "門", name: "邊境阻絕", color: "#5cbcb5" },
  { id: "shield", mark: "盾", name: "免疫防護", color: "#bc965c" },
  { id: "care", mark: "治", name: "防治網絡", color: "#bc6e5c" },
  { id: "ready", mark: "備", name: "整備韌性", color: "#7a6eb8" },
];

export const phases = [
  { id: "all", label: "全部階段", years: "2025–2035", note: "十四座島上的工作一起看。" },
  { id: "now", label: "本期執行", years: "2025–2026", note: "這一季就在做的通報、接種、清孳生源、篩檢與儲備。" },
  { id: "near", label: "近期建設", years: "至 2027", note: "邊境檢疫整備收到 2027。潛伏結核治療和特殊病原動線，也排在這段要推進的工作。防疫中心的工期不在這一格。" },
  { id: "mid", label: "中程目標", years: "至 2030", note: "愛滋第一期之後的覆蓋、檢驗網絡、抗藥性行動計畫、疫苗產業計畫和防疫資訊基盤，這些收到 2030 前後。" },
  { id: "far", label: "長期消除", years: "至 2035", note: "計畫期結束後仍不能退回去的事：結核消除對齊 2035、疫苗基金、C 肝追蹤、登革熱日常化。防疫中心興建收到 2032。" },
];

export const phaseLabel = {
  now: "本期執行",
  near: "近期建設",
  mid: "中程目標",
  far: "長期消除",
};

export const dayNotes = [
  { from: 0, to: 5, title: "夜班值勤", text: "疫情中心守國際情資與國內警訊。基因體定序還在跑，港口留下船舶班，醫院的感染管制不打烊。" },
  { from: 5, to: 8, title: "交班與清晨巡檢", text: "夜班把未完成的事件交給早班。社區開始清積水，機場打開早高峰檢疫。" },
  { from: 8, to: 12, title: "門診、校園、通報", text: "接種門診、學校點名、診所通報一起進來。監測網在這一節最吵。" },
  { from: 12, to: 15, title: "檢驗與訪視", text: "上午的檢體進實驗室。結核關懷、肝炎治療和醫院查核在下午繼續跑。" },
  { from: 15, to: 18, title: "第二輪社區", text: "登革熱巡檢再出一輪。長照機構把白天的群聚訊號補進通報。" },
  { from: 18, to: 21, title: "篩檢與說明", text: "匿名篩檢在傍晚比較進得去。需要對公眾說明時，也多半排在這個時段。" },
  { from: 21, to: 24, title: "跨境夜班", text: "紅眼航班與船舶還在進。另一個時區的疫情交換開始變多，定序室重新忙起來。" },
];

const pillarName = Object.fromEntries(pillars.map((p) => [p.id, p.name]));

export const islands = [
  {
    id: "watch",
    no: "01",
    name: "疫情監測",
    pin: "監測",
    col: 1,
    row: 1,
    pillars: ["sentinel"],
    land: "#86b866",
    accent: "#5c81bc",
    kit: "tower",
    blurb: "國內外的疫情訊號要匯到同一個值勤畫面，後面的檢驗、整備和說明才接得上。這座島放在北部中央，因為它是網的結點。",
    source: "急性傳染病流行風險監控與管理第四期計畫（2025–2028）。這是中程四年的傘狀計畫，風險監測、病媒與孳生源、主被動監視、檢驗、人才、早期診療、接種完成、跨機關和智慧監控都寫在裡面。疫苗採購另走疫苗基金。",
    href: "https://nidss.cdc.gov.tw/",
    hrefLabel: "看全國傳染病統計",
    items: [
      { id: "watch-notify", name: "法定傳染病通報", phase: "now", hours: [[8, 18]], keywords: ["通報", "法定", "醫師"], text: "醫師與檢驗單位依《傳染病防治法》的時限通報。疫情中心要的是收得齊，不是多一本報表。" },
      { id: "watch-duty", name: "疫情中心值勤", phase: "now", hours: [[0, 24]], keywords: ["值勤", "二十四小時", "疫情中心"], text: "國內外警訊有人看、有人交接。達門檻就啟動疫調，而不是下一個上班日再處理。" },
      { id: "watch-signal", name: "多元訊號", phase: "near", hours: [[9, 17]], keywords: ["就診", "類流感", "污水", "預警"], text: "門急診就診趨勢先於個別確診。污水等環境訊號若要納入，是拿來補通報的延遲，不是取代個案。" },
      { id: "watch-level", name: "風險分級", phase: "mid", hours: [[10, 16]], keywords: ["分級", "預警", "地方"], text: "把監視指標收成地方這週用得上的風險級別：該加強的是接種、清孳生源，還是機構群聚。" },
    ],
  },
  {
    id: "border",
    no: "02",
    name: "邊境檢疫",
    pin: "邊境",
    col: 1,
    row: 0,
    pillars: ["gate", "ready"],
    land: "#d5c79f",
    accent: "#5cbcb5",
    kit: "port",
    blurb: "境外病原先進機場和港口，才進社區。檢疫放在輪廓最北的那一格，當作這張網的門，而不是一道單獨的牆。",
    source: "新興傳染病暨流感大流行應變整備及邊境檢疫計畫（2022–2027）",
    href: CDC_HOME,
    hrefLabel: "疾管署首頁（查詢邊境檢疫）",
    items: [
      { id: "border-port", name: "航空港口檢疫", phase: "now", hours: [[5, 23]], keywords: ["機場", "港口", "檢疫", "體溫"], text: "對入境旅客、機組與船舶做檢疫詢問和症狀評估。異常就分流、採檢，不讓隊伍本身變成風險。" },
      { id: "border-travel", name: "旅遊史與症狀", phase: "now", hours: [[5, 23]], keywords: ["旅遊史", "入境", "發燒"], text: "發熱、呼吸道症狀和蚊媒疫區旅遊史，當天要變成疫情中心看得到的名單。" },
      { id: "border-surge", name: "檢疫量能", phase: "near", hours: [[8, 18]], keywords: ["隔離", "人力", "大流行"], text: "動線、隔離空間和輪班人力平時就留得住，新型病原或流感大流行時才放得大。這項在 2022 至 2027 的整備計畫裡。計畫寫明這段是爆發前的準備，不是應變動員。" },
      { id: "border-vector", name: "交通工具病媒", phase: "now", hours: [[0, 24]], keywords: ["船舶", "航空器", "病媒", "登革熱"], text: "航空器與船舶的病媒和環境衛生要查。登革熱不必等社區出現病例，才發現蚊子先下了船。" },
    ],
  },
  {
    id: "lab",
    no: "03",
    name: "實驗室網絡",
    pin: "實驗",
    col: 1,
    row: 2,
    pillars: ["sentinel", "ready"],
    land: "#e8e3d3",
    accent: "#61adb7",
    kit: "lab",
    blurb: "監視若沒有型別，只知道有人病了，不知道是哪一種在傳。實驗室貼著監測島，檢體才不會在兩個計畫之間迷路。",
    source: "後新冠疫情時代傳染病檢驗網絡計畫（2025–2030）；衛生福利部防疫中心興建工程（2021–2032）",
    href: CDC_HOME,
    hrefLabel: "疾管署首頁（查詢檢驗網絡）",
    items: [
      { id: "lab-net", name: "全國檢驗分工", phase: "now", hours: [[9, 18]], keywords: ["檢驗", "參考實驗室", "合約"], text: "一般檢體在地做，特殊病原送參考實驗室。分工要寫得出哪一種病原、哪一級實驗室。" },
      { id: "lab-seq", name: "基因體定序", phase: "mid", hours: [[0, 8], [18, 24]], keywords: ["定序", "基因體", "流感", "新冠"], text: "流感、新冠、腸病毒和其他病原的流行株要定得出來。網絡計畫走到 2030，定序是中程要站穩的量能，不是一次性專案。" },
      { id: "lab-biosafety", name: "生物安全與保全", phase: "now", hours: [[9, 18]], keywords: ["生物安全", "病原", "庫存"], text: "高風險病原的操作、庫存和人員管制依生物安全等級管理。量能變大時，這套制度要一起變大。" },
      { id: "lab-campus", name: "防疫中心興建", phase: "far", hours: [[9, 17]], keywords: ["防疫中心", "高防護實驗室", "2032"], text: "行政院 115 年 3 月第二次修正。工期自 110 年至 121 年，也就是 2021 到 2032。國家衛生指揮中心、國家級實驗室和行政部門收進昆陽基地的同一棟，含高防護實驗室。房子要到 2032 才收，不是 2027。房子本身不是防疫。" },
    ],
  },
  {
    id: "vax",
    no: "04",
    name: "預防接種",
    pin: "接種",
    col: 0,
    row: 1,
    pillars: ["shield"],
    land: "#a8c378",
    accent: "#bc965c",
    kit: "clinic",
    blurb: "接種放在北部西側，沿著人口多的那一側。疫苗基金解決買得到、送得到、打得到。產業計畫是另一份，解決做得出來、急時擴得開。",
    source: "充實國家疫苗基金及促進國民免疫力第四期計畫（2024–2028）；國家疫苗產業韌性深耕計畫（2026–2030）",
    href: CDC_HOME,
    hrefLabel: "疾管署首頁（查詢疫苗）",
    items: [
      { id: "vax-routine", name: "常規公費疫苗", phase: "now", hours: [[8, 17]], keywords: ["公費", "麻疹", "日本腦炎", "幼兒"], text: "幼兒與既有對象的常規時程要維持。麻疹、日本腦炎這類已控制的疾病，是靠每一個出生世代繼續打。" },
      { id: "vax-season", name: "季節流感與新冠", phase: "now", hours: [[8, 20]], keywords: ["流感疫苗", "新冠", "長者", "高風險"], text: "每季開打，高風險與長者優先，為了減少重症和死亡。開打日不是終點，庫存和接種率才是。" },
      { id: "vax-cold", name: "冷鏈與調撥", phase: "now", hours: [[6, 18]], keywords: ["冷鏈", "封緘", "衛生局", "庫存"], text: "從封緘、冷儲到縣市衛生局，溫度和庫存要看得到，縣市之間調得動。" },
      { id: "vax-fund", name: "基金長得住", phase: "far", hours: [[9, 17]], keywords: ["疫苗基金", "財源", "緊急採購"], text: "第四期的正式名稱是充實國家疫苗基金及促進國民免疫力計畫，收到 2028。長期要留下的是財源和緊急採購。這一條是買、送、打，和產業計畫不是同一份。" },
      { id: "vax-industry", name: "疫苗產業韌性", phase: "mid", hours: [[9, 17]], keywords: ["疫苗產業", "預購協議", "研發", "115"], text: "這是基金以外的另一份計畫，自 115 年 1 月 1 日至 119 年 12 月 31 日，衛生福利部與經濟部一起做。工作是大流行疫苗的準備與預購、研發、國內供應的韌性，以及產業的國際連結。基金負責買得到；這一項負責做得出來、急時擴得開。" },
    ],
  },
  {
    id: "flu",
    no: "05",
    name: "流感與呼吸道",
    pin: "流感",
    col: 0,
    row: 2,
    pillars: ["shield", "care"],
    land: "#8fbf6a",
    accent: "#bc8f5c",
    kit: "houses",
    blurb: "季節流感是每年都會來的壓力測試。同一套監視、用藥和機構應變，也是流感大流行整備在社區這一端的形狀。",
    source: "常設業務，與新興傳染病暨流感大流行應變整備及邊境檢疫計畫（2022–2027）、急性監測第四期（2025–2028）交界",
    href: "https://www.cdc.gov.tw/",
    hrefLabel: "疾管署首頁（查詢流感）",
    items: [
      { id: "flu-severe", name: "併發重症監視", phase: "now", hours: [[8, 18]], keywords: ["流感", "重症", "型別"], text: "追蹤重症、死亡和病毒型別，判斷這一季的嚴重度，而不是只看門診擁擠。" },
      { id: "flu-drug", name: "抗病毒藥物", phase: "now", hours: [[9, 17]], keywords: ["抗病毒", "合約醫院", "庫存"], text: "合約醫院的藥劑存量和效期要在流行期調得動。藥和疫苗是兩條補給線，不能互相替代。" },
      { id: "flu-cluster", name: "機構群聚", phase: "now", hours: [[9, 18]], keywords: ["護理之家", "群聚", "學校"], text: "護理之家、學校和矯正機關出現群聚時，給採檢、給藥和隔離建議，並回報監測。" },
      { id: "flu-novel", name: "新型呼吸道腳本", phase: "near", hours: [[9, 17]], keywords: ["大流行", "新興", "腳本"], text: "為流感大流行或新的呼吸道病毒預留監視、藥品和溝通腳本。整備計畫收到 2027，腳本要在那之前寫得能演練。" },
    ],
  },
  {
    id: "entero",
    no: "06",
    name: "腸病毒與校園",
    pin: "腸病毒",
    col: 1,
    row: 3,
    pillars: ["care"],
    land: "#9ec274",
    accent: "#60b96c",
    kit: "school",
    blurb: "腸病毒的重症在幼兒，傳播在教室和家庭。這座島放在生活帶中段，因為學校比實驗室更早感覺到這一波開始了。",
    source: "急性傳染病流行風險監控與管理第四期計畫（2025–2028）裡的腸病毒與腸道傳染病章節。開學季仍和教托育機構一起做。",
    href: "https://www.cdc.gov.tw/",
    hrefLabel: "疾管署首頁（查詢腸病毒）",
    items: [
      { id: "entero-sign", name: "重症前兆衛教", phase: "now", hours: [[7, 20]], keywords: ["嗜睡", "肌躍", "嘔吐", "家長"], text: "提醒家長辨識嗜睡、肌躍型抽搐、持續嘔吐等重症前兆，儘速就醫。衛教要在流行上升前就在，而不是上新聞以後。" },
      { id: "entero-school", name: "教托育監視", phase: "now", hours: [[7, 16]], keywords: ["幼兒園", "停課", "缺勤"], text: "幼兒園與國小的缺勤、停課和群聚回報衛生單位。這是監測的前段，不是學校自己的內部統計。" },
      { id: "entero-hand", name: "手部與環境", phase: "now", hours: [[7, 16]], keywords: ["洗手", "消毒", "肥皂"], text: "肥皂洗手，玩具和常用表面要消毒。腸病毒靠這一套，比靠停課通知可靠。" },
      { id: "entero-term", name: "開學季聯合防護", phase: "now", hours: [[7, 16]], keywords: ["開學", "流感", "新冠"], text: "開學前後把腸病毒、流感和蚊媒防護收成學校做得到的一套動作，避免三份公文各講各的。" },
    ],
  },
  {
    id: "dengue",
    no: "07",
    name: "登革熱與病媒",
    pin: "登革熱",
    col: 1,
    row: 6,
    pillars: ["care", "gate"],
    land: "#c6b57e",
    accent: "#bc935c",
    kit: "yard",
    blurb: "社區防治的主體是清孳生源，不是等確診才噴藥。南端風險最高，所以這座島放在臺灣輪廓的最南端。",
    source: "急性傳染病流行風險監控與管理第四期計畫（2025–2028）裡的病媒監測與孳生源清除。社區清積水仍是常設業務。",
    href: "https://www.cdc.gov.tw/",
    hrefLabel: "疾管署首頁（查詢登革熱）",
    items: [
      { id: "dengue-source", name: "孳生源清除", phase: "now", hours: [[6, 10], [15, 18]], keywords: ["積水", "容器", "花盆"], text: "容器、花盆和積水處要巡、要清。雨後的空窗比藥劑的庫存更常決定下一週的指數。" },
      { id: "dengue-index", name: "病媒蚊密度", phase: "now", hours: [[7, 17]], keywords: ["誘卵", "指數", "成蚊"], text: "用密度看這一區的風險。指數上升而還沒有本土病例時，就該先清，不等確診。" },
      { id: "dengue-crew", name: "社區動員", phase: "now", hours: [[7, 11]], keywords: ["里", "環保", "衛生局"], text: "里、環保和衛生單位一起清。單靠化學防治撐不住下一場雨。" },
      { id: "dengue-routine", name: "日常化，而不是緊急動員", phase: "far", hours: [[9, 17]], keywords: ["制度化", "市政"], text: "長期要留下的是清積水變成日常市政。緊急噴藥和醫療整備是疫情升高時的加開，不是常態本身。" },
    ],
  },
  {
    id: "tb",
    no: "08",
    name: "結核消除",
    pin: "結核",
    col: 0,
    row: 4,
    pillars: ["care"],
    land: "#7fae60",
    accent: "#9abb5d",
    kit: "dots",
    blurb: "第三期自 2026 年走到 2030。主動發現和把藥吃完，比再印一本手冊更能讓發生率下降。",
    source: "我國加入 WHO 2035 消除結核第三期計畫（2026–2030）。名稱裡的 2035 是目標年，不是會員資格，消除也還沒有達成。",
    href: "https://www.cdc.gov.tw/Category/ListPage/2fbGet7KwqEwnjGAy-Zbyg",
    hrefLabel: "看結核病防治專區",
    items: [
      { id: "tb-find", name: "主動發現", phase: "now", hours: [[9, 17]], keywords: ["接觸者", "篩檢", "高風險"], text: "在接觸者和高風險族群裡找出發病的人，不等症狀自己走到門診。" },
      { id: "tb-dots", name: "都治與完成治療", phase: "now", hours: [[9, 17]], keywords: ["都治", "DOTS", "完成率"], text: "直接觀察治療和關懷，是為了完成率，不是為了打卡。沒吃完的療程會把抗藥性留在社區。" },
      { id: "tb-ltbi", name: "潛伏結核治療", phase: "near", hours: [[9, 17]], keywords: ["潛伏", "LTBI", "接觸者"], text: "對接觸者提供潛伏感染治療，減少日後發病。這是第三期要推進的工作，不是已經做完的例行公事。" },
      { id: "tb-2035", name: "守到消除門檻", phase: "far", hours: [[9, 17]], keywords: ["2035", "發生率", "抗藥性"], text: "2030 的計畫結束後，2035 仍要有人看發生率和抗藥性結核。分子快速檢測縮短的是診斷空窗，不能取代後續追蹤。" },
    ],
  },
  {
    id: "hiv",
    no: "09",
    name: "愛滋消除",
    pin: "愛滋",
    col: 1,
    row: 4,
    pillars: ["care"],
    land: "#9dc378",
    accent: "#bc5c6f",
    kit: "ribbon",
    blurb: "消除愛滋第一期走到 2026。篩檢、PrEP 和治療要在這一期收成；2030 的消除目標還在後面，所以這座島有一段明顯的中程工作。",
    source: "2030年消除愛滋第一期計畫（2022–2026）。消除目標對齊 2030，第一期還沒有做完。",
    href: CDC_HOME,
    hrefLabel: "疾管署首頁（查詢愛滋）",
    items: [
      { id: "hiv-test", name: "擴大篩檢", phase: "now", hours: [[12, 20]], keywords: ["匿名", "自我篩檢", "篩檢"], text: "匿名篩檢、自我篩檢，以及就醫時提供的檢驗，是為了找出還不知道自己感染的人。" },
      { id: "hiv-prep", name: "暴露前預防", phase: "now", hours: [[9, 17]], keywords: ["PrEP", "暴露前"], text: "對有感染風險的人提供 PrEP 和定期追蹤。它是治療以外的預防，不是取代保險套或篩檢。" },
      { id: "hiv-treat", name: "治療即預防", phase: "now", hours: [[9, 17]], keywords: ["U=U", "病毒量", "治療"], text: "確診後儘速治療、病毒量測不到，才能降低再傳染。慢下來的那一截通常不是藥物，是銜接。" },
      { id: "hiv-2030", name: "2030 之前的覆蓋", phase: "mid", hours: [[9, 17]], keywords: ["2030", "污名", "覆蓋率"], text: "第一期在 2026 年結束，2030 仍是目標，不是已經消除。114 年的檢討仍寫著有人不知道自己感染、延遲診斷還在。污名若還在，最需要進來的人不會出現在統計裡。" },
    ],
  },
  {
    id: "hepa",
    no: "10",
    name: "病毒性肝炎",
    pin: "肝炎",
    col: 1,
    row: 5,
    pillars: ["care", "shield"],
    land: "#86b46a",
    accent: "#5fba90",
    kit: "tent",
    blurb: "B 型肝炎靠疫苗世代守住，C 型肝炎靠找完、治完。這座島放在南段，因為篩檢和治療要跟著人群走，不能停在醫學中心的門診。",
    source: "肝炎防治常設業務（B 肝疫苗世代、C 肝口服抗病毒與轉介）。重大政策清單上沒有單獨的肝炎計畫。",
    href: "https://www.cdc.gov.tw/",
    hrefLabel: "疾管署首頁（查詢病毒性肝炎）",
    items: [
      { id: "hepa-b", name: "B 型肝炎疫苗世代", phase: "now", hours: [[9, 17]], keywords: ["B肝", "幼兒", "帶原"], text: "維持幼兒 B 肝接種，守住已經降下來的慢性帶原。這一件和疫苗基金是同一條冷鏈的不同疾病。" },
      { id: "hepa-c", name: "C 型肝炎治療", phase: "now", hours: [[9, 17]], keywords: ["C肝", "口服", "抗病毒"], text: "C 肝用口服抗病毒藥治療。篩檢陽性就要接到開得到藥的院所，不停在一張檢驗報告。" },
      { id: "hepa-screen", name: "高風險與年齡篩檢", phase: "near", hours: [[9, 17]], keywords: ["篩檢", "年齡"], text: "在特定年齡和風險條件提供 B、C 肝篩檢，避免只靠自覺症狀。症狀出現時，往往已經不是公衛要的那個時間點。" },
      { id: "hepa-follow", name: "治完以後仍要有人看", phase: "far", hours: [[9, 17]], keywords: ["追蹤", "復發", "新感染"], text: "治療告一段落後，新感染和需要追蹤的人仍要有出口。消除不是結案公文，是發生率不再回升。" },
    ],
  },
  {
    id: "ipc",
    no: "11",
    name: "感染管制",
    pin: "感管",
    col: 2,
    row: 3,
    pillars: ["care", "ready"],
    land: "#e6e1d2",
    accent: "#62acb6",
    kit: "hospital",
    blurb: "醫院和長照機構是病原會放大的地方。感染管制放在東側的醫療帶，一手接群聚通報，一手把抗生素使用交給離岸的抗藥性島。",
    source: "整備計畫裡的傳染病防治醫療網，以及抗藥性行動計畫裡的感染預防。醫院和長照機構的查核是常設業務。",
    href: "https://www.cdc.gov.tw/Category/Page/J63NmsvevBg2u3I2qYBenw",
    hrefLabel: "看感染管制專頁",
    items: [
      { id: "ipc-hospital", name: "醫院感染管制", phase: "now", hours: [[9, 17]], keywords: ["醫院", "隔離", "查核"], text: "隔離空間、防護裝備和群聚通報要接得上臨床。查核看的是做得到，不是計畫書有沒有這一章。" },
      { id: "ipc-ltc", name: "長照機構群聚", phase: "now", hours: [[9, 17]], keywords: ["長照", "護理之家", "群聚"], text: "流感、腸胃道和呼吸道群聚要早期發現、分艙、訪視。機構裡的一個晚通報，會變成監測島上的一整週。" },
      { id: "ipc-hand", name: "照護點的手部衛生", phase: "now", hours: [[0, 24]], keywords: ["洗手", "順從度"], text: "洗手設備和順從度是最便宜、也最常失效的措施。醫院這一件不下班，因為交班本身就是風險最高的縫。" },
      { id: "ipc-route", name: "特殊病原的動線", phase: "near", hours: [[9, 17]], keywords: ["動線", "後送", "隔離"], text: "特殊病原個案的動線、防護和後送醫院要事先講好。等個案到了急診再找負壓，就不算整備。" },
    ],
  },
  {
    id: "amr",
    no: "12",
    name: "抗藥性 One Health",
    pin: "抗藥性",
    col: -1,
    row: 3,
    pillars: ["care", "sentinel"],
    land: "#b3b48a",
    accent: "#7a6eb8",
    kit: "rings",
    blurb: "抗藥性不在單一科室裡。人醫、動物和環境都有一份，所以這座島離岸，用橋接回實驗室和醫院，而不是蓋在醫院屋頂上。",
    source: "國家級防疫一體抗生素抗藥性管理行動計畫（2025–2029，115 年 3 月修訂）；行政院國家防疫一體聯合行動方案（2026–2030）",
    href: "https://www.cdc.gov.tw/Category/Page/J63NmsvevBg2u3I2qYBenw",
    hrefLabel: "看抗藥性監視專頁",
    items: [
      { id: "amr-steward", name: "人醫抗生素管理", phase: "now", hours: [[9, 17]], keywords: ["抗生素", "管理", "醫院"], text: "醫院的抗生素管理計畫，減少不必要的廣效抗生素。管理的輸入來自處方，不是來自口號。" },
      { id: "amr-watch", name: "抗藥性監視", phase: "now", hours: [[9, 18]], keywords: ["抗藥性", "菌株", "THAS"], text: "臨床分離株的抗藥性比例，按菌種回饋給醫院。沒有持續上傳的藥物敏感性，行動計畫只剩百分比的空格。" },
      { id: "amr-animal", name: "動物與環境", phase: "near", hours: [[9, 17]], keywords: ["One Health", "動物", "環境"], text: "與農業、環境部門對齊動物用藥和環境中的抗藥性。近期要做的是把人醫以外的資料接進來。" },
      { id: "amr-joint", name: "同一張跨部會的桌子", phase: "mid", hours: [[9, 17]], keywords: ["政策會報", "聯合行動", "2029", "自評"], text: "行政院於 114 年 4 月 30 日核定國家防疫一體政策會報。聯合行動方案涵蓋 115 年至 119 年，把人醫、動物、食品和環境放在同一張桌子，範圍比抗藥性大。抗藥性行動計畫是其中的抗藥性切片，收到 2029，115 年 3 月修訂過。核心能力仍是對照國際工具做自評或外部評核。" },
    ],
  },
  {
    id: "ready",
    no: "13",
    name: "防疫整備",
    pin: "整備",
    col: 2,
    row: 2,
    pillars: ["ready"],
    land: "#cec090",
    accent: "#7a6eb8",
    kit: "warehouse",
    blurb: "物資、指揮架構和演練放在實驗室東側。監測跨過門檻時，這裡要從庫存狀態改成部署狀態，而不是開始寫第一份計畫。",
    source: "新興傳染病暨流感大流行應變整備及邊境檢疫計畫（2022–2027）；韌性防疫安全網資訊基盤計畫（2026–2030）",
    href: "https://www.cdc.gov.tw/Category/ListPage/Otpn7pDwnMd2UoVG-QEzdw",
    hrefLabel: "看整備應變專頁",
    items: [
      { id: "ready-stock", name: "防疫物資儲備", phase: "now", hours: [[9, 18]], keywords: ["物資", "防護", "試劑", "效期"], text: "個人防護設備、檢測試劑和治療藥要有安全存量、效期和調撥順位。過期的儲備等於沒有儲備。" },
      { id: "ready-command", name: "指揮與情資架構", phase: "now", hours: [[0, 24]], keywords: ["指揮中心", "疫情中心", "權責"], text: "需要跨部會時，能從日常疫情中心升到指揮中心。權責事先寫好，才不會在事件當天重新發明。" },
      { id: "ready-beds", name: "醫療量能約定", phase: "near", hours: [[9, 17]], keywords: ["病床", "採檢", "急診"], text: "與醫療網約定重症床、採檢和人力，避免單一病原擠垮急診。這是整備計畫裡還沒有完全變成日常的那一截。" },
      { id: "ready-drill", name: "演練", phase: "now", hours: [[9, 16]], keywords: ["演練", "桌演", "實兵"], text: "用桌面演練和實兵找出計畫寫得通、現場做不到的段落。沒有事後清單的演練，只是活動。" },
      { id: "ready-info", name: "防疫資訊基盤", phase: "mid", hours: [[9, 18]], keywords: ["資訊", "資安", "資料治理", "AI"], text: "資訊基盤計畫自 115 年至 119 年。五條策略是韌性與安全的資訊基礎（含配合防疫中心興建的資安標準機房）、資料治理、交換與通報標準、防疫服務裡的人工智慧，以及資訊人才。這一項是整備島上的資訊，不取代演練。" },
    ],
  },
  {
    id: "global",
    no: "14",
    name: "國際衛生",
    pin: "國際",
    col: 2,
    row: 1,
    pillars: ["sentinel", "gate"],
    land: "#7fb3a2",
    accent: "#5cb1bc",
    kit: "antenna",
    blurb: "境外的疫情情報要在國內出現病例之前進到值勤畫面。這座島放在東北，面向境外；臺灣依國際衛生條例的核心能力自我檢視，並和合作對象交換情資。",
    source: "國際合作與 IHR 國家對口常設業務",
    href: "https://www.cdc.gov.tw/Category/Page/pLGVAwA60glWsIoMUWKNYA",
    hrefLabel: "看國際衛生條例對口頁",
    items: [
      { id: "global-intel", name: "國際疫情交換", phase: "now", hours: [[9, 21]], keywords: ["情資", "鄰近", "交換"], text: "合作國家和鄰近地區的事件，要進到疫情中心的值勤，而不是停在一份轉寄的電子報。" },
      { id: "global-ihr", name: "核心能力檢視", phase: "now", hours: [[9, 17]], keywords: ["IHR", "核心能力", "對口"], text: "依國際衛生條例的核心能力自我檢視：偵測、通報、應變和邊境。聯合行動方案寫的也是對照國際工具做自評或外部評核。對口要有名字和班表，不能只有一個信箱。" },
      { id: "global-people", name: "人才與技術合作", phase: "near", hours: [[9, 17]], keywords: ["培訓", "FETP", "技術"], text: "防疫訓練和技術合作是近期要維持的管道。人的網絡比臨時的視訊會議耐用。" },
      { id: "global-say", name: "對內說明與對外同步", phase: "now", hours: [[10, 21]], keywords: ["風險溝通", "記者會", "說明"], text: "對公眾的說明和對合作對象的通報要是同一套事實。兩個版本的數字，會先在國內被發現。" },
    ],
  },
];

export const flows = [
  { id: "f01", a: "border", b: "watch", title: "入境訊號進監測", carried: "旅遊史名單", text: "邊境的異常症狀和旅遊史，當天就要變成疫情中心看得到的訊號。" },
  { id: "f02", a: "border", b: "lab", title: "跨境檢體鑑定", carried: "檢體", text: "邊境採到的檢體走參考實驗室，確認是已知病原，還是需要升級處理的新型。" },
  { id: "f03", a: "watch", b: "lab", title: "通報接著檢驗", carried: "檢體", text: "監視上升若沒有檢驗型別，只知道有人病了，不知道是哪一種在傳。" },
  { id: "f04", a: "watch", b: "ready", title: "預警啟動整備", carried: "預警單", text: "監測跨過門檻，物資、床位和溝通腳本從庫存狀態改成部署狀態。" },
  { id: "f05", a: "vax", b: "flu", title: "季節免疫", carried: "疫苗", text: "流感疫苗打在重症監視指出的高風險族群，而不是打完才回頭看嚴重度。" },
  { id: "f06", a: "ready", b: "flu", title: "抗病毒調度", carried: "藥品", text: "流行期合約醫院的藥量不夠時，儲備庫存要按重症曲線調過去。" },
  { id: "f07", a: "flu", b: "border", title: "大流行的兩端", carried: "整備計畫", text: "流感大流行整備是同一份計畫：一端在社區用藥，一端在邊境放大檢疫。" },
  { id: "f08", a: "entero", b: "watch", title: "校園回報", carried: "缺勤", text: "幼兒園的停課和缺勤，比個別重症通報更早告訴監測網這一波開始了。" },
  { id: "f09", a: "entero", b: "ipc", title: "同一套洗手", carried: "衛教", text: "校園的手部衛生和醫院的手部衛生是同一種措施，對象不同。" },
  { id: "f10", a: "dengue", b: "watch", title: "密度校正病例", carried: "密度", text: "病媒蚊指數上升而還沒有本土病例時，就該先清孳生源，不等確診。" },
  { id: "f11", a: "dengue", b: "border", title: "病媒不要入境", carried: "查核", text: "社區在清積水的同時，交通工具檢疫要擋住境外蚊媒。" },
  { id: "f12", a: "hiv", b: "hepa", title: "一次篩檢，兩種消除", carried: "篩檢單", text: "愛滋和病毒性肝炎的風險族群有重疊，篩檢和轉介可以走同一條動線。" },
  { id: "f13", a: "tb", b: "lab", title: "分子分型找群聚", carried: "菌株", text: "結核接觸者調查若加上基因型別，才分得出是同一條傳播鏈，還是巧合。" },
  { id: "f14", a: "amr", b: "lab", title: "抗藥性要有菌株", carried: "菌株", text: "管理計畫上的百分比，來自實驗室持續上傳的藥物敏感性。" },
  { id: "f15", a: "ipc", b: "amr", title: "管制數據餵管理", carried: "使用量", text: "醫院感染管制看到的群聚和抗生素使用，是 One Health 人醫端的輸入。" },
  { id: "f16", a: "global", b: "watch", title: "國際情資換班", carried: "情資", text: "合作對象的事件，要在國內出現病例前就進到值勤畫面。" },
  { id: "f17", a: "lab", b: "global", title: "定序貢獻判斷", carried: "序列", text: "國內流行株的基因體，是對外說明和風險判斷的依據，不只是一則國內新聞。" },
  { id: "f18", a: "vax", b: "ready", title: "冷鏈與緊急調撥", carried: "冷鏈", text: "疫苗基金的常規冷鏈，大流行時要能改成緊急接種的配送網。" },
];

export function hourCovers(spans, hour) {
  return spans.some(([a, b]) => (a <= b ? hour >= a && hour < b : hour >= a || hour < b));
}

export function dayNote(minutes) {
  const hour = minutes / 60;
  return dayNotes.find((n) => hour >= n.from && hour < n.to) ?? dayNotes[0];
}

export function itemCount() {
  return islands.reduce((n, island) => n + island.items.length, 0);
}

export function validate() {
  const errors = [];
  const ids = new Map(islands.map((island) => [island.id, island]));
  const coords = new Set();
  const phasesOk = new Set(["now", "near", "mid", "far"]);
  const pillarIds = new Set(pillars.map((p) => p.id));
  for (const island of islands) {
    const key = `${island.col},${island.row}`;
    if (coords.has(key)) errors.push(`duplicate coord ${key}`);
    coords.add(key);
    if (!island.pillars.length) errors.push(`${island.id} has no pillar`);
    for (const pillar of island.pillars) {
      if (!pillarIds.has(pillar)) errors.push(`${island.id} bad pillar ${pillar}`);
    }
    for (const item of island.items) {
      if (!phasesOk.has(item.phase)) errors.push(`${item.id} bad phase`);
      if (!Array.isArray(item.hours) || !Array.isArray(item.hours[0])) errors.push(`${item.id} bad hours`);
    }
  }
  for (const flow of flows) {
    if (!ids.has(flow.a) || !ids.has(flow.b)) errors.push(`flow ${flow.id} endpoint`);
    if (flow.a === flow.b) errors.push(`flow ${flow.id} loop`);
  }
  if (islands.length !== 14) errors.push("expected 14 islands");
  if (errors.length) throw new Error(errors.join("; "));
  return { islands: islands.length, items: itemCount(), flows: flows.length, pillars: pillarName };
}
