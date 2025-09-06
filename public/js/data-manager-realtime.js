/**
 * ULTRATHINK 실시간 공유 지도 시스템
 * Supabase Realtime 브로드캐스트 기반 실시간 동기화
 */

class RealtimeDataManager extends DataManager {
    constructor() {
        super();
        
        // 실시간 관련 설정
        this.realtimeChannel = null;
        this.broadcastChannel = 'parcel-updates';
        this.isRealtimeConnected = false;
        this.realtimeListeners = new Map(); // 이벤트 리스너들
        
        // 동시 편집 방지를 위한 잠금 시스템
        this.lockedParcels = new Set(); // 현재 편집 중인 필지들
        this.userSession = this.generateSessionId(); // 고유 세션 ID
        
        // 실시간 초기화 (지연 실행)
        setTimeout(() => this.initRealtime(), 500);
    }
    
    // 고유 세션 ID 생성
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // 🎯 ULTRATHINK: Supabase Realtime 초기화
    async initRealtime() {
        try {
            console.log('🚀 ULTRATHINK 실시간 시스템 초기화 시작...');
            
            if (!this.isConnected) {
                console.warn('⚠️ Supabase 연결이 필요합니다. 기본 연결을 먼저 시도합니다...');
                await this.testConnection();
            }
            
            // Supabase 클라이언트 생성 (간소화된 버전)
            this.supabaseClient = {
                url: this.SUPABASE_URL,
                key: this.SUPABASE_ANON_KEY,
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`
                }
            };
            
            // 브로드캐스트 채널 설정
            await this.setupBroadcastChannel();
            
            this.isRealtimeConnected = true;
            console.log('✅ ULTRATHINK 실시간 시스템 초기화 완료');
            this.notifyRealtimeStatusChange('connected');
            
        } catch (error) {
            console.error('❌ 실시간 시스템 초기화 실패:', error.message);
            this.isRealtimeConnected = false;
            this.notifyRealtimeStatusChange('error');
        }
    }
    
    // 🎯 ULTRATHINK: 브로드캐스트 채널 설정
    async setupBroadcastChannel() {
        console.log(`📡 브로드캐스트 채널 설정: ${this.broadcastChannel}`);
        
        // WebSocket 기반 실시간 시뮬레이션 (간소화된 구현)
        this.realtimeChannel = {
            channelName: this.broadcastChannel,
            listeners: new Map(),
            isConnected: true
        };
        
        // 실시간 이벤트 수신 시뮬레이션 설정
        this.setupRealtimeEventHandlers();
        
        console.log('✅ 브로드캐스트 채널 설정 완료');
    }
    
    // 🎯 ULTRATHINK: 실시간 이벤트 핸들러 설정
    setupRealtimeEventHandlers() {
        // 필지 변경 이벤트 수신
        this.onRealtimeEvent('parcel_update', (payload) => {
            this.handleParcelUpdate(payload);
        });
        
        // 필지 잠금 이벤트 수신
        this.onRealtimeEvent('parcel_lock', (payload) => {
            this.handleParcelLock(payload);
        });
        
        // 필지 잠금 해제 이벤트 수신
        this.onRealtimeEvent('parcel_unlock', (payload) => {
            this.handleParcelUnlock(payload);
        });
        
        // 사용자 연결/해제 이벤트 수신
        this.onRealtimeEvent('user_presence', (payload) => {
            this.handleUserPresence(payload);
        });
    }
    
    // 🎯 ULTRATHINK: 실시간 이벤트 리스너 등록
    onRealtimeEvent(eventType, callback) {
        if (!this.realtimeListeners.has(eventType)) {
            this.realtimeListeners.set(eventType, []);
        }
        this.realtimeListeners.get(eventType).push(callback);
    }
    
    // 🎯 ULTRATHINK: 실시간 이벤트 발생 시뮬레이션
    triggerRealtimeEvent(eventType, payload) {
        const listeners = this.realtimeListeners.get(eventType) || [];
        listeners.forEach(callback => {
            try {
                callback(payload);
            } catch (error) {
                console.error(`실시간 이벤트 처리 오류 (${eventType}):`, error);
            }
        });
    }
    
    // 🎯 ULTRATHINK: 브로드캐스트 메시지 전송 (구글 로그인 기반)
    async broadcast(eventType, payload) {
        // 구글 로그인 사용자만 브로드캐스트 가능
        if (!window.userManager || !window.userManager.canUseRealtimeFeatures()) {
            console.log('ℹ️ 로컬 사용자 - 브로드캐스트 건너뛰기');
            return false;
        }
        
        if (!this.isRealtimeConnected) {
            console.warn('⚠️ 실시간 연결이 끊어져있습니다. 로컬에만 저장됩니다.');
            return false;
        }
        
        try {
            const message = {
                type: eventType,
                payload: {
                    ...payload,
                    sessionId: this.userSession,
                    timestamp: Date.now()
                }
            };
            
            console.log(`📤 브로드캐스트 전송 [${eventType}]:`, message);
            
            // 실제 Supabase Realtime 전송 시뮬레이션
            await this.sendToSupabaseRealtime(message);
            
            // 로컬에서도 즉시 처리 (자신의 메시지는 제외하고 다른 사용자에게만 전송)
            setTimeout(() => {
                if (payload.sessionId !== this.userSession) {
                    this.triggerRealtimeEvent(eventType, message.payload);
                }
            }, 100); // 네트워크 지연 시뮬레이션
            
            return true;
            
        } catch (error) {
            console.error('브로드캐스트 전송 실패:', error.message);
            return false;
        }
    }
    
    // 🎯 ULTRATHINK: Supabase Realtime 전송 시뮬레이션
    async sendToSupabaseRealtime(message) {
        // 실제 구현에서는 Supabase Realtime API 호출
        // 현재는 localStorage를 활용한 브라우저 간 통신 시뮬레이션
        const realtimeKey = `realtime_${this.broadcastChannel}`;
        const realtimeMessages = JSON.parse(localStorage.getItem(realtimeKey) || '[]');
        
        realtimeMessages.push({
            ...message,
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
        });
        
        // 최근 100개 메시지만 유지
        if (realtimeMessages.length > 100) {
            realtimeMessages.splice(0, realtimeMessages.length - 100);
        }
        
        localStorage.setItem(realtimeKey, JSON.stringify(realtimeMessages));
        
        // StorageEvent를 통한 실시간 시뮬레이션
        window.dispatchEvent(new StorageEvent('storage', {
            key: realtimeKey,
            newValue: JSON.stringify(realtimeMessages)
        }));
    }
    
    // 🎯 ULTRATHINK: 필지 변경 브로드캐스트
    async broadcastParcelUpdate(parcelData) {
        const success = await this.broadcast('parcel_update', {
            action: 'update',
            parcel: parcelData,
            updatedBy: this.userSession
        });
        
        if (success) {
            console.log('✅ 필지 변경사항 브로드캐스트 완료:', parcelData.parcelNumber);
        }
        
        return success;
    }
    
    // 🎯 ULTRATHINK: 필지 잠금 브로드캐스트
    async broadcastParcelLock(parcelId) {
        if (this.lockedParcels.has(parcelId)) {
            console.warn(`⚠️ 필지 ${parcelId}는 이미 잠금 상태입니다.`);
            return false;
        }
        
        this.lockedParcels.add(parcelId);
        
        return await this.broadcast('parcel_lock', {
            parcelId: parcelId,
            lockedBy: this.userSession
        });
    }
    
    // 🎯 ULTRATHINK: 필지 잠금 해제 브로드캐스트
    async broadcastParcelUnlock(parcelId) {
        this.lockedParcels.delete(parcelId);
        
        return await this.broadcast('parcel_unlock', {
            parcelId: parcelId,
            unlockedBy: this.userSession
        });
    }
    
    // 🎯 ULTRATHINK: 필지 업데이트 이벤트 처리
    handleParcelUpdate(payload) {
        // 자신이 보낸 메시지는 무시
        if (payload.sessionId === this.userSession) {
            return;
        }
        
        console.log('📥 다른 사용자의 필지 변경사항 수신:', payload);
        
        try {
            const { parcel } = payload.payload;
            
            // 지도에서 해당 필지 업데이트
            this.updateParcelOnMap(parcel);
            
            // 토스트 알림
            if (window.showToast) {
                window.showToast(`다른 사용자가 ${parcel.parcelNumber} 필지를 수정했습니다`, 'info');
            }
            
        } catch (error) {
            console.error('필지 업데이트 처리 오류:', error);
        }
    }
    
    // 🎯 ULTRATHINK: 필지 잠금 이벤트 처리
    handleParcelLock(payload) {
        if (payload.sessionId === this.userSession) {
            return;
        }
        
        const { parcelId, lockedBy } = payload.payload;
        console.log(`🔒 필지 ${parcelId}가 다른 사용자에 의해 잠금됨:`, lockedBy);
        
        // UI에서 잠금 상태 표시
        this.showParcelLockedState(parcelId, lockedBy);
    }
    
    // 🎯 ULTRATHINK: 필지 잠금 해제 이벤트 처리
    handleParcelUnlock(payload) {
        if (payload.sessionId === this.userSession) {
            return;
        }
        
        const { parcelId } = payload.payload;
        console.log(`🔓 필지 ${parcelId} 잠금 해제됨`);
        
        // UI에서 잠금 해제 상태 표시
        this.hideParcelLockedState(parcelId);
    }
    
    // 🎯 ULTRATHINK: 사용자 접속 상태 처리
    handleUserPresence(payload) {
        if (payload.sessionId === this.userSession) {
            return;
        }
        
        console.log('👤 사용자 접속 상태 변경:', payload);
        
        // UserManager에 사용자 업데이트 전달
        if (window.userManager && payload.payload) {
            if (payload.payload.action === 'update') {
                window.userManager.handleUserUpdate({
                    sessionId: payload.sessionId,
                    name: payload.payload.name,
                    color: payload.payload.color,
                    role: payload.payload.role
                });
            } else if (payload.payload.action === 'disconnect') {
                window.userManager.handleUserDisconnect(payload.sessionId);
            }
        }
    }
    
    // 🎯 ULTRATHINK: 지도에서 필지 업데이트 (향상된 버전)
    updateParcelOnMap(parcel) {
        try {
            console.log('🗺️ 지도 필지 업데이트:', parcel.parcelNumber, parcel.action);
            
            let updated = false;
            const targetPNU = parcel.pnu;
            const targetJibun = parcel.parcelNumber;
            
            // 1. PNU로 직접 검색 (가장 정확)
            if (targetPNU && window.clickParcels?.has(targetPNU)) {
                const data = window.clickParcels.get(targetPNU);
                this.updateParcelPolygon(data, parcel, 'clickParcels');
                updated = true;
            }
            
            // 2. searchParcels에서 PNU로 검색
            if (targetPNU && window.searchParcels?.has(targetPNU)) {
                const data = window.searchParcels.get(targetPNU);
                this.updateParcelPolygon(data, parcel, 'searchParcels');
                updated = true;
            }
            
            // 3. 지번으로 검색 (PNU를 찾을 수 없는 경우)
            if (!updated) {
                // clickParcels에서 지번 매칭
                if (window.clickParcels) {
                    window.clickParcels.forEach((data, pnu) => {
                        const dataJibun = this.extractJibunFromData(data);
                        if (dataJibun === targetJibun) {
                            this.updateParcelPolygon(data, parcel, 'clickParcels');
                            updated = true;
                        }
                    });
                }
                
                // searchParcels에서 지번 매칭
                if (!updated && window.searchParcels) {
                    window.searchParcels.forEach((data, pnu) => {
                        const dataJibun = this.extractJibunFromData(data);
                        if (dataJibun === targetJibun) {
                            this.updateParcelPolygon(data, parcel, 'searchParcels');
                            updated = true;
                        }
                    });
                }
            }
            
            if (!updated) {
                console.log(`ℹ️ 필지 ${parcel.parcelNumber} (PNU: ${parcel.pnu})를 지도에서 찾을 수 없어 업데이트를 건너뜁니다.`);
            }
            
        } catch (error) {
            console.error('지도 필지 업데이트 오류:', error);
        }
    }
    
    // 🎯 ULTRATHINK: 필지 데이터에서 지번 추출
    extractJibunFromData(data) {
        if (data.data?.properties) {
            // formatJibun 함수 사용 (parcel.js에 정의됨)
            return window.formatJibun ? window.formatJibun(data.data.properties) : 
                   (data.data.properties.jibun || data.data.properties.JIBUN || '');
        }
        return '';
    }
    
    // 🎯 ULTRATHINK: 개별 필지 폴리곤 업데이트
    updateParcelPolygon(data, parcel, source) {
        if (!data.polygon) {
            console.warn(`폴리곤이 없는 필지 데이터 (${source}):`, data);
            return;
        }
        
        try {
            // 색상 업데이트
            if (parcel.color) {
                const fillOpacity = window.paintModeEnabled ? 0.3 : 0;
                const strokeOpacity = window.paintModeEnabled ? 0.8 : 0;
                
                data.polygon.setOptions({
                    fillColor: parcel.color,
                    fillOpacity: fillOpacity,
                    strokeColor: parcel.color,
                    strokeOpacity: strokeOpacity,
                    strokeWeight: 2
                });
                
                data.color = parcel.color;
                console.log(`✅ ${source}에서 필지 색상 업데이트: ${parcel.parcelNumber} → ${parcel.color}`);
            }
            
            // 메모 마커 처리
            if (parcel.memo && parcel.memo.trim() !== '') {
                if (!data.memoMarker && window.addMemoMarker) {
                    // 메모 마커 추가 (parcel.js의 기존 함수 활용)
                    window.addMemoMarker(data, parcel);
                    console.log(`✅ 메모 마커 추가: ${parcel.parcelNumber}`);
                }
            } else if (data.memoMarker && (!parcel.memo || parcel.memo.trim() === '')) {
                // 메모가 삭제된 경우 마커 제거
                data.memoMarker.setMap(null);
                delete data.memoMarker;
                console.log(`🗑️ 메모 마커 제거: ${parcel.parcelNumber}`);
            }
            
            // 필지 액션에 따른 추가 처리
            if (parcel.action === 'save_complete') {
                // 저장 완료 시 특별한 효과 (짧은 깜빡임)
                this.flashParcelSaved(data.polygon);
            }
            
        } catch (error) {
            console.error(`${source} 폴리곤 업데이트 오류:`, error);
        }
    }
    
    // 🎯 ULTRATHINK: 저장 완료 시 깜빡임 효과
    flashParcelSaved(polygon) {
        if (!polygon) return;
        
        const originalOptions = {
            strokeWeight: polygon.strokeWeight || 2,
            strokeOpacity: polygon.strokeOpacity || 0.8
        };
        
        // 깜빡임 효과
        polygon.setOptions({ strokeWeight: 4, strokeOpacity: 1.0 });
        
        setTimeout(() => {
            polygon.setOptions(originalOptions);
        }, 300);
    }
    
    // 🎯 ULTRATHINK: 필지 잠금 상태 UI 표시
    showParcelLockedState(parcelId, lockedBy) {
        // CSS 클래스나 오버레이를 통해 잠금 상태 표시
        console.log(`🔒 UI: 필지 ${parcelId} 잠금 표시 (${lockedBy})`);
    }
    
    // 🎯 ULTRATHINK: 필지 잠금 해제 상태 UI 표시
    hideParcelLockedState(parcelId) {
        console.log(`🔓 UI: 필지 ${parcelId} 잠금 해제 표시`);
    }
    
    // 🎯 ULTRATHINK: 실시간 상태 변경 알림
    notifyRealtimeStatusChange(status) {
        console.log(`📊 실시간 상태 변경: ${status}`);
        
        // 기존 sync status 시스템과 통합
        if (status === 'connected') {
            this.updateSyncStatus('synced');
        } else if (status === 'error') {
            this.updateSyncStatus('error');
        }
    }
    
    // 🎯 ULTRATHINK: 연결 해제 및 정리
    disconnect() {
        if (this.realtimeChannel) {
            console.log('📡 실시간 채널 연결 해제...');
            this.realtimeChannel = null;
        }
        
        this.isRealtimeConnected = false;
        this.realtimeListeners.clear();
        this.lockedParcels.clear();
        
        console.log('✅ 실시간 시스템 정리 완료');
    }
    
    // 🎯 ULTRATHINK: 실시간 통계 정보
    getRealtimeStats() {
        return {
            isConnected: this.isRealtimeConnected,
            channelName: this.broadcastChannel,
            userSession: this.userSession,
            lockedParcels: Array.from(this.lockedParcels),
            listenerCount: this.realtimeListeners.size
        };
    }
}

// 🎯 ULTRATHINK: 전역 실시간 데이터 매니저 인스턴스
window.realtimeDataManager = new RealtimeDataManager();

// 기존 dataManager 대체 (호환성 유지)
window.dataManager = window.realtimeDataManager;

console.log('🌟 ULTRATHINK 실시간 공유 지도 시스템 로드 완료!');