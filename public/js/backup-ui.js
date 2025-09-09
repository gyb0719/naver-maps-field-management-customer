/**
 * 메인 페이지 백업 UI 관리
 * 사이드바의 백업 기능 버튼들을 관리
 */

class BackupUI {
    constructor() {
        this.supabaseDataManager = null;
        this.backupManager = null;
        this.isInitialized = false;
        
        this.init();
    }

    async init() {
        try {
            console.log('🚀 BackupUI 초기화 시작...');
            
            // DataManager 인스턴스 대기
            await this.waitForDataManager();
            
            // UI 이벤트 리스너 설정
            this.setupEventListeners();
            
            // 상태 업데이트 시작
            this.startStatusUpdates();
            
            this.isInitialized = true;
            console.log('✅ BackupUI 초기화 완료');
            
        } catch (error) {
            console.error('❌ BackupUI 초기화 실패:', error);
        }
    }

    async waitForDataManager() {
        let attempts = 0;
        while (!window.supabaseDataManager && attempts < 30) {
            console.log('⏳ SupabaseDataManager 대기 중...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }
        
        if (!window.supabaseDataManager) {
            throw new Error('SupabaseDataManager를 찾을 수 없습니다');
        }
        
        this.supabaseDataManager = window.supabaseDataManager;
        this.backupManager = this.supabaseDataManager.backupManager;
        
        console.log('✅ SupabaseDataManager 연결 완료');
    }

    setupEventListeners() {
        // 수동 백업 버튼
        const manualBackupBtn = document.getElementById('manualBackupBtn');
        if (manualBackupBtn) {
            manualBackupBtn.addEventListener('click', () => {
                this.performManualBackup();
            });
        }

        // 백업 목록 버튼
        const backupHistoryBtn = document.getElementById('backupHistoryBtn');
        if (backupHistoryBtn) {
            backupHistoryBtn.addEventListener('click', () => {
                this.showBackupHistory();
            });
        }

        // 복원 버튼
        const restoreBtn = document.getElementById('restoreBtn');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => {
                this.showRestoreDialog();
            });
        }

        // 연결 상태 변경 이벤트
        window.addEventListener('supabaseConnectionChange', (event) => {
            this.updateConnectionStatus(event.detail);
        });

        // 백업 완료 이벤트
        window.addEventListener('backupCompleted', (event) => {
            this.updateBackupStatus(event.detail);
        });

        console.log('📡 BackupUI 이벤트 리스너 설정 완료');
    }

    startStatusUpdates() {
        // 초기 상태 업데이트
        this.updateBackupStatus();
        
        // 5분마다 상태 업데이트
        setInterval(() => {
            this.updateBackupStatus();
        }, 5 * 60 * 1000);
    }

    async updateBackupStatus() {
        try {
            if (!this.backupManager) return;

            const status = this.backupManager.getBackupStatus();
            const lastBackupElement = document.getElementById('lastBackupTime');
            
            if (lastBackupElement) {
                if (status.lastAutoBackup) {
                    const lastBackup = new Date(status.lastAutoBackup);
                    const now = new Date();
                    const diffHours = Math.floor((now - lastBackup) / (1000 * 60 * 60));
                    
                    if (diffHours < 1) {
                        lastBackupElement.textContent = '마지막 백업: 방금 전';
                    } else if (diffHours < 24) {
                        lastBackupElement.textContent = `마지막 백업: ${diffHours}시간 전`;
                    } else {
                        lastBackupElement.textContent = `마지막 백업: ${Math.floor(diffHours / 24)}일 전`;
                    }
                } else {
                    lastBackupElement.textContent = '마지막 백업: 없음';
                }
            }
            
        } catch (error) {
            console.warn('⚠️ 백업 상태 업데이트 실패:', error);
        }
    }

    updateConnectionStatus(detail) {
        // 플로팅 패널의 연결 상태 업데이트
        const statusElement = document.getElementById('connectionStatus');
        const statusDot = statusElement?.querySelector('.status-dot');
        const statusText = statusElement?.querySelector('.status-text');
        
        if (statusElement) {
            if (detail.isConnected) {
                statusDot.className = 'status-dot connected';
                statusText.textContent = '연결됨';
            } else {
                statusDot.className = 'status-dot error';
                statusText.textContent = '연결 끊어짐';
            }
        }

        // 헤더 버튼의 인디케이터도 업데이트
        const headerIndicator = document.getElementById('connectionIndicator');
        const headerDot = headerIndicator?.querySelector('.status-dot');
        
        if (headerDot) {
            if (detail.isConnected) {
                headerDot.className = 'status-dot connected';
            } else {
                headerDot.className = 'status-dot error';
            }
        }
    }

    async performManualBackup() {
        if (!this.backupManager) {
            this.showToast('백업 시스템이 준비되지 않았습니다', 'error');
            return;
        }

        const btn = document.getElementById('manualBackupBtn');
        if (!btn) return;

        try {
            // 버튼 상태 변경
            btn.disabled = true;
            btn.innerHTML = '🔄 백업 중...';
            
            // 수동 백업 실행
            const success = await this.backupManager.performManualBackup();
            
            if (success) {
                this.showToast('백업이 완료되었습니다 📁', 'success');
                this.updateBackupStatus();
            } else {
                this.showToast('백업에 실패했습니다', 'error');
            }

        } catch (error) {
            console.error('❌ 수동 백업 실패:', error);
            this.showToast('백업 중 오류가 발생했습니다', 'error');
        } finally {
            // 버튼 상태 복원
            btn.disabled = false;
            btn.innerHTML = '📁 수동 백업';
        }
    }

    async showBackupHistory() {
        if (!this.backupManager) {
            this.showToast('백업 시스템이 준비되지 않았습니다', 'error');
            return;
        }

        try {
            const history = await this.backupManager.getBackupHistory(null, 10);
            
            let historyHtml = '<div style="max-height: 300px; overflow-y: auto;">';
            
            if (history.length === 0) {
                historyHtml += '<p style="text-align: center; color: #718096; padding: 20px;">백업 히스토리가 없습니다</p>';
            } else {
                history.forEach(backup => {
                    const date = new Date(backup.created_at);
                    const typeText = this.getBackupTypeText(backup.backup_type);
                    const parcelCount = backup.metadata?.data_count?.parcels || 0;
                    
                    historyHtml += `
                        <div style="padding: 10px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: 600;">${date.toLocaleString()}</div>
                                <div style="font-size: 0.875rem; color: #718096;">${typeText} - ${parcelCount}개 필지</div>
                            </div>
                            <button onclick="backupUI.restoreFromHistory('${backup.backup_id}')" 
                                    style="padding: 4px 8px; background: #4299e1; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">
                                복원
                            </button>
                        </div>
                    `;
                });
            }
            
            historyHtml += '</div>';
            
            this.showModal('백업 히스토리', historyHtml);

        } catch (error) {
            console.error('❌ 백업 히스토리 조회 실패:', error);
            this.showToast('백업 히스토리 조회에 실패했습니다', 'error');
        }
    }

    getBackupTypeText(type) {
        const types = {
            'auto_daily': '일일 자동 백업',
            'manual': '수동 백업',
            'safety_backup': '안전 백업'
        };
        return types[type] || type;
    }

    showRestoreDialog() {
        const dialogHtml = `
            <div style="margin-bottom: 20px;">
                <p style="margin-bottom: 15px;">백업 파일을 선택하여 데이터를 복원할 수 있습니다.</p>
                <input type="file" id="restoreFileInput" accept=".json" style="width: 100%; padding: 10px; border: 1px solid #cbd5e0; border-radius: 6px; margin-bottom: 15px;">
                <div style="background: #fff5f5; border: 1px solid #fc8181; border-radius: 6px; padding: 10px; font-size: 0.875rem; color: #c53030;">
                    ⚠️ 주의: 데이터 복원 시 현재 데이터가 덮어쓰여집니다.
                </div>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="this.closest('.modal').remove()" 
                        style="padding: 8px 16px; background: #e2e8f0; border: none; border-radius: 6px; cursor: pointer;">
                    취소
                </button>
                <button onclick="backupUI.processRestoreFile()" 
                        style="padding: 8px 16px; background: #ed8936; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    복원하기
                </button>
            </div>
        `;
        
        this.showModal('데이터 복원', dialogHtml);
    }

    async processRestoreFile() {
        const fileInput = document.getElementById('restoreFileInput');
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            this.showToast('복원할 파일을 선택하세요', 'error');
            return;
        }

        const file = fileInput.files[0];
        if (!file.name.endsWith('.json')) {
            this.showToast('JSON 파일만 업로드할 수 있습니다', 'error');
            return;
        }

        if (!confirm('데이터를 복원하시겠습니까? 현재 데이터가 덮어쓰여집니다.')) {
            return;
        }

        try {
            // 파일 읽기
            const fileContent = await this.readFileAsText(file);
            const backupData = JSON.parse(fileContent);

            // 모달 닫기
            const modal = document.querySelector('.modal');
            if (modal) modal.remove();

            // 복원 실행
            this.showToast('데이터 복원을 시작합니다...', 'info');
            
            const success = await this.backupManager.restoreFromBackup(backupData);

            if (success) {
                this.showToast('데이터 복원이 완료되었습니다 🔄', 'success');
                
                // 페이지 새로고침 권장
                setTimeout(() => {
                    if (confirm('복원이 완료되었습니다. 페이지를 새로고침하시겠습니까?')) {
                        window.location.reload();
                    }
                }, 2000);
            } else {
                this.showToast('데이터 복원에 실패했습니다', 'error');
            }

        } catch (error) {
            console.error('❌ 데이터 복원 실패:', error);
            this.showToast('데이터 복원 중 오류가 발생했습니다', 'error');
            
            // 모달 닫기
            const modal = document.querySelector('.modal');
            if (modal) modal.remove();
        }
    }

    async restoreFromHistory(backupId) {
        if (!confirm('이 백업으로 데이터를 복원하시겠습니까?')) {
            return;
        }

        try {
            this.showToast('백업 히스토리에서의 복원 기능은 아직 개발 중입니다', 'warning');
            
            // TODO: Supabase에서 특정 백업 ID로 복원하는 기능 구현
            
        } catch (error) {
            console.error('❌ 히스토리 복원 실패:', error);
            this.showToast('복원에 실패했습니다', 'error');
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    showModal(title, content) {
        // 기존 모달 제거
        const existingModal = document.querySelector('.modal');
        if (existingModal) {
            existingModal.remove();
        }

        // 모달 생성
        const modal = document.createElement('div');
        modal.className = 'modal';
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
        `;

        modal.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 20px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e2e8f0;">
                    <h3 style="margin: 0; color: #2b6cb0;">${title}</h3>
                    <button onclick="this.closest('.modal').remove()" 
                            style="background: none; border: none; font-size: 20px; cursor: pointer; color: #718096;">
                        ✕
                    </button>
                </div>
                <div>
                    ${content}
                </div>
            </div>
        `;

        // 모달 외부 클릭시 닫기
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        document.body.appendChild(modal);
    }

    showToast(message, type = 'info') {
        // 기존 showToast 함수 활용
        if (typeof window.showToast === 'function') {
            window.showToast(message);
        } else {
            // 폴백: 간단한 alert
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
}

// 전역 인스턴스 생성
window.backupUI = new BackupUI();

console.log('📦 BackupUI 로드 완료');