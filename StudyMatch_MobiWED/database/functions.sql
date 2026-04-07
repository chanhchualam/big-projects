-- ==================== FUNCTIONS ====================

-- Function: Kiểm tra xem học sinh đã đăng ký hay chưa
CREATE OR REPLACE FUNCTION F_KT_DA_DANG_KY (
    p_userid IN INTEGER
)
RETURN BOOLEAN
IS
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM Diem
    WHERE UserId = p_userid;
    
    RETURN (v_count > 0);
END F_KT_DA_DANG_KY;
/

-- Function: Tính tỷ lệ phù hợp với ngành
CREATE OR REPLACE FUNCTION F_TINH_TI_LE_PHU_HOP (
    p_diem_hoc_sinh IN DECIMAL,
    p_diem_chuan_nganh IN DECIMAL
)
RETURN DECIMAL
IS
    v_ti_le DECIMAL;
BEGIN
    IF p_diem_chuan_nganh = 0 OR p_diem_chuan_nganh IS NULL THEN
        v_ti_le := 0;
    ELSE
        v_ti_le := ROUND((p_diem_hoc_sinh / p_diem_chuan_nganh) * 100, 2);
        
        -- Giới hạn trong khoảng 0-100
        IF v_ti_le > 100 THEN
            v_ti_le := 100;
        ELSIF v_ti_le < 0 THEN
            v_ti_le := 0;
        END IF;
    END IF;
    
    RETURN v_ti_le;
END F_TINH_TI_LE_PHU_HOP;
/

-- Function: Lấy xếp hạng ngành
CREATE OR REPLACE FUNCTION F_XEP_HANG_NGANH (
    p_nganhid IN INTEGER
)
RETURN INTEGER
IS
    v_rank INTEGER;
BEGIN
    SELECT COUNT(*) + 1
    INTO v_rank
    FROM Nganh n1
    WHERE n1.DiemChuan > (SELECT DiemChuan FROM Nganh WHERE NganhID = p_nganhid)
    AND n1.TruongID = (SELECT TruongID FROM Nganh WHERE NganhID = p_nganhid);
    
    RETURN v_rank;
END F_XEP_HANG_NGANH;
/

-- Function: Tính số lượng người đã đánh giá ngành
CREATE OR REPLACE FUNCTION F_DEM_DANH_GIA (
    p_nganhid IN INTEGER
)
RETURN INTEGER
IS
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM DanhGia
    WHERE NganhID = p_nganhid;
    
    RETURN NVL(v_count, 0);
END F_DEM_DANH_GIA;
/

-- Function: Lấy điểm đánh giá trung bình
CREATE OR REPLACE FUNCTION F_DANH_GIA_TRUNG_BINH (
    p_nganhid IN INTEGER
)
RETURN DECIMAL
IS
    v_avg DECIMAL;
BEGIN
    SELECT ROUND(AVG(DiemDanhGia), 2)
    INTO v_avg
    FROM DanhGia
    WHERE NganhID = p_nganhid;
    
    RETURN NVL(v_avg, 0);
END F_DANH_GIA_TRUNG_BINH;
/

-- Function: Kiểm tra điểm hợp lệ
CREATE OR REPLACE FUNCTION F_KT_DIEM_HOP_LE (
    p_diem IN DECIMAL
)
RETURN BOOLEAN
IS
BEGIN
    RETURN (p_diem >= 0 AND p_diem <= 10);
END F_KT_DIEM_HOP_LE;
/

-- Function: Lấy mô tả mức độ phù hợp
CREATE OR REPLACE FUNCTION F_MO_TA_MUC_DO_PHU_HOP (
    p_ti_le IN DECIMAL
)
RETURN VARCHAR
IS
    v_mo_ta VARCHAR(50);
BEGIN
    CASE
        WHEN p_ti_le >= 90 THEN v_mo_ta := 'Rất Phù Hợp';
        WHEN p_ti_le >= 80 THEN v_mo_ta := 'Phù Hợp';
        WHEN p_ti_le >= 70 THEN v_mo_ta := 'Khá Phù Hợp';
        WHEN p_ti_le >= 60 THEN v_mo_ta := 'Bình Thường';
        ELSE v_mo_ta := 'Ít Phù Hợp';
    END CASE;
    
    RETURN v_mo_ta;
END F_MO_TA_MUC_DO_PHU_HOP;
/
