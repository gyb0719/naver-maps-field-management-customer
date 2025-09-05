// UI 상태 관리 모듈
class UIManager {
    constructor() {
        this.loadingStack = 0;
        this.init();
    }

    init() {
        this.createLoadingOverlay();
        this.createToastContainer();
    }

    // 로딩 오버레이 생성
    createLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text">데이터 로딩 중...</div>
            </div>
        `;
        overlay.style.display = 'none';
        document.body.appendChild(overlay);
    }

    // 토스트 메시지 컨테이너 생성
    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // 로딩 시작
    showLoading(message = '데이터 로딩 중...') {
        this.loadingStack++;
        const overlay = document.getElementById('loadingOverlay');
        const loadingText = overlay.querySelector('.loading-text');
        loadingText.textContent = message;
        overlay.style.display = 'flex';
    }

    // 로딩 종료
    hideLoading() {
        this.loadingStack = Math.max(0, this.loadingStack - 1);
        if (this.loadingStack === 0) {
            const overlay = document.getElementById('loadingOverlay');
            overlay.style.display = 'none';
        }
    }

    // 토스트 메시지 표시
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${this.getToastIcon(type)}</div>
            <div class="toast-message">${message}</div>
        `;
        
        container.appendChild(toast);
        
        // 애니메이션
        setTimeout(() => toast.classList.add('show'), 10);
        
        // 자동 제거
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // 토스트 아이콘
    getToastIcon(type) {
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }

    // 에러 표시
    showError(message, error = null) {
        console.error(message, error);
        this.showToast(message, 'error', 5000);
    }

    // 성공 메시지
    showSuccess(message) {
        this.showToast(message, 'success');
    }

    // 경고 메시지
    showWarning(message) {
        this.showToast(message, 'warning', 4000);
    }

    // 정보 메시지
    showInfo(message) {
        this.showToast(message, 'info');
    }

    // 확인 다이얼로그
    async confirm(message, title = '확인') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'confirm-modal';
            modal.innerHTML = `
                <div class="confirm-content">
                    <h3>${title}</h3>
                    <p>${message}</p>
                    <div class="confirm-buttons">
                        <button class="btn-cancel">취소</button>
                        <button class="btn-confirm">확인</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            setTimeout(() => modal.classList.add('show'), 10);
            
            const cleanup = (result) => {
                modal.classList.remove('show');
                setTimeout(() => {
                    modal.remove();
                    resolve(result);
                }, 300);
            };
            
            modal.querySelector('.btn-cancel').onclick = () => cleanup(false);
            modal.querySelector('.btn-confirm').onclick = () => cleanup(true);
            modal.onclick = (e) => {
                if (e.target === modal) cleanup(false);
            };
        });
    }
}

// 싱글톤 인스턴스 생성
const uiManager = new UIManager();

// 전역 사용을 위한 export
window.UIManager = uiManager;