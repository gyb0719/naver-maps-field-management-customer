const { test, expect } = require('@playwright/test');

test.describe('직접 라벨 테스트', () => {
    
    test('검색 모드를 강제로 설정하고 라벨 테스트', async ({ page }) => {
        // 콘솔 로그 캡처
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
        await page.waitForTimeout(6000); // 충분한 로딩 대기
        
        console.log('✅ 페이지 로드 완료');
        
        // 검색 모드 강제 설정 및 직접 라벨 테스트
        const testResult = await page.evaluate(() => {
            // 1. 강제로 검색 모드 설정
            window.currentMode = 'search';
            console.log('🔧 검색 모드 강제 설정:', window.currentMode);
            
            // 2. 테스트 데이터 준비
            const testParcelData = {
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[126.978, 37.566], [126.979, 37.566], [126.979, 37.567], [126.978, 37.567], [126.978, 37.566]]]
                },
                properties: { PNU: 'test_label_001', JIBUN: '테스트 라벨 999번' }
            };
            
            const displayText = '🟡 테스트 라벨 999번지';
            
            console.log('📦 테스트 데이터 준비 완료');
            console.log('🗺️ window.map 존재:', !!window.map);
            console.log('📝 highlightParcel 함수 존재:', typeof highlightParcel);
            
            // 3. 직접 highlightParcel 호출
            try {
                const result = highlightParcel(testParcelData, displayText);
                console.log('✅ highlightParcel 호출 완료');
                
                // 4. 2초 후 결과 확인
                setTimeout(() => {
                    const searchParcelsSize = window.searchParcels ? window.searchParcels.size : 0;
                    console.log('📊 검색 필지 개수:', searchParcelsSize);
                    
                    if (window.searchParcels && window.searchParcels.size > 0) {
                        const entries = Array.from(window.searchParcels.entries());
                        entries.forEach(([pnu, info]) => {
                            console.log(`🏷️ 저장된 라벨 정보 (${pnu}):`, {
                                hasLabel: !!info.label,
                                displayText: info.displayText,
                                hasPolygon: !!info.polygon
                            });
                        });
                    }
                }, 2000);
                
                return { success: true, message: 'highlightParcel 호출 성공' };
            } catch (error) {
                console.error('💥 highlightParcel 호출 실패:', error);
                console.error('💥 에러 스택:', error.stack);
                return { success: false, message: error.message, stack: error.stack };
            }
        });
        
        console.log('🎯 직접 테스트 결과:', testResult);
        
        // 3초 대기 후 최종 확인
        await page.waitForTimeout(3000);
        
        const finalCheck = await page.evaluate(() => {
            return {
                currentMode: window.currentMode,
                searchParcelsCount: window.searchParcels ? window.searchParcels.size : 0,
                mapExists: !!window.map
            };
        });
        
        console.log('📊 최종 상태 확인:', finalCheck);
        
        // 라벨 관련 로그 필터링
        console.log('\\n📋 라벨 생성 관련 로그:');
        const labelLogs = logs.filter(log => 
            log.includes('라벨') || 
            log.includes('ULTRATHINK') ||
            log.includes('highlightParcel') ||
            log.includes('검색 모드') ||
            log.includes('displayText') ||
            log.includes('노란색') ||
            log.includes('🏷️') ||
            log.includes('📝')
        );
        
        labelLogs.forEach(log => console.log(`  ${log}`));
        
        // 결과 판정
        console.log('\\n🎯 테스트 결과:');
        if (testResult.success && finalCheck.searchParcelsCount > 0) {
            console.log('✅ SUCCESS: 라벨 테스트 성공!');
        } else if (testResult.success) {
            console.log('⚠️ PARTIAL: 함수 호출은 성공했지만 저장되지 않음');
        } else {
            console.log('❌ FAIL: 라벨 테스트 실패');
        }
    });
    
});