// Leaflet용 필지 관리 코드 
// (parcel.js에서 naver.maps 부분을 Leaflet으로 변경)

// 기존 parcel.js의 모든 함수를 포함하되, 지도 API 부분만 Leaflet으로 수정
// 원본 parcel.js를 유지하면서 별도 파일로 생성

// 필지 폴리곤 그리기 (Leaflet 버전)
window.drawParcelPolygon = function(parcel, isSelected = false) {
    const geometry = parcel.geometry;
    const properties = parcel.properties;
    const pnu = properties.PNU || properties.pnu;
    const jibun = formatJibun(properties);
    
    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
        const coordinates = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
        
        // Leaflet 좌표 형식으로 변환 [lng,lat] -> [lat,lng]
        const latlngs = [];
        coordinates.forEach(polygon => {
            const ring = polygon[0].map(coord => [coord[1], coord[0]]);
            latlngs.push(ring);
        });
        
        // 저장된 필지 정보 확인
        let savedParcel = getSavedParcelData(pnu);
        if (!savedParcel && jibun) {
            savedParcel = getSavedParcelDataByJibun(jibun);
        }
        
        const fillColor = savedParcel && savedParcel.color ? savedParcel.color : 'transparent';
        const fillOpacity = savedParcel && savedParcel.color && savedParcel.color !== 'transparent' ? 0.5 : 0;
        
        // Leaflet 폴리곤 생성
        const polygon = L.polygon(latlngs[0], {
            color: isSelected ? '#FF0000' : '#0000FF',
            weight: isSelected ? 1.5 : 0.5,
            opacity: 0.6,
            fillColor: fillColor,
            fillOpacity: fillOpacity
        }).addTo(window.map);
        
        // 클릭 이벤트
        polygon.on('click', function(e) {
            L.DomEvent.stopPropagation(e); // 지도 클릭 이벤트 방지
            toggleParcelSelection(parcel, polygon);
        });
        
        // 필지 저장
        parcels.set(pnu, {
            polygon: polygon,
            data: parcel,
            color: fillColor
        });
        
        return polygon;
    }
};

// updatePolygonStyle 함수 오버라이드 (Leaflet 버전)
window.updatePolygonStyle = function(pnu, color) {
    const parcelInfo = parcels.get(pnu);
    if (parcelInfo && parcelInfo.polygon) {
        parcelInfo.polygon.setStyle({
            fillColor: color,
            fillOpacity: color && color !== 'transparent' ? 0.5 : 0
        });
        parcelInfo.color = color;
    }
};

// clearSelection 함수 오버라이드 (Leaflet 버전)
const originalClearSelection = window.clearSelection;
window.clearSelection = function() {
    selectedPolygons.forEach(polygon => {
        if (polygon && polygon.setStyle) {
            polygon.setStyle({
                color: '#0000FF',
                weight: 0.5,
                opacity: 0.6
            });
        }
    });
    selectedPolygons.clear();
    
    // 원본 함수 호출
    if (typeof originalClearSelection === 'function') {
        originalClearSelection.call(this);
    }
};

// 필지 제거 함수 오버라이드 (Leaflet 버전)
const originalRemoveParcel = window.removeParcelFromMap;
window.removeParcelFromMap = function(pnu) {
    const parcelInfo = parcels.get(pnu);
    if (parcelInfo && parcelInfo.polygon) {
        window.map.removeLayer(parcelInfo.polygon);
        parcels.delete(pnu);
    }
};

console.log('Leaflet 필지 관리 코드 로드됨');