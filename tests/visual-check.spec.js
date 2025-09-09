const { test, expect } = require('@playwright/test');

test.describe('시각적 확인 테스트', () => {
    
    test('보라색 필지 시각적 확인 및 스타일 검증', async ({ page }) => {
        // 콘솔 로그 캡처
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
        await page.waitForTimeout(6000);
        
        console.log('✅ 페이지 로드 완료');
        
        // 간단한 검색 실행
        const searchInput = await page.locator('#searchInput');
        const searchBtn = await page.locator('#searchBtn');
        
        await searchInput.fill('서울시 중구 명동');
        console.log('📝 검색어 입력: 서울시 중구 명동');
        
        await searchBtn.click();
        console.log('🔍 검색 버튼 클릭');
        
        // 검색 완료 대기
        await page.waitForTimeout(8000);
        
        // DOM에서 실제 폴리곤 요소들 확인
        const visualCheck = await page.evaluate(() => {
            // 1. searchParcels 데이터 확인
            const searchParcelsData = window.searchParcels ? Array.from(window.searchParcels.entries()) : [];
            
            // 2. DOM에서 실제 폴리곤 관련 요소들 찾기
            const mapContainer = document.getElementById('map');
            const allCanvases = mapContainer ? mapContainer.querySelectorAll('canvas') : [];
            const allDivs = mapContainer ? mapContainer.querySelectorAll('div') : [];
            
            // 3. 네이버 맵 내부 폴리곤 객체들 확인
            let polygonDetails = [];
            
            if (window.searchParcels) {
                window.searchParcels.forEach((parcelInfo, pnu) => {
                    let polygonInfo = {
                        pnu: pnu,
                        hasPolygon: !!parcelInfo.polygon,
                        hasLabel: !!parcelInfo.label,
                        displayText: parcelInfo.displayText
                    };
                    
                    if (parcelInfo.polygon) {
                        try {
                            // 폴리곤 속성 직접 확인
                            const polygon = parcelInfo.polygon;
                            polygonInfo.polygonConnected = !!polygon.getMap();
                            polygonInfo.polygonVisible = true; // 기본값
                            
                            // 폴리곤 옵션 확인 (가능한 경우)
                            try {
                                const options = polygon.getOptions ? polygon.getOptions() : null;
                                if (options) {
                                    polygonInfo.polygonOptions = {
                                        fillColor: options.fillColor,
                                        fillOpacity: options.fillOpacity,
                                        strokeColor: options.strokeColor,
                                        strokeOpacity: options.strokeOpacity
                                    };
                                }
                            } catch (e) {
                                polygonInfo.optionsError = e.message;
                            }
                        } catch (e) {
                            polygonInfo.polygonError = e.message;
                        }
                    }
                    
                    if (parcelInfo.label) {
                        try {
                            const label = parcelInfo.label;
                            polygonInfo.labelConnected = !!label.getMap();
                            polygonInfo.labelPosition = label.getPosition();
                        } catch (e) {
                            polygonInfo.labelError = e.message;
                        }
                    }
                    
                    polygonDetails.push(polygonInfo);
                });
            }
            
            return {
                searchParcelsCount: searchParcelsData.length,
                mapContainer: !!mapContainer,
                canvasCount: allCanvases.length,
                divCount: allDivs.length,
                polygonDetails: polygonDetails,
                currentMode: window.currentMode
            };
        });
        
        console.log('📊 시각적 검증 결과:', visualCheck);
        console.log('📋 폴리곤 상세 정보:', visualCheck.polygonDetails);
        
        // 3초 후 다시 한번 확인 (혹시 뭔가 변경되었는지)
        await page.waitForTimeout(3000);
        
        const secondCheck = await page.evaluate(() => {
            let activePolygons = 0;
            let activeLabels = 0;
            let polygonIssues = [];
            
            if (window.searchParcels) {
                window.searchParcels.forEach((parcelInfo, pnu) => {
                    if (parcelInfo.polygon) {
                        const isActive = !!parcelInfo.polygon.getMap();
                        if (isActive) {
                            activePolygons++;
                        } else {
                            polygonIssues.push(`폴리곤 ${pnu}이 지도에서 연결 해제됨`);
                        }
                    }
                    
                    if (parcelInfo.label) {
                        const isActive = !!parcelInfo.label.getMap();
                        if (isActive) {
                            activeLabels++;
                        }
                    }
                });
            }
            
            return {
                activePolygons: activePolygons,
                activeLabels: activeLabels,
                polygonIssues: polygonIssues,
                totalSearchParcels: window.searchParcels ? window.searchParcels.size : 0
            };
        });
        
        console.log('📊 3초 후 재검증:', secondCheck);
        
        // 스크린샷 찍기 (시각적 확인용)
        await page.screenshot({ 
            path: 'C:/Users/gyb07/workspace/naver-maps/debug-screenshot.png',
            fullPage: true 
        });
        
        console.log('📸 스크린샷 저장됨: debug-screenshot.png');
        
        // 관련 로그들
        console.log('\\n📋 폴리곤 관련 로그:');
        const polygonLogs = logs.filter(log => 
            log.includes('폴리곤') ||
            log.includes('보라색') ||
            log.includes('fillOpacity') ||
            log.includes('스타일') ||
            log.includes('보호')
        );
        
        polygonLogs.slice(-10).forEach(log => console.log(`  ${log}`));
        
        // 최종 판정
        console.log('\\n🎯 시각적 검증 결과:');
        if (secondCheck.activePolygons > 0 && secondCheck.activeLabels > 0) {
            console.log('✅ SUCCESS: 폴리곤과 라벨 모두 활성 상태');
        } else if (secondCheck.activeLabels > 0 && secondCheck.activePolygons === 0) {
            console.log('🔴 CONFIRMED: 라벨만 있고 폴리곤이 사라짐 (사용자 보고와 일치!)');
            console.log('📋 폴리곤 문제들:', secondCheck.polygonIssues);
        } else {
            console.log('⚠️ 다른 상황 발생');
        }
        
        console.log(`총 검색 필지: ${secondCheck.totalSearchParcels}`);
        console.log(`활성 폴리곤: ${secondCheck.activePolygons}`);
        console.log(`활성 라벨: ${secondCheck.activeLabels}`);
    });
    
});