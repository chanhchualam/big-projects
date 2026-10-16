# StudyMatch (Oracle) - Hướng dẫn import bằng Oracle SQL Developer

## Chạy 1 file duy nhất (khuyên dùng)
- Mở và chạy: `database/oracle/studymatch_oracle_full.sql` (Run Script / F5)

## Nếu bạn thấy bảng bị nhân đôi (DANHGIA và DanhGia, ...)
Điều này xảy ra khi bạn từng chạy `db.create_all()` của SQLAlchemy trên Oracle (tạo bảng với tên có dấu nháy "...").

- Chạy script dọn dẹp (trong schema STUDYMATCH): `database/oracle/07_cleanup_quoted_tables.sql`
- Sau đó chạy lại: `database/oracle/studymatch_oracle_full.sql` (nếu cần)

## Thứ tự chạy script (đầy đủ)
1. `database/oracle/00_drop_all.sql` (tuỳ chọn, nếu muốn xoá sạch)
2. `database/oracle/01_schema.sql`
3. `database/oracle/02_functions.sql`
4. `database/oracle/03_procedures.sql`
5. `database/oracle/04_triggers.sql`
6. `database/oracle/05_views.sql`
7. `database/oracle/06_sample_data.sql`

## Lưu ý
- Các khóa chính dùng sequence + trigger auto-ID nên khi `INSERT` bạn có thể để `NULL` cho cột ID.
- Trigger cập nhật `KetQuaDuDoan` dùng **compound trigger** để tránh lỗi *mutating table*.
- Nếu bạn không muốn tự động cập nhật `KetQuaDuDoan` khi nhập điểm, có thể bỏ trigger `trg_diem_refresh_ketqua`.

## Lỗi chữ tiếng Việt bị méo (ví dụ: "Lá»‹ch Sá»­")
Đây là lỗi **encoding** (file UTF-8 nhưng bị mở bằng ANSI/Windows-1252).

- Trong Oracle SQL Developer: `Tools -> Preferences -> Environment -> Encoding` chọn **UTF-8**, sau đó đóng/mở lại file `.sql` rồi chạy lại bằng **Run Script (F5)**.
- Trong VS Code: góc phải dưới (Encoding) chọn **Reopen with Encoding -> UTF-8**, rồi **Save with Encoding -> UTF-8**.
- Nếu bạn đã import và dữ liệu đã bị lưu sai, cách nhanh nhất là chạy `00_drop_all.sql` rồi import lại `studymatch_oracle_full.sql` sau khi chỉnh encoding.
