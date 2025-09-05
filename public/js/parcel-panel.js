// 하단 필지 목록 패널 관리
let isPanelOpen = false;
let panelHeight = 300;

// 패널 토글
function toggleParcelPanel() {
    const panel = document.getElementById('bottomParcelPanel');
    const toggleBtn = document.getElementById('parcelListToggleBtn');
    
    if (!panel) return;
    
    isPanelOpen = !isPanelOpen;
    
    if (isPanelOpen) {
        panel.classList.add('open');
        toggleBtn.classList.add('panel-open');
    } else {
        panel.classList.remove('open');
        toggleBtn.classList.remove('panel-open');
    }
}

// 모든 필지 삭제
function clearAllParcels() {
    if (!confirm('모든 필지를 삭제하시겠습니까?')) return;
    
    if (typeof window.savedParcels !== 'undefined') {
        window.savedParcels = [];
    }
    
    updateParcelListDisplay();
    saveToLocalStorage();
    
    // 지도에서 폴리곤 제거
    if (window.parcelPolygons) {
        window.parcelPolygons.forEach(polygon => polygon.setMap(null));
        window.parcelPolygons = [];
    }
}

// 필지 데이터 내보내기
function exportParcelData() {
    if (!window.savedParcels || window.savedParcels.length === 0) {
        alert('내보낼 필지가 없습니다.');
        return;
    }
    
    // CSV 형식으로 변환
    let csv = '주소,필지번호,면적,용도지역,공시지가,색상,메모\n';
    
    window.savedParcels.forEach(parcel => {
        csv += `"${parcel.address || ''}","${parcel.pnu || ''}","${parcel.area || ''}","${parcel.landUse || ''}","${parcel.landPrice || ''}","${parcel.color || ''}","${parcel.memo || ''}"\n`;
    });
    
    // 다운로드
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `필지목록_${new Date().toLocaleDateString()}.csv`;
    link.click();
}

// 필지 목록 업데이트 함수
function updateParcelListDisplay() {
    const container = document.getElementById('parcelListContainer');
    const count = document.getElementById('parcelCount');
    const panelCount = document.getElementById('panelParcelCount');
    
    if (!container) return;
    
    const parcels = window.savedParcels || [];
    
    // 카운트 업데이트
    if (count) count.textContent = parcels.length;
    if (panelCount) panelCount.textContent = `(${parcels.length})`;
    
    // 목록이 비어있으면
    if (parcels.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #718096; padding: 40px;">저장된 필지가 없습니다.</div>';
        return;
    }
    
    // 필지 카드 생성
    container.innerHTML = '';
    parcels.forEach((parcel, index) => {
        const card = createParcelCard(parcel, index);
        container.appendChild(card);
    });
}

// 필지 카드 생성
function createParcelCard(parcel, index) {
    const card = document.createElement('div');
    card.className = 'parcel-item';
    
    const header = document.createElement('div');
    header.className = 'parcel-item-header';
    
    const address = document.createElement('div');
    address.className = 'parcel-address';
    address.textContent = parcel.address || '주소 없음';
    
    const colorIndicator = document.createElement('div');
    colorIndicator.className = 'parcel-color-indicator';
    colorIndicator.style.backgroundColor = parcel.color || '#FF0000';
    
    header.appendChild(address);
    header.appendChild(colorIndicator);
    
    const info = document.createElement('div');
    info.className = 'parcel-info';
    info.innerHTML = `
        ${parcel.pnu ? `<div>필지번호: ${parcel.pnu}</div>` : ''}
        ${parcel.area ? `<div>면적: ${parcel.area}㎡</div>` : ''}
        ${parcel.landUse ? `<div>용도: ${parcel.landUse}</div>` : ''}
        ${parcel.landPrice ? `<div>공시지가: ${parcel.landPrice}</div>` : ''}
        ${parcel.memo ? `<div>메모: ${parcel.memo}</div>` : ''}
    `;
    
    const actions = document.createElement('div');
    actions.className = 'parcel-actions';
    
    const locateBtn = document.createElement('button');
    locateBtn.className = 'parcel-action-btn';
    locateBtn.textContent = '📍 위치보기';
    locateBtn.onclick = () => focusOnParcel(parcel);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'parcel-action-btn delete';
    deleteBtn.textContent = '🗑️ 삭제';
    deleteBtn.onclick = () => deleteParcel(index);
    
    actions.appendChild(locateBtn);
    actions.appendChild(deleteBtn);
    
    card.appendChild(header);
    card.appendChild(info);
    card.appendChild(actions);
    
    return card;
}

// 필지 위치로 이동
function focusOnParcel(parcel) {
    if (!parcel.coordinates || !window.map) return;
    
    // 폴리곤의 중심점 계산
    let sumLat = 0, sumLng = 0;
    let count = 0;
    
    parcel.coordinates.forEach(coord => {
        sumLat += coord.lat;
        sumLng += coord.lng;
        count++;
    });
    
    const center = new naver.maps.LatLng(sumLat / count, sumLng / count);
    
    // 지도 이동
    window.map.setCenter(center);
    window.map.setZoom(18);
    
    // 패널 닫기
    if (isPanelOpen) {
        toggleParcelPanel();
    }
}

// 필지 삭제
function deleteParcel(index) {
    if (!confirm('이 필지를 삭제하시겠습니까?')) return;
    
    if (window.savedParcels && window.savedParcels[index]) {
        // 폴리곤 제거
        if (window.parcelPolygons && window.parcelPolygons[index]) {
            window.parcelPolygons[index].setMap(null);
            window.parcelPolygons.splice(index, 1);
        }
        
        // 데이터 제거
        window.savedParcels.splice(index, 1);
        
        // 업데이트
        updateParcelListDisplay();
        saveToLocalStorage();
    }
}

// 로컬 스토리지에 저장
function saveToLocalStorage() {
    if (window.savedParcels) {
        localStorage.setItem('savedParcels', JSON.stringify(window.savedParcels));
    }
}

// 드래그로 높이 조절 기능
document.addEventListener('DOMContentLoaded', function() {
    const panel = document.getElementById('bottomParcelPanel');
    const handle = document.getElementById('panelHandle');
    
    if (!panel || !handle) return;
    
    let isDragging = false;
    let startY = 0;
    let startHeight = 0;
    
    handle.addEventListener('mousedown', function(e) {
        isDragging = true;
        startY = e.clientY;
        startHeight = panel.offsetHeight;
        document.body.style.cursor = 'ns-resize';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        
        const deltaY = startY - e.clientY;
        const newHeight = Math.max(200, Math.min(window.innerHeight * 0.8, startHeight + deltaY));
        
        panel.style.height = newHeight + 'px';
    });
    
    document.addEventListener('mouseup', function() {
        isDragging = false;
        document.body.style.cursor = '';
    });
    
    // 초기 필지 목록 표시
    updateParcelListDisplay();
});

// 외부에서 호출할 수 있도록 전역 함수로 등록
window.toggleParcelPanel = toggleParcelPanel;
window.clearAllParcels = clearAllParcels;
window.exportParcelData = exportParcelData;
window.updateParcelListDisplay = updateParcelListDisplay;