/**
 * Supabase 전용 데이터 관리자
 * localStorage 완전 제거, Supabase 클라우드 저장소만 사용
 * 60k 필지 + 30k 메모 데이터를 안전하게 관리
 */

class SupabaseDataManager {
    constructor() {
        // Supabase 매니저 인스턴스
        this.supabaseManager = null;
        this.backupManager = null;
        
        // 상태 관리
        this.isInitialized = false;
        this.isLoading = false;
        this.lastSyncTime = null;
        
        // 메모리 캐시 (성능 최적화용)
        this.parcelsCache = new Map();
        this.searchCache = new Map();
        this.CACHE_TTL = 5 * 60 * 1000; // 5분 캐시
        
        // 실시간 동기화
        this.syncCallbacks = [];
        
        this.init();
    }

    // 초기화
    async init() {
        try {
            console.log('🚀 SupabaseDataManager 초기화 시작...');
            
            // SupabaseManager 인스턴스 생성
            this.supabaseManager = new SupabaseManager();
            await this.waitForSupabaseInit();
            
            // BackupManager 인스턴스 생성
            this.backupManager = new BackupManager(this.supabaseManager);
            
            // 실시간 구독 설정
            this.setupRealtimeSubscriptions();
            
            this.isInitialized = true;
            console.log('✅ SupabaseDataManager 초기화 완료');
            
            // 초기화 완료 이벤트 발송
            this.dispatchEvent('dataManagerReady', { 
                status: 'initialized',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ SupabaseDataManager 초기화 실패:', error);
            throw error;
        }
    }

    // SupabaseManager 초기화 대기
    async waitForSupabaseInit() {
        while (!this.supabaseManager.isConnected) {
            console.log('⏳ Supabase 연결 대기 중...');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('✅ Supabase 연결 완료');
    }

    // 실시간 구독 설정
    setupRealtimeSubscriptions() {
        // Supabase 데이터 변경 이벤트 구독
        window.addEventListener('supabaseDataChange', (event) => {
            const { eventType, data } = event.detail;
            this.handleRealtimeUpdate(eventType, data);
        });

        // 연결 상태 변경 이벤트 구독
        window.addEventListener('supabaseConnectionChange', (event) => {
            const { isConnected, status } = event.detail;
            this.dispatchEvent('connectionStatusChange', { isConnected, status });
        });

        console.log('📡 실시간 구독 설정 완료');
    }

    // 실시간 업데이트 처리
    handleRealtimeUpdate(eventType, data) {
        console.log('📡 실시간 데이터 업데이트:', eventType, data);
        
        // 메모리 캐시 업데이트
        if (eventType === 'update' || eventType === 'insert') {
            this.parcelsCache.set(data.pnu, {
                data: data,
                timestamp: Date.now()
            });
        } else if (eventType === 'delete') {
            this.parcelsCache.delete(data.pnu);
        }
        
        // 콜백 실행
        this.syncCallbacks.forEach(callback => {
            try {
                callback(eventType, data);
            } catch (error) {
                console.error('실시간 업데이트 콜백 오류:', error);
            }
        });
        
        // 글로벌 이벤트 발송 (기존 코드 호환성)
        this.dispatchEvent('parcelDataChanged', {
            eventType,
            data,
            timestamp: new Date().toISOString()
        });
    }

    // 모든 필지 데이터 로드
    async loadAllParcels() {
        if (!this.isInitialized) {
            throw new Error('DataManager가 초기화되지 않았습니다');
        }

        if (this.isLoading) {
            console.log('⏳ 이미 로딩 중...');
            return [];
        }

        try {
            this.isLoading = true;
            console.log('📥 모든 필지 데이터 로드 시작...');

            // Supabase에서 데이터 로드
            const parcels = await this.supabaseManager.loadAllParcels();
            
            // 메모리 캐시 업데이트
            this.updateCache(parcels);
            
            this.lastSyncTime = new Date().toISOString();
            console.log(`✅ ${parcels.length}개 필지 로드 완료`);
            
            return parcels;

        } catch (error) {
            console.error('❌ 필지 로드 실패:', error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }

    // 뷰포트 기반 필지 로드 (성능 최적화)
    async loadVisibleParcels(bounds) {
        if (!this.isInitialized) {
            throw new Error('DataManager가 초기화되지 않았습니다');
        }

        try {
            console.log('📍 뷰포트 내 필지 로드 시작...');
            
            const parcels = await this.supabaseManager.loadVisibleParcels(bounds);
            
            console.log(`📍 뷰포트 내 ${parcels.length}개 필지 로드 완료`);
            return parcels;

        } catch (error) {
            console.error('❌ 뷰포트 필지 로드 실패:', error);
            return [];
        }
    }

    // 필지 저장
    async saveParcel(pnu, parcelData) {
        if (!this.isInitialized) {
            throw new Error('DataManager가 초기화되지 않았습니다');
        }

        try {
            console.log(`💾 필지 저장: ${pnu}`);
            
            // Supabase에 저장
            const success = await this.supabaseManager.saveParcel(pnu, parcelData);
            
            if (success) {
                // 메모리 캐시 업데이트
                this.parcelsCache.set(pnu, {
                    data: parcelData,
                    timestamp: Date.now()
                });
                
                // 저장 완료 이벤트 발송
                this.dispatchEvent('parcelSaved', {
                    pnu,
                    data: parcelData,
                    timestamp: new Date().toISOString()
                });
                
                console.log(`✅ 필지 저장 완료: ${pnu}`);
            }
            
            return success;

        } catch (error) {
            console.error(`❌ 필지 저장 실패: ${pnu}`, error);
            throw error;
        }
    }

    // 여러 필지 저장 (배치 처리)
    async saveParcels(parcels) {
        if (!this.isInitialized) {
            throw new Error('DataManager가 초기화되지 않았습니다');
        }

        if (!parcels || parcels.length === 0) {
            console.log('저장할 필지가 없습니다');
            return { success: true, count: 0 };
        }

        try {
            console.log(`💾 ${parcels.length}개 필지 배치 저장 시작...`);
            
            let successCount = 0;
            const errors = [];

            // 배치로 저장
            for (const parcel of parcels) {
                try {
                    const success = await this.saveParcel(parcel.pnu, parcel);
                    if (success) {
                        successCount++;
                    }
                } catch (error) {
                    errors.push({ pnu: parcel.pnu, error: error.message });
                }
            }

            console.log(`✅ 배치 저장 완료: ${successCount}/${parcels.length}개 성공`);
            
            return {
                success: successCount > 0,
                count: successCount,
                total: parcels.length,
                errors: errors
            };

        } catch (error) {
            console.error('❌ 배치 저장 실패:', error);
            throw error;
        }
    }

    // 필지 삭제
    async deleteParcel(pnu) {
        if (!this.isInitialized) {
            throw new Error('DataManager가 초기화되지 않았습니다');
        }

        try {
            console.log(`🗑️ 필지 삭제: ${pnu}`);
            
            // Supabase에서 삭제
            const success = await this.supabaseManager.deleteParcel(pnu);
            
            if (success) {
                // 메모리 캐시에서 제거
                this.parcelsCache.delete(pnu);
                
                // 삭제 완료 이벤트 발송
                this.dispatchEvent('parcelDeleted', {
                    pnu,
                    timestamp: new Date().toISOString()
                });
                
                console.log(`✅ 필지 삭제 완료: ${pnu}`);
            }
            
            return success;

        } catch (error) {
            console.error(`❌ 필지 삭제 실패: ${pnu}`, error);
            throw error;
        }
    }

    // 필지 검색
    async searchParcels(query, limit = 100) {
        if (!this.isInitialized) {
            throw new Error('DataManager가 초기화되지 않았습니다');
        }

        // 캐시된 검색 결과 확인
        const cacheKey = `search_${query}_${limit}`;
        const cached = this.searchCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
            console.log(`🔍 캐시된 검색 결과 반환: "${query}"`);
            return cached.results;
        }

        try {
            console.log(`🔍 필지 검색: "${query}"`);
            
            const results = await this.supabaseManager.searchParcels(query, limit);
            
            // 검색 결과 캐시
            this.searchCache.set(cacheKey, {
                results: results,
                timestamp: Date.now()
            });

            console.log(`✅ 검색 완료: "${query}" - ${results.length}개 결과`);
            return results;

        } catch (error) {
            console.error(`❌ 검색 실패: "${query}"`, error);
            return [];
        }
    }

    // 메모리 캐시 업데이트
    updateCache(parcels) {
        const now = Date.now();
        
        parcels.forEach(parcel => {
            this.parcelsCache.set(parcel.pnu, {
                data: parcel,
                timestamp: now
            });
        });

        // 캐시 크기 제한 (최대 10000개)
        if (this.parcelsCache.size > 10000) {
            const entries = Array.from(this.parcelsCache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            
            // 오래된 항목 5000개 제거
            for (let i = 0; i < 5000; i++) {
                this.parcelsCache.delete(entries[i][0]);
            }
            
            console.log('🧹 메모리 캐시 정리 완료 (5000개 제거)');
        }
    }

    // 캐시된 필지 가져오기
    getCachedParcel(pnu) {
        const cached = this.parcelsCache.get(pnu);
        if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
            return cached.data;
        }
        return null;
    }

    // 수동 백업 실행
    async createManualBackup() {
        if (!this.isInitialized || !this.backupManager) {
            throw new Error('백업 시스템이 초기화되지 않았습니다');
        }

        try {
            console.log('🚀 수동 백업 시작...');
            
            const success = await this.backupManager.performManualBackup();
            
            if (success) {
                console.log('✅ 수동 백업 완료');
                this.dispatchEvent('backupCompleted', {
                    type: 'manual',
                    timestamp: new Date().toISOString()
                });
            }
            
            return success;

        } catch (error) {
            console.error('❌ 수동 백업 실패:', error);
            throw error;
        }
    }

    // 백업에서 데이터 복원
    async restoreFromBackup(backupData, options = {}) {
        if (!this.isInitialized || !this.backupManager) {
            throw new Error('백업 시스템이 초기화되지 않았습니다');
        }

        try {
            console.log('🔄 백업 데이터 복원 시작...');
            
            const success = await this.backupManager.restoreFromBackup(backupData, options);
            
            if (success) {
                // 캐시 초기화
                this.clearCache();
                
                console.log('✅ 백업 복원 완료');
                this.dispatchEvent('restoreCompleted', {
                    timestamp: new Date().toISOString()
                });
            }
            
            return success;

        } catch (error) {
            console.error('❌ 백업 복원 실패:', error);
            throw error;
        }
    }

    // 백업 목록 조회
    async getBackupHistory(type = null, limit = 10) {
        if (!this.isInitialized || !this.backupManager) {
            throw new Error('백업 시스템이 초기화되지 않았습니다');
        }

        try {
            const history = await this.backupManager.getBackupHistory(type, limit);
            return history;
        } catch (error) {
            console.error('❌ 백업 목록 조회 실패:', error);
            return [];
        }
    }

    // 백업 상태 조회
    getBackupStatus() {
        if (!this.backupManager) {
            return {
                isAvailable: false,
                error: '백업 시스템이 초기화되지 않았습니다'
            };
        }

        return {
            isAvailable: true,
            ...this.backupManager.getBackupStatus()
        };
    }

    // 통계 정보 조회
    async getStats() {
        const stats = {
            connection: this.isInitialized,
            lastSyncTime: this.lastSyncTime,
            cacheSize: this.parcelsCache.size,
            searchCacheSize: this.searchCache.size,
            isLoading: this.isLoading
        };

        if (this.supabaseManager) {
            try {
                const supabaseStats = await this.supabaseManager.getStats();
                stats.supabase = supabaseStats;
            } catch (error) {
                console.warn('Supabase 통계 조회 실패:', error);
            }
        }

        return stats;
    }

    // 실시간 업데이트 콜백 등록
    onSyncUpdate(callback) {
        this.syncCallbacks.push(callback);
    }

    // 캐시 정리
    clearCache() {
        this.parcelsCache.clear();
        this.searchCache.clear();
        console.log('🧹 메모리 캐시 정리 완료');
    }

    // 연결 상태 확인
    isConnected() {
        return this.isInitialized && this.supabaseManager?.isConnectedToSupabase();
    }

    // 이벤트 발송 헬퍼
    dispatchEvent(eventName, detail) {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(eventName, { detail }));
        }
    }

    // 정리
    destroy() {
        if (this.backupManager) {
            this.backupManager.cleanup();
        }
        
        if (this.supabaseManager) {
            this.supabaseManager.destroy();
        }
        
        this.clearCache();
        this.syncCallbacks = [];
        
        console.log('🧹 SupabaseDataManager 정리 완료');
    }
}

// 레거시 호환성을 위한 래퍼 함수들
class LegacyDataManagerAdapter {
    constructor(supabaseDataManager) {
        this.manager = supabaseDataManager;
    }

    // 기존 loadLocal() 호출을 Supabase 로드로 변경
    loadLocal() {
        console.warn('⚠️ loadLocal() 호출 감지 - loadAllParcels()로 리다이렉션');
        return this.manager.loadAllParcels();
    }

    // 기존 saveLocal() 호출을 Supabase 저장으로 변경  
    async saveLocal(parcels) {
        console.warn('⚠️ saveLocal() 호출 감지 - saveParcels()로 리다이렉션');
        const result = await this.manager.saveParcels(parcels);
        return result.success;
    }

    // 기존 load() 호출 호환성
    async load(options = {}) {
        if (options.fallbackToCloud !== false) {
            return await this.manager.loadAllParcels();
        } else {
            // 캐시된 데이터만 반환
            const allCached = [];
            for (const [pnu, cached] of this.manager.parcelsCache) {
                if (Date.now() - cached.timestamp < this.manager.CACHE_TTL) {
                    allCached.push(cached.data);
                }
            }
            return allCached;
        }
    }

    // 기존 save() 호출 호환성
    async save(parcels, options = {}) {
        const result = await this.manager.saveParcels(parcels);
        
        // 기존 형식으로 반환
        return {
            local: result.success,
            cloud: result.success,
            cache: true,
            errors: result.errors || [],
            performance: {
                parcelCount: result.total || 0
            }
        };
    }

    // 동기화 상태 관련 호환성
    updateSyncStatus(status) {
        this.manager.dispatchEvent('syncStatusChanged', { status });
    }

    onSyncStatusChange(callback) {
        window.addEventListener('syncStatusChanged', (event) => {
            callback(event.detail.status);
        });
    }

    // 기타 호환성 메서드들
    get syncStatus() {
        return this.manager.isConnected() ? 'synced' : 'offline';
    }

    get lastSyncTime() {
        return this.manager.lastSyncTime;
    }
}

// 전역 인스턴스 생성 및 초기화
let supabaseDataManager;
let legacyAdapter;

async function initializeSupabaseDataManager() {
    try {
        console.log('🔄 Supabase 데이터 관리자로 전환 중...');
        
        // 기존 dataManager가 있으면 정리
        if (window.dataManager && typeof window.dataManager.destroy === 'function') {
            window.dataManager.destroy();
        }
        
        // 새로운 Supabase 전용 데이터 관리자 생성
        supabaseDataManager = new SupabaseDataManager();
        legacyAdapter = new LegacyDataManagerAdapter(supabaseDataManager);
        
        // 전역 등록 (기존 코드 호환성)
        window.dataManager = legacyAdapter;
        window.supabaseDataManager = supabaseDataManager;
        window.SupabaseDataManager = SupabaseDataManager;
        
        console.log('✅ Supabase 전용 데이터 관리자 초기화 완료');
        
    } catch (error) {
        console.error('❌ Supabase 데이터 관리자 초기화 실패:', error);
        throw error;
    }
}

// DOM 로드 완료 시 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSupabaseDataManager);
} else {
    // 이미 로드 완료된 경우 즉시 초기화
    initializeSupabaseDataManager();
}

console.log('📦 Supabase 전용 데이터 관리자 로드 완료');