// API 설정 - 보안 강화를 위해 서버 프록시 사용
const CONFIG = {
    NAVER_CLIENT_ID: 'xzbnwd2h1z', // 공개 키이므로 노출 가능
    // 민감한 키들은 제거하고 서버 프록시를 통해 사용
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
let map = null;
let currentColor = CONFIG.COLORS.red;

// 필지 모드 관리 - window에 직접 정의
window.currentMode = 'search'; // 'search' 또는 'click' - 기본값은 검색 모드
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