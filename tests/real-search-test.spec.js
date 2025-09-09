const { test, expect } = require('@playwright/test');

test.describe('실제 검색 플로우 테스트', () => {
    
    test('실제 검색 버튼 클릭으로 보라색 필지와 라벨 테스트', async ({ page }) => {
        // 콘솔 로그 캡처
        const logs = [];
        page.on('console', msg => {
            logs.push(`${msg.type()}: ${msg.text()}`);
        });
        
        // 에러 캡처
        const errors = [];
        page.on('pageerror', error => {
            errors.push(`PAGE ERROR: ${error.message}`);
        });
        
        // 페이지 로드
        console.log('🔍 페이지 로딩...');
        try {
            await page.goto('http://localhost:3000', { timeout: 15000 });
        } catch (e) {
            await page.goto('http://localhost:5000', { timeout: 15000 });
        }
        
        await page.waitForSelector('body', { timeout: 10000 });
        await page.waitForTimeout(6000); // 충분한 로딩 대기
        
        console.log('✅ 페이지 로드 완료');
        
        // 검색 입력 필드 찾기
        const searchInput = await page.locator('#searchInput');
        const searchBtn = await page.locator('#searchBtn');
        
        console.log('🔍 검색 요소 존재 확인');
        await expect(searchInput).toBeVisible();
        await expect(searchBtn).toBeVisible();
        
        // 실제 주소 검색 (서울시 중구)
        console.log('📝 검색어 입력: "서울시 중구 소공동"');
        await searchInput.fill('서울시 중구 소공동');
        
        // 검색 전 상태 확인
        const preSearchState = await page.evaluate(() => {
            return {
                currentMode: window.currentMode,
                searchParcelsCount: window.searchParcels ? window.searchParcels.size : 0,
                mapExists: !!window.map
            };
        });
        
        console.log('📊 검색 전 상태:', preSearchState);
        
        // 검색 버튼 클릭
        console.log('🔍 검색 버튼 클릭');
        await searchBtn.click();
        
        // 검색 완료까지 대기 (충분한 시간)
        await page.waitForTimeout(8000);
        
        // 검색 후 상태 확인
        const postSearchState = await page.evaluate(() => {
            const searchParcels = window.searchParcels ? Array.from(window.searchParcels.entries()) : [];
            
            let polygonCount = 0;
            let labelCount = 0;
            let purplePolygonCount = 0;
            
            searchParcels.forEach(([pnu, parcelInfo]) => {
                if (parcelInfo.polygon) {
                    polygonCount++;
                    // 폴리곤이 지도에 표시되어 있는지 확인
                    const polygonMap = parcelInfo.polygon.getMap();
                    if (polygonMap) {
                        purplePolygonCount++;
                    }
                }
                if (parcelInfo.label) {
                    labelCount++;
                }
            });
            
            return {
                currentMode: window.currentMode,
                searchParcelsCount: window.searchParcels ? window.searchParcels.size : 0,
                polygonCount: polygonCount,
                labelCount: labelCount,
                purplePolygonCount: purplePolygonCount,
                mapExists: !!window.map,
                searchParcelsDetails: searchParcels.map(([pnu, info]) => ({
                    pnu: pnu,
                    hasPolygon: !!info.polygon,
                    hasLabel: !!info.label,
                    displayText: info.displayText,
                    polygonOnMap: info.polygon ? !!info.polygon.getMap() : false,
                    labelOnMap: info.label ? !!info.label.getMap() : false
                }))
            };
        });
        
        console.log('📊 검색 후 상태:', postSearchState);
        console.log('📋 검색 필지 상세 정보:', postSearchState.searchParcelsDetails);
        
        // 5초 후 다시 확인 (혹시 뭔가 변경되는지)
        await page.waitForTimeout(5000);
        
        const finalState = await page.evaluate(() => {
            const searchParcels = window.searchParcels ? Array.from(window.searchParcels.entries()) : [];
            
            let activePolygonCount = 0;
            let activeLabelCount = 0;
            
            searchParcels.forEach(([pnu, parcelInfo]) => {
                if (parcelInfo.polygon && parcelInfo.polygon.getMap()) {
                    activePolygonCount++;
                }
                if (parcelInfo.label && parcelInfo.label.getMap()) {
                    activeLabelCount++;
                }
            });
            
            return {
                searchParcelsCount: window.searchParcels ? window.searchParcels.size : 0,
                activePolygonCount: activePolygonCount,
                activeLabelCount: activeLabelCount,
                currentMode: window.currentMode
            };
        });
        
        console.log('📊 최종 상태 (5초 후):', finalState);
        
        // 관련 로그 필터링
        console.log('\\n📋 검색 관련 로그:');
        const searchLogs = logs.filter(log => 
            log.includes('검색') ||
            log.includes('보라색') ||
            log.includes('폴리곤') ||
            log.includes('라벨') ||
            log.includes('highlightParcel') ||
            log.includes('clearSearch') ||
            log.includes('모드') ||
            log.includes('🎨') ||
            log.includes('🏷️') ||
            log.includes('💜') ||
            log.includes('🟣')
        );
        
        searchLogs.slice(-20).forEach(log => console.log(`  ${log}`));
        
        // 에러 로그
        if (errors.length > 0) {
            console.log('\\n💥 발생한 에러들:');
            errors.forEach(error => console.log(`  ${error}`));
        }
        
        // 결과 판정
        console.log('\\n🎯 최종 판정:');
        if (finalState.activePolygonCount > 0 && finalState.activeLabelCount > 0) {
            console.log('✅ SUCCESS: 보라색 필지와 라벨 모두 표시됨!');
        } else if (finalState.activeLabelCount > 0 && finalState.activePolygonCount === 0) {
            console.log('⚠️ ISSUE: 라벨만 표시되고 보라색 필지가 사라짐 (사용자 보고와 동일)');
        } else if (finalState.activePolygonCount > 0 && finalState.activeLabelCount === 0) {
            console.log('⚠️ ISSUE: 보라색 필지만 표시되고 라벨이 없음');
        } else {
            console.log('❌ FAIL: 보라색 필지와 라벨 모두 표시되지 않음');
        }
        
        console.log(`📈 검색된 필지 수: ${finalState.searchParcelsCount}`);
        console.log(`🟣 활성 폴리곤 수: ${finalState.activePolygonCount}`);
        console.log(`🏷️ 활성 라벨 수: ${finalState.activeLabelCount}`);
        
    });
    
});