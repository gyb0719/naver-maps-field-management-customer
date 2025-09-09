const { test, expect } = require('@playwright/test');

test.describe('SessionStorage 디버그 테스트', () => {
    
    test('sessionStorage가 제대로 작동하는지 확인', async ({ page }) => {
        // 콘솔 로그 캡처
        const logs = [];
        page.on('console', msg => {
            logs.push(`${msg.type()}: ${msg.text()}`);
        });
        
        // 페이지 로드 (3000 포트 시도)
        console.log('🔍 페이지 로딩 시도...');
        
        try {
            await page.goto('http://localhost:3000', { timeout: 10000 });
        } catch (e) {
            console.log('3000 포트 실패, 5000 포트 시도...');
            await page.goto('http://localhost:5000', { timeout: 10000 });
        }
        
        // 기본 요소 대기
        await page.waitForSelector('body', { timeout: 10000 });
        await page.waitForTimeout(3000);
        
        console.log('✅ 페이지 로드 완료');
        
        // sessionStorage 테스트 데이터 저장
        console.log('💾 sessionStorage 테스트 데이터 저장...');
        await page.evaluate(() => {
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
                },
                'test_pnu_2': {
                    data: { test: 'data2' },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [[[126.980, 37.568], [126.981, 37.568], [126.981, 37.569], [126.980, 37.569], [126.980, 37.568]]]
                    },
                    properties: { PNU: 'test_pnu_2', JIBUN: '테스트 2번' },
                    displayText: '테스트동 2번지',
                    timestamp: Date.now()
                }
            };
            
            sessionStorage.setItem('searchParcels', JSON.stringify(testData));
            console.log('💾 테스트 데이터 저장 완료:', Object.keys(testData));
            
            return Object.keys(testData).length;
        });
        
        // 저장된 데이터 확인
        const savedDataBefore = await page.evaluate(() => {
            const data = sessionStorage.getItem('searchParcels');
            console.log('확인된 sessionStorage 데이터:', data);
            return data;
        });
        
        console.log('📊 새로고침 전 데이터:', savedDataBefore ? '있음' : '없음');
        
        // 새로고침
        console.log('🔄 페이지 새로고침...');
        await page.reload();
        await page.waitForTimeout(2000);
        
        // 새로고침 후 데이터 확인
        const savedDataAfter = await page.evaluate(() => {
            const data = sessionStorage.getItem('searchParcels');
            console.log('새로고침 후 sessionStorage 데이터:', data);
            return data;
        });
        
        console.log('📊 새로고침 후 데이터:', savedDataAfter ? '있음' : '없음');
        
        // 복원 함수 존재 여부 확인
        const restoreFunctionCheck = await page.evaluate(() => {
            return {
                restoreFunction: typeof window.restoreSearchParcelsFromSession === 'function',
                testFunction: typeof window.testSearchRestore === 'function',
                searchParcelsExists: !!window.searchParcels,
                mapExists: !!window.map,
                formatJibunExists: typeof formatJibun === 'function'
            };
        });
        
        console.log('🔧 함수 존재 여부:', restoreFunctionCheck);
        
        // 수동으로 복원 함수 호출
        if (restoreFunctionCheck.testFunction) {
            console.log('🧪 수동 복원 함수 호출...');
            await page.evaluate(() => {
                window.testSearchRestore();
            });
            
            await page.waitForTimeout(2000);
            
            // 복원 결과 확인
            const restoredCount = await page.evaluate(() => {
                return window.searchParcels ? window.searchParcels.size : 0;
            });
            
            console.log('🔧 복원된 검색 필지 수:', restoredCount);
        }
        
        // 복원 관련 로그만 필터링
        console.log('\n📋 복원 관련 로그:');
        const restoreLogs = logs.filter(log => 
            log.includes('ULTRATHINK') || 
            log.includes('복원') || 
            log.includes('sessionStorage') ||
            log.includes('searchParcels') ||
            log.includes('🟣') ||
            log.includes('💾')
        );
        
        restoreLogs.forEach(log => console.log(`  ${log}`));
        
        // 결과 판정
        if (savedDataBefore && savedDataAfter) {
            console.log('\n✅ SessionStorage 데이터 유지됨');
        } else if (savedDataBefore && !savedDataAfter) {
            console.log('\n❌ BUG: SessionStorage 데이터 사라짐!');
        } else {
            console.log('\n⚠️ 초기 데이터 저장 실패');
        }
    });
    
});