const { test, expect } = require('@playwright/test');

test.describe('수정된 검색 필지 복원 테스트', () => {
    
    test('Early Bootstrap 방식으로 검색 필지 복원 테스트', async ({ page }) => {
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
        await page.waitForTimeout(5000); // 지도 로딩을 위한 충분한 대기
        
        console.log('✅ 페이지 로드 완료');
        
        // 테스트 데이터 저장 및 Early Bootstrap 함수 존재 확인
        const setupResult = await page.evaluate(() => {
            // 1단계: 테스트 데이터 저장
            const testData = {
                'test_pnu_1': {
                    data: { test: 'data1' },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [[[126.978, 37.566], [126.979, 37.566], [126.979, 37.567], [126.978, 37.567], [126.978, 37.566]]]
                    },
                    properties: { PNU: 'test_pnu_1', JIBUN: '테스트 1번' },
                    displayText: '테스트동 1번지',
                    timestamp: Date.now()
                }
            };
            
            sessionStorage.setItem('searchParcels', JSON.stringify(testData));
            
            // 2단계: 함수 존재 확인
            return {
                sessionDataSaved: !!sessionStorage.getItem('searchParcels'),
                earlyRestoreExists: typeof window.earlyRestoreSearchParcels === 'function',
                testEarlyRestoreExists: typeof window.testEarlyRestore === 'function',
                mapExists: !!window.map,
                searchParcelsExists: !!window.searchParcels,
                formatJibunExists: typeof formatJibun === 'function',
                dataKeys: Object.keys(JSON.parse(sessionStorage.getItem('searchParcels') || '{}')).length
            };
        });
        
        console.log('📊 설정 결과:', setupResult);
        
        if (!setupResult.earlyRestoreExists) {
            console.log('❌ Early Bootstrap 함수가 존재하지 않음!');
            return;
        }
        
        // 새로고침 전 수동으로 복원 함수 테스트
        console.log('🧪 새로고침 전 복원 함수 테스트...');
        const preRestoreResult = await page.evaluate(() => {
            if (typeof window.testEarlyRestore === 'function') {
                return window.testEarlyRestore();
            }
            return false;
        });
        
        console.log('🔧 새로고침 전 수동 복원 결과:', preRestoreResult);
        
        await page.waitForTimeout(2000);
        
        // 복원 후 상태 확인
        const preRestoreCount = await page.evaluate(() => {
            return window.searchParcels ? window.searchParcels.size : 0;
        });
        
        console.log('📊 새로고침 전 복원된 필지 수:', preRestoreCount);
        
        // 새로고침
        console.log('🔄 페이지 새로고침...');
        await page.reload();
        await page.waitForTimeout(7000); // 새로고침 후 충분한 대기
        
        // 새로고침 후 상태 확인
        const postRefreshResult = await page.evaluate(() => {
            return {
                sessionDataExists: !!sessionStorage.getItem('searchParcels'),
                earlyRestoreExists: typeof window.earlyRestoreSearchParcels === 'function',
                testEarlyRestoreExists: typeof window.testEarlyRestore === 'function',
                mapExists: !!window.map,
                searchParcelsExists: !!window.searchParcels,
                searchParcelsCount: window.searchParcels ? window.searchParcels.size : 0,
                formatJibunExists: typeof formatJibun === 'function',
                dataKeys: Object.keys(JSON.parse(sessionStorage.getItem('searchParcels') || '{}')).length
            };
        });
        
        console.log('📊 새로고침 후 상태:', postRefreshResult);
        
        // 자동 복원이 실패했다면 수동 복원 시도
        if (postRefreshResult.searchParcelsCount === 0 && postRefreshResult.testEarlyRestoreExists) {
            console.log('🧪 자동 복원 실패, 수동 복원 시도...');
            
            const manualRestoreResult = await page.evaluate(() => {
                return window.testEarlyRestore();
            });
            
            console.log('🔧 수동 복원 결과:', manualRestoreResult);
            await page.waitForTimeout(2000);
            
            const finalCount = await page.evaluate(() => {
                return window.searchParcels ? window.searchParcels.size : 0;
            });
            
            console.log('📊 수동 복원 후 필지 수:', finalCount);
        }
        
        // Bootstrap 관련 로그 필터링
        console.log('\n📋 Bootstrap 관련 로그:');
        const bootstrapLogs = logs.filter(log => 
            log.includes('Bootstrap') || 
            log.includes('ULTRATHINK') ||
            log.includes('복원') ||
            log.includes('Early') ||
            log.includes('🟣') ||
            log.includes('🚀')
        );
        
        bootstrapLogs.forEach(log => console.log(`  ${log}`));
        
        // 결과 판정
        console.log('\n🎯 최종 결과:');
        if (postRefreshResult.searchParcelsCount > 0) {
            console.log('✅ SUCCESS: 검색 필지가 새로고침 후 복원됨!');
        } else if (postRefreshResult.sessionDataExists && !postRefreshResult.searchParcelsCount) {
            console.log('⚠️ PARTIAL: sessionStorage 데이터는 있지만 복원 실패');
        } else {
            console.log('❌ FAIL: 검색 필지 복원 완전 실패');
        }
        
        // 의존성 문제 진단
        if (!postRefreshResult.mapExists) {
            console.log('🔧 ISSUE: window.map이 준비되지 않음');
        }
        if (!postRefreshResult.formatJibunExists) {
            console.log('🔧 ISSUE: formatJibun 함수가 준비되지 않음');
        }
        if (!postRefreshResult.earlyRestoreExists) {
            console.log('🔧 ISSUE: earlyRestoreSearchParcels 함수가 준비되지 않음');
        }
        
    });
    
});