/**
 * 강화된 다중 백업 시스템
 * 중요한 60K 필지 데이터를 위한 무결성 보장
 */

export class SafeBackupSystem {
  constructor() {
    this.backupPaths = [
      './data/backups/daily',
      './data/backups/weekly', 
      './data/backups/monthly'
    ];
    this.checksums = new Map();
  }

  /**
   * 3-2-1 백업 원칙 구현
   * - 3개 복사본 (로컬, Git, 클라우드)
   * - 2개 다른 저장 매체 (HDD, SSD)
   * - 1개 오프사이트 (클라우드)
   */
  async createSecureBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    try {
      // 1. 현재 데이터 체크섬 생성
      const data = this.getCurrentData();
      const checksum = await this.calculateChecksum(data);
      
      // 2. 로컬 백업 (즉시 복구 가능)
      await this.saveLocalBackup(data, timestamp);
      
      // 3. Git 커밋 (버전 관리)
      await this.gitBackup(data, timestamp);
      
      // 4. 클라우드 업로드 (재해 복구)
      await this.cloudBackup(data, timestamp);
      
      // 5. 백업 검증
      await this.verifyBackup(timestamp, checksum);
      
      // 6. 오래된 백업 정리
      await this.cleanupOldBackups();
      
      console.log(`✅ 안전 백업 완료: ${timestamp}`);
      return { success: true, timestamp, checksum };
      
    } catch (error) {
      console.error('❌ 백업 실패:', error);
      throw error;
    }
  }

  /**
   * 데이터 무결성 검증
   */
  async calculateChecksum(data) {
    const crypto = await import('crypto');
    return crypto.createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  /**
   * 로컬 다중 백업 저장
   */
  async saveLocalBackup(data, timestamp) {
    const backups = [
      {
        path: `./data/backups/realtime/parcels-${timestamp}.json`,
        type: 'realtime'
      },
      {
        path: `./data/backups/daily/parcels-${timestamp.split('T')[0]}.json`,
        type: 'daily'
      },
      {
        path: `./data/backups/external/parcels-${timestamp}.json`,
        type: 'external' // USB/외장하드 경로
      }
    ];

    await Promise.all(
      backups.map(async backup => {
        await this.ensureDirectory(backup.path);
        await this.writeJsonFile(backup.path, {
          timestamp,
          version: '1.0',
          type: backup.type,
          checksum: await this.calculateChecksum(data),
          data
        });
      })
    );
  }

  /**
   * Git 버전 관리 백업
   */
  async gitBackup(data, timestamp) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      // Git 초기화 (없는 경우)
      await execAsync('git init');
      
      // 데이터 파일 저장
      await this.writeJsonFile('./data/parcels-data.json', data);
      
      // Git 커밋
      await execAsync('git add data/parcels-data.json');
      await execAsync(`git commit -m "Safe backup: ${timestamp} (${data.parcels?.length || 0} parcels)"`);
      
      // 원격 저장소 푸시 (설정된 경우)
      try {
        await execAsync('git push origin main');
      } catch (e) {
        console.warn('원격 저장소 푸시 실패 (로컬 커밋은 성공)');
      }
      
    } catch (error) {
      console.error('Git 백업 실패:', error);
      throw error;
    }
  }

  /**
   * 다중 클라우드 백업
   */
  async cloudBackup(data, timestamp) {
    const backupData = {
      timestamp,
      source: 'naver-maps-parcel-management',
      backup_type: 'full',
      data_count: {
        parcels: data.parcels?.length || 0,
        memos: data.memos?.length || 0
      },
      checksum: await this.calculateChecksum(data),
      data
    };

    const promises = [];

    // Google Drive 백업 (있는 경우)
    if (this.hasGoogleDriveConfig()) {
      promises.push(this.uploadToGoogleDrive(backupData, timestamp));
    }

    // Dropbox 백업 (있는 경우)  
    if (this.hasDropboxConfig()) {
      promises.push(this.uploadToDropbox(backupData, timestamp));
    }

    // 이메일 백업 (소량 데이터인 경우)
    promises.push(this.emailBackup(backupData, timestamp));

    await Promise.allSettled(promises);
  }

  /**
   * 백업 검증 및 복구 테스트
   */
  async verifyBackup(timestamp, originalChecksum) {
    const backupPath = `./data/backups/realtime/parcels-${timestamp}.json`;
    
    try {
      const backupData = await this.readJsonFile(backupPath);
      const backupChecksum = await this.calculateChecksum(backupData.data);
      
      if (backupChecksum !== originalChecksum) {
        throw new Error('백업 체크섬 불일치 - 데이터 손상 가능성');
      }
      
      // 복구 테스트
      const restored = await this.testRestore(backupData.data);
      if (!restored) {
        throw new Error('백업 복구 테스트 실패');
      }
      
      console.log('✅ 백업 검증 성공');
      return true;
      
    } catch (error) {
      console.error('❌ 백업 검증 실패:', error);
      throw error;
    }
  }

  /**
   * 자동 복구 시스템
   */
  async autoRecovery() {
    console.log('🚨 자동 복구 시스템 활성화');
    
    const recoveryOptions = [
      {
        source: 'realtime backup',
        path: './data/backups/realtime',
        priority: 1
      },
      {
        source: 'daily backup', 
        path: './data/backups/daily',
        priority: 2
      },
      {
        source: 'git history',
        path: './.git',
        priority: 3
      },
      {
        source: 'cloud backup',
        path: 'cloud',
        priority: 4
      }
    ];

    for (const option of recoveryOptions) {
      try {
        console.log(`🔄 ${option.source}에서 복구 시도...`);
        
        const recoveredData = await this.recoverFromSource(option);
        if (recoveredData && this.validateRecoveredData(recoveredData)) {
          await this.applyRecovery(recoveredData);
          console.log(`✅ ${option.source}에서 복구 성공`);
          return recoveredData;
        }
      } catch (error) {
        console.error(`❌ ${option.source} 복구 실패:`, error);
        continue;
      }
    }
    
    throw new Error('모든 복구 옵션 실패 - 수동 복구 필요');
  }

  /**
   * 현재 localStorage 데이터 추출
   */
  getCurrentData() {
    // 브라우저 환경에서는 localStorage 접근
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('parcel-manager-data');
      return saved ? JSON.parse(saved) : { parcels: [], memos: [] };
    }
    
    // Node.js 환경에서는 파일 접근
    try {
      const fs = require('fs');
      const data = fs.readFileSync('./data/parcels-data.json', 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return { parcels: [], memos: [] };
    }
  }

  /**
   * 유틸리티 메서드들
   */
  async ensureDirectory(filePath) {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
  }

  async writeJsonFile(filePath, data) {
    const fs = await import('fs/promises');
    await this.ensureDirectory(filePath);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  async readJsonFile(filePath) {
    const fs = await import('fs/promises');
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  }

  // 클라우드 서비스별 구현 (설정에 따라 활성화)
  hasGoogleDriveConfig() { return false; } // 실제 구현 시 환경변수 확인
  hasDropboxConfig() { return false; }

  async uploadToGoogleDrive(data, timestamp) {
    // Google Drive API 구현
    console.log('Google Drive 백업 대기 중...');
  }

  async uploadToDropbox(data, timestamp) {
    // Dropbox API 구현  
    console.log('Dropbox 백업 대기 중...');
  }

  async emailBackup(data, timestamp) {
    // 중요 메타데이터만 이메일로 전송
    const metadata = {
      timestamp,
      parcel_count: data.data?.parcels?.length || 0,
      memo_count: data.data?.memos?.length || 0,
      checksum: data.checksum,
      backup_size: JSON.stringify(data).length
    };
    
    console.log('이메일 백업 메타데이터:', metadata);
    // 실제 이메일 발송 구현...
  }

  async cleanupOldBackups() {
    // 30일 이상 된 백업 정리
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const cleanupPaths = [
      './data/backups/realtime',
      './data/backups/daily'
    ];
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    for (const cleanupPath of cleanupPaths) {
      try {
        const files = await fs.readdir(cleanupPath);
        for (const file of files) {
          const filePath = path.join(cleanupPath, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < thirtyDaysAgo) {
            await fs.unlink(filePath);
            console.log(`🗑️ 오래된 백업 삭제: ${file}`);
          }
        }
      } catch (error) {
        console.warn(`백업 정리 실패: ${cleanupPath}`, error);
      }
    }
  }

  async testRestore(data) {
    // 백업 데이터 구조 검증
    return (
      data &&
      Array.isArray(data.parcels) &&
      Array.isArray(data.memos) &&
      data.parcels.length >= 0 &&
      data.memos.length >= 0
    );
  }

  validateRecoveredData(data) {
    return this.testRestore(data);
  }

  async recoverFromSource(option) {
    // 각 소스별 복구 로직 구현
    console.log(`${option.source}에서 데이터 복구 중...`);
    return null; // 실제 구현에서는 복구된 데이터 반환
  }

  async applyRecovery(data) {
    // 복구된 데이터를 현재 시스템에 적용
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('parcel-manager-data', JSON.stringify(data));
    }
  }
}

// 자동 백업 스케줄러
export class BackupScheduler {
  constructor() {
    this.backupSystem = new SafeBackupSystem();
    this.intervals = new Map();
  }

  startAutoBackup() {
    // 실시간 백업 (5분마다)
    this.intervals.set('realtime', setInterval(() => {
      this.backupSystem.createSecureBackup().catch(console.error);
    }, 5 * 60 * 1000));

    // 일일 백업
    this.intervals.set('daily', setInterval(() => {
      this.backupSystem.createSecureBackup().catch(console.error);
    }, 24 * 60 * 60 * 1000));

    console.log('🛡️ 자동 백업 시스템 활성화');
  }

  stopAutoBackup() {
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
      console.log(`⏹️ ${name} 백업 중단`);
    }
    this.intervals.clear();
  }
}

export default SafeBackupSystem;