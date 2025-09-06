/**
 * IndexedDB 기반 고성능 캐싱 시스템
 * 대용량 필지 데이터와 검색 결과를 효율적으로 캐시
 */

class IndexedDBCache {
    constructor() {
        this.dbName = 'NaverMapsParcelCache';
        this.version = 2;
        this.db = null;
        this.initPromise = null;
        
        // 캐시 설정
        this.stores = {
            parcels: {
                name: 'parcels',
                keyPath: 'id',
                indexes: ['pnu', 'address', 'color', 'createdAt']
            },
            searches: {
                name: 'searches',
                keyPath: 'query',
                indexes: ['timestamp', 'resultsCount']
            },
            mapTiles: {
                name: 'mapTiles',
                keyPath: 'tileKey',
                indexes: ['zoom', 'timestamp']
            },
            settings: {
                name: 'settings',
                keyPath: 'key',
                indexes: ['category']
            }
        };
        
        this.CACHE_EXPIRY = {
            parcels: 7 * 24 * 60 * 60 * 1000,    // 7일
            searches: 1 * 60 * 60 * 1000,        // 1시간
            mapTiles: 3 * 24 * 60 * 60 * 1000,   // 3일
            settings: 30 * 24 * 60 * 60 * 1000   // 30일
        };
    }

    // DB 초기화
    async init() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                console.warn('IndexedDB를 지원하지 않는 브라우저입니다');
                resolve(null);
                return;
            }

            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('IndexedDB 열기 실패:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log(`IndexedDB 초기화 완료: ${this.dbName} v${this.version}`);
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log(`IndexedDB 업그레이드: ${event.oldVersion} → ${event.newVersion}`);

                // 기존 스토어 정리
                const existingStores = Array.from(db.objectStoreNames);
                existingStores.forEach(storeName => {
                    if (!Object.keys(this.stores).includes(storeName)) {
                        console.log(`사용하지 않는 스토어 삭제: ${storeName}`);
                        db.deleteObjectStore(storeName);
                    }
                });

                // 새 스토어 생성
                Object.values(this.stores).forEach(storeConfig => {
                    if (!db.objectStoreNames.contains(storeConfig.name)) {
                        const store = db.createObjectStore(storeConfig.name, {
                            keyPath: storeConfig.keyPath
                        });

                        // 인덱스 생성
                        storeConfig.indexes.forEach(indexName => {
                            store.createIndex(indexName, indexName, { unique: false });
                        });

                        console.log(`스토어 생성: ${storeConfig.name}`);
                    }
                });
            };
        });

        return this.initPromise;
    }

    // 필지 데이터 캐싱
    async cacheParcels(parcels) {
        if (!this.db || !parcels || parcels.length === 0) return false;

        try {
            const transaction = this.db.transaction(['parcels'], 'readwrite');
            const store = transaction.objectStore('parcels');

            // 배치 처리로 성능 최적화
            const promises = parcels.map(parcel => {
                const cacheEntry = {
                    ...parcel,
                    cachedAt: Date.now(),
                    expiresAt: Date.now() + this.CACHE_EXPIRY.parcels
                };

                return new Promise((resolve, reject) => {
                    const request = store.put(cacheEntry);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            });

            await Promise.all(promises);
            console.log(`필지 ${parcels.length}개 캐시 완료`);
            return true;

        } catch (error) {
            console.error('필지 캐시 실패:', error);
            return false;
        }
    }

    // 캐시된 필지 데이터 조회
    async getCachedParcels(filters = {}) {
        if (!this.db) return [];

        try {
            const transaction = this.db.transaction(['parcels'], 'readonly');
            const store = transaction.objectStore('parcels');

            const parcels = await new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            // 만료된 항목 필터링
            const now = Date.now();
            const validParcels = parcels.filter(parcel => 
                !parcel.expiresAt || parcel.expiresAt > now
            );

            // 추가 필터 적용
            let filteredParcels = validParcels;

            if (filters.color) {
                filteredParcels = filteredParcels.filter(p => p.color === filters.color);
            }

            if (filters.searchText) {
                const searchLower = filters.searchText.toLowerCase();
                filteredParcels = filteredParcels.filter(p => 
                    (p.address && p.address.toLowerCase().includes(searchLower)) ||
                    (p.ownerName && p.ownerName.toLowerCase().includes(searchLower)) ||
                    (p.parcelNumber && p.parcelNumber.toLowerCase().includes(searchLower))
                );
            }

            console.log(`캐시에서 ${filteredParcels.length}개 필지 조회`);
            return filteredParcels;

        } catch (error) {
            console.error('필지 캐시 조회 실패:', error);
            return [];
        }
    }

    // 검색 결과 캐싱
    async cacheSearchResult(query, results) {
        if (!this.db || !query) return false;

        try {
            const transaction = this.db.transaction(['searches'], 'readwrite');
            const store = transaction.objectStore('searches');

            const cacheEntry = {
                query: query.toLowerCase().trim(),
                results: results,
                resultsCount: results.length,
                timestamp: Date.now(),
                expiresAt: Date.now() + this.CACHE_EXPIRY.searches
            };

            await new Promise((resolve, reject) => {
                const request = store.put(cacheEntry);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            console.log(`검색 결과 캐시: "${query}" (${results.length}개)`);
            return true;

        } catch (error) {
            console.error('검색 결과 캐시 실패:', error);
            return false;
        }
    }

    // 캐시된 검색 결과 조회
    async getCachedSearchResult(query) {
        if (!this.db || !query) return null;

        try {
            const transaction = this.db.transaction(['searches'], 'readonly');
            const store = transaction.objectStore('searches');

            const result = await new Promise((resolve, reject) => {
                const request = store.get(query.toLowerCase().trim());
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            if (!result) return null;

            // 만료 확인
            if (result.expiresAt && result.expiresAt < Date.now()) {
                await this.deleteCachedSearch(query);
                return null;
            }

            console.log(`캐시에서 검색 결과 조회: "${query}" (${result.resultsCount}개)`);
            return result.results;

        } catch (error) {
            console.error('검색 결과 캐시 조회 실패:', error);
            return null;
        }
    }

    // 설정값 캐싱
    async cacheSetting(key, value, category = 'general') {
        if (!this.db || !key) return false;

        try {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');

            const cacheEntry = {
                key,
                value,
                category,
                timestamp: Date.now(),
                expiresAt: Date.now() + this.CACHE_EXPIRY.settings
            };

            await new Promise((resolve, reject) => {
                const request = store.put(cacheEntry);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            return true;

        } catch (error) {
            console.error('설정 캐시 실패:', error);
            return false;
        }
    }

    // 캐시된 설정값 조회
    async getCachedSetting(key, defaultValue = null) {
        if (!this.db || !key) return defaultValue;

        try {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');

            const result = await new Promise((resolve, reject) => {
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            if (!result) return defaultValue;

            // 만료 확인
            if (result.expiresAt && result.expiresAt < Date.now()) {
                await this.deleteCachedSetting(key);
                return defaultValue;
            }

            return result.value;

        } catch (error) {
            console.error('설정 캐시 조회 실패:', error);
            return defaultValue;
        }
    }

    // 만료된 항목 정리
    async cleanupExpired() {
        if (!this.db) return;

        const now = Date.now();
        const cleanupPromises = [];

        try {
            for (const storeName of Object.keys(this.stores)) {
                cleanupPromises.push(this.cleanupExpiredInStore(storeName, now));
            }

            const results = await Promise.all(cleanupPromises);
            const totalCleaned = results.reduce((sum, count) => sum + count, 0);

            if (totalCleaned > 0) {
                console.log(`만료된 캐시 항목 ${totalCleaned}개 정리 완료`);
            }

        } catch (error) {
            console.error('캐시 정리 실패:', error);
        }
    }

    // 특정 스토어의 만료된 항목 정리
    async cleanupExpiredInStore(storeName, now) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        let cleanedCount = 0;

        return new Promise((resolve, reject) => {
            const request = store.openCursor();
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                
                if (cursor) {
                    const record = cursor.value;
                    
                    if (record.expiresAt && record.expiresAt < now) {
                        cursor.delete();
                        cleanedCount++;
                    }
                    
                    cursor.continue();
                } else {
                    resolve(cleanedCount);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    // 캐시 통계
    async getCacheStats() {
        if (!this.db) return null;

        try {
            const stats = {};

            for (const storeName of Object.keys(this.stores)) {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);

                const count = await new Promise((resolve, reject) => {
                    const request = store.count();
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });

                stats[storeName] = { count };
            }

            // 총 용량 추정
            stats.estimatedSize = await this.estimateStorageSize();

            return stats;

        } catch (error) {
            console.error('캐시 통계 조회 실패:', error);
            return null;
        }
    }

    // 저장소 크기 추정
    async estimateStorageSize() {
        try {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                return {
                    used: estimate.usage,
                    available: estimate.quota,
                    percentage: ((estimate.usage / estimate.quota) * 100).toFixed(2)
                };
            }
        } catch (error) {
            console.warn('저장소 크기 추정 실패:', error);
        }
        return null;
    }

    // 특정 스토어 전체 삭제
    async clearStore(storeName) {
        if (!this.db || !this.stores[storeName]) return false;

        try {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);

            await new Promise((resolve, reject) => {
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            console.log(`${storeName} 스토어 전체 삭제 완료`);
            return true;

        } catch (error) {
            console.error(`${storeName} 스토어 삭제 실패:`, error);
            return false;
        }
    }

    // 개별 항목 삭제
    async deleteCachedSearch(query) {
        if (!this.db) return false;

        try {
            const transaction = this.db.transaction(['searches'], 'readwrite');
            const store = transaction.objectStore('searches');

            await new Promise((resolve, reject) => {
                const request = store.delete(query.toLowerCase().trim());
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            return true;

        } catch (error) {
            console.error('검색 결과 삭제 실패:', error);
            return false;
        }
    }

    async deleteCachedSetting(key) {
        if (!this.db) return false;

        try {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');

            await new Promise((resolve, reject) => {
                const request = store.delete(key);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            return true;

        } catch (error) {
            console.error('설정 삭제 실패:', error);
            return false;
        }
    }

    // DB 연결 종료
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log('IndexedDB 연결 종료');
        }
    }
}

// 전역 인스턴스 생성 및 초기화
window.indexedDBCache = new IndexedDBCache();

// 초기화 및 주기적 정리 설정
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.indexedDBCache.init();
        
        // 10분마다 만료된 캐시 정리
        setInterval(() => {
            window.indexedDBCache.cleanupExpired();
        }, 10 * 60 * 1000);
        
        console.log('IndexedDB 캐시 시스템 준비 완료');
    } catch (error) {
        console.error('IndexedDB 캐시 초기화 실패:', error);
    }
});