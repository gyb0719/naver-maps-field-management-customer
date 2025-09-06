/**
 * 필지 데이터 서비스 레이어
 * Supabase와 기존 VWorld API를 연동하는 서비스
 */

import { supabase, TABLES } from './supabase.js';

export class ParcelService {
  constructor() {
    this.cache = new Map(); // 메모리 캐시
  }

  /**
   * 필지 정보 저장 (VWorld API 응답 + 사용자 입력)
   */
  async saveParcel(parcelData) {
    try {
      const {
        pnu,
        coordinates, // 폴리곤 좌표 배열
        centerLat,
        centerLng,
        address,
        jibun,
        area,
        color = 'red',
        ownerName = '',
        rawVworldData = {}
      } = parcelData;

      // PostGIS용 geometry 생성
      const geometry = this.coordinatesToPostGIS(coordinates);
      const location = `POINT(${centerLng} ${centerLat})`;

      const { data, error } = await supabase
        .from(TABLES.PARCELS)
        .upsert({
          pnu: pnu,
          address: address,
          jibun: jibun,
          area: parseFloat(area) || 0,
          owner_name: ownerName,
          geometry: geometry,
          location: location,
          color: color,
          raw_data: rawVworldData
        })
        .select()
        .single();

      if (error) {
        console.error('필지 저장 오류:', error);
        throw new Error(`필지 저장 실패: ${error.message}`);
      }

      console.log('필지 저장 성공:', data.pnu);
      return data;
    } catch (err) {
      console.error('saveParcel 오류:', err);
      throw err;
    }
  }

  /**
   * 메모 추가
   */
  async addMemo(parcelId, content) {
    try {
      const { data, error } = await supabase
        .from(TABLES.MEMOS)
        .insert({
          parcel_id: parcelId,
          content: content
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('메모 추가 오류:', err);
      throw err;
    }
  }

  /**
   * PNU로 필지 조회
   */
  async getParcelByPnu(pnu) {
    try {
      const { data, error } = await supabase
        .from('parcels_with_memos')
        .select('*')
        .eq('pnu', pnu)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found는 정상
        throw error;
      }

      return data || null;
    } catch (err) {
      console.error('getParcelByPnu 오류:', err);
      return null;
    }
  }

  /**
   * 좌표로 필지 검색 (클릭 기능)
   */
  async getParcelByCoordinate(lat, lng) {
    try {
      const { data, error } = await supabase
        .rpc('get_parcel_by_point', {
          lng: parseFloat(lng),
          lat: parseFloat(lat)
        });

      if (error) throw error;
      return data[0] || null;
    } catch (err) {
      console.error('getParcelByCoordinate 오류:', err);
      return null;
    }
  }

  /**
   * 경계 박스 내 필지 조회 (지도 뷰포트)
   */
  async getParcelsInBounds(bounds) {
    try {
      const { minLng, minLat, maxLng, maxLat } = bounds;
      
      const { data, error } = await supabase
        .rpc('get_parcels_in_bounds', {
          min_lng: parseFloat(minLng),
          min_lat: parseFloat(minLat),
          max_lng: parseFloat(maxLng),
          max_lat: parseFloat(maxLat)
        });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('getParcelsInBounds 오류:', err);
      return [];
    }
  }

  /**
   * 색상별 필지 조회
   */
  async getParcelsByColor(color) {
    try {
      const { data, error } = await supabase
        .from('parcels_with_memos')
        .select('*')
        .eq('color', color)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('getParcelsByColor 오류:', err);
      return [];
    }
  }

  /**
   * 전체 필지 조회 (관리 패널용)
   */
  async getAllParcels(limit = 1000, offset = 0) {
    try {
      const { data, error } = await supabase
        .from('parcels_with_memos')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('getAllParcels 오류:', err);
      return [];
    }
  }

  /**
   * 필지 색상 변경
   */
  async updateParcelColor(pnu, newColor) {
    try {
      const { data, error } = await supabase
        .from(TABLES.PARCELS)
        .update({ color: newColor })
        .eq('pnu', pnu)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('updateParcelColor 오류:', err);
      throw err;
    }
  }

  /**
   * 필지 삭제 (소프트 삭제)
   */
  async deleteParcel(pnu) {
    try {
      const { data, error } = await supabase
        .from(TABLES.PARCELS)
        .update({ status: 'archived' })
        .eq('pnu', pnu)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('deleteParcel 오류:', err);
      throw err;
    }
  }

  /**
   * 검색 (주소, 지번, 메모 내용)
   */
  async searchParcels(query) {
    try {
      const { data, error } = await supabase
        .from('parcels_with_memos')
        .select('*')
        .or(`address.ilike.%${query}%,jibun.ilike.%${query}%`)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('searchParcels 오류:', err);
      return [];
    }
  }

  /**
   * 통계 조회
   */
  async getStats() {
    try {
      const { data, error } = await supabase
        .from('parcels_stats')
        .select('*');

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('getStats 오류:', err);
      return [];
    }
  }

  /**
   * 좌표 배열을 PostGIS POLYGON 형식으로 변환
   */
  coordinatesToPostGIS(coordinates) {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
      return null;
    }

    try {
      // 첫 번째와 마지막 점이 같은지 확인 (폴리곤 규칙)
      const coords = [...coordinates];
      const first = coords[0];
      const last = coords[coords.length - 1];
      
      if (first.lng !== last.lng || first.lat !== last.lat) {
        coords.push(first); // 폴리곤을 닫음
      }

      // POLYGON WKT 형식으로 변환
      const wktCoords = coords
        .map(coord => `${coord.lng} ${coord.lat}`)
        .join(', ');
      
      return `POLYGON((${wktCoords}))`;
    } catch (err) {
      console.error('좌표 변환 오류:', err);
      return null;
    }
  }

  /**
   * PostGIS geometry를 좌표 배열로 변환
   */
  postGISToCoordinates(geometryGeoJSON) {
    try {
      const geom = JSON.parse(geometryGeoJSON);
      if (geom.type === 'Polygon' && geom.coordinates?.[0]) {
        return geom.coordinates[0].map(([lng, lat]) => ({ lng, lat }));
      }
      return [];
    } catch (err) {
      console.error('PostGIS 좌표 변환 오류:', err);
      return [];
    }
  }

  /**
   * 실시간 업데이트 구독
   */
  subscribeToParcels(callback) {
    const subscription = supabase
      .channel('parcels_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'parcels' 
        }, 
        payload => {
          callback(payload);
        }
      )
      .subscribe();

    return subscription;
  }

  /**
   * 구독 해제
   */
  unsubscribe(subscription) {
    if (subscription) {
      supabase.removeChannel(subscription);
    }
  }
}

// 싱글톤 인스턴스 
export const parcelService = new ParcelService();
export default parcelService;