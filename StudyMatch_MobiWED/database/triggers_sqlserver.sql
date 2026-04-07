-- ==================== SQL SERVER TRIGGERS ====================
-- StudyMatch Database Triggers - SQL Server 2016+ Compatible

USE StudyMatch;
GO

-- ==================== TRIGGER 1: Prevent Future Score Entry ====================
IF OBJECT_ID('trg_PreventFutureScore', 'TR') IS NOT NULL
    DROP TRIGGER trg_PreventFutureScore;
GO

CREATE TRIGGER trg_PreventFutureScore
ON Diem
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (SELECT 1 FROM inserted WHERE NgayNhap > GETDATE())
    BEGIN
        RAISERROR('Cannot add score with future date', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END
GO

-- ==================== TRIGGER 2: Auto Update User Modified Time ====================
IF OBJECT_ID('trg_UpdateUserModified', 'TR') IS NOT NULL
    DROP TRIGGER trg_UpdateUserModified;
GO

-- Note: Add NgayCapNhat column to UserThi first if using this trigger
-- ALTER TABLE UserThi ADD NgayCapNhat DATETIME DEFAULT GETDATE();

CREATE TRIGGER trg_UpdateUserModified
ON UserThi
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    IF COLUMNS_UPDATED() > 0
    BEGIN
        -- Could add NgayCapNhat here if table is updated
        -- For now, just log the update
        PRINT 'User record updated: ' + CAST(GETDATE() AS VARCHAR(30));
    END
END
GO

-- ==================== TRIGGER 3: Validate Score Insert ====================
IF OBJECT_ID('trg_ValidateScoreInsert', 'TR') IS NOT NULL
    DROP TRIGGER trg_ValidateScoreInsert;
GO

CREATE TRIGGER trg_ValidateScoreInsert
ON Diem
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Check if student exists
    IF NOT EXISTS (
        SELECT 1 FROM UserThi u 
        INNER JOIN inserted i ON u.UserId = i.UserId
    )
    BEGIN
        RAISERROR('Referenced student does not exist', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
    
    -- Check if subject exists
    IF NOT EXISTS (
        SELECT 1 FROM MonTrongKhoiThi m 
        INNER JOIN inserted i ON m.MonID = i.MonID
    )
    BEGIN
        RAISERROR('Referenced subject does not exist', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END
GO

-- ==================== TRIGGER 4: Prevent Major Deletion if Used ====================
IF OBJECT_ID('trg_PreventMajorDeletion', 'TR') IS NOT NULL
    DROP TRIGGER trg_PreventMajorDeletion;
GO

CREATE TRIGGER trg_PreventMajorDeletion
ON Nganh
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @NganhID INT;
    SELECT @NganhID = NganhID FROM deleted;
    
    -- Check if major has ratings
    IF EXISTS (SELECT 1 FROM DanhGia WHERE NganhID = @NganhID)
    BEGIN
        RAISERROR('Cannot delete major that has student ratings', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
    
    -- Check if major has admission info
    IF EXISTS (SELECT 1 FROM ThongTinTuyenSinh WHERE NganhID = @NganhID)
    BEGIN
        RAISERROR('Cannot delete major that has admission information', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
    
    -- If checks pass, allow deletion
    DELETE FROM Nganh WHERE NganhID = @NganhID;
END
GO

-- ==================== TRIGGER 5: Audit Score Changes ====================
IF OBJECT_ID('trg_AuditScoreChanges', 'TR') IS NOT NULL
    DROP TRIGGER trg_AuditScoreChanges;
GO

-- First create audit table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditScoreChanges')
BEGIN
    CREATE TABLE AuditScoreChanges (
        AuditID INT PRIMARY KEY IDENTITY(1,1),
        DiemID INT,
        UserId INT,
        MonID INT,
        DiemThiOld DECIMAL(4,2),
        DiemThiNew DECIMAL(4,2),
        ChangeType VARCHAR(10), -- 'INSERT' or 'UPDATE'
        ChangedAt DATETIME DEFAULT GETDATE()
    );
END
GO

CREATE TRIGGER trg_AuditScoreChanges
ON Diem
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted)
    BEGIN
        -- UPDATE operation
        INSERT INTO AuditScoreChanges (DiemID, UserId, MonID, DiemThiOld, DiemThiNew, ChangeType)
        SELECT 
            i.DiemID,
            i.UserId,
            i.MonID,
            d.DiemThi,
            i.DiemThi,
            'UPDATE'
        FROM inserted i
        INNER JOIN deleted d ON i.DiemID = d.DiemID;
    END
    ELSE
    BEGIN
        -- INSERT operation
        INSERT INTO AuditScoreChanges (DiemID, UserId, MonID, DiemThiNew, ChangeType)
        SELECT 
            DiemID,
            UserId,
            MonID,
            DiemThi,
            'INSERT'
        FROM inserted;
    END
END
GO

-- ==================== TRIGGER 6: Validate Rating Score ====================
IF OBJECT_ID('trg_ValidateRatingScore', 'TR') IS NOT NULL
    DROP TRIGGER trg_ValidateRatingScore;
GO

CREATE TRIGGER trg_ValidateRatingScore
ON DanhGia
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (SELECT 1 FROM inserted WHERE DiemDanhGia < 1 OR DiemDanhGia > 5)
    BEGIN
        RAISERROR('Rating score must be between 1 and 5', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
    
    -- Verify major and user exist
    IF NOT EXISTS (
        SELECT 1 FROM inserted i
        INNER JOIN Nganh n ON i.NganhID = n.NganhID
        INNER JOIN UserThi u ON i.UserId = u.UserId
    )
    BEGIN
        RAISERROR('Major or User does not exist', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END
GO

-- ==================== TRIGGER 7: Auto Update Rating Date ====================
IF OBJECT_ID('trg_UpdateRatingDate', 'TR') IS NOT NULL
    DROP TRIGGER trg_UpdateRatingDate;
GO

CREATE TRIGGER trg_UpdateRatingDate
ON DanhGia
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE DanhGia
    SET NgayDanhGia = GETDATE()
    FROM DanhGia d
    INNER JOIN inserted i ON d.DanhGiaID = i.DanhGiaID
    WHERE d.NgayDanhGia < DATEADD(SECOND, -1, GETDATE());
END
GO

-- ==================== TRIGGER 8: Prevent Duplicate Teacher Assignment ====================
IF OBJECT_ID('trg_PreventDuplicateAssignment', 'TR') IS NOT NULL
    DROP TRIGGER trg_PreventDuplicateAssignment;
GO

CREATE TRIGGER trg_PreventDuplicateAssignment
ON ThongTinTuyenSinh
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (
        SELECT 1
        FROM ThongTinTuyenSinh tti
        INNER JOIN inserted i ON tti.NganhID = i.NganhID 
                              AND tti.GiaoVienID = i.GiaoVienID
                              AND tti.ThongTinID <> i.ThongTinID
    )
    BEGIN
        RAISERROR('Teacher is already assigned to this major', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END
GO

PRINT 'All triggers created successfully!';
GO
