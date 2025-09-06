/**
 * 보안 강화된 설정 로더
 * 서버에서 안전하게 설정을 받아옵니다
 */

class ConfigLoader {
    constructor() {
        this.config = null;
        this.loaded = false;
    }

    // 서버에서 설정 로드
    async loadConfig() {
        if (this.loaded) {
            return this.config;
        }

        try {
            console.log('🔧 서버에서 설정 로드 중...');
            
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error(`설정 로드 실패: ${response.status}`);
            }

            this.config = await response.json();
            this.loaded = true;

            console.log('✅ 서버 설정 로드 완료');
            
            // 기존 CONFIG 객체 업데이트
            if (window.CONFIG) {
                Object.assign(window.CONFIG, this.config);
            }

            // Google Auth 설정 업데이트
            if (window.GoogleAuth && this.config.GOOGLE_CLIENT_ID) {
                window.GoogleAuth.CLIENT_ID = this.config.GOOGLE_CLIENT_ID;
            }

            // DataManager 설정 업데이트
            if (window.DataManager && this.config.SUPABASE_URL) {
                // DataManager 인스턴스가 있으면 설정 업데이트
                if (window.dataManager) {
                    window.dataManager.SUPABASE_URL = this.config.SUPABASE_URL;
                    window.dataManager.SUPABASE_ANON_KEY = this.config.SUPABASE_ANON_KEY;
                }
            }

            return this.config;

        } catch (error) {
            console.error('❌ 설정 로드 실패:', error);
            
            // 폴백 설정 사용
            this.config = {
                NAVER_CLIENT_ID: 'xzbnwd2h1z', // 기본 공개 키
                GOOGLE_CLIENT_ID: null,
                SUPABASE_URL: null,
                SUPABASE_ANON_KEY: null
            };
            
            this.loaded = true;
            return this.config;
        }
    }

    // 설정 값 가져오기
    get(key) {
        if (!this.loaded) {
            console.warn('설정이 아직 로드되지 않았습니다. loadConfig()를 먼저 호출하세요.');
            return null;
        }
        return this.config[key];
    }

    // 모든 설정 가져오기
    getAll() {
        return this.config;
    }
}

// 전역 인스턴스 생성
window.configLoader = new ConfigLoader();

// DOM 로드 후 자동으로 설정 로드
document.addEventListener('DOMContentLoaded', async () => {
    await window.configLoader.loadConfig();
});