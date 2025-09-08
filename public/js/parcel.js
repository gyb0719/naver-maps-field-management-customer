// 필지 관련 기능

// 🎯 ULTRATHINK: 필지 색칠 모드 전역 변수
window.paintModeEnabled = true; // 기본값: 색칠 모드 활성화

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
        showToast('API 설정 오류', 'error');
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
    showToast('필지 정보 없음', 'warning');
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
                        
                        // 🎯 ULTRATHINK: 첫 클릭에서 즉시 색칠 데이터 자동 생성
                        const pnu = parcel.properties.PNU || parcel.properties.pnu;
                        let parcelData = getSavedParcelData(pnu);
                        if (!parcelData && window.paintModeEnabled) {
                            // parcelData가 없으면 즉시 생성하여 첫 클릭부터 바로 색칠 가능
                            parcelData = {
                                pnu: pnu,
                                jibun: formatJibun(parcel.properties),
                                color: currentColor,
                                ownerName: '',
                                ownerAddress: '', 
                                ownerContact: '',
                                memo: ''
                            };
                            console.log('🎨 ULTRATHINK: parcelData 자동 생성으로 첫 클릭부터 즉시 색칠 가능');
                        }
                        
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
    
    // 🎯 ULTRATHINK: 중복 폴리곤 방지 - 기존 폴리곤과 메모 마커 제거
    if (window.clickParcels && window.clickParcels.has(pnu)) {
        const existingParcel = window.clickParcels.get(pnu);
        if (existingParcel.polygon) {
            existingParcel.polygon.setMap(null); // 기존 폴리곤 제거
        }
        if (existingParcel.memoMarker) {
            existingParcel.memoMarker.setMap(null); // 기존 메모 마커 제거
        }
        console.log(`📍 기존 필지 폴리곤 및 메모 마커 제거: ${pnu}`);
    }
    
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
        
        // 🎯 ULTRATHINK: 첫 클릭 즉시 색칠 - 저장된 색상이 없으면 현재 색상으로 즉시 적용
        const fillColor = savedParcel && savedParcel.color ? savedParcel.color : currentColor;
        // 🎯 ULTRATHINK: 무조건 0.7로 완전히 보이게 (투명한 폴리곤 생성 방지)
        const fillOpacity = 0.7;
        
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
        
        // 🎯 ULTRATHINK: 왼쪽 클릭 이벤트 (색칠 전용)
        naver.maps.Event.addListener(polygon, 'click', function(e) {
            e.domEvent.stopPropagation(); // 지도 클릭 이벤트 방지
            handleParcelLeftClick(parcel, polygon);
        });
        
        // 🎯 ULTRATHINK: 오른쪽 클릭 이벤트 (색 지우기 전용)
        naver.maps.Event.addListener(polygon, 'rightclick', function(e) {
            e.domEvent.preventDefault(); // 컨텍스트 메뉴 방지
            e.domEvent.stopPropagation(); // 지도 우클릭 이벤트 방지
            handleParcelRightClick(parcel, polygon);
        });
        
        // 🎯 ULTRATHINK: 메모가 있는 필지에 M 마커 표시 (Marker 사용으로 안정성 개선)
        let memoMarker = null;
        if (savedParcel && savedParcel.memo && savedParcel.memo.trim() !== '') {
            // 폴리곤 중심점 계산
            const bounds = new naver.maps.LatLngBounds();
            paths.forEach(path => bounds.extend(path));
            const center = bounds.getCenter();
            
            // 메모 마커 생성
            memoMarker = new naver.maps.Marker({
                position: center,
                map: map,
                icon: {
                    content: '<div style="background:#FF6B6B;color:white;border:2px solid white;border-radius:50%;width:24px;height:24px;font-size:14px;font-weight:bold;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;">M</div>',
                    anchor: new naver.maps.Point(12, 12)
                }
            });
            
            // 🎯 ULTRATHINK: 메모 마커 클릭 시 왼쪽 폼에 정보 표시
            naver.maps.Event.addListener(memoMarker, 'click', function() {
                // PNU로 저장된 데이터 찾기
                const savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
                const savedInfo = savedData.find(item => 
                    (item.pnu && item.pnu === pnu) || 
                    item.parcelNumber === jibun
                );
                
                if (savedInfo) {
                    // 왼쪽 폼에 모든 정보 채우기
                    document.getElementById('parcelNumber').value = savedInfo.parcelNumber || jibun;
                    document.getElementById('ownerName').value = savedInfo.ownerName || '';
                    document.getElementById('ownerAddress').value = savedInfo.ownerAddress || '';
                    document.getElementById('ownerContact').value = savedInfo.ownerContact || '';
                    document.getElementById('memo').value = savedInfo.memo || '';
                    
                    // 현재 선택된 PNU 설정
                    window.currentSelectedPNU = pnu;
                    
                    // 메모 하이라이트 효과
                    const memoField = document.getElementById('memo');
                    memoField.focus();
                    memoField.style.backgroundColor = '#FFF9C4'; // 연한 노란색 하이라이트
                    
                    setTimeout(() => {
                        memoField.style.backgroundColor = ''; // 원래 색으로 복원
                    }, 2000);
                    
                    showToast('메모 필지 정보 로드됨', 'info');
                    console.log(`📝 메모 마커 클릭: ${savedInfo.memo}`);
                }
            });
        }
        
        // 필지 저장 (메모 마커 포함)
        window.clickParcels.set(pnu, {
            polygon: polygon,
            data: parcel,
            color: fillColor,
            memoMarker: memoMarker // 메모 마커 저장
        });
        
        return polygon; // 폴리곤 객체 반환
    }
}

// 🎯 ULTRATHINK: 왼쪽 클릭 - 색칠 전용 (단순화된 로직)
async function handleParcelLeftClick(parcel, polygon) {
    const pnu = parcel.properties.PNU || parcel.properties.pnu;
    const parcelData = window.clickParcels.get(pnu);
    const searchParcelData = window.searchParcels && window.searchParcels.get(pnu);
    const jibun = formatJibun(parcel.properties);
    
    // 🎯 ULTRATHINK: 색칠 모드가 꺼져있으면 아무것도 안 함
    if (!window.paintModeEnabled) {
        console.log('🚫 색칠 모드 OFF - 왼쪽 클릭 무시');
        return;
    }
    
    // 🎯 ULTRATHINK: 검색 필지(보라색)는 색칠 안 함
    const isSearchParcel = (parcelData && parcelData.color === '#9370DB') || 
                           (searchParcelData && searchParcelData.color === '#9370DB');
    if (isSearchParcel) {
        console.log('🟣 검색 필지(보라색) - 색칠 안 함');
        return;
    }
    
    // 🎯 ULTRATHINK: 권한 확인 (간소화)
    if (window.userManager && window.userManager.canUseRealtimeFeatures()) {
        const permission = await window.userManager.requestEditPermission(pnu);
        if (!permission) {
            console.log('🚫 실시간 편집 권한 없음:', jibun);
            return;
        }
        
        // 권한 해제 예약
        setTimeout(async () => {
            if (window.userManager) {
                await window.userManager.releaseEditPermission(pnu);
            }
        }, 3000);
    }
    
    // 🎯 ULTRATHINK: 무조건 색칠 (저장된 정보 여부와 상관없이)
    console.log('🎨 ULTRATHINK 왼쪽 클릭 - 바로 색칠:', currentColor, jibun);
    console.log('🎨 PNU:', pnu, '필지 데이터 존재:', !!parcelData);
    applyColorToParcel(parcel, currentColor);
    
    // 로그만 남기고 팝업 없음
    if (parcelData && parcelData.color !== 'transparent' && parcelData.color !== currentColor) {
        console.log(`🔄 색상 변경: ${parcelData.color} → ${currentColor}`);
    } else {
        console.log(`🎨 필지 색칠 완료: ${jibun}`);
    }
}

// 🎯 ULTRATHINK: 오른쪽 클릭 - 색 지우기 전용
async function handleParcelRightClick(parcel, polygon) {
    const pnu = parcel.properties.PNU || parcel.properties.pnu;
    const parcelData = window.clickParcels.get(pnu);
    const jibun = formatJibun(parcel.properties);
    
    // 색칠 모드가 꺼져있으면 색 지우기도 불가
    if (!window.paintModeEnabled) {
        console.log('🚫 색칠 모드 OFF - 색 지우기 불가');
        return;
    }
    
    // 색칠되어 있는지 확인
    if (parcelData && parcelData.color !== 'transparent') {
        console.log('🎨 오른쪽 클릭 - 색상 제거:', jibun);
        
        // 🎯 ULTRATHINK: 편집 권한 확인 (구글 로그인 사용자만 실시간 잠금)
        if (window.userManager) {
            // 구글 로그인 사용자만 실시간 편집 권한 확인
            if (window.userManager.canUseRealtimeFeatures()) {
                const permission = await window.userManager.requestEditPermission(pnu);
                if (!permission) {
                    console.log('🚫 필지 편집 권한 없음 (실시간 모드):', jibun);
                    return; // 권한 없으면 종료
                }
                
                // 권한 획득 후 색상 제거
                clearParcel(parcel, polygon);
                
                // 권한 해제
                setTimeout(async () => {
                    if (window.userManager) {
                        await window.userManager.releaseEditPermission(pnu);
                    }
                }, 1000);
            } else {
                // 로컬 사용자는 권한 확인만 (실시간 잠금 없음)
                const permission = window.userManager.canEditParcel(pnu);
                if (!permission.allowed) {
                    console.log('🚫 필지 편집 권한 없음 (로컬 모드):', permission.reason);
                    return;
                }
                clearParcel(parcel, polygon);
            }
        } else {
            clearParcel(parcel, polygon);
        }
        
        console.log(`🗑️ 색상 제거 완료: ${jibun}`);
    } else {
        console.log('🚫 색칠되지 않은 필지 - 제거할 색상 없음');
    }
    // showToast 제거 - 팝업 없이 조용히 처리
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

// 🎯 ULTRATHINK: 필지에 색상 적용 (무조건 완전 색칠)
function applyColorToParcel(parcel, color) {
    const pnu = parcel.properties.PNU || parcel.properties.pnu;
    let parcelData = window.clickParcels.get(pnu);
    
    console.log('🎨 applyColorToParcel 호출:', pnu, color, 'parcelData 존재:', !!parcelData);
    
    // 🎯 ULTRATHINK: parcelData가 없으면 즉시 생성! (두 번 클릭 문제 해결)
    if (!parcelData) {
        console.log('🚀 ULTRATHINK: parcelData가 없음 - 즉시 생성합니다!');
        
        // 필지 폴리곤 생성 (createParcelPolygon 함수 사용)
        const polygon = createParcelPolygon(parcel, null, false);
        if (polygon) {
            parcelData = {
                polygon: polygon,
                color: 'transparent',
                pnu: pnu,
                properties: parcel.properties
            };
            window.clickParcels.set(pnu, parcelData);
            console.log('🚀 ULTRATHINK: parcelData 생성 완료!', pnu);
        } else {
            console.error('🚫 ULTRATHINK: 폴리곤 생성 실패!', pnu);
            return;
        }
    }
    
    if (parcelData) {
        console.log('🎨 폴리곤 setOptions 호출 전:', parcelData.polygon ? 'polygon 존재' : 'polygon 없음');
        
        // 🎯 ULTRATHINK: 무조건 완전 색칠 (조건부 로직 제거)
        parcelData.polygon.setOptions({
            fillColor: color,
            fillOpacity: 0.7,        // 무조건 0.7로 충분히 보이게
            strokeColor: color,
            strokeOpacity: 1.0,      // 테두리도 무조건 완전히 보이게
            strokeWeight: 2
        });
        parcelData.color = color;
        
        console.log('🎨 ULTRATHINK 필지 색칠 완료:', pnu, color, 'fillOpacity: 0.7');
        
        // 🎯 ULTRATHINK: 실시간 브로드캐스트 - 임시 색상 변경
        if (window.realtimeDataManager && window.realtimeDataManager.isRealtimeConnected) {
            const parcelInfo = {
                pnu: pnu,
                parcelNumber: formatJibun(parcel.properties),
                color: color,
                action: 'color_preview', // 임시 색상 변경
                coordinates: parcel.geometry?.coordinates || parcel.coordinates
            };
            
            window.realtimeDataManager.broadcastParcelUpdate(parcelInfo)
                .catch(error => console.warn('임시 색상 브로드캐스트 실패:', error));
        }
        
        // 주의: localStorage 저장은 saveParcelData() 함수에서만 수행
        // 클릭만으로는 임시 색상만 적용되고, 저장 버튼을 눌러야 실제 저장됨
    } else {
        console.error('🚫 parcelData가 없어서 색칠 실패:', pnu);
        console.error('🚫 window.clickParcels:', window.clickParcels);
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

// 일반 토스트 메시지 표시 (화면 중앙 상단)
function showToast(message, type = 'success') {
    // 기존 토스트가 있으면 제거
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // 새 토스트 생성
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // body에 추가
    document.body.appendChild(toast);
    
    // 애니메이션 시작
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // 2초 후 자동 제거
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    }, 2000);
}

// 저장 버튼 근처에 토스트 메시지 표시
function showToastNearButton(message, type = 'success') {
    // 기존 토스트가 있으면 제거
    const existingToast = document.querySelector('.toast-near-button');
    if (existingToast) {
        existingToast.remove();
    }
    
    // 새 토스트 생성
    const toast = document.createElement('div');
    toast.className = `toast-near-button ${type}`;
    toast.textContent = message;
    
    // 저장 버튼의 부모 요소(form-buttons)에 추가
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn && saveBtn.parentElement) {
        saveBtn.parentElement.appendChild(toast);
        
        // 애니메이션 시작
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // 2초 후 자동 제거
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 200);
        }, 2000);
    }
}

// 필지 데이터 저장 (실시간 동기화 적용)
async function saveParcelData() {
    const parcelNumber = document.getElementById('parcelNumber').value;
    
    if (!parcelNumber) {
        showToastNearButton('지번 입력 필요', 'warning');
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
            // 🎯 ULTRATHINK: 2중 백업 확실성 보장 - 강제 클라우드 동기화
            syncResult = await window.dataManager.save(savedData, { 
                forceCloudSync: true,  // Supabase 강제 백업
                forceGoogleBackup: true  // Google Sheets 강제 백업 트리거
            });
            console.log('🔄 실시간 동기화 저장 결과 (강제 2중 백업):', syncResult);
            
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
            showToastNearButton('저장 실패', 'error');
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
    
    // 🎯 ULTRATHINK: ParcelManager UI 제거됨 - Supabase + Google Sheets 2중 백업만 사용
    // 우측 UI 무시 - 데이터는 자동 클라우드 백업됨
    
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
    let message = '저장됨';
    if (syncResult.local && syncResult.cloud) {
        message = '저장 완료 🌐';
    } else if (syncResult.local) {
        message = '저장됨 ⏳';
    }
    
    showToastNearButton(message, 'success');
    
    // 🎯 ULTRATHINK: 실시간 브로드캐스트 - 최종 저장 완료
    if (window.realtimeDataManager && window.realtimeDataManager.isRealtimeConnected) {
        try {
            const broadcastData = {
                pnu: currentPNU,
                parcelNumber: savedParcelNumber,
                color: currentColor,
                ownerName: document.getElementById('ownerName').value || '',
                ownerAddress: document.getElementById('ownerAddress').value || '',
                ownerContact: document.getElementById('ownerContact').value || '',
                memo: document.getElementById('memo').value || '',
                action: 'save_complete', // 최종 저장 완료
                coordinates: geometry
            };
            
            window.realtimeDataManager.broadcastParcelUpdate(broadcastData)
                .then(() => console.log('✅ 필지 저장 브로드캐스트 완료:', savedParcelNumber))
                .catch(error => console.warn('필지 저장 브로드캐스트 실패:', error));
                
        } catch (error) {
            console.warn('실시간 브로드캐스트 처리 중 오류:', error);
        }
    }
    
    // 🎯 ULTRATHINK: 저장 후 실시간 ParcelManager 동기화
    console.log('🔄 저장 완료 - ParcelManager 실시간 갱신 시작...');
    
    try {
        // 🎯 ULTRATHINK: ParcelManager UI 제거됨 - 클라우드 백업 전용
        // UI 동기화 불필요 - 데이터는 dataManager가 자동 백업
        {
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
    
    // 🎯 ULTRATHINK: 포괄적 버그 필지 검사 및 제거
    console.log('🔧 포괄적 문제 필지들 스캔 및 제거 실행...');
    const problemParcels = comprehensiveBugParcelScan();
    
    if (clearedCount > 0 || problemParcels.length > 0) {
        // 폼 초기화
        document.getElementById('parcelForm').reset();
        showToast(`${clearedCount + problemParcels.length}개 필지 초기화 (포괄적 검사 포함)`, 'success');
    } else {
        showToast('초기화할 필지 없음', 'info');
    }
}

// 모든 필지 색상 초기화 (선택 + 검색)
function clearAllParcelsColors() {
    // confirm은 utils.js에서 이미 처리됨
    let clearedCount = 0;
    
    // 🎯 ULTRATHINK: ViewportRenderer에서 렌더링된 폴리곤들도 완전 제거
    if (window.viewportRenderer && window.viewportRenderer.renderedParcels) {
        window.viewportRenderer.renderedParcels.forEach((polygon, id) => {
            if (polygon && polygon.setMap) {
                polygon.setMap(null); // 완전 제거
                clearedCount++;
            }
        });
        window.viewportRenderer.renderedParcels.clear(); // 맵 비우기
        console.log('🗑️ ViewportRenderer 폴리곤들 완전 제거');
    }
    
    // 선택 필지 초기화 (저장된 정보가 있어도 강제로 초기화)
    window.clickParcels.forEach((parcelData, pnu) => {
        if (parcelData.polygon) {
            parcelData.polygon.setMap(null); // 완전 제거
            clearedCount++;
        }
        // 메모 마커도 제거
        if (parcelData.memoMarker) {
            parcelData.memoMarker.setMap(null);
        }
    });
    window.clickParcels.clear(); // 맵 비우기
    
    // 검색 필지도 초기화
    if (typeof clearAllSearchResults === 'function') {
        clearAllSearchResults();
    }
    
    // 🎯 ULTRATHINK: 혹시 놓친 폴리곤들을 위한 전역 정리
    if (window.map && window.map.__listeners__) {
        // 지도에 등록된 모든 오버레이 중 폴리곤 타입 제거
        console.log('🔍 전역 폴리곤 정리 시도...');
    }
    
    // 🎯 ULTRATHINK: 포괄적 버그 필지 검사 및 제거 (전체 초기화)
    console.log('🔧 전체 초기화 - 포괄적 문제 필지들 스캔 및 제거 실행...');
    const problemParcels = comprehensiveBugParcelScan();
    
    // 폼 초기화
    document.getElementById('parcelForm').reset();
    
    console.log(`💥 ULTRATHINK 전체 초기화: ${clearedCount + problemParcels.length}개 요소 완전 제거 (포괄적 검사 포함)`);
    showToast(`모든 필지 완전 초기화 (${clearedCount + problemParcels.length}개 완전 제거)`, 'success');
}

// 🎯 ULTRATHINK: 모든 폴리곤 스타일 숨기기 (색칠 OFF 모드 - 완전 투명)
function hideAllPolygonStyles() {
    let hiddenCount = 0;
    
    // clickParcels의 폴리곤들 완전히 숨기기 (색상은 보존)
    window.clickParcels.forEach((parcelData, pnu) => {
        if (parcelData.polygon) {
            // 🎯 ULTRATHINK: 색상 정보는 보존하되 화면에서만 숨기기
            if (!parcelData.originalStyle) {
                parcelData.originalStyle = {
                    fillColor: parcelData.color || '#FF0000',
                    fillOpacity: (parcelData.color && parcelData.color !== 'transparent') ? 0.3 : 0,
                    strokeColor: parcelData.color || '#FF0000',
                    strokeOpacity: 0.8,
                    strokeWeight: 2
                };
            }
            
            parcelData.polygon.setOptions({
                fillOpacity: 0,      // 채우기 완전 투명
                strokeOpacity: 0,    // 테두리 완전 투명 (버그 수정!)
                strokeWeight: 0      // 테두리 두께도 0으로
            });
            hiddenCount++;
        }
    });
    
    // ViewportRenderer의 폴리곤들 완전히 숨기기
    if (window.viewportRenderer && window.viewportRenderer.renderedParcels) {
        window.viewportRenderer.renderedParcels.forEach((polygon, id) => {
            if (polygon && polygon.setOptions) {
                polygon.setOptions({
                    fillOpacity: 0,
                    strokeOpacity: 0,    // 완전 투명 (버그 수정!)
                    strokeWeight: 0
                });
                hiddenCount++;
            }
        });
    }
    
    // 검색 폴리곤들도 완전히 숨기기
    if (window.searchParcels) {
        window.searchParcels.forEach((parcelData, pnu) => {
            if (parcelData.polygon) {
                // 색상 정보 보존
                if (!parcelData.originalStyle) {
                    parcelData.originalStyle = {
                        fillColor: parcelData.color || '#FFFF00',
                        fillOpacity: (parcelData.color && parcelData.color !== 'transparent') ? 0.3 : 0,
                        strokeColor: parcelData.color || '#FFFF00',
                        strokeOpacity: 0.8,
                        strokeWeight: 2
                    };
                }
                
                parcelData.polygon.setOptions({
                    fillOpacity: 0,
                    strokeOpacity: 0,    // 완전 투명 (버그 수정!)
                    strokeWeight: 0
                });
                hiddenCount++;
            }
        });
    }
    
    console.log(`🚫 ${hiddenCount}개 폴리곤 스타일 완전 숨김 완료`);
}

// 🎯 ULTRATHINK: 모든 폴리곤 스타일 복원 (색칠 ON 모드 - 원본 색상 보존)
function restoreAllPolygonStyles() {
    let restoredCount = 0;
    
    // clickParcels의 폴리곤들 원본 색상으로 복원
    window.clickParcels.forEach((parcelData, pnu) => {
        if (parcelData.polygon) {
            // 🎯 ULTRATHINK: originalStyle이 있으면 원본으로 복원, 없으면 현재 색상 사용
            if (parcelData.originalStyle) {
                parcelData.polygon.setOptions(parcelData.originalStyle);
                // originalStyle 정보 제거 (다음번 숨김을 위해)
                delete parcelData.originalStyle;
            } else if (parcelData.color) {
                // 기존 색상 정보가 있으면 복원
                const fillOpacity = (parcelData.color && parcelData.color !== 'transparent') ? 0.3 : 0;
                const strokeOpacity = (parcelData.color && parcelData.color !== 'transparent') ? 0.8 : 0.6;
                
                parcelData.polygon.setOptions({
                    fillColor: parcelData.color,
                    fillOpacity: fillOpacity,
                    strokeColor: parcelData.color,
                    strokeOpacity: strokeOpacity,
                    strokeWeight: 2
                });
            } else {
                // 기본 스타일로 복원
                parcelData.polygon.setOptions({
                    fillColor: 'transparent',
                    fillOpacity: 0,
                    strokeColor: '#0000FF',
                    strokeOpacity: 0.6,
                    strokeWeight: 0.5
                });
            }
            restoredCount++;
        }
    });
    
    // ViewportRenderer의 폴리곤들 복원
    if (window.viewportRenderer && window.viewportRenderer.renderedParcels) {
        window.viewportRenderer.renderedParcels.forEach((polygon, id) => {
            if (polygon && polygon.setOptions) {
                // ViewportRenderer는 기본 스타일로 복원
                polygon.setOptions({
                    fillOpacity: 0,
                    strokeOpacity: 0.6,
                    strokeWeight: 0.5,
                    strokeColor: '#0000FF'
                });
                restoredCount++;
            }
        });
    }
    
    // 검색 폴리곤들 원본 색상으로 복원
    if (window.searchParcels) {
        window.searchParcels.forEach((parcelData, pnu) => {
            if (parcelData.polygon) {
                // 🎯 ULTRATHINK: originalStyle이 있으면 원본으로 복원
                if (parcelData.originalStyle) {
                    parcelData.polygon.setOptions(parcelData.originalStyle);
                    // originalStyle 정보 제거
                    delete parcelData.originalStyle;
                } else if (parcelData.color) {
                    // 기존 색상 정보가 있으면 복원 (검색은 주로 노란색)
                    const fillOpacity = (parcelData.color && parcelData.color !== 'transparent') ? 0.3 : 0;
                    const strokeOpacity = (parcelData.color && parcelData.color !== 'transparent') ? 0.8 : 0.6;
                    
                    parcelData.polygon.setOptions({
                        fillColor: parcelData.color,
                        fillOpacity: fillOpacity,
                        strokeColor: parcelData.color,
                        strokeOpacity: strokeOpacity,
                        strokeWeight: 2
                    });
                } else {
                    // 기본 검색 폴리곤 스타일로 복원 (노란색)
                    parcelData.polygon.setOptions({
                        fillColor: '#FFFF00',
                        fillOpacity: 0.3,
                        strokeColor: '#FFFF00',
                        strokeOpacity: 0.8,
                        strokeWeight: 2
                    });
                }
                restoredCount++;
            }
        });
    }
    
    console.log(`🎨 ${restoredCount}개 폴리곤 스타일 복원 완료`);
}

// 🎯 ULTRATHINK: 특정 필지 디버깅 함수
function debugSpecificParcels(targetJibuns = ['소하동 1288', '소하동 1361-2', '소하동 1325']) {
    console.log('🔍 === 특정 필지 디버깅 시작 ===');
    
    targetJibuns.forEach(jibun => {
        console.log(`\n📍 ${jibun} 디버깅:`);
        
        // 1. localStorage 확인
        const savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
        const savedInfo = savedData.filter(item => 
            item.parcelNumber === jibun || 
            (item.parcelNumber && item.parcelNumber.includes(jibun.split(' ')[1]))
        );
        console.log(`📦 localStorage에서 발견: ${savedInfo.length}개`, savedInfo);
        
        // 2. clickParcels 확인
        let foundInClick = 0;
        window.clickParcels.forEach((data, pnu) => {
            const parcelJibun = formatJibun(data.data?.properties || {});
            if (parcelJibun === jibun || parcelJibun.includes(jibun.split(' ')[1])) {
                console.log(`🖱️ clickParcels에서 발견: PNU=${pnu}, 색상=${data.color}`, data);
                foundInClick++;
            }
        });
        
        // 3. searchParcels 확인
        let foundInSearch = 0;
        if (window.searchParcels) {
            window.searchParcels.forEach((data, pnu) => {
                const parcelJibun = formatJibun(data.data?.properties || {});
                if (parcelJibun === jibun || parcelJibun.includes(jibun.split(' ')[1])) {
                    console.log(`🔍 searchParcels에서 발견: PNU=${pnu}, 색상=${data.color}`, data);
                    foundInSearch++;
                }
            });
        }
        
        // 4. ViewportRenderer 확인
        let foundInViewport = 0;
        if (window.viewportRenderer && window.viewportRenderer.renderedParcels) {
            window.viewportRenderer.renderedParcels.forEach((polygon, id) => {
                if (id.includes(jibun.split(' ')[1]) || id.includes(jibun)) {
                    console.log(`📐 ViewportRenderer에서 발견: ID=${id}`, polygon);
                    foundInViewport++;
                }
            });
        }
        
        console.log(`📊 ${jibun} 요약: localStorage=${savedInfo.length}, click=${foundInClick}, search=${foundInSearch}, viewport=${foundInViewport}`);
    });
    
    console.log('🔍 === 특정 필지 디버깅 완료 ===\n');
}

// 🎯 ULTRATHINK: 강력한 특정 필지 제거 함수 (확장됨)
function forceRemoveSpecificParcels(targetJibuns = [
    '소하동 1288', '소하동 1361-2', '소하동 1325', // 기존 문제 필지들
    '안양동 1088-111', '박달동 322-4' // 새로운 문제 필지들
]) {
    console.log('💥 === 강력한 특정 필지 제거 시작 ===');
    let totalRemoved = 0;
    
    targetJibuns.forEach(jibun => {
        console.log(`\n🎯 ${jibun} 강제 제거:`);
        let removedCount = 0;
        
        // 1. localStorage에서 완전 삭제
        let savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
        const originalLength = savedData.length;
        savedData = savedData.filter(item => {
            const shouldRemove = item.parcelNumber === jibun || 
                               (item.parcelNumber && item.parcelNumber.includes(jibun.split(' ')[1]));
            if (shouldRemove) removedCount++;
            return !shouldRemove;
        });
        
        if (savedData.length !== originalLength) {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(savedData));
            console.log(`📦 localStorage에서 ${originalLength - savedData.length}개 제거`);
        }
        
        // 2. clickParcels에서 완전 제거
        const keysToDelete = [];
        window.clickParcels.forEach((data, pnu) => {
            const parcelJibun = formatJibun(data.data?.properties || {});
            if (parcelJibun === jibun || parcelJibun.includes(jibun.split(' ')[1])) {
                if (data.polygon) data.polygon.setMap(null);
                if (data.memoMarker) data.memoMarker.setMap(null);
                keysToDelete.push(pnu);
                removedCount++;
            }
        });
        keysToDelete.forEach(key => window.clickParcels.delete(key));
        if (keysToDelete.length > 0) {
            console.log(`🖱️ clickParcels에서 ${keysToDelete.length}개 제거`);
        }
        
        // 3. searchParcels에서 완전 제거
        const searchKeysToDelete = [];
        if (window.searchParcels) {
            window.searchParcels.forEach((data, pnu) => {
                const parcelJibun = formatJibun(data.data?.properties || {});
                if (parcelJibun === jibun || parcelJibun.includes(jibun.split(' ')[1])) {
                    if (data.polygon) data.polygon.setMap(null);
                    if (data.memoMarker) data.memoMarker.setMap(null);
                    searchKeysToDelete.push(pnu);
                    removedCount++;
                }
            });
            searchKeysToDelete.forEach(key => window.searchParcels.delete(key));
            if (searchKeysToDelete.length > 0) {
                console.log(`🔍 searchParcels에서 ${searchKeysToDelete.length}개 제거`);
            }
        }
        
        // 4. ViewportRenderer에서 완전 제거
        const viewportKeysToDelete = [];
        if (window.viewportRenderer && window.viewportRenderer.renderedParcels) {
            window.viewportRenderer.renderedParcels.forEach((polygon, id) => {
                if (id.includes(jibun.split(' ')[1]) || id.includes(jibun)) {
                    if (polygon && polygon.setMap) polygon.setMap(null);
                    viewportKeysToDelete.push(id);
                    removedCount++;
                }
            });
            viewportKeysToDelete.forEach(key => window.viewportRenderer.renderedParcels.delete(key));
            if (viewportKeysToDelete.length > 0) {
                console.log(`📐 ViewportRenderer에서 ${viewportKeysToDelete.length}개 제거`);
            }
        }
        
        console.log(`✅ ${jibun} 총 ${removedCount}개 요소 제거 완료`);
        totalRemoved += removedCount;
    });
    
    console.log(`💥 === 강력한 특정 필지 제거 완료: 총 ${totalRemoved}개 ===\n`);
    showToast(`특정 필지 ${totalRemoved}개 강제 제거 완료`, 'success');
}

// 🎯 ULTRATHINK: 모든 메모 마커 필지 스캔 및 제거
function scanAndRemoveAllMemoMarkedParcels() {
    console.log('🔍 === 메모 마커 필지 전체 스캔 시작 ===');
    let totalRemoved = 0;
    const problemParcels = [];
    
    // clickParcels에서 메모 마커가 있는 필지들 찾기
    window.clickParcels.forEach((data, pnu) => {
        if (data.memoMarker && data.data?.properties) {
            const jibun = formatJibun(data.data.properties);
            problemParcels.push(jibun);
            console.log(`🅼 메모 마커 필지 발견: ${jibun} (PNU: ${pnu})`);
        }
    });
    
    // searchParcels에서도 검사
    if (window.searchParcels) {
        window.searchParcels.forEach((data, pnu) => {
            if (data.memoMarker && data.data?.properties) {
                const jibun = formatJibun(data.data.properties);
                if (!problemParcels.includes(jibun)) {
                    problemParcels.push(jibun);
                    console.log(`🅼 메모 마커 필지 발견 (검색): ${jibun} (PNU: ${pnu})`);
                }
            }
        });
    }
    
    console.log(`📋 총 ${problemParcels.length}개 메모 마커 필지 발견:`, problemParcels);
    
    if (problemParcels.length > 0) {
        // 발견된 메모 마커 필지들을 모두 강제 제거
        forceRemoveSpecificParcels(problemParcels);
        totalRemoved = problemParcels.length;
    }
    
    console.log('🔍 === 메모 마커 필지 전체 스캔 완료 ===\n');
    return problemParcels;
}

// 🎯 ULTRATHINK: 빨간색 필지 전체 스캔 및 제거
function scanAndRemoveAllRedParcels() {
    console.log('🔴 === 빨간색 필지 전체 스캔 시작 ===');
    let totalRemoved = 0;
    const redParcels = [];
    
    // clickParcels에서 빨간색 필지들 찾기
    window.clickParcels.forEach((data, pnu) => {
        if (data.color === '#FF0000' && data.data?.properties) {
            const jibun = formatJibun(data.data.properties);
            redParcels.push(jibun);
            console.log(`🔴 빨간색 필지 발견: ${jibun} (PNU: ${pnu})`);
        }
    });
    
    // searchParcels에서도 검사
    if (window.searchParcels) {
        window.searchParcels.forEach((data, pnu) => {
            if (data.color === '#FF0000' && data.data?.properties) {
                const jibun = formatJibun(data.data.properties);
                if (!redParcels.includes(jibun)) {
                    redParcels.push(jibun);
                    console.log(`🔴 빨간색 필지 발견 (검색): ${jibun} (PNU: ${pnu})`);
                }
            }
        });
    }
    
    console.log(`📋 총 ${redParcels.length}개 빨간색 필지 발견:`, redParcels);
    
    if (redParcels.length > 0) {
        // 발견된 빨간색 필지들을 모두 강제 제거
        forceRemoveSpecificParcels(redParcels);
        totalRemoved = redParcels.length;
    }
    
    console.log('🔴 === 빨간색 필지 전체 스캔 완료 ===\n');
    return redParcels;
}

// 🎯 ULTRATHINK: 잠재적 버그 필지 종합 검사 및 제거
function comprehensiveBugParcelScan() {
    console.log('🚨 === 포괄적 버그 필지 검사 시작 ===');
    
    const allProblemParcels = new Set();
    
    // 1. 메모 마커가 있는 필지들
    const memoMarkedParcels = scanAndRemoveAllMemoMarkedParcels();
    memoMarkedParcels.forEach(p => allProblemParcels.add(p));
    
    // 2. 빨간색 필지들  
    const redParcels = scanAndRemoveAllRedParcels();
    redParcels.forEach(p => allProblemParcels.add(p));
    
    // 3. localStorage에 저장되어 있지만 지도에서 사라지지 않는 필지들
    const savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
    const savedParcels = savedData.map(item => item.parcelNumber).filter(Boolean);
    console.log(`💾 localStorage에 저장된 필지들: ${savedParcels.length}개`, savedParcels);
    savedParcels.forEach(p => allProblemParcels.add(p));
    
    // 4. ViewportRenderer에 렌더링된 필지들
    const viewportParcels = [];
    if (window.viewportRenderer && window.viewportRenderer.renderedParcels) {
        window.viewportRenderer.renderedParcels.forEach((polygon, id) => {
            viewportParcels.push(id);
        });
        console.log(`📐 ViewportRenderer 렌더링된 필지들: ${viewportParcels.length}개`);
        viewportParcels.forEach(p => allProblemParcels.add(p));
    }
    
    const finalProblemList = Array.from(allProblemParcels);
    console.log(`🎯 최종 문제 필지 목록 (${finalProblemList.length}개):`, finalProblemList);
    
    // 모든 문제 필지들을 한번에 강제 제거
    if (finalProblemList.length > 0) {
        console.log('💥 모든 문제 필지들을 강제 제거 실행...');
        forceRemoveSpecificParcels(finalProblemList);
        
        // 추가 보안: 모든 폴리곤 완전 정리
        clearAllParcelsColors();
    }
    
    console.log('🚨 === 포괄적 버그 필지 검사 완료 ===\n');
    showToast(`${finalProblemList.length}개 문제 필지 완전 제거`, 'success');
    return finalProblemList;
}

// 🎯 ULTRATHINK: 슈퍼 초기화 함수 (모든 잠재적 버그 해결)
function superClearAllParcels() {
    console.log('🌟 === ULTRATHINK 슈퍼 초기화 시작 ===');
    
    // 1. 포괄적 버그 필지 검사 및 제거
    const problemParcels = comprehensiveBugParcelScan();
    
    // 2. 기본 전체 초기화
    clearAllParcelsColors();
    
    // 3. 강력한 메모리 정리
    if (window.clickParcels) window.clickParcels.clear();
    if (window.searchParcels) window.searchParcels.clear();
    if (window.viewportRenderer) {
        window.viewportRenderer.clearAll();
    }
    
    // 4. localStorage 완전 정리
    localStorage.removeItem(CONFIG.STORAGE_KEY);
    
    console.log('🌟 === ULTRATHINK 슈퍼 초기화 완료 ===');
    showToast('🌟 ULTRATHINK 슈퍼 초기화 완료!', 'success');
}

// 전역 함수로 등록 (콘솔에서 사용 가능)
window.scanAndRemoveAllMemoMarkedParcels = scanAndRemoveAllMemoMarkedParcels;
window.scanAndRemoveAllRedParcels = scanAndRemoveAllRedParcels;
window.comprehensiveBugParcelScan = comprehensiveBugParcelScan;
window.superClearAllParcels = superClearAllParcels;

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
    
    // 🎯 ULTRATHINK: 필지 색칠 모드 토글 버튼
    const paintModeToggle = document.getElementById('paintModeToggle');
    if (paintModeToggle) {
        paintModeToggle.addEventListener('click', function() {
            window.paintModeEnabled = !window.paintModeEnabled;
            
            const toggleIcon = this.querySelector('.toggle-icon');
            const toggleText = this.querySelector('.toggle-text');
            
            if (window.paintModeEnabled) {
                this.classList.add('active');
                toggleIcon.textContent = '🎨';
                toggleText.textContent = '색칠 ON';
                
                // 🎯 ULTRATHINK: 색칠 ON - 기존 색칠이 이미 유지되므로 별도 복원 불필요
                // restoreAllPolygonStyles() 호출하지 않음 - 기존 색칠이 계속 유지됨
                
                console.log('🎨 필지 색칠 모드 활성화 - 새로운 색칠 가능');
                showToast('색칠 ON - 새로운 색칠 가능', 'success');
            } else {
                this.classList.remove('active');
                toggleIcon.textContent = '🚫';
                toggleText.textContent = '색칠 OFF';
                
                // 🎯 ULTRATHINK: 색칠 OFF - 기존 색칠은 유지, 새로운 색칠만 방지
                // hideAllPolygonStyles() 호출하지 않음 - 기존 색칠 유지
                
                console.log('🚫 필지 색칠 모드 비활성화 - 기존 색칠 유지, 새로운 색칠만 방지');
                showToast('색칠 OFF - 기존 색칠 유지됨', 'info');
            }
        });
    }
    
    // 중복 이벤트 리스너 제거 - utils.js에서 이미 등록됨
}