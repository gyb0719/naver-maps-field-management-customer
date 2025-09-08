const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// 포트 설정 - 강제로 3000 포트 사용
const PORT = 3000;

// CORS 설정
app.use(cors());
app.use(express.json());

// 정적 파일 제공
app.use(express.static('public'));
app.use('/assets', express.static(path.join(__dirname, 'srcassets')));
app.use('/components', express.static(path.join(__dirname, 'srccomponents')));
app.use('/pages', express.static(path.join(__dirname, 'srcpages')));

// 클라이언트 설정 제공 (공개 가능한 설정만)
app.get('/api/config', (req, res) => {
    res.json({
        NAVER_CLIENT_ID: process.env.NAVER_CLIENT_ID || 'xzbnwd2h1z',
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
    });
});

// VWorld API 프록시 라우트
app.get('/api/vworld', async (req, res) => {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    try {
        console.log('VWorld API 프록시 요청:', req.query);
        
        // 쿼리 파라미터 추출
        const {
            service = 'data',
            request: requestType = 'GetFeature', 
            data: dataType = 'LP_PA_CBND_BUBUN',
            key,
            geometry = 'true',
            geomFilter = '',
            size = '10',
            format = 'json',
            crs = 'EPSG:4326'
        } = req.query;
        
        // VWorld API 키들 - 환경 변수에서 로드
        const apiKeys = [
            process.env.VWORLD_API_KEY_1,
            process.env.VWORLD_API_KEY_2,
            process.env.VWORLD_API_KEY_3,
            process.env.VWORLD_API_KEY_4,
            key // 클라이언트에서 제공한 키도 시도
        ].filter(Boolean); // null/undefined 제거
        
        let lastError;
        let successResult;
        
        // 각 키를 순서대로 시도
        for (let i = 0; i < apiKeys.length; i++) {
            const currentKey = apiKeys[i];
            
            try {
                console.log(`API 키 ${i + 1}/${apiKeys.length} 시도 중...`);
                
                const params = new URLSearchParams();
                params.append('service', service);
                params.append('request', requestType);
                params.append('data', dataType);
                params.append('key', currentKey);
                params.append('geometry', geometry);
                params.append('format', format);
                params.append('crs', crs);
                
                if (geomFilter) {
                    params.append('geomFilter', geomFilter);
                }
                params.append('size', size);
                
                const url = `https://api.vworld.kr/req/data?${params.toString()}`;
                
                const { default: fetch } = await import('node-fetch');
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0'
                    }
                });
                
                const data = await response.json();
                
                if (data.response?.status === 'OK' || (data.features && data.features.length > 0)) {
                    console.log(`✓ API 키 성공: ${currentKey.substring(0, 8)}...`);
                    successResult = data;
                    break;
                } else {
                    console.log(`✗ API 키 실패: ${data.response?.status || '데이터 없음'}`);
                    lastError = data;
                }
            } catch (error) {
                console.error(`API 키 ${currentKey.substring(0, 8)}... 오류:`, error.message);
                lastError = error;
            }
        }
        
        if (successResult) {
            return res.json(successResult);
        } else {
            console.error('모든 API 키 실패');
            return res.status(500).json({
                error: '모든 API 키가 실패했습니다',
                lastError: lastError
            });
        }
        
    } catch (error) {
        console.error('프록시 오류:', error);
        res.status(500).json({ 
            error: '프록시 서버 오류', 
            message: error.message 
        });
    }
});

// Naver Geocoding API 프록시
app.get('/api/naver/geocode', async (req, res) => {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    try {
        const { query } = req.query;
        
        if (!query) {
            return res.status(400).json({ error: '검색어가 필요합니다' });
        }

        const naverClientId = process.env.NAVER_CLIENT_ID;
        const naverClientSecret = process.env.NAVER_CLIENT_SECRET;

        if (!naverClientId || !naverClientSecret) {
            return res.status(500).json({ error: 'Naver API 설정이 필요합니다' });
        }

        const { default: fetch } = await import('node-fetch');
        const response = await fetch(
            `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`,
            {
                method: 'GET',
                headers: {
                    'X-NCP-APIGW-API-KEY-ID': naverClientId,
                    'X-NCP-APIGW-API-KEY': naverClientSecret
                }
            }
        );

        const data = await response.json();
        
        if (response.ok) {
            res.json(data);
        } else {
            console.error('Naver Geocoding API 오류:', data);
            res.status(response.status).json(data);
        }

    } catch (error) {
        console.error('Naver 프록시 오류:', error);
        res.status(500).json({ 
            error: 'Naver API 프록시 서버 오류', 
            message: error.message 
        });
    }
});

// Google Sheets 프록시 (추후 구현)
app.post('/api/sheets/export', async (req, res) => {
    // 향후 Google Sheets API 직접 연동 시 사용
    res.status(501).json({ error: 'Google Sheets 프록시는 아직 구현되지 않았습니다' });
});

// 기본 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 서버 시작
const server = app.listen(PORT, () => {
    console.log(`
    ======================================
    🚀 서버가 시작되었습니다!
    
    📍 로컬: http://localhost:${PORT}
    📍 네트워크: http://127.0.0.1:${PORT}
    
    ✅ NAVER Maps Field Management Program
    ======================================
    `);
});

// 포트 충돌 시 다른 포트로 재시도
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        const newPort = PORT === 3000 ? 4000 : 3000;
        console.log(`⚠️ 포트 ${PORT}이 사용 중입니다. 포트 ${newPort}로 재시도합니다...`);
        
        app.listen(newPort, () => {
            console.log(`
            ======================================
            🚀 서버가 포트 ${newPort}에서 시작되었습니다!
            
            📍 로컬: http://localhost:${newPort}
            📍 네트워크: http://127.0.0.1:${newPort}
            
            ✅ NAVER Maps Field Management Program
            ======================================
            `);
        });
    } else {
        console.error('서버 시작 오류:', err);
    }
});