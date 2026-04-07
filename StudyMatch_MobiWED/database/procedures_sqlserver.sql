-- ==================== SQL SERVER STORED PROCEDURES ====================
-- StudyMatch Database Procedures - SQL Server 2016+ Compatible

USE StudyMatch;
GO

-- ==================== PROCEDURE 1: Register New Student ====================
IF OBJECT_ID('sp_RegisterStudent', 'P') IS NOT NULL
    DROP PROCEDURE sp_RegisterStudent;
GO

CREATE PROCEDURE sp_RegisterStudent
    @UserName NVARCHAR(100),
    @MatKhau NVARCHAR(255),
    @HoTen NVARCHAR(150),
    @Email NVARCHAR(100),
    @LoaiUser NVARCHAR(50) = 'Student',
    @NewUserId INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Kiểm tra UserName tồn tại
        IF EXISTS (SELECT 1 FROM UserThi WHERE UserName = @UserName)
        BEGIN
            THROW 50001, 'Username already exists', 1;
        END
        
        -- Kiểm tra Email tồn tại
        IF EXISTS (SELECT 1 FROM UserThi WHERE Email = @Email)
        BEGIN
            THROW 50002, 'Email already exists', 1;
        END
        
        -- Thêm user mới
        INSERT INTO UserThi (UserName, MatKhau, HoTen, Email, LoaiUser, NgayTao)
        VALUES (@UserName, @MatKhau, @HoTen, @Email, @LoaiUser, GETDATE());
        
        SET @NewUserId = SCOPE_IDENTITY();
        
        RETURN 0; -- Success
    END TRY
    BEGIN CATCH
        SELECT 
            ERROR_NUMBER() AS ErrorNumber,
            ERROR_MESSAGE() AS ErrorMessage,
            ERROR_SEVERITY() AS ErrorSeverity;
        RETURN -1; -- Error
    END CATCH
END
GO

-- ==================== PROCEDURE 2: Add Student Score ====================
IF OBJECT_ID('sp_AddStudentScore', 'P') IS NOT NULL
    DROP PROCEDURE sp_AddStudentScore;
GO

CREATE PROCEDURE sp_AddStudentScore
    @UserId INT,
    @MonID INT,
    @DiemThi DECIMAL(4,2),
    @DiemThuong DECIMAL(4,2) = 0,
    @DiemID INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Validate scores
        IF @DiemThi < 0 OR @DiemThi > 10
        BEGIN
            THROW 50003, 'Score must be between 0 and 10', 1;
        END
        
        -- Check if user and subject exist
        IF NOT EXISTS (SELECT 1 FROM UserThi WHERE UserId = @UserId)
        BEGIN
            THROW 50004, 'User does not exist', 1;
        END
        
        IF NOT EXISTS (SELECT 1 FROM MonTrongKhoiThi WHERE MonID = @MonID)
        BEGIN
            THROW 50005, 'Subject does not exist', 1;
        END
        
        -- Get HeSo for the subject
        DECLARE @HeSo DECIMAL(3,1);
        SELECT @HeSo = HeSo FROM MonTrongKhoiThi WHERE MonID = @MonID;
        
        -- Insert score
        INSERT INTO Diem (UserId, MonID, DiemThi, DiemThuong, HeSo, NgayNhap)
        VALUES (@UserId, @MonID, @DiemThi, @DiemThuong, @HeSo, GETDATE());
        
        SET @DiemID = SCOPE_IDENTITY();
        RETURN 0; -- Success
    END TRY
    BEGIN CATCH
        SELECT 
            ERROR_NUMBER() AS ErrorNumber,
            ERROR_MESSAGE() AS ErrorMessage;
        RETURN -1; -- Error
    END CATCH
END
GO

-- ==================== PROCEDURE 3: Get Student Recommendations ====================
IF OBJECT_ID('sp_GetStudentRecommendations', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetStudentRecommendations;
GO

CREATE PROCEDURE sp_GetStudentRecommendations
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        SELECT 
            n.NganhID,
            n.TenNganh,
            n.MaNganh,
            t.TenTruong,
            t.MaTruong,
            n.DiemChuan,
            n.ChiTieuTuyen,
            MAX(d.DiemThi * d.HeSo) AS DiemCaoNhat,
            CASE 
                WHEN MAX(d.DiemThi * d.HeSo) >= n.DiemChuan THEN 'KHỐI'
                ELSE 'CHUẨN BỊ'
            END AS TrangThaiTuyen,
            ISNULL(AVG(CAST(dg.DiemDanhGia AS FLOAT)), 0) AS DiemDanhGiaTrungBinh,
            dg.NhanXet
        FROM Nganh n
        INNER JOIN TruongDH t ON n.TruongID = t.TruongID
        INNER JOIN Diem d ON 1=1
        LEFT JOIN DanhGia dg ON n.NganhID = dg.NganhID AND dg.UserId = @UserId
        WHERE d.UserId = @UserId 
          AND n.KhoiThi_YeuCau = (SELECT TOP 1 k.TenKhoi FROM KhoiThi k)
        GROUP BY n.NganhID, n.TenNganh, n.MaNganh, t.TenTruong, t.MaTruong, 
                 n.DiemChuan, n.ChiTieuTuyen, dg.NhanXet
        ORDER BY DiemCaoNhat DESC;
        
        RETURN 0; -- Success
    END TRY
    BEGIN CATCH
        SELECT 
            ERROR_NUMBER() AS ErrorNumber,
            ERROR_MESSAGE() AS ErrorMessage;
        RETURN -1; -- Error
    END CATCH
END
GO

-- ==================== PROCEDURE 4: Update Major Information ====================
IF OBJECT_ID('sp_UpdateMajorInfo', 'P') IS NOT NULL
    DROP PROCEDURE sp_UpdateMajorInfo;
GO

CREATE PROCEDURE sp_UpdateMajorInfo
    @NganhID INT,
    @TenNganh NVARCHAR(200) = NULL,
    @DiemChuan DECIMAL(5,2) = NULL,
    @ChiTieuTuyen INT = NULL,
    @MoTa NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Check if major exists
        IF NOT EXISTS (SELECT 1 FROM Nganh WHERE NganhID = @NganhID)
        BEGIN
            THROW 50006, 'Major does not exist', 1;
        END
        
        UPDATE Nganh
        SET 
            TenNganh = ISNULL(@TenNganh, TenNganh),
            DiemChuan = ISNULL(@DiemChuan, DiemChuan),
            ChiTieuTuyen = ISNULL(@ChiTieuTuyen, ChiTieuTuyen),
            MoTa = ISNULL(@MoTa, MoTa)
        WHERE NganhID = @NganhID;
        
        RETURN 0; -- Success
    END TRY
    BEGIN CATCH
        SELECT 
            ERROR_NUMBER() AS ErrorNumber,
            ERROR_MESSAGE() AS ErrorMessage;
        RETURN -1; -- Error
    END CATCH
END
GO

-- ==================== PROCEDURE 5: Get University Statistics ====================
IF OBJECT_ID('sp_GetUniversityStats', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetUniversityStats;
GO

CREATE PROCEDURE sp_GetUniversityStats
    @TruongID INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        SELECT 
            t.TruongID,
            t.TenTruong,
            t.MaTruong,
            t.DiaChi,
            COUNT(DISTINCT n.NganhID) AS SoNghanh,
            AVG(n.DiemChuan) AS DiemChuanTrungBinh,
            SUM(n.ChiTieuTuyen) AS TongChiTieu,
            COUNT(DISTINCT dg.UserId) AS SoSinhVienDanhGia,
            ISNULL(AVG(CAST(dg.DiemDanhGia AS FLOAT)), 0) AS DiemDanhGiaTrungBinh
        FROM TruongDH t
        LEFT JOIN Nganh n ON t.TruongID = n.TruongID
        LEFT JOIN DanhGia dg ON n.NganhID = dg.NganhID
        WHERE @TruongID IS NULL OR t.TruongID = @TruongID
        GROUP BY t.TruongID, t.TenTruong, t.MaTruong, t.DiaChi
        ORDER BY t.TenTruong;
        
        RETURN 0; -- Success
    END TRY
    BEGIN CATCH
        SELECT 
            ERROR_NUMBER() AS ErrorNumber,
            ERROR_MESSAGE() AS ErrorMessage;
        RETURN -1; -- Error
    END CATCH
END
GO

PRINT 'All stored procedures created successfully!';
GO
