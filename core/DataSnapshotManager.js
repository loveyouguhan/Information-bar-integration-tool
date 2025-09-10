/**
 * 数据快照管理器
 *
 * 负责管理数据核心的快照和回溯功能：
 * - 为每条消息创建数据快照（楼层命名）
 * - 消息删除/重新生成时的数据回溯
 * - 快照存储和管理（每个聊天50个限制）
 * - 快照数据的完整性验证
 *
 * @class DataSnapshotManager
 */

export class DataSnapshotManager {
    constructor(dataCore, eventSystem = null) {
        console.log('[DataSnapshotManager] 🔧 数据快照管理器初始化开始');

        this.dataCore = dataCore;
        this.eventSystem = eventSystem;

        // 快照存储结构
        this.snapshots = new Map(); // chatId -> Array<Snapshot>
        this.maxSnapshotsPerChat = 50; // 每个聊天最多保持50个快照

        // 快照元数据
        this.snapshotMetadata = new Map(); // snapshotId -> metadata

        // 当前楼层跟踪
        this.currentFloors = new Map(); // chatId -> currentFloor

        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;

        // 绑定方法
        this.init = this.init.bind(this);
        this.createSnapshot = this.createSnapshot.bind(this);
        this.rollbackToSnapshot = this.rollbackToSnapshot.bind(this);
        this.cleanupSnapshots = this.cleanupSnapshots.bind(this);

        console.log('[DataSnapshotManager] 🏗️ 构造函数完成');
    }

    /**
     * 初始化数据快照管理器
     */
    async init() {
        try {
            console.log('[DataSnapshotManager] 📊 开始初始化数据快照管理器...');

            // 绑定事件监听
            this.bindEvents();

            // 加载现有快照
            await this.loadExistingSnapshots();

            this.initialized = true;
            console.log('[DataSnapshotManager] ✅ 数据快照管理器初始化完成');

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 绑定事件监听
     */
    bindEvents() {
        try {
            if (!this.eventSystem) {
                console.warn('[DataSnapshotManager] ⚠️ 事件系统未提供，跳过事件绑定');
                return;
            }

            // 监听数据存储完成事件，自动创建快照
            this.eventSystem.on('infobar:data:stored', async (data) => {
                await this.handleDataStored(data);
            });

            // 监听聊天数据变更事件
            this.eventSystem.on('chat:data:changed', async (data) => {
                // 🔧 修复：防循环 - 跳过快照相关的数据变更
                if (data && data.source === 'snapshot') {
                    console.log('[DataSnapshotManager] ⚠️ 跳过快照相关的数据变更事件，防止循环');
                    return;
                }
                await this.handleChatDataChanged(data);
            });

            // 监听消息删除事件
            this.eventSystem.on('message:deleted', async (data) => {
                await this.handleMessageDeleted(data);
            });

            // 监听消息重新生成事件
            this.eventSystem.on('message:regenerated', async (data) => {
                await this.handleMessageRegenerated(data);
            });

            // 监听聊天切换事件
            this.eventSystem.on('chat:changed', async (data) => {
                await this.handleChatChanged(data);
            });

            console.log('[DataSnapshotManager] 🔗 事件监听已绑定');

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 绑定事件失败:', error);
        }
    }

    /**
     * 创建数据快照
     * @param {string} chatId - 聊天ID
     * @param {number} messageFloor - 消息楼层（0开始）
     * @param {Object} options - 快照选项
     * @returns {string} 快照ID
     */
    async createSnapshot(chatId, messageFloor, options = {}) {
        try {
            if (!chatId) {
                throw new Error('聊天ID不能为空');
            }

            // 🔧 修复：防重复创建检查 - 避免无限循环
            const snapshotKey = `${chatId}_${messageFloor}`;
            const currentTime = Date.now();
            
            // 检查是否在短时间内重复创建同一楼层的快照
            if (this.recentSnapshots && this.recentSnapshots.has(snapshotKey)) {
                const lastCreateTime = this.recentSnapshots.get(snapshotKey);
                const timeDiff = currentTime - lastCreateTime;
                
                // 如果在5秒内重复创建同一楼层快照，跳过
                if (timeDiff < 5000) {
                    console.log(`[DataSnapshotManager] ⚠️ 防循环保护：跳过重复创建快照 ${chatId} 楼层:${messageFloor}，距离上次创建仅${timeDiff}ms`);
                    return null;
                }
            }

            // 初始化重复检查映射
            if (!this.recentSnapshots) {
                this.recentSnapshots = new Map();
            }
            
            // 记录创建时间
            this.recentSnapshots.set(snapshotKey, currentTime);
            
            // 清理5分钟前的记录，避免内存泄漏
            setTimeout(() => {
                this.recentSnapshots.delete(snapshotKey);
            }, 300000); // 5分钟后清理

            console.log('[DataSnapshotManager] 📸 创建数据快照:', chatId, '楼层:', messageFloor);

            // 获取当前数据核心状态
            const currentData = await this.captureCurrentState(chatId);

            if (!currentData) {
                console.warn('[DataSnapshotManager] ⚠️ 无法获取当前数据状态，跳过快照创建');
                return null;
            }

            // 生成快照ID
            const snapshotId = this.generateSnapshotId(chatId, messageFloor);

            // 创建快照对象
            const snapshot = {
                id: snapshotId,
                chatId: chatId,
                messageFloor: messageFloor,
                timestamp: Date.now(),
                data: this.deepClone(currentData),
                metadata: {
                    panelCount: Object.keys(currentData.panels || {}).length,
                    dataSize: this.calculateDataSize(currentData),
                    version: '1.0.0',
                    ...options
                }
            };

            // 存储快照
            await this.storeSnapshot(snapshot);

            // 更新当前楼层跟踪
            this.currentFloors.set(chatId, messageFloor);

            console.log('[DataSnapshotManager] ✅ 快照创建完成:', snapshotId);
            console.log('[DataSnapshotManager] 📊 快照包含', snapshot.metadata.panelCount, '个面板，数据大小:', snapshot.metadata.dataSize, 'B');

            // 🔧 修复：延迟触发快照创建事件，防止立即循环
            if (this.eventSystem && !options.skipEvent) {
                // 延迟100ms触发事件，让当前操作完全结束
                setTimeout(() => {
                    this.eventSystem.emit('snapshot:created', {
                        snapshotId,
                        chatId,
                        messageFloor,
                        timestamp: snapshot.timestamp,
                        source: options.source || 'normal'
                    });
                }, 100);
            }

            return snapshotId;

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 创建快照失败:', error);
            this.handleError(error);
            return null;
        }
    }

    /**
     * 回溯到指定快照
     * @param {string} chatId - 聊天ID
     * @param {number} targetFloor - 目标楼层
     * @returns {boolean} 回溯是否成功
     */
    async rollbackToSnapshot(chatId, targetFloor) {
        try {
            if (!chatId) {
                throw new Error('聊天ID不能为空');
            }

            console.log('[DataSnapshotManager] 🔄 开始数据回溯:', chatId, '目标楼层:', targetFloor);

            // 🔧 改进：智能查找目标快照
            let targetSnapshot = await this.findSnapshot(chatId, targetFloor);
            let actualTargetFloor = targetFloor;

            if (!targetSnapshot) {
                console.warn('[DataSnapshotManager] ⚠️ 未找到目标楼层的快照:', targetFloor);

                // 🔧 智能回退：查找最近的有效快照
                const fallbackResult = await this.findFallbackSnapshot(chatId, targetFloor);
                if (fallbackResult) {
                    targetSnapshot = fallbackResult.snapshot;
                    actualTargetFloor = fallbackResult.floor;
                    console.log('[DataSnapshotManager] 🔄 使用回退快照:', actualTargetFloor);
                } else {
                    console.error('[DataSnapshotManager] ❌ 无法找到任何有效快照，启用安全软回退：保持当前数据不变');
                    // 🔧 修复：安全软回退策略 - 绝对不清空用户数据
                    console.log('[DataSnapshotManager] 🛡️ 安全策略：数据保护优先，不执行任何可能导致数据丢失的操作');
                    
                    // 创建当前状态的保护性快照
                    await this.createSnapshot(chatId, targetFloor, {
                        source: 'protective_snapshot',
                        trigger: 'rollback_fallback_protection',
                        note: '回溯失败时的数据保护快照'
                    });
                    
                    return true; // 返回true，视为"回溯完成"，但未更改数据
                }
            }

            console.log('[DataSnapshotManager] 🎯 找到目标快照:', targetSnapshot.id, '楼层:', actualTargetFloor);

            // 验证快照数据完整性
            if (!this.validateSnapshotData(targetSnapshot)) {
                console.error('[DataSnapshotManager] ❌ 快照数据验证失败');

                // 🔧 尝试查找其他有效快照
                const alternativeResult = await this.findFallbackSnapshot(chatId, actualTargetFloor - 1);
                if (alternativeResult && this.validateSnapshotData(alternativeResult.snapshot)) {
                    console.log('[DataSnapshotManager] 🔄 使用备选快照:', alternativeResult.floor);
                    targetSnapshot = alternativeResult.snapshot;
                    actualTargetFloor = alternativeResult.floor;
                } else {
                    console.error('[DataSnapshotManager] ❌ 无法找到任何有效的备选快照');
                    // 🔧 修复：即使验证失败，也不应该返回false导致潜在的数据清空
                    console.log('[DataSnapshotManager] 🛡️ 数据保护：避免因快照验证失败导致数据清空');
                    
                    // 创建当前状态的保护性快照
                    await this.createSnapshot(chatId, actualTargetFloor, {
                        source: 'validation_failure_protection',
                        trigger: 'snapshot_validation_failed',
                        note: '快照验证失败时的数据保护快照'
                    });
                    
                    return true; // 返回true，保护用户数据不被清空
                }
            }

            // 🔧 调试：显示要恢复的快照数据内容
            const snapshotPanels = targetSnapshot.data.panels || {};
            console.log('[DataSnapshotManager] 📋 快照数据内容验证:', {
                panelCount: Object.keys(snapshotPanels).length,
                panelNames: Object.keys(snapshotPanels)
            });

            // 🔧 调试：检查几个主要面板的数据内容
            const samplePanels = ['personal', 'world', 'interaction'];
            for (const panelName of samplePanels) {
                if (snapshotPanels[panelName]) {
                    const panelData = snapshotPanels[panelName];
                    const fieldCount = Object.keys(panelData).length;
                    console.log(`[DataSnapshotManager] 📋 快照面板 ${panelName} 内容:`, {
                        fieldCount,
                        hasData: fieldCount > 0,
                        sampleFields: fieldCount > 0 ? Object.keys(panelData).slice(0, 3) : []
                    });
                } else {
                    console.log(`[DataSnapshotManager] ⚠️ 快照中面板 ${panelName} 不存在`);
                }
            }

            // 恢复数据核心状态
            await this.restoreDataCore(chatId, targetSnapshot.data);

            // 更新当前楼层跟踪
            this.currentFloors.set(chatId, actualTargetFloor);

            console.log('[DataSnapshotManager] ✅ 数据回溯完成');
            console.log('[DataSnapshotManager] 📊 已恢复', Object.keys(targetSnapshot.data.panels || {}).length, '个面板数据');

            // 触发回溯完成事件
            if (this.eventSystem) {
                const eventData = {
                    chatId,
                    targetFloor: actualTargetFloor,
                    originalTargetFloor: targetFloor,
                    snapshotId: targetSnapshot.id,
                    timestamp: Date.now()
                };

                console.log('[DataSnapshotManager] 🔔 准备触发回溯完成事件:', eventData);
                this.eventSystem.emit('snapshot:rollback:completed', eventData);
                console.log('[DataSnapshotManager] 🔔 回溯完成事件已触发');
            } else {
                console.warn('[DataSnapshotManager] ⚠️ 事件系统未初始化，无法触发回溯完成事件');
            }

            return true;

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 数据回溯失败:', error);
            this.handleError(error);
            return false;
        }
    }

    /**
     * 捕获当前数据核心状态
     * @param {string} chatId - 聊天ID
     * @returns {Object} 当前数据状态
     */
    async captureCurrentState(chatId) {
        try {
            // 获取聊天数据
            const chatData = await this.dataCore.getChatData(chatId);

            if (!chatData) {
                return null;
            }

            // 构建快照数据结构（支持新数据格式）
            const state = {
                version: '2.0.0', // 🔧 新增：数据版本标识
                format: 'modern', // 🔧 新增：数据格式标识
                panels: {},
                metadata: {
                    lastUpdated: Date.now(),
                    chatId: chatId,
                    captureMethod: 'current_state',
                    dataStructure: 'chinese_fields' // 🔧 新增：字段名格式标识
                }
            };

            // 🔧 修复：支持多种数据结构格式
            if (chatData.infobar_data && chatData.infobar_data.panels) {
                // 新格式：保持原始结构，支持中文字段名
                state.panels = this.deepClone(chatData.infobar_data.panels);
                console.log('[DataSnapshotManager] 📊 捕获新格式面板数据，面板数量:', Object.keys(state.panels).length);
                
                // 🔧 新增：记录每个面板的数据格式类型
                Object.keys(state.panels).forEach(panelId => {
                    const panelData = state.panels[panelId];
                    if (Array.isArray(panelData)) {
                        state.metadata[`${panelId}_format`] = 'multirow_array';
                        state.metadata[`${panelId}_rows`] = panelData.length;
                    } else if (typeof panelData === 'object') {
                        state.metadata[`${panelId}_format`] = 'key_value_object';
                        state.metadata[`${panelId}_fields`] = Object.keys(panelData).length;
                    }
                });
            } else if (chatData.panels) {
                // 🔧 兼容：直接从chatData获取面板数据
                state.panels = this.deepClone(chatData.panels);
                state.metadata.dataStructure = 'direct_panels';
                console.log('[DataSnapshotManager] 📊 捕获直接面板数据，面板数量:', Object.keys(state.panels).length);
            }

            // 添加历史记录信息
            if (chatData.infobar_data && chatData.infobar_data.history) {
                state.metadata.historyCount = chatData.infobar_data.history.length;
            }

            // 🔧 新增：数据完整性验证
            state.metadata.dataIntegrity = this.calculateDataIntegrity(state.panels);

            console.log('[DataSnapshotManager] 🎯 快照状态捕获完成，数据版本:', state.version, '格式:', state.format);
            return state;

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 捕获当前状态失败:', error);
            return null;
        }
    }

    /**
     * 恢复数据核心状态
     * @param {string} chatId - 聊天ID
     * @param {Object} snapshotData - 快照数据
     */
    async restoreDataCore(chatId, snapshotData) {
        try {
            console.log('[DataSnapshotManager] 🔄 恢复数据核心状态...');
            
            // 🔧 修复：检查快照数据版本和格式
            const snapshotVersion = snapshotData.version || '1.0.0';
            const snapshotFormat = snapshotData.format || 'legacy';
            
            console.log('[DataSnapshotManager] 📊 快照版本:', snapshotVersion, '格式:', snapshotFormat);

            // 获取当前聊天数据
            const chatData = await this.dataCore.getChatData(chatId) || {};

            // 🔧 修复：根据快照版本使用不同的恢复策略
            if (snapshotVersion >= '2.0.0' && snapshotFormat === 'modern') {
                // 新版本快照：直接恢复，保持数据格式
                await this.restoreModernFormatSnapshot(chatId, chatData, snapshotData);
            } else {
                // 旧版本快照：兼容性恢复
                await this.restoreLegacyFormatSnapshot(chatId, chatData, snapshotData);
            }

            // 🔧 保存恢复后的数据，标记为快照操作以避免循环
            await this.dataCore.setChatData(chatId, chatData, { source: 'snapshot', operation: 'restore' });

            console.log('[DataSnapshotManager] ✅ 数据核心状态恢复完成');
            return true;

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 数据核心状态恢复失败:', error);
            return false;
        }
    }

    /**
     * 🚀 恢复新格式快照
     */
    async restoreModernFormatSnapshot(chatId, chatData, snapshotData) {
        try {
            console.log('[DataSnapshotManager] 🚀 使用新格式恢复策略...');

            // 确保infobar_data结构存在
            if (!chatData.infobar_data) {
                chatData.infobar_data = {
                    panels: {},
                    history: [],
                    lastUpdated: 0,
                    version: '2.0.0',
                    format: 'modern'
                };
            }

            // 🔧 修复：直接恢复面板数据，保持中文字段名格式
            if (snapshotData.panels) {
                chatData.infobar_data.panels = this.deepClone(snapshotData.panels);
                chatData.infobar_data.lastUpdated = Date.now();
                chatData.infobar_data.version = snapshotData.version;
                chatData.infobar_data.format = snapshotData.format;

                // 添加回溯记录到历史
                chatData.infobar_data.history.push({
                    timestamp: Date.now(),
                    type: 'rollback_modern',
                    panelCount: Object.keys(snapshotData.panels).length,
                    snapshotVersion: snapshotData.version,
                    dataStructure: snapshotData.metadata?.dataStructure || 'chinese_fields',
                    restoredPanels: Object.keys(snapshotData.panels)
                });

                console.log('[DataSnapshotManager] ✅ 新格式面板数据恢复完成，面板数量:', Object.keys(snapshotData.panels).length);
            }

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 新格式快照恢复失败:', error);
            throw error;
        }
    }

    /**
     * 🔧 恢复旧格式快照（兼容性处理）
     */
    async restoreLegacyFormatSnapshot(chatId, chatData, snapshotData) {
        try {
            console.log('[DataSnapshotManager] 🔧 使用兼容性恢复策略...');

            // 确保infobar_data结构存在
            if (!chatData.infobar_data) {
                chatData.infobar_data = {
                    panels: {},
                    history: [],
                    lastUpdated: 0
                };
            }

            // 恢复面板数据
            if (snapshotData.panels) {
                chatData.infobar_data.panels = this.deepClone(snapshotData.panels);
                chatData.infobar_data.lastUpdated = Date.now();

                // 添加回溯记录到历史
                chatData.infobar_data.history.push({
                    timestamp: Date.now(),
                    type: 'rollback_legacy',
                    panelCount: Object.keys(snapshotData.panels).length,
                    panels: Object.keys(snapshotData.panels)
                });

                // 限制历史记录数量
                if (chatData.infobar_data.history.length > 100) {
                    chatData.infobar_data.history = chatData.infobar_data.history.slice(-50);
                }

                console.log('[DataSnapshotManager] ✅ 旧格式面板数据恢复完成，面板数量:', Object.keys(snapshotData.panels).length);
            }

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 旧格式快照恢复失败:', error);
            throw error;
        }
    }

    /**
     * 🔧 新增：计算数据完整性哈希
     */
    calculateDataIntegrity(panels) {
        try {
            if (!panels || typeof panels !== 'object') {
                return 'empty';
            }

            // 生成数据指纹
            const dataFingerprint = {
                panelCount: Object.keys(panels).length,
                totalFields: 0,
                panelTypes: {}
            };

            Object.keys(panels).forEach(panelId => {
                const panelData = panels[panelId];
                if (Array.isArray(panelData)) {
                    dataFingerprint.panelTypes[panelId] = 'array';
                    dataFingerprint.totalFields += panelData.reduce((sum, row) => 
                        sum + (typeof row === 'object' ? Object.keys(row).length : 0), 0);
                } else if (typeof panelData === 'object') {
                    dataFingerprint.panelTypes[panelId] = 'object';
                    dataFingerprint.totalFields += Object.keys(panelData).length;
                }
            });

            return this.simpleHash(JSON.stringify(dataFingerprint));

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 计算数据完整性失败:', error);
            return 'error';
        }
    }

    /**
     * 存储快照
            await this.dataCore.setChatData(chatId, chatData);

            console.log('[DataSnapshotManager] ✅ 数据核心状态恢复完成');

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 恢复数据核心状态失败:', error);
            throw error;
        }
    }

    /**
     * 存储快照
     * @param {Object} snapshot - 快照对象
     */
    async storeSnapshot(snapshot) {
        try {
            const { chatId, id } = snapshot;

            // 确保聊天快照数组存在
            if (!this.snapshots.has(chatId)) {
                this.snapshots.set(chatId, []);
            }

            const chatSnapshots = this.snapshots.get(chatId);

            // 🔧 避免同楼层重复快照：剔除同楼层旧快照
            for (let i = chatSnapshots.length - 1; i >= 0; i--) {
                if (chatSnapshots[i].messageFloor === snapshot.messageFloor) {
                    this.snapshotMetadata.delete(chatSnapshots[i].id);
                    chatSnapshots.splice(i, 1);
                }
            }

            // 添加新快照
            chatSnapshots.push(snapshot);

            // 按楼层排序
            chatSnapshots.sort((a, b) => a.messageFloor - b.messageFloor);

            // 存储快照元数据
            this.snapshotMetadata.set(id, snapshot.metadata);

            // 清理超出限制的快照
            await this.cleanupSnapshots(chatId);

            // 持久化到chatMetadata
            await this.persistSnapshots(chatId);

            console.log('[DataSnapshotManager] 💾 快照已存储:', id);

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 存储快照失败:', error);
            throw error;
        }
    }

    /**
     * 移除指定楼层的快照
     * @param {string} chatId - 聊天ID
     * @param {number} floor - 楼层
     */
    async removeSnapshotsForFloor(chatId, floor) {
        try {
            if (!this.snapshots.has(chatId)) return;
            const chatSnapshots = this.snapshots.get(chatId);
            let changed = false;
            for (let i = chatSnapshots.length - 1; i >= 0; i--) {
                if (chatSnapshots[i].messageFloor === floor) {
                    this.snapshotMetadata.delete(chatSnapshots[i].id);
                    chatSnapshots.splice(i, 1);
                    changed = true;
                }
            }
            if (changed) {
                await this.persistSnapshots(chatId);
            }
        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 移除指定楼层快照失败:', error);
        }
    }

    /**
     * 查找指定楼层的快照
     * @param {string} chatId - 聊天ID
     * @param {number} floor - 楼层号
     * @returns {Object|null} 快照对象
     */
    async findSnapshot(chatId, floor) {
        try {
            if (!this.snapshots.has(chatId)) {
                return null;
            }

            const chatSnapshots = this.snapshots.get(chatId);
            return chatSnapshots.find(snapshot => snapshot.messageFloor === floor) || null;

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 查找快照失败:', error);
            return null;
        }
    }

    /**
     * 🔧 查找回退快照
     * @param {string} chatId - 聊天ID
     * @param {number} targetFloor - 目标楼层
     * @returns {Object|null} 回退快照结果 {snapshot, floor}
     */
    async findFallbackSnapshot(chatId, targetFloor) {
        try {
            console.log('[DataSnapshotManager] 🔍 查找回退快照，目标楼层:', targetFloor);

            if (!this.snapshots.has(chatId)) {
                console.log('[DataSnapshotManager] ⚠️ 该聊天没有任何快照');
                return null;
            }

            const chatSnapshots = this.snapshots.get(chatId);
            if (chatSnapshots.length === 0) {
                console.log('[DataSnapshotManager] ⚠️ 快照列表为空');
                return null;
            }

            // 🔧 策略1: 查找小于等于目标楼层的最大楼层快照
            const validSnapshots = chatSnapshots
                .filter(snapshot => snapshot.messageFloor <= targetFloor)
                .sort((a, b) => b.messageFloor - a.messageFloor); // 降序排列

            if (validSnapshots.length > 0) {
                const bestSnapshot = validSnapshots[0];
                console.log('[DataSnapshotManager] ✅ 找到最佳回退快照:', bestSnapshot.messageFloor);
                return {
                    snapshot: bestSnapshot,
                    floor: bestSnapshot.messageFloor
                };
            }

            // 🔧 策略2: 如果没有找到合适的快照，使用最早的快照
            const earliestSnapshot = chatSnapshots
                .sort((a, b) => a.messageFloor - b.messageFloor)[0];

            if (earliestSnapshot) {
                console.log('[DataSnapshotManager] ⚠️ 使用最早的快照作为回退:', earliestSnapshot.messageFloor);
                return {
                    snapshot: earliestSnapshot,
                    floor: earliestSnapshot.messageFloor
                };
            }

            console.log('[DataSnapshotManager] ❌ 无法找到任何回退快照');
            return null;

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 查找回退快照失败:', error);
            return null;
        }
    }

    /**
     * 清理超出限制的快照
     * @param {string} chatId - 聊天ID
     */
    async cleanupSnapshots(chatId) {
        try {
            if (!this.snapshots.has(chatId)) {
                return;
            }

            const chatSnapshots = this.snapshots.get(chatId);

            if (chatSnapshots.length > this.maxSnapshotsPerChat) {
                console.log('[DataSnapshotManager] 🧹 清理超出限制的快照，当前:', chatSnapshots.length, '限制:', this.maxSnapshotsPerChat);

                // 保留最新的快照
                const toRemove = chatSnapshots.splice(0, chatSnapshots.length - this.maxSnapshotsPerChat);

                // 清理元数据
                for (const snapshot of toRemove) {
                    this.snapshotMetadata.delete(snapshot.id);
                }

                console.log('[DataSnapshotManager] 🗑️ 已清理', toRemove.length, '个旧快照');
            }

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 清理快照失败:', error);
        }
    }

    /**
     * 持久化快照到chatMetadata
     * @param {string} chatId - 聊天ID
     */
    async persistSnapshots(chatId) {
        try {
            if (!this.snapshots.has(chatId)) {
                return;
            }

            const chatSnapshots = this.snapshots.get(chatId);
            const snapshotKey = `snapshots_${chatId}`;

            // 只存储必要的信息以节省空间
            const persistData = chatSnapshots.map(snapshot => ({
                id: snapshot.id,
                messageFloor: snapshot.messageFloor,
                timestamp: snapshot.timestamp,
                data: snapshot.data,
                metadata: snapshot.metadata
            }));

            // 使用数据核心的chatMetadata存储
            await this.dataCore.chatMetadata.set(snapshotKey, persistData);

            console.log('[DataSnapshotManager] 💾 快照已持久化:', chatId, '数量:', persistData.length);

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 持久化快照失败:', error);
        }
    }

    /**
     * 加载现有快照
     */
    async loadExistingSnapshots() {
        try {
            console.log('[DataSnapshotManager] 📥 加载现有快照...');

            const currentChatId = this.dataCore.getCurrentChatId();
            if (currentChatId) {
                await this.loadSnapshotsForChatCompat(currentChatId);
            }

            console.log('[DataSnapshotManager] ✅ 现有快照加载完成');

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 加载现有快照失败:', error);
        }
    }

    /**
     * 为指定聊天加载快照
     * @param {string} chatId - 聊天ID
     */
    async loadSnapshotsForChat(chatId) {
        try {
            const snapshotKey = `snapshots_${chatId}`;
            const persistedSnapshots = this.dataCore.chatMetadata.get(snapshotKey);

            if (persistedSnapshots && Array.isArray(persistedSnapshots)) {
                // f  
                const normalized = persistedSnapshots.map(s => {
                    const snap = { ...s };
                    try {
                        //   data  JSON 
                        if (typeof snap.data === 'string') {
                            try {
                                const parsed = JSON.parse(snap.data);
                                if (parsed && typeof parsed === 'object') {
                                    snap.data = parsed;
                                }
                            } catch (e) {
                                console.warn('[DataSnapshotManager]   data JSON ');
                                snap.data = { panels: {}, _raw: snap.data };
                            }
                        }
                        //   panels 
                        if (!snap.data || typeof snap.data !== 'object') {
                            snap.data = { panels: {} };
                        }
                        if (!snap.data.panels) {
                            //  
                            if (snap.data.__format === 'operation_commands' && Array.isArray(snap.data.__operations)) {
                                console.log('[DataSnapshotManager]    (),  panels ');
                                snap.data.panels = {};
                            } else {
                                snap.data.panels = {};
                            }
                        }
                    } catch (e) {
                        console.warn('[DataSnapshotManager]   ,  panels ');
                        snap.data = { panels: {} };
                    }
                    return snap;
                });

                this.snapshots.set(chatId, normalized);

                // 
                for (const snapshot of normalized) {
                    this.snapshotMetadata.set(snapshot.id, snapshot.metadata);
                }

                console.log('[DataSnapshotManager]  ', normalized.length, ':', chatId);
            }

        } catch (error) {
            console.error('[DataSnapshotManager]  :', error);
        }
    }

    /**
     * 为指定聊天加载快照（兼容旧数据格式，安全规范化）
     * @param {string} chatId - 聊天ID
     */
    async loadSnapshotsForChatCompat(chatId) {
        try {
            const snapshotKey = `snapshots_${chatId}`;
            const persistedSnapshots = this.dataCore.chatMetadata.get(snapshotKey);

            if (persistedSnapshots && Array.isArray(persistedSnapshots)) {
                // 规范化历史快照，兼容旧格式
                const normalized = persistedSnapshots.map(s => {
                    const snap = { ...s };
                    try {
                        // 兼容旧格式：data 为 JSON 字符串
                        if (typeof snap.data === 'string') {
                            try {
                                const parsed = JSON.parse(snap.data);
                                if (parsed && typeof parsed === 'object') {
                                    snap.data = parsed;
                                }
                            } catch (e) {
                                console.warn('[DataSnapshotManager] ⚠ 解析旧格式快照 data(JSON) 失败，使用空对象并保留_raw');
                                snap.data = { panels: {}, _raw: snap.data };
                            }
                        }
                        // 保障 data 是对象
                        if (!snap.data || typeof snap.data !== 'object') {
                            snap.data = { panels: {} };
                        }
                        // 保障 panels 字段存在
                        if (!snap.data.panels) {
                            // 若为操作指令快照格式，暂不执行指令，初始化为空 panels
                            if (snap.data.__format === 'operation_commands' && Array.isArray(snap.data.__operations)) {
                                console.log('[DataSnapshotManager] ℹ 检测到操作指令格式快照，暂不执行指令，初始化为空 panels');
                                snap.data.panels = {};
                            } else {
                                snap.data.panels = {};
                            }
                        }
                    } catch (e) {
                        console.warn('[DataSnapshotManager] ⚠ 规范化快照数据失败，回退为空 panels');
                        snap.data = { panels: {} };
                    }
                    return snap;
                });

                this.snapshots.set(chatId, normalized);

                // 恢复元数据
                for (const snapshot of normalized) {
                    this.snapshotMetadata.set(snapshot.id, snapshot.metadata);
                }

                console.log('[DataSnapshotManager] 📥 已加载', normalized.length, '个快照(含兼容处理):', chatId);
            }

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 加载聊天快照失败:', error);
        }
    }


    /**
     * 处理数据存储完成事件
     * @param {Object} data - 事件数据
     */
    async handleDataStored(data) {
        try {
            const chatId = data.chatId || this.dataCore.getCurrentChatId();
            if (!chatId) {
                return;
            }

            // 获取当前消息楼层
            const currentFloor = this.getCurrentMessageFloor(chatId);

            // 🔧 改进：确保为用户消息也创建快照
            console.log('[DataSnapshotManager] 📸 为楼层创建快照:', currentFloor);

            // 🔧 避免同楼层重复快照：先移除同楼层历史
            await this.removeSnapshotsForFloor(chatId, currentFloor);

            // 创建快照
            await this.createSnapshot(chatId, currentFloor, {
                source: 'data_stored',
                trigger: 'auto'
            });

            // 🔧 额外保护：如果当前是楼层0且没有快照，创建一个基础快照
            if (currentFloor === 0) {
                const existingSnapshot = await this.findSnapshot(chatId, 0);
                if (!existingSnapshot) {
                    console.log('[DataSnapshotManager] 🛡️ 为楼层0创建保护性快照');
                    await this.createSnapshot(chatId, 0, {
                        source: 'protection',
                        trigger: 'auto'
                    });
                }
            }

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 处理数据存储事件失败:', error);
        }
    }

    /**
     * 处理聊天数据变更事件
     * @param {Object} data - 事件数据
     */
    async handleChatDataChanged(data) {
        try {
            const { chatId } = data;
            if (!chatId) {
                return;
            }

            // 只在有意义的数据变更时创建快照
            if (this.isSignificantDataChange(data)) {
                const currentFloor = this.getCurrentMessageFloor(chatId);
                await this.createSnapshot(chatId, currentFloor, {
                    source: 'data_changed',
                    trigger: 'auto'
                });
            }

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 处理聊天数据变更事件失败:', error);
        }
    }

    /**
     * 处理消息删除事件
     * @param {Object} data - 事件数据
     */
    async handleMessageDeleted(data) {
        try {
            console.log('[DataSnapshotManager] 🗑️ 检测到消息删除事件');

            // 🔧 新增：检查是否需要跳过回溯（用户消息删除）
            if (data && data.skipRollback === true) {
                console.log('[DataSnapshotManager] ℹ️ 跳过数据回溯（删除的是用户消息）');
                return;
            }

            // 🔧 新增：显示消息类型信息
            const messageType = data?.messageInfo?.isUser ? '用户消息' : 'AI消息';
            console.log('[DataSnapshotManager] 📊 消息类型:', messageType);

            if (data?.messageInfo?.isUser) {
                console.log('[DataSnapshotManager] ℹ️ 用户消息删除不需要数据回溯');
                return;
            }

            console.log('[DataSnapshotManager] 🔄 开始AI消息删除的数据回溯...');

            const chatId = data.chatId || this.dataCore.getCurrentChatId();
            if (!chatId) {
                console.warn('[DataSnapshotManager] ⚠️ 无法获取聊天ID');
                return;
            }

            // 🔧 改进：获取删除前的楼层信息
            const currentFloor = this.getCurrentMessageFloor(chatId);
            console.log('[DataSnapshotManager] 📊 当前楼层:', currentFloor);

            // 🔧 改进：智能计算回溯目标楼层
            let targetFloor = await this.findBestRollbackTarget(chatId, currentFloor);

            console.log('[DataSnapshotManager] 🎯 智能回溯目标: 从楼层', currentFloor, '回溯到楼层', targetFloor);

            // 🔧 修复：在回溯之前不要清理任何与目标相关的楼层快照，避免误删回溯所需的快照
            // 如需清理残留，应在回溯完成后，再按需清理高于实际目标楼层的快照

            // 执行回溯
            const success = await this.rollbackToSnapshot(chatId, targetFloor);

            if (success) {
                console.log('[DataSnapshotManager] ✅ AI消息删除回溯成功');
            } else {
                console.warn('[DataSnapshotManager] ⚠️ AI消息删除回溯失败');

                // 🔧 回溯失败时的降级处理
                await this.handleRollbackFailure(chatId, currentFloor);
            }

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 处理消息删除事件失败:', error);
        }
    }

    /**
     * 处理消息重新生成事件
     * @param {Object} data - 事件数据
     */
    async handleMessageRegenerated(data) {
        try {
            console.log('[DataSnapshotManager] 🔄 检测到消息重新生成，开始数据回溯...');

            const chatId = data.chatId || this.dataCore.getCurrentChatId();
            if (!chatId) {
                console.warn('[DataSnapshotManager] ⚠️ 无法获取聊天ID');
                return;
            }

            // 重新生成时回溯到当前消息的前一个状态
            const currentFloor = this.getCurrentMessageFloor(chatId);
            const targetFloor = Math.max(0, currentFloor - 1);

            console.log('[DataSnapshotManager] 🎯 重新生成回溯: 从楼层', currentFloor, '回溯到楼层', targetFloor);

            // 执行回溯
            const success = await this.rollbackToSnapshot(chatId, targetFloor);

            if (success) {
                console.log('[DataSnapshotManager] ✅ 消息重新生成回溯成功');
            } else {
                console.warn('[DataSnapshotManager] ⚠️ 消息重新生成回溯失败');
            }

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 处理消息重新生成事件失败:', error);
        }
    }

    /**
     * 处理聊天切换事件
     * @param {Object} data - 事件数据
     */
    async handleChatChanged(data) {
        try {
            const chatId = this.dataCore.getCurrentChatId();
            if (chatId) {
                // 加载新聊天的快照
                await this.loadSnapshotsForChatCompat(chatId);
            }

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 处理聊天切换事件失败:', error);
        }
    }

    /**
     * 获取当前消息楼层
     * @param {string} chatId - 聊天ID
     * @returns {number} 当前楼层
     */
    getCurrentMessageFloor(chatId) {
        try {
            const context = SillyTavern.getContext();
            if (context && context.chat && Array.isArray(context.chat)) {
                return Math.max(0, context.chat.length - 1);
            }
            return 0;
        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 获取当前消息楼层失败:', error);
            return 0;
        }
    }

    /**
     * 🔧 智能查找最佳回溯目标楼层
     * @param {string} chatId - 聊天ID
     * @param {number} currentFloor - 当前楼层
     * @returns {number} 最佳回溯目标楼层
     */
    async findBestRollbackTarget(chatId, currentFloor) {
        try {
            console.log('[DataSnapshotManager] 🔍 查找最佳回溯目标，当前楼层:', currentFloor);

            // 🔧 策略1: 优先尝试回溯到上一层
            let targetFloor = Math.max(0, currentFloor - 1);

            // 检查目标楼层是否有快照
            let targetSnapshot = await this.findSnapshot(chatId, targetFloor);
            if (targetSnapshot) {
                console.log('[DataSnapshotManager] ✅ 找到上一层快照:', targetFloor);
                return targetFloor;
            }

            // 🔧 策略2: 如果上一层没有快照，向前查找最近的有效快照
            console.log('[DataSnapshotManager] 🔍 上一层无快照，查找最近的有效快照...');

            if (!this.snapshots.has(chatId)) {
                console.log('[DataSnapshotManager] ⚠️ 该聊天没有任何快照，回溯到楼层0');
                return 0;
            }

            const chatSnapshots = this.snapshots.get(chatId);
            if (chatSnapshots.length === 0) {
                console.log('[DataSnapshotManager] ⚠️ 快照列表为空，回溯到楼层0');
                return 0;
            }

            // 查找小于等于目标楼层的最大楼层快照
            const validSnapshots = chatSnapshots
                .filter(snapshot => snapshot.messageFloor <= targetFloor)
                .sort((a, b) => b.messageFloor - a.messageFloor); // 降序排列

            if (validSnapshots.length > 0) {
                const bestSnapshot = validSnapshots[0];
                console.log('[DataSnapshotManager] ✅ 找到最佳回溯目标:', bestSnapshot.messageFloor);
                return bestSnapshot.messageFloor;
            }

            // 🔧 策略3: 如果没有找到合适的快照，检查是否有更早的快照（楼层号更小）
            const earlierSnapshots = chatSnapshots
                .filter(snapshot => snapshot.messageFloor < currentFloor)
                .sort((a, b) => b.messageFloor - a.messageFloor); // 降序排列，优先选择最接近的

            if (earlierSnapshots.length > 0) {
                const bestEarlierSnapshot = earlierSnapshots[0];
                console.log('[DataSnapshotManager] ✅ 找到更早的快照作为回溯目标:', bestEarlierSnapshot.messageFloor);
                return bestEarlierSnapshot.messageFloor;
            }

            // 🔧 策略4: 如果没有更早的快照，但有更晚的快照，说明数据状态异常
            const laterSnapshots = chatSnapshots
                .filter(snapshot => snapshot.messageFloor > currentFloor);

            if (laterSnapshots.length > 0) {
                console.warn('[DataSnapshotManager] ⚠️ 检测到异常：只有更晚的快照存在，可能是楼层计算错误');
                console.warn('[DataSnapshotManager] ⚠️ 当前楼层:', currentFloor, '可用快照楼层:', chatSnapshots.map(s => s.messageFloor));
                // 在这种异常情况下，不进行回溯，避免数据混乱
                console.log('[DataSnapshotManager] 🚫 跳过回溯以避免数据混乱');
                return currentFloor; // 返回当前楼层，不进行回溯
            }

            // 🔧 策略4: 最后的降级方案
            console.log('[DataSnapshotManager] ⚠️ 无法找到任何有效快照，回溯到楼层0');
            return 0;

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 查找最佳回溯目标失败:', error);
            return Math.max(0, currentFloor - 1);
        }
    }

    /**
     * 🔧 处理回溯失败的降级方案
     * @param {string} chatId - 聊天ID
     * @param {number} currentFloor - 当前楼层
     */
    async handleRollbackFailure(chatId, currentFloor) {
        try {
            console.log('[DataSnapshotManager] 🚨 回溯失败，执行非破坏性降级处理（Soft Fallback）...');

            // ✅ 安全策略：不清空数据，保持当前状态，避免造成数据丢失
            // 仅创建一个保护性快照，作为后续操作的基线
            console.log('[DataSnapshotManager] 🛡️ 创建保护性快照作为新起点');
            await this.createSnapshot(chatId, Math.max(0, currentFloor - 1), {
                source: 'rollback_failure',
                trigger: 'soft_fallback'
            });

            console.log('[DataSnapshotManager] ✅ 非破坏性降级处理完成（未清空数据）');

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 降级处理失败:', error);
        }
    }

    /**
     * 🔧 清空数据核心状态
     * @param {string} chatId - 聊天ID
     */
    async clearDataCore(chatId) {
        try {
            if (this.dataCore && typeof this.dataCore.clearChatData === 'function') {
                await this.dataCore.clearChatData(chatId);
                console.log('[DataSnapshotManager] ✅ 数据核心状态已清空');
            } else {
                console.warn('[DataSnapshotManager] ⚠️ 数据核心不支持清空操作');
            }
        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 清空数据核心失败:', error);
        }
    }

    /**
     * 判断是否为有意义的数据变更
     * @param {Object} data - 变更数据
     * @returns {boolean} 是否有意义
     */
    isSignificantDataChange(data) {
        // 只有包含面板数据的变更才认为是有意义的
        return data && data.data && typeof data.data === 'object';
    }

    /**
     * 验证快照数据完整性
     * @param {Object} snapshot - 快照对象
     * @returns {boolean} 是否有效
     */
    validateSnapshotData(snapshot) {
        return snapshot &&
               snapshot.data &&
               typeof snapshot.data === 'object' &&
               snapshot.timestamp &&
               snapshot.id;
    }

    /**
     * 生成快照ID
     * @param {string} chatId - 聊天ID
     * @param {number} messageFloor - 消息楼层
     * @returns {string} 快照ID
     */
    generateSnapshotId(chatId, messageFloor) {
        const timestamp = Date.now();
        const chatHash = this.simpleHash(chatId);
        return `snapshot_${chatHash}_floor_${messageFloor}_${timestamp}`;
    }

    /**
     * 计算数据大小
     * @param {Object} data - 数据对象
     * @returns {number} 数据大小（字节）
     */
    calculateDataSize(data) {
        try {
            return JSON.stringify(data).length;
        } catch (error) {
            return 0;
        }
    }

    /**
     * 深度克隆对象
     * @param {Object} obj - 要克隆的对象
     * @returns {Object} 克隆后的对象
     */
    deepClone(obj) {
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 深度克隆失败:', error);
            return {};
        }
    }

    /**
     * 简单哈希函数
     * @param {string} str - 要哈希的字符串
     * @returns {string} 哈希值
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * 获取快照统计信息
     * @param {string} chatId - 聊天ID
     * @returns {Object} 统计信息
     */
    getSnapshotStats(chatId) {
        try {
            if (!this.snapshots.has(chatId)) {
                return {
                    total: 0,
                    totalSize: 0,
                    oldestFloor: null,
                    newestFloor: null
                };
            }

            const chatSnapshots = this.snapshots.get(chatId);
            const floors = chatSnapshots.map(s => s.messageFloor).sort((a, b) => a - b);
            const totalSize = chatSnapshots.reduce((sum, s) => sum + this.calculateDataSize(s.data), 0);

            return {
                total: chatSnapshots.length,
                totalSize: totalSize,
                oldestFloor: floors[0] || null,
                newestFloor: floors[floors.length - 1] || null
            };

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 获取快照统计失败:', error);
            return { total: 0, totalSize: 0, oldestFloor: null, newestFloor: null };
        }
    }

    /**
     * 错误处理
     * @param {Error} error - 错误对象
     */
    handleError(error) {
        this.errorCount++;
        console.error('[DataSnapshotManager] ❌ 错误计数:', this.errorCount);

        if (this.eventSystem) {
            this.eventSystem.emit('snapshot:error', {
                error: error.message,
                timestamp: Date.now(),
                errorCount: this.errorCount
            });
        }
    }

    /**
     * 销毁管理器
     */
    destroy() {
        try {
            console.log('[DataSnapshotManager] 🔧 销毁数据快照管理器...');

            // 清理所有快照
            this.snapshots.clear();
            this.snapshotMetadata.clear();
            this.currentFloors.clear();

            // 移除事件监听
            if (this.eventSystem) {
                this.eventSystem.off('infobar:data:stored');
                this.eventSystem.off('chat:data:changed');
                this.eventSystem.off('message:deleted');
                this.eventSystem.off('message:regenerated');
                this.eventSystem.off('chat:changed');
            }

            this.initialized = false;
            console.log('[DataSnapshotManager] ✅ 数据快照管理器已销毁');

        } catch (error) {
            console.error('[DataSnapshotManager] ❌ 销毁失败:', error);
        }
    }
}