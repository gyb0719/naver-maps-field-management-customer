/**
 * ULTRATHINK 사용자 관리 및 권한 시스템
 * 간단한 사용자 인식과 충돌 방지 메커니즘
 */

class UserManager {
    constructor() {
        this.currentUser = this.initializeUser();
        this.userColors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
        ];
        this.connectedUsers = new Map(); // 현재 접속중인 사용자들
        
        this.setupUserInterface();
        this.startHeartbeat();
    }
    
    // 🎯 ULTRATHINK: 사용자 초기화 시스템
    initializeUser() {
        // 구글 로그인 상태 확인
        if (window.GoogleAuth && window.GoogleAuth.isAuthenticated()) {
            const googleUser = window.GoogleAuth.getUserInfo();
            if (googleUser) {
                console.log('🔐 구글 로그인 사용자:', googleUser.name);
                return this.createUserFromGoogle(googleUser);
            }
        }
        
        // 로그인하지 않은 사용자 - 로컬 사용자로 생성
        console.log('👤 로컬 사용자로 초기화');
        return this.createLocalUser();
    }
    
    // 🎯 ULTRATHINK: 로컬 사용자 생성
    createLocalUser() {
        const sessionId = this.generateSessionId();
        return {
            id: sessionId,
            name: `사용자_${sessionId.substring(0, 4)}`,
            email: null,
            picture: null,
            color: this.assignUserColor(),
            role: 'editor', // 로컬 사용자도 편집 가능
            isAuthenticated: false,
            provider: 'local',
            joinedAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        };
    }
    
    // 🎯 ULTRATHINK: 세션 ID 생성
    generateSessionId() {
        return 'local_' + Math.random().toString(36).substr(2, 8) + Date.now().toString(36);
    }
    
    // 🎯 ULTRATHINK: 구글 사용자 정보로부터 사용자 생성
    createUserFromGoogle(googleUser) {
        return {
            id: googleUser.sub || googleUser.id, // Google ID
            name: googleUser.name || '구글 사용자',
            email: googleUser.email,
            picture: googleUser.picture, // 프로필 이미지
            color: this.assignUserColor(),
            role: 'editor',
            isAuthenticated: true,
            provider: 'google',
            joinedAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        };
    }
    
    // 🎯 ULTRATHINK: 구글 로그인 실행
    initiateGoogleLogin() {
        // sheets.js의 구글 로그인 함수 직접 호출
        if (window.exportCurrentParcelToGoogleSheets) {
            console.log('🔐 구글 로그인 시작...');
            window.exportCurrentParcelToGoogleSheets();
            
            // 로그인 후 페이지 새로고침하여 사용자 정보 업데이트
            setTimeout(() => {
                if (window.GoogleAuth?.isAuthenticated()) {
                    if (window.showToast) {
                        window.showToast('구글 로그인 완료! 🌐', 'success');
                    }
                    setTimeout(() => window.location.reload(), 1000);
                }
            }, 2000);
        } else {
            console.error('❌ 구글 로그인 기능을 사용할 수 없습니다');
        }
    }
    
    // 🎯 ULTRATHINK: 사용자 색상 배정
    assignUserColor() {
        const usedColors = Array.from(this.connectedUsers.values()).map(u => u.color);
        const availableColors = this.userColors.filter(color => !usedColors.includes(color));
        
        if (availableColors.length > 0) {
            return availableColors[0];
        } else {
            // 모든 색상이 사용 중이면 랜덤 색상 생성
            return `#${Math.floor(Math.random()*16777215).toString(16)}`;
        }
    }
    
    // 🎯 ULTRATHINK: 사용자 정보 저장
    saveUser(user) {
        localStorage.setItem('naverMapsUser', JSON.stringify(user));
        console.log('👤 사용자 정보 저장됨:', user.name);
    }
    
    // 🎯 ULTRATHINK: 사용자 인터페이스 설정 (구글 로그인 필수)
    setupUserInterface() {
        if (this.currentUser) {
            this.createUserIndicator();
            this.createConnectedUsersList();
        }
        // 비로그인 사용자는 UI 차단됨
    }
    
    // 🎯 ULTRATHINK: 현재 사용자 표시기 생성 (구글 로그인 사용자만)
    createUserIndicator() {
        const header = document.querySelector('.header-controls');
        if (!header || !this.currentUser) return;
        
        const userIndicator = document.createElement('div');
        userIndicator.className = 'user-indicator';
        
        // 구글 로그인 사용자만 표시
        userIndicator.innerHTML = `
            <div class="current-user authenticated" style="
                display: flex; 
                align-items: center; 
                gap: 8px; 
                padding: 6px 12px;
                background: rgba(255,255,255,0.95);
                border-radius: 20px;
                border: 2px solid ${this.currentUser.color};
                font-size: 14px;
                font-weight: bold;
                color: #333;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            " onclick="userManager.showUserSettings()" title="구글 로그인 사용자">
                ${this.currentUser.picture ? `
                    <img src="${this.currentUser.picture}" style="
                        width: 20px; 
                        height: 20px; 
                        border-radius: 50%; 
                        border: 1px solid ${this.currentUser.color};
                    " alt="프로필">
                ` : `
                    <div style="
                        width: 12px; 
                        height: 12px; 
                        border-radius: 50%; 
                        background: ${this.currentUser.color};
                    "></div>
                `}
                <span>${this.currentUser.name}</span>
                <span style="font-size: 10px; color: #2ed573; font-weight: normal;">🌐 ON AIR</span>
            </div>
        `;
        
        header.appendChild(userIndicator);
    }
    
    // 🎯 ULTRATHINK: 접속 사용자 목록 생성 (구글 로그인 필수)
    createConnectedUsersList() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar || !this.currentUser) return;
        
        const usersPanel = document.createElement('div');
        usersPanel.className = 'users-panel';
        
        // 구글 로그인 사용자만 표시
        usersPanel.innerHTML = `
            <div class="panel-header">
                <h3>🌐 ON AIR 사용자</h3>
                <span id="userCount" class="user-count">1명</span>
            </div>
            <div id="usersList" class="users-list" style="
                max-height: 150px;
                overflow-y: auto;
                padding: 8px;
                background: #f9f9f9;
                border-radius: 4px;
                margin-top: 8px;
            ">
                <!-- 구글 로그인 사용자 목록이 여기에 표시됩니다 -->
            </div>
        `;
        
        // 색상 패널 다음에 추가
        const colorPanel = sidebar.querySelector('.color-panel');
        if (colorPanel) {
            colorPanel.insertAdjacentElement('afterend', usersPanel);
        } else {
            sidebar.appendChild(usersPanel);
        }
        
        this.updateUsersList();
    }
    
    // 🎯 ULTRATHINK: 접속 사용자 목록 업데이트
    updateUsersList() {
        const usersList = document.getElementById('usersList');
        const userCount = document.getElementById('userCount');
        
        if (!usersList || !userCount || !this.currentUser) return;
        
        // 모든 구글 로그인 사용자 포함
        const allUsers = new Map();
        
        // 현재 사용자 추가
        allUsers.set(this.currentUser.id, this.currentUser);
        
        // 다른 사용자들 추가
        this.connectedUsers.forEach((user, id) => {
            allUsers.set(id, user);
        });
        
        userCount.textContent = `${allUsers.size}명`;
        
        usersList.innerHTML = Array.from(allUsers.values()).map(user => `
            <div class="user-item" style="
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 4px 8px;
                margin: 2px 0;
                border-radius: 4px;
                background: ${user.id === this.currentUser.id ? 'rgba(66, 133, 244, 0.1)' : 'white'};
                border: 1px solid ${user.id === this.currentUser.id ? '#4285f4' : '#e0e0e0'};
            ">
                ${user.picture ? `
                    <img src="${user.picture}" style="
                        width: 16px; 
                        height: 16px; 
                        border-radius: 50%; 
                        border: 1px solid ${user.color};
                    " alt="프로필">
                ` : `
                    <div style="
                        width: 10px; 
                        height: 10px; 
                        border-radius: 50%; 
                        background: ${user.color};
                    "></div>
                `}
                <span style="font-size: 12px; font-weight: ${user.id === this.currentUser.id ? 'bold' : 'normal'};">
                    ${user.name}${user.id === this.currentUser.id ? ' (나)' : ''}
                </span>
                <span style="font-size: 9px; color: #2ed573; margin-left: auto;">
                    🌐
                </span>
            </div>
        `).join('');
    }
    
    // 🎯 ULTRATHINK: 구글 로그인 유도
    promptGoogleLogin() {
        const confirmed = confirm(
            '🌐 실시간 공유 기능을 사용하려면 구글 로그인이 필요합니다.\n\n' +
            '구글 로그인하시겠습니까?\n\n' +
            '※ 로그인한 사용자들끼리만 지도를 실시간으로 공유할 수 있습니다.'
        );
        
        if (confirmed) {
            // sheets.js의 구글 로그인 함수 호출
            if (window.exportCurrentParcelToGoogleSheets) {
                window.exportCurrentParcelToGoogleSheets();
                // 로그인 후 페이지 새로고침하여 사용자 정보 업데이트
                setTimeout(() => {
                    if (window.GoogleAuth?.isAuthenticated()) {
                        if (window.showToast) {
                            window.showToast('구글 로그인 완료! 실시간 공유가 활성화되었습니다 🌐', 'success');
                        }
                        setTimeout(() => window.location.reload(), 1500);
                    }
                }, 2000);
            } else {
                if (window.showToast) {
                    window.showToast('구글 로그인 기능을 사용할 수 없습니다', 'error');
                }
            }
        }
    }
    
    // 🎯 ULTRATHINK: 사용자 설정 표시
    showUserSettings() {
        if (!this.currentUser.isAuthenticated) {
            this.promptGoogleLogin();
            return;
        }
        
        // 구글 로그인 사용자는 로그아웃 옵션만 제공
        const action = confirm(
            `🔐 ${this.currentUser.name}님\n` +
            `📧 ${this.currentUser.email}\n\n` +
            '로그아웃하시겠습니까?\n' +
            '(로그아웃하면 실시간 공유가 비활성화됩니다)'
        );
        
        if (action) {
            this.logout();
        }
    }
    
    // 🎯 ULTRATHINK: 로그아웃
    logout() {
        // localStorage 정리
        localStorage.removeItem('googleToken');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('naverMapsUser');
        
        if (window.showToast) {
            window.showToast('로그아웃되었습니다. 페이지가 새로고침됩니다.', 'info');
        }
        
        // 페이지 새로고침
        setTimeout(() => window.location.reload(), 1000);
    }
    
    // 🎯 ULTRATHINK: 권한 확인 (구글 로그인 기반)
    hasPermission(action) {
        // 로컬 사용자는 실시간 공유 기능 제한
        if (this.currentUser.role === 'local') {
            return ['view', 'edit', 'save'].includes(action); // 로컬 편집만 가능
        }
        
        // 인증된 사용자 권한
        switch (this.currentUser.role) {
            case 'admin':
                return true; // 모든 권한
            case 'editor':
                return ['view', 'edit', 'save', 'realtime_share'].includes(action);
            case 'viewer':
                return ['view', 'realtime_share'].includes(action);
            default:
                return false;
        }
    }
    
    // 🎯 ULTRATHINK: 실시간 공유 권한 확인
    canUseRealtimeFeatures() {
        return this.currentUser.isAuthenticated && this.hasPermission('realtime_share');
    }
    
    // 🎯 ULTRATHINK: 필지 편집 권한 확인
    canEditParcel(parcelId) {
        if (!this.hasPermission('edit')) {
            return { allowed: false, reason: '편집 권한이 없습니다.' };
        }
        
        // 로컬 사용자는 실시간 잠금 검사 생략
        if (!this.canUseRealtimeFeatures()) {
            return { allowed: true }; // 로컬 편집 허용
        }
        
        // 실시간 데이터 매니저를 통한 잠금 상태 확인
        if (window.realtimeDataManager) {
            const isLocked = window.realtimeDataManager.lockedParcels.has(parcelId);
            if (isLocked) {
                return { allowed: false, reason: '다른 사용자가 편집 중입니다.' };
            }
        }
        
        return { allowed: true };
    }
    
    // 🎯 ULTRATHINK: 다른 사용자 업데이트 처리
    handleUserUpdate(userData) {
        if (userData.sessionId === this.currentUser.id) return;
        
        this.connectedUsers.set(userData.sessionId, {
            id: userData.sessionId,
            name: userData.name || '익명 사용자',
            color: userData.color || '#808080',
            role: userData.role || 'editor',
            lastSeen: new Date().toISOString()
        });
        
        this.updateUsersList();
    }
    
    // 🎯 ULTRATHINK: 사용자 연결 해제 처리
    handleUserDisconnect(sessionId) {
        if (this.connectedUsers.has(sessionId)) {
            const user = this.connectedUsers.get(sessionId);
            console.log(`👋 사용자 연결 해제: ${user.name}`);
            this.connectedUsers.delete(sessionId);
            this.updateUsersList();
            
            if (window.showToast) {
                window.showToast(`${user.name}님이 나갔습니다`, 'info');
            }
        }
    }
    
    // 🎯 ULTRATHINK: 사용자 정보 브로드캐스트
    broadcastUserUpdate() {
        if (window.realtimeDataManager && window.realtimeDataManager.isRealtimeConnected) {
            window.realtimeDataManager.broadcast('user_presence', {
                action: 'update',
                name: this.currentUser.name,
                color: this.currentUser.color,
                role: this.currentUser.role
            }).catch(error => console.warn('사용자 정보 브로드캐스트 실패:', error));
        }
    }
    
    // 🎯 ULTRATHINK: 하트비트 (접속 상태 유지)
    startHeartbeat() {
        // 30초마다 접속 상태 브로드캐스트
        setInterval(() => {
            this.broadcastUserUpdate();
        }, 30000);
        
        // 초기 브로드캐스트
        setTimeout(() => {
            this.broadcastUserUpdate();
        }, 1000);
    }
    
    // 🎯 ULTRATHINK: 편집 권한 요청
    async requestEditPermission(parcelId) {
        const permission = this.canEditParcel(parcelId);
        if (!permission.allowed) {
            if (window.showToast) {
                window.showToast(permission.reason, 'warning');
            }
            return false;
        }
        
        // 필지 잠금 요청
        if (window.realtimeDataManager) {
            const success = await window.realtimeDataManager.broadcastParcelLock(parcelId);
            if (success) {
                console.log(`🔒 필지 ${parcelId} 편집 권한 획득`);
                return true;
            } else {
                if (window.showToast) {
                    window.showToast('편집 권한을 획득할 수 없습니다', 'error');
                }
                return false;
            }
        }
        
        return true; // 실시간 매니저가 없으면 기본 허용
    }
    
    // 🎯 ULTRATHINK: 편집 권한 해제
    async releaseEditPermission(parcelId) {
        if (window.realtimeDataManager) {
            await window.realtimeDataManager.broadcastParcelUnlock(parcelId);
            console.log(`🔓 필지 ${parcelId} 편집 권한 해제`);
        }
    }
    
    // 🎯 ULTRATHINK: 통계 정보
    getStats() {
        return {
            currentUser: this.currentUser,
            connectedUsersCount: this.connectedUsers.size,
            totalUsersCount: this.connectedUsers.size + 1, // 자신 포함
            connectedUsers: Array.from(this.connectedUsers.values())
        };
    }
}

// 🎯 ULTRATHINK: 전역 사용자 매니저 인스턴스
window.userManager = new UserManager();

console.log('👥 ULTRATHINK 사용자 관리 시스템 로드 완료!');