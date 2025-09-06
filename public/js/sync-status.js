/**
 * 동기화 상태 UI 컨트롤러
 * DataManager의 동기화 상태를 시각적으로 표시
 */

class SyncStatusUI {
    constructor() {
        this.statusElement = null;
        this.indicatorElement = null;
        this.textElement = null;
        this.init();
    }

    init() {
        // DOM이 로드되면 초기화
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.statusElement = document.getElementById('cloudStatus');
        this.indicatorElement = document.getElementById('syncIndicator');
        this.textElement = document.getElementById('syncText');

        if (!this.statusElement) {
            console.warn('클라우드 동기화 상태 엘리먼트를 찾을 수 없습니다');
            return;
        }

        // DataManager 상태 변경 이벤트 구독 (안전한 참조)
        if (window.dataManager && typeof window.dataManager.onSyncStatusChange === 'function') {
            try {
                window.dataManager.onSyncStatusChange((status, prevStatus) => {
                    this.updateUI(status);
                });

                // 초기 상태 설정
                this.updateUI(window.dataManager.syncStatus);
                console.log('✅ DataManager와 SyncStatusUI 연결 성공');
            } catch (error) {
                console.warn('DataManager 연결 실패:', error);
                this.updateUI('offline'); // 폴백 상태
            }
        } else {
            console.warn('DataManager onSyncStatusChange 메소드 없음, 재시도 중...');
            // DataManager 로드 대기 후 재시도
            setTimeout(() => {
                if (window.dataManager && typeof window.dataManager.onSyncStatusChange === 'function') {
                    window.dataManager.onSyncStatusChange((status) => {
                        this.updateUI(status);
                    });
                    this.updateUI(window.dataManager.syncStatus);
                    console.log('✅ 지연된 DataManager 연결 성공');
                }
            }, 500);
        }

        // 수동 동기화 클릭 이벤트
        this.indicatorElement?.addEventListener('click', () => {
            this.handleManualSync();
        });

        console.log('SyncStatusUI 초기화 완료');
    }

    updateUI(status) {
        if (!this.statusElement) return;

        // 데이터 속성 업데이트
        this.statusElement.setAttribute('data-status', status);

        // 텍스트 업데이트
        const statusTexts = {
            'offline': '오프라인',
            'syncing': '동기화 중...',
            'synced': '동기화 완료',
            'error': '동기화 실패',
            'hidden': ''
        };

        if (this.textElement) {
            this.textElement.textContent = statusTexts[status] || '알 수 없음';
            // hidden 상태일 때 전체 상태 표시 숨김
            if (status === 'hidden') {
                this.statusElement.style.display = 'none';
            } else {
                this.statusElement.style.display = '';
            }
        }

        // 툴팁 업데이트
        if (this.indicatorElement) {
            const tooltips = {
                'offline': '오프라인 모드 - 클릭하여 연결 재시도',
                'syncing': '데이터 동기화 진행 중...',
                'synced': `동기화 완료 - 마지막 동기화: ${this.formatTime(window.dataManager?.lastSyncTime)}`,
                'hidden': '로컬 저장소 모드',
                'error': '동기화 실패 - 클릭하여 재시도'
            };

            this.indicatorElement.title = tooltips[status] || '';
        }

        console.log('동기화 상태 UI 업데이트:', status);
    }

    async handleManualSync() {
        if (!window.dataManager) {
            console.error('DataManager가 없습니다');
            return;
        }

        const currentStatus = window.dataManager.syncStatus;

        try {
            if (currentStatus === 'offline') {
                // 오프라인 상태에서는 연결 재시도
                await window.dataManager.init();
            } else if (currentStatus === 'synced' || currentStatus === 'error') {
                // 수동 동기화 실행
                await window.dataManager.sync();
            }
        } catch (error) {
            console.error('수동 동기화 실패:', error);
            
            // 사용자에게 알림
            if (this.textElement) {
                const originalText = this.textElement.textContent;
                this.textElement.textContent = '동기화 실패';
                
                setTimeout(() => {
                    this.updateUI(window.dataManager.syncStatus);
                }, 2000);
            }
        }
    }

    formatTime(timeString) {
        if (!timeString) return '없음';
        
        try {
            const date = new Date(timeString);
            return date.toLocaleString('ko-KR', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return '알 수 없음';
        }
    }

    // 통계 정보 표시 (개발용)
    showStats() {
        if (!window.dataManager) return;

        const stats = window.dataManager.getStats();
        console.table(stats);
        
        if (window.confirm('개발자 통계 정보를 콘솔에 표시했습니다. 자세한 정보를 보시겠습니까?')) {
            console.log('=== DataManager 상세 통계 ===');
            console.log('총 필지 수:', stats.totalParcels);
            console.log('마지막 동기화:', this.formatTime(stats.lastSyncTime));
            console.log('동기화 상태:', stats.syncStatus);
            console.log('메모리 사용량:', (stats.memoryUsage / 1024).toFixed(1) + 'KB');
        }
    }
}

// 전역 인스턴스 생성
window.syncStatusUI = new SyncStatusUI();

console.log('SyncStatusUI 로드 완료');