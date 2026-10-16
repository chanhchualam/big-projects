/*
  Mẫu Linked Server khi ba vùng nằm trên máy chủ SQL khác nhau.
  Thay: REMOTE_SERVER, REMOTE_LOGIN, REMOTE_PASSWORD, tên DB.
  Chỉ dùng khi triển khai phân tán vật lý.

  EXEC sp_addlinkedserver @server = N'SRV_BAC', @srvproduct = N'', @provider = N'MSOLEDBSQL', @datasrc = N'10.0.0.1';
  EXEC sp_addlinkedsrvlogin @rmtsrvname = N'SRV_BAC', @useself = N'FALSE', @locallogin = NULL, @rmtuser = N'remote_login', @rmtpassword = N'***';

  Sau đó tạo view UNION ALL trỏ tới SRV_BAC.TrafficViolation_Bac.dbo.ViPhamGiaoThong ...
*/
