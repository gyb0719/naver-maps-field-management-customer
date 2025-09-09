/**
 * 백업 관리자 - 일일 자동 백업 및 월간 수동 백업 시스템
 * 컴퓨터를 잘 모르는 사용자도 쉽게 사용할 수 있는 백업/복원 기능
 */

class BackupManager {
    constructor(supabaseManager) {
        this.supabaseManager = supabaseManager;
        this.isBackupInProgress = false;
        this.isRestoreInProgress = false;
        
        // 백업 설정
        this.AUTO_BACKUP_ENABLED = true;
        this.AUTO_BACKUP_TIME = '02:00'; // 새벽 2시 자동 백업
        this.BACKUP_RETENTION_DAYS = 30; // 30일간 백업 보관
        this.MANUAL_BACKUP_RETENTION_MONTHS = 12; // 12개월간 수동 백업 보관
        
        // 백업 상태 관리
        this.lastAutoBackupTime = null;
        this.lastManualBackupTime = null;
        this.backupHistory = [];
        
        // 압축 설정 (대용량 데이터 처리)
        this.COMPRESSION_ENABLED = true;
        this.CHUNK_SIZE = 1000; // 1000개씩 처리
        
        this.init();
    }

    // 초기화
    async init() {
        try {
            console.log('🔧 BackupManager 초기화 시작...');
            
            // 백업 상태 로드
            await this.loadBackupStatus();
            
            // 자동 백업 스케줄러 설정
            this.setupAutoBackupScheduler();
            
            // 페이지 언로드 시 정리
            window.addEventListener('beforeunload', () => {
                this.cleanup();
            });
            
            console.log('✅ BackupManager 초기화 완료');
            
        } catch (error) {
            console.error('❌ BackupManager 초기화 실패:', error);
        }
    }

    // 자동 백업 스케줄러 설정
    setupAutoBackupScheduler() {
        if (!this.AUTO_BACKUP_ENABLED) return;
        
        // 매분마다 백업 시간 체크
        setInterval(() => {
            this.checkAutoBackupTime();
        }, 60000); // 1분마다 체크
        
        console.log(`⏰ 자동 백업 스케줄러 설정 완료 (매일 ${this.AUTO_BACKUP_TIME})`);
    }

    // 자동 백업 시간 체크
    async checkAutoBackupTime() {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5); // HH:MM 형식
        const today = now.toISOString().split('T')[0]; // YYYY-MM-DD 형식
        
        // 백업 시간이고 오늘 백업이 안된 경우
        if (currentTime === this.AUTO_BACKUP_TIME) {
            const lastBackupDate = this.lastAutoBackupTime ? 
                new Date(this.lastAutoBackupTime).toISOString().split('T')[0] : null;
            
            if (lastBackupDate !== today) {
                console.log('🕐 자동 백업 시간 도래 - 백업 시작');
                await this.performAutoBackup();
            }
        }
    }

    // 자동 백업 수행
    async performAutoBackup() {
        if (this.isBackupInProgress) {
            console.log('⚠️ 백업이 이미 진행 중입니다');
            return false;
        }

        try {
            this.isBackupInProgress = true;
            console.log('🔄 일일 자동 백업 시작...');
            
            const startTime = performance.now();
            
            // 현재 모든 데이터 수집
            const backupData = await this.collectAllData();
            
            // 백업 메타데이터 생성
            const backupMetadata = {
                backup_id: this.generateBackupId(),
                backup_type: 'auto_daily',
                created_at: new Date().toISOString(),
                data_count: {
                    parcels: backupData.parcels?.length || 0,
                    settings: backupData.settings?.length || 0
                },
                compressed: this.COMPRESSION_ENABLED,
                version: '1.0'
            };
            
            // 데이터 압축 (필요시)
            let finalData = backupData;
            if (this.COMPRESSION_ENABLED) {
                finalData = await this.compressBackupData(backupData);
            }
            
            // Supabase에 백업 저장
            await this.saveBackupToSupabase(backupMetadata, finalData);
            
            // 오래된 백업 정리
            await this.cleanupOldBackups();
            
            this.lastAutoBackupTime = new Date().toISOString();
            await this.saveBackupStatus();
            
            const duration = ((performance.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ 자동 백업 완료 (${duration}초, ${backupMetadata.data_count.parcels}개 필지)`);
            
            // 백업 성공 알림
            this.showBackupNotification('자동 백업이 완료되었습니다', 'success');
            
            return true;
            
        } catch (error) {
            console.error('❌ 자동 백업 실패:', error);
            this.showBackupNotification('자동 백업이 실패했습니다', 'error');
            return false;
            
        } finally {
            this.isBackupInProgress = false;
        }
    }

    // 수동 백업 수행 (Google Drive용)
    async performManualBackup() {
        if (this.isBackupInProgress) {
            this.showBackupNotification('백업이 이미 진행 중입니다', 'warning');
            return false;
        }

        try {
            this.isBackupInProgress = true;
            this.showBackupNotification('수동 백업을 시작합니다...', 'info');
            
            const startTime = performance.now();
            
            // 현재 모든 데이터 수집
            const backupData = await this.collectAllData();
            
            // 백업 파일 생성
            const backupFile = await this.createBackupFile(backupData);
            
            // 파일 다운로드
            this.downloadBackupFile(backupFile);
            
            this.lastManualBackupTime = new Date().toISOString();
            await this.saveBackupStatus();
            
            const duration = ((performance.now() - startTime) / 1000).toFixed(2);
            const parcelCount = backupData.parcels?.length || 0;
            
            console.log(`✅ 수동 백업 파일 생성 완료 (${duration}초, ${parcelCount}개 필지)`);
            this.showBackupNotification(`백업 파일이 다운로드됩니다 (${parcelCount}개 필지)`, 'success');
            
            return true;
            
        } catch (error) {
            console.error('❌ 수동 백업 실패:', error);
            this.showBackupNotification('수동 백업이 실패했습니다', 'error');
            return false;
            
        } finally {
            this.isBackupInProgress = false;
        }
    }

    // 모든 데이터 수집
    async collectAllData() {
        try {
            console.log('📦 백업할 데이터 수집 중...');
            
            // Supabase에서 모든 필지 데이터 로드
            const parcels = await this.supabaseManager.loadAllParcels();
            
            // 설정 및 기타 데이터 (추후 확장 가능)
            const settings = await this.collectSettings();
            
            const backupData = {
                parcels: parcels || [],
                settings: settings || [],
                metadata: {
                    export_date: new Date().toISOString(),
                    total_parcels: parcels?.length || 0,
                    version: '1.0'
                }
            };
            
            console.log(`📊 수집 완료: ${backupData.parcels.length}개 필지, ${backupData.settings.length}개 설정`);
            return backupData;
            
        } catch (error) {
            console.error('❌ 데이터 수집 실패:', error);
            throw error;
        }
    }

    // 설정 데이터 수집
    async collectSettings() {
        try {
            // IndexedDB 캐시에서 설정값 수집
            const settings = [];
            
            if (window.indexedDBCache) {
                // 캐시된 설정값들 수집 (필요시)
                const mapSettings = {
                    key: 'map_center',
                    value: window.map?.getCenter() || null,
                    category: 'map'
                };
                settings.push(mapSettings);
                
                const zoomSettings = {
                    key: 'map_zoom',
                    value: window.map?.getZoom() || 15,
                    category: 'map'
                };
                settings.push(zoomSettings);
            }
            
            return settings;
            
        } catch (error) {
            console.warn('⚠️ 설정 데이터 수집 중 오류:', error);
            return [];
        }
    }

    // 데이터 압축 (대용량 처리)
    async compressBackupData(data) {
        try {
            // JSON 문자열로 변환 후 간단한 압축
            const jsonString = JSON.stringify(data);
            
            // 필요시 여기에 실제 압축 알고리즘 구현 (예: LZ-string)
            // 현재는 기본 JSON 반환
            console.log(`💾 백업 데이터 크기: ${(jsonString.length / 1024 / 1024).toFixed(2)}MB`);
            
            return data;
            
        } catch (error) {
            console.warn('⚠️ 데이터 압축 실패, 원본 데이터 사용:', error);
            return data;
        }
    }

    // Supabase에 백업 저장
    async saveBackupToSupabase(metadata, data) {
        try {
            const { error } = await this.supabaseManager.supabase
                .from('daily_backups')
                .insert({
                    backup_id: metadata.backup_id,
                    backup_type: metadata.backup_type,
                    backup_data: data,
                    metadata: metadata,
                    created_at: metadata.created_at
                });
            
            if (error) throw error;
            
            console.log(`💾 Supabase 백업 저장 완료: ${metadata.backup_id}`);
            
        } catch (error) {
            console.error('❌ Supabase 백업 저장 실패:', error);
            throw error;
        }
    }

    // 백업 파일 생성 (수동 백업용)
    async createBackupFile(data) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `naver-maps-backup-${timestamp}.json`;
        
        const backupContent = {
            ...data,
            backup_info: {
                created_at: new Date().toISOString(),
                backup_type: 'manual',
                application: 'Naver Maps Field Management',
                version: '1.0'
            }
        };
        
        return {
            filename,
            content: JSON.stringify(backupContent, null, 2),
            size: JSON.stringify(backupContent).length
        };
    }

    // 백업 파일 다운로드
    downloadBackupFile(backupFile) {
        try {
            const blob = new Blob([backupFile.content], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = backupFile.filename;
            a.style.display = 'none';
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            console.log(`📁 백업 파일 다운로드: ${backupFile.filename} (${(backupFile.size / 1024).toFixed(2)}KB)`);
            
        } catch (error) {
            console.error('❌ 백업 파일 다운로드 실패:', error);
            throw error;
        }
    }

    // 백업에서 데이터 복원
    async restoreFromBackup(backupData, options = {}) {
        if (this.isRestoreInProgress) {
            this.showBackupNotification('복원이 이미 진행 중입니다', 'warning');
            return false;
        }

        try {
            this.isRestoreInProgress = true;
            this.showBackupNotification('백업 데이터를 복원하고 있습니다...', 'info');
            
            const startTime = performance.now();
            
            // 백업 데이터 검증
            if (!this.validateBackupData(backupData)) {
                throw new Error('백업 데이터가 유효하지 않습니다');
            }
            
            // 기존 데이터 백업 (안전장치)
            if (options.createSafetyBackup !== false) {
                await this.createSafetyBackup();
            }
            
            // 데이터 복원
            const restored = await this.restoreDataToSupabase(backupData);
            
            // 캐시 새로고침
            if (this.supabaseManager.memoryCache) {
                this.supabaseManager.memoryCache.clear();
            }
            
            const duration = ((performance.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ 백업 복원 완료 (${duration}초, ${restored.parcels}개 필지)`);
            
            this.showBackupNotification(`백업이 성공적으로 복원되었습니다 (${restored.parcels}개 필지)`, 'success');
            
            // 페이지 새로고침 권장
            if (confirm('복원이 완료되었습니다. 페이지를 새로고침하시겠습니까?')) {
                window.location.reload();
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ 백업 복원 실패:', error);
            this.showBackupNotification('백업 복원이 실패했습니다', 'error');
            return false;
            
        } finally {
            this.isRestoreInProgress = false;
        }
    }

    // 백업 데이터 검증
    validateBackupData(data) {
        try {
            if (!data || typeof data !== 'object') return false;
            
            // 필수 필드 확인
            if (!data.parcels || !Array.isArray(data.parcels)) return false;
            if (!data.metadata) return false;
            
            // 필지 데이터 구조 확인 (샘플링)
            const sampleParcel = data.parcels[0];
            if (sampleParcel && !sampleParcel.pnu) return false;
            
            console.log(`✅ 백업 데이터 검증 완료 (${data.parcels.length}개 필지)`);
            return true;
            
        } catch (error) {
            console.error('❌ 백업 데이터 검증 실패:', error);
            return false;
        }
    }

    // Supabase에 데이터 복원
    async restoreDataToSupabase(backupData) {
        try {
            const parcels = backupData.parcels || [];
            let restoredCount = 0;
            
            // 청크 단위로 복원 (성능 최적화)
            for (let i = 0; i < parcels.length; i += this.CHUNK_SIZE) {
                const chunk = parcels.slice(i, i + this.CHUNK_SIZE);
                
                const { error } = await this.supabaseManager.supabase
                    .from('parcels')
                    .upsert(chunk, { onConflict: 'pnu' });
                
                if (error) throw error;
                
                restoredCount += chunk.length;
                console.log(`📥 복원 진행: ${restoredCount}/${parcels.length} (${((restoredCount/parcels.length)*100).toFixed(1)}%)`);
            }
            
            return {
                parcels: restoredCount,
                settings: backupData.settings?.length || 0
            };
            
        } catch (error) {
            console.error('❌ Supabase 데이터 복원 실패:', error);
            throw error;
        }
    }

    // 안전 백업 생성 (복원 전 현재 상태 백업)
    async createSafetyBackup() {
        try {
            console.log('🔐 안전 백업 생성 중...');
            
            const currentData = await this.collectAllData();
            const safetyBackupMetadata = {
                backup_id: this.generateBackupId('safety'),
                backup_type: 'safety_backup',
                created_at: new Date().toISOString(),
                data_count: {
                    parcels: currentData.parcels?.length || 0
                }
            };
            
            await this.saveBackupToSupabase(safetyBackupMetadata, currentData);
            console.log('✅ 안전 백업 생성 완료');
            
        } catch (error) {
            console.warn('⚠️ 안전 백업 생성 실패:', error);
        }
    }

    // 백업 목록 조회
    async getBackupHistory(type = null, limit = 10) {
        try {
            let query = this.supabaseManager.supabase
                .from('daily_backups')
                .select('backup_id, backup_type, created_at, metadata')
                .order('created_at', { ascending: false })
                .limit(limit);
            
            if (type) {
                query = query.eq('backup_type', type);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            
            return data || [];
            
        } catch (error) {
            console.error('❌ 백업 목록 조회 실패:', error);
            return [];
        }
    }

    // 오래된 백업 정리
    async cleanupOldBackups() {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.BACKUP_RETENTION_DAYS);
            
            const { error } = await this.supabaseManager.supabase
                .from('daily_backups')
                .delete()
                .eq('backup_type', 'auto_daily')
                .lt('created_at', cutoffDate.toISOString());
            
            if (error) throw error;
            
            console.log(`🧹 ${this.BACKUP_RETENTION_DAYS}일 이상된 백업 정리 완료`);
            
        } catch (error) {
            console.warn('⚠️ 백업 정리 실패:', error);
        }
    }

    // 백업 상태 로드
    async loadBackupStatus() {
        try {
            if (window.indexedDBCache) {
                this.lastAutoBackupTime = await window.indexedDBCache.getCachedSetting('lastAutoBackupTime');
                this.lastManualBackupTime = await window.indexedDBCache.getCachedSetting('lastManualBackupTime');
            }
        } catch (error) {
            console.warn('⚠️ 백업 상태 로드 실패:', error);
        }
    }

    // 백업 상태 저장
    async saveBackupStatus() {
        try {
            if (window.indexedDBCache) {
                await window.indexedDBCache.cacheSetting('lastAutoBackupTime', this.lastAutoBackupTime);
                await window.indexedDBCache.cacheSetting('lastManualBackupTime', this.lastManualBackupTime);
            }
        } catch (error) {
            console.warn('⚠️ 백업 상태 저장 실패:', error);
        }
    }

    // 백업 ID 생성
    generateBackupId(prefix = 'backup') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '');
        const random = Math.random().toString(36).substring(2, 8);
        return `${prefix}_${timestamp}_${random}`;
    }

    // 백업 알림 표시
    showBackupNotification(message, type = 'info') {
        console.log(`${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'} ${message}`);
        
        // Toast 알림 표시 (기존 시스템 활용)
        if (window.showToast) {
            window.showToast(message);
        }
    }

    // 백업 상태 조회
    getBackupStatus() {
        return {
            autoBackupEnabled: this.AUTO_BACKUP_ENABLED,
            lastAutoBackup: this.lastAutoBackupTime,
            lastManualBackup: this.lastManualBackupTime,
            isBackupInProgress: this.isBackupInProgress,
            isRestoreInProgress: this.isRestoreInProgress,
            retentionDays: this.BACKUP_RETENTION_DAYS
        };
    }

    // 정리
    cleanup() {
        if (this.isBackupInProgress) {
            console.log('🔄 백업 진행 중... 정리 대기');
        }
        console.log('🧹 BackupManager 정리 완료');
    }
}

// 전역 사용을 위해 window에 등록
window.BackupManager = BackupManager;

console.log('📦 BackupManager 클래스 로드 완료');