// 🎯 통합된 M 마커 시스템 테스트
const { test, expect } = require('@playwright/test');

test('통합된 M 마커 시스템 테스트', async ({ page }) => {
  console.log('🎯 통합된 M 마커 시스템 테스트 시작');
  
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(4000);
  
  // 1단계: 필지 클릭
  console.log('📍 1단계: 필지 클릭');
  const map = page.locator('#map');
  await map.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(3000);
  
  const parcelNumber = await page.locator('#parcelNumber').inputValue();
  console.log(`📝 로드된 필지: ${parcelNumber}`);
  
  // 2단계: 정보 입력
  console.log('✏️ 2단계: 정보 입력');
  await page.locator('#ownerName').fill('통합테스트');
  await page.locator('#memo').fill('M마커 통합 시스템 테스트');
  
  // 3단계: 저장 전 M 마커 수 확인
  const beforeSave = await page.evaluate(() => {
    const markerElements = document.querySelectorAll('[style*="M"][style*="background"]');
    return {
      domMarkers: markerElements.length,
      totalParcels: window.AppState?.clickParcels?.size || 0
    };
  });
  
  console.log(`📊 저장 전: DOM M마커 ${beforeSave.domMarkers}개, 필지 ${beforeSave.totalParcels}개`);
  
  // 4단계: 저장
  console.log('💾 4단계: 저장 실행');
  await page.locator('#saveBtn').click();
  await page.waitForTimeout(2000);
  
  // 5단계: 저장 후 M 마커 확인
  const afterSave = await page.evaluate(() => {
    const markerElements = document.querySelectorAll('[style*="M"][style*="background"]');
    
    // AppState에서 마커 정보 확인
    const parcels = Array.from(window.AppState.clickParcels.entries());
    const parcelWithMarkers = parcels.filter(([pnu, data]) => {
      return data.marker && data.memoMarker && data.hasMarker;
    });
    
    const visibleMarkers = parcels.filter(([pnu, data]) => {
      return data.marker && data.marker.getMap() !== null;
    });
    
    return {
      domMarkers: markerElements.length,
      totalParcels: parcels.length,
      parcelWithMarkers: parcelWithMarkers.length,
      visibleMarkers: visibleMarkers.length,
      markerDetails: parcelWithMarkers.map(([pnu, data]) => ({
        pnu: pnu,
        hasMarker: data.hasMarker,
        markerExists: !!data.marker,
        memoMarkerExists: !!data.memoMarker,
        sameObject: data.marker === data.memoMarker,
        isVisible: data.marker ? data.marker.getMap() !== null : false
      }))
    };
  });
  
  console.log(`📊 저장 후 결과:`);
  console.log(`  - DOM M마커: ${afterSave.domMarkers}개`);
  console.log(`  - 마커 정보가 있는 필지: ${afterSave.parcelWithMarkers}개`);
  console.log(`  - 실제 표시된 마커: ${afterSave.visibleMarkers}개`);
  
  afterSave.markerDetails.forEach((detail, index) => {
    console.log(`  📍 필지 ${index + 1}:`, {
      hasMarker: detail.hasMarker,
      markerExists: detail.markerExists,
      memoMarkerExists: detail.memoMarkerExists,
      sameObject: detail.sameObject,
      isVisible: detail.isVisible
    });
  });
  
  // 6단계: 결과 검증
  expect(afterSave.parcelWithMarkers).toBeGreaterThan(0);
  expect(afterSave.visibleMarkers).toBeGreaterThan(0);
  expect(afterSave.domMarkers).toBeGreaterThan(0);
  
  // M 마커가 증가했는지 확인 (저장 후 마커가 생겨야 함)
  expect(afterSave.visibleMarkers).toBeGreaterThanOrEqual(beforeSave.domMarkers);
  
  if (afterSave.markerDetails.length > 0) {
    const detail = afterSave.markerDetails[0];
    expect(detail.hasMarker).toBe(true);
    expect(detail.markerExists).toBe(true);
    expect(detail.memoMarkerExists).toBe(true);
    expect(detail.sameObject).toBe(true); // marker와 memoMarker가 같은 객체여야 함
    expect(detail.isVisible).toBe(true);
  }
  
  console.log('✅ 통합된 M 마커 시스템 테스트 완료!');
  
  // 7단계: M 마커 클릭 테스트
  console.log('🖱️ 7단계: M 마커 클릭 테스트');
  
  // M 마커 요소 클릭 시도
  const mMarkers = page.locator('#map div:has-text("M")');
  const markerCount = await mMarkers.count();
  
  if (markerCount > 0) {
    console.log(`🖱️ ${markerCount}개 M 마커 중 첫 번째 클릭`);
    await mMarkers.first().click();
    await page.waitForTimeout(1000);
    
    // 클릭 후 폼에 정보가 표시되는지 확인
    const formValues = await page.evaluate(() => ({
      parcelNumber: document.getElementById('parcelNumber')?.value || '',
      ownerName: document.getElementById('ownerName')?.value || '',
      memo: document.getElementById('memo')?.value || ''
    }));
    
    console.log(`📝 M 마커 클릭 후 폼 상태:`, formValues);
    
    // 정보가 제대로 표시되었는지 확인
    expect(formValues.parcelNumber.length).toBeGreaterThan(0);
    expect(formValues.ownerName).toBe('통합테스트');
    expect(formValues.memo).toBe('M마커 통합 시스템 테스트');
    
    console.log('✅ M 마커 클릭 이벤트 정상 작동!');
  } else {
    console.log('⚠️ M 마커를 찾을 수 없음');
  }
});