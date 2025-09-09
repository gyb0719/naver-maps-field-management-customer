// 🎯 실제 M 마커 생성 문제 진단
const { test, expect } = require('@playwright/test');

test('M 마커 생성 실패 원인 진단', async ({ page }) => {
  console.log('🎯 M 마커 생성 실패 원인 진단 시작');
  
  // 모든 콘솔 로그 수집
  page.on('console', (msg) => {
    console.log(`📱 ${msg.type()}: ${msg.text()}`);
  });
  
  // 에러 로그 수집
  page.on('pageerror', (error) => {
    console.log('🚨 페이지 에러:', error.message);
  });
  
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(3000);
  
  // 1. 필지 클릭
  console.log('📍 1단계: 필지 클릭');
  const map = page.locator('#map');
  await map.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(2000);
  
  // 2. 색상 적용
  console.log('🎨 2단계: 색상 적용');
  const redColorBtn = page.locator('.color-item[data-color="#FF0000"]');
  await redColorBtn.click();
  await page.waitForTimeout(500);
  await map.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(1000);
  
  // 3. 저장 전 상태 확인
  console.log('🔍 3단계: 저장 전 상태 확인');
  const beforeSave = await page.evaluate(() => {
    const result = {
      hasAppState: !!window.AppState,
      hasCreateMMarkerFunc: typeof window.createMMarker === 'function',
      hasAppCoreCreateMarker: !!(window.AppCore && window.AppCore.createMMarker),
      parcelCount: window.AppState ? window.AppState.clickParcels.size : 0,
      currentSelected: window.AppState ? window.AppState.currentSelectedParcel : null,
      mapExists: !!window.map
    };
    
    if (window.AppState && window.AppState.clickParcels.size > 0) {
      const firstParcel = window.AppState.clickParcels.entries().next().value;
      result.firstParcelPnu = firstParcel[0];
      result.firstParcelHasMarker = !!firstParcel[1].marker;
      result.firstParcelData = {
        hasData: !!firstParcel[1].data,
        hasPolygon: !!firstParcel[1].polygon,
        hasGeometry: !!(firstParcel[1].data && firstParcel[1].data.geometry)
      };
    }
    
    return result;
  });
  
  console.log('저장 전 진단 결과:', JSON.stringify(beforeSave, null, 2));
  
  // 4. 정보 입력 및 저장 시도
  console.log('💾 4단계: 정보 입력 및 저장');
  await page.locator('#ownerName').fill('마커 테스트');
  await page.locator('#memo').fill('M 마커 생성 디버그');
  
  // 저장 버튼 클릭
  console.log('🔴 저장 버튼 클릭!');
  await page.locator('#saveBtn').click();
  await page.waitForTimeout(3000);
  
  // 5. 저장 후 상태 확인
  console.log('✅ 5단계: 저장 후 상태 확인');
  const afterSave = await page.evaluate(() => {
    const result = {
      parcelCount: window.AppState ? window.AppState.clickParcels.size : 0,
      markers: []
    };
    
    if (window.AppState && window.AppState.clickParcels.size > 0) {
      const parcels = Array.from(window.AppState.clickParcels.entries());
      parcels.forEach(([pnu, data], index) => {
        result.markers.push({
          pnu: pnu,
          hasMarker: !!data.marker,
          markerVisible: data.marker ? data.marker.getMap() !== null : false,
          hasMarkerFlag: data.hasMarker,
          isSaved: data.data ? data.data.isSaved : false,
          markerPosition: data.marker ? {
            lat: data.marker.getPosition().lat(),
            lng: data.marker.getPosition().lng()
          } : null
        });
      });
    }
    
    return result;
  });
  
  console.log('저장 후 마커 상태:', JSON.stringify(afterSave, null, 2));
  
  // 6. createMMarker 함수 직접 호출 테스트
  console.log('🔧 6단계: createMMarker 함수 직접 호출');
  const directTest = await page.evaluate(() => {
    if (!window.AppState || window.AppState.clickParcels.size === 0) {
      return { error: 'No parcels to test' };
    }
    
    const firstPnu = window.AppState.clickParcels.keys().next().value;
    console.log('직접 호출할 PNU:', firstPnu);
    
    try {
      let result;
      if (window.AppCore && window.AppCore.createMMarker) {
        console.log('AppCore.createMMarker 호출');
        result = window.AppCore.createMMarker(firstPnu);
      } else if (typeof window.createMMarker === 'function') {
        console.log('window.createMMarker 호출');
        result = window.createMMarker(firstPnu);
      } else {
        return { error: 'createMMarker function not found' };
      }
      
      return { 
        result: result,
        pnu: firstPnu,
        success: true 
      };
    } catch (error) {
      return { 
        error: error.message,
        pnu: firstPnu,
        success: false 
      };
    }
  });
  
  console.log('직접 호출 결과:', JSON.stringify(directTest, null, 2));
  
  // 최종 마커 확인
  await page.waitForTimeout(1000);
  const finalCheck = await page.evaluate(() => {
    if (!window.AppState || window.AppState.clickParcels.size === 0) return null;
    
    const firstParcel = window.AppState.clickParcels.entries().next().value;
    const [pnu, data] = firstParcel;
    
    return {
      pnu: pnu,
      hasMarker: !!data.marker,
      markerVisible: data.marker ? data.marker.getMap() !== null : false,
      timestamp: Date.now()
    };
  });
  
  console.log('최종 마커 확인:', finalCheck);
  
  if (finalCheck && !finalCheck.hasMarker) {
    console.log('❌ M 마커 생성 실패!');
  } else if (finalCheck && finalCheck.hasMarker && !finalCheck.markerVisible) {
    console.log('⚠️ M 마커는 생성되었지만 지도에 표시되지 않음!');
  } else if (finalCheck && finalCheck.hasMarker && finalCheck.markerVisible) {
    console.log('✅ M 마커 생성 및 표시 성공!');
  }
});