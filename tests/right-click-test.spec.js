const { test, expect } = require('@playwright/test');

test.describe('오른쪽 클릭 색칠/지우기 테스트', () => {
    
    test('검색 OFF 모드에서 왼쪽/오른쪽 클릭 테스트', async ({ page }) => {
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
        await page.waitForTimeout(5000);
        
        // 현재 모드 확인 및 클릭 모드로 설정
        const initialMode = await page.evaluate(() => {
            console.log('🔧 현재 모드:', window.currentMode);
            console.log('🎨 색칠 모드 상태:', window.paintModeEnabled);
            
            // 클릭 모드가 아니면 토글
            if (window.currentMode !== 'click') {
                const toggleBtn = document.getElementById('searchToggleBtn');
                if (toggleBtn) {
                    toggleBtn.click();
                    console.log('🔄 클릭 모드로 변경');
                } else {
                    window.currentMode = 'click';
                    console.log('🔄 직접 클릭 모드 설정');
                }
            }
            
            // 🎯 ULTRATHINK: 색칠 모드 강제 활성화
            if (!window.paintModeEnabled) {
                window.paintModeEnabled = true;
                console.log('🎨 색칠 모드 강제 활성화');
                
                // UI 토글 버튼도 업데이트
                const paintToggle = document.getElementById('paintModeToggle');
                if (paintToggle) {
                    paintToggle.classList.add('active');
                    const toggleIcon = paintToggle.querySelector('.toggle-icon');
                    const toggleText = paintToggle.querySelector('.toggle-text');
                    if (toggleIcon) toggleIcon.textContent = '🎨';
                    if (toggleText) toggleText.textContent = '색칠 ON';
                    console.log('🎨 색칠 모드 UI 업데이트 완료');
                }
            }
            
            return {
                mode: window.currentMode,
                paintModeEnabled: window.paintModeEnabled,
                clickParcels: window.clickParcels ? window.clickParcels.size : 0
            };
        });
        
        console.log('📊 초기 모드:', initialMode);
        
        await page.waitForTimeout(2000);
        
        // 지도 중앙 좌표에 왼쪽 클릭 (색칠 시도)
        console.log('🎨 지도 왼쪽 클릭으로 색칠 시도...');
        await page.click('div[id^="map"]', { button: 'left' });
        await page.waitForTimeout(3000);
        
        // 왼쪽 클릭 결과 확인
        const leftClickResult = await page.evaluate(() => {
            let coloredCount = 0;
            if (window.clickParcels) {
                window.clickParcels.forEach((parcel) => {
                    if (parcel.color && parcel.color !== 'transparent') {
                        coloredCount++;
                    }
                });
            }
            
            return {
                clickParcels: window.clickParcels ? window.clickParcels.size : 0,
                coloredCount: coloredCount
            };
        });
        
        console.log('📊 왼쪽 클릭 결과:', leftClickResult);
        
        // 오른쪽 클릭 테스트 - 색칠된 폴리곤을 직접 클릭
        console.log('🗑️ 색칠된 폴리곤에 오른쪽 클릭으로 색 지우기 시도...');
        const rightClickResult = await page.evaluate(async () => {
            // 색칠된 폴리곤 찾기
            let coloredParcel = null;
            if (window.clickParcels) {
                for (let [pnu, parcel] of window.clickParcels) {
                    if (parcel.color && parcel.color !== 'transparent' && parcel.polygon) {
                        coloredParcel = { pnu, parcel };
                        break;
                    }
                }
            }
            
            if (coloredParcel) {
                console.log('🎯 색칠된 폴리곤 발견:', coloredParcel.pnu);
                
                // 폴리곤에 직접 오른쪽 클릭 이벤트 발생
                if (coloredParcel.parcel.polygon && typeof handleParcelRightClick === 'function') {
                    console.log('🗑️ handleParcelRightClick 직접 호출...');
                    
                    // parcel 데이터 구성
                    const parcelData = coloredParcel.parcel.data || {
                        properties: {
                            PNU: coloredParcel.pnu,
                            pnu: coloredParcel.pnu
                        }
                    };
                    
                    // handleParcelRightClick 직접 호출 (async 함수이므로 await 필요)
                    try {
                        await handleParcelRightClick(parcelData, coloredParcel.parcel.polygon);
                        console.log('✅ handleParcelRightClick 호출 완료');
                        return { success: true, pnu: coloredParcel.pnu };
                    } catch (error) {
                        console.error('❌ handleParcelRightClick 오류:', error);
                        return { success: false, error: error.toString() };
                    }
                } else {
                    console.log('❌ handleParcelRightClick 함수 없음');
                    return { success: false, error: 'handleParcelRightClick 함수 없음' };
                }
            } else {
                console.log('❌ 색칠된 폴리곤을 찾을 수 없음');
                return { success: false, error: '색칠된 폴리곤 없음' };
            }
        });
        
        console.log('📊 오른쪽 클릭 직접 호출 결과:', rightClickResult);
        
        await page.waitForTimeout(3000);
        
        // 오른쪽 클릭 후 상태 확인
        const finalState = await page.evaluate(() => {
            let transparentCount = 0;
            let coloredCount = 0;
            
            if (window.clickParcels) {
                window.clickParcels.forEach((parcel) => {
                    if (parcel.color === 'transparent' || parcel.color === undefined) {
                        transparentCount++;
                    } else {
                        coloredCount++;
                    }
                });
            }
            
            return {
                totalParcels: window.clickParcels ? window.clickParcels.size : 0,
                transparentCount: transparentCount,
                coloredCount: coloredCount
            };
        });
        
        console.log('📊 오른쪽 클릭 후 상태:', finalState);
        
        // 오류 로그 확인
        const errorLogs = logs.filter(log => 
            log.includes('error') || 
            log.includes('Error') || 
            log.includes('오류') ||
            log.includes('savedData.some') ||
            log.includes('is not a function')
        );
        
        if (errorLogs.length > 0) {
            console.log('❌ 오류 로그 발견:');
            errorLogs.forEach(log => console.log(`  ${log}`));
        } else {
            console.log('✅ JavaScript 오류 없음');
        }
        
        // 클릭 관련 로그
        const clickLogs = logs.filter(log => 
            log.includes('클릭') ||
            log.includes('색칠') ||
            log.includes('색 지우기') ||
            log.includes('handleParcelRightClick') ||
            log.includes('applyColorToParcel')
        ).slice(-10);
        
        console.log('\n📋 클릭 관련 로그:');
        clickLogs.forEach(log => console.log(`  ${log}`));
        
        if (leftClickResult.coloredCount > 0 || finalState.transparentCount > 0) {
            console.log('✅ 왼쪽/오른쪽 클릭 기능이 일부 작동함');
            
            if (rightClickResult.success) {
                console.log('🗑️ 오른쪽 클릭 (색 지우기) 성공');
            } else {
                console.log('❌ 오른쪽 클릭 (색 지우기) 실패:', rightClickResult.error || '원인 불명');
            }
        } else {
            console.log('❌ 왼쪽/오른쪽 클릭 기능이 작동하지 않음');
        }
    });
    
});