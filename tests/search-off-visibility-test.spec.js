const { test, expect } = require('@playwright/test');

test.describe('검색 OFF 시 색칠 표시 테스트', () => {
    
    test('검색 OFF 시 색칠된 필지가 실제로 보이는지 확인', async ({ page }) => {
        const logs = [];
        page.on('console', msg => {
            logs.push(`${msg.type()}: ${msg.text()}`);
        });
        
        // 페이지 로드
        console.log('🔍 페이지 로딩...');
        try {
            await page.goto('http://localhost:3000', { timeout: 15000 });
        } catch (e) {
            await page.goto('http://localhost:5000', { timeout: 15000 });
        }
        
        await page.waitForSelector('body', { timeout: 10000 });
        await page.waitForTimeout(8000);
        
        // 1단계: 검색 실행
        console.log('🔍 1단계: 검색 실행...');
        const searchInput = await page.locator('#searchInput');
        const searchBtn = await page.locator('#searchBtn');
        
        await searchInput.fill('서울시 중구 소공동 87-1');
        await searchBtn.click();
        await page.waitForTimeout(10000);
        
        // 2단계: 검색된 필지 색칠
        console.log('🎨 2단계: 검색 필지 색칠...');
        await page.evaluate(() => {
            window.currentColor = '#FF0000';
            
            if (window.searchParcels && window.searchParcels.size > 0) {
                const firstParcel = window.searchParcels.values().next().value;
                if (firstParcel && firstParcel.data && typeof applyColorToParcel === 'function') {
                    console.log('검색 필지에 빨간색 적용...');
                    applyColorToParcel(firstParcel.data, '#FF0000');
                }
            }
        });
        
        await page.waitForTimeout(3000);
        
        // 3단계: 검색 OFF
        console.log('🔄 3단계: 검색 OFF...');
        const searchToggleBtn = await page.locator('#searchToggleBtn');
        await searchToggleBtn.click();
        await page.waitForTimeout(5000);
        
        // 4단계: 실제 표시 상태 확인
        console.log('👁️ 4단계: 실제 표시 상태 확인...');
        const visibilityState = await page.evaluate(() => {
            let visibleClickCount = 0;
            let clickParcelDetails = [];
            
            if (window.clickParcels) {
                window.clickParcels.forEach((parcel, pnu) => {
                    const isVisible = parcel.polygon && parcel.polygon.getMap();
                    if (isVisible) {
                        visibleClickCount++;
                        
                        // 폴리곤 스타일 확인
                        const options = parcel.polygon.getOptions ? parcel.polygon.getOptions() : {};
                        clickParcelDetails.push({
                            pnu: pnu,
                            color: parcel.color,
                            fillColor: options.fillColor,
                            fillOpacity: options.fillOpacity,
                            strokeColor: options.strokeColor,
                            strokeOpacity: options.strokeOpacity,
                            isOnMap: !!parcel.polygon.getMap()
                        });
                    }
                });
            }
            
            let visibleSearchCount = 0;
            if (window.searchParcels) {
                window.searchParcels.forEach((parcel, pnu) => {
                    if (parcel.polygon && parcel.polygon.getMap()) {
                        visibleSearchCount++;
                    }
                });
            }
            
            return {
                currentMode: window.currentMode,
                totalClickParcels: window.clickParcels ? window.clickParcels.size : 0,
                visibleClickParcels: visibleClickCount,
                visibleSearchParcels: visibleSearchCount,
                clickParcelDetails: clickParcelDetails.slice(0, 3), // 처음 3개만
                showClickParcelsFunction: typeof window.showClickParcels === 'function',
                hideSearchParcelsFunction: typeof window.hideSearchParcels === 'function'
            };
        });
        
        console.log('📊 표시 상태:', JSON.stringify(visibilityState, null, 2));
        
        // 5단계: 수동으로 showClickParcels 호출
        console.log('🔧 5단계: 수동으로 showClickParcels 호출...');
        await page.evaluate(() => {
            if (typeof window.showClickParcels === 'function') {
                console.log('수동으로 showClickParcels 호출...');
                window.showClickParcels();
            }
        });
        
        await page.waitForTimeout(2000);
        
        // 최종 상태 확인
        const finalState = await page.evaluate(() => {
            let finalVisibleCount = 0;
            if (window.clickParcels) {
                window.clickParcels.forEach((parcel, pnu) => {
                    if (parcel.polygon && parcel.polygon.getMap()) {
                        finalVisibleCount++;
                    }
                });
            }
            return {
                finalVisibleClickParcels: finalVisibleCount
            };
        });
        
        console.log('📊 최종 상태:', finalState);
        
        // 관련 로그 확인
        console.log('\\n📋 관련 로그:');
        const relevantLogs = logs.filter(log => 
            log.includes('색칠') ||
            log.includes('showClickParcels') ||
            log.includes('hideSearchParcels') ||
            log.includes('toggleSearchMode') ||
            log.includes('표시') ||
            log.includes('숨김')
        );
        
        relevantLogs.slice(-20).forEach(log => console.log(`  ${log}`));
        
        // 결과 분석
        if (finalState.finalVisibleClickParcels > 0) {
            console.log('✅ 성공: 검색 OFF 후 색칠된 필지가 표시됨!');
        } else {
            console.log('❌ 실패: 검색 OFF 후 색칠된 필지가 표시되지 않음');
            console.log('💡 가능한 원인: showClickParcels 함수 미호출 또는 폴리곤 스타일 문제');
        }
    });
    
});