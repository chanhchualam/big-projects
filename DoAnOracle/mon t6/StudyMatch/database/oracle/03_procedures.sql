-- StudyMatch (Oracle) - Procedures (PL/SQL)

-- ===== Procedures from database/procedures.sql (fixed for Oracle) =====

CREATE OR REPLACE PROCEDURE P_TINH_DIEM_TRUNG_BINH (
    p_userid IN NUMBER,
    p_diem_tb OUT NUMBER
)
IS
BEGIN
    SELECT ROUND(AVG(DiemThi), 2)
      INTO p_diem_tb
      FROM Diem
     WHERE UserId = p_userid;

    p_diem_tb := NVL(p_diem_tb, 0);
END P_TINH_DIEM_TRUNG_BINH;
/

CREATE OR REPLACE PROCEDURE P_DE_XUAT_NGANH (
    p_userid IN NUMBER,
    p_cursor OUT SYS_REFCURSOR
)
IS
    v_diem_tb NUMBER;
BEGIN
    SELECT ROUND(AVG(d.DiemThi), 2)
      INTO v_diem_tb
      FROM Diem d
     WHERE d.UserId = p_userid;

    v_diem_tb := NVL(v_diem_tb, 0);

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

CREATE OR REPLACE PROCEDURE P_CAP_NHAT_KET_QUA (
    p_userid IN NUMBER
)
IS
    v_diem_tb NUMBER;
BEGIN
    SELECT ROUND(AVG(DiemThi), 2)
      INTO v_diem_tb
      FROM Diem
     WHERE UserId = p_userid;

    v_diem_tb := NVL(v_diem_tb, 0);

    DELETE FROM KetQuaDuDoan WHERE UserId = p_userid;

    INSERT INTO KetQuaDuDoan (KetQuaID, UserId, NganhID, DiemTrungBinh, TiLePhuHop, NgayTinhToan)
    SELECT
        seq_ketquaid.NEXTVAL,
        p_userid,
        n.NganhID,
        v_diem_tb,
        ROUND((v_diem_tb / DECODE(n.DiemChuan, 0, 1, n.DiemChuan)) * 100, 2),
        SYSTIMESTAMP
    FROM Nganh n
    WHERE n.DiemChuan IS NOT NULL
      AND n.DiemChuan > 0;
END P_CAP_NHAT_KET_QUA;
/

CREATE OR REPLACE PROCEDURE P_THONG_KE_HOC_SINH (
    p_userid IN NUMBER,
    p_so_mon OUT NUMBER,
    p_diem_tb OUT NUMBER,
    p_diem_cao OUT NUMBER,
    p_diem_thap OUT NUMBER
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

    p_so_mon  := NVL(p_so_mon, 0);
    p_diem_tb := NVL(p_diem_tb, 0);
    p_diem_cao := NVL(p_diem_cao, 0);
    p_diem_thap := NVL(p_diem_thap, 0);
END P_THONG_KE_HOC_SINH;
/

CREATE OR REPLACE PROCEDURE P_XOA_DU_LIEU_CU (
    p_so_ngay_truoc IN NUMBER DEFAULT 365
)
IS
    v_ngay_cat TIMESTAMP;
BEGIN
    v_ngay_cat := SYSTIMESTAMP - NUMTODSINTERVAL(p_so_ngay_truoc, 'DAY');

    DELETE FROM KetQuaDuDoan
     WHERE NgayTinhToan < v_ngay_cat;

    DELETE FROM DanhGia
     WHERE NgayDanhGia < v_ngay_cat;
END P_XOA_DU_LIEU_CU;
/

-- ===== Procedures ported from database/procedures_sqlserver.sql =====

CREATE OR REPLACE PROCEDURE SP_REGISTER_STUDENT(
    p_username IN VARCHAR2,
    p_matkhau  IN VARCHAR2,
    p_hoten    IN VARCHAR2,
    p_email    IN VARCHAR2,
    p_loaiuser IN VARCHAR2 DEFAULT 'Student',
    p_newuserid OUT NUMBER
)
IS
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM UserThi WHERE UserName = p_username;
    IF v_count > 0 THEN
        RAISE_APPLICATION_ERROR(-20011, 'Username already exists');
    END IF;

    SELECT COUNT(*) INTO v_count FROM UserThi WHERE Email = p_email;
    IF v_count > 0 THEN
        RAISE_APPLICATION_ERROR(-20012, 'Email already exists');
    END IF;

    INSERT INTO UserThi (UserId, UserName, MatKhau, HoTen, Email, LoaiUser, NgayTao)
    VALUES (NULL, p_username, p_matkhau, p_hoten, p_email, p_loaiuser, SYSTIMESTAMP)
    RETURNING UserId INTO p_newuserid;
END SP_REGISTER_STUDENT;
/

CREATE OR REPLACE PROCEDURE SP_ADD_STUDENT_SCORE(
    p_userid IN NUMBER,
    p_monid  IN NUMBER,
    p_diemthi IN NUMBER,
    p_diemthuong IN NUMBER DEFAULT 0,
    p_diemid OUT NUMBER
)
IS
    v_exists NUMBER;
    v_heso NUMBER;
BEGIN
    IF p_diemthi < 0 OR p_diemthi > 10 THEN
        RAISE_APPLICATION_ERROR(-20013, 'Score must be between 0 and 10');
    END IF;

    SELECT COUNT(*) INTO v_exists FROM UserThi WHERE UserId = p_userid;
    IF v_exists = 0 THEN
        RAISE_APPLICATION_ERROR(-20014, 'User does not exist');
    END IF;

    SELECT COUNT(*) INTO v_exists FROM MonTrongKhoiThi WHERE MonID = p_monid;
    IF v_exists = 0 THEN
        RAISE_APPLICATION_ERROR(-20015, 'Subject does not exist');
    END IF;

    SELECT HeSo INTO v_heso FROM MonTrongKhoiThi WHERE MonID = p_monid;

    INSERT INTO Diem (DiemID, UserId, MonID, DiemThi, DiemThuong, HeSo, NgayNhap)
    VALUES (NULL, p_userid, p_monid, p_diemthi, p_diemthuong, v_heso, SYSTIMESTAMP)
    RETURNING DiemID INTO p_diemid;
END SP_ADD_STUDENT_SCORE;
/

CREATE OR REPLACE PROCEDURE SP_GET_STUDENT_RECOMMENDATIONS(
    p_userid IN NUMBER,
    p_cursor OUT SYS_REFCURSOR
)
IS
BEGIN
    OPEN p_cursor FOR
        SELECT
            n.NganhID,
            n.TenNganh,
            n.MaNganh,
            t.TenTruong,
            t.MaTruong,
            n.DiemChuan,
            n.ChiTieuTuyen,
            MAX(d.DiemThi * d.HeSo) AS DiemCaoNhat,
            CASE
                WHEN MAX(d.DiemThi * d.HeSo) >= NVL(n.DiemChuan, 0) THEN 'DU_TIEU_CHI'
                ELSE 'CAN_CO_GANG'
            END AS TrangThaiTuyen,
            NVL(ROUND(AVG(dg.DiemDanhGia), 2), 0) AS DiemDanhGiaTrungBinh,
            MAX(dg.NhanXet) AS NhanXet
        FROM Nganh n
        JOIN TruongDH t ON n.TruongID = t.TruongID
        JOIN Diem d ON d.UserId = p_userid
        JOIN MonTrongKhoiThi m ON d.MonID = m.MonID
        JOIN KhoiThi k ON m.KhoiID = k.KhoiID
        LEFT JOIN DanhGia dg ON n.NganhID = dg.NganhID AND dg.UserId = p_userid
        WHERE k.TenKhoi = n.KhoiThi_YeuCau
        GROUP BY
            n.NganhID, n.TenNganh, n.MaNganh,
            t.TenTruong, t.MaTruong,
            n.DiemChuan, n.ChiTieuTuyen
        ORDER BY DiemCaoNhat DESC;
END SP_GET_STUDENT_RECOMMENDATIONS;
/

CREATE OR REPLACE PROCEDURE SP_UPDATE_MAJOR_INFO(
    p_nganhid IN NUMBER,
    p_tennganh IN VARCHAR2 DEFAULT NULL,
    p_diemchuan IN NUMBER DEFAULT NULL,
    p_chitieutuyen IN NUMBER DEFAULT NULL,
    p_mota IN VARCHAR2 DEFAULT NULL
)
IS
    v_exists NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_exists FROM Nganh WHERE NganhID = p_nganhid;
    IF v_exists = 0 THEN
        RAISE_APPLICATION_ERROR(-20016, 'Major does not exist');
    END IF;

    UPDATE Nganh
       SET TenNganh = COALESCE(p_tennganh, TenNganh),
           DiemChuan = COALESCE(p_diemchuan, DiemChuan),
           ChiTieuTuyen = COALESCE(p_chitieutuyen, ChiTieuTuyen),
           MoTa = COALESCE(p_mota, MoTa)
     WHERE NganhID = p_nganhid;
END SP_UPDATE_MAJOR_INFO;
/

CREATE OR REPLACE PROCEDURE SP_GET_UNIVERSITY_STATS(
    p_truongid IN NUMBER DEFAULT NULL,
    p_cursor OUT SYS_REFCURSOR
)
IS
BEGIN
    OPEN p_cursor FOR
        SELECT
            t.TruongID,
            t.TenTruong,
            t.MaTruong,
            t.DiaChi,
            COUNT(DISTINCT n.NganhID) AS SoNganh,
            ROUND(AVG(n.DiemChuan), 2) AS DiemChuanTrungBinh,
            SUM(n.ChiTieuTuyen) AS TongChiTieu,
            COUNT(DISTINCT dg.UserId) AS SoSinhVienDanhGia,
            NVL(ROUND(AVG(dg.DiemDanhGia), 2), 0) AS DiemDanhGiaTrungBinh
        FROM TruongDH t
        LEFT JOIN Nganh n ON t.TruongID = n.TruongID
        LEFT JOIN DanhGia dg ON n.NganhID = dg.NganhID
        WHERE p_truongid IS NULL OR t.TruongID = p_truongid
        GROUP BY t.TruongID, t.TenTruong, t.MaTruong, t.DiaChi
        ORDER BY t.TenTruong;
END SP_GET_UNIVERSITY_STATS;
/

PROMPT Procedures created.
