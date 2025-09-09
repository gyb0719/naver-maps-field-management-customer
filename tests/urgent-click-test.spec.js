const { test, expect } = require('@playwright/test');

test.describe('🚨 긴급: 왼쪽 클릭 색칠 문제', () => {
    test.beforeEach(async ({ page }) => {
        // 지도 페이지 로드
        await page.goto('http://localhost:3000');
        
        // 지도 로딩 대기
        await page.waitForTimeout(8000);
        
        // 모든 콘솔 메시지 수집
        page.on('console', msg => {
            const text = msg.text();
            console.log(`[${msg.type().toUpperCase()}]`, text);
        });
        
        // 오류 메시지 수집
        page.on('pageerror', error => {
            console.log('❌ Page Error:', error.message);
        });
    });

    test('🚨 URGENT: 왼쪽 클릭 색칠 기능 긴급 진단', async ({ page }) => {
        console.log('🚨 긴급 진단 시작: 왼쪽 클릭 색칠 기능');
        
        // 1. 필수 시스템 체크
        const systemCheck = await page.evaluate(() => {
            return {
                hasMap: !!window.map,
                hasAppState: !!window.AppState,
                hasHandleMapLeftClick: !!window.handleMapLeftClick,
                paintModeEnabled: window.paintModeEnabled,
                AppStatePaintMode: window.AppState?.paintMode,
                currentColor: window.AppState?.currentColor,
                clickParcelsSize: window.AppState?.clickParcels?.size || 0
            };
        });
        
        console.log('🔍 시스템 상태 체크:', systemCheck);
        
        // 2. 색칠 버튼 상태 확인
        const paintBtn = await page.locator('#paintToggleBtn');
        await expect(paintBtn).toBeVisible();
        
        const paintBtnText = await paintBtn.textContent();
        console.log('🎨 색칠 버튼 텍스트:', paintBtnText);
        
        // 색칠 모드가 OFF면 ON으로 변경
        if (paintBtnText.includes('OFF')) {
            console.log('🎨 색칠 모드를 ON으로 변경...');
            await paintBtn.click();
            await page.waitForTimeout(1000);
        }
        
        // 3. 지도 클릭 테스트
        const mapContainer = await page.locator('#map');
        await expect(mapContainer).toBeVisible();
        
        const mapBox = await mapContainer.boundingBox();
        const centerX = mapBox.x + mapBox.width / 2;
        const centerY = mapBox.y + mapBox.height / 2;
        
        console.log(`🗺️ 지도 중앙 좌표: ${centerX}, ${centerY}`);
        
        // 클릭 전 상태 기록
        const beforeClick = await page.evaluate(() => {
            return {
                clickParcelsCount: window.AppState?.clickParcels?.size || 0,
                paintMode: window.AppState?.paintMode,
                searchMode: window.AppState?.searchMode
            };
        });
        console.log('📊 클릭 전 상태:', beforeClick);
        
        // 왼쪽 클릭 실행
        console.log('👆 지도 중앙 왼쪽 클릭 실행...');
        await page.mouse.click(centerX, centerY, { button: 'left' });
        
        // VWorld API 응답 대기
        console.log('⏳ VWorld API 응답 대기...');
        await page.waitForTimeout(12000);
        
        // 클릭 후 상태 확인
        const afterClick = await page.evaluate(() => {
            return {
                clickParcelsCount: window.AppState?.clickParcels?.size || 0,
                paintMode: window.AppState?.paintMode,
                searchMode: window.AppState?.searchMode,
                hasPolygons: Array.from(window.AppState?.clickParcels?.values() || [])
                    .filter(p => p.polygon && p.polygon.getMap()).length
            };
        });
        console.log('📊 클릭 후 상태:', afterClick);
        
        // 결과 분석
        if (afterClick.clickParcelsCount > beforeClick.clickParcelsCount) {
            console.log('✅ 성공: 필지가 추가됨');
        } else {
            console.log('❌ 실패: 필지가 추가되지 않음');
        }
        
        if (afterClick.hasPolygons > 0) {
            console.log('✅ 성공: 색칠된 폴리곤 존재');
        } else {
            console.log('❌ 실패: 색칠된 폴리곤 없음');
        }
        
        // 마지막 5초간 추가 대기
        console.log('⏳ 추가 5초 대기...');
        await page.waitForTimeout(5000);
        
        console.log('🚨 긴급 진단 완료');
    });
});