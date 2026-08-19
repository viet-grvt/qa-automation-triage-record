# QE-966 — Kế hoạch thực thi
**Ticket:** [QE-966] [QA] Trading module for WEB + MOBILE bug scenarios into automation
**Assignee:** Viet · **Reporter:** Tuan Nhu Dinh · **Status:** In Progress · **Priority:** Medium
**Parent:** [QE-964] [QA] Automation enhancements for WEB and MOBILE (Epic, To Do) · **Due:** chưa có
**Nguồn:** https://grvt.atlassian.net/browse/QE-966 — fetch read-only 2026-08-19, description có **41 bug** (WEB 6 · MOBILE 35), không comment, không subtask, không issue link.
**Repo audit:** `c:/Gravity/qa-automation` @ `76b0cbc` (QE-886) — WEB = Playwright `ui_tests/tests/**`, MOBILE = WDIO/Cucumber `mobile_tests/features/*.feature`.
**Scope chốt sau discuss:**
> Convert bug thành automation test. Nếu đã có test → **extend thêm verification checkpoints**. Nếu chưa → **viết mới**.

---
## 1. Cluster map — 41 bug → 13 flow

> Đây là lý do không nên đếm "41 test". Hầu hết bug nằm trong cùng một flow đã có test, chỉ thiếu assertion.

### WEB — 6 bug / 4 cluster

| Cluster | Bug | Flow |
|---|---|---|
| **W1** Order amendment | PRO-7603 | Amend order sau khi list pair mới |
| **W2** Export | PRO-7508 · PRO-7782 | Export order/transaction CSV |
| **W3** i18n trading | PRO-7949 · PRO-7695 | Locale trên Quick Order + order book footer |
| **W4** Leverage display | PRO-8386 | Max leverage hiển thị khi đổi instrument |

### MOBILE — 35 bug / 9 cluster

| Cluster | Bug | Flow | Số bug |
|---|---|---|---|
| **M1** TP/SL create & split | 8345 · 8082 · 8098 · 8347 · 8434 · 8650 | Tạo TP/SL, split TP/SL, standalone TPSL | 6 |
| **M2** TP/SL edit & amend | 8828 · 8790 · 8085 · 8103 · 8101 · 8100 · 8099 · 8348 | Edit TP/SL panel: dropdown, slider, ROI%, Confirm | 8 |
| **M3** Order lifecycle & sync | 8403 · 8399 · 7699 · 7907 · 8435 | State list sau cancel/amend/place | 5 |
| **M4** Quick Order | 8844 · 8509 · 8842 | Quick Order PERP + SPOT | 3 |
| **M5** Validation & confirm sheet | 8843 · 8649 · 8407 · 7605 · 7472 · 8648 · 8819 | Validate input + nội dung confirm/toast | 7 |
| **M6** Leverage | 8210 | Đổi leverage | 1 |
| **M7** Instrument & market data | 8821 · 7797 | Delisted filter, order book vs chart | 2 |
| **M8** Scale order | 8633 | Scale order Post-Only | 1 |
| **M9** Performance | 7700 · 7798 | Freeze sau đặt lệnh kéo dài, sluggish sau OTA | 2 |

**Nhận xét:** M1 + M2 = 14/35 bug đều nằm trong TP/SL. Repo **đã có** `mobile_tests/features/tpsl.feature` với 25 scenario (split modal, TP/SL row, badge count, ROI%, amend-không-duplicate, trigger price range) → phần lớn công việc ở đây là **thêm assertion vào test sẵn có**, không phải viết 14 test mới. Đây là chỗ đáng làm đầu tiên vì tỉ lệ coverage/effort cao nhất.

---

## 2. Bảng phân loại — mỗi bug một dòng, quyết định EXTEND / NEW / NOT-AUTO

**Đã audit repo → cột `Test hiện có?` ghi tên spec/feature cụ thể; ô `—` nghĩa là đã tìm và xác nhận không có coverage.** Cột `Quyết định` là **đề xuất**, chốt lại trước khi bắt đầu từng đợt.

### WEB — 6 bug

| Bug | Cluster | Platform | Sev | Test hiện có? | **Quyết định** | Checkpoint cần thêm (nếu EXTEND) | Est | Ngày dự kiến | Status |
|---|---|---|---|---|---|---|---|---|---|
| PRO-7603 | W1 | WEB | High | `ui_tests/tests/placeOrders/orderAmendments.spec.ts` (4 test: limit amend, position-linked TP/SL, standalone TP/SL, OCO) | **EXTEND** | Sau amend: không có error toast; assert toast là confirmation, chạy trên instrument mới list (param instrument từ list-pair API, không hardcode) | 0.3 | 08-28 | ⬜ |
| PRO-7508 | W2 | WEB | High | `ui_tests/tests/exportHistory/exportHistory.spec.ts` — có test "exported file row renders correctly" | **EXTEND** | Parse CSV: cột size của Equity/ETF (SOXL) phải là số hữu hạn, khác chuỗi `inf`; thêm 1 instrument Equity vào seed data | 0.3 | 08-28 | ⬜ |
| PRO-7782 | W2 | WEB | Medium | `exportHistory.spec.ts` — order/trade/transaction CSV + PDF đều đã có | **EXTEND** | Assert file thực sự tải về (size > 0, header đúng), không chỉ assert "offers email delivery" | 0.2 | 08-28 | ⬜ |
| PRO-7949 | W3 | WEB | Medium | `ui_tests/tests/languageUiLayout.spec.ts` (scan untranslated text) — **chưa cover Quick Place Order**; không có spec Quick Order nào trên WEB | **EXTEND** | Thêm Quick Order panel vào danh sách surface được scan; assert "Enter Qty" có bản dịch ở mọi locale | 0.3 | 08-28 | ⬜ |
| PRO-7695 | W3 | WEB | Medium | `languageUiLayout.spec.ts` + `language.spec.ts` — cover layout/overflow, **không cover đúng-sai nghĩa của chuỗi** | **NEW** | — (assert footer order book locale `ja`: long/buy vs sell/short không bị đảo — cần bảng kỳ vọng ja) | 0.5 | 08-28 | ⬜ |
| PRO-8386 | W4 | WEB | Low | `estimatedLiqPrice.spec.ts` · `verifyMarginRulesUI.spec.ts` · `isolatedMarginMode.spec.ts` có dùng leverage, **không assert max-leverage lúc đổi instrument** | **NEW** ⚠ transient | — (poll max leverage trong 2s sau khi switch sang PUMP_USDT: không được xuất hiện giá trị nào khác 10x) | 0.5 | 08-28 | ⬜ |

### MOBILE — 35 bug

| Bug | Cluster | Platform | Sev | Test hiện có? | **Quyết định** | Checkpoint cần thêm (nếu EXTEND) | Est | Ngày dự kiến | Status |
|---|---|---|---|---|---|---|---|---|---|
| PRO-8844 | M4 | MOBILE | Highest | `e2e-tests-privy.feature:258` Quick Order PERP market+limit | **EXTEND** | Sau khi Advanced Order trả error toast: Quick Order panel vẫn nhận input và vẫn place được lệnh (không hang) | 0.3 | 08-25 | ⬜ |
| PRO-8403 | M3 | MOBILE | Highest | `e2e-tests-privy.feature:165` full market order lifecycle · `tpsl.feature` (Limit TP/SL) | **EXTEND** | Sau cancel → pull-to-refresh → order đã cancel **không** xuất hiện lại trong Open Orders; verify cả sau app restart | 0.3 | 08-26 | ⬜ |
| PRO-8345 | M1 | MOBILE | Highest | `tpsl.feature:145–221` — đã có 5 scenario "amend không duplicate leg" | **EXTEND** | Assert **đếm số leg TP = 1** sau amend position-linked TP/SL (scenario:174 gần nhất, hiện chỉ cover standalone) | 0.2 | 08-20 | ⬜ |
| PRO-8210 | M6 | MOBILE | Highest | `long-running-trade-view.feature:26` có đổi leverage 1x/2x/3x nhưng chỉ như background load | **EXTEND** | Scenario riêng: set leverage → assert **không** có toast "Failed to set leverage" và giá trị mới persist sau reload | 0.3 | 08-27 | ⬜ |
| PRO-7700 | M9 | MOBILE | Highest | `long-running-trade-view.feature` (30 phút + 1 giờ stability) | **EXTEND** ⚠ perf | Trong session dài: thêm vòng đặt lệnh liên tục, assert thời gian phản hồi tap→toast không vượt budget (cần chốt budget) | 0.5 | 09-01 | ⬜ |
| PRO-7699 | M3 | MOBILE | Highest | `e2e-tests-privy.feature:56` market · `:165` lifecycle | **EXTEND** | Sau place limit/market: list cập nhật **không cần restart** — poll Open Orders theo ngưỡng, fail nếu chỉ pass sau restart | 0.3 | 08-26 | ⬜ |
| PRO-8828 | M2 | MOBILE | High | `tpsl.feature:203` repeated TP amendments | **EXTEND** ⚠ perf | Bọc bước amend bằng timing assertion (budget cần chốt, đề xuất < 2s) | 0.2 | 08-21 | ⬜ |
| PRO-8821 | M7 | MOBILE | High | — (grep `delist` toàn repo: 0 kết quả) | **NEW** | — (mở filter dropdown Positions/Open Orders: instrument delisted không được có trong list) | 0.5 | 09-01 | ⬜ |
| PRO-8790 | M2 | MOBILE | High | `tpsl.feature:89` TP theo ROI percent · WEB có `placeOrders/roi.spec.ts` để đối chiếu kỳ vọng | **EXTEND** | TP/SL sheet phải render **ROI và PnL**, không chỉ "Change %" | 0.2 | 08-21 | ⬜ |
| PRO-8650 | M1 | MOBILE | High | `tpsl.feature` — không có scenario nào về max slippage | **NEW** | — (set max slippage → TP/SL control phải bị disable) | 0.5 | 08-22 | ⬜ |
| PRO-8633 | M8 | MOBILE | High | `e2e-tests-privy.feature:92` POST_ONLY (không phải Scale) · WEB `e2e/testUIForScaleOrders.spec.ts` | **NEW** ⚠ env | — (Scale Order sheet: Post-Only checkbox tồn tại; **phải chạy được trên PROD** hoặc assert theo feature-flag) | 0.8 | 09-01 | ⬜ |
| PRO-8509 | M4 | MOBILE | High | `e2e-tests-privy.feature:284` "Quick Order on a Spot pair hides margin and leverage controls and still places orders" — **đã cover chính xác bug này** | **EXTEND** | Đã có assert `leverage control should not be rendered`; thêm assert margin section absent + lệnh SPOT place thành công end-to-end (prod-leak → đưa vào smoke) | 0.1 | 08-25 | ⬜ |
| PRO-8399 | M3 | MOBILE | High | `tpsl.feature:77` Cancel all TP/SL removes badge | **EXTEND** ⚠ transient | Sau Cancel All: order count về 0 **trong ≤ 1.5s** (polling có ngưỡng, không screenshot) | 0.2 | 08-26 | ⬜ |
| PRO-8347 | M1 | MOBILE | High | `tpsl.feature:31` quantity over max blocked · `:221+` trigger price range validation | **EXTEND** | TP/SL dưới min notional → **phải có error toast**, chạy trên cả iOS và Android | 0.2 | 08-20 | ⬜ |
| PRO-8085 | M2 | MOBILE | High | `tpsl.feature` (chạy trên iOS qua `wdio.pwa.ios.bs.config.ts`) | **EXTEND** | Trong TPSL panel: mỗi dropdown tap được và đổi được giá trị (prod-leak → đưa vào smoke iOS) | 0.3 | 08-21 | ⬜ |
| PRO-7797 | M7 | MOBILE | High | `e2e-tests-privy.feature:24` Order-Book sorted · `:32` not crossed · `:18` chart rendered — nhưng **không cross-check order book vs chart** | **EXTEND** | Trên USDC/USDT: last price của order book và của chart lệch ≤ tick size | 0.3 | 09-01 | ⬜ |
| PRO-8843 | M5 | MOBILE | Medium | `e2e-tests-privy.feature:56` market order · confirm sheet chưa được assert nội dung | **EXTEND** | Price `0.00000` phải bị chặn trước confirm; order value không được là `--` | 0.2 | 08-27 | ⬜ |
| PRO-8842 | M4 | MOBILE | Medium | `e2e-tests-privy.feature:284` Quick Order SPOT | **EXTEND** | Nhập USDT > available balance → hiện error, không cho submit | 0.2 | 08-25 | ⬜ |
| PRO-8819 | M5 | MOBILE | Medium | `e2e-tests-privy.feature:56` market BUY/SELL | **EXTEND** | Toast sau market order phải có fill details (qty + avg price), đối chiếu format với WEB | 0.2 | 08-27 | ⬜ |
| PRO-8649 | M5 | MOBILE | Medium | `tpsl.feature:31` min/max size blocked (assert bị chặn, **không** assert layout) | **EXTEND** ⚠ layout | Bounding box của error message và của Quantity field **không giao nhau**; không dùng visual diff | 0.3 | 08-27 | ⬜ |
| PRO-8435 | M3 | MOBILE | Medium | `e2e-tests-privy.feature:165` lifecycle — không assert view mode | **EXTEND** | Sau amend: screen vẫn ở OrderBook mode, không tự nhảy sang Chart | 0.2 | 08-26 | ⬜ |
| PRO-8407 | M5 | MOBILE | Medium | — (không có scenario về layout sau nhiều lệnh) | **NEW** ⚠ layout | — (place N lệnh liên tiếp → bounding box label Quantity không giao value) | 0.5 | 08-27 | ⬜ |
| PRO-8348 | M2 | MOBILE | Medium | `tpsl.feature:89` ROI percent (không có scenario switch ROI% ↔ Offset%) | **NEW** ⚠ layout | — (switch ROI% → Offset%: slider vẫn có border; nếu framework không assert được style → NOT-AUTO) | 0.5 | 08-21 | ⬜ |
| PRO-8103 | M2 | MOBILE | Medium | `tpsl.feature:63` edit trigger price persists | **EXTEND** | Kéo slider tới 100% → dropdown trong Edit TP/SL vẫn clickable (Android) | 0.3 | 08-21 | ⬜ |
| PRO-8101 | M2 | MOBILE | Medium | `tpsl.feature:63` edit trigger price persists | **EXTEND** ⚠ transient | Sau Confirm amend: UI phản ánh giá trị mới trong ≤ 1.5s (polling ngưỡng) | 0.2 | 08-21 | ⬜ |
| PRO-8100 | M2 | MOBILE | Medium | `tpsl.feature:221–268` trigger price range validation (whole + split, long + short) | **EXTEND** | Thêm case ROI% ngoài khoảng (vd 9999) → error visible; hiện chỉ cover trigger price | 0.2 | 08-20 | ⬜ |
| PRO-8099 | M2 | MOBILE | Medium | `tpsl.feature:63` mở Edit TP/SL | **EXTEND** | Mở panel, không đổi gì → Confirm button `disabled` | 0.1 | 08-20 | ⬜ |
| PRO-8098 | M1 | MOBILE | Medium | `tpsl.feature:100` first SL target row | **EXTEND** | Sau khi keypad mở: SL Trigger Price field vẫn visible (bounding box không bị keypad che) | 0.3 | 08-22 | ⬜ |
| PRO-8082 | M1 | MOBILE | Medium | `tpsl.feature:41` "up to six TP targets can be added" — đã cover phía TP | **EXTEND** | Mirror sang SL: sau 6 SL, Add disabled **và** không thêm được leg thứ 7 bằng đường nào khác (assert số leg = 6 sau confirm) | 0.2 | 08-20 | ⬜ |
| PRO-7907 | M3 | MOBILE | Medium | WEB `e2e/testUIForScaleOrders.spec.ts`; MOBILE — không có scale order | **NEW** ⚠ transient | — (sau khi place scaled order: "No Positions" empty-state không được xuất hiện; poll trong 2s) | 0.8 | 08-26 | ⬜ |
| PRO-7798 | M9 | MOBILE | Medium | `long-running-trade-view.feature` | **NOT-AUTO** | Lý do: cần OTA update thật giữa 2 lần chạy — không dựng được trong CI. Route về manual regression sau mỗi OTA | 0 | — | ⬜ |
| PRO-7605 | M5 | MOBILE | Medium | `e2e-tests-privy.feature:141` REDUCE_ONLY orders | **EXTEND** ⚠ transient | Min order size validation trên Reduce-Only phải **giữ nguyên**, không flash rồi mất — poll message còn visible sau 2s | 0.3 | 08-27 | ⬜ |
| PRO-7472 | M5 | MOBILE | Medium | `e2e-tests-privy.feature:92` POST_ONLY orders | **EXTEND** | Edit quantity vượt margin trên Post-Only Limit → error insufficient margin xuất hiện | 0.3 | 08-27 | ⬜ |
| PRO-8648 | M5 | MOBILE | Low | `e2e-tests-privy.feature:165` lifecycle (confirm sheet chưa assert field) | **EXTEND** | Confirm Order sheet phải có dòng `Order Type: Limit` cho lệnh Limit | 0.1 | 08-27 | ⬜ |
| PRO-8434 | M1 | MOBILE | Low | `tpsl.feature:133` data resets when row deleted / tab switched (gần nhất, không phải standalone TPSL) | **EXTEND** | Standalone TPSL: đổi trigger price → **không** có lỗi "Data not found" | 0.2 | 08-22 | ⬜ |

**Tổng est:** WEB ≈ 2.1 ngày · MOBILE ≈ 8.6 ngày · **≈ 10.7 ngày** — 32 EXTEND, 8 NEW, 1 NOT-AUTO.

**Ba nhãn quyết định:**

| Nhãn | Nghĩa | Est điển hình | Số bug |
|---|---|---|---|
| **EXTEND** | Flow đã có test, chỉ thêm assertion / kiểm tra thêm state | 0.1–0.3 ngày | 32 |
| **NEW** | Chưa có test cho flow này, viết mới | 0.5–1.5 ngày | 8 |
| **NOT-AUTO** | Không automate được → ghi lý do, route về manual regression | 0 | 1 |

Cột `Test hiện có?` phải ghi **tên spec cụ thể**, không ghi ✓/✗. Không biết tên file thì chưa audit xong.

---

## 3. Nhóm cần cẩn thận — đừng để làm hỏng flakiness target của QE-935

> Một số bug trong danh sách này rất dễ tạo ra test flaky. Automate ẩu ở đây sẽ phá mục tiêu <3% của QE-935. Trong bảng mục 2, các dòng này được đánh dấu ⚠.

**Bug về trạng thái thoáng qua (transient state)** — `8386` flashes 50x · `7907` "No Positions" flash ~1s · `7605` validation flash · `8399` count lingers ~3s · `8101` delayed UI update
→ Test phải bắt **trạng thái trung gian**, mà trạng thái đó phụ thuộc timing. Cách an toàn: assert bằng polling có ngưỡng rõ ràng (ví dụ "trong vòng 1.5s sau Cancel All, count phải về 0"), không assert bằng screenshot tại một thời điểm.

**Bug về layout/overlap** — `8649` error đè lên field · `8407` label đè value · `8348` mất border slider
→ Không dùng visual diff (nguồn flaky lớn nhất). Dùng element bounding-box assertion: hai element không được giao nhau. Riêng `8348` (border của slider) là thuộc tính style — nếu framework không đọc được reliable → xếp NOT-AUTO và đẩy sang manual.

**Bug về hiệu năng** — `7700` freeze · `7798` sluggish sau OTA · `8828` amend chậm
→ Đây là **assertion về thời gian**, không phải về chức năng. Phải chốt budget cụ thể với team trước khi viết (ví dụ "amend TP/SL hoàn tất <2s"), nếu không test sẽ đỏ tuỳ máy. `7798` (sau OTA update) đã xếp **NOT-AUTO**. `7700` gắn vào `long-running-trade-view.feature` vì suite này đã chạy 30 phút / 1 giờ sẵn.

**Bug env-specific** — `8633` Scale Order Post-Only checkbox thiếu **trên Production**
→ Cần test chạy được ở PROD hoặc ít nhất assert theo feature-flag. Ghi rõ env trong test.

**Bug platform-specific** — `8085` · `8347` · `8348` (iOS) · `8103` (Android)
→ Repo có config riêng (`wdio.pwa.ios.bs.config.ts` vs `wdio.local.config.ts`). Tag scenario theo platform, đừng để chạy chéo rồi fail giả.

Đề xuất: mọi test thuộc nhóm này **chạy 10 lần liên tiếp phải green 10/10** trước khi merge vào suite chính. Chưa đạt thì để ở suite riêng, không đưa vào smoke.

---

## 4. Quy ước "extend checkpoints" — thống nhất trước khi làm

Vì phần lớn công việc là thêm assertion vào test cũ, cần quy ước để 3 tháng sau còn truy được vì sao có assertion đó:

```javascript
// PRO-8099 — Confirm button phải disabled khi chưa thay đổi gì
await expect(tpslSheet.confirmButton).toBeDisabled();

// PRO-8100 — trigger price / ROI% phải bị chặn ngoài khoảng hợp lệ
await tpslSheet.setRoi(9999);
await expect(tpslSheet.errorMessage).toBeVisible();
```

MOBILE là Cucumber nên checkpoint đi kèm step mới, comment đặt ngay trên `Then`:

```gherkin
  # PRO-8099 — Confirm button phải disabled khi chưa thay đổi gì
  Then the Edit TP/SL confirm button should be disabled
```

Quy tắc:
- [ ] Mỗi checkpoint có comment `// PRO-xxxx — <điều đang bảo vệ>` ngay trên assertion
- [ ] Không gộp nhiều bug vào một assertion chung chung — mất đi khả năng biết bug nào regress
- [ ] Sau khi test green, comment ngược lại bug gốc: `Automated regression: <spec>::<test name>`
- [ ] Thiếu `data-testid` / `accessibilityLabel` → raise request cho FE/mobile **ngay hôm đó**, đừng dùng locator theo text hay xpath (đây là nguồn flaky số 1)

---

## 5. Thứ tự thực thi đề xuất

| Đợt | Ngày | Nội dung | Vì sao trước |
|---|---|---|---|
| **1** | 08-20 → 08-22 | M1 + M2 (TP/SL, 14 bug) | Cụm lớn nhất, `tpsl.feature` đã có 25 scenario → 12/14 là EXTEND, chi phí mỗi bug thấp nhất |
| **2** | 08-25 → 08-26 | M4 + M3 (Quick Order + lifecycle, 8 bug) | Có prod-leak (8509 — đã có scenario khớp, chỉ cần siết assert) và 3 bug Highest |
| **3** | 08-27 | M5 + M6 (validation + leverage, 8 bug) | Assertion đơn giản, chủ yếu EXTEND |
| **4** | 08-28 | W1–W4 (WEB, 6 bug) | Web suite ổn định sẵn, `orderAmendments` + `exportHistory` + `languageUiLayout` dễ chèn thêm |
| **5** | 08-31 → 09-01 | M7 + M8 + M9 (5 bug) | Khó nhất: 8821 không có coverage, 8633 cần PROD, 7798 đã NOT-AUTO |

Ngày trên tính theo ngày làm việc. 08-22 và 08-29 là thứ Bảy — nếu không làm cuối tuần thì đợt 1 và đợt 5 trượt sang tuần kế tiếp.

---

## 6. Điểm cần chốt trước khi code

1. **Perf budget** cho `7700` / `8828` — không có số cụ thể thì không viết được assertion.
2. **8633 chạy env nào** — test PROD được duyệt, hay chỉ assert feature-flag trên testnet.
3. **Bảng kỳ vọng locale `ja`** cho `7695` (long/buy vs sell/short) — cần người đọc được tiếng Nhật xác nhận.
4. **8348** — framework có đọc được border style của slider reliable? Nếu không → NOT-AUTO, tăng NOT-AUTO lên 2.
5. **Xác nhận cột `Quyết định`** ở bảng mục 2 trước khi bắt đầu Đợt 1.
