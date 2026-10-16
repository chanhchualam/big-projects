/*
  CSDL điều phối: ánh xạ biển số / mã tỉnh → vùng (Bắc–Trung–Nam),
  tra cứu nhanh khi route truy vấn tới shard đúng.
*/
USE TrafficViolation_Coordinator;
GO

IF OBJECT_ID(N'dbo.Vung', N'U') IS NULL
CREATE TABLE dbo.Vung (
    MaVung       CHAR(1)       NOT NULL PRIMARY KEY, -- B, T, N
    TenVung      NVARCHAR(40) NOT NULL,
    DatabaseName SYSNAME      NOT NULL -- TrafficViolation_Bac / _Trung / _Nam
);

IF OBJECT_ID(N'dbo.DauBienSoToVung', N'U') IS NULL
CREATE TABLE dbo.DauBienSoToVung (
    DauBienSo    VARCHAR(5)   NOT NULL PRIMARY KEY, -- VD: 29, 99, 51...
    MaVung       CHAR(1)      NOT NULL REFERENCES dbo.Vung(MaVung)
);

IF OBJECT_ID(N'dbo.MaTinhToVung', N'U') IS NULL
CREATE TABLE dbo.MaTinhToVung (
    MaTinh       VARCHAR(10)  NOT NULL PRIMARY KEY,
    MaVung       CHAR(1)      NOT NULL REFERENCES dbo.Vung(MaVung)
);

-- Gợi ý dữ liệu mẫu (điều chỉnh theo quy tắc thực tế của Bộ Công an)
IF NOT EXISTS (SELECT 1 FROM dbo.Vung)
INSERT INTO dbo.Vung (MaVung, TenVung, DatabaseName) VALUES
(N'B', N'Miền Bắc', N'TrafficViolation_Bac'),
(N'T', N'Miền Trung', N'TrafficViolation_Trung'),
(N'N', N'Miền Nam', N'TrafficViolation_Nam');

-- Ví dụ: đầu biển → vùng (cần cập nhật đầy đủ theo danh mục thật)
IF NOT EXISTS (SELECT 1 FROM dbo.DauBienSoToVung)
INSERT INTO dbo.DauBienSoToVung (DauBienSo, MaVung) VALUES
(N'11', N'B'), (N'12', N'B'), (N'14', N'B'), (N'15', N'B'), (N'16', N'B'),
(N'17', N'B'), (N'18', N'B'), (N'19', N'B'), (N'20', N'B'), (N'22', N'B'),
(N'29', N'B'), (N'33', N'B'), (N'34', N'B'), (N'35', N'B'), (N'36', N'B'),
(N'37', N'B'), (N'38', N'B'), (N'43', N'T'), (N'44', N'T'), (N'45', N'T'),
(N'46', N'T'), (N'47', N'T'), (N'48', N'T'), (N'49', N'T'), (N'50', N'N'),
(N'51', N'N'), (N'52', N'N'), (N'53', N'N'), (N'54', N'N'), (N'55', N'N'),
(N'56', N'N'), (N'57', N'N'), (N'58', N'N'), (N'59', N'N'), (N'60', N'N'),
(N'61', N'N'), (N'62', N'N'), (N'63', N'N'), (N'64', N'N'), (N'65', N'N'),
(N'66', N'N'), (N'67', N'N'), (N'68', N'N'), (N'69', N'N'), (N'70', N'N'),
(N'71', N'N'), (N'72', N'N'), (N'73', N'N'), (N'74', N'N'), (N'75', N'N'),
(N'76', N'N'), (N'77', N'N'), (N'78', N'N'), (N'79', N'N'), (N'80', N'N'),
(N'81', N'N'), (N'82', N'N'), (N'83', N'N'), (N'84', N'N'), (N'85', N'N'),
(N'86', N'N'), (N'88', N'N'), (N'89', N'N'), (N'90', N'N'), (N'92', N'N'),
(N'93', N'N'), (N'94', N'N'), (N'95', N'N'), (N'97', N'N'), (N'98', N'N'), (N'99', N'B');

GO

IF OBJECT_ID(N'dbo.fn_LayVungTheoDauBien', N'FN') IS NOT NULL
    DROP FUNCTION dbo.fn_LayVungTheoDauBien;
GO
CREATE FUNCTION dbo.fn_LayVungTheoDauBien (@BienSo VARCHAR(20))
RETURNS CHAR(1)
AS
BEGIN
    DECLARE @seg VARCHAR(20), @dau VARCHAR(5), @i INT, @c NCHAR(1);
    SET @BienSo = LTRIM(RTRIM(@BienSo));
    IF @BienSo IS NULL OR LEN(@BienSo) < 2 RETURN NULL;

    SET @seg = LEFT(@BienSo, CASE WHEN CHARINDEX(N'-', @BienSo) > 0
        THEN CHARINDEX(N'-', @BienSo) - 1 ELSE LEN(@BienSo) END);

    SET @dau = N'';
    SET @i = 1;
    WHILE @i <= LEN(@seg)
    BEGIN
        SET @c = SUBSTRING(@seg, @i, 1);
        IF @c LIKE N'[0-9]'
            SET @dau = @dau + @c;
        ELSE
            BREAK;
        IF LEN(@dau) >= 2 BREAK;
        SET @i = @i + 1;
    END;

    IF LEN(@dau) < 2 RETURN NULL;

    DECLARE @v CHAR(1);
    SELECT @v = MaVung FROM dbo.DauBienSoToVung WHERE DauBienSo = @dau;
    RETURN @v;
END
GO
