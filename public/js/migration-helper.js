/**
 * 기존 localStorage 데이터를 Supabase로 마이그레이션하는 도구
 * 사용자가 기존 데이터를 잃지 않도록 안전하게 이전
 */

class MigrationHelper {
    constructor() {
        this.LEGACY_STORAGE_KEY = 'parcelData';
        this.supabaseDataManager = null;
        this.migrationStatus = {
            inProgress: false,
            completed: false,
            error: null
        };
    }

    // 기존 localStorage 데이터 확인
    checkLegacyData() {
        try {
            const legacyData = localStorage.getItem(this.LEGACY_STORAGE_KEY);
            if (!legacyData) {
                return { exists: false, count: 0 };
            }

            const parcels = JSON.parse(legacyData);
            if (!Array.isArray(parcels)) {
                return { exists: false, count: 0 };
            }

            console.log(`📦 기존 localStorage 데이터 발견: ${parcels.length}개 필지`);
            return { 
                exists: true, 
                count: parcels.length,
                data: parcels
            };

        } catch (error) {
            console.error('❌ 기존 데이터 확인 실패:', error);
            return { exists: false, count: 0, error: error.message };
        }
    }

    // 자동 마이그레이션 실행
    async autoMigrate() {
        if (this.migrationStatus.inProgress) {
            console.log('⏳ 마이그레이션이 이미 진행 중입니다');
            return;
        }

        try {
            this.migrationStatus.inProgress = true;
            
            // 기존 데이터 확인
            const legacyCheck = this.checkLegacyData();
            if (!legacyCheck.exists) {
                console.log('📦 마이그레이션할 기존 데이터가 없습니다');
                this.migrationStatus.completed = true;
                return { success: true, migrated: 0 };
            }

            // Supabase 데이터 관리자 대기
            if (!window.supabaseDataManager) {
                console.log('⏳ Supabase 데이터 관리자 대기 중...');
                await this.waitForSupabaseDataManager();
            }

            this.supabaseDataManager = window.supabaseDataManager;

            console.log(`🚀 자동 마이그레이션 시작: ${legacyCheck.count}개 필지`);

            // 기존 데이터를 Supabase로 저장
            const saveResult = await this.supabaseDataManager.saveParcels(legacyCheck.data);

            if (saveResult.success) {
                console.log(`✅ 마이그레이션 완료: ${saveResult.count}/${legacyCheck.count}개 필지 이전`);
                
                // 마이그레이션 완료 표시
                this.markMigrationComplete();
                
                // 사용자에게 알림
                this.showMigrationSuccess(saveResult.count, legacyCheck.count);

                this.migrationStatus.completed = true;
                return { 
                    success: true, 
                    migrated: saveResult.count,
                    total: legacyCheck.count,
                    errors: saveResult.errors
                };
            } else {
                throw new Error('Supabase 저장 실패');
            }

        } catch (error) {
            console.error('❌ 자동 마이그레이션 실패:', error);
            this.migrationStatus.error = error.message;
            
            // 사용자에게 오류 알림
            this.showMigrationError(error.message);
            
            return { success: false, error: error.message };
        } finally {
            this.migrationStatus.inProgress = false;
        }
    }

    // 수동 마이그레이션 (사용자 확인 후)
    async manualMigrate() {
        const legacyCheck = this.checkLegacyData();
        
        if (!legacyCheck.exists) {
            this.showNotification('마이그레이션할 기존 데이터가 없습니다', 'info');
            return;
        }

        const confirmMessage = `기존 localStorage에서 ${legacyCheck.count}개의 필지 데이터를 발견했습니다.\n\n클라우드 데이터베이스로 이전하시겠습니까?\n\n이전 후 데이터는 더욱 안전하게 보관되며, 자동 백업 기능이 활성화됩니다.`;
        
        if (!confirm(confirmMessage)) {
            return;
        }

        const result = await this.autoMigrate();
        
        if (result.success) {
            // 성공적인 마이그레이션 후 localStorage 백업 생성
            this.createLocalStorageBackup(legacyCheck.data);
        }
    }

    // localStorage 백업 생성 (안전장치)
    createLocalStorageBackup(data) {
        try {
            const backupKey = `${this.LEGACY_STORAGE_KEY}_backup_${new Date().toISOString().slice(0, 10)}`;
            localStorage.setItem(backupKey, JSON.stringify({
                originalData: data,
                backupDate: new Date().toISOString(),
                migratedCount: data.length
            }));
            
            console.log(`💾 localStorage 백업 생성됨: ${backupKey}`);
            
        } catch (error) {
            console.warn('⚠️ localStorage 백업 생성 실패:', error);
        }
    }

    // Supabase 데이터 관리자 대기
    async waitForSupabaseDataManager() {
        let attempts = 0;
        while (!window.supabaseDataManager && attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }
        
        if (!window.supabaseDataManager) {
            throw new Error('Supabase 데이터 관리자를 찾을 수 없습니다');
        }
        
        // 추가로 연결 상태 확인
        let connectionAttempts = 0;
        while (!window.supabaseDataManager.isConnected() && connectionAttempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            connectionAttempts++;
        }
        
        if (!window.supabaseDataManager.isConnected()) {
            throw new Error('Supabase 연결이 설정되지 않았습니다');
        }
    }

    // 마이그레이션 완료 표시
    markMigrationComplete() {
        try {
            localStorage.setItem('migration_completed', new Date().toISOString());
            console.log('✅ 마이그레이션 완료 표시 저장됨');
        } catch (error) {
            console.warn('⚠️ 마이그레이션 완료 표시 저장 실패:', error);
        }
    }

    // 마이그레이션 완료 여부 확인
    isMigrationCompleted() {
        return localStorage.getItem('migration_completed') !== null;
    }

    // 성공 알림
    showMigrationSuccess(migrated, total) {
        const message = `✅ 데이터 마이그레이션 완료!\n\n${migrated}/${total}개 필지가 클라우드 데이터베이스로 안전하게 이전되었습니다.\n\n이제 자동 백업 기능이 활성화되어 데이터가 더욱 안전하게 보관됩니다.`;
        
        // 모달로 표시
        this.showMigrationModal('🎉 마이그레이션 완료', message, 'success');
        
        // 토스트 알림도 표시
        if (typeof window.showToast === 'function') {
            window.showToast(`${migrated}개 필지 데이터 이전 완료 ✅`);
        }
    }

    // 오류 알림
    showMigrationError(error) {
        const message = `❌ 데이터 마이그레이션 중 오류가 발생했습니다.\n\n오류: ${error}\n\n기존 데이터는 localStorage에 그대로 보관되며, 나중에 다시 시도할 수 있습니다.`;
        
        this.showMigrationModal('⚠️ 마이그레이션 오류', message, 'error');
    }

    // 일반 알림
    showNotification(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(message);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    // 마이그레이션 모달 표시
    showMigrationModal(title, message, type = 'info') {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            font-family: 'Noto Sans KR', sans-serif;
        `;

        const typeColors = {
            success: { bg: '#f0fff4', border: '#68d391', text: '#2f855a' },
            error: { bg: '#fff5f5', border: '#fc8181', text: '#c53030' },
            info: { bg: '#ebf8ff', border: '#63b3ed', text: '#3182ce' }
        };

        const colors = typeColors[type] || typeColors.info;

        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 12px;
                padding: 30px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                text-align: center;
            ">
                <div style="
                    background: ${colors.bg};
                    border: 2px solid ${colors.border};
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 20px;
                    color: ${colors.text};
                ">
                    <h3 style="margin: 0 0 15px 0; font-size: 1.2rem;">${title}</h3>
                    <p style="margin: 0; line-height: 1.5; white-space: pre-line;">${message}</p>
                </div>
                <button onclick="this.closest('div[style*=\"position: fixed\"]').remove()" 
                        style="
                            background: #4299e1;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 1rem;
                            font-weight: 500;
                        ">
                    확인
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        // 3초 후 자동 닫기 (오류가 아닌 경우만)
        if (type !== 'error') {
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.remove();
                }
            }, 5000);
        }
    }

    // 페이지 로드 시 자동 마이그레이션 체크
    async checkAndMigrate() {
        // 이미 마이그레이션이 완료된 경우 스킵
        if (this.isMigrationCompleted()) {
            console.log('✅ 마이그레이션이 이미 완료되었습니다');
            return;
        }

        // 기존 데이터 확인
        const legacyCheck = this.checkLegacyData();
        if (!legacyCheck.exists) {
            // 마이그레이션 완료 표시 (기존 데이터가 없는 경우)
            this.markMigrationComplete();
            return;
        }

        console.log(`📋 마이그레이션 확인: ${legacyCheck.count}개 필지 발견`);

        // 5개 미만의 데이터는 자동 마이그레이션
        if (legacyCheck.count < 5) {
            console.log('🔄 소량 데이터 자동 마이그레이션 시작...');
            await this.autoMigrate();
        } else {
            // 많은 데이터는 사용자 확인 후 마이그레이션
            console.log('❓ 대량 데이터 발견 - 사용자 확인 필요');
            
            // 3초 후 확인 대화상자 표시
            setTimeout(() => {
                this.manualMigrate();
            }, 3000);
        }
    }

    // 마이그레이션 상태 조회
    getMigrationStatus() {
        return {
            ...this.migrationStatus,
            isCompleted: this.isMigrationCompleted(),
            legacyDataExists: this.checkLegacyData().exists
        };
    }
}

// 전역 인스턴스 생성
window.migrationHelper = new MigrationHelper();

// 페이지 로드 완료 후 자동 마이그레이션 체크
document.addEventListener('DOMContentLoaded', () => {
    // 2초 지연 후 마이그레이션 체크 (다른 시스템이 초기화될 시간 확보)
    setTimeout(() => {
        window.migrationHelper.checkAndMigrate();
    }, 2000);
});

console.log('📦 MigrationHelper 로드 완료 - 기존 데이터 자동 마이그레이션 준비됨');