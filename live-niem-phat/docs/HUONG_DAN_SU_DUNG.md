# Hướng dẫn sử dụng – Thiền Đường Live Overlay

Overlay dọc 9:16 (1080×1920) cho TikTok Live, mô phỏng phòng live "Thiền Đường Ngàn Sen". Người xem vào phòng, bình luận, thả tim hay tặng quà thì nhân vật của họ xuất hiện và hành động ngay trong chánh điện.

## Cấu trúc thư mục

```
server.js            Backend: Express + Socket.IO + tiktok-live-connector, giả lập, lưu dữ liệu
config.json          Cấu hình: nghi lễ ↔ quà, điểm, thử thách, toạ độ cảnh, quẻ xăm, chữ...
data/state.json      (tự tạo) điểm & danh sách người xem, giữ lại khi khởi động lại
public/
  index.html         Bảng điều khiển  →  http://localhost:3000/
  overlay.html       Overlay cho OBS  →  http://localhost:3000/overlay
  css/overlay.css    Giao diện HUD khung gỗ đỏ viền vàng
  css/panel.css      Giao diện bảng điều khiển
  js/scene.js        Vẽ cảnh bằng Canvas: sư, bồ đoàn, nhân vật, khói hương, hiệu ứng
  js/hud.js          Các bảng thông tin + hàng đợi hiệu ứng
  js/audio.js        Âm thanh Web Audio: mõ, chuông, nhạc nền
  js/overlay.js      Điều phối overlay (socket, sự kiện, vòng lặp 60 FPS)
  js/panel.js        Logic bảng điều khiển
  assets/            Ảnh nền background.jpg, nhạc bgm.mp3 (tuỳ chọn)
```

## Hướng dẫn từng bước

### Bước 1 – Cài Node.js
1. Vào https://nodejs.org, tải bản **LTS** (Node 18 trở lên) và cài như phần mềm bình thường.
2. Mở Terminal (macOS) hoặc Command Prompt (Windows), gõ `node -v`. Nếu thấy dạng `v20.x.x` là đã cài xong.

### Bước 2 – Chạy tool
```bash
cd "đường/dẫn/tới/thư mục tool"
npm install        # chỉ cần chạy lần đầu
node server.js     # hoặc: npm start
```
Màn hình sẽ in ra:
```
Bảng điều khiển : http://127.0.0.1:3000/
Overlay cho OBS : http://127.0.0.1:3000/overlay
```
Mở bảng điều khiển bằng Chrome:
- **Test khi chưa live:** bật công tắc **Chế độ GIẢ LẬP**, hoặc bấm các nút / phím tắt `1`–`9` (hành động) và `Shift+1`–`Shift+7` (nghi lễ).
- **Khi đã live:** nhập TikTok ID (không cần `@`) → **Kết nối**. Nếu báo "KHÔNG đang live" thì tool tự thử lại mỗi 30 giây, nên có thể bấm kết nối trước rồi mới bắt đầu live.
- Có thể điền sẵn `tiktok.username` trong `config.json` để server tự kết nối mỗi lần khởi động.

Dừng tool: bấm `Ctrl + C` trong cửa sổ Terminal (dữ liệu được lưu trước khi thoát).

### Bước 3 – Thêm vào OBS
1. Trong bảng điều khiển, bấm **📋 Copy URL overlay cho OBS**.
2. OBS → *Settings → Video*: đặt **Base (Canvas) Resolution = 1080x1920** (khung dọc).
3. *Sources* → **+** → **Browser** (Browser Source) → đặt tên "Thiền Đường".
4. Dán URL `http://127.0.0.1:3000/overlay`, **Width = 1080**, **Height = 1920**.
5. Tick **Control audio via OBS** nếu muốn chỉnh âm lượng overlay trong mixer của OBS.
6. Bấm OK. Nếu cảnh không hiện, chuột phải vào source → **Refresh**.

Tham số thêm vào URL khi cần:

| Tham số | Tác dụng |
|---|---|
| `?nobg=1` | Nền trong suốt (chỉ có nhân vật + HUD), đặt chồng lên camera/ảnh khác |
| `?debug=1` | Hiện FPS ở góc dưới |
| `?mute=1` | Tắt tiếng riêng overlay này |

Nút **Tắt tiếng overlay** trên bảng điều khiển tắt tiếng mọi overlay đang mở (kể cả trong OBS). Khung xem trước luôn tắt tiếng sẵn để không bị phát tiếng hai lần; bật công tắc "Nghe âm thanh ở khung xem trước" nếu muốn nghe thử.

### Bước 4 – Thay ảnh nền
1. Chuẩn bị ảnh chánh điện **1080×1920** (tượng Phật ở trên, bàn thờ đỏ, sàn gỗ...).
2. Đặt vào `public/assets/background.jpg`, rồi refresh overlay. Chưa có ảnh thì overlay tự vẽ một nền chánh điện dự phòng.
3. Canh lại toạ độ trong mục `scene` của `config.json` cho khớp với ảnh của bạn:
   - `buddha` {x, y, r}: tâm và bán kính hào quang tượng Phật (dùng cho Đại lễ Phật quang)
   - `burner` {x, y}: miệng lư hương (nơi cắm nhang và khói bay lên)
   - `monks`: vị trí, tỉ lệ và tên 3 vị sư
   - `seatGrid`: lưới 24 bồ đoàn (toạ độ x từng cột hai dãy, `y0` hàng đầu, `dy` khoảng cách hàng)
   - Muốn đặt từng ghế tự do thì dùng `"seatPositions": [{"x":120,"y":1250,"s":0.95}, ...]`
4. Lưu `config.json`. Server tự nạp lại và overlay cập nhật ngay, không cần khởi động lại.

Nhạc nền riêng: đặt file `public/assets/bgm.mp3`. Không có file này thì tool dùng nhạc nền tổng hợp nhẹ.

### Bước 5 – Thêm / sửa nghi lễ (quà tặng)
Mỗi nghi lễ là một mục trong mảng `rituals` của `config.json`:
```json
{ "id": "dang_huong", "name": "Dâng hương trầm", "coins": 50, "icon": "🪔",
  "effect": "hoa_dang", "level": "big", "duration": 6000,
  "giftNames": ["Perfume", "Sunglasses"] }
```
| Trường | Ý nghĩa |
|---|---|
| `id` | Mã riêng, không trùng nhau |
| `name`, `icon`, `coins` | Tên, icon và giá xu hiển thị trên bảng Nghi lễ |
| `giftNames` | Tên quà TikTok (tiếng Anh, không phân biệt hoa/thường) sẽ kích hoạt nghi lễ này |
| `effect` | Hiệu ứng có sẵn: `bow_roses`, `pin_rose`, `hai_loc`, `xin_chu`, `hoa_dang`, `phap_danh`, `phat_quang` |
| `level` | `medium` = banner nhỏ phía trên (chạy nối tiếp nhanh); `big` = hiệu ứng lớn giữa màn hình, chạy lần lượt, không chồng nhau |
| `duration` | Thời lượng hiệu ứng (ms) |

- Nếu tên quà không khớp mục nào và `"matchByCoins": true` thì tool chọn nghi lễ có số xu **lớn nhất nhưng không vượt quá** giá quà. Nhờ vậy mọi quà đều có hiệu ứng.
- Tên quà TikTok thay đổi theo khu vực và theo thời gian. Muốn biết tên chính xác, mở **Log hệ thống** khi có người tặng: dòng log sẽ ghi tên quà.
- Muốn đặt pháp danh cố định cho một người: thêm vào `phapDanh.overrides`, ví dụ `{ "tiktok_id": "Tâm An" }`. Khi test có thể gõ pháp danh vào ô trên bảng điều khiển.
- Danh sách chữ thư pháp (`xinChu`) và quẻ xăm (`xam`) cũng sửa được trong `config.json`.

**Ảnh icon quà (giống khay quà TikTok):** mỗi nghi lễ lấy ảnh theo thứ tự ưu tiên sau:
1. Trường `"image"` trong `config.json` (đường dẫn file hoặc link https).
2. File `public/assets/gifts/<id>.png` (hoặc `.webp`, `.gif`, `.jpg`), ví dụ `public/assets/gifts/lay_phat.png`.
3. Ảnh quà TikTok thật: tự tải về khi kết nối vào phiên live và lưu ở `data/gifts.json`, nên lần sau không live vẫn có ảnh.
4. Không có ảnh nào thì dùng emoji ở trường `icon`.

Sau khi đã kết nối live một lần, tab **"Tất cả quà TikTok"** trên bảng điều khiển hiện toàn bộ quà của TikTok kèm giá xu và nghi lễ mà quà đó sẽ kích hoạt. Bấm vào quà nào để tặng thử quà đó.

## Lệnh người xem gõ trong chat

| Gõ | Hành động | Điểm (mặc định) |
|---|---|---|
| `1` | Thắp hương: nhang bay vào lư, khói bốc lên | +3 |
| `2` | Lạy Phật: nhân vật cúi lạy | +5 |
| `3` | Gõ mõ: chữ "cốc cốc" + tiếng mõ | +2 |
| `4` | Thỉnh chuông: sóng âm + tiếng chuông | +2 |
| `nam` / `nữ` | Đổi hình nhân vật | 0 |
| `xăm` | Rút quẻ, quẻ hiện giữa màn hình | +2 |
| `cầu ...` | Bong bóng lời khấn bay lên | +3 |
| bình luận khác | Bong bóng chat trên đầu | +1 |
| thả tim | Tim & cánh hoa bay lên, cộng tiến độ thử thách | +1/tim |
| theo dõi / chia sẻ | Hoa sen nở dưới chỗ ngồi | +10 |
| tặng quà | Nghi lễ tương ứng | +2/xu |

Các mức điểm, thời gian chờ giữa hai lệnh (chống spam), thời gian treo máy trước khi nhường chỗ (`idleTimeoutSec`) và thử thách (`challenge`: loại `likes | bows | incense | coins | merit`, mục tiêu, bước tăng mỗi vòng) đều chỉnh được trong `config.json`.

## Cơ chế chỗ ngồi
- 24 bồ đoàn. Ai tương tác lần đầu (vào phòng, bình luận, tim, quà...) được xếp vào ghế trống, ưu tiên hàng trên và sát lối đi.
- Hết chỗ thì người mới vào **hàng chờ** (bảng góc phải hiện "Chờ chỗ").
- Người ngồi không tương tác quá `idleTimeoutSec` (mặc định 10 phút; 3 phút nếu đang có người chờ) sẽ nhường chỗ cho người đầu hàng chờ.
- **Reset phiên** đưa điểm về 0 và giải phóng mọi chỗ, nhưng vẫn giữ tên, giới tính và pháp danh của người xem.

## Xử lý sự cố
- **"Không tìm thấy TikTok ID"**: kiểm tra lại ID (phần sau `@` trong link hồ sơ).
- **"KHÔNG đang live"**: tool tự thử lại mỗi `offlineRetrySec` giây cho tới khi bạn lên live.
- **"Máy chủ ký giới hạn lượt"**: thư viện dùng máy chủ ký Euler Stream miễn phí, có giới hạn số lượt. Đợi vài phút, hoặc đăng ký API key tại eulerstream.com và điền vào `tiktok.signApiKey`.
- **Mất kết nối giữa chừng**: tool tự kết nối lại với thời gian chờ tăng dần (3s → 60s).
- **Cổng 3000 bị chiếm**: đổi `port` trong `config.json`, hoặc chạy `PORT=3001 node server.js`.
- **Mở cho máy khác trong mạng LAN** (ví dụ OBS chạy trên máy khác): đổi `"host": "0.0.0.0"`. Lưu ý: khi đó ai trong mạng LAN cũng mở được bảng điều khiển.
