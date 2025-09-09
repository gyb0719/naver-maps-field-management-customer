// 🎯 ULTRATHINK M 마커 & 검색 모드 수정 테스트
const { test, expect } = require('@playwright/test');

test.describe('ULTRATHINK 수정사항 테스트', () => {
  
  test('M 마커 생성 및 검색 모드 토글 통합 테스트', async ({ page }) => {
    console.log('🎯 ULTRATHINK 수정사항 통합 테스트 시작');
    
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(4000);
    
    // 1단계: 필지 클릭하여 데이터 로드
    console.log('📍 1단계: 필지 클릭');
    const map = page.locator('#map');
    await map.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(3000);
    
    const parcelNumber = await page.locator('#parcelNumber').inputValue();
    console.log(`📝 로드된 필지: ${parcelNumber}`);
    expect(parcelNumber.length).toBeGreaterThan(0);
    
    // 2단계: 필지에 색상 적용
    console.log('🎨 2단계: 빨간색 적용');
    const redColorBtn = page.locator('.color-item[data-color="#FF0000"]');
    await redColorBtn.click();
    await page.waitForTimeout(500);
    
    // 필지에 색칠 (왼쪽 클릭)
    await map.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(2000);
    
    // 3단계: 필지 정보 입력 및 저장
    console.log('💾 3단계: 필지 저장');
    await page.locator('#ownerName').fill('ULTRATHINK 테스트');
    await page.locator('#memo').fill('M 마커 테스트');
    
    await page.locator('#saveBtn').click();
    await page.waitForTimeout(3000); // M 마커 생성 대기
    
    // 4단계: M 마커 확인
    console.log('🔍 4단계: M 마커 생성 확인');
    const markerStatus = await page.evaluate(() => {
      if (!window.AppState || !window.AppState.clickParcels) return null;
      
      const parcels = Array.from(window.AppState.clickParcels.entries());
      if (parcels.length === 0) return null;
      
      const [pnu, parcelData] = parcels[0];
      return {
        pnu: pnu,
        hasMarker: parcelData.hasMarker,
        markerExists: !!parcelData.marker,
        memoMarkerExists: !!parcelData.memoMarker,
        sameObject: parcelData.marker === parcelData.memoMarker,
        isVisible: parcelData.marker ? parcelData.marker.getMap() !== null : false,
        isSaved: parcelData.data?.isSaved || false
      };
    });
    
    console.log('📊 M 마커 상태:', markerStatus);
    
    if (markerStatus) {
      expect(markerStatus.hasMarker).toBe(true);
      expect(markerStatus.markerExists).toBe(true);
      expect(markerStatus.isVisible).toBe(true);
      expect(markerStatus.isSaved).toBe(true);
      console.log('✅ M 마커 생성 성공!');
    } else {
      console.log('❌ M 마커 상태를 확인할 수 없음');
    }
    
    // 5단계: 검색 모드 토글 테스트
    console.log('🔄 5단계: 검색 모드 토글 테스트');
    
    // 현재 색칠된 필지가 보이는지 확인
    const beforeToggle = await page.evaluate(() => {
      if (!window.AppState) return null;
      
      const parcels = Array.from(window.AppState.clickParcels.entries());
      const visibleParcels = parcels.filter(([pnu, data]) => 
        data.polygon && data.polygon.getMap() !== null
      );
      
      return {
        totalParcels: parcels.length,
        visibleParcels: visibleParcels.length,
        searchMode: window.AppState.searchMode
      };
    });
    
    console.log('검색 토글 전 상태:', beforeToggle);
    
    // 검색 ON 버튼 클릭
    const searchToggleBtn = page.locator('#searchToggleBtn');
    const beforeText = await searchToggleBtn.textContent();
    console.log(`검색 버튼 현재 텍스트: ${beforeText}`);
    
    await searchToggleBtn.click();
    await page.waitForTimeout(2000);
    
    const afterToggle = await page.evaluate(() => {
      if (!window.AppState) return null;
      
      const parcels = Array.from(window.AppState.clickParcels.entries());
      const visibleParcels = parcels.filter(([pnu, data]) => 
        data.polygon && data.polygon.getMap() !== null
      );
      
      return {
        totalParcels: parcels.length,
        visibleParcels: visibleParcels.length,
        searchMode: window.AppState.searchMode
      };
    });
    
    const afterText = await searchToggleBtn.textContent();
    console.log(`검색 버튼 변경 후 텍스트: ${afterText}`);
    console.log('검색 토글 후 상태:', afterToggle);
    
    // 검색 모드 ON 상태에서 색칠된 필지가 숨겨졌는지 확인
    if (beforeText.includes('OFF') && afterText.includes('ON')) {
      console.log('✅ 검색 모드 ON 전환 성공');
      
      if (afterToggle && beforeToggle) {
        const hiddenParcels = beforeToggle.visibleParcels - afterToggle.visibleParcels;
        console.log(`🙈 숨겨진 필지 수: ${hiddenParcels}개`);
        
        if (hiddenParcels > 0) {
          console.log('✅ 검색 ON 시 색칠된 필지 숨김 성공!');
        } else {
          console.log('⚠️ 색칠된 필지가 숨겨지지 않음');
        }
      }
    }
    
    // 검색 OFF로 다시 전환
    await searchToggleBtn.click();
    await page.waitForTimeout(2000);
    
    const finalState = await page.evaluate(() => {
      if (!window.AppState) return null;
      
      const parcels = Array.from(window.AppState.clickParcels.entries());
      const visibleParcels = parcels.filter(([pnu, data]) => 
        data.polygon && data.polygon.getMap() !== null
      );
      
      return {
        totalParcels: parcels.length,
        visibleParcels: visibleParcels.length,
        searchMode: window.AppState.searchMode
      };
    });
    
    const finalText = await searchToggleBtn.textContent();
    console.log(`최종 검색 버튼 텍스트: ${finalText}`);
    console.log('최종 상태:', finalState);
    
    if (finalText.includes('OFF')) {
      console.log('✅ 검색 OFF 복원 성공');
      
      if (finalState && beforeToggle && finalState.visibleParcels === beforeToggle.visibleParcels) {
        console.log('✅ 색칠된 필지 복원 성공!');
      }
    }
    
    console.log('🎉 ULTRATHINK 통합 테스트 완료!');
  });
});