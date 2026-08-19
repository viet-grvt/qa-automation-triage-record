# Đánh giá khả năng automate — 7 ticket PRO (PRE-RELEASE v3.3.0)

Repo: `c:/Gravity/qa-automation` @ `93b13c60`. Stack mobile: WebdriverIO 9 + Appium + Cucumber, chạy trên BrowserStack (UiAutomator2 / XCUITest).
Đi kèm: [pre-release-v3.3.0-coverage-gap.md](pre-release-v3.3.0-coverage-gap.md)

## Kết luận ngắn

**Cả 7 ticket đều automate được** — không ticket nào cần capability mà framework hiện chưa có. Nhưng *automate được* và *nên automate* là hai chuyện khác nhau: chi phí thật nằm ở page object còn thiếu (Advanced Order form, Price Alerts mobile) chứ không nằm ở assertion.

| Ticket | Automate? | Effort | ROI | Ghi chú chặn |
|---|---|---|---|---|
| PRO-8818 Spot tag | **Dễ** | 1 d | Cao | — |
| PRO-8840 Mark Price trên Spot (**web**) | **Rất dễ** | 0.5 d | Rất cao | POM web đã có sẵn |
| PRO-8843 price = 0 | **Dễ** | 1.5 d | Cao | Chờ chốt expected behaviour |
| PRO-8841 max cap 1e9 | **Dễ** | 1 d | Trung bình | Chờ chốt spec (clamp / reject) |
| PRO-8842 Quick Order Spot thiếu lỗi | **Trung bình** | 2 d | Cao | Test data phải tính runtime |
| PRO-8844 Quick Order treo (blocker) | **Trung bình–khó** | 3 d | Rất cao | Advanced form chưa được model |
| PRO-8840 Mark Price trên Spot (**mobile**) | **Trung bình** | 3 d | Trung bình | POM Price Alerts mobile = 0 |
| PRO-8839 Earn lệch trái ở `ja` | **Trung bình** | 2 d | Thấp nếu làm riêng, **cao nếu làm generic** | — |

## Đính chính report trước

Điểm 5 trong `coverage-gap.md` viết "mobile không có assertion layout/geometry nào" — **sai**. Framework đã có sẵn và đang chạy:

- `step_definitions/home.steps.ts:15-50` — M-084 (`features/e2e-menus.feature:20`) assert market tab labels render trên một dòng, không overflow, bằng rects + `driver.getWindowSize()`, có cả wrap-detection theo tỉ lệ chiều cao.
- `page_object/abstracts/language_page.ts:677` — `locateRect(word)` resolve bounding box của text bất kỳ, thử lần lượt `@text / @content-desc / @label / @name / @value` nên chạy được cả Android và iOS.
- `sharp` có trong deps, đã dùng để composite SVG overlay lên screenshot và attach vào Allure (`language_page.ts:660-675`).

Nghĩa là PRO-8839 không phải "vô hình về cấu trúc" như tôi viết — công cụ có đủ, chỉ là chưa áp vào locale layout. Điều này hạ effort của B5 và nâng khả năng automate của 8839 từ "khó/brittle" lên "trung bình". Đã sửa trong file gốc.

## Chi tiết từng ticket

### PRO-8844 — Quick Order treo sau khi từ Advanced Order (blocker) — Automate: CÓ, 3 d
Đây là ticket giá trị nhất và cũng dễ bị đánh giá sai là "không automate được vì làm sao detect app treo".

**Assertion không cần detect treo.** Chỉ cần assert *hệ quả của tap*, không assert visibility:
1. Đẩy Advanced form vào error state (amount > available → "Max order size is …").
2. Navigate sang Quick Order.
3. Assert stale error text **không** xuất hiện trên panel Quick Order → đây là assert trực tiếp cái leak, độc lập với chuyện treo.
4. Tap Buy → assert confirmation sheet / toast xuất hiện trong timeout. Nếu app treo, bước này fail.

Chỗ nhiều người sai: bug để màn hình vẫn scroll được nên `isDisplayed()` vẫn pass. Assert theo hệ quả của tap thì không bị lừa.

**Chi phí thật:** `grep -rin "advanced.order"` trên `mobile_tests` = 0 hit. Advanced Place Order form chưa được model → phải thêm method vào `abstracts/trade_page.ts` + `android_trade_page.ts` + `ios_trade_page.ts`. 3 ngày là ở đây, không phải ở assertion.

**Rủi ro cần xử lý:**
- Nếu bug reproduce trong CI thì app đứng → scenario phải force-restart app trong `After` hook, nếu không cả spec sau đó fail theo. Framework có sẵn pattern này (`com.openApp()`, tag `@notReloadSession`) nhưng phải khai báo tường minh.
- iOS locator dùng positional XPath (`following-sibling::XCUIElementTypeOther[8]` trong `ios_trade_page.ts:26`) → locator mới cho Advanced form sẽ dễ vỡ. **Nên xin mobile team thêm testID** cho Advanced form + error node của Quick Order; xin được thì effort và flake giảm đáng kể.

### PRO-8840 — Price Alerts: Mark Price trên Spot — Automate: CÓ. Web 0.5 d / Mobile 3 d
Tách hai nửa vì ROI lệch nhau rất xa.

**Web gần như miễn phí.** `ui_tests/pages/priceAlertFormDialog.ts` đã có `getPriceType()` trả về list options; `priceAlert.spec.ts:18` chỉ pin cứng `INSTRUMENT = "BTC_USDT_Perp"`. Chỉ cần parameterise qua một Perp + một Spot pair và assert `"Mark Price"` ∉ options khi là Spot. Cùng một business rule, guard bằng POM có sẵn.

**Mobile đắt hơn 6 lần** vì Price Alerts chưa có POM nào (chỉ có regex tiêu đề notification ở `helpers/langDetect.ts:178`).

→ Làm web trước, mobile sau. Rule được bảo vệ ngay với 0.5 ngày.

### PRO-8842 — Quick Order Spot thiếu lỗi insufficient balance — Automate: CÓ, 2 d
**Vấn đề chính là test data, không phải assertion.** `ui_tests/pages/flow/authenFlow.ts:192` mint 1,000,000,000 USDT cho account → không thể hardcode một con số để "vượt balance".

Cách làm đúng: đọc available balance lúc runtime rồi nhập `available * 10`. Deterministic bất kể account được fund bao nhiêu, không cần account nghèo riêng.

Cần thêm locator cho error prompt trong panel Quick Order (chưa có). Phần assert parity với Advanced form phụ thuộc PRO-8844 (cùng cần Advanced POM) — có thể bỏ nửa parity, chỉ assert error xuất hiện, là đã guard được regression.

### PRO-8843 — price = 0 tới được confirmation — Automate: CÓ, 1.5 d
Reuse tốt: step `Then("The {string} button should be disabled")` đã có ở `step_definitions/trade.steps.ts:441`; locator `orderPriceInput` đã có (`ios_trade_page.ts:214`).

**Lưu ý về expected behaviour:** fix có thể là disable nút, có thể là inline error — chưa chốt. Nếu assert đúng một cơ chế thì test sẽ phải sửa lại khi fix khác đi. Nên assert invariant yếu hơn nhưng ổn định: *"không thể tới được confirmation sheet khi price = 0"*. Đúng với mọi cách fix.

An toàn: không submit order thật, nên chạy testnet không tạo rác.
Cần thêm step "confirmation sheet is not shown" — hiện chưa có (`grep "Confirm order"` = 0 hit).

### PRO-8841 — Amount không cap 1,000,000,000 — Automate: CÓ, 1 d, nhưng chờ spec
Kỹ thuật rất đơn giản: nhập `10000000000000000` → assert bị clamp về ≤ 1e9 hoặc hiện lỗi.

Vướng ở chỗ khác: ticket nói "align with WEB" nhưng **web cũng không có test nào cho cap này** (`grep "1000000000"` chỉ ra helper mint USDT). Nên viết một test parity dùng chung constant cho cả web và mobile, thay vì hai test rời — như vậy mới thật sự guard được cái rule "hai platform giống nhau".

Cân nhắc đẩy xuống `api_tests` một phần: nếu BE cũng phải reject thì test API rẻ và ổn định hơn test UI.

### PRO-8818 — thiếu tag "Spot" — Automate: CÓ, 1 d — ROI cao nhất trên mỗi ngày công
Deterministic, không cần test data, chỉ là presence assertion. Bước chọn Spot pair đã có sẵn cả hai platform (`android_trade_page.ts:212`, `ios_trade_page.ts:140`).

**Bẫy duy nhất:** chữ "Spot" cũng xuất hiện ở market tab → XPath phải scope vào header của trade form (sibling của instrument name), không match text toàn cục, nếu không test sẽ pass giả.

### PRO-8839 — Earn lệch trái ở tiếng Nhật — Automate: CÓ, 2 d, nhưng đừng làm riêng lẻ
Kỹ thuật đã có (xem phần đính chính). Assertion: lấy rect của text `"Earning …% APY on …"`, so tâm ngang với tâm container/screen trong tolerance.

**Thiết kế nên dùng self-baselining:** so center-offset ở `ja` với chính nó ở `en` trong tolerance, thay vì hardcode "phải ở giữa ± N px". Tránh phụ thuộc device size và font từng locale.

Rủi ro: text động (APY value, số dư) → phải match theo prefix/regex chứ không exact string.

**Judgment call:** severity Low, và làm riêng một test cho một string ở màn Earn thì maintenance cost không đáng. Chỉ nên làm nếu đóng gói thành step generic kiểu *"these elements should stay centered/within bounds in `<locale>`"*, rồi tái dùng cho PRO-8822 (Russian dropdown lệch) và PRO-8827 (Spread bị cắt) từ đợt 17-Aug. Làm generic thì ROI cao; làm one-off thì tôi khuyên để manual.

## Yếu tố cấp framework quyết định effort thật

**Thuận lợi (đã có, tái dùng được ngay):**
- Geometry assertion pattern hoàn chỉnh — rects + window size + wrap/overflow detection (`home.steps.ts:15-50`).
- `locateRect()` cross-platform cho text bất kỳ.
- `sharp` + Allure attachment để chụp annotated screenshot khi fail.
- Step "button should be disabled" và "blocked with max order size error" đã có → negative assertion không phải viết từ đầu.
- POM web Price Alerts đầy đủ.

**Chặn / đẩy chi phí lên:**
1. **Không có env pre-release** — quan trọng nhất, và không liên quan tới việc từng ticket có automate được hay không. Viết xong 7 test mà suite vẫn chỉ chạy testnet thì vẫn không guard được đợt pre-release sau. Đây là lý do A1 phải đi trước B1–B5.
2. **iOS locator brittleness** — XPath positional index, không có testID trên cả Android (dùng `@text`/`@content-desc`) lẫn iOS. Đây là driver chi phí lớn nhất cho 8844 và rủi ro pass-giả cho 8818. Xin testID từ mobile team là đòn bẩy tốt nhất, rẻ hơn mọi thứ khác trong list này.
3. **iOS pre-release không install được trên BrowserStack** — 4/7 bug tìm thấy trên iOS. Không giải quyết thì phần iOS của 8844/8843/8842/8841 vẫn phải test tay.

## Khuyến nghị thứ tự

1. **Tuần này:** PRO-8818 (1 d) + PRO-8840 web (0.5 d) — rẻ, deterministic, guard ngay.
2. **Song song:** xin testID cho Advanced Order form + Quick Order error node → rồi làm PRO-8844 (3 d).
3. **Sau khi chốt spec:** PRO-8843 + PRO-8841 gộp thành một validation lane (`features/order-validation.feature`), cộng PRO-8842 vào cùng feature file (2.5–4 d).
4. **Chỉ khi làm generic:** PRO-8839 trong step locale-layout dùng chung với PRO-8822/8827.
5. **Xuyên suốt:** A1 (env pre-release) là điều kiện để mọi thứ trên có ý nghĩa.

Không có ticket nào tôi đánh giá là "không automate được". Ticket duy nhất tôi khuyên **không** automate dạng one-off là PRO-8839.
