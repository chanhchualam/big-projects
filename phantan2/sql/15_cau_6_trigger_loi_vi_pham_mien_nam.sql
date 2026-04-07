/*
================================================================================
  CÂU 6 — Trigger dbo.tr_BaoVeLoiViPham tại Trạm Quản Trị MIỀN NAM (CSGT_MIENNAM)

  Yêu cầu đề bài:
  - Sự kiện: DELETE trên danh mục dbo.LoiViPham (ví dụ bỏ một quy định phạt).
  - Logic: Chỉ cho phép xóa nếu MaLoi đó CHƯA xuất hiện trong ChiTietPhat ở BẤT KỲ
    trạm nào (toàn quốc / cả 3 miền).
  - Kỹ thuật: Trigger chạy trên Miền Nam nhưng phải kiểm tra ChiTietPhat qua
    Linked Server tới Miền Trung và Miền Bắc (và bản địa Miền Nam).

  ĐIỀU KIỆN TIÊN QUYẾT (trên instance chứa CSGT_MIENNAM):
  1) Tạo Linked Server tới Trung và Bắc — xem sql/13_setup_linked_servers.sql
     khối comment "Trên instance MIỀN NAM": LINK_TRUNG, LINK_BAC.
  2) Tên database: CSGT_MIENTRUNG (LINK_TRUNG), CSGT_MIENBAC (LINK_BAC),
     local: CSGT_MIENNAM.

  Cách chạy: SSMS → kết nối instance MIỀN NAM → New Query → Execute toàn bộ file.

  Kiểm tra:
    SELECT * FROM sys.triggers WHERE name = N'tr_BaoVeLoiViPham';

  Thử xóa mã đã có trong ChiTietPhat (bất kỳ miền) → phải báo lỗi và không xóa.
  Thử xóa mã chỉ tồn tại trên LoiViPham, chưa dùng trong ChiTietPhat → thành công.
================================================================================
*/

USE CSGT_MIENNAM;
GO

CREATE OR ALTER TRIGGER dbo.tr_BaoVeLoiViPham
ON dbo.LoiViPham
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;

    /*
      deleted: các dòng vừa bị xóa khỏi LoiViPham (cùng transaction).
      Nếu MaLoi còn được tham chiếu ở ChiTietPhat tại Nam / Trung / Bắc → hủy giao dịch.
    */
    IF EXISTS (
        SELECT 1
        FROM deleted AS d
        INNER JOIN dbo.ChiTietPhat AS ctp ON ctp.MaLoi = d.MaLoi
    )
    OR EXISTS (
        SELECT 1
        FROM deleted AS d
        INNER JOIN LINK_TRUNG.CSGT_MIENTRUNG.dbo.ChiTietPhat AS ctp
               ON ctp.MaLoi = d.MaLoi
    )
    OR EXISTS (
        SELECT 1
        FROM deleted AS d
        INNER JOIN LINK_BAC.CSGT_MIENBAC.dbo.ChiTietPhat AS ctp
               ON ctp.MaLoi = d.MaLoi
    )
    BEGIN
        RAISERROR(
            N'Không được xóa: mã lỗi đã có trong ChiTietPhat tại ít nhất một trạm (ROLLBACK).',
            16, 1
        );
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
GO

/*
  Gợi ý test (chỉnh MaLoi cho khớp dữ liệu thật):

  -- Thử xóa mã đang dùng trong biên bản (kỳ vọng: lỗi)
  -- DELETE FROM dbo.LoiViPham WHERE MaLoi = <mã đã có trong ChiTietPhat>;

  -- Thử xóa mã chưa dùng (kỳ vọng: thành công)
  -- DELETE FROM dbo.LoiViPham WHERE MaLoi = <mã chỉ có trên LoiViPham>;
*/
