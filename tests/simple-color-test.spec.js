// 🎯 간단한 색칠 기능 테스트
const { test, expect } = require('@playwright/test');

test('필지 색칠 기능 테스트', async ({ page }) => {
  console.log('🎯 필지 색칠 기능 테스트 시작');
  
  // 콘솔 로그 수집
  page.on('console', (msg) => {
    if (msg.type() === 'log' && msg.text().includes('색칠')) {
      console.log('🎨 색칠 로그:', msg.text());
    }
  });
  
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(3000);
  
  console.log('1. 필지 클릭');
  const map = page.locator('#map');
  await map.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(2000);
  
  console.log('2. 빨간색 선택');
  const redColorBtn = page.locator('.color-item[data-color="#FF0000"]');
  await redColorBtn.click();
  await page.waitForTimeout(500);
  
  console.log('3. 필지에 색칠 시도');
  await map.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(3000);
  
  // 색칠 상태 확인
  const colorState = await page.evaluate(() => {
    if (!window.AppState) return null;
    
    const parcels = Array.from(window.AppState.clickParcels.entries());
    if (parcels.length === 0) return { hasParcel: false };
    
    const [pnu, data] = parcels[0];
    return {
      hasParcel: true,
      pnu: pnu,
      hasPolygon: !!data.polygon,
      polygonVisible: data.polygon ? data.polygon.getMap() !== null : false,
      paintMode: window.paintModeEnabled
    };
  });
  
  console.log('🎨 색칠 상태:', colorState);
  
  if (colorState && colorState.hasParcel) {
    console.log('✅ 필지 존재함');
    if (colorState.hasPolygon && colorState.polygonVisible) {
      console.log('✅ 색칠 성공!');
    } else {
      console.log('❌ 색칠 실패');
    }
  } else {
    console.log('❌ 필지 없음');
  }
});