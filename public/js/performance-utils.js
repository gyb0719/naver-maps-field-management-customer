// 성능 최적화 유틸리티

// 디바운스 함수
function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(this, args);
    };
}

// 쓰로틀 함수
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// 메모리 캐시 매니저
class CacheManager {
    constructor(maxSize = 100, ttl = 300000) { // TTL: 5분
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = ttl;
    }

    set(key, value) {
        // 캐시 크기 제한
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    get(key) {
        const item = this.cache.get(key);
        
        if (!item) return null;
        
        // TTL 체크
        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return item.value;
    }

    clear() {
        this.cache.clear();
    }

    has(key) {
        return this.get(key) !== null;
    }

    size() {
        return this.cache.size;
    }

    // 오래된 항목 정리
    cleanExpired() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now - item.timestamp > this.ttl) {
                this.cache.delete(key);
            }
        }
    }
}

// API 요청 큐 매니저
class RequestQueue {
    constructor(maxConcurrent = 3) {
        this.queue = [];
        this.running = 0;
        this.maxConcurrent = maxConcurrent;
    }

    async add(request) {
        return new Promise((resolve, reject) => {
            this.queue.push({ request, resolve, reject });
            this.process();
        });
    }

    async process() {
        if (this.running >= this.maxConcurrent || this.queue.length === 0) {
            return;
        }

        this.running++;
        const { request, resolve, reject } = this.queue.shift();

        try {
            const result = await request();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.running--;
            this.process();
        }
    }

    clear() {
        this.queue = [];
    }

    get pending() {
        return this.queue.length;
    }
}

// 레이지 로딩 옵저버
class LazyLoadObserver {
    constructor(options = {}) {
        this.options = {
            root: null,
            rootMargin: '50px',
            threshold: 0.01,
            ...options
        };
        
        this.observer = new IntersectionObserver(this.handleIntersection.bind(this), this.options);
        this.callbacks = new Map();
    }

    observe(element, callback) {
        this.callbacks.set(element, callback);
        this.observer.observe(element);
    }

    unobserve(element) {
        this.callbacks.delete(element);
        this.observer.unobserve(element);
    }

    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const callback = this.callbacks.get(entry.target);
                if (callback) {
                    callback(entry.target);
                    this.unobserve(entry.target);
                }
            }
        });
    }

    disconnect() {
        this.observer.disconnect();
        this.callbacks.clear();
    }
}

// 배치 처리 유틸리티
class BatchProcessor {
    constructor(batchSize = 10, delay = 100) {
        this.batchSize = batchSize;
        this.delay = delay;
        this.items = [];
        this.processing = false;
    }

    async add(item) {
        this.items.push(item);
        if (!this.processing) {
            this.processing = true;
            await this.processBatches();
        }
    }

    async processBatches() {
        while (this.items.length > 0) {
            const batch = this.items.splice(0, this.batchSize);
            await this.processBatch(batch);
            if (this.items.length > 0) {
                await this.sleep(this.delay);
            }
        }
        this.processing = false;
    }

    async processBatch(batch) {
        // 오버라이드 필요
        console.log('Processing batch:', batch);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 전역 인스턴스 생성
const parcelCache = new CacheManager(200, 600000); // 10분 TTL
const apiQueue = new RequestQueue(3);
const lazyLoader = new LazyLoadObserver();

// Export
window.PerformanceUtils = {
    debounce,
    throttle,
    CacheManager,
    RequestQueue,
    LazyLoadObserver,
    BatchProcessor,
    parcelCache,
    apiQueue,
    lazyLoader
};