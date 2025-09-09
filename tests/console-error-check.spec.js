const { test, expect } = require('@playwright/test');

test.describe('콘솔 오류 진단', () => {
    test('브라우저 콘솔 오류 수집', async ({ page }) => {
        console.log('🔍 브라우저 콘솔 오류 수집 시작');
        
        const consoleMessages = [];
        const errors = [];
        
        // 콘솔 메시지 수집
        page.on('console', msg => {
            const text = msg.text();
            const type = msg.type();
            consoleMessages.push({ type, text });
            
            if (type === 'error') {
                console.log('❌ Console Error:', text);
                errors.push(text);
            } else if (type === 'warn') {
                console.log('⚠️ Console Warning:', text);
            } else if (text.includes('AppState') || text.includes('app-core') || text.includes('ULTRATHINK')) {
                console.log(`📝 [${type.toUpperCase()}]`, text);
            }
        });
        
        // 페이지 오류 수집
        page.on('pageerror', error => {
            console.log('💥 Page Error:', error.message);
            errors.push('Page Error: ' + error.message);
        });
        
        // 페이지 로드
        await page.goto('http://localhost:3000');
        
        // 충분히 대기
        await page.waitForTimeout(10000);
        
        // JavaScript 상태 확인
        const jsStatus = await page.evaluate(() => {
            return {
                appCoreLoaded: typeof window.AppState !== 'undefined',
                appCoreType: typeof window.AppState,
                windowKeys: Object.keys(window).filter(k => k.includes('App') || k.includes('core')),
                mapLoaded: typeof window.map !== 'undefined',
                naverMapsLoaded: typeof naver !== 'undefined',
                scriptsLoaded: {
                    supabase: typeof window.supabase !== 'undefined',
                    config: typeof CONFIG !== 'undefined'
                }
            };
        });
        
        console.log('🔍 JavaScript 상태:', jsStatus);
        console.log('📊 총 콘솔 메시지:', consoleMessages.length);
        console.log('❌ 총 오류:', errors.length);
        
        if (errors.length > 0) {
            console.log('🚨 발견된 오류들:');
            errors.forEach((error, i) => {
                console.log(`  ${i + 1}. ${error}`);
            });
        }
    });
});