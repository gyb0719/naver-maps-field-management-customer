-- 네이버 지도 필지 관리 프로그램 - 한국어 검색 최적화 버전
-- PostGIS + pg_trgm으로 강력한 한국어 검색 지원

-- 필수 확장 활성화 (먼저 실행!)
-- CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

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

-- 기본 인덱스
CREATE INDEX IF NOT EXISTS idx_parcels_pnu ON parcels(pnu);
CREATE INDEX IF NOT EXISTS idx_parcels_color ON parcels(color);
CREATE INDEX IF NOT EXISTS idx_parcels_status ON parcels(status);
CREATE INDEX IF NOT EXISTS idx_parcels_created_at ON parcels(created_at);
CREATE INDEX IF NOT EXISTS idx_parcels_area ON parcels(area);

-- 공간 인덱스 (PostGIS) - 핵심!
CREATE INDEX IF NOT EXISTS idx_parcels_geometry ON parcels USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_parcels_location ON parcels USING GIST(location);

-- 한국어 검색 최적화 인덱스 (pg_trgm 사용)
CREATE INDEX IF NOT EXISTS idx_parcels_address_trgm ON parcels USING GIN(address_search gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_parcels_jibun_trgm ON parcels USING GIN(jibun_search gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_parcels_owner_trgm ON parcels USING GIN(owner_search gin_trgm_ops);

-- 메모 인덱스
CREATE INDEX IF NOT EXISTS idx_memos_parcel_id ON memos(parcel_id);
CREATE INDEX IF NOT EXISTS idx_memos_content_trgm ON memos USING GIN(content_search gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_memos_created_at ON memos(created_at);

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거
DROP TRIGGER IF EXISTS update_parcels_updated_at ON parcels;
CREATE TRIGGER update_parcels_updated_at
    BEFORE UPDATE ON parcels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_memos_updated_at ON memos;
CREATE TRIGGER update_memos_updated_at
    BEFORE UPDATE ON memos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for parcels" ON parcels;
CREATE POLICY "Enable all access for parcels" ON parcels FOR ALL USING (true);

DROP POLICY IF EXISTS "Enable all access for memos" ON memos;
CREATE POLICY "Enable all access for memos" ON memos FOR ALL USING (true);

-- 뷰: 필지와 메모 조인
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

-- 통계 뷰
DROP VIEW IF EXISTS parcels_stats;
CREATE VIEW parcels_stats AS
SELECT 
    color,
    COUNT(*) as parcels_by_color,
    SUM(area) as total_area_by_color,
    AVG(area) as avg_area_by_color
FROM parcels 
WHERE status = 'active'
GROUP BY color
UNION ALL
SELECT 
    'ALL' as color,
    COUNT(*) as parcels_by_color,
    SUM(area) as total_area_by_color,
    AVG(area) as avg_area_by_color
FROM parcels 
WHERE status = 'active';

-- 함수: 경계박스 내 필지 조회
DROP FUNCTION IF EXISTS get_parcels_in_bounds;
CREATE OR REPLACE FUNCTION get_parcels_in_bounds(
    min_lng DECIMAL,
    min_lat DECIMAL, 
    max_lng DECIMAL,
    max_lat DECIMAL
) RETURNS TABLE (
    id UUID,
    pnu VARCHAR(50),
    address TEXT,
    jibun TEXT,
    color VARCHAR(20),
    geometry_geojson TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.pnu,
        p.address,
        p.jibun, 
        p.color,
        ST_AsGeoJSON(p.geometry)::TEXT as geometry_geojson
    FROM parcels p
    WHERE p.geometry && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    AND p.status = 'active'
    LIMIT 1000;
END;
$$ LANGUAGE plpgsql;

-- 함수: 좌표로 필지 검색 (클릭)
DROP FUNCTION IF EXISTS get_parcel_by_point;
CREATE OR REPLACE FUNCTION get_parcel_by_point(
    lng DECIMAL,
    lat DECIMAL
) RETURNS TABLE (
    id UUID,
    pnu VARCHAR(50),
    address TEXT,
    jibun TEXT,
    color VARCHAR(20),
    geometry_geojson TEXT,
    area DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.pnu,
        p.address,
        p.jibun,
        p.color, 
        ST_AsGeoJSON(p.geometry)::TEXT as geometry_geojson,
        p.area
    FROM parcels p
    WHERE ST_Contains(p.geometry, ST_SetSRID(ST_Point(lng, lat), 4326))
    AND p.status = 'active'
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 핵심 함수: 한국어 검색 (pg_trgm 활용)
DROP FUNCTION IF EXISTS search_parcels_korean;
CREATE OR REPLACE FUNCTION search_parcels_korean(
    search_query TEXT
) RETURNS TABLE (
    id UUID,
    pnu VARCHAR(50),
    address TEXT,
    jibun TEXT,
    color VARCHAR(20),
    owner_name TEXT,
    geometry_geojson TEXT,
    similarity_score REAL,
    match_type TEXT
) AS $$
BEGIN
    -- 빈 검색어 처리
    IF search_query IS NULL OR trim(search_query) = '' THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH search_results AS (
        SELECT 
            p.id,
            p.pnu,
            p.address,
            p.jibun,
            p.color,
            p.owner_name,
            ST_AsGeoJSON(p.geometry)::TEXT as geometry_geojson,
            GREATEST(
                similarity(p.address_search, search_query),
                similarity(p.jibun_search, search_query),
                similarity(p.owner_search, search_query)
            ) as similarity_score,
            CASE 
                WHEN similarity(p.address_search, search_query) = GREATEST(
                    similarity(p.address_search, search_query),
                    similarity(p.jibun_search, search_query),
                    similarity(p.owner_search, search_query)
                ) THEN 'address'
                WHEN similarity(p.jibun_search, search_query) = GREATEST(
                    similarity(p.address_search, search_query),
                    similarity(p.jibun_search, search_query),
                    similarity(p.owner_search, search_query)
                ) THEN 'jibun'
                ELSE 'owner'
            END as match_type
        FROM parcels p
        WHERE p.status = 'active'
        AND (
            -- 정확한 부분 매치 (우선순위 높음)
            p.address_search ILIKE '%' || search_query || '%' OR
            p.jibun_search ILIKE '%' || search_query || '%' OR
            p.owner_search ILIKE '%' || search_query || '%' OR
            -- 유사도 매치 (0.3 이상)
            similarity(p.address_search, search_query) > 0.3 OR
            similarity(p.jibun_search, search_query) > 0.3 OR
            similarity(p.owner_search, search_query) > 0.3
        )
    )
    SELECT * FROM search_results
    ORDER BY 
        similarity_score DESC,
        CASE 
            WHEN address ILIKE search_query || '%' THEN 1
            WHEN jibun ILIKE search_query || '%' THEN 2
            WHEN owner_name ILIKE search_query || '%' THEN 3
            ELSE 4
        END
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- 함수: 메모에서 검색
DROP FUNCTION IF EXISTS search_memos_korean;
CREATE OR REPLACE FUNCTION search_memos_korean(
    search_query TEXT
) RETURNS TABLE (
    memo_id UUID,
    parcel_id UUID,
    content TEXT,
    pnu VARCHAR(50),
    address TEXT,
    similarity_score REAL
) AS $$
BEGIN
    IF search_query IS NULL OR trim(search_query) = '' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        m.id as memo_id,
        m.parcel_id,
        m.content,
        p.pnu,
        p.address,
        similarity(m.content_search, search_query) as similarity_score
    FROM memos m
    JOIN parcels p ON m.parcel_id = p.id
    WHERE p.status = 'active'
    AND (
        m.content_search ILIKE '%' || search_query || '%' OR
        similarity(m.content_search, search_query) > 0.3
    )
    ORDER BY similarity_score DESC
    LIMIT 30;
END;
$$ LANGUAGE plpgsql;

-- 함수: 통합 검색 (필지 + 메모)
DROP FUNCTION IF EXISTS search_all_korean;
CREATE OR REPLACE FUNCTION search_all_korean(
    search_query TEXT
) RETURNS TABLE (
    result_type TEXT,
    id UUID,
    pnu VARCHAR(50),
    title TEXT,
    subtitle TEXT,
    geometry_geojson TEXT,
    similarity_score REAL
) AS $$
BEGIN
    IF search_query IS NULL OR trim(search_query) = '' THEN
        RETURN;
    END IF;

    RETURN QUERY
    -- 필지 검색 결과
    SELECT 
        'parcel'::TEXT as result_type,
        sp.id,
        sp.pnu,
        sp.address as title,
        sp.jibun as subtitle,
        sp.geometry_geojson,
        sp.similarity_score
    FROM search_parcels_korean(search_query) sp
    
    UNION ALL
    
    -- 메모 검색 결과
    SELECT 
        'memo'::TEXT as result_type,
        sm.parcel_id as id,
        sm.pnu,
        sm.address as title,
        left(sm.content, 50) || '...' as subtitle,
        ST_AsGeoJSON((SELECT geometry FROM parcels WHERE id = sm.parcel_id))::TEXT as geometry_geojson,
        sm.similarity_score
    FROM search_memos_korean(search_query) sm
    
    ORDER BY similarity_score DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql;

-- 한국어 검색 설정 (pg_trgm threshold 조정)
-- 더 관대한 유사도 매칭을 위해 threshold를 낮춤
SELECT set_limit(0.3);

-- 데이터 검증 함수
DROP FUNCTION IF EXISTS validate_korean_search;
CREATE OR REPLACE FUNCTION validate_korean_search()
RETURNS TABLE (
    total_parcels BIGINT,
    searchable_addresses BIGINT,
    searchable_jibuns BIGINT,
    searchable_owners BIGINT,
    trgm_indexes_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_parcels,
        COUNT(CASE WHEN address_search IS NOT NULL AND address_search != '' THEN 1 END)::BIGINT as searchable_addresses,
        COUNT(CASE WHEN jibun_search IS NOT NULL AND jibun_search != '' THEN 1 END)::BIGINT as searchable_jibuns,
        COUNT(CASE WHEN owner_search IS NOT NULL AND owner_search != '' THEN 1 END)::BIGINT as searchable_owners,
        EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = 'idx_parcels_address_trgm') as trgm_indexes_active
    FROM parcels
    WHERE status = 'active';
END;
$$ LANGUAGE plpgsql;