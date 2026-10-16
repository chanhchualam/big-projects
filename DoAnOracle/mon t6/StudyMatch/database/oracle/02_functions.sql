-- StudyMatch (Oracle) - Functions (PL/SQL)

-- ===== Functions from database/functions.sql =====

CREATE OR REPLACE FUNCTION F_KT_DA_DANG_KY (
    p_userid IN NUMBER
)
RETURN BOOLEAN
IS
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM Diem
    WHERE UserId = p_userid;

    RETURN (v_count > 0);
END F_KT_DA_DANG_KY;
/

CREATE OR REPLACE FUNCTION F_TINH_TI_LE_PHU_HOP (
    p_diem_hoc_sinh IN NUMBER,
    p_diem_chuan_nganh IN NUMBER
)
RETURN NUMBER
IS
    v_ti_le NUMBER;
BEGIN
    IF p_diem_chuan_nganh IS NULL OR p_diem_chuan_nganh = 0 THEN
        v_ti_le := 0;
    ELSE
        v_ti_le := ROUND((NVL(p_diem_hoc_sinh, 0) / p_diem_chuan_nganh) * 100, 2);
        IF v_ti_le > 100 THEN
            v_ti_le := 100;
        ELSIF v_ti_le < 0 THEN
            v_ti_le := 0;
        END IF;
    END IF;

    RETURN v_ti_le;
END F_TINH_TI_LE_PHU_HOP;
/

CREATE OR REPLACE FUNCTION F_XEP_HANG_NGANH (
    p_nganhid IN NUMBER
)
RETURN NUMBER
IS
    v_rank NUMBER;
BEGIN
    SELECT COUNT(*) + 1
      INTO v_rank
      FROM Nganh n1
     WHERE n1.DiemChuan > (SELECT DiemChuan FROM Nganh WHERE NganhID = p_nganhid)
       AND n1.TruongID  = (SELECT TruongID  FROM Nganh WHERE NganhID = p_nganhid);

    RETURN v_rank;
END F_XEP_HANG_NGANH;
/

CREATE OR REPLACE FUNCTION F_DEM_DANH_GIA (
    p_nganhid IN NUMBER
)
RETURN NUMBER
IS
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM DanhGia
    WHERE NganhID = p_nganhid;

    RETURN NVL(v_count, 0);
END F_DEM_DANH_GIA;
/

CREATE OR REPLACE FUNCTION F_DANH_GIA_TRUNG_BINH (
    p_nganhid IN NUMBER
)
RETURN NUMBER
IS
    v_avg NUMBER;
BEGIN
    SELECT ROUND(AVG(DiemDanhGia), 2) INTO v_avg
    FROM DanhGia
    WHERE NganhID = p_nganhid;

    RETURN NVL(v_avg, 0);
END F_DANH_GIA_TRUNG_BINH;
/

CREATE OR REPLACE FUNCTION F_KT_DIEM_HOP_LE (
    p_diem IN NUMBER
)
RETURN BOOLEAN
IS
BEGIN
    RETURN (p_diem >= 0 AND p_diem <= 10);
END F_KT_DIEM_HOP_LE;
/

CREATE OR REPLACE FUNCTION F_MO_TA_MUC_DO_PHU_HOP (
    p_ti_le IN NUMBER
)
RETURN VARCHAR2
IS
    v_mo_ta VARCHAR2(50);
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

-- ===== Functions ported from database/functions_sqlserver.sql =====

CREATE OR REPLACE FUNCTION FN_CALCULATE_WEIGHTED_SCORE(
    p_diemthi    IN NUMBER,
    p_diemthuong IN NUMBER,
    p_heso       IN NUMBER
)
RETURN NUMBER
IS
BEGIN
    RETURN NVL(p_diemthi, 0) * NVL(p_heso, 1) + NVL(p_diemthuong, 0);
END FN_CALCULATE_WEIGHTED_SCORE;
/

CREATE OR REPLACE FUNCTION FN_CHECK_STUDENT_ELIGIBILITY(
    p_userid  IN NUMBER,
    p_nganhid IN NUMBER
)
RETURN NUMBER
IS
    v_diemchuan NUMBER;
    v_khoiyeucau VARCHAR2(50);
    v_diemcaonhat NUMBER;
BEGIN
    SELECT DiemChuan, KhoiThi_YeuCau
      INTO v_diemchuan, v_khoiyeucau
      FROM Nganh
     WHERE NganhID = p_nganhid;

    SELECT MAX(d.DiemThi * d.HeSo)
      INTO v_diemcaonhat
      FROM Diem d
      JOIN MonTrongKhoiThi m ON d.MonID = m.MonID
      JOIN KhoiThi k ON m.KhoiID = k.KhoiID
     WHERE d.UserId = p_userid
       AND k.TenKhoi = v_khoiyeucau;

    IF NVL(v_diemcaonhat, 0) >= NVL(v_diemchuan, 0) THEN
        RETURN 1;
    END IF;

    RETURN 0;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN 0;
END FN_CHECK_STUDENT_ELIGIBILITY;
/

CREATE OR REPLACE FUNCTION FN_GET_STUDENT_BLOCK_SCORES(
    p_userid IN NUMBER,
    p_khoiid IN NUMBER
)
RETURN NUMBER
IS
    v_total NUMBER;
BEGIN
    SELECT NVL(SUM(d.DiemThi * d.HeSo) / NULLIF(COUNT(d.DiemID), 0), 0)
      INTO v_total
      FROM Diem d
      JOIN MonTrongKhoiThi m ON d.MonID = m.MonID
     WHERE d.UserId = p_userid
       AND m.KhoiID = p_khoiid;

    RETURN NVL(v_total, 0);
END FN_GET_STUDENT_BLOCK_SCORES;
/

CREATE OR REPLACE FUNCTION FN_COUNT_ELIGIBLE_MAJORS(
    p_userid IN NUMBER
)
RETURN NUMBER
IS
    v_count NUMBER;
BEGIN
    SELECT COUNT(DISTINCT n.NganhID)
      INTO v_count
      FROM Nganh n
      JOIN Diem d ON d.UserId = p_userid
      JOIN MonTrongKhoiThi m ON d.MonID = m.MonID
      JOIN KhoiThi k ON m.KhoiID = k.KhoiID
     WHERE k.TenKhoi = n.KhoiThi_YeuCau
       AND (d.DiemThi * d.HeSo) >= NVL(n.DiemChuan, 0);

    RETURN NVL(v_count, 0);
END FN_COUNT_ELIGIBLE_MAJORS;
/

CREATE OR REPLACE FUNCTION FN_FORMAT_MAJOR_NAME(
    p_tennganh  IN VARCHAR2,
    p_tentruong IN VARCHAR2
)
RETURN VARCHAR2
IS
BEGIN
    RETURN p_tennganh || ' - ' || p_tentruong;
END FN_FORMAT_MAJOR_NAME;
/

CREATE OR REPLACE FUNCTION FN_DAYS_UNTIL_EXAM(
    p_examdate IN DATE
)
RETURN NUMBER
IS
BEGIN
    RETURN TRUNC(p_examdate) - TRUNC(SYSDATE);
END FN_DAYS_UNTIL_EXAM;
/

CREATE OR REPLACE FUNCTION FN_CALCULATE_AVERAGE_RATING(
    p_nganhid IN NUMBER
)
RETURN NUMBER
IS
    v_avg NUMBER;
BEGIN
    SELECT AVG(DiemDanhGia) INTO v_avg
      FROM DanhGia
     WHERE NganhID = p_nganhid;

    RETURN NVL(ROUND(v_avg, 2), 0);
END FN_CALCULATE_AVERAGE_RATING;
/

PROMPT Functions created.
