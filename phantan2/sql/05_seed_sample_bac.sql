/* Dữ liệu mẫu cho vùng Bắc — chạy sau khi schema sẵn sàng */
USE TrafficViolation_Bac;
GO

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM dbo.DonViHanhChinh WHERE MaDonVi = N'HN')
    INSERT INTO dbo.DonViHanhChinh (MaDonVi, TenDonVi, Cap, MaCha) VALUES
    (N'HN', N'Thành phố Hà Nội', 1, NULL);

IF NOT EXISTS (SELECT 1 FROM dbo.ChuPhuongTien WHERE MaChu = N'DEMO001')
    INSERT INTO dbo.ChuPhuongTien (MaChu, HoTen, CCCD, DienThoai, DiaChi)
    VALUES (N'DEMO001', N'Nguyễn Văn A', N'001234567890', N'0900000001', N'Hà Nội');

IF NOT EXISTS (SELECT 1 FROM dbo.PhuongTien WHERE BienSo = N'29A-123.45')
    INSERT INTO dbo.PhuongTien (BienSo, MaChu, LoaiXe, NhanHieu, MauSon, MaTinhDK)
    VALUES (N'29A-123.45', N'DEMO001', N'Ô tô con', N'Toyota', N'Đen', N'HN');

IF NOT EXISTS (SELECT 1 FROM dbo.TramGhiHinh WHERE MaTram = N'TRAM-HN-01')
    INSERT INTO dbo.TramGhiHinh (MaTram, TenTram, MaDonVi, KinhDo, ViDo, DangHoatDong)
    VALUES (N'TRAM-HN-01', N'Trạm Văn Miếu - Quốc Tử Giám', N'HN', 105.8361999, 21.0277644, 1);

DECLARE @mid BIGINT;
IF NOT EXISTS (SELECT 1 FROM dbo.ViPhamGiaoThong WHERE BienSo = N'29A-123.45' AND NguonGhiNhan = N'Phạt nguội')
BEGIN
    INSERT INTO dbo.ViPhamGiaoThong (BienSo, MaTram, MaDonVi, ThoiGianVP, LoaiViPham, DieuKhoan, MucPhatTien, GhiChu, NguonGhiNhan)
    VALUES (N'29A-123.45', N'TRAM-HN-01', N'HN', SYSUTCDATETIME(), N'Vượt đèn đỏ', N'Điều 5.6', 1200000, N'Mẫu phân tán', N'Phạt nguội');
    SET @mid = SCOPE_IDENTITY();
    INSERT INTO dbo.PhatNguoi (MaViPham, MaAnh, DoTinCay, TrangThai)
    VALUES (@mid, N'IMG-DEMO-0001', 92.5, N'Chờ xác minh');
    INSERT INTO dbo.XuLyViPham (MaViPham, TrangThai, DaNopPhat)
    VALUES (@mid, N'Đang xử lý', 0);
END
GO
