// 🎯 ULTRATHINK 전체 컴포넌트 종합 테스트 스위트
const { test, expect } = require('@playwright/test');

test.describe('ULTRATHINK 전체 시스템 컴포넌트 테스트', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    // 페이지 및 지도 완전 로딩 대기
    await page.waitForTimeout(5000);
  });

  test('1. 기본 UI 컴포넌트 및 버튼 테스트', async ({ page }) => {
    console.log('🎯 1. 기본 UI 컴포넌트 테스트 시작');
    
    // 필수 UI 요소들 존재 확인
    const uiElements = [
      '#searchInput',
      '#searchBtn', 
      '#searchToggleBtn',
      '#paintToggleBtn',
      '#parcelNumber',
      '#ownerName',
      '#ownerAddress', 
      '#ownerContact',
      '#memo',
      '#saveBtn'
    ];
    
    for (const selector of uiElements) {
      const element = page.locator(selector);
      await expect(element).toBeVisible();
      console.log(`✅ ${selector} 요소 존재 확인`);
    }
    
    // 색상 팔레트 버튼들 확인
    const colorButtons = [
      '.color-btn[data-color="#FF0000"]', // 빨강
      '.color-btn[data-color="#00FF00"]', // 초록
      '.color-btn[data-color="#0000FF"]', // 파랑
      '.color-btn[data-color="#FFFF00"]', // 노랑
      '.color-btn[data-color="#FF00FF"]', // 마젠타
      '.color-btn[data-color="#00FFFF"]', // 시안
      '.color-btn[data-color="#FFA500"]', // 오렌지
      '.color-btn[data-color="#800080"]'  // 보라
    ];
    
    for (const colorSelector of colorButtons) {
      const colorBtn = page.locator(colorSelector);
      await expect(colorBtn).toBeVisible();
    }
    console.log('✅ 8개 색상 팔레트 버튼 모두 존재 확인');
    
    // 지도 타입 버튼들 확인
    const mapTypeButtons = [
      '.map-type-btn[data-type="normal"]',
      '.map-type-btn[data-type="satellite"]', 
      '.map-type-btn[data-type="hybrid"]',
      '.map-type-btn[data-type="terrain"]'
    ];
    
    for (const mapTypeSelector of mapTypeButtons) {
      const mapTypeBtn = page.locator(mapTypeSelector);
      await expect(mapTypeBtn).toBeVisible();
    }
    console.log('✅ 4개 지도 타입 버튼 모두 존재 확인');
    
    console.log('🎉 1. 기본 UI 컴포넌트 테스트 완료!');
  });

  test('2. 색상 팔레트 시스템 테스트', async ({ page }) => {
    console.log('🎯 2. 색상 팔레트 시스템 테스트 시작');
    
    const testColors = [
      { color: '#FF0000', name: '빨강' },
      { color: '#00FF00', name: '초록' }, 
      { color: '#0000FF', name: '파랑' },
      { color: '#FFFF00', name: '노랑' }
    ];
    
    for (const { color, name } of testColors) {
      // 색상 버튼 클릭
      const colorBtn = page.locator(`.color-btn[data-color="${color}"]`);
      await colorBtn.click();
      await page.waitForTimeout(500);
      
      // AppState에서 선택된 색상 확인
      const selectedColor = await page.evaluate(() => {
        return window.AppState ? window.AppState.currentColor : null;
      });
      
      expect(selectedColor).toBe(color);
      console.log(`✅ ${name}(${color}) 색상 선택 확인`);
      
      // active 클래스 확인
      await expect(colorBtn).toHaveClass(/active/);
    }
    
    console.log('🎉 2. 색상 팔레트 시스템 테스트 완료!');
  });

  test('3. 색칠 모드 ON/OFF 테스트', async ({ page }) => {
    console.log('🎯 3. 색칠 모드 ON/OFF 테스트 시작');
    
    const paintToggleBtn = page.locator('#paintToggleBtn');
    
    // 초기 상태 확인 (ON이 기본값)
    await expect(paintToggleBtn).toHaveText('색칠 ON');
    await expect(paintToggleBtn).toHaveClass(/active/);
    
    let paintMode = await page.evaluate(() => {
      return window.AppState ? window.AppState.paintMode : null;
    });
    expect(paintMode).toBe(true);
    console.log('✅ 초기 색칠 모드: ON 확인');
    
    // OFF로 전환
    await paintToggleBtn.click();
    await page.waitForTimeout(500);
    
    await expect(paintToggleBtn).toHaveText('색칠 OFF');
    await expect(paintToggleBtn).not.toHaveClass('active');
    
    paintMode = await page.evaluate(() => {
      return window.AppState ? window.AppState.paintMode : null;
    });
    expect(paintMode).toBe(false);
    console.log('✅ 색칠 모드 OFF 전환 확인');
    
    // 다시 ON으로 전환
    await paintToggleBtn.click();
    await page.waitForTimeout(500);
    
    await expect(paintToggleBtn).toHaveText('색칠 ON');
    await expect(paintToggleBtn).toHaveClass(/active/);
    
    paintMode = await page.evaluate(() => {
      return window.AppState ? window.AppState.paintMode : null;
    });
    expect(paintMode).toBe(true);
    console.log('✅ 색칠 모드 ON 복원 확인');
    
    console.log('🎉 3. 색칠 모드 ON/OFF 테스트 완료!');
  });

  test('4. 검색 시스템 종합 테스트', async ({ page }) => {
    console.log('🎯 4. 검색 시스템 종합 테스트 시작');
    
    const searchToggleBtn = page.locator('#searchToggleBtn');
    const searchInput = page.locator('#searchInput');
    const searchBtn = page.locator('#searchBtn');
    
    // 초기 검색 OFF 상태 확인
    await expect(searchToggleBtn).toHaveText('검색 OFF');
    await expect(searchToggleBtn).not.toHaveClass('active');
    
    let searchMode = await page.evaluate(() => {
      return window.AppState ? window.AppState.searchMode : null;
    });
    expect(searchMode).toBe(false);
    console.log('✅ 초기 검색 모드: OFF 확인');
    
    // 검색 실행으로 자동 ON 전환 테스트
    await searchInput.fill('서울시 중구');
    await searchBtn.click();
    await page.waitForTimeout(3000); // API 응답 대기
    
    await expect(searchToggleBtn).toHaveText('검색 ON');
    await expect(searchToggleBtn).toHaveClass(/active/);
    
    searchMode = await page.evaluate(() => {
      return window.AppState ? window.AppState.searchMode : null;
    });
    expect(searchMode).toBe(true);
    console.log('✅ 검색 실행 시 자동 ON 전환 확인');
    
    // 엔터키 검색 테스트
    await searchInput.clear();
    await searchInput.fill('경기도 성남시');
    await searchInput.press('Enter');
    await page.waitForTimeout(3000);
    
    // 여전히 ON 상태여야 함
    await expect(searchToggleBtn).toHaveText('검색 ON');
    console.log('✅ 엔터키 검색 기능 확인');
    
    // 수동 OFF 전환
    await searchToggleBtn.click();
    await page.waitForTimeout(500);
    
    await expect(searchToggleBtn).toHaveText('검색 OFF');
    await expect(searchToggleBtn).not.toHaveClass('active');
    console.log('✅ 수동 검색 OFF 전환 확인');
    
    console.log('🎉 4. 검색 시스템 종합 테스트 완료!');
  });

  test('5. 필지 클릭 및 색칠 시스템 테스트', async ({ page }) => {
    console.log('🎯 5. 필지 클릭 및 색칠 시스템 테스트 시작');
    
    // 색칠 모드 ON 확인
    const paintToggleBtn = page.locator('#paintToggleBtn');
    await expect(paintToggleBtn).toHaveText('색칠 ON');
    
    // 빨간색 선택
    const redColorBtn = page.locator('.color-btn[data-color="#FF0000"]');
    await redColorBtn.click();
    await page.waitForTimeout(500);
    
    // 지도 클릭
    const map = page.locator('#map');
    await map.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(3000); // API 응답 대기
    
    // 필지 번호 입력창에 값 로드 확인
    const parcelNumberInput = page.locator('#parcelNumber');
    const parcelNumber = await parcelNumberInput.inputValue();
    
    expect(parcelNumber.length).toBeGreaterThan(0);
    console.log(`✅ 필지 클릭 및 정보 로드: ${parcelNumber}`);
    
    // AppState에서 클릭 필지 확인
    const clickParcelInfo = await page.evaluate(() => {
      if (!window.AppState) return null;
      return {
        clickParcelsCount: window.AppState.clickParcels.size,
        currentSelectedParcel: window.AppState.currentSelectedParcel ? {
          pnu: window.AppState.currentSelectedParcel.pnu,
          jibun: window.AppState.currentSelectedParcel.data.jibun
        } : null
      };
    });
    
    expect(clickParcelInfo.clickParcelsCount).toBeGreaterThan(0);
    expect(clickParcelInfo.currentSelectedParcel).not.toBeNull();
    console.log(`✅ AppState 클릭 필지 수: ${clickParcelInfo.clickParcelsCount}개`);
    console.log(`✅ 선택된 필지: ${clickParcelInfo.currentSelectedParcel?.jibun}`);
    
    console.log('🎉 5. 필지 클릭 및 색칠 시스템 테스트 완료!');
  });

  test('6. 필지 저장 및 M 마커 시스템 테스트', async ({ page }) => {
    console.log('🎯 6. 필지 저장 및 M 마커 시스템 테스트 시작');
    
    // 필지 클릭
    const map = page.locator('#map');
    await map.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(3000);
    
    // 필지 정보 입력
    const testData = {
      owner: 'ULTRATHINK 테스트',
      address: '서울시 중구 테스트동',
      contact: '010-1234-5678',
      memo: '전체 컴포넌트 테스트'
    };
    
    await page.locator('#ownerName').fill(testData.owner);
    await page.locator('#ownerAddress').fill(testData.address);
    await page.locator('#ownerContact').fill(testData.contact);
    await page.locator('#memo').fill(testData.memo);
    
    // 저장 버튼 클릭
    const saveBtn = page.locator('#saveBtn');
    await saveBtn.click();
    await page.waitForTimeout(2000);
    
    // M 마커 생성 확인
    const mMarkers = page.locator('#map div:has-text("M")');
    const markerCount = await mMarkers.count();
    
    expect(markerCount).toBeGreaterThan(0);
    console.log(`✅ M 마커 생성 확인: ${markerCount}개`);
    
    // 저장된 필지 정보 확인
    const savedParcelInfo = await page.evaluate(() => {
      if (!window.AppState) return null;
      
      const parcels = Array.from(window.AppState.clickParcels.entries());
      const savedParcels = parcels.filter(([pnu, data]) => data.isSaved === true);
      
      return {
        totalParcels: parcels.length,
        savedParcels: savedParcels.length,
        savedData: savedParcels.length > 0 ? {
          owner: savedParcels[0][1].owner,
          address: savedParcels[0][1].address,
          contact: savedParcels[0][1].contact,
          memo: savedParcels[0][1].memo,
          hasMarker: savedParcels[0][1].hasMarker
        } : null
      };
    });
    
    expect(savedParcelInfo.savedParcels).toBeGreaterThan(0);
    expect(savedParcelInfo.savedData.owner).toBe(testData.owner);
    expect(savedParcelInfo.savedData.address).toBe(testData.address);
    expect(savedParcelInfo.savedData.contact).toBe(testData.contact);
    expect(savedParcelInfo.savedData.memo).toBe(testData.memo);
    expect(savedParcelInfo.savedData.hasMarker).toBe(true);
    
    console.log('✅ 필지 정보 저장 확인:', savedParcelInfo.savedData);
    
    console.log('🎉 6. 필지 저장 및 M 마커 시스템 테스트 완료!');
  });

  test('7. 지도 타입 변경 테스트', async ({ page }) => {
    console.log('🎯 7. 지도 타입 변경 테스트 시작');
    
    const mapTypes = [
      { type: 'normal', name: '일반' },
      { type: 'satellite', name: '위성' },
      { type: 'hybrid', name: '하이브리드' },
      { type: 'terrain', name: '지형' }
    ];
    
    for (const { type, name } of mapTypes) {
      const mapTypeBtn = page.locator(`.map-type-btn[data-type="${type}"]`);
      await mapTypeBtn.click();
      await page.waitForTimeout(1000);
      
      // active 클래스 확인
      await expect(mapTypeBtn).toHaveClass(/active/);
      console.log(`✅ ${name} 지도 타입 변경 확인`);
    }
    
    console.log('🎉 7. 지도 타입 변경 테스트 완료!');
  });

  test('8. 저장된 필지 재클릭 정보 로드 테스트', async ({ page }) => {
    console.log('🎯 8. 저장된 필지 재클릭 정보 로드 테스트 시작');
    
    // 1단계: 필지 클릭 및 저장
    const map = page.locator('#map');
    await map.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(3000);
    
    const testData = {
      owner: '재클릭 테스트',
      memo: '정보 로드 테스트'
    };
    
    await page.locator('#ownerName').fill(testData.owner);
    await page.locator('#memo').fill(testData.memo);
    await page.locator('#saveBtn').click();
    await page.waitForTimeout(2000);
    
    // 2단계: 다른 곳 클릭으로 선택 해제
    await map.click({ position: { x: 200, y: 200 } });
    await page.waitForTimeout(1000);
    
    // 입력 필드가 비워졌는지 확인
    const ownerAfterDeselect = await page.locator('#ownerName').inputValue();
    const memoAfterDeselect = await page.locator('#memo').inputValue();
    console.log(`📝 선택 해제 후: owner="${ownerAfterDeselect}", memo="${memoAfterDeselect}"`);
    
    // 3단계: 원래 필지 재클릭
    await map.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(2000);
    
    // 저장된 정보가 다시 로드되었는지 확인
    const ownerAfterReclick = await page.locator('#ownerName').inputValue();
    const memoAfterReclick = await page.locator('#memo').inputValue();
    
    expect(ownerAfterReclick).toBe(testData.owner);
    expect(memoAfterReclick).toBe(testData.memo);
    
    console.log(`✅ 재클릭 후 정보 로드: owner="${ownerAfterReclick}", memo="${memoAfterReclick}"`);
    
    console.log('🎉 8. 저장된 필지 재클릭 정보 로드 테스트 완료!');
  });

  test('9. 다중 필지 관리 테스트', async ({ page }) => {
    console.log('🎯 9. 다중 필지 관리 테스트 시작');
    
    const map = page.locator('#map');
    const testPositions = [
      { x: 300, y: 250, owner: '필지A' },
      { x: 500, y: 350, owner: '필지B' },
      { x: 350, y: 400, owner: '필지C' }
    ];
    
    // 여러 필지 클릭 및 저장
    for (let i = 0; i < testPositions.length; i++) {
      const pos = testPositions[i];
      
      // 필지 클릭
      await map.click({ position: { x: pos.x, y: pos.y } });
      await page.waitForTimeout(3000);
      
      // 정보 입력 및 저장
      await page.locator('#ownerName').fill(pos.owner);
      await page.locator('#memo').fill(`다중 테스트 ${i + 1}`);
      await page.locator('#saveBtn').click();
      await page.waitForTimeout(1500);
      
      console.log(`✅ ${pos.owner} 필지 저장 완료`);
    }
    
    // 전체 저장된 필지 수 확인
    const totalSavedParcels = await page.evaluate(() => {
      if (!window.AppState) return 0;
      
      const parcels = Array.from(window.AppState.clickParcels.entries());
      const savedParcels = parcels.filter(([pnu, data]) => data.isSaved === true);
      
      return {
        total: parcels.length,
        saved: savedParcels.length,
        savedList: savedParcels.map(([pnu, data]) => ({
          jibun: data.jibun,
          owner: data.owner,
          hasMarker: data.hasMarker
        }))
      };
    });
    
    expect(totalSavedParcels.saved).toBeGreaterThanOrEqual(3);
    console.log(`✅ 다중 필지 저장 확인: ${totalSavedParcels.saved}개`);
    console.log('📋 저장된 필지 목록:', totalSavedParcels.savedList);
    
    // M 마커 수 확인
    const mMarkers = page.locator('#map div:has-text("M")');
    const markerCount = await mMarkers.count();
    
    expect(markerCount).toBeGreaterThanOrEqual(3);
    console.log(`✅ M 마커 수 확인: ${markerCount}개`);
    
    console.log('🎉 9. 다중 필지 관리 테스트 완료!');
  });

  test('10. 전체 시스템 안정성 테스트', async ({ page }) => {
    console.log('🎯 10. 전체 시스템 안정성 테스트 시작');
    
    // AppState 무결성 확인
    const appStateInfo = await page.evaluate(() => {
      if (!window.AppState) return null;
      
      return {
        paintMode: window.AppState.paintMode,
        searchMode: window.AppState.searchMode,
        currentColor: window.AppState.currentColor,
        clickParcelsCount: window.AppState.clickParcels.size,
        searchParcelsCount: window.AppState.searchParcels.size,
        hasMap: !!window.AppState.map,
        vworldKeysCount: window.AppState.vworldKeys?.length || 0
      };
    });
    
    expect(appStateInfo).not.toBeNull();
    expect(appStateInfo.hasMap).toBe(true);
    expect(appStateInfo.vworldKeysCount).toBeGreaterThan(0);
    console.log('✅ AppState 무결성 확인:', appStateInfo);
    
    // 필수 전역 함수들 존재 확인
    const globalFunctions = await page.evaluate(() => {
      const functions = [
        'AppState',
        'handleMapLeftClick',
        'colorParcel',
        'saveCurrentParcel',
        'loadParcelInfoToPanel',
        'clearParcelInfoPanel',
        'hideSearchParcels',
        'showSearchParcels'
      ];
      
      return functions.map(func => ({
        name: func,
        exists: typeof window[func] !== 'undefined'
      }));
    });
    
    const missingFunctions = globalFunctions.filter(f => !f.exists);
    expect(missingFunctions.length).toBe(0);
    console.log('✅ 필수 전역 함수들 존재 확인');
    
    // 콘솔 에러 확인 (심각한 에러만)
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('parser-blocking')) {
        logs.push(msg.text());
      }
    });
    
    // 빠른 기능 테스트
    await page.locator('#paintToggleBtn').click();
    await page.waitForTimeout(200);
    await page.locator('#paintToggleBtn').click();
    await page.waitForTimeout(200);
    
    await page.locator('#searchToggleBtn').click();
    await page.waitForTimeout(200);
    await page.locator('#searchToggleBtn').click();
    await page.waitForTimeout(200);
    
    const map = page.locator('#map');
    await map.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(2000);
    
    // 심각한 콘솔 에러가 없어야 함
    const seriousErrors = logs.filter(log => 
      log.includes('TypeError') || 
      log.includes('ReferenceError') || 
      log.includes('Cannot read properties')
    );
    
    expect(seriousErrors.length).toBe(0);
    console.log('✅ 콘솔 에러 없음 확인');
    
    console.log('🎉 10. 전체 시스템 안정성 테스트 완료!');
  });

});