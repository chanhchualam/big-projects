-- ==================== TRIGGERS ====================

-- Trigger: Tự động thêm kết quả dự đoán khi có điểm mới
CREATE OR REPLACE TRIGGER TR_THEM_KET_QUA_TU_DONG
AFTER INSERT ON Diem
FOR EACH ROW
BEGIN
    -- Xóa kết quả cũ
    DELETE FROM KetQuaDuDoan WHERE UserId = :NEW.UserId;
    
    -- Gọi procedure cập nhật kết quả
    P_CAP_NHAT_KET_QUA(:NEW.UserId);
END;
/

-- Trigger: Cập nhật kết quả khi sửa điểm
CREATE OR REPLACE TRIGGER TR_CAP_NHAT_KET_QUA_KHI_SUA
AFTER UPDATE ON Diem
FOR EACH ROW
BEGIN
    DELETE FROM KetQuaDuDoan WHERE UserId = :NEW.UserId;
    P_CAP_NHAT_KET_QUA(:NEW.UserId);
END;
/

-- Trigger: Xóa kết quả khi xóa điểm
CREATE OR REPLACE TRIGGER TR_XOA_KET_QUA
AFTER DELETE ON Diem
FOR EACH ROW
BEGIN
    DELETE FROM KetQuaDuDoan WHERE UserId = :OLD.UserId;
END;
/

-- Trigger: Kiểm tra điểm hợp lệ
CREATE OR REPLACE TRIGGER TR_KT_DIEM_HOP_LE
BEFORE INSERT OR UPDATE ON Diem
FOR EACH ROW
BEGIN
    IF NOT F_KT_DIEM_HOP_LE(:NEW.DiemThi) THEN
        RAISE_APPLICATION_ERROR(-20001, 'Điểm phải trong khoảng 0-10');
    END IF;
    
    IF :NEW.DiemThuong < 0 OR :NEW.DiemThuong > 1 THEN
        RAISE_APPLICATION_ERROR(-20002, 'Điểm thưởng phải trong khoảng 0-1');
    END IF;
END;
/

-- Trigger: Kiểm tra tính hợp lệ của đánh giá
CREATE OR REPLACE TRIGGER TR_KT_DANH_GIA_HOP_LE
BEFORE INSERT OR UPDATE ON DanhGia
FOR EACH ROW
BEGIN
    IF :NEW.DiemDanhGia < 1 OR :NEW.DiemDanhGia > 5 THEN
        RAISE_APPLICATION_ERROR(-20003, 'Điểm đánh giá phải từ 1 đến 5');
    END IF;
    
    IF LENGTH(:NEW.NhanXet) > 500 THEN
        RAISE_APPLICATION_ERROR(-20004, 'Nhận xét không được vượt quá 500 ký tự');
    END IF;
END;
/

-- Trigger: Lưu lịch sử thay đổi điểm
CREATE OR REPLACE TRIGGER TR_LUU_LICH_SU_DIEM
AFTER UPDATE ON Diem
FOR EACH ROW
BEGIN
    INSERT INTO LICH_SU_DIEM 
    (DiemID, UserId, DiemCu, DiemMoi, NgayThayDoi)
    VALUES 
    (:NEW.DiemID, :NEW.UserId, :OLD.DiemThi, :NEW.DiemThi, SYSDATE);
END;
/

-- Trigger: Kiểm tra tính duy nhất của user
CREATE OR REPLACE TRIGGER TR_KT_USER_DUY_NHAT
BEFORE INSERT ON UserThi
FOR EACH ROW
BEGIN
    IF :NEW.UserName IS NULL OR :NEW.UserName = '' THEN
        RAISE_APPLICATION_ERROR(-20005, 'Tên đăng nhập không được để trống');
    END IF;
    
    IF LENGTH(:NEW.MatKhau) < 6 THEN
        RAISE_APPLICATION_ERROR(-20006, 'Mật khẩu phải có ít nhất 6 ký tự');
    END IF;
END;
/

-- Trigger: Cập nhật ngày sửa đổi
CREATE OR REPLACE TRIGGER TR_CAP_NHAT_NGAY_SUA
BEFORE UPDATE ON Nganh
FOR EACH ROW
BEGIN
    :NEW.NgaySua := SYSDATE;
END;
/

-- Trigger: Kiểm tra tính hợp lệ của khoảng điểm
CREATE OR REPLACE TRIGGER TR_KT_DIEM_CHUAN
BEFORE INSERT OR UPDATE ON Nganh
FOR EACH ROW
BEGIN
    IF :NEW.DiemChuan IS NOT NULL THEN
        IF :NEW.DiemChuan < 0 OR :NEW.DiemChuan > 30 THEN
            RAISE_APPLICATION_ERROR(-20007, 'Điểm chuan phải trong khoảng 0-30');
        END IF;
    END IF;
END;
/

-- Trigger: Hạn chế số lượng đánh giá duplicate
CREATE OR REPLACE TRIGGER TR_LIMIT_DANH_GIA
BEFORE INSERT ON DanhGia
FOR EACH ROW
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM DanhGia
    WHERE UserId = :NEW.UserId 
        AND NganhID = :NEW.NganhID 
        AND TRUNC(NgayDanhGia) = TRUNC(SYSDATE);
    
    IF v_count > 0 THEN
        RAISE_APPLICATION_ERROR(-20008, 'Bạn đã đánh giá ngành này hôm nay');
    END IF;
END;
/
