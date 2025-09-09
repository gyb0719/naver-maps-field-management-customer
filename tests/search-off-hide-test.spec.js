// 🎯 검색 OFF 시 보라색 필지 숨김 테스트
const { test, expect } = require('@playwright/test');

test('검색 OFF 기본값에서 보라색 필지 숨김 테스트', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // 페이지 로딩 대기
  await page.waitForTimeout(4000);
  
  console.log('🎯 검색 OFF 숨김 테스트 시작');
  
  // 초기 검색 버튼 상태 확인 (OFF가 기본값)
  const searchToggleBtn = page.locator('#searchToggleBtn');
  await expect(searchToggleBtn).toHaveText('검색 OFF');
  console.log('✅ 초기 검색 상태: OFF 확인');
  
  // AppState 검색 모드 확인
  const searchMode = await page.evaluate(() => {
    return window.AppState ? window.AppState.searchMode : null;
  });
  
  expect(searchMode).toBe(false);
  console.log('✅ AppState.searchMode: false 확인');
  
  // 검색 필지 수 확인 (숨겨져야 함)
  const searchParcelInfo = await page.evaluate(() => {
    if (!window.AppState) return null;
    
    const searchParcels = Array.from(window.AppState.searchParcels.entries());
    const visibleSearchParcels = searchParcels.filter(([pnu, data]) => {
      return data.polygon && data.polygon.getMap() !== null;
    });
    
    return {
      totalSearchParcels: searchParcels.length,
      visibleSearchParcels: visibleSearchParcels.length
    };
  });
  
  console.log(`📊 검색 필지 상태:`, searchParcelInfo);
  
  // 검색 OFF 상태에서는 보라색 검색 필지가 보이면 안됨
  if (searchParcelInfo) {
    expect(searchParcelInfo.visibleSearchParcels).toBe(0);
    console.log('✅ 검색 OFF 상태에서 보라색 필지 숨김 확인');
  }
  
  // 실제 검색을 해서 자동 ON 전환 테스트
  console.log('🔍 검색 실행하여 자동 ON 전환 테스트');
  
  const searchInput = page.locator('#searchInput');
  await searchInput.fill('서울시 중구');
  
  const searchBtn = page.locator('#searchBtn');
  await searchBtn.click();
  
  // 검색 후 상태 변경 대기
  await page.waitForTimeout(3000);
  
  // 자동으로 검색 ON으로 변경되었는지 확인
  await expect(searchToggleBtn).toHaveText('검색 ON');
  console.log('✅ 검색 실행 시 자동 ON 전환 확인');
  
  // 이제 검색 필지가 보여야 함
  const afterSearchInfo = await page.evaluate(() => {
    if (!window.AppState) return null;
    
    const searchParcels = Array.from(window.AppState.searchParcels.entries());
    const visibleSearchParcels = searchParcels.filter(([pnu, data]) => {
      return data.polygon && data.polygon.getMap() !== null;
    });
    
    return {
      totalSearchParcels: searchParcels.length,
      visibleSearchParcels: visibleSearchParcels.length
    };
  });
  
  console.log(`📊 검색 후 필지 상태:`, afterSearchInfo);
  
  if (afterSearchInfo && afterSearchInfo.totalSearchParcels > 0) {
    expect(afterSearchInfo.visibleSearchParcels).toBeGreaterThan(0);
    console.log('✅ 검색 ON 상태에서 보라색 필지 표시 확인');
  }
  
  // 다시 검색 OFF로 전환
  await searchToggleBtn.click();
  await page.waitForTimeout(1000);
  
  // 검색 OFF로 변경 확인
  await expect(searchToggleBtn).toHaveText('검색 OFF');
  console.log('✅ 수동 검색 OFF 전환 확인');
  
  // 다시 검색 필지가 숨겨졌는지 확인
  const finalSearchInfo = await page.evaluate(() => {
    if (!window.AppState) return null;
    
    const searchParcels = Array.from(window.AppState.searchParcels.entries());
    const visibleSearchParcels = searchParcels.filter(([pnu, data]) => {
      return data.polygon && data.polygon.getMap() !== null;
    });
    
    return {
      totalSearchParcels: searchParcels.length,
      visibleSearchParcels: visibleSearchParcels.length
    };
  });
  
  console.log(`📊 최종 필지 상태:`, finalSearchInfo);
  
  if (finalSearchInfo) {
    expect(finalSearchInfo.visibleSearchParcels).toBe(0);
    console.log('✅ 최종 검색 OFF 상태에서 보라색 필지 숨김 확인');
  }
  
  console.log('🎉 검색 OFF 숨김 테스트 완료!');
});