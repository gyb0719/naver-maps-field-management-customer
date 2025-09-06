# 🌥️ Supabase 클라우드 동기화 설정 가이드

네이버 지도 필지 관리 프로그램에서 클라우드 동기화 기능을 사용하기 위한 완전한 설정 가이드입니다.

## 📋 목차

1. [Supabase 프로젝트 생성](#supabase-프로젝트-생성)
2. [데이터베이스 설정](#데이터베이스-설정)
3. [API 키 설정](#api-키-설정)
4. [설정 완료 확인](#설정-완료-확인)
5. [문제 해결](#문제-해결)

## 🚀 Supabase 프로젝트 생성

### 1. Supabase 계정 생성
1. [Supabase 웹사이트](https://supabase.com) 방문
2. **Sign Up** 클릭하여 계정 생성
3. 이메일 인증 완료

### 2. 새 프로젝트 생성
1. 대시보드에서 **New Project** 클릭
2. 프로젝트 정보 입력:
   - **Name**: `naver-maps-parcels`
   - **Database Password**: 강력한 비밀번호 설정 (저장해 두세요!)
   - **Region**: `Northeast Asia (Seoul)` 권장
3. **Create new project** 클릭
4. 프로젝트 생성 완료까지 1-2분 대기

## 🗄️ 데이터베이스 설정

### 1. SQL Editor 접속
1. Supabase 프로젝트 대시보드에서 **SQL Editor** 메뉴 클릭
2. 새로운 쿼리 탭 생성

### 2. 설정 스크립트 실행

**중요**: 반드시 `db/setup-complete.sql` 파일의 전체 내용을 복사하여 실행하세요.

```sql
-- 1. 파일 위치: db/setup-complete.sql
-- 2. 전체 내용 복사 (327줄)
-- 3. SQL Editor에 붙여넣기
-- 4. "Run" 버튼 클릭
```

### 3. 설정 완료 확인

스크립트 실행 후 다음 메시지들이 나타나야 합니다:

```
✅ Supabase 설정이 완료되었습니다!
✅ 모든 컴포넌트 상태: ok
✅ ping 테스트: 성공
📊 초기 통계 표시
```

## 🔑 API 키 설정

### 1. API 키 확인
1. Supabase 대시보드 → **Settings** → **API** 메뉴
2. 다음 정보 복사:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJ...` (매우 긴 문자열)

### 2. 애플리케이션에 키 설정

`public/js/data-manager.js` 파일에서 다음 부분을 수정:

```javascript
class DataManager {
    constructor() {
        // 여기에 본인의 Supabase 정보 입력
        this.SUPABASE_URL = 'https://본인의프로젝트ID.supabase.co';
        this.SUPABASE_ANON_KEY = '본인의_anon_key_여기에_붙여넣기';
```

## ✅ 설정 완료 확인

### 1. 애플리케이션 재시작
```bash
# 서버 재시작
node server.js
```

### 2. 브라우저에서 확인
1. 애플리케이션 접속 (`http://localhost:3000`)
2. 개발자 도구 콘솔 확인
3. 다음 메시지들 확인:
   ```
   🔍 Supabase 연결 테스트 중...
   ✅ 기본 연결: 성공
   ✅ 데이터베이스 테이블: 존재함
   ✅ 배치 삽입 함수: 존재함
   ✅ 롤백 함수: 존재함
   ✅ 설정 완료 확인 함수: 존재함
   🎉 Supabase 설정 완료 - 모든 검사 통과
   ```

### 3. 동기화 상태 확인
- 우측 상단의 동기화 상태 아이콘이 **초록색**이어야 함
- 필지를 저장하면 콘솔에 `🔄 실시간 동기화 저장 결과` 메시지 출력

## 🔧 문제 해결

### 1. "기본 연결 실패" 오류

**원인**: 잘못된 URL 또는 API 키
**해결**:
1. Supabase 대시보드에서 Project URL과 anon key 재확인
2. `data-manager.js`의 URL과 키가 정확한지 확인
3. URL 끝의 `/` 제거 확인

### 2. "parcels 테이블이 존재하지 않습니다" 오류

**원인**: 데이터베이스 설정 미완료
**해결**:
1. `db/setup-complete.sql` 파일 전체 내용 복사
2. Supabase SQL Editor에서 실행
3. 에러 없이 완료되었는지 확인

### 3. "배치 삽입 함수가 존재하지 않습니다" 오류

**원인**: RPC 함수 생성 실패
**해결**:
1. SQL Editor에서 다음 쿼리로 함수 확인:
   ```sql
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_type = 'FUNCTION' 
   AND routine_name IN ('secure_batch_insert', 'ping', 'emergency_rollback');
   ```
2. 함수가 없다면 `setup-complete.sql` 재실행
3. PostgreSQL 버전 호환성 확인 (Supabase는 PostgreSQL 14+ 사용)

### 4. "PostGIS 확장이 활성화되지 않았습니다" 오류

**원인**: PostGIS 확장 활성화 실패
**해결**:
1. SQL Editor에서 수동 활성화:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE EXTENSION IF NOT EXISTS unaccent;
   ```
2. 권한 부족 시 Supabase 지원팀 문의

### 5. 동기화는 되지만 데이터가 보이지 않는 경우

**해결**:
1. Supabase 대시보드 → **Table Editor** → **parcels** 테이블 확인
2. Row Level Security (RLS) 정책 확인:
   ```sql
   SELECT * FROM parcels LIMIT 5;
   ```
3. 데이터가 있다면 RLS 정책 문제, `setup-complete.sql` 재실행

## 📊 용량 및 제한사항

### Supabase 무료 플랜 제한
- **데이터베이스 크기**: 500MB
- **예상 사용량**: ~77MB (60,000 필지 + 30,000 메모)
- **API 요청**: 월 50,000회
- **동시 연결**: 최대 60개

### 성능 최적화
- 배치 크기: 3-15개 (데이터 크기에 따라 자동 조정)
- 자동 동기화: 2초 디바운싱
- 에러 재시도: 최대 3회 (지수 백오프)
- 캐시: 30초 TTL

## 🔐 보안 참고사항

1. **API 키 보호**: anon key는 클라이언트용이므로 노출되어도 안전하지만, service_role key는 절대 노출 금지
2. **RLS 정책**: 모든 테이블에 Row Level Security 활성화됨
3. **HTTPS**: 모든 통신은 HTTPS로 암호화됨
4. **백업**: 정기적인 Google Sheets 백업 권장

## 📞 추가 지원

설정 중 문제가 발생하면:

1. **콘솔 로그 확인**: 브라우저 개발자 도구에서 자세한 오류 메시지 확인
2. **Supabase 로그 확인**: Supabase 대시보드 → **Logs** 메뉴
3. **GitHub Issues**: [프로젝트 Issues](https://github.com/anthropics/claude-code/issues)에 문의

---

💡 **팁**: 설정 완료 후 처음 동기화할 때는 시간이 걸릴 수 있습니다. 인내심을 갖고 기다려 주세요!