/**
 * 안전한 데이터 마이그레이션 시스템
 * 60K 필지 + 30K 메모를 위한 트랜잭션 기반 무결성 보장
 */

import { supabase, TABLES } from '../lib/supabase.js';

export class SafeMigrationSystem {
  constructor() {
    this.SAFE_BATCH_SIZE = 5; // 메모리 안전을 위해 극도로 작게
    this.MAX_RETRIES = 5;
    this.CHECKPOINT_INTERVAL = 10; // 10개 배치마다 체크포인트
    
    this.migrationId = `migration_${Date.now()}`;
    this.checkpoints = [];
    this.failedItems = [];
    this.validatedData = null;
  }

  /**
   * 1단계: 마이그레이션 전 완전한 검증
   */
  async validateAllData() {
    console.log('🔍 데이터 검증 시작...');
    
    const localData = this.extractLocalStorageData();
    const validationReport = {
      totalParcels: localData.parcels.length,
      totalMemos: localData.memos.length,
      validParcels: 0,
      validMemos: 0,
      errors: []
    };

    // 필지 검증
    for (let i = 0; i < localData.parcels.length; i++) {
      try {
        await this.validateParcel(localData.parcels[i], i);
        validationReport.validParcels++;
      } catch (error) {
        validationReport.errors.push({
          type: 'parcel',
          index: i,
          error: error.message,
          data: localData.parcels[i]
        });
      }
    }

    // 메모 검증
    for (let i = 0; i < localData.memos.length; i++) {
      try {
        await this.validateMemo(localData.memos[i], localData.parcels, i);
        validationReport.validMemos++;
      } catch (error) {
        validationReport.errors.push({
          type: 'memo',
          index: i,
          error: error.message,
          data: localData.memos[i]
        });
      }
    }

    console.log('📊 검증 결과:', validationReport);

    // 치명적 오류가 있으면 중단
    if (validationReport.errors.length > localData.parcels.length * 0.1) {
      throw new Error(`검증 실패: ${validationReport.errors.length}개 오류 (허용 한계 초과)`);
    }

    this.validatedData = {
      ...localData,
      validationReport
    };

    return validationReport;
  }

  /**
   * 개별 필지 검증
   */
  async validateParcel(parcel, index) {
    const errors = [];

    // 필수 필드 검증
    if (!parcel.pnu || parcel.pnu.includes('temp_')) {
      errors.push('유효하지 않은 PNU');
    }

    if (!parcel.coordinates || !Array.isArray(parcel.coordinates) || parcel.coordinates.length < 3) {
      errors.push('좌표 데이터 부족');
    }

    // 좌표 유효성 검증
    if (parcel.coordinates) {
      for (const coord of parcel.coordinates) {
        if (!coord.lat || !coord.lng || 
            coord.lat < 33 || coord.lat > 39 || 
            coord.lng < 124 || coord.lng > 132) {
          errors.push('한국 영토 밖 좌표');
          break;
        }
      }
    }

    // 면적 검증
    if (parcel.area && (parcel.area < 0 || parcel.area > 1000000)) {
      errors.push('비정상적인 면적 값');
    }

    // PostGIS geometry 변환 테스트
    try {
      const geometry = this.coordinatesToPostGIS(parcel.coordinates);
      if (!geometry) {
        errors.push('PostGIS geometry 변환 실패');
      }
    } catch (error) {
      errors.push(`Geometry 오류: ${error.message}`);
    }

    if (errors.length > 0) {
      throw new ValidationError(`필지 #${index} 검증 실패: ${errors.join(', ')}`, errors);
    }

    return true;
  }

  /**
   * 개별 메모 검증
   */
  async validateMemo(memo, parcels, index) {
    const errors = [];

    if (!memo.content || memo.content.trim().length === 0) {
      errors.push('빈 메모 내용');
    }

    if (!memo.pnu) {
      errors.push('메모와 연결된 PNU 없음');
    }

    // 연결된 필지 존재 확인
    const linkedParcel = parcels.find(p => p.pnu === memo.pnu);
    if (!linkedParcel) {
      errors.push('연결된 필지를 찾을 수 없음');
    }

    if (errors.length > 0) {
      throw new ValidationError(`메모 #${index} 검증 실패: ${errors.join(', ')}`, errors);
    }

    return true;
  }

  /**
   * 2단계: 완전 백업 생성
   */
  async createFullBackup() {
    console.log('💾 완전 백업 생성 중...');

    const backup = {
      migrationId: this.migrationId,
      timestamp: new Date().toISOString(),
      type: 'pre-migration-full',
      localStorage: this.extractLocalStorageData(),
      supabaseSnapshot: await this.exportCurrentSupabaseData(),
      validation: this.validatedData?.validationReport
    };

    // IndexedDB에 백업 저장 (localStorage 용량 한계 회피)
    await this.storeInIndexedDB(`backup_${this.migrationId}`, backup);

    // JSON 파일로도 내보내기
    this.downloadBackupFile(backup);

    console.log('✅ 백업 완료');
    return backup;
  }

  /**
   * 3단계: 트랜잭션 기반 안전한 마이그레이션
   */
  async executeSecureMigration(onProgress) {
    console.log('🚀 안전한 마이그레이션 시작');

    try {
      // 사전 검증
      if (!this.validatedData) {
        await this.validateAllData();
      }

      // 백업 생성
      await this.createFullBackup();

      // Supabase 연결 상태 확인
      await this.verifySupabaseConnection();

      // 필지 마이그레이션
      const parcelResult = await this.migrateParcelsSafely(onProgress);
      
      // 메모 마이그레이션 (필지 완료 후)
      const memoResult = await this.migrateMemosSafely(onProgress);

      // 최종 검증
      await this.verifyMigrationIntegrity();

      console.log('🎉 마이그레이션 성공 완료');
      return {
        success: true,
        parcels: parcelResult,
        memos: memoResult,
        migrationId: this.migrationId
      };

    } catch (error) {
      console.error('🚨 마이그레이션 실패:', error);
      await this.emergencyRollback();
      throw error;
    }
  }

  /**
   * 트랜잭션 기반 필지 마이그레이션
   */
  async migrateParcelsSafely(onProgress) {
    const parcels = this.validatedData.parcels;
    const batches = this.createBatches(parcels, this.SAFE_BATCH_SIZE);
    
    let successCount = 0;
    let checkpointCounter = 0;

    console.log(`📦 필지 배치 처리 시작: ${batches.length}개 배치`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      let retryCount = 0;

      while (retryCount < this.MAX_RETRIES) {
        try {
          // 네트워크 상태 확인
          await this.checkNetworkStability();

          // 트랜잭션 시작
          const batchResult = await this.executeBatchTransaction(batch, 'parcels');
          
          successCount += batchResult.count;
          checkpointCounter++;

          // 체크포인트 저장
          if (checkpointCounter >= this.CHECKPOINT_INTERVAL) {
            await this.saveCheckpoint({
              type: 'parcels',
              batchIndex: i,
              successCount,
              timestamp: new Date().toISOString()
            });
            checkpointCounter = 0;
          }

          // 진행률 업데이트
          onProgress?.({
            type: 'parcels',
            progress: Math.round(((i + 1) / batches.length) * 100),
            processed: successCount,
            total: parcels.length,
            currentBatch: i + 1,
            totalBatches: batches.length
          });

          break; // 성공 시 재시도 루프 탈출

        } catch (error) {
          retryCount++;
          console.warn(`배치 ${i + 1} 재시도 ${retryCount}/${this.MAX_RETRIES}:`, error.message);

          if (retryCount >= this.MAX_RETRIES) {
            // 실패한 배치 저장
            await this.saveFailedBatch(batch, error, 'parcels');
            throw new Error(`배치 ${i + 1} 최종 실패: ${error.message}`);
          }

          // 지수 백오프로 재시도 대기
          await this.delay(Math.pow(2, retryCount) * 1000);
        }
      }

      // 메모리 부담 완화를 위한 딜레이
      await this.delay(100);
    }

    return { success: successCount, failed: this.failedItems.length };
  }

  /**
   * 단일 배치 트랜잭션 실행
   */
  async executeBatchTransaction(batch, type) {
    // Supabase RPC 함수로 트랜잭션 실행
    const { data, error } = await supabase.rpc('secure_batch_insert', {
      batch_type: type,
      batch_data: batch,
      migration_id: this.migrationId
    });

    if (error) {
      throw new Error(`배치 트랜잭션 실패: ${error.message}`);
    }

    return data;
  }

  /**
   * 메모 안전 마이그레이션
   */
  async migrateMemosSafely(onProgress) {
    console.log('📝 메모 마이그레이션 시작');

    // 저장된 필지의 PNU → ID 매핑 생성
    const parcelMapping = await this.createParcelMapping();

    const memos = this.validatedData.memos;
    const memosWithIds = memos.map(memo => ({
      ...memo,
      parcel_id: parcelMapping[memo.pnu]
    })).filter(memo => memo.parcel_id); // 매핑된 것만

    const batches = this.createBatches(memosWithIds, this.SAFE_BATCH_SIZE);
    let successCount = 0;

    for (let i = 0; i < batches.length; i++) {
      try {
        const result = await this.executeBatchTransaction(batches[i], 'memos');
        successCount += result.count;

        onProgress?.({
          type: 'memos',
          progress: Math.round(((i + 1) / batches.length) * 100),
          processed: successCount,
          total: memosWithIds.length
        });

      } catch (error) {
        await this.saveFailedBatch(batches[i], error, 'memos');
        console.error(`메모 배치 ${i + 1} 실패:`, error);
      }
    }

    return { success: successCount, failed: memos.length - successCount };
  }

  /**
   * 긴급 롤백 시스템
   */
  async emergencyRollback() {
    console.log('🚨 긴급 롤백 시작');

    try {
      // 백업에서 복구
      const backup = await this.getFromIndexedDB(`backup_${this.migrationId}`);
      
      if (!backup) {
        throw new Error('백업을 찾을 수 없습니다');
      }

      // Supabase 데이터 완전 삭제 (마이그레이션 ID 기준)
      await supabase.rpc('emergency_rollback', {
        migration_id: this.migrationId
      });

      // localStorage 복구
      localStorage.setItem('parcel-manager-data', JSON.stringify(backup.localStorage));

      console.log('✅ 롤백 완료');
      return true;

    } catch (error) {
      console.error('❌ 롤백 실패:', error);
      // 수동 복구 안내 표시
      this.showManualRecoveryInstructions();
      throw error;
    }
  }

  /**
   * 마이그레이션 무결성 검증
   */
  async verifyMigrationIntegrity() {
    console.log('🔍 마이그레이션 무결성 검증');

    const localData = this.validatedData;
    
    // Supabase에서 데이터 조회
    const { data: parcels } = await supabase
      .from(TABLES.PARCELS)
      .select('*')
      .eq('migration_id', this.migrationId);

    const { data: memos } = await supabase
      .from(TABLES.MEMOS)
      .select('*')
      .eq('migration_id', this.migrationId);

    // 개수 검증
    const expectedParcels = localData.parcels.length - this.failedItems.filter(i => i.type === 'parcel').length;
    const expectedMemos = localData.memos.length - this.failedItems.filter(i => i.type === 'memo').length;

    if (parcels.length !== expectedParcels) {
      throw new Error(`필지 개수 불일치: 예상 ${expectedParcels}, 실제 ${parcels.length}`);
    }

    if (memos.length !== expectedMemos) {
      throw new Error(`메모 개수 불일치: 예상 ${expectedMemos}, 실제 ${memos.length}`);
    }

    // 샘플 데이터 무결성 검증
    for (let i = 0; i < Math.min(10, parcels.length); i++) {
      const parcel = parcels[i];
      if (!parcel.geometry || !parcel.pnu) {
        throw new Error(`필지 데이터 무결성 오류: ${parcel.id}`);
      }
    }

    console.log('✅ 무결성 검증 완료');
    return true;
  }

  /**
   * 유틸리티 메서드들
   */
  async verifySupabaseConnection() {
    const { error } = await supabase.from(TABLES.PARCELS).select('count').limit(1);
    if (error) {
      throw new Error(`Supabase 연결 실패: ${error.message}`);
    }
  }

  async checkNetworkStability() {
    if (!navigator.onLine) {
      throw new Error('네트워크 연결 없음');
    }
    
    // 간단한 핑 테스트
    try {
      const start = Date.now();
      await supabase.rpc('ping');
      const latency = Date.now() - start;
      
      if (latency > 5000) {
        throw new Error('네트워크 지연 심각');
      }
    } catch (error) {
      throw new Error('네트워크 불안정');
    }
  }

  extractLocalStorageData() {
    try {
      const saved = localStorage.getItem('parcel-manager-data');
      return saved ? JSON.parse(saved) : { parcels: [], memos: [] };
    } catch (error) {
      throw new Error(`localStorage 데이터 읽기 실패: ${error.message}`);
    }
  }

  coordinatesToPostGIS(coordinates) {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
      return null;
    }

    try {
      const coords = [...coordinates];
      const first = coords[0];
      const last = coords[coords.length - 1];
      
      if (first.lng !== last.lng || first.lat !== last.lat) {
        coords.push(first);
      }

      const wktCoords = coords
        .map(coord => `${coord.lng} ${coord.lat}`)
        .join(', ');
      
      return `POLYGON((${wktCoords}))`;
    } catch (error) {
      throw new Error(`PostGIS 변환 실패: ${error.message}`);
    }
  }

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

  async storeInIndexedDB(key, data) {
    // IndexedDB 구현 (localStorage 용량 한계 회피)
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('parcel-migration', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['backups'], 'readwrite');
        const store = transaction.objectStore('backups');
        
        store.put(data, key);
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('backups');
      };
    });
  }

  async getFromIndexedDB(key) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('parcel-migration', 1);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['backups'], 'readonly');
        const store = transaction.objectStore('backups');
        const getRequest = store.get(key);
        
        getRequest.onsuccess = () => resolve(getRequest.result);
        getRequest.onerror = () => reject(getRequest.error);
      };
    });
  }

  downloadBackupFile(backup) {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parcel-backup-${backup.migrationId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async saveCheckpoint(checkpoint) {
    this.checkpoints.push(checkpoint);
    await this.storeInIndexedDB(`checkpoint_${this.migrationId}`, this.checkpoints);
  }

  async saveFailedBatch(batch, error, type) {
    this.failedItems.push({
      type,
      batch,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }

  async createParcelMapping() {
    const { data } = await supabase
      .from(TABLES.PARCELS)
      .select('id, pnu')
      .eq('migration_id', this.migrationId);
    
    const mapping = {};
    data.forEach(parcel => {
      mapping[parcel.pnu] = parcel.id;
    });
    
    return mapping;
  }

  async exportCurrentSupabaseData() {
    const { data: parcels } = await supabase.from(TABLES.PARCELS).select('*');
    const { data: memos } = await supabase.from(TABLES.MEMOS).select('*');
    return { parcels, memos };
  }

  showManualRecoveryInstructions() {
    console.error(`
    🚨 수동 복구 필요:
    1. IndexedDB에서 backup_${this.migrationId} 조회
    2. localStorage에 데이터 복구
    3. Supabase에서 migration_id='${this.migrationId}' 데이터 삭제
    `);
  }
}

class ValidationError extends Error {
  constructor(message, errors) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export default SafeMigrationSystem;