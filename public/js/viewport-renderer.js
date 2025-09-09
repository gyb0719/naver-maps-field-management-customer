/**
 * 뷰포트 기반 지도 렌더링 최적화
 * 현재 보이는 영역의 필지만 렌더링하여 성능 향상
 */

class ViewportRenderer {
    constructor(map) {
        this.map = map;
        this.renderedParcels = new Map(); // 현재 렌더링된 필지들
        this.allParcels = []; // 전체 필지 데이터
        this.isRendering = false;
        this.renderQueue = [];
        
        // 성능 설정
        this.MAX_PARCELS_PER_ZOOM = {
            7: 50,    // 매우 멀리서 볼 때
            10: 100,  // 중간 거리
            13: 300,  // 가까이
            15: 800,  // 매우 가까이
            18: 2000  // 최대 줌
        };
        
        this.RENDER_DELAY = 100; // 렌더링 디바운스 딜레이 (ms)
        this.renderTimeout = null;
        this.lastViewport = null;
        
        this.init();
    }

    init() {
        this.bindMapEvents();
        console.log('ViewportRenderer 초기화 완료');
    }

    bindMapEvents() {
        // 지도 이동/줌 이벤트 리스너
        naver.maps.Event.addListener(this.map, 'idle', () => {
            this.scheduleRender();
        });

        naver.maps.Event.addListener(this.map, 'zoom_changed', () => {
            this.scheduleRender();
        });

        naver.maps.Event.addListener(this.map, 'bounds_changed', () => {
            this.scheduleRender();
        });
    }

    // 렌더링 스케줄링 (디바운스)
    scheduleRender() {
        if (this.renderTimeout) {
            clearTimeout(this.renderTimeout);
        }

        this.renderTimeout = setTimeout(() => {
            this.renderViewport();
        }, this.RENDER_DELAY);
    }

    // 뷰포트 렌더링 실행
    async renderViewport() {
        if (this.isRendering) {
            return;
        }

        this.isRendering = true;

        try {
            const viewport = this.getCurrentViewport();
            const zoomLevel = this.map.getZoom();
            
            // 뷰포트가 크게 변하지 않았으면 스킵
            if (this.isSimilarViewport(viewport, this.lastViewport)) {
                this.isRendering = false;
                return;
            }

            console.log(`🗺️ 뷰포트 렌더링: 줌 ${zoomLevel}, 범위 ${viewport.sw.lat().toFixed(4)},${viewport.sw.lng().toFixed(4)} ~ ${viewport.ne.lat().toFixed(4)},${viewport.ne.lng().toFixed(4)}`);

            // 현재 줌 레벨에 따른 최대 필지 수
            const maxParcels = this.getMaxParcelsForZoom(zoomLevel);
            
            // 뷰포트 내 필지 필터링
            const visibleParcels = this.filterParcelsInViewport(viewport, maxParcels);
            
            // 기존 렌더링된 필지 중 범위 밖 것들 제거
            this.removeOutOfBoundsParcels(viewport);
            
            // 새로운 필지들 렌더링
            await this.renderParcels(visibleParcels);
            
            this.lastViewport = viewport;
            
            console.log(`✅ 렌더링 완료: ${visibleParcels.length}개 필지 (최대: ${maxParcels})`);

        } catch (error) {
            console.error('뷰포트 렌더링 오류:', error);
        } finally {
            this.isRendering = false;
        }
    }

    // 현재 뷰포트 정보 가져오기
    getCurrentViewport() {
        const bounds = this.map.getBounds();
        return {
            sw: bounds.getSW(), // 남서쪽
            ne: bounds.getNE(), // 북동쪽
            center: this.map.getCenter(),
            zoom: this.map.getZoom()
        };
    }

    // 뷰포트 유사성 검사
    isSimilarViewport(current, previous) {
        if (!previous) return false;
        
        const threshold = 0.001; // 약 100m 차이
        
        return Math.abs(current.sw.lat() - previous.sw.lat()) < threshold &&
               Math.abs(current.sw.lng() - previous.sw.lng()) < threshold &&
               Math.abs(current.ne.lat() - previous.ne.lat()) < threshold &&
               Math.abs(current.ne.lng() - previous.ne.lng()) < threshold &&
               current.zoom === previous.zoom;
    }

    // 줌 레벨별 최대 필지 수 계산
    getMaxParcelsForZoom(zoomLevel) {
        const zoomLevels = Object.keys(this.MAX_PARCELS_PER_ZOOM)
            .map(Number)
            .sort((a, b) => a - b);
        
        for (const level of zoomLevels) {
            if (zoomLevel <= level) {
                return this.MAX_PARCELS_PER_ZOOM[level];
            }
        }
        
        return this.MAX_PARCELS_PER_ZOOM[Math.max(...zoomLevels)];
    }

    // 뷰포트 내 필지 필터링
    filterParcelsInViewport(viewport, maxCount) {
        const visibleParcels = [];
        
        for (const parcel of this.allParcels) {
            if (!this.isParcelInViewport(parcel, viewport)) {
                continue;
            }
            
            // 이미 렌더링된 필지는 스킵
            if (this.renderedParcels.has(parcel.id)) {
                continue;
            }
            
            visibleParcels.push(parcel);
            
            // 최대 개수 제한
            if (visibleParcels.length >= maxCount) {
                break;
            }
        }
        
        return visibleParcels;
    }

    // 필지가 뷰포트 내에 있는지 확인
    isParcelInViewport(parcel, viewport) {
        const geometry = parcel.geometry || parcel.coordinates;
        if (!geometry) return false;

        // 필지의 중심점 계산
        const center = this.getParcelCenter(geometry);
        if (!center) return false;

        // 뷰포트 범위 확인
        return center.lat >= viewport.sw.lat() &&
               center.lat <= viewport.ne.lat() &&
               center.lng >= viewport.sw.lng() &&
               center.lng <= viewport.ne.lng();
    }

    // 필지 중심점 계산
    getParcelCenter(geometry) {
        try {
            if (geometry.type === 'Polygon' && geometry.coordinates && geometry.coordinates[0]) {
                const coords = geometry.coordinates[0];
                let sumLat = 0, sumLng = 0, count = 0;
                
                coords.forEach(coord => {
                    sumLat += coord[1]; // lat
                    sumLng += coord[0]; // lng
                    count++;
                });
                
                if (count > 0) {
                    return { lat: sumLat / count, lng: sumLng / count };
                }
            } else if (Array.isArray(geometry)) {
                // 이전 형식 호환
                let sumLat = 0, sumLng = 0, count = 0;
                
                geometry.forEach(coord => {
                    sumLat += coord.lat || coord[1];
                    sumLng += coord.lng || coord[0];
                    count++;
                });
                
                if (count > 0) {
                    return { lat: sumLat / count, lng: sumLng / count };
                }
            }
        } catch (error) {
            console.warn('필지 중심점 계산 실패:', error);
        }
        
        return null;
    }

    // 범위 밖 필지 제거
    removeOutOfBoundsParcels(viewport) {
        const toRemove = [];
        
        this.renderedParcels.forEach((polygon, parcelId) => {
            const parcel = this.allParcels.find(p => p.id === parcelId);
            if (!parcel || !this.isParcelInViewport(parcel, viewport)) {
                toRemove.push({ id: parcelId, polygon });
            }
        });
        
        toRemove.forEach(({ id, polygon }) => {
            if (polygon && polygon.setMap) {
                polygon.setMap(null);
            }
            this.renderedParcels.delete(id);
        });
        
        if (toRemove.length > 0) {
            console.log(`🗑️ 범위 밖 필지 제거: ${toRemove.length}개`);
        }
    }

    // 필지들 렌더링
    async renderParcels(parcels) {
        if (parcels.length === 0) return;

        // 성능을 위해 배치로 처리
        const batchSize = 50;
        
        for (let i = 0; i < parcels.length; i += batchSize) {
            const batch = parcels.slice(i, i + batchSize);
            
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    this.renderParcelBatch(batch);
                    resolve();
                });
            });
            
            // 다른 작업이 실행될 수 있도록 잠시 대기
            if (i + batchSize < parcels.length) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        }
    }

    // 필지 배치 렌더링
    renderParcelBatch(batch) {
        batch.forEach(parcel => {
            try {
                // 🎯 ULTRATHINK: 중복 폴리곤 방지 - 이미 렌더링된 필지인지 확인
                if (this.renderedParcels.has(parcel.id)) {
                    const existingPolygon = this.renderedParcels.get(parcel.id);
                    if (existingPolygon) {
                        existingPolygon.setMap(null); // 기존 폴리곤 제거
                    }
                }
                
                const polygon = this.createParcelPolygon(parcel);
                if (polygon) {
                    this.renderedParcels.set(parcel.id, polygon);
                }
            } catch (error) {
                console.warn('필지 렌더링 실패:', parcel.id, error);
            }
        });
    }

    // 필지 폴리곤 생성
    createParcelPolygon(parcel, shouldAddToMap = true) {
        const geometry = parcel.geometry || parcel.coordinates;
        if (!geometry) return null;

        let paths = [];
        
        try {
            if (geometry.type === 'MultiPolygon' && geometry.coordinates && geometry.coordinates[0] && geometry.coordinates[0][0]) {
                // 🎯 ULTRATHINK: MultiPolygon 처리 - coordinates[0][0] 사용
                paths = geometry.coordinates[0][0].map(coord => 
                    new naver.maps.LatLng(coord[1], coord[0])
                );
                console.log('🔧 MultiPolygon 좌표 처리 완료, paths 개수:', paths.length);
            } else if (geometry.type === 'Polygon' && geometry.coordinates && geometry.coordinates[0]) {
                paths = geometry.coordinates[0].map(coord => 
                    new naver.maps.LatLng(coord[1], coord[0])
                );
                console.log('🔧 Polygon 좌표 처리 완료, paths 개수:', paths.length);
            } else if (Array.isArray(geometry)) {
                paths = geometry.map(coord => 
                    new naver.maps.LatLng(coord.lat || coord[1], coord.lng || coord[0])
                );
                console.log('🔧 배열 좌표 처리 완료, paths 개수:', paths.length);
            }
            
            if (paths.length === 0) return null;
            
            const polygon = new naver.maps.Polygon({
                map: shouldAddToMap ? this.map : null, // 🎯 ULTRATHINK: 조건부 지도 추가
                paths: paths,
                fillColor: parcel.color || '#FF0000',
                fillOpacity: 0.3,
                strokeColor: parcel.color || '#FF0000',
                strokeOpacity: 0.8,
                strokeWeight: 2
            });
            
            // 클릭 이벤트 추가
            naver.maps.Event.addListener(polygon, 'click', () => {
                this.onParcelClick(parcel);
            });
            
            return polygon;
            
        } catch (error) {
            console.warn('폴리곤 생성 실패:', error);
            return null;
        }
    }

    // 필지 클릭 이벤트
    onParcelClick(parcel) {
        console.log('필지 클릭:', parcel.parcelNumber || parcel.id);
        
        // 기존 필지 클릭 로직 호출
        if (window.displayParcelInfo) {
            window.displayParcelInfo(parcel);
        }
    }

    // 전체 필지 데이터 설정
    setParcels(parcels) {
        this.allParcels = parcels || [];
        console.log(`ViewportRenderer: ${this.allParcels.length}개 필지 데이터 설정`);
        
        // 현재 뷰포트 다시 렌더링
        this.scheduleRender();
    }

    // 필지 추가
    addParcel(parcel) {
        if (!parcel) {
            console.warn('ViewportRenderer.addParcel: parcel이 null 또는 undefined입니다');
            return;
        }
        
        if (!this.allParcels) {
            this.allParcels = [];
        }
        
        this.allParcels.push(parcel);
        
        // 현재 뷰포트에 있으면 즉시 렌더링
        const viewport = this.getCurrentViewport();
        if (this.isParcelInViewport(parcel, viewport)) {
            this.renderParcels([parcel]);
        }
    }

    // 필지 제거
    removeParcel(parcelId) {
        this.allParcels = this.allParcels.filter(p => p.id !== parcelId);
        
        // 렌더링된 폴리곤 제거
        const polygon = this.renderedParcels.get(parcelId);
        if (polygon && polygon.setMap) {
            polygon.setMap(null);
            this.renderedParcels.delete(parcelId);
        }
    }

    // 모든 필지 제거
    clearAll() {
        // 모든 렌더링된 폴리곤 제거
        this.renderedParcels.forEach(polygon => {
            if (polygon && polygon.setMap) {
                polygon.setMap(null);
            }
        });
        
        this.renderedParcels.clear();
        this.allParcels = [];
        console.log('ViewportRenderer: 모든 필지 제거 완료');
    }

    // 통계 정보
    getStats() {
        return {
            totalParcels: this.allParcels.length,
            renderedParcels: this.renderedParcels.size,
            currentZoom: this.map.getZoom(),
            maxParcelsForZoom: this.getMaxParcelsForZoom(this.map.getZoom()),
            isRendering: this.isRendering
        };
    }

    // 정리
    destroy() {
        if (this.renderTimeout) {
            clearTimeout(this.renderTimeout);
        }
        
        this.clearAll();
        console.log('ViewportRenderer 정리 완료');
    }
}

// 전역 사용을 위해 window에 등록
window.ViewportRenderer = ViewportRenderer;