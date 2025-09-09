const { test, expect } = require('@playwright/test');

test.describe('VWorld API 진단', () => {
    test('VWorld API 호출 상세 진단', async ({ page }) => {
        console.log('🌍 VWorld API 호출 진단 시작');
        
        // VWorld API 관련 로그만 수집
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('VWorld') || text.includes('API') || text.includes('필지') || text.includes('JSONP') || text.includes('getParcel')) {
                console.log(`[${msg.type().toUpperCase()}]`, text);
            }
        });
        
        // 네트워크 요청 모니터링
        const requests = [];
        page.on('request', request => {
            const url = request.url();
            if (url.includes('vworld') || url.includes('api')) {
                requests.push({ url, method: request.method() });
                console.log('🌐 Request:', request.method(), url);
            }
        });
        
        page.on('response', response => {
            const url = response.url();
            if (url.includes('vworld') || url.includes('api')) {
                console.log('📡 Response:', response.status(), url);
            }
        });
        
        // 페이지 로드
        await page.goto('http://localhost:3000');
        await page.waitForTimeout(8000);
        
        // VWorld API 키 확인
        const apiStatus = await page.evaluate(() => {
            return {
                hasAppState: !!window.AppState,
                hasVworldKeys: !!window.AppState?.vworldKeys,
                vworldKeysCount: window.AppState?.vworldKeys?.length || 0,
                firstKey: window.AppState?.vworldKeys?.[0]?.substring(0, 8) + '...' || null,
                hasGetParcelFromVWorld: typeof window.getParcelFromVWorld === 'function' || typeof getParcelFromVWorld === 'function'
            };
        });
        
        console.log('🔑 VWorld API 상태:', apiStatus);
        
        // 수동으로 VWorld API 호출 테스트
        console.log('🧪 수동 VWorld API 테스트...');
        
        const testResult = await page.evaluate(async () => {
            // 서울시청 좌표로 테스트
            const testLat = 37.5665;
            const testLng = 126.9780;
            
            console.log(`🧪 테스트 좌표: ${testLat}, ${testLng}`);
            
            try {
                if (window.getParcelFromVWorld) {
                    const result = await window.getParcelFromVWorld(testLat, testLng);
                    return { success: !!result, result: result, error: null };
                } else {
                    return { success: false, result: null, error: 'getParcelFromVWorld function not found' };
                }
            } catch (error) {
                return { success: false, result: null, error: error.message };
            }
        });
        
        console.log('🧪 수동 VWorld API 테스트 결과:', testResult);
        
        // 지도 클릭도 테스트
        const mapContainer = await page.locator('#map');
        await expect(mapContainer).toBeVisible();
        
        const mapBox = await mapContainer.boundingBox();
        const centerX = mapBox.x + mapBox.width / 2;
        const centerY = mapBox.y + mapBox.height / 2;
        
        console.log('👆 지도 클릭 테스트...');
        await page.mouse.click(centerX, centerY, { button: 'left' });
        
        // API 호출 대기
        await page.waitForTimeout(15000);
        
        console.log('📊 최종 요청 수:', requests.length);
        console.log('🌍 VWorld API 진단 완료');
    });
});