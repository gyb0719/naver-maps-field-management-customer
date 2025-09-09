// 🎯 ULTRATHINK 통합 필지 관리 시스템
// 모든 핵심 기능을 하나의 파일에서 깔끔하게 관리

// ============================
// 전역 상태 관리
// ============================
const AppState = {
    // 모드 상태
    paintMode: true,        // 색칠 모드 (기본: ON)
    searchMode: false,      // 검색 모드 (기본: OFF = 클릭 필지 표시)
    
    // 색상 관리
    currentColor: '#FF0000', // 현재 선택된 색상
    
    // 선택된 필지 추적 🎯 THINK HARD 해결책
    currentSelectedParcel: null, // { pnu, data } 형태
    colors: {
        red: '#FF0000',
        blue: '#0066FF', 
        green: '#00CC00',
        yellow: '#FFFF00',
        purple: '#9966FF',
        orange: '#FF6600',
        pink: '#FF66CC',
        cyan: '#00CCCC'
    },
    
    // 필지 데이터
    clickParcels: new Map(),    // 클릭으로 칠한 필지들
    searchParcels: new Map(),   // 검색된 필지들
    
    // 지도 객체
    map: null,
    
    // 🎯 고객용 설정 - 실제 VWorld API 키들로 교체하세요
    vworldKeys: [
        'YOUR_VWORLD_API_KEY_1',
        'YOUR_VWORLD_API_KEY_2',
        'YOUR_VWORLD_API_KEY_3',
        'YOUR_VWORLD_API_KEY_4',
        'YOUR_VWORLD_API_KEY_5'
    ]
};

// ============================
// 유틸리티 함수들
// ============================

// 토스트 메시지 표시 (무한 루프 완전 방지)
function showToast(message, type = 'info') {
    // 🎯 ULTRATHINK: 무한 루프 완전 방지 - 단순 콘솔만 출력
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // 실제 토스트 UI는 다른 시스템에 위임하지 않고 단순화
    // window.showToast 호출 완전 제거
    
    // 시각적 피드백이 필요하면 간단한 알림만
    if (type === 'success' && message.includes('저장')) {
        // 저장 성공 시에만 간단한 시각적 피드백
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            const originalText = saveBtn.textContent;
            saveBtn.textContent = '저장됨!';
            saveBtn.style.background = '#28a745';
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.style.background = '';
            }, 1000);
        }
    }
}

// PNU에서 지번 포맷팅
function formatJibun(properties) {
    const pnu = properties.PNU || properties.pnu || '';
    if (pnu.length >= 19) {
        const sido = pnu.substring(0, 2);
        const gungu = pnu.substring(2, 5); 
        const dong = pnu.substring(5, 8);
        const ri = pnu.substring(8, 10);
        const san = pnu.substring(10, 11) === '1' ? '산' : '';
        const jibun = parseInt(pnu.substring(11, 15)) || 0;
        const ho = parseInt(pnu.substring(15, 19)) || 0;
        
        const jibunStr = ho > 0 ? `${jibun}-${ho}` : `${jibun}`;
        return `${san}${jibunStr}`;
    }
    
    // 기존 방식으로 fallback
    return properties.JIBUN || properties.jibun || 
           (properties.BONBUN && properties.BUBUN ? 
            `${properties.BONBUN}-${properties.BUBUN}` : '정보없음');
}

// 좌표를 폴리곤으로 변환
function createPolygonFromGeometry(geometry, options = {}) {
    if (!geometry || !geometry.coordinates) {
        console.error('❌ 지오메트리 정보가 없습니다');
        return null;
    }

    try {
        let coords;
        if (geometry.type === 'Polygon') {
            coords = geometry.coordinates[0];
        } else if (geometry.type === 'MultiPolygon') {
            coords = geometry.coordinates[0][0];
        } else {
            console.error('❌ 지원되지 않는 지오메트리 타입:', geometry.type);
            return null;
        }

        const paths = coords.map(coord => new naver.maps.LatLng(coord[1], coord[0]));
        
        const polygonOptions = {
            paths: paths,
            fillColor: options.fillColor || '#FF0000',
            fillOpacity: options.fillOpacity || 0.7,
            strokeColor: options.strokeColor || '#FF0000', 
            strokeOpacity: options.strokeOpacity || 1.0,
            strokeWeight: options.strokeWeight || 2,
            ...options
        };

        return new naver.maps.Polygon(polygonOptions);
    } catch (error) {
        console.error('❌ 폴리곤 생성 실패:', error);
        return null;
    }
}

// ============================
// VWorld API 호출
// ============================
async function getParcelFromVWorld(lat, lng) {
    console.log(`🌍 VWorld API 호출: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    
    for (let i = 0; i < AppState.vworldKeys.length; i++) {
        const apiKey = AppState.vworldKeys[i];
        console.log(`🔑 API 키 ${i+1}/${AppState.vworldKeys.length} 시도 중...`);
        
        try {
            const result = await callVWorldAPI(lat, lng, apiKey);
            if (result) {
                console.log('✅ VWorld API 호출 성공!');
                return result;
            }
        } catch (error) {
            console.warn(`⚠️ API 키 ${i+1} 실패:`, error.message);
        }
    }
    
    console.error('❌ 모든 VWorld API 키 실패');
    showToast('필지 정보를 가져올 수 없습니다', 'error');
    return null;
}

function callVWorldAPI(lat, lng, apiKey) {
    return new Promise((resolve, reject) => {
        const callbackName = `vworld_callback_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        const script = document.createElement('script');
        
        window[callbackName] = function(data) {
            try {
                if (data.response && data.response.status === 'OK' && data.response.result) {
                    const features = data.response.result.featureCollection?.features;
                    if (features && features.length > 0) {
                        const feature = features[0];
                        console.log(`📋 필지 발견! 전체 속성:`, feature.properties);
                        console.log(`🔍 PNU 확인: PNU=${feature.properties?.PNU}, pnu=${feature.properties?.pnu}, A_PNU=${feature.properties?.A_PNU}`);
                        resolve(feature);
                    } else {
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            } finally {
                document.head.removeChild(script);
                delete window[callbackName];
            }
        };
        
        const url = `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=LP_PA_CBND_BUBUN&key=${apiKey}&geometry=true&geomFilter=POINT(${lng} ${lat})&size=10&format=json&crs=EPSG:4326&callback=${callbackName}`;
        
        script.src = url;
        script.onerror = () => {
            document.head.removeChild(script);
            delete window[callbackName];
            reject(new Error('JSONP 요청 실패'));
        };
        
        document.head.appendChild(script);
        
        setTimeout(() => {
            if (document.head.contains(script)) {
                document.head.removeChild(script);
                delete window[callbackName];
                reject(new Error('타임아웃'));
            }
        }, 10000);
    });
}

// ============================
// 필지 관리 시스템
// ============================

// 필지 색칠하기 (좌클릭)
function colorParcel(parcel, color) {
    console.log('🎯 THINK HARD: colorParcel 함수 호출됨!', parcel);
    // 🎯 ULTRATHINK: VWorld API는 pnu(소문자)를 사용함!
    const pnu = parcel.properties.pnu || parcel.properties.PNU;
    if (!pnu) {
        console.error('❌ PNU 정보가 없습니다', parcel.properties);
        return;
    }
    
    console.log(`🎨 필지 색칠: ${pnu} → ${color}`);
    
    // 기존 필지가 있는지 확인
    let existingParcel = AppState.clickParcels.get(pnu);
    
    if (existingParcel) {
        // 기존 필지 색상 변경
        existingParcel.color = color;
        if (existingParcel.polygon) {
            existingParcel.polygon.setOptions({
                fillColor: color,
                fillOpacity: 0.7,
                strokeColor: color,
                strokeOpacity: 1.0,
                strokeWeight: 2
            });
        }
        console.log('✅ 기존 필지 색상 변경 완료');
    } else {
        // 새 필지 생성
        const polygon = createPolygonFromGeometry(parcel.geometry, {
            fillColor: color,
            fillOpacity: 0.7,
            strokeColor: color,
            strokeOpacity: 1.0,
            strokeWeight: 2
        });
        
        if (!polygon) {
            console.error('❌ 폴리곤 생성 실패');
            return;
        }
        
        // 지도에 표시 (색칠 모드이고 검색 모드가 아닐 때만)
        if (AppState.paintMode && !AppState.searchMode) {
            polygon.setMap(AppState.map);
        }
        
        // 클릭 필지 저장
        AppState.clickParcels.set(pnu, {
            polygon: polygon,
            color: color,
            pnu: pnu,
            data: parcel,
            properties: parcel.properties,
            jibun: formatJibun(parcel.properties),
            timestamp: Date.now(),
            isSaved: false,
            hasMarker: false
        });
        
        console.log('✅ 새 필지 생성 완료');
    }
    
    // 필지 목록 패널 제거됨 - updateParcelList 호출 제거
    
    // 🎯 THINK HARD: 필지 정보 완전 로드 (지번 + 저장된 정보)
    const currentParcelData = AppState.clickParcels.get(pnu);
    if (currentParcelData) {
        // 현재 선택된 필지로 설정
        AppState.currentSelectedParcel = { pnu, data: currentParcelData };
        console.log(`🎯 필지 선택 및 정보 로드: ${currentParcelData.jibun}`);
        
        // 완전한 정보 로드 (저장된 정보 포함)
        loadParcelInfoToPanel(currentParcelData);
    }
    
    // 🎯 ULTRATHINK: Supabase 클라우드 저장 (비동기, 별도 실행)
    if (currentParcelData) {
        saveParcelToSupabase(currentParcelData).catch(error => {
            console.error('❌ Supabase 저장 오류:', error);
        });
    }
}

// 필지 삭제하기 (우클릭)
function removeParcel(pnu) {
    console.log(`🗑️ 필지 삭제: ${pnu}`);
    
    const parcelData = AppState.clickParcels.get(pnu);
    if (!parcelData) {
        console.log('삭제할 필지가 없습니다');
        return;
    }
    
    // 폴리곤 지도에서 제거
    if (parcelData.polygon) {
        parcelData.polygon.setMap(null);
    }
    
    // M 마커 제거
    if (parcelData.marker) {
        parcelData.marker.setMap(null);
    }
    
    // 데이터에서 삭제
    AppState.clickParcels.delete(pnu);
    
    // 필지 목록 패널 제거됨 - updateParcelList 호출 제거
    
    // 🎯 ULTRATHINK: Supabase에서 삭제
    deleteParcelFromSupabase(pnu);
    
    console.log('✅ 필지 삭제 완료');
    showToast('필지가 삭제되었습니다');
}

// ============================
// 지도 이벤트 핸들러
// ============================

// 지도 좌클릭 이벤트
async function handleMapLeftClick(e) {
    console.log('🎯 THINK HARD: handleMapLeftClick 호출됨');
    
    if (!AppState.paintMode) {
        console.log('❌ 색칠 모드가 꺼져있어 클릭 무시');
        return;
    }
    
    if (AppState.searchMode) {
        console.log('❌ 검색 모드에서는 클릭 무시');
        return;
    }
    
    const coord = e.coord;
    console.log(`👆 좌클릭: ${coord.lat()}, ${coord.lng()}`);
    console.log(`🎯 VWorld API 호출 시작...`);
    
    try {
        const parcel = await getParcelFromVWorld(coord.lat(), coord.lng());
        console.log(`🎯 VWorld API 응답:`, parcel ? '성공' : '실패');
        
        if (parcel) {
            console.log(`🎯 필지 데이터 존재, colorParcel 호출`);
            // 🎯 THINK HARD: colorParcel에서 색칠 + 정보 로드 모두 완료
            colorParcel(parcel, AppState.currentColor);
        } else {
            console.log(`❌ 필지 정보 없음, 패널 초기화`);
            // 🎯 THINK HARD: 필지 정보 없는 곳 클릭 시 입력 필드 초기화
            AppState.currentSelectedParcel = null;
            clearParcelInfoPanel();
            showToast('이 위치에 필지 정보가 없습니다', 'warning');
        }
    } catch (error) {
        console.error('❌ 필지 색칠 실패:', error);
        showToast('필지 색칠에 실패했습니다', 'error');
    }
}

// 지도 우클릭 이벤트
async function handleMapRightClick(e) {
    if (!AppState.paintMode) {
        console.log('색칠 모드가 꺼져있어 우클릭 무시');
        return;
    }
    
    const coord = e.coord;
    console.log(`👉 우클릭: ${coord.lat()}, ${coord.lng()}`);
    
    try {
        const parcel = await getParcelFromVWorld(coord.lat(), coord.lng());
        if (parcel) {
            const pnu = parcel.properties.PNU || parcel.properties.pnu;
            if (pnu && AppState.clickParcels.has(pnu)) {
                removeParcel(pnu);
            } else {
                showToast('삭제할 필지가 없습니다', 'info');
            }
        }
    } catch (error) {
        console.error('❌ 필지 삭제 실패:', error);
    }
}

// ============================
// 저장 및 복원 시스템
// ============================


// 🎯 ULTRATHINK: Supabase에서 데이터 복원
async function loadFromSupabase() {
    try {
        console.log('🎯 Supabase에서 데이터 복원 시작...');
        
        // SupabaseDataManager 대기
        if (!window.supabaseDataManager) {
            console.log('⏳ SupabaseDataManager 대기 중...');
            let attempts = 0;
            while (!window.supabaseDataManager && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 200));
                attempts++;
            }
            
            if (!window.supabaseDataManager) {
                console.warn('⚠️ SupabaseDataManager를 찾을 수 없어 기본 설정으로 시작');
                return;
            }
        }
        
        // 상태 초기화
        AppState.paintMode = true;
        AppState.searchMode = false;
        AppState.currentColor = '#FF0000';
        window.paintModeEnabled = AppState.paintMode;
        
        // Supabase에서 모든 필지 데이터 가져오기
        const allParcels = await window.supabaseDataManager.getAllParcels();
        console.log(`📊 Supabase에서 ${allParcels.length}개 필지 로드`);
        
        let restoreCount = 0;
        
        allParcels.forEach(parcelData => {
            if (parcelData.geometry && parcelData.pnu) {
                const polygon = createPolygonFromGeometry(parcelData.geometry, {
                    fillColor: parcelData.color || '#FF0000',
                    fillOpacity: 0.7,
                    strokeColor: parcelData.color || '#FF0000',
                    strokeOpacity: 1.0,
                    strokeWeight: 2
                });
                
                if (polygon) {
                    // 색칠 모드이고 검색 모드가 아닐 때만 표시
                    if (AppState.paintMode && !AppState.searchMode) {
                        polygon.setMap(AppState.map);
                    }
                    
                    AppState.clickParcels.set(parcelData.pnu, {
                        polygon: polygon,
                        color: parcelData.color || '#FF0000',
                        pnu: parcelData.pnu,
                        data: { 
                            geometry: parcelData.geometry, 
                            properties: parcelData.properties || {},
                            owner: parcelData.ownerName || '',
                            address: parcelData.ownerAddress || '',
                            contact: parcelData.ownerContact || '',
                            memo: parcelData.memo || ''
                        },
                        properties: parcelData.properties || {},
                        jibun: formatJibun(parcelData.properties || {}),
                        timestamp: new Date(parcelData.updated_at || parcelData.created_at).getTime(),
                        isSaved: true,
                        hasMarker: true
                    });
                    
                    // M 마커 생성
                    createMMarker(parcelData.pnu);
                    
                    restoreCount++;
                }
            }
        });
        
        console.log(`✅ Supabase 복원 완료: ${restoreCount}개 필지`);
        
    } catch (error) {
        console.error('❌ Supabase 복원 실패:', error);
        console.log('🎯 기본 설정으로 시작');
    }
}


// ============================
// UI 업데이트 함수들  
// ============================

// 필지 목록 패널이 제거되어 updateParcelList 함수도 삭제됨

// 🎯 ULTRATHINK: 단일 M 마커 생성 시스템 (중복 방지)
function createMMarker(pnu) {
    console.log(`🚨 CRITICAL M 마커 생성 시작: ${pnu}`);
    console.log(`🔍 현재 시간: ${new Date().toLocaleTimeString()}`);
    
    const parcelData = AppState.clickParcels.get(pnu);
    if (!parcelData) {
        console.error(`❌ 필지 데이터 없음: ${pnu}`);
        return false;
    }
    
    // 🎯 ULTRATHINK: 기존 마커 완전 제거 (중복 방지)
    if (parcelData.marker) {
        parcelData.marker.setMap(null);
        parcelData.marker = null;
        console.log('🗑️ 기존 M 마커 제거');
    }
    if (parcelData.memoMarker && parcelData.memoMarker !== parcelData.marker) {
        parcelData.memoMarker.setMap(null);
        parcelData.memoMarker = null;
        console.log('🗑️ 기존 memoMarker 제거');
    }
    
    let markerPosition;
    
    // 방법 1: 필지 중심점 계산 시도
    if (parcelData.data?.geometry?.coordinates) {
        try {
            const coords = parcelData.data.geometry.coordinates[0];
            let centerLat = 0, centerLng = 0;
            coords.forEach(coord => {
                centerLat += coord[1];
                centerLng += coord[0];
            });
            centerLat /= coords.length;
            centerLng /= coords.length;
            markerPosition = new naver.maps.LatLng(centerLat, centerLng);
            console.log(`📍 필지 중심점: ${centerLat}, ${centerLng}`);
        } catch (error) {
            console.warn('⚠️ 필지 중심점 계산 실패:', error);
            markerPosition = null;
        }
    }
    
    // 🎯 ULTRATHINK: 지도 객체 확보 (핵심 수정!)
    const map = window.map || AppState.map; // window.map 우선 사용
    if (!map) {
        console.error('❌ 지도 객체를 찾을 수 없음 (window.map도 AppState.map도 없음)');
        return false;
    }
    console.log(`📍 지도 객체 확인: ${map ? '✅' : '❌'}`);
    
    // 방법 2: 지도 중심 사용 (fallback)
    if (!markerPosition) {
        try {
            markerPosition = map.getCenter();
            console.log(`📍 지도 중심 사용: ${markerPosition.lat()}, ${markerPosition.lng()}`);
            
            // 지도 중심이 (0,0)이면 기본 위치 사용
            if (markerPosition.lat() === 0 && markerPosition.lng() === 0) {
                markerPosition = new naver.maps.LatLng(37.5665, 126.9780); // 서울 시청
                console.log('📍 기본 위치(서울시청) 사용');
            }
        } catch (error) {
            console.warn('⚠️ 지도 중심 획득 실패, 기본 위치 사용:', error);
            markerPosition = new naver.maps.LatLng(37.5665, 126.9780); // 서울 시청
        }
    }
    
    try {
        // 🎯 ULTRATHINK: 간단하고 확실한 M 마커 생성 (예전 방식)
        console.log(`✅ 간단 마커 생성 위치: ${markerPosition.lat()}, ${markerPosition.lng()}`);
        
        const marker = new naver.maps.Marker({
            position: markerPosition,
            map: map,
            icon: {
                content: '<div style="background: #dc3545; color: white; width: 32px; height: 32px; border-radius: 50%; text-align: center; line-height: 32px; font-weight: bold; font-size: 18px; border: 3px solid white; box-shadow: 0 4px 12px rgba(220,53,69,0.8); z-index: 10000; cursor: pointer;">M</div>',
                anchor: new naver.maps.Point(16, 16)
            },
            zIndex: 10000,
            title: `저장된 필지: ${parcelData.data?.jibun || pnu}`
        });
        
        console.log(`✅ 마커 생성 완료, 지도 표시됨:`, marker.getMap() !== null);
        
        // 🎯 ULTRATHINK: 클릭 이벤트 (한 번만 추가)
        naver.maps.Event.addListener(marker, 'click', async function() {
            console.log(`📝 M 마커 클릭: ${pnu}`);
            
            try {
                // 🎯 ULTRATHINK: Supabase에서 저장된 데이터 가져오기
                const savedInfo = await window.supabaseDataManager?.getParcel(pnu);
                
                if (savedInfo) {
                    const parcelNumberField = document.getElementById('parcelNumber');
                    const ownerNameField = document.getElementById('ownerName');
                    const ownerAddressField = document.getElementById('ownerAddress');
                    const ownerContactField = document.getElementById('ownerContact');
                    const memoField = document.getElementById('memo');
                    
                    if (parcelNumberField) parcelNumberField.value = formatJibun(savedInfo.properties || {});
                    if (ownerNameField) ownerNameField.value = savedInfo.ownerName || '';
                    if (ownerAddressField) ownerAddressField.value = savedInfo.ownerAddress || '';
                    if (ownerContactField) ownerContactField.value = savedInfo.ownerContact || '';
                    if (memoField) memoField.value = savedInfo.memo || '';
                    
                    AppState.currentSelectedParcel = pnu;
                    console.log(`✅ Supabase에서 저장된 정보 표시: ${pnu}`);
                } else {
                    console.log(`⚠️ Supabase에 저장된 정보 없음: ${pnu}`);
                }
            } catch (error) {
                console.error('❌ M 마커 클릭 처리 오류:', error);
            }
        });
        
        // 🎯 ULTRATHINK: 단일 참조로 저장 (중복 방지)
        parcelData.marker = marker;
        parcelData.memoMarker = marker; // 호환성을 위한 동일 참조
        parcelData.hasMarker = true;
        
        console.log('✅ ULTRATHINK M 마커 생성 완료!');
        
        // 1초 후 마커 존재 및 표시 확인
        setTimeout(() => {
            const isVisible = marker && marker.getMap() !== null;
            console.log(`🔍 M 마커 1초 후 확인: 존재=${!!marker}, 표시됨=${isVisible}`);
            if (!isVisible) {
                console.warn('⚠️ M 마커가 1초 후에도 표시되지 않음!');
            }
        }, 1000);
        
        return true;
        
    } catch (error) {
        console.error('❌ M 마커 생성 실패:', error);
        return false;
}
}

// ============================
// 검색 관련 함수들
// ============================

// 주소 또는 지번 검색
async function performSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput || !searchInput.value.trim()) {
        showToast('검색어를 입력해주세요', 'warning');
        return;
    }
    
    const query = searchInput.value.trim();
    console.log(`🔍 ULTRATHINK 검색 시작: ${query}`);
    showToast('검색 중...', 'info');
    
    try {
        // Naver Geocoding API를 통한 주소 검색
        const geocodeResult = await searchByAddress(query);
        
        if (geocodeResult) {
            console.log('✅ 주소 검색 성공:', geocodeResult);
            
            // 지도 이동
            const lat = geocodeResult.y;
            const lng = geocodeResult.x;
            AppState.map.setCenter(new naver.maps.LatLng(lat, lng));
            AppState.map.setZoom(16);
            
            // 해당 위치의 필지 정보 가져오기
            const parcel = await getParcelFromVWorld(lat, lng);
            if (parcel) {
                // 🎯 ULTRATHINK: 검색 성공 시 자동으로 검색 모드 ON
                if (!AppState.searchMode) {
                    console.log('🔍 ULTRATHINK: 검색 성공으로 자동 검색 모드 ON');
                    AppState.searchMode = true;
                    updateSearchButtonState();
                    hideClickParcels(); // 클릭 필지 숨김
                }
                
                // 검색된 필지를 보라색으로 표시
                addSearchParcel(parcel);
                showSearchParcels(); // 검색 필지 표시
                showToast(`검색 완료: ${geocodeResult.roadAddress || geocodeResult.jibunAddress}`, 'success');
            } else {
                showToast('해당 위치에 필지 정보가 없습니다', 'warning');
            }
        } else {
            showToast('검색 결과를 찾을 수 없습니다', 'warning');
        }
    } catch (error) {
        console.error('❌ 검색 실패:', error);
        showToast('검색에 실패했습니다', 'error');
    }
}

// Naver Geocoding API를 통한 주소 검색
async function searchByAddress(query) {
    try {
        // 서버의 프록시를 통해 Naver Geocoding API 호출
        const response = await fetch(`/api/naver/geocode?query=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
            throw new Error('Geocoding API 호출 실패');
        }
        
        const data = await response.json();
        
        if (data.addresses && data.addresses.length > 0) {
            return data.addresses[0];
        } else {
            return null;
        }
    } catch (error) {
        console.error('Geocoding API 오류:', error);
        return null;
    }
}

// 검색된 필지를 보라색으로 추가
function addSearchParcel(parcel) {
    const pnu = parcel.properties.PNU || parcel.properties.pnu;
    if (!pnu) return;
    
    // 기존 검색 결과 지우기
    clearSearchParcels();
    
    // 보라색 폴리곤 생성
    const polygon = createPolygonFromGeometry(parcel.geometry, {
        fillColor: '#9966FF',
        fillOpacity: 0.5,
        strokeColor: '#9966FF',
        strokeOpacity: 1.0,
        strokeWeight: 3
    });
    
    if (!polygon) return;
    
    // 검색 모드일 때만 표시
    if (AppState.searchMode) {
        polygon.setMap(AppState.map);
    }
    
    // 지번 라벨 생성
    const jibun = formatJibun(parcel.properties);
    const coords = parcel.geometry.coordinates[0];
    let centerLat = 0, centerLng = 0;
    coords.forEach(coord => {
        centerLat += coord[1];
        centerLng += coord[0];
    });
    centerLat /= coords.length;
    centerLng /= coords.length;
    
    const label = new naver.maps.InfoWindow({
        content: `<div style="padding: 4px 8px; background: white; border: 1px solid #9966FF; border-radius: 4px; font-size: 12px; font-weight: bold; color: #9966FF;">${jibun}</div>`,
        position: new naver.maps.LatLng(centerLat, centerLng),
        backgroundColor: 'transparent',
        borderWidth: 0,
        anchorSkew: false
    });
    
    if (AppState.searchMode) {
        label.open(AppState.map);
    }
    
    // 검색 필지 저장
    AppState.searchParcels.set(pnu, {
        polygon: polygon,
        label: label,
        pnu: pnu,
        data: parcel,
        properties: parcel.properties,
        jibun: jibun
    });
    
    console.log(`✅ 검색 필지 추가 (보라색): ${pnu} - ${jibun}`);
}

// 검색 결과 지우기
function clearSearchParcels() {
    AppState.searchParcels.forEach((parcelData) => {
        if (parcelData.polygon) {
            parcelData.polygon.setMap(null);
        }
        if (parcelData.label) {
            parcelData.label.close();
        }
    });
    AppState.searchParcels.clear();
    console.log('🧹 검색 결과 모두 지움');
}

// ============================
// 저장 관련 함수들
// ============================

// 🎯 THINK HARD: 선택된 필지 정보를 왼쪽 패널에 로드
function loadParcelInfoToPanel(parcelData) {
    if (!parcelData) {
        console.log('❌ 로드할 필지 데이터가 없음');
        return;
    }
    
    console.log(`📝 필지 정보 패널에 로드: ${parcelData.jibun || 'N/A'}`);
    
    // 입력 필드들 가져오기
    const parcelNumberInput = document.getElementById('parcelNumber');
    const ownerNameInput = document.getElementById('ownerName');
    const ownerAddressInput = document.getElementById('ownerAddress');
    const ownerContactInput = document.getElementById('ownerContact');
    const memoInput = document.getElementById('memo');
    
    // 필지 정보 로드
    if (parcelNumberInput) {
        parcelNumberInput.value = parcelData.jibun || '';
    }
    
    // 저장된 정보가 있으면 로드, 없으면 기본 필지 속성 사용
    if (ownerNameInput) {
        ownerNameInput.value = parcelData.data?.owner || parcelData.owner || '';
    }
    
    if (ownerAddressInput) {
        ownerAddressInput.value = parcelData.data?.address || parcelData.address || '';
    }
    
    if (ownerContactInput) {
        ownerContactInput.value = parcelData.data?.contact || parcelData.contact || '';
    }
    
    if (memoInput) {
        memoInput.value = parcelData.data?.memo || parcelData.memo || '';
    }
    
    console.log(`✅ 필지 정보 로드 완료: 저장됨=${parcelData.isSaved}, 마커=${parcelData.hasMarker}`);
}

// 🎯 THINK HARD: 필지 정보 패널 초기화 (입력 필드 비우기)
function clearParcelInfoPanel() {
    const parcelNumberInput = document.getElementById('parcelNumber');
    const ownerNameInput = document.getElementById('ownerName');
    const ownerAddressInput = document.getElementById('ownerAddress');
    const ownerContactInput = document.getElementById('ownerContact');
    const memoInput = document.getElementById('memo');
    
    if (parcelNumberInput) parcelNumberInput.value = '';
    if (ownerNameInput) ownerNameInput.value = '';
    if (ownerAddressInput) ownerAddressInput.value = '';
    if (ownerContactInput) ownerContactInput.value = '';
    if (memoInput) memoInput.value = '';
    
    console.log('🧹 필지 정보 패널 초기화 완료');
}

// 🎯 THINK HARD: 현재 필지 정보 저장 (선택된 필지 기준)
async function saveCurrentParcel() {
    console.log('🚀 ULTRATHINK: saveCurrentParcel 함수 시작');
    console.log('📊 현재 clickParcels 개수:', AppState.clickParcels.size);
    console.log('📍 currentSelectedParcel:', AppState.currentSelectedParcel);
    
    // 🎯 ULTRATHINK: 중복 실행 방지
    if (saveCurrentParcel.isRunning) {
        console.log('⚠️ ULTRATHINK: saveCurrentParcel 이미 실행 중, 중복 실행 방지');
        return;
    }
    saveCurrentParcel.isRunning = true;
    
    const parcelNumberInput = document.getElementById('parcelNumber');
    const ownerNameInput = document.getElementById('ownerName');
    const ownerAddressInput = document.getElementById('ownerAddress');
    const ownerContactInput = document.getElementById('ownerContact');
    const memoInput = document.getElementById('memo');
    
    let targetPnu = null;
    let targetParcelData = null;
    
    // 🎯 ULTRATHINK: 다중 전략으로 저장할 필지 찾기
    
    // 전략 1: currentSelectedParcel 사용 (PNU string)
    if (AppState.currentSelectedParcel && typeof AppState.currentSelectedParcel === 'string') {
        targetPnu = AppState.currentSelectedParcel;
        targetParcelData = AppState.clickParcels.get(targetPnu);
        if (targetParcelData) {
            console.log(`✅ 전략1 성공: currentSelectedParcel → ${targetPnu}`);
        } else {
            console.warn(`⚠️ 전략1 실패: PNU ${targetPnu}에 해당하는 데이터 없음`);
            targetPnu = null;
        }
    }
    
    // 전략 2: 입력된 지번과 일치하는 필지 찾기
    if (!targetPnu && parcelNumberInput && parcelNumberInput.value.trim()) {
        const inputJibun = parcelNumberInput.value.trim();
        console.log(`🔍 전략2: 지번으로 찾기 → "${inputJibun}"`);
        
        for (let [pnu, parcelData] of AppState.clickParcels) {
            const jibun = parcelData.data?.jibun || parcelData.jibun;
            if (jibun === inputJibun) {
                targetPnu = pnu;
                targetParcelData = parcelData;
                console.log(`✅ 전략2 성공: 지번 "${inputJibun}" 매칭 → ${pnu}`);
                break;
            }
        }
    }
    
    // 전략 3: 색칠된 필지 중 첫 번째 사용 (최후 수단)
    if (!targetPnu && AppState.clickParcels.size > 0) {
        const firstEntry = AppState.clickParcels.entries().next().value;
        targetPnu = firstEntry[0];
        targetParcelData = firstEntry[1];
        console.log(`⚠️ 전략3: 첫 번째 필지 사용 → ${targetPnu}`);
    }
    
    // ULTRATHINK 검증
    if (!targetPnu || !targetParcelData) {
        console.error('❌ ULTRATHINK: 모든 전략 실패 - 저장할 필지를 찾을 수 없음');
        showToast('저장할 필지를 선택해주세요', 'warning');
        saveCurrentParcel.isRunning = false;
        return;
    }
    
    console.log(`🎯 ULTRATHINK 저장 확정: PNU=${targetPnu}, 지번=${targetParcelData.data?.jibun || targetParcelData.jibun}`);
    
    try {
        // 필지 정보 업데이트
        if (!targetParcelData.data) {
            targetParcelData.data = {};
        }
        
        const parcelData = targetParcelData.data;
        parcelData.owner = ownerNameInput ? ownerNameInput.value.trim() : '';
        parcelData.address = ownerAddressInput ? ownerAddressInput.value.trim() : '';
        parcelData.contact = ownerContactInput ? ownerContactInput.value.trim() : '';
        parcelData.memo = memoInput ? memoInput.value.trim() : '';
        parcelData.isSaved = true;
        parcelData.hasMarker = true;
        
        // AppState 업데이트
        targetParcelData.hasMarker = true;
        AppState.clickParcels.set(targetPnu, targetParcelData);
        
        console.log(`💾 필지 데이터 업데이트 완료:`, parcelData);
        
        // 🎯 ULTRATHINK: M 마커 강제 생성 (다중 안전장치)
        console.log(`🎯 M 마커 생성 시작: ${targetPnu}`);
        
        // 1단계: 기존 마커 완전 제거
        if (targetParcelData.marker) {
            try {
                targetParcelData.marker.setMap(null);
                targetParcelData.marker = null;
                console.log('🗑️ 기존 M 마커 제거');
            } catch (e) {
                console.warn('⚠️ 기존 마커 제거 중 오류:', e);
            }
        }
        
        // 🎯 ULTRATHINK: 예전에 잘 작동하던 방식으로 간단하게 M 마커 생성
        console.log(`🚨 간단 마커 생성 시작: ${targetPnu}`);
        
        // createMMarker 함수 직접 호출 (예전 방식)
        const markerSuccess = createMMarker(targetPnu);
        console.log(`🚨 createMMarker 결과: ${markerSuccess}`);
        
        // 혹시 실패하면 1초 후 재시도
        setTimeout(() => {
            const checkParcel = AppState.clickParcels.get(targetPnu);
            if (!checkParcel || !checkParcel.marker) {
                console.log(`🚨 1초 후 재시도: ${targetPnu}`);
                createMMarker(targetPnu);
            } else {
                console.log(`✅ M 마커 확인됨: ${targetPnu}`);
            }
        }, 1000);
        
        // 🎯 ULTRATHINK: Supabase 클라우드 저장
        await saveParcelToSupabase({
            pnu: targetPnu,
            color: targetParcelData.color,
            properties: targetParcelData.properties,
            data: targetParcelData.data,
            ownerName: parcelData.owner,
            ownerAddress: parcelData.address,
            ownerContact: parcelData.contact,
            memo: parcelData.memo
        });
        
        showToast('저장됨', 'success');
        console.log(`💾 ULTRATHINK 저장 완료: ${parcelData.jibun} (${targetPnu})`);
        
    } catch (error) {
        console.error('❌ ULTRATHINK 저장 중 오류:', error);
        showToast('저장 오류', 'error');
    } finally {
        saveCurrentParcel.isRunning = false;
    }
}

// ============================
// 버튼 상태 업데이트 함수들
// ============================

// 🎯 ULTRATHINK: 검색 버튼 상태 업데이트 (중앙화된 관리)
function updateSearchButtonState() {
    const btn = document.getElementById('searchToggleBtn');
    if (btn) {
        btn.textContent = AppState.searchMode ? '검색 ON' : '검색 OFF';
        btn.classList.toggle('active', AppState.searchMode);
        console.log(`🔄 ULTRATHINK: 검색 버튼 상태 업데이트 → ${AppState.searchMode ? 'ON' : 'OFF'}`);
    }
}

// 색칠 버튼 상태 업데이트
function updatePaintButtonState() {
    const btn = document.getElementById('paintToggleBtn');
    if (btn) {
        btn.textContent = AppState.paintMode ? '색칠 ON' : '색칠 OFF';
        btn.classList.toggle('active', AppState.paintMode);
        console.log(`🔄 ULTRATHINK: 색칠 버튼 상태 업데이트 → ${AppState.paintMode ? 'ON' : 'OFF'}`);
    }
}

// ============================
// 모드 토글 함수들
// ============================

// 색칠 모드 토글
function togglePaintMode() {
    AppState.paintMode = !AppState.paintMode;
    
    // 🎯 ULTRATHINK: parcel.js와 동기화
    window.paintModeEnabled = AppState.paintMode;
    
    updatePaintButtonState();
    
    console.log(`🎨 ULTRATHINK: 색칠 모드 토글 → ${AppState.paintMode ? 'ON' : 'OFF'}`);
    console.log(`🔗 ULTRATHINK: window.paintModeEnabled 동기화 → ${window.paintModeEnabled}`);
    showToast(`색칠 모드 ${AppState.paintMode ? '활성화' : '비활성화'}`);
    
    // 🎯 ULTRATHINK: 상태 변경은 실시간 동기화로 처리 (localStorage 제거)
}

// 🎯 ULTRATHINK: 검색 모드 토글 (수동 전환용)
function toggleSearchMode() {
    console.log(`🔄 ULTRATHINK toggleSearchMode 시작: ${AppState.searchMode} → ${!AppState.searchMode}`);
    console.log(`📊 현재 클릭 필지 수: ${AppState.clickParcels.size}개`);
    
    AppState.searchMode = !AppState.searchMode;
    updateSearchButtonState();
    
    // 필지 표시/숨김 처리
    if (AppState.searchMode) {
        // 검색 ON: 클릭 필지 숨기고 검색 필지 표시
        console.log('🔍 검색 ON: 클릭 필지 숨김 시작...');
        console.log('⏰ hideClickParcels() 호출 전 상태 확인...');
        AppState.clickParcels.forEach((data, pnu) => {
            console.log(`📍 필지 ${pnu}: polygon=${!!data.polygon}, marker=${!!data.marker}, visible=${data.polygon?.getMap() !== null}`);
        });
        
        hideClickParcels();
        
        console.log('⏰ hideClickParcels() 호출 후 상태 확인...');
        AppState.clickParcels.forEach((data, pnu) => {
            console.log(`📍 필지 ${pnu}: polygon=${!!data.polygon}, marker=${!!data.marker}, visible=${data.polygon?.getMap() !== null}`);
        });
        
        console.log('🔍 검색 ON: 검색 필지 표시 시작...');
        showSearchParcels();
        console.log('✅ 검색 ON 완료: 클릭 필지 숨김 + 검색 필지 표시');
    } else {
        // 검색 OFF: 검색 필지 숨기고 클릭 필지 표시
        console.log('🖱️ 검색 OFF: 검색 필지 숨김 시작...');
        hideSearchParcels();
        console.log('🖱️ 검색 OFF: 클릭 필지 표시 시작...');
        showClickParcels();
        console.log('✅ 검색 OFF 완료: 검색 필지 숨김 + 클릭 필지 표시');
    }
    
    showToast(`검색 모드 ${AppState.searchMode ? '활성화' : '비활성화'}`);
    // 🎯 ULTRATHINK: 상태 변경은 실시간 동기화로 처리 (localStorage 제거)
}

// 클릭 필지 표시
function showClickParcels() {
    const map = window.map || AppState.map; // ULTRATHINK: 지도 객체 확보
    if (!map) {
        console.error('❌ showClickParcels: 지도 객체 없음');
        return;
    }
    
    AppState.clickParcels.forEach((parcelData) => {
        if (parcelData.polygon) {
            parcelData.polygon.setMap(map);
        }
        if (parcelData.marker) {
            parcelData.marker.setMap(map);
        }
    });
    console.log(`👁️ 클릭 필지 표시 (색칠 + M 마커): ${AppState.clickParcels.size}개`);
}

// 클릭 필지 숨김 (검색 모드 ON 시 M 마커도 함께 숨김)
function hideClickParcels() {
    console.log(`🙈 ULTRATHINK hideClickParcels 시작: ${AppState.clickParcels.size}개 필지 처리`);
    
    let hiddenPolygons = 0;
    let hiddenMarkers = 0;
    
    AppState.clickParcels.forEach((parcelData, pnu) => {
        console.log(`🔍 처리 중 필지 ${pnu}:`, {
            hasPolygon: !!parcelData.polygon,
            hasMarker: !!parcelData.marker,
            polygonVisible: parcelData.polygon ? parcelData.polygon.getMap() !== null : null,
            markerVisible: parcelData.marker ? parcelData.marker.getMap() !== null : null
        });
        
        // 🎯 ULTRATHINK: 검색 모드 ON일 때는 색칠된 필지와 M 마커 모두 숨김
        if (parcelData.polygon) {
            try {
                parcelData.polygon.setMap(null);
                hiddenPolygons++;
                console.log(`✅ 폴리곤 숨김 성공: ${pnu}`);
            } catch (error) {
                console.error(`❌ 폴리곤 숨김 실패: ${pnu}`, error);
            }
        }
        if (parcelData.marker) {
            try {
                parcelData.marker.setMap(null);
                hiddenMarkers++;
                console.log(`✅ M 마커 숨김 성공: ${pnu}`);
            } catch (error) {
                console.error(`❌ M 마커 숨김 실패: ${pnu}`, error);
            }
        }
    });
    
    console.log(`🙈 클릭 필지 숨김 완료: 폴리곤 ${hiddenPolygons}개, M 마커 ${hiddenMarkers}개`);
}

// 검색 필지 표시
function showSearchParcels() {
    AppState.searchParcels.forEach((parcelData) => {
        if (parcelData.polygon) {
            parcelData.polygon.setMap(AppState.map);
        }
        if (parcelData.label) {
            parcelData.label.open(AppState.map);
        }
    });
    console.log(`👁️ 검색 필지 표시: ${AppState.searchParcels.size}개`);
}

// 검색 필지 숨김
function hideSearchParcels() {
    AppState.searchParcels.forEach((parcelData) => {
        if (parcelData.polygon) {
            parcelData.polygon.setMap(null);
        }
        if (parcelData.label) {
            parcelData.label.close();
        }
    });
    console.log(`🙈 검색 필지 숨김: ${AppState.searchParcels.size}개`);
}

// ============================
// 초기화 및 이벤트 바인딩
// ============================

// 앱 초기화
function initializeApp() {
    console.log('🚀 ULTRATHINK App Core 초기화 시작');
    
    // 지도 객체 참조 설정
    AppState.map = window.map;
    
    if (!AppState.map) {
        console.error('❌ 지도 객체를 찾을 수 없습니다');
        return;
    }
    
    // 지도 이벤트 등록
    naver.maps.Event.addListener(AppState.map, 'click', handleMapLeftClick);
    naver.maps.Event.addListener(AppState.map, 'rightclick', handleMapRightClick);
    
    // 버튼 이벤트 등록
    const paintToggleBtn = document.getElementById('paintToggleBtn');
    if (paintToggleBtn) {
        paintToggleBtn.addEventListener('click', togglePaintMode);
    }
    
    const searchToggleBtn = document.getElementById('searchToggleBtn');
    if (searchToggleBtn) {
        searchToggleBtn.addEventListener('click', toggleSearchMode);
    }
    
    // 저장 버튼 이벤트 등록
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveCurrentParcel);
    }
    
    // 검색 버튼 이벤트 등록
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }
    
    // 검색 입력창 엔터키 이벤트
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
    
    // 색상 팔레트 이벤트 등록
    document.querySelectorAll('.color-item').forEach(item => {
        item.addEventListener('click', function() {
            AppState.currentColor = this.dataset.color;
            document.querySelectorAll('.color-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            console.log(`🎨 색상 변경: ${AppState.currentColor}`);
        });
    });
    
    // 🎯 ULTRATHINK: Supabase에서 데이터 복원
    loadFromSupabase();
    
    // 필지 목록 패널 제거됨 - updateParcelList 호출 제거
    
    // 버튼 상태 동기화
    const paintBtn = document.getElementById('paintToggleBtn');
    if (paintBtn) {
        paintBtn.textContent = AppState.paintMode ? '색칠 ON' : '색칠 OFF';
        paintBtn.classList.toggle('active', AppState.paintMode);
    }
    
    // 🎯 ULTRATHINK: 중앙화된 검색 버튼 상태 업데이트 사용
    updateSearchButtonState();
    
    // 🎯 ULTRATHINK: 초기 검색 OFF 상태에서는 보라색 검색 필지 숨김
    if (!AppState.searchMode) {
        console.log('🔍 초기 검색 OFF 모드: 보라색 검색 필지 숨김 처리');
        hideSearchParcels();
    }
    
    console.log('✅ ULTRATHINK App Core 초기화 완료');
    console.log(`📊 상태: 색칠=${AppState.paintMode}, 검색=${AppState.searchMode}, 필지=${AppState.clickParcels.size}개`);
}

// 🎯 THINK HARD: AppState와 핵심 함수들을 전역으로 완전 노출
window.AppState = AppState;
window.colorParcel = colorParcel;
window.loadParcelInfoToPanel = loadParcelInfoToPanel;
window.clearParcelInfoPanel = clearParcelInfoPanel;
window.saveCurrentParcel = saveCurrentParcel;
window.handleMapLeftClick = handleMapLeftClick;
window.handleMapRightClick = handleMapRightClick;
window.clearParcel = clearParcel;
// 기존 코드 호환성: getParcelInfo = getParcelFromVWorld
window.getParcelInfo = getParcelFromVWorld;

// 🎯 ULTRATHINK: 검색 필지 제거 함수
function clearParcel(pnu) {
    console.log('🗑️ clearParcel 함수 호출:', pnu);
    
    // 1. 클릭 필지에서 찾기
    const clickParcel = AppState.clickParcels.get(pnu);
    if (clickParcel) {
        console.log('🖱️ 클릭 필지 제거 시도:', pnu);
        
        // 폴리곤 제거
        if (clickParcel.polygon) {
            clickParcel.polygon.setMap(null);
        }
        
        // M 마커 제거
        if (clickParcel.memoMarker) {
            clickParcel.memoMarker.setMap(null);
        }
        
        // 데이터 제거
        AppState.clickParcels.delete(pnu);
        
        // 🎯 ULTRATHINK: Supabase에서 제거
        deleteParcelFromSupabase(pnu);
        
        // sessionStorage에서도 제거 (임시 데이터)
        try {
            const tempData = JSON.parse(sessionStorage.getItem('tempParcelColors') || '{}');
            if (tempData[pnu]) {
                delete tempData[pnu];
                sessionStorage.setItem('tempParcelColors', JSON.stringify(tempData));
            }
        } catch (error) {
            console.warn('⚠️ sessionStorage 제거 실패:', error);
        }
        
        showToast('필지 색상이 제거되었습니다', 'info');
        console.log('✅ 클릭 필지 제거 완료:', pnu);
        return true;
    }
    
    // 2. 검색 필지에서 찾기 (window.searchParcels 사용)
    if (window.searchParcels && window.searchParcels.has(pnu)) {
        console.log('🔍 검색 필지 제거 시도:', pnu);
        
        const searchParcel = window.searchParcels.get(pnu);
        
        // 폴리곤 제거
        if (searchParcel.polygon) {
            searchParcel.polygon.setMap(null);
        }
        
        // 라벨 제거
        if (searchParcel.label) {
            searchParcel.label.setMap(null);
        }
        
        // 데이터 제거
        window.searchParcels.delete(pnu);
        
        // sessionStorage에서 검색 필지 제거
        try {
            const sessionData = JSON.parse(sessionStorage.getItem('searchParcels') || '{}');
            if (sessionData[pnu]) {
                delete sessionData[pnu];
                sessionStorage.setItem('searchParcels', JSON.stringify(sessionData));
                console.log('💾 sessionStorage에서 검색 필지 제거 완료:', pnu);
            }
        } catch (error) {
            console.warn('⚠️ sessionStorage 제거 실패:', error);
        }
        
        // localStorage에서도 검색 결과 업데이트
        if (typeof saveSearchResultsToStorage === 'function') {
            saveSearchResultsToStorage();
        }
        
        showToast('검색 필지가 제거되었습니다', 'info');
        console.log('✅ 검색 필지 제거 완료:', pnu);
        return true;
    }
    
    console.warn('⚠️ 해당 PNU의 필지를 찾을 수 없음:', pnu);
    return false;
}

// 🎯 ULTRATHINK: Supabase 클라우드 저장 함수
async function saveParcelToSupabase(parcelData) {
    if (!parcelData) {
        console.warn('⚠️ 저장할 필지 데이터가 없습니다');
        return;
    }

    try {
        console.log('💾 Supabase에 필지 저장 중...', parcelData.pnu);
        
        // SupabaseDataManager 대기
        if (!window.supabaseDataManager) {
            console.log('⏳ SupabaseDataManager 대기 중...');
            // 최대 10초 대기
            let attempts = 0;
            while (!window.supabaseDataManager && attempts < 100) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (!window.supabaseDataManager) {
                console.error('❌ SupabaseDataManager를 찾을 수 없습니다');
                return;
            }
        }

        // 필지 데이터 형식 변환
        const supabaseData = {
            pnu: parcelData.pnu,
            color: parcelData.color || 'red',
            properties: parcelData.properties || {},
            geometry: parcelData.data?.geometry || parcelData.geometry,
            ownerName: parcelData.ownerName || '',
            ownerAddress: parcelData.ownerAddress || '',
            ownerContact: parcelData.ownerContact || '',
            memo: parcelData.memo || ''
        };

        // Supabase에 저장
        const success = await window.supabaseDataManager.saveParcel(parcelData.pnu, supabaseData);
        
        if (success) {
            console.log('✅ Supabase 저장 완료:', parcelData.pnu);
            // 저장 완료 표시
            if (parcelData) {
                parcelData.isSaved = true;
            }
            showToast('필지 데이터가 저장되었습니다 ☁️', 'success');
        } else {
            console.error('❌ Supabase 저장 실패');
            showToast('데이터 저장에 실패했습니다', 'error');
        }

    } catch (error) {
        console.error('❌ Supabase 저장 오류:', error);
        showToast('저장 중 오류가 발생했습니다', 'error');
    }
}

// 🎯 ULTRATHINK: Supabase에서 필지 삭제 함수  
async function deleteParcelFromSupabase(pnu) {
    try {
        if (!window.supabaseDataManager) {
            console.warn('⚠️ SupabaseDataManager가 준비되지 않았습니다');
            return false;
        }

        console.log('🗑️ Supabase에서 필지 삭제:', pnu);
        
        const success = await window.supabaseDataManager.deleteParcel(pnu);
        
        if (success) {
            console.log('✅ Supabase 삭제 완료:', pnu);
            showToast('필지가 삭제되었습니다 🗑️', 'success');
            return true;
        } else {
            console.error('❌ Supabase 삭제 실패');
            return false;
        }

    } catch (error) {
        console.error('❌ Supabase 삭제 오류:', error);
        return false;
    }
}

// 전역 함수 노출 (기존 코드와의 호환성)
window.AppCore = {
    AppState,
    togglePaintMode,
    toggleSearchMode,
    colorParcel,
    removeParcel,
    clearParcel,
    showClickParcels,
    hideClickParcels,
    showSearchParcels,
    hideSearchParcels,
    createMMarker,
    performSearch,
    clearSearchParcels,
    loadParcelInfoToPanel,
    clearParcelInfoPanel,
    saveCurrentParcel,
    saveParcelToSupabase,
    deleteParcelFromSupabase
};

// 초기화 실행 (지도가 준비된 후)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(initializeApp, 1000); // 지도 로딩 대기
    });
} else {
    setTimeout(initializeApp, 1000);
}

console.log('📦 ULTRATHINK App Core 로드 완료');