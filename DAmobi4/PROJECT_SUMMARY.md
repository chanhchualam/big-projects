# Tóm tắt Dự án SMARTBUDGET

## Tổng quan

SMARTBUDGET là ứng dụng quản lý chi tiêu cá nhân được xây dựng bằng Flutter, sử dụng SQLite làm cơ sở dữ liệu cục bộ.

## Các tính năng đã triển khai

### ✅ Hoàn thành

1. **Đăng nhập/Đăng ký**
   - Xác thực người dùng
   - Mật khẩu được hash bằng SHA-256
   - Lưu trạng thái đăng nhập

2. **Ghi chép giao dịch**
   - Thêm giao dịch thu nhập/chi tiêu
   - Chọn tài khoản
   - Nhập mô tả và số tiền
   - Xem danh sách giao dịch

3. **Quản lý ngân sách**
   - Tạo ngân sách theo chu kỳ (ngày/tuần/tháng/năm)
   - Thiết lập số tiền và thời gian

4. **Quản lý ví/tài khoản**
   - Tạo nhiều tài khoản (tiền mặt, ngân hàng, thẻ tín dụng, tiết kiệm)
   - Xem tổng số dư
   - Quản lý số dư từng tài khoản

5. **Biểu đồ báo cáo**
   - Hiển thị tổng thu nhập, chi tiêu, số dư
   - Biểu đồ cột chi tiêu theo tháng
   - Sử dụng fl_chart

6. **Database SQLite**
   - Tự động tạo database khi khởi động
   - Các bảng: users, accounts, transactions, budgets, goals, bills, shared_accounts, categories

## Cấu trúc dự án

```
smartbudget/
├── lib/
│   ├── main.dart                    # Entry point
│   ├── models/                      # Data models
│   │   ├── user_model.dart
│   │   ├── transaction_model.dart
│   │   ├── account_model.dart
│   │   └── budget_model.dart
│   ├── providers/                   # State management (Provider)
│   │   ├── auth_provider.dart
│   │   ├── transaction_provider.dart
│   │   ├── budget_provider.dart
│   │   └── account_provider.dart
│   ├── screens/                     # UI screens
│   │   ├── splash_screen.dart
│   │   ├── auth/
│   │   │   ├── login_screen.dart
│   │   │   └── register_screen.dart
│   │   ├── home/
│   │   │   └── home_screen.dart
│   │   ├── transactions/
│   │   │   ├── transaction_list_screen.dart
│   │   │   └── add_transaction_screen.dart
│   │   ├── budgets/
│   │   │   ├── budget_screen.dart
│   │   │   └── add_budget_screen.dart
│   │   ├── accounts/
│   │   │   ├── account_screen.dart
│   │   │   └── add_account_screen.dart
│   │   └── reports/
│   │       └── report_screen.dart
│   ├── services/                    # Business logic
│   │   ├── user_service.dart
│   │   ├── transaction_service.dart
│   │   ├── account_service.dart
│   │   └── budget_service.dart
│   └── utils/
│       └── database_helper.dart     # SQLite helper
├── android/                         # Android configuration
├── assets/                          # Images, icons
└── pubspec.yaml                     # Dependencies
```

## Công nghệ sử dụng

- **Flutter**: Framework UI
- **Provider**: State management
- **SQLite (sqflite)**: Database cục bộ
- **fl_chart**: Biểu đồ
- **intl**: Định dạng ngày tháng và tiền tệ
- **shared_preferences**: Lưu trữ cài đặt

## Các tính năng sắp tới

- [ ] Quét hóa đơn (OCR) - Sử dụng Google ML Kit
- [ ] Tự động hóa từ tin nhắn/thông báo - Đọc SMS
- [ ] AI Financial Coach - Phân tích và tư vấn
- [ ] Dự báo chi tiêu - Machine learning
- [ ] Quản lý mục tiêu - Mục tiêu tài chính
- [ ] Nhắc nhở hóa đơn - Local notifications
- [ ] Chế độ dùng chung - Chia sẻ tài khoản
- [ ] Đồng bộ đám mây - Backup và sync

## Cách chạy

1. Cài đặt dependencies: `flutter pub get`
2. Chạy ứng dụng: `flutter run`
3. Hoặc mở trong Android Studio và nhấn Run

Xem chi tiết trong file `SETUP.md`

## Lưu ý

- Database được tạo tự động khi chạy lần đầu
- Dữ liệu lưu cục bộ trên thiết bị
- Cần cấp quyền camera, storage, SMS cho các tính năng nâng cao

