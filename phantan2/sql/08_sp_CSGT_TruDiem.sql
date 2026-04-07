/*
  Xử lý vi phạm chỉ cần số bằng (+ mã lỗi, nơi lập). Biển số (BienSo) lấy tự động:
  TOP 1 từ dbo.PhuongTien để thỏa FK BienBan -> PhuongTien khi form không nhập biển.

  LichSuTruDiem: chỉ INSERT nếu bảng tồn tại (tránh lỗi 208 khi DB chưa tạo bảng).

  Chạy trên CSGT_MIENTRUNG. Chỉnh INSERT ChiTietPhat nếu thêm cột NOT NULL.
*/
USE CSGT_MIENTRUNG;
GO

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

    /* Một biển số bất kỳ trong PhuongTien — để thỏa FK khi người dùng không nhập biển */
    SELECT TOP 1 @BienSo = pt.BienSo
    FROM dbo.PhuongTien AS pt
    ORDER BY pt.BienSo;

    IF @BienSo IS NULL
    BEGIN
        RAISERROR(N'Chưa có phương tiện nào trong dbo.PhuongTien — cần ít nhất một dòng để gắn biên bản.', 16, 1);
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
