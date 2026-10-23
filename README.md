# 疾管署政策發展島

十四座六邊形島排成臺灣輪廓。一座島是一項公開的防治工作，島上的房子是具體工作，島與島之間的弧是交接。

線上版：<https://ancientsky.github.io/cdc-policy-island/>

本島依疾病管制署公開計畫與常設業務整理，用來看出政策之間怎麼相連。這不是疾病管制署官方網站。衛生福利部施政計畫和年度計畫評核是管考，沒有另做成一座島。海面上的病原和對岸的陰影是這張圖自己的警示，不是署的說法。

內容以疾管署 [重大政策](https://www.cdc.gov.tw/Category/MPage/kVzFWokFW3l9_YeB8idzuw) 為準，中文是原文。英文和日文是對照說明，不是官方譯名。

## 怎麼看

- 點一座島，或從右側清單進去。房子是一項工作。
- 弧線預設不畫。點到相關的島，或打開「協作線」，才看得到交接。
- 下方的一天表示這個鐘點誰在值班。晨、午、晚、夜跟時鐘走，不是另一套皮膚。
- 語言是「中 / EN / 日」。階段可以只看本期、近期、中程或長期。主軸可複選：監測預警、邊境阻絕、免疫防護、防治網絡、整備韌性。
- 拖曳旋轉，滾輪拉近。手機上同一套操作。

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

## English

An interactive map of public Taiwan CDC programs, arranged as fourteen hexes in the outline of Taiwan. Buildings are pieces of work. Arcs are handoffs. This is not an official Taiwan CDC website. Chinese text is the source. English and Japanese are descriptive translations, not official titles.

The pathogens offshore and the far shore are this picture’s own warning. They are not a statement by Taiwan CDC.
