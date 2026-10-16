/*
  Site Miền Trung (CSGT_MIENTRUNG): các vụ vi phạm có MỨC PHẠT (chi tiết) > 10.000.000 đ
  Hiển thị: Số quyết định, Tổng tiền phạt (theo quyết định), Tên lỗi
  — JOIN ChiTietPhat + LoiViPham (+ QuyetDinhXuPhat để lấy số QĐ và tổng tiền).

  Chạy trên database Miền Trung (máy chủ điều phối / CSGT_MIENTRUNG).

  Đã tích hợp web: menu "Phạt > 10tr (Trung)" hoặc /phat-tren-10-trieu-mien-trung
  — ghi đè SQL qua WebApp.Demo.QueryPhatTren10TrieuTrung trong config/connections.json.
*/
USE CSGT_MIENTRUNG;
GO

/* Phiên bản 1: Lọc theo tiền phạt TỪNG DÒNG chi tiết (ChiTietPhat.SoTien) > 10 triệu */
SELECT
    qd.SoQuyetDinh,
    qd.TongTien      AS TongTienPhat,
    lv.TenLoi        AS TenLoiViPham
FROM dbo.BienBan AS bb
INNER JOIN dbo.ChiTietPhat AS ctp
       ON ctp.MaBienBan = bb.MaBienBan
INNER JOIN dbo.LoiViPham AS lv
       ON lv.MaLoi = ctp.MaLoi
LEFT JOIN dbo.QuyetDinhXuPhat AS qd
       ON qd.MaBienBan = bb.MaBienBan
WHERE ctp.SoTien > 10000000
ORDER BY qd.SoQuyetDinh, bb.MaBienBan, lv.TenLoi;
GO

/*
  Phiên bản 2 (nếu đề yêu cầu "mức phạt" là TỔNG TIỀN trên quyết định, không phải từng chi tiết):
  — Bỏ comment khối dưới và dùng thay cho Phiên bản 1.

SELECT
    qd.SoQuyetDinh,
    qd.TongTien      AS TongTienPhat,
    lv.TenLoi        AS TenLoiViPham
FROM dbo.BienBan AS bb
INNER JOIN dbo.ChiTietPhat AS ctp
       ON ctp.MaBienBan = bb.MaBienBan
INNER JOIN dbo.LoiViPham AS lv
       ON lv.MaLoi = ctp.MaLoi
INNER JOIN dbo.QuyetDinhXuPhat AS qd
       ON qd.MaBienBan = bb.MaBienBan
WHERE qd.TongTien > 10000000
ORDER BY qd.SoQuyetDinh, bb.MaBienBan, lv.TenLoi;
*/
