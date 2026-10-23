# 防疫島大冒險

十四座六邊形島排成臺灣輪廓。一座島是一項公開的防治工作，島上的房子是具體工作，島與島之間的弧是交接。

線上版：<https://ancientsky.github.io/cdc-policy-island/>

本站依疾病管制署公開資料整理，非官方網站。資料截至 2026 年 10 月。

資料年份常數是 `src/data.js` 的 `DATA_AS_OF`（目前 `2026-10`）。

內容以疾管署 [重大政策](https://www.cdc.gov.tw/Category/MPage/kVzFWokFW3l9_YeB8idzuw) 為準，中文是原文。英文和日文是對照說明，不是官方譯名。

## 怎麼看

- 點一座島，或從清單進去。房子是一項工作。
- 弧線預設不畫。點到相關的島，或打開「協作線」，才看得到交接。
- 下方的一天表示這個鐘點誰在值班。清晨、正午、黃昏、夜裡跟著這條時間走。
- 語言在左上角「中 ▾」。階段和主軸在「篩選」裡。主軸可複選：監測預警、邊境阻絕、免疫防護、防治網絡、整備韌性。
- 拖曳旋轉，滾輪拉近。手機上同一套操作。
- 海上有五隻病菌，各自朝自己的島靠近：登革熱島旁的蚊子對上清積水，口岸的蚊子對上入境檢疫，流感病毒對上接種，腸病毒對上洗手，結核桿菌對上把藥吃完。這是比喻，不是署的作業流程。

## 十四座島

| | 島 | 在看的事 |
| --- | --- | --- |
| 01 | 疫情監測 | 急性傳染病流行風險監控與管理第四期（2025–2028） |
| 02 | 口岸檢疫 | 新興傳染病暨流感大流行應變整備及邊境檢疫（2022–2027） |
| 03 | 實驗室網絡 | 後新冠檢驗網絡（2025–2030）、防疫中心興建（2021–2032） |
| 04 | 預防接種 | 疫苗基金第四期（2024–2028）、疫苗產業韌性（2026–2030） |
| 05 | 流感與呼吸道 | 與整備、急性監測交界的常設業務 |
| 06 | 腸病毒與校園 | 第四期計畫裡的腸病毒與腸道傳染病 |
| 07 | 登革熱與病媒 | 第四期計畫裡的病媒監測與孳生源清除 |
| 08 | 結核消除 | 加入 WHO 2035 消除結核第三期（2026–2030）。2035 是目標年 |
| 09 | 愛滋消除 | 2030 年消除愛滋第一期（2022–2026）。第一期還沒有做完 |
| 10 | 病毒性肝炎 | 常設業務。B 肝疫苗世代，C 肝口服抗病毒與轉介 |
| 11 | 感染管制 | 醫療網、感染預防，以及醫院和長照的查核 |
| 12 | 抗藥性 One Health | 抗藥性行動計畫（2025–2029）與防疫一體聯合行動方案（2026–2030） |
| 13 | 防疫整備 | 整備及邊境檢疫計畫，加上資訊基盤（2026–2030） |
| 14 | 國際衛生 | 國際衛生條例核心能力的自我檢視，以及情資交換 |

## 在本機跑

需要 Node.js 22。

```bash
npm install
npm run dev
```

開發伺服器在 <http://localhost:5173/>。

```bash
npm run build
npm run preview
```

`npm run build` 在本機把網站放在網站根目錄。GitHub Pages 建置時會把 `VITE_BASE` 設成 `/cdc-policy-island/`。

## 發布

推上 `main` 之後，`.github/workflows/pages.yml` 會安裝依賴、建置，並部署到 GitHub Pages。

## 開發規範

不得複製第三方網站的程式碼、模型、文案或資產。

- 只能學技巧後自己重寫。禁止複製或改寫任何 JS/CSS 片段、數值表、3D 模型的零件參數、SVG 圖示、文案句型、標題、按鈕名稱、教學步驟結構、logo 或截圖。
- 不得在網站、README、commit 訊息或程式註解中提及參考網站的名稱或網址。
- 新寫的每個 3D 模組檔頭加一行：`// Original implementation for this project. Not derived from third-party source code.`

## English

An interactive map of public Taiwan CDC programs, arranged as fourteen hexes in the outline of Taiwan. Buildings are pieces of work. Arcs are handoffs. This site is arranged from public Taiwan CDC material. It is not an official site. Data as of October 2026. Chinese text is the source. English and Japanese are descriptive translations, not official titles.

Five germs offshore each move toward their own island: a mosquito by dengue meets emptied water, a mosquito by the port meets screening, an influenza virus meets vaccination, an enterovirus meets handwashing, and a tuberculosis bacillus meets finishing the medicine. That picture is a metaphor, not an operating procedure.
