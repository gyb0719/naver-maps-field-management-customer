-- 네이버 지도 필지 관리 프로그램 - 완전 설정 스크립트
-- 이 파일을 Supabase SQL Editor에서 실행하면 모든 설정이 완료됩니다.

-- ===========================================
-- 1. 필수 확장 활성화
-- ===========================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ===========================================  
-- 2. 테이블 생성
-- ===========================================

-- 필지 정보 테이블
CREATE TABLE IF NOT EXISTS parcels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- 기본 정보
    pnu VARCHAR(50) UNIQUE NOT NULL,  -- 필지 고유번호
    address TEXT,                     -- 주소
    jibun TEXT,                       -- 지번
    area DECIMAL(15,2),               -- 면적 (제곱미터)
    owner_name TEXT,                  -- 소유자명
    
    -- 지리 정보 (PostGIS)
    geometry GEOMETRY(POLYGON, 4326), -- 필지 경계 폴리곤
    location GEOMETRY(POINT, 4326),   -- 중심점 좌표
    
    -- 관리 정보
    color VARCHAR(20) DEFAULT 'red',  -- 표시 색상
    status VARCHAR(20) DEFAULT 'active', -- 상태 (active, archived)
    
    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    migration_id VARCHAR(100), -- 마이그레이션 추적 ID
    
    -- VWorld API 원본 데이터 (JSON)
    raw_data JSONB,
    
    -- 한국어 검색 최적화 필드들
    address_search TEXT GENERATED ALWAYS AS (COALESCE(address, '')) STORED,
    jibun_search TEXT GENERATED ALWAYS AS (COALESCE(jibun, '')) STORED,
    owner_search TEXT GENERATED ALWAYS AS (COALESCE(owner_name, '')) STORED
);

-- 메모 테이블
CREATE TABLE IF NOT EXISTS memos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 한국어 검색 최적화
    content_search TEXT GENERATED ALWAYS AS (content) STORED
);

-- 마이그레이션 이력 테이블 (마이그레이션 추적용)
CREATE TABLE IF NOT EXISTS migration_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    migration_id VARCHAR(100) UNIQUE NOT NULL,
    migration_type VARCHAR(50) NOT NULL, -- 'manual', 'auto', 'bulk'
    status VARCHAR(20) DEFAULT 'in_progress', -- 'in_progress', 'completed', 'failed'
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    error_records INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_details JSONB,
    metadata JSONB
);

-- ===========================================
-- 3. 인덱스 생성 (성능 최적화)
-- ===========================================

-- 기본 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_parcels_pnu ON parcels(pnu);
CREATE INDEX IF NOT EXISTS idx_parcels_status ON parcels(status);
CREATE INDEX IF NOT EXISTS idx_parcels_created_at ON parcels(created_at);
CREATE INDEX IF NOT EXISTS idx_parcels_migration_id ON parcels(migration_id);

-- 공간 인덱스 (PostGIS)
CREATE INDEX IF NOT EXISTS idx_parcels_geometry ON parcels USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_parcels_location ON parcels USING GIST(location);

-- 한국어 전문 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_parcels_address_trgm ON parcels USING gin(address_search gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_parcels_jibun_trgm ON parcels USING gin(jibun_search gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_parcels_owner_trgm ON parcels USING gin(owner_search gin_trgm_ops);

-- 메모 인덱스
CREATE INDEX IF NOT EXISTS idx_memos_parcel_id ON memos(parcel_id);
CREATE INDEX IF NOT EXISTS idx_memos_content_trgm ON memos USING gin(content_search gin_trgm_ops);

-- 마이그레이션 로그 인덱스
CREATE INDEX IF NOT EXISTS idx_migration_logs_id ON migration_logs(migration_id);
CREATE INDEX IF NOT EXISTS idx_migration_logs_status ON migration_logs(status);
CREATE INDEX IF NOT EXISTS idx_migration_logs_started_at ON migration_logs(started_at);

-- ===========================================
-- 4. RPC 함수들 생성
-- ===========================================

-- 트랜잭션 기반 안전한 배치 삽입
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
    error_msg TEXT;
BEGIN
    IF batch_type = 'parcels' THEN
        -- 필지 배치 처리
        FOR batch_item IN SELECT jsonb_array_elements(batch_data)
        LOOP
            BEGIN
                INSERT INTO parcels (
                    pnu,
                    address,
                    jibun,
                    area,
                    owner_name,
                    geometry,
                    location,
                    color,
                    raw_data,
                    migration_id
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
                    jibun = EXCLUDED.jibun,
                    area = EXCLUDED.area,
                    owner_name = EXCLUDED.owner_name,
                    geometry = EXCLUDED.geometry,
                    location = EXCLUDED.location,
                    color = EXCLUDED.color,
                    raw_data = EXCLUDED.raw_data,
                    migration_id = EXCLUDED.migration_id,
                    updated_at = NOW()
                RETURNING id INTO new_id;
                
                result_count := result_count + 1;
                result_ids := array_append(result_ids, new_id);
                
            EXCEPTION WHEN OTHERS THEN
                error_msg := SQLERRM;
                result_errors := array_append(result_errors, error_msg);
                CONTINUE;
            END;
        END LOOP;
    END IF;
    
    RETURN QUERY SELECT result_count, result_ids, result_errors;
END;
$$ LANGUAGE plpgsql;

-- 비상 롤백 함수
CREATE OR REPLACE FUNCTION emergency_rollback(
    rollback_migration_id TEXT
) RETURNS TABLE (
    deleted_count INTEGER,
    rollback_status TEXT
) AS $$
DECLARE
    result_count INTEGER := 0;
BEGIN
    -- 해당 마이그레이션 ID로 생성된 모든 레코드 삭제
    DELETE FROM parcels WHERE migration_id = rollback_migration_id;
    GET DIAGNOSTICS result_count = ROW_COUNT;
    
    -- 마이그레이션 로그 업데이트
    UPDATE migration_logs 
    SET status = 'rolled_back', completed_at = NOW()
    WHERE migration_id = rollback_migration_id;
    
    RETURN QUERY SELECT result_count, 'success'::TEXT;
    
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 0, ('Rollback failed: ' || SQLERRM)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 연결 상태 확인 (핑)
CREATE OR REPLACE FUNCTION ping()
RETURNS TABLE (
    status TEXT,
    ping_time TIMESTAMPTZ,
    database_name TEXT
) AS $$
BEGIN
    RETURN QUERY SELECT 
        'ok'::TEXT,
        NOW(),
        current_database()::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 시스템 상태 조회
CREATE OR REPLACE FUNCTION get_system_status()
RETURNS TABLE (
    test_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- Ping 테스트
    RETURN QUERY
    SELECT 
        'ping'::TEXT,
        'success'::TEXT,
        'Connection OK'::TEXT;
    
    -- 통계 함수 테스트
    RETURN QUERY
    SELECT 
        'statistics'::TEXT,
        'success'::TEXT,
        ('Total parcels: ' || COUNT(*)::TEXT)
    FROM parcels;
    
    -- PostGIS 테스트  
    RETURN QUERY
    SELECT 
        'postgis'::TEXT,
        CASE 
            WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') 
            THEN 'success'::TEXT
            ELSE 'failed'::TEXT 
        END,
        'PostGIS extension check'::TEXT;
        
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY
    SELECT 
        'error'::TEXT,
        'failed'::TEXT,
        SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 5. 초기 설정 완료 확인
-- ===========================================

-- 설정 완료 확인 함수
CREATE OR REPLACE FUNCTION check_setup_complete()
RETURNS TABLE (
    component TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- 테이블 존재 확인
    RETURN QUERY
    SELECT 
        'tables'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name IN ('parcels', 'memos', 'migration_logs')
        ) THEN 'ok'::TEXT ELSE 'missing'::TEXT END,
        'Core tables check'::TEXT;
    
    -- 확장 확인
    RETURN QUERY
    SELECT 
        'extensions'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM pg_extension 
            WHERE extname IN ('postgis', 'pg_trgm', 'unaccent')
        ) THEN 'ok'::TEXT ELSE 'missing'::TEXT END,
        'Required extensions check'::TEXT;
    
    -- 함수 확인
    RETURN QUERY
    SELECT 
        'functions'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname IN ('secure_batch_insert', 'ping', 'emergency_rollback')
        ) THEN 'ok'::TEXT ELSE 'missing'::TEXT END,
        'RPC functions check'::TEXT;

END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 6. 설정 완료 메시지
-- ===========================================

SELECT 'Supabase 설정이 완료되었습니다!' as setup_status;
SELECT * FROM check_setup_complete();
SELECT 'ping 테스트:' as test_label, * FROM ping();

-- 초기 통계
SELECT 
    'Initial Statistics' as info,
    (SELECT COUNT(*) FROM parcels) as parcel_count,
    (SELECT COUNT(*) FROM memos) as memo_count,
    NOW() as setup_time;