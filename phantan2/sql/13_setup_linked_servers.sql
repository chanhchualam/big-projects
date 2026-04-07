/*
  Thiết lập Linked Server giữa ba instance (chỉnh SERVER / DATABASE cho đúng máy).
  Chạy từng khối trên đúng instance (thường database master).

  Msg 15028 "The server 'LINK_xxx' already exists" = linked server đã có — bỏ qua hoặc
  xóa rồi tạo lại:
    EXEC sp_dropserver @server = N'LINK_NAM', @droplogins = 'droplogins';

  Khối dưới dùng IF NOT EXISTS để chạy lại script không lỗi.

  Windows auth (self mapping) — nếu cần login riêng: sp_addlinkedsrvlogin.

  --- Trên instance MIỀN TRUNG (máy Web, CSGT_MIENTRUNG) ---
  Cần: LINK_BAC -> CSGT_MIENBAC, LINK_NAM -> CSGT_MIENNAM
*/

USE master;
GO

/* Đổi LAPTOP-96O50AKP\TEST1, TEST2 cho đúng instance Bắc / Nam */
IF NOT EXISTS (SELECT 1 FROM sys.servers WHERE name = N'LINK_BAC')
BEGIN
    EXEC sp_addlinkedserver
        @server = N'LINK_BAC',
        @srvproduct = N'',
        @provider = N'MSOLEDBSQL',
        @datasrc = N'LAPTOP-96O50AKP\TEST1';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.servers WHERE name = N'LINK_NAM')
BEGIN
    EXEC sp_addlinkedserver
        @server = N'LINK_NAM',
        @srvproduct = N'',
        @provider = N'MSOLEDBSQL',
        @datasrc = N'LAPTOP-96O50AKP\TEST2';
END
GO

/*
  --- Trên instance MIỀN BẮC (CSGT_MIENBAC) ---
  Cần: LINK_TRUNG -> MIENTRUNG, LINK_NAM -> MIENNAM

IF NOT EXISTS (SELECT 1 FROM sys.servers WHERE name = N'LINK_TRUNG')
    EXEC sp_addlinkedserver @server=N'LINK_TRUNG', @srvproduct=N'', @provider=N'MSOLEDBSQL', @datasrc=N'LAPTOP-96O50AKP';
IF NOT EXISTS (SELECT 1 FROM sys.servers WHERE name = N'LINK_NAM')
    EXEC sp_addlinkedserver @server=N'LINK_NAM', @srvproduct=N'', @provider=N'MSOLEDBSQL', @datasrc=N'LAPTOP-96O50AKP\TEST2';

  --- Trên instance MIỀN NAM (CSGT_MIENNAM) — trigger câu 6 ---
  Cần: LINK_TRUNG, LINK_BAC

IF NOT EXISTS (SELECT 1 FROM sys.servers WHERE name = N'LINK_TRUNG')
    EXEC sp_addlinkedserver @server=N'LINK_TRUNG', @srvproduct=N'', @provider=N'MSOLEDBSQL', @datasrc=N'LAPTOP-96O50AKP';
IF NOT EXISTS (SELECT 1 FROM sys.servers WHERE name = N'LINK_BAC')
    EXEC sp_addlinkedserver @server=N'LINK_BAC', @srvproduct=N'', @provider=N'MSOLEDBSQL', @datasrc=N'LAPTOP-96O50AKP\TEST1';
*/
