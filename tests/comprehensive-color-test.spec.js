const { test, expect } = require('@playwright/test');

test.describe('포괄적 색칠 시스템 테스트', () => {
    
    test('모든 시나리오 테스트: 검색/클릭/모드전환', async ({ page }) => {
        const logs = [];
        page.on('console', msg => {
            logs.push(`${msg.type()}: ${msg.text()}`);
        });
        
        // 1단계: 페이지 로드
        console.log('🔍 1단계: 페이지 로딩...');
        try {
            await page.goto('http://localhost:3000', { timeout: 15000 });
        } catch (e) {
            await page.goto('http://localhost:5000', { timeout: 15000 });
        }
        
        await page.waitForSelector('body', { timeout: 10000 });
        await page.waitForTimeout(8000);
        console.log('✅ 1단계 완료: 페이지 로드');
        
        // 초기 상태 확인
        const initialState = await page.evaluate(() => {
            return {
                currentMode: window.currentMode,
                searchParcelsCount: window.searchParcels ? window.searchParcels.size : 0,
                clickParcelsCount: window.clickParcels ? window.clickParcels.size : 0
            };
        });
        console.log('📊 초기 상태:', initialState);
        
        // 2단계: 검색 모드에서 검색 실행
        console.log('🔍 2단계: 검색 모드에서 검색...');
        
        const searchInput = await page.locator('#searchInput');
        const searchBtn = await page.locator('#searchBtn');
        
        await searchInput.fill('서울시 중구 소공동 87-1');
        await searchBtn.click();
        await page.waitForTimeout(10000);
        
        const afterSearchState = await page.evaluate(() => {
            let visibleSearchParcels = 0;
            let visibleClickParcels = 0;
            
            if (window.searchParcels) {
                window.searchParcels.forEach(parcel => {
                    if (parcel.polygon && parcel.polygon.getMap()) visibleSearchParcels++;
                });
            }
            
            if (window.clickParcels) {
                window.clickParcels.forEach(parcel => {
                    if (parcel.polygon && parcel.polygon.getMap()) visibleClickParcels++;
                });
            }
            
            return {
                currentMode: window.currentMode,
                searchParcelsCount: window.searchParcels ? window.searchParcels.size : 0,
                clickParcelsCount: window.clickParcels ? window.clickParcels.size : 0,
                visibleSearchParcels: visibleSearchParcels,
                visibleClickParcels: visibleClickParcels
            };
        });
        
        console.log('✅ 2단계 완료: 검색 실행');
        console.log('📊 검색 후 상태:', afterSearchState);
        
        // 검색 실패 시 테스트 중단
        if (afterSearchState.searchParcelsCount === 0) {
            console.log('❌ 검색 실패 - 테스트 중단');
            return;
        }
        
        // 3단계: 검색 모드에서 검색된 필지 색칠
        console.log('🎨 3단계: 검색 필지 색칠...');
        
        await page.evaluate(() => {
            window.currentColor = '#FF0000'; // 빨간색으로 설정
            
            if (window.searchParcels && window.searchParcels.size > 0) {
                const firstParcel = window.searchParcels.values().next().value;
                if (firstParcel && firstParcel.data && typeof applyColorToParcel === 'function') {
                    console.log('검색 필지에 빨간색 적용...');
                    applyColorToParcel(firstParcel.data, '#FF0000');
                }
            }
        });
        
        await page.waitForTimeout(3000);
        
        const afterColorState = await page.evaluate(() => {
            let visibleSearchParcels = 0;
            let visibleClickParcels = 0;
            let searchParcelColors = [];
            let clickParcelColors = [];
            
            if (window.searchParcels) {
                window.searchParcels.forEach(parcel => {
                    if (parcel.polygon && parcel.polygon.getMap()) {
                        visibleSearchParcels++;
                        searchParcelColors.push(parcel.color || 'purple');
                    }
                });
            }
            
            if (window.clickParcels) {
                window.clickParcels.forEach(parcel => {
                    if (parcel.polygon && parcel.polygon.getMap()) {
                        visibleClickParcels++;
                        clickParcelColors.push(parcel.color || 'unknown');
                    }
                });
            }
            
            return {
                currentMode: window.currentMode,
                searchParcelsCount: window.searchParcels ? window.searchParcels.size : 0,
                clickParcelsCount: window.clickParcels ? window.clickParcels.size : 0,
                visibleSearchParcels: visibleSearchParcels,
                visibleClickParcels: visibleClickParcels,
                searchParcelColors: searchParcelColors,
                clickParcelColors: clickParcelColors
            };
        });
        
        console.log('✅ 3단계 완료: 검색 필지 색칠');
        console.log('📊 색칠 후 상태:', afterColorState);
        
        // 4단계: 검색 OFF로 전환
        console.log('🔄 4단계: 검색 OFF로 전환...');
        
        const searchToggleBtn = await page.locator('#searchToggleBtn');
        await searchToggleBtn.click();
        await page.waitForTimeout(5000);
        
        const afterToggleState = await page.evaluate(() => {
            let visibleSearchParcels = 0;
            let visibleClickParcels = 0;
            let searchParcelColors = [];
            let clickParcelColors = [];
            
            if (window.searchParcels) {
                window.searchParcels.forEach(parcel => {
                    if (parcel.polygon && parcel.polygon.getMap()) {
                        visibleSearchParcels++;
                        searchParcelColors.push(parcel.color || 'purple');
                    }
                });
            }
            
            if (window.clickParcels) {
                window.clickParcels.forEach(parcel => {
                    if (parcel.polygon && parcel.polygon.getMap()) {
                        visibleClickParcels++;
                        clickParcelColors.push(parcel.color || 'unknown');
                    }
                });
            }
            
            return {
                currentMode: window.currentMode,
                searchParcelsCount: window.searchParcels ? window.searchParcels.size : 0,
                clickParcelsCount: window.clickParcels ? window.clickParcels.size : 0,
                visibleSearchParcels: visibleSearchParcels,
                visibleClickParcels: visibleClickParcels,
                searchParcelColors: searchParcelColors,
                clickParcelColors: clickParcelColors
            };
        });
        
        console.log('✅ 4단계 완료: 검색 OFF');
        console.log('📊 검색 OFF 후 상태:', afterToggleState);
        
        // 5단계: 클릭 모드에서 일반 필지 클릭 색칠 테스트
        console.log('🎨 5단계: 클릭 모드에서 일반 색칠 테스트...');
        
        const mapElement = await page.locator('#map');
        await mapElement.click({ position: { x: 300, y: 200 } });
        await page.waitForTimeout(5000);
        
        const afterClickState = await page.evaluate(() => {
            let visibleSearchParcels = 0;
            let visibleClickParcels = 0;
            
            if (window.searchParcels) {
                window.searchParcels.forEach(parcel => {
                    if (parcel.polygon && parcel.polygon.getMap()) visibleSearchParcels++;
                });
            }
            
            if (window.clickParcels) {
                window.clickParcels.forEach(parcel => {
                    if (parcel.polygon && parcel.polygon.getMap()) visibleClickParcels++;
                });
            }
            
            return {
                currentMode: window.currentMode,
                searchParcelsCount: window.searchParcels ? window.searchParcels.size : 0,
                clickParcelsCount: window.clickParcels ? window.clickParcels.size : 0,
                visibleSearchParcels: visibleSearchParcels,
                visibleClickParcels: visibleClickParcels
            };
        });
        
        console.log('✅ 5단계 완료: 클릭 색칠 테스트');
        console.log('📊 클릭 후 상태:', afterClickState);
        
        // 6단계: 최종 결과 분석
        console.log('\\n🎯 최종 결과 분석:');
        
        // 문제 1: 검색 OFF 시 검색 필지가 보이는지 확인
        if (afterToggleState.currentMode === 'click' && afterToggleState.visibleSearchParcels > 0) {
            console.log('🔴 문제 1 발견: 검색 OFF 상태인데 검색 필지가 보임!');
            console.log(`   - 보이는 검색 필지: ${afterToggleState.visibleSearchParcels}개`);
        } else {
            console.log('✅ 문제 1 정상: 검색 OFF 시 검색 필지 숨김됨');
        }
        
        // 문제 2: 클릭 색칠이 작동하는지 확인
        if (afterClickState.visibleClickParcels === afterToggleState.visibleClickParcels) {
            console.log('🔴 문제 2 발견: 클릭으로 색칠이 안됨!');
        } else {
            console.log('✅ 문제 2 정상: 클릭 색칠이 작동함');
        }
        
        // 전체 상황 요약
        console.log('\\n📋 전체 상황 요약:');
        console.log(`초기: 검색=${initialState.searchParcelsCount}, 클릭=${initialState.clickParcelsCount}`);
        console.log(`검색후: 검색=${afterSearchState.searchParcelsCount}, 클릭=${afterSearchState.clickParcelsCount}, 보이는검색=${afterSearchState.visibleSearchParcels}`);
        console.log(`색칠후: 검색=${afterColorState.searchParcelsCount}, 클릭=${afterColorState.clickParcelsCount}, 보이는클릭=${afterColorState.visibleClickParcels}`);
        console.log(`OFF후: 검색=${afterToggleState.searchParcelsCount}, 클릭=${afterToggleState.clickParcelsCount}, 보이는검색=${afterToggleState.visibleSearchParcels}, 보이는클릭=${afterToggleState.visibleClickParcels}`);
        console.log(`클릭후: 검색=${afterClickState.searchParcelsCount}, 클릭=${afterClickState.clickParcelsCount}, 보이는클릭=${afterClickState.visibleClickParcels}`);
        
    });
    
});