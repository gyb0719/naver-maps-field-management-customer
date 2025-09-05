// Leaflet 지도 초기화
let map = null;
let currentLayer = 'osm';
let osmLayer, satelliteLayer, cadastralLayer;

// 지도 초기화
function initMap() {
    // 저장된 위치 정보 불러오기
    const savedPosition = localStorage.getItem('mapPosition');
    let center, zoom;
    
    if (savedPosition) {
        const pos = JSON.parse(savedPosition);
        center = [pos.lat, pos.lng];
        zoom = pos.zoom;
        console.log('저장된 위치 복원:', pos);
    } else {
        center = [CONFIG.MAP_DEFAULT_CENTER.lat, CONFIG.MAP_DEFAULT_CENTER.lng];
        zoom = CONFIG.MAP_DEFAULT_ZOOM;
        console.log('기본 위치 사용');
    }
    
    // Leaflet 지도 생성
    map = L.map('map').setView(center, zoom);
    window.map = map;  // 전역 변수로 노출
    
    // OpenStreetMap 레이어
    osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // 위성 레이어 (ESRI)
    satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 19
    });
    
    // 지적편집도 레이어 (Vworld WMS)
    cadastralLayer = L.tileLayer.wms('https://api.vworld.kr/req/wms', {
        layers: 'lp_pa_cbnd_bubun',
        styles: 'lp_pa_cbnd_bubun',
        format: 'image/png',
        transparent: true,
        version: '1.3.0',
        crs: L.CRS.EPSG4326,
        key: 'E5B1657B-9B6F-3A4B-91EF-98512BE931A1',
        maxZoom: 19
    });
    
    // 지도 타입 변경 이벤트
    document.querySelectorAll('.map-type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // 활성 버튼 변경
            document.querySelectorAll('.map-type-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const type = this.dataset.type;
            
            // 모든 레이어 제거
            map.eachLayer(layer => {
                if (layer !== osmLayer && layer !== satelliteLayer && layer !== cadastralLayer) {
                    return; // 폴리곤 등은 유지
                }
                map.removeLayer(layer);
            });
            
            // 선택된 레이어 추가
            switch(type) {
                case 'normal':
                    osmLayer.addTo(map);
                    break;
                case 'satellite':
                    satelliteLayer.addTo(map);
                    break;
                case 'cadastral':
                    osmLayer.addTo(map);
                    cadastralLayer.addTo(map);
                    break;
                case 'street':
                    // 거리뷰는 별도 구현 필요
                    alert('거리뷰는 준비중입니다.');
                    osmLayer.addTo(map);
                    break;
            }
        });
    });
    
    // 지도 클릭 이벤트
    map.on('click', async function(e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        
        console.log('클릭 좌표:', lat, lng);
        
        // Vworld API로 필지 정보 조회
        await getParcelInfo(lat, lng);
    });
    
    // 지도 이동/줌 종료 이벤트
    map.on('moveend', function() {
        const center = map.getCenter();
        const zoom = map.getZoom();
        
        // 위치 저장
        const position = {
            lat: center.lat,
            lng: center.lng,
            zoom: zoom
        };
        localStorage.setItem('mapPosition', JSON.stringify(position));
        console.log('위치 저장:', position);
        
        // 영역 내 필지 로드
        if (zoom >= 17) {
            const bounds = map.getBounds();
            loadParcelsInBounds({
                getNE: () => bounds.getNorthEast(),
                getSW: () => bounds.getSouthWest()
            });
        }
    });
    
    return map;
}

// 지도 이동 함수
function moveToLocation(lat, lng, zoomLevel = 18) {
    if (map) {
        map.setView([lat, lng], zoomLevel);
    }
}

// 마커 생성 함수
function createMarker(lat, lng, title) {
    if (map) {
        return L.marker([lat, lng])
            .addTo(map)
            .bindPopup(title);
    }
}

// 폴리곤 그리기 함수 (Leaflet용)
function drawPolygonOnMap(coordinates, options = {}) {
    if (!map) return null;
    
    // MultiPolygon 좌표를 Leaflet 형식으로 변환
    let latlngs = [];
    
    if (Array.isArray(coordinates[0][0][0])) {
        // MultiPolygon
        latlngs = coordinates[0][0].map(coord => [coord[1], coord[0]]);
    } else {
        // Polygon
        latlngs = coordinates.map(coord => [coord[1], coord[0]]);
    }
    
    const polygon = L.polygon(latlngs, {
        color: options.color || '#FF0000',
        weight: options.weight || 2,
        opacity: options.opacity || 0.8,
        fillColor: options.fillColor || options.color || '#FF0000',
        fillOpacity: options.fillOpacity || 0.3
    }).addTo(map);
    
    return polygon;
}

// 페이지 로드 완료 시 실행
window.addEventListener('load', function() {
    console.log('페이지 로드 완료, 지도 초기화 시작');
    
    // Leaflet 로드 확인
    if (typeof L === 'undefined') {
        console.error('Leaflet이 로드되지 않았습니다');
        return;
    }
    
    // 지도 초기화
    try {
        initMap();
        
        // 필지 목록 복원
        restoreParcelsFromStorage();
        
        console.log('모든 초기화 완료');
    } catch (error) {
        console.error('초기화 오류:', error);
    }
});