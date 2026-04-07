PROMPT ==========================================================PROMPT ==========================================================


































/END;  END IF;    DBMS_OUTPUT.PUT_LINE('Done. Dropped ' || v_count || ' mixed-case table(s).');  ELSE    DBMS_OUTPUT.PUT_LINE('No mixed-case (quoted) tables found. Nothing to do.');  IF v_count = 0 THEN  END LOOP;    EXECUTE IMMEDIATE 'DROP TABLE "' || r.table_name || '" CASCADE CONSTRAINTS PURGE';    DBMS_OUTPUT.PUT_LINE('Dropping table: "' || r.table_name || '"');    v_count := v_count + 1;  ) LOOP    ORDER BY table_name    WHERE table_name <> UPPER(table_name)    FROM user_tables    SELECT table_name  FOR r IN (BEGIN  v_count NUMBER := 0;DECLARESET SERVEROUTPUT ON;-- Safe behavior: only drops tables whose names are NOT all-uppercase.-- Run as the application schema (e.g. STUDYMATCH).---- The official StudyMatch Oracle scripts create unquoted tables (Oracle stores them as UPPERCASE).-- Those typically appear if SQLAlchemy create_all() was run once against Oracle.-- This script removes tables created with QUOTED identifiers like "KhoiThi".PROMPT ==========================================================PROMPT StudyMatch Oracle Cleanup: Drop mixed-case (quoted) tablesPROMPT StudyMatch Oracle Cleanup: Drop mixed-case (quoted) tables
PROMPT ==========================================================

-- This script removes tables created with QUOTED identifiers like "KhoiThi".
-- Those typically appear if SQLAlchemy create_all() was run once against Oracle.
-- The official StudyMatch Oracle scripts create unquoted tables (Oracle stores them as UPPERCASE).
--
-- Run as the application schema (e.g. STUDYMATCH).
-- Safe behavior: only drops tables whose names are NOT all-uppercase.

SET SERVEROUTPUT ON;

DECLARE
  v_count NUMBER := 0;
BEGIN
  FOR r IN (
    SELECT table_name
    FROM user_tables
    WHERE table_name <> UPPER(table_name)
    ORDER BY table_name
  ) LOOP
    v_count := v_count + 1;
    DBMS_OUTPUT.PUT_LINE('Dropping table: "' || r.table_name || '"');
    EXECUTE IMMEDIATE 'DROP TABLE "' || r.table_name || '" CASCADE CONSTRAINTS PURGE';
  END LOOP;

  IF v_count = 0 THEN
    DBMS_OUTPUT.PUT_LINE('No mixed-case (quoted) tables found. Nothing to do.');
  ELSE
    DBMS_OUTPUT.PUT_LINE('Done. Dropped ' || v_count || ' mixed-case table(s).');
  END IF;
END;
/
