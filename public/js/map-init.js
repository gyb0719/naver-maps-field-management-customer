// 지도 초기화 및 설정

// 네이버 지도 API 동적 로드
async function loadNaverMapAPI() {
    try {
        // 서버에서 설정 가져오기
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.CONFIG_API_URL}`);
        const config = await response.json();
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${config.naverClientId}&submodules=panorama`;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    } catch (error) {
        console.error('Failed to load Naver Map API:', error);
        if (window.UIManager) {
            window.UIManager.showError('지도 API 로드 실패');
        }
    }
}

// 지도 초기화
async function initializeMap() {
    try {
        if (window.UIManager) {
            window.UIManager.showLoading('지도를 초기화하는 중...');
        }

        // 네이버 지도 API가 로드되지 않았다면 로드
        if (typeof naver === 'undefined' || !naver.maps) {
            await loadNaverMapAPI();
        }

        // 지도 생성
        const mapOptions = {
            center: new naver.maps.LatLng(CONFIG.MAP_DEFAULT_CENTER.lat, CONFIG.MAP_DEFAULT_CENTER.lng),
            zoom: CONFIG.MAP_DEFAULT_ZOOM,
            minZoom: 10,
            maxZoom: 21,
            mapTypeControl: true,
            scaleControl: true,
            logoControl: false,
            mapDataControl: false,
            mapTypeControlOptions: {
                style: naver.maps.MapTypeControlStyle.BUTTON,
                position: naver.maps.Position.TOP_RIGHT
            }
        };

        map = new naver.maps.Map('map', mapOptions);

        // 지도 이벤트 리스너 설정
        setupMapEventListeners();

        // 초기 필지 데이터 로드
        setTimeout(() => {
            const bounds = map.getBounds();
            if (window.loadParcelsInBounds) {
                window.loadParcelsInBounds(bounds);
            }
        }, 500);

        if (window.UIManager) {
            window.UIManager.hideLoading();
            window.UIManager.showSuccess('지도가 준비되었습니다.');
        }

        return map;
    } catch (error) {
        console.error('Map initialization failed:', error);
        if (window.UIManager) {
            window.UIManager.hideLoading();
            window.UIManager.showError('지도 초기화 실패');
        }
    }
}

// 지도 이벤트 리스너 설정
function setupMapEventListeners() {
    // 지도 클릭 이벤트 - app-core.js의 통합 시스템 사용
    naver.maps.Event.addListener(map, 'click', function(e) {
        const latlng = e.coord;
        console.log('🎯 ULTRATHINK: 지도 클릭 위치:', latlng.lat(), latlng.lng());
        
        // app-core.js의 통합 클릭 핸들러 호출
        if (window.AppState && window.AppState.handleMapLeftClick) {
            window.AppState.handleMapLeftClick(e);
        } else if (window.handleMapLeftClick) {
            window.handleMapLeftClick(e);
        } else {
            console.warn('🚨 ULTRATHINK: 통합 클릭 핸들러를 찾을 수 없음');
        }
    });

    // 지도 이동 완료 이벤트 (디바운싱 적용)
    const handleBoundsChanged = window.PerformanceUtils ? 
        window.PerformanceUtils.throttle(() => {
            const bounds = map.getBounds();
            const zoom = map.getZoom();
            
            // 줌 레벨이 충분할 때만 필지 로드
            if (zoom >= 15 && window.loadParcelsInBounds) {
                window.loadParcelsInBounds(bounds);
            }
        }, 1000) : 
        () => {
            const bounds = map.getBounds();
            const zoom = map.getZoom();
            if (zoom >= 15 && window.loadParcelsInBounds) {
                window.loadParcelsInBounds(bounds);
            }
        };

    naver.maps.Event.addListener(map, 'idle', handleBoundsChanged);
}

// 지도 타입 변경
function changeMapType(type) {
    if (!map) return;
    
    const mapTypes = {
        'normal': naver.maps.MapTypeId.NORMAL,
        'satellite': naver.maps.MapTypeId.SATELLITE,
        'hybrid': naver.maps.MapTypeId.HYBRID,
        'terrain': naver.maps.MapTypeId.TERRAIN
    };
    
    if (mapTypes[type]) {
        map.setMapTypeId(mapTypes[type]);
        
        // 지적편집도 오버레이
        if (type === 'cadastral') {
            map.setMapTypeId(naver.maps.MapTypeId.NORMAL);
            // 지적편집도 레이어 추가 (별도 구현 필요)
        }
    }
}

// Export
window.MapManager = {
    initializeMap,
    changeMapType,
    getMap: () => map
};