const { test, expect } = require('@playwright/test');

test.describe('필지 데이터 구조 디버그', () => {
    
    test('검색 필지 데이터 구조 상세 확인', async ({ page }) => {
        console.log('🔍 페이지 로딩...');
        try {
            await page.goto('http://localhost:3000', { timeout: 15000 });
        } catch (e) {
            await page.goto('http://localhost:5000', { timeout: 15000 });
        }
        
        await page.waitForSelector('body', { timeout: 10000 });
        await page.waitForTimeout(5000);
        
        // 검색 실행
        console.log('🔍 검색 실행...');
        const searchInput = await page.locator('#searchInput');
        const searchBtn = await page.locator('#searchBtn');
        
        await searchInput.fill('서울시 중구 소공동 87-1');
        await searchBtn.click();
        await page.waitForTimeout(8000);
        
        // 검색 필지 데이터 구조 상세 분석
        const dataStructure = await page.evaluate(() => {
            if (!window.searchParcels || window.searchParcels.size === 0) {
                return { error: '검색 필지가 없습니다' };
            }
            
            const firstSearchParcel = window.searchParcels.values().next().value;
            console.log('🔍 전체 firstSearchParcel:', firstSearchParcel);
            
            const result = {
                hasData: !!firstSearchParcel.data,
                hasGeometry: false,
                hasCoordinates: false,
                geometryType: null,
                coordinatesStructure: null,
                dataStructure: {}
            };
            
            if (firstSearchParcel.data) {
                const data = firstSearchParcel.data;
                console.log('🔍 data 키들:', Object.keys(data));
                
                result.dataStructure = {
                    keys: Object.keys(data),
                    hasGeometry: !!data.geometry,
                    hasCoordinates: !!data.coordinates,
                    hasProperties: !!data.properties
                };
                
                if (data.geometry) {
                    result.hasGeometry = true;
                    result.geometryType = data.geometry.type;
                    
                    console.log('🔍 geometry.type:', data.geometry.type);
                    console.log('🔍 geometry.coordinates 존재:', !!data.geometry.coordinates);
                    
                    if (data.geometry.coordinates) {
                        result.hasCoordinates = true;
                        result.coordinatesStructure = {
                            length: data.geometry.coordinates.length,
                            firstLevel: Array.isArray(data.geometry.coordinates[0]) ? data.geometry.coordinates[0].length : 'not array',
                            secondLevel: Array.isArray(data.geometry.coordinates[0]) && Array.isArray(data.geometry.coordinates[0][0]) ? data.geometry.coordinates[0][0].length : 'not array',
                            sampleCoordinate: data.geometry.coordinates[0] && data.geometry.coordinates[0][0] && data.geometry.coordinates[0][0][0] ? data.geometry.coordinates[0][0][0] : 'none'
                        };
                        
                        console.log('🔍 좌표 구조:', result.coordinatesStructure);
                    }
                }
                
                // viewportRenderer.createParcelPolygon 테스트
                console.log('🧪 viewportRenderer.createParcelPolygon 테스트...');
                if (window.viewportRenderer && window.viewportRenderer.createParcelPolygon) {
                    try {
                        const testPolygon = window.viewportRenderer.createParcelPolygon(data, false);
                        result.polygonTestResult = {
                            success: !!testPolygon,
                            type: testPolygon ? typeof testPolygon : 'null'
                        };
                        console.log('🧪 폴리곤 테스트 결과:', result.polygonTestResult);
                        
                        // 폴리곤 생성에 실패한 경우 더 자세한 디버깅
                        if (!testPolygon) {
                            console.log('🔍 폴리곤 생성 실패 - 상세 분석...');
                            
                            // 직접 geometry 체크
                            const geometry = data.geometry || data.coordinates;
                            console.log('🔍 geometry 존재:', !!geometry);
                            
                            if (geometry) {
                                console.log('🔍 geometry.type:', geometry.type);
                                console.log('🔍 geometry.coordinates:', !!geometry.coordinates);
                                
                                if (geometry.type === 'Polygon' && geometry.coordinates && geometry.coordinates[0]) {
                                    console.log('🔍 Polygon 좌표 개수:', geometry.coordinates[0].length);
                                    console.log('🔍 첫 번째 좌표 샘플:', geometry.coordinates[0][0]);
                                    
                                    // 수동으로 paths 생성 테스트
                                    try {
                                        const paths = geometry.coordinates[0].map(coord => ({
                                            lat: coord[1],
                                            lng: coord[0]
                                        }));
                                        console.log('🧪 paths 생성 성공, 길이:', paths.length);
                                        console.log('🧪 첫 번째 path:', paths[0]);
                                        
                                        result.pathsTestResult = {
                                            success: true,
                                            pathsLength: paths.length,
                                            firstPath: paths[0]
                                        };
                                    } catch (pathError) {
                                        console.error('🧪 paths 생성 실패:', pathError);
                                        result.pathsTestResult = {
                                            success: false,
                                            error: pathError.toString()
                                        };
                                    }
                                }
                            }
                        }
                    } catch (polygonError) {
                        console.error('🧪 폴리곤 테스트 오류:', polygonError);
                        result.polygonTestResult = {
                            success: false,
                            error: polygonError.toString()
                        };
                    }
                } else {
                    result.polygonTestResult = {
                        success: false,
                        error: 'viewportRenderer.createParcelPolygon 함수가 없음'
                    };
                }
            }
            
            return result;
        });
        
        console.log('📊 필지 데이터 구조 분석 결과:', JSON.stringify(dataStructure, null, 2));
        
        if (dataStructure.error) {
            console.log('❌ 검색 실패:', dataStructure.error);
        } else if (!dataStructure.polygonTestResult.success) {
            console.log('❌ 폴리곤 생성 실패:', dataStructure.polygonTestResult.error || '원인 불명');
        } else {
            console.log('✅ 폴리곤 생성 성공');
        }
    });
    
});