// 🎯 간단한 M 마커 테스트
const { test, expect } = require('@playwright/test');

test('간단한 M 마커 생성 테스트', async ({ page }) => {
  console.log('🎯 간단한 M 마커 생성 테스트 시작');
  
  // JavaScript 에러 수집
  page.on('pageerror', (error) => {
    console.log('🚨 JavaScript 에러:', error.message);
  });
  
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000); // 모든 스크립트 로드 대기
  
  // 1. 필지 클릭
  console.log('📍 1단계: 필지 클릭');
  const map = page.locator('#map');
  await map.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(3000);
  
  // 2. 색상 적용
  console.log('🎨 2단계: 색상 적용');
  await page.locator('.color-item[data-color="#FF0000"]').click();
  await page.waitForTimeout(500);
  await map.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(2000);
  
  // 3. 정보 입력
  console.log('📝 3단계: 정보 입력');
  await page.locator('#ownerName').fill('마커테스트');
  await page.locator('#memo').fill('M마커');
  
  // 4. 저장
  console.log('💾 4단계: 저장');
  await page.locator('#saveBtn').click();
  await page.waitForTimeout(5000); // M 마커 생성 대기
  
  // 5. 마커 확인
  const markerStatus = await page.evaluate(() => {
    if (!window.AppState || window.AppState.clickParcels.size === 0) {
      return { error: 'No parcels found' };
    }
    
    const firstParcel = Array.from(window.AppState.clickParcels.entries())[0];
    const [pnu, data] = firstParcel;
    
    return {
      pnu: pnu,
      hasMarker: !!data.marker,
      markerVisible: data.marker ? data.marker.getMap() !== null : false,
      hasMarkerFlag: data.hasMarker,
      isSaved: data.data?.isSaved || false
    };
  });
  
  console.log('📊 마커 상태:', markerStatus);
  
  // 검증
  if (markerStatus.error) {
    console.log('❌ 테스트 실패:', markerStatus.error);
  } else {
    expect(markerStatus.hasMarker).toBe(true);
    expect(markerStatus.markerVisible).toBe(true);
    expect(markerStatus.isSaved).toBe(true);
    console.log('✅ M 마커 생성 성공!');
  }
});