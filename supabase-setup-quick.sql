-- 네이버 지도 필지 관리 프로그램 - 빠른 설정 스크립트
-- 이 파일을 Supabase SQL Editor에 복사해서 실행하세요

-- ===========================================
-- 1. 필수 확장 활성화
-- ===========================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ===========================================  
-- 2. 테이블 생성
-- ===========================================
CREATE TABLE IF NOT EXISTS parcels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pnu VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    jibun TEXT,
    area DECIMAL(15,2),
    owner_name TEXT,
    geometry GEOMETRY(POLYGON, 4326),
    location GEOMETRY(POINT, 4326),
    color VARCHAR(20) DEFAULT 'red',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    migration_id VARCHAR(100),
    raw_data JSONB,
    address_search TEXT GENERATED ALWAYS AS (COALESCE(address, '')) STORED,
    jibun_search TEXT GENERATED ALWAYS AS (COALESCE(jibun, '')) STORED,
    owner_search TEXT GENERATED ALWAYS AS (COALESCE(owner_name, '')) STORED
);

CREATE TABLE IF NOT EXISTS memos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    content_search TEXT GENERATED ALWAYS AS (content) STORED
);

CREATE TABLE IF NOT EXISTS migration_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    migration_id VARCHAR(100) UNIQUE NOT NULL,
    migration_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'in_progress',
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    error_records INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_details JSONB,
    metadata JSONB
);

-- ===========================================
-- 3. 인덱스 생성
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_parcels_pnu ON parcels(pnu);
CREATE INDEX IF NOT EXISTS idx_parcels_status ON parcels(status);
CREATE INDEX IF NOT EXISTS idx_parcels_geometry ON parcels USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_parcels_location ON parcels USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_parcels_address_trgm ON parcels USING gin(address_search gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_memos_parcel_id ON memos(parcel_id);

-- ===========================================
-- 4. RPC 함수들
-- ===========================================

-- 배치 삽입 함수
CREATE OR REPLACE FUNCTION secure_batch_insert(
    batch_type TEXT,
    batch_data JSONB,
    input_migration_id TEXT
) RETURNS TABLE (
    count INTEGER,
    inserted_ids UUID[],
    errors TEXT[]
) AS $$
DECLARE
    result_count INTEGER := 0;
    result_ids UUID[] := '{}';
    result_errors TEXT[] := '{}';
    batch_item JSONB;
    new_id UUID;
BEGIN
    IF batch_type = 'parcels' THEN
        FOR batch_item IN SELECT jsonb_array_elements(batch_data)
        LOOP
            BEGIN
                INSERT INTO parcels (
                    pnu, address, jibun, area, owner_name,
                    geometry, location, color, raw_data, migration_id
                ) VALUES (
                    batch_item->>'pnu',
                    batch_item->>'address',
                    batch_item->>'jibun',
                    COALESCE((batch_item->>'area')::DECIMAL, 0),
                    batch_item->>'owner_name',
                    ST_GeomFromText(batch_item->>'geometry', 4326),
                    ST_SetSRID(ST_Point(
                        (batch_item->>'centerLng')::DECIMAL,
                        (batch_item->>'centerLat')::DECIMAL
                    ), 4326),
                    COALESCE(batch_item->>'color', 'red'),
                    batch_item->'rawVworldData',
                    input_migration_id
                ) 
                ON CONFLICT (pnu) DO UPDATE SET
                    address = EXCLUDED.address,
                    updated_at = NOW()
                RETURNING id INTO new_id;
                
                result_count := result_count + 1;
                result_ids := array_append(result_ids, new_id);
                
            EXCEPTION WHEN OTHERS THEN
                result_errors := array_append(result_errors, SQLERRM);
                CONTINUE;
            END;
        END LOOP;
    END IF;
    
    RETURN QUERY SELECT result_count, result_ids, result_errors;
END;
$$ LANGUAGE plpgsql;

-- 연결 상태 확인
CREATE OR REPLACE FUNCTION ping()
RETURNS TABLE (status TEXT, ping_time TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY SELECT 'ok'::TEXT, NOW();
END;
$$ LANGUAGE plpgsql;

-- 비상 롤백 함수
CREATE OR REPLACE FUNCTION emergency_rollback(input_migration_id TEXT)
RETURNS TABLE (deleted_count INTEGER, rollback_status TEXT) AS $$
DECLARE
    result_count INTEGER := 0;
BEGIN
    DELETE FROM parcels WHERE migration_id = input_migration_id;
    GET DIAGNOSTICS result_count = ROW_COUNT;
    RETURN QUERY SELECT result_count, 'success'::TEXT;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 0, ('Error: ' || SQLERRM)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 설정 완료 확인 함수
CREATE OR REPLACE FUNCTION check_setup_complete()
RETURNS TABLE (component TEXT, status TEXT, details TEXT) AS $$
BEGIN
    RETURN QUERY SELECT 'tables'::TEXT, 'ok'::TEXT, 'Tables created'::TEXT;
    RETURN QUERY SELECT 'extensions'::TEXT, 'ok'::TEXT, 'PostGIS enabled'::TEXT;
    RETURN QUERY SELECT 'functions'::TEXT, 'ok'::TEXT, 'RPC functions ready'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 5. 설정 완료 확인
-- ===========================================
SELECT 'Supabase 설정이 완료되었습니다!' as setup_status;
SELECT * FROM check_setup_complete();
SELECT * FROM ping();