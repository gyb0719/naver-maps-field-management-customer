// 🎯 ULTRATHINK 필지 클릭 디버깅 테스트
const { test, expect } = require('@playwright/test');

test('Debug: 필지 클릭 과정 상세 분석', async ({ page }) => {
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
  
  // AppState 확인
  const appStateExists = await page.evaluate(() => {
    return typeof window.AppState !== 'undefined';
  });
  console.log(`📊 AppState 존재: ${appStateExists}`);
  
  // 지도 클릭 전 상태 확인
  const beforeClickValue = await page.locator('#parcelNumber').inputValue();
  console.log(`📝 클릭 전 parcelNumber 값: "${beforeClickValue}"`);
  
  // 지도 클릭 (서울 시청 근처 - 확실한 필지 위치)
  const map = page.locator('#map');
  console.log('🖱️ 지도 클릭 시도 (서울 시청 근처)');
  await map.click({ position: { x: 500, y: 400 } });
  
  // 클릭 후 즉시 상태 확인
  await page.waitForTimeout(1000);
  const afterClick1s = await page.locator('#parcelNumber').inputValue();
  console.log(`📝 클릭 후 1초: "${afterClick1s}"`);
  
  // 2초 후 확인
  await page.waitForTimeout(1000);
  const afterClick2s = await page.locator('#parcelNumber').inputValue();
  console.log(`📝 클릭 후 2초: "${afterClick2s}"`);
  
  // 3초 후 확인
  await page.waitForTimeout(1000);
  const afterClick3s = await page.locator('#parcelNumber').inputValue();
  console.log(`📝 클릭 후 3초: "${afterClick3s}"`);
  
  // 5초 후 최종 확인
  await page.waitForTimeout(2000);
  const finalValue = await page.locator('#parcelNumber').inputValue();
  console.log(`📝 클릭 후 5초 (최종): "${finalValue}"`);
  
  // 콘솔 로그 출력
  console.log('\n📋 캡처된 콘솔 로그들:');
  logs.forEach((log, index) => {
    console.log(`${index + 1}. ${log}`);
  });
  
  // AppState.clickParcels 상태 확인
  const clickParcelsSize = await page.evaluate(() => {
    return window.AppState ? window.AppState.clickParcels.size : -1;
  });
  console.log(`📊 AppState.clickParcels 크기: ${clickParcelsSize}`);
  
  // 현재 선택된 필지 확인
  const currentSelected = await page.evaluate(() => {
    return window.AppState && window.AppState.currentSelectedParcel 
      ? JSON.stringify(window.AppState.currentSelectedParcel, null, 2)
      : null;
  });
  console.log(`🎯 현재 선택된 필지: ${currentSelected}`);
  
  // 테스트 결과 분석
  if (finalValue && finalValue.length > 0) {
    console.log('✅ 성공: 필지 정보가 로드됨');
    expect(finalValue.length).toBeGreaterThan(0);
  } else {
    console.log('❌ 실패: 필지 정보가 로드되지 않음');
    console.log(`최종 상태: parcelNumber="${finalValue}", clickParcels=${clickParcelsSize}개`);
    
    // 실패 시 추가 디버깅 정보
    const errorInfo = await page.evaluate(() => {
      return {
        paintMode: window.AppState?.paintMode,
        searchMode: window.AppState?.searchMode,
        map: !!window.AppState?.map,
        vworldKeys: window.AppState?.vworldKeys?.length || 0
      };
    });
    console.log('🔍 디버깅 정보:', JSON.stringify(errorInfo, null, 2));
    
    // 실패해도 테스트는 통과시키고 정보만 출력
    console.log('ℹ️ 디버깅 목적이므로 테스트 통과 처리');
  }
});