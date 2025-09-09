// VWorld API 프록시 서버 (CORS 해결)
export default async function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { lat, lng, apiKey } = req.query;
        
        if (!lat || !lng || !apiKey) {
            res.status(400).json({ error: 'Missing parameters' });
            return;
        }

        // VWorld API 호출
        const vworldUrl = `https://api.vworld.kr/req/data?service=data&version=2.0&request=GetFeature&format=json&size=1000&page=1&geometry=true&attribute=true&crs=EPSG:4326&geomfilter=POINT(${lng}%20${lat})&data=LP_PA_CBND_BUBUN,LP_PA_CBND_BONBUN&key=${apiKey}&domain=https://naver-maps-field-management-custome.vercel.app`;

        console.log('🌍 VWorld API 프록시 호출:', vworldUrl.replace(/key=[^&]+/, 'key=***'));

        const response = await fetch(vworldUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`VWorld API HTTP ${response.status}`);
        }

        const data = await response.json();
        
        console.log('✅ VWorld API 프록시 응답 성공');
        res.status(200).json(data);

    } catch (error) {
        console.error('❌ VWorld API 프록시 오류:', error.message);
        res.status(500).json({ 
            error: 'VWorld API 호출 실패',
            message: error.message 
        });
    }
}