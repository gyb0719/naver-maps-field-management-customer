// 🎯 ULTRATHINK 검색 워크플로우 완전 테스트
const { test, expect } = require('@playwright/test');

test.describe('검색 ON/OFF 워크플로우 테스트', () => {
  
  test('초기 상태: 검색 OFF가 기본값', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // 페이지 로드 대기
    await page.waitForTimeout(3000);
    
    // 검색 토글 버튼이 OFF 상태인지 확인
    const searchToggleBtn = page.locator('#searchToggleBtn');
    await expect(searchToggleBtn).toHaveText('검색 OFF');
    await expect(searchToggleBtn).not.toHaveClass('active');
    
    console.log('✅ 초기 상태: 검색 OFF 확인됨');
  });
  
  test('검색 시 자동으로 검색 ON 모드 전환', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // 페이지 로드 대기
    await page.waitForTimeout(3000);
    
    // 초기 상태 확인 (검색 OFF)
    const searchToggleBtn = page.locator('#searchToggleBtn');
    await expect(searchToggleBtn).toHaveText('검색 OFF');
    
    // 검색어 입력
    const searchInput = page.locator('#searchInput');
    await searchInput.fill('서울시 강남구');
    
    // 검색 실행
    const searchBtn = page.locator('#searchBtn');
    await searchBtn.click();
    
    // 검색 후 버튼 상태 확인 (자동으로 ON이 되어야 함)
    await page.waitForTimeout(2000); // API 응답 대기
    
    await expect(searchToggleBtn).toHaveText('검색 ON');
    await expect(searchToggleBtn).toHaveClass(/active/);
    
    console.log('✅ 검색 시 자동 ON 전환 확인됨');
  });
  
  test('수동 검색 ON/OFF 토글 기능', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // 페이지 로드 대기
    await page.waitForTimeout(3000);
    
    const searchToggleBtn = page.locator('#searchToggleBtn');
    
    // 초기 상태 (OFF)
    await expect(searchToggleBtn).toHaveText('검색 OFF');
    
    // 수동으로 ON 전환
    await searchToggleBtn.click();
    await expect(searchToggleBtn).toHaveText('검색 ON');
    await expect(searchToggleBtn).toHaveClass(/active/);
    
    // 다시 OFF 전환
    await searchToggleBtn.click();
    await expect(searchToggleBtn).toHaveText('검색 OFF');
    await expect(searchToggleBtn).not.toHaveClass('active');
    
    console.log('✅ 수동 토글 기능 확인됨');
  });
  
  test('엔터키로 검색 시 자동 ON 모드 전환', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // 페이지 로드 대기
    await page.waitForTimeout(3000);
    
    // 초기 상태 확인
    const searchToggleBtn = page.locator('#searchToggleBtn');
    await expect(searchToggleBtn).toHaveText('검색 OFF');
    
    // 검색어 입력 후 엔터키 입력
    const searchInput = page.locator('#searchInput');
    await searchInput.fill('경기도 성남시');
    await searchInput.press('Enter');
    
    // 검색 후 상태 확인
    await page.waitForTimeout(2000);
    
    await expect(searchToggleBtn).toHaveText('검색 ON');
    await expect(searchToggleBtn).toHaveClass(/active/);
    
    console.log('✅ 엔터키 검색 시 자동 ON 전환 확인됨');
  });

});