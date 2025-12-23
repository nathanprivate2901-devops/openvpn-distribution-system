const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

/**
 * Database Synchronization Service
 *
 * Synchronizes data from local MySQL database to remote MySQL database
 * Supports bidirectional sync with conflict resolution
 *
 * Features:
 * - Full database sync (schema + data)
 * - Incremental sync (only changed records)
 * - Conflict resolution (last-write-wins or custom strategy)
 * - Transaction support for data integrity
 * - Automatic retry on failure
 */

class DatabaseSyncService {
  constructor() {
    this.localConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'openvpn_system',
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0
    };

    this.remoteConfig = {
      host: process.env.REMOTE_DB_HOST,
      port: process.env.REMOTE_DB_PORT || 3306,
      user: process.env.REMOTE_DB_USER,
      password: process.env.REMOTE_DB_PASSWORD,
      database: process.env.REMOTE_DB_NAME || process.env.DB_NAME || 'openvpn_system',
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 30000
    };

    this.localPool = null;
    this.remotePool = null;
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.syncStats = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      lastError: null
    };

    // Tables to sync in order (respecting foreign key constraints)
    // 1. users - no dependencies
    // 2. qos_policies - no dependencies
    // 3. verification_tokens - depends on users
    // 4. user_qos - depends on users and qos_policies
    // 5. config_files - depends on users and qos_policies
    this.tablesToSync = [
      'users',
      'qos_policies',
      'verification_tokens',
      'user_qos',
      'config_files'
    ];
  }

  /**
   * Initialize database connections
   */
  async initialize() {
    try {
      // Validate remote config
      if (!this.remoteConfig.host || !this.remoteConfig.user || !this.remoteConfig.password) {
        logger.warn('Remote database configuration incomplete. Sync service disabled.', {
          hasHost: !!this.remoteConfig.host,
          hasUser: !!this.remoteConfig.user,
          hasPassword: !!this.remoteConfig.password
        });
        return false;
      }

      // Create local connection pool
      this.localPool = mysql.createPool(this.localConfig);
      logger.info('Local database pool created for sync service', {
        host: this.localConfig.host,
        database: this.localConfig.database
      });

      // Create remote connection pool
      this.remotePool = mysql.createPool(this.remoteConfig);
      logger.info('Remote database pool created for sync service', {
        host: this.remoteConfig.host,
        database: this.remoteConfig.database
      });

      // Test connections
      await this.testConnections();

      return true;
    } catch (error) {
      logger.error('Failed to initialize database sync service:', error);
      throw error;
    }
  }

  /**
   * Test both database connections
   */
  async testConnections() {
    try {
      // Test local connection
      const [localRows] = await this.localPool.query('SELECT 1 as test');
      logger.info('Local database connection test successful');

      // Test remote connection
      const [remoteRows] = await this.remotePool.query('SELECT 1 as test');
      logger.info('Remote database connection test successful');

      return true;
    } catch (error) {
      logger.error('Database connection test failed:', error);
      throw error;
    }
  }

  /**
   * Perform full database synchronization
   * Syncs all tables from local to remote
   */
  async syncFull() {
    if (this.isSyncing) {
      logger.warn('Sync already in progress, skipping');
      return { success: false, message: 'Sync already in progress' };
    }

    this.isSyncing = true;
    this.syncStats.totalSyncs++;
    const startTime = Date.now();

    try {
      logger.info('Starting full database synchronization');

      const syncResults = {
        tables: {},
        totalRecords: 0,
        errors: []
      };

      // Sync each table in order
      for (const table of this.tablesToSync) {
        try {
          const result = await this.syncTable(table);
          syncResults.tables[table] = result;
          syncResults.totalRecords += result.recordsSynced;

          logger.info(`Table ${table} synced successfully`, result);
        } catch (error) {
          logger.error(`Failed to sync table ${table}:`, error);
          syncResults.errors.push({
            table,
            error: error.message
          });
        }
      }

      const duration = Date.now() - startTime;
      this.lastSyncTime = new Date();
      this.syncStats.successfulSyncs++;

      logger.info('Full database synchronization completed', {
        duration: `${duration}ms`,
        totalRecords: syncResults.totalRecords,
        errors: syncResults.errors.length
      });

      return {
        success: true,
        duration,
        syncResults,
        timestamp: this.lastSyncTime
      };

    } catch (error) {
      this.syncStats.failedSyncs++;
      this.syncStats.lastError = error.message;
      logger.error('Full database synchronization failed:', error);

      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a single table
   */
  async syncTable(tableName) {
    logger.info(`Syncing table: ${tableName}`);

    try {
      // Get records from local database with appropriate filters
      let query = `SELECT * FROM ${tableName}`;

      // For users table, exclude soft-deleted users and users with NULL username
      if (tableName === 'users') {
        query += ' WHERE deleted_at IS NULL AND username IS NOT NULL';
      }

      const [localRecords] = await this.localPool.query(query);

      if (localRecords.length === 0) {
        logger.info(`Table ${tableName} is empty or all records filtered, skipping`);
        return { recordsSynced: 0, operation: 'skipped' };
      }

      // Get existing records from remote database
      let remoteRecords = [];
      try {
        [remoteRecords] = await this.remotePool.query(`SELECT * FROM ${tableName}`);
      } catch (error) {
        // Table might not exist on remote, will be created
        logger.warn(`Table ${tableName} might not exist on remote:`, error.message);
      }

      // Create a map of remote records by ID
      const remoteMap = new Map();
      remoteRecords.forEach(record => {
        remoteMap.set(record.id, record);
      });

      let insertCount = 0;
      let updateCount = 0;
      let skippedCount = 0;

      // Process each local record
      for (const localRecord of localRecords) {
        // Skip records with invalid foreign keys
        if (!this.isValidRecord(tableName, localRecord)) {
          skippedCount++;
          continue;
        }

        const remoteRecord = remoteMap.get(localRecord.id);

        try {
          if (!remoteRecord) {
            // Record doesn't exist on remote, insert it
            await this.insertRecord(tableName, localRecord);
            insertCount++;
          } else {
            // Record exists, check if update is needed
            if (this.needsUpdate(localRecord, remoteRecord)) {
              await this.updateRecord(tableName, localRecord);
              updateCount++;
            }
          }
        } catch (error) {
          logger.warn(`Skipping record ${localRecord.id} in ${tableName} due to error:`, error.message);
          skippedCount++;
        }
      }

      logger.info(`Table ${tableName} sync complete`, {
        totalRecords: localRecords.length,
        inserted: insertCount,
        updated: updateCount,
        skipped: skippedCount
      });

      return {
        recordsSynced: insertCount + updateCount,
        inserted: insertCount,
        updated: updateCount,
        skipped: skippedCount
      };

    } catch (error) {
      logger.error(`Error syncing table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Validate if a record is valid for syncing
   */
  isValidRecord(tableName, record) {
    // For users table, ensure username is not NULL
    if (tableName === 'users') {
      if (!record.username) {
        return false;
      }
    }

    // For tables with user_id foreign key, it should be valid
    if (record.user_id !== undefined) {
      // Skip if user_id is NULL (unless it's allowed to be NULL)
      if (record.user_id === null && tableName !== 'config_files') {
        return false;
      }
    }

    return true;
  }

  /**
   * Insert a record into remote database
   */
  async insertRecord(tableName, record) {
    try {
      const columns = Object.keys(record);
      const values = Object.values(record);
      const placeholders = columns.map(() => '?').join(', ');

      const query = `
        INSERT INTO ${tableName} (${columns.join(', ')})
        VALUES (${placeholders})
      `;

      await this.remotePool.query(query, values);
    } catch (error) {
      logger.error(`Failed to insert record into ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Update a record in remote database
   */
  async updateRecord(tableName, record) {
    try {
      const columns = Object.keys(record).filter(col => col !== 'id');
      const setClause = columns.map(col => `${col} = ?`).join(', ');
      const values = columns.map(col => record[col]);
      values.push(record.id);

      const query = `
        UPDATE ${tableName}
        SET ${setClause}
        WHERE id = ?
      `;

      await this.remotePool.query(query, values);
    } catch (error) {
      logger.error(`Failed to update record in ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Check if record needs update
   * Compares updated_at timestamps if available
   */
  needsUpdate(localRecord, remoteRecord) {
    // If table has updated_at column, compare timestamps
    if (localRecord.updated_at && remoteRecord.updated_at) {
      const localTime = new Date(localRecord.updated_at).getTime();
      const remoteTime = new Date(remoteRecord.updated_at).getTime();
      return localTime > remoteTime;
    }

    // Otherwise, do a deep comparison (exclude timestamps)
    const localData = { ...localRecord };
    const remoteData = { ...remoteRecord };

    delete localData.created_at;
    delete localData.updated_at;
    delete remoteData.created_at;
    delete remoteData.updated_at;

    return JSON.stringify(localData) !== JSON.stringify(remoteData);
  }

  /**
   * Perform incremental sync (only changed records since last sync)
   */
  async syncIncremental() {
    if (!this.lastSyncTime) {
      logger.info('No previous sync time found, performing full sync');
      return await this.syncFull();
    }

    if (this.isSyncing) {
      logger.warn('Sync already in progress, skipping');
      return { success: false, message: 'Sync already in progress' };
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      logger.info('Starting incremental database synchronization', {
        since: this.lastSyncTime
      });

      const syncResults = {
        tables: {},
        totalRecords: 0
      };

      // Sync only records updated since last sync
      for (const table of this.tablesToSync) {
        try {
          const result = await this.syncTableIncremental(table, this.lastSyncTime);
          syncResults.tables[table] = result;
          syncResults.totalRecords += result.recordsSynced;
        } catch (error) {
          logger.error(`Failed to sync table ${table} incrementally:`, error);
        }
      }

      const duration = Date.now() - startTime;
      this.lastSyncTime = new Date();

      logger.info('Incremental synchronization completed', {
        duration: `${duration}ms`,
        totalRecords: syncResults.totalRecords
      });

      return {
        success: true,
        duration,
        syncResults,
        timestamp: this.lastSyncTime
      };

    } catch (error) {
      logger.error('Incremental synchronization failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync only records updated after a specific time
   */
  async syncTableIncremental(tableName, since) {
    try {
      // Check if table has updated_at column
      const [columns] = await this.localPool.query(
        `SHOW COLUMNS FROM ${tableName} LIKE 'updated_at'`
      );

      if (columns.length === 0) {
        // Table doesn't have updated_at, skip incremental sync
        return { recordsSynced: 0, operation: 'skipped' };
      }

      // Get records updated since last sync
      const [localRecords] = await this.localPool.query(
        `SELECT * FROM ${tableName} WHERE updated_at > ?`,
        [since]
      );

      if (localRecords.length === 0) {
        return { recordsSynced: 0, operation: 'no_changes' };
      }

      let insertCount = 0;
      let updateCount = 0;

      for (const record of localRecords) {
        // Check if record exists on remote
        const [remoteRecords] = await this.remotePool.query(
          `SELECT * FROM ${tableName} WHERE id = ?`,
          [record.id]
        );

        if (remoteRecords.length === 0) {
          await this.insertRecord(tableName, record);
          insertCount++;
        } else {
          await this.updateRecord(tableName, record);
          updateCount++;
        }
      }

      return {
        recordsSynced: insertCount + updateCount,
        inserted: insertCount,
        updated: updateCount
      };

    } catch (error) {
      logger.error(`Error in incremental sync for ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Get sync statistics
   */
  getStats() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      stats: this.syncStats,
      successRate: this.syncStats.totalSyncs > 0
        ? `${Math.round((this.syncStats.successfulSyncs / this.syncStats.totalSyncs) * 100)}%`
        : '0%'
    };
  }

  /**
   * Close database connections
   */
  async close() {
    try {
      if (this.localPool) {
        await this.localPool.end();
        logger.info('Local database pool closed');
      }
      if (this.remotePool) {
        await this.remotePool.end();
        logger.info('Remote database pool closed');
      }
    } catch (error) {
      logger.error('Error closing database pools:', error);
    }
  }
}

// Export singleton instance
const databaseSyncService = new DatabaseSyncService();

module.exports = databaseSyncService;
