const { test, expect } = require('@playwright/test');

test.describe('스크립트 로딩 디버그 테스트', () => {
    
    test('스크립트 로딩 상태와 함수 가용성 확인', async ({ page }) => {
        const logs = [];
        const errors = [];
        
        page.on('console', msg => {
            logs.push(`${msg.type()}: ${msg.text()}`);
        });
        
        page.on('pageerror', error => {
            errors.push(error.message);
            console.error('❌ 페이지 에러:', error.message);
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
        
        // 스크립트 로딩 상태 확인
        const scriptStatus = await page.evaluate(() => {
            return {
                // 기본 변수들
                map: typeof window.map,
                CONFIG: typeof CONFIG,
                currentColor: typeof window.currentColor,
                currentMode: typeof window.currentMode,
                
                // 필지 관련 변수들
                clickParcels: typeof window.clickParcels,
                searchParcels: typeof window.searchParcels,
                paintModeEnabled: typeof window.paintModeEnabled,
                
                // 함수들
                getParcelInfo: typeof window.getParcelInfo,
                applyColorToParcel: typeof applyColorToParcel,
                createParcelPolygon: typeof createParcelPolygon,
                
                // 실제 값들
                currentColorValue: window.currentColor,
                paintModeValue: window.paintModeEnabled,
                mapExists: !!window.map
            };
        });
        
        console.log('📊 스크립트 로딩 상태:');
        Object.entries(scriptStatus).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
        });
        
        // 에러 확인
        if (errors.length > 0) {
            console.log('\\n❌ 발견된 에러들:');
            errors.forEach(error => console.log(`  ${error}`));
        }
        
        // 관련 로그 확인
        console.log('\\n📋 parcel.js 관련 로그:');
        const parcelLogs = logs.filter(log => 
            log.includes('parcel.js') ||
            log.includes('ULTRATHINK parcel') ||
            log.includes('필지 색칠') ||
            log.includes('paintModeEnabled') ||
            log.includes('getParcelInfo')
        );
        
        parcelLogs.forEach(log => console.log(`  ${log}`));
        
        // Early Bootstrap 로그 확인
        console.log('\\n🚀 Early Bootstrap 로그:');
        const bootstrapLogs = logs.filter(log => 
            log.includes('Bootstrap') ||
            log.includes('복원')
        );
        
        bootstrapLogs.forEach(log => console.log(`  ${log}`));
        
        // 결과 요약
        console.log('\\n📋 결과 요약:');
        console.log(`  parcel.js 로드 완료 로그: ${logs.some(l => l.includes('parcel.js 로드 완료')) ? '✅' : '❌'}`);
        console.log(`  getParcelInfo 함수: ${scriptStatus.getParcelInfo === 'function' ? '✅' : '❌'}`);
        console.log(`  paintModeEnabled 설정: ${scriptStatus.paintModeEnabled !== 'undefined' ? '✅' : '❌'}`);
        console.log(`  map 객체 존재: ${scriptStatus.mapExists ? '✅' : '❌'}`);
    });
    
});