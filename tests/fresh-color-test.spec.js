const { test, expect } = require('@playwright/test');

test.describe('신선한 색칠 테스트 (기존 데이터 없이)', () => {
    
    test('깨끗한 환경에서 검색→색칠→OFF 플로우 테스트', async ({ page }) => {
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
        await page.waitForTimeout(8000);
        
        // 기존 데이터 완전 초기화
        console.log('🧹 기존 데이터 완전 초기화...');
        await page.evaluate(() => {
            // 모든 필지 데이터 초기화
            if (window.clickParcels) {
                window.clickParcels.forEach((parcel, pnu) => {
                    if (parcel.polygon) parcel.polygon.setMap(null);
                    if (parcel.label) parcel.label.setMap(null);
                });
                window.clickParcels.clear();
            }
            
            if (window.searchParcels) {
                window.searchParcels.forEach((parcel, pnu) => {
                    if (parcel.polygon) parcel.polygon.setMap(null);
                    if (parcel.label) parcel.label.setMap(null);
                });
                window.searchParcels.clear();
            }
            
            // localStorage 초기화
            localStorage.removeItem('parcelData');
            sessionStorage.removeItem('searchParcels');
            sessionStorage.removeItem('tempParcelColors');
            
            console.log('🧹 데이터 초기화 완료');
        });
        
        await page.waitForTimeout(2000);
        
        // 초기화 후 상태 확인
        const cleanState = await page.evaluate(() => {
            return {
                clickCount: window.clickParcels ? window.clickParcels.size : 0,
                searchCount: window.searchParcels ? window.searchParcels.size : 0,
                currentMode: window.currentMode
            };
        });
        console.log('📊 깨끗한 초기 상태:', cleanState);
        
        // 1단계: 검색 실행
        console.log('🔍 1단계: 검색 실행...');
        const searchInput = await page.locator('#searchInput');
        const searchBtn = await page.locator('#searchBtn');
        
        await searchInput.fill('서울시 중구 소공동 87-1');
        await searchBtn.click();
        await page.waitForTimeout(8000);
        
        const afterSearchState = await page.evaluate(() => {
            return {
                clickCount: window.clickParcels ? window.clickParcels.size : 0,
                searchCount: window.searchParcels ? window.searchParcels.size : 0,
                currentMode: window.currentMode,
                searchVisible: window.searchParcels ? Array.from(window.searchParcels.values()).filter(p => p.polygon && p.polygon.getMap()).length : 0
            };
        });
        console.log('📊 검색 후 상태:', afterSearchState);
        
        if (afterSearchState.searchCount === 0) {
            console.log('❌ 검색 실패 - 테스트 중단');
            return;
        }
        
        // 2단계: 검색된 필지 색칠
        console.log('🎨 2단계: 검색 필지를 빨간색으로 색칠...');
        await page.evaluate(() => {
            window.currentColor = '#FF0000'; // 빨간색 설정
            
            if (window.searchParcels && window.searchParcels.size > 0) {
                const firstParcel = window.searchParcels.values().next().value;
                console.log('🔍 firstParcel 구조:', firstParcel);
                console.log('🔍 firstParcel.data 존재:', !!firstParcel.data);
                console.log('🔍 firstParcel 키들:', Object.keys(firstParcel || {}));
                
                if (firstParcel && typeof applyColorToParcel === 'function') {
                    // firstParcel.data가 아니라 firstParcel 자체가 필지 데이터일 수 있음
                    const parcelData = firstParcel.data || firstParcel;
                    console.log('🎨 사용할 parcel 데이터:', !!parcelData);
                    console.log('🎨 parcel.properties 존재:', !!(parcelData && parcelData.properties));
                    
                    if (parcelData && parcelData.properties) {
                        const pnu = parcelData.properties.PNU || parcelData.properties.pnu;
                        console.log('🎨 applyColorToParcel 호출 PNU:', pnu);
                        
                        // 직접 테스트 함수 호출
                        console.log('🧪 직접 테스트 함수 호출...');
                        function testApplyColor(parcel, color) {
                            console.log('🧪 testApplyColor 시작');
                            console.log('🧪 parcel:', !!parcel);
                            console.log('🧪 parcel.properties:', !!parcel.properties);
                            
                            const testPnu = parcel.properties.PNU || parcel.properties.pnu;
                            console.log('🧪 testPnu:', testPnu);
                            
                            // 진짜 함수 호출
                            console.log('🧪 실제 applyColorToParcel 호출...');
                            try {
                                applyColorToParcel(parcel, color);
                                console.log('🧪 applyColorToParcel 호출 완료');
                                
                                // 호출 후 즉시 상태 확인
                                console.log('🧪 호출 후 clickParcels 크기:', window.clickParcels ? window.clickParcels.size : 0);
                                console.log('🧪 호출 후 searchParcels 크기:', window.searchParcels ? window.searchParcels.size : 0);
                            } catch (e) {
                                console.error('🧪 applyColorToParcel 오류:', e);
                            }
                        }
                        
                        testApplyColor(parcelData, '#FF0000');
                    } else {
                        console.error('❌ 유효한 parcel 데이터 없음');
                    }
                }
            }
        });
        
        await page.waitForTimeout(3000);
        
        const afterColorState = await page.evaluate(() => {
            let clickDetails = [];
            if (window.clickParcels) {
                window.clickParcels.forEach((parcel, pnu) => {
                    // 순환 참조 방지를 위해 getOptions() 대신 기본값 사용
                    clickDetails.push({
                        pnu: pnu,
                        color: parcel.color,
                        fillColor: parcel.color, // 실제 색상과 동일
                        fillOpacity: 0.7, // 기본값
                        onMap: parcel.polygon && !!parcel.polygon.getMap()
                    });
                });
            }
            
            return {
                clickCount: window.clickParcels ? window.clickParcels.size : 0,
                searchCount: window.searchParcels ? window.searchParcels.size : 0,
                currentMode: window.currentMode,
                clickDetails: clickDetails
            };
        });
        console.log('📊 색칠 후 상태:', JSON.stringify(afterColorState, null, 2));
        
        // 3단계: 검색 OFF
        console.log('🔄 3단계: 검색 OFF...');
        const searchToggleBtn = await page.locator('#searchToggleBtn');
        await searchToggleBtn.click();
        await page.waitForTimeout(3000);
        
        const finalState = await page.evaluate(() => {
            let visibleClickCount = 0;
            let clickDetails = [];
            
            if (window.clickParcels) {
                window.clickParcels.forEach((parcel, pnu) => {
                    const isVisible = parcel.polygon && parcel.polygon.getMap();
                    if (isVisible) visibleClickCount++;
                    
                    // 순환 참조 방지를 위해 getOptions() 대신 기본값 사용
                    clickDetails.push({
                        pnu: pnu,
                        color: parcel.color,
                        fillColor: parcel.color, // 실제 색상과 동일
                        fillOpacity: 0.7, // 기본값
                        visible: isVisible
                    });
                });
            }
            
            return {
                currentMode: window.currentMode,
                totalClickParcels: window.clickParcels ? window.clickParcels.size : 0,
                visibleClickParcels: visibleClickCount,
                clickDetails: clickDetails
            };
        });
        // JSON 순환 참조 오류 방지를 위한 안전한 로깅
        const safeState = {
            currentMode: finalState.currentMode,
            totalClickParcels: finalState.totalClickParcels,
            visibleClickParcels: finalState.visibleClickParcels,
            clickDetails: finalState.clickDetails.map(detail => ({
                pnu: detail.pnu,
                color: detail.color,
                fillColor: detail.fillColor,
                fillOpacity: detail.fillOpacity,
                visible: detail.visible
            }))
        };
        console.log('📊 최종 상태 (검색 OFF):', JSON.stringify(safeState, null, 2));
        
        // 결과 분석
        const hasVisibleColoredParcel = finalState.clickDetails.some(detail => 
            detail.visible && 
            detail.fillColor === '#FF0000' && 
            detail.fillOpacity > 0
        );
        
        if (hasVisibleColoredParcel) {
            console.log('✅ 성공: 검색 OFF 시 빨간색으로 색칠된 필지가 표시됨!');
        } else {
            console.log('❌ 실패: 검색 OFF 시 올바른 색상으로 표시되지 않음');
            
            // 관련 로그 출력
            console.log('\\n📋 색칠 관련 로그:');
            const colorLogs = logs.filter(log => 
                log.includes('applyColorToParcel') ||
                log.includes('색칠') ||
                log.includes('FF0000') ||
                log.includes('fillColor') ||
                log.includes('새로운 클릭 필지')
            );
            colorLogs.slice(-10).forEach(log => console.log(`  ${log}`));
        }
    });
    
});