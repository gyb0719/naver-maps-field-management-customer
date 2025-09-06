/**
 * 고성능 가상 스크롤 구현
 * 대량 데이터(60k+ 필지)를 효율적으로 렌더링
 */

class VirtualScroller {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? 
            document.querySelector(container) : container;
        
        if (!this.container) {
            throw new Error('VirtualScroller: 컨테이너를 찾을 수 없습니다');
        }

        // 기본 설정
        this.options = {
            itemHeight: options.itemHeight || 80,
            overscan: options.overscan || 5, // 버퍼 아이템 수
            renderItem: options.renderItem || this.defaultRenderItem,
            onItemClick: options.onItemClick || null,
            className: options.className || 'virtual-scroller-item',
            ...options
        };

        this.items = [];
        this.filteredItems = [];
        this.visibleItems = [];
        
        // 스크롤 상태
        this.scrollTop = 0;
        this.viewportHeight = 0;
        this.totalHeight = 0;
        
        // 렌더링 범위
        this.startIndex = 0;
        this.endIndex = 0;
        this.visibleStartIndex = 0;
        this.visibleEndIndex = 0;

        // 성능 최적화
        this.isScrolling = false;
        this.scrollTimeout = null;
        this.raf = null;

        this.init();
    }

    init() {
        this.setupContainer();
        this.bindEvents();
        this.updateViewportHeight();
    }

    setupContainer() {
        // 컨테이너 스타일 설정
        this.container.style.position = 'relative';
        this.container.style.overflow = 'auto';
        this.container.style.height = this.container.style.height || '400px';

        // 스크롤러 래퍼 생성
        this.scrollerWrapper = document.createElement('div');
        this.scrollerWrapper.style.position = 'relative';
        this.scrollerWrapper.style.width = '100%';
        
        // 아이템 컨테이너 생성
        this.itemsContainer = document.createElement('div');
        this.itemsContainer.style.position = 'absolute';
        this.itemsContainer.style.top = '0';
        this.itemsContainer.style.left = '0';
        this.itemsContainer.style.width = '100%';

        this.scrollerWrapper.appendChild(this.itemsContainer);
        this.container.appendChild(this.scrollerWrapper);
    }

    bindEvents() {
        // 스크롤 이벤트 (throttled)
        this.container.addEventListener('scroll', (e) => {
            this.handleScroll(e);
        });

        // 리사이즈 이벤트
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // 아이템 클릭 이벤트 (이벤트 위임)
        this.itemsContainer.addEventListener('click', (e) => {
            this.handleItemClick(e);
        });
    }

    handleScroll(e) {
        if (this.raf) {
            cancelAnimationFrame(this.raf);
        }

        this.raf = requestAnimationFrame(() => {
            this.scrollTop = this.container.scrollTop;
            this.updateVisibleRange();
            this.renderVisibleItems();
            
            this.isScrolling = true;
            
            // 스크롤 종료 감지
            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = setTimeout(() => {
                this.isScrolling = false;
                this.onScrollEnd();
            }, 150);
        });
    }

    handleResize() {
        this.updateViewportHeight();
        this.updateVisibleRange();
        this.renderVisibleItems();
    }

    handleItemClick(e) {
        const itemElement = e.target.closest('.virtual-scroller-item');
        if (!itemElement) return;

        const index = parseInt(itemElement.dataset.index, 10);
        if (isNaN(index)) return;

        const item = this.filteredItems[index];
        if (item && this.options.onItemClick) {
            this.options.onItemClick(item, index, e);
        }
    }

    updateViewportHeight() {
        this.viewportHeight = this.container.clientHeight;
    }

    updateVisibleRange() {
        const itemHeight = this.options.itemHeight;
        const overscan = this.options.overscan;
        
        // 보이는 첫 번째 아이템 인덱스
        this.visibleStartIndex = Math.floor(this.scrollTop / itemHeight);
        
        // 보이는 마지막 아이템 인덱스
        this.visibleEndIndex = Math.min(
            this.filteredItems.length - 1,
            this.visibleStartIndex + Math.ceil(this.viewportHeight / itemHeight)
        );

        // 버퍼 추가 (오버스캔)
        this.startIndex = Math.max(0, this.visibleStartIndex - overscan);
        this.endIndex = Math.min(
            this.filteredItems.length - 1, 
            this.visibleEndIndex + overscan
        );
    }

    renderVisibleItems() {
        if (this.filteredItems.length === 0) {
            this.itemsContainer.innerHTML = '<div class="no-items">항목이 없습니다</div>';
            return;
        }

        const fragment = document.createDocumentFragment();
        
        // 보이는 범위의 아이템들만 렌더링
        for (let i = this.startIndex; i <= this.endIndex; i++) {
            const item = this.filteredItems[i];
            if (!item) continue;

            const itemElement = this.createItemElement(item, i);
            fragment.appendChild(itemElement);
        }

        // DOM 업데이트
        this.itemsContainer.innerHTML = '';
        this.itemsContainer.appendChild(fragment);

        // 전체 높이 설정 (스크롤바 유지)
        this.scrollerWrapper.style.height = `${this.totalHeight}px`;
    }

    createItemElement(item, index) {
        const element = document.createElement('div');
        element.className = this.options.className;
        element.dataset.index = index;
        
        // 위치 설정
        element.style.position = 'absolute';
        element.style.top = `${index * this.options.itemHeight}px`;
        element.style.height = `${this.options.itemHeight}px`;
        element.style.width = '100%';
        element.style.boxSizing = 'border-box';
        
        // 콘텐츠 렌더링
        element.innerHTML = this.options.renderItem(item, index);
        
        return element;
    }

    defaultRenderItem(item, index) {
        return `
            <div style="padding: 10px; border-bottom: 1px solid #eee;">
                <div><strong>${item.title || item.name || `Item ${index}`}</strong></div>
                <div style="color: #666; font-size: 0.9em;">
                    ${item.description || item.address || ''}
                </div>
            </div>
        `;
    }

    // 데이터 설정
    setItems(items) {
        this.items = items || [];
        this.applyFilter();
    }

    // 필터 적용
    setFilter(filterFn) {
        this.filterFunction = filterFn;
        this.applyFilter();
    }

    applyFilter() {
        if (this.filterFunction) {
            this.filteredItems = this.items.filter(this.filterFunction);
        } else {
            this.filteredItems = [...this.items];
        }
        
        this.totalHeight = this.filteredItems.length * this.options.itemHeight;
        this.updateVisibleRange();
        this.renderVisibleItems();
    }

    // 검색 기능
    search(query) {
        if (!query || query.trim() === '') {
            this.setFilter(null);
            return;
        }

        const searchLower = query.toLowerCase().trim();
        this.setFilter(item => {
            const searchableText = [
                item.title, item.name, item.address, 
                item.ownerName, item.parcelNumber,
                item.memo, item.description
            ].filter(Boolean).join(' ').toLowerCase();
            
            return searchableText.includes(searchLower);
        });
    }

    // 특정 인덱스로 스크롤
    scrollToIndex(index) {
        if (index < 0 || index >= this.filteredItems.length) return;

        const targetScrollTop = index * this.options.itemHeight;
        this.container.scrollTop = targetScrollTop;
    }

    // 특정 아이템으로 스크롤
    scrollToItem(item) {
        const index = this.filteredItems.indexOf(item);
        if (index !== -1) {
            this.scrollToIndex(index);
        }
    }

    // 스크롤 종료 후 콜백
    onScrollEnd() {
        // 추가적인 최적화나 지연 로딩 작업 수행 가능
        console.log(`VirtualScroller: 스크롤 종료 (${this.startIndex}-${this.endIndex})`);
    }

    // 통계 정보
    getStats() {
        return {
            totalItems: this.items.length,
            filteredItems: this.filteredItems.length,
            renderedItems: this.endIndex - this.startIndex + 1,
            visibleItems: this.visibleEndIndex - this.visibleStartIndex + 1,
            scrollTop: this.scrollTop,
            isScrolling: this.isScrolling
        };
    }

    // 정리
    destroy() {
        if (this.raf) {
            cancelAnimationFrame(this.raf);
        }
        
        clearTimeout(this.scrollTimeout);
        
        // 이벤트 리스너 제거
        this.container.removeEventListener('scroll', this.handleScroll);
        window.removeEventListener('resize', this.handleResize);
        
        // DOM 정리
        this.container.innerHTML = '';
    }
}

// 전역 사용을 위해 window에 등록
window.VirtualScroller = VirtualScroller;