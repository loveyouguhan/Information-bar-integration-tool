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

            // 触发快照创建事件
            if (this.eventSystem) {
                this.eventSystem.emit('snapshot:created', {
                    snapshotId,
                    chatId,
                    messageFloor,
                    timestamp: snapshot.timestamp
                });
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
                    console.error('[DataSnapshotManager] ❌ 无法找到任何有效快照');
                    return false;
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
                    return false;
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
                this.eventSystem.emit('snapshot:rollback:completed', {
                    chatId,
                    targetFloor: actualTargetFloor,
                    originalTargetFloor: targetFloor,
                    snapshotId: targetSnapshot.id,
                    timestamp: Date.now()
                });
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

            // 构建快照数据结构
            const state = {
                panels: {},
                metadata: {
                    lastUpdated: Date.now(),
                    chatId: chatId
                }
            };

            // 提取面板数据
            if (chatData.infobar_data && chatData.infobar_data.panels) {
                state.panels = this.deepClone(chatData.infobar_data.panels);
            }

            // 添加历史记录信息
            if (chatData.infobar_data && chatData.infobar_data.history) {
                state.metadata.historyCount = chatData.infobar_data.history.length;
            }

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

            // 获取当前聊天数据
            const chatData = await this.dataCore.getChatData(chatId) || {};

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
                    type: 'rollback',
                    panelCount: Object.keys(snapshotData.panels).length,
                    panels: Object.keys(snapshotData.panels)
                });

                // 限制历史记录数量
                if (chatData.infobar_data.history.length > 100) {
                    chatData.infobar_data.history = chatData.infobar_data.history.slice(-50);
                }
            }

            // 保存聊天数据
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
                await this.loadSnapshotsForChat(currentChatId);
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
                this.snapshots.set(chatId, persistedSnapshots);

                // 恢复元数据
                for (const snapshot of persistedSnapshots) {
                    this.snapshotMetadata.set(snapshot.id, snapshot.metadata);
                }

                console.log('[DataSnapshotManager] 📥 已加载', persistedSnapshots.length, '个快照:', chatId);
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
            console.log('[DataSnapshotManager] 🗑️ 检测到消息删除，开始数据回溯...');

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

            // 🔧 先清理被删消息对应楼层的快照，避免残留
            await this.removeSnapshotsForFloor(chatId, currentFloor + 1); // 清理可能的下一楼层快照

            // 执行回溯
            const success = await this.rollbackToSnapshot(chatId, targetFloor);

            if (success) {
                console.log('[DataSnapshotManager] ✅ 消息删除回溯成功');
            } else {
                console.warn('[DataSnapshotManager] ⚠️ 消息删除回溯失败');

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
                await this.loadSnapshotsForChat(chatId);
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

            // 🔧 策略3: 如果没有找到合适的快照，回溯到最早的快照
            const earliestSnapshot = chatSnapshots
                .sort((a, b) => a.messageFloor - b.messageFloor)[0];

            if (earliestSnapshot) {
                console.log('[DataSnapshotManager] ⚠️ 使用最早的快照作为回溯目标:', earliestSnapshot.messageFloor);
                return earliestSnapshot.messageFloor;
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
            console.log('[DataSnapshotManager] 🚨 回溯失败，执行降级处理...');

            // 🔧 降级策略1: 清空当前数据核心状态
            console.log('[DataSnapshotManager] 🧹 清空数据核心状态');
            await this.clearDataCore(chatId);

            // 🔧 降级策略2: 创建一个基础快照作为新的起点
            console.log('[DataSnapshotManager] 📸 创建基础快照作为新起点');
            await this.createSnapshot(chatId, Math.max(0, currentFloor - 1), {
                source: 'rollback_failure',
                trigger: 'fallback'
            });

            console.log('[DataSnapshotManager] ✅ 降级处理完成');

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