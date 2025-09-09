// 🎯 빠른 전체 컴포넌트 체크
const { test, expect } = require('@playwright/test');

test.describe('빠른 전체 시스템 체크', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(4000); // 로딩 대기
  });

  test('UI 컴포넌트 존재 확인', async ({ page }) => {
    console.log('🎯 UI 컴포넌트 존재 확인');
    
    // 필수 버튼들
    await expect(page.locator('#searchToggleBtn')).toBeVisible();
    await expect(page.locator('#paintToggleBtn')).toBeVisible();
    await expect(page.locator('#saveBtn')).toBeVisible();
    
    // 입력 필드들  
    await expect(page.locator('#parcelNumber')).toBeVisible();
    await expect(page.locator('#ownerName')).toBeVisible();
    await expect(page.locator('#memo')).toBeVisible();
    
    // 색상 팔레트
    const colorButtons = await page.locator('.color-item').count();
    expect(colorButtons).toBe(8);
    
    console.log(`✅ UI 컴포넌트 체크 완료: 색상 버튼 ${colorButtons}개`);
  });

  test('기본 기능 작동 확인', async ({ page }) => {
    console.log('🎯 기본 기능 작동 확인');
    
    // 색칠 모드 토글
    const paintBtn = page.locator('#paintToggleBtn');
    await expect(paintBtn).toHaveText('색칠 ON');
    
    await paintBtn.click();
    await expect(paintBtn).toHaveText('색칠 OFF');
    
    await paintBtn.click(); 
    await expect(paintBtn).toHaveText('색칠 ON');
    
    // 검색 모드 토글
    const searchBtn = page.locator('#searchToggleBtn');
    await expect(searchBtn).toHaveText('검색 OFF');
    
    await searchBtn.click();
    await expect(searchBtn).toHaveText('검색 ON');
    
    await searchBtn.click();
    await expect(searchBtn).toHaveText('검색 OFF');
    
    console.log('✅ 기본 토글 기능 정상 작동');
  });

  test('필지 클릭 및 저장 테스트', async ({ page }) => {
    console.log('🎯 필지 클릭 및 저장 테스트');
    
    // 지도 클릭
    const map = page.locator('#map');
    await map.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(3000);
    
    // 필지 번호 로드 확인
    const parcelNumber = await page.locator('#parcelNumber').inputValue();
    expect(parcelNumber.length).toBeGreaterThan(0);
    console.log(`📍 필지 클릭 성공: ${parcelNumber}`);
    
    // 정보 입력
    await page.locator('#ownerName').fill('빠른 테스트');
    await page.locator('#memo').fill('컴포넌트 체크');
    
    // 저장
    await page.locator('#saveBtn').click();
    await page.waitForTimeout(2000);
    
    // M 마커 확인
    const mMarkers = page.locator('#map div:has-text("M")');
    const markerCount = await mMarkers.count();
    expect(markerCount).toBeGreaterThan(0);
    
    console.log(`✅ 저장 및 M 마커 생성 성공: ${markerCount}개`);
  });

  test('AppState 무결성 확인', async ({ page }) => {
    console.log('🎯 AppState 무결성 확인');
    
    const appState = await page.evaluate(() => {
      if (!window.AppState) return null;
      
      return {
        paintMode: window.AppState.paintMode,
        searchMode: window.AppState.searchMode,
        hasMap: !!window.AppState.map,
        vworldKeysCount: window.AppState.vworldKeys?.length || 0,
        clickParcelsSize: window.AppState.clickParcels?.size || 0,
        searchParcelsSize: window.AppState.searchParcels?.size || 0
      };
    });
    
    expect(appState).not.toBeNull();
    expect(appState.hasMap).toBe(true);
    expect(appState.vworldKeysCount).toBeGreaterThan(0);
    
    console.log('✅ AppState 상태:', appState);
  });

  test('전역 함수 존재 확인', async ({ page }) => {
    console.log('🎯 전역 함수 존재 확인');
    
    const functions = await page.evaluate(() => {
      const funcs = [
        'AppState',
        'handleMapLeftClick',
        'saveCurrentParcel',
        'colorParcel',
        'showSearchParcels',
        'hideSearchParcels'
      ];
      
      return funcs.map(func => ({
        name: func,
        exists: typeof window[func] !== 'undefined'
      }));
    });
    
    const missingFuncs = functions.filter(f => !f.exists);
    expect(missingFuncs.length).toBe(0);
    
    console.log('✅ 필수 전역 함수 모두 존재');
    functions.forEach(f => {
      console.log(`  - ${f.name}: ${f.exists ? '✅' : '❌'}`);
    });
  });

});