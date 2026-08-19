# Locator Stability Report — đề xuất thêm `data-testid` cho GRVT Web

**Ngày:** 2026-08-19 · **Người lập:** QA (viet.pham@grvt.io) · **Gửi:** Web Dev Team

**Env đã kiểm tra (login thật bằng passwordless `viet_trans@mailinator.com`):**

| Env | URL | Trạng thái crawl |
|---|---|---|
| staging | https://market.staging.gravitymarkets.io | 19/19 route, đã login |
| testnet | https://testnet.grvt.io | 18/19 route, đã login |
| prod | https://grvt.io | 18/19 route, đã login (bỏ qua flow cần balance) |

**Cách làm:** login thật vào cả 3 env → crawl 19 route đã auth → dump toàn bộ DOM (class, id, aria-label, data-*, button text, placeholder) → chạy **302 locator tĩnh** lấy trực tiếp từ page objects của `qa-automation/ui_tests/pages` lên DOM thật của từng env và đếm số element khớp. Con số `S / T / P` trong các bảng dưới là **số element thật sự khớp** trên staging / testnet / prod, không phải suy đoán.

---

## 1. Kết luận ngắn

> **Toàn bộ web app GRVT hiện không có một thuộc tính test-hook nào.** Trên 19 route × 3 env, số element có `data-testid` / `data-test-id` / `data-test` / `data-qa` / `data-cy` = **0**. Trong repo automation, 100% `data-testid` đang dùng là của **extension MetaMask**, không phải của app.

Hệ quả: **730 locator** trong 28 page object phải bám vào text hiển thị, tên class do build sinh ra, hoặc vị trí trong cây DOM.

| Cách locator đang bám vào | Số locator | Vỡ khi dev làm gì |
|---|---|---|
| **Text hiển thị** (`text()=`, `contains(text(),…)`, `normalize-space()`) | 347 | Đổi copy, sửa chính tả, đổi ngôn ngữ, thêm icon vào label |
| **Vị trí DOM** (`following-sibling`, `parent::`, `[1]`, `[last()]`) | 224 | Thêm/bớt một `<div>` wrapper, đổi thứ tự, thêm tooltip |
| **Tên class** (`contains(@class,…)`, `[class*=…]`) | 210 | Đổi tên class SCSS, refactor CSS module, đổi utility class |
| `aria-label` / `role` / `placeholder` | 117 | Tương đối ổn, nhưng vẫn đổi khi làm i18n |
| **`id` hoặc `data-*`** | **4** | — |

**516/730 locator (71%)** phụ thuộc ít nhất một trong ba thứ dev thay đổi thường xuyên nhất: text, class, cấu trúc DOM.

---

## 2. Bằng chứng: cùng một locator, 3 env cho kết quả khác nhau

Đây là phần quan trọng nhất — chứng minh rằng locator hiện tại **không portable giữa các env**, nên mỗi lần một env deploy trước là test env đó gãy.

Chạy 302 locator tĩnh lên DOM thật: **22 locator resolve trên env này nhưng = 0 element trên env khác.**

| Element | Locator | S | T | P | Nguyên nhân |
|---|---|---|---|---|---|
| Danh sách sector (market search) | `//*[@class='overflow-auto fx-column fx-jc-center gap-2 px-3 sm-px-4']` | **0** | 1 | 1 | staging đổi chuỗi utility class → match tuyệt đối `@class=` hỏng |
| Instrument selector | `//div[normalize-space()='Perpetual' and contains(preceding-sibling::div,'USDT')]/preceding-sibling::div` | **0** | 1 | 1 | staging đổi cấu trúc sibling |
| Rows trading account | `//*[text()='Trading Account']/parent::*[1]/following-sibling::*[1]/div` | **0** | 10 | 1 | vừa lệch env vừa mơ hồ (10 vs 1 element) |
| Count trading accounts | `//*[text()='Trading accounts']/following-sibling::*[1]` | 1 | **0** | **0** | chỉ staging có chữ này |
| Nút Download app | `//*[@aria-label="Download app"]` | **0** | 1 | 1 | staging chưa có nút |
| Nút More options | `//button[normalize-space()='More options']` | **0** | 1 | 1 | staging chưa có nút |
| Toast | `.Toastify__toast` / `//*[@class='Toastify']//*[@role="alert"]` | **0** | **0** | 1 | prod dùng Toastify, staging/testnet render khác |
| Close All (position) | `//button[starts-with(normalize-space(),'Close All')]` | **0** | 1 | **0** | chỉ testnet có |
| Dropdown "Deposit via" / "Deposit in" | `//*[text()='Deposit via']/parent::label[1]/following-sibling::div[1]` | **0** | **0** | 1 | chỉ prod dùng label này |
| Nút Transfer/Move (mint) | `//*[@alt='mint-tokens']/following-sibling::div//button[text()='Transfer' or text()='Move']` | 1 | 1 | **0** | prod không có mint |
| Icon "+" add funds | `//*[name()='svg' and .//*[name()='path' and starts-with(@d,'M7.33337 7.33334')]]/…` | 1 | 1 | **0** | **locate bằng toạ độ vector của icon** — designer sửa icon là gãy |
| Banner close | `//*[contains(@class,'notification-banner')]//*[contains(@class,'txt-icon-secondary') and contains(@class,'pointer')]` | 1 | 1 | **0** | class trạng thái |

### 2.1 Khác biệt cấu trúc giữa các env

| Điểm khác | staging | testnet | prod |
|---|---|---|---|
| Root container | `div#app-root` | `div#__next` | `div#__next` |
| Marker Next.js | `data-precedence` (App Router) | `data-n-css`, `data-next-head`, `data-nscript` (Pages Router) | giống testnet |
| Nút "Live Trading" | có | có | **không** |
| Nút "More options" | **không** | có | có |
| Placeholder ô search market | `"Search market"` | `"Search"` | `"Search"` |
| `aria-label="switch margin mode"` | có | **không** | **không** |
| Filter market (Favorites / All / Classic Perps / Spot / Crypto / Equities) | có | **không** | **không** |
| `/exchange/deposit-yield` | có | 404 | 404 |
| Toast container | — | — | `Toastify` |

→ staging đang chạy **một app shell khác hẳn** (App Router) so với testnet/prod (Pages Router). Mọi locator bám cấu trúc DOM đều phải viết hai nhánh.

### 2.2 Class name là hash do build sinh ra

Class trong app có dạng `style-module-scss-module__9thdKW__headerWrapper`. Phần `9thdKW` là **hash nội dung file SCSS** — đổi file SCSS là đổi hash.

- Tổng số hash quan sát được trên 3 env: **78**
- Dùng chung cả 3 env: **59**
- Chỉ có trên staging: **9** (`6CsbWq, PbjbEa, Xq19VW, JWglFq, AG9hQa, bbAiqG, 1GDYZW, qVaYcq, R7X8Aq`)
- Chỉ có trên prod: **3** (`GIhftG, H00UuW, n4u7Fq`)
- Chỉ có trên testnet: **1** (`rYr9ka`)

Test hiện phải viết `contains(@class,'headerWrapper')` để né hash. Nhưng cách này gãy ngay khi:
- suffix bị đổi tên (`headerWrapper` → `topBar`)
- có component thứ hai cũng chứa `headerWrapper` trong tên → selector match nhiều element

---

## 3. Những locator "không thể bảo trì" — ưu tiên xử lý trước

Đây là các trường hợp automation buộc phải dùng vì không còn hook nào khác:

| # | Nơi dùng | Locator | Vấn đề |
|---|---|---|---|
| 1 | ROI input trong TP/SL dialog | `…//div[@style="width: 160px;"]//input[contains(@class,'text-field')]` | **Bám vào `width: 160px` inline style.** Đổi width là gãy. |
| 2 | Tabs layout | `//*[@style='width: 100%; height: 684px;']//div[contains(@class,'_tabs')]/div` | **Bám vào chiều cao 684px.** |
| 3 | Nút close dialog trên cùng | `//*[@role='dialog' and contains(@style,'z-index: 1001')]//span[contains(@class,'pointer')]` | **Bám vào z-index** để biết dialog nào đang ở trên. |
| 4 | Icon "+" add funds (spot) | `//*[name()='svg' and .//*[name()='path' and starts-with(@d,'M7.33337 7.33334')]]/…` | **Bám vào path data của SVG.** |
| 5 | Chuông price alert | `(//*[name()='path' and starts-with(@d,'M12 4C9.8245 4 7.97109 5.38991')]/ancestor::span[…])[1]` | Như trên. |
| 6 | Nút đổi đơn vị quantity | `//span[text()='\|']/following-sibling::div[1]/span[contains(@class,'__icon')]` | **Locate bằng ký tự gạch đứng `\|`.** |
| 7 | Nút Create trading account | `${avatar}/parent::*/parent::*/parent::*//button[…]` | Leo 3 tầng parent. |
| 8 | Sector list | `//*[@class='overflow-auto fx-column fx-jc-center gap-2 px-3 sm-px-4']` | Match tuyệt đối 6 utility class. Thêm 1 class là gãy. Đã gãy trên staging. |
| 9 | Layout alignment (i18n) | `//*[@class='fx-column gap-6']/div[1]/div[2]/div[1]/span[2]/span[1]` | Chuỗi index thuần. |
| 10 | Row cuối trong bảng | `(${allInstrumentRows})[last()]` | Phụ thuộc thứ tự render. |

Ngoài ra: **98 locator** dùng index kiểu `[1]`, `[2]`, `[last()]`, `/div[3]`; **15 locator** bám inline style.

---

## 4. Locator mơ hồ — match nhiều element cùng lúc

37 locator match >1 element, tức là đang phụ thuộc "cái đầu tiên tìm thấy". Thêm một element cùng loại vào trang là test chọn nhầm mà không báo lỗi:

| Locator | S | T | P |
|---|---|---|---|
| `//*[contains(@class,'tabItem')]` | 20 | 25 | 25 |
| `//*[contains(@class,'sticky top-0') or contains(@class,'tableRow')]` | 31 | 25 | 25 |
| `//*[contains(@class,'_tableRow')]/div` | 30 | 25 | 25 |
| `//*[contains(@class,'sticky top-0')]/following-sibling::div` | 30 | 10 | 9 |
| `//*[contains(text(),'Mark')]/following-sibling::*[1]` | 5 | 4 | 4 |
| `//a[@href='/exchange/portfolio']` | 2 | 2 | 2 |
| `//*[normalize-space()='All assets']` | 5 | 5 | 5 |
| `//*[contains(., 'Buy') and contains(@class, 'green')]` | 2 | 2 | 2 |
| `//button[contains(@class,'__buy')] \| //button[normalize-space()='Buy / Long']` | 2 | 2 | 2 |
| `//*[starts-with(text(),'TradingAccount')]` | 2 | 2 | 2 |

---

## 5. Đề xuất cụ thể cho Dev team

### 5.1 Quy ước

Dùng **`data-testid`** (chuẩn của Playwright/Testing Library), kebab-case, đặt tên theo `<khu-vuc>-<phần-tử>-<vai-trò>`:

```
data-testid="order-form-price-input"
data-testid="order-form-submit-buy"
data-testid="header-user-menu"
data-testid="positions-table-row"
```

Với danh sách/bảng, đặt trên **container + từng row**, kèm khoá định danh:

```html
<tbody data-testid="positions-table">
  <tr data-testid="positions-table-row" data-instrument="BTC-USDT">
```

Nguyên tắc: **`data-testid` là API công khai giữa dev và QA** — không đổi khi refactor UI. Đổi thì báo trước như đổi API.

### 5.2 Không cần làm hết một lượt

Chia 3 đợt, theo đúng thứ tự test hay gãy nhất:

**Đợt 1 — Global + Trading (chặn nhiều test nhất)**

| Khu vực | Element cần testid |
|---|---|
| Header | logo, main nav item, user menu/avatar, language, settings, notifications, download app, Log in, Sign up |
| Toast | container, nội dung toast, nút close |
| Dialog | container dialog, title, nút close, nút Confirm/Cancel |
| Order form (perpetual + spot) | tab Limit/Market/Scale, ô Order price, ô Quantity, nút đổi đơn vị, slider, checkbox TP/SL, Post-only, Reduce-only, Time in Force, nút Buy/Long, Sell/Short, nút Trading Login |
| Order book | container, hàng bid, hàng ask, spread |
| Bảng dưới | tab Positions/Open Orders/Order History/Trade History, từng row, nút Close/Close All/Reverse |
| Instrument selector | nút mở, ô search, từng row kết quả, filter sector |

**Đợt 2 — Account + Funding**

| Khu vực | Element cần testid |
|---|---|
| Account overview | Total Equity, số dư funding, danh sách trading account, nút Manage |
| Deposit / Withdraw / Transfer | dropdown chọn network/token/tài khoản, ô amount, nút Max, nút submit, địa chỉ ví + nút copy |
| Address book | nút Add recipient, ô name/address, danh sách, nút xoá |
| Security | API key, secret key, 2FA |
| History | tab, filter, row, nút Export |

**Đợt 3 — Rewards / Strategies / Leaderboard**

Vaults, referral hub, liquidity league, funding comparison, price alert dialog, split TP/SL dialog.

### 5.3 Xin ưu tiên: đồng bộ hoá 3 env

12 locator ở mục 2 gãy **chỉ vì env lệch nhau**. Nếu dev thêm `data-testid` cùng tên trên cả 3 env, phần này biến mất hoàn toàn — kể cả khi UI staging và prod khác nhau về nội dung.

### 5.4 Chi phí ước tính

Khoảng **150–200 element** cần đánh dấu, tập trung ở ~15 component. Đa số là thêm một attribute vào JSX. Đổi lại QA gỡ được ~516 locator dễ vỡ và cắt phần lớn nhóm lỗi `SCRIPT / brittle-locator` trong triage hằng ngày.

---

## 6. Phụ lục — danh sách đầy đủ theo page

Cột **S / T / P** = số element khớp thật trên staging / testnet / prod khi crawl ngày 2026-08-19. `_template_` = locator ghép chuỗi động, không verify tĩnh được. `-` = locator chỉ xuất hiện trong dialog/flow chưa mở lúc crawl.

### /exchange/account/address-book  
_15 locator rủi ro_

| Element (biến trong code) | Locator hiện tại | Loại rủi ro | Nguồn | Kết quả thật S / T / P |
|---|---|---|---|---|
| `addWalletBtn` | `//*[contains(text(),'Add wallet recipient')]` | TEXT | addressBookPage.ts:20 | 0 / 0 / 0 |
| `addFriendBtn` | `//*[contains(text(),'Add Grvt friend')]` | TEXT | addressBookPage.ts:21 | 0 / 0 / 0 |
| `walletRows` | `//*[contains(text(),'Add wallet recipient')]/following-sibling::div` | TEXT+POSITION | addressBookPage.ts:22 | 0 / 0 / 0 |
| `friendRows` | `//*[contains(text(),'Add Grvt friend')]/following-sibling::div` | TEXT+POSITION | addressBookPage.ts:23 | 0 / 0 / 0 |
| `networkControl` | `${dlg}//*[contains(@class,'-control')]` | CLASS | addressBookPage.ts:28 | _template_ |
| `dontAskAgain2FA` | `//*[contains(text(),'security risks of not enabling 2FA')]` | TEXT | addressBookPage.ts:29 | 0 / 0 / 0 |
| `openTab` | `${walletRows}[.//*[contains(normalize-space(.),'${name}')]]` | TEXT | addressBookPage.ts:67 | _template_ |
| `openTab` | `${friendRows}[.//*[contains(normalize-space(.),'${name}')]]` | TEXT | addressBookPage.ts:79 | _template_ |
| `selected` | `${networkControl}//*[normalize-space(.)='${network}']` | TEXT | addressBookPage.ts:91 | _template_ |
| `result` | `${dlg}//*[contains(normalize-space(.),'${query}')]` | TEXT | addressBookPage.ts:226 | _template_ |
| `networkLoc` | `${card}//*[contains(normalize-space(.),'${networkDisplay}')]` | TEXT | addressBookPage.ts:274 | _template_ |
| `otherLoc` | `${card}//*[normalize-space(.)='${other}']` | TEXT | addressBookPage.ts:284 | _template_ |
| `nameInput` | `(${dlg}//input)[1]` | POSITION | addressBookPage.ts:343 | _template_ |
| `result` | `${dlg}//*[contains(normalize-space(.),'@${query}') and not(.//*[contains(normalize-space(.),'@${query}')])]` | TEXT | addressBookPage.ts:354 | _template_ |
| `nameInput` | `(${dlg}//input)[last()]` | POSITION | addressBookPage.ts:372 | _template_ |

### /exchange/account/history/*  
_9 locator rủi ro_

| Element (biến trong code) | Locator hiện tại | Loại rủi ro | Nguồn | Kết quả thật S / T / P |
|---|---|---|---|---|
| `exportTriggerBtn` | `//button[normalize-space()='Export']` | TEXT | exportHistoryPage.ts:25 | 1 / 1 / 1 |
| `exportPopupSubmitBtn` | `//button[starts-with(normalize-space(), 'Export (')]` | TEXT | exportHistoryPage.ts:26 | 0 / 0 / 0 |
| `reportTypeLabel` | `//div[normalize-space()='Report Type']` | TEXT | exportHistoryPage.ts:27 | 0 / 0 / 0 |
| `timeRangeLabel` | `//div[normalize-space()='Time Range']` | TEXT | exportHistoryPage.ts:28 | 0 / 0 / 0 |
| `historyRows` | `//*[@role='dialog']//div[contains(@class,'tableRow')]` | CLASS+ARIA | exportHistoryPage.ts:29 | 0 / 0 / 0 |
| `downloadBtn` | `${historyRow(rowIndex)}//button[2]` | POSITION | exportHistoryPage.ts:49 | _template_ |
| `headerCells` | `//*[contains(@class,'sticky top-0')]/div[1]/div` | CLASS+POSITION | tradingHistoryPage.ts:9 | 14 / 14 / 14 |
| `bodyRow` | `//*[contains(@class,'sticky top-0')]/following-sibling::div` | CLASS+POSITION | tradingHistoryPage.ts:10 | 30 / 10 / 9 |
| `activeTab` | `//*[contains(@class,'__tabs')]//*[contains(@class,'style_active') or contains(@class,'_active')]/span` | CLASS | tradingHistoryPage.ts:11 | 5 / 6 / 6 |

### /exchange/account/overview  
_36 locator rủi ro_

| Element (biến trong code) | Locator hiện tại | Loại rủi ro | Nguồn | Kết quả thật S / T / P |
|---|---|---|---|---|
| `header` | `//*[contains(@class,'headerWrapper')]` | CLASS | accountpage.ts:14 | 1 / 1 / 1 |
| `loginHeaderBtn` | `${header}//*[text()='Log in']` | TEXT | accountpage.ts:16 | _template_ |
| `signupHeaderBtn` | `${header}//*[text()='Sign up']` | TEXT | accountpage.ts:17 | _template_ |
| `totalEquitySum` | `//*[text()='Total Equity (SUM)']//*[text()='USD']/preceding-sibling::*[1]` | TEXT+POSITION | accountpage.ts:18 | 0 / 0 / 0 |
| `totalEquityUsd` | `//*[text()='Total Equity']//*[text()='USD']/preceding-sibling::*[1]` | TEXT+POSITION | accountpage.ts:19 | 0 / 0 / 0 |
| `totalEquityUsdt` | `(//*[text()='Total Equity']//*[text()='USDT']/preceding-sibling::*[1])[1]` | TEXT+POSITION | accountpage.ts:20 | 0 / 0 / 0 |
| `tradingAccountRows` | `//*[text()='Trading Account']/parent::*[1]/following-sibling::*[1]/div` | TEXT+POSITION | accountpage.ts:21 | 0 / 10 / 1 |
| `tradingAccountCount` | `//*[text()='Trading accounts']/following-sibling::*[1]` | TEXT+POSITION | accountpage.ts:22 | 1 / 0 / 0 |
| `manageBtn` | `//*[text()='Manage']` | TEXT | accountpage.ts:24 | 1 / 1 / 1 |
| `createManageBtn` | `${dialogLoc}//*[contains(text(),'Create & Manage')]` | TEXT | accountpage.ts:25 | _template_ |
| `apiKeyLoc` | `(//*[text()='API Key']//following-sibling::*//*[contains(@class,'txt-hover-text-01')])[1]` | CLASS+TEXT+POSITION | accountpage.ts:26 | 0 / 0 / 0 |
| `privateKey` | `(//*[text()='Secret Private Key']//following-sibling::*//*[contains(@class,'txt-hover-text-01')])[1]` | CLASS+TEXT+POSITION | accountpage.ts:27 | 0 / 0 / 0 |
| `storedKeyCheckBox` | `//label//*[contains(text(),'I have stored')]` | TEXT | accountpage.ts:28 | 0 / 0 / 0 |
| `continueWithEmailBtn` | `//*[text()='Continue with Email' or text()='Connect email' or text()='Continue']` | TEXT | accountpage.ts:30 | 0 / 0 / 0 |
| `confirmBtn` | `//button[text()='Confirm']` | TEXT | accountpage.ts:31 | 0 / 0 / 0 |
| `errorLoc` | `//*[contains(@class,'__error')]` | CLASS | accountpage.ts:32 | 0 / 1 / 0 |
| `resendCodeBtn` | `//*[text()='Resend code']` | TEXT | accountpage.ts:33 | 0 / 0 / 0 |
| `enterCodeTitle` | `//*[text()='Verify your email' or text()='Enter code']` | TEXT | accountpage.ts:34 | 0 / 0 / 0 |
| `tradingLoginBtn` | `//button[contains(text(),'Trading Login') or contains(text(),'Connect SecureKey') or contains(text(),'Create trading account')]` | TEXT | accountpage.ts:35 | 0 / 0 / 0 |
| `createTradingAccountPopup` | `${dialogLoc}//*[contains(text(),'Create trading account')]` | TEXT | accountpage.ts:36 | _template_ |
| `createTradingAccountBtn` | `//*[contains(text(),'Create trading account')]` | TEXT | accountpage.ts:37 | 0 / 0 / 0 |
| `buyBtn` | `//button[contains(@class,'__buy')]` | CLASS | accountpage.ts:38 | 1 / 1 / 1 |
| `signWithSecureKey` | `${dialogLoc}//*[contains(text(),'Sign with SecureKey')]` | TEXT | accountpage.ts:39 | _template_ |
| `continueBtn` | `//*[text()='Continue']` | TEXT | accountpage.ts:40 | 0 / 0 / 0 |
| `assetsOverviewToggle` | `//*[*[text()='Assets Overview']]/span` | TEXT | accountpage.ts:41 | 0 / 0 / 0 |
| `fundingAccountToggle` | `//*[*[text()='Funding Account']]/span` | TEXT | accountpage.ts:42 | 0 / 0 / 0 |
| `tradingAccountsToggle` | `//*[*[text()='Trading Accounts']]/span` | TEXT | accountpage.ts:43 | 0 / 0 / 0 |
| `nameLoc` | `${bodyRow}[${i}]//*[text()='Name']/following-sibling::div[1]/span[1]` | TEXT+POSITION | accountpage.ts:121 | _template_ |
| `idLoc` | `${bodyRow}[${i}]//*[text()='Name']/following-sibling::div[2]` | TEXT+POSITION | accountpage.ts:122 | _template_ |
| `strategyTagLoc` | `${bodyRow}[${i}]//*[contains(@class,'tagLabel') and normalize-space(.)='Strategy']` | CLASS+TEXT | accountpage.ts:123 | _template_ |
| `addTradingAcc` | `//*[normalize-space(text())='${BTN.addTradingAccount}']` | TEXT | accountpage.ts:278 | _template_ |
| `confirmBtn` | `//*[text()='Continue' or text()='${BTN.confirm}']` | TEXT | accountpage.ts:288 | _template_ |
| `isAPIKeyAlreadyExists` | `(//*[text()='${apiLabel}'])[1]` | TEXT+POSITION | accountpage.ts:346 | _template_ |
| `createAPIKey` | `//*[*[text()='API Key']]/following-sibling::input` | TEXT+POSITION | accountpage.ts:364 | 0 / 0 / 0 |
| `createAPIKey` | `//*[*[text()='Secret Private Key']]/following-sibling::input` | TEXT+POSITION | accountpage.ts:372 | 0 / 0 / 0 |
| `createAPIKey` | `(//*[*[text()='${apiLabel}']]//following-sibling::*//*[@class='oneline-text'])[1]` | CLASS+TEXT+POSITION | accountpage.ts:381 | _template_ |

### /exchange/account/security  
_9 locator rủi ro_

| Element (biến trong code) | Locator hiện tại | Loại rủi ro | Nguồn | Kết quả thật S / T / P |
|---|---|---|---|---|
| `activeSessions` | `//*[text()='Active Sessions' or text()='This Session']/parent::*[1]/following-sibling::*[1]` | TEXT+POSITION | securitypage.ts:10 | 0 / 0 / 0 |
| `deviceLoc` | `${activeSessions}//*[text()='Device']/following-sibling::*[1]` | TEXT+POSITION | securitypage.ts:11 | _template_ |
| `timeExpiryLoc` | `${activeSessions}//*[text()='Time to expiry']/following-sibling::*[1]` | TEXT+POSITION | securitypage.ts:12 | _template_ |
| `tradingLoginTokenLoc` | `${activeSessions}//*[text()='Trading Login Token']/following-sibling::*[1]` | TEXT+POSITION | securitypage.ts:13 | _template_ |
| `expiryLoc` | `${activeSessions}//*[text()='Expiry']/following-sibling::*[1]` | TEXT+POSITION | securitypage.ts:14 | _template_ |
| `tradingLoginBtn` | `//*[contains(text(),"You don't have a")]/following-sibling::button[1]` | TEXT+POSITION | securitypage.ts:16 | 0 / 0 / 0 |
| `settingsLineIcon` | `//*[text()='Active Sessions']/following-sibling::div[1]//*[@fill="none"]` | TEXT+POSITION | securitypage.ts:17 | 0 / 0 / 0 |
| `endAllOtherSessionsBtn` | `//*[text()='Other Sessions']/following-sibling::button[text()='End All']` | TEXT+POSITION | securitypage.ts:18 | 0 / 0 / 0 |
| `submitSecondarySecureKeyAddress` | `//*[@role='dialog']//input[1]` | POSITION+ARIA | securitypage.ts:136 | 0 / 0 / 0 |

### /exchange/account/trading-accounts  
_8 locator rủi ro_

| Element (biến trong code) | Locator hiện tại | Loại rủi ro | Nguồn | Kết quả thật S / T / P |
|---|---|---|---|---|
| `levExceedsLoc` | `//*[text()='Leverage Exceeds Maximum']` | TEXT | flow/subAccountConfigFlow.ts:8 | 0 / 0 / 0 |
| `loginHeaderBtn` | `//*[contains(@class,'headerWrapper')]//*[text()='Log in']` | CLASS+TEXT | subAccountPage.ts:15 | 0 / 0 / 0 |
| `tradingLoginBtn` | `//button[contains(text(),'Trading Login') or contains(text(),'Connect SecureKey') or contains(text(),'Create trading account')]` | TEXT | subAccountPage.ts:16 | 0 / 0 / 0 |
| `buySellBtn` | `//button[contains(@class,'__buy')] \| //button[normalize-space()='Buy / Long'] \| //button[normalize-space()='Sell / Short']` | CLASS+TEXT | subAccountPage.ts:17 | 2 / 2 / 2 |
| `dialogCloseBtn` | `${dialog}//button[normalize-space()='Cancel' or normalize-space()='Close' or normalize-space()='Ok' or normalize-space()='OK' or normalize-space()='Go` | TEXT | subAccountPage.ts:20 | _template_ |
| `dialogCloseIcon` | `${dialog}//*[contains(@class,'pointer') and not(normalize-space(text()))]` | CLASS+TEXT | subAccountPage.ts:21 | _template_ |
| `switcherTitle` | `${dialog}//*[contains(text(),'Switch trading account')]` | TEXT | subAccountPage.ts:23 | _template_ |
| `switcherConfirm` | `${dialog}//button[normalize-space()='Confirm']` | TEXT | subAccountPage.ts:24 | _template_ |

### /exchange/deposit | /withdraw | /transfer  
_55 locator rủi ro_

| Element (biến trong code) | Locator hiện tại | Loại rủi ro | Nguồn | Kết quả thật S / T / P |
|---|---|---|---|---|
| `menuContainer` | `//*[contains(@class,'_menuContainer')]` | CLASS | transferpage.ts:25 | 0 / 0 / 0 |
| `fundingAccountText` | `//div[contains(text(),'Funding Account') and not(contains(text(),'Balance'))]/following-sibling::div[1]` | TEXT+POSITION | transferpage.ts:26 | 3 / 2 / 2 |
| `transferOrMoveBtn` | `//*[@alt='mint-tokens']/following-sibling::div//button[text()='Transfer' or text()='Move']` | TEXT+POSITION | transferpage.ts:27 | 1 / 1 / 0 |
| `availableToTransfer` | `//*[text()='Available to Transfer']/following-sibling::*[1] \| //*[contains(text(),'Cash balance')]` | TEXT+POSITION | transferpage.ts:28 | 2 / 2 / 2 |
| `fromField` | `//*[text()='From']/following-sibling::div[1]` | TEXT+POSITION | transferpage.ts:29 | 1 / 1 / 1 |
| `toField` | `//*[text()='To']/following-sibling::div[1]` | TEXT+POSITION | transferpage.ts:30 | 1 / 1 / 1 |
| `availableFrom` | `//*[text()='From']/following-sibling::div[position()=2 or position()=3]//*[text()='Available to transfer' or text()='Available to Transfer']/following` | TEXT+POSITION | transferpage.ts:31 | 1 / 1 / 1 |
| `availableTo` | `//*[text()='To']/following-sibling::div[position()=1 or position()=2]//*[text()='Available']/following-sibling::span[1]` | TEXT+POSITION | transferpage.ts:32 | 0 / 0 / 0 |
| `seeHistoryBtn` | `//button[contains(text(),'See history')]` | TEXT | transferpage.ts:33 | 1 / 1 / 1 |
| `seeHistoryBtnExact` | `//button[normalize-space()='See history']` | TEXT | transferpage.ts:34 | 1 / 1 / 1 |
| `viewTxnHistoryBtn` | `//button[normalize-space()='View transaction history']` | TEXT | transferpage.ts:35 | 0 / 0 / 0 |
| `recentTxnCells` | `(//*[contains(@class,'tableRow')])[1]/*/*` | CLASS+POSITION | transferpage.ts:36 | 7 / 12 / 7 |
| `mintBtn` | `//button[text()='Mint']` | TEXT | transferpage.ts:37 | 0 / 0 / 0 |
| `fundingBalanceLabel` | `//*[text()='Funding Account Balance']/following-sibling::span[1]` | TEXT+POSITION | transferpage.ts:38 | 0 / 0 / 0 |
| `moveBtn` | `//*[text()='To']/parent::div[1]/following-sibling::button[text()='Move']` | TEXT+POSITION | transferpage.ts:39 | 1 / 1 / 1 |
| `dialogConfirmBtn` | `${dialog}//button[text()='Confirm']` | TEXT | transferpage.ts:40 | _template_ |
| `transferAssetsBtn` | `//button/*[text()='Transfer assets']` | TEXT | transferpage.ts:41 | 0 / 0 / 0 |
| `coinWithdrawControl` | `//*[contains(@class,'bg-background-input-default')]/*[contains(@class,'wrapper')]//*[contains(@class,'singleValue')]/div[1]` | CLASS+POSITION | transferpage.ts:43 | 1 / 1 / 1 |
| `maxBtn` | `//*[text()='Max']` | TEXT | transferpage.ts:44 | 1 / 1 / 1 |
| `sendViaControl` | `//*[text()='Send via']/following-sibling::div[1]//*[contains(@class,'-control')]` | CLASS+TEXT+POSITION | transferpage.ts:45 | 0 / 0 / 0 |
| `depositViaControl` | `//*[text()='Deposit via']/parent::label[1]/following-sibling::div[1]//*[contains(@class,'-control')]` | CLASS+TEXT+POSITION | transferpage.ts:46 | 0 / 0 / 1 |
| `depositViaBox` | `//*[text()='Deposit via']/parent::label[1]/following-sibling::div[1]` | TEXT+POSITION | transferpage.ts:47 | 0 / 0 / 1 |
| `depositInBox` | `//*[text()='Deposit in']/parent::label[1]/following-sibling::div[1]` | TEXT+POSITION | transferpage.ts:48 | 0 / 0 / 1 |
| `walletBalanceValue` | `//*[text()='Wallet balance']//following-sibling::span[1]` | TEXT+POSITION | transferpage.ts:50 | 0 / 0 / 0 |
| `walletBalanceText` | `//*[contains(text(),'Wallet balance')]` | TEXT | transferpage.ts:51 | 0 / 0 / 0 |
| `spendingLimitValue` | `//*[text()='Spending limit']/following-sibling::*[1]` | TEXT+POSITION | transferpage.ts:52 | 0 / 0 / 0 |
| `depositBtnLoc` | `//*[contains(@class,'headerWrapper')]//button[text()='Deposit']` | CLASS+TEXT | transferpage.ts:53 | 2 / 2 / 2 |
| `setSpendingLimitLoc` | `//*[text()='Set spending limit']` | TEXT | transferpage.ts:54 | 0 / 0 / 0 |
| `receiveValue` | `//*[text()='Receive']/following-sibling::*/span` | TEXT+POSITION | transferpage.ts:55 | 0 / 0 / 0 |
| `toastAlert` | `//*[@class='Toastify']//*[@role='alert']` | CLASS+ARIA | transferpage.ts:56 | 0 / 0 / 1 |
| `switchDepositIcon` | `//*[text()='Depositing with']/parent::div[1]/following-sibling::span[1]/span[1]` | TEXT+POSITION | transferpage.ts:57 | 0 / 0 / 0 |
| `historyHeaderCells` | `//*[contains(@class,'hide-scrollbar-y')]/div[1]/div[1]/div` | CLASS+POSITION | transferpage.ts:58 | 15 / 15 / 15 |
| `historyBodyRow` | `//*[contains(@class,'__tableRow')]` | CLASS | transferpage.ts:59 | 30 / 25 / 25 |
| `historyTabs` | `//*[contains(@class,'__tabs')]` | CLASS | transferpage.ts:60 | 5 / 6 / 6 |
| `sendAsValue` | `//*[text()='Send as']/following-sibling::div[1]//*[contains(@class,'singleValue')]` | CLASS+TEXT+POSITION | transferpage.ts:61 | 0 / 0 / 0 |
| `sendAsControl` | `//*[text()='Send as']/following-sibling::div[1]//*[contains(@class,'-control')]` | CLASS+TEXT+POSITION | transferpage.ts:62 | 0 / 0 / 0 |
| `coinDisplay` | `//*[contains(@class,'singleValue')]/div[contains(text(),'USDT') or contains(text(),'USDC') or contains(text(),'ETH') or contains(text(),'GRVT')]` | CLASS+TEXT | transferpage.ts:63 | 1 / 1 / 1 |
| `twAvatar` | `//div[contains(@class,'twAvatar')]` | CLASS | transferpage.ts:64 | 3 / 3 / 3 |
| `metamaskOption` | `//span[text()='MetaMask']` | TEXT | transferpage.ts:66 | 0 / 0 / 0 |
| `exactText` | `//*[text()='${text}']` | TEXT | transferpage.ts:97 | _template_ |
| `getToAccountBalance` | `//*[text()='To']/following-sibling::*[position()=1 or position()=2]//*[text()='Available' or text()='Available to Transfer']/following-sibling::*` | TEXT+POSITION | transferpage.ts:329 | 1 / 1 / 1 |
| `toDropLoc` | `${toLoc}//*[contains(@class,'_control')]` | CLASS | transferpage.ts:559 | _template_ |
| `isAccountOfferedInTo` | `${toLoc}//*[contains(text(),'${account}')]` | TEXT | transferpage.ts:563 | _template_ |
| `isAccountOfferedInTo` | `${toLoc}//*[contains(text(),'${account}${type}')]` | TEXT | transferpage.ts:564 | _template_ |
| `fromDropLoc` | `${fromLoc}//*[contains(@class,'_control')]` | CLASS | transferpage.ts:744 | _template_ |
| `selectFrom` | `(${fromLoc}\|${menuContainer})//*[contains(text(),'${account}')]` | TEXT | transferpage.ts:748 | _template_ |
| `selectFrom` | `(${fromLoc}\|${menuContainer})//*[contains(text(),'${account}${type}')]` | TEXT | transferpage.ts:750 | _template_ |
| `selectTo` | `${toLoc}//*[contains(text(),'${account}')]` | TEXT | transferpage.ts:773 | _template_ |
| `selectTo` | `${toLoc}//*[contains(text(),'${account}${type}')]` | TEXT | transferpage.ts:775 | _template_ |
| `loc` | `//*[contains(@class,'_wrapper')]//*[contains(text(),'${coin}')]` | CLASS+TEXT | transferpage.ts:835 | _template_ |
| `selectedLoc` | `${box}//*[contains(@class,'-control')]//*[text()='${label}']` | CLASS+TEXT | transferpage.ts:864 | _template_ |
| `dropLoc` | `${box}//*[contains(@class,'-control')]` | CLASS | transferpage.ts:866 | _template_ |
| `control` | `${box}//*[contains(@class,'-control')]` | CLASS | transferpage.ts:885 | _template_ |
| `loc` | `${mainAccountDepositHistory}/div//*[contains(text(),'${bridge}')]` | TEXT | transferpage.ts:1314 | _template_ |

### /exchange/deposit-yield  
_1 locator rủi ro_

| Element (biến trong code) | Locator hiện tại | Loại rủi ro | Nguồn | Kết quả thật S / T / P |
|---|---|---|---|---|
| `copyIcon` | `//*[@role="dialog"]//*[text()='Copy link']/preceding-sibling::div[contains(@class,'pointer')]` | CLASS+TEXT+POSITION+ARIA | earnpage.ts:10 | 0 / 0 / 0 |

### /exchange/liquidity-league  
_5 locator rủi ro_

| Element (biến trong code) | Locator hiện tại | Loại rủi ro | Nguồn | Kết quả thật S / T / P |
|---|---|---|---|---|
| `totalPoint` | `//*[contains(text(),'Your total points')]/parent::div[1]/following-sibling::*[1]/*[1]` | TEXT+POSITION | leaderboardpage.ts:4 | 0 / 0 / 0 |
| `overallRank` | `//*[text()='Your overall rank']/following-sibling::*[1]` | TEXT+POSITION | leaderboardpage.ts:5 | 0 / 0 / 0 |
| `pointLastweek` | `//*[text()='Points last week']/following-sibling::*[1]/*[1]` | TEXT+POSITION | leaderboardpage.ts:6 | 0 / 0 / 0 |
| `lastweekRankLoc` | `//*[text()='Performance last week']/following-sibling::*[1]` | TEXT+POSITION | leaderboardpage.ts:7 | 0 / 0 / 0 |
| `tableRowLoc` | `//*[contains(@class,'sticky top-0') or contains(@class,'tableRow')]` | CLASS | leaderboardpage.ts:8 | 31 / 25 / 25 |

### /exchange/perpetual/{sym}  
_110 locator rủi ro_

| Element (biến trong code) | Locator hiện tại | Loại rủi ro | Nguồn | Kết quả thật S / T / P |
|---|---|---|---|---|
| `textContains` | `//*[contains(text(),'${text}')]` | TEXT | flow/tradingFlow.ts:49 | _template_ |
| `tableTab` | `//*[contains(@class,'tabItem')]//*[contains(text(),'{0}') or contains(text(),'{1}')]` | CLASS+TEXT | perpetualpage.ts:55 | - |
| `positionTab` | `//*[contains(@class,'tabItem')]//*[contains(text(),'Positions')]` | CLASS+TEXT | perpetualpage.ts:57 | 1 / 1 / 1 |
| `limitPriceInput` | `//div[contains(@class,'__label') and normalize-space()='Order price']/following-sibling::input \| //input[@placeholder='Price']` | CLASS+TEXT+POSITION+ARIA | perpetualpage.ts:74 | 1 / 1 / 1 |
| `qtyUnitLabel` | `//div[contains(@class,'__label') and (normalize-space()='Quantity' or normalize-space()='Value' or normalize-space()='Cost')]` | CLASS+TEXT | perpetualpage.ts:75 | 1 / 1 / 1 |
| `qtyUnitSuffixBtn` | `${qtyUnitLabel}/parent::label[1]/following-sibling::span[1]//*[@role='button']` | POSITION+ARIA | perpetualpage.ts:76 | _template_ |
| `qtyUnitLegacyBtn` | `//span[text()='\|']/following-sibling::div[1]/span[contains(@class,'__icon')]` | CLASS+TEXT+POSITION | perpetualpage.ts:77 | 0 / 0 / 0 |
| `tradingLoginBtn` | `//button[contains(text(),'Trading Login') or contains(text(),'Connect SecureKey') or contains(text(),'Create trading account')]` | TEXT | perpetualpage.ts:79 | 0 / 0 / 0 |
| `instrumentSelector` | `//div[normalize-space()='Perpetual' and contains(preceding-sibling::div,'USDT')]/preceding-sibling::div` | TEXT+POSITION | perpetualpage.ts:80 | 0 / 1 / 1 |
| `timeInForceLoc` | `//*[text()='${tif}']` | TEXT | perpetualpage.ts:187 | _template_ |
| `marketRowsAll` | `//*[@title="Market"]/ancestor::div[2]/following-sibling::div/div/div` | POSITION+ARIA | perpetualpage.ts:192 | 0 / 0 / 0 |
| `positionsTabText` | `//*[contains(text(),'Positions (')]/parent::div[1]` | TEXT+POSITION | perpetualpage.ts:230 | 0 / 0 / 0 |
| `comboboxWrap` | `//*[@role='combobox']/ancestor::*[contains(@class,'fx-wrap-wrap')][1]` | CLASS+POSITION+ARIA | perpetualpage.ts:232 | 2 / 2 / 2 |
| `limitTabBtn` | `//button[text()='Limit']` | TEXT | perpetualpage.ts:234 | 0 / 0 / 0 |
| `orderBookTab` | `//*[text()='Order book']` | TEXT | perpetualpage.ts:237 | 1 / 1 / 1 |
| `metamaskOption` | `//span[text()='MetaMask']` | TEXT | perpetualpage.ts:238 | 0 / 0 / 0 |
| `validateTradeIndicators` | `//*[contains(text(), "Mark")]//following-sibling::*[contains(@class,'font-roboto')]` | CLASS+TEXT+POSITION | perpetualpage.ts:305 | 1 / 1 / 1 |
| `validateTradeIndicators` | `//*[contains(@class,'body-12 font-roboto font-medium cursor-help') or contains(@class,'font-body-xs font-roboto font-medium cursor-help')]` | CLASS | perpetualpage.ts:310 | 1 / 1 / 1 |
| `validateTradeIndicators` | `(//*[contains(text(), "24h volume")])[1]//following-sibling::*` | TEXT+POSITION | perpetualpage.ts:314 | 1 / 1 / 1 |
| `validateTradeIndicators` | `(//*[contains(text(), "24h volume")])[2]//following-sibling::*` | TEXT+POSITION | perpetualpage.ts:318 | 1 / 1 / 1 |
| `validateTradeIndicators` | `(//*[contains(text(), "24h high")])[1]//following-sibling::*` | TEXT+POSITION | perpetualpage.ts:322 | 1 / 1 / 1 |
| `validateTradeIndicators` | `(//*[contains(text(), "24h low")])[1]//following-sibling::*` | TEXT+POSITION | perpetualpage.ts:326 | 1 / 1 / 1 |
| `validateTradeIndicators` | `(//*[contains(text(), "Open interest")])[1]//following-sibling::*` | TEXT+POSITION | perpetualpage.ts:330 | 1 / 1 / 1 |
| `validateTradeIndicators` | `//*[contains(text(), "Funding")]/following-sibling::div[1]/span[1] \| (//*[contains(text(), "Funding rate")])[1]//following-sibling::*` | TEXT+POSITION | perpetualpage.ts:334 | 4 / 3 / 2 |
| `getOBBidAskSnapshot` | `//*[contains(@class,'fx-column-reverse')]` | CLASS | perpetualpage.ts:566 | 1 / 1 / 1 |
| `getOBBidAskSnapshot` | `(//*[contains(@class,'reverse')]/following-sibling::*)[2]` | CLASS+POSITION | perpetualpage.ts:569 | 1 / 1 / 1 |
| `getOBAsks` | `//*[contains(@class,'fx-column-reverse')]` | CLASS | perpetualpage.ts:576 | 1 / 1 / 1 |
| `getOBBids` | `(//*[contains(@class,'reverse')]/following-sibling::*)[2]` | CLASS+POSITION | perpetualpage.ts:588 | 1 / 1 / 1 |
| `getRecentTrades` | `(//*[contains(@class,'fx-1 fx-column relative')])[2]` | CLASS+POSITION | perpetualpage.ts:599 | 1 / 1 / 1 |
| `assertOBLastPrice` | `(//*[contains(@class,'reverse')]/following-sibling::*)[1]` | CLASS+POSITION | perpetualpage.ts:720 | 1 / 1 / 1 |
| `assertOBMarkPrice` | `(//*[contains(@class,'reverse')]/following-sibling::*)[1]` | CLASS+POSITION | perpetualpage.ts:729 | 1 / 1 / 1 |
| `assertOBBuyPercent` | `//*[contains(., 'Buy') and contains(@class, 'green')]` | CLASS+TEXT | perpetualpage.ts:746 | 2 / 2 / 2 |
| `assertOBSellPercent` | `//*[contains(., 'Sell') and contains(@class, 'red')]` | CLASS+TEXT | perpetualpage.ts:754 | 2 / 2 / 2 |
| `setLimitOrder` | `//*[contains(@class,'tabItem')]//*[text()='Limit']` | CLASS+TEXT | perpetualpage.ts:889 | 1 / 1 / 1 |
| `setMarketOrder` | `//*[contains(@class,'tabItem')]//*[text()='Market']` | CLASS+TEXT | perpetualpage.ts:918 | 1 / 1 / 1 |
| `tpMarketDropLoc` | `${tpMarket}//*[contains(@class,'style_valueContainer') or contains(@class,'-control')]` | CLASS | perpetualpage.ts:970 | _template_ |
| `typeLoc` | `${tpMarket}//*[contains(text(),'{0}')]` | TEXT | perpetualpage.ts:971 | _template_ |
| `slMarketDropLoc` | `${slMarket}//*[contains(@class,'style_valueContainer') or contains(@class,'-control')]` | CLASS | perpetualpage.ts:993 | _template_ |
| `typeLoc` | `${slMarket}//*[contains(text(),'{0}')]` | TEXT | perpetualpage.ts:994 | _template_ |
| `getPositionsTabLoc` | `//*[contains(text(),'Positions (')]` | TEXT | perpetualpage.ts:1077 | 1 / 1 / 1 |
| `skipTradingLogin` | `(//button[text()='Cancel'])[last()]` | TEXT+POSITION | perpetualpage.ts:2174 | 0 / 0 / 0 |
| `midLoc` | `(${limitPriceLoc})/parent::label[1]/following-sibling::span[1]//*[text()='Mid']` | TEXT+POSITION | perpetualpage.ts:2211 | _template_ |
| `marketLoc` | `${rows}[1]//*[contains(@class,'oneline-text')]` | CLASS+POSITION | perpetualpage.ts:2253 | _template_ |
| `getTradeIndicatorsOnSearch` | `//*[contains(@class,'oneline-text') and (normalize-space()="${market}" or normalize-space()="${marketWithoutQuote}")]` | CLASS+TEXT | perpetualpage.ts:2320 | _template_ |
| `createTradingLogin` | `//*[contains(@class,'style_walletMenu')]/button[text()='Trading Login']` | CLASS+TEXT | perpetualpage.ts:2412 | 0 / 0 / 0 |
| `trigPriceInput` | `${loc}/following-sibling::div[1]//input[@placeholder="Trigger price"]` | POSITION+ARIA | perpetualpage.ts:2471 | _template_ |
| `trigTypeDropLoc` | `${loc}/following-sibling::div[1]//input[@placeholder="Trigger price"]/parent::label[1]/following-sibling::*[1]//*[contains(@class,'body')]` | CLASS+POSITION+ARIA | perpetualpage.ts:2483 | _template_ |
| `typeLocator` | `${dialog}//*[contains(@class,'pointer') and normalize-space(text())='${trigType}']` | CLASS+TEXT | perpetualpage.ts:2484 | _template_ |
| `roiInput` | `${loc}/following-sibling::div[1]//div[@style="width: 160px;"]//input[contains(@class,'text-field')]` | CLASS+POSITION | perpetualpage.ts:2516 | _template_ |
| `roiDropLoc` | `${loc}/following-sibling::div[1]//div[@style="width: 160px;"]//input[contains(@class,'text-field')]/parent::label[1]/following-sibling::span[1]` | CLASS+POSITION | perpetualpage.ts:2529 | _template_ |
| `selRoiTypeInTPLSPopUp` | `//*[contains(@class,'_wrapper') and contains(@class,'css-')]//*[text()='{0}']` | CLASS+TEXT | perpetualpage.ts:2531 | - |
| `setTPSLQtySliderToPercent` | `${loc}/following-sibling::div[1]//input[@placeholder="Trigger price"]/parent::label[1]/following-sibling::*[1]//*[contains(@class,'body')]` | CLASS+POSITION+ARIA | perpetualpage.ts:2662 | _template_ |
| `valLoc` | `${dialog}//*[text()='${label}']/following-sibling::div[1]` | TEXT+POSITION | perpetualpage.ts:2765 | _template_ |
| `getInfoConfirmPositionTPSLPopup` | `${dialog}//*[text()='Estimated P&L']/following-sibling::div[1]/span[@class='txt-feature-green']` | CLASS+TEXT+POSITION | perpetualpage.ts:2768 | _template_ |
| `getInfoConfirmPositionTPSLPopup` | `${dialog}//*[text()='Estimated P&L']/following-sibling::div[1]/span[@class='txt-feature-red']` | CLASS+TEXT+POSITION | perpetualpage.ts:2771 | _template_ |
| `confirmBtn` | `${dialog}//*[text()='Confirm']` | TEXT | perpetualpage.ts:2807 | _template_ |
| `allssets` | `${filterLoc}/div[1]//*[text()='Assets' or text()='All assets']` | TEXT+POSITION | perpetualpage.ts:3062 | _template_ |
| `valueLoc` | `${filterLoc}/div[1]//*[text()='Assets' or text()='All assets' or contains(text(),'Selected')]` | TEXT+POSITION | perpetualpage.ts:3063 | _template_ |
| `allAssetsLoc` | `${filterLoc}/div[1]//*[text()='Assets']` | TEXT+POSITION | perpetualpage.ts:3091 | _template_ |
| `valueLoc` | `${filterLoc}/div[1]//*[text()='Assets' or contains(text(),'Selected')]` | TEXT+POSITION | perpetualpage.ts:3092 | _template_ |
| `allAssetsLoc` | `${filterLoc}/div[1]//*[contains(text(),'Selected')]` | TEXT+POSITION | perpetualpage.ts:3115 | _template_ |
| `getMaxLeverageFromUI` | `//span[contains(@class,'_markLabel')]` | CLASS | perpetualpage.ts:3370 | 0 / 0 / 0 |
| `assignedLoc` | `${dialog}//*[text()='Margin Assigned']/following-sibling::div[1]` | TEXT+POSITION | perpetualpage.ts:3558 | _template_ |
| `ratioLoc` | `${dialog}//*[text()='Margin Ratio']/following-sibling::div[1]` | TEXT+POSITION | perpetualpage.ts:3559 | _template_ |
| `_openSearchLoc` | `//div[normalize-space()='Perpetual' and contains(preceding-sibling::div,'USDT')]/preceding-sibling::div` | TEXT+POSITION | perpetualpage.ts:3662 | 0 / 1 / 1 |
| `_sectors` | `//*[@class='overflow-auto fx-column fx-jc-center gap-2 px-3 sm-px-4']` | CLASS | perpetualpage.ts:3663 | 0 / 1 / 1 |
| `_rowsParent` | `(${this._sectors} \| ${this._sectors}/parent::div[1])/following-sibling::div[1]//div[contains(@class,'relative')]/div[1]` | CLASS+POSITION | perpetualpage.ts:3664 | _template_ |
| `getFirstTierMarginRatesFromDetailsPanel` | `${this._rowLoc(row)}[1]//*[contains(@class,'star') or contains(@class,'favorite') or name()='svg']` | CLASS+POSITION | perpetualpage.ts:3671 | _template_ |
| `getFirstTierMarginRatesFromDetailsPanel` | `(${this._sectors} \| ${this._sectors}/parent::div[1])/following-sibling::div[1]//*[contains(text(),'${col}')]` | TEXT+POSITION | perpetualpage.ts:3675 | _template_ |
| `clickSubTag` | `//*[contains(@class,"bg-background-neutral-bold") and normalize-space(.)='${tagName}']` | CLASS+TEXT | perpetualpage.ts:3764 | _template_ |
| `starInstrumentRow` | `${this._rowLoc(row)}[1]//*[contains(@class,'icon-warning-bold')]` | CLASS+POSITION | perpetualpage.ts:3794 | _template_ |
| `xpath` | `${this._rowsParent}/div/div[1]//*[contains(@class,'oneline-text')]` | CLASS+POSITION | perpetualpage.ts:3821 | _template_ |
| `unstarInstrument` | `//*[contains(@class,"_active")]/*[text()='${tabName}']` | CLASS+TEXT | perpetualpage.ts:3993 | _template_ |
| `unstarInstrument` | `xpath=${this._rowLoc(row)}/div[1]` | POSITION | perpetualpage.ts:4003 | _template_ |
| `unstarInstrument` | `[class='overflow-auto fx-column fx-jc-center gap-2 px-3 sm-px-4']` | CLASS | perpetualpage.ts:4015 | 0 / 1 / 1 |
| `lastRow` | `(${this.allInstrumentRows})[last()]` | POSITION | perpetualpage.ts:4342 | _template_ |
| `FORM_DIALOG` | `//*[@role='dialog' and .//*[normalize-space()='Frequency'] and .//*[normalize-space()='Once Only']]` | TEXT+ARIA | priceAlertFormDialog.ts:25 | 0 / 0 / 0 |
| `ALERT_TYPE_VALUE` | `${FORM_DIALOG}//*[normalize-space(.)='Alert Type']/following-sibling::*[1]` | TEXT+POSITION | priceAlertFormDialog.ts:29 | _template_ |
| `PRICE_TYPE_VALUE` | `(${FORM_DIALOG}//*[normalize-space()='Mark Price' or normalize-space()='Last Price' or normalize-space()='Index Price'])[1]` | TEXT+POSITION | priceAlertFormDialog.ts:30 | _template_ |
| `SYMBOL_DROPDOWN` | `${FORM_DIALOG}//label[normalize-space()='Symbol']/following::*[contains(@class,'control')][1]` | CLASS+TEXT+POSITION | priceAlertFormDialog.ts:31 | _template_ |
| `ALERT_TYPE_DROPDOWN` | `${FORM_DIALOG}//*[normalize-space(.)='Alert Type']/following-sibling::*[1]` | TEXT+POSITION | priceAlertFormDialog.ts:32 | _template_ |
| `PRICE_TYPE_DROPDOWN` | `(${FORM_DIALOG}//*[normalize-space()='Mark Price' or normalize-space()='Last Price' or normalize-space()='Index Price'])[1]` | TEXT+POSITION | priceAlertFormDialog.ts:33 | _template_ |
| `INLINE_ERROR` | `${FORM_DIALOG}//*[contains(@class,'error') or contains(@class,'helperText') or contains(@class,'errorText')][string-length(normalize-space())>0]` | CLASS+TEXT | priceAlertFormDialog.ts:41 | _template_ |
| `CONFIRM_BUTTON` | `${FORM_DIALOG}//button[normalize-space()='Confirm']` | TEXT | priceAlertFormDialog.ts:42 | _template_ |
| `CANCEL_BUTTON` | `${FORM_DIALOG}//button[normalize-space()='Cancel']` | TEXT | priceAlertFormDialog.ts:43 | _template_ |
| `LIST_DIALOG` | `//*[@role='dialog' and (.//*[normalize-space()='Price Alerts List'] or .//button[normalize-space()='Add Alert'])]` | TEXT+ARIA | priceAlertListDialog.ts:6 | 0 / 0 / 0 |
| `ADD_ALERT_BUTTON` | `${LIST_DIALOG}//button[normalize-space()='Add Alert']` | TEXT | priceAlertListDialog.ts:8 | _template_ |
| `CONFIRM_BUTTON` | `${LIST_DIALOG}//button[normalize-space()='Confirm']` | TEXT | priceAlertListDialog.ts:9 | _template_ |
| `CANCEL_BUTTON` | `${LIST_DIALOG}//button[normalize-space()='Cancel']` | TEXT | priceAlertListDialog.ts:10 | _template_ |
| `EMPTY_STATE` | `${LIST_DIALOG}//*[normalize-space()='No price alerts yet']` | TEXT | priceAlertListDialog.ts:11 | _template_ |
| `CARD_INDICATOR` | `${LIST_DIALOG}//*[count(*)=0 and (normalize-space()='Mark Price' or normalize-space()='Last Price' or normalize-space()='Index Price')]` | TEXT | priceAlertListDialog.ts:12 | _template_ |
| `CARD` | `${CARD_INDICATOR}/ancestor::*[count(.//button)>=2][1]` | POSITION | priceAlertListDialog.ts:13 | _template_ |
| `CARD_EDIT_BUTTON` | `(${CARD_BY_INDEX(i)}//button)[1]` | POSITION | priceAlertListDialog.ts:15 | _template_ |
| `CARD_DELETE_BUTTON` | `(${CARD_BY_INDEX(i)}//button)[2]` | POSITION | priceAlertListDialog.ts:16 | _template_ |
| `QUOTA_ERROR` | `//*[contains(normalize-space(),'Maximum alert limit reached') or contains(normalize-space(),'limit reached')]` | TEXT | priceAlertListDialog.ts:17 | 0 / 0 / 0 |
| `TOOLBAR_BELL` | `(//*[name()='path' and starts-with(@d,'M12 4C9.8245 4 7.97109 5.38991')]/ancestor::span[contains(@class,'pointer')][1])[1]` | CLASS+POSITION | priceAlertPage.ts:10 | 1 / 1 / 1 |
| `CONFIRM_DELETE_BTN` | `(//*[@role='dialog'])[last()]//button[normalize-space()='Confirm' or normalize-space()='Delete' or normalize-space()='Yes' or normalize-space()='OK']` | TEXT+POSITION+ARIA | priceAlertPage.ts:11 | 0 / 0 / 0 |
| `roiInput` | `${dialog}//div[contains(@style,'width: 160px')]//input[contains(@class,'text-field')] \| (${dialog}//input[@placeholder='Trigger price']/following::in` | CLASS+POSITION+ARIA | splitTPSLPage.ts:24 | _template_ |
| `roiTypeText` | `${dialog}//div[contains(@style,'width: 160px')]//*[contains(@class,'singleValue')] \| ${dialog}//*[(normalize-space()='ROI%' or normalize-space()='P&a` | CLASS+TEXT | splitTPSLPage.ts:25 | _template_ |
| `roiTypeDropdown` | `${dialog}//div[contains(@style,'width: 160px')]//*[contains(@class,'dropdownIndicator')] \| ${dialog}//*[(normalize-space()='ROI%' or normalize-space(` | CLASS+TEXT+POSITION | splitTPSLPage.ts:26 | _template_ |
| `execDropdown` | `${dialog}//input[contains(@placeholder,'TP') or contains(@placeholder,'SL')]/ancestor::*[contains(@class,'text-field_container__')][1]/following-sibli` | CLASS+TEXT+POSITION+ARIA | splitTPSLPage.ts:27 | _template_ |
| `addSplitBtn` | `${dialog}//button[contains(normalize-space(),'Add Split TP Order') or contains(normalize-space(),'Add Split SL Order')]` | TEXT | splitTPSLPage.ts:29 | _template_ |
| `confirmBtn` | `${dialog}//button[normalize-space()='Confirm']` | TEXT | splitTPSLPage.ts:30 | _template_ |
| `cancelBtn` | `${dialog}//button[normalize-space()='Cancel']` | TEXT | splitTPSLPage.ts:31 | _template_ |
| `positionsTabFallback` | `//*[contains(text(),'Positions (')]/parent::div[1]` | TEXT+POSITION | splitTPSLPage.ts:37 | 0 / 0 / 0 |
| `selectRoiType` | `//*[contains(@class,'option') or contains(@class,'pointer')]//*[normalize-space()='${type}']` | CLASS+TEXT | splitTPSLPage.ts:232 | _template_ |
| `confirmAndWaitClosed` | `${tpslCell}//*[contains(@class,'pointer')][self::span or self::img or self::svg or self::div]` | CLASS | splitTPSLPage.ts:335 | _template_ |

### /exchange/reward-portal/referral-hub  
_5 locator rủi ro_

| Element (biến trong code) | Locator hiện tại | Loại rủi ro | Nguồn | Kết quả thật S / T / P |
|---|---|---|---|---|
| `directInvitesLoc` | `//*[text()='Direct invites commission']/following-sibling::*[1]` | TEXT+POSITION | referralpage.ts:6 | 0 / 0 / 0 |
| `indirectInvites` | `//*[text()='Indirect invites commission']/following-sibling::*[1]` | TEXT+POSITION | referralpage.ts:7 | 0 / 0 / 0 |
| `pointsLoc` | `//*[text()='Points multiplier' or text()='Points booster']/following-sibling::*[1]` | TEXT+POSITION | referralpage.ts:8 | 0 / 0 / 0 |
| `makerLoc` | `//*[text()='Maker/Taker fees']/following-sibling::*[1]` | TEXT+POSITION | referralpage.ts:9 | 0 / 0 / 0 |
| `referralLink` | `//*[contains(text(),'Your referral link')]/following-sibling::*[1]//input[1]` | TEXT+POSITION | referralpage.ts:10 | 1 / 1 / 1 |

### /exchange/spot/{sym}  
_14 locator rủi ro_

| Element (biến trong code) | Locator hiện tại | Loại rủi ro | Nguồn | Kết quả thật S / T / P |
|---|---|---|---|---|
| `sideToggleBuy` | `//div[contains(@class,'toggleItem') and normalize-space(text())='Buy']` | CLASS+TEXT | spotpage.ts:10 | 1 / 1 / 1 |
| `sideToggleSell` | `//div[contains(@class,'toggleItem') and normalize-space(text())='Sell']` | CLASS+TEXT | spotpage.ts:11 | 1 / 1 / 1 |
| `submitOrderButton` | `//button[contains(normalize-space(.),'Buy') or contains(normalize-space(.),'Sell')][@type='button' or contains(@class,'fx-column')]` | CLASS+TEXT+ARIA | spotpage.ts:14 | 2 / 2 / 2 |
| `confirmOrderButton` | `//button[normalize-space(.)='Yes, confirm' or normalize-space(.)='Confirm']` | TEXT | spotpage.ts:15 | 0 / 0 / 0 |
| `accountSelect` | `//*[text()='Please select']` | TEXT | spotpage.ts:16 | 0 / 0 / 0 |
| `tradingAccountOption` | `//*[starts-with(text(),'TradingAccount')]` | TEXT | spotpage.ts:17 | 2 / 2 / 2 |
| `availableToTradeLabelBuy` | `//*[${availableToTradeText}]/following-sibling::*[1][contains(.,'USDT')]` | TEXT+POSITION | spotpage.ts:20 | _template_ |
| `availableToTradeLabelSell` | `//*[${availableToTradeText}]/following-sibling::*[1][contains(.,'ETH')]` | TEXT+POSITION | spotpage.ts:21 | _template_ |
| `orderValueUsdt` | `//*[${lowerText}='order value']/following-sibling::*[1]` | POSITION | spotpage.ts:22 | _template_ |
| `tableRow` | `//*[contains(@class,'tableRow') or contains(@class,'sticky top-0')]` | CLASS | spotpage.ts:25 | 31 / 25 / 25 |
| `addFundsPlusIcon` | `//*[name()='svg' and .//*[name()='path' and starts-with(@d,'M7.33337 7.33334')]]/ancestor::*[self::span or self::button][1]` | POSITION | spotpage.ts:26 | 1 / 1 / 0 |
| `moveCardInDialog` | `${dialog}//*[contains(normalize-space(.),'Transfer asset from Funding Account')]` | TEXT | spotpage.ts:27 | _template_ |
| `dialogConfirmButton` | `${dialog}//button[normalize-space(.)='Confirm']` | TEXT | spotpage.ts:29 | _template_ |
| `constructor` | `xpath=//div[normalize-space(text())='Status']/following-sibling::div//span` | TEXT+POSITION | spotpage.ts:143 | 0 / 0 / 0 |

### /exchange/strategies  
_8 locator rủi ro_

| Element (biến trong code) | Locator hiện tại | Loại rủi ro | Nguồn | Kết quả thật S / T / P |
|---|---|---|---|---|
| `historyRows` | `${el.historyContainer}//*[contains(@class,'_tableRow')]` | CLASS | strategiespage.ts:45 | _template_ |
| `valueLoc` | `${el.investmentSummary}/following-sibling::*[1]//*[text()='Value']/following-sibling::div[1]` | TEXT+POSITION | strategiespage.ts:139 | _template_ |
| `investmentLoc` | `${el.investmentSummary}/following-sibling::*[1]//*[text()='Investment']/following-sibling::div[1]` | TEXT+POSITION | strategiespage.ts:140 | _template_ |
| `sharesLoc` | `${el.investmentSummary}/following-sibling::*[1]//*[text()='Shares']/following-sibling::div[1]` | TEXT+POSITION | strategiespage.ts:141 | _template_ |
| `entryPriceLoc` | `${el.investmentSummary}/following-sibling::*[1]//*[text()='Avg. Entry Price']/following-sibling::div[1]` | TEXT+POSITION | strategiespage.ts:142 | _template_ |
| `totalEarningsLoc` | `${el.investmentSummary}/following-sibling::*[1]//span[contains(text(),'Total earnings')]/parent::div[1]/following-sibling::div[1]` | TEXT+POSITION | strategiespage.ts:143 | _template_ |
| `histHeaderRow` | `${el.historyContainer}//*[@class='fx fx-ai-center']/div[1]/div` | CLASS+POSITION | strategiespage.ts:193 | _template_ |
| `getFundingAccountBalance` | `//*[text()='Funding account balance']/following-sibling::div[1]` | TEXT+POSITION | strategiespage.ts:577 | 0 / 0 / 0 |

### Global  
_1 locator rủi ro_

| Element (biến trong code) | Locator hiện tại | Loại rủi ro | Nguồn | Kết quả thật S / T / P |
|---|---|---|---|---|
| `constructor` | `(error: ${msg.split("\n")[0]})` | POSITION | languagepage.ts:332 | _template_ |

### Global (header)  
_24 locator rủi ro_

| Element (biến trong code) | Locator hiện tại | Loại rủi ro | Nguồn | Kết quả thật S / T / P |
|---|---|---|---|---|
| `username` | `//*[text()='Username']/parent::div[1]/following-sibling::div[1]` | TEXT+POSITION | commonPage.ts:16 | 1 / 1 / 1 |
| `avatar` | `//*[contains(@class,'userMenu')]` | CLASS | commonPage.ts:17 | 1 / 1 / 1 |
| `addRecipientBtn` | `//*[contains(text(),'Add wallet recipient') or contains(text(),'Add Grvt friend')]` | TEXT | commonPage.ts:18 | 0 / 0 / 0 |
| `userCenterSidebar` | `//*[contains(@class,'style_userCenterSidebar') or contains(@class,'userMenu')]` | CLASS | commonPage.ts:20 | 1 / 1 / 1 |
| `header` | `//*[contains(@class,'headerWrapper')]` | CLASS | commonPage.ts:31 | 1 / 1 / 1 |
| `parentLoc` | `${header}//*[contains(text(),'${parent}')]` | TEXT | commonPage.ts:38 | _template_ |
| `childLoc` | `${header}//*[contains(text(),'${child}')]` | TEXT | commonPage.ts:42 | _template_ |
| `langItemInPanel` | `${languageIcon}/following-sibling::*//*[text()="${lang}"]` | TEXT+POSITION | commonPage.ts:49 | _template_ |
| `selectItemInAvatarMenu` | `${sidebar}//*[text()="Deposit"]` | TEXT | commonPage.ts:164 | _template_ |
| `selectItemInAvatarMenu` | `${sidebar}//*[text()="Withdraw"]` | TEXT | commonPage.ts:167 | _template_ |
| `selectItemInAvatarMenu` | `${sidebar}//*[text()="Transfer"]` | TEXT | commonPage.ts:170 | _template_ |
| `selectItemInAvatarMenu` | `${sidebar}//*[contains(text(),'Switch Trading Account')]` | TEXT | commonPage.ts:173 | _template_ |
| `selectItemInAvatarMenu` | `${sidebar}//*[contains(text(),'Learn more')]` | TEXT | commonPage.ts:176 | _template_ |
| `selectItemInAvatarMenu` | `${sidebar}//*[text()="Overview"]` | TEXT | commonPage.ts:179 | _template_ |
| `selectItemInAvatarMenu` | `${sidebar}//*[text()="API Keys"]` | TEXT | commonPage.ts:182 | _template_ |
| `selectItemInAvatarMenu` | `${sidebar}//*[text()="Address Book"]` | TEXT | commonPage.ts:185 | _template_ |
| `selectItemInAvatarMenu` | `${sidebar}//*[text()="Security"]` | TEXT | commonPage.ts:188 | _template_ |
| `selectItemInAvatarMenu` | `${sidebar}//*[text()="Log out"]` | TEXT | commonPage.ts:191 | _template_ |
| `downloadBtn` | `//button//span[contains(text(),'{0}')]` | TEXT | downloadAppPage.ts:12 | - |
| `qrPopover` | `//*[contains(text(),'Download app')]/ancestor::div[1]` | TEXT+POSITION | downloadAppPage.ts:13 | 0 / 1 / 1 |
| `moreOptionsBtn` | `//button[normalize-space()='More options']` | TEXT | downloadAppPage.ts:14 | 0 / 1 / 1 |
| `HEADER_WRAPPER_CSS` | `[class*="headerWrapper"]` | CLASS | headerNavPage.ts:7 | 1 / 1 / 1 |
| `dismissOpenPanels` | `xpath=//*[@class="Toastify"]//*[@fill="none"]` | CLASS | headerNavPage.ts:411 | 0 / 0 / 0 |
| `dismissOpenPanels` | `xpath=//*[@role='dialog' and contains(@style,'1001')]//span[contains(@class,'pointer')]` | CLASS+ARIA | headerNavPage.ts:416 | 0 / 0 / 0 |

### Global (i18n sweep)  
_45 locator rủi ro_

| Element (biến trong code) | Locator hiện tại | Loại rủi ro | Nguồn | Kết quả thật S / T / P |
|---|---|---|---|---|
| `headerNav` | `//*[contains(@class,'headerWrapper')]` | CLASS | languageUiPage.ts:7 | 1 / 1 / 1 |
| `sectors` | `//*[@class='overflow-auto fx-column fx-jc-center gap-2 px-3 sm-px-4']` | CLASS | languageUiPage.ts:9 | 0 / 1 / 1 |
| `tabsLoc` | `//*[@style='width: 100%; height: 684px;']//div[contains(@class,'_tabs')]/div` | CLASS | languageUiPage.ts:10 | 2 / 2 / 2 |
| `tableRoot` | `//div[contains(@class,'fx-column z-0 overflow-auto hide-scrollbar-y')]` | CLASS | languageUiPage.ts:11 | 1 / 1 / 1 |
| `constructor` | `[class*="wrapper" i]` | CLASS | languageUiPage.ts:122 | 105 / 93 / 88 |
| `verifyTooltips` | `[class*="txt-help"] { visibility: visible !important; opacity: 1 !important; }` | CLASS | languageUiPage.ts:344 | 0 / 0 / 0 |
| `verifyTooltips` | `[class*="txt-help"]` | CLASS | languageUiPage.ts:347 | 99 / 37 / 34 |
| `verifyInstrumentSearchTable` | `xpath=//*[contains(@class,'_selectMarketWrapper')]/div[1]//*[contains(@class,'_wrapper')]` | CLASS+POSITION | languageUiPage.ts:414 | 0 / 0 / 0 |
| `verifyInstrumentSearchTable` | `xpath=(${sectors} \| ${sectors}/parent::div[1])/following-sibling::div[1]` | POSITION | languageUiPage.ts:425 | _template_ |
| `verifyInstrumentSearchTable` | `xpath=.//div[contains(@class,'relative')]/div[1]/div[1]/div` | CLASS+POSITION | languageUiPage.ts:441 | 0 / 0 / 0 |
| `verifyInstrumentSearchTable` | `xpath=.//div[contains(@class,'relative')]/div[1]/div[position()>1]/div` | CLASS+POSITION | languageUiPage.ts:449 | 0 / 0 / 0 |
| `verifyHoverMenus` | `[class*="_menuPanel"]` | CLASS | languageUiPage.ts:468 | 11 / 12 / 12 |
| `verifyHoverMenus` | `[class*="visible"], [class*="open"], [class*="show"]` | CLASS | languageUiPage.ts:480 | 0 / 0 / 0 |
| `verifyLabelInputAlignment` | `xpath=//*[contains(@style,'min-height: calc')]/following-sibling::div[1]//*[contains(@class,'wrapper style-module-scss-module__')]/following-sibling::` | CLASS+POSITION | languageUiPage.ts:650 | 0 / 0 / 0 |
| `verifyLabelInputAlignment` | `xpath=//*[@class='fx fx-ai-center gap-2 pl-3 md-pl-0']/preceding-sibling::*[1]` | CLASS+POSITION | languageUiPage.ts:653 | 0 / 0 / 0 |
| `verifyLabelInputAlignment` | `xpath=//*[@class='bg-surface-elevated round-3 overflow-hidden']/div[1]/div[1]//*[contains(@class,'pointer')]/*[contains(@class,'__icon')]` | CLASS+POSITION | languageUiPage.ts:658 | 0 / 0 / 0 |
| `verifyLabelInputAlignment` | `xpath=//*[@class='bg-surface-elevated round-3 overflow-hidden']/div[1]/div[2]//*[contains(@class,'__icon')]` | CLASS+POSITION | languageUiPage.ts:661 | 0 / 0 / 0 |
| `verifyLabelInputAlignment` | `xpath=//*[contains(@class,'round-5 bg-surface-elevated txt-center relative shadow-sm')]//button[1]` | CLASS+POSITION | languageUiPage.ts:666 | 0 / 0 / 0 |
| `verifyLabelInputAlignment` | `xpath=//button[contains(@class,'__xSmall')]` | CLASS | languageUiPage.ts:671 | 0 / 0 / 0 |
| `verifyLabelInputAlignment` | `xpath=//*[@class='fx-column gap-4 round-2 p-6 sm-p-4 bg-surface-elevated']//button[1]` | CLASS+POSITION | languageUiPage.ts:675 | 0 / 0 / 0 |
| `verifyLabelInputAlignment` | `xpath=//*[@class='fx-column gap-6']/div[1]/div[2]/div[1]/span[1]/span[1]` | CLASS+POSITION | languageUiPage.ts:692 | 0 / 0 / 0 |
| `verifyLabelInputAlignment` | `xpath=//*[@class='fx-column gap-6']/div[1]/div[2]/div[1]/span[2]/span[1]` | CLASS+POSITION | languageUiPage.ts:697 | 0 / 0 / 0 |
| `verifyLabelInputAlignment` | `xpath=//*[@class='fx-column gap-6']/div[1]/div[2]/div[1]/span[3]/span[1]` | CLASS+POSITION | languageUiPage.ts:702 | 0 / 0 / 0 |
| `verifyLabelInputAlignment` | `xpath=//*[contains(@class,'__tabs')]/div[1]` | CLASS+POSITION | languageUiPage.ts:708 | 0 / 0 / 0 |
| `verifyLabelInputAlignment` | `xpath=//*[@class='fx-as-center fx-column round-2 gap-5']//button[contains(@class,'__medium style-module-scss-module__')]` | CLASS | languageUiPage.ts:710 | 0 / 0 / 0 |
| `verifyLabelInputAlignment` | `xpath=//*[contains(@class,'__tabs')]/div[2]` | CLASS+POSITION | languageUiPage.ts:714 | 0 / 0 / 0 |
| `verifyLabelInputAlignment` | `xpath=//*[@class='fx-1 fx-column gap-6']//button[contains(@class,'__medium style-module-scss-module__')]` | CLASS | languageUiPage.ts:722 | 0 / 0 / 0 |
| `verifyLabelInputAlignment` | `xpath=//*[@class='fx-column gap-5 md-gap-4 p-4 round-5 bg-surface-elevated shadow-sm']/div[2]/div[1]//*[contains(@class,'__icon')]` | CLASS+POSITION | languageUiPage.ts:728 | 0 / 0 / 0 |
| `verifyLabelInputAlignment` | `xpath=//*[@class='fx-column gap-5 md-gap-4 p-4 round-5 bg-surface-elevated shadow-sm']/div[2]/div[2]//*[contains(@class,'__icon')]` | CLASS+POSITION | languageUiPage.ts:733 | 0 / 0 / 0 |
| `verifyLabelInputAlignment` | `xpath=//*[contains(@class,'fx fx-wrap-wrap fx-center-between gap-2')]//*[contains(@class,"style_tabItem__") or contains(@class,'__tabs')] \| //*[conta` | CLASS | languageUiPage.ts:768 | 0 / 0 / 0 |
| `verifyNotificationsPage` | `xpath=//*[contains(@class,"round-5 px-5 py-4 bg-hover-background-float-hovered")]` | CLASS | languageUiPage.ts:806 | 0 / 0 / 0 |
| `verifyOrderBookHeaders` | `xpath=${tabsLoc}//*[contains(@class,"_label")]` | CLASS | languageUiPage.ts:841 | _template_ |
| `verifyDropdownOptions` | `xpath=ancestor::div[contains(@class,"control")][1]` | CLASS+POSITION | languageUiPage.ts:1028 | 0 / 0 / 0 |
| `verifyDropdownOptions` | `#${ariaControls} [role="option"], #${ariaControls} [class*="option"]` | CLASS+ARIA | languageUiPage.ts:1073 | _template_ |
| `verifyDropdownOptions` | `[role="listbox"] [role="option"], [class*="menu"] [class*="option"]` | CLASS+ARIA | languageUiPage.ts:1076 | 0 / 0 / 0 |
| `verifyToastMessage` | `[class*="Toastify"] [role="alert"]` | CLASS+ARIA | languageUiPage.ts:1108 | 0 / 0 / 1 |
| `verifyToastMessage` | `[class*="Toastify"] [role="alert"] *` | CLASS+ARIA | languageUiPage.ts:1114 | 0 / 0 / 14 |
| `toastLoc` | `[class*="Toastify"] [role="alert"]` | CLASS+ARIA | languageUiPage.ts:1129 | 0 / 0 / 1 |
| `verifyToastMessage` | `[class*="txt-feature-red"], [class*="error" i], [class*="helperText" i][class*="Error" i]` | CLASS | languageUiPage.ts:1131 | 114 / 174 / 207 |
| `headers` | `xpath=${tableRoot}/div[1]/div[1]/div` | POSITION | languageUiPage.ts:1274 | _template_ |
| `cells` | `xpath=${tableRoot}/div[2]/div[1]/div[1]/div` | POSITION | languageUiPage.ts:1301 | _template_ |
| `toasts` | `[class*="Toastify"] [role="alert"]` | CLASS+ARIA | languageUiPage.ts:1311 | 0 / 0 / 1 |
| `dismissOpenPanels` | `xpath=//*[@class="Toastify"]//*[@fill="none"]` | CLASS | languageUiPage.ts:1493 | 0 / 0 / 0 |
| `dismissOpenPanels` | `xpath=//*[@role='dialog' and contains(@style,'1001')]//span[contains(@class,'pointer')]` | CLASS+ARIA | languageUiPage.ts:1498 | 0 / 0 / 0 |

### Global (mọi page)  
_19 locator rủi ro_

| Element (biến trong code) | Locator hiện tại | Loại rủi ro | Nguồn | Kết quả thật S / T / P |
|---|---|---|---|---|
| `avatar` | `//*[contains(@class,'userMenu')]` | CLASS | basepage.ts:18 | 1 / 1 / 1 |
| `loginHeaderBtn` | `//*[contains(@class,'headerWrapper')]//*[text()='Log in']` | CLASS+TEXT | basepage.ts:19 | 0 / 0 / 0 |
| `toast` | `//*[@class='Toastify']` | CLASS | basepage.ts:27 | 1 / 1 / 1 |
| `closeNotifyBannerLoc` | `//*[contains(@class,'notification-banner')]//*[contains(@class,'txt-icon-secondary') and contains(@class,'pointer')]` | CLASS | basepage.ts:33 | 1 / 1 / 0 |
| `mmConfirmBtn` | `//button[text()='Confirm' or text()='Approve']` | TEXT | basepage.ts:35 | 0 / 0 / 0 |
| `mmConnectBtn` | `//button[text()='Confirm' or text()='Approve' or text()='Connect']` | TEXT | basepage.ts:36 | 0 / 0 / 0 |
| `mmOption` | `//*[text()='MetaMask']` | TEXT | basepage.ts:37 | 0 / 0 / 0 |
| `inviteCodeDialog` | `//*[text()="Enter Invite Code"]/ancestor::*[.//input][1]` | TEXT+POSITION | basepage.ts:38 | 0 / 0 / 0 |
| `topDialogClose` | `//*[@role='dialog' and contains(@style,'1001')]//span[contains(@class,'pointer')]` | CLASS+ARIA | basepage.ts:40 | 0 / 0 / 0 |
| `contentCloseBtn` | `(//*[contains(@class,'style_contentWrapper')]//*[local-name()='svg'])[1]` | CLASS+POSITION | basepage.ts:41 | 0 / 0 / 0 |
| `containsContentTpl` | `//*[contains(.,"{0}")]` | TEXT | basepage.ts:45 | - |
| `containsContentTwoTpl` | `//*[contains(.,"{0}") or contains(.,"{1}")]` | TEXT | basepage.ts:47 | - |
| `exactTextTpl` | `//*[text()="{0}"]` | TEXT | basepage.ts:48 | - |
| `containsTextTpl` | `//*[contains(text(),"{0}")]` | TEXT | basepage.ts:49 | - |
| `titleContains` | `//*[contains(text(),"${title}")]` | TEXT | basepage.ts:58 | _template_ |
| `exactText` | `//*[text()='${text}']` | TEXT | basepage.ts:63 | _template_ |
| `confirmBtn` | `${dialog}//button[normalize-space()="Confirm"]` | TEXT | basepage.ts:1479 | _template_ |
| `closeBanner` | `//*[contains(@class, 'hover-black')]` | CLASS | basepage.ts:1634 | 0 / 0 / 0 |
| `signLoc` | `${dialog}//*[contains(text(),'Sign with SecureKey')]` | TEXT | basepage.ts:1927 | _template_ |

### Global (theme sweep)  
_13 locator rủi ro_

| Element (biến trong code) | Locator hiện tại | Loại rủi ro | Nguồn | Kết quả thật S / T / P |
|---|---|---|---|---|
| `settingIcon` | `//*[contains(@class,'menuPanel')][.//*[@aria-label='Settings']]` | CLASS+ARIA | themeUiPage.ts:7 | 1 / 1 / 1 |
| `headerWrapper` | `//*[contains(@class,'headerWrapper')]` | CLASS | themeUiPage.ts:9 | 1 / 1 / 1 |
| `uiThemeRow` | `${settingIcon}//*[normalize-space(text())='UI Theme']` | TEXT | themeUiPage.ts:12 | _template_ |
| `setThemeAndTrack` | `[${i + 1}] ${f.url}\n    ${f.error.split("\n")[0]}` | POSITION | themeUiPage.ts:76 | _template_ |
| `setThemeAndTrack` | `[${f.theme}] ${f.error.split("\n")[0]}` | POSITION | themeUiPage.ts:118 | _template_ |
| `verifyAllChecks` | `[${i + 1}] [${f.theme}] [${f.check}] ${f.url}\n    ${f.error.split("\n")[0]}` | POSITION | themeUiPage.ts:238 | _template_ |
| `verifyIcons` | `[class*='price' i], [class*='value' i], [class*='amount' i], [class*='volume' i], td, th` | CLASS | themeUiPage.ts:1090 | 23 / 24 / 18 |
| `verifyTables` | `xpath=//table \| //*[contains(@class,'_tableRow')]/ancestor::*[contains(@class,'table')][1]` | CLASS+POSITION | themeUiPage.ts:1303 | 0 / 0 / 0 |
| `verifyCharts` | `xpath=//canvas \| //*[contains(@class,'chart') and not(self::canvas)]` | CLASS | themeUiPage.ts:1317 | 0 / 0 / 0 |
| `verifyCards` | `xpath=//*[contains(@class,'card') or contains(@class,'Card') or contains(@class,'panel') or contains(@class,'Panel')]` | CLASS | themeUiPage.ts:1397 | 0 / 0 / 0 |
| `verifyCards` | `[class*='card'],[class*='Card'],[class*='panel'],[class*='Panel']` | CLASS | themeUiPage.ts:1420 | 15 / 15 / 15 |
| `dismissOpenPanels` | `xpath=//*[@class="Toastify"]//*[@fill="none"]` | CLASS | themeUiPage.ts:1523 | 0 / 0 / 0 |
| `dismissOpenPanels` | `xpath=//*[@role='dialog' and contains(@style,'1001')]//span[contains(@class,'pointer')]` | CLASS+ARIA | themeUiPage.ts:1528 | 0 / 0 / 0 |

### Onboarding  
_3 locator rủi ro_

| Element (biến trong code) | Locator hiện tại | Loại rủi ro | Nguồn | Kết quả thật S / T / P |
|---|---|---|---|---|
| `avatar` | `//*[contains(@class,'userMenu')]` | CLASS | homepage.ts:5 | 1 / 1 / 1 |
| `btnLocator` | `${avatar}//button[@text()='Create trading account']` | TEXT | homepage.ts:65 | _template_ |
| `btnLocator` | `${avatar}/parent::*/parent::*/parent::*//button['Create trading account']` | POSITION | homepage.ts:92 | _template_ |
