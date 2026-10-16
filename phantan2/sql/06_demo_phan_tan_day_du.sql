/*
  Minh họa đồ án: phân mảnh dọc (Hành chính / Điểm), phân mảnh ngang (3 miền),
  trigger/proc trừ điểm qua Linked Server, danh mục lỗi.

  Thứ tự gợi ý:
  1) Chạy phần A trên database CSGT_MIENTRUNG (máy / instance chủ Web — Miền Trung).
  2) Chạy phần B trên CSGT_MIENNAM (Miền Nam — TEST2 nếu LINK_NAM trỏ tới đó).
  3) Chạy phần C trên CSGT_MIENBAC (Miền Bắc — TEST1) để có bảng danh mục cho demo replication.
  4) Quay lại Miền Trung chạy phần D (procedure).

  Điều chỉnh tên Linked Server nếu khác LINK_NAM / LINK_BAC.
*/

/* ========== A — CSGT_MIENTRUNG (Miền Trung) ========== */
USE CSGT_MIENTRUNG;
GO

IF OBJECT_ID(N'dbo.Demo_HanhChinh', N'U') IS NULL
CREATE TABLE dbo.Demo_HanhChinh (
    SoBangLai NVARCHAR(30) NOT NULL PRIMARY KEY,
    HoTen     NVARCHAR(200) NOT NULL,
    NgaySinh  DATE          NULL
);

IF OBJECT_ID(N'dbo.Demo_LoiViPham', N'U') IS NULL
CREATE TABLE dbo.Demo_LoiViPham (
    MaLoi   VARCHAR(20)  NOT NULL PRIMARY KEY,
    TenLoi  NVARCHAR(300) NOT NULL,
    MucPhat DECIMAL(18,2) NOT NULL DEFAULT 0,
    DiemTru INT NOT NULL DEFAULT 1
);

IF OBJECT_ID(N'dbo.Demo_BienBanViPham', N'U') IS NULL
CREATE TABLE dbo.Demo_BienBanViPham (
    Id        BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    SoBangLai NVARCHAR(30) NOT NULL,
    MaLoi     VARCHAR(20)  NOT NULL,
    NoiLapPhat NVARCHAR(200) NULL,
    NgayLap   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- Dữ liệu mẫu tra cứu xuyên miền (bằng lái MN001)
MERGE dbo.Demo_HanhChinh AS t
USING (SELECT N'MN001' AS SoBangLai, N'Nguyễn Văn Minh' AS HoTen, CAST(N'1990-05-15' AS DATE) AS NgaySinh) AS s
ON t.SoBangLai = s.SoBangLai
WHEN NOT MATCHED THEN INSERT (SoBangLai, HoTen, NgaySinh) VALUES (s.SoBangLai, s.HoTen, s.NgaySinh);

MERGE dbo.Demo_LoiViPham AS t
USING (SELECT * FROM (VALUES
    (N'L001', N'Vượt đèn đỏ', 1200000, 4),
    (N'L002', N'Không đeo khẩu trang khi tham gia giao thông (demo)', 300000, 1)
) AS x(MaLoi, TenLoi, MucPhat, DiemTru)) AS s
ON t.MaLoi = s.MaLoi
WHEN NOT MATCHED THEN INSERT (MaLoi, TenLoi, MucPhat, DiemTru)
VALUES (s.MaLoi, s.TenLoi, s.MucPhat, s.DiemTru);
GO

/* ========== B — CSGT_MIENNAM (Miền Nam — chạy trên DB tại TEST2 / LINK_NAM) ========== */
/*
USE CSGT_MIENNAM;
GO
IF OBJECT_ID(N'dbo.Demo_Diem', N'U') IS NULL
CREATE TABLE dbo.Demo_Diem (
    SoBangLai NVARCHAR(30) NOT NULL PRIMARY KEY,
    DiemConLai INT NOT NULL DEFAULT 12
);
MERGE dbo.Demo_Diem AS t
USING (SELECT N'MN001' AS SoBangLai, 12 AS DiemConLai) AS s ON t.SoBangLai = s.SoBangLai
WHEN NOT MATCHED THEN INSERT (SoBangLai, DiemConLai) VALUES (s.SoBangLai, s.DiemConLai);
GO
*/

/* ========== C — CSGT_MIENBAC (Miền Bắc — TEST1) ========== */
/*
USE CSGT_MIENBAC;
GO
IF OBJECT_ID(N'dbo.Demo_LoiViPham', N'U') IS NULL
CREATE TABLE dbo.Demo_LoiViPham (
    MaLoi   VARCHAR(20)  NOT NULL PRIMARY KEY,
    TenLoi  NVARCHAR(300) NOT NULL,
    MucPhat DECIMAL(18,2) NOT NULL DEFAULT 0,
    DiemTru INT NOT NULL DEFAULT 1
);
-- Sau khi thêm lỗi ở Miền Trung, có thể INSERT tương tự ở đây hoặc dùng replication.
GO
*/

/* ========== D — Procedure trên CSGT_MIENTRUNG (sau khi B đã tồn tại Demo_Diem) ========== */
USE CSGT_MIENTRUNG;
GO

CREATE OR ALTER PROCEDURE dbo.sp_DemoTruDiem
    @SoBangLai NVARCHAR(30),
    @MaLoi     VARCHAR(20),
    @NoiLapPhat NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @DiemTru INT;
    SELECT @DiemTru = ISNULL(DiemTru, 1) FROM dbo.Demo_LoiViPham WHERE MaLoi = @MaLoi;
    IF @DiemTru IS NULL SET @DiemTru = 1;

    INSERT INTO dbo.Demo_BienBanViPham (SoBangLai, MaLoi, NoiLapPhat)
    VALUES (@SoBangLai, @MaLoi, @NoiLapPhat);

    UPDATE d
    SET d.DiemConLai = ISNULL(d.DiemConLai, 12) - @DiemTru
    FROM LINK_NAM.CSGT_MIENNAM.dbo.Demo_Diem AS d
    WHERE d.SoBangLai = @SoBangLai;
END
GO
