// 🎯 검색 모드 ON 시 색칠된 필지 완전 숨김 테스트
const { test, expect } = require('@playwright/test');

test('검색 모드 ON 시 색칠된 필지와 M 마커 완전 숨김', async ({ page }) => {
  console.log('🎯 검색 모드 색칠 필지 숨김 테스트 시작');
  
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(4000);
  
  // 1단계: 필지 클릭하여 데이터 로드
  console.log('📍 1단계: 필지 클릭');
  const map = page.locator('#map');
  await map.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(3000);
  
  const parcelNumber = await page.locator('#parcelNumber').inputValue();
  console.log(`📝 로드된 필지: ${parcelNumber}`);
  
  // 2단계: 필지에 색상 적용
  console.log('🎨 2단계: 필지에 색상 적용');
  const redColorBtn = page.locator('.color-item[data-color="#FF0000"]');
  await redColorBtn.click();
  await page.waitForTimeout(500);
  
  // 필지에 색칠 (왼쪽 클릭)
  await map.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(2000);
  
  // 3단계: 필지 저장하여 M 마커 생성
  console.log('💾 3단계: 필지 저장');
  await page.locator('#ownerName').fill('숨김 테스트');
  await page.locator('#memo').fill('검색 모드 숨김 테스트');
  
  await page.locator('#saveBtn').click();
  await page.waitForTimeout(2000);
  
  // 4단계: 검색 OFF 상태에서 필지와 M 마커 표시 확인
  console.log('👁️ 4단계: 검색 OFF 상태 확인');
  const beforeSearchOn = await page.evaluate(() => {
    if (!window.AppState) return null;
    
    const parcels = Array.from(window.AppState.clickParcels.entries());
    const visibleParcels = parcels.filter(([pnu, data]) => 
      data.polygon && data.polygon.getMap() !== null
    );
    const visibleMarkers = parcels.filter(([pnu, data]) => 
      data.marker && data.marker.getMap() !== null
    );
    
    return {
      searchMode: window.AppState.searchMode,
      totalParcels: parcels.length,
      visibleParcels: visibleParcels.length,
      visibleMarkers: visibleMarkers.length
    };
  });
  
  console.log('검색 OFF 상태:', beforeSearchOn);
  expect(beforeSearchOn.visibleParcels).toBeGreaterThan(0); // 색칠된 필지 보임
  expect(beforeSearchOn.visibleMarkers).toBeGreaterThan(0); // M 마커 보임
  
  // 5단계: 검색 ON 버튼 클릭
  console.log('🔍 5단계: 검색 ON 버튼 클릭');
  const searchToggleBtn = page.locator('#searchToggleBtn');
  await searchToggleBtn.click();
  await page.waitForTimeout(2000);
  
  // 6단계: 검색 ON 상태에서 필지와 M 마커 숨김 확인
  const afterSearchOn = await page.evaluate(() => {
    if (!window.AppState) return null;
    
    const parcels = Array.from(window.AppState.clickParcels.entries());
    const visibleParcels = parcels.filter(([pnu, data]) => 
      data.polygon && data.polygon.getMap() !== null
    );
    const visibleMarkers = parcels.filter(([pnu, data]) => 
      data.marker && data.marker.getMap() !== null
    );
    
    return {
      searchMode: window.AppState.searchMode,
      totalParcels: parcels.length,
      visibleParcels: visibleParcels.length,
      visibleMarkers: visibleMarkers.length
    };
  });
  
  const buttonText = await searchToggleBtn.textContent();
  console.log('검색 ON 상태:', afterSearchOn);
  console.log('검색 버튼 텍스트:', buttonText);
  
  // 검증: 검색 ON일 때 모든 색칠된 필지와 M 마커가 숨겨져야 함
  expect(buttonText).toContain('ON');
  expect(afterSearchOn.searchMode).toBe(true);
  expect(afterSearchOn.visibleParcels).toBe(0); // ✅ 색칠된 필지 완전 숨김
  expect(afterSearchOn.visibleMarkers).toBe(0); // ✅ M 마커도 완전 숨김
  
  console.log('✅ 검색 ON: 색칠된 필지와 M 마커 완전 숨김 성공!');
  
  // 7단계: 검색 OFF로 복원 테스트
  console.log('🔄 7단계: 검색 OFF 복원 테스트');
  await searchToggleBtn.click();
  await page.waitForTimeout(2000);
  
  const afterSearchOff = await page.evaluate(() => {
    if (!window.AppState) return null;
    
    const parcels = Array.from(window.AppState.clickParcels.entries());
    const visibleParcels = parcels.filter(([pnu, data]) => 
      data.polygon && data.polygon.getMap() !== null
    );
    const visibleMarkers = parcels.filter(([pnu, data]) => 
      data.marker && data.marker.getMap() !== null
    );
    
    return {
      searchMode: window.AppState.searchMode,
      visibleParcels: visibleParcels.length,
      visibleMarkers: visibleMarkers.length
    };
  });
  
  const finalButtonText = await searchToggleBtn.textContent();
  console.log('검색 OFF 복원 상태:', afterSearchOff);
  console.log('최종 버튼 텍스트:', finalButtonText);
  
  // 검증: 검색 OFF일 때 색칠된 필지와 M 마커가 다시 표시되어야 함
  expect(finalButtonText).toContain('OFF');
  expect(afterSearchOff.searchMode).toBe(false);
  expect(afterSearchOff.visibleParcels).toBeGreaterThan(0); // 색칠된 필지 복원
  expect(afterSearchOff.visibleMarkers).toBeGreaterThan(0); // M 마커 복원
  
  console.log('✅ 검색 OFF: 색칠된 필지와 M 마커 복원 성공!');
  console.log('🎉 검색 모드 숨김/복원 테스트 완료!');
});