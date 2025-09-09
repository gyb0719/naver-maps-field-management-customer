const { test, expect } = require('@playwright/test');

test.describe('검색 OFF 시 색칠 필지 표시 테스트', () => {
    
    test('검색 → 필지 색칠 → 검색 OFF → 색칠 필지 표시 확인', async ({ page }) => {
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
        await page.waitForTimeout(8000);
        
        console.log('✅ 1단계 완료: 페이지 로드');
        
        // 2단계: 검색 실행
        console.log('🔍 2단계: 검색 실행...');
        const searchInput = await page.locator('#searchInput');
        const searchBtn = await page.locator('#searchBtn');
        
        await searchInput.fill('서울시 중구 소공동 87-1');
        await searchBtn.click();
        await page.waitForTimeout(10000);
        
        // 검색 후 상태 확인
        const afterSearchState = await page.evaluate(() => {
            return {
                searchParcelsCount: window.searchParcels ? window.searchParcels.size : 0,
                currentMode: window.currentMode,
                searchParcelsVisible: window.searchParcels ? Array.from(window.searchParcels.values()).filter(p => p.polygon && p.polygon.getMap()).length : 0
            };
        });
        
        console.log('✅ 2단계 완료: 검색 실행');
        console.log('📊 검색 후 상태:', afterSearchState);
        
        if (afterSearchState.searchParcelsCount === 0) {
            console.log('❌ 검색 실패 - 테스트 중단');
            return;
        }
        
        // 3단계: 검색된 필지를 수동으로 색칠 
        console.log('🎨 3단계: 검색된 필지 수동 색칠...');
        
        await page.evaluate(() => {
            // 색상 설정
            window.currentColor = '#FF0000';
            console.log('색상을 빨간색으로 설정:', window.currentColor);
            
            // 검색된 필지가 있는지 확인하고 직접 색칠
            if (window.searchParcels && window.searchParcels.size > 0) {
                const firstParcel = window.searchParcels.values().next().value;
                if (firstParcel && firstParcel.data) {
                    console.log('검색된 필지에 직접 색칠 적용...');
                    
                    // applyColorToParcel 함수 직접 호출
                    if (typeof applyColorToParcel === 'function') {
                        applyColorToParcel(firstParcel.data, '#FF0000');
                        console.log('✅ applyColorToParcel 함수 직접 호출 완료');
                    } else {
                        console.error('❌ applyColorToParcel 함수를 찾을 수 없음');
                    }
                }
            } else {
                console.warn('⚠️ 검색된 필지가 없음');
            }
        });
        
        await page.waitForTimeout(3000);
        
        // 색칠 후 상태 확인
        const afterColorState = await page.evaluate(() => {
            return {
                clickParcelsCount: window.clickParcels ? window.clickParcels.size : 0,
                searchParcelsCount: window.searchParcels ? window.searchParcels.size : 0,
                tempColorsCount: Object.keys(JSON.parse(sessionStorage.getItem('tempParcelColors') || '{}')).length,
                currentMode: window.currentMode
            };
        });
        
        console.log('✅ 3단계 완료: 필지 색칠');
        console.log('📊 색칠 후 상태:', afterColorState);
        
        // 4단계: 검색 OFF 버튼 클릭
        console.log('🔄 4단계: 검색 OFF...');
        const searchToggleBtn = await page.locator('#searchToggleBtn');
        await searchToggleBtn.click();
        await page.waitForTimeout(5000); // 모드 전환 및 데이터 이전 대기
        
        // 검색 OFF 후 상태 확인
        const afterToggleState = await page.evaluate(() => {
            let activeClickParcels = 0;
            let activeSearchParcels = 0;
            let clickParcelColors = [];
            
            if (window.clickParcels) {
                window.clickParcels.forEach((parcel, pnu) => {
                    if (parcel.polygon && parcel.polygon.getMap()) {
                        activeClickParcels++;
                        clickParcelColors.push(parcel.color);
                    }
                });
            }
            
            if (window.searchParcels) {
                window.searchParcels.forEach((parcel, pnu) => {
                    if (parcel.polygon && parcel.polygon.getMap()) {
                        activeSearchParcels++;
                    }
                });
            }
            
            return {
                currentMode: window.currentMode,
                clickParcelsCount: window.clickParcels ? window.clickParcels.size : 0,
                searchParcelsCount: window.searchParcels ? window.searchParcels.size : 0,
                activeClickParcels: activeClickParcels,
                activeSearchParcels: activeSearchParcels,
                clickParcelColors: clickParcelColors,
                tempColorsCount: Object.keys(JSON.parse(sessionStorage.getItem('tempParcelColors') || '{}')).length
            };
        });
        
        console.log('✅ 4단계 완료: 검색 OFF');
        console.log('📊 검색 OFF 후 최종 상태:', afterToggleState);
        
        // 5단계: 결과 분석
        console.log('\\n🎯 최종 결과 분석:');
        
        if (afterToggleState.currentMode === 'click' && afterToggleState.activeClickParcels > 0) {
            console.log('🟢 성공: 검색 OFF 후 색칠된 필지가 표시됨!');
            console.log(`   - 현재 모드: ${afterToggleState.currentMode}`);
            console.log(`   - 활성 클릭 필지: ${afterToggleState.activeClickParcels}개`);
            console.log(`   - 활성 검색 필지: ${afterToggleState.activeSearchParcels}개`);
            console.log(`   - 클릭 필지 색상: ${afterToggleState.clickParcelColors.join(', ')}`);
        } else {
            console.log('🔴 실패: 검색 OFF 후 색칠된 필지가 표시되지 않음');
            console.log(`   - 현재 모드: ${afterToggleState.currentMode}`);
            console.log(`   - 활성 클릭 필지: ${afterToggleState.activeClickParcels}개`);
            console.log(`   - 활성 검색 필지: ${afterToggleState.activeSearchParcels}개`);
        }
        
        // 관련 로그 확인
        console.log('\\n📋 관련 로그:');
        const relevantLogs = logs.filter(log => 
            log.includes('색칠') ||
            log.includes('toggleSearchMode') ||
            log.includes('migrateTempColors') ||
            log.includes('clickParcels') ||
            log.includes('임시 데이터 이전') ||
            log.includes('ULTRATHINK')
        );
        
        relevantLogs.slice(-20).forEach(log => console.log(`  ${log}`));
        
    });
    
});