// 검색 기능

// 폴리곤 중심점 계산 함수
function calculatePolygonCenter(coordinates) {
    if (!coordinates || coordinates.length === 0) {
        return [0, 0];
    }
    
    let totalX = 0;
    let totalY = 0;
    let count = 0;
    
    for (const coord of coordinates) {
        if (coord && coord.length >= 2) {
            totalX += coord[0];
            totalY += coord[1];
            count++;
        }
    }
    
    if (count === 0) {
        return [0, 0];
    }
    
    return [totalX / count, totalY / count];
}

// 필지 하이라이트 함수
function highlightParcel(parcelData, customDisplayText) {
    try {
        console.log('🎨 필지 하이라이트 시작');
        
        const geometry = parcelData.geometry;
        const properties = parcelData.properties || {};
        
        if (!geometry || !geometry.coordinates) {
            console.error('❌ geometry 또는 coordinates가 없습니다:', geometry);
            return null;
        }

        // displayText 결정 - customDisplayText 우선, 없으면 formatJibun 사용
        let displayText = customDisplayText;
        if (!displayText) {
            try {
                if (typeof formatJibun === 'function') {
                    displayText = formatJibun(properties);
                } else {
                    displayText = properties.JIBUN || properties.jibun || '지번미상';
                }
            } catch (error) {
                console.error('💥 formatJibun 에러:', error);
                displayText = properties.JIBUN || properties.jibun || '지번미상';
            }
        }
        
        console.log('🏠 포맷된 지번:', displayText);

        // 좌표 변환
        let paths = [];
        
        if (geometry.type === 'Polygon') {
            // 단일 폴리곤
            const coords = geometry.coordinates[0];
            paths = coords.map(coord => new naver.maps.LatLng(coord[1], coord[0]));
        } else if (geometry.type === 'MultiPolygon') {
            // 다중 폴리곤 - 첫 번째 폴리곤만 사용
            const coords = geometry.coordinates[0][0];
            paths = coords.map(coord => new naver.maps.LatLng(coord[1], coord[0]));
        }

        if (paths.length === 0) {
            console.warn('❌ paths가 비어있습니다');
            return;
        }

        console.log('🗺️ 변환된 paths 개수:', paths.length);

        // 보라색 폴리곤 생성 (검색 필지용)
        const highlightPolygon = new naver.maps.Polygon({
            paths: paths,
            fillColor: '#9370DB', // 보라색 (Medium Purple)
            fillOpacity: 0.9, // 0.8 → 0.9로 더욱 진하게 (거의 불투명)
            strokeColor: '#6A0DAD', // 진한 보라색 테두리
            strokeWeight: 3,
            strokeOpacity: 1.0,
            map: window.map
        });

        console.log('✅ 보라색 폴리곤 생성 완료');
        console.log('🔍 폴리곤 paths 확인:', highlightPolygon.getPaths());
        
        // 강제로 지도에 다시 설정
        highlightPolygon.setMap(window.map);
        console.log('🔄 폴리곤을 지도에 강제 설정 완료');
        
        // 🎯 ULTRATHINK: 검색 폴리곤 스타일 보호 - 다른 시스템이 덮어쓰지 못하도록
        setTimeout(() => {
            highlightPolygon.setOptions({
                fillColor: '#9370DB',
                fillOpacity: 0.9, // 최대한 진하게
                strokeColor: '#6A0DAD',
                strokeWeight: 3,
                strokeOpacity: 1.0
            });
            console.log('🛡️ 검색 폴리곤 스타일 보호 적용 완료 (fillOpacity: 0.9)');
        }, 100);
        
        // 🎯 ULTRATHINK: 추가 보호 - 1초 후 다시 한번 강제 적용
        setTimeout(() => {
            highlightPolygon.setOptions({
                fillColor: '#9370DB',
                fillOpacity: 0.9,
                strokeColor: '#6A0DAD',
                strokeWeight: 3,
                strokeOpacity: 1.0
            });
            console.log('🛡️ 검색 폴리곤 추가 보호 적용 완료');
        }, 1000);
        
        // 검색 필지 라벨 생성
        let label = null;
        try {
            if (!displayText || displayText.trim() === '') {
                console.warn('⚠️ displayText가 비어있어 라벨을 생성하지 않습니다');
                return null;
            }
            
            // 좌표 계산
            const coordsForCenter = geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates[0][0];
            let center = calculatePolygonCenter(coordsForCenter);
            
            // 중심점 fallback
            if (!center || center[0] === 0 || center[1] === 0) {
                center = [coordsForCenter[0][0], coordsForCenter[0][1]];
            }
            
            // 4단계: 보라색 검색 라벨 생성
            label = new naver.maps.Marker({
                position: new naver.maps.LatLng(center[1], center[0]),
                map: window.map,
                icon: {
                    content: `<div style="
                        background: white;
                        color: #9370DB;
                        padding: 6px 12px;
                        border: 3px solid #9370DB;
                        font-size: 13px;
                        font-weight: bold;
                        border-radius: 8px;
                        position: relative;
                        z-index: 10000;
                        box-shadow: 0 3px 10px rgba(147,112,219,0.4);
                        white-space: nowrap;
                        min-width: 60px;
                        text-align: center;
                        animation: searchGlow 2s ease-in-out infinite alternate;
                    ">${displayText}</div>
                    <style>
                        @keyframes searchGlow {
                            0% { box-shadow: 0 3px 10px rgba(147,112,219,0.4); }
                            100% { box-shadow: 0 5px 15px rgba(147,112,219,0.7); }
                        }
                    </style>`,
                    anchor: new naver.maps.Point(0, 35)
                }
            });
            
            console.log('✅ 검색 라벨 생성 완료:', displayText);
            
            // 강제 지도 설정
            if (label && window.map) {
                label.setMap(window.map);
            }
            
        } catch (error) {
            console.error('💥 라벨 생성 중 에러:', error);
            console.error('💥 에러 스택:', error.stack);
            label = null;
        }

        // window.searchParcels에 저장
        const pnu = properties.PNU || properties.pnu || `search_${Date.now()}_${Math.random()}`;
        const searchResult = {
            pnu: pnu,
            polygon: highlightPolygon,
            label: label,
            data: parcelData,
            displayText: displayText
        };

        window.searchParcels.set(pnu, searchResult);
        console.log('💾 searchParcels에 저장 완료, 총 개수:', window.searchParcels.size);

        // currentSelectedPNU 설정 (저장 시 검색 필지로 인식되도록)
        window.currentSelectedPNU = pnu;
        console.log('📌 currentSelectedPNU 설정:', pnu);

        // 🎯 ULTRATHINK: sessionStorage에 검색 필지 저장 (새로고침 유지용)
        try {
            const sessionData = JSON.parse(sessionStorage.getItem('searchParcels') || '{}');
            const saveData = {
                data: parcelData,
                geometry: parcelData.geometry,
                properties: parcelData.properties,
                displayText: displayText,
                timestamp: Date.now()
            };
            sessionData[pnu] = saveData;
            sessionStorage.setItem('searchParcels', JSON.stringify(sessionData));
            
            console.log('💾 ULTRATHINK: sessionStorage에 검색 필지 저장 완료');
            console.log('📝 저장된 PNU:', pnu);
            console.log('📝 저장된 데이터:', saveData);
            console.log('📝 전체 sessionStorage 크기:', Object.keys(sessionData).length);
        } catch (error) {
            console.error('❌ sessionStorage 저장 실패:', error);
        }

        // localStorage에 저장
        saveSearchResultsToStorage();
        
        // 🎯 ULTRATHINK: ParcelManager UI 제거됨 - Supabase + Google Sheets 2중 백업만 사용
        // UI 동기화 불필요 - 데이터는 자동으로 클라우드에 백업됨
        
        // 검색 결과 저장 이벤트 발생
        window.dispatchEvent(new CustomEvent('parcelDataSaved', {
            detail: { parcelNumber: displayText, syncResult: null, action: 'search_add' }
        }));
        
        // 왼쪽 폼에 지번 자동 입력
        const parcelNumberInput = document.getElementById('parcelNumber');
        if (parcelNumberInput) {
            // formatJibun 함수 사용하여 지번 포맷팅
            const jibun = formatJibun(properties);
                         
            parcelNumberInput.value = jibun;
            console.log('📝 왼쪽 폼에 지번 자동 입력:', jibun);
            
            // 입력 이벤트 트리거 (다른 이벤트 리스너가 반응하도록)
            parcelNumberInput.dispatchEvent(new Event('input'));
        }
        
        // 폴리곤 왼쪽 클릭 이벤트 - 폼에 정보 입력
        naver.maps.Event.addListener(highlightPolygon, 'click', function(e) {
            // 우클릭은 처리하지 않음
            if (e.pointerEvent && e.pointerEvent.button === 2) {
                return;
            }
            
            const parcelNumberInput = document.getElementById('parcelNumber');
            if (parcelNumberInput) {
                // formatJibun 함수 사용하여 지번 포맷팅
                const jibun = formatJibun(properties);
                             
                parcelNumberInput.value = jibun;
                console.log('🖱️ 검색 필지 클릭 - 지번 입력:', jibun);
                
                // 폼의 다른 필드도 초기화 또는 자동 입력 가능
                document.getElementById('ownerName')?.focus();
            }
        });

        // 🎯 ULTRATHINK: 검색 필지 우클릭 색상 제거 기능 추가
        naver.maps.Event.addListener(highlightPolygon, 'rightclick', function(e) {
            console.log('🖱️ 검색 필지 우클릭 - 색상 제거 시도');
            
            try {
                // app-core.js의 clearParcel 함수 호출
                if (window.AppCore && window.AppCore.clearParcel) {
                    window.AppCore.clearParcel(pnu);
                    console.log('✅ app-core.js clearParcel 호출 완료');
                } else if (window.clearParcel) {
                    window.clearParcel(pnu);
                    console.log('✅ window.clearParcel 호출 완료');
                } else {
                    console.warn('⚠️ clearParcel 함수를 찾을 수 없음');
                }
                
                // 우클릭 기본 메뉴 방지
                e.pointerEvent?.preventDefault();
                
            } catch (error) {
                console.error('❌ 검색 필지 색상 제거 중 오류:', error);
            }
        });

    } catch (error) {
        console.error('💥 필지 하이라이트 실패:', error);
        console.error('오류 상세:', error.stack);
    }
}

// window.searchParcels가 정의되지 않았다면 초기화
if (typeof window.searchParcels === 'undefined') {
    window.searchParcels = new Map();
}

// localStorage 키 정의
const SEARCH_STORAGE_KEY = 'window.searchParcels';

// 검색 결과를 localStorage에 저장
function saveSearchResultsToStorage() {
    try {
        const searchData = [];
        window.searchParcels.forEach((result, pnu) => {
            // 폴리곤과 라벨은 저장하지 않고, 데이터만 저장
            searchData.push({
                pnu: result.pnu,
                data: result.data,
                displayText: result.displayText
            });
        });
        
        localStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify(searchData));
        console.log('💾 검색 결과를 localStorage에 저장:', searchData.length + '개');
    } catch (error) {
        console.error('💥 검색 결과 저장 실패:', error);
    }
}

// localStorage에서 검색 결과 복원
function loadSearchResultsFromStorage() {
    try {
        const savedData = localStorage.getItem(SEARCH_STORAGE_KEY);
        if (!savedData) {
            console.log('📂 저장된 검색 결과가 없습니다');
            return;
        }
        
        const searchData = JSON.parse(savedData);
        console.log('📂 저장된 검색 결과를 복원:', searchData.length + '개');
        
        // 현재 모드를 먼저 체크
        const isSearchMode = window.currentMode === 'search';
        console.log('🔍 현재 모드:', window.currentMode, '(검색 모드:', isSearchMode + ')');
        
        // 기존 검색 결과 초기화
        clearSearchResults();
        
        // 검색 모드일 때만 폴리곤을 지도에 표시
        if (isSearchMode) {
            console.log('🔍 검색 모드이므로 검색 필지를 표시합니다');
            searchData.forEach(item => {
                highlightParcel(item.data);
            });
        } else {
            console.log('🔧 클릭 모드이므로 검색 필지를 메모리에만 로드하고 표시하지 않습니다');
            // 데이터는 window.searchParcels에 저장하되 지도에는 표시하지 않음
            searchData.forEach(item => {
                const pnu = item.data.properties.PNU;
                if (pnu) {
                    // 폴리곤 없이 데이터만 저장
                    window.searchParcels.set(pnu, {
                        data: item.data,
                        polygon: null,
                        label: null
                    });
                }
            });
        }
        
        console.log('✅ 검색 결과 복원 완료 (검색 필지 개수:', window.searchParcels.size + ')');
    } catch (error) {
        console.error('💥 검색 결과 복원 실패:', error);
        // 오류 발생 시 손상된 데이터 제거
        localStorage.removeItem(SEARCH_STORAGE_KEY);
    }
}

// 검색 결과 완전 초기화 (localStorage 포함)
function clearSearchResults() {
    try {
        // 지도에서 기존 검색 결과 제거
        if (window.searchParcels) {
            window.searchParcels.forEach((result) => {
                if (result.polygon) {
                    result.polygon.setMap(null);
                }
                if (result.label) {
                    result.label.setMap(null);
                }
            });
            window.searchParcels.clear();
        }
        console.log('🧹 검색 결과 지도에서 제거 완료');
        
        // 🎯 ULTRATHINK: sessionStorage는 보존 (새로고침 시 복원용)
        // sessionStorage.removeItem('searchParcels'); // 주석 처리
        console.log('💾 ULTRATHINK: sessionStorage는 보존됨 (새로고침 복원용)');
        
        // 🎯 ULTRATHINK: ParcelManager UI 제거됨 - Supabase + Google Sheets 2중 백업만 사용
        // UI 동기화 불필요 - 데이터는 자동으로 클라우드에 백업됨
        
        // 검색 결과 정리 이벤트 발생
        window.dispatchEvent(new CustomEvent('parcelDataSaved', {
            detail: { parcelNumber: null, syncResult: null, action: 'search_clear_display' }
        }));
    } catch (error) {
        console.error('💥 검색 결과 제거 실패:', error);
    }
}

// localStorage에서 검색 결과 삭제
function removeSearchResultsFromStorage() {
    try {
        localStorage.removeItem(SEARCH_STORAGE_KEY);
        console.log('🗑️ localStorage에서 검색 결과 삭제 완료');
        
        // 🎯 ULTRATHINK: ParcelManager UI 제거됨 - Supabase + Google Sheets 2중 백업만 사용
        // UI 동기화 불필요 - 데이터는 자동으로 클라우드에 백업됨
        
        // localStorage 검색 결과 삭제 이벤트 발생
        window.dispatchEvent(new CustomEvent('parcelDataSaved', {
            detail: { parcelNumber: null, syncResult: null, action: 'search_storage_clear' }
        }));
    } catch (error) {
        console.error('💥 검색 결과 localStorage 삭제 실패:', error);
    }
}

// 🎯 ULTRATHINK: sessionStorage에서 검색 필지 복원 함수
function restoreSearchParcelsFromSession() {
    try {
        console.log('🟣 ULTRATHINK: 검색 필지 복원 함수 시작');
        
        // 1단계: 필수 의존성 체크
        if (!window.map) {
            console.error('❌ window.map이 준비되지 않음');
            return;
        }
        if (typeof formatJibun !== 'function') {
            console.error('❌ formatJibun 함수가 준비되지 않음');
            return;
        }
        if (!window.searchParcels) {
            console.error('❌ window.searchParcels가 준비되지 않음');
            return;
        }
        
        console.log('✅ 모든 의존성 준비 완료');
        console.log('📊 현재 모드:', window.currentMode);
        console.log('🗺️ 지도 객체:', window.map);
        
        // 2단계: sessionStorage에서 데이터 로드
        const searchData = JSON.parse(sessionStorage.getItem('searchParcels') || '{}');
        const searchKeys = Object.keys(searchData);
        
        console.log('💾 sessionStorage 데이터:', searchData);
        
        if (searchKeys.length === 0) {
            console.log('💾 ULTRATHINK: 복원할 검색 필지가 없음');
            return;
        }
        
        console.log(`🟣 ULTRATHINK: ${searchKeys.length}개 검색 필지 복원 시작`);
        
        let restoredCount = 0;
        searchKeys.forEach(pnu => {
            const parcel = searchData[pnu];
            
            console.log(`🔄 복원 시도: PNU ${pnu}`, parcel);
            
            if (!parcel || !parcel.geometry) {
                console.warn(`⚠️ 검색 필지 데이터 누락: ${pnu}`);
                return;
            }
            
            try {
                // 3단계: 폴리곤 좌표 생성
                const coords = parcel.geometry.coordinates[0].map(coord => 
                    new naver.maps.LatLng(coord[1], coord[0])
                );
                
                console.log(`📍 폴리곤 좌표 생성: ${coords.length}개`);
                
                // 4단계: 보라색 폴리곤 생성 (항상 지도에 표시)
                const polygon = new naver.maps.Polygon({
                    map: window.map, // 현재 모드와 관계없이 항상 표시
                    paths: coords,
                    fillColor: '#9370DB',
                    fillOpacity: 0.9, // 0.8 → 0.9로 더욱 진하게
                    strokeColor: '#6A0DAD',
                    strokeOpacity: 1,
                    strokeWeight: 2
                });
                
                console.log('🟣 보라색 폴리곤 생성 완료');
                
                // 🎯 ULTRATHINK: 복원된 검색 폴리곤 스타일 보호
                setTimeout(() => {
                    polygon.setOptions({
                        fillColor: '#9370DB',
                        fillOpacity: 0.9, // 최대한 진하게
                        strokeColor: '#6A0DAD',
                        strokeWeight: 2,
                        strokeOpacity: 1
                    });
                    console.log('🛡️ 복원된 검색 폴리곤 스타일 보호 적용 완료 (fillOpacity: 0.9)');
                }, 100);
                
                // 🎯 ULTRATHINK: 복원 후 추가 보호 - 1초 후 다시 한번 강제 적용
                setTimeout(() => {
                    polygon.setOptions({
                        fillColor: '#9370DB',
                        fillOpacity: 0.9,
                        strokeColor: '#6A0DAD',
                        strokeWeight: 2,
                        strokeOpacity: 1
                    });
                    console.log('🛡️ 복원된 검색 폴리곤 추가 보호 적용 완료');
                }, 1000);
                
                // 복원된 검색 라벨 생성
                const displayText = parcel.displayText || (parcel.properties ? formatJibun(parcel.properties) : '지번미상');
                let label = null;
                
                try {
                    if (displayText && displayText !== '지번미상') {
                        const bounds = new naver.maps.LatLngBounds();
                        coords.forEach(coord => bounds.extend(coord));
                        const center = bounds.getCenter();
                        
                        if (center) {
                            label = new naver.maps.Marker({
                                position: center,
                                map: window.map,
                                icon: {
                                    content: `<div style="
                                        background: white;
                                        color: #9370DB;
                                        padding: 6px 12px;
                                        border: 3px solid #9370DB;
                                        font-size: 13px;
                                        font-weight: bold;
                                        border-radius: 8px;
                                        position: relative;
                                        z-index: 10000;
                                        box-shadow: 0 3px 10px rgba(147,112,219,0.4);
                                        white-space: nowrap;
                                        min-width: 60px;
                                        text-align: center;
                                        animation: searchGlow 2s ease-in-out infinite alternate;
                                    ">${displayText}</div>
                                    <style>
                                        @keyframes searchGlow {
                                            0% { box-shadow: 0 3px 10px rgba(147,112,219,0.4); }
                                            100% { box-shadow: 0 5px 15px rgba(147,112,219,0.7); }
                                        }
                                    </style>`,
                                    anchor: new naver.maps.Point(0, 35)
                                }
                            });
                            
                            console.log('✅ 복원 라벨 생성 완료:', displayText);
                            
                            if (label && window.map) {
                                label.setMap(window.map);
                            }
                        }
                    }
                } catch (error) {
                    console.error('💥 복원 라벨 생성 중 에러:', error);
                    label = null;
                }
                
                // 🎯 ULTRATHINK: 복원된 검색 폴리곤에도 우클릭 이벤트 추가
                naver.maps.Event.addListener(polygon, 'rightclick', function(e) {
                    console.log('🖱️ 복원된 검색 필지 우클릭 - 색상 제거 시도');
                    
                    try {
                        // app-core.js의 clearParcel 함수 호출
                        if (window.AppCore && window.AppCore.clearParcel) {
                            window.AppCore.clearParcel(pnu);
                            console.log('✅ app-core.js clearParcel 호출 완료');
                        } else if (window.clearParcel) {
                            window.clearParcel(pnu);
                            console.log('✅ window.clearParcel 호출 완료');
                        } else {
                            console.warn('⚠️ clearParcel 함수를 찾을 수 없음');
                        }
                        
                        // 우클릭 기본 메뉴 방지
                        e.pointerEvent?.preventDefault();
                        
                    } catch (error) {
                        console.error('❌ 복원된 검색 필지 색상 제거 중 오류:', error);
                    }
                });
                
                // 6단계: window.searchParcels에 저장
                window.searchParcels.set(pnu, {
                    pnu: pnu,
                    polygon: polygon,
                    label: label,
                    data: parcel.data,
                    displayText: displayText,
                    color: '#9370DB'
                });
                
                restoredCount++;
                console.log(`✨ 검색 필지 복원 성공: ${displayText} (PNU: ${pnu})`);
                
            } catch (error) {
                console.error(`❌ 검색 필지 복원 실패: ${pnu}`, error);
            }
        });
        
        console.log(`🟣 ULTRATHINK: 검색 필지 복원 완료 - ${restoredCount}/${searchKeys.length}개 성공`);
        
        // 7단계: 복원된 검색 필지들을 localStorage에도 다시 저장
        if (restoredCount > 0) {
            console.log('💾 localStorage에 복원된 데이터 저장 시작');
            saveSearchResultsToStorage();
        }
        
    } catch (error) {
        console.error('❌ ULTRATHINK: 검색 필지 복원 중 오류:', error);
    }
}

// 검색 모드는 window.currentMode를 사용 ('search' 또는 'click')
// 초기값은 config.js에서 설정됨

// DOM 로드 완료 후 이벤트 리스너 설정
document.addEventListener('DOMContentLoaded', function() {
    // 검색 초기화 버튼
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            console.log('🧹 검색 초기화 버튼 클릭');
            clearSearchResults();
            removeSearchResultsFromStorage();
            alert('검색 결과가 초기화되었습니다.');
        });
    }
    
    console.log('🎯 검색 관련 이벤트 리스너 설정 완료');
    
    // 🎯 ULTRATHINK: 지도 준비 후 검색 필지 복원 (DOMContentLoaded에서)
    const waitForMapAndRestoreDOM = () => {
        if (window.map && typeof window.map === 'object' && typeof formatJibun === 'function') {
            console.log('🗺️ DOMContentLoaded: 지도 객체 준비 완료, 검색 필지 복원 시작');
            setTimeout(() => {
                restoreSearchParcelsFromSession();
            }, 500);
        } else {
            console.log('⏳ DOMContentLoaded: 지도 객체 대기 중...');
            setTimeout(waitForMapAndRestoreDOM, 300);
        }
    };
    
    // DOMContentLoaded에서 첫 번째 복원 시도
    setTimeout(waitForMapAndRestoreDOM, 1500);
});

// 🎯 ULTRATHINK: window load 이벤트에서 백업 복원 시도
window.addEventListener('load', function() {
    console.log('🔄 window load: 검색 필지 복원 백업 시도');
    
    const waitForMapAndRestoreLoad = () => {
        if (window.map && typeof window.map === 'object' && typeof formatJibun === 'function' && window.searchParcels) {
            console.log('🗺️ window load: 모든 준비 완료, 검색 필지 복원 시작');
            setTimeout(() => {
                // 이미 복원된 필지가 있는지 확인
                if (window.searchParcels.size === 0) {
                    console.log('🔄 기존 복원이 실패했거나 없음, 백업 복원 수행');
                    restoreSearchParcelsFromSession();
                } else {
                    console.log('✅ 이미 복원된 검색 필지 있음:', window.searchParcels.size + '개');
                }
            }, 1000);
        } else {
            console.log('⏳ window load: 의존성 대기 중...');
            setTimeout(waitForMapAndRestoreLoad, 500);
        }
    };
    
    setTimeout(waitForMapAndRestoreLoad, 2000); // window load에서는 조금 더 지연
});

// 🎯 ULTRATHINK: 전역 함수로 등록하여 개발자 콘솔에서 테스트 가능
window.restoreSearchParcelsFromSession = restoreSearchParcelsFromSession;
window.testSearchRestore = function() {
    console.log('🧪 테스트: 강제 검색 필지 복원 시도');
    restoreSearchParcelsFromSession();
};

// 전역 변수로 interval 저장
let checkMapInterval = null;

// 기존 필지 색상 저장용
let hiddenParcels = [];

// 🎯 ULTRATHINK: search.js의 toggleSearchMode (app-core.js 함수 호출)
function toggleSearchMode() {
    console.log('🔄 SEARCH.JS toggleSearchMode 시작');
    
    const toggleBtn = document.getElementById('searchToggleBtn');
    if (!toggleBtn) {
        console.error('❌ 검색 토글 버튼을 찾을 수 없음');
        return;
    }
    
    // 현재 모드 전환
    window.currentMode = (window.currentMode === 'search') ? 'click' : 'search';
    
    if (window.currentMode === 'search') {
        // 🎯 검색 ON: 클릭 필지 숨기고 검색 필지 표시
        toggleBtn.textContent = '검색 ON';
        toggleBtn.classList.add('active');
        
        console.log('🔍 검색 ON: app-core.js hideClickParcels 호출');
        if (window.AppCore && window.AppCore.hideClickParcels) {
            window.AppCore.hideClickParcels();
        } else if (typeof window.hideClickParcels === 'function') {
            window.hideClickParcels();
        }
        
        console.log('🔍 검색 ON: app-core.js showSearchParcels 호출');
        if (window.AppCore && window.AppCore.showSearchParcels) {
            window.AppCore.showSearchParcels();
        } else if (typeof window.showSearchParcels === 'function') {
            window.showSearchParcels();
        }
        
        if (window.AppState) {
            window.AppState.searchMode = true;
        }
        
        console.log('✅ 검색 ON 완료');
        
    } else {
        // 🎯 검색 OFF: 검색 필지 숨기고 클릭 필지 표시
        toggleBtn.textContent = '검색 OFF';
        toggleBtn.classList.remove('active');
        
        console.log('🖱️ 검색 OFF: app-core.js hideSearchParcels 호출');
        if (window.AppCore && window.AppCore.hideSearchParcels) {
            window.AppCore.hideSearchParcels();
        } else if (typeof window.hideSearchParcels === 'function') {
            window.hideSearchParcels();
        }
        
        console.log('🖱️ 검색 OFF: app-core.js showClickParcels 호출');
        if (window.AppCore && window.AppCore.showClickParcels) {
            window.AppCore.showClickParcels();
        } else if (typeof window.showClickParcels === 'function') {
            window.showClickParcels();
        }
        
        if (window.AppState) {
            window.AppState.searchMode = false;
        }
        
        console.log('✅ 검색 OFF 완료');
    }
    
    // localStorage 저장
    if (typeof window.saveToLocalStorage === 'function') {
        window.saveToLocalStorage();
    }
}

// 검색 결과 보이기
function showSearchResults() {
    console.log('showSearchResults 호출, window.searchParcels 크기:', window.searchParcels.size);
    
    if (window.searchParcels.size === 0) {
        console.log('표시할 검색 결과가 없음');
        return;
    }
    
    let showCount = 0;
    window.searchParcels.forEach((result, key) => {
        console.log('검색 결과 표시:', key, result);
        if (result.polygon) {
            result.polygon.setMap(window.map);
            showCount++;
        }
        if (result.label) result.label.setMap(window.map);
        // 마커와 정보창은 더 이상 사용하지 않음
    });
    
    console.log(`${showCount}개 검색 결과 표시 완료`);
}

// 검색 결과 숨기기
function hideSearchResults() {
    console.log('hideSearchResults 호출, window.searchParcels 크기:', window.searchParcels.size);
    
    if (window.searchParcels.size === 0) {
        console.log('숨길 검색 결과가 없음');
        return;
    }
    
    let hideCount = 0;
    window.searchParcels.forEach((result, key) => {
        console.log('검색 결과 숨기기:', key, result);
        if (result.polygon) {
            result.polygon.setMap(null);
            hideCount++;
        }
        if (result.label) result.label.setMap(null);
        // 마커와 정보창은 더 이상 사용하지 않음
    });
    
    console.log(`${hideCount}개 검색 결과 숨김 완료`);
}

// 주소/지번 검색
async function searchAddress(query) {
    console.log('=== searchAddress 함수 시작 ===');
    console.log('📍 검색어:', query);
    console.log('🕒 시작 시간:', new Date().toLocaleString());
    
    // 검색 시 자동으로 검색 모드로 전환
    if (window.currentMode !== 'search') {
        window.currentMode = 'search';
        const btn = document.getElementById('searchToggleBtn');
        if (btn) {
            btn.textContent = '검색 ON';
            btn.classList.add('active');
        }
        console.log('🔄 검색 모드로 자동 전환됨');
        
        // 클릭 필지 숨기고 검색 필지 표시
        window.hideClickParcels();
        window.showSearchParcels();
    }
    
    // 검색이 시작되면 checkMapInterval 클리어
    if (checkMapInterval) {
        console.log('⏹️ checkMapInterval 정리');
        clearInterval(checkMapInterval);
        checkMapInterval = null;
    }
    
    // 검색 모드에서 기존 필지 숨기기
    console.log('👻 기존 필지 숨기기 실행');
    hideExistingParcels();
    
    // map 객체 확인
    console.log('🗺️ window.map 확인:', window.map);
    if (!window.map) {
        console.error('❌ 지도가 초기화되지 않았습니다.');
        alert('지도가 아직 로딩 중입니다. 잠시 후 다시 시도해주세요.');
        return;
    }
    
    // 네이버 지도 Service 확인
    console.log('📡 naver.maps.Service 확인:', naver?.maps?.Service);
    if (!naver || !naver.maps || !naver.maps.Service) {
        console.error('❌ 네이버 지도 API가 로드되지 않았습니다.');
        alert('지도 API가 로딩 중입니다. 잠시 후 다시 시도해주세요.');
        return;
    }
    
    console.log('✅ 사전 확인 완료, 지오코딩 API 호출 시작');
    
    // 네이버 Geocoding API로 주소 검색
    try {
        naver.maps.Service.geocode({
            query: query
        }, function(status, response) {
            console.log('Geocoding 상태:', status);
            console.log('Geocoding 응답:', response);
            
            if (status !== naver.maps.Service.Status.OK) {
                console.log('Geocoding 실패, 지번 검색 시도');
                // Geocoding 실패 시 지번 검색 시도
                searchParcelByJibun(query);
                return;
            }
            
            const result = response.v2.addresses[0];
            if (!result) {
                console.log('주소 결과 없음, 지번 검색 시도');
                searchParcelByJibun(query);
                return;
            }
            
            // 좌표 변환
            const lat = parseFloat(result.y);
            const lng = parseFloat(result.x);
            const point = new naver.maps.LatLng(lat, lng);
            
            console.log('주소 검색 성공:', result);
            console.log('좌표:', lat, lng);
            
            if (result && result.addressElements) {
                const addressElements = result.addressElements;
                let fullAddress = '';
                
                addressElements.forEach(element => {
                    if (element.longName && element.types.includes('POSTAL_CODE') === false) {
                        fullAddress += element.longName + ' ';
                    }
                });
                
                const item = {
                    address: fullAddress.trim(),
                    point: point
                };
                
                console.log('주소 검색 성공:', item);
                
                // 지도 이동
                window.map.setCenter(point);
                window.map.setZoom(18);
                
                // 해당 위치의 필지를 검색용으로 조회 (노란색 표시)
                searchParcelAtLocation(point.lat(), point.lng());
            }
        });
    } catch (error) {
        console.error('주소 검색 실패:', error);
        alert('검색 중 오류가 발생했습니다.');
    }
}

// 지번으로 필지 검색
async function searchParcelByJibun(jibun) {
    console.log('지번 검색 시작:', jibun);
    
    // map 객체 확인
    if (!window.map) {
        console.error('지도가 초기화되지 않았습니다.');
        alert('지도가 아직 로딩 중입니다. 잠시 후 다시 시도해주세요.');
        return;
    }
    
    // 더 넓은 범위로 검색 - 서울 전체 영역
    const center = window.map.getCenter();
    const centerLat = center.lat();
    const centerLng = center.lng();
    
    // 검색 범위를 크게 확장 (약 50km 반경)
    const expandedBounds = {
        minLat: centerLat - 0.45,  
        maxLat: centerLat + 0.45,
        minLng: centerLng - 0.45,  
        maxLng: centerLng + 0.45
    };
    
    // JSONP 방식으로 API 호출
    const apiKey = '8C62256B-1D08-32FF-AB3C-1FCD67242196';
    const callbackName = `searchCallback_${Date.now()}`;
    
    return new Promise((resolve) => {
        window[callbackName] = function(data) {
            console.log('지번 검색 API 응답:', data);
            
            // 콜백 함수 정리
            delete window[callbackName];
            document.head.removeChild(script);
            
            if (!data.response || data.response.status !== 'OK' || !data.response.result?.featureCollection?.features) {
                console.log('해당 지번의 필지를 찾을 수 없습니다.');
                alert('해당 지번의 필지를 찾을 수 없습니다.');
                resolve();
                return;
            }
            
            const features = data.response.result.featureCollection.features;
            
            // 지번으로 필터링
            const matchingParcels = features.filter(feature => {
                const properties = feature.properties;
                const parcelJibun = formatJibun(properties);
                const searchJibun = jibun.replace(/\s/g, '').toLowerCase();
                const targetJibun = parcelJibun.replace(/\s/g, '').toLowerCase();
                
                console.log('지번 비교:', {
                    search: searchJibun,
                    target: targetJibun,
                    match: targetJibun.includes(searchJibun) || searchJibun.includes(targetJibun)
                });
                
                return targetJibun.includes(searchJibun) || searchJibun.includes(targetJibun);
            });
            
            console.log('매칭된 필지 수:', matchingParcels.length);
            
            if (matchingParcels.length === 0) {
                alert('해당 지번의 필지를 찾을 수 없습니다.');
                resolve();
                return;
            }
            
            // 첫 번째 매칭 필지로 지도 이동
            const firstFeature = matchingParcels[0];
            if (firstFeature.geometry && firstFeature.geometry.coordinates) {
                const coords = firstFeature.geometry.type === 'MultiPolygon' 
                    ? firstFeature.geometry.coordinates[0][0]
                    : firstFeature.geometry.coordinates[0];
                const center = calculatePolygonCenter(coords);
                window.map.setCenter(new naver.maps.LatLng(center[1], center[0]));
                window.map.setZoom(18);
                
                console.log('지도 이동 완료:', center);
            }
            
            // 모든 매칭 필지를 검색 결과로 하이라이트
            matchingParcels.forEach(parcel => {
                highlightParcel(parcel);
            });
            
            console.log(`${matchingParcels.length}개 필지 하이라이트 완료`);
            resolve();
        };
        
        // 타임아웃 처리
        const timeout = setTimeout(() => {
            if (window[callbackName]) {
                delete window[callbackName];
                console.error('지번 검색 타임아웃');
                alert('검색 시간이 초과되었습니다.');
                resolve();
            }
        }, 10000);
        
        // JSONP 스크립트 추가
        const script = document.createElement('script');
        script.src = `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=LP_PA_CBND_BUBUN&key=${apiKey}&geometry=true&geomFilter=BOX(${expandedBounds.minLng},${expandedBounds.minLat},${expandedBounds.maxLng},${expandedBounds.maxLat})&size=1000&format=json&crs=EPSG:4326&callback=${callbackName}&domain=http://localhost:3000`;
        script.onerror = () => {
            clearTimeout(timeout);
            delete window[callbackName];
            console.error('지번 검색 스크립트 로드 실패');
            alert('검색 중 오류가 발생했습니다.');
            resolve();
        };
        document.head.appendChild(script);
    });
}

// 두 번째 highlightParcel 함수는 첫 번째 함수와 중복되므로 제거됨
// 첫 번째 highlightParcel 함수 (line 29)를 사용하세요

// 검색 결과 하이라이트 함수는 더 이상 사용하지 않음 - 필지만 표시

// VWorld API로 실제 필지 데이터 가져오기
async function getParcelForSearch(lat, lng) {
    console.log(`🏢 검색용 실제 필지 정보 조회 시작: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    
    const apiKeys = [
        'BBAC532E-A56D-34CF-B520-CE68E8D6D52A',
        'E5B1657B-9B6F-3A4B-91EF-98512BE931A1',
        '6B854F88-4A5D-303C-B7C8-40858117A95E',
        'CEB6F0C2-8D2C-3F1A-B9B0-3F7E8D4C6A50'
    ];
    
    // JSONP를 우선적으로 시도
    for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = apiKeys[i];
        console.log(`🔑 검색용 JSONP 시도 - API 키 ${i+1}/${apiKeys.length}`);
        
        try {
            const result = await new Promise((resolve) => {
                const callbackName = `vworld_search_callback_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                
                window[callbackName] = function(data) {
                    delete window[callbackName];
                    const script = document.querySelector(`script[src*="${callbackName}"]`);
                    if (script) script.remove();
                    
                    if (data && data.response && data.response.status === 'OK') {
                        const features = data.response.result?.featureCollection?.features;
                        if (features && features.length > 0) {
                            console.log('🎊 검색용 필지 데이터 획득 성공!');
                            resolve(features[0]); // 첫 번째 필지 반환
                        } else {
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                };
                
                const script = document.createElement('script');
                script.src = `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=LP_PA_CBND_BUBUN&key=${apiKey}&geometry=true&geomFilter=POINT(${lng} ${lat})&size=1&format=json&crs=EPSG:4326&callback=${callbackName}&domain=http://localhost:3000`;
                script.onerror = () => {
                    delete window[callbackName];
                    script.remove();
                    resolve(null);
                };
                
                document.head.appendChild(script);
                
                // 타임아웃 설정
                setTimeout(() => {
                    if (window[callbackName]) {
                        delete window[callbackName];
                        script.remove();
                        resolve(null);
                    }
                }, 3000);
            });
            
            if (result) {
                return result;
            }
        } catch (error) {
            console.log(`⚠️ 검색용 API 키 ${i+1} 실패:`, error);
        }
    }
    
    console.log('❌ 모든 검색용 API 키 실패');
    return null;
}

// Nominatim API로 특정 위치의 주소 정보 검색
async function searchParcelAtLocation(lat, lng) {
    console.log('🎯 위치 기반 필지 검색 시작:', lat, lng);
    
    try {
        // VWorld API로 실제 필지 데이터 가져오기
        const parcelData = await getParcelForSearch(lat, lng);
        
        if (parcelData) {
            console.log('✅ 실제 필지 데이터를 찾았습니다. 하이라이트 시작...');
            highlightParcel(parcelData);
            console.log('🎉 필지 하이라이트 완료');
        } else {
            // VWorld에서 못 찾으면 Nominatim으로 대체
            console.log('⚠️ VWorld에서 필지를 찾지 못해 Nominatim으로 대체합니다.');
            
            const apiUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
            console.log('📡 Nominatim API 요청 URL:', apiUrl);
            
            const response = await fetch(apiUrl, {
                headers: {
                    'User-Agent': 'NAVER Maps Field Management Program'
                }
            });
            
            if (!response.ok) {
                throw new Error('Nominatim API 요청 실패');
            }
            
            const data = await response.json();
            console.log('📋 Nominatim 위치 검색 응답:', data);
            
            if (data && data.address) {
                console.log('✅ 위치 정보를 찾았습니다. 하이라이트 시작...');
                
                // Nominatim 응답을 필지 형태로 변환 (더 큰 폴리곤으로)
                const parcel = createParcelFromNominatimForSearch(data, lat, lng);
                console.log('🎨 생성된 필지 데이터:', parcel);
                
                highlightParcel(parcel);
                console.log('🎉 1개 위치 하이라이트 완료');
            } else {
                console.warn('❌ 해당 위치에서 주소 정보를 찾을 수 없습니다.');
                alert('해당 위치에서 주소 정보를 찾을 수 없습니다.');
            }
        }
    } catch (error) {
        console.error('💥 위치 기반 필지 검색 실패:', error);
        alert('필지 검색 중 오류가 발생했습니다.');
    }
}

// Nominatim 응답을 검색용 필지 형태로 변환
function createParcelFromNominatimForSearch(nominatimData, lat, lng) {
    const address = nominatimData.address || {};
    const displayName = nominatimData.display_name || '';
    
    // 한국 주소 체계에 맞는 지번 생성
    const dong = address.quarter || address.suburb || address.neighbourhood || '';
    const roadName = address.road || '';
    const houseNumber = address.house_number || '';
    
    // 지번 형식으로 변환
    let jibun = '';
    if (dong && houseNumber) {
        jibun = `${dong} ${houseNumber}`;
    } else if (roadName && houseNumber) {
        jibun = `${roadName} ${houseNumber}`;
    } else if (displayName) {
        const parts = displayName.split(',');
        jibun = parts[0].trim();
    } else {
        jibun = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    }
    
    // 다각형 생성 (중심점 주변 사각형)
    const size = 0.0005; // 약 50m (실제 필지 못 찾을 때 대체용)
    const coordinates = [
        [[
            [lng - size, lat - size],
            [lng + size, lat - size], 
            [lng + size, lat + size],
            [lng - size, lat + size],
            [lng - size, lat - size]
        ]]
    ];
    
    return {
        geometry: {
            type: "MultiPolygon",
            coordinates: coordinates
        },
        properties: {
            JIBUN: jibun,
            PNU: `OSM_${nominatimData.place_id || Date.now()}`,
            ADDR: displayName,
            sggnm: address.borough || address.county || '',
            ldong: dong,
            lnbrMnnm: houseNumber
        }
    };
}


// 기존 필지 숨기기
function hideExistingParcels() {
    console.log('hideExistingParcels 호출, parcels 크기:', window.parcels?.size || 0);
    
    if (!window.parcels || window.parcels.size === 0) {
        console.log('숨길 기존 필지가 없음');
        return;
    }
    
    hiddenParcels = [];
    let hideCount = 0;
    
    window.parcels.forEach((parcelData, pnu) => {
        if (parcelData.polygon && parcelData.polygon.getMap()) {
            // 현재 상태 저장
            hiddenParcels.push({
                pnu: pnu,
                polygon: parcelData.polygon,
                visible: true
            });
            
            // 지도에서 제거
            parcelData.polygon.setMap(null);
            hideCount++;
            console.log(`필지 ${hideCount} 숨김 완료: ${pnu}`);
        }
    });
    
    console.log(`${hideCount}개 기존 필지 숨김 완료`);
}

// 기존 필지 복원
function showExistingParcels() {
    console.log('showExistingParcels 호출, hiddenParcels 수:', hiddenParcels.length);
    
    if (hiddenParcels.length === 0) {
        console.log('복원할 필지가 없음');
        return;
    }
    
    let restoreCount = 0;
    hiddenParcels.forEach((item, index) => {
        if (item.visible && item.polygon) {
            item.polygon.setMap(window.map);
            restoreCount++;
            console.log(`필지 ${index + 1} 복원 완료`);
        }
    });
    
    console.log(`기존 필지 ${restoreCount}개 복원 완료`);
    hiddenParcels = [];
}

// 지도와 API가 로드된 후에 이벤트 리스너 등록
function initSearchEventListeners() {
    console.log('=== search.js 이벤트 리스너 초기화 시작 ===');
    console.log('현재 시간:', new Date().toLocaleString());
    
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    
    console.log('searchBtn 요소:', searchBtn);
    console.log('searchInput 요소:', searchInput);
    
    if (!searchBtn) {
        console.error('❌ searchBtn을 찾을 수 없습니다');
        return;
    }
    
    if (!searchInput) {
        console.error('❌ searchInput을 찾을 수 없습니다');
        return;
    }
    
    console.log('✅ HTML 요소 찾기 성공');
    
    // 검색 버튼
    searchBtn.addEventListener('click', () => {
        console.log('🔍 검색 버튼 클릭됨!');
        console.log('현재 시간:', new Date().toLocaleString());
        const query = searchInput.value.trim();
        console.log('입력된 검색어:', `"${query}"`);
        
        if (query) {
            console.log('✅ 검색어 유효함, searchAddress 함수 호출');
            searchAddress(query);
        } else {
            console.log('❌ 검색어가 비어있음');
            alert('검색어를 입력하세요');
        }
    });
    
    // 엔터키로 검색
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            console.log('엔터키 검색');
            const query = e.target.value.trim();
            if (query) {
                console.log('검색 실행:', query);
                searchAddress(query);
            } else {
                alert('검색어를 입력하세요');
            }
        }
    });
    
    // 검색 토글 버튼 초기 상태 설정
    const searchToggleBtn = document.getElementById('searchToggleBtn');
    if (searchToggleBtn) {
        if (window.currentMode === 'search') {
            searchToggleBtn.textContent = '검색 ON';
            searchToggleBtn.classList.add('active');
        } else {
            searchToggleBtn.textContent = '검색 OFF';
            searchToggleBtn.classList.remove('active');
        }
        
        console.log('검색 토글 버튼 초기 상태 설정 완료. onclick="toggleSearchMode()" 사용');
    } else {
        console.error('searchToggleBtn을 찾을 수 없습니다. DOM 요소 확인:', document.getElementById('searchToggleBtn'));
    }
    
    console.log('🎯 이벤트 리스너 등록 완료');
    console.log('✅ searchBtn 클릭 이벤트:', '등록됨');
    console.log('✅ searchInput 엔터키 이벤트:', '등록됨');
    console.log('=== initSearchEventListeners 완료 ===');
}

// DOMContentLoaded 이벤트
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 search.js DOMContentLoaded 실행');
    console.log('📍 현재 시간:', new Date().toLocaleString());
    
    // 초기 모드 설정 (클릭 모드 = 검색 OFF)
    window.currentMode = 'click';
    window.showClickParcels();
    window.hideSearchParcels();
    
    // 버튼 초기 상태 설정
    const searchToggleBtn = document.getElementById('searchToggleBtn');
    if (searchToggleBtn) {
        searchToggleBtn.textContent = '검색 OFF';
        searchToggleBtn.classList.remove('active');
    }
    
    console.log('🔧 초기 모드 설정: 클릭 모드 (검색 OFF)');
    
    // 지도가 초기화될 때까지 기다림
    console.log('⏳ 지도 및 API 로딩 상태 체크 시작...');
    checkMapInterval = setInterval(() => {
        console.log('🔍 지도 상태 체크:');
        console.log('  - window.map:', !!window.map);
        console.log('  - naver:', !!naver);
        console.log('  - naver.maps:', !!(naver?.maps));
        console.log('  - naver.maps.Service:', !!(naver?.maps?.Service));
        
        if (window.map && naver && naver.maps && naver.maps.Service) {
            clearInterval(checkMapInterval);
            checkMapInterval = null;
            console.log('✅ 지도 및 API 로드 완료, 검색 이벤트 리스너 등록');
            initSearchEventListeners();
        } else {
            console.log('⏳ 지도 또는 API 로딩 대기 중...');
        }
    }, 500);
    
    // 10초 후에도 로드되지 않으면 에러
    setTimeout(() => {
        if (checkMapInterval) {
            clearInterval(checkMapInterval);
            checkMapInterval = null;
            console.error('지도 초기화 시간 초과');
            alert('지도 로딩에 실패했습니다. 페이지를 새로고침해주세요.');
        }
    }, 10000);
});

// 검색 결과 전체 지우기 (parcel.js에서 사용)
function clearAllSearchResults() {
    console.log('검색 결과 전체 지우기');
    
    if (window.searchParcels.size === 0) {
        console.log('지울 검색 결과가 없음');
        return;
    }
    
    window.searchParcels.forEach((result, key) => {
        if (result.polygon) result.polygon.setMap(null);
        if (result.label) result.label.setMap(null);
        // 마커와 정보창은 더 이상 사용하지 않음
    });
    
    window.searchParcels.clear();
    console.log('모든 검색 결과 제거 완료');
    
    // ULTRATHINK: 실시간 ParcelManager 동기화
    // 🎯 ULTRATHINK: ParcelManager UI 제거됨 - 클라우드 백업만 활성
    
    // 검색 결과 삭제 이벤트 발생
    window.dispatchEvent(new CustomEvent('parcelDataSaved', {
        detail: { parcelNumber: null, syncResult: null, action: 'search_clear' }
    }));
}

// 전역 함수로 노출
window.clearAllSearchResults = clearAllSearchResults;