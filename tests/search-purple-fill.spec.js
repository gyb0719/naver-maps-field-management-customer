const { test, expect } = require('@playwright/test');

test.describe('검색 필지 보라색 채우기 테스트', () => {
    
    test('검색 필지가 보라색으로 완전히 칠해지는지 확인', async ({ page }) => {
        // 콘솔 로그 캡처
        const logs = [];
        page.on('console', msg => {
            logs.push(`${msg.type()}: ${msg.text()}`);
        });
        
        // 페이지 로드
        console.log('🔍 페이지 로딩...');
        try {
            await page.goto('http://localhost:3000', { timeout: 10000 });
        } catch (e) {
            await page.goto('http://localhost:5000', { timeout: 10000 });
        }
        
        await page.waitForSelector('body', { timeout: 10000 });
        await page.waitForTimeout(5000); // 지도 로딩 대기
        
        console.log('✅ 페이지 로드 완료');
        
        // 테스트용 검색 필지 데이터 생성 및 하이라이트
        const searchResult = await page.evaluate(() => {
            // 테스트 필지 데이터
            const testParcelData = {
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[126.978, 37.566], [126.979, 37.566], [126.979, 37.567], [126.978, 37.567], [126.978, 37.566]]]
                },
                properties: { PNU: 'test_pnu_purple', JIBUN: '테스트 999번' }
            };
            
            const displayText = '서울시 중구 테스트동 999번지';
            
            // 전역 변수 상태 확인
            console.log('🌐 전역 변수 확인:');
            console.log('  - window.map:', typeof window.map);
            console.log('  - window.searchParcels:', typeof window.searchParcels);
            console.log('  - highlightParcel:', typeof highlightParcel);
            console.log('  - formatJibun:', typeof formatJibun);
            console.log('  - calculatePolygonCenter:', typeof calculatePolygonCenter);
            
            // highlightParcel 함수 호출
            if (typeof highlightParcel === 'function') {
                try {
                    console.log('🚀 highlightParcel 함수 호출 시작...');
                    highlightParcel(testParcelData, displayText);
                    console.log('✅ highlightParcel 함수 호출 성공');
                    return { success: true, message: 'highlightParcel 호출 성공' };
                } catch (error) {
                    console.error('❌ highlightParcel 함수 호출 실패:', error);
                    console.error('❌ 에러 스택:', error.stack);
                    return { success: false, message: error.message, stack: error.stack };
                }
            } else {
                console.error('❌ highlightParcel 함수를 찾을 수 없음');
                return { success: false, message: 'highlightParcel 함수 없음' };
            }
        });
        
        console.log('🎨 검색 필지 하이라이트 결과:', searchResult);
        
        // 2초 대기 후 폴리곤 스타일 확인
        await page.waitForTimeout(2000);
        
        // 생성된 폴리곤의 스타일 확인
        const polygonStyleCheck = await page.evaluate(() => {
            // 먼저 window.searchParcels 상태 확인
            console.log('🔍 window.searchParcels 존재 여부:', typeof window.searchParcels);
            console.log('🔍 window.searchParcels 크기:', window.searchParcels ? window.searchParcels.size : 'undefined');
            
            // 전역 변수들 확인
            const globalVars = {
                searchParcels: typeof window.searchParcels,
                searchParcelPolylines: typeof window.searchParcelPolylines,
                currentSelectedPNU: window.currentSelectedPNU
            };
            console.log('🌐 전역 변수 상태:', globalVars);
            
            // searchParcels에서 생성된 폴리곤 찾기
            if (window.searchParcels && window.searchParcels.size > 0) {
                const parcelEntries = Array.from(window.searchParcels.entries());
                console.log('📊 검색 필지 개수:', parcelEntries.length);
                
                const results = [];
                parcelEntries.forEach(([pnu, parcelInfo]) => {
                    console.log(`📄 필지 정보 (${pnu}):`, parcelInfo);
                    
                    if (parcelInfo.polygon) {
                        const fillColor = parcelInfo.polygon.getFillColor();
                        const fillOpacity = parcelInfo.polygon.getFillOpacity();
                        const strokeColor = parcelInfo.polygon.getStrokeColor();
                        const strokeOpacity = parcelInfo.polygon.getStrokeOpacity();
                        
                        results.push({
                            pnu: pnu,
                            fillColor: fillColor,
                            fillOpacity: fillOpacity,
                            strokeColor: strokeColor,
                            strokeOpacity: strokeOpacity
                        });
                        
                        console.log(`🎨 폴리곤 스타일 확인 (${pnu}):`, {
                            fillColor, fillOpacity, strokeColor, strokeOpacity
                        });
                    } else {
                        console.log(`❌ 폴리곤 없음 (${pnu})`);
                    }
                });
                
                return results;
            } else {
                console.log('❌ searchParcels가 비어있거나 존재하지 않음');
                
                // 혹시 다른 곳에 폴리곤이 저장되었는지 확인
                if (window.searchParcelPolylines && window.searchParcelPolylines.length > 0) {
                    console.log('🔍 searchParcelPolylines에 폴리곤 발견:', window.searchParcelPolylines.length);
                }
                
                return [];
            }
        });
        
        console.log('🎨 폴리곤 스타일 검사 결과:', polygonStyleCheck);
        
        // 보라색 관련 로그 필터링
        console.log('\\n📋 보라색 폴리곤 관련 로그:');
        const purpleLogs = logs.filter(log => 
            log.includes('보라색') || 
            log.includes('9370DB') ||
            log.includes('fillOpacity') ||
            log.includes('폴리곤') ||
            log.includes('스타일') ||
            log.includes('보호')
        );
        
        purpleLogs.forEach(log => console.log(`  ${log}`));
        
        // 결과 판정
        console.log('\\n🎯 최종 결과:');
        if (polygonStyleCheck.length > 0) {
            const polygon = polygonStyleCheck[0];
            if (polygon.fillOpacity >= 0.7 && polygon.fillColor === '#9370DB') {
                console.log('✅ SUCCESS: 검색 필지가 보라색으로 완전히 칠해짐!');
                console.log(`   - fillColor: ${polygon.fillColor}`);
                console.log(`   - fillOpacity: ${polygon.fillOpacity}`);
            } else {
                console.log('⚠️ PARTIAL: 폴리곤이 생성됐지만 스타일이 올바르지 않음');
                console.log(`   - fillColor: ${polygon.fillColor} (예상: #9370DB)`);
                console.log(`   - fillOpacity: ${polygon.fillOpacity} (예상: >= 0.7)`);
            }
        } else {
            console.log('❌ FAIL: 검색 필지 폴리곤이 생성되지 않음');
        }
        
    });
    
});