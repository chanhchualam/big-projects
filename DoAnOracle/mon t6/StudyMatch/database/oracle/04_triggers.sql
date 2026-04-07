-- StudyMatch (Oracle) - Triggers
-- Includes: auto-ID from sequences + validations + derived data refresh.

-- ===== Auto-ID triggers =====

CREATE OR REPLACE TRIGGER trg_userthi_bi
BEFORE INSERT ON UserThi
FOR EACH ROW
BEGIN
    IF :NEW.UserId IS NULL THEN
        :NEW.UserId := seq_userid.NEXTVAL;
    END IF;
    :NEW.NgayCapNhat := SYSTIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER trg_khoithi_bi
BEFORE INSERT ON KhoiThi
FOR EACH ROW
BEGIN
    IF :NEW.KhoiID IS NULL THEN
        :NEW.KhoiID := seq_khoiid.NEXTVAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_montrongkhoi_bi
BEFORE INSERT ON MonTrongKhoiThi
FOR EACH ROW
BEGIN
    IF :NEW.MonID IS NULL THEN
        :NEW.MonID := seq_monid.NEXTVAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_monhoc_bi
BEFORE INSERT ON MonHoc
FOR EACH ROW
BEGIN
    IF :NEW.MonHocID IS NULL THEN
        :NEW.MonHocID := seq_monhocid.NEXTVAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_truongdh_bi
BEFORE INSERT ON TruongDH
FOR EACH ROW
BEGIN
    IF :NEW.TruongID IS NULL THEN
        :NEW.TruongID := seq_truongid.NEXTVAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_nganh_bi
BEFORE INSERT ON Nganh
FOR EACH ROW
BEGIN
    IF :NEW.NganhID IS NULL THEN
        :NEW.NganhID := seq_nganhid.NEXTVAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_giaovien_bi
BEFORE INSERT ON GiaoVien
FOR EACH ROW
BEGIN
    IF :NEW.GiaoVienID IS NULL THEN
        :NEW.GiaoVienID := seq_giaovienid.NEXTVAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_ttts_bi
BEFORE INSERT ON ThongTinTuyenSinh
FOR EACH ROW
BEGIN
    IF :NEW.ThongTinID IS NULL THEN
        :NEW.ThongTinID := seq_ttuyenid.NEXTVAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_danhgia_bi
BEFORE INSERT ON DanhGia
FOR EACH ROW
BEGIN
    IF :NEW.DanhGiaID IS NULL THEN
        :NEW.DanhGiaID := seq_danhgiaid.NEXTVAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_hinhanhgv_bi
BEFORE INSERT ON HinhAnhGiaoVien
FOR EACH ROW
BEGIN
    IF :NEW.HinhAnhID IS NULL THEN
        :NEW.HinhAnhID := seq_hinhanhid.NEXTVAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_ketqua_bi
BEFORE INSERT ON KetQuaDuDoan
FOR EACH ROW
BEGIN
    IF :NEW.KetQuaID IS NULL THEN
        :NEW.KetQuaID := seq_ketquaid.NEXTVAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_lichsu_bi
BEFORE INSERT ON Lich_Su_Diem
FOR EACH ROW
BEGIN
    IF :NEW.LichSuID IS NULL THEN
        :NEW.LichSuID := seq_lichsuid.NEXTVAL;
    END IF;
END;
/

-- ===== Validation triggers =====

CREATE OR REPLACE TRIGGER trg_diem_validate
BEFORE INSERT OR UPDATE ON Diem
FOR EACH ROW
BEGIN
    IF INSERTING AND :NEW.DiemID IS NULL THEN
        :NEW.DiemID := seq_diemid.NEXTVAL;
    END IF;

    IF NOT F_KT_DIEM_HOP_LE(:NEW.DiemThi) THEN
        RAISE_APPLICATION_ERROR(-20001, 'DiemThi must be between 0 and 10');
    END IF;

    IF :NEW.DiemThuong IS NULL THEN
        :NEW.DiemThuong := 0;
    END IF;

    IF :NEW.DiemThuong < 0 OR :NEW.DiemThuong > 1 THEN
        RAISE_APPLICATION_ERROR(-20002, 'DiemThuong must be between 0 and 1');
    END IF;

    IF :NEW.NgayNhap IS NOT NULL AND :NEW.NgayNhap > SYSTIMESTAMP THEN
        RAISE_APPLICATION_ERROR(-20003, 'Cannot add score with future date');
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_danhgia_validate
BEFORE INSERT OR UPDATE ON DanhGia
FOR EACH ROW
BEGIN
    IF :NEW.DiemDanhGia < 1 OR :NEW.DiemDanhGia > 5 THEN
        RAISE_APPLICATION_ERROR(-20004, 'DiemDanhGia must be between 1 and 5');
    END IF;

    IF :NEW.NhanXet IS NOT NULL AND LENGTH(:NEW.NhanXet) > 500 THEN
        RAISE_APPLICATION_ERROR(-20005, 'NhanXet must be <= 500 chars');
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_nganh_update_ngaysua
BEFORE UPDATE ON Nganh
FOR EACH ROW
BEGIN
    :NEW.NgaySua := SYSTIMESTAMP;
END;
/

-- ===== Audit/history trigger =====

CREATE OR REPLACE TRIGGER trg_diem_history
AFTER UPDATE OF DiemThi ON Diem
FOR EACH ROW
BEGIN
    INSERT INTO Lich_Su_Diem (LichSuID, DiemID, UserId, DiemCu, DiemMoi, NgayThayDoi)
    VALUES (NULL, :NEW.DiemID, :NEW.UserId, :OLD.DiemThi, :NEW.DiemThi, SYSTIMESTAMP);
END;
/

-- ===== Refresh KetQuaDuDoan without mutating-table error =====
-- Uses a COMPOUND TRIGGER so the refresh runs AFTER STATEMENT.

CREATE OR REPLACE TRIGGER trg_diem_refresh_ketqua
FOR INSERT OR UPDATE OR DELETE ON Diem
COMPOUND TRIGGER
    TYPE t_user_map IS TABLE OF BOOLEAN INDEX BY VARCHAR2(40);
    g_users t_user_map;

    PROCEDURE add_user(p_userid NUMBER) IS
    BEGIN
        IF p_userid IS NOT NULL THEN
            g_users(TO_CHAR(TRUNC(p_userid))) := TRUE;
        END IF;
    END;

AFTER EACH ROW IS
BEGIN
    IF INSERTING OR UPDATING THEN
        add_user(:NEW.UserId);
    END IF;
    IF DELETING THEN
        add_user(:OLD.UserId);
    END IF;
END AFTER EACH ROW;

AFTER STATEMENT IS
    v_key VARCHAR2(40);
BEGIN
    v_key := g_users.FIRST;
    WHILE v_key IS NOT NULL LOOP
        P_CAP_NHAT_KET_QUA(TO_NUMBER(v_key));
        v_key := g_users.NEXT(v_key);
    END LOOP;
END AFTER STATEMENT;
END trg_diem_refresh_ketqua;
/

PROMPT Triggers created.
