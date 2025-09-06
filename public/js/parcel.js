// 필지 관련 기능

// 실제 VWorld API로 필지 정보 조회 (JSONP 방식)
async function getParcelInfo(lat, lng) {
    console.log(`🏢 실제 필지 정보 조회 시작: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    
    // 🎯 ULTRATHINK: CONFIG 안전 체크 및 fallback 시스템
    console.log('🔧 CONFIG 객체 상태 확인:', {
        CONFIG_EXISTS: typeof CONFIG !== 'undefined',
        VWORLD_API_KEYS_EXISTS: typeof CONFIG !== 'undefined' && CONFIG.VWORLD_API_KEYS,
        KEYS_LENGTH: typeof CONFIG !== 'undefined' && CONFIG.VWORLD_API_KEYS ? CONFIG.VWORLD_API_KEYS.length : 0
    });
    
    // Config에서 API 키 가져오기 + 안전한 fallback
    const apiKeys = (typeof CONFIG !== 'undefined' && CONFIG.VWORLD_API_KEYS && CONFIG.VWORLD_API_KEYS.length > 0) 
        ? CONFIG.VWORLD_API_KEYS 
        : [
            // ULTRATHINK Fallback 키들 (CONFIG 로드 실패 시)
            '0A0DFD5D-0266-3FAB-8766-06E821646AF7',
            'BBAC532E-A56D-34CF-B520-CE68E8D6D52A',
            'E5B1657B-9B6F-3A4B-91EF-98512BE931A1',
            '8C62256B-1D08-32FF-AB3C-1FCD67242196',
            '6B854F88-4A5D-303C-B7C8-40858117A95E'
        ];
    
    console.log(`🔑 ULTRATHINK: ${apiKeys.length}개 API 키 로드됨 (Config: ${typeof CONFIG !== 'undefined' && CONFIG.VWORLD_API_KEYS ? '성공' : 'Fallback 사용'})`);
    
    if (!apiKeys || apiKeys.length === 0) {
        console.error('❌ ULTRATHINK: API 키를 전혀 로드할 수 없습니다!');
        alert('API 설정 오류가 발생했습니다. 새로고침을 시도해주세요.');
        return;
    }
    
    // JSONP 방식으로 각 API 키 시도
    for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = apiKeys[i];
        console.log(`🔑 JSONP 시도 - API 키 ${i+1}/${apiKeys.length}: ${apiKey.substring(0, 8)}...`);
        
        const result = await getParcelInfoViaJSONP(lat, lng, apiKey);
        if (result) {
            console.log('🎊 JSONP로 실제 필지 데이터 획득 성공!');
            return result;
        }
        
        console.log(`⚠️ JSONP API 키 ${i+1} 실패, 다음 키로 시도...`);
    }
    
    // 모든 키로 실패한 경우
    console.log('⚠️ 모든 API 키로 필지 정보를 가져오지 못했습니다.');
    console.log('💡 VWorld API는 CORS 정책으로 인해 JSONP만 지원합니다.');
    alert('해당 위치의 필지 정보를 찾을 수 없습니다.');
}

// JSONP 방식으로 VWorld API 호출
async function getParcelInfoViaJSONP(lat, lng, apiKey) {
    console.log('🌐 JSONP 방식으로 VWorld API 재시도...');
    
    return new Promise((resolve, reject) => {
        const callbackName = `vworld_callback_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        const script = document.createElement('script');
        
        // JSONP 콜백 함수 등록
        window[callbackName] = function(data) {
            console.log('📡 JSONP 응답 수신:', data);
            
            try {
                if (data.response && data.response.status === 'OK' && data.response.result) {
                    const features = data.response.result.featureCollection?.features;
                    
                    if (features && features.length > 0) {
                        console.log(`🎊 JSONP로 실제 필지 데이터 획득! ${features.length}개`);
                        
                        const parcel = features[0];
                        displayParcelInfo(parcel);
                        const polygon = drawParcelPolygon(parcel, true);
                        toggleParcelSelection(parcel, polygon);
                        
                        resolve(parcel);
                    } else {
                        console.log('📭 JSONP: 빈 결과');
                        resolve(null);
                    }
                } else {
                    console.warn('⚠️ JSONP: 예상하지 못한 응답');
                    resolve(null);
                }
            } finally {
                // 정리
                document.head.removeChild(script);
                delete window[callbackName];
            }
        };
        
        // JSONP 요청 URL 생성 (HTTPS 사용으로 Mixed Content 해결)
        const url = `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=LP_PA_CBND_BUBUN&key=${apiKey}&geometry=true&geomFilter=POINT(${lng} ${lat})&size=10&format=json&crs=EPSG:4326&callback=${callbackName}`;
        
        script.src = url;
        script.onerror = () => {
            console.error('💥 JSONP 요청 실패');
            document.head.removeChild(script);
            delete window[callbackName];
            resolve(null);
        };
        
        document.head.appendChild(script);
        
        // 10초 타임아웃
        setTimeout(() => {
            if (document.head.contains(script)) {
                console.warn('⏱️ JSONP 타임아웃');
                document.head.removeChild(script);
                delete window[callbackName];
                resolve(null);
            }
        }, 10000);
    });
}




// VWorld API로 영역 내 실제 필지 폴리곤 데이터 로드
async function loadParcelsInBounds(bounds) {
    // 검색 모드에서는 자동으로 필지를 로드하지 않음
    if (window.currentMode === 'search') {
        console.log('🔍 검색 모드에서는 자동 필지 로드를 건너뜁니다.');
        return;
    }
    
    console.log('🏘️ VWorld API로 영역 내 실제 필지 데이터 로드 시작');
    
    const ne = bounds.getNE();
    const sw = bounds.getSW();
    
    // 경계 박스 생성 (서남쪽 경도, 서남쪽 위도, 동북쪽 경도, 동북쪽 위도)
    const bbox = `${sw.lng()},${sw.lat()},${ne.lng()},${ne.lat()}`;
    console.log('🗺️ 검색 영역 (BBOX):', bbox);
    
    // 🎯 ULTRATHINK: CONFIG 안전 체크 및 fallback 시스템 (영역 로드용)
    console.log('🔧 CONFIG 객체 상태 확인 (영역 로드):', {
        CONFIG_EXISTS: typeof CONFIG !== 'undefined',
        VWORLD_API_KEYS_EXISTS: typeof CONFIG !== 'undefined' && CONFIG.VWORLD_API_KEYS,
        KEYS_LENGTH: typeof CONFIG !== 'undefined' && CONFIG.VWORLD_API_KEYS ? CONFIG.VWORLD_API_KEYS.length : 0
    });
    
    // Config에서 API 키 가져오기 + 안전한 fallback
    const apiKeys = (typeof CONFIG !== 'undefined' && CONFIG.VWORLD_API_KEYS && CONFIG.VWORLD_API_KEYS.length > 0) 
        ? CONFIG.VWORLD_API_KEYS 
        : [
            // ULTRATHINK Fallback 키들 (CONFIG 로드 실패 시)
            '0A0DFD5D-0266-3FAB-8766-06E821646AF7',
            'BBAC532E-A56D-34CF-B520-CE68E8D6D52A',
            'E5B1657B-9B6F-3A4B-91EF-98512BE931A1',
            '8C62256B-1D08-32FF-AB3C-1FCD67242196',
            '6B854F88-4A5D-303C-B7C8-40858117A95E'
        ];
    
    console.log(`🔑 ULTRATHINK 영역 로드: ${apiKeys.length}개 API 키 준비됨 (Config: ${typeof CONFIG !== 'undefined' && CONFIG.VWORLD_API_KEYS ? '성공' : 'Fallback 사용'})`);
    
    if (!apiKeys || apiKeys.length === 0) {
        console.error('❌ ULTRATHINK 영역 로드: API 키를 전혀 로드할 수 없습니다!');
        return;
    }
    
    // CORS 우회를 위해 JSONP를 우선적으로 시도
    for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
        const apiKey = apiKeys[keyIndex];
        console.log(`🔑 JSONP 폴리곤 우선 시도 - API 키 ${keyIndex+1}/${apiKeys.length}: ${apiKey.substring(0, 8)}...`);
        
        const result = await loadParcelsInBoundsViaJSONP(bounds, apiKey);
        if (result > 0) {
            console.log(`🎊 JSONP로 실제 폴리곤 데이터 획득 성공! ${result}개 필지`);
            return; // 성공 시 함수 종료
        }
        
        console.log(`⚠️ JSONP 폴리곤 API 키 ${keyIndex+1} 실패, 다음 키로 시도...`);
    }
    
    // JSONP가 모든 키로 실패한 경우 메시지 출력
    console.log('⚠️ 모든 API 키로 필지 데이터를 가져오지 못했습니다.');
    console.log('💡 VWorld API는 CORS 정책으로 인해 JSONP만 지원합니다.');
}

// JSONP 방식으로 VWorld API 폴리곤 로드
async function loadParcelsInBoundsViaJSONP(bounds, apiKey) {
    console.log('🌐 JSONP 방식으로 VWorld 폴리곤 API 재시도...');
    
    const ne = bounds.getNE();
    const sw = bounds.getSW();
    const bbox = `${sw.lng()},${sw.lat()},${ne.lng()},${ne.lat()}`;
    
    return new Promise((resolve) => {
        const callbackName = `vworld_polygon_callback_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        const script = document.createElement('script');
        
        // JSONP 콜백 함수 등록
        window[callbackName] = function(data) {
            console.log('📡 폴리곤 JSONP 응답 수신:', data);
            
            try {
                if (data.response && data.response.status === 'OK' && data.response.result) {
                    const features = data.response.result.featureCollection?.features;
                    
                    if (features && features.length > 0) {
                        console.log(`🎊 JSONP로 실제 폴리곤 데이터 획득! ${features.length}개`);
                        
                        let loadedCount = 0;
                        features.forEach((feature, index) => {
                            const pnu = feature.properties?.PNU || feature.properties?.pnu || `UNKNOWN_${index}`;
                            
                            if (!window.clickParcels.has(pnu)) {
                                try {
                                    const polygon = drawParcelPolygon(feature, false);
                                    if (polygon) {
                                        loadedCount++;
                                        console.log(`✅ JSONP 폴리곤 그리기: ${feature.properties?.JIBUN || pnu}`);
                                    }
                                } catch (drawError) {
                                    console.warn(`⚠️ JSONP 필지 ${pnu} 그리기 실패:`, drawError);
                                }
                            }
                        });
                        
                        console.log(`🎉 JSONP 폴리곤 로드 완료: ${loadedCount}개`);
                        resolve(loadedCount);
                        
                    } else {
                        console.log('📭 JSONP: 빈 폴리곤 결과');
                        resolve(0);
                    }
                } else {
                    console.warn('⚠️ JSONP: 예상하지 못한 폴리곤 응답');
                    resolve(0);
                }
            } finally {
                // 정리
                document.head.removeChild(script);
                delete window[callbackName];
            }
        };
        
        // JSONP 요청 URL 생성
        const url = `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=LP_PA_CBND_BUBUN&key=${apiKey}&geometry=true&geomFilter=BOX(${bbox})&size=100&format=json&crs=EPSG:4326&callback=${callbackName}`;
        
        script.src = url;
        script.onerror = () => {
            console.error('💥 JSONP 폴리곤 요청 실패');
            document.head.removeChild(script);
            delete window[callbackName];
            resolve(0);
        };
        
        document.head.appendChild(script);
        
        // 15초 타임아웃 (폴리곤 데이터는 더 클 수 있음)
        setTimeout(() => {
            if (document.head.contains(script)) {
                console.warn('⏱️ JSONP 폴리곤 타임아웃');
                document.head.removeChild(script);
                delete window[callbackName];
                resolve(0);
            }
        }, 15000);
    });
}


// 필지 폴리곤 그리기
function drawParcelPolygon(parcel, isSelected = false) {
    const geometry = parcel.geometry;
    const properties = parcel.properties;
    const pnu = properties.PNU || properties.pnu;
    const jibun = formatJibun(properties);
    
    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
        const paths = [];
        const coordinates = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
        
        coordinates.forEach(polygon => {
            polygon[0].forEach(coord => {
                paths.push(new naver.maps.LatLng(coord[1], coord[0]));
            });
        });
        
        // 저장된 필지 정보 확인 (PNU와 지번 둘 다 확인)
        let savedParcel = getSavedParcelData(pnu);
        if (!savedParcel && jibun) {
            savedParcel = getSavedParcelDataByJibun(jibun);
        }
        
        const fillColor = savedParcel && savedParcel.color ? savedParcel.color : 'transparent';
        const fillOpacity = savedParcel && savedParcel.color && savedParcel.color !== 'transparent' ? 0.5 : 0;
        
        const polygon = new naver.maps.Polygon({
            map: map,
            paths: paths,
            fillColor: fillColor,
            fillOpacity: fillOpacity,
            strokeColor: isSelected ? '#FF0000' : '#0000FF',
            strokeOpacity: 0.6,
            strokeWeight: isSelected ? 1.5 : 0.5,
            clickable: true
        });
        
        // 클릭 이벤트
        naver.maps.Event.addListener(polygon, 'click', function(e) {
            e.domEvent.stopPropagation(); // 지도 클릭 이벤트 방지
            toggleParcelSelection(parcel, polygon);
        });
        
        // 필지 저장
        window.clickParcels.set(pnu, {
            polygon: polygon,
            data: parcel,
            color: fillColor
        });
        
        return polygon; // 폴리곤 객체 반환
    }
}

// 필지 선택/해제 토글
function toggleParcelSelection(parcel, polygon) {
    const pnu = parcel.properties.PNU || parcel.properties.pnu;
    const parcelData = window.clickParcels.get(pnu);
    const searchParcelData = window.searchParcels && window.searchParcels.get(pnu);
    const jibun = formatJibun(parcel.properties);
    
    // 보라색(검색 필지) 확인 - clickParcels 또는 searchParcels에서 확인
    const isSearchParcel = (parcelData && parcelData.color === '#9370DB') || 
                           (searchParcelData && searchParcelData.color === '#9370DB');
    if (isSearchParcel) {
        console.log('🟣 검색 필지(보라색) 클릭 - 색상 복사 방지');
        // 폼에 정보만 표시하고 색상은 변경하지 않음
        document.getElementById('parcelNumber').value = jibun;
        window.currentSelectedPNU = pnu;
        
        // 저장된 정보가 있으면 로드
        const savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
        const savedInfo = savedData.find(item => 
            (item.pnu && item.pnu === pnu) || 
            item.parcelNumber === jibun
        );
        
        if (savedInfo) {
            document.getElementById('ownerName').value = savedInfo.ownerName || '';
            document.getElementById('ownerAddress').value = savedInfo.ownerAddress || '';
            document.getElementById('ownerContact').value = savedInfo.ownerContact || '';
            document.getElementById('memo').value = savedInfo.memo || '';
        } else {
            document.getElementById('ownerName').value = '';
            document.getElementById('ownerAddress').value = '';
            document.getElementById('ownerContact').value = '';
            document.getElementById('memo').value = '';
        }
        
        return; // 보라색 필지는 여기서 종료
    }
    
    // 저장된 정보 확인
    const savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
    const savedInfo = savedData.find(item => 
        (item.pnu && item.pnu === pnu) || 
        item.parcelNumber === jibun
    );
    
    // 저장된 정보가 있는지와 실제 데이터가 있는지 확인
    const hasActualData = savedInfo && (
        (savedInfo.ownerName && savedInfo.ownerName.trim() !== '') ||
        (savedInfo.ownerAddress && savedInfo.ownerAddress.trim() !== '') ||
        (savedInfo.ownerContact && savedInfo.ownerContact.trim() !== '') ||
        (savedInfo.memo && savedInfo.memo.trim() !== '')
    );
    
    // 저장된 실제 정보가 있으면 폼에 로드만 하고 색상은 유지
    if (hasActualData) {
        console.log('저장된 정보가 있는 필지 클릭 - 정보 로드, 색상 보호');
        
        // 폼에 정보 로드
        window.currentSelectedPNU = pnu;
        document.getElementById('parcelNumber').value = savedInfo.parcelNumber || '';
        document.getElementById('ownerName').value = savedInfo.ownerName || '';
        document.getElementById('ownerAddress').value = savedInfo.ownerAddress || '';
        document.getElementById('ownerContact').value = savedInfo.ownerContact || '';
        document.getElementById('memo').value = savedInfo.memo || '';
        
        // 색상은 변경하지 않음
        if (savedInfo.color && savedInfo.color !== 'transparent') {
            // 보라색(검색 필지)이 아닐 때만 현재 색상 업데이트
            if (savedInfo.color !== '#9370DB') {
                currentColor = savedInfo.color;
                document.getElementById('currentColor').style.background = currentColor;
            }
            
            // 색상 팔레트에서 해당 색상 선택
            document.querySelectorAll('.color-item').forEach(item => {
                item.classList.remove('active');
                if (item.dataset.color === currentColor) {
                    item.classList.add('active');
                }
            });
        }
        
        return; // 색상 변경 없이 종료
    }
    
    // 저장된 정보가 없거나 빈 정보만 있는 경우
    // 이미 색칠되어 있는지 확인
    if (parcelData && parcelData.color !== 'transparent') {
        // 두 번 클릭 시 색상 제거 (정보가 없는 경우에만)
        console.log('정보 없는 필지 - 색상 제거');
        clearParcel(parcel, polygon);
        
        // 저장된 데이터에서도 제거
        if (savedInfo && !hasActualData) {
            const updatedData = savedData.filter(item => 
                !((item.pnu && item.pnu === pnu) || item.parcelNumber === jibun)
            );
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(updatedData));
        }
    } else {
        // 색칠되어 있지 않으면 선택 및 색칠
        console.log('새로운 필지 색칠:', currentColor);
        selectParcel(parcel, polygon);
        applyColorToParcel(parcel, currentColor);
    }
}

// 필지 색상 및 정보 제거
function clearParcel(parcel, polygon) {
    const pnu = parcel.properties.PNU || parcel.properties.pnu;
    const parcelData = window.clickParcels.get(pnu);
    const jibun = formatJibun(parcel.properties);
    
    if (parcelData) {
        // 폴리곤 색상 및 테두리 완전히 초기화
        polygon.setOptions({
            fillColor: 'transparent',
            fillOpacity: 0,
            strokeColor: '#0000FF',
            strokeOpacity: 0.6,
            strokeWeight: 0.5
        });
        parcelData.color = 'transparent';
        
        // LocalStorage에서 제거 (pnu와 parcelNumber 둘 다 확인)
        let savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
        savedData = savedData.filter(item => item.pnu !== pnu && item.parcelNumber !== jibun);
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(savedData));
        console.log('색상 정보 제거됨:', pnu, jibun);
        
        // 폼 초기화
        document.getElementById('parcelNumber').value = '';
        document.getElementById('ownerName').value = '';
        document.getElementById('ownerAddress').value = '';
        document.getElementById('ownerContact').value = '';
        document.getElementById('memo').value = '';
    }
}

// 필지 선택
function selectParcel(parcel, polygon) {
    const properties = parcel.properties;
    console.log('필지 속성:', properties); // 디버깅용
    
    // 검색 모드가 아닐 때만 currentSelectedPNU 업데이트
    // (검색 모드에서는 search.js에서 설정한 PNU 유지)
    if (window.currentMode !== 'search') {
        window.currentSelectedPNU = properties.PNU || properties.pnu;
    }
    
    // 지번 포맷팅 (utils.js 함수 사용)
    const jibun = formatJibun(properties);
    
    // 지번만 자동 입력, 나머지는 공란
    document.getElementById('parcelNumber').value = jibun;
    document.getElementById('ownerName').value = '';
    document.getElementById('ownerAddress').value = '';
    document.getElementById('ownerContact').value = '';
    document.getElementById('memo').value = '';
    
    // 폴리곤 강조
    if (polygon) {
        polygon.setOptions({
            strokeColor: '#FF0000',
            strokeWeight: 1.5
        });
    }
}

// 필지에 색상 적용
function applyColorToParcel(parcel, color) {
    const pnu = parcel.properties.PNU || parcel.properties.pnu;
    const parcelData = window.clickParcels.get(pnu);
    
    if (parcelData) {
        parcelData.polygon.setOptions({
            fillColor: color,
            fillOpacity: 0.5
        });
        parcelData.color = color;
        
        console.log('필지 색상 적용됨 (저장 안됨):', pnu, color);
        
        // 주의: localStorage 저장은 saveParcelData() 함수에서만 수행
        // 클릭만으로는 임시 색상만 적용되고, 저장 버튼을 눌러야 실제 저장됨
    }
}

// 필지 정보 표시
function displayParcelInfo(parcel) {
    const properties = parcel.properties;
    console.log('필지 전체 정보:', properties);
    
    // 디버깅용 - VWorld API 필드 확인
    console.log('🔍 VWorld API 필드 확인:');
    console.log('  - PNU:', properties.PNU || properties.pnu);
    console.log('  - NU_NM:', properties.NU_NM || properties.nu_nm);
    console.log('  - JIBUN:', properties.JIBUN || properties.jibun);
    console.log('  - BONBUN:', properties.BONBUN || properties.bonbun);
    console.log('  - BUBUN:', properties.BUBUN || properties.bubun);
    console.log('  - ADDR:', properties.ADDR || properties.addr);
    console.log('  - SAN:', properties.SAN || properties.san);
    console.log('  - 모든 필드:', Object.keys(properties));
    
    // 검색 모드가 아닐 때만 currentSelectedPNU 업데이트
    // (검색 모드에서는 search.js에서 설정한 PNU 유지)
    if (window.currentMode !== 'search') {
        window.currentSelectedPNU = properties.PNU || properties.pnu;
    }
    
    // 지번 포맷팅 (utils.js 함수 사용)
    const jibun = formatJibun(properties);
    console.log('📝 포맷된 지번:', jibun);
    
    // 폼에 정보 표시
    if (jibun) {
        document.getElementById('parcelNumber').value = jibun;
    }
}

// 필지 데이터 저장 (실시간 동기화 적용)
async function saveParcelData() {
    const parcelNumber = document.getElementById('parcelNumber').value;
    
    if (!parcelNumber) {
        alert('지번을 입력해주세요.');
        return;
    }
    
    // 현재 선택된 필지의 PNU 사용 (전역 변수에서 가져오기)
    let currentPNU = window.currentSelectedPNU;
    let geometry = null;
    let isSearchParcel = false; // 검색 필지인지 표시
    
    // currentSelectedPNU가 있으면 우선 사용
    if (currentPNU) {
        // PNU가 있으면 해당 필지의 geometry 가져오기 (검색 모드에서는 searchParcels 우선)
        console.log('🔍 currentPNU로 필지 검색:', currentPNU);
        console.log('   현재 모드:', window.currentMode);
        
        // 검색 모드일 때는 searchParcels를 먼저 확인
        if (window.currentMode === 'search') {
            console.log('   searchParcels Map 크기:', window.searchParcels.size);
            console.log('   searchParcels 키들:', Array.from(window.searchParcels.keys()));
            let parcelData = window.searchParcels.get(currentPNU);
            console.log('   searchParcels.get(' + currentPNU + ') 결과:', !!parcelData, parcelData);
            
            if (parcelData) {
                geometry = parcelData.data ? parcelData.data.geometry : parcelData.geometry;
                isSearchParcel = true;
                console.log('   ✅ searchParcels에서 찾음');
            }
        }
        
        // 못 찾았으면 clickParcels 확인
        if (!geometry) {
            let parcelData = window.clickParcels.get(currentPNU);
            console.log('   clickParcels에서 검색 결과:', !!parcelData);
            
            if (parcelData && parcelData.data) {
                geometry = parcelData.data.geometry;
                console.log('   ✅ clickParcels에서 찾음');
            }
        }
        
        console.log('   최종 isSearchParcel:', isSearchParcel);
    } else {
        // currentSelectedPNU가 없으면 지번으로 검색 (fallback)
        console.log('⚠️ currentSelectedPNU가 없음, 지번으로 검색 시도');
        
        // 검색 모드일 때는 searchParcels 우선
        if (window.currentMode === 'search') {
            window.searchParcels.forEach((parcelData, pnu) => {
                const jibun = formatJibun(parcelData.data?.properties || {});
                if (jibun === parcelNumber && !currentPNU) {
                    currentPNU = pnu;
                    geometry = parcelData.data ? parcelData.data.geometry : parcelData.geometry;
                    isSearchParcel = true;
                }
            });
        }
        
        // 못 찾았으면 clickParcels 확인
        if (!currentPNU) {
            window.clickParcels.forEach((parcelData, pnu) => {
                const jibun = formatJibun(parcelData.data?.properties || {});
                if (jibun === parcelNumber) {
                    currentPNU = pnu;
                    geometry = parcelData.data?.geometry;
                }
            });
        }
    }
    
    const formData = {
        parcelNumber: parcelNumber,
        pnu: currentPNU, // PNU 추가
        ownerName: document.getElementById('ownerName').value,
        ownerAddress: document.getElementById('ownerAddress').value,
        ownerContact: document.getElementById('ownerContact').value,
        memo: document.getElementById('memo').value,
        color: isSearchParcel ? '#9370DB' : currentColor, // 검색 필지는 보라색
        geometry: geometry, // geometry 정보 저장
        timestamp: new Date().toISOString(),
        isSearchParcel: isSearchParcel // 검색 필지 여부 저장
    };
    
    // 실시간 동기화를 통한 저장 (localStorage + Supabase)
    let savedData = [];
    let syncResult = { local: false, cloud: false };
    
    try {
        if (window.dataManager) {
            // DataManager를 통한 하이브리드 저장
            savedData = window.dataManager.loadLocal();
        } else {
            // 백업으로 기존 방식 사용
            savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
        }
        
        // 기존 데이터 업데이트 또는 추가 (PNU와 parcelNumber 둘 다 확인)
        const existingIndex = savedData.findIndex(item => 
            (item.pnu && item.pnu === currentPNU) || 
            item.parcelNumber === formData.parcelNumber
        );
        
        if (existingIndex > -1) {
            savedData[existingIndex] = formData;
            console.log(`🔄 기존 필지 업데이트: ${formData.parcelNumber} (${currentPNU})`);
        } else {
            savedData.push(formData);
            console.log(`🆕 새 필지 추가: ${formData.parcelNumber} (${currentPNU})`);
        }
        
        if (window.dataManager) {
            // 실시간 동기화 저장
            syncResult = await window.dataManager.save(savedData);
            console.log('🔄 실시간 동기화 저장 결과:', syncResult);
            
            if (syncResult.errors && syncResult.errors.length > 0) {
                console.warn('일부 동기화 오류:', syncResult.errors);
            }
        } else {
            // 백업으로 기존 localStorage 저장
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(savedData));
            syncResult.local = true;
        }
        
    } catch (error) {
        console.error('저장 중 오류 발생:', error);
        
        // 오류 시 백업으로 localStorage 저장 (안전한 처리)
        try {
            const rawData = localStorage.getItem(CONFIG.STORAGE_KEY) || '[]';
            savedData = JSON.parse(rawData);
            
            // 배열이 아닌 경우 빈 배열로 초기화
            if (!Array.isArray(savedData)) {
                console.warn('저장된 데이터가 배열이 아닙니다. 초기화합니다:', savedData);
                savedData = [];
            }
            
            const existingIndex = savedData.findIndex(item => 
                item && ( // item null 체크 추가
                    (item.pnu && item.pnu === currentPNU) || 
                    item.parcelNumber === formData.parcelNumber
                )
            );
            
            if (existingIndex > -1) {
                savedData[existingIndex] = formData;
            } else {
                savedData.push(formData);
            }
            
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(savedData));
            syncResult.local = true;
            console.log('백업 저장 완료');
        } catch (backupError) {
            console.error('백업 저장도 실패:', backupError);
            alert('저장에 실패했습니다. 다시 시도해주세요.');
            return;
        }
    }
    
    // Map에도 업데이트 (검색 필지인지 클릭 필지인지에 따라 다른 Map 사용)
    const targetMap = isSearchParcel ? window.searchParcels : window.clickParcels;
    const parcelData = targetMap.get(currentPNU);
    
    if (parcelData) {
        // Map에 저장된 데이터 업데이트
        parcelData.ownerName = formData.ownerName;
        parcelData.ownerAddress = formData.ownerAddress;
        parcelData.ownerContact = formData.ownerContact;
        parcelData.memo = formData.memo;
        parcelData.color = formData.color;
        parcelData.savedInfo = formData;
        
        console.log(`✅ ${isSearchParcel ? '검색' : '클릭'} 필지 Map 업데이트 완료:`, parcelData);
        
        // 폴리곤 색상 업데이트 (검색 필지는 보라색 유지)
        if (parcelData.polygon) {
            parcelData.polygon.setOptions({
                fillColor: formData.color,
                fillOpacity: isSearchParcel ? 0.7 : 0.5,
                strokeColor: formData.color
            });
        }
        
        // 검색 필지의 경우 현재 모드가 search일 때만 표시
        if (isSearchParcel && parcelData.polygon) {
            parcelData.polygon.setMap(window.currentMode === 'search' ? map : null);
        }
        
        console.log(`${isSearchParcel ? '검색' : '클릭'} 필지 Map 업데이트 완료:`, currentPNU, formData);
    }
    
    // 목록 업데이트
    updateParcelList();
    
    // 우측 필지 관리자 목록도 업데이트
    if (window.parcelManager) {
        // loadParcels를 호출하여 최신 데이터를 로드
        window.parcelManager.loadParcels();
        window.parcelManager.applyFilters();
        window.parcelManager.render();
    }
    
    // 또는 refreshParcelList 이벤트 발생
    window.dispatchEvent(new Event('refreshParcelList'));
    
    // 저장 후 폼 초기화 (지번은 유지)
    const savedParcelNumber = document.getElementById('parcelNumber').value;
    document.getElementById('ownerName').value = '';
    document.getElementById('ownerAddress').value = '';
    document.getElementById('ownerContact').value = '';
    document.getElementById('memo').value = '';
    
    // 지번은 검색 결과를 유지하기 위해 그대로 둠
    console.log('✅ 저장 완료 - 폼 초기화 (지번 유지):', savedParcelNumber);
    
    // 동기화 상태에 따른 메시지
    let message = '저장되었습니다.';
    if (syncResult.local && syncResult.cloud) {
        message = '저장 완료! 클라우드에도 자동 동기화되었습니다. 🌐';
    } else if (syncResult.local) {
        message = '로컬에 저장되었습니다. 클라우드 동기화는 자동으로 진행됩니다. ⏳';
    }
    
    alert(message);
    
    // 🎯 ULTRATHINK: 저장 후 실시간 ParcelManager 동기화
    console.log('🔄 저장 완료 - ParcelManager 실시간 갱신 시작...');
    
    try {
        // 1. ParcelManager가 존재하면 즉시 갱신
        if (window.parcelManager && typeof window.parcelManager.loadParcels === 'function') {
            console.log('📋 ParcelManager 데이터 재로드...');
            window.parcelManager.loadParcels();
            
            console.log('📊 ParcelManager 통계 업데이트...');
            window.parcelManager.updateStatisticsOnly();
            
            console.log('🖼️ ParcelManager 화면 렌더링...');
            window.parcelManager.render();
            
            console.log('✅ ParcelManager 실시간 갱신 완료!');
        } else {
            console.warn('⚠️ ParcelManager를 찾을 수 없음 - 수동 새로고침 필요');
        }
        
        // 2. 전역 이벤트 발생 (다른 컴포넌트들도 갱신 가능)
        window.dispatchEvent(new CustomEvent('parcelDataSaved', {
            detail: { 
                parcelNumber: savedParcelNumber,
                syncResult: syncResult,
                timestamp: new Date().toISOString()
            }
        }));
        console.log('📡 parcelDataSaved 이벤트 발생');
        
    } catch (error) {
        console.error('❌ 실시간 갱신 중 오류:', error);
        console.log('💡 수동 새로고침을 권장합니다');
    }
}

// 저장된 필지 데이터 가져오기
function getSavedParcelData(pnu) {
    const savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
    // PNU로 찾기
    return savedData.find(item => item.pnu === pnu);
}

// 지번으로 저장된 필지 데이터 가져오기
function getSavedParcelDataByJibun(jibun) {
    const savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
    return savedData.find(item => item.parcelNumber === jibun);
}

// 필지에 메모가 있는지 확인
function hasParcelMemo(parcel) {
    const pnu = parcel.properties.PNU || parcel.properties.pnu;
    const jibun = formatJibun(parcel.properties);
    const savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
    // PNU 또는 지번으로 찾기
    const parcelInfo = savedData.find(item => 
        (item.pnu && item.pnu === pnu) || 
        item.parcelNumber === jibun
    );
    return parcelInfo && parcelInfo.memo && parcelInfo.memo.trim() !== '';
}

// 필지에 저장된 정보가 있는지 확인 (소유자명, 주소, 연락처, 메모 중 하나라도)
function hasParcelInfo(parcel) {
    const pnu = parcel.properties.PNU || parcel.properties.pnu;
    const jibun = formatJibun(parcel.properties);
    const savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
    // PNU 또는 지번으로 찾기
    const parcelInfo = savedData.find(item => 
        (item.pnu && item.pnu === pnu) || 
        item.parcelNumber === jibun
    );
    
    if (!parcelInfo) return false;
    
    // 정보 중 하나라도 있으면 true
    return (parcelInfo.ownerName && parcelInfo.ownerName.trim() !== '') ||
           (parcelInfo.ownerAddress && parcelInfo.ownerAddress.trim() !== '') ||
           (parcelInfo.ownerContact && parcelInfo.ownerContact.trim() !== '') ||
           (parcelInfo.memo && parcelInfo.memo.trim() !== '');
}

// 필지 정보를 폼에 로드
function loadParcelInfoToForm(parcel) {
    const pnu = parcel.properties.PNU || parcel.properties.pnu;
    const jibun = formatJibun(parcel.properties);
    
    // 현재 선택된 PNU 업데이트
    window.currentSelectedPNU = pnu;
    
    const savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
    // PNU 또는 지번으로 찾기
    const parcelInfo = savedData.find(item => 
        (item.pnu && item.pnu === pnu) || 
        item.parcelNumber === jibun
    );
    
    if (parcelInfo) {
        document.getElementById('parcelNumber').value = parcelInfo.parcelNumber || '';
        document.getElementById('ownerName').value = parcelInfo.ownerName || '';
        document.getElementById('ownerAddress').value = parcelInfo.ownerAddress || '';
        document.getElementById('ownerContact').value = parcelInfo.ownerContact || '';
        document.getElementById('memo').value = parcelInfo.memo || '';
        
        if (parcelInfo.color) {
            // 보라색(검색 필지)이 아닐 때만 현재 색상 업데이트
            if (parcelInfo.color !== '#9370DB') {
                currentColor = parcelInfo.color;
                document.getElementById('currentColor').style.background = currentColor;
                
                // 색상 팔레트에서 해당 색상 선택
                document.querySelectorAll('.color-item').forEach(item => {
                    item.classList.remove('active');
                    if (item.dataset.color === currentColor) {
                        item.classList.add('active');
                    }
                });
            }
        }
    }
}

// 저장된 필지 목록 업데이트
function updateParcelList() {
    const savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
    const container = document.getElementById('parcelListContainer');
    
    // DOM 요소가 없으면 건너뛰기
    if (!container) {
        console.log('parcelListContainer not found, skipping update');
        return;
    }
    
    container.innerHTML = '';
    
    savedData.forEach(item => {
        const div = document.createElement('div');
        div.className = 'parcel-item';
        div.innerHTML = `
            <div class="parcel-item-header">
                <span class="parcel-item-number">${item.parcelNumber}</span>
                <div class="parcel-item-color" style="background: ${item.color}"></div>
            </div>
            <div class="parcel-item-info">
                ${item.ownerName ? `소유자: ${item.ownerName}` : ''}
                ${item.ownerContact ? `<br>연락처: ${item.ownerContact}` : ''}
            </div>
        `;
        
        div.addEventListener('click', () => {
            loadParcelToForm(item);
        });
        
        container.appendChild(div);
    });
}

// 필지 정보를 폼에 로드
function loadParcelToForm(data) {
    document.getElementById('parcelNumber').value = data.parcelNumber || '';
    document.getElementById('ownerName').value = data.ownerName || '';
    document.getElementById('ownerAddress').value = data.ownerAddress || '';
    document.getElementById('ownerContact').value = data.ownerContact || '';
    document.getElementById('memo').value = data.memo || '';
    
    // 보라색(검색 필지)이 아닐 때만 현재 색상 업데이트
    if (data.color !== '#9370DB') {
        currentColor = data.color;
        document.getElementById('currentColor').style.background = currentColor;
    }
}

// 저장된 필지 불러오기
function loadSavedParcels() {
    const savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
    updateParcelList();
    
    // 현재 화면에 보이는 영역의 필지들에 색상 복원
    restoreSavedParcelsOnMap();
}

// 지도에 저장된 필지 색상 복원
function restoreSavedParcelsOnMap() {
    const savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
    console.log(`저장된 필지 ${savedData.length}개 복원 시작`);
    
    // 저장된 데이터 중 geometry가 있는 항목들 처리
    savedData.forEach(saved => {
        if (saved.geometry && saved.color && saved.color !== 'transparent') {
            // 검색 필지인지 클릭 필지인지 구분
            const targetMap = saved.isSearchParcel ? window.searchParcels : window.clickParcels;
            
            // 해당 Map에 이미 있는지 확인
            const existingParcel = targetMap.get(saved.pnu);
            
            if (existingParcel && existingParcel.polygon) {
                // 이미 있으면 색상만 변경
                existingParcel.polygon.setOptions({
                    fillColor: saved.color,
                    fillOpacity: saved.isSearchParcel ? 0.7 : 0.5  // 검색 필지는 더 진하게
                });
                existingParcel.color = saved.color;
                console.log(`기존 ${saved.isSearchParcel ? '검색' : '클릭'} 필지 색상 복원: ${saved.parcelNumber} - ${saved.color}`);
            } else if (saved.geometry) {
                // 없으면 폴리곤 생성
                const parcelData = {
                    geometry: saved.geometry,
                    properties: {
                        PNU: saved.pnu,
                        jibun: saved.parcelNumber
                    }
                };
                
                // 검색 필지인 경우 searchParcels에, 클릭 필지인 경우 clickParcels에 추가
                if (saved.isSearchParcel) {
                    // searchParcels에 추가 (보라색으로)
                    const polygonOptions = {
                        fillColor: '#9370DB',
                        fillOpacity: 0.7,
                        strokeColor: '#9370DB',
                        strokeOpacity: 0.8,
                        strokeWeight: 2
                    };
                    
                    // 폴리곤 생성 로직 (drawParcelPolygon 대신 직접 구현)
                    const coords = parcelData.geometry.coordinates[0].map(coord => 
                        new naver.maps.LatLng(coord[1], coord[0])
                    );
                    
                    const polygon = new naver.maps.Polygon({
                        map: window.currentMode === 'search' ? map : null,
                        paths: coords,
                        ...polygonOptions
                    });
                    
                    targetMap.set(saved.pnu, {
                        polygon: polygon,
                        data: parcelData,
                        color: '#9370DB'
                    });
                    
                    console.log(`새 검색 필지 생성 및 색상 복원: ${saved.parcelNumber} - #9370DB`);
                } else {
                    // 폴리곤 그리기 (클릭 필지)
                    drawParcelPolygon(parcelData, false);
                    
                    // 색상 적용
                    const newParcel = window.clickParcels.get(saved.pnu);
                    if (newParcel && newParcel.polygon) {
                        newParcel.polygon.setOptions({
                            fillColor: saved.color,
                            fillOpacity: 0.5
                        });
                        newParcel.color = saved.color;
                        console.log(`새 클릭 필지 생성 및 색상 복원: ${saved.parcelNumber} - ${saved.color}`);
                    }
                }
            }
        }
    });
    
    // 현재 지도에 표시된 필지들도 확인
    window.clickParcels.forEach((parcelData, pnu) => {
        if (!parcelData.color || parcelData.color === 'transparent') {
            const jibun = formatJibun(parcelData.data.properties);
            
            // 저장된 데이터에서 해당 필지 찾기
            const saved = savedData.find(item => 
                (item.pnu && item.pnu === pnu) || 
                (item.parcelNumber && item.parcelNumber === jibun)
            );
            
            if (saved && saved.color && saved.color !== 'transparent') {
                // 색상 복원
                if (parcelData.polygon) {
                    parcelData.polygon.setOptions({
                        fillColor: saved.color,
                        fillOpacity: 0.5
                    });
                    parcelData.color = saved.color;
                    console.log(`추가 색상 복원: ${jibun} - ${saved.color}`);
                }
            }
        }
    });
}

// 선택 필지 색상 초기화
function clearSelectedParcelsColors() {
    let clearedCount = 0;
    
    window.clickParcels.forEach((parcelData, pnu) => {
        // 사용자가 색칠한 필지만 초기화 (8가지 색상 중 하나)
        if (parcelData.polygon && parcelData.color !== 'transparent' && parcelData.color !== '#FFFF00') {
            // 저장된 정보가 있는 필지는 건너뛰기
            const savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
            const hasInfo = savedData.some(item => {
                if (item.pnu !== pnu && (!item.parcelNumber || item.parcelNumber !== parcelData.data?.properties?.jibun)) {
                    return false;
                }
                return (item.ownerName && item.ownerName.trim() !== '') ||
                       (item.ownerAddress && item.ownerAddress.trim() !== '') ||
                       (item.ownerContact && item.ownerContact.trim() !== '') ||
                       (item.memo && item.memo.trim() !== '');
            });
            
            if (hasInfo) {
                console.log('정보가 있는 필지 보호:', pnu);
                return;
            }
            
            // 폴리곤 색상 제거
            parcelData.polygon.setOptions({
                fillColor: 'transparent',
                fillOpacity: 0,
                strokeColor: '#0000FF',
                strokeWeight: 0.5
            });
            parcelData.color = 'transparent';
            clearedCount++;
        }
    });
    
    if (clearedCount > 0) {
        // 폼 초기화
        document.getElementById('parcelForm').reset();
        alert(`${clearedCount}개의 선택 필지가 초기화되었습니다.`);
    } else {
        alert('초기화할 선택 필지가 없습니다.');
    }
}

// 모든 필지 색상 초기화 (선택 + 검색)
function clearAllParcelsColors() {
    // confirm은 utils.js에서 이미 처리됨
    let clearedCount = 0;
    
    // 선택 필지 초기화 (저장된 정보가 있어도 강제로 초기화)
    window.clickParcels.forEach((parcelData, pnu) => {
        if (parcelData.polygon && parcelData.color !== 'transparent') {
            // 폴리곤 색상 제거
            parcelData.polygon.setOptions({
                fillColor: 'transparent',
                fillOpacity: 0,
                strokeColor: '#0000FF',
                strokeWeight: 0.5
            });
            parcelData.color = 'transparent';
            clearedCount++;
        }
    });
    
    // 검색 필지도 초기화
    if (typeof clearAllSearchResults === 'function') {
        clearAllSearchResults();
    }
    
    // 폼 초기화
    document.getElementById('parcelForm').reset();
    
    console.log(`전체 초기화: ${clearedCount}개 필지 색상 제거`);
    alert('모든 필지가 초기화되었습니다.');
}

// 이벤트 리스너 초기화
function initializeEventListeners() {
    // 색상 선택
    document.querySelectorAll('.color-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.color-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            currentColor = this.dataset.color;
            document.getElementById('currentColor').style.background = currentColor;
        });
    });
    
    // 저장 버튼
    document.getElementById('saveBtn').addEventListener('click', saveParcelData);
    
    // 초기화 버튼
    document.getElementById('clearBtn').addEventListener('click', () => {
        document.getElementById('parcelForm').reset();
    });
    
    // 내보내기 버튼 제거 (필지 관리 시스템으로 이동)
    
    // 초기화 버튼들
    document.getElementById('clearSelectedBtn').addEventListener('click', clearSelectedParcelsColors);
    document.getElementById('clearSearchBtn').addEventListener('click', function() {
        // search.js의 clearAllSearchResults 함수 호출
        if (typeof clearAllSearchResults === 'function') {
            clearAllSearchResults();
        }
    });
    // 중복 이벤트 리스너 제거 - utils.js에서 이미 등록됨
}