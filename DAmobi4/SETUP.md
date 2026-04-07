# Hướng dẫn Cài đặt và Chạy SMARTBUDGET

## Yêu cầu hệ thống

- Flutter SDK (phiên bản 3.0.0 trở lên)
- Android Studio
- Android SDK (API level 21 trở lên)
- Git

## Các bước cài đặt

### 1. Cài đặt Flutter

Nếu chưa có Flutter, tải và cài đặt từ: https://flutter.dev/docs/get-started/install

Kiểm tra cài đặt:
```bash
flutter doctor
```

### 2. Clone hoặc tải dự án

Nếu bạn đã có dự án, chuyển đến thư mục dự án:
```bash
cd DAmobi4
```

### 3. Cài đặt dependencies

```bash
flutter pub get
```

### 4. Chạy ứng dụng

#### Trên Android Studio:
1. Mở Android Studio
2. File > Open > Chọn thư mục dự án
3. Chờ Android Studio index dự án
4. Kết nối thiết bị Android hoặc khởi động emulator
5. Nhấn nút Run (▶) hoặc Shift + F10

#### Hoặc từ terminal:
```bash
flutter run
```

## Cấu trúc dự án

```
smartbudget/
├── lib/
│   ├── main.dart                 # Entry point
│   ├── models/                   # Data models
│   ├── providers/                # State management (Provider)
│   ├── screens/                  # UI screens
│   ├── services/                 # Business logic & database operations
│   └── utils/                    # Utilities (database helper)
├── android/                      # Android configuration
├── assets/                       # Images, icons
└── pubspec.yaml                  # Dependencies
```

## Tính năng đã triển khai

✅ Đăng nhập/Đăng ký
✅ Ghi chép giao dịch
✅ Quản lý ngân sách
✅ Quản lý ví/tài khoản
✅ Biểu đồ báo cáo
✅ SQLite database

## Tính năng sắp tới

- Quét hóa đơn (OCR)
- Tự động hóa từ tin nhắn/thông báo
- AI Financial Coach
- Dự báo chi tiêu
- Quản lý mục tiêu
- Nhắc nhở hóa đơn
- Chế độ dùng chung
- Đồng bộ đám mây

## Lưu ý

- Database SQLite được tạo tự động khi ứng dụng chạy lần đầu
- Dữ liệu được lưu cục bộ trên thiết bị
- Mật khẩu được hash bằng SHA-256

## Xử lý lỗi thường gặp

### Lỗi: "SDK location not found"
- Mở `android/local.properties`
- Thêm dòng: `sdk.dir=C:\\Users\\YOUR_USERNAME\\AppData\\Local\\Android\\Sdk`

### Lỗi: "Gradle sync failed"
- File > Invalidate Caches / Restart trong Android Studio
- Xóa thư mục `.gradle` và build lại

### Lỗi: "Package not found"
- Chạy `flutter clean`
- Chạy `flutter pub get` lại

## Hỗ trợ

Nếu gặp vấn đề, vui lòng kiểm tra:
1. Flutter version: `flutter --version`
2. Android SDK đã cài đặt đúng
3. Thiết bị/emulator đã kết nối: `flutter devices`

