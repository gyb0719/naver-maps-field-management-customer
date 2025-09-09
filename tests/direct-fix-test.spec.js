const { test, expect } = require('@playwright/test');

test.describe('직접 수정 테스트', () => {
    
    test('투명한 필지들을 실제 색상으로 변경', async ({ page }) => {
        console.log('🔍 페이지 로딩...');
        try {
            await page.goto('http://localhost:3000', { timeout: 15000 });
        } catch (e) {
            await page.goto('http://localhost:5000', { timeout: 15000 });
        }
        
        await page.waitForSelector('body', { timeout: 10000 });
        await page.waitForTimeout(8000);
        
        // 직접 투명 필지들을 색상으로 변경
        console.log('🎨 투명 필지들을 빨간색으로 변경...');
        const result = await page.evaluate(() => {
            let fixedCount = 0;
            
            if (window.clickParcels) {
                window.clickParcels.forEach((parcel, pnu) => {
                    // 투명한 필지 찾기
                    if (parcel.color === 'transparent' && parcel.polygon) {
                        // 빨간색으로 변경
                        parcel.color = '#FF0000';
                        
                        // 폴리곤 스타일 업데이트
                        parcel.polygon.setOptions({
                            fillColor: '#FF0000',
                            fillOpacity: 0.7,
                            strokeColor: '#FF0000',
                            strokeOpacity: 1.0,
                            strokeWeight: 2
                        });
                        
                        fixedCount++;
                        
                        // 처음 5개만 로그
                        if (fixedCount <= 5) {
                            console.log(`🎨 ${fixedCount}번째 필지 색칠: ${pnu}`);
                        }
                    }
                });
            }
            
            return {
                fixedCount: fixedCount,
                totalClickParcels: window.clickParcels ? window.clickParcels.size : 0,
                currentMode: window.currentMode
            };
        });
        
        console.log('📊 수정 결과:', result);
        
        // 검색 OFF 상태로 전환
        console.log('🔄 검색 OFF 상태로 전환...');
        await page.evaluate(() => {
            if (window.currentMode === 'search') {
                // 검색 토글 버튼 클릭
                const toggleBtn = document.getElementById('searchToggleBtn');
                if (toggleBtn) {
                    toggleBtn.click();
                }
            }
        });
        
        await page.waitForTimeout(3000);
        
        // 최종 상태 확인
        const finalState = await page.evaluate(() => {
            let visibleColoredCount = 0;
            let coloredParcelDetails = [];
            
            if (window.clickParcels) {
                window.clickParcels.forEach((parcel, pnu) => {
                    const isVisible = parcel.polygon && parcel.polygon.getMap();
                    const isColored = parcel.color !== 'transparent';
                    
                    if (isVisible && isColored) {
                        visibleColoredCount++;
                        
                        // 처음 3개만 상세정보
                        if (coloredParcelDetails.length < 3) {
                            const options = parcel.polygon.getOptions ? parcel.polygon.getOptions() : {};
                            coloredParcelDetails.push({
                                pnu: pnu,
                                color: parcel.color,
                                fillColor: options.fillColor,
                                fillOpacity: options.fillOpacity,
                                visible: isVisible
                            });
                        }
                    }
                });
            }
            
            return {
                currentMode: window.currentMode,
                totalClickParcels: window.clickParcels ? window.clickParcels.size : 0,
                visibleColoredCount: visibleColoredCount,
                coloredParcelDetails: coloredParcelDetails
            };
        });
        
        console.log('📊 최종 상태:', JSON.stringify(finalState, null, 2));
        
        if (finalState.visibleColoredCount > 0) {
            console.log(`✅ 성공: 검색 OFF 시 ${finalState.visibleColoredCount}개 색칠된 필지가 표시됨!`);
        } else {
            console.log('❌ 실패: 검색 OFF 시에도 색칠된 필지가 표시되지 않음');
        }
    });
    
});