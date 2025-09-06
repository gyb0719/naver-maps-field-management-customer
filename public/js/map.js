// 전역 변수
let streetLayer = null;
let cadastralLayer = null;

// 지도 초기화
function initMap() {
    // 저장된 위치 정보 불러오기
    const savedPosition = localStorage.getItem('mapPosition');
    let center, zoom;
    
    if (savedPosition) {
        const pos = JSON.parse(savedPosition);
        center = new naver.maps.LatLng(pos.lat, pos.lng);
        zoom = pos.zoom;
        console.log('저장된 위치 복원:', pos);
    } else {
        center = new naver.maps.LatLng(CONFIG.MAP_DEFAULT_CENTER.lat, CONFIG.MAP_DEFAULT_CENTER.lng);
        zoom = CONFIG.MAP_DEFAULT_ZOOM;
        console.log('기본 위치 사용');
    }
    
    const mapOptions = {
        center: center,
        zoom: zoom,
        mapTypeId: naver.maps.MapTypeId.NORMAL,
        scaleControl: true,
        logoControl: true,
        mapDataControl: true,
        zoomControl: true,
        minZoom: 7,
        maxZoom: 19
    };
    
    map = new naver.maps.Map('map', mapOptions);
    window.map = map;  // 전역 변수로 노출 (검색 기능 사용)
    
    // ViewportRenderer 초기화
    if (window.ViewportRenderer) {
        window.viewportRenderer = new ViewportRenderer(map);
        console.log('ViewportRenderer 초기화 완료');
    }
    
    // 레이어 초기화
    cadastralLayer = new naver.maps.CadastralLayer();
    streetLayer = new naver.maps.StreetLayer();
    
    // 지도 타입 변경 이벤트
    document.querySelectorAll('.map-type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // 활성 버튼 변경
            document.querySelectorAll('.map-type-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const type = this.dataset.type;
            
            // 모든 레이어 제거
            cadastralLayer.setMap(null);
            streetLayer.setMap(null);
            
            // 항상 지도 표시 (파노라마 컨테이너 숨김)
            document.getElementById('map').style.display = 'block';
            document.getElementById('pano').style.display = 'none';
            
            switch(type) {
                case 'normal':
                    map.setMapTypeId(naver.maps.MapTypeId.NORMAL);
                    break;
                case 'satellite':
                    map.setMapTypeId(naver.maps.MapTypeId.HYBRID);
                    break;
                case 'cadastral':
                    map.setMapTypeId(naver.maps.MapTypeId.NORMAL);
                    cadastralLayer.setMap(map);
                    // 지적편집도 모드에서 필지 데이터 자동 로드
                    if (typeof loadParcelsInBounds === 'function') {
                        loadParcelsInBounds(map.getBounds());
                    }
                    break;
                case 'street':
                    // 거리뷰 활성화
                    showStreetView();
                    console.log('거리뷰 모드 활성화');
                    break;
            }
        });
    });
    
    // 지도 클릭 이벤트
    naver.maps.Event.addListener(map, 'click', function(e) {
        // 검색 모드에서는 클릭으로 필지를 추가하지 않음
        if (window.currentMode === 'search') {
            console.log('검색 모드에서는 클릭으로 필지를 추가하지 않습니다.');
            return;
        }
        
        const coord = e.coord;
        console.log('클릭 좌표:', coord.lat(), coord.lng());
        
        // 클릭 모드일 때만 Vworld API로 필지 정보 조회
        getParcelInfo(coord.lat(), coord.lng());
    });
    
    // 지도 이동 시 위치 저장 (ViewportRenderer가 필지 렌더링 담당)
    naver.maps.Event.addListener(map, 'idle', function() {
        // 현재 위치 저장
        const center = map.getCenter();
        const position = {
            lat: center.lat(),
            lng: center.lng(),
            zoom: map.getZoom()
        };
        localStorage.setItem('mapPosition', JSON.stringify(position));
        console.log('위치 저장:', position);
        
        // 저장된 필지 색상 복원 (ViewportRenderer와 병행)
        setTimeout(() => {
            if (typeof restoreSavedParcelsOnMap === 'function') {
                restoreSavedParcelsOnMap();
            }
        }, 200); // 딜레이 단축
    });
}

// 지도 타입 변경
function changeMapType(type) {
    switch(type) {
        case 'NORMAL':
            map.setMapTypeId(naver.maps.MapTypeId.NORMAL);
            break;
        case 'TERRAIN':
            map.setMapTypeId(naver.maps.MapTypeId.TERRAIN);
            break;
        case 'SATELLITE':
            map.setMapTypeId(naver.maps.MapTypeId.SATELLITE);
            break;
        case 'HYBRID':
            map.setMapTypeId(naver.maps.MapTypeId.HYBRID);
            break;
    }
}

// 지도 이동
function moveToLocation(lat, lng, zoom = 18) {
    const location = new naver.maps.LatLng(lat, lng);
    map.setCenter(location);
    if (zoom) {
        map.setZoom(zoom);
    }
    
    // 이동한 위치 저장
    const position = {
        lat: lat,
        lng: lng,
        zoom: zoom || map.getZoom()
    };
    localStorage.setItem('mapPosition', JSON.stringify(position));
    console.log('이동 위치 저장:', position);
}

// 현재 위치로 이동
function moveToCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                moveToLocation(lat, lng);
                
                // 현재 위치 마커 표시
                new naver.maps.Marker({
                    position: new naver.maps.LatLng(lat, lng),
                    map: map,
                    icon: {
                        content: '<div style="background: #3498db; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                        anchor: new naver.maps.Point(10, 10)
                    }
                });
            },
            error => {
                console.error('위치 정보를 가져올 수 없습니다:', error);
            }
        );
    }
}

// 거리뷰 표시 - 무조건 동작하도록 개선
function showStreetView() {
    const mapCenter = map.getCenter();
    
    console.log('🚶 거리뷰 모드 시작:', mapCenter.toString());
    
    // 지도 숨기고 파노라마 표시
    document.getElementById('map').style.display = 'none';
    document.getElementById('pano').style.display = 'block';
    
    // 기존 거리뷰 레이어 제거
    if (window.activeStreetLayer) {
        window.activeStreetLayer.setMap(null);
        window.activeStreetLayer = null;
    }
    
    if (!window.panorama) {
        // 1단계: 파노라마 시도
        try {
            console.log('📷 파노라마 생성 시도...');
            window.panorama = new naver.maps.Panorama('pano', {
                position: mapCenter,
                pov: { pan: -133, tilt: 0, fov: 100 },
                logoControl: false,
                zoomControl: true,
                arrowControl: true
            });
            
            naver.maps.Event.addListener(window.panorama, 'pano_changed', function() {
                console.log('📍 파노라마 위치 변경됨');
            });
            
            // 파노라마 로드 완료 대기
            setTimeout(() => {
                try {
                    if (window.panorama.getPosition()) {
                        console.log('✅ 파노라마 초기화 성공');
                        return;
                    }
                } catch (checkError) {
                    console.warn('⚠️ 파노라마 상태 확인 실패, 폴백 시도');
                    fallbackToStreetLayer();
                }
            }, 2000);
            
        } catch (panoError) {
            console.error('💥 파노라마 초기화 실패:', panoError);
            fallbackToStreetLayer();
        }
    } else {
        // 기존 파노라마 위치 업데이트
        try {
            window.panorama.setPosition(mapCenter);
            console.log('📍 파노라마 위치 업데이트 성공');
        } catch (updateError) {
            console.error('💥 파노라마 위치 업데이트 실패:', updateError);
            fallbackToStreetLayer();
        }
    }
    
    // 2단계: 거리뷰 레이어 폴백
    function fallbackToStreetLayer() {
        console.log('🔄 거리뷰 레이어로 폴백 시도...');
        
        // 파노라마 제거
        if (window.panorama) {
            try {
                window.panorama = null;
            } catch (e) {}
        }
        
        // 다시 지도 표시하고 거리뷰 레이어 추가
        document.getElementById('map').style.display = 'block';
        document.getElementById('pano').style.display = 'none';
        
        try {
            window.activeStreetLayer = new naver.maps.StreetLayer();
            window.activeStreetLayer.setMap(map);
            
            // 지도를 현재 위치로 이동하고 줌 조정
            map.setCenter(mapCenter);
            map.setZoom(18);
            
            console.log('✅ 거리뷰 레이어 활성화 성공');
            
        } catch (layerError) {
            console.error('💥 거리뷰 레이어 실패:', layerError);
            fallbackToMapView();
        }
    }
    
    // 3단계: 일반 지도 폴백 (고배율)
    function fallbackToMapView() {
        console.log('🗺️ 일반 지도 폴백 (거리뷰 풍 고배율)');
        
        document.getElementById('map').style.display = 'block';
        document.getElementById('pano').style.display = 'none';
        
        // 최대 줌으로 거리뷰 느낌 연출
        map.setCenter(mapCenter);
        map.setZoom(19); // 최대 줌
        
        // 현재 위치 마커 표시
        if (window.streetViewMarker) {
            window.streetViewMarker.setMap(null);
        }
        
        window.streetViewMarker = new naver.maps.Marker({
            position: mapCenter,
            map: map,
            icon: {
                content: `<div style="
                    background: #4285F4; 
                    width: 24px; height: 24px; 
                    border-radius: 50%; 
                    border: 4px solid white; 
                    box-shadow: 0 3px 8px rgba(0,0,0,0.4);
                    position: relative;
                ">
                    <div style="
                        position: absolute;
                        top: -8px; right: -8px;
                        background: #EA4335; 
                        width: 12px; height: 12px; 
                        border-radius: 50%;
                        border: 2px solid white;
                    "></div>
                </div>`,
                anchor: new naver.maps.Point(12, 12)
            }
        });
        
        console.log('✅ 고배율 지도 뷰로 표시 완료');
    }
}

// 네이버 지도 API 로드 확인 함수
function waitForNaverMaps(callback, maxAttempts = 30) {
    let attempts = 0;
    
    function check() {
        console.log(`🔍 네이버 지도 API 로드 확인 중... (시도 ${attempts + 1}/${maxAttempts})`);
        
        if (typeof naver !== 'undefined' && 
            typeof naver.maps !== 'undefined' &&
            typeof naver.maps.Map !== 'undefined') {
            console.log('✅ 네이버 지도 API 로드 완료!');
            callback();
            return;
        }
        
        attempts++;
        if (attempts < maxAttempts) {
            setTimeout(check, 500);
        } else {
            console.error('❌ 네이버 지도 API 로드 실패 - 최대 시도 횟수 초과');
            // 오류 메시지 표시
            const mapContainer = document.getElementById('map');
            if (mapContainer) {
                mapContainer.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column; background: #f5f5f5;">
                        <div style="text-align: center; color: #666;">
                            <h3>🚫 지도 로드 실패</h3>
                            <p>네이버 지도 API를 불러올 수 없습니다.</p>
                            <p>네트워크 연결 및 API 키를 확인해주세요.</p>
                            <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer;">새로고침</button>
                        </div>
                    </div>
                `;
            }
        }
    }
    
    check();
}

// 페이지 로드 시 지도 초기화
window.onload = function() {
    console.log('🚀 페이지 로드 완료, 지도 초기화 시작');
    
    // 네이버 지도 API 로드 대기
    waitForNaverMaps(() => {
        try {
            console.log('🗺️ 지도 초기화 시작...');
            initMap();
            
            if (typeof initializeEventListeners === 'function') {
                initializeEventListeners();
                console.log('✅ 이벤트 리스너 초기화 완료');
            }
            
            if (typeof loadSavedParcels === 'function') {
                loadSavedParcels();
                console.log('✅ 저장된 필지 로드 완료');
            }
            
            // 초기 화면의 필지 로드 및 색상 복원
            setTimeout(() => {
                if (map) {
                    const bounds = map.getBounds();
                    if (typeof loadParcelsInBounds === 'function') {
                        loadParcelsInBounds(bounds);
                    }
                    
                    // 저장된 필지 색상 복원
                    setTimeout(() => {
                        if (typeof restoreSavedParcelsOnMap === 'function') {
                            restoreSavedParcelsOnMap();
                        }
                        
                        // 저장된 검색 결과 복원
                        if (typeof loadSearchResultsFromStorage === 'function') {
                            loadSearchResultsFromStorage();
                            console.log('💎 저장된 검색 결과 복원 시도');
                        }
                    }, 1500);
                }
            }, 1000);
            
            console.log('🎉 모든 초기화 완료!');
            
        } catch (error) {
            console.error('💥 초기화 중 오류 발생:', error);
            const mapContainer = document.getElementById('map');
            if (mapContainer) {
                mapContainer.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column; background: #f5f5f5;">
                        <div style="text-align: center; color: #666;">
                            <h3>🚫 초기화 실패</h3>
                            <p>지도 초기화 중 오류가 발생했습니다.</p>
                            <p>${error.message}</p>
                            <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer;">새로고침</button>
                        </div>
                    </div>
                `;
            }
        }
    });
};