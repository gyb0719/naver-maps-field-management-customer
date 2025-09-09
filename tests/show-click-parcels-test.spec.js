const { test, expect } = require('@playwright/test');

test.describe('showClickParcels 함수 테스트', () => {
    
    test('showClickParcels 호출 시 투명 필지가 색상으로 표시되는지 확인', async ({ page }) => {
        const logs = [];
        page.on('console', msg => {
            logs.push(`${msg.type()}: ${msg.text()}`);
        });
        
        console.log('🔍 페이지 로딩...');
        try {
            await page.goto('http://localhost:3000', { timeout: 15000 });
        } catch (e) {
            await page.goto('http://localhost:5000', { timeout: 15000 });
        }
        
        await page.waitForSelector('body', { timeout: 10000 });
        await page.waitForTimeout(8000);
        
        // 초기 상태 확인
        const initialState = await page.evaluate(() => {
            let transparentCount = 0;
            if (window.clickParcels) {
                window.clickParcels.forEach((parcel, pnu) => {
                    if (parcel.color === 'transparent') {
                        transparentCount++;
                    }
                });
            }
            
            return {
                totalClickParcels: window.clickParcels ? window.clickParcels.size : 0,
                transparentParcels: transparentCount,
                currentMode: window.currentMode
            };
        });
        
        console.log('📊 초기 상태:', initialState);
        
        // 검색 OFF 모드로 전환 (showClickParcels 호출됨)
        console.log('🔄 검색 OFF 모드로 전환...');
        await page.evaluate(() => {
            if (window.currentMode === 'search') {
                const toggleBtn = document.getElementById('searchToggleBtn');
                if (toggleBtn) {
                    toggleBtn.click();
                }
            } else {
                // 이미 클릭 모드라면 수동으로 showClickParcels 호출
                if (typeof window.showClickParcels === 'function') {
                    window.showClickParcels();
                }
            }
        });
        
        await page.waitForTimeout(3000);
        
        // 최종 상태 확인
        const finalState = await page.evaluate(() => {
            let transparentCount = 0;
            let coloredCount = 0;
            let visibleColoredCount = 0;
            let colorSamples = [];
            
            if (window.clickParcels) {
                window.clickParcels.forEach((parcel, pnu) => {
                    if (parcel.color === 'transparent') {
                        transparentCount++;
                    } else {
                        coloredCount++;
                        
                        // 지도에 표시되고 있는지 확인
                        if (parcel.polygon && parcel.polygon.getMap()) {
                            visibleColoredCount++;
                            
                            // 처음 3개 색상 샘플
                            if (colorSamples.length < 3) {
                                colorSamples.push({
                                    pnu: pnu,
                                    color: parcel.color
                                });
                            }
                        }
                    }
                });
            }
            
            return {
                currentMode: window.currentMode,
                totalClickParcels: window.clickParcels ? window.clickParcels.size : 0,
                transparentParcels: transparentCount,
                coloredParcels: coloredCount,
                visibleColoredParcels: visibleColoredCount,
                colorSamples: colorSamples
            };
        });
        
        console.log('📊 최종 상태:', finalState);
        
        // 관련 로그 확인
        console.log('\\n📋 투명 필지 복원 관련 로그:');
        const fixLogs = logs.filter(log => 
            log.includes('투명 필지') ||
            log.includes('색상 복원') ||
            log.includes('기본 색상') ||
            log.includes('showClickParcels') ||
            log.includes('클릭 필지 표시')
        );
        
        fixLogs.slice(-10).forEach(log => console.log(`  ${log}`));
        
        // 결과 분석
        const improvementCount = initialState.transparentParcels - finalState.transparentParcels;
        
        if (finalState.visibleColoredParcels > 0) {
            console.log(`✅ 성공: ${finalState.visibleColoredParcels}개 색칠된 필지가 표시됨!`);
            console.log(`🎨 색상 샘플:`, finalState.colorSamples);
            
            if (improvementCount > 0) {
                console.log(`🔧 ${improvementCount}개 투명 필지가 색상으로 변환됨!`);
            }
        } else {
            console.log('❌ 실패: 색칠된 필지가 표시되지 않음');
        }
    });
    
});