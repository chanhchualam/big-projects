-- ==================== PROCEDURES ====================

-- Procedure: Tính điểm trung bình cho học sinh
CREATE OR REPLACE PROCEDURE P_TINH_DIEM_TRUNG_BINH (
    p_userid IN INTEGER,
    p_diem_tb OUT DECIMAL
)
IS
BEGIN
    SELECT ROUND(AVG(DiemThi), 2)
    INTO p_diem_tb
    FROM Diem
    WHERE UserId = p_userid;
    
    IF p_diem_tb IS NULL THEN
        p_diem_tb := 0;
    END IF;
END P_TINH_DIEM_TRUNG_BINH;
/

-- Procedure: Đề xuất ngành học dựa trên điểm
CREATE OR REPLACE PROCEDURE P_DE_XUAT_NGANH (
    p_userid IN INTEGER,
    p_cursor OUT SYS_REFCURSOR
)
IS
    v_diem_tb DECIMAL;
BEGIN
    -- Tính điểm trung bình
    SELECT ROUND(AVG(d.DiemThi), 2)
    INTO v_diem_tb
    FROM Diem d
    WHERE d.UserId = p_userid;
    
    -- Nếu chưa có điểm
    IF v_diem_tb IS NULL THEN
        v_diem_tb := 0;
    END IF;
    
    -- Lấy danh sách ngành phù hợp
    OPEN p_cursor FOR
    SELECT 
        n.NganhID,
        n.TenNganh,
        t.TenTruong,
        n.DiemChuan,
        ROUND((v_diem_tb / DECODE(n.DiemChuan, 0, 1, n.DiemChuan)) * 100, 2) AS TiLePhuHop,
        n.KhoiThi_YeuCau,
        n.ChiTieuTuyen
    FROM Nganh n
    LEFT JOIN TruongDH t ON n.TruongID = t.TruongID
    WHERE n.DiemChuan IS NOT NULL
        AND (v_diem_tb / DECODE(n.DiemChuan, 0, 1, n.DiemChuan)) * 100 >= 50
    ORDER BY TiLePhuHop DESC;
END P_DE_XUAT_NGANH;
/

-- Procedure: Cập nhật kết quả dự đoán
CREATE OR REPLACE PROCEDURE P_CAP_NHAT_KET_QUA (
    p_userid IN INTEGER
)
IS
    v_diem_tb DECIMAL;
    v_ketquaid INTEGER;
    CURSOR cur_nganh IS
        SELECT NganhID, DiemChuan
        FROM Nganh
        WHERE DiemChuan IS NOT NULL;
BEGIN
    -- Tính điểm trung bình
    SELECT ROUND(AVG(DiemThi), 2)
    INTO v_diem_tb
    FROM Diem
    WHERE UserId = p_userid;
    
    -- Xóa kết quả cũ
    DELETE FROM KetQuaDuDoan WHERE UserId = p_userid;
    
    -- Thêm kết quả mới
    FOR rec IN cur_nganh LOOP
        v_ketquaid := seq_ketquaid.NEXTVAL;
        
        IF rec.DiemChuan > 0 THEN
            INSERT INTO KetQuaDuDoan 
            VALUES (
                v_ketquaid,
                p_userid,
                rec.NganhID,
                v_diem_tb,
                ROUND((v_diem_tb / rec.DiemChuan) * 100, 2),
                SYSDATE
            );
        END IF;
    END LOOP;
    
    COMMIT;
END P_CAP_NHAT_KET_QUA;
/

-- Procedure: Lấy thống kê học sinh
CREATE OR REPLACE PROCEDURE P_THONG_KE_HOC_SINH (
    p_userid IN INTEGER,
    p_so_mon OUT INTEGER,
    p_diem_tb OUT DECIMAL,
    p_diem_cao OUT DECIMAL,
    p_diem_thap OUT DECIMAL
)
IS
BEGIN
    SELECT 
        COUNT(*),
        ROUND(AVG(DiemThi), 2),
        MAX(DiemThi),
        MIN(DiemThi)
    INTO p_so_mon, p_diem_tb, p_diem_cao, p_diem_thap
    FROM Diem
    WHERE UserId = p_userid;
    
    IF p_so_mon IS NULL THEN
        p_so_mon := 0;
        p_diem_tb := 0;
        p_diem_cao := 0;
        p_diem_thap := 0;
    END IF;
END P_THONG_KE_HOC_SINH;
/

-- Procedure: Xóa dữ liệu cũ
CREATE OR REPLACE PROCEDURE P_XOA_DU_LIEU_CU (
    p_so_ngay_truoc IN INTEGER DEFAULT 365
)
IS
    v_ngay_cat OFF TIMESTAMP;
BEGIN
    v_ngay_cat := SYSDATE - p_so_ngay_truoc;
    
    DELETE FROM KetQuaDuDoan 
    WHERE NgayTinhToan < v_ngay_cat;
    
    DELETE FROM DanhGia 
    WHERE NgayDanhGia < v_ngay_cat;
    
    COMMIT;
END P_XOA_DU_LIEU_CU;
/
