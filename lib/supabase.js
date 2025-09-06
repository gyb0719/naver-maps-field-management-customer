/**
 * Supabase 클라이언트 설정
 * 네이버 지도 필지 관리 프로그램용 데이터베이스 연결
 */

import { createClient } from '@supabase/supabase-js';

// 환경변수에서 Supabase 설정 가져오기
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// Supabase 클라이언트 생성
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// 데이터베이스 테이블 타입 정의
export const TABLES = {
  PARCELS: 'parcels',
  MEMOS: 'memos'
};

// 필지 데이터 타입
export const ParcelSchema = {
  id: 'uuid',
  pnu: 'text',
  geometry: 'geometry',
  location: 'point', 
  color: 'text',
  address: 'text',
  jibun: 'text',
  area: 'decimal',
  owner_name: 'text',
  created_at: 'timestamptz',
  updated_at: 'timestamptz'
};

// 메모 데이터 타입
export const MemoSchema = {
  id: 'uuid',
  parcel_id: 'uuid',
  content: 'text',
  created_at: 'timestamptz'
};

// 데이터베이스 연결 상태 확인
export const checkConnection = async () => {
  try {
    const { data, error } = await supabase
      .from(TABLES.PARCELS)
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('Supabase 연결 오류:', error);
      return false;
    }
    
    console.log('Supabase 연결 성공');
    return true;
  } catch (err) {
    console.error('Supabase 연결 실패:', err);
    return false;
  }
};

export default supabase;