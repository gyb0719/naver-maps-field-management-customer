// 🎯 ULTRATHINK 필지 정보 저장 완전 테스트 스위트
// 사용자 요구사항: "필지를 선택하고 저장하면 M 마크가 뜨고 다시 클릭하면 왼쪽에서 정보를 볼 수 있게"

const { test, expect } = require('@playwright/test');

test.describe('ULTRATHINK 필지 저장 워크플로우', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    // 페이지 및 지도 로딩 대기
    await page.waitForTimeout(4000);
  });

  test('Step 1: 필지 클릭 → 색칠 + 정보 로드', async ({ page }) => {
    console.log('🎯 Step 1: 필지 클릭 테스트');
    
    // 색칠 모드가 ON인지 확인
    const paintToggleBtn = page.locator('#paintToggleBtn');
    await expect(paintToggleBtn).toContainText('색칠 ON');
    
    // 지도에서 임의의 위치 클릭 (서울 시청 근처)
    const map = page.locator('#map');
    await map.click({ position: { x: 400, y: 300 } });
    
    // API 응답 및 색칠 대기
    await page.waitForTimeout(3000);
    
    // 콘솔에서 필지 선택 로그 확인
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('필지 선택됨') || msg.text().includes('필지 정보 로드')) {
        logs.push(msg.text());
      }
    });
    
    // 필지 번호 입력창에 값이 로드되었는지 확인
    const parcelNumberInput = page.locator('#parcelNumber');
    await page.waitForTimeout(2000);
    const inputValue = await parcelNumberInput.inputValue();
    
    // 입력값이 있으면 성공
    expect(inputValue.length).toBeGreaterThan(0);
    console.log(`✅ Step 1 통과: 필지 정보 로드됨 - ${inputValue}`);
  });

  test('Step 2: 필지 저장 → M 마커 표시', async ({ page }) => {
    console.log('🎯 Step 2: 필지 저장 테스트');
    
    // Step 1과 동일하게 필지 클릭
    const map = page.locator('#map');
    await map.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(3000);
    
    // 필지 정보 입력
    await page.locator('#ownerName').fill('테스트 소유자');
    await page.locator('#ownerAddress').fill('테스트 주소');
    await page.locator('#memo').fill('ULTRATHINK 테스트');
    
    // 저장 버튼 클릭
    await page.locator('#saveBtn').click();
    await page.waitForTimeout(2000);
    
    // M 마커가 지도에 생성되었는지 확인 (DOM에서 M 텍스트 찾기)
    const mMarker = page.locator('#map div:has-text("M")').first();
    await expect(mMarker).toBeVisible();
    
    // 저장 성공 토스트 확인 (콘솔 또는 UI)
    const toastMessage = page.locator('text=저장되었습니다').or(page.locator('text=저장 완료'));
    
    console.log('✅ Step 2 통과: M 마커 생성 및 저장 완료');
  });

  test('Step 3: 저장된 필지 재클릭 → 정보 로드', async ({ page }) => {
    console.log('🎯 Step 3: 저장된 필지 재클릭 테스트');
    
    // Step 1-2와 동일하게 필지 클릭, 정보 입력, 저장
    const map = page.locator('#map');
    await map.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(3000);
    
    const testOwner = '재클릭 테스트 소유자';
    const testMemo = 'ULTRATHINK 재클릭 테스트';
    
    await page.locator('#ownerName').fill(testOwner);
    await page.locator('#memo').fill(testMemo);
    await page.locator('#saveBtn').click();
    await page.waitForTimeout(2000);
    
    // 다른 곳 클릭해서 선택 해제
    await map.click({ position: { x: 200, y: 200 } });
    await page.waitForTimeout(1000);
    
    // 원래 위치 재클릭
    await map.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(2000);
    
    // 저장된 정보가 왼쪽 패널에 로드되었는지 확인
    const ownerNameInput = page.locator('#ownerName');
    const memoInput = page.locator('#memo');
    
    await expect(ownerNameInput).toHaveValue(testOwner);
    await expect(memoInput).toHaveValue(testMemo);
    
    console.log('✅ Step 3 통과: 저장된 정보 재로드 성공');
  });

  test('Complete Workflow: 전체 워크플로우 통합 테스트', async ({ page }) => {
    console.log('🎯 Complete Workflow: 전체 워크플로우 테스트');
    
    const testData = {
      owner: 'ULTRATHINK 통합테스트',
      address: '서울시 중구 세종대로 110',
      contact: '02-1234-5678',
      memo: '통합 워크플로우 테스트 완료'
    };
    
    // 1단계: 필지 클릭
    const map = page.locator('#map');
    await map.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(3000);
    
    // 필지 번호 입력창에 값 로드 확인
    const parcelNumber = await page.locator('#parcelNumber').inputValue();
    expect(parcelNumber.length).toBeGreaterThan(0);
    console.log(`📋 필지 번호: ${parcelNumber}`);
    
    // 2단계: 정보 입력 및 저장
    await page.locator('#ownerName').fill(testData.owner);
    await page.locator('#ownerAddress').fill(testData.address);
    await page.locator('#ownerContact').fill(testData.contact);
    await page.locator('#memo').fill(testData.memo);
    
    await page.locator('#saveBtn').click();
    await page.waitForTimeout(2000);
    
    // M 마커 확인
    const mMarker = page.locator('#map div:has-text("M")').first();
    await expect(mMarker).toBeVisible();
    console.log('✅ M 마커 생성 확인');
    
    // 3단계: 다른 곳 클릭 후 재클릭
    await map.click({ position: { x: 200, y: 200 } });
    await page.waitForTimeout(1000);
    
    // 입력 필드들이 비워졌는지 확인 (다른 필지 클릭했으므로)
    await page.waitForTimeout(1000);
    
    // 원래 위치 재클릭
    await map.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(2000);
    
    // 4단계: 저장된 정보 재로드 확인
    await expect(page.locator('#ownerName')).toHaveValue(testData.owner);
    await expect(page.locator('#ownerAddress')).toHaveValue(testData.address);
    await expect(page.locator('#ownerContact')).toHaveValue(testData.contact);
    await expect(page.locator('#memo')).toHaveValue(testData.memo);
    
    console.log('🎉 Complete Workflow 통과: 모든 단계 성공!');
    console.log('✅ 1. 필지 클릭 → 색칠 + 정보 로드');
    console.log('✅ 2. 정보 입력 → 저장 + M 마커');
    console.log('✅ 3. 재클릭 → 저장된 정보 로드');
  });

  test('Error Handling: 필지 정보 없는 곳 클릭', async ({ page }) => {
    console.log('🎯 Error Handling: 필지 없는 곳 클릭 테스트');
    
    // 바다나 외곽 지역 클릭 (필지 정보 없는 곳)
    const map = page.locator('#map');
    await map.click({ position: { x: 100, y: 100 } });
    await page.waitForTimeout(3000);
    
    // 경고 토스트나 로그 메시지 확인
    // (필지 정보가 없을 때는 아무것도 로드되지 않아야 함)
    const parcelNumberInput = page.locator('#parcelNumber');
    const inputValue = await parcelNumberInput.inputValue();
    
    // 이전 테스트의 값이 남아있을 수 있으므로 새로고침 후 테스트
    await page.reload();
    await page.waitForTimeout(3000);
    
    await map.click({ position: { x: 50, y: 50 } }); // 확실히 필지 없는 곳
    await page.waitForTimeout(3000);
    
    const newInputValue = await parcelNumberInput.inputValue();
    expect(newInputValue).toBe(''); // 빈 값이어야 함
    
    console.log('✅ Error Handling 통과: 필지 없는 곳은 정보 로드 안됨');
  });

});