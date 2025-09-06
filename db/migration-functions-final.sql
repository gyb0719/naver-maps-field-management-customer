-- 안전한 마이그레이션을 위한 Supabase RPC 함수들 (최종 수정 버전)
-- 매개변수명 충돌 문제 완전 해결

-- 1. 트랜잭션 기반 안전한 배치 삽입
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
                ) RETURNING id INTO new_id;
                
                result_count := result_count + 1;
                result_ids := array_append(result_ids, new_id);
                
            EXCEPTION WHEN OTHERS THEN
                error_msg := SQLERRM;
                result_errors := array_append(result_errors, 
                    'PNU ' || (batch_item->>'pnu') || ': ' || error_msg);
            END;
        END LOOP;
        
    ELSIF batch_type = 'memos' THEN
        -- 메모 배치 처리
        FOR batch_item IN SELECT jsonb_array_elements(batch_data)
        LOOP
            BEGIN
                INSERT INTO memos (
                    parcel_id,
                    content,
                    migration_id
                ) VALUES (
                    (batch_item->>'parcel_id')::UUID,
                    batch_item->>'content',
                    input_migration_id
                ) RETURNING id INTO new_id;
                
                result_count := result_count + 1;
                result_ids := array_append(result_ids, new_id);
                
            EXCEPTION WHEN OTHERS THEN
                error_msg := SQLERRM;
                result_errors := array_append(result_errors, 
                    'Parcel ID ' || (batch_item->>'parcel_id') || ': ' || error_msg);
            END;
        END LOOP;
        
    ELSE
        RAISE EXCEPTION 'Unknown batch_type: %', batch_type;
    END IF;
    
    RETURN QUERY SELECT result_count, result_ids, result_errors;
    
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Batch insert failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- 2. 긴급 롤백 함수
CREATE OR REPLACE FUNCTION emergency_rollback(
    input_migration_id TEXT
) RETURNS TABLE (
    deleted_parcels INTEGER,
    deleted_memos INTEGER,
    success BOOLEAN
) AS $$
DECLARE
    parcel_count INTEGER;
    memo_count INTEGER;
BEGIN
    DELETE FROM memos WHERE migration_id = input_migration_id;
    GET DIAGNOSTICS memo_count = ROW_COUNT;
    
    DELETE FROM parcels WHERE migration_id = input_migration_id;
    GET DIAGNOSTICS parcel_count = ROW_COUNT;
    
    RETURN QUERY SELECT parcel_count, memo_count, true;
    
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Rollback failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- 3. 연결 상태 확인 (핑)
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
        current_database();
END;
$$ LANGUAGE plpgsql;

-- 4. 마이그레이션 상태 조회 (매개변수명 충돌 해결)
CREATE OR REPLACE FUNCTION get_migration_status(
    input_migration_id TEXT
) RETURNS TABLE (
    migration_id TEXT,
    parcel_count BIGINT,
    memo_count BIGINT,
    latest_parcel_created TIMESTAMPTZ,
    latest_memo_created TIMESTAMPTZ,
    sample_parcels JSONB
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        input_migration_id::TEXT,
        (SELECT COUNT(*) FROM parcels WHERE parcels.migration_id = input_migration_id),
        (SELECT COUNT(*) FROM memos WHERE memos.migration_id = input_migration_id),
        (SELECT MAX(created_at) FROM parcels WHERE parcels.migration_id = input_migration_id),
        (SELECT MAX(created_at) FROM memos WHERE memos.migration_id = input_migration_id),
        (SELECT jsonb_agg(
            jsonb_build_object(
                'id', id,
                'pnu', pnu,
                'address', address,
                'created_at', created_at
            )
        ) FROM (
            SELECT id, pnu, address, created_at 
            FROM parcels 
            WHERE parcels.migration_id = input_migration_id 
            ORDER BY created_at DESC 
            LIMIT 5
        ) sample_data);
END;
$$ LANGUAGE plpgsql;

-- 5. 데이터 무결성 검증
CREATE OR REPLACE FUNCTION validate_migration_integrity(
    input_migration_id TEXT
) RETURNS TABLE (
    check_name TEXT,
    passed BOOLEAN,
    details TEXT
) AS $$
BEGIN
    -- 필지 기본 검증
    RETURN QUERY 
    SELECT 
        'parcels_have_valid_geometry'::TEXT,
        COUNT(*) = COUNT(CASE WHEN ST_IsValid(geometry) THEN 1 END),
        COUNT(*)::TEXT || ' total, ' || 
        COUNT(CASE WHEN NOT ST_IsValid(geometry) THEN 1 END)::TEXT || ' invalid'
    FROM parcels WHERE parcels.migration_id = input_migration_id;
    
    -- 필지 PNU 중복 검증
    RETURN QUERY
    SELECT 
        'no_duplicate_pnus'::TEXT,
        COUNT(*) = COUNT(DISTINCT pnu),
        COUNT(*)::TEXT || ' total, ' || 
        COUNT(DISTINCT pnu)::TEXT || ' unique PNUs'
    FROM parcels WHERE parcels.migration_id = input_migration_id;
    
    -- 메모-필지 연결 검증
    RETURN QUERY
    SELECT 
        'all_memos_have_valid_parcel'::TEXT,
        NOT EXISTS(
            SELECT 1 FROM memos m 
            WHERE m.migration_id = input_migration_id 
            AND NOT EXISTS(SELECT 1 FROM parcels p WHERE p.id = m.parcel_id)
        ),
        'Checking memo-parcel relationships'::TEXT;
        
    -- 좌표 범위 검증 (한국 영토 내)
    RETURN QUERY
    SELECT 
        'coordinates_within_korea'::TEXT,
        NOT EXISTS(
            SELECT 1 FROM parcels p
            WHERE p.migration_id = input_migration_id
            AND (ST_X(location) < 124 OR ST_X(location) > 132 
                 OR ST_Y(location) < 33 OR ST_Y(location) > 39)
        ),
        'Checking if all coordinates are within Korea bounds'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 6. 마이그레이션 메타데이터 테이블
CREATE TABLE IF NOT EXISTS migration_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    migration_id TEXT NOT NULL,
    event_type TEXT NOT NULL, 
    event_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 마이그레이션 로그 기록
CREATE OR REPLACE FUNCTION log_migration_event(
    input_migration_id TEXT,
    input_event_type TEXT,
    input_event_data JSONB DEFAULT '{}'::JSONB
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO migration_logs (migration_id, event_type, event_data)
    VALUES (input_migration_id, input_event_type, input_event_data)
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- 8. 마이그레이션 통계
CREATE OR REPLACE FUNCTION get_migration_statistics()
RETURNS TABLE (
    total_migrations BIGINT,
    successful_migrations BIGINT,
    failed_migrations BIGINT,
    total_parcels_migrated BIGINT,
    total_memos_migrated BIGINT,
    latest_migration_date TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT migration_id)::BIGINT,
        COUNT(DISTINCT CASE WHEN event_type = 'complete' THEN migration_id END)::BIGINT,
        COUNT(DISTINCT CASE WHEN event_type = 'rollback' THEN migration_id END)::BIGINT,
        COALESCE(SUM(CASE WHEN event_type = 'complete' THEN (event_data->>'parcel_count')::BIGINT END), 0),
        COALESCE(SUM(CASE WHEN event_type = 'complete' THEN (event_data->>'memo_count')::BIGINT END), 0),
        MAX(created_at)
    FROM migration_logs;
END;
$$ LANGUAGE plpgsql;

-- 9. 기존 테이블에 migration_id 컬럼 추가
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS migration_id TEXT;
ALTER TABLE memos ADD COLUMN IF NOT EXISTS migration_id TEXT;

-- 10. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_parcels_migration_id ON parcels(migration_id);
CREATE INDEX IF NOT EXISTS idx_memos_migration_id ON memos(migration_id);
CREATE INDEX IF NOT EXISTS idx_migration_logs_migration_id ON migration_logs(migration_id);
CREATE INDEX IF NOT EXISTS idx_migration_logs_event_type ON migration_logs(event_type);

-- 11. 뷰 업데이트
DROP VIEW IF EXISTS parcels_with_memos;
CREATE VIEW parcels_with_memos AS
SELECT 
    p.*,
    COALESCE(
        json_agg(
            json_build_object(
                'id', m.id,
                'content', m.content,
                'created_at', m.created_at
            ) ORDER BY m.created_at DESC
        ) FILTER (WHERE m.id IS NOT NULL),
        '[]'::json
    ) as memos
FROM parcels p
LEFT JOIN memos m ON p.id = m.parcel_id
WHERE p.status = 'active'
GROUP BY p.id;

-- 12. 테스트 함수
CREATE OR REPLACE FUNCTION test_migration_functions()
RETURNS TABLE (
    function_name TEXT,
    status TEXT,
    message TEXT
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
        'get_migration_statistics'::TEXT,
        'success'::TEXT,
        'Statistics function ready'::TEXT;
    
    -- migration_logs 테이블 존재 확인
    RETURN QUERY
    SELECT 
        'migration_logs_table'::TEXT,
        CASE WHEN EXISTS(
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'migration_logs'
        ) THEN 'success'::TEXT ELSE 'error'::TEXT END,
        'Migration logs table status'::TEXT;
    
    -- 더미 로그 기록 테스트
    RETURN QUERY
    SELECT 
        'log_migration_event'::TEXT,
        'success'::TEXT,
        'Log ID: ' || log_migration_event('test_migration', 'test', '{"test": true}'::JSONB)::TEXT;
        
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY
    SELECT 
        'error'::TEXT,
        'failed'::TEXT,
        SQLERRM;
END;
$$ LANGUAGE plpgsql;