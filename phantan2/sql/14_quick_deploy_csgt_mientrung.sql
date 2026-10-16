/*
  TRIỂN KHAI NHANH — Chỉ trên database Web đang dùng (thường là CSGT_MIENTRUNG).
  Lỗi ODBC 2812 "Could not find stored procedure" = chưa chạy script này trên đúng DB.

  Gồm: sp_CSGT_TruDiem (trang Xử lý vi phạm), usp_* bài tập câu 3–7 — xem sql/08 nếu chỉ cần procedure nghiệp vụ.

  Trước đó: tạo Linked Server LINK_BAC, LINK_NAM (xem sql/13_setup_linked_servers.sql).

  Cách làm: mở SSMS → kết nối đúng instance như chuỗi WebApp.ConnectionString
  → New Query → chọn database CSGT_MIENTRUNG → Execute toàn bộ file.
*/

USE CSGT_MIENTRUNG;
GO

/* Trang «Xử lý vi phạm» — chỉ SoBangLai + MaLoi + NoiLap; BienSo = TOP 1 PhuongTien; LichSuTruDiem nếu có bảng */
CREATE OR ALTER PROCEDURE dbo.sp_CSGT_TruDiem
    @SoBangLai NVARCHAR(50),
    @MaLoi     VARCHAR(30),
    @NoiLap    NVARCHAR(300)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @MaLoiInt   INT;
    DECLARE @DiemTru    INT;
    DECLARE @MucPhat    DECIMAL(18, 2);
    DECLARE @MaBienBan  BIGINT;
    DECLARE @BienSo     NVARCHAR(30);

    IF NULLIF(LTRIM(RTRIM(@SoBangLai)), N'') IS NULL
    BEGIN
        RAISERROR(N'Số bằng lái (@SoBangLai) bắt buộc.', 16, 1);
        RETURN;
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.BangLai AS bl WHERE bl.SoBangLai = @SoBangLai)
    BEGIN
        RAISERROR(
            N'Số bằng không có trong dbo.BangLai (FK). Nhập đúng SoBangLai (vd: MT001).',
            16, 1
        );
        RETURN;
    END;

    SELECT TOP 1 @BienSo = pt.BienSo
    FROM dbo.PhuongTien AS pt
    ORDER BY pt.BienSo;

    IF @BienSo IS NULL
    BEGIN
        RAISERROR(N'Chưa có dòng nào trong dbo.PhuongTien — cần ít nhất một phương tiện.', 16, 1);
        RETURN;
    END;

    SET @MaLoiInt = TRY_CAST(@MaLoi AS INT);
    IF @MaLoiInt IS NULL
    BEGIN
        RAISERROR(N'Mã lỗi (MaLoi) phải là số khớp dbo.LoiViPham.', 16, 1);
        RETURN;
    END;

    SELECT @DiemTru = ISNULL(lv.DiemTru, 1), @MucPhat = ISNULL(lv.MucPhatTien, 0)
    FROM dbo.LoiViPham AS lv
    WHERE lv.MaLoi = @MaLoiInt;

    IF @DiemTru IS NULL
    BEGIN
        RAISERROR(N'Không tìm thấy mã lỗi trong dbo.LoiViPham.', 16, 1);
        RETURN;
    END;

    SELECT @MaBienBan = ISNULL(MAX(bb.MaBienBan), 0) + 1
    FROM dbo.BienBan AS bb WITH (UPDLOCK, HOLDLOCK);

    INSERT INTO dbo.BienBan (MaBienBan, SoBangLai, BienSo, NgayViPham, DiaDiem, TrangThai, MaDonVi_XuLy)
    VALUES (@MaBienBan, @SoBangLai, @BienSo, SYSUTCDATETIME(), @NoiLap, N'ChoXuLy', NULL);

    INSERT INTO dbo.ChiTietPhat (MaBienBan, MaLoi, SoTien)
    VALUES (@MaBienBan, @MaLoiInt, @MucPhat);

    IF OBJECT_ID(N'dbo.LichSuTruDiem', N'U') IS NOT NULL
        INSERT INTO dbo.LichSuTruDiem (SoBangLai, DiemTru, NgayGhi, GhiChu)
        VALUES (@SoBangLai, @DiemTru, SYSUTCDATETIME(), N'Xử lý từ Web — phân tán');

    UPDATE d
    SET d.DiemConLai = ISNULL(d.DiemConLai, 12) - @DiemTru
    FROM LINK_NAM.CSGT_MIENNAM.dbo.BangLai_Diem AS d
    WHERE d.SoBangLai = @SoBangLai;
END
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

CREATE OR ALTER PROCEDURE dbo.usp_TruDiemBangLai
    @SoBangLai NVARCHAR(50),
    @DiemTru   INT
AS
BEGIN
    SET NOCOUNT ON;
    /* UPDATE qua LINK_NAM: cần XACT_ABORT ON, tránh lỗi 7395/7412 (OLE DB / nested transaction). */
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

/* Kiểm tra nhanh:
   EXEC dbo.usp_TraCuuPhatNguoi @BienSo = N'30A-10002';
   EXEC dbo.usp_TruDiemBangLai @SoBangLai = N'MN001', @DiemTru = 1;
   EXEC dbo.usp_DemTaiXeVuPhamTren3Lan @Nam = 2026;
*/
