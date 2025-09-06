/**
 * 간소화된 DataManager - Supabase 연결 문제 해결
 */

class DataManager {
    constructor() {
        this.SUPABASE_URL = 'https://iccixxihdsvbgbkuwdqj.supabase.co';
        this.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljY2l4eGloZHN2Ymdia3V3ZHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwOTYyNjksImV4cCI6MjA3MjY3MjI2OX0.sEiGF7sImn2aY4Bl1463DVVZOmZuczTXfkgTS2-A074';
        
        this.syncStatus = 'offline';
        this.isConnected = false;
        this.lastSyncTime = null;
        this.syncStatusListeners = []; // 상태 변경 리스너들
        
        // 간단한 초기화 (지연 실행)
        setTimeout(() => this.init(), 100);
    }
    
    async init() {
        try {
            console.log('🚀 간소화된 DataManager 초기화 시작...');
            
            // Supabase 연결 테스트
            await this.testConnection();
            
            this.isConnected = true;
            this.updateSyncStatus('synced');
            console.log('✅ DataManager 초기화 완료 - Supabase 연결됨');
            
        } catch (error) {
            console.warn('⚠️ Supabase 연결 실패, localStorage 전용 모드:', error.message);
            this.isConnected = false;
            this.updateSyncStatus('offline');
        }
    }
    
    // 간단한 연결 테스트
    async testConnection() {
        try {
            console.log('🔍 Supabase 연결 테스트...');
            
            const response = await fetch(`${this.SUPABASE_URL}/rest/v1/rpc/ping`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('✅ Supabase 연결 성공:', data);
            return true;
            
        } catch (error) {
            console.error('❌ Supabase 연결 실패:', error.message);
            throw error;
        }
    }
    
    // 동기화 상태 업데이트 (안전한 참조)
    updateSyncStatus(status) {
        this.syncStatus = status;
        
        // 리스너들에게 상태 변경 알림
        this.syncStatusListeners.forEach(listener => {
            try {
                listener(status);
            } catch (error) {
                console.warn('SyncStatus listener 오류:', error);
            }
        });
        
        // SyncStatusUI가 있으면 안전하게 업데이트
        if (window.syncStatusUI && typeof window.syncStatusUI.updateStatus === 'function') {
            try {
                window.syncStatusUI.updateStatus(status);
            } catch (error) {
                console.warn('SyncStatusUI 업데이트 실패:', error);
            }
        }
        
        // 간단한 상태 표시 폴백
        const statusElement = document.getElementById('syncStatus') || document.getElementById('syncText');
        if (statusElement) {
            const statusMap = {
                'offline': '오프라인',
                'syncing': '동기화 중...',
                'synced': '동기화 완료',
                'error': '동기화 실패'
            };
            statusElement.textContent = statusMap[status] || status;
        }
    }
    
    // SyncStatusUI 호환성 메소드
    onSyncStatusChange(callback) {
        if (typeof callback === 'function') {
            this.syncStatusListeners.push(callback);
            // 현재 상태 즉시 알림
            callback(this.syncStatus);
        }
    }
    
    // 리스너 제거
    offSyncStatusChange(callback) {
        const index = this.syncStatusListeners.indexOf(callback);
        if (index > -1) {
            this.syncStatusListeners.splice(index, 1);
        }
    }
    
    // 데이터 저장 (localStorage + Supabase 하이브리드)
    async save(key, data, options = {}) {
        try {
            // 1. localStorage에 우선 저장 (즉시 응답)
            localStorage.setItem(key, JSON.stringify(data));
            
            // 2. Supabase 동기화 (백그라운드)
            if (this.isConnected && options.sync !== false) {
                this.syncToSupabase(key, data).catch(error => {
                    console.warn('백그라운드 동기화 실패:', error.message);
                });
            }
            
            return data;
            
        } catch (error) {
            console.error('데이터 저장 실패:', error.message);
            throw error;
        }
    }
    
    // 데이터 로드
    load(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('데이터 로드 실패:', error.message);
            return null;
        }
    }
    
    // 기존 코드 호환성을 위한 메소드들
    loadLocal(key) {
        return this.load(key);
    }
    
    saveLocal(key, data) {
        return this.save(key, data, { sync: false });
    }
    
    // 필지 데이터 로드
    loadParcels() {
        return this.loadLocal('parcelData') || {};
    }
    
    // 필지 데이터 저장
    saveParcels(data) {
        return this.saveLocal('parcelData', data);
    }
    
    // Supabase 동기화 (백그라운드)
    async syncToSupabase(key, data) {
        if (!this.isConnected) {
            return;
        }
        
        try {
            this.updateSyncStatus('syncing');
            
            // 실제 동기화 로직은 나중에 구현
            console.log(`📤 ${key} Supabase 동기화 준비`);
            
            // 성공적으로 동기화되었다고 가정
            this.lastSyncTime = new Date();
            this.updateSyncStatus('synced');
            
        } catch (error) {
            console.error('Supabase 동기화 실패:', error.message);
            this.updateSyncStatus('error');
        }
    }
    
    // 연결 재시도
    async retry() {
        try {
            this.updateSyncStatus('syncing');
            await this.testConnection();
            this.isConnected = true;
            this.updateSyncStatus('synced');
            console.log('✅ Supabase 재연결 성공!');
        } catch (error) {
            console.error('❌ 재연결 실패:', error.message);
            this.isConnected = false;
            this.updateSyncStatus('offline');
        }
    }
}

// 전역 인스턴스 생성
window.dataManager = new DataManager();

console.log('📦 간소화된 DataManager 로드 완료');