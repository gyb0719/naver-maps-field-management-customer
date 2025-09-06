/**
 * ULTRATHINK 실시간 동기화 UI/UX 개선
 * 실시간 상태 표시 및 사용자 경험 향상
 */

class RealtimeUI {
    constructor() {
        this.statusIndicator = null;
        this.activityFeed = null;
        this.connectionStatus = 'disconnected';
        this.activityHistory = [];
        this.maxActivityHistory = 20;
        
        this.init();
    }
    
    // 🎯 ULTRATHINK: UI 초기화 (비활성화)
    init() {
        // UI 초기화 비활성화 - 사용자 요청으로 복잡한 UI 제거
        console.log('🎨 ULTRATHINK 실시간 UI 시스템 비활성화됨');
    }
    
    // 🎯 ULTRATHINK: 실시간 상태 표시기 생성
    createStatusIndicator() {
        const header = document.querySelector('.header');
        if (!header) return;
        
        const statusContainer = document.createElement('div');
        statusContainer.className = 'realtime-status-container';
        statusContainer.innerHTML = `
            <div id="realtimeStatus" class="realtime-status" style="
                position: fixed;
                top: 80px;
                right: 20px;
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 12px 16px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: bold;
                display: flex;
                align-items: center;
                gap: 8px;
                z-index: 1000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                backdrop-filter: blur(10px);
                cursor: pointer;
                transition: all 0.3s ease;
            " onclick="realtimeUI.toggleActivityFeed()" title="실시간 동기화 상태">
                <div id="statusDot" class="status-dot" style="
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #ff4757;
                    animation: pulse 2s infinite;
                "></div>
                <span id="statusText">연결 중...</span>
                <div id="activityCounter" class="activity-counter" style="
                    background: #667eea;
                    color: white;
                    border-radius: 10px;
                    padding: 2px 6px;
                    font-size: 10px;
                    display: none;
                ">0</div>
            </div>
            
            <style>
                @keyframes pulse {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.2); }
                    100% { opacity: 1; transform: scale(1); }
                }
                
                .realtime-status:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(0,0,0,0.4);
                }
            </style>
        `;
        
        document.body.appendChild(statusContainer);
        this.statusIndicator = document.getElementById('realtimeStatus');
    }
    
    // 🎯 ULTRATHINK: 실시간 활동 피드 생성
    createActivityFeed() {
        const feedContainer = document.createElement('div');
        feedContainer.className = 'realtime-activity-feed';
        feedContainer.innerHTML = `
            <div id="activityFeed" class="activity-feed" style="
                position: fixed;
                top: 120px;
                right: 20px;
                width: 320px;
                max-height: 400px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                display: none;
                overflow: hidden;
                z-index: 1001;
                backdrop-filter: blur(20px);
                border: 1px solid rgba(255,255,255,0.3);
            ">
                <div class="feed-header" style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 12px 16px;
                    font-weight: bold;
                    font-size: 14px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <span>🌐 실시간 활동</span>
                    <button onclick="realtimeUI.clearActivityHistory()" style="
                        background: rgba(255,255,255,0.2);
                        border: none;
                        color: white;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 11px;
                        cursor: pointer;
                    ">지우기</button>
                </div>
                
                <div id="activityList" class="activity-list" style="
                    max-height: 320px;
                    overflow-y: auto;
                    padding: 8px;
                ">
                    <div class="no-activity" style="
                        text-align: center;
                        color: #999;
                        padding: 40px 20px;
                        font-size: 13px;
                    ">
                        아직 활동이 없습니다
                    </div>
                </div>
                
                <div class="feed-footer" style="
                    background: #f8f9fa;
                    padding: 8px 16px;
                    font-size: 11px;
                    color: #666;
                    text-align: center;
                    border-top: 1px solid #e9ecef;
                ">
                    실시간 동기화 활성화됨 ✨
                </div>
            </div>
        `;
        
        document.body.appendChild(feedContainer);
        this.activityFeed = document.getElementById('activityFeed');
    }
    
    // 🎯 ULTRATHINK: 이벤트 리스너 설정
    setupEventListeners() {
        // 바깥 영역 클릭 시 활동 피드 닫기
        document.addEventListener('click', (e) => {
            if (this.activityFeed && 
                !this.activityFeed.contains(e.target) && 
                !this.statusIndicator.contains(e.target)) {
                this.hideActivityFeed();
            }
        });
        
        // ESC 키로 활동 피드 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activityFeed.style.display === 'block') {
                this.hideActivityFeed();
            }
        });
    }
    
    // 🎯 ULTRATHINK: 상태 모니터링 시작
    startStatusMonitoring() {
        // 1초마다 연결 상태 확인
        setInterval(() => {
            this.updateConnectionStatus();
        }, 1000);
        
        // 초기 상태 확인
        setTimeout(() => {
            this.updateConnectionStatus();
        }, 100);
    }
    
    // 🎯 ULTRATHINK: 연결 상태 업데이트 (구글 로그인 기반)
    updateConnectionStatus() {
        // 비로그인 사용자는 UI 표시하지 않음
        if (!window.userManager || !window.userManager.canUseRealtimeFeatures()) {
            return;
        }
        
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        
        if (!statusDot || !statusText) return;
        
        let status = 'offline';
        let statusMessage = '오프라인';
        let statusColor = '#ff4757';
        
        // 구글 로그인된 사용자만 상태 표시
        if (window.realtimeDataManager?.isRealtimeConnected) {
            status = 'onair';
            statusMessage = 'ON AIR';
            statusColor = '#2ed573';
            
            // 접속자 수 표시
            const stats = window.userManager.getStats();
            const authenticatedCount = stats.connectedUsers.filter(u => u.isAuthenticated !== false).length + 1;
            statusMessage += ` (${authenticatedCount}명)`;
        } else {
            status = 'ready';
            statusMessage = 'ON AIR 준비';
            statusColor = '#ffa502';
        }
        
        if (this.connectionStatus !== status) {
            this.connectionStatus = status;
            this.addActivity(`상태 변경: ${statusMessage}`, 'system');
        }
        
        statusDot.style.background = statusColor;
        statusText.textContent = statusMessage;
    }
    
    // 🎯 ULTRATHINK: 활동 피드 토글
    toggleActivityFeed() {
        if (this.activityFeed.style.display === 'block') {
            this.hideActivityFeed();
        } else {
            this.showActivityFeed();
        }
    }
    
    // 🎯 ULTRATHINK: 활동 피드 표시
    showActivityFeed() {
        this.activityFeed.style.display = 'block';
        this.activityFeed.style.animation = 'slideIn 0.3s ease-out';
        
        // 스타일 추가
        if (!document.querySelector('#slideInStyle')) {
            const style = document.createElement('style');
            style.id = 'slideInStyle';
            style.textContent = `
                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(-10px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // 🎯 ULTRATHINK: 활동 피드 숨기기
    hideActivityFeed() {
        this.activityFeed.style.display = 'none';
    }
    
    // 🎯 ULTRATHINK: 활동 추가
    addActivity(message, type = 'info', user = null) {
        const timestamp = new Date();
        const activity = {
            id: Date.now(),
            message,
            type, // info, success, warning, error, system
            user,
            timestamp
        };
        
        this.activityHistory.unshift(activity);
        
        // 최대 개수 제한
        if (this.activityHistory.length > this.maxActivityHistory) {
            this.activityHistory = this.activityHistory.slice(0, this.maxActivityHistory);
        }
        
        this.updateActivityList();
        this.updateActivityCounter();
    }
    
    // 🎯 ULTRATHINK: 활동 목록 업데이트
    updateActivityList() {
        const activityList = document.getElementById('activityList');
        if (!activityList) return;
        
        if (this.activityHistory.length === 0) {
            activityList.innerHTML = `
                <div class="no-activity" style="
                    text-align: center;
                    color: #999;
                    padding: 40px 20px;
                    font-size: 13px;
                ">
                    아직 활동이 없습니다
                </div>
            `;
            return;
        }
        
        activityList.innerHTML = this.activityHistory.map(activity => {
            const typeIcons = {
                info: 'ℹ️',
                success: '✅',
                warning: '⚠️',
                error: '❌',
                system: '⚙️',
                user: '👤',
                parcel: '🏠'
            };
            
            const typeColors = {
                info: '#3498db',
                success: '#2ecc71',
                warning: '#f39c12',
                error: '#e74c3c',
                system: '#9b59b6',
                user: '#1abc9c',
                parcel: '#e67e22'
            };
            
            const timeString = activity.timestamp.toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            return `
                <div class="activity-item" style="
                    padding: 8px 12px;
                    margin: 4px 0;
                    background: ${activity.type === 'system' ? '#f8f9fa' : 'white'};
                    border: 1px solid #e9ecef;
                    border-radius: 6px;
                    border-left: 3px solid ${typeColors[activity.type] || '#ddd'};
                    font-size: 12px;
                    line-height: 1.4;
                ">
                    <div style="display: flex; align-items: flex-start; gap: 8px;">
                        <span style="font-size: 14px;">${typeIcons[activity.type] || 'ℹ️'}</span>
                        <div style="flex: 1;">
                            <div style="color: #333; font-weight: 500;">
                                ${activity.message}
                            </div>
                            ${activity.user ? `<div style="color: #666; font-size: 10px; margin-top: 2px;">by ${activity.user}</div>` : ''}
                            <div style="color: #999; font-size: 10px; margin-top: 4px;">
                                ${timeString}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // 🎯 ULTRATHINK: 활동 카운터 업데이트
    updateActivityCounter() {
        const counter = document.getElementById('activityCounter');
        if (!counter) return;
        
        if (this.activityHistory.length > 0) {
            counter.style.display = 'block';
            counter.textContent = this.activityHistory.length;
        } else {
            counter.style.display = 'none';
        }
    }
    
    // 🎯 ULTRATHINK: 활동 히스토리 지우기
    clearActivityHistory() {
        this.activityHistory = [];
        this.updateActivityList();
        this.updateActivityCounter();
        
        this.addActivity('활동 히스토리가 지워졌습니다', 'system');
    }
    
    // 🎯 ULTRATHINK: 필지 활동 알림
    notifyParcelActivity(parcelNumber, action, userName) {
        const actionMessages = {
            'color_preview': `${parcelNumber} 색상 변경 중`,
            'save_complete': `${parcelNumber} 저장 완료`,
            'lock': `${parcelNumber} 편집 시작`,
            'unlock': `${parcelNumber} 편집 완료`
        };
        
        const actionTypes = {
            'color_preview': 'info',
            'save_complete': 'success',
            'lock': 'warning',
            'unlock': 'info'
        };
        
        const message = actionMessages[action] || `${parcelNumber} ${action}`;
        const type = actionTypes[action] || 'parcel';
        
        this.addActivity(message, type, userName);
    }
    
    // 🎯 ULTRATHINK: 사용자 활동 알림
    notifyUserActivity(userName, action) {
        const actionMessages = {
            'join': `${userName}님이 참여했습니다`,
            'leave': `${userName}님이 나갔습니다`,
            'update': `${userName}님이 정보를 변경했습니다`
        };
        
        const message = actionMessages[action] || `${userName} ${action}`;
        this.addActivity(message, 'user');
    }
    
    // 🎯 ULTRATHINK: 시스템 알림
    notifySystem(message) {
        this.addActivity(message, 'system');
    }
    
    // 🎯 ULTRATHINK: 성공 알림
    notifySuccess(message) {
        this.addActivity(message, 'success');
    }
    
    // 🎯 ULTRATHINK: 오류 알림
    notifyError(message) {
        this.addActivity(message, 'error');
    }
}

// 🎯 ULTRATHINK: 전역 실시간 UI 인스턴스
window.realtimeUI = new RealtimeUI();

// 기존 시스템과 연동
if (window.realtimeDataManager) {
    // 필지 업데이트 이벤트 연동
    const originalHandleParcelUpdate = window.realtimeDataManager.handleParcelUpdate;
    window.realtimeDataManager.handleParcelUpdate = function(payload) {
        originalHandleParcelUpdate.call(this, payload);
        
        if (payload.payload && payload.payload.parcel) {
            const parcel = payload.payload.parcel;
            const userName = payload.payload.updatedBy || '익명';
            window.realtimeUI.notifyParcelActivity(
                parcel.parcelNumber, 
                parcel.action || 'update',
                userName
            );
        }
    };
}

console.log('🎨 ULTRATHINK 실시간 UI/UX 시스템 로드 완료!');