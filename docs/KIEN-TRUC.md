# Tài liệu kiến trúc — TikTok Admin Console

Tài liệu này dành cho thành viên mới trong team, giải thích dự án `tiktok-admin` được tổ chức
như thế nào, luồng dữ liệu đi qua đâu, và các quy ước cần tuân theo khi thêm code. Đọc xong file
này, bạn nên hiểu được một trang trong console hoạt động ra sao từ khi request tới cho đến khi
render ra màn hình.

## 1. Đây là ứng dụng gì

`tiktok-admin` là **trang quản trị nội bộ** (admin console) cho một nền tảng dạng TikTok. Nó
không phải app cho người dùng cuối — nó dành cho đội kiểm duyệt (moderation) và vận hành để:

- Xem thống kê tổng quan (dashboard, analytics).
- Quản lý người dùng (khoá/mở khoá tài khoản, ban/unban).
- Quản lý video (gỡ/khôi phục video).
- Quản lý bình luận (xoá bình luận vi phạm).
- Xử lý hàng đợi report (report queue) và xem audit log các hành động kiểm duyệt.

Công nghệ chính: **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind CSS v4**.
Không dùng thư viện quản lý state (Redux, Zustand...) — state chủ yếu nằm ở URL (query string)
và được xử lý ở **Server Components**.

> ⚠️ Lưu ý quan trọng: file `AGENTS.md` ở gốc repo ghi rõ **đây không phải bản Next.js "tiêu
> chuẩn"** mà bạn từng biết — có breaking changes so với kiến thức huấn luyện của AI. Trước khi
> code, đọc tài liệu trong `node_modules/next/dist/docs/`.

## 2. Chạy dự án lần đầu

```bash
npm install
npm run dev
```

Mặc định dự án chạy ở **chế độ mock** (`ADMIN_USE_MOCK` không set = `true`), tức là **không cần
backend thật**. Toàn bộ dữ liệu lấy từ `lib/mock/*.ts`. Đây là lý do bạn có thể `npm run dev` và
thấy dashboard có dữ liệu ngay, dù chưa chạy service nào khác.

Muốn nối vào backend thật (4 service: admin-service, auth-service, video-service,
interaction-service, analytics-service, đứng sau một `api-gateway` ở cổng `:8080`), set trong
`.env.local`:

```
ADMIN_USE_MOCK=false
GATEWAY_URL=http://localhost:8080
```

## 3. Cấu trúc thư mục

```
app/                    → Next.js App Router: routing + page component
  (admin)/              → route group cho khu vực sau đăng nhập (có sidebar/topbar chung)
    dashboard/, analytics/, users/, videos/, comments/,
    moderation/reports/, moderation/actions/, system/queues/, settings/
  login/, forgot-password/  → trang public (không cần đăng nhập)
  api/                   → route handler nội bộ (session, password-reset)
middleware.ts            → gác cổng auth, refresh token, redirect /login

lib/
  api/                   → toàn bộ logic gọi API + kiểu dữ liệu (types.ts)
    admin.ts             → các hàm nghiệp vụ: listUsers, listVideos, moderateUser, ...
    client.ts            → wrapper fetch (apiGet/apiPost) tới gateway
    config.ts             → cờ USE_MOCK, tên cookie, GATEWAY_URL
    rollup.ts             → biến đổi dữ liệu thô thành dữ liệu cho biểu đồ
  mock/                  → dữ liệu giả cho từng domain (users, videos, comments, moderation, analytics)
  moderation.ts           → hằng số nghiệp vụ dùng chung (preset lý do, action nào có hiệu lực...)
  url.ts                  → hrefWith() — build lại query string
  use-propagation.ts      → hook usePropagation() — chờ hành động kiểm duyệt "ngấm" xuống hệ thống
  format.ts, csv.ts, series.ts, utils.ts → tiện ích chung

components/
  ui/                    → component dùng chung, không gắn nghiệp vụ cụ thể (Badge, Card, Pager, SearchBox, StatusBadge...)
  layout/                → sidebar, topbar, page-header, nav-config.ts (định nghĩa menu)
  users/, videos/, comments/, moderation/, analytics/, dashboard/, charts/, auth/
                          → component gắn với từng domain nghiệp vụ
```

**Quy tắc chọn nơi đặt code:** logic gọi API luôn nằm trong `lib/api/admin.ts`, không gọi
`fetch` trực tiếp trong component. Hằng số nghiệp vụ dùng ở nhiều nơi (ví dụ preset lý do ban)
nằm trong `lib/moderation.ts`, không lặp lại trong từng component.

## 4. Luồng dữ liệu của một trang (ví dụ: `/users`)

1. **`app/(admin)/users/page.tsx`** là **Server Component** (mặc định trong App Router, không
   có `"use client"`). Nó đọc query string (`?q=...&status=...&page=...`) từ `searchParams`.
2. Nó gọi `listUsers({ q, status, page })` trong `lib/api/admin.ts`.
3. Hàm đó kiểm tra `USE_MOCK`:
   - Nếu `true` → lọc/phân trang trực tiếp trên mảng `mockUsers` trong bộ nhớ.
   - Nếu `false` → gọi `apiGet()` tới gateway (`/api/v1/auth/admin/users?...`).
   - **Component không bao giờ biết** mình đang chạy mock hay live — chữ ký hàm giống hệt nhau.
4. Kết quả trả về theo kiểu `Page<T>` (giống cấu trúc `Page` của Spring: `content`,
   `totalElements`, `totalPages`, `number`, `size`).
5. Page component render `<UsersTable rows={...} />` — component con là **Client Component**
   nếu cần tương tác (nút bấm, polling...), còn lại giữ Server Component để giảm JS gửi về
   trình duyệt.

**Vì sao lọc/sắp xếp/phân trang luôn ở phía server (kể cả trong mock)?** Vì danh sách được phân
trang — nếu lọc ở client thì "tìm tất cả tài khoản bị khoá" chỉ đúng trong 25 dòng đã tải về, chứ
không đúng trên toàn hệ thống. Quy ước: **mọi filter/sort đều là tham số gửi lên hàm API**, không
áp dụng sau khi đã có dữ liệu.

## 5. State nằm ở URL, không ở React state

Bộ lọc, trang hiện tại, khoảng thời gian... đều được lưu trong **query string** chứ không phải
`useState`. Lý do:

- Server Component đọc trực tiếp `searchParams`, không cần "nâng state lên" qua client.
- Bấm Back/Forward của trình duyệt hoạt động đúng, F5 không mất bộ lọc, có thể copy link chia sẻ.

Helper `hrefWith(pathname, currentParams, patch)` (`lib/url.ts`) dùng để đổi một vài key trong
query string mà **không làm mất các key khác** — ví dụ đổi filter status không được xoá mất
tham số ngày tháng đang chọn. Khi đổi *nội dung* danh sách (đổi filter, đổi từ khoá tìm kiếm),
luôn truyền thêm `page: null` để reset về trang 1.

```ts
hrefWith("/users", searchParams, { status: "BANNED", page: null })
// → "/users?status=BANNED"
```

## 6. Kiến trúc hướng sự kiện (event-driven) khi kiểm duyệt

Đây là phần **dễ gây nhầm lẫn nhất** cho người mới, cần hiểu kỹ trước khi sửa code liên quan đến
ban/takedown/xoá bình luận.

Khi admin bấm "Ban user" hay "Takedown video", request đi tới **`admin-service`**, KHÔNG đi thẳng
tới service sở hữu dữ liệu đó (`auth-service`, `video-service`, `interaction-service`). Lý do:

- `admin-service` ghi lại một dòng vào audit log (`moderation_actions`) — ai làm gì, vì sao.
- `admin-service` publish một sự kiện Kafka.
- Service sở hữu dữ liệu thật (vd `auth-service` cho việc ban) **consume sự kiện đó** rồi mới
  thật sự đổi trạng thái tài khoản.

→ Nghĩa là: **request POST trả về thành công KHÔNG có nghĩa là trạng thái đã đổi ngay**. Có độ
trễ lan truyền (propagation delay) giữa lúc ghi audit log và lúc service kia áp dụng thay đổi.

Đây là lý do có hook **`usePropagation`** (`lib/use-propagation.ts`): sau khi submit một hành
động kiểm duyệt, UI gọi `watch()` để "nhớ" giá trị trạng thái hiện tại, sau đó tự động
`router.refresh()` tại các mốc 900ms / 2.5s / 6s để kiểm tra trạng thái đã đổi chưa. Trong lúc
`pending`, dòng đó bị làm mờ và nút bị disable để tránh bấm hành động hai lần vào một trạng thái
chưa kịp đổi. Sau 9 giây không thấy đổi → coi là "stalled" (có vấn đề ở pipeline) và hiển thị
thông báo thay vì chờ vô hạn.

**Không phải hành động nào cũng có hiệu lực thật** — mảng `ENFORCED` trong `lib/moderation.ts`
liệt kê các loại action có consumer thực sự ở downstream (`TAKEDOWN_VIDEO`, `RESTORE_VIDEO`,
`BAN_USER`, `UNBAN_USER`, `REMOVE_COMMENT`). Các loại khác chỉ được ghi log, chưa có ai lắng nghe.

## 7. Mock mode hoạt động thế nào

`lib/api/config.ts` export `USE_MOCK = process.env.ADMIN_USE_MOCK !== "false"` — **mặc định là
`true`**. Mọi hàm nghiệp vụ trong `lib/api/admin.ts` đều có dạng:

```ts
export async function listVideos(options) {
  if (USE_MOCK) {
    // lọc/phân trang trên mảng mockVideos
  }
  // gọi apiGet(...) tới gateway thật
}
```

Dữ liệu mock nằm trong `lib/mock/*.ts`, được sinh từ một mốc thời gian **cố định** (`MOCK_NOW`
trong `lib/mock/random.ts`) — không dùng `Date.now()` thật, để các biểu đồ theo ngày luôn có dữ
liệu nằm đúng trong khung thời gian đang xem, thay vì random rơi ra ngoài.

Một số hành động ghi (`moderateUser`, `moderateVideo`, `resolveReport`, `removeComment`) sẽ
**throw lỗi rõ ràng** khi đang ở mock mode, vì chúng cần ghi audit log + Kafka event ở backend
thật — không có cách nào giả lập hợp lý trong bộ nhớ.

## 8. Xác thực (Authentication)

`middleware.ts` chạy trước mọi request:

- Nếu `USE_MOCK = true` → bỏ qua hoàn toàn việc kiểm tra đăng nhập (để `npm run dev` không bị kẹt
  ở trang login mà không có backend để đăng nhập vào).
- Nếu `USE_MOCK = false`:
  - Có 2 cookie: `admin_session` (access token, sống 15 phút) và `admin_refresh` (refresh token,
    sống 7 ngày).
  - Khi access token hết hạn nhưng refresh token còn → middleware tự động gọi
    `/api/v1/auth/refresh` để lấy access token mới **trước khi** request được xử lý tiếp, tránh
    tình trạng "tự động đăng xuất" dù refresh token vẫn còn hạn.
  - Trang `/login` và `/forgot-password` luôn truy cập được kể cả khi chưa đăng nhập.

## 9. Các component/hook dùng chung cần biết trước khi thêm code mới

Trước khi tự viết mới cái gì, kiểm tra các file sau — rất nhiều pattern đã được tách sẵn để tránh
lặp code:

| File | Dùng khi nào |
|---|---|
| `lib/url.ts` (`hrefWith`) | Cần đổi query string mà giữ nguyên các filter khác |
| `lib/use-propagation.ts` (`usePropagation`) | Sau khi submit một hành động kiểm duyệt, cần chờ trạng thái cập nhật |
| `components/ui/status-badge.tsx` | Hiển thị badge trạng thái user/video — có `VideoStatusBadge`, `UserStatusBadge` |
| `components/ui/search-box.tsx` | Ô tìm kiếm có debounce sẵn (350ms) |
| `components/ui/pager.tsx` | Phân trang, dùng chung cho mọi bảng danh sách |
| `lib/moderation.ts` (`PRESET_REASONS`) | Danh sách lý do gợi ý khi ban/takedown/xoá bình luận — **một nguồn duy nhất**, không hardcode lại trong component |
| `lib/format.ts` | Format số, ngày tháng hiển thị |

## 10. Kiểu dữ liệu (contract với backend)

Toàn bộ interface/type mô tả dữ liệu từ backend nằm trong **`lib/api/types.ts`** — đây là nơi
đầu tiên cần xem khi muốn biết một entity (`AdminUserResponse`, `AdminVideoResponse`,
`ReportResponse`, `ModerationActionResponse`...) có field gì. Khi backend đổi response shape,
chỉ cần sửa ở đây và TypeScript sẽ báo lỗi mọi chỗ dùng sai.

## 11. Thêm một trang mới — checklist

1. Thêm route trong `app/(admin)/<ten-trang>/page.tsx`.
2. Thêm mục menu vào `NAV_GROUPS` trong `components/layout/nav-config.ts`, và breadcrumb vào
   `ROUTE_TITLES` cùng file.
3. Nếu cần gọi API mới: thêm type vào `lib/api/types.ts`, thêm hàm vào `lib/api/admin.ts` theo
   đúng pattern `if (USE_MOCK) {...} else { apiGet/apiPost(...) }`, thêm data giả tương ứng vào
   `lib/mock/`.
4. Ưu tiên tái sử dụng component trong `components/ui/` trước khi viết mới.
5. Nếu trang có filter/sort/phân trang: đưa state vào query string, dùng `hrefWith`, không dùng
   `useState` cho các giá trị đó.

## 12. Việc chưa xong (theo `nav-config.ts`)

Menu "Queues & DLQ" (`/system/queues`) chưa có `ready: true` — nghĩa là chưa có endpoint backend
tương ứng, màn hình hiện chỉ là placeholder. Đừng ngạc nhiên nếu nó không hoạt động đầy đủ.
