const { test, expect } = require('@playwright/test');

test.describe('applyColorToParcel 디버그 테스트', () => {
    
    test('applyColorToParcel 함수 내부 로그 확인', async ({ page }) => {
        // 브라우저 콘솔 로그 수집
        const logs = [];
        page.on('console', msg => {
            logs.push(`${msg.type()}: ${msg.text()}`);
        });
        
        console.log('🔍 페이지 로딩...');
        try {
            await page.goto('http://localhost:3000', { timeout: 15000 });
        } catch (e) {
            await page.goto('http://localhost:5000', { timeout: 15000 });
        }
        
        await page.waitForSelector('body', { timeout: 10000 });
        await page.waitForTimeout(5000);
        
        // 검색 실행
        console.log('🔍 검색 실행...');
        const searchInput = await page.locator('#searchInput');
        const searchBtn = await page.locator('#searchBtn');
        
        await searchInput.fill('서울시 중구 소공동 87-1');
        await searchBtn.click();
        await page.waitForTimeout(8000);
        
        // 검색 후 상태 확인
        const searchResult = await page.evaluate(() => {
            return {
                searchCount: window.searchParcels ? window.searchParcels.size : 0,
                searchKeys: window.searchParcels ? Array.from(window.searchParcels.keys()) : [],
                currentMode: window.currentMode
            };
        });
        console.log('📊 검색 결과:', searchResult);
        
        if (searchResult.searchCount === 0) {
            console.log('❌ 검색 결과 없음 - 테스트 중단');
            return;
        }
        
        // applyColorToParcel 직접 호출
        console.log('🎨 applyColorToParcel 직접 호출...');
        const result = await page.evaluate(() => {
            // 첫 번째 검색 결과 가져오기
            const firstSearchParcel = window.searchParcels.values().next().value;
            console.log('🔍 firstSearchParcel:', firstSearchParcel);
            console.log('🔍 firstSearchParcel.data:', !!firstSearchParcel.data);
            
            if (!firstSearchParcel || !firstSearchParcel.data) {
                console.error('❌ 검색 필지 데이터가 없음');
                return { success: false, error: '검색 필지 데이터 없음' };
            }
            
            const parcelData = firstSearchParcel.data;
            console.log('🔍 parcelData.properties:', !!parcelData.properties);
            
            if (!parcelData.properties) {
                console.error('❌ parcelData.properties가 없음');
                return { success: false, error: 'properties 없음' };
            }
            
            const pnu = parcelData.properties.PNU || parcelData.properties.pnu;
            console.log('🎨 PNU:', pnu);
            
            // applyColorToParcel 호출 전 상태
            const beforeState = {
                searchCount: window.searchParcels.size,
                clickCount: window.clickParcels.size,
                currentMode: window.currentMode
            };
            console.log('🎨 호출 전 상태:', beforeState);
            
            try {
                // applyColorToParcel 호출
                if (typeof applyColorToParcel === 'function') {
                    applyColorToParcel(parcelData, '#FF0000');
                    console.log('✅ applyColorToParcel 호출 성공');
                    
                    // 호출 후 상태
                    const afterState = {
                        searchCount: window.searchParcels.size,
                        clickCount: window.clickParcels.size,
                        currentMode: window.currentMode
                    };
                    console.log('🎨 호출 후 상태:', afterState);
                    
                    return {
                        success: true,
                        pnu: pnu,
                        beforeState: beforeState,
                        afterState: afterState
                    };
                } else {
                    console.error('❌ applyColorToParcel 함수가 존재하지 않음');
                    return { success: false, error: 'applyColorToParcel 함수 없음' };
                }
                
            } catch (error) {
                console.error('❌ applyColorToParcel 호출 중 오류:', error);
                return { success: false, error: error.toString() };
            }
        });
        
        console.log('📊 applyColorToParcel 결과:', JSON.stringify(result, null, 2));
        
        await page.waitForTimeout(3000);
        
        // 관련 로그 출력
        console.log('\n📋 applyColorToParcel 관련 로그:');
        const relevantLogs = logs.filter(log => 
            log.includes('applyColorToParcel') ||
            log.includes('createParcelPolygon') ||
            log.includes('검색 필지 →') ||
            log.includes('새로운 클릭 필지') ||
            log.includes('viewportRenderer') ||
            log.includes('searchParcels에서') ||
            log.includes('clickParcels에') ||
            log.includes('ULTRATHINK applyColorToParcel')
        );
        
        relevantLogs.slice(-20).forEach(log => console.log(`  ${log}`));
        
        if (result.success) {
            console.log(`✅ applyColorToParcel 실행 성공: ${result.pnu}`);
            console.log(`📊 변경 사항 - 검색: ${result.beforeState.searchCount} → ${result.afterState.searchCount}, 클릭: ${result.beforeState.clickCount} → ${result.afterState.clickCount}`);
        } else {
            console.log(`❌ applyColorToParcel 실행 실패: ${result.error}`);
        }
    });
    
});