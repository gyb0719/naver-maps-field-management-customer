const { test, expect } = require('@playwright/test');

test.describe('함수 로딩 확인', () => {
    
    test('Early Bootstrap 함수가 로드되는지 확인', async ({ page }) => {
        // 모든 콘솔 로그 캡처
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
        await page.waitForTimeout(8000); // 충분한 대기
        
        console.log('✅ 페이지 로드 완료');
        
        // 단계별로 함수 존재 확인
        const functionCheck = await page.evaluate(() => {
            const results = [];
            
            // 1단계: config-client.js가 로드되었는지
            results.push({
                step: 'CONFIG 객체',
                exists: typeof window.CONFIG !== 'undefined',
                value: typeof window.CONFIG
            });
            
            // 2단계: searchParcels Map이 있는지
            results.push({
                step: 'window.searchParcels',
                exists: typeof window.searchParcels !== 'undefined',
                value: typeof window.searchParcels
            });
            
            // 3단계: earlyRestoreSearchParcels 함수
            results.push({
                step: 'window.earlyRestoreSearchParcels',
                exists: typeof window.earlyRestoreSearchParcels === 'function',
                value: typeof window.earlyRestoreSearchParcels
            });
            
            // 4단계: testEarlyRestore 함수
            results.push({
                step: 'window.testEarlyRestore',
                exists: typeof window.testEarlyRestore === 'function',
                value: typeof window.testEarlyRestore
            });
            
            // 5단계: 기타 전역 객체들
            results.push({
                step: 'window.map',
                exists: typeof window.map !== 'undefined',
                value: typeof window.map
            });
            
            results.push({
                step: 'formatJibun',
                exists: typeof formatJibun === 'function',
                value: typeof formatJibun
            });
            
            return results;
        });
        
        console.log('\n📊 함수 존재 확인 결과:');
        functionCheck.forEach(result => {
            console.log(`  ${result.exists ? '✅' : '❌'} ${result.step}: ${result.value}`);
        });
        
        // config 관련 로그 확인
        console.log('\n📋 CONFIG 관련 로그:');
        const configLogs = logs.filter(log => 
            log.includes('CONFIG') ||
            log.includes('config') ||
            log.includes('Bootstrap') ||
            log.includes('ULTRATHINK')
        );
        
        configLogs.forEach(log => console.log(`  ${log}`));
        
        // 함수가 로드되지 않았다면 스크립트 로딩 순서 확인
        if (!functionCheck.find(f => f.step === 'window.earlyRestoreSearchParcels').exists) {
            console.log('\n🔧 스크립트 로딩 확인:');
            const scriptInfo = await page.evaluate(() => {
                const scripts = Array.from(document.querySelectorAll('script[src]'));
                return scripts.map(script => script.src.split('/').pop());
            });
            
            console.log('로드된 스크립트들:', scriptInfo);
        }
        
        // 전체 콘솔 로그 (처음 20개만)
        console.log('\n📜 초기 로그 (처음 20개):');
        logs.slice(0, 20).forEach((log, index) => {
            console.log(`  ${index}: ${log}`);
        });
        
    });
    
});