// 🎯 실시간 저장 버그 디버깅
const { test, expect } = require('@playwright/test');

test('실시간 저장 버그 디버깅', async ({ page }) => {
  // 모든 콘솔 로그 캡처
  const logs = [];
  page.on('console', msg => {
    logs.push(`${Date.now()}: ${msg.type()}: ${msg.text()}`);
  });
  
  await page.goto('http://localhost:3000');
  console.log('✅ 페이지 로드 완료');
  
  await page.waitForTimeout(4000);
  console.log('✅ 초기 로딩 대기 완료');
  
  // 1단계: 필지 클릭
  console.log('🖱️ 1단계: 필지 클릭');
  const map = page.locator('#map');
  await map.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(3000);
  
  const parcelNumber = await page.locator('#parcelNumber').inputValue();
  console.log(`📝 로드된 필지: ${parcelNumber}`);
  
  // 2단계: 정보 입력
  console.log('✏️ 2단계: 정보 입력');
  await page.locator('#ownerName').fill('디버그 테스트');
  await page.locator('#memo').fill('실시간 버그 확인');
  
  // 저장 전 로그 클리어
  logs.length = 0;
  
  // 3단계: 저장 버튼 클릭
  console.log('💾 3단계: 저장 버튼 클릭');
  
  // 저장 버튼 상태 확인
  const saveBtn = page.locator('#saveBtn');
  const isVisible = await saveBtn.isVisible();
  const isEnabled = await saveBtn.isEnabled();
  console.log(`저장 버튼 상태: visible=${isVisible}, enabled=${isEnabled}`);
  
  // 저장 클릭
  await saveBtn.click();
  
  // 1초만 대기하고 로그 확인
  await page.waitForTimeout(1000);
  
  console.log('\\n📋 저장 후 1초간의 로그:');
  const recentLogs = logs.slice(-20); // 최근 20개만
  recentLogs.forEach((log, index) => {
    console.log(`${index + 1}. ${log}`);
  });
  
  console.log(`\\n📊 총 로그 수: ${logs.length}개`);
  
  // 삭제 메시지가 반복되는지 확인
  const deleteMessages = logs.filter(log => log.includes('필지가 삭제되었습니다'));
  console.log(`🔍 '필지가 삭제되었습니다' 메시지 수: ${deleteMessages.length}개`);
  
  // SUCCESS 메시지 확인
  const successMessages = logs.filter(log => log.includes('SUCCESS') || log.includes('저장되었습니다'));
  console.log(`✅ '저장 성공' 메시지 수: ${successMessages.length}개`);
  
  // 로그가 너무 많으면 무한 루프 감지
  if (logs.length > 100) {
    console.log('🚨 무한 루프 감지! 로그가 100개 이상입니다.');
  } else {
    console.log('✅ 정상적인 로그 수준입니다.');
  }
  
  // M 마커 확인
  const mMarkers = page.locator('#map div:has-text("M")');
  const markerCount = await mMarkers.count();
  console.log(`🔍 M 마커 수: ${markerCount}개`);
  
  // AppState 확인
  const appState = await page.evaluate(() => {
    if (!window.AppState) return null;
    
    const parcels = Array.from(window.AppState.clickParcels.entries());
    const savedParcels = parcels.filter(([pnu, data]) => data.isSaved === true);
    
    return {
      totalParcels: parcels.length,
      savedParcels: savedParcels.length,
      hasCurrentSelected: !!window.AppState.currentSelectedParcel
    };
  });
  
  console.log('📊 AppState 상태:', appState);
});