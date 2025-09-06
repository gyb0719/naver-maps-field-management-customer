/**
 * Rate Limiting과 요청 관리를 위한 유틸리티
 */

class RateLimiter {
    constructor(maxRequests = 100, windowMs = 60000) {
        this.maxRequests = maxRequests; // 최대 요청 수
        this.windowMs = windowMs; // 시간 윈도우 (밀리초)
        this.requests = []; // 요청 타임스탬프 저장
    }

    // 요청 허용 여부 확인
    isAllowed() {
        const now = Date.now();
        
        // 시간 윈도우 밖의 요청들 제거
        this.requests = this.requests.filter(timestamp => 
            now - timestamp < this.windowMs
        );
        
        // 최대 요청 수 확인
        if (this.requests.length >= this.maxRequests) {
            console.warn(`⚠️ Rate limit 도달: ${this.maxRequests}회/${this.windowMs/1000}초`);
            return false;
        }
        
        // 요청 추가
        this.requests.push(now);
        return true;
    }

    // 남은 요청 수 반환
    getRemainingRequests() {
        const now = Date.now();
        this.requests = this.requests.filter(timestamp => 
            now - timestamp < this.windowMs
        );
        return Math.max(0, this.maxRequests - this.requests.length);
    }

    // 다음 요청 가능 시간 반환
    getResetTime() {
        if (this.requests.length === 0) return 0;
        
        const oldestRequest = Math.min(...this.requests);
        const resetTime = oldestRequest + this.windowMs - Date.now();
        return Math.max(0, resetTime);
    }
}

// API별 Rate Limiter 인스턴스
class APIRateLimiters {
    constructor() {
        this.limiters = {
            vworld: new RateLimiter(50, 60000), // VWorld: 50회/분
            naver: new RateLimiter(100, 60000), // Naver: 100회/분  
            google: new RateLimiter(30, 60000), // Google: 30회/분
            supabase: new RateLimiter(200, 60000) // Supabase: 200회/분
        };
    }

    // API 호출 전 확인
    canMakeRequest(apiName) {
        const limiter = this.limiters[apiName];
        if (!limiter) {
            console.warn(`알 수 없는 API: ${apiName}`);
            return true; // 알 수 없는 API는 허용
        }

        const allowed = limiter.isAllowed();
        
        if (!allowed) {
            const resetTime = limiter.getResetTime();
            console.warn(`${apiName} API Rate limit 도달. ${Math.ceil(resetTime/1000)}초 후 재시도 가능`);
        } else {
            const remaining = limiter.getRemainingRequests();
            console.log(`${apiName} API 요청 성공 (남은 요청: ${remaining})`);
        }
        
        return allowed;
    }

    // 상태 정보 반환
    getStatus() {
        const status = {};
        
        for (const [apiName, limiter] of Object.entries(this.limiters)) {
            status[apiName] = {
                remaining: limiter.getRemainingRequests(),
                resetTime: limiter.getResetTime()
            };
        }
        
        return status;
    }
}

// 요청 로깅 클래스
class RequestLogger {
    constructor(maxLogs = 1000) {
        this.logs = [];
        this.maxLogs = maxLogs;
    }

    // 요청 로그
    logRequest(apiName, endpoint, params = {}) {
        const log = {
            timestamp: new Date().toISOString(),
            apiName,
            endpoint,
            params: { ...params }, // 깊은 복사로 민감 정보 보호
            success: null,
            responseTime: null,
            startTime: Date.now()
        };

        // 민감한 정보 마스킹
        if (log.params.key) {
            log.params.key = log.params.key.substring(0, 8) + '...';
        }

        this.logs.push(log);
        
        // 로그 크기 제한
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        return log;
    }

    // 응답 로그
    logResponse(log, success, responseData = null) {
        log.success = success;
        log.responseTime = Date.now() - log.startTime;
        
        if (success) {
            console.log(`✅ ${log.apiName} 요청 성공 (${log.responseTime}ms)`);
        } else {
            console.error(`❌ ${log.apiName} 요청 실패 (${log.responseTime}ms):`, responseData);
        }
    }

    // 최근 로그 반환
    getRecentLogs(count = 50) {
        return this.logs.slice(-count);
    }

    // 에러 로그만 반환
    getErrorLogs(count = 20) {
        return this.logs
            .filter(log => log.success === false)
            .slice(-count);
    }

    // 통계 정보
    getStats() {
        const total = this.logs.length;
        const successful = this.logs.filter(log => log.success === true).length;
        const failed = this.logs.filter(log => log.success === false).length;
        
        // API별 통계
        const apiStats = {};
        this.logs.forEach(log => {
            if (!apiStats[log.apiName]) {
                apiStats[log.apiName] = { total: 0, success: 0, fail: 0 };
            }
            apiStats[log.apiName].total++;
            if (log.success === true) apiStats[log.apiName].success++;
            if (log.success === false) apiStats[log.apiName].fail++;
        });

        return {
            total,
            successful,
            failed,
            successRate: total > 0 ? (successful / total * 100).toFixed(1) : 0,
            apiStats
        };
    }
}

// 전역 인스턴스 생성
window.apiRateLimiters = new APIRateLimiters();
window.requestLogger = new RequestLogger();

// API 호출 래퍼 함수
window.safeApiCall = async function(apiName, apiCall, params = {}) {
    // Rate limiting 확인
    if (!window.apiRateLimiters.canMakeRequest(apiName)) {
        throw new Error(`${apiName} API rate limit exceeded`);
    }

    // 요청 로깅
    const log = window.requestLogger.logRequest(apiName, 'unknown', params);

    try {
        const result = await apiCall();
        window.requestLogger.logResponse(log, true);
        return result;
    } catch (error) {
        window.requestLogger.logResponse(log, false, error.message);
        throw error;
    }
};