// 🎯 빠른 검색 모드 테스트
const { test, expect } = require('@playwright/test');

test('빠른 검색 모드 ON/OFF 테스트', async ({ page }) => {
  console.log('🎯 빠른 검색 모드 테스트 시작');
  
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(3000);
  
  // 필지 클릭
  const map = page.locator('#map');
  await map.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(2000);
  
  // 색상 적용
  const redColorBtn = page.locator('.color-item[data-color="#FF0000"]');
  await redColorBtn.click();
  await page.waitForTimeout(500);
  await map.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(1000);
  
  // 저장
  await page.locator('#ownerName').fill('테스트');
  await page.locator('#saveBtn').click();
  await page.waitForTimeout(2000);
  
  // 검색 ON 버튼 클릭
  const searchToggleBtn = page.locator('#searchToggleBtn');
  const beforeText = await searchToggleBtn.textContent();
  console.log('🔴 버튼 클릭 전:', beforeText);
  
  await searchToggleBtn.click();
  await page.waitForTimeout(2000);
  
  const afterText = await searchToggleBtn.textContent();
  console.log('🟢 버튼 클릭 후:', afterText);
  
  // 상태 확인 (간단하게)
  const isSearchOn = afterText.includes('ON');
  console.log('✅ 검색 모드 전환:', isSearchOn ? '성공' : '실패');
  
  expect(isSearchOn).toBe(true);
});