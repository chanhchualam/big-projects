/*
  Báo cáo tổng hợp trên một instance (UNION ALL ba CSDL vùng).
  Chạy sau khi đã tạo 3 DB và schema.
*/
USE TrafficViolation_Coordinator;
GO

IF OBJECT_ID(N'dbo.vw_ViPham_ToanQuoc', N'V') IS NOT NULL
    DROP VIEW dbo.vw_ViPham_ToanQuoc;
GO
CREATE VIEW dbo.vw_ViPham_ToanQuoc
AS
SELECT N'B' AS MaVung, v.* FROM TrafficViolation_Bac.dbo.ViPhamGiaoThong v
UNION ALL
SELECT N'T', v.* FROM TrafficViolation_Trung.dbo.ViPhamGiaoThong v
UNION ALL
SELECT N'N', v.* FROM TrafficViolation_Nam.dbo.ViPhamGiaoThong v;
GO

IF OBJECT_ID(N'dbo.vw_PhatNguoi_ToanQuoc', N'V') IS NOT NULL
    DROP VIEW dbo.vw_PhatNguoi_ToanQuoc;
GO
CREATE VIEW dbo.vw_PhatNguoi_ToanQuoc
AS
SELECT N'B' AS MaVung, p.* FROM TrafficViolation_Bac.dbo.PhatNguoi p
UNION ALL
SELECT N'T', p.* FROM TrafficViolation_Trung.dbo.PhatNguoi p
UNION ALL
SELECT N'N', p.* FROM TrafficViolation_Nam.dbo.PhatNguoi p;
GO
