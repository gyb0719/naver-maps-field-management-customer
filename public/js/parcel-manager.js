// 🎯 ULTRATHINK: UI 제거됨 - 클라우드 백업 전용 모드
// ParcelManager UI는 비활성화되고, 데이터는 Supabase + Google Sheets 2중 백업만 사용
class ParcelManager {
    constructor() {
        // UI 관련 기능 모두 비활성화
        this.uiDisabled = true;
        this.parcels = [];
        this.filteredParcels = [];
        this.selectedParcels = new Set();
        this.viewMode = 'grid'; // 'grid' or 'list'
        this.filterBy = 'all'; // 'all', 'red', 'blue', 'green', etc
        this.searchQuery = '';
        this.isPanelOpen = false;
        this.isRendering = false; // 렌더링 중 플래그
        this.isComposing = false; // 한글 조합 중 플래그
        
        // 가상 스크롤 관련
        this.virtualScroller = null;
        this.useVirtualScroll = false; // 🎯 ULTRATHINK: 가상 스크롤 임시 비활성화로 버그 해결
        this.VIRTUAL_SCROLL_THRESHOLD = 10000; // 매우 높은 값으로 설정하여 가상 스크롤 비활성화
        
        this.init();
    }
    
    async init() {
        await this.loadParcels();
        this.setupEventListeners();
        
        // DOM이 준비되었을 때 렌더링 및 통계 업데이트
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.render();
                this.updateStatisticsOnly();
            });
        } else {
            // 이미 DOM이 준비된 경우
            setTimeout(() => {
                this.render();
                this.updateStatisticsOnly();
            }, 100);
        }
        
        // 초기 로드 시 검색 필지 라벨 숨기기
        this.hideSearchLabels();
    }
    
    async loadParcels() {
        // DataManager를 통한 하이브리드 로딩 (localStorage + Supabase)
        let rawParcels = [];
        
        try {
            if (window.dataManager && typeof window.dataManager.loadParcels === 'function') {
                rawParcels = await window.dataManager.loadParcels();
                console.log(`DataManager를 통해 필지 데이터 로드됨:`, rawParcels);
                
                // 객체 형태를 배열로 변환
                if (rawParcels && typeof rawParcels === 'object' && !Array.isArray(rawParcels)) {
                    rawParcels = Object.values(rawParcels);
                }
                
                // 배열이 아닌 경우 빈 배열로 초기화
                if (!Array.isArray(rawParcels)) {
                    rawParcels = [];
                }
                
                console.log(`최종 ${rawParcels.length}개 필지 로드됨`);
            } else {
                // DataManager가 없으면 기존 방식 사용
                const STORAGE_KEY = window.CONFIG && window.CONFIG.STORAGE_KEY ? window.CONFIG.STORAGE_KEY : 'parcelData';
                const saved = localStorage.getItem(STORAGE_KEY);
                rawParcels = saved ? JSON.parse(saved) : [];
                console.log('레거시 모드로 데이터 로드됨');
            }
        } catch (error) {
            console.error('데이터 로드 실패, 기본값 사용:', error);
            rawParcels = [];
        }
        
        // 기존 데이터 형식 변환 (id와 createdAt 추가) - 안전한 처리
        this.parcels = (rawParcels || []).map((parcel, index) => {
            // null 체크 추가
            if (!parcel || typeof parcel !== 'object') {
                console.warn(`Invalid parcel data at index ${index}:`, parcel);
                return null;
            }
            
            return {
                ...parcel,
                id: parcel.id || `parcel_${parcel.pnu || parcel.parcelNumber || 'unknown'}_${index}`,
                createdAt: parcel.createdAt || parcel.timestamp || new Date().toISOString(),
                address: parcel.address || parcel.parcelNumber || parcel.pnu || '주소 없음',
                coordinates: parcel.coordinates || parcel.geometry // geometry를 coordinates로도 참조 가능하게
            };
        }).filter(parcel => parcel !== null); // null 값들 제거
        
        // searchParcels Map의 저장된 데이터도 추가 (중복 제외)
        if (window.searchParcels && window.searchParcels.size > 0) {
            console.log('searchParcels 데이터 추가 시도:', window.searchParcels.size);
            window.searchParcels.forEach((parcelData, pnu) => {
                // 저장된 정보가 있는 검색 필지만 추가
                if (parcelData.savedInfo || parcelData.ownerName || parcelData.ownerAddress || parcelData.memo) {
                    const exists = this.parcels.some(p => p.pnu === pnu);
                    if (!exists) {
                        const jibun = parcelData.data?.properties?.jibun || 
                                     parcelData.data?.properties?.JIBUN || 
                                     (window.formatJibun ? window.formatJibun(parcelData.data?.properties) : '') || 
                                     parcelData.savedInfo?.parcelNumber ||
                                     pnu;
                        
                        const newParcel = {
                            id: `search_${pnu}_${Date.now()}`,
                            pnu: pnu,
                            parcelNumber: jibun,
                            ownerName: parcelData.ownerName || parcelData.savedInfo?.ownerName || '',
                            ownerAddress: parcelData.ownerAddress || parcelData.savedInfo?.ownerAddress || '',
                            ownerContact: parcelData.ownerContact || parcelData.savedInfo?.ownerContact || '',
                            memo: parcelData.memo || parcelData.savedInfo?.memo || '',
                            color: '#9370DB', // 검색 필지는 보라색
                            isSearchParcel: true,
                            geometry: parcelData.data?.geometry,
                            createdAt: parcelData.savedInfo?.timestamp || new Date().toISOString(),
                            address: jibun,
                            coordinates: parcelData.data?.geometry
                        };
                        
                        this.parcels.push(newParcel);
                        console.log('검색 필지 추가됨:', newParcel);
                    }
                }
            });
        }
        
        this.filteredParcels = [...this.parcels];
        
        // 수량 표시 업데이트
        const countEl = document.getElementById('apCount');
        if (countEl) {
            countEl.textContent = this.parcels.length;
        }

        // ViewportRenderer에 필지 데이터 제공
        if (window.viewportRenderer) {
            window.viewportRenderer.setParcels(this.parcels);
        }
    }
    
    async saveParcels() {
        try {
            if (window.dataManager) {
                // DataManager를 통한 하이브리드 저장 (localStorage + Supabase)
                const result = await window.dataManager.save(this.parcels);
                console.log('DataManager 저장 결과:', result);
                
                if (!result.local) {
                    console.error('로컬 저장 실패');
                }
                
                return result;
            } else {
                // DataManager가 없으면 기존 방식 사용
                const STORAGE_KEY = window.CONFIG && window.CONFIG.STORAGE_KEY ? window.CONFIG.STORAGE_KEY : 'parcelData';
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.parcels));
                console.log('레거시 모드로 데이터 저장됨');
                return { local: true, cloud: false };
            }
        } catch (error) {
            console.error('데이터 저장 실패:', error);
            return { local: false, cloud: false, errors: [error.message] };
        }
    }
    
    addParcel(parcel) {
        parcel.id = Date.now().toString();
        parcel.createdAt = new Date().toISOString();
        parcel.tags = [];
        this.parcels.unshift(parcel);
        
        // ViewportRenderer에 필지 추가
        if (window.viewportRenderer) {
            window.viewportRenderer.addParcel(parcel);
        }
        
        this.saveParcels();
        this.applyFilters();
        this.render();
    }
    
    removeParcel(id) {
        this.parcels = this.parcels.filter(p => p.id !== id);
        this.selectedParcels.delete(id);
        
        // ViewportRenderer에서 필지 제거
        if (window.viewportRenderer) {
            window.viewportRenderer.removeParcel(id);
        }
        
        this.saveParcels();
        this.applyFilters();
        this.render();
    }
    
    toggleSelection(id) {
        if (this.selectedParcels.has(id)) {
            this.selectedParcels.delete(id);
        } else {
            this.selectedParcels.add(id);
        }
        this.render();
    }
    
    selectAll() {
        this.filteredParcels.forEach(p => this.selectedParcels.add(p.id));
        this.render();
    }
    
    deselectAll() {
        this.selectedParcels.clear();
        this.render();
    }
    
    deleteSelected() {
        if (this.selectedParcels.size === 0) return;
        if (!confirm(`선택한 ${this.selectedParcels.size}개 필지를 삭제하시겠습니까?`)) return;
        
        this.parcels = this.parcels.filter(p => !this.selectedParcels.has(p.id));
        this.selectedParcels.clear();
        this.saveParcels();
        this.applyFilters();
        this.render();
        
        // 지도에서도 색상 제거
        this.clearMapColors();
    }
    
    // 위험한 전체 데이터 초기화 기능 제거됨 - 안전을 위해 비활성화
    
    // 🎯 ULTRATHINK: 초기화 확인 팝업 (실시간 활동과 동일한 스타일)
    showResetConfirmationPopup() {
        const popup = document.createElement('div');
        popup.id = 'resetConfirmationPopup';
        popup.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                backdrop-filter: blur(5px);
            " onclick="this.remove()">
                <div style="
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                    width: 400px;
                    max-width: 90%;
                    overflow: hidden;
                    border: 1px solid rgba(255,255,255,0.3);
                    animation: slideIn 0.3s ease-out;
                " onclick="event.stopPropagation()">
                    <div style="
                        background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
                        color: white;
                        padding: 16px 20px;
                        font-weight: bold;
                        font-size: 16px;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    ">
                        ⚠️ 전체 초기화 확인
                    </div>
                    
                    <div style="padding: 20px;">
                        <div style="margin-bottom: 16px; line-height: 1.5; color: #333;">
                            <strong style="color: #e74c3c;">경고:</strong> 모든 필지 정보와 색상이 영구적으로 삭제됩니다.<br>
                            <span style="color: #666;">이 작업은 되돌릴 수 없습니다.</span>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #666;">
                                확인을 위해 "<strong>초기화</strong>"를 입력하세요:
                            </label>
                            <input 
                                id="resetConfirmInput" 
                                type="text" 
                                placeholder="초기화"
                                style="
                                    width: 100%;
                                    padding: 10px;
                                    border: 2px solid #ddd;
                                    border-radius: 6px;
                                    font-size: 14px;
                                    box-sizing: border-box;
                                "
                                onkeyup="if(event.key==='Enter' && this.value==='초기화') document.getElementById('confirmResetBtn').click()"
                            />
                        </div>
                        
                        <div style="display: flex; gap: 8px; justify-content: flex-end;">
                            <button onclick="document.getElementById('resetConfirmationPopup').remove()" style="
                                background: #95a5a6;
                                color: white;
                                border: none;
                                padding: 10px 16px;
                                border-radius: 6px;
                                font-size: 14px;
                                cursor: pointer;
                                transition: background 0.2s;
                            " onmouseover="this.style.background='#7f8c8d'" onmouseout="this.style.background='#95a5a6'">
                                취소
                            </button>
                            <button id="confirmResetBtn" onclick="parcelManager.executeReset()" style="
                                background: #e74c3c;
                                color: white;
                                border: none;
                                padding: 10px 16px;
                                border-radius: 6px;
                                font-size: 14px;
                                font-weight: bold;
                                cursor: pointer;
                                transition: background 0.2s;
                            " onmouseover="this.style.background='#c0392b'" onmouseout="this.style.background='#e74c3c'">
                                초기화 실행
                            </button>
                        </div>
                    </div>
                </div>
                
                <style>
                    @keyframes slideIn {
                        from { opacity: 0; transform: scale(0.95) translateY(-10px); }
                        to { opacity: 1; transform: scale(1) translateY(0); }
                    }
                </style>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        // 입력 필드에 포커스
        setTimeout(() => {
            const input = document.getElementById('resetConfirmInput');
            if (input) input.focus();
        }, 100);
    }
    
    // 🎯 ULTRATHINK: 초기화 실행
    executeReset() {
        const input = document.getElementById('resetConfirmInput');
        if (!input || input.value !== '초기화') {
            input.style.borderColor = '#e74c3c';
            input.style.backgroundColor = '#ffeaa7';
            setTimeout(() => {
                input.style.borderColor = '#ddd';
                input.style.backgroundColor = 'white';
            }, 1000);
            return;
        }
        
        // 팝업 제거
        document.getElementById('resetConfirmationPopup').remove();
        
        this.performReset();
    }
    
    // 🎯 ULTRATHINK: 실제 초기화 수행
    performReset() {
        
        // 모든 데이터 삭제
        this.parcels = [];
        this.filteredParcels = [];
        this.selectedParcels.clear();
        
        // LocalStorage 초기화
        const STORAGE_KEY = window.CONFIG && window.CONFIG.STORAGE_KEY ? window.CONFIG.STORAGE_KEY : 'parcelData';
        localStorage.removeItem(STORAGE_KEY);
        
        // 지도에서 모든 색상 제거
        this.clearAllMapColors();
        
        // 검색 필지도 모두 제거 (search.js의 clearAllSearchResults 함수 호출)
        if (typeof window.clearAllSearchResults === 'function') {
            window.clearAllSearchResults();
            console.log('검색 필지도 모두 제거됨');
        } else {
            console.log('clearAllSearchResults 함수를 찾을 수 없음');
        }
        
        // UI 업데이트
        this.render();
        
        // 수량 표시 업데이트
        const countEl = document.getElementById('apCount');
        if (countEl) {
            countEl.textContent = '0';
        }
        
        // 토스트 메시지로 알림
        if (window.showToast) {
            window.showToast('전체 초기화가 완료되었습니다! 🗑️', 'success');
        } else {
            alert('전체 초기화가 완료되었습니다.');
        }
    }
    
    // 전체 필지를 구글 시트로 전송
    async exportAllToGoogleSheets() {
        if (this.parcels.length === 0) {
            if (window.showToast) {
                window.showToast('전송할 필지 데이터가 없습니다.', 'warning');
            } else {
                alert('전송할 필지 데이터가 없습니다.');
            }
            return;
        }
        
        // 지번만 있어도 전송 가능하도록 필터링
        const dataToExport = this.parcels
            .filter(parcel => parcel.parcelNumber && parcel.parcelNumber.trim()) // 지번이 있는 것만
            .map(parcel => ({
                parcelNumber: parcel.parcelNumber || '',
                ownerName: parcel.ownerName || '',
                ownerAddress: parcel.ownerAddress || '',
                ownerContact: parcel.ownerContact || '',
                memo: parcel.memo || ''
            }));
        
        if (dataToExport.length === 0) {
            if (window.showToast) {
                window.showToast('지번이 입력된 필지가 없습니다.', 'warning');
            } else {
                alert('지번이 입력된 필지가 없습니다.');
            }
            return;
        }
        
        // exportToGoogleSheets 함수 호출 (sheets.js의 함수에 데이터 전달)
        if (typeof exportToGoogleSheets === 'function') {
            await exportToGoogleSheets(dataToExport);
        } else {
            alert('구글 시트 연동 기능을 사용할 수 없습니다.');
        }
    }
    
    // 지도에서 색상 제거
    clearMapColors() {
        if (window.parcels) {
            window.parcels.forEach((parcelData) => {
                if (parcelData.polygon) {
                    parcelData.polygon.setOptions({
                        fillColor: 'transparent',
                        fillOpacity: 0
                    });
                    parcelData.color = 'transparent';
                }
            });
        }
    }
    
    // 지도에서 모든 색상 제거
    clearAllMapColors() {
        // 클릭 필지 색상 제거
        if (window.parcels) {
            window.parcels.forEach((parcelData) => {
                if (parcelData.polygon) {
                    parcelData.polygon.setOptions({
                        fillColor: 'transparent',
                        fillOpacity: 0,
                        strokeColor: '#0000FF',
                        strokeOpacity: 0.6,
                        strokeWeight: 0.5
                    });
                    parcelData.color = 'transparent';
                }
            });
        }
        
        // 검색 필지도 지도에서 제거
        if (window.searchParcels) {
            window.searchParcels.forEach((parcelData) => {
                if (parcelData.polygon) {
                    parcelData.polygon.setMap(null);
                }
                if (parcelData.label) {
                    parcelData.label.setMap(null);
                }
            });
            // searchParcels Map 자체는 유지하되, 폴리곤만 제거
            console.log('검색 필지 폴리곤 제거 완료');
        }
    }
    
    search(query) {
        this.searchQuery = query.toLowerCase();
        this.applyFilters();
        this.renderList(); // 리스트만 업데이트
    }
    
    setFilter(filterType) {
        console.log('setFilter 호출됨:', filterType); // 디버깅용
        this.filterBy = filterType;
        
        // 보라색(검색 필지) 필터 처리
        if (filterType === '#9370DB') {
            // 검색 필지 표시 (폴리곤 + 라벨)
            this.showSearchParcelsWithLabels();
        } else {
            // 검색 필지 라벨만 숨기기 (폴리곤은 유지)
            this.hideSearchLabels();
        }
        
        this.applyFilters();
        console.log('필터링 후 필지 개수:', this.filteredParcels.length); // 디버깅용
        this.renderList(); // 리스트만 업데이트
    }
    
    // 검색 필지의 폴리곤과 라벨 모두 표시
    showSearchParcelsWithLabels() {
        if (!window.searchParcels || window.searchParcels.size === 0) {
            console.log('표시할 검색 필지가 없음');
            return;
        }
        
        console.log('🟣 보라색 필터: 검색 필지 표시 시작');
        let showCount = 0;
        
        window.searchParcels.forEach((result, key) => {
            // 폴리곤 표시
            if (result.polygon) {
                result.polygon.setMap(window.map);
                result.polygon.setOptions({
                    fillColor: '#9370DB',
                    fillOpacity: 0.7,
                    strokeColor: '#6A0DAD',
                    strokeWeight: 2
                });
            }
            
            // 라벨 표시
            if (result.label) {
                result.label.setMap(window.map);
                showCount++;
            }
        });
        
        console.log(`✅ ${showCount}개 검색 필지 라벨 표시 완료`);
    }
    
    // 검색 필지의 라벨만 숨기기
    hideSearchLabels() {
        if (!window.searchParcels || window.searchParcels.size === 0) {
            return;
        }
        
        console.log('🔸 다른 필터: 검색 필지 라벨 숨기기');
        let hideCount = 0;
        
        window.searchParcels.forEach((result, key) => {
            // 라벨만 숨기기
            if (result.label) {
                result.label.setMap(null);
                hideCount++;
            }
            
            // 폴리곤은 기본 스타일로 변경
            if (result.polygon && result.polygon.getMap()) {
                result.polygon.setOptions({
                    fillColor: '#9370DB',
                    fillOpacity: 0.3,
                    strokeColor: '#9370DB',
                    strokeWeight: 1
                });
            }
        });
        
        console.log(`✅ ${hideCount}개 검색 필지 라벨 숨김 완료`);
    }
    
    
    applyFilters() {
        console.log('applyFilters 시작 - filterBy:', this.filterBy); // 디버깅용
        console.log('전체 필지 수:', this.parcels.length); // 디버깅용
        
        // 필터링
        this.filteredParcels = this.parcels.filter(parcel => {
            // 검색어 필터
            if (this.searchQuery) {
                const searchIn = [
                    parcel.parcelNumber,
                    parcel.pnu,
                    parcel.ownerName,
                    parcel.ownerAddress,
                    parcel.ownerContact,
                    parcel.memo
                ].join(' ').toLowerCase();
                
                if (!searchIn.includes(this.searchQuery)) {
                    return false;
                }
            }
            
            // 색상 필터
            if (this.filterBy !== 'all') {
                // 디버깅: 각 필지의 색상 확인
                if (this.parcels.length < 10) { // 필지가 적을 때만 로그
                    console.log(`필지 색상 비교: ${parcel.parcelNumber} - color: ${parcel.color}, filterBy: ${this.filterBy}`);
                }
                if (parcel.color !== this.filterBy) {
                    return false;
                }
            }
            
            return true;
        });
        
        // 최신순으로 고정 정렬
        this.filteredParcels.sort((a, b) => {
            return new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp);
        });

        // 가상 스크롤 업데이트
        this.updateVirtualScroll();
    }
    
    togglePanel() {
        // 🎯 ULTRATHINK: UI 제거됨 - 패널 토글 비활성화
        if (this.uiDisabled) {
            console.log('🚫 ParcelManager UI 비활성화 - 패널 토글 스킵');
            return;
        }
        
        this.isPanelOpen = !this.isPanelOpen;
        const panel = document.getElementById('advancedParcelPanel');
        if (panel) {
            panel.classList.toggle('open', this.isPanelOpen);
        }
    }
    
    setViewMode(mode) {
        this.viewMode = mode;
        this.render();
    }
    
    exportSelected() {
        if (this.selectedParcels.size === 0) {
            alert('내보낼 필지를 선택해주세요.');
            return;
        }
        
        const selected = this.parcels.filter(p => this.selectedParcels.has(p.id));
        const csv = this.generateCSV(selected);
        this.downloadCSV(csv, `선택필지_${new Date().toLocaleDateString()}.csv`);
    }
    
    exportAll() {
        if (this.filteredParcels.length === 0) {
            alert('복사할 필지가 없습니다.');
            return;
        }
        
        // 엑셀 붙여넣기용 탭 구분 형식으로 생성 (헤더 제외, 필수 4개 항목만)
        let tableData = this.filteredParcels.map(p => 
            `${p.parcelNumber || ''}\t${p.ownerName || ''}\t${p.ownerAddress || ''}\t${p.ownerContact || ''}`
        ).join('\n');
        
        // 클립보드에 복사
        this.copyToClipboard(tableData);
    }
    
    copyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            const count = this.filteredParcels.length;
            alert(`${count}개의 필지 정보가 클립보드에 복사되었습니다.\n\n엑셀에서 Ctrl+V로 붙여넣기 하세요.`);
        } catch (err) {
            console.error('복사 실패:', err);
            alert('복사에 실패했습니다.');
        } finally {
            document.body.removeChild(textarea);
        }
    }
    
    generateCSV(parcels) {
        let csv = '\uFEFF지번,PNU,소유자이름,소유자주소,연락처,메모,색상,저장일시\n';
        parcels.forEach(p => {
            csv += `"${p.parcelNumber || ''}","${p.pnu || ''}","${p.ownerName || ''}","${p.ownerAddress || ''}","${p.ownerContact || ''}","${p.memo || ''}","${p.color || ''}","${p.createdAt || p.timestamp || ''}"\n`;
        });
        return csv;
    }
    
    downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }
    
    getStatistics() {
        console.log('📊 통계 계산 시작 - 실제 저장된 데이터:', this.parcels.length);
        
        // 실제 저장된 필지 데이터를 기반으로 통계 계산
        let selectedCount = 0; // 클릭으로 선택된 필지
        let searchCount = 0;   // 검색으로 찾은 필지
        
        // 🎯 ULTRATHINK: 색상 기반 완벽 분류 시스템
        const SEARCH_COLORS = ['#9370DB', '#8A2BE2', '#800080']; // 보라색 계열 = 검색 필지
        
        this.parcels.forEach((parcel, index) => {
            const color = parcel.color || '#FF0000'; // 기본값: 빨간색
            
            console.log(`🔍 필지 ${index + 1} 분석:`, {
                parcelNumber: parcel.parcelNumber || parcel.pnu,
                color: color,
                isSearchColor: SEARCH_COLORS.includes(color),
                source: parcel.source || parcel.type
            });
            
            // 🌈 색상 기반 완벽 분류
            if (SEARCH_COLORS.includes(color)) {
                // 보라색 계열 = 검색 필지
                searchCount++;
                console.log(`  ✅ 검색 필지로 분류 (색상: ${color})`);
            } else {
                // 기타 색상 = 선택 필지 (클릭으로 색칠한 필지)
                selectedCount++;
                console.log(`  ✅ 선택 필지로 분류 (색상: ${color})`);
            }
        });
        
        const stats = {
            total: this.parcels.length,
            filtered: this.filteredParcels.length,
            selectedCount: selectedCount,    // 클릭해서 색칠한 필지
            searchCount: searchCount,        // 검색해서 나온 필지
            selected: this.selectedParcels.size,
            byColor: {},
            totalArea: 0
        };
        
        this.parcels.forEach(p => {
            const color = p.color || 'transparent';
            stats.byColor[color] = (stats.byColor[color] || 0) + 1;
            stats.totalArea += parseFloat(p.area) || 0;
        });
        
        // 🎯 ULTRATHINK: 완벽한 통계 검증 시스템
        console.log('📊 ================================');
        console.log('📊 ULTRATHINK 통계 검증 결과:');
        console.log('📊 ================================');
        console.log(`📊 총 필지 수: ${stats.total}개`);
        console.log(`🔴 선택 필지: ${stats.selectedCount}개 (빨간색 등)`);
        console.log(`🟣 검색 필지: ${stats.searchCount}개 (보라색 #9370DB)`);
        console.log(`🎯 필터된 필지: ${stats.filtered}개`);
        console.log('📊 ================================');
        
        // 색상별 상세 분석
        const colorAnalysis = {};
        this.parcels.forEach(parcel => {
            const color = parcel.color || 'unknown';
            colorAnalysis[color] = (colorAnalysis[color] || 0) + 1;
        });
        console.log('🌈 색상별 분석:', colorAnalysis);
        
        return stats;
    }
    
    // 통계만 업데이트하는 메서드
    updateStatisticsOnly() {
        // localStorage에서 데이터 다시 로드
        this.loadParcels();
        
        const stats = this.getStatistics();
        
        // 선택 통계 업데이트 (더 안전한 선택자 사용)
        const statItems = document.querySelectorAll('.pm-stats .stat-item');
        console.log('📈 통계 DOM 요소 찾기:', statItems.length);
        
        if (statItems.length >= 2) {
            // 첫 번째: 선택 필지
            const selectedValueEl = statItems[0].querySelector('.stat-value');
            if (selectedValueEl) {
                selectedValueEl.textContent = stats.selectedCount;
                console.log('✅ 선택 필지 통계 업데이트:', stats.selectedCount);
            }
            
            // 두 번째: 검색 필지  
            const searchValueEl = statItems[1].querySelector('.stat-value');
            if (searchValueEl) {
                searchValueEl.textContent = stats.searchCount;
                console.log('✅ 검색 필지 통계 업데이트:', stats.searchCount);
            }
        } else {
            console.warn('⚠️ 통계 DOM 요소를 찾을 수 없습니다');
        }
        
        console.log('✅ DOM 통계 업데이트 완료:', { 선택: stats.selectedCount, 검색: stats.searchCount });
    }
    
    // 🎯 ULTRATHINK: 완벽한 통계 테스트 함수
    testStatistics() {
        console.log('🧪 ULTRATHINK 통계 테스트 시작...');
        
        // 데이터 재로드
        this.loadParcels();
        
        // 통계 재계산
        const stats = this.getStatistics();
        
        // 실제 화면 통계 업데이트
        this.updateStatisticsOnly();
        
        console.log('🧪 테스트 완료 - 화면 통계가 업데이트되었습니다!');
        return stats;
    }
    
    render() {
        // 🎯 ULTRATHINK: UI 제거됨 - 렌더링 비활성화
        if (this.uiDisabled) {
            console.log('🚫 ParcelManager UI 비활성화 - 렌더링 스킵');
            return;
        }
        
        const container = document.getElementById('parcelManagerContent');
        if (!container) return;
        
        // 필터가 적용된 상태를 유지하기 위해 loadParcels는 제거
        // this.loadParcels(); // 이것이 필터를 초기화시킴
        
        const stats = this.getStatistics();
        
        container.innerHTML = `
            <!-- 헤더 통계 및 내보내기 버튼 -->
            <div class="pm-header">
                <div class="pm-stats">
                    <div class="stat-item">
                        <span class="stat-label">선택</span>
                        <span class="stat-value">${stats.selectedCount}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">검색</span>
                        <span class="stat-value">${stats.searchCount}</span>
                    </div>
                </div>
                <div class="pm-actions">
                    <button onclick="parcelManager.exportAllToGoogleSheets()" class="btn-export-google">
                        구글 시트 전송
                    </button>
                    <button onclick="parcelManager.exportAll()" class="btn-export">
                        엑셀 복사
                    </button>
                    <button onclick="alert('안전을 위해 전체 초기화 기능이 비활성화되었습니다. 색상 초기화 기능을 사용해주세요.')" class="btn-disabled" disabled>
                        전체 초기화 (비활성화)
                    </button>
                </div>
            </div>
            
            <!-- 검색 바 -->
            <div class="pm-search">
                <input type="text" 
                       id="pmSearchInput" 
                       placeholder="검색 (주소, 소유자, 메모...)" 
                       value="${this.searchQuery}">
            </div>
            
            <!-- 필터 -->
            <div class="pm-controls">
                <div class="pm-filters">
                    <button class="filter-btn ${this.filterBy === 'all' ? 'active' : ''}" 
                            data-filter="all">전체</button>
                    <button class="filter-btn ${this.filterBy === '#FF0000' ? 'active' : ''}" 
                            data-filter="#FF0000" 
                            style="background: #FF0000;"></button>
                    <button class="filter-btn ${this.filterBy === '#FFA500' ? 'active' : ''}" 
                            data-filter="#FFA500" 
                            style="background: #FFA500;"></button>
                    <button class="filter-btn ${this.filterBy === '#FFFF00' ? 'active' : ''}" 
                            data-filter="#FFFF00" 
                            style="background: #FFFF00;"></button>
                    <button class="filter-btn ${this.filterBy === '#90EE90' ? 'active' : ''}" 
                            data-filter="#90EE90" 
                            style="background: #90EE90;"></button>
                    <button class="filter-btn ${this.filterBy === '#0000FF' ? 'active' : ''}" 
                            data-filter="#0000FF" 
                            style="background: #0000FF;"></button>
                    <button class="filter-btn ${this.filterBy === '#000000' ? 'active' : ''}" 
                            data-filter="#000000" 
                            style="background: #000000;"></button>
                    <button class="filter-btn ${this.filterBy === '#FFFFFF' ? 'active' : ''}" 
                            data-filter="#FFFFFF" 
                            style="background: #FFFFFF; border: 1px solid #ccc;"></button>
                    <button class="filter-btn ${this.filterBy === '#87CEEB' ? 'active' : ''}" 
                            data-filter="#87CEEB" 
                            style="background: #87CEEB;"></button>
                    <!-- 검색 필지용 보라색 필터 - 구분을 위해 떨어뜨려 배치 -->
                    <div style="width: 15px;"></div>
                    <button class="filter-btn search-filter ${this.filterBy === '#9370DB' ? 'active' : ''}" 
                            data-filter="#9370DB" 
                            style="background: #9370DB; border: 2px solid #6A0DAD;" 
                            title="검색 필지"></button>
                </div>
            </div>
            
            <!-- 일괄 작업 도구 -->
            ${this.selectedParcels.size > 0 ? `
                <div class="pm-bulk-actions">
                    <button onclick="parcelManager.selectAll()">전체선택</button>
                    <button onclick="parcelManager.deselectAll()">선택해제</button>
                    <button onclick="parcelManager.deleteSelected()" class="danger">선택삭제</button>
                    <button onclick="parcelManager.exportSelected()">선택내보내기</button>
                </div>
            ` : ''}
            
            <!-- 필지 목록 -->
            <div id="parcelListContainer" class="pm-list-container" style="height: 500px;">
                ${this.filteredParcels.length === 0 ? `
                    <div class="pm-empty">
                        <div class="empty-icon">—</div>
                        <p class="empty-title">저장된 필지가 없습니다</p>
                        <p class="empty-subtitle">필지를 선택하고 저장 버튼을 눌러주세요</p>
                    </div>
                ` : `<div id="virtualScrollList"></div>`}
            </div>
            
        `;
        
        this.attachEventListeners();
        this.initVirtualScroll();
    }

    // 가상 스크롤 초기화
    initVirtualScroll() {
        // 데이터가 없거나 임계치 이하면 기본 렌더링
        if (this.filteredParcels.length === 0 || 
            this.filteredParcels.length < this.VIRTUAL_SCROLL_THRESHOLD) {
            return;
        }

        const container = document.getElementById('virtualScrollList');
        if (!container) return;

        // 기존 가상 스크롤러 정리
        if (this.virtualScroller) {
            this.virtualScroller.destroy();
        }

        try {
            // 가상 스크롤러 생성
            this.virtualScroller = new VirtualScroller(container, {
                itemHeight: this.viewMode === 'grid' ? 120 : 60,
                overscan: 5,
                renderItem: (item, index) => this.renderVirtualParcelItem(item, index),
                onItemClick: (item, index, event) => this.handleVirtualItemClick(item, index, event),
                className: 'virtual-parcel-item'
            });

            // 데이터 설정
            this.virtualScroller.setItems(this.filteredParcels);
            
            console.log(`가상 스크롤 초기화 완료: ${this.filteredParcels.length}개 항목`);
        } catch (error) {
            console.error('가상 스크롤 초기화 실패:', error);
            // 폴백: 기본 렌더링
            this.renderFallbackList();
        }
    }

    // 가상 스크롤 아이템 렌더링
    renderVirtualParcelItem(parcel, index) {
        const isSelected = this.selectedParcels.has(parcel.id);
        const date = new Date(parcel.createdAt || parcel.timestamp).toLocaleDateString();
        const color = parcel.color || '#ccc';
        
        if (this.viewMode === 'grid') {
            return `
                <div class="pm-card ${isSelected ? 'selected' : ''}" 
                     data-id="${parcel.id}" data-index="${index}">
                    <div class="pm-card-select">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} 
                               data-action="toggle-select">
                    </div>
                    <div class="pm-card-color" style="background: ${color}"></div>
                    <div class="pm-card-content">
                        <h4>${parcel.parcelNumber || '지번 없음'}</h4>
                        <div class="pm-card-info">
                            ${parcel.ownerName ? `<div>👤 ${parcel.ownerName}</div>` : ''}
                            ${parcel.ownerAddress ? `<div>🏠 ${parcel.ownerAddress}</div>` : ''}
                            ${parcel.ownerContact ? `<div>📞 ${parcel.ownerContact}</div>` : ''}
                            ${parcel.memo ? `<div>메모: ${parcel.memo.substring(0, 50)}${parcel.memo.length > 50 ? '...' : ''}</div>` : ''}
                        </div>
                        <p class="pm-card-date">${date}</p>
                    </div>
                    <div class="pm-card-actions">
                        <button data-action="edit" data-id="${parcel.id}" class="btn-edit">수정</button>
                        <button data-action="delete" data-id="${parcel.id}" class="btn-delete">삭제</button>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="pm-list-item ${isSelected ? 'selected' : ''}" 
                     data-id="${parcel.id}" data-index="${index}">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} 
                           data-action="toggle-select">
                    <div class="pm-list-color" style="background: ${color}"></div>
                    <div class="pm-list-content">
                        <span class="pm-list-address">${parcel.parcelNumber || '지번 없음'}</span>
                        <span class="pm-list-owner">${parcel.ownerName || '-'}</span>
                        <span class="pm-list-contact">${parcel.ownerContact || '-'}</span>
                        <span class="pm-list-memo">${parcel.memo ? parcel.memo.substring(0, 30) + '...' : '-'}</span>
                        <span class="pm-list-date">${date}</span>
                    </div>
                    <div class="pm-list-actions">
                        <button data-action="edit" data-id="${parcel.id}" class="btn-edit">수정</button>
                        <button data-action="delete" data-id="${parcel.id}" class="btn-delete">삭제</button>
                    </div>
                </div>
            `;
        }
    }

    // 가상 스크롤 아이템 클릭 처리
    handleVirtualItemClick(item, index, event) {
        const target = event.target;
        const action = target.dataset.action;
        const itemId = item.id;

        switch (action) {
            case 'toggle-select':
                event.stopPropagation();
                this.toggleSelection(itemId);
                break;
            case 'edit':
                event.stopPropagation();
                this.editParcel(itemId);
                break;
            case 'delete':
                event.stopPropagation();
                this.removeParcel(itemId);
                break;
            default:
                // 아이템 클릭 시 지도에서 포커스
                this.focusOnMap(itemId);
                break;
        }
    }

    // 폴백 렌더링 (가상 스크롤 실패 시)
    renderFallbackList() {
        const container = document.getElementById('virtualScrollList');
        if (!container) return;

        container.innerHTML = this.filteredParcels
            .map(parcel => this.renderParcelCard(parcel))
            .join('');
    }

    // 필터 변경 시 가상 스크롤 업데이트
    updateVirtualScroll() {
        if (!this.virtualScroller) {
            this.initVirtualScroll();
            return;
        }

        if (this.filteredParcels.length < this.VIRTUAL_SCROLL_THRESHOLD) {
            // 임계치 이하면 가상 스크롤 비활성화
            this.virtualScroller.destroy();
            this.virtualScroller = null;
            this.renderFallbackList();
        } else {
            // 데이터 업데이트
            this.virtualScroller.setItems(this.filteredParcels);
        }
    }
    
    // 리스트만 업데이트하는 메서드
    renderList() {
        const listContainer = document.querySelector('.pm-list');
        if (!listContainer) return;
        
        listContainer.innerHTML = this.filteredParcels.length === 0 ? `
            <div class="pm-empty">
                <div class="empty-icon">—</div>
                <p class="empty-title">저장된 필지가 없습니다</p>
                <p class="empty-subtitle">필지를 선택하고 저장 버튼을 눌러주세요</p>
            </div>
        ` : this.filteredParcels.map(parcel => this.renderParcelCard(parcel)).join('');
    }
    
    renderParcelCard(parcel) {
        const isSelected = this.selectedParcels.has(parcel.id);
        const date = new Date(parcel.createdAt || parcel.timestamp).toLocaleDateString();
        
        if (this.viewMode === 'grid') {
            return `
                <div class="pm-card ${isSelected ? 'selected' : ''}" 
                     data-id="${parcel.id}"
                     onclick="parcelManager.focusOnMap('${parcel.id}')"
                     style="cursor: pointer;">
                    <div class="pm-card-select">
                        <input type="checkbox" 
                               ${isSelected ? 'checked' : ''} 
                               onclick="event.stopPropagation();"
                               onchange="parcelManager.toggleSelection('${parcel.id}')">
                    </div>
                    <div class="pm-card-color" 
                         style="background: ${parcel.color || '#ccc'}"></div>
                    <div class="pm-card-content">
                        <h4>${parcel.parcelNumber || '지번 없음'}</h4>
                        <div class="pm-card-info">
                            ${parcel.ownerName ? `<div>👤 ${parcel.ownerName}</div>` : ''}
                            ${parcel.ownerAddress ? `<div>🏠 ${parcel.ownerAddress}</div>` : ''}
                            ${parcel.ownerContact ? `<div>📞 ${parcel.ownerContact}</div>` : ''}
                            ${parcel.memo ? `<div>메모: ${parcel.memo.substring(0, 50)}${parcel.memo.length > 50 ? '...' : ''}</div>` : ''}
                        </div>
                        <p class="pm-card-date">${date}</p>
                    </div>
                    <div class="pm-card-actions">
                        <button onclick="parcelManager.editParcel('${parcel.id}')" 
                                title="수정" class="btn-edit">수정</button>
                        <button onclick="parcelManager.removeParcel('${parcel.id}')" 
                                title="삭제" class="btn-delete">삭제</button>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="pm-list-item ${isSelected ? 'selected' : ''}" 
                     data-id="${parcel.id}"
                     onclick="parcelManager.focusOnMap('${parcel.id}')"
                     style="cursor: pointer;">
                    <input type="checkbox" 
                           ${isSelected ? 'checked' : ''} 
                           onclick="event.stopPropagation();"
                           onchange="parcelManager.toggleSelection('${parcel.id}')">
                    <div class="pm-list-color" 
                         style="background: ${parcel.color || '#ccc'}"></div>
                    <div class="pm-list-content">
                        <span class="pm-list-address">${parcel.parcelNumber || '지번 없음'}</span>
                        <span class="pm-list-owner">${parcel.ownerName || '-'}</span>
                        <span class="pm-list-contact">${parcel.ownerContact || '-'}</span>
                        <span class="pm-list-memo">${parcel.memo ? parcel.memo.substring(0, 30) + '...' : '-'}</span>
                        <span class="pm-list-date">${date}</span>
                    </div>
                    <div class="pm-list-actions">
                        <button onclick="parcelManager.editParcel('${parcel.id}')" class="btn-edit" title="수정">수정</button>
                        <button onclick="parcelManager.removeParcel('${parcel.id}')" class="btn-delete" title="삭제">삭제</button>
                    </div>
                </div>
            `;
        }
    }
    
    focusOnMap(id) {
        const parcel = this.parcels.find(p => p.id === id);
        if (!parcel || !window.map) return;
        
        const geometry = parcel.geometry || parcel.coordinates;
        if (!geometry) return;
        
        // geometry에서 좌표 추출
        if (geometry.type === 'Polygon' && geometry.coordinates && geometry.coordinates[0]) {
            const coords = geometry.coordinates[0];
            let sumLat = 0, sumLng = 0, count = 0;
            
            coords.forEach(coord => {
                // [lng, lat] 형식
                sumLat += coord[1];
                sumLng += coord[0];
                count++;
            });
            
            if (count > 0) {
                const center = new naver.maps.LatLng(sumLat / count, sumLng / count);
                window.map.setCenter(center);
                window.map.setZoom(18);
            }
        } else if (Array.isArray(geometry)) {
            // 이전 형식 호환
            let sumLat = 0, sumLng = 0, count = 0;
            geometry.forEach(coord => {
                sumLat += coord.lat || coord[1];
                sumLng += coord.lng || coord[0];
                count++;
            });
            
            if (count > 0) {
                const center = new naver.maps.LatLng(sumLat / count, sumLng / count);
                window.map.setCenter(center);
                window.map.setZoom(18);
            }
        }
        
        // 패널 닫기
        this.togglePanel();
    }
    
    editParcel(id) {
        const parcel = this.parcels.find(p => p.id === id);
        if (!parcel) return;
        
        // 폼에 데이터 채우기
        document.getElementById('parcelNumber').value = parcel.parcelNumber || '';
        document.getElementById('ownerName').value = parcel.ownerName || '';
        document.getElementById('ownerAddress').value = parcel.ownerAddress || '';
        document.getElementById('ownerContact').value = parcel.ownerContact || '';
        document.getElementById('memo').value = parcel.memo || '';
        
        // 색상 선택
        if (parcel.color) {
            const colorBtn = document.querySelector(`.color-item[data-color="${parcel.color}"]`);
            if (colorBtn) colorBtn.click();
        }
        
        // 지도 포커스
        this.focusOnMap(id);
    }
    
    attachEventListeners() {
        // 검색
        const searchInput = document.getElementById('pmSearchInput');
        if (searchInput && !searchInput.hasAttribute('data-listener-attached')) {
            searchInput.setAttribute('data-listener-attached', 'true');
            
            // 한글 조합 시작
            searchInput.addEventListener('compositionstart', () => {
                this.isComposing = true;
            });
            
            // 한글 조합 종료
            searchInput.addEventListener('compositionend', (e) => {
                this.isComposing = false;
                if (!this.isRendering) {
                    this.search(e.target.value);
                }
            });
            
            // 일반 입력 처리
            searchInput.addEventListener('input', (e) => {
                // 렌더링 중이거나 한글 조합 중이 아닐 때만 처리
                if (!this.isRendering && !this.isComposing) {
                    this.search(e.target.value);
                }
            });
        }
        
        // 필터 - 이벤트 핸들러 수정 (중복 방지)
        document.querySelectorAll('.filter-btn').forEach(btn => {
            if (!btn.hasAttribute('data-listener-attached')) {
                btn.setAttribute('data-listener-attached', 'true');
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // currentTarget을 사용하여 정확한 버튼 요소 가져오기
                    const filterValue = e.currentTarget.getAttribute('data-filter');
                    console.log('필터 클릭:', filterValue); // 디버깅용
                    
                    if (filterValue) {
                        this.setFilter(filterValue);
                    }
                });
            }
        });
        
        // 정렬
        const sortSelect = document.getElementById('pmSortSelect');
        if (sortSelect && !sortSelect.hasAttribute('data-listener-attached')) {
            sortSelect.setAttribute('data-listener-attached', 'true');
            sortSelect.addEventListener('change', (e) => {
                this.setSortBy(e.target.value);
            });
        }
    }
    
    setupEventListeners() {
        // 외부에서 필지 추가 이벤트 리스닝
        window.addEventListener('parcelAdded', (e) => {
            this.loadParcels();  // 데이터 변경 시에만 로드
            this.addParcel(e.detail);
        });
        
        // 외부에서 필지 목록 갱신 요청
        window.addEventListener('refreshParcelList', () => {
            this.loadParcels();
            this.applyFilters();
            this.render();
        });
        
        // 🎯 ULTRATHINK: 저장 후 실시간 동기화 이벤트
        window.addEventListener('parcelDataSaved', (e) => {
            console.log('🚨 parcelDataSaved 이벤트 수신:', e.detail);
            console.log('🔄 ParcelManager 즉시 갱신 시작...');
            
            try {
                // 1. 데이터 재로드
                this.loadParcels();
                console.log('📋 데이터 재로드 완료');
                
                // 2. 필터 재적용  
                this.applyFilters();
                console.log('🔍 필터 재적용 완료');
                
                // 3. 화면 렌더링
                this.render();
                console.log('🖼️ 화면 렌더링 완료');
                
                // 4. 통계 업데이트
                this.updateStatisticsOnly();
                console.log('📊 통계 업데이트 완료');
                
                console.log('✅ 실시간 동기화 완료! 우측 필지 목록이 즉시 갱신되었습니다.');
                
            } catch (error) {
                console.error('❌ 실시간 동기화 중 오류:', error);
            }
        });
    }
}

// 🎯 ULTRATHINK: ParcelManager UI 완전 비활성화 - Supabase + Google Sheets 2중 백업 전용
// window.parcelManager = new ParcelManager();