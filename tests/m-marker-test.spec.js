// 🎯 M 마커 생성 테스트
const { test, expect } = require('@playwright/test');

test('M 마커 생성 테스트: 필지 저장 후 마커 확인', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // 페이지 로딩 대기
  await page.waitForTimeout(4000);
  
  console.log('🎯 M 마커 테스트 시작');
  
  // 1단계: 필지 클릭
  const map = page.locator('#map');
  await map.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(3000);
  
  // 필지 정보 로드 확인
  const parcelNumberInput = page.locator('#parcelNumber');
  const parcelNumber = await parcelNumberInput.inputValue();
  console.log(`📋 클릭된 필지: ${parcelNumber}`);
  
  expect(parcelNumber.length).toBeGreaterThan(0);
  
  // 2단계: 필지 정보 입력
  await page.locator('#ownerName').fill('M마커 테스트');
  await page.locator('#memo').fill('M 마커 생성 테스트');
  
  // 3단계: 저장 버튼 클릭
  await page.locator('#saveBtn').click();
  await page.waitForTimeout(2000);
  
  // 4단계: M 마커가 생성되었는지 확인
  // DOM에서 M 텍스트를 포함한 마커 요소 찾기
  const mMarkers = page.locator('#map div:has-text("M")');
  const markerCount = await mMarkers.count();
  
  console.log(`🔍 발견된 M 마커 수: ${markerCount}`);
  
  // 적어도 하나의 M 마커가 있어야 함
  expect(markerCount).toBeGreaterThan(0);
  
  // 마커가 실제로 보이는지 확인
  if (markerCount > 0) {
    await expect(mMarkers.first()).toBeVisible();
    console.log('✅ M 마커가 지도에 보임');
  }
  
  // 5단계: AppState에서 마커 정보 확인
  const markerInfo = await page.evaluate(() => {
    if (!window.AppState) return null;
    
    const parcels = Array.from(window.AppState.clickParcels.entries());
    const savedParcels = parcels.filter(([pnu, data]) => data.hasMarker === true);
    
    return {
      totalParcels: parcels.length,
      savedParcels: savedParcels.length,
      markerData: savedParcels.map(([pnu, data]) => ({
        pnu,
        jibun: data.jibun,
        hasMarker: data.hasMarker,
        isSaved: data.isSaved
      }))
    };
  });
  
  console.log('📊 마커 상태:', JSON.stringify(markerInfo, null, 2));
  
  expect(markerInfo.savedParcels).toBeGreaterThan(0);
  
  console.log('🎉 M 마커 테스트 완료!');
});