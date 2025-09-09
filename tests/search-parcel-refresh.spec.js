const { test, expect } = require('@playwright/test');

test.describe('검색 필지 새로고침 버그 테스트', () => {
    
    test('검색 필지가 새로고침 후에도 유지되는지 확인', async ({ page }) => {
        // 콘솔 로그를 캡처하여 디버깅
        const logs = [];
        page.on('console', msg => {
            logs.push(`${msg.type()}: ${msg.text()}`);
        });
        
        // 페이지 로드
        console.log('🔍 페이지 로딩 시작...');
        await page.goto('http://localhost:5000');
        
        // 지도 로딩 대기 (더 길게)
        await page.waitForTimeout(5000);
        
        // 검색 ON 모드로 변경
        console.log('🔍 검색 ON 모드로 변경...');
        const searchToggle = await page.locator('#searchToggle');
        if (await searchToggle.isVisible()) {
            await searchToggle.click();
            await page.waitForTimeout(1000);
        }
        
        // 지도 중심 좌표 확인
        const mapCenter = await page.evaluate(() => {
            if (window.map) {
                const center = window.map.getCenter();
                return { lat: center.lat(), lng: center.lng() };
            }
            return null;
        });
        console.log('🗺️ 지도 중심:', mapCenter);
        
        // 지도 클릭하여 검색 필지 생성
        console.log('🖱️ 지도 클릭하여 검색 필지 생성...');
        const mapElement = await page.locator('#map');
        await mapElement.click({ position: { x: 300, y: 300 } });
        
        // 검색 필지 생성 대기
        await page.waitForTimeout(3000);
        
        // sessionStorage 확인 (1차)
        const sessionDataBefore = await page.evaluate(() => {
            const data = sessionStorage.getItem('searchParcels');
            console.log('💾 새로고침 전 sessionStorage:', data);
            return data;
        });
        
        // window.searchParcels 확인 (1차)
        const searchParcelsCountBefore = await page.evaluate(() => {
            return window.searchParcels ? window.searchParcels.size : 0;
        });
        
        console.log('📊 새로고침 전 상태:');
        console.log('  - sessionStorage 데이터:', sessionDataBefore ? '있음' : '없음');
        console.log('  - window.searchParcels 크기:', searchParcelsCountBefore);
        
        // 보라색 폴리곤 존재 확인 (1차)
        const purplePolygonsBefore = await page.evaluate(() => {
            return window.searchParcels ? Array.from(window.searchParcels.values()).filter(p => p.polygon).length : 0;
        });
        
        console.log('🟣 새로고침 전 보라색 폴리곤:', purplePolygonsBefore + '개');
        
        // 새로고침
        console.log('🔄 페이지 새로고침...');
        await page.reload();
        
        // 새로고침 후 로딩 대기 (더 길게)
        await page.waitForTimeout(6000);
        
        // 복원 로그 확인
        console.log('\n📋 복원 관련 로그:');
        const restoreLogs = logs.filter(log => 
            log.includes('ULTRATHINK') || 
            log.includes('복원') || 
            log.includes('sessionStorage') ||
            log.includes('searchParcels')
        );
        restoreLogs.forEach(log => console.log(`  ${log}`));
        
        // sessionStorage 확인 (2차)
        const sessionDataAfter = await page.evaluate(() => {
            const data = sessionStorage.getItem('searchParcels');
            console.log('💾 새로고침 후 sessionStorage:', data);
            return data;
        });
        
        // window.searchParcels 확인 (2차)
        const searchParcelsCountAfter = await page.evaluate(() => {
            return window.searchParcels ? window.searchParcels.size : 0;
        });
        
        // 보라색 폴리곤 존재 확인 (2차)
        const purplePolygonsAfter = await page.evaluate(() => {
            return window.searchParcels ? Array.from(window.searchParcels.values()).filter(p => p.polygon && p.polygon.getMap()).length : 0;
        });
        
        console.log('\n📊 새로고침 후 상태:');
        console.log('  - sessionStorage 데이터:', sessionDataAfter ? '있음' : '없음');
        console.log('  - window.searchParcels 크기:', searchParcelsCountAfter);
        console.log('🟣 새로고침 후 보라색 폴리곤:', purplePolygonsAfter + '개');
        
        // 디버그 정보 수집
        const debugInfo = await page.evaluate(() => {
            return {
                mapExists: !!window.map,
                searchParcelsExists: !!window.searchParcels,
                formatJibunExists: typeof formatJibun === 'function',
                restoreFunctionExists: typeof window.restoreSearchParcelsFromSession === 'function',
                currentMode: window.currentMode,
                sessionStorageKeys: Object.keys(sessionStorage),
                restoreFunctionCalled: window._restoreCalled || false
            };
        });
        
        console.log('\n🔧 디버그 정보:', debugInfo);
        
        // 수동으로 복원 함수 호출해보기
        console.log('\n🧪 수동 복원 테스트...');
        const manualRestoreResult = await page.evaluate(() => {
            if (typeof window.testSearchRestore === 'function') {
                window.testSearchRestore();
                return 'OK';
            }
            return 'FUNCTION_NOT_FOUND';
        });
        
        console.log('수동 복원 결과:', manualRestoreResult);
        await page.waitForTimeout(2000);
        
        // 수동 복원 후 상태 확인
        const searchParcelsCountAfterManual = await page.evaluate(() => {
            return window.searchParcels ? window.searchParcels.size : 0;
        });
        
        console.log('🔧 수동 복원 후 window.searchParcels 크기:', searchParcelsCountAfterManual);
        
        // 모든 콘솔 로그 출력
        console.log('\n📜 전체 콘솔 로그:');
        logs.forEach((log, index) => {
            if (index < 50) { // 너무 많으면 처음 50개만
                console.log(`  ${index}: ${log}`);
            }
        });
        
        // 테스트 검증
        if (sessionDataBefore && searchParcelsCountBefore > 0) {
            console.log('\n✅ 새로고침 전 데이터 존재 확인됨');
            
            if (!sessionDataAfter || searchParcelsCountAfter === 0) {
                console.log('❌ BUG: 새로고침 후 데이터 사라짐!');
                
                // 추가 디버깅 정보
                if (!sessionDataAfter) {
                    console.log('  - sessionStorage 데이터가 사라짐');
                }
                if (searchParcelsCountAfter === 0) {
                    console.log('  - window.searchParcels가 비어있음');
                }
            } else {
                console.log('✅ 새로고침 후 데이터 유지됨');
            }
        } else {
            console.log('⚠️ 새로고침 전 데이터가 생성되지 않음 (검색 필지 생성 실패)');
        }
        
        // 스크린샷 저장
        await page.screenshot({ path: 'tests/screenshots/search-parcel-refresh-test.png', fullPage: true });
    });
    
});