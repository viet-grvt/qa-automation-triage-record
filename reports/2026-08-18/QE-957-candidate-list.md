# QE-957 — Ranked Bug-Automation Candidate List
**Ticket:** [QE-957](https://grvt.atlassian.net/browse/QE-957) Build ranked bug-automation candidate list — Subtask của [QE-949](https://grvt.atlassian.net/browse/QE-949)
**Assignee:** Raj Tilak · **Due:** 25/08/2026 · **Priority:** High · **Status:** To Do
**Đầu ra dùng cho:** [QE-959](https://grvt.atlassian.net/browse/QE-959) (WEB, 5 scenario) và [QE-960](https://grvt.atlassian.net/browse/QE-960) (MOBILE, 10 scenario)

> QE-957 là **gate** của toàn bộ QE-949 — không automate bug nào nằm ngoài danh sách này.
> Bản này là **draft để review**, chưa sign-off. Ba chỗ cần quyết định trước khi chốt: xem §8.

---

## 0. Header — phạm vi quét

```
Ngày sweep     : 18/08/2026
JQL đã chạy    : project = PRO AND issuetype = Bug AND created >= -26w
                 AND labels IN ("prod-leak", "severity:high") ORDER BY created DESC
Tổng bug quét  : 43
Đã triage đầy đủ: 20  (14 seed từ QE-949 + 6 phát hiện thêm trong sweep)
Còn phải triage : ~23 dòng của set 43 (xem "Giới hạn của lần sweep này" bên dưới)
Sau khi lọc    : 15 candidate top set · 5 loại vì đã automated/partial · 5 loại vì không automatable
Top set chốt   : 15  (WEB 5 · MOBILE 10)
Người review   : Raj / Viet          Ngày duyệt: ____
```

**JQL đã bị sửa so với format ban đầu.** Câu gốc (`labels IN (prod-leak, regression) OR priority IN (Highest, High)`) trả về **767 bug** trong 26 tuần — không phải một sweep, đó là gần như toàn bộ PRO. `regression` và `priority:High` được dán quá rộng nên không lọc được gì. Câu đã dùng bám vào `prod-leak` + `severity:high` → 43 dòng, đúng cỡ để triage tay.

**Cảnh báo hygiene — đây là phát hiện quan trọng nhất của lần sweep:**
Chỉ có **3 bug trong toàn bộ project PRO** mang label `prod-leak`: PRO-8509, PRO-8109, PRO-8085.
Nhưng đọc description thì có ít nhất **5 bug nữa đã đến user thật trên PROD** mà không được dán label: PRO-8032 (CEO báo), PRO-6846 (ENV: PROD), PRO-8370 (PROD, all regions), PRO-8791 (PROD web+mobile), và bug header nav (tái phát trên prod tháng 7).
→ Cột `Prod leak` bên dưới được chấm **theo description, không theo label**. Nghĩa là JQL này *không* tự tái lập được kết quả — xem §8 câu hỏi 2.

**Giới hạn của lần sweep này (ghi rõ để lần audit sau không nhầm là đã quét hết):**
Tool Jira read-only trả tối đa 5 issue mỗi trang và không cấp cursor để phân trang tiếp, nên trong set 43 dòng tôi lấy được đầy đủ chi tiết 6 dòng (PRO-8844, 8829, 8509, 8370, 8109, 8085) + 14 dòng seed của QE-949 + 4 bug mới ngày 18/08. **~23 dòng còn lại của set 43 chưa được triage** — cần mở [link JQL này](https://grvt.atlassian.net/issues?jql=project%20%3D%20PRO%20AND%20issuetype%20%3D%20Bug%20AND%20created%20%3E%3D%20-26w%20AND%20labels%20IN%20(%22prod-leak%22%2C%20%22severity%3Ahigh%22)%20ORDER%20BY%20created%20DESC) trên UI và quét nốt. Nếu trong đó có bug ≥60 điểm thì top 15 phải đổi.

---

## 1. Rubric chấm điểm

| Tiêu chí | Điểm | Cách chấm |
|---|---|---|
| **Prod leak** | 40 / 0 | 40 nếu bug đã đến người dùng thật (theo description: ENV PROD / user báo), không theo label |
| **Tái phát** | 25 / 10 / 0 | 25 = tái phát ≥2 lần · 10 = 1 lần (hoặc cùng module đã có bug cùng loại) · 0 = chưa |
| **Blast radius** | 20 / 12 / 5 | 20 = chặn flow tiền (trade/withdraw/deposit/invest/login) · 12 = chặn flow phụ · 5 = cosmetic |
| **Chi phí automate** | 15 / 8 / 3 | 15 = S (<0.5 ngày) · 8 = M (0.5–1.5 ngày) · 3 = L (>1.5 ngày) |

**Score tối đa 100.** Ngưỡng: ≥60 vào top set · 40–59 backlog · <40 để manual.

> **Ngưỡng này không đủ 15 dòng.** Chỉ **12 dòng** đạt ≥60. Ba dòng M8–M10 dưới đây được **promote từ band <40** để đạt target 15 scenario của QE-949. Đây là quyết định cần Viet duyệt tại buổi review (§8 câu 5) — không phải điều chỉnh rubric cho khớp con số.
>
> Lý do promote (không phải cảm tính): cả ba đều **đang mở, cùng module Quick Order / TP/SL — chính hai module đã leak prod 2 lần** (PRO-8509, PRO-8085). Chúng chỉ mất 40 điểm Prod leak vì được bắt ở PRE-RELEASE trước khi tới user.
>
> **Và đó là lý do nên automate chứ không phải lý do để hạ ưu tiên.** Ba bug này hiện đang được chặn bằng **manual trên PRE-RELEASE** — chặng cuối, tốn người, và chỉ bắt được khi có ai đó ngồi test đúng flow đó. Automate chúng ở **TESTNET** đẩy điểm chặn lùi lên một chặng: bug bị bắt *trước khi* build vào pre-release, tự động, mỗi lần CI chạy. Nói cách khác rubric đang chấm "chưa leak" như một điểm trừ, trong khi thực tế là ta đang trả giá bằng công manual để giữ nó không leak — automate là cách bỏ khoản chi đó.
>
> Điều này áp dụng cho **cả 15 dòng**: không có scenario nào chạy trên PRE-RELEASE hay PROD. Toàn bộ Env = TESTNET.

---

## 2. Bảng A — Ranked candidate list

Prod leak: **✅** = xác nhận PROD theo description · **?** = chưa xác nhận env · **❌ (pre-rel)** = chưa đến user thật, bắt được ở PRE-RELEASE
Đã auto: **✅** đủ · **⚠️** partial (→ Bảng C) · **❌** chưa có

> **`❌ (pre-rel)` chỉ nói về điểm Prod leak, không nói về khả năng automate.** Ta không automate *trên* môi trường PRE-RELEASE, nhưng mọi scenario trong danh sách này chạy ở **TESTNET** — nằm **trước** PRE-RELEASE trong pipeline. Nên với nhóm này test còn có giá trị cao hơn: nó chặn bug ở chặng sớm hơn cả chặng đã bắt được bug lần này (manual trên pre-release), tức là lần sau không cần tới người mới thấy. Cột `Automatable?` của cả ba dòng M8/M9/M10 là ✅, và Env trong detail card là TESTNET.

| # | Bug | Tiêu đề ngắn | Platform | Module | Sev | Prod leak | Tái phát | Blast | Đã auto? | Automatable? | Cost | **Score** | Suite đích | Giao cho |
|---|-----|--------------|----------|--------|-----|-----------|----------|-------|----------|--------------|------|-----------|-----------|----------|
| W1 | QE-793 (không có PRO key) | Header nav rendering vỡ across pages/locales | WEB | Navigation | High | ✅ | 25 | 12 | ⚠️ | ✅ | S | **92** | smoke | QE-959 |
| M1 | PRO-8085 | iOS TP/SL dropdown Trigger Type + ROI/PnL không bấm được | MOBILE | Trade / TPSL | High | ✅ | 10 | 20 | ⚠️ | ✅ | S | **85** | smoke | QE-960 |
| M2 | PRO-8032 | Trade tab trắng lần mở đầu, cache state lỗi được replay | MOBILE | Trade | High | ✅ | 10 | 20 | ❌ | ✅ | M | **78** | smoke | QE-960 |
| M3 | PRO-8791 | Trading login prompt dù session còn hạn (MOBILE side) | MOBILE | Auth / Session | Med | ✅ | 10 | 20 | ❌ | ✅ | M | **78** | smoke | QE-960 |
| W2 | PRO-8791 | Trading login prompt dù session còn hạn (WEB side) | WEB | Auth / Session | Med | ✅ | 10 | 20 | ⚠️ | ✅ | M | **78** | smoke | QE-959 |
| W3 | *gap → QE-958* | Earn: nhãn APY vs APR sai + giá trị rate sai (3.5% hiện 4%) | WEB | Earn | High | ✅ | 10 | 12 | ❌ | ✅ | S | **77** | regression | QE-959 |
| M4 | PRO-8509 | Quick Order SPOT hiện Cross/Isolated margin + leverage | MOBILE | Trade / Spot | High | ✅ | 0 | 20 | ❌ | ✅ | S | **75** | smoke | QE-960 |
| W4 | *gap → QE-958* | Earn: Balance Earning vs Balance available to trade lệch nhau | WEB | Earn | High | ✅ | 0 | 20 | ❌ | ✅ | S | **75** | smoke | QE-959 |
| M5 | PRO-8109 | Withdrawal fail trên native app, PWA thì được | MOBILE | Withdraw | High | ✅ | 0 | 20 | ❌ | ✅ | M | **68** | smoke | QE-960 |
| W5 | *gap → QE-958* | Vault: invest bị chặn khi remaining capacity < $0.01 | WEB | Vault | High | ✅ | 0 | 20 | ❌ | ✅ | M | **68** | smoke | QE-959 |
| M6 | *gap → QE-958* | Move vs Send: internal transfer vào bị phân loại là withdrawal | MOBILE | Transfer | High | ✅ | 0 | 20 | ❌ | ✅ | M | **68** | smoke | QE-960 |
| M7 | *gap → QE-958* | Earn: quest / footer widget hiện sai dưới feature flag EoE | MOBILE | Earn | Med | ✅ | 0 | 5 | ❌ | ✅ | S | **60** | regression | QE-960 |
| M8 | PRO-8844 | Quick Order treo (scroll được, không nhận tap) sau khi sang từ Advanced có error toast | MOBILE | Trade / Quick Order | High | ❌ (pre-rel) | 10 | 20 | ❌ | ✅ | M | **38** ⬆ | smoke | QE-960 |
| M9 | PRO-8144 | Invest bundle Target Return (APY) sai mặc định, chỉ đúng khi bật "Show annualized yield" | MOBILE | Invest | High | **?** | 10 | 12 | ❌ | ✅ | S | **37** ⬆ | regression | QE-960 |
| M10 | PRO-8790 | TP/SL sheet chỉ có "Change %", mất ROI / PnL | MOBILE | Trade / TPSL | Med | ❌ (pre-rel) | 10 | 12 | ⚠️ | ✅ | S | **37** ⬆ | regression | QE-960 |

⬆ = promote từ band <40 để đủ target 15 · chờ duyệt ở §8 câu 5.

**Chia theo target QE-949:** WEB 5 (W1–W5) → QE-959 · MOBILE 10 (M1–M10) → QE-960. Khớp đúng con số hai subtask.

**5 trong 15 dòng (W3, W4, W5, M6, M7) hiện chưa có PRO key** — chúng phụ thuộc QE-958. Nếu QE-958 trượt, năm dòng này không traceable về bug gốc và DoD của QE-961 (two-way traceability) fail. Đây là dependency mạnh nhất của cả QE-949.

---

## 3. Bảng B — Lịch làm automation

> Cửa sổ build: 25/08 → 15/09 = 15 ngày làm việc. **Tổng Est = 11.0 ngày**, còn 4 ngày buffer. Không cần cắt scope.

| # | Bug | Platform | **Ngày dự kiến** | **Ngày thực tế xong** | Người làm | Est (ngày) | Actual | Status | Test ID | PR | Verify (n/n green) |
|---|-----|----------|------------------|----------------------|-----------|-----------|--------|--------|---------|-----|--------------------|
| M1 | PRO-8085 | MOBILE | 25/08 | | | 0.5 | | ⬜ Not started | | | |
| M2 | PRO-8032 | MOBILE | 25/08 | | | 1.0 | | ⬜ Not started | | | |
| M4 | PRO-8509 | MOBILE | 26/08 | | | 0.5 | | ⬜ Not started | | | |
| M5 | PRO-8109 | MOBILE | 27/08 | | | 1.0 | | ⬜ Not started | | | |
| M3 | PRO-8791 | MOBILE | 28/08 | | | 1.0 | | ⬜ Not started | | | |
| W1 | QE-793 header | WEB | 31/08 | | | 0.5 | | ⬜ Not started | | | |
| W2 | PRO-8791 | WEB | 31/08 | | | 1.0 | | ⬜ Not started | | | |
| W4 | Earn balance (gap) | WEB | 01/09 | | | 0.5 | | ⬜ Not started | | | |
| W3 | Earn APY/APR (gap) | WEB | 02/09 | | | 0.5 | | ⬜ Not started | | | |
| W5 | Vault <$0.01 (gap) | WEB | 03/09 | | | 1.0 | | ⬜ Not started | | | |
| M6 | Move vs Send (gap) | MOBILE | 04/09 | | | 1.0 | | ⬜ Not started | | | |
| M7 | Earn quest EoE (gap) | MOBILE | 07/09 | | | 0.5 | | ⬜ Not started | | | |
| M9 | PRO-8144 | MOBILE | 08/09 | | | 0.5 | | ⬜ Not started | | | |
| M10 | PRO-8790 | MOBILE | 09/09 | | | 0.5 | | ⬜ Not started | | | |
| M8 | PRO-8844 | MOBILE | 10/09 | | | 1.0 | | ⬜ Not started | | | |
| — | *Bảng C patches* | cả hai | 11/09 | | | 1.0 | | ⬜ Not started | | | |

`Status`: ⬜ Not started · 🟦 In progress · 🟨 In review · ✅ Green in CI · 🟥 Blocked · ⏸️ Deferred

**Phân bổ tuần:**

| Tuần | Ngày | Số scenario | Trọng tâm |
|---|---|---|---|
| W1 | 25/08 → 28/08 | 5 | Prod leak MOBILE điểm cao nhất (QE-960): TP/SL dropdown, Trade tab init, Quick Order SPOT, Withdraw, session |
| W2 | 31/08 → 04/09 | 6 | Toàn bộ WEB (QE-959) + Move vs Send · **phụ thuộc QE-958 đã raise xong 5 bug** |
| W3 | 07/09 → 11/09 | 4 + patches | Ba dòng promote + vá Bảng C |
| Buffer | 14/09 → 15/09 | 0 | Trượt lịch + ổn định lại các test mới |

Cột `Est` vs `Actual` không phải để đánh giá ai — nó để tuần sau ước lượng đúng hơn. Nếu Actual > 2× Est liên tục ở một module, đó là dấu hiệu module đó thiếu testability chứ không phải người làm chậm.

**Rủi ro lịch:** tuần W2 có 6/6 scenario phụ thuộc QE-958 (5 gap) — nếu QE-958 chưa xong trước 31/08 thì cả tuần W2 đứng. Cần đảo W3 lên trước W2 trong trường hợp đó.

---

## 4. Bảng C — Đã automated (một phần) — cần vá chứ không cần viết mới

Đối chiếu với repo `qa-automation` (`ui_tests/tests/`, `mobile_tests/features/`):

| Bug | Test hiện có | Vì sao vẫn lọt | Cần sửa gì | Est | Ngày dự kiến | Owner |
|---|---|---|---|---|---|---|
| W1 header nav (QE-793) | `ui_tests/tests/headerNav.spec.ts` — có cả block `Navigation header — render stability` | Bug vẫn tái phát tháng 7 dù test tồn tại → assertion không chạm nhánh bị vỡ (test check presence/typography/locale, không check render sau navigation giữa các page) | Thêm assertion render-after-route-change cho từng page × locale; hiện chỉ check trên trang đầu | 0.5 | 11/09 | |
| W2 PRO-8791 session | `ui_tests/tests/tradingLoginSession.spec.ts` | **Assertion bị comment out** (dòng 58–75: device / timeExpiry / tradingLoginToken / expiry đều bị `//`). Test pass mà không kiểm tra gì về session validity | Bật lại 4 assertion đã comment, thêm case: `/query` fail → không được coi là session invalid, phải re-validate | 0.5 | 11/09 | |
| M1 PRO-8085 dropdown | `mobile_tests/features/tpsl.feature` (M-053…M-064) | Cover được slider, add/edit row, ROI display — **không có scenario nào tap vào dropdown Trigger Type hay $ Type**, đúng chỗ bug xảy ra | Thêm scenario tap Trigger Type (Mark/Index) + $ Type (ROI/PnL), tag `@ios` (bug là iOS-only) | 0.5 | 25/08 | |
| M10 PRO-8790 ROI/PnL | `mobile_tests/features/tpsl.feature` @splitTPSLByRoi (M-060) | Test verify TP target thêm bằng ROI **hiển thị đúng**, nhưng không assert danh sách option của dropdown có đủ Change % / ROI / PnL | Thêm assertion trên option list của dropdown, không chỉ trên kết quả | 0.5 | 09/09 | |

Nhóm này rẻ nhất trên mỗi đơn vị coverage → nên làm trước nhóm viết mới hoàn toàn. Riêng `tradingLoginSession.spec.ts` là case đáng lo nhất: một test **đang xanh trong CI mà không assert gì** — nó tạo cảm giác an toàn sai.

**Bug bị loại khỏi seed QE-949 vì đã automated đủ (ghi lý do theo DoD):**

| Bug | Lý do loại | Test đang cover |
|---|---|---|
| PRO-8002 — redirect sau signup về Competitions | Đã có test, và test assert đúng nhánh redirect theo entry page (kể cả case Competitions và case invite → Overview) | `ui_tests/tests/auth/redirectionAfterAuth.spec.ts` (dòng 121–123, 142) |

---

## 5. Bảng D — Not-automatable register

| Bug | Platform | Lý do không automate | Nhóm lý do | Route về đâu | Review lại |
|---|---|---|---|---|---|
| PRO-8370 | MOBILE | Root cause là regression upstream trong MetaMask 8.3.0 SDK/WalletConnect pairing. Handshake không bao giờ resolve → không có state nào để assert, và ta không control được app phía kia. **Score 68 nhưng vẫn không automate được.** | third-party wallet UI | Manual regression checklist + telemetry cho pairing attempt không hoàn tất (PRO-7685). Phần *GRVT-owned* — timeout 20s + fallback path — nếu tách thành ticket riêng thì **cái đó automate được**, và nên vào danh sách này ở lần sweep sau | 15/09 (khi MetaMask ship fix) |
| PRO-6846 | MOBILE | "Scroll cảm giác sluggish" là đánh giá chủ quan; không có ngưỡng fps/latency nào được định nghĩa trong ticket để assert | perf / visual judgement | Manual regression checklist | vĩnh viễn, trừ khi định nghĩa được ngưỡng fps |
| PRO-8828 | MOBILE | Latency của TP/SL amendment — không có SLA số cụ thể. Assert bằng timeout sẽ flaky theo network của CI runner | perf, không có ngưỡng | Manual regression checklist | vĩnh viễn, trừ khi PM chốt SLA (vd. <3s) |
| PRO-7884 | WEB | Partner logo thiếu trong card Base Interest — cần so sánh với Figma bằng mắt. Có thể snapshot-test nhưng giá trị thấp và snapshot vỡ mỗi lần đổi design | visual / design judgement | Manual regression checklist | vĩnh viễn |
| PRO-8829 | MOBILE | *Không phải không automatable* — automate được bình thường trên TESTNET (assert Open Orders tab vẫn có order sau khi amend, không cần force-restart). Loại chỉ vì score 28, không vì bản chất hay vì môi trường | (loại theo điểm) | Backlog, gộp vào test amendment ở M10 — cùng flow nên gần như không tốn thêm | 15/09 |

**Bug seed bị loại vì điểm, không phải vì không automatable (ghi để lần sau không cân nhắc lại từ đầu):**

| Bug | Score | Lý do loại |
|---|---|---|
| PRO-8038 — first tap Login/Sign Up reload app | 35 | Env chưa xác nhận PROD (prod leak = 0). Ngoài ra cần state "vừa install lần đầu" mới cho mỗi lần chạy — automate được nhưng đắt và dễ flaky |
| PRO-8611 — admin-invited user bị hỏi password thay vì OTP | 20 | Env chưa xác nhận PROD. Cần automate cả inbox email của invite link → cost L, blast 12 |
| PRO-8843 / PRO-8842 / PRO-8841 / PRO-8840 (mới 18/08) | <40 | severity:low / medium, pre-release, chưa leak. Vào backlog cho sweep sau — nhưng PRO-8842 (Quick Order Spot thiếu error prompt) cùng module với PRO-8509 đã leak 1 lần, đáng theo dõi |

---

## 6. Detail card — top 15

Ba card đầu (điểm cao nhất) điền đầy đủ để làm mẫu chuẩn; 12 card còn lại Raj điền theo đúng khuôn này trước buổi review.

```
[#W1] QE-793 (chưa có PRO key) — Header nav rendering vỡ across pages/locales
Platform / Module : WEB / Navigation
Prod leak         : ✅ tái phát trên prod tháng 7/2026 sau khi fix tháng 6
Lịch sử tái phát  : ≥2 lần — fix tháng 6, vỡ lại tháng 7 vì không có automated guard
Blast radius      : header là entry point của mọi page; vỡ header = user không navigate được, mọi locale

Kịch bản test đề xuất:
  Given user đã login, chạy lần lượt qua từng locale được support
  When  navigate qua từng top-level page (Trade / Overview / Earn / Invest / Competitions / Portfolio)
  Then  header render đủ mọi nav item sau MỖI lần route change (không chỉ trang đầu),
        đúng typography + màu, không có item bị overflow/mất

Suite đích     : smoke                    Env: TESTNET
Test data cần  : 1 account đã login, danh sách locale hiện hành
Phụ thuộc      : không — extend file test đã có
Cost           : S  →  Est 0.5 ngày
Ngày dự kiến   : 31/08          Ngày xong: ____
Traceability   : extend ui_tests/tests/headerNav.spec.ts · tag QE-793
Rủi ro         : bug này KHÔNG có PRO key. Nếu không raise PRO bug thì QE-961 không
                 two-way traceable được cho dòng điểm cao nhất của cả danh sách
```

```
[#M1] PRO-8085 — iOS TP/SL dropdown Trigger Type + ROI/PnL không bấm được
Platform / Module : MOBILE (iOS-only) / Trade — TPSL
Prod leak         : ✅ phát hiện 06/07, fix 09/07 — ENV PROD, Alaukik + Raj repro được
Lịch sử tái phát  : 1 lần — PRO-8790 (14/08) lại là ROI/PnL trên cùng panel TP/SL, đang mở
Blast radius      : chặn set TP/SL theo Mark/Index và ROI/PnL → user không bảo vệ được vị thế
                    đang mở. Android không bị → là lỗi platform-specific, dễ lọt nếu CI chỉ chạy Android

Kịch bản test đề xuất:
  Given account có 1 vị thế perp đang mở, chạy trên iOS
  When  mở panel TP/SL và tap dropdown Trigger Type, rồi tap dropdown $ Type
  Then  cả hai dropdown MỞ RA và đổi được option (Mark↔Index, ROI↔PnL↔Offset);
        assertion này chính là thứ đáng lẽ chặn được bug — slider vẫn work nên
        test nào chỉ chạm slider sẽ pass mà không thấy gì

Suite đích     : smoke                    Env: TESTNET
Test data cần  : account có vị thế perp mở, balance đủ margin
Phụ thuộc      : cần data-testid trên hai dropdown nếu chưa có · phải chạy được trên iOS runner
Cost           : S  →  Est 0.5 ngày
Ngày dự kiến   : 25/08          Ngày xong: ____
Traceability   : thêm scenario vào mobile_tests/features/tpsl.feature, tag @ios @PRO-8085
Rủi ro         : tpsl.feature hiện tag @android ở dòng 1 — phải chắc scenario mới thật sự
                 chạy trên iOS runner, không thì test xanh mà không cover gì (đúng lỗi của
                 tradingLoginSession.spec.ts)
```

```
[#M2] PRO-8032 — Trade tab trắng lần mở đầu, bad cache state bị replay
Platform / Module : MOBILE (iOS + Android) / Trade
Prod leak         : ✅ phát hiện 01/07 (CEO Hong Yea báo), fix 11/07 — ENV PROD
Lịch sử tái phát  : 1 lần — cùng loại với một market-info init issue fix ngày 30/06
Blast radius      : user mới mở Trade tab lần đầu thấy màn trắng; force-close KHÔNG cứu được
                    vì app replay cache rỗng → user mới bị chặn hoàn toàn khỏi trading

Kịch bản test đề xuất:
  Given app vừa install, account chưa từng mở Trade tab (không có cached state)
  When  tap Trade tab trực tiếp từ bottom nav (KHÔNG đi qua homepage — đường qua
        homepage bypass được bug nên test đi đường đó sẽ pass giả)
  Then  BTC price + funding rate + 24h-change đều có giá trị trong <Ns
  And   force-restart app rồi mở lại Trade tab → vẫn có data (assert cache không
        persist state rỗng)

Suite đích     : smoke                    Env: TESTNET
Test data cần  : account mới hoàn toàn HOẶC cơ chế clear app storage trước mỗi run
Phụ thuộc      : cần clear-storage giữa các run · cần assert được cả 2 bug (no-retry
                 và bad-cache-replayed) — ticket ghi rõ đây là 2 bug trong 1
Cost           : M  →  Est 1.0 ngày
Ngày dự kiến   : 25/08          Ngày xong: ____
Traceability   : tag PRO-8032 · comment ngược lại PRO-8032 sau khi green
Rủi ro         : "account chưa từng mở Trade tab" là one-off data state — Raj/Jay/Tuan
                 không repro được bug gốc chính vì account của họ đã init rồi. Nếu không
                 clear được storage thì scenario này vô nghĩa → đây là điều kiện tiên quyết,
                 kiểm tra trước 25/08
```

**12 card còn lại:** W2, W3, W4, W5, M3, M4, M5, M6, M7, M8, M9, M10 — Raj điền trước review.

---

## 7. Checklist review

- [x] Câu JQL có trong tài liệu và chạy lại được — *nhưng kết quả không tái lập được cách chấm `Prod leak`, vì chỉ 3/43 bug có label. Xem §8 câu 2*
- [x] Mọi dòng có Platform và Automatable yes/no **kèm lý do** (DoD) — Bảng A + Bảng D
- [x] Mọi dòng có điểm theo rubric, không có dòng nào xếp hạng bằng cảm tính
- [ ] Top 15 đã chốt và chia rõ về QE-959 (WEB 5) / QE-960 (MOBILE 10) — *đã chia đúng số, chờ duyệt 3 dòng promote*
- [x] Danh sách seed trên QE-949 đã được đối chiếu — 14/14 bug seed đã triage, mỗi bug bị loại có lý do ghi ở §4/§5
- [x] 5 gap chưa có ticket đã có dòng riêng (W3, W4, W5, M6, M7) — *nhưng vẫn phụ thuộc QE-958 raise PRO bug*
- [x] Bảng B có ngày dự kiến cho **đủ cả 15** dòng
- [x] Tổng Est (11.0 ngày) ≤ số ngày còn lại đến 15/09 (15 ngày) — không phải cắt scope
- [x] Not-automatable set đã route sang manual regression checklist
- [ ] **~23 dòng còn lại của set 43 chưa triage** — phải quét nốt trước khi sign-off, nếu không thì "top 15" là top 15 của 20 bug, không phải của 43

**Sign-off:** Raj ⬜ · Viet ⬜ · Ngày: ______

---

## 8. Câu hỏi mở / cần quyết định

| # | Câu hỏi | Chặn dòng nào | Cần ai quyết | Deadline |
|---|---|---|---|---|
| 1 | PRO-8144, PRO-8038, PRO-8611 có phải PROD không? Description không ghi env. Nếu là PROD thì +40 điểm mỗi bug → PRO-8144 lên 77 (vào top set thật), PRO-8038 lên 75, PRO-8611 lên 60 → **top 15 phải xếp lại** | M9 + 2 dòng đang bị loại | Raj / Luy | 22/08 |
| 2 | Chỉ 3 bug trong cả PRO có label `prod-leak`, trong khi ít nhất 5 bug khác đã leak thật. Cần policy dán label khi close bug — nếu không thì sweep lần sau lại phải đọc tay 43 description | Toàn bộ khả năng tái lập của JQL, và cả QE-961 | Viet (policy) | 25/08 |
| 3 | 5/15 dòng top set (W3, W4, W5, M6, M7) chưa có PRO key, phụ thuộc QE-958. Nếu QE-958 chưa xong trước 31/08 thì cả tuần W2 đứng — có đảo W3 lên trước W2 không? | W3, W4, W5, M6, M7 + lịch tuần W2 | Raj / Viet | 25/08 |
| 4 | Platform của 4 gap Earn/Vault/Transfer: WEB, MOBILE hay cả hai? Hiện tôi gán Earn+Vault → WEB, Move-vs-Send + quest EoE → MOBILE để khớp 5/10, nhưng đó là **suy đoán** — nếu thực tế là BOTH thì phải tách thành 2 dòng và tổng scenario vượt 15 | W3, W4, W5, M6, M7 | Raj (người quan sát gap) | 22/08 |
| 5 | Chỉ 12 dòng đạt ngưỡng ≥60. Ba dòng M8/M9/M10 promote từ band <40 để đủ target 15 — **duyệt promote, hay hạ target QE-949 xuống 12 scenario?** Hạ target thì honest hơn với rubric; promote thì giữ commitment 15 | M8, M9, M10 | Viet | tại buổi review |
| 6 | Bug header nav (W1) là dòng điểm cao nhất (92) nhưng **không có PRO key** — có raise PRO bug cho nó không? Không có key thì QE-961 (two-way traceability, DoD 100%) fail ngay ở dòng quan trọng nhất | W1 + DoD của QE-961 | Raj | 22/08 |
| 7 | `tradingLoginSession.spec.ts` có 4 assertion bị comment out — test đang xanh mà không kiểm tra gì. Đây là bug script hay cố ý disable? Nếu cố ý thì vì sao | W2 | người viết test gốc | 25/08 |

---

## 9. Nhật ký thay đổi

| Ngày | Thay đổi | Bởi |
|---|---|---|
| 18/08/2026 | Bản đầu — sweep 43 bug (triage đầy đủ 20), rank 15 dòng, đối chiếu repo qa-automation cho cột "Đã auto?" | Viet (draft), chờ Raj review |
| 18/08/2026 | Làm rõ nhóm `❌ (pre-rel)`: marker này chỉ nói về điểm Prod leak, không nói về khả năng automate. Toàn bộ 15 scenario chạy ở TESTNET — upstream của PRE-RELEASE — nên nhóm này automate được và giá trị còn cao hơn (thay công manual ở chặng cuối bằng CI ở chặng sớm). Sửa lập luận promote M8/M9/M10 và dòng PRO-8829 ở Bảng D theo cùng logic | Viet |

Sau khi chốt, mọi thay đổi top 15 phải ghi vào đây — để cuối tháng biết được đã cam kết gì và trượt ở đâu.
