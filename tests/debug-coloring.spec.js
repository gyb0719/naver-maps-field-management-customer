// 🎯 색칠 기능 디버깅 테스트
const { test, expect } = require('@playwright/test');

test('색칠 기능 상세 디버깅', async ({ page }) => {
  // 콘솔 로그 캡처
  const logs = [];
  page.on('console', msg => {
    logs.push(`${msg.type()}: ${msg.text()}`);
  });
  
  await page.goto('http://localhost:3000');
  console.log('✅ 페이지 로드 완료');
  
  await page.waitForTimeout(4000);
  console.log('✅ 초기 로딩 대기 완료');
  
  // 색칠 모드 확인
  const paintBtn = page.locator('#paintToggleBtn');
  const paintMode = await paintBtn.textContent();
  console.log(`🎨 색칠 모드: ${paintMode}`);
  
  // AppState 색칠 모드 확인
  const appPaintMode = await page.evaluate(() => {
    return window.AppState ? window.AppState.paintMode : null;
  });
  console.log(`📊 AppState 색칠 모드: ${appPaintMode}`);
  
  // 색상 선택 확인
  const currentColor = await page.evaluate(() => {
    return window.AppState ? window.AppState.currentColor : null;
  });
  console.log(`🎨 현재 선택 색상: ${currentColor}`);
  
  // 빨간색 선택
  const redColorBtn = page.locator('.color-item[data-color="#FF0000"]');
  await redColorBtn.click();
  await page.waitForTimeout(500);
  
  const selectedColor = await page.evaluate(() => {
    return window.AppState ? window.AppState.currentColor : null;
  });
  console.log(`🔴 빨간색 선택 후: ${selectedColor}`);
  
  // 로그 클리어
  logs.length = 0;
  
  // 지도 클릭
  console.log('🖱️ 지도 클릭 시도');
  const map = page.locator('#map');
  await map.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(3000);
  
  // 클릭 후 로그 확인
  console.log('\\n📋 클릭 후 로그:');
  logs.forEach((log, index) => {
    console.log(`${index + 1}. ${log}`);
  });
  
  // 필지 번호 확인
  const parcelNumber = await page.locator('#parcelNumber').inputValue();
  console.log(`📝 필지 번호: "${parcelNumber}"`);
  
  // AppState에서 필지 확인
  const parcelInfo = await page.evaluate(() => {
    if (!window.AppState) return null;
    
    const parcels = Array.from(window.AppState.clickParcels.entries());
    return {
      totalParcels: parcels.length,
      parcels: parcels.map(([pnu, data]) => ({
        pnu: pnu,
        jibun: data.jibun,
        color: data.color,
        hasPolygon: !!data.polygon,
        polygonVisible: data.polygon ? data.polygon.getMap() !== null : false
      }))
    };
  });
  
  console.log('📊 필지 상태:', JSON.stringify(parcelInfo, null, 2));
  
  // colorParcel 함수 존재 확인
  const colorParcelExists = await page.evaluate(() => {
    return typeof window.colorParcel === 'function';
  });
  console.log(`🎨 colorParcel 함수 존재: ${colorParcelExists}`);
  
  // handleMapLeftClick 함수 존재 확인  
  const handleMapLeftClickExists = await page.evaluate(() => {
    return typeof window.handleMapLeftClick === 'function';
  });
  console.log(`🖱️ handleMapLeftClick 함수 존재: ${handleMapLeftClickExists}`);
  
  // 결과 분석
  if (parcelNumber && parcelNumber.length > 0) {
    console.log('✅ 필지 정보 로드 성공');
    
    if (parcelInfo && parcelInfo.totalParcels > 0) {
      const parcel = parcelInfo.parcels[0];
      if (parcel.color && parcel.hasPolygon && parcel.polygonVisible) {
        console.log('✅ 색칠 성공!');
      } else {
        console.log('❌ 색칠 실패');
        console.log(`- 색상: ${parcel.color}`);
        console.log(`- 폴리곤 있음: ${parcel.hasPolygon}`);
        console.log(`- 폴리곤 표시됨: ${parcel.polygonVisible}`);
      }
    }
  } else {
    console.log('❌ 필지 정보 로드 실패');
  }
});