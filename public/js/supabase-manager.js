/**
 * Supabase 데이터 관리자
 * localStorage를 완전히 대체하는 실시간 클라우드 데이터 시스템
 */

class SupabaseManager {
    constructor() {
        // Supabase 클라이언트 초기화
        // 🎯 고객용 설정 - 실제 Supabase 정보로 교체하세요
        this.SUPABASE_URL = 'https://cqfszcbifonxpfasodto.supabase.co';
        this.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxZnN6Y2JpZm9ueHBmYXNvZHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MTM2NzUsImV4cCI6MjA3Mjk4OTY3NX0.gaEIzHhU8d7e1T8WDzxK-YDW7DPU2aLkD3XBU7TtncI';
        
        // 🎯 ULTRATHINK: Supabase 클라이언트 초기화 (라이브러리 로딩 대기)
        this.supabase = null;
        
        // 상태 관리
        this.isConnected = false;
        this.connectionStatus = 'connecting';
        this.lastSyncTime = null;
        
        // 메모리 캐시 (성능 최적화)
        this.memoryCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5분 캐시
        this.maxCacheSize = 1000; // 최대 1000개 필지 캐시
        
        // 배치 저장 시스템
        this.writeBatch = [];
        this.batchTimeout = null;
        this.BATCH_DELAY = 2000; // 2초 배치 지연
        this.MAX_BATCH_SIZE = 100; // 최대 100개씩 배치
        
        // 성능 모니터링
        this.performance = {
            queryCount: 0,
            avgQueryTime: 0,
            cacheHitRate: 0,
            lastQueryTime: 0
        };
        
        this.init();
    }

    // 🎯 ULTRATHINK: Supabase 라이브러리 로딩 대기
    async waitForSupabaseLibrary() {
        console.log('⏳ Supabase 라이브러리 로딩 대기 중...');
        
        let attempts = 0;
        const maxAttempts = 50; // 최대 10초 대기 (200ms * 50)
        
        while (!window.supabase && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
            
            if (attempts % 5 === 0) {
                console.log(`⏳ Supabase 라이브러리 로딩 대기... (${attempts}/${maxAttempts})`);
            }
        }
        
        if (!window.supabase) {
            throw new Error('Supabase 라이브러리 로드 실패 - CDN 로딩 확인 필요');
        }
        
        console.log('✅ Supabase 라이브러리 로드 완료');
    }

    // 초기화
    async init() {
        try {
            console.log('🚀 SupabaseManager 초기화 시작...');
            
            // 🎯 ULTRATHINK: Supabase 라이브러리 로딩 대기
            await this.waitForSupabaseLibrary();
            
            // Supabase 클라이언트 생성
            this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);
            
            if (!this.supabase) {
                throw new Error('Supabase 클라이언트 생성 실패');
            }
            
            // 연결 테스트
            await this.testConnection();
            
            // 실시간 구독 설정
            this.setupRealtimeSubscription();
            
            console.log('✅ SupabaseManager 초기화 완료');
            
        } catch (error) {
            console.error('❌ SupabaseManager 초기화 실패:', error);
            this.connectionStatus = 'error';
            this.notifyConnectionStatus();
        }
    }

    // 연결 테스트
    async testConnection() {
        const startTime = performance.now();
        
        try {
            const { data, error } = await this.supabase
                .from('parcels')
                .select('count', { count: 'exact', head: true });
            
            if (error) throw error;
            
            this.isConnected = true;
            this.connectionStatus = 'connected';
            this.performance.lastQueryTime = performance.now() - startTime;
            
            console.log(`✅ Supabase 연결 성공 (${this.performance.lastQueryTime.toFixed(2)}ms)`);
            this.notifyConnectionStatus();
            
        } catch (error) {
            this.isConnected = false;
            this.connectionStatus = 'error';
            throw new Error(`Supabase 연결 실패: ${error.message}`);
        }
    }

    // 실시간 구독 설정
    setupRealtimeSubscription() {
        this.supabase
            .channel('parcels_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'parcels' },
                (payload) => {
                    console.log('📡 실시간 데이터 변경:', payload);
                    this.handleRealtimeChange(payload);
                }
            )
            .subscribe();
        
        console.log('📡 실시간 구독 설정 완료');
    }

    // 실시간 변경 처리
    handleRealtimeChange(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        switch (eventType) {
            case 'INSERT':
            case 'UPDATE':
                // 메모리 캐시 업데이트
                if (newRecord) {
                    this.memoryCache.set(newRecord.pnu, newRecord);
                    this.notifyDataChange('update', newRecord);
                }
                break;
                
            case 'DELETE':
                // 메모리 캐시에서 제거
                if (oldRecord) {
                    this.memoryCache.delete(oldRecord.pnu);
                    this.notifyDataChange('delete', oldRecord);
                }
                break;
        }
    }

    // 데이터 변경 알림
    notifyDataChange(eventType, data) {
        window.dispatchEvent(new CustomEvent('supabaseDataChange', {
            detail: { eventType, data }
        }));
    }

    // 연결 상태 알림
    notifyConnectionStatus() {
        window.dispatchEvent(new CustomEvent('supabaseConnectionChange', {
            detail: { 
                isConnected: this.isConnected, 
                status: this.connectionStatus 
            }
        }));
    }

    // 모든 필지 데이터 로드
    async loadAllParcels() {
        const startTime = performance.now();
        
        try {
            console.log('📥 모든 필지 데이터 로드 시작...');
            
            const { data, error } = await this.supabase
                .from('parcels')
                .select('*')
                .order('updated_at', { ascending: false });
            
            if (error) throw error;
            
            // 메모리 캐시 업데이트
            this.updateMemoryCache(data);
            
            this.lastSyncTime = new Date();
            this.updatePerformanceMetrics(startTime);
            
            console.log(`✅ ${data.length}개 필지 로드 완료 (${(performance.now() - startTime).toFixed(2)}ms)`);
            
            return data || [];
            
        } catch (error) {
            console.error('❌ 필지 로드 실패:', error);
            throw error;
        }
    }

    // 뷰포트 기반 필지 로드 (성능 최적화)
    async loadVisibleParcels(bounds) {
        const startTime = performance.now();
        
        try {
            // 간단한 범위 쿼리 (PostGIS 기능 없이)
            const { data, error } = await this.supabase
                .from('parcels')
                .select('*')
                .limit(1000); // 일단 1000개 제한
            
            if (error) throw error;
            
            // 클라이언트 사이드에서 필터링 (임시 방법)
            const visibleParcels = data.filter(parcel => {
                if (!parcel.geometry || !parcel.geometry.coordinates) return false;
                
                try {
                    const coords = parcel.geometry.coordinates[0];
                    if (!coords || coords.length === 0) return false;
                    
                    // 간단한 바운딩 박스 체크
                    const center = this.calculateCenter(coords);
                    return center.lat >= bounds.sw.lat() && 
                           center.lat <= bounds.ne.lat() &&
                           center.lng >= bounds.sw.lng() && 
                           center.lng <= bounds.ne.lng();
                } catch (err) {
                    return false;
                }
            });
            
            this.updatePerformanceMetrics(startTime);
            console.log(`📍 뷰포트 내 ${visibleParcels.length}개 필지 로드`);
            
            return visibleParcels;
            
        } catch (error) {
            console.error('❌ 뷰포트 필지 로드 실패:', error);
            return [];
        }
    }

    // 좌표 중심점 계산
    calculateCenter(coords) {
        let sumLat = 0, sumLng = 0, count = 0;
        
        coords.forEach(coord => {
            sumLng += coord[0];
            sumLat += coord[1];
            count++;
        });
        
        return {
            lat: sumLat / count,
            lng: sumLng / count
        };
    }

    // 필지 저장 (배치 처리)
    async saveParcel(pnu, parcelData) {
        try {
            // 메모리 캐시 즉시 업데이트 (사용자 경험 향상)
            const cachedData = {
                pnu,
                geometry: parcelData.geometry,
                properties: parcelData.properties,
                color: parcelData.color,
                owner_name: parcelData.ownerName || parcelData.owner_name,
                owner_address: parcelData.ownerAddress || parcelData.owner_address,
                owner_contact: parcelData.ownerContact || parcelData.owner_contact,
                memo: parcelData.memo,
                updated_at: new Date().toISOString()
            };
            
            this.memoryCache.set(pnu, cachedData);
            
            // 배치에 추가
            this.writeBatch.push(cachedData);
            
            // 배치 크기 초과시 즉시 저장
            if (this.writeBatch.length >= this.MAX_BATCH_SIZE) {
                await this.flushBatch();
            } else {
                // 2초 후 배치 저장 예약
                this.scheduleBatchFlush();
            }
            
            console.log(`💾 필지 저장 예약: ${pnu}`);
            return true;
            
        } catch (error) {
            console.error('❌ 필지 저장 실패:', error);
            throw error;
        }
    }

    // 배치 저장 스케줄링
    scheduleBatchFlush() {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }
        
        this.batchTimeout = setTimeout(() => {
            this.flushBatch();
        }, this.BATCH_DELAY);
    }

    // 배치 플러시 (실제 DB 저장)
    async flushBatch() {
        if (this.writeBatch.length === 0) return;
        
        const batch = [...this.writeBatch];
        this.writeBatch = [];
        
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }
        
        try {
            console.log(`📤 ${batch.length}개 필지 배치 저장 시작...`);
            
            const { error } = await this.supabase
                .from('parcels')
                .upsert(batch, {
                    onConflict: 'pnu'
                });
            
            if (error) throw error;
            
            console.log(`✅ ${batch.length}개 필지 배치 저장 완료`);
            
        } catch (error) {
            console.error('❌ 배치 저장 실패:', error);
            
            // 실패한 데이터를 다시 배치에 추가
            this.writeBatch.push(...batch);
            
            // 3초 후 재시도
            setTimeout(() => {
                this.flushBatch();
            }, 3000);
        }
    }

    // 필지 삭제
    async deleteParcel(pnu) {
        try {
            // 메모리 캐시에서 즉시 제거
            this.memoryCache.delete(pnu);
            
            const { error } = await this.supabase
                .from('parcels')
                .delete()
                .eq('pnu', pnu);
            
            if (error) throw error;
            
            console.log(`🗑️ 필지 삭제 완료: ${pnu}`);
            return true;
            
        } catch (error) {
            console.error('❌ 필지 삭제 실패:', error);
            throw error;
        }
    }

    // 메모리 캐시 업데이트
    updateMemoryCache(data) {
        data.forEach(parcel => {
            // 캐시 크기 제한
            if (this.memoryCache.size >= this.maxCacheSize) {
                // LRU: 가장 오래된 항목 제거
                const firstKey = this.memoryCache.keys().next().value;
                this.memoryCache.delete(firstKey);
            }
            
            this.memoryCache.set(parcel.pnu, parcel);
        });
    }

    // 성능 메트릭 업데이트
    updatePerformanceMetrics(startTime) {
        const queryTime = performance.now() - startTime;
        this.performance.queryCount++;
        this.performance.avgQueryTime = 
            (this.performance.avgQueryTime * (this.performance.queryCount - 1) + queryTime) / 
            this.performance.queryCount;
    }

    // 검색 기능
    async searchParcels(query, limit = 100) {
        try {
            const { data, error } = await this.supabase
                .from('parcels')
                .select('*')
                .or(`owner_name.ilike.%${query}%,memo.ilike.%${query}%,pnu.ilike.%${query}%`)
                .limit(limit);
            
            if (error) throw error;
            
            console.log(`🔍 검색 결과: "${query}" - ${data.length}개`);
            return data || [];
            
        } catch (error) {
            console.error('❌ 검색 실패:', error);
            return [];
        }
    }

    // 통계 정보
    async getStats() {
        try {
            const { count, error } = await this.supabase
                .from('parcels')
                .select('*', { count: 'exact', head: true });
            
            if (error) throw error;
            
            return {
                totalParcels: count,
                cacheSize: this.memoryCache.size,
                connectionStatus: this.connectionStatus,
                lastSync: this.lastSyncTime,
                performance: this.performance
            };
            
        } catch (error) {
            console.error('❌ 통계 조회 실패:', error);
            return {
                totalParcels: 0,
                cacheSize: this.memoryCache.size,
                connectionStatus: this.connectionStatus,
                lastSync: this.lastSyncTime,
                performance: this.performance
            };
        }
    }

    // 캐시에서 필지 가져오기
    getCachedParcel(pnu) {
        return this.memoryCache.get(pnu);
    }

    // 연결 상태 확인
    isConnectedToSupabase() {
        return this.isConnected;
    }

    // 정리
    destroy() {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }
        
        // 남은 배치 저장
        if (this.writeBatch.length > 0) {
            this.flushBatch();
        }
        
        this.memoryCache.clear();
        console.log('🧹 SupabaseManager 정리 완료');
    }
}

// 전역 사용을 위해 window에 등록
window.SupabaseManager = SupabaseManager;

console.log('📦 SupabaseManager 클래스 로드 완료');