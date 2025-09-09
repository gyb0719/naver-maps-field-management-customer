const { test, expect } = require('@playwright/test');

test.describe('새로고침 복원 테스트', () => {
    
    test('검색 → 새로고침 → 보라색 필지 사라짐 문제 정확히 진단', async ({ page }) => {
        // 콘솔 로그 캡처
        const logs = [];
        page.on('console', msg => {
            logs.push(`${msg.type()}: ${msg.text()}`);
        });
        
        // 페이지 로드
        console.log('🔍 1단계: 페이지 로딩...');
        try {
            await page.goto('http://localhost:3000', { timeout: 15000 });
        } catch (e) {
            await page.goto('http://localhost:5000', { timeout: 15000 });
        }
        
        await page.waitForSelector('body', { timeout: 10000 });
        await page.waitForTimeout(6000);
        
        console.log('✅ 1단계 완료: 페이지 로드');
        
        // 2단계: 검색 실행
        console.log('🔍 2단계: 검색 실행...');
        const searchInput = await page.locator('#searchInput');
        const searchBtn = await page.locator('#searchBtn');
        
        await searchInput.fill('서울시 중구 을지로');
        await searchBtn.click();
        await page.waitForTimeout(8000);
        
        // 검색 후 상태 확인
        const afterSearchState = await page.evaluate(() => {
            let polygonCount = 0;
            let labelCount = 0;
            let polygonDetails = [];
            
            if (window.searchParcels) {
                window.searchParcels.forEach((parcelInfo, pnu) => {
                    let detail = {
                        pnu: pnu,
                        hasPolygon: !!parcelInfo.polygon,
                        hasLabel: !!parcelInfo.label,
                        displayText: parcelInfo.displayText
                    };
                    
                    if (parcelInfo.polygon) {
                        polygonCount++;
                        detail.polygonOnMap = !!parcelInfo.polygon.getMap();
                        try {
                            // 폴리곤 스타일 정보 획득
                            const paths = parcelInfo.polygon.getPaths();
                            detail.pathsCount = paths ? paths.length : 0;
                        } catch (e) {
                            detail.pathsError = e.message;
                        }
                    }
                    
                    if (parcelInfo.label) {
                        labelCount++;
                        detail.labelOnMap = !!parcelInfo.label.getMap();
                    }
                    
                    polygonDetails.push(detail);
                });
            }
            
            return {
                searchParcelsCount: window.searchParcels ? window.searchParcels.size : 0,
                polygonCount: polygonCount,
                labelCount: labelCount,
                sessionStorageData: sessionStorage.getItem('searchParcels'),
                polygonDetails: polygonDetails,
                currentMode: window.currentMode
            };
        });
        
        console.log('✅ 2단계 완료: 검색 실행');
        console.log('📊 검색 후 상태:', afterSearchState);
        
        // 3단계: 새로고침
        console.log('🔄 3단계: 새로고침 실행...');
        await page.reload();
        await page.waitForTimeout(8000); // 복원까지 충분한 대기
        
        // 새로고침 후 상태 확인
        const afterRefreshState = await page.evaluate(() => {
            let polygonCount = 0;
            let labelCount = 0;
            let activePolygonCount = 0;
            let activeLabelCount = 0;
            let polygonDetails = [];
            
            if (window.searchParcels) {
                window.searchParcels.forEach((parcelInfo, pnu) => {
                    let detail = {
                        pnu: pnu,
                        hasPolygon: !!parcelInfo.polygon,
                        hasLabel: !!parcelInfo.label,
                        displayText: parcelInfo.displayText
                    };
                    
                    if (parcelInfo.polygon) {
                        polygonCount++;
                        const isOnMap = !!parcelInfo.polygon.getMap();
                        detail.polygonOnMap = isOnMap;
                        if (isOnMap) activePolygonCount++;
                        
                        // 폴리곤 상세 분석
                        try {
                            const paths = parcelInfo.polygon.getPaths();
                            detail.pathsCount = paths ? paths.length : 0;
                            detail.polygonVisible = true; // 기본적으로 visible
                        } catch (e) {
                            detail.pathsError = e.message;
                            detail.polygonVisible = false;
                        }
                    }
                    
                    if (parcelInfo.label) {
                        labelCount++;
                        const isOnMap = !!parcelInfo.label.getMap();
                        detail.labelOnMap = isOnMap;
                        if (isOnMap) activeLabelCount++;
                    }
                    
                    polygonDetails.push(detail);
                });
            }
            
            return {
                searchParcelsCount: window.searchParcels ? window.searchParcels.size : 0,
                polygonCount: polygonCount,
                labelCount: labelCount,
                activePolygonCount: activePolygonCount,
                activeLabelCount: activeLabelCount,
                sessionStorageData: sessionStorage.getItem('searchParcels'),
                polygonDetails: polygonDetails,
                currentMode: window.currentMode
            };
        });
        
        console.log('✅ 3단계 완료: 새로고침');
        console.log('📊 새로고침 후 상태:', afterRefreshState);
        
        // 복원 관련 로그 필터링
        console.log('\\n📋 복원 관련 로그:');
        const restorationLogs = logs.filter(log => 
            log.includes('복원') ||
            log.includes('Bootstrap') ||
            log.includes('sessionStorage') ||
            log.includes('Early') ||
            log.includes('복원된') ||
            log.includes('🟣') ||
            log.includes('💾')
        );
        
        restorationLogs.slice(-15).forEach(log => console.log(`  ${log}`));
        
        // 폴리곤 관련 로그
        console.log('\\n📋 폴리곤 생성 로그:');
        const polygonLogs = logs.filter(log => 
            log.includes('폴리곤') ||
            log.includes('보라색') ||
            log.includes('fillOpacity') ||
            log.includes('보호')
        );
        
        polygonLogs.slice(-10).forEach(log => console.log(`  ${log}`));
        
        // 4단계: 문제 진단
        console.log('\\n🎯 문제 진단:');
        
        if (afterRefreshState.activeLabelCount > 0 && afterRefreshState.activePolygonCount === 0) {
            console.log('🔴 CONFIRMED: 사용자 보고와 동일 - 라벨만 남고 폴리곤 사라짐!');
            
            if (afterRefreshState.polygonCount > 0) {
                console.log('🔍 원인: 폴리곤 객체는 있지만 지도에서 분리됨');
                console.log('📋 폴리곤 상세 분석:', afterRefreshState.polygonDetails);
            } else {
                console.log('🔍 원인: 폴리곤 객체 자체가 복원되지 않음');
            }
        } else if (afterRefreshState.activePolygonCount > 0 && afterRefreshState.activeLabelCount > 0) {
            console.log('✅ 복원 성공: 폴리곤과 라벨 모두 활성');
        } else {
            console.log('⚠️ 다른 상황 발생');
        }
        
        console.log(`총 검색 필지: ${afterRefreshState.searchParcelsCount}`);
        console.log(`폴리곤 객체: ${afterRefreshState.polygonCount}`);
        console.log(`라벨 객체: ${afterRefreshState.labelCount}`);
        console.log(`활성 폴리곤: ${afterRefreshState.activePolygonCount}`);
        console.log(`활성 라벨: ${afterRefreshState.activeLabelCount}`);
        
    });
    
});