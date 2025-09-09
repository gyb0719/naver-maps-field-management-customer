// API 설정 - 보안 강화를 위해 서버 프록시 사용
const CONFIG = {
    NAVER_CLIENT_ID: 'xzbnwd2h1z', // 공개 키이므로 노출 가능
    
    // VWorld API 키들 (기존 작동하던 위치로 복원)
    VWORLD_API_KEYS: [
        '360C0EFC-15A9-31F9-8B90-A20D04622410', // 고객 키
        '0A0DFD5D-0266-3FAB-8766-06E821646AF7', // 기존 키
        'BBAC532E-A56D-34CF-B520-CE68E8D6D52A',
        'E5B1657B-9B6F-3A4B-91EF-98512BE931A1', 
        '8C62256B-1D08-32FF-AB3C-1FCD67242196',
        '6B854F88-4A5D-303C-B7C8-40858117A95E'
    ],
    
    GOOGLE_SHEETS_URL: '', // Google Apps Script URL (나중에 설정)
    
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
    
    // 필지 하이라이트 색상
    HIGHLIGHT_COLOR: '#FFFF00',  // 노란색 형광색
    HIGHLIGHT_OPACITY: 0.7,
    
    // LocalStorage 키
    STORAGE_KEY: 'parcelData'
};

// 전역 변수
// let map = null; // ❌ 중복 선언 제거 - map.js에서 관리
let currentColor = CONFIG.COLORS.red;

// ✅ ULTRATHINK: window.currentColor 동기화
window.currentColor = currentColor;

// 필지 모드 관리 - window에 직접 정의
window.currentMode = 'click'; // 'search' 또는 'click' - 기본값을 클릭 모드로 변경 (필지 색칠 가능)
window.clickParcels = new Map(); // 클릭으로 선택한 필지 데이터 저장
window.searchParcels = new Map(); // 검색으로 찾은 필지 데이터 저장

// 하위 호환성을 위한 alias (기존 코드와의 호환성 유지)
// window.parcels와 window.searchResults를 직접 연결
window.parcels = window.clickParcels;
window.searchResults = window.searchParcels;
let searchResultsVisible = true; // 검색 결과 표시 여부

// 필지 표시/숨김 관련 유틸리티 함수들
function showClickParcels() {
    console.log('클릭 필지 표시:', window.clickParcels.size, '개');
    window.clickParcels.forEach((parcel, key) => {
        if (parcel.polygon) parcel.polygon.setMap(map);
        if (parcel.label) parcel.label.setMap(map);
    });
}

function hideClickParcels() {
    console.log('클릭 필지 숨김:', window.clickParcels.size, '개');
    window.clickParcels.forEach((parcel, key) => {
        if (parcel.polygon) parcel.polygon.setMap(null);
        if (parcel.label) parcel.label.setMap(null);
    });
}

function showSearchParcels() {
    console.log('검색 필지 표시:', window.searchParcels.size, '개');
    window.searchParcels.forEach((parcel, key) => {
        if (parcel.polygon) parcel.polygon.setMap(map);
        if (parcel.label) parcel.label.setMap(map);
    });
}

function hideSearchParcels() {
    console.log('검색 필지 숨김:', window.searchParcels.size, '개');
    window.searchParcels.forEach((parcel, key) => {
        if (parcel.polygon) parcel.polygon.setMap(null);
        if (parcel.label) parcel.label.setMap(null);
    });
}

// window 객체에 함수들도 연결
window.showClickParcels = showClickParcels;
window.hideClickParcels = hideClickParcels;
window.showSearchParcels = showSearchParcels;
window.hideSearchParcels = hideSearchParcels;

// 🎯 ULTRATHINK: 전역 CONFIG 등록 및 안전장치
window.CONFIG = CONFIG;

// CONFIG 로드 확인 및 디버깅
console.log('🔧 ULTRATHINK CONFIG 로드 확인:', {
    CONFIG_LOADED: typeof CONFIG !== 'undefined',
    VWORLD_API_KEYS_COUNT: CONFIG && CONFIG.VWORLD_API_KEYS ? CONFIG.VWORLD_API_KEYS.length : 0,
    NAVER_CLIENT_ID: CONFIG && CONFIG.NAVER_CLIENT_ID ? 'OK' : 'MISSING'
});

// 로드 실패 시 경고
if (typeof CONFIG === 'undefined' || !CONFIG.VWORLD_API_KEYS) {
    console.error('❌ ULTRATHINK: CONFIG 로드 실패 또는 불완전!');
}

// 🎯 ULTRATHINK: Early Bootstrap - 검색 필지 복원 시스템 (config.js)
window.earlyRestoreSearchParcels = function() {
    try {
        console.log('🚀 ULTRATHINK Early Bootstrap: 검색 필지 복원 시작 (config.js)');
        
        // 의존성 체크
        if (!window.map || !window.searchParcels || typeof formatJibun !== 'function') {
            console.log('⏳ Early Bootstrap: 의존성 대기 중... (map:', !!window.map, ', searchParcels:', !!window.searchParcels, ', formatJibun:', typeof formatJibun === 'function', ')');
            return false;
        }
        
        // sessionStorage에서 데이터 로드
        const sessionData = JSON.parse(sessionStorage.getItem('searchParcels') || '{}');
        const searchKeys = Object.keys(sessionData);
        
        if (searchKeys.length === 0) {
            console.log('💾 Early Bootstrap: 복원할 검색 필지 없음');
            return true;
        }
        
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
                    fillOpacity: 0.7,
                    strokeColor: '#6A0DAD',
                    strokeOpacity: 1,
                    strokeWeight: 2
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
                console.log(`✨ Early Bootstrap 복원: ${displayText}`);
                
            } catch (error) {
                console.error(`❌ Early Bootstrap 복원 실패: ${pnu}`, error);
            }
        });
        
        console.log(`🟣 Early Bootstrap 완료: ${restoredCount}/${searchKeys.length}개 성공`);
        
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


console.log('🚀 ULTRATHINK: Early Bootstrap 시스템 로드됨 (config.js)');