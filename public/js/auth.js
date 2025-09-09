// Google OAuth 인증 관리

const GoogleAuth = {
    // OAuth 설정 - 환경 변수로 이동 예정
    CLIENT_ID: null, // 서버에서 제공받을 예정
    DISCOVERY_DOCS: [
        'https://sheets.googleapis.com/$discovery/rest?version=v4',
        'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'
    ],
    SCOPES: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
    ].join(' '),

    // 초기화 상태
    initialized: false,

    // Google API 초기화
    async initializeAuth() {
        if (this.initialized) return;
        
        try {
            // Google API가 로드될 때까지 대기
            await new Promise((resolve, reject) => {
                if (window.google) {
                    resolve();
                    return;
                }

                let attempts = 0;
                const checkGoogle = setInterval(() => {
                    attempts++;
                    if (window.google && window.google.accounts) {
                        clearInterval(checkGoogle);
                        resolve();
                    } else if (attempts > 50) { // 5초 대기
                        clearInterval(checkGoogle);
                        reject(new Error('Google API 로드 실패'));
                    }
                }, 100);
            });

            this.initialized = true;
            console.log('Google Auth 초기화 완료');
        } catch (error) {
            console.error('Google Auth 초기화 실패:', error);
            throw error;
        }
    },
    
    // 토큰 만료 시간 확인
    isTokenExpired() {
        const expiryTime = localStorage.getItem('tokenExpiry');
        if (!expiryTime) return true;
        return new Date().getTime() > parseInt(expiryTime);
    },
    
    // 로그인 상태 확인
    isAuthenticated() {
        // 실제 토큰 검증 (테스트 모드 제거)
        console.log('인증 상태 확인 중...');
        
        // localStorage로 변경하여 브라우저 재시작해도 유지
        const idToken = localStorage.getItem('googleToken');
        const accessToken = localStorage.getItem('accessToken');
        
        // ID 토큰만 있어도 인증된 것으로 처리
        if (idToken) {
            // 토큰 만료 체크
            if (!this.isTokenExpired()) {
                console.log('인증 상태: 유효');
                return true;
            } else {
                console.log('토큰 만료됨, 자동 갱신 시도');
                // 토큰 만료시 자동 갱신 시도
                this.refreshToken();
                return false;
            }
        }
        
        console.log('인증 상태: 로그인 필요');
        return false;
    },
    
    // 액세스 토큰 가져오기
    getAccessToken() {
        return localStorage.getItem('accessToken');
    },
    
    // 사용자 정보 가져오기
    getUserInfo() {
        const userInfo = localStorage.getItem('userInfo');
        return userInfo ? JSON.parse(userInfo) : null;
    },
    
    // 토큰 저장 (만료시간 함께 저장)
    saveTokens(tokenResponse) {
        localStorage.setItem('accessToken', tokenResponse.access_token);
        // 토큰 만료 시간 설정 (보통 1시간)
        const expiryTime = new Date().getTime() + (tokenResponse.expires_in || 3600) * 1000;
        localStorage.setItem('tokenExpiry', expiryTime.toString());
    },
    
    // 토큰 갱신
    async refreshToken() {
        try {
            // Silent refresh 시도
            if (window.google && window.google.accounts) {
                const tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: this.CLIENT_ID,
                    scope: this.SCOPES,
                    prompt: '', // Silent refresh
                    callback: (tokenResponse) => {
                        console.log('토큰 자동 갱신 성공');
                        this.saveTokens(tokenResponse);
                    }
                });
                tokenClient.requestAccessToken();
            }
        } catch (error) {
            console.error('토큰 갱신 실패:', error);
        }
    },
    
    // 로그인 페이지로 리다이렉트
    redirectToLogin() {
        window.location.href = '/login.html';
    },
    
    // 로그아웃
    logout() {
        // localStorage에서 인증 관련 데이터만 제거
        localStorage.removeItem('googleToken');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('tokenExpiry');
        sessionStorage.clear();
        this.redirectToLogin();
    },
    
    // Google Sheets API 호출
    async callSheetsAPI(method, endpoint, data = null) {
        const token = this.getAccessToken();
        if (!token) {
            console.error('액세스 토큰이 없습니다');
            return null;
        }
        
        const options = {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(`https://sheets.googleapis.com/v4${endpoint}`, options);
            const responseText = await response.text();
            
            if (!response.ok) {
                console.error('API 호출 실패 상세:', {
                    status: response.status,
                    statusText: response.statusText,
                    response: responseText,
                    endpoint: endpoint
                });
                throw new Error(`API 호출 실패: ${response.status} - ${responseText}`);
            }
            
            return JSON.parse(responseText);
        } catch (error) {
            console.error('Sheets API 호출 오류:', error);
            return null;
        }
    },
    
    // Google Calendar API 호출
    async callCalendarAPI(endpoint) {
        const token = this.getAccessToken();
        if (!token) {
            console.error('액세스 토큰이 없습니다');
            return null;
        }
        
        try {
            const response = await fetch(`https://www.googleapis.com/calendar/v3${endpoint}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                // 401 오류인 경우 토큰 만료로 간주하고 조용히 처리
                if (response.status === 401) {
                    console.warn('Google API 토큰 만료 또는 권한 없음 - Calendar 기능 비활성화');
                    return null; // 에러 던지지 않고 null 반환
                }
                throw new Error(`API 호출 실패: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            // 401 오류는 경고로만 처리
            if (error.message.includes('401')) {
                console.warn('Calendar API 액세스 권한 없음 - 기능 비활성화');
            } else {
                console.error('Calendar API 호출 오류:', error);
            }
            return null;
        }
    },
    
    // 스프레드시트 생성 또는 가져오기
    async getOrCreateSpreadsheet() {
        const SPREADSHEET_NAME = '네이버지도_필지관리_데이터';
        
        // 기존 스프레드시트 검색
        const files = await this.searchSpreadsheet(SPREADSHEET_NAME);
        
        if (files && files.files && files.files.length > 0) {
            // 기존 시트 사용
            return files.files[0].id;
        }
        
        // 새 스프레드시트 생성
        const createData = {
            properties: {
                title: SPREADSHEET_NAME
            },
            sheets: [{
                properties: {
                    title: '필지정보'
                },
                data: [{
                    startRow: 0,
                    startColumn: 0,
                    rowData: [{
                        values: [
                            { userEnteredValue: { stringValue: '지번' }, userEnteredFormat: { horizontalAlignment: 'LEFT' } },
                            { userEnteredValue: { stringValue: '소유자이름' } },
                            { userEnteredValue: { stringValue: '소유자주소' } },
                            { userEnteredValue: { stringValue: '연락처' } },
                            { userEnteredValue: { stringValue: '메모' } }
                        ]
                    }]
                }]
            }]
        };
        
        const result = await this.callSheetsAPI('POST', '/spreadsheets', createData);
        return result ? result.spreadsheetId : null;
    },
    
    // 스프레드시트 검색
    async searchSpreadsheet(name) {
        const token = this.getAccessToken();
        if (!token) return null;
        
        try {
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=name='${name}' and mimeType='application/vnd.google-apps.spreadsheet'`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error(`Drive API 호출 실패: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Drive API 검색 오류:', error);
            return null;
        }
    },
    
    // 대량 필지 데이터 백업 (60k 개)
    async backupParcelsToSheets(parcels, onProgress = null) {
        const BATCH_SIZE = 1000; // Google Sheets API 제한 대응
        const SPREADSHEET_NAME = '네이버지도_필지백업_' + new Date().toISOString().slice(0,10);
        
        // 새 백업 시트 생성
        const spreadsheetId = await this.createBackupSpreadsheet(SPREADSHEET_NAME, 'parcel');
        if (!spreadsheetId) throw new Error('백업 시트 생성 실패');
        
        let processedCount = 0;
        const totalBatches = Math.ceil(parcels.length / BATCH_SIZE);
        
        for (let i = 0; i < totalBatches; i++) {
            const batch = parcels.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
            const values = batch.map(parcel => {
                console.log('Processing parcel:', parcel); // 디버깅
                return [
                    parcel.pnu || '',
                    parcel.address || '',
                    parcel.jibun || '', 
                    parcel.area || 0,
                    parcel.ownerName || '', // 테스트 데이터는 ownerName 사용
                    parcel.color || '',
                    parcel.lat || 0,
                    parcel.lng || 0,
                    parcel.created ? new Date(parcel.created).toLocaleString('ko-KR') : new Date().toLocaleString('ko-KR'),
                    JSON.stringify(parcel.coordinates || [])
                ];
            });
            
            await this.batchUpdateSheet(spreadsheetId, `필지데이터!A${processedCount + 2}`, values);
            processedCount += batch.length;
            
            if (onProgress) {
                onProgress(Math.round((processedCount / parcels.length) * 100), `${processedCount}/${parcels.length} 처리 완료`);
            }
            
            // API 제한 방지 딜레이
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return { spreadsheetId, processedCount };
    },

    // 대량 메모 데이터 백업 (30k 개)
    async backupMemosToSheets(memos, onProgress = null) {
        const BATCH_SIZE = 1000;
        const SPREADSHEET_NAME = '네이버지도_메모백업_' + new Date().toISOString().slice(0,10);
        
        const spreadsheetId = await this.createBackupSpreadsheet(SPREADSHEET_NAME, 'memo');
        if (!spreadsheetId) throw new Error('메모 백업 시트 생성 실패');
        
        let processedCount = 0;
        const totalBatches = Math.ceil(memos.length / BATCH_SIZE);
        
        for (let i = 0; i < totalBatches; i++) {
            const batch = memos.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
            const values = batch.map(memo => [
                memo.pnu || '',
                memo.content || '',
                new Date(memo.created || Date.now()).toLocaleString('ko-KR'),
                memo.parcel_id || ''
            ]);
            
            await this.batchUpdateSheet(spreadsheetId, `메모데이터!A${processedCount + 2}`, values);
            processedCount += batch.length;
            
            if (onProgress) {
                onProgress(Math.round((processedCount / memos.length) * 100), `${processedCount}/${memos.length} 처리 완료`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return { spreadsheetId, processedCount };
    },

    // 백업용 스프레드시트 생성
    async createBackupSpreadsheet(title, type) {
        const sheets = type === 'parcel' ? [
            {
                properties: { title: '필지데이터' },
                data: [{
                    startRow: 0,
                    startColumn: 0,
                    rowData: [{
                        values: [
                            { userEnteredValue: { stringValue: 'PNU' }},
                            { userEnteredValue: { stringValue: '주소' }},
                            { userEnteredValue: { stringValue: '지번' }},
                            { userEnteredValue: { stringValue: '면적' }},
                            { userEnteredValue: { stringValue: '소유자' }},
                            { userEnteredValue: { stringValue: '색상' }},
                            { userEnteredValue: { stringValue: '위도' }},
                            { userEnteredValue: { stringValue: '경도' }},
                            { userEnteredValue: { stringValue: '생성일시' }},
                            { userEnteredValue: { stringValue: '좌표데이터' }}
                        ]
                    }]
                }]
            }
        ] : [
            {
                properties: { title: '메모데이터' },
                data: [{
                    startRow: 0,
                    startColumn: 0,
                    rowData: [{
                        values: [
                            { userEnteredValue: { stringValue: 'PNU' }},
                            { userEnteredValue: { stringValue: '메모내용' }},
                            { userEnteredValue: { stringValue: '생성일시' }},
                            { userEnteredValue: { stringValue: '필지ID' }}
                        ]
                    }]
                }]
            }
        ];

        const createData = {
            properties: { title },
            sheets
        };
        
        const result = await this.callSheetsAPI('POST', '/spreadsheets', createData);
        return result ? result.spreadsheetId : null;
    },

    // 배치 업데이트
    async batchUpdateSheet(spreadsheetId, range, values) {
        const body = {
            values: values,
            majorDimension: 'ROWS'
        };
        
        console.log(`API 호출: PUT /spreadsheets/${spreadsheetId}/values/${range}`);
        console.log('전송 데이터:', { valuesCount: values.length, firstRow: values[0] });
        
        const result = await this.callSheetsAPI(
            'PUT',
            `/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
            body
        );
        
        console.log('API 응답:', result);
        return result;
    },

    // 스프레드시트에 데이터 추가
    async appendToSheet(spreadsheetId, data) {
        const range = '필지정보!A:E';
        const values = data.map(item => [
            item.지번 || '',
            item.소유자이름 || '',
            item.소유자주소 || '',
            item.연락처 || '',
            item.메모 || ''
        ]);
        
        const body = {
            values: values,
            majorDimension: 'ROWS'
        };
        
        // 데이터 추가 - A1부터 시작하도록 명시적으로 설정
        const result = await this.callSheetsAPI(
            'POST',
            `/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
            body
        );
        
        // 지번 열(A열) 왼쪽 정렬 포맷 적용
        if (result) {
            await this.formatColumn(spreadsheetId, 0); // A열 = 0
        }
        
        return result;
    },
    
    // 특정 열 포맷 설정
    async formatColumn(spreadsheetId, columnIndex) {
        const formatRequest = {
            requests: [{
                repeatCell: {
                    range: {
                        sheetId: 0,
                        startColumnIndex: columnIndex,
                        endColumnIndex: columnIndex + 1
                    },
                    cell: {
                        userEnteredFormat: {
                            horizontalAlignment: 'LEFT'
                        }
                    },
                    fields: 'userEnteredFormat.horizontalAlignment'
                }
            }]
        };
        
        return await this.callSheetsAPI(
            'POST',
            `/spreadsheets/${spreadsheetId}:batchUpdate`,
            formatRequest
        );
    },
    
    // 사용자 캘린더 목록 가져오기
    async getUserCalendars() {
        const result = await this.callCalendarAPI('/users/me/calendarList');
        return result ? result.items : [];
    },
    
    // 주 캘린더 ID 가져오기
    async getPrimaryCalendarId() {
        const calendars = await this.getUserCalendars();
        const primary = calendars.find(cal => cal.primary);
        return primary ? primary.id : null;
    }
};

// 페이지 로드 시 인증 확인
document.addEventListener('DOMContentLoaded', function() {
    // 🎯 ULTRATHINK: 테스트 환경에서 인증 우회
    const isTestEnvironment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // login.html이 아닌 경우에만 인증 확인
    if (!window.location.pathname.includes('login.html')) {
        console.log('===== 인증 체크 시작 =====');
        console.log('현재 페이지:', window.location.pathname);
        console.log('테스트 환경:', isTestEnvironment);
        console.log('googleToken:', localStorage.getItem('googleToken') ? '있음' : '없음');
        console.log('tokenExpiry:', localStorage.getItem('tokenExpiry'));
        console.log('현재 시간:', new Date().getTime());
        
        if (isTestEnvironment) {
            console.log('🧪 테스트 환경 - 인증 우회');
            // 테스트용 더미 인증 정보 설정
            localStorage.setItem('googleToken', 'test_token');
            localStorage.setItem('tokenExpiry', (new Date().getTime() + 3600000).toString());
        }
        
        if (!GoogleAuth.isAuthenticated() && !isTestEnvironment) {
            console.log('인증 실패 - 로그인 페이지로 리다이렉트');
            GoogleAuth.redirectToLogin();
        } else {
            console.log('인증 성공 - 메인 페이지 유지');
            // 인증된 경우 사용자 정보 표시
            const userInfo = GoogleAuth.getUserInfo();
            if (userInfo) {
                console.log('로그인 사용자:', userInfo.email);
                
                // 헤더에 사용자 정보 표시 (선택사항)
                const header = document.querySelector('.header');
                if (header && !document.getElementById('userInfo')) {
                    const userDiv = document.createElement('div');
                    userDiv.id = 'userInfo';
                    userDiv.style.cssText = 'position: absolute; top: 1rem; right: 1rem; color: white; font-size: 0.875rem;';
                    userDiv.innerHTML = `
                        <span>${userInfo.name || userInfo.email}님</span>
                        <button onclick="GoogleAuth.logout()" style="margin-left: 1rem; padding: 0.25rem 0.5rem; background: rgba(255,255,255,0.2); border: 1px solid white; border-radius: 4px; color: white; cursor: pointer;">
                            로그아웃
                        </button>
                    `;
                    header.appendChild(userDiv);
                }
            }
            
            // 주기적으로 토큰 유효성 체크 및 갱신 (30분마다)
            setInterval(() => {
                if (GoogleAuth.isTokenExpired()) {
                    console.log('토큰 만료 감지, 자동 갱신 시도...');
                    GoogleAuth.refreshToken();
                }
            }, 30 * 60 * 1000); // 30분
            
            // 페이지가 포커스를 받을 때마다 토큰 체크
            window.addEventListener('focus', () => {
                if (GoogleAuth.isTokenExpired()) {
                    console.log('페이지 포커스 시 토큰 갱신...');
                    GoogleAuth.refreshToken();
                }
            });
        }
    }
});

// 전역 객체로 노출
window.GoogleAuth = GoogleAuth;