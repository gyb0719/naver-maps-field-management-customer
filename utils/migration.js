/**
 * localStorage에서 Supabase로 데이터 마이그레이션 유틸리티
 * 60K 필지 + 30K 메모 데이터를 안전하게 이전
 */

import { parcelService } from '../lib/parcelService.js';

export class DataMigration {
  constructor() {
    this.batchSize = 100; // 한 번에 처리할 레코드 수
    this.progressCallback = null;
    this.errors = [];
  }

  /**
   * localStorage에서 필지 데이터 추출
   */
  extractLocalStorageData() {
    try {
      const savedData = localStorage.getItem('parcel-manager-data');
      if (!savedData) {
        console.log('localStorage에 저장된 데이터가 없습니다.');
        return { parcels: [], memos: [] };
      }

      const data = JSON.parse(savedData);
      console.log(`추출된 데이터: 필지 ${data.parcels?.length || 0}개, 메모 ${data.memos?.length || 0}개`);
      
      return {
        parcels: data.parcels || [],
        memos: data.memos || []
      };
    } catch (err) {
      console.error('localStorage 데이터 추출 실패:', err);
      return { parcels: [], memos: [] };
    }
  }

  /**
   * 배치별 필지 데이터 마이그레이션
   */
  async migrateParcels(parcels, onProgress) {
    console.log(`필지 마이그레이션 시작: ${parcels.length}개`);
    
    const batches = this.createBatches(parcels, this.batchSize);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`배치 ${i + 1}/${batches.length} 처리 중... (${batch.length}개)`);

      try {
        await Promise.all(
          batch.map(async (parcel) => {
            try {
              await this.migrateParcel(parcel);
              successCount++;
            } catch (err) {
              errorCount++;
              this.errors.push({
                type: 'parcel',
                data: parcel,
                error: err.message
              });
            }
          })
        );

        // 진행률 업데이트
        const progress = ((i + 1) / batches.length) * 100;
        if (onProgress) {
          onProgress({
            type: 'parcels',
            progress: Math.round(progress),
            success: successCount,
            errors: errorCount,
            total: parcels.length
          });
        }

        // 배치 간 딜레이 (DB 부하 방지)
        if (i < batches.length - 1) {
          await this.delay(500);
        }
      } catch (err) {
        console.error(`배치 ${i + 1} 처리 실패:`, err);
      }
    }

    console.log(`필지 마이그레이션 완료: 성공 ${successCount}개, 실패 ${errorCount}개`);
    return { success: successCount, errors: errorCount };
  }

  /**
   * 개별 필지 마이그레이션
   */
  async migrateParcel(localParcel) {
    try {
      // localStorage 형식을 Supabase 형식으로 변환
      const parcelData = {
        pnu: localParcel.pnu || `temp_${Date.now()}_${Math.random()}`,
        coordinates: localParcel.coordinates || [],
        centerLat: localParcel.lat || 37.5665,
        centerLng: localParcel.lng || 126.9780,
        address: localParcel.address || '',
        jibun: localParcel.jibun || '',
        area: localParcel.area || 0,
        color: localParcel.color || 'red',
        ownerName: localParcel.ownerName || localParcel.owner || '',
        rawVworldData: localParcel.rawData || {}
      };

      await parcelService.saveParcel(parcelData);
    } catch (err) {
      console.error('필지 마이그레이션 실패:', localParcel.pnu, err);
      throw err;
    }
  }

  /**
   * 배치별 메모 데이터 마이그레이션
   */
  async migrateMemos(memos, onProgress) {
    console.log(`메모 마이그레이션 시작: ${memos.length}개`);
    
    const batches = this.createBatches(memos, this.batchSize);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`메모 배치 ${i + 1}/${batches.length} 처리 중... (${batch.length}개)`);

      try {
        await Promise.all(
          batch.map(async (memo) => {
            try {
              await this.migrateMemo(memo);
              successCount++;
            } catch (err) {
              errorCount++;
              this.errors.push({
                type: 'memo',
                data: memo,
                error: err.message
              });
            }
          })
        );

        // 진행률 업데이트
        const progress = ((i + 1) / batches.length) * 100;
        if (onProgress) {
          onProgress({
            type: 'memos',
            progress: Math.round(progress),
            success: successCount,
            errors: errorCount,
            total: memos.length
          });
        }

        // 배치 간 딜레이
        if (i < batches.length - 1) {
          await this.delay(300);
        }
      } catch (err) {
        console.error(`메모 배치 ${i + 1} 처리 실패:`, err);
      }
    }

    console.log(`메모 마이그레이션 완료: 성공 ${successCount}개, 실패 ${errorCount}개`);
    return { success: successCount, errors: errorCount };
  }

  /**
   * 개별 메모 마이그레이션
   */
  async migrateMemo(localMemo) {
    try {
      // PNU로 필지 ID 찾기
      const parcel = await parcelService.getParcelByPnu(localMemo.pnu);
      if (!parcel) {
        throw new Error(`필지를 찾을 수 없음: ${localMemo.pnu}`);
      }

      await parcelService.addMemo(parcel.id, localMemo.content || localMemo.memo || '');
    } catch (err) {
      console.error('메모 마이그레이션 실패:', localMemo, err);
      throw err;
    }
  }

  /**
   * 전체 마이그레이션 실행
   */
  async runMigration(onProgress) {
    console.log('=== 데이터 마이그레이션 시작 ===');
    this.errors = [];

    try {
      // 1. localStorage 데이터 추출
      const localData = this.extractLocalStorageData();
      if (localData.parcels.length === 0) {
        console.log('마이그레이션할 데이터가 없습니다.');
        return { success: true, message: '마이그레이션할 데이터가 없습니다.' };
      }

      // 2. 필지 데이터 마이그레이션
      const parcelResult = await this.migrateParcels(localData.parcels, onProgress);

      // 3. 메모 데이터 마이그레이션 (필지 마이그레이션 완료 후)
      const memoResult = await this.migrateMemos(localData.memos, onProgress);

      // 4. 결과 요약
      const summary = {
        success: true,
        parcels: parcelResult,
        memos: memoResult,
        totalErrors: this.errors.length,
        errors: this.errors
      };

      console.log('=== 마이그레이션 완료 ===');
      console.log('결과 요약:', summary);

      return summary;
    } catch (err) {
      console.error('마이그레이션 실패:', err);
      return {
        success: false,
        error: err.message,
        errors: this.errors
      };
    }
  }

  /**
   * 백업 생성 (마이그레이션 전)
   */
  createBackup() {
    try {
      const localData = this.extractLocalStorageData();
      const backup = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        data: localData
      };

      // 백업 파일 다운로드
      const blob = new Blob([JSON.stringify(backup, null, 2)], { 
        type: 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `parcel-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('백업 파일 생성 완료');
      return true;
    } catch (err) {
      console.error('백업 생성 실패:', err);
      return false;
    }
  }

  /**
   * 마이그레이션 상태 검증
   */
  async validateMigration() {
    try {
      const localData = this.extractLocalStorageData();
      const supabaseData = await parcelService.getAllParcels(10000);

      console.log(`로컬 데이터: ${localData.parcels.length}개`);
      console.log(`Supabase 데이터: ${supabaseData.length}개`);

      const validation = {
        local_count: localData.parcels.length,
        supabase_count: supabaseData.length,
        migration_complete: supabaseData.length >= localData.parcels.length * 0.9, // 90% 이상 성공 시 완료
        sample_pnus: supabaseData.slice(0, 5).map(p => p.pnu)
      };

      console.log('마이그레이션 검증 결과:', validation);
      return validation;
    } catch (err) {
      console.error('마이그레이션 검증 실패:', err);
      return { error: err.message };
    }
  }

  /**
   * 유틸리티 메서드들
   */
  createBatches(array, size) {
    const batches = [];
    for (let i = 0; i < array.length; i += size) {
      batches.push(array.slice(i, i + size));
    }
    return batches;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 오류 리포트 내보내기
   */
  exportErrorReport() {
    if (this.errors.length === 0) {
      console.log('오류가 없습니다.');
      return;
    }

    const report = {
      timestamp: new Date().toISOString(),
      total_errors: this.errors.length,
      errors: this.errors
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `migration-errors-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// 싱글톤 인스턴스
export const dataMigration = new DataMigration();
export default dataMigration;