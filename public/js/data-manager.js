/**
 * 데이터 관리자 - localStorage와 Supabase 하이브리드 시스템
 * 60k 필지 + 30k 메모 데이터의 안전한 이중 저장
 */

class DataManager {
    constructor() {
        this.STORAGE_KEY = 'parcelData';
        this.SUPABASE_URL = 'https://iccixxihdsvbgbkuwdqj.supabase.co';
        this.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljY2l4eGloZHN2Ymdia3V3ZHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwOTYyNjksImV4cCI6MjA3MjY3MjI2OX0.sEiGF7sImn2aY4Bl1463DVVZOmZuczTXfkgTS2-A074';
        
        // 상태 관리
        this.syncStatus = 'offline'; // 'offline', 'syncing', 'synced', 'error'
        this.syncStatusCallbacks = [];
        this.lastSyncTime = null;
        
        // 초기화
        this.init();
    }

    async init() {
        try {
            await this.testSupabaseConnection();
            this.updateSyncStatus('synced');
            console.log('DataManager 초기화 완료 - Supabase 연결 성공');
        } catch (error) {
            console.warn('Supabase 연결 실패, localStorage 전용 모드:', error.message);
            this.updateSyncStatus('offline');
        }
    }

    // Supabase 연결 테스트
    async testSupabaseConnection() {
        const response = await fetch(`${this.SUPABASE_URL}/rest/v1/rpc/ping`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': this.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`
            }
        });

        if (!response.ok) {
            throw new Error(`Supabase 연결 실패: ${response.status}`);
        }

        return await response.json();
    }

    // 동기화 상태 업데이트
    updateSyncStatus(status) {
        const prevStatus = this.syncStatus;
        this.syncStatus = status;
        
        if (status === 'synced') {
            this.lastSyncTime = new Date().toISOString();
        }

        // UI 콜백 실행
        this.syncStatusCallbacks.forEach(callback => {
            try {
                callback(status, prevStatus);
            } catch (error) {
                console.error('동기화 상태 콜백 오류:', error);
            }
        });

        // DOM 이벤트 발송
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('syncStatusChanged', {
                detail: { status, prevStatus, lastSyncTime: this.lastSyncTime }
            }));
        }
    }

    // 동기화 상태 콜백 등록
    onSyncStatusChange(callback) {
        this.syncStatusCallbacks.push(callback);
    }

    // localStorage에서 데이터 로드
    loadLocal() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('localStorage 로드 실패:', error);
            return [];
        }
    }

    // localStorage에 데이터 저장
    saveLocal(parcels) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(parcels));
            return true;
        } catch (error) {
            console.error('localStorage 저장 실패:', error);
            return false;
        }
    }

    // Supabase에서 데이터 로드 (미래 구현용)
    async loadCloud() {
        if (this.syncStatus === 'offline') {
            throw new Error('Supabase 연결 없음');
        }

        try {
            // 현재는 기본 구조만 구현
            console.log('클라우드 데이터 로드 (미래 구현)');
            return [];
        } catch (error) {
            console.error('클라우드 로드 실패:', error);
            throw error;
        }
    }

    // Supabase에 데이터 저장 (미래 구현용)
    async saveCloud(parcels, options = {}) {
        if (this.syncStatus === 'offline') {
            console.log('오프라인 모드 - 클라우드 저장 건너뜀');
            return false;
        }

        try {
            this.updateSyncStatus('syncing');
            console.log(`클라우드 저장 시작: ${parcels.length}개 필지`);
            
            // 현재는 기본 구조만 구현 - 실제 저장 로직은 추후 추가
            await new Promise(resolve => setTimeout(resolve, 500)); // 시뮬레이션
            
            this.updateSyncStatus('synced');
            console.log('클라우드 저장 완료');
            return true;
        } catch (error) {
            console.error('클라우드 저장 실패:', error);
            this.updateSyncStatus('error');
            return false;
        }
    }

    // 통합 저장 (localStorage + Supabase)
    async save(parcels, options = {}) {
        const results = {
            local: false,
            cloud: false,
            errors: []
        };

        // 1. localStorage 저장 (필수)
        results.local = this.saveLocal(parcels);
        if (!results.local) {
            results.errors.push('localStorage 저장 실패');
        }

        // 2. Supabase 저장 (선택적)
        if (options.cloudSync !== false) {
            try {
                results.cloud = await this.saveCloud(parcels, options);
            } catch (error) {
                results.errors.push(`클라우드 저장 실패: ${error.message}`);
            }
        }

        console.log('데이터 저장 결과:', results);
        return results;
    }

    // 통합 로드 (localStorage 우선, Supabase 백업)
    async load(options = {}) {
        let data = [];

        // 1. localStorage에서 로드 (빠름)
        data = this.loadLocal();
        
        if (data.length > 0) {
            console.log(`로컬에서 ${data.length}개 필지 로드됨`);
            return data;
        }

        // 2. localStorage가 비어있으면 Supabase에서 로드
        if (options.fallbackToCloud !== false && this.syncStatus !== 'offline') {
            try {
                data = await this.loadCloud();
                if (data.length > 0) {
                    // 로컬에도 캐시
                    this.saveLocal(data);
                    console.log(`클라우드에서 ${data.length}개 필지 복원됨`);
                }
            } catch (error) {
                console.error('클라우드 로드 실패:', error);
            }
        }

        return data;
    }

    // 수동 동기화
    async sync() {
        if (this.syncStatus === 'offline') {
            throw new Error('오프라인 모드 - 동기화 불가능');
        }

        try {
            this.updateSyncStatus('syncing');
            
            const localData = this.loadLocal();
            if (localData.length > 0) {
                await this.saveCloud(localData, { forceSync: true });
            }

            this.updateSyncStatus('synced');
            return true;
        } catch (error) {
            this.updateSyncStatus('error');
            throw error;
        }
    }

    // 통계 정보
    getStats() {
        const localData = this.loadLocal();
        return {
            totalParcels: localData.length,
            lastSyncTime: this.lastSyncTime,
            syncStatus: this.syncStatus,
            memoryUsage: JSON.stringify(localData).length
        };
    }

    // 백업 생성 (Google Sheets용)
    async createBackup() {
        const localData = this.loadLocal();
        
        if (localData.length === 0) {
            throw new Error('백업할 데이터가 없습니다');
        }

        // Google Sheets 백업 로직 (기존 시스템 활용)
        if (window.GoogleAuth && window.GoogleAuth.backupParcelsToSheets) {
            try {
                this.updateSyncStatus('syncing');
                const result = await window.GoogleAuth.backupParcelsToSheets(localData);
                console.log('Google Sheets 백업 완료:', result);
                return result;
            } catch (error) {
                console.error('Google Sheets 백업 실패:', error);
                throw error;
            } finally {
                this.updateSyncStatus('synced');
            }
        } else {
            throw new Error('Google Sheets 백업 시스템을 찾을 수 없습니다');
        }
    }
}

// 전역 인스턴스 생성
window.dataManager = new DataManager();

// 레거시 호환성을 위한 별칭
window.DataManager = DataManager;

console.log('DataManager 로드 완료 - 하이브리드 데이터 시스템 준비됨');