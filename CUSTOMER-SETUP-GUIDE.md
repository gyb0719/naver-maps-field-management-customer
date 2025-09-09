# 🗺️ 네이버 지도 필지 관리 프로그램 - 고객 설정 가이드

## 📋 준비 사항
- [x] GitHub 계정 (코드 다운로드용)
- [x] Supabase 계정 (데이터베이스용)  
- [x] Vercel 계정 (웹사이트 배포용)
- [x] 네이버 클라우드 플랫폼 계정 (지도 API용)
- [x] VWorld API 키 (필지 데이터용)

## 🚀 1단계: 소스코드 다운로드

### GitHub에서 소스코드 받기
```bash
# 1. 제공받은 GitHub 저장소 URL 접속
# 2. 초록색 "Code" 버튼 → "Download ZIP" 클릭
# 3. 압축 해제 후 프로젝트 폴더 확인
```

## ☁️ 2단계: Supabase 데이터베이스 설정

### 2-1. Supabase 프로젝트 생성
1. **https://supabase.com** 접속 → 회원가입/로그인
2. **"New Project"** 클릭
3. **Project Name**: `필지관리-데이터베이스`
4. **Database Password**: 강력한 비밀번호 설정 (기록해두세요!)
5. **Region**: `Asia Northeast (Seoul)` 선택
6. **"Create new project"** 클릭 → 2-3분 대기

### 2-2. 데이터베이스 테이블 생성
1. Supabase 대시보드에서 **"SQL Editor"** 클릭
2. `db/setup-complete.sql` 파일의 모든 내용을 복사
3. SQL Editor에 붙여넣기 후 **"Run"** 클릭
4. ✅ 성공 메시지 확인

### 2-3. API 키 복사
1. **Settings** → **API** 메뉴 이동  
2. **Project URL** 복사 (예: `https://abcdefg.supabase.co`)
3. **anon public key** 복사 (매우 긴 문자열)

## 🌍 3단계: API 키 설정

### 3-1. 네이버 지도 API 키 발급
1. **https://www.ncloud.com** 접속 → 회원가입/로그인
2. **콘솔** → **AI·Application Service** → **Maps**
3. **Application 등록** → 웹 서비스 URL 입력
4. **Client ID** 복사

### 3-2. VWorld API 키 발급 (필지 데이터용)
1. **https://www.vworld.kr** 접속 → 회원가입/로그인  
2. **오픈API** → **인증키 신청**
3. **서비스명**: `필지관리프로그램`
4. **API 키** 발급받기 (여러개 신청 권장)

### 3-3. 소스코드에 API 키 설정
**`public/js/supabase-manager.js`** 파일 수정:
```javascript
// 9-10번째 줄 수정
this.SUPABASE_URL = 'https://여러분의프로젝트ID.supabase.co';
this.SUPABASE_ANON_KEY = '여러분의_Anonymous_Key를_여기에_붙여넣기';
```

**`public/index.html`** 파일 수정:
```html  
<!-- 12번째 줄 수정 -->
<script type="text/javascript" src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=여러분의네이버지도키&submodules=geocoder,panorama"></script>
```

**`public/js/app-core.js`** 파일 수정:
```javascript
// 36-42번째 줄 - VWorld API 키들 교체
vworldKeys: [
    '여러분의_VWorld_키1',
    '여러분의_VWorld_키2', 
    '여러분의_VWorld_키3',
    '여러분의_VWorld_키4',
    '여러분의_VWorld_키5'
]
```

## 🌐 4단계: 웹사이트 배포 (Vercel)

### 4-1. Vercel 계정 생성 및 배포
1. **https://vercel.com** 접속 → GitHub 계정으로 로그인
2. **"New Project"** 클릭
3. **Import Git Repository** → GitHub 저장소 선택
4. **Project Name**: `필지관리프로그램`
5. **"Deploy"** 클릭 → 2-3분 대기
6. ✅ 배포 완료! URL 복사 (예: `https://프로젝트명.vercel.app`)

### 4-2. 환경변수 설정 (선택사항)
1. Vercel 대시보드 → **Settings** → **Environment Variables**
2. 필요시 추가 환경변수 설정

## ✅ 5단계: 최종 테스트

### 필수 확인 사항
1. **웹사이트 접속**: Vercel URL로 접속 확인
2. **지도 로드**: 네이버 지도가 정상 표시되는지 확인
3. **색칠 기능**: 지도 왼쪽 클릭 → 빨간색 색칠 확인
4. **삭제 기능**: 지도 우클릭 → 색칠 제거 확인
5. **정보 저장**: 필지 클릭 → 정보 입력 → 저장 버튼 확인
6. **새로고침**: 페이지 새로고침 후 색칠 유지 확인

## 💰 예상 비용 (월간)
- **Supabase Pro**: $25/월 (대용량 데이터베이스)
- **Vercel Pro**: $20/월 (고성능 웹호스팅) - 선택사항
- **네이버 클라우드**: 무료 (월 100만 건 API 호출)
- **VWorld API**: 무료
- **총 최소 비용**: $25/월

## 🆘 문제 해결

### 지도가 안 보여요
- 네이버 지도 API 키 확인
- 브라우저 콘솔에서 오류 메시지 확인

### 색칠이 안 돼요
- VWorld API 키 확인
- 해당 지역에 필지 데이터가 있는지 확인

### 데이터가 안 저장돼요
- Supabase URL과 API 키 확인
- 브라우저 개발자 도구에서 네트워크 오류 확인

## 📞 기술 지원
설정 중 문제가 생기면 다음 정보와 함께 연락주세요:
- 어떤 단계에서 문제가 생겼는지
- 브라우저 콘솔의 오류 메시지 스크린샷
- 사용 중인 브라우저와 운영체제

---

🎉 **설정 완료 후 24시간 이내에 테스트를 완료해주세요!**