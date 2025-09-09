// 🎯 ULTRATHINK M 마커 저장 테스트
const { test, expect } = require('@playwright/test');

test('ULTRATHINK M 마커 확실한 생성 테스트', async ({ page }) => {
  console.log('🎯 ULTRATHINK M 마커 생성 테스트 시작');
  
  // 콘솔 로그 수집
  page.on('console', (msg) => {
    if (msg.type() === 'log' && (msg.text().includes('ULTRATHINK') || msg.text().includes('마커'))) {
      console.log('📱', msg.text());
    }
  });
  
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(3000);
  
  // 1단계: 필지 클릭
  console.log('📍 1단계: 필지 클릭');
  const map = page.locator('#map');
  await map.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(2000);
  
  const parcelNumber = await page.locator('#parcelNumber').inputValue();
  console.log(`📝 로드된 필지: ${parcelNumber}`);
  
  // 2단계: 색상 적용
  console.log('🎨 2단계: 색상 적용');
  const redColorBtn = page.locator('.color-item[data-color="#FF0000"]');
  await redColorBtn.click();
  await page.waitForTimeout(500);
  await map.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(1000);
  
  // 3단계: 저장 전 상태 확인
  console.log('📊 3단계: 저장 전 상태 확인');
  const beforeSave = await page.evaluate(() => {
    if (!window.AppState) return null;
    
    const parcels = Array.from(window.AppState.clickParcels.entries());
    return {
      parcelCount: parcels.length,
      currentSelected: window.AppState.currentSelectedParcel,
      hasMarkerBefore: parcels.length > 0 ? !!parcels[0][1].marker : false
    };
  });
  
  console.log('저장 전 상태:', beforeSave);
  
  // 4단계: 필지 정보 입력 및 저장
  console.log('💾 4단계: 정보 입력 및 저장');
  await page.locator('#ownerName').fill('ULTRATHINK 테스트');
  await page.locator('#memo').fill('M 마커 확실 생성 테스트');
  
  // 저장 버튼 클릭
  await page.locator('#saveBtn').click();
  await page.waitForTimeout(3000); // M 마커 생성 및 확인 대기
  
  // 5단계: 저장 후 M 마커 확인
  console.log('✅ 5단계: M 마커 생성 확인');
  const afterSave = await page.evaluate(() => {
    if (!window.AppState) return null;
    
    const parcels = Array.from(window.AppState.clickParcels.entries());
    if (parcels.length === 0) return null;
    
    const [pnu, parcelData] = parcels[0];
    const marker = parcelData.marker;
    
    return {
      pnu: pnu,
      hasMarker: !!marker,
      markerVisible: marker ? marker.getMap() !== null : false,
      markerPosition: marker ? {
        lat: marker.getPosition().lat(),
        lng: marker.getPosition().lng()
      } : null,
      hasMarkerFlag: parcelData.hasMarker,
      isSaved: parcelData.data?.isSaved,
      owner: parcelData.data?.owner
    };
  });
  
  console.log('저장 후 M 마커 상태:', afterSave);
  
  // 검증
  if (afterSave) {
    expect(afterSave.hasMarker).toBe(true);
    expect(afterSave.markerVisible).toBe(true);
    expect(afterSave.hasMarkerFlag).toBe(true);
    expect(afterSave.isSaved).toBe(true);
    expect(afterSave.owner).toBe('ULTRATHINK 테스트');
    
    console.log('✅ ULTRATHINK M 마커 생성 성공!');
    console.log(`📍 마커 위치: ${afterSave.markerPosition?.lat}, ${afterSave.markerPosition?.lng}`);
  } else {
    console.log('❌ M 마커 상태를 확인할 수 없음');
    throw new Error('M 마커 생성 실패');
  }
  
  console.log('🎉 ULTRATHINK M 마커 테스트 완료!');
});