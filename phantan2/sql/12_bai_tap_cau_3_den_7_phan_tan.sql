/*
================================================================================
  BÀI TẬP PHÂN TÁN — Câu 3 đến 7
  CSDL: CSGT_MIENBAC | CSGT_MIENTRUNG | CSGT_MIENNAM
  Chỉnh tên Linked Server cho khớp SSMS (xem khối đầu).

  Thứ tự: tạo Linked Server → chạy từng khối USE trên đúng instance.

  Web (Flask) chỉ cần procedure trên CSGT_MIENTRUNG: có thể chạy nhanh
  sql/14_quick_deploy_csgt_mientrung.sql thay vì toàn bộ file này.
================================================================================
  QUY ƯỚC LINKED SERVER

  Từ Miền Bắc (CSGT_MIENBAC):     LINK_TRUNG → MIENTRUNG,  LINK_NAM → MIENNAM
  Từ Miền Trung (CSGT_MIENTRUNG): LINK_BAC → MIENBAC,       LINK_NAM → MIENNAM (khớp web)
  Từ Miền Nam (CSGT_MIENNAM):     LINK_TRUNG → MIENTRUNG,  LINK_BAC → MIENBAC (cho trigger)

  Cột: BienBan (BienSo, TrangThai, NgayViPham, DiaDiem, MaDonVi_XuLy), ChiTietPhat.MaLoi,
  LoiViPham.TenLoi, DonViCSGT.TenDonVi, BangLai_Diem, GiaoDichNopPhat.SoTien
================================================================================
*/

/* ========== CÂU 3 — usp_TraCuuPhatNguoi @BienSo — Site Miền Bắc ========== */
USE CSGT_MIENBAC;
GO

CREATE OR ALTER PROCEDURE dbo.usp_TraCuuPhatNguoi
    @BienSo NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;

    IF OBJECT_ID(N'tempdb..#KetQua') IS NOT NULL
        DROP TABLE #KetQua;

    CREATE TABLE #KetQua (
        NguonTram   NVARCHAR(30)  NOT NULL,
        NgayViPham  DATETIME2     NULL,
        DiaDiem     NVARCHAR(500) NULL,
        TenLoi      NVARCHAR(400) NULL,
        TenDonVi    NVARCHAR(200) NULL
    );

    INSERT INTO #KetQua (NguonTram, NgayViPham, DiaDiem, TenLoi, TenDonVi)
    SELECT
        N'Miền Bắc',
        bb.NgayViPham,
        bb.DiaDiem,
        lv.TenLoi,
        dv.TenDonVi
    FROM dbo.BienBan AS bb
    INNER JOIN dbo.ChiTietPhat AS ctp ON ctp.MaBienBan = bb.MaBienBan
    INNER JOIN dbo.LoiViPham AS lv ON lv.MaLoi = ctp.MaLoi
    LEFT JOIN dbo.DonViCSGT AS dv ON dv.MaDonVi = bb.MaDonVi_XuLy
    WHERE bb.BienSo = @BienSo
      AND bb.TrangThai IN (N'ChoXuLy', N'DaGuiThongBao');

    IF NOT EXISTS (SELECT 1 FROM #KetQua)
    BEGIN
        INSERT INTO #KetQua (NguonTram, NgayViPham, DiaDiem, TenLoi, TenDonVi)
        SELECT
            N'Miền Trung',
            bb.NgayViPham,
            bb.DiaDiem,
            lv.TenLoi,
            dv.TenDonVi
        FROM LINK_TRUNG.CSGT_MIENTRUNG.dbo.BienBan AS bb
        INNER JOIN LINK_TRUNG.CSGT_MIENTRUNG.dbo.ChiTietPhat AS ctp
                ON ctp.MaBienBan = bb.MaBienBan
        INNER JOIN LINK_TRUNG.CSGT_MIENTRUNG.dbo.LoiViPham AS lv
                ON lv.MaLoi = ctp.MaLoi
        LEFT JOIN LINK_TRUNG.CSGT_MIENTRUNG.dbo.DonViCSGT AS dv
               ON dv.MaDonVi = bb.MaDonVi_XuLy
        WHERE bb.BienSo = @BienSo
          AND bb.TrangThai IN (N'ChoXuLy', N'DaGuiThongBao');

        INSERT INTO #KetQua (NguonTram, NgayViPham, DiaDiem, TenLoi, TenDonVi)
        SELECT
            N'Miền Nam',
            bb.NgayViPham,
            bb.DiaDiem,
            lv.TenLoi,
            dv.TenDonVi
        FROM LINK_NAM.CSGT_MIENNAM.dbo.BienBan AS bb
        INNER JOIN LINK_NAM.CSGT_MIENNAM.dbo.ChiTietPhat AS ctp
                ON ctp.MaBienBan = bb.MaBienBan
        INNER JOIN LINK_NAM.CSGT_MIENNAM.dbo.LoiViPham AS lv
                ON lv.MaLoi = ctp.MaLoi
        LEFT JOIN LINK_NAM.CSGT_MIENNAM.dbo.DonViCSGT AS dv
               ON dv.MaDonVi = bb.MaDonVi_XuLy
        WHERE bb.BienSo = @BienSo
          AND bb.TrangThai IN (N'ChoXuLy', N'DaGuiThongBao');
    END

    SELECT
        NguonTram,
        NgayViPham,
        DiaDiem,
        TenLoi,
        TenDonVi
    FROM #KetQua
    ORDER BY NguonTram, NgayViPham DESC;
END
GO

/* ========== CÂU 3 — cùng tên procedure tại Miền Trung (Web / node điều phối): Trung trước, rồi Bắc + Nam ========== */
USE CSGT_MIENTRUNG;
GO

CREATE OR ALTER PROCEDURE dbo.usp_TraCuuPhatNguoi
    @BienSo NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;

    IF OBJECT_ID(N'tempdb..#KetQua') IS NOT NULL
        DROP TABLE #KetQua;

    CREATE TABLE #KetQua (
        NguonTram   NVARCHAR(30)  NOT NULL,
        NgayViPham  DATETIME2     NULL,
        DiaDiem     NVARCHAR(500) NULL,
        TenLoi      NVARCHAR(400) NULL,
        TenDonVi    NVARCHAR(200) NULL
    );

    INSERT INTO #KetQua (NguonTram, NgayViPham, DiaDiem, TenLoi, TenDonVi)
    SELECT
        N'Miền Trung',
        bb.NgayViPham,
        bb.DiaDiem,
        lv.TenLoi,
        dv.TenDonVi
    FROM dbo.BienBan AS bb
    INNER JOIN dbo.ChiTietPhat AS ctp ON ctp.MaBienBan = bb.MaBienBan
    INNER JOIN dbo.LoiViPham AS lv ON lv.MaLoi = ctp.MaLoi
    LEFT JOIN dbo.DonViCSGT AS dv ON dv.MaDonVi = bb.MaDonVi_XuLy
    WHERE bb.BienSo = @BienSo
      AND bb.TrangThai IN (N'ChoXuLy', N'DaGuiThongBao');

    IF NOT EXISTS (SELECT 1 FROM #KetQua)
    BEGIN
        INSERT INTO #KetQua (NguonTram, NgayViPham, DiaDiem, TenLoi, TenDonVi)
        SELECT
            N'Miền Bắc',
            bb.NgayViPham,
            bb.DiaDiem,
            lv.TenLoi,
            dv.TenDonVi
        FROM LINK_BAC.CSGT_MIENBAC.dbo.BienBan AS bb
        INNER JOIN LINK_BAC.CSGT_MIENBAC.dbo.ChiTietPhat AS ctp
                ON ctp.MaBienBan = bb.MaBienBan
        INNER JOIN LINK_BAC.CSGT_MIENBAC.dbo.LoiViPham AS lv
                ON lv.MaLoi = ctp.MaLoi
        LEFT JOIN LINK_BAC.CSGT_MIENBAC.dbo.DonViCSGT AS dv
               ON dv.MaDonVi = bb.MaDonVi_XuLy
        WHERE bb.BienSo = @BienSo
          AND bb.TrangThai IN (N'ChoXuLy', N'DaGuiThongBao');

        INSERT INTO #KetQua (NguonTram, NgayViPham, DiaDiem, TenLoi, TenDonVi)
        SELECT
            N'Miền Nam',
            bb.NgayViPham,
            bb.DiaDiem,
            lv.TenLoi,
            dv.TenDonVi
        FROM LINK_NAM.CSGT_MIENNAM.dbo.BienBan AS bb
        INNER JOIN LINK_NAM.CSGT_MIENNAM.dbo.ChiTietPhat AS ctp
                ON ctp.MaBienBan = bb.MaBienBan
        INNER JOIN LINK_NAM.CSGT_MIENNAM.dbo.LoiViPham AS lv
                ON lv.MaLoi = ctp.MaLoi
        LEFT JOIN LINK_NAM.CSGT_MIENNAM.dbo.DonViCSGT AS dv
               ON dv.MaDonVi = bb.MaDonVi_XuLy
        WHERE bb.BienSo = @BienSo
          AND bb.TrangThai IN (N'ChoXuLy', N'DaGuiThongBao');
    END

    SELECT
        NguonTram,
        NgayViPham,
        DiaDiem,
        TenLoi,
        TenDonVi
    FROM #KetQua
    ORDER BY NguonTram, NgayViPham DESC;
END
GO

/* ========== CÂU 4 — usp_TruDiemBangLai — Miền Bắc (điểm tại Miền Nam) ========== */
USE CSGT_MIENBAC;
GO

CREATE OR ALTER PROCEDURE dbo.usp_TruDiemBangLai
    @SoBangLai NVARCHAR(50),
    @DiemTru   INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @DiemTruoc INT;
    DECLARE @DiemMoi   INT;
    DECLARE @CanhBao   NVARCHAR(200) = NULL;

    SELECT @DiemTruoc = d.DiemConLai
    FROM dbo.BangLai_HanhChinh AS hc
    INNER JOIN LINK_NAM.CSGT_MIENNAM.dbo.BangLai_Diem AS d
            ON d.SoBangLai = hc.SoBangLai
    WHERE hc.SoBangLai = @SoBangLai;

    IF @DiemTruoc IS NULL
    BEGIN
        RAISERROR(N'Không tìm thấy bằng lái hoặc chưa có bản ghi điểm tại Miền Nam.', 16, 1);
        RETURN;
    END

    UPDATE d
    SET d.DiemConLai = ISNULL(d.DiemConLai, 12) - @DiemTru
    FROM LINK_NAM.CSGT_MIENNAM.dbo.BangLai_Diem AS d
    WHERE d.SoBangLai = @SoBangLai;

    SET @DiemMoi = (
        SELECT d.DiemConLai
        FROM LINK_NAM.CSGT_MIENNAM.dbo.BangLai_Diem AS d
        WHERE d.SoBangLai = @SoBangLai
    );

    IF @DiemMoi IS NOT NULL AND @DiemMoi <= 0
        SET @CanhBao = N'Cảnh báo: Tước Bằng (điểm GPLX về 0 hoặc âm).';

    SELECT
        @SoBangLai AS SoBangLai,
        @DiemTruoc AS DiemTruoc,
        @DiemMoi   AS DiemConLaiMoi,
        @CanhBao   AS CanhBao;
END
GO

/* ========== CÂU 4 — cùng tên procedure trên Miền Trung ========== */
USE CSGT_MIENTRUNG;
GO

CREATE OR ALTER PROCEDURE dbo.usp_TruDiemBangLai
    @SoBangLai NVARCHAR(50),
    @DiemTru   INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @DiemTruoc INT;
    DECLARE @DiemMoi   INT;
    DECLARE @CanhBao   NVARCHAR(200) = NULL;

    SELECT @DiemTruoc = d.DiemConLai
    FROM dbo.BangLai_HanhChinh AS hc
    INNER JOIN LINK_NAM.CSGT_MIENNAM.dbo.BangLai_Diem AS d
            ON d.SoBangLai = hc.SoBangLai
    WHERE hc.SoBangLai = @SoBangLai;

    IF @DiemTruoc IS NULL
    BEGIN
        RAISERROR(N'Không tìm thấy bằng lái hoặc chưa có bản ghi điểm tại Miền Nam.', 16, 1);
        RETURN;
    END

    UPDATE d
    SET d.DiemConLai = ISNULL(d.DiemConLai, 12) - @DiemTru
    FROM LINK_NAM.CSGT_MIENNAM.dbo.BangLai_Diem AS d
    WHERE d.SoBangLai = @SoBangLai;

    SET @DiemMoi = (
        SELECT d.DiemConLai
        FROM LINK_NAM.CSGT_MIENNAM.dbo.BangLai_Diem AS d
        WHERE d.SoBangLai = @SoBangLai
    );

    IF @DiemMoi IS NOT NULL AND @DiemMoi <= 0
        SET @CanhBao = N'Cảnh báo: Tước Bằng (điểm GPLX về 0 hoặc âm).';

    SELECT
        @SoBangLai AS SoBangLai,
        @DiemTruoc AS DiemTruoc,
        @DiemMoi   AS DiemConLaiMoi,
        @CanhBao   AS CanhBao;
END
GO

/* ========== CÂU 5 — Thu ngân sách toàn quốc (Linked Server, không đồng bộ bản sao) ========== */
USE CSGT_MIENTRUNG;
GO

CREATE OR ALTER VIEW dbo.vw_ThuNganSachTheoMien AS
SELECT N'Bắc' AS MaKhuVuc, SUM(ISNULL(gd.SoTien, 0)) AS TongTienDaThu
FROM LINK_BAC.CSGT_MIENBAC.dbo.GiaoDichNopPhat AS gd
UNION ALL
SELECT N'Trung', SUM(ISNULL(gd.SoTien, 0))
FROM dbo.GiaoDichNopPhat AS gd
UNION ALL
SELECT N'Nam', SUM(ISNULL(gd.SoTien, 0))
FROM LINK_NAM.CSGT_MIENNAM.dbo.GiaoDichNopPhat AS gd;
GO

/* ========== CÂU 6 — Trigger bảo vệ danh mục lỗi — Miền Nam ========== */
/* AFTER DELETE + ROLLBACK: SQL Server chỉ cho INSTEAD OF trên VIEW, không cho trên bảng. */
USE CSGT_MIENNAM;
GO

CREATE OR ALTER TRIGGER dbo.tr_BaoVeLoiViPham
ON dbo.LoiViPham
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;

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
END
GO

/* ========== CÂU 7 — Đếm tài xế > 3 biên bản/năm (COUNT từng trạm rồi gộp) ========== */
USE CSGT_MIENTRUNG;
GO

CREATE OR ALTER PROCEDURE dbo.usp_DemTaiXeVuPhamTren3Lan
    @Nam INT
AS
BEGIN
    SET NOCOUNT ON;

    IF OBJECT_ID(N'tempdb..#DemTheoTram') IS NOT NULL
        DROP TABLE #DemTheoTram;

    CREATE TABLE #DemTheoTram (
        SoBangLai NVARCHAR(50) NOT NULL,
        SoBienBan INT NOT NULL
    );

    INSERT INTO #DemTheoTram (SoBangLai, SoBienBan)
    SELECT bb.SoBangLai, COUNT(*)
    FROM dbo.BienBan AS bb
    WHERE YEAR(bb.NgayViPham) = @Nam
      AND NULLIF(LTRIM(RTRIM(bb.SoBangLai)), N'') IS NOT NULL
    GROUP BY bb.SoBangLai;

    INSERT INTO #DemTheoTram (SoBangLai, SoBienBan)
    SELECT bb.SoBangLai, COUNT(*)
    FROM LINK_BAC.CSGT_MIENBAC.dbo.BienBan AS bb
    WHERE YEAR(bb.NgayViPham) = @Nam
      AND NULLIF(LTRIM(RTRIM(bb.SoBangLai)), N'') IS NOT NULL
    GROUP BY bb.SoBangLai;

    INSERT INTO #DemTheoTram (SoBangLai, SoBienBan)
    SELECT bb.SoBangLai, COUNT(*)
    FROM LINK_NAM.CSGT_MIENNAM.dbo.BienBan AS bb
    WHERE YEAR(bb.NgayViPham) = @Nam
      AND NULLIF(LTRIM(RTRIM(bb.SoBangLai)), N'') IS NOT NULL
    GROUP BY bb.SoBangLai;

    ;WITH Gop AS (
        SELECT SoBangLai, SUM(SoBienBan) AS TongBB
        FROM #DemTheoTram
        GROUP BY SoBangLai
        HAVING SUM(SoBienBan) > 3
    )
    SELECT COUNT(*) AS SoTaiXeNhieuVu FROM Gop;

    ;WITH Gop AS (
        SELECT SoBangLai, SUM(SoBienBan) AS TongBB
        FROM #DemTheoTram
        GROUP BY SoBangLai
        HAVING SUM(SoBienBan) > 3
    )
    SELECT SoBangLai, TongBB FROM Gop ORDER BY TongBB DESC;
END
GO

/*
  Ghi chú câu 7: SQL Server không hỗ trợ truy vấn Linked Server trong scalar UDF
  ổn định — dùng dbo.usp_DemTaiXeVuPhamTren3Lan (hai tập kết quả: tổng + chi tiết).
*/
