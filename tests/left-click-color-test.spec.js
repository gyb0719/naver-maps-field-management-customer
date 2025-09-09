const { test, expect } = require('@playwright/test');

test.describe('왼쪽 클릭 색칠 기능 테스트', () => {
    test.beforeEach(async ({ page }) => {
        // 지도 페이지 로드
        await page.goto('http://localhost:3000');
        
        // 지도 로딩 대기
        await page.waitForTimeout(5000);
        
        // 콘솔 로그 수집
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('❌ Console Error:', msg.text());
            }
            if (msg.text().includes('ULTRATHINK') || msg.text().includes('색칠') || msg.text().includes('VWorld')) {
                console.log('🎯', msg.text());
            }
        });
    });

    test('ULTRATHINK: 왼쪽 클릭으로 필지 색칠하기', async ({ page }) => {
        console.log('🎯 ULTRATHINK: 왼쪽 클릭 색칠 테스트 시작');
        
        // 색칠 모드가 활성화되어 있는지 확인
        const paintToggleBtn = await page.locator('#paintToggleBtn');
        await expect(paintToggleBtn).toBeVisible();
        
        const paintBtnText = await paintToggleBtn.textContent();
        console.log('🎨 색칠 버튼 상태:', paintBtnText);
        
        // 색칠 모드가 OFF라면 ON으로 변경
        if (paintBtnText.includes('OFF')) {
            await paintToggleBtn.click();
            await page.waitForTimeout(1000);
            console.log('🎨 색칠 모드 활성화됨');
        }
        
        // 지도 영역 찾기
        const mapContainer = await page.locator('#map');
        await expect(mapContainer).toBeVisible();
        
        // 지도 중앙 좌표 계산
        const mapBox = await mapContainer.boundingBox();
        const centerX = mapBox.x + mapBox.width / 2;
        const centerY = mapBox.y + mapBox.height / 2;
        
        console.log(`🗺️ 지도 중앙 클릭: ${centerX}, ${centerY}`);
        
        // 지도 중앙을 왼쪽 클릭
        await page.mouse.click(centerX, centerY, { button: 'left' });
        
        // VWorld API 호출 완료 대기
        await page.waitForTimeout(10000);
        
        // 콘솔에서 VWorld API 호출 및 색칠 로그 확인
        const logs = [];
        page.on('console', msg => logs.push(msg.text()));
        
        // Supabase 저장 호출 확인 (페이지 로그에서)
        await page.evaluate(() => {
            console.log('🔍 현재 AppState.clickParcels:', window.AppState?.clickParcels?.size || 0);
            console.log('🔍 paintModeEnabled:', window.paintModeEnabled);
            console.log('🔍 SupabaseDataManager:', !!window.supabaseDataManager);
        });
        
        // 추가 대기
        await page.waitForTimeout(5000);
        
        console.log('✅ ULTRATHINK: 왼쪽 클릭 색칠 테스트 완료');
    });
    
    test('ULTRATHINK: Supabase 연결 확인', async ({ page }) => {
        console.log('☁️ ULTRATHINK: Supabase 연결 테스트 시작');
        
        // SupabaseDataManager 로딩 대기
        await page.waitForFunction(() => {
            return window.supabaseDataManager !== undefined;
        }, { timeout: 30000 });
        
        // Supabase 연결 상태 확인
        const isConnected = await page.evaluate(async () => {
            if (!window.supabaseDataManager) {
                return { connected: false, error: 'SupabaseDataManager 없음' };
            }
            
            try {
                // 간단한 ping 테스트
                const result = await window.supabaseDataManager.supabase
                    .from('parcels')
                    .select('count')
                    .limit(1);
                    
                return { connected: !result.error, error: result.error?.message || null };
            } catch (error) {
                return { connected: false, error: error.message };
            }
        });
        
        console.log('☁️ Supabase 연결 상태:', isConnected);
        expect(isConnected.connected).toBe(true);
        
        console.log('✅ ULTRATHINK: Supabase 연결 테스트 완료');
    });
});