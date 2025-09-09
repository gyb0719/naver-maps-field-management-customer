const { test, expect } = require('@playwright/test');

test.describe('정확한 지번 검색 테스트', () => {
    
    test('구체적인 지번으로 검색 → 새로고침 → 보라색 필지 사라짐 재현', async ({ page }) => {
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
        
        // 2단계: 구체적인 지번으로 검색
        console.log('🔍 2단계: 구체적인 지번 검색...');
        const searchInput = await page.locator('#searchInput');
        const searchBtn = await page.locator('#searchBtn');
        
        // 구체적인 지번 입력
        await searchInput.fill('서울시 중구 소공동 87-1');
        console.log('📝 검색어 입력: "서울시 중구 소공동 87-1"');
        
        await searchBtn.click();
        console.log('🔍 검색 버튼 클릭');
        
        await page.waitForTimeout(10000); // 검색 완료까지 충분한 대기
        
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
                sessionStorageSize: JSON.parse(sessionStorage.getItem('searchParcels') || '{}'),
                polygonDetails: polygonDetails,
                currentMode: window.currentMode
            };
        });
        
        console.log('✅ 2단계 완료: 구체적인 지번 검색');
        console.log('📊 검색 후 상태:', afterSearchState);
        console.log('💾 sessionStorage 크기:', Object.keys(afterSearchState.sessionStorageSize).length);
        
        // 검색이 성공했는지 확인
        if (afterSearchState.searchParcelsCount === 0) {
            console.log('❌ 검색 실패 - 다른 지번으로 재시도');
            
            // 다른 지번으로 재시도
            await searchInput.fill('서울시 중구 명동2가 31-1');
            console.log('📝 재검색: "서울시 중구 명동2가 31-1"');
            await searchBtn.click();
            await page.waitForTimeout(10000);
            
            const retryState = await page.evaluate(() => {
                return {
                    searchParcelsCount: window.searchParcels ? window.searchParcels.size : 0,
                    sessionStorageData: sessionStorage.getItem('searchParcels'),
                    currentMode: window.currentMode
                };
            });
            
            console.log('📊 재검색 후 상태:', retryState);
            
            if (retryState.searchParcelsCount === 0) {
                console.log('❌ 재검색도 실패 - 검색 시스템 문제일 수 있음');
                
                // 수동으로 highlightParcel 호출
                console.log('🔧 수동 폴리곤 생성 시도...');
                await page.evaluate(() => {
                    const testData = {
                        geometry: {
                            type: 'Polygon',
                            coordinates: [[[126.978, 37.566], [126.979, 37.566], [126.979, 37.567], [126.978, 37.567], [126.978, 37.566]]]
                        },
                        properties: { PNU: 'manual_test_001', JIBUN: '수동 테스트 1번' }
                    };
                    
                    if (typeof highlightParcel === 'function') {
                        highlightParcel(testData, '수동 테스트 1번지');
                        console.log('✅ 수동 폴리곤 생성 완료');
                    }
                });
                
                await page.waitForTimeout(3000);
            }
        }
        
        // 최종 검색 후 상태
        const finalSearchState = await page.evaluate(() => {
            let activePolygonCount = 0;
            let activeLabelCount = 0;
            
            if (window.searchParcels) {
                window.searchParcels.forEach((parcelInfo, pnu) => {
                    if (parcelInfo.polygon && parcelInfo.polygon.getMap()) {
                        activePolygonCount++;
                    }
                    if (parcelInfo.label && parcelInfo.label.getMap()) {
                        activeLabelCount++;
                    }
                });
            }
            
            return {
                searchParcelsCount: window.searchParcels ? window.searchParcels.size : 0,
                activePolygonCount: activePolygonCount,
                activeLabelCount: activeLabelCount,
                sessionStorageData: !!sessionStorage.getItem('searchParcels'),
                sessionStorageSize: Object.keys(JSON.parse(sessionStorage.getItem('searchParcels') || '{}')).length
            };
        });
        
        console.log('📊 검색 완료 후 최종 상태:', finalSearchState);
        
        if (finalSearchState.searchParcelsCount === 0) {
            console.log('❌ 모든 검색 시도 실패 - 테스트 중단');
            return;
        }
        
        console.log('✅ 검색 성공! 새로고침 테스트 진행...');
        
        // 3단계: 새로고침
        console.log('🔄 3단계: 새로고침 실행...');
        await page.reload();
        await page.waitForTimeout(10000); // 복원까지 충분한 대기
        
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
        console.log('📋 폴리곤 상세:', afterRefreshState.polygonDetails);
        
        // 4단계: 최종 진단
        console.log('\\n🎯 최종 진단:');
        
        if (afterRefreshState.activeLabelCount > 0 && afterRefreshState.activePolygonCount === 0) {
            console.log('🔴 CONFIRMED: 사용자 보고와 정확히 일치!');
            console.log('   - 라벨은 복원됨: ' + afterRefreshState.activeLabelCount + '개');
            console.log('   - 폴리곤은 사라짐: ' + afterRefreshState.activePolygonCount + '개');
            
            if (afterRefreshState.polygonCount > 0) {
                console.log('🔍 원인: 폴리곤 객체는 생성되었지만 지도에서 분리됨');
            } else {
                console.log('🔍 원인: 폴리곤 객체 자체가 생성되지 않음');
            }
        } else if (afterRefreshState.activePolygonCount > 0 && afterRefreshState.activeLabelCount > 0) {
            console.log('✅ 정상: 폴리곤과 라벨 모두 복원됨');
        } else {
            console.log('⚠️ 다른 상황:', afterRefreshState);
        }
        
        // 복원 관련 로그 확인
        console.log('\\n📋 새로고침 후 복원 로그:');
        const refreshLogs = logs.filter(log => 
            log.includes('복원') ||
            log.includes('Bootstrap') ||
            log.includes('Early') ||
            log.includes('🟣')
        );
        
        refreshLogs.slice(-10).forEach(log => console.log(`  ${log}`));
        
    });
    
});