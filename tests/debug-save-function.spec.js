// 🎯 저장 기능 디버깅 테스트
const { test, expect } = require('@playwright/test');

test('저장 기능 상세 디버깅', async ({ page }) => {
  // 콘솔 로그 캡처
  const logs = [];
  page.on('console', msg => {
    logs.push(`${msg.type()}: ${msg.text()}`);
  });
  
  await page.goto('http://localhost:3000');
  console.log('✅ 페이지 로드 완료');
  
  // 충분한 로딩 시간
  await page.waitForTimeout(5000);
  console.log('✅ 초기 로딩 대기 완료');
  
  // 1단계: 필지 클릭
  console.log('🖱️ 1단계: 필지 클릭');
  const map = page.locator('#map');
  await map.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(3000);
  
  // 필지 정보 로드 확인
  const parcelNumber = await page.locator('#parcelNumber').inputValue();
  console.log(`📝 로드된 필지 번호: "${parcelNumber}"`);
  expect(parcelNumber.length).toBeGreaterThan(0);
  
  // AppState 상태 확인
  const beforeSaveState = await page.evaluate(() => {
    if (!window.AppState) return null;
    
    const currentParcel = window.AppState.currentSelectedParcel;
    return {
      hasCurrentSelected: !!currentParcel,
      currentParcelPnu: currentParcel?.pnu || null,
      currentParcelJibun: currentParcel?.data?.jibun || null,
      clickParcelsCount: window.AppState.clickParcels.size,
      saveFunction: typeof window.saveCurrentParcel === 'function'
    };
  });
  
  console.log('📊 저장 전 상태:', JSON.stringify(beforeSaveState, null, 2));
  
  // 2단계: 정보 입력
  console.log('✏️ 2단계: 정보 입력');
  const testData = {
    owner: 'DEBUG 테스트',
    address: '디버그 주소',
    contact: '010-9999-9999',
    memo: '저장 디버그 테스트'
  };
  
  await page.locator('#ownerName').fill(testData.owner);
  await page.locator('#ownerAddress').fill(testData.address);
  await page.locator('#ownerContact').fill(testData.contact);
  await page.locator('#memo').fill(testData.memo);
  
  console.log('📝 입력 데이터:', testData);
  
  // 3단계: 저장 버튼 클릭 전 확인
  console.log('🔍 3단계: 저장 버튼 상태 확인');
  const saveBtn = page.locator('#saveBtn');
  await expect(saveBtn).toBeVisible();
  await expect(saveBtn).toBeEnabled();
  
  // 저장 전 로그 클리어
  logs.length = 0;
  
  // 4단계: 저장 실행
  console.log('💾 4단계: 저장 실행');
  await saveBtn.click();
  await page.waitForTimeout(3000); // 저장 처리 대기
  
  // 저장 후 상태 확인
  const afterSaveState = await page.evaluate(() => {
    if (!window.AppState) return null;
    
    const parcels = Array.from(window.AppState.clickParcels.entries());
    const savedParcels = parcels.filter(([pnu, data]) => data.isSaved === true);
    const currentParcel = window.AppState.currentSelectedParcel;
    
    return {
      totalParcels: parcels.length,
      savedParcels: savedParcels.length,
      currentSelectedParcel: currentParcel ? {
        pnu: currentParcel.pnu,
        jibun: currentParcel.data.jibun,
        owner: currentParcel.data.owner,
        isSaved: currentParcel.data.isSaved,
        hasMarker: currentParcel.data.hasMarker
      } : null,
      savedParcelsList: savedParcels.map(([pnu, data]) => ({
        pnu,
        jibun: data.jibun,
        owner: data.owner,
        isSaved: data.isSaved,
        hasMarker: data.hasMarker
      }))
    };
  });
  
  console.log('📊 저장 후 상태:', JSON.stringify(afterSaveState, null, 2));
  
  // M 마커 확인
  const mMarkers = page.locator('#map div:has-text("M")');
  const markerCount = await mMarkers.count();
  console.log(`🔍 M 마커 수: ${markerCount}개`);
  
  // 캡처된 로그 출력
  console.log('\\n📋 저장 과정 로그:');
  logs.forEach((log, index) => {
    console.log(`${index + 1}. ${log}`);
  });
  
  // 검증
  if (afterSaveState) {
    expect(afterSaveState.savedParcels).toBeGreaterThan(0);
    expect(afterSaveState.currentSelectedParcel?.isSaved).toBe(true);
    expect(afterSaveState.currentSelectedParcel?.hasMarker).toBe(true);
    expect(markerCount).toBeGreaterThan(0);
    
    console.log('✅ 저장 성공!');
    console.log('✅ M 마커 생성 성공!');
  } else {
    console.log('❌ AppState 접근 실패');
  }
});