/**
 * 记忆自动维护系统
 * 
 * 核心功能：
 * - 聊天级别记忆隔离（确保聊天A和聊天B的记忆完全独立）
 * - 消息删除/重生成记忆同步（及时清理已删除消息的记忆）
 * - 智能记忆清理（识别过时、冗余记忆）
 * - 记忆压缩优化（合并相似记忆、摘要化）
 * - 记忆质量评估（准确性验证、冲突检测）
 * - 自动维护任务调度
 * 
 * @class MemoryMaintenanceSystem
 */

export class MemoryMaintenanceSystem {
    constructor(unifiedDataCore, eventSystem, deepMemoryManager, vectorizedMemoryRetrieval) {
        console.log('[MemoryMaintenanceSystem] 🔧 记忆自动维护系统初始化开始');
        
        this.unifiedDataCore = unifiedDataCore;
        this.eventSystem = eventSystem;
        this.deepMemoryManager = deepMemoryManager;
        this.vectorizedMemoryRetrieval = vectorizedMemoryRetrieval;
        
        // 维护系统设置
        this.settings = {
            enabled: false,                         // 🔧 修复：默认禁用自动维护
            autoCleanup: true,                      // 自动清理
            autoCompression: true,                  // 自动压缩
            autoQualityCheck: true,                 // 自动质量检查
            
            // 清理策略
            maxMemoryAge: 90 * 24 * 60 * 60 * 1000, // 90天（毫秒）
            lowImportanceThreshold: 0.3,            // 低重要性阈值
            redundancyThreshold: 0.9,               // 冗余相似度阈值
            
            // 压缩策略
            similarityThreshold: 0.85,              // 相似记忆合并阈值
            maxMemoryLength: 500,                   // 最大记忆长度（字符）
            compressionRatio: 0.7,                  // 压缩比率
            
            // 维护调度
            maintenanceInterval: 60 * 60 * 1000,    // 1小时（毫秒）
            immediateCleanupOnDelete: true,         // 删除消息时立即清理
            immediateCleanupOnRegenerate: true      // 重新生成时立即清理
        };
        
        // 聊天级别记忆存储（核心：确保聊天隔离）
        this.chatMemories = new Map();              // chatId -> { memories, metadata }
        this.currentChatId = null;                  // 当前活动聊天ID
        
        // 维护任务队列
        this.maintenanceQueue = [];
        this.maintenanceInProgress = false;
        this.maintenanceTimer = null;
        
        // 统计信息
        this.stats = {
            totalCleanups: 0,                       // 总清理次数
            totalCompressions: 0,                   // 总压缩次数
            totalQualityChecks: 0,                  // 总质量检查次数
            memoriesRemoved: 0,                     // 移除的记忆数
            memoriesCompressed: 0,                  // 压缩的记忆数
            conflictsResolved: 0,                   // 解决的冲突数
            lastMaintenanceTime: 0                  // 最后维护时间
        };
        
        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        
        console.log('[MemoryMaintenanceSystem] 🏗️ 构造函数完成');
    }

    /**
     * 初始化记忆维护系统
     */
    async init() {
        try {
            console.log('[MemoryMaintenanceSystem] 📊 开始初始化记忆维护系统...');

            // 加载设置
            await this.loadSettings();

            // 🔧 修复：如果禁用，跳过初始化
            if (!this.settings.enabled) {
                console.log('[MemoryMaintenanceSystem] ⏸️ 记忆维护系统已禁用，跳过初始化');
                this.initialized = true;
                return;
            }

            // 获取当前聊天ID
            this.currentChatId = this.unifiedDataCore?.getCurrentChatId?.();
            console.log('[MemoryMaintenanceSystem] 📍 当前聊天ID:', this.currentChatId);

            // 绑定事件监听器
            this.bindEventListeners();

            // 启动自动维护调度
            this.startMaintenanceScheduler();

            this.initialized = true;
            console.log('[MemoryMaintenanceSystem] ✅ 记忆维护系统初始化完成');

            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('memory-maintenance:initialized', {
                    timestamp: Date.now(),
                    currentChatId: this.currentChatId
                });
            }

        } catch (error) {
            console.error('[MemoryMaintenanceSystem] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 加载设置
     */
    async loadSettings() {
        try {
            // 🔧 修复：优先从extensionSettings加载设置
            try {
                const context = SillyTavern?.getContext?.();
                const extensionSettings = context?.extensionSettings?.['Information bar integration tool'];
                const memoryEnhancement = extensionSettings?.memoryEnhancement;

                if (memoryEnhancement?.enhancement?.memoryMaintenance !== undefined) {
                    this.settings.enabled = memoryEnhancement.enhancement.memoryMaintenance;
                    console.log('[MemoryMaintenanceSystem] 📥 从extensionSettings加载enabled:', this.settings.enabled);
                }
            } catch (error) {
                console.warn('[MemoryMaintenanceSystem] ⚠️ 从extensionSettings加载设置失败:', error);
            }

            // 向后兼容：从unifiedDataCore加载其他设置
            if (this.unifiedDataCore) {
                const savedSettings = await this.unifiedDataCore.getData('memory_maintenance_settings');
                if (savedSettings) {
                    this.settings = { ...savedSettings, ...this.settings };
                    console.log('[MemoryMaintenanceSystem] ✅ 设置已加载:', this.settings);
                }
            }

        } catch (error) {
            console.error('[MemoryMaintenanceSystem] ❌ 加载设置失败:', error);
        }
    }

    /**
     * 🔧 新增：更新设置
     */
    async updateSettings(newSettings) {
        try {
            console.log('[MemoryMaintenanceSystem] 🔄 更新设置:', newSettings);

            const oldEnabled = this.settings.enabled;
            this.settings = { ...this.settings, ...newSettings };

            // 如果启用状态改变
            if (newSettings.hasOwnProperty('enabled') && oldEnabled !== newSettings.enabled) {
                if (newSettings.enabled) {
                    console.log('[MemoryMaintenanceSystem] ✅ 启用记忆维护系统');
                    this.startMaintenanceScheduler();
                } else {
                    console.log('[MemoryMaintenanceSystem] ⏸️ 禁用记忆维护系统');
                    this.stopMaintenanceScheduler();
                }
            }

            // 保存设置
            if (this.unifiedDataCore) {
                await this.unifiedDataCore.setData('memory_maintenance_settings', this.settings);
            }

            console.log('[MemoryMaintenanceSystem] ✅ 设置更新完成');

        } catch (error) {
            console.error('[MemoryMaintenanceSystem] ❌ 更新设置失败:', error);
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        try {
            if (!this.eventSystem) {
                console.warn('[MemoryMaintenanceSystem] ⚠️ 事件系统未提供，跳过事件绑定');
                return;
            }
            
            // 🔧 核心：监听聊天切换事件（确保记忆隔离）
            this.eventSystem.on('chat:changed', async (data) => {
                await this.handleChatSwitch(data);
            });
            
            // 🔧 核心：监听消息删除事件（及时清理记忆）
            this.eventSystem.on('message:deleted', async (data) => {
                await this.handleMessageDeleted(data);
            });
            
            // 🔧 核心：监听消息重新生成事件（及时清理记忆）
            this.eventSystem.on('message:regenerated', async (data) => {
                await this.handleMessageRegenerated(data);
            });
            
            console.log('[MemoryMaintenanceSystem] 🔗 事件监听器已绑定');
            
        } catch (error) {
            console.error('[MemoryMaintenanceSystem] ❌ 绑定事件监听器失败:', error);
        }
    }

    /**
     * 🔧 核心功能：处理聊天切换事件（确保记忆隔离）
     */
    async handleChatSwitch(data) {
        try {
            console.log('[MemoryMaintenanceSystem] 🔄 处理聊天切换事件');

            if (!this.settings.enabled) return;

            // 获取新的聊天ID（优先使用data中的chatId，否则从UnifiedDataCore获取）
            const newChatId = data?.chatId || this.unifiedDataCore?.getCurrentChatId?.();
            if (!newChatId || newChatId === this.currentChatId) {
                console.log('[MemoryMaintenanceSystem] ℹ️ 聊天ID未变化，跳过处理');
                return;
            }

            console.log('[MemoryMaintenanceSystem] 🔄 聊天切换:', this.currentChatId, '->', newChatId);
            
            // 🔧 步骤1：保存当前聊天的记忆数据
            if (this.currentChatId) {
                await this.saveChatMemories(this.currentChatId);
            }

            // 🔧 步骤2：清理DeepMemoryManager的当前记忆层
            if (this.deepMemoryManager) {
                console.log('[MemoryMaintenanceSystem] 🧹 清理DeepMemoryManager记忆层...');
                this.deepMemoryManager.memoryLayers.sensory.clear();
                this.deepMemoryManager.memoryLayers.shortTerm.clear();
                this.deepMemoryManager.memoryLayers.longTerm.clear();
                this.deepMemoryManager.memoryLayers.deepArchive.clear();
                this.deepMemoryManager.memoryIndex.clear();
                this.deepMemoryManager.stats.totalMemories = 0;
            }

            // 🔧 步骤3：更新当前聊天ID
            this.currentChatId = newChatId;

            // 🔧 步骤4：加载新聊天的记忆数据
            await this.loadChatMemories(newChatId);

            // 🔧 步骤5：恢复DeepMemoryManager的记忆层
            await this.restoreChatMemoriesToDeepMemory(newChatId);
            
            console.log('[MemoryMaintenanceSystem] ✅ 聊天切换处理完成');
            
            // 触发聊天切换完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('memory-maintenance:chat-switched', {
                    oldChatId: this.currentChatId,
                    newChatId: newChatId,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            console.error('[MemoryMaintenanceSystem] ❌ 处理聊天切换事件失败:', error);
        }
    }

    /**
     * 🔧 核心功能：保存聊天记忆数据（确保聊天隔离）
     */
    async saveChatMemories(chatId) {
        try {
            if (!chatId) return;
            
            console.log('[MemoryMaintenanceSystem] 💾 保存聊天记忆数据:', chatId);
            
            // 从DeepMemoryManager获取当前记忆数据
            if (this.deepMemoryManager) {
                const memoryLayers = this.deepMemoryManager.memoryLayers;
                const chatMemoryData = {
                    chatId: chatId,
                    timestamp: Date.now(),
                    layers: {}
                };
                
                // 保存各层记忆
                for (const [layerName, layer] of Object.entries(memoryLayers)) {
                    chatMemoryData.layers[layerName] = Object.fromEntries(layer);
                }
                
                // 存储到chatMemories Map
                this.chatMemories.set(chatId, chatMemoryData);
                
                // 持久化到UnifiedDataCore（使用chatId作为键的一部分）
                const storageKey = `memory_maintenance_chat_${chatId}`;
                await this.unifiedDataCore.setData(storageKey, chatMemoryData);
                
                console.log('[MemoryMaintenanceSystem] ✅ 聊天记忆数据已保存:', chatId);
            }
            
        } catch (error) {
            console.error('[MemoryMaintenanceSystem] ❌ 保存聊天记忆数据失败:', error);
        }
    }

    /**
     * 🔧 核心功能：加载聊天记忆数据（确保聊天隔离）
     */
    async loadChatMemories(chatId) {
        try {
            if (!chatId) return;

            console.log('[MemoryMaintenanceSystem] 📥 加载聊天记忆数据:', chatId);

            // 先检查内存缓存
            let chatMemoryData = this.chatMemories.get(chatId);

            // 如果缓存中没有，从UnifiedDataCore加载
            if (!chatMemoryData) {
                const storageKey = `memory_maintenance_chat_${chatId}`;
                chatMemoryData = await this.unifiedDataCore.getData(storageKey);

                if (chatMemoryData) {
                    this.chatMemories.set(chatId, chatMemoryData);
                    console.log('[MemoryMaintenanceSystem] 📥 从存储加载聊天记忆数据:', chatId);
                } else {
                    console.log('[MemoryMaintenanceSystem] ℹ️ 新聊天，无历史记忆数据:', chatId);
                }
            }

            console.log('[MemoryMaintenanceSystem] ✅ 聊天记忆数据加载完成:', chatId);

        } catch (error) {
            console.error('[MemoryMaintenanceSystem] ❌ 加载聊天记忆数据失败:', error);
        }
    }

    /**
     * 🔧 核心功能：恢复聊天记忆到DeepMemoryManager（确保聊天隔离）
     */
    async restoreChatMemoriesToDeepMemory(chatId) {
        try {
            if (!chatId || !this.deepMemoryManager) return;

            console.log('[MemoryMaintenanceSystem] 🔄 恢复聊天记忆到DeepMemoryManager:', chatId);

            // 从缓存获取聊天记忆数据
            const chatMemoryData = this.chatMemories.get(chatId);

            if (!chatMemoryData || !chatMemoryData.layers) {
                console.log('[MemoryMaintenanceSystem] ℹ️ 无记忆数据需要恢复');
                return;
            }

            // 恢复各层记忆
            let restoredCount = 0;
            for (const [layerName, layerData] of Object.entries(chatMemoryData.layers)) {
                if (this.deepMemoryManager.memoryLayers[layerName]) {
                    for (const [id, memory] of Object.entries(layerData)) {
                        this.deepMemoryManager.memoryLayers[layerName].set(id, memory);
                        this.deepMemoryManager.memoryIndex.set(id, memory);
                        restoredCount++;
                    }
                }
            }

            // 更新统计
            this.deepMemoryManager.stats.totalMemories = restoredCount;

            console.log(`[MemoryMaintenanceSystem] ✅ 已恢复 ${restoredCount} 个记忆到DeepMemoryManager`);

        } catch (error) {
            console.error('[MemoryMaintenanceSystem] ❌ 恢复聊天记忆失败:', error);
        }
    }

    /**
     * 🔧 核心功能：处理消息删除事件（及时清理记忆）
     */
    async handleMessageDeleted(data) {
        try {
            console.log('[MemoryMaintenanceSystem] 🗑️ 处理消息删除事件');

            if (!this.settings.enabled) return;

            // 检查是否需要跳过回溯（用户消息删除）
            if (data && data.skipRollback === true) {
                console.log('[MemoryMaintenanceSystem] ℹ️ 跳过记忆清理（删除的是用户消息）');
                return;
            }

            console.log('[MemoryMaintenanceSystem] 🔄 开始清理已删除消息的记忆...');

            // 获取当前聊天ID
            const chatId = data?.chatId || this.currentChatId;
            if (!chatId) {
                console.warn('[MemoryMaintenanceSystem] ⚠️ 无法获取聊天ID，跳过记忆清理');
                return;
            }

            // 🔧 立即清理最近的记忆（感知记忆层）
            if (this.settings.immediateCleanupOnDelete) {
                await this.clearRecentMemories(chatId);
            }

            // 更新统计
            this.stats.totalCleanups++;

            console.log('[MemoryMaintenanceSystem] ✅ 消息删除记忆清理完成');

        } catch (error) {
            console.error('[MemoryMaintenanceSystem] ❌ 处理消息删除事件失败:', error);
        }
    }

    /**
     * 🔧 核心功能：处理消息重新生成事件（及时清理记忆）
     */
    async handleMessageRegenerated(data) {
        try {
            console.log('[MemoryMaintenanceSystem] 🔄 处理消息重新生成事件');

            if (!this.settings.enabled) return;

            // 获取当前聊天ID
            const chatId = data?.chatId || this.currentChatId;
            if (!chatId) {
                console.warn('[MemoryMaintenanceSystem] ⚠️ 无法获取聊天ID，跳过记忆清理');
                return;
            }

            console.log('[MemoryMaintenanceSystem] 🔄 开始清理重新生成消息的记忆...');

            // 🔧 立即清理最近的记忆
            if (this.settings.immediateCleanupOnRegenerate) {
                await this.clearRecentMemories(chatId);
            }

            // 更新统计
            this.stats.totalCleanups++;

            console.log('[MemoryMaintenanceSystem] ✅ 消息重新生成记忆清理完成');

        } catch (error) {
            console.error('[MemoryMaintenanceSystem] ❌ 处理消息重新生成事件失败:', error);
        }
    }

    /**
     * 🔧 清理最近的记忆（用于消息删除/重生成）
     */
    async clearRecentMemories(chatId) {
        try {
            console.log('[MemoryMaintenanceSystem] 🧹 清理最近的记忆...');

            if (!this.deepMemoryManager) {
                console.warn('[MemoryMaintenanceSystem] ⚠️ DeepMemoryManager未初始化');
                return;
            }

            // 清理感知记忆层（最近的记忆）
            const sensoryLayer = this.deepMemoryManager.memoryLayers.sensory;
            const threshold = Date.now() - (5 * 60 * 1000); // 最近5分钟的记忆

            let removedCount = 0;
            for (const [id, memory] of sensoryLayer) {
                if (memory.timestamp > threshold) {
                    sensoryLayer.delete(id);
                    this.deepMemoryManager.memoryIndex.delete(id);
                    removedCount++;
                }
            }

            // 更新统计
            this.deepMemoryManager.stats.totalMemories -= removedCount;
            this.stats.memoriesRemoved += removedCount;

            console.log(`[MemoryMaintenanceSystem] ✅ 已清理 ${removedCount} 个最近的记忆`);

            // 保存更新后的记忆数据
            if (this.deepMemoryManager.saveMemoryData) {
                await this.deepMemoryManager.saveMemoryData();
            }

        } catch (error) {
            console.error('[MemoryMaintenanceSystem] ❌ 清理最近记忆失败:', error);
        }
    }

    /**
     * 启动自动维护调度器
     */
    startMaintenanceScheduler() {
        try {
            if (this.maintenanceTimer) {
                clearInterval(this.maintenanceTimer);
            }

            console.log('[MemoryMaintenanceSystem] ⏰ 启动自动维护调度器，间隔:', this.settings.maintenanceInterval / 1000, '秒');

            this.maintenanceTimer = setInterval(async () => {
                await this.runMaintenance();
            }, this.settings.maintenanceInterval);

        } catch (error) {
            console.error('[MemoryMaintenanceSystem] ❌ 启动维护调度器失败:', error);
        }
    }

    /**
     * 停止自动维护调度器
     */
    stopMaintenanceScheduler() {
        if (this.maintenanceTimer) {
            clearInterval(this.maintenanceTimer);
            this.maintenanceTimer = null;
            console.log('[MemoryMaintenanceSystem] ⏸️ 自动维护调度器已停止');
        }
    }

    /**
     * 运行维护任务
     */
    async runMaintenance() {
        try {
            if (this.maintenanceInProgress) {
                console.log('[MemoryMaintenanceSystem] ⚠️ 维护任务正在进行中，跳过本次调度');
                return;
            }

            this.maintenanceInProgress = true;
            console.log('[MemoryMaintenanceSystem] 🔧 开始自动维护...');

            const startTime = Date.now();

            // 执行维护任务
            if (this.settings.autoCleanup) {
                await this.cleanupOutdatedMemories();
            }

            if (this.settings.autoCompression) {
                await this.compressRedundantMemories();
            }

            if (this.settings.autoQualityCheck) {
                await this.checkMemoryQuality();
            }

            // 更新统计
            this.stats.lastMaintenanceTime = Date.now();
            const duration = Date.now() - startTime;

            console.log(`[MemoryMaintenanceSystem] ✅ 自动维护完成，耗时: ${duration}ms`);

            // 触发维护完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('memory-maintenance:completed', {
                    duration: duration,
                    stats: this.stats,
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('[MemoryMaintenanceSystem] ❌ 运行维护任务失败:', error);
        } finally {
            this.maintenanceInProgress = false;
        }
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[MemoryMaintenanceSystem] ❌ 错误:', error);

        if (this.eventSystem) {
            this.eventSystem.emit('memory-maintenance:error', {
                error: error.message,
                timestamp: Date.now(),
                errorCount: this.errorCount
            });
        }
    }

    /**
     * 🔧 智能清理：清理过时记忆
     */
    async cleanupOutdatedMemories() {
        try {
            console.log('[MemoryMaintenanceSystem] 🧹 开始清理过时记忆...');

            if (!this.deepMemoryManager) return;

            const now = Date.now();
            let removedCount = 0;

            // 遍历所有记忆层
            for (const [layerName, layer] of Object.entries(this.deepMemoryManager.memoryLayers)) {
                for (const [id, memory] of layer) {
                    // 检查记忆年龄
                    const age = now - (memory.timestamp || 0);

                    // 检查重要性
                    const importance = memory.metadata?.importance || 0.5;

                    // 清理条件：
                    // 1. 超过最大年龄且重要性低
                    // 2. 深度归档层中超过最大年龄的记忆
                    if ((age > this.settings.maxMemoryAge && importance < this.settings.lowImportanceThreshold) ||
                        (layerName === 'deepArchive' && age > this.settings.maxMemoryAge * 2)) {

                        layer.delete(id);
                        this.deepMemoryManager.memoryIndex.delete(id);
                        removedCount++;
                    }
                }
            }

            // 更新统计
            this.deepMemoryManager.stats.totalMemories -= removedCount;
            this.stats.memoriesRemoved += removedCount;

            console.log(`[MemoryMaintenanceSystem] ✅ 已清理 ${removedCount} 个过时记忆`);

            // 保存更新
            if (removedCount > 0 && this.deepMemoryManager.saveMemoryData) {
                await this.deepMemoryManager.saveMemoryData();
            }

        } catch (error) {
            console.error('[MemoryMaintenanceSystem] ❌ 清理过时记忆失败:', error);
        }
    }

    /**
     * 🔧 智能压缩：合并冗余记忆
     */
    async compressRedundantMemories() {
        try {
            console.log('[MemoryMaintenanceSystem] 🗜️ 开始压缩冗余记忆...');

            if (!this.deepMemoryManager || !this.vectorizedMemoryRetrieval) return;

            let compressedCount = 0;

            // 遍历长期记忆层和深度归档层
            for (const layerName of ['longTerm', 'deepArchive']) {
                const layer = this.deepMemoryManager.memoryLayers[layerName];
                const memories = Array.from(layer.values());

                // 查找相似记忆对
                for (let i = 0; i < memories.length; i++) {
                    for (let j = i + 1; j < memories.length; j++) {
                        const mem1 = memories[i];
                        const mem2 = memories[j];

                        // 计算相似度
                        const similarity = await this.calculateMemorySimilarity(mem1, mem2);

                        // 如果相似度高，合并记忆
                        if (similarity > this.settings.similarityThreshold) {
                            await this.mergeMemories(mem1, mem2, layer);
                            compressedCount++;
                        }
                    }
                }
            }

            // 更新统计
            this.stats.memoriesCompressed += compressedCount;
            this.stats.totalCompressions++;

            console.log(`[MemoryMaintenanceSystem] ✅ 已压缩 ${compressedCount} 个冗余记忆`);

            // 保存更新
            if (compressedCount > 0 && this.deepMemoryManager.saveMemoryData) {
                await this.deepMemoryManager.saveMemoryData();
            }

        } catch (error) {
            console.error('[MemoryMaintenanceSystem] ❌ 压缩冗余记忆失败:', error);
        }
    }

    /**
     * 🔧 质量检查：检查记忆质量
     */
    async checkMemoryQuality() {
        try {
            console.log('[MemoryMaintenanceSystem] 🔍 开始检查记忆质量...');

            if (!this.deepMemoryManager) return;

            let conflictsFound = 0;
            let conflictsResolved = 0;

            // 检查记忆冲突
            const memories = Array.from(this.deepMemoryManager.memoryIndex.values());

            for (let i = 0; i < memories.length; i++) {
                for (let j = i + 1; j < memories.length; j++) {
                    const conflict = await this.detectMemoryConflict(memories[i], memories[j]);

                    if (conflict) {
                        conflictsFound++;

                        // 尝试解决冲突
                        const resolved = await this.resolveMemoryConflict(memories[i], memories[j]);
                        if (resolved) {
                            conflictsResolved++;
                        }
                    }
                }
            }

            // 更新统计
            this.stats.conflictsResolved += conflictsResolved;
            this.stats.totalQualityChecks++;

            console.log(`[MemoryMaintenanceSystem] ✅ 质量检查完成，发现 ${conflictsFound} 个冲突，解决 ${conflictsResolved} 个`);

        } catch (error) {
            console.error('[MemoryMaintenanceSystem] ❌ 检查记忆质量失败:', error);
        }
    }

    /**
     * 计算记忆相似度
     */
    async calculateMemorySimilarity(mem1, mem2) {
        try {
            // 简单的文本相似度计算（可以后续优化为向量相似度）
            const text1 = mem1.content || '';
            const text2 = mem2.content || '';

            if (!text1 || !text2) return 0;

            // 使用Jaccard相似度
            const words1 = new Set(text1.toLowerCase().split(/\s+/));
            const words2 = new Set(text2.toLowerCase().split(/\s+/));

            const intersection = new Set([...words1].filter(x => words2.has(x)));
            const union = new Set([...words1, ...words2]);

            return intersection.size / union.size;

        } catch (error) {
            console.error('[MemoryMaintenanceSystem] ❌ 计算相似度失败:', error);
            return 0;
        }
    }

    /**
     * 合并记忆
     */
    async mergeMemories(mem1, mem2, layer) {
        try {
            // 保留重要性更高的记忆，合并内容
            const importance1 = mem1.metadata?.importance || 0.5;
            const importance2 = mem2.metadata?.importance || 0.5;

            const primary = importance1 >= importance2 ? mem1 : mem2;
            const secondary = importance1 >= importance2 ? mem2 : mem1;

            // 合并内容
            primary.content = `${primary.content}\n[合并记忆] ${secondary.content}`;

            // 更新元数据
            primary.metadata.merged = true;
            primary.metadata.mergedCount = (primary.metadata.mergedCount || 0) + 1;
            primary.metadata.lastMergeTime = Date.now();

            // 删除次要记忆
            for (const [id, mem] of layer) {
                if (mem === secondary) {
                    layer.delete(id);
                    this.deepMemoryManager.memoryIndex.delete(id);
                    break;
                }
            }

        } catch (error) {
            console.error('[MemoryMaintenanceSystem] ❌ 合并记忆失败:', error);
        }
    }

    /**
     * 检测记忆冲突
     */
    async detectMemoryConflict(mem1, mem2) {
        try {
            // 简单的冲突检测：检查是否有矛盾的陈述
            // 这里可以后续使用AI进行更智能的冲突检测

            const text1 = (mem1.content || '').toLowerCase();
            const text2 = (mem2.content || '').toLowerCase();

            // 检测否定词
            const negationPatterns = ['不是', '不会', '没有', '不能', '不要'];

            for (const pattern of negationPatterns) {
                if (text1.includes(pattern) && text2.includes(pattern.replace('不', ''))) {
                    return true;
                }
            }

            return false;

        } catch (error) {
            console.error('[MemoryMaintenanceSystem] ❌ 检测冲突失败:', error);
            return false;
        }
    }

    /**
     * 解决记忆冲突
     */
    async resolveMemoryConflict(mem1, mem2) {
        try {
            // 简单的冲突解决：保留更新的记忆
            const time1 = mem1.timestamp || 0;
            const time2 = mem2.timestamp || 0;

            const older = time1 < time2 ? mem1 : mem2;

            // 标记旧记忆为已过时
            older.metadata.outdated = true;
            older.metadata.conflictResolvedTime = Date.now();

            return true;

        } catch (error) {
            console.error('[MemoryMaintenanceSystem] ❌ 解决冲突失败:', error);
            return false;
        }
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            initialized: this.initialized,
            enabled: this.settings.enabled,
            currentChatId: this.currentChatId,
            chatMemoriesCount: this.chatMemories.size,
            stats: this.stats,
            errorCount: this.errorCount
        };
    }
}

