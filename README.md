# 🗺️ 네이버 지도 필지 관리 프로그램

**전문적인 필지 색칠 및 관리 시스템**

## 🎯 주요 기능

### ✨ 핵심 기능
- **🎨 필지 색칠**: 지도 클릭으로 즉시 색칠 (8색 팔레트)
- **📝 정보 관리**: 소유자, 주소, 연락처, 메모 저장
- **🔍 검색**: 주소/지번으로 필지 검색
- **💾 자동 백업**: 매일 오전 2시 자동 백업
- **📊 실시간 동기화**: 여러 사용자 동시 작업 지원

### 🛠️ 고급 기능  
- **☁️ 클라우드 저장**: Supabase 기반 안전한 데이터 보관
- **📑 엑셀 연동**: 구글 시트 자동 전송
- **🔄 백업/복원**: 수동 백업 및 데이터 복원
- **📱 반응형**: PC/모바일 모두 지원

## 🚀 빠른 시작

### 1️⃣ API 키 설정
다음 파일들에서 API 키를 실제 키로 교체하세요:

**`public/index.html`** (네이버 지도 API):
```html
<script src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=실제키"></script>
```

**`public/js/supabase-manager.js`** (Supabase):
```javascript
this.SUPABASE_URL = 'https://실제프로젝트.supabase.co';
this.SUPABASE_ANON_KEY = '실제키';
```

**`public/js/app-core.js`** (VWorld API):
```javascript
vworldKeys: ['실제키1', '실제키2', ...]
```

### 2️⃣ 로컬 테스트
```bash
node server.js
# http://localhost:3000 접속
```

### 3️⃣ 배포 (Vercel)
1. Vercel 계정 연결
2. GitHub 저장소 Import
3. 자동 배포 완료

## 📋 필수 요구사항

### API 서비스
- **네이버 클라우드 플랫폼**: 지도 API
- **VWorld**: 필지 데이터 API  
- **Supabase**: 데이터베이스 (Pro 플랜 권장)

### 개발 환경
- Node.js 16+
- 모던 브라우저 (Chrome, Firefox, Safari, Edge)

## 💰 운영 비용

- **Supabase Pro**: $25/월 (필수)
- **Vercel Pro**: $20/월 (선택)
- **네이버/VWorld API**: 무료
- **총 최소 비용**: $25/월

## 📖 상세 설정 가이드

전체 설정 과정은 **`CUSTOMER-SETUP-GUIDE.md`** 파일을 참조하세요.

## 🎨 사용 방법

### 기본 조작
- **왼쪽 클릭**: 필지 색칠
- **오른쪽 클릭**: 색상 제거
- **색상 변경**: 좌측 팔레트 클릭
- **정보 저장**: 필지 선택 → 정보 입력 → 저장

### 고급 기능
- **검색 모드**: 상단 "검색 ON/OFF" 토글
- **색칠 모드**: 좌측 "색칠 ON/OFF" 토글  
- **백업**: 상단 백업 버튼 → 수동 백업
- **복원**: 백업 패널 → 복원하기

## 🔧 기술 스택

### Frontend
- **Vanilla JavaScript** (프레임워크 없음)
- **네이버 지도 API v3**
- **Supabase JavaScript Client**

### Backend  
- **Node.js + Express**
- **Supabase PostgreSQL**
- **PostGIS** (지리 데이터)

### 배포
- **Vercel** (Frontend)
- **Supabase** (Database)

## 🆘 문제 해결

### 자주 묻는 질문

**Q: 지도가 안 보여요**
A: 네이버 지도 API 키를 확인하세요.

**Q: 색칠이 안 돼요**  
A: VWorld API 키와 해당 지역 필지 데이터를 확인하세요.

**Q: 데이터가 안 저장돼요**
A: Supabase 연결과 데이터베이스 설정을 확인하세요.

### 디버깅
브라우저 개발자 도구(F12) → Console에서 오류 메시지 확인

## 📞 지원

### 기술 지원 (30일)
- 초기 설정 지원
- 기본 사용법 교육
- 기술 문의 대응

설정 중 문제가 있으면 다음 정보와 함께 연락주세요:
- 문제 발생 단계
- 브라우저 콘솔 오류 메시지
- 사용 환경 (브라우저, OS)

---

⭐ **완성된 전문 필지 관리 시스템을 경험해보세요!** ⭐