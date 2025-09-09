const { test, expect } = require('@playwright/test');

test.describe('간단한 클릭 색칠 테스트', () => {
    
    test('클릭 모드에서 지도 클릭 시 색칠 작동 확인', async ({ page }) => {
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
        
        // 초기 상태 확인
        const initialState = await page.evaluate(() => {
            return {
                currentMode: window.currentMode,
                clickParcelsCount: window.clickParcels ? window.clickParcels.size : 0,
                paintModeEnabled: window.paintModeEnabled,
                currentColor: window.currentColor,
                getParcelInfoExists: typeof window.getParcelInfo === 'function'
            };
        });
        console.log('📊 초기 상태:', initialState);
        
        // 클릭 모드인지 확인
        if (initialState.currentMode !== 'click') {
            console.log('🔄 클릭 모드로 전환...');
            const toggleBtn = await page.locator('#searchToggleBtn');
            await toggleBtn.click();
            await page.waitForTimeout(2000);
        }
        
        // 최종 상태 확인
        const beforeClickState = await page.evaluate(() => {
            return {
                currentMode: window.currentMode,
                clickParcelsCount: window.clickParcels ? window.clickParcels.size : 0,
                paintModeEnabled: window.paintModeEnabled,
                currentColor: window.currentColor
            };
        });
        console.log('📊 클릭 전 상태:', beforeClickState);
        
        // 지도 클릭 (서울 중심 좌표 근처)
        console.log('🎯 지도 클릭 실행...');
        const mapElement = await page.locator('#map');
        await mapElement.click({ position: { x: 400, y: 300 } });
        
        // 클릭 후 상태 확인 (더 긴 대기시간)
        await page.waitForTimeout(10000);
        
        const afterClickState = await page.evaluate(() => {
            let visibleClickParcels = 0;
            if (window.clickParcels) {
                window.clickParcels.forEach(parcel => {
                    if (parcel.polygon && parcel.polygon.getMap()) visibleClickParcels++;
                });
            }
            
            return {
                currentMode: window.currentMode,
                clickParcelsCount: window.clickParcels ? window.clickParcels.size : 0,
                visibleClickParcels: visibleClickParcels
            };
        });
        
        console.log('📊 클릭 후 상태:', afterClickState);
        
        // 로그에서 관련 정보 출력
        console.log('\\n📋 관련 로그:');
        const relevantLogs = logs.filter(log => 
            log.includes('클릭') ||
            log.includes('getParcelInfo') ||
            log.includes('색칠') ||
            log.includes('applyColorToParcel') ||
            log.includes('ULTRATHINK')
        );
        
        relevantLogs.slice(-15).forEach(log => console.log(`  ${log}`));
        
        // 결과 분석
        if (afterClickState.clickParcelsCount > beforeClickState.clickParcelsCount) {
            console.log('✅ 성공: 클릭으로 색칠이 작동함!');
        } else {
            console.log('❌ 실패: 클릭으로 색칠이 작동하지 않음');
        }
    });
    
});