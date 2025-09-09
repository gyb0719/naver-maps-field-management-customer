// 클라이언트 사이드 설정 (환경변수 사용)
window.CONFIG = {
    // 이 값들은 빌드 시 환경변수로 대체됨
    NAVER_CLIENT_ID: 'xzbnwd2h1z', // 네이버 지도는 클라이언트 ID만 필요
    
    // 지도 초기 설정
    MAP_DEFAULT_CENTER: {
        lat: 37.5665,
        lng: 126.9780
    },
    MAP_DEFAULT_ZOOM: 15,
    
    // 색상 팔레트
    COLORS: {
        red: '#FF0000',
        orange: '#FFA500',
        yellow: '#FFFF00',
        green: '#90EE90',
        blue: '#0000FF',
        black: '#000000',
        white: '#FFFFFF',
        skyblue: '#87CEEB'
    },
    
    // 필지 하이라이트 색상 (검색 필지용)
    HIGHLIGHT_COLOR: '#9370DB',  // 보라색 (검색 필지)
    HIGHLIGHT_OPACITY: 0.7,
    CLICK_PARCEL_COLOR: '#FFFF00',  // 노란색 (클릭 필지)
    
    // LocalStorage 키
    STORAGE_KEY: 'parcelData',
    
    // Google Sheets Apps Script URL
    GOOGLE_SHEETS_URL: 'https://script.google.com/macros/s/AKfycbxR42RFSg32RjxLzBESBK6lL1KXaCipBiVHK2Crn-GeYyyVMdqTmZGfpBwUFqlZpVxw/exec' // 여기에 Google Apps Script 배포 URL을 입력하세요
};

// 전역 변수
// let map = null; // ❌ 중복 선언 제거 - map.js에서 관리
// let currentColor = window.CONFIG.COLORS.red; // ❌ 중복 선언 제거 - config.js에서 관리

// 필지 모드 관리 - window에 직접 정의 (🎯 ULTRATHINK: 검색 필지 복원 시 모드 보존)
// window.currentMode = 'click'; // 주석 처리 - config.js에서 관리
if (typeof window.currentMode === 'undefined') {
    window.currentMode = 'click'; // 기본값을 클릭 모드로 변경 (필지 색칠 가능)
}
window.clickParcels = new Map(); // 클릭으로 선택한 필지 데이터 저장
window.searchParcels = new Map(); // 검색으로 찾은 필지 데이터 저장

// 하위 호환성을 위한 alias
window.parcels = window.clickParcels;
window.searchResults = window.searchParcels;

let searchResultsVisible = true;
window.currentSelectedPNU = null; // 현재 선택된 필지의 PNU (전역 변수로 변경)

// 필지 표시/숨김 관련 유틸리티 함수들
window.showClickParcels = function() {
    console.log('클릭 필지 표시:', window.clickParcels.size, '개');
    let transparentFixCount = 0;
    
    window.clickParcels.forEach((parcel, key) => {
        if (parcel.polygon) {
            parcel.polygon.setMap(map);
            
            // 🎯 ULTRATHINK: 투명한 필지 자동 색칠 수정
            if (parcel.color === 'transparent' || parcel.color === undefined) {
                const savedData = JSON.parse(localStorage.getItem('parcelData') || '{}');
                const savedInfo = savedData[key];
                
                if (savedInfo && savedInfo.color && savedInfo.color !== 'transparent') {
                    // 저장된 색상으로 복원
                    parcel.color = savedInfo.color;
                    parcel.polygon.setOptions({
                        fillColor: savedInfo.color,
                        fillOpacity: 0.7,
                        strokeColor: savedInfo.color,
                        strokeOpacity: 1.0,
                        strokeWeight: 2
                    });
                    transparentFixCount++;
                    console.log(`🎨 투명 필지 색상 복원: ${key} → ${savedInfo.color}`);
                } else {
                    // 기본 색상 적용 (노란색)
                    parcel.color = '#FFFF00';
                    parcel.polygon.setOptions({
                        fillColor: '#FFFF00',
                        fillOpacity: 0.7,
                        strokeColor: '#FFFF00',
                        strokeOpacity: 1.0,
                        strokeWeight: 2
                    });
                    transparentFixCount++;
                    console.log(`🎨 투명 필지 기본 색상 적용: ${key} → 노란색`);
                }
            }
        }
        if (parcel.label) parcel.label.setMap(map);
    });
    
    if (transparentFixCount > 0) {
        console.log(`✅ ${transparentFixCount}개 투명 필지 색상 복원 완료`);
    }
}

window.hideClickParcels = function() {
    console.log('클릭 필지 숨김:', window.clickParcels.size, '개');
    window.clickParcels.forEach((parcel, key) => {
        if (parcel.polygon) parcel.polygon.setMap(null);
        if (parcel.label) parcel.label.setMap(null);
    });
}

window.showSearchParcels = function() {
    console.log('검색 필지 표시:', window.searchParcels.size, '개');
    window.searchParcels.forEach((parcel, key) => {
        if (parcel.polygon) parcel.polygon.setMap(map);
        if (parcel.label) parcel.label.setMap(map);
    });
}

window.hideSearchParcels = function() {
    console.log('검색 필지 숨김:', window.searchParcels.size, '개');
    window.searchParcels.forEach((parcel, key) => {
        if (parcel.polygon) parcel.polygon.setMap(null);
        if (parcel.label) parcel.label.setMap(null);
    });
}

// 🎯 ULTRATHINK: Early Bootstrap - 검색 필지 복원 시스템 (config-client.js)
window.earlyRestoreSearchParcels = function() {
    try {
        console.log('🚀 ULTRATHINK Early Bootstrap: 검색 필지 복원 시작 (config-client.js)');
        
        // 의존성 체크
        if (!window.map || !window.searchParcels || typeof formatJibun !== 'function') {
            console.log('⏳ Early Bootstrap: 의존성 대기 중...');
            return false;
        }
        
        // sessionStorage에서 데이터 로드
        const sessionData = JSON.parse(sessionStorage.getItem('searchParcels') || '{}');
        const searchKeys = Object.keys(sessionData);
        
        if (searchKeys.length === 0) {
            console.log('💾 Early Bootstrap: 복원할 검색 필지 없음');
            return true;
        }
        
        // 🎯 ULTRATHINK: 검색 필지가 있으면 검색 모드로 강제 설정
        console.log(`🔄 검색 필지 ${searchKeys.length}개 발견 - 검색 모드로 강제 변경`);
        window.currentMode = 'search';
        
        console.log(`🟣 Early Bootstrap: ${searchKeys.length}개 검색 필지 복원 시작`);
        
        let restoredCount = 0;
        searchKeys.forEach(pnu => {
            const parcel = sessionData[pnu];
            
            if (!parcel || !parcel.geometry) {
                console.warn(`⚠️ Early Bootstrap: 데이터 누락 ${pnu}`);
                return;
            }
            
            try {
                // 🎯 ULTRATHINK: MultiPolygon 구조 정확히 처리
                let coordsArray;
                if (parcel.geometry.type === 'MultiPolygon') {
                    // MultiPolygon: coordinates[0][0] (첫 번째 폴리곤의 외곽선)
                    coordsArray = parcel.geometry.coordinates[0][0];
                    console.log('🟣 MultiPolygon 구조 감지, 좌표 경로: coordinates[0][0]');
                } else if (parcel.geometry.type === 'Polygon') {
                    // Polygon: coordinates[0] (외곽선)
                    coordsArray = parcel.geometry.coordinates[0];
                    console.log('🟣 Polygon 구조 감지, 좌표 경로: coordinates[0]');
                } else {
                    console.error('❌ 지원하지 않는 geometry 타입:', parcel.geometry.type);
                    return;
                }
                
                console.log('🔢 추출된 좌표 개수:', coordsArray.length);
                console.log('🔢 첫 번째 좌표 예시:', coordsArray[0]);
                
                // 네이버 좌표로 변환
                const coords = coordsArray.map(coord => 
                    new naver.maps.LatLng(coord[1], coord[0])  // [lng, lat] → LatLng(lat, lng)
                );
                
                // 보라색 폴리곤 생성
                const polygon = new naver.maps.Polygon({
                    map: window.map,
                    paths: coords,
                    fillColor: '#9370DB',
                    fillOpacity: 0.9, // 더 진한 색으로 변경
                    strokeColor: '#6A0DAD',
                    strokeOpacity: 1,
                    strokeWeight: 3 // 두께 증가
                });
                
                // 지번 라벨 생성
                const displayText = parcel.displayText || (parcel.properties ? formatJibun(parcel.properties) : '지번미상');
                let label = null;
                
                if (displayText && displayText !== '지번미상') {
                    const bounds = new naver.maps.LatLngBounds();
                    coords.forEach(coord => bounds.extend(coord));
                    const center = bounds.getCenter();
                    
                    label = new naver.maps.Marker({
                        position: center,
                        map: window.map,
                        icon: {
                            content: `<div style="
                                padding: 8px 12px; 
                                background: rgba(255, 255, 255, 0.95); 
                                border: 2px solid #9370DB; 
                                border-radius: 6px; 
                                font-weight: bold; 
                                font-size: 13px; 
                                color: #6A0DAD; 
                                text-shadow: 1px 1px 2px rgba(255,255,255,0.8);
                                box-shadow: 0 3px 8px rgba(106,13,173,0.3);
                                white-space: nowrap;
                            ">${displayText}</div>`,
                            anchor: new naver.maps.Point(0, 0)
                        }
                    });
                }
                
                // window.searchParcels에 저장
                window.searchParcels.set(pnu, {
                    pnu: pnu,
                    polygon: polygon,
                    label: label,
                    data: parcel.data,
                    displayText: displayText,
                    color: '#9370DB'
                });
                
                restoredCount++;
                console.log(`✨ Early Bootstrap 복원: ${displayText} (currentMode: ${window.currentMode})`);
                
            } catch (error) {
                console.error(`❌ Early Bootstrap 복원 실패: ${pnu}`, error);
            }
        });
        
        console.log(`🟣 Early Bootstrap 완료: ${restoredCount}/${searchKeys.length}개 성공 - 검색 모드 유지`);
        
        // 🎯 ULTRATHINK: 검색 모드가 OFF면 복원된 필지들도 숨김
        if (window.AppState && !window.AppState.searchMode) {
            console.log('🔍 Early Bootstrap 후 검색 OFF 확인: 보라색 필지 숨김');
            if (window.hideSearchParcels) {
                window.hideSearchParcels();
            }
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Early Bootstrap 전체 실패:', error);
        return false;
    }
};

// 전역 함수로 등록
window.testEarlyRestore = window.earlyRestoreSearchParcels;

// 🎯 ULTRATHINK: 임시 저장된 색칠 필지 복원 함수
window.restoreTempColoredParcels = function() {
    try {
        console.log('🔄 임시 저장된 색칠 필지 복원 시작...');
        
        // sessionStorage에서 임시 색칠 데이터 로드
        const tempColorKey = 'tempColoredParcels';
        const tempData = JSON.parse(sessionStorage.getItem(tempColorKey) || '{}');
        const tempKeys = Object.keys(tempData);
        
        if (tempKeys.length === 0) {
            console.log('💾 복원할 임시 색칠 필지 없음');
            return 0;
        }
        
        // 의존성 체크
        if (!window.map || !window.clickParcels || typeof createParcelPolygon !== 'function') {
            console.log('⏳ 임시 색칠 필지 복원: 의존성 대기 중...');
            return false;
        }
        
        console.log(`🎨 ${tempKeys.length}개 임시 색칠 필지 복원 시작`);
        
        let restoredCount = 0;
        tempKeys.forEach(pnu => {
            const savedParcel = tempData[pnu];
            
            if (!savedParcel || !savedParcel.geometry || !savedParcel.color) {
                console.warn(`⚠️ 임시 데이터 누락: ${pnu}`);
                return;
            }
            
            try {
                // 폴리곤 생성
                const polygon = createParcelPolygon(savedParcel.geometry, savedParcel.color);
                
                if (polygon) {
                    // 지번 라벨 생성
                    let label = null;
                    if (savedParcel.jibun && savedParcel.jibun !== '지번미상') {
                        const bounds = new naver.maps.LatLngBounds();
                        polygon.getPaths().getAt(0).forEach(coord => bounds.extend(coord));
                        const center = bounds.getCenter();
                        
                        label = new naver.maps.Marker({
                            position: center,
                            map: window.map,
                            icon: {
                                content: `<div style="
                                    padding: 6px 10px; 
                                    background: rgba(255, 255, 255, 0.9); 
                                    border: 2px solid ${savedParcel.color}; 
                                    border-radius: 4px; 
                                    font-weight: bold; 
                                    font-size: 12px; 
                                    color: #333; 
                                    text-shadow: 1px 1px 1px rgba(255,255,255,0.8);
                                    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                                    white-space: nowrap;
                                ">${savedParcel.jibun}</div>`,
                                anchor: new naver.maps.Point(0, 0)
                            }
                        });
                    }
                    
                    // clickParcels에 저장
                    window.clickParcels.set(pnu, {
                        pnu: pnu,
                        polygon: polygon,
                        label: label,
                        data: savedParcel,
                        color: savedParcel.color,
                        displayText: savedParcel.jibun || '지번미상',
                        properties: savedParcel.properties
                    });
                    
                    restoredCount++;
                    console.log(`🎨 임시 색칠 필지 복원: ${savedParcel.jibun || pnu} (${savedParcel.color})`);
                    
                } else {
                    console.error(`❌ 임시 폴리곤 생성 실패: ${pnu}`);
                }
                
            } catch (error) {
                console.error(`❌ 임시 필지 복원 실패: ${pnu}`, error);
            }
        });
        
        console.log(`🎨 임시 색칠 필지 복원 완료: ${restoredCount}/${tempKeys.length}개 성공`);
        return restoredCount;
        
    } catch (error) {
        console.error('❌ 임시 색칠 필지 복원 전체 실패:', error);
        return false;
    }
};

