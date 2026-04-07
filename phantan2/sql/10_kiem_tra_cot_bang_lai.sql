/* Chạy trên CSGT_MIENTRUNG (và tương tự trên Nam nếu cần) để xem đúng tên cột */
USE CSGT_MIENTRUNG;
GO

SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN (
  N'BangLai', N'BangLai_HanhChinh', N'BangLai_Diem',
  N'PhuongTien', N'BienBan', N'ChiTietPhat', N'LoiViPham',
  N'QuyetDinhXuPhat', N'GiaoDichNopPhat', N'DonViCSGT'
)
ORDER BY TABLE_NAME, ORDINAL_POSITION;
GO
