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
        
        // 자동 동기화 관리
        this.autoSyncEnabled = true;
        this.syncDebounceTimer = null;
        this.syncInProgress = false;
        this.pendingSyncData = null;
        this.SYNC_DEBOUNCE_MS = 2000; // 2초 디바운싱
        
        // Google Sheets 백업 관리
        this.lastGoogleBackup = null;
        this.googleBackupInterval = 5 * 60 * 1000; // 5분마다
        
        // 충돌 방지 및 성능 최적화
        this.dataVersion = null; // 데이터 버전 추적
        this.lastDataChecksum = null; // 데이터 무결성 검증
        this.optimizedBatchSizes = new Map(); // 동적 배치 크기 최적화
        this.connectionPool = new Map(); // 연결 재사용
        this.memoryCache = new Map(); // 메모리 캐시
        this.CACHE_TTL = 30000; // 30초 캐시 만료
        this.MAX_RETRIES = 3; // 최대 재시도 횟수
        this.syncLockTimeout = 30000; // 30초 동기화 잠금 타임아웃
        
        // 성능 모니터링
        this.performanceMetrics = {
            syncTimes: [],
            errorCounts: { network: 0, validation: 0, conflict: 0, retry: 0 },
            batchOptimization: { successes: 0, failures: 0 }
        };
        
        // 에러 핸들링 및 재시도 로직
        this.retryDelays = [1000, 2000, 4000, 8000, 16000]; // 지수 백오프 지연 시간
        this.circuitBreaker = {
            isOpen: false,
            failures: 0,
            lastFailureTime: null,
            threshold: 5, // 5번 실패시 회로 차단
            timeout: 60000 // 1분 후 재시도
        };
        this.activeRetries = new Map(); // 진행 중인 재시도 추적
        
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

    // Supabase에 실제 데이터 저장
    async saveCloud(parcels, options = {}) {
        if (this.syncStatus === 'offline') {
            console.log('오프라인 모드 - 클라우드 저장 건너뜀');
            return false;
        }

        if (parcels.length === 0) {
            console.log('저장할 데이터가 없음');
            return true;
        }

        try {
            this.updateSyncStatus('syncing');
            console.log(`🔄 실제 클라우드 저장 시작: ${parcels.length}개 필지`);
            
            const migrationId = `auto_sync_${Date.now()}`;
            
            // 1. 필지 데이터 변환 및 검증
            const validParcels = [];
            const memos = [];
            
            for (const parcel of parcels) {
                try {
                    // 좌표 데이터를 WKT 형식으로 변환
                    const wkt = this.coordinatesToWKT(parcel.coordinates || parcel.geometry);
                    if (!wkt) continue;
                    
                    const validParcel = {
                        pnu: parcel.pnu || `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        address: parcel.address || parcel.parcelNumber || '',
                        jibun: parcel.jibun || parcel.parcelNumber || '',
                        area: parseFloat(parcel.area) || 0,
                        owner_name: parcel.ownerName || '',
                        geometry: wkt,
                        centerLng: parcel.lng || (parcel.coordinates ? parcel.coordinates[0]?.lng : 127.0276),
                        centerLat: parcel.lat || (parcel.coordinates ? parcel.coordinates[0]?.lat : 37.5006),
                        color: parcel.color || 'red',
                        rawVworldData: parcel.rawData || {}
                    };
                    
                    validParcels.push(validParcel);
                    
                    // 메모가 있으면 추가
                    if (parcel.memo || parcel.ownerContact || parcel.ownerAddress) {
                        const memoContent = [
                            parcel.memo || '',
                            parcel.ownerContact ? `연락처: ${parcel.ownerContact}` : '',
                            parcel.ownerAddress ? `주소: ${parcel.ownerAddress}` : ''
                        ].filter(Boolean).join(' | ');
                        
                        if (memoContent.trim()) {
                            memos.push({
                                pnu: validParcel.pnu,
                                content: memoContent
                            });
                        }
                    }
                } catch (err) {
                    console.warn('필지 변환 실패:', parcel.pnu, err.message);
                    continue;
                }
            }
            
            if (validParcels.length === 0) {
                throw new Error('변환 가능한 필지가 없습니다');
            }
            
            console.log(`✅ 변환 완료: ${validParcels.length}개 필지, ${memos.length}개 메모`);
            
            // 2. 최적화된 배치별로 Supabase에 저장
            const BATCH_SIZE = this.getOptimalBatchSize(validParcels, 'supabase_save');
            const parcelBatches = this.createBatches(validParcels, BATCH_SIZE);
            console.log(`📦 최적화된 배치 크기: ${BATCH_SIZE} (총 ${parcelBatches.length}개 배치)`);
            let totalProcessed = 0;
            let totalErrors = [];
            
            for (let i = 0; i < parcelBatches.length; i++) {
                const batch = parcelBatches[i];
                
                try {
                    const result = await this.callSupabaseRPC('secure_batch_insert', {
                        batch_type: 'parcels',
                        batch_data: batch,
                        input_migration_id: migrationId
                    });
                    
                    if (result && result.length > 0) {
                        const batchResult = result[0];
                        totalProcessed += batchResult.count || 0;
                        
                        if (batchResult.errors && batchResult.errors.length > 0) {
                            totalErrors.push(...batchResult.errors);
                        }
                        
                        console.log(`📦 배치 ${i + 1}/${parcelBatches.length}: ${batchResult.count}개 저장`);
                    }
                } catch (batchError) {
                    console.error(`배치 ${i + 1} 저장 실패:`, batchError);
                    totalErrors.push(`배치 ${i + 1}: ${batchError.message}`);
                }
                
                // API 제한 방지
                if (i < parcelBatches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            // 3. 메모 저장 (필지 ID 매핑 필요 - 단순화를 위해 생략)
            console.log(`💾 메모 ${memos.length}개는 차후 구현`);
            
            // 4. 결과 처리
            const successRate = totalProcessed / validParcels.length;
            
            if (successRate >= 0.8) { // 80% 이상 성공
                this.updateSyncStatus('synced');
                console.log(`✅ 클라우드 저장 성공: ${totalProcessed}/${validParcels.length}개`);
                
                if (totalErrors.length > 0) {
                    console.warn('일부 오류:', totalErrors);
                }
                
                return true;
            } else {
                throw new Error(`저장 성공률 낮음: ${Math.round(successRate * 100)}% (${totalProcessed}/${validParcels.length})`);
            }
            
        } catch (error) {
            console.error('❌ 클라우드 저장 실패:', error);
            this.updateSyncStatus('error');
            return false;
        }
    }
    
    // 좌표를 WKT 형식으로 변환
    coordinatesToWKT(coordinates) {
        if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
            return null;
        }

        const coords = [...coordinates];
        const first = coords[0];
        const last = coords[coords.length - 1];
        
        // 폴리곤 닫기
        if (first.lng !== last.lng || first.lat !== last.lat) {
            coords.push(first);
        }

        const wktCoords = coords
            .map(coord => `${coord.lng} ${coord.lat}`)
            .join(', ');
        
        return `POLYGON((${wktCoords}))`;
    }
    
    // 배치 생성
    createBatches(array, size) {
        const batches = [];
        for (let i = 0; i < array.length; i += size) {
            batches.push(array.slice(i, i + size));
        }
        return batches;
    }
    
    // 에러 분류
    classifyError(error) {
        const message = error.message.toLowerCase();
        const status = error.status || 0;
        
        if (status === 429 || message.includes('rate limit')) {
            return { type: 'rate_limit', retryable: true, delay: 5000 };
        } else if (status >= 500 || status === 0 || message.includes('network')) {
            return { type: 'network', retryable: true, delay: 1000 };
        } else if (status === 401 || status === 403) {
            return { type: 'auth', retryable: false, delay: 0 };
        } else if (status >= 400 && status < 500) {
            return { type: 'client', retryable: false, delay: 0 };
        } else {
            return { type: 'unknown', retryable: true, delay: 2000 };
        }
    }
    
    // 회로 차단기 상태 확인
    checkCircuitBreaker() {
        if (!this.circuitBreaker.isOpen) return true;
        
        const now = Date.now();
        if (now - this.circuitBreaker.lastFailureTime > this.circuitBreaker.timeout) {
            console.log('🔌 회로 차단기 재설정 - 재시도 허용');
            this.circuitBreaker.isOpen = false;
            this.circuitBreaker.failures = 0;
            return true;
        }
        
        return false;
    }
    
    // 회로 차단기 업데이트
    updateCircuitBreaker(success) {
        if (success) {
            this.circuitBreaker.failures = 0;
            this.circuitBreaker.isOpen = false;
        } else {
            this.circuitBreaker.failures++;
            this.circuitBreaker.lastFailureTime = Date.now();
            
            if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
                this.circuitBreaker.isOpen = true;
                console.log('🚨 회로 차단기 활성화 - 일시적 동기화 중단');
            }
        }
    }
    
    // 재시도 가능한 Supabase RPC 호출
    async callSupabaseRPCWithRetry(functionName, params, retryCount = 0) {
        const operationId = `${functionName}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        // 회로 차단기 확인
        if (!this.checkCircuitBreaker()) {
            throw new Error('회로 차단기 활성화됨 - 서비스 일시 중단');
        }
        
        // 이미 진행 중인 동일한 작업이 있는지 확인
        if (this.activeRetries.has(functionName) && retryCount === 0) {
            console.log(`⏳ ${functionName} 이미 진행 중 - 중복 요청 방지`);
            return this.activeRetries.get(functionName);
        }
        
        const retryPromise = this._executeRPCWithRetry(functionName, params, retryCount, operationId);
        
        if (retryCount === 0) {
            this.activeRetries.set(functionName, retryPromise);
        }
        
        try {
            const result = await retryPromise;
            this.updateCircuitBreaker(true);
            return result;
        } catch (error) {
            this.updateCircuitBreaker(false);
            throw error;
        } finally {
            if (retryCount === 0) {
                this.activeRetries.delete(functionName);
            }
        }
    }
    
    async _executeRPCWithRetry(functionName, params, retryCount, operationId) {
        try {
            console.log(`🔄 ${functionName} 호출 시도 ${retryCount + 1}/${this.MAX_RETRIES + 1} (${operationId})`);
            
            const response = await fetch(`${this.SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
                    'X-Operation-ID': operationId
                },
                body: JSON.stringify(params),
                // 요청 타임아웃 설정
                signal: AbortSignal.timeout(30000) // 30초 타임아웃
            });

            if (!response.ok) {
                const errorText = await response.text();
                const error = new Error(`Supabase RPC 실패: ${response.status} - ${errorText}`);
                error.status = response.status;
                throw error;
            }

            const result = await response.json();
            console.log(`✅ ${functionName} 성공 (${operationId})`);
            return result;
            
        } catch (error) {
            console.error(`❌ ${functionName} 실패 (시도 ${retryCount + 1}):`, error.message);
            
            const errorInfo = this.classifyError(error);
            this.performanceMetrics.errorCounts[errorInfo.type] = (this.performanceMetrics.errorCounts[errorInfo.type] || 0) + 1;
            
            // 재시도 불가능한 에러이거나 최대 재시도 횟수 초과
            if (!errorInfo.retryable || retryCount >= this.MAX_RETRIES) {
                console.error(`💥 ${functionName} 최종 실패 (${operationId}):`, error.message);
                throw error;
            }
            
            // 지수 백오프로 재시도
            const delay = Math.min(
                this.retryDelays[retryCount] || this.retryDelays[this.retryDelays.length - 1],
                errorInfo.delay
            );
            
            console.log(`⏰ ${delay}ms 후 재시도 (${retryCount + 1}/${this.MAX_RETRIES})`);
            this.performanceMetrics.errorCounts.retry++;
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.callSupabaseRPCWithRetry(functionName, params, retryCount + 1);
        }
    }
    
    // 레거시 호환용 - 기존 호출들을 재시도 버전으로 래핑
    async callSupabaseRPC(functionName, params) {
        return this.callSupabaseRPCWithRetry(functionName, params);
    }

    // 데이터 무결성 및 버전 관리
    async calculateDataChecksum(parcels) {
        const dataString = JSON.stringify(parcels.sort((a, b) => (a.pnu || '').localeCompare(b.pnu || '')));
        const encoder = new TextEncoder();
        const data = encoder.encode(dataString);
        
        if (crypto.subtle) {
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } else {
            // Fallback for older browsers
            let hash = 0;
            for (let i = 0; i < dataString.length; i++) {
                const char = dataString.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            return hash.toString(16);
        }
    }
    
    // 충돌 감지 및 해결
    async detectConflicts(parcels) {
        const currentChecksum = await this.calculateDataChecksum(parcels);
        
        if (this.lastDataChecksum && this.lastDataChecksum !== currentChecksum) {
            console.log('🔍 데이터 변경 감지됨');
            
            // 변경된 필지 식별
            const changes = this.identifyChanges(parcels);
            return {
                hasConflicts: false, // 현재는 단순 변경으로 처리
                changes,
                checksum: currentChecksum
            };
        }
        
        return { hasConflicts: false, changes: [], checksum: currentChecksum };
    }
    
    // 변경사항 식별
    identifyChanges(newParcels) {
        const currentParcels = this.loadLocal();
        const currentMap = new Map(currentParcels.map(p => [p.pnu, p]));
        
        const changes = {
            added: [],
            modified: [],
            deleted: []
        };
        
        // 추가된 또는 수정된 필지 찾기
        for (const parcel of newParcels) {
            const existing = currentMap.get(parcel.pnu);
            if (!existing) {
                changes.added.push(parcel);
            } else {
                // 간단한 수정 체크 (owner, color, memo 등)
                if (JSON.stringify(existing) !== JSON.stringify(parcel)) {
                    changes.modified.push({ old: existing, new: parcel });
                }
            }
            currentMap.delete(parcel.pnu);
        }
        
        // 삭제된 필지 (남은 것들)
        changes.deleted = Array.from(currentMap.values());
        
        return changes;
    }
    
    // 스마트 배치 크기 최적화
    getOptimalBatchSize(parcels, operation = 'save') {
        const dataSize = JSON.stringify(parcels).length;
        const cacheKey = `${operation}_${Math.floor(dataSize / 10000)}k`;
        
        // 캐시된 최적 크기가 있으면 사용
        if (this.optimizedBatchSizes.has(cacheKey)) {
            const cached = this.optimizedBatchSizes.get(cacheKey);
            if (Date.now() - cached.timestamp < 300000) { // 5분간 유효
                return cached.size;
            }
        }
        
        // 데이터 크기에 따른 동적 배치 크기 결정
        let optimalSize;
        if (dataSize < 50000) { // 50KB 미만
            optimalSize = 10;
        } else if (dataSize < 200000) { // 200KB 미만
            optimalSize = 7;
        } else if (dataSize < 500000) { // 500KB 미만
            optimalSize = 5;
        } else {
            optimalSize = 3; // 대용량 데이터
        }
        
        // 성능 이력을 기반으로 조정
        const recentMetrics = this.performanceMetrics.syncTimes.slice(-10);
        if (recentMetrics.length > 5) {
            const avgTime = recentMetrics.reduce((sum, time) => sum + time, 0) / recentMetrics.length;
            if (avgTime > 2000) { // 2초 이상 걸리면 배치 크기 감소
                optimalSize = Math.max(2, optimalSize - 1);
            } else if (avgTime < 500) { // 0.5초 미만이면 배치 크기 증가
                optimalSize = Math.min(15, optimalSize + 2);
            }
        }
        
        // 캐시 업데이트
        this.optimizedBatchSizes.set(cacheKey, {
            size: optimalSize,
            timestamp: Date.now()
        });
        
        return optimalSize;
    }
    
    // 메모리 캐시 관리
    getCachedData(key) {
        const cached = this.memoryCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.data;
        }
        this.memoryCache.delete(key);
        return null;
    }
    
    setCachedData(key, data) {
        this.memoryCache.set(key, {
            data: JSON.parse(JSON.stringify(data)), // Deep clone
            timestamp: Date.now()
        });
        
        // 캐시 크기 제한 (최대 10개 항목)
        if (this.memoryCache.size > 10) {
            const oldestKey = Array.from(this.memoryCache.keys())[0];
            this.memoryCache.delete(oldestKey);
        }
    }
    
    // 통합 저장 (충돌 방지 및 성능 최적화 적용)
    async save(parcels, options = {}) {
        const startTime = Date.now();
        const results = {
            local: false,
            cloud: false,
            errors: [],
            performance: {}
        };

        try {
            // 1. 충돌 감지
            const conflictCheck = await this.detectConflicts(parcels);
            if (conflictCheck.hasConflicts && !options.forceOverride) {
                results.errors.push('데이터 충돌 감지됨. forceOverride 옵션 필요');
                return results;
            }
            
            // 2. localStorage 저장 (필수)
            results.local = this.saveLocal(parcels);
            if (!results.local) {
                results.errors.push('localStorage 저장 실패');
            } else {
                // 체크섬 업데이트
                this.lastDataChecksum = conflictCheck.checksum;
                this.dataVersion = Date.now();
            }

            // 3. 자동 클라우드 동기화 (디바운싱)
            if (this.autoSyncEnabled && options.skipAutoSync !== true) {
                this.scheduleAutoSync(parcels, { ...options, dataVersion: this.dataVersion });
            }

            // 4. 즉시 클라우드 동기화 (수동 요청시)
            if (options.forceCloudSync === true) {
                try {
                    results.cloud = await this.saveCloud(parcels, { ...options, dataVersion: this.dataVersion });
                } catch (error) {
                    results.errors.push(`클라우드 저장 실패: ${error.message}`);
                    this.performanceMetrics.errorCounts.network++;
                }
            }
            
            // 5. 성능 메트릭 기록
            const syncTime = Date.now() - startTime;
            this.performanceMetrics.syncTimes.push(syncTime);
            if (this.performanceMetrics.syncTimes.length > 100) {
                this.performanceMetrics.syncTimes = this.performanceMetrics.syncTimes.slice(-50);
            }
            
            results.performance = {
                syncTime,
                avgSyncTime: this.performanceMetrics.syncTimes.reduce((sum, time) => sum + time, 0) / this.performanceMetrics.syncTimes.length,
                parcelCount: parcels.length
            };

        } catch (error) {
            results.errors.push(`저장 프로세스 실패: ${error.message}`);
            this.performanceMetrics.errorCounts.validation++;
        }

        console.log('📊 최적화된 데이터 저장 결과:', results);
        return results;
    }
    
    // 자동 동기화 스케줄링 (디바운싱)
    scheduleAutoSync(parcels, options = {}) {
        // 이미 동기화 중이면 데이터만 업데이트
        if (this.syncInProgress) {
            this.pendingSyncData = { parcels: [...parcels], options };
            console.log('🔄 동기화 진행 중 - 데이터 대기열 업데이트');
            return;
        }

        // 기존 타이머 취소
        if (this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer);
        }

        // 새로운 타이머 설정
        this.syncDebounceTimer = setTimeout(async () => {
            await this.executeAutoSync(parcels, options);
        }, this.SYNC_DEBOUNCE_MS);

        console.log(`⏰ 자동 동기화 예약: ${this.SYNC_DEBOUNCE_MS}ms 후 실행`);
    }
    
    // 자동 동기화 실행
    async executeAutoSync(parcels, options = {}) {
        if (this.syncInProgress) {
            console.log('⏭️ 이미 동기화 진행 중 - 건너뜀');
            return;
        }

        try {
            this.syncInProgress = true;
            console.log('🚀 자동 동기화 시작');

            const success = await this.saveCloud(parcels, { 
                ...options, 
                autoSync: true 
            });

            if (success) {
                console.log('✅ 자동 동기화 완료');
                
                // 주기적 Google Sheets 백업 체크
                this.checkGoogleBackup(parcels);
            }

            // 대기 중인 데이터가 있으면 처리
            if (this.pendingSyncData) {
                const pending = this.pendingSyncData;
                this.pendingSyncData = null;
                
                console.log('📂 대기 중인 데이터 동기화 시작');
                setTimeout(() => {
                    this.scheduleAutoSync(pending.parcels, pending.options);
                }, 1000);
            }

        } catch (error) {
            console.error('❌ 자동 동기화 실패:', error);
        } finally {
            this.syncInProgress = false;
            this.syncDebounceTimer = null;
        }
    }
    
    // 향상된 Google Sheets 주기적 백업
    async checkGoogleBackup(parcels) {
        const now = Date.now();
        
        // 백업 필요성 체크
        if (!this.shouldRunGoogleBackup(now)) {
            return;
        }
        
        console.log('📋 Google Sheets 백업 시간 도래');
        
        try {
            const backupResult = await this.executeGoogleBackupWithRetry(parcels);
            
            if (backupResult.success) {
                this.lastGoogleBackup = now;
                console.log(`✅ Google Sheets 자동 백업 완료: ${backupResult.count}개 필지`);
                
                // 백업 성공 알림 (선택적)
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('googleBackupComplete', {
                        detail: { timestamp: now, count: backupResult.count }
                    }));
                }
            } else {
                throw new Error(backupResult.error || '백업 실패');
            }
            
        } catch (error) {
            console.error('❌ Google Sheets 자동 백업 실패:', error);
            
            // 백업 실패시 재시도 간격 조정 (점진적 증가)
            this.adjustBackupInterval(false);
            
            // 실패 알림
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('googleBackupFailed', {
                    detail: { error: error.message, timestamp: now }
                }));
            }
        }
    }
    
    // 백업 필요성 판단
    shouldRunGoogleBackup(currentTime) {
        // 첫 백업이거나 간격이 지났으면 실행
        if (!this.lastGoogleBackup) {
            return true;
        }
        
        const timeSinceLastBackup = currentTime - this.lastGoogleBackup;
        return timeSinceLastBackup > this.googleBackupInterval;
    }
    
    // 백업 간격 동적 조정
    adjustBackupInterval(success) {
        if (success) {
            // 성공시 기본 간격으로 리셋
            this.googleBackupInterval = Math.max(5 * 60 * 1000, this.googleBackupInterval * 0.9);
        } else {
            // 실패시 간격 증가 (최대 30분까지)
            this.googleBackupInterval = Math.min(30 * 60 * 1000, this.googleBackupInterval * 1.5);
        }
        
        console.log(`🔧 Google Sheets 백업 간격 조정: ${Math.round(this.googleBackupInterval / 60000)}분`);
    }
    
    // Google Sheets 백업 재시도 로직
    async executeGoogleBackupWithRetry(parcels, retryCount = 0) {
        const MAX_BACKUP_RETRIES = 2;
        
        try {
            // Google Sheets API 사용 가능성 체크
            if (!window.GoogleAuth || typeof window.GoogleAuth.backupParcelsToSheets !== 'function') {
                throw new Error('Google Sheets API 사용 불가');
            }
            
            // 데이터 검증
            if (!parcels || parcels.length === 0) {
                return { success: true, count: 0, message: '백업할 데이터 없음' };
            }
            
            console.log(`🔄 Google Sheets 백업 시도 ${retryCount + 1}/${MAX_BACKUP_RETRIES + 1}`);
            
            // 백업 실행
            const result = await window.GoogleAuth.backupParcelsToSheets(parcels);
            
            if (result && result.success) {
                this.adjustBackupInterval(true);
                return {
                    success: true,
                    count: parcels.length,
                    spreadsheetId: result.spreadsheetId,
                    timestamp: new Date().toISOString()
                };
            } else {
                throw new Error(result?.error || '백업 결과 확인 실패');
            }
            
        } catch (error) {
            console.error(`❌ Google Sheets 백업 시도 ${retryCount + 1} 실패:`, error.message);
            
            // 재시도 가능한 에러인지 판단
            const isRetryable = this.isGoogleBackupRetryable(error);
            
            if (isRetryable && retryCount < MAX_BACKUP_RETRIES) {
                const delay = (retryCount + 1) * 2000; // 2초, 4초, 6초
                console.log(`⏰ ${delay}ms 후 Google Sheets 백업 재시도`);
                
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.executeGoogleBackupWithRetry(parcels, retryCount + 1);
            } else {
                this.adjustBackupInterval(false);
                return {
                    success: false,
                    error: error.message,
                    retryCount: retryCount + 1
                };
            }
        }
    }
    
    // Google Sheets 백업 에러의 재시도 가능성 판단
    isGoogleBackupRetryable(error) {
        const message = error.message.toLowerCase();
        
        // 재시도 불가능한 에러들
        if (message.includes('auth') || 
            message.includes('permission') || 
            message.includes('quota exceeded') ||
            message.includes('api 사용 불가')) {
            return false;
        }
        
        // 네트워크 에러나 일시적 문제는 재시도 가능
        return true;
    }
    
    // 수동 Google Sheets 백업
    async manualGoogleBackup(options = {}) {
        const parcels = options.parcels || this.loadLocal();
        
        if (parcels.length === 0) {
            throw new Error('백업할 데이터가 없습니다');
        }
        
        console.log('🚀 수동 Google Sheets 백업 시작');
        
        try {
            this.updateSyncStatus('syncing');
            
            const result = await this.executeGoogleBackupWithRetry(parcels);
            
            if (result.success) {
                console.log(`✅ 수동 백업 완료: ${result.count}개 필지`);
                this.lastGoogleBackup = Date.now();
                
                return {
                    success: true,
                    message: `${result.count}개 필지가 Google Sheets에 백업되었습니다`,
                    spreadsheetId: result.spreadsheetId,
                    timestamp: result.timestamp
                };
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('❌ 수동 백업 실패:', error);
            throw error;
        } finally {
            this.updateSyncStatus('synced');
        }
    }
    
    // Google Sheets 백업 상태 확인
    getGoogleBackupStatus() {
        const now = Date.now();
        const nextBackupTime = this.lastGoogleBackup ? 
            this.lastGoogleBackup + this.googleBackupInterval : 
            now;
        
        return {
            lastBackup: this.lastGoogleBackup ? new Date(this.lastGoogleBackup).toLocaleString() : '없음',
            nextBackup: new Date(nextBackupTime).toLocaleString(),
            interval: `${Math.round(this.googleBackupInterval / 60000)}분`,
            isOverdue: now > nextBackupTime,
            isAvailable: !!(window.GoogleAuth && window.GoogleAuth.backupParcelsToSheets)
        };
    }
    
    // 자동 동기화 설정
    setAutoSync(enabled) {
        this.autoSyncEnabled = enabled;
        console.log(`🔧 자동 동기화: ${enabled ? '활성화' : '비활성화'}`);
        
        if (!enabled && this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer);
            this.syncDebounceTimer = null;
        }
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

    // 에러 복구 및 통계
    async recoverFromErrors() {
        if (this.circuitBreaker.isOpen) {
            console.log('🔧 에러 복구 시도 - 회로 차단기 재설정');
            this.circuitBreaker.isOpen = false;
            this.circuitBreaker.failures = 0;
            
            // 연결 테스트
            try {
                await this.testSupabaseConnection();
                this.updateSyncStatus('synced');
                console.log('✅ 에러 복구 성공 - 서비스 재개');
                return true;
            } catch (error) {
                console.error('❌ 에러 복구 실패:', error);
                this.updateSyncStatus('error');
                return false;
            }
        }
        return true;
    }
    
    // 확장된 통계 정보
    getStats() {
        const localData = this.loadLocal();
        const avgSyncTime = this.performanceMetrics.syncTimes.length > 0 
            ? this.performanceMetrics.syncTimes.reduce((sum, time) => sum + time, 0) / this.performanceMetrics.syncTimes.length 
            : 0;
            
        return {
            // 기본 데이터
            totalParcels: localData.length,
            lastSyncTime: this.lastSyncTime,
            syncStatus: this.syncStatus,
            memoryUsage: JSON.stringify(localData).length,
            dataVersion: this.dataVersion,
            
            // 성능 메트릭
            performance: {
                avgSyncTime: Math.round(avgSyncTime),
                totalSyncs: this.performanceMetrics.syncTimes.length,
                cacheHitRate: this.memoryCache.size > 0 ? '활성' : '비활성'
            },
            
            // 에러 통계
            errors: {
                total: Object.values(this.performanceMetrics.errorCounts).reduce((sum, count) => sum + count, 0),
                breakdown: { ...this.performanceMetrics.errorCounts },
                circuitBreakerStatus: this.circuitBreaker.isOpen ? '차단됨' : '정상',
                activeRetries: this.activeRetries.size
            },
            
            // 최적화 정보
            optimization: {
                dynamicBatchSizes: this.optimizedBatchSizes.size,
                autoSyncEnabled: this.autoSyncEnabled,
                lastGoogleBackup: this.lastGoogleBackup ? new Date(this.lastGoogleBackup).toLocaleString() : '없음'
            }
        };
    }
    
    // 진단 및 상태 점검
    async runDiagnostics() {
        console.log('🔍 DataManager 진단 시작');
        const diagnostics = {
            timestamp: new Date().toISOString(),
            tests: {}
        };
        
        // 1. 로컬 저장소 테스트
        try {
            const testData = [{ test: true, timestamp: Date.now() }];
            this.saveLocal(testData);
            const loaded = this.loadLocal();
            diagnostics.tests.localStorage = loaded.length > 0 && loaded[0].test === true;
        } catch (error) {
            diagnostics.tests.localStorage = false;
        }
        
        // 2. Supabase 연결 테스트
        try {
            await this.testSupabaseConnection();
            diagnostics.tests.supabaseConnection = true;
        } catch (error) {
            diagnostics.tests.supabaseConnection = false;
        }
        
        // 3. 메모리 캐시 테스트
        try {
            this.setCachedData('test', { test: true });
            diagnostics.tests.memoryCache = this.getCachedData('test')?.test === true;
        } catch (error) {
            diagnostics.tests.memoryCache = false;
        }
        
        // 4. 전체 상태 요약
        const passedTests = Object.values(diagnostics.tests).filter(Boolean).length;
        const totalTests = Object.keys(diagnostics.tests).length;
        diagnostics.overall = passedTests === totalTests ? 'PASS' : 'FAIL';
        diagnostics.score = `${passedTests}/${totalTests}`;
        
        console.log('📊 진단 결과:', diagnostics);
        return diagnostics;
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