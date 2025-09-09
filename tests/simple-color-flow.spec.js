const { test, expect } = require('@playwright/test');

test.describe('간단한 색칠 플로우 테스트', () => {
    
    test('검색→색칠→OFF 기본 플로우', async ({ page }) => {
        console.log('🔍 페이지 로딩...');
        try {
            await page.goto('http://localhost:3000', { timeout: 15000 });
        } catch (e) {
            await page.goto('http://localhost:5000', { timeout: 15000 });
        }
        
        await page.waitForSelector('body', { timeout: 10000 });
        await page.waitForTimeout(5000);
        
        // 초기화
        await page.evaluate(() => {
            if (window.clickParcels) window.clickParcels.clear();
            if (window.searchParcels) window.searchParcels.clear();
        });
        
        // 검색 실행
        console.log('🔍 검색 실행...');
        const searchInput = await page.locator('#searchInput');
        const searchBtn = await page.locator('#searchBtn');
        
        await searchInput.fill('서울시 중구 소공동 87-1');
        await searchBtn.click();
        await page.waitForTimeout(8000);
        
        // 검색 결과 확인
        const searchResult = await page.evaluate(() => ({
            searchCount: window.searchParcels ? window.searchParcels.size : 0,
            currentMode: window.currentMode
        }));
        console.log('📊 검색 결과:', searchResult);
        
        if (searchResult.searchCount === 0) {
            console.log('❌ 검색 결과 없음');
            return;
        }
        
        // 색칠 실행
        console.log('🎨 색칠 실행...');
        const colorResult = await page.evaluate(() => {
            const firstParcel = window.searchParcels.values().next().value;
            if (firstParcel && firstParcel.data && typeof applyColorToParcel === 'function') {
                applyColorToParcel(firstParcel.data, '#FF0000');
                return {
                    success: true,
                    clickCount: window.clickParcels ? window.clickParcels.size : 0
                };
            }
            return { success: false };
        });
        console.log('📊 색칠 결과:', colorResult);
        
        // 검색 OFF
        console.log('🔄 검색 OFF...');
        const searchToggleBtn = await page.locator('#searchToggleBtn');
        await searchToggleBtn.click();
        await page.waitForTimeout(3000);
        
        // 최종 상태 확인 (간단하게)
        const finalResult = await page.evaluate(() => {
            let visibleCount = 0;
            let totalCount = 0;
            
            if (window.clickParcels) {
                window.clickParcels.forEach((parcel, pnu) => {
                    totalCount++;
                    if (parcel.polygon && parcel.polygon.getMap && parcel.polygon.getMap()) {
                        visibleCount++;
                    }
                });
            }
            
            return {
                currentMode: window.currentMode,
                totalCount: totalCount,
                visibleCount: visibleCount
            };
        });
        
        console.log('📊 최종 상태:', finalResult);
        
        if (finalResult.visibleCount > 0) {
            console.log(`✅ 성공: ${finalResult.visibleCount}개 필지가 검색 OFF에서 표시됨!`);
        } else {
            console.log('❌ 실패: 검색 OFF에서 색칠된 필지가 표시되지 않음');
        }
    });
    
});