#!/bin/zsh
# ------------------------------------------------------------
# BẤM ĐÚP FILE NÀY ĐỂ CHUẨN BỊ LIVE (macOS)
#  1. Chạy server (nếu chưa chạy)
#  2. Mở cửa sổ overlay riêng, khung dọc, để TikTok LIVE Studio "Window capture"
#     - Chặn Chrome hạ tốc cửa sổ bị che (nguyên nhân gây giật / hiệu ứng chạy chậm)
#     - Giới hạn 30 FPS cho nhẹ máy (TikTok phát 30 FPS)
#  3. Mở bảng điều khiển
# Dừng: bấm Ctrl + C trong cửa sổ Terminal này.
# ------------------------------------------------------------
cd "$(dirname "$0")"
PORT=3000
PROFILE="$HOME/Library/Application Support/ThienDuongOverlay"
OVERLAY_URL="http://localhost:$PORT/overlay?fps=30"
# Máy yếu: đổi dòng trên thành  "http://localhost:$PORT/overlay?fps=30&lite=1"

SERVER_PID=""
if lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Server đã chạy sẵn ở cổng $PORT."
else
  echo "Đang chạy server..."
  node server.js &
  SERVER_PID=$!
  for i in {1..30}; do
    lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1 && break
    sleep 0.5
  done
fi

# Đóng cửa sổ overlay cũ (nếu có) để mở lại với cấu hình chống giật
pkill -f "user-data-dir=$PROFILE" 2>/dev/null && sleep 1

open -na "Google Chrome" --args \
  --user-data-dir="$PROFILE" \
  --app="$OVERLAY_URL" \
  --window-size=608,1080 --window-position=0,0 \
  --autoplay-policy=no-user-gesture-required \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --disable-background-timer-throttling

sleep 1
open "http://localhost:$PORT/"

echo ""
echo "Đã mở cửa sổ overlay (góc trái màn hình) và bảng điều khiển."
echo "Trong TikTok LIVE Studio: Add source -> Window capture -> chọn cửa sổ overlay."
echo "Giữ cửa sổ Terminal này mở trong lúc live. Dừng: Ctrl + C."

if [ -n "$SERVER_PID" ]; then
  wait $SERVER_PID
fi
