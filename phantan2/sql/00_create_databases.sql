/*
  Hệ thống: Quản lý vi phạm giao thông & phạt nguội — CSDL phân tán theo vùng
  Chạy trên SQL Server (SSMS). Điều chỉnh đường dẫn filegroup nếu cần.
*/
USE master;
GO

IF DB_ID(N'TrafficViolation_Bac') IS NULL
    CREATE DATABASE TrafficViolation_Bac;
GO
IF DB_ID(N'TrafficViolation_Trung') IS NULL
    CREATE DATABASE TrafficViolation_Trung;
GO
IF DB_ID(N'TrafficViolation_Nam') IS NULL
    CREATE DATABASE TrafficViolation_Nam;
GO
IF DB_ID(N'TrafficViolation_Coordinator') IS NULL
    CREATE DATABASE TrafficViolation_Coordinator;
GO
