-- ==================== SQL SERVER FUNCTIONS ====================
-- StudyMatch Database Functions - SQL Server 2016+ Compatible

USE StudyMatch;
GO

-- ==================== FUNCTION 1: Calculate Weighted Score ====================
IF OBJECT_ID('fn_CalculateWeightedScore', 'FN') IS NOT NULL
    DROP FUNCTION fn_CalculateWeightedScore;
GO

CREATE FUNCTION fn_CalculateWeightedScore
(
    @DiemThi DECIMAL(4,2),
    @DiemThuong DECIMAL(4,2),
    @HeSo DECIMAL(3,1)
)
RETURNS DECIMAL(5,2)
AS
BEGIN
    DECLARE @Result DECIMAL(5,2);
    SET @Result = ISNULL(@DiemThi, 0) * @HeSo + ISNULL(@DiemThuong, 0);
    RETURN @Result;
END
GO

-- ==================== FUNCTION 2: Check Student Eligibility ====================
IF OBJECT_ID('fn_CheckStudentEligibility', 'FN') IS NOT NULL
    DROP FUNCTION fn_CheckStudentEligibility;
GO

CREATE FUNCTION fn_CheckStudentEligibility
(
    @UserId INT,
    @NganhID INT
)
RETURNS INT
AS
BEGIN
    DECLARE @DiemChuanNganh DECIMAL(5,2);
    DECLARE @DiemCaoNhatHocSinh DECIMAL(5,2);
    DECLARE @KhoiYeuCau VARCHAR(50);
    DECLARE @Result INT = 0;
    
    -- Get major requirements
    SELECT @DiemChuanNganh = DiemChuan, @KhoiYeuCau = KhoiThi_YeuCau
    FROM Nganh
    WHERE NganhID = @NganhID;
    
    -- Get student's highest score in the required block
    SELECT @DiemCaoNhatHocSinh = MAX(d.DiemThi * d.HeSo)
    FROM Diem d
    INNER JOIN MonTrongKhoiThi m ON d.MonID = m.MonID
    INNER JOIN KhoiThi k ON m.KhoiID = k.KhoiID
    WHERE d.UserId = @UserId AND k.TenKhoi = @KhoiYeuCau;
    
    -- Return 1 if eligible, 0 if not
    IF ISNULL(@DiemCaoNhatHocSinh, 0) >= @DiemChuanNganh
        SET @Result = 1;
    ELSE
        SET @Result = 0;
    
    RETURN @Result;
END
GO

-- ==================== FUNCTION 3: Get Student Block Scores ====================
IF OBJECT_ID('fn_GetStudentBlockScores', 'FN') IS NOT NULL
    DROP FUNCTION fn_GetStudentBlockScores;
GO

CREATE FUNCTION fn_GetStudentBlockScores
(
    @UserId INT,
    @KhoiID INT
)
RETURNS DECIMAL(5,2)
AS
BEGIN
    DECLARE @TotalScore DECIMAL(5,2);
    
    SELECT @TotalScore = SUM(d.DiemThi * d.HeSo) / COUNT(d.DiemID)
    FROM Diem d
    INNER JOIN MonTrongKhoiThi m ON d.MonID = m.MonID
    WHERE d.UserId = @UserId AND m.KhoiID = @KhoiID;
    
    RETURN ISNULL(@TotalScore, 0);
END
GO

-- ==================== FUNCTION 4: Count Student Eligible Majors ====================
IF OBJECT_ID('fn_CountEligibleMajors', 'FN') IS NOT NULL
    DROP FUNCTION fn_CountEligibleMajors;
GO

CREATE FUNCTION fn_CountEligibleMajors
(
    @UserId INT
)
RETURNS INT
AS
BEGIN
    DECLARE @Count INT = 0;
    
    SELECT @Count = COUNT(DISTINCT n.NganhID)
    FROM Nganh n
    INNER JOIN Diem d ON 1=1
    INNER JOIN MonTrongKhoiThi m ON d.MonID = m.MonID
    INNER JOIN KhoiThi k ON m.KhoiID = k.KhoiID
    WHERE d.UserId = @UserId 
      AND k.TenKhoi = n.KhoiThi_YeuCau
      AND (d.DiemThi * d.HeSo) >= n.DiemChuan;
    
    RETURN ISNULL(@Count, 0);
END
GO

-- ==================== FUNCTION 5: Format Major Name ====================
IF OBJECT_ID('fn_FormatMajorName', 'FN') IS NOT NULL
    DROP FUNCTION fn_FormatMajorName;
GO

CREATE FUNCTION fn_FormatMajorName
(
    @TenNganh NVARCHAR(200),
    @TenTruong NVARCHAR(200)
)
RETURNS NVARCHAR(500)
AS
BEGIN
    DECLARE @Result NVARCHAR(500);
    SET @Result = @TenNganh + ' - ' + @TenTruong;
    RETURN @Result;
END
GO

-- ==================== FUNCTION 6: Get Days Until Exam ====================
IF OBJECT_ID('fn_DaysUntilExam', 'FN') IS NOT NULL
    DROP FUNCTION fn_DaysUntilExam;
GO

CREATE FUNCTION fn_DaysUntilExam
(
    @ExamDate DATETIME
)
RETURNS INT
AS
BEGIN
    DECLARE @Days INT;
    SET @Days = DATEDIFF(DAY, GETDATE(), @ExamDate);
    RETURN @Days;
END
GO

-- ==================== FUNCTION 7: Calculate Average Rating ====================
IF OBJECT_ID('fn_CalculateAverageRating', 'FN') IS NOT NULL
    DROP FUNCTION fn_CalculateAverageRating;
GO

CREATE FUNCTION fn_CalculateAverageRating
(
    @NganhID INT
)
RETURNS DECIMAL(3,2)
AS
BEGIN
    DECLARE @Average DECIMAL(3,2);
    
    SELECT @Average = AVG(CAST(DiemDanhGia AS DECIMAL(5,2)))
    FROM DanhGia
    WHERE NganhID = @NganhID;
    
    RETURN ISNULL(@Average, 0);
END
GO

PRINT 'All functions created successfully!';
GO
