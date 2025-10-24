/**
 * 向量化总结管理器
 * 
 * 负责管理AI记忆总结的向量化处理：
 * - 监听AI记忆总结创建事件
 * - 累积AI记忆总结到达总结楼层
 * - 调用向量化API处理总结
 * - 管理已向量化的总结记录
 * 
 * @class VectorizedSummaryManager
 */

export class VectorizedSummaryManager {
    constructor(dependencies = {}) {
        console.log('[VectorizedSummaryManager] 🔮 向量化总结管理器初始化开始');

        // 🔧 依赖注入
        this.unifiedDataCore = dependencies.unifiedDataCore || window.InfoBarData;
        this.eventSystem = dependencies.eventSystem || window.SillyTavernInfobar?.eventSource;
        this.customVectorAPI = dependencies.customVectorAPI;

        // 🔧 设置
        this.settings = {
            enabled: false,
            floorCount: 20,
            autoHideEnabled: false
        };

        // 🔧 数据存储
        this.pendingSummaries = []; // 待向量化的AI记忆总结
        this.vectorizedRecords = []; // 已向量化的总结记录
        this.currentFloor = 0; // 当前楼层计数

        // 🔧 状态
        this.initialized = false;
        this.errorCount = 0;

        console.log('[VectorizedSummaryManager] 📊 向量化总结管理器初始化完成');
    }

    /**
     * 初始化向量化总结管理器
     */
    async init() {
        try {
            console.log('[VectorizedSummaryManager] 🚀 开始初始化向量化总结管理器...');

            // 加载设置
            await this.loadSettings();

            // 加载待向量化总结
            await this.loadPendingSummaries();

            // 加载已向量化记录
            await this.loadVectorizedRecords();

            // 绑定事件监听器
            this.bindEventListeners();

            this.initialized = true;
            console.log('[VectorizedSummaryManager] ✅ 向量化总结管理器初始化完成');

        } catch (error) {
            console.error('[VectorizedSummaryManager] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 加载设置
     */
    async loadSettings() {
        try {
            const context = SillyTavern?.getContext?.();
            const extensionSettings = context?.extensionSettings?.['Information bar integration tool'];
            const vectorizedSummarySettings = extensionSettings?.vectorizedSummary?.settings;

            if (vectorizedSummarySettings && typeof vectorizedSummarySettings === 'object') {
                this.settings = { ...this.settings, ...vectorizedSummarySettings };
                console.log('[VectorizedSummaryManager] ✅ 从扩展设置加载配置:', this.settings);
            }

        } catch (error) {
            console.error('[VectorizedSummaryManager] ❌ 加载设置失败:', error);
        }
    }

    /**
     * 保存设置
     */
    async saveSettings() {
        try {
            const context = SillyTavern?.getContext?.();
            if (context?.extensionSettings) {
                if (!context.extensionSettings['Information bar integration tool']) {
                    context.extensionSettings['Information bar integration tool'] = {};
                }
                if (!context.extensionSettings['Information bar integration tool'].vectorizedSummary) {
                    context.extensionSettings['Information bar integration tool'].vectorizedSummary = {};
                }

                context.extensionSettings['Information bar integration tool'].vectorizedSummary.settings = this.settings;

                // 🔧 修复：调用saveSettingsDebounced持久化到settings.json
                if (context.saveSettingsDebounced) {
                    await context.saveSettingsDebounced();
                }

                console.log('[VectorizedSummaryManager] ✅ 设置已保存');
            }

        } catch (error) {
            console.error('[VectorizedSummaryManager] ❌ 保存设置失败:', error);
        }
    }

    /**
     * 加载待向量化总结
     */
    async loadPendingSummaries() {
        try {
            const context = SillyTavern?.getContext?.();
            const chatId = context?.chatId;

            if (!chatId) {
                console.log('[VectorizedSummaryManager] ⚠️ 没有活动聊天，跳过加载待向量化总结');
                return;
            }

            const extensionSettings = context?.extensionSettings?.['Information bar integration tool'];
            const vectorizedSummarySettings = extensionSettings?.vectorizedSummary || {};
            const chatSummaries = vectorizedSummarySettings[chatId] || {};
            this.pendingSummaries = chatSummaries.pendingSummaries || [];
            this.currentFloor = chatSummaries.currentFloor || 0;

            console.log('[VectorizedSummaryManager] ✅ 加载待向量化总结:', {
                chatId,
                count: this.pendingSummaries.length,
                currentFloor: this.currentFloor
            });

        } catch (error) {
            console.error('[VectorizedSummaryManager] ❌ 加载待向量化总结失败:', error);
        }
    }

    /**
     * 保存待向量化总结
     */
    async savePendingSummaries() {
        try {
            const context = SillyTavern?.getContext?.();
            const chatId = context?.chatId;

            if (!chatId) {
                console.warn('[VectorizedSummaryManager] ⚠️ 没有活动聊天，无法保存待向量化总结');
                return;
            }

            const extensionSettings = context?.extensionSettings?.['Information bar integration tool'];
            if (!extensionSettings.vectorizedSummary) {
                extensionSettings.vectorizedSummary = {};
            }
            if (!extensionSettings.vectorizedSummary[chatId]) {
                extensionSettings.vectorizedSummary[chatId] = {};
            }

            extensionSettings.vectorizedSummary[chatId].pendingSummaries = this.pendingSummaries;
            extensionSettings.vectorizedSummary[chatId].currentFloor = this.currentFloor;

            console.log('[VectorizedSummaryManager] ✅ 待向量化总结已保存:', {
                chatId,
                count: this.pendingSummaries.length,
                currentFloor: this.currentFloor
            });

            // 触发事件通知UI更新
            if (this.eventSystem) {
                this.eventSystem.emit('vectorized-summary:pending-updated', {
                    chatId,
                    count: this.pendingSummaries.length,
                    currentFloor: this.currentFloor
                });
            }

        } catch (error) {
            console.error('[VectorizedSummaryManager] ❌ 保存待向量化总结失败:', error);
        }
    }

    /**
     * 加载已向量化记录
     */
    async loadVectorizedRecords() {
        try {
            const context = SillyTavern?.getContext?.();
            const chatId = context?.chatId;

            if (!chatId) {
                console.log('[VectorizedSummaryManager] ⚠️ 没有活动聊天，跳过加载已向量化记录');
                return;
            }

            const extensionSettings = context?.extensionSettings?.['Information bar integration tool'];
            const vectorizedSummarySettings = extensionSettings?.vectorizedSummary || {};
            const chatSummaries = vectorizedSummarySettings[chatId] || {};
            this.vectorizedRecords = chatSummaries.vectorizedRecords || [];

            console.log('[VectorizedSummaryManager] ✅ 加载已向量化记录:', {
                chatId,
                count: this.vectorizedRecords.length
            });

        } catch (error) {
            console.error('[VectorizedSummaryManager] ❌ 加载已向量化记录失败:', error);
        }
    }

    /**
     * 保存已向量化记录
     */
    async saveVectorizedRecords() {
        try {
            const context = SillyTavern?.getContext?.();
            const chatId = context?.chatId;

            if (!chatId) {
                console.warn('[VectorizedSummaryManager] ⚠️ 没有活动聊天，无法保存已向量化记录');
                return;
            }

            const extensionSettings = context?.extensionSettings?.['Information bar integration tool'];
            if (!extensionSettings.vectorizedSummary) {
                extensionSettings.vectorizedSummary = {};
            }
            if (!extensionSettings.vectorizedSummary[chatId]) {
                extensionSettings.vectorizedSummary[chatId] = {};
            }

            extensionSettings.vectorizedSummary[chatId].vectorizedRecords = this.vectorizedRecords;

            // 🔧 修复：调用saveSettingsDebounced持久化到settings.json
            if (context.saveSettingsDebounced) {
                await context.saveSettingsDebounced();
            }

            console.log('[VectorizedSummaryManager] ✅ 已向量化记录已保存:', {
                chatId,
                count: this.vectorizedRecords.length
            });

            // 触发事件通知UI更新
            if (this.eventSystem) {
                this.eventSystem.emit('vectorized-summary:records-updated', {
                    chatId,
                    count: this.vectorizedRecords.length
                });
            }

        } catch (error) {
            console.error('[VectorizedSummaryManager] ❌ 保存已向量化记录失败:', error);
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        try {
            console.log('[VectorizedSummaryManager] 🔗 绑定事件监听器...');

            if (!this.eventSystem) {
                console.warn('[VectorizedSummaryManager] ⚠️ 事件系统未找到');
                return;
            }

            // 监听AI记忆总结创建事件
            this.eventSystem.on('ai-summary:created', (data) => {
                this.handleAISummaryCreated(data);
            });

            // 监听聊天切换事件
            this.eventSystem.on('chat:changed', (data) => {
                this.handleChatChanged(data);
            });

            // 🔧 新增：监听消息删除事件
            this.eventSystem.on('message:deleted', (data) => {
                this.handleMessageDeleted(data);
            });

            console.log('[VectorizedSummaryManager] ✅ 事件监听器绑定完成');

        } catch (error) {
            console.error('[VectorizedSummaryManager] ❌ 绑定事件监听器失败:', error);
        }
    }

    /**
     * 处理AI记忆总结创建事件
     */
    async handleAISummaryCreated(data) {
        try {
            if (!this.settings.enabled) {
                console.log('[VectorizedSummaryManager] ⏸️ 向量化总结已禁用，跳过处理');
                return;
            }

            console.log('[VectorizedSummaryManager] 📨 收到AI记忆总结创建事件:', data);

            // 🔧 修复：使用实际的楼层号
            const floorNumber = data.floorNumber || 0;

            // 添加到待向量化列表
            this.pendingSummaries.push({
                summary: data.summary,
                timestamp: data.timestamp || Date.now(),
                messageCount: data.messageCount || 1,
                floorNumber: floorNumber // 🔧 新增：楼层号
            });

            // 🔧 修复：更新当前楼层为最新的楼层号
            this.currentFloor = floorNumber;

            // 保存待向量化总结
            await this.savePendingSummaries();

            console.log('[VectorizedSummaryManager] ✅ AI记忆总结已添加到待向量化列表:', {
                currentFloor: this.currentFloor,
                pendingCount: this.pendingSummaries.length,
                floorThreshold: this.settings.floorCount
            });

            // 🔧 修复：检查是否达到总结楼层（使用模运算）
            // 例如：总结楼层为20，当楼层号为20、40、60...时触发向量化
            if (this.currentFloor > 0 && this.currentFloor % this.settings.floorCount === 0) {
                console.log('[VectorizedSummaryManager] 🎯 达到总结楼层，开始向量化处理...');
                await this.vectorizeSummaries();
            }

        } catch (error) {
            console.error('[VectorizedSummaryManager] ❌ 处理AI记忆总结创建事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 处理聊天切换事件
     */
    async handleChatChanged(data) {
        try {
            console.log('[VectorizedSummaryManager] 🔄 聊天切换事件:', data);

            // 重新加载数据
            await this.loadPendingSummaries();
            await this.loadVectorizedRecords();

        } catch (error) {
            console.error('[VectorizedSummaryManager] ❌ 处理聊天切换事件失败:', error);
        }
    }

    /**
     * 🔧 新增：处理消息删除事件
     */
    async handleMessageDeleted(data) {
        try {
            console.log('[VectorizedSummaryManager] 🗑️ 处理消息删除事件');

            // 检查是否需要跳过回溯（用户消息删除）
            if (data && data.skipRollback === true) {
                console.log('[VectorizedSummaryManager] ℹ️ 跳过处理（删除的是用户消息）');
                return;
            }

            // 🔧 策略：删除最近的AI记忆总结记录（5分钟内的）
            const now = Date.now();
            const recentThreshold = 5 * 60 * 1000; // 5分钟

            const beforeCount = this.pendingSummaries.length;

            // 过滤掉最近的总结
            this.pendingSummaries = this.pendingSummaries.filter(item => {
                return now - item.timestamp > recentThreshold;
            });

            const deletedCount = beforeCount - this.pendingSummaries.length;

            if (deletedCount > 0) {
                console.log(`[VectorizedSummaryManager] 🗑️ 已删除 ${deletedCount} 条最近的AI记忆总结记录`);

                // 保存更新后的数据
                await this.savePendingSummaries();

                // 🔧 新增：触发UI更新事件
                if (this.eventSystem) {
                    this.eventSystem.emit('vectorized-summary:pending-updated', {
                        pendingCount: this.pendingSummaries.length,
                        deletedCount: deletedCount,
                        timestamp: Date.now()
                    });
                }
            } else {
                console.log('[VectorizedSummaryManager] ℹ️ 没有需要删除的AI记忆总结记录');
            }

        } catch (error) {
            console.error('[VectorizedSummaryManager] ❌ 处理消息删除事件失败:', error);
        }
    }

    /**
     * 向量化总结
     * @param {Function} progressCallback - 进度回调函数 (progress, message)
     */
    async vectorizeSummaries(progressCallback = null) {
        try {
            console.log('[VectorizedSummaryManager] 🔮 开始向量化总结...');

            if (!this.pendingSummaries || this.pendingSummaries.length === 0) {
                console.log('[VectorizedSummaryManager] ℹ️ 没有待向量化的总结');
                return;
            }

            const totalSummaries = this.pendingSummaries.length;
            console.log(`[VectorizedSummaryManager] 📊 待向量化总结数量: ${totalSummaries}`);

            // 🔧 获取当前聊天ID
            const context = window.SillyTavern?.getContext?.();
            const chatId = context?.chatId;

            if (!chatId) {
                throw new Error('无法获取当前聊天ID');
            }

            // 🔧 获取扩展配置
            const extCfg = context?.extensionSettings?.['Information bar integration tool'] || {};
            const vectorAPIConfig = extCfg.vectorAPIConfig || {};

            // 检查向量化API配置
            if (!vectorAPIConfig.baseUrl || !vectorAPIConfig.apiKey) {
                throw new Error('请先在"自定义API"面板中配置向量化API（点击"🧠 向量化API"按钮）');
            }

            // 🔧 获取向量化模块
            const infoBarTool = window.SillyTavernInfobar;
            const vectorRetrieval = infoBarTool?.modules?.vectorizedMemoryRetrieval;

            if (!vectorRetrieval || !vectorRetrieval.customVectorAPI) {
                throw new Error('向量化模块未找到');
            }

            // 🔧 更新向量化API配置
            vectorRetrieval.customVectorAPI.updateConfig({
                url: vectorAPIConfig.baseUrl,
                apiKey: vectorAPIConfig.apiKey,
                model: vectorAPIConfig.model || 'text-embedding-ada-002'
            });

            console.log('[VectorizedSummaryManager] 🔧 使用向量化API配置:', {
                url: vectorAPIConfig.baseUrl,
                model: vectorAPIConfig.model
            });

            if (progressCallback) {
                progressCallback(10, '准备向量化数据...');
            }

            // 🔧 生成集合ID（使用聊天ID和模型名称）
            const cleanChatId = chatId.replace(/[^a-zA-Z0-9_-]/g, '_');
            const cleanModelName = (vectorAPIConfig.model || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
            const collectionId = `${cleanChatId}/${cleanModelName}`;

            console.log('[VectorizedSummaryManager] 📦 集合ID:', collectionId);

            // 🔧 准备向量化数据项
            const items = [];
            const embeddings = {}; // 🔧 修复：embeddings应该是对象，键是文本，值是向量

            for (let i = 0; i < totalSummaries; i++) {
                const summaryData = this.pendingSummaries[i];

                // 🔧 修复：从summary对象中提取content
                const summaryContent = summaryData.summary?.content || summaryData.content || '';
                const floorInfo = summaryData.floorNumber > 0 ? `楼层${summaryData.floorNumber}` : '';
                const text = `【总结 #${i + 1}${floorInfo ? ` (${floorInfo})` : ''}】\n${summaryContent}`;

                if (progressCallback) {
                    const progress = 10 + (i / totalSummaries) * 60; // 10% - 70%
                    progressCallback(progress, `正在向量化总结 ${i + 1}/${totalSummaries}...`);
                }

                try {
                    // 🔧 使用customVectorAPI进行向量化
                    const vector = await vectorRetrieval.customVectorAPI.vectorizeText(text);

                    items.push({
                        hash: this.generateHash(text + Date.now() + i),
                        text: text,
                        metadata: {
                            summaryIndex: i,
                            floorNumber: summaryData.floorNumber,
                            timestamp: summaryData.timestamp || Date.now()
                        }
                    });

                    // 🔧 修复：embeddings是对象，键是文本内容，值是向量数组
                    embeddings[text] = vector;

                    console.log(`[VectorizedSummaryManager] ✅ 总结 ${i + 1} 向量化成功`);

                } catch (error) {
                    console.error(`[VectorizedSummaryManager] ❌ 总结 ${i + 1} 向量化失败:`, error);
                    throw new Error(`向量化第 ${i + 1} 个总结失败: ${error.message}`);
                }
            }

            if (progressCallback) {
                progressCallback(70, '保存向量数据到后端...');
            }

            // 🔧 调用SillyTavern向量API保存数据
            const insertPayload = {
                collectionId: collectionId,
                items: items,
                source: 'webllm',  // 🔧 修复：使用webllm作为source，与向量功能保持一致
                embeddings: embeddings
            };

            console.log('[VectorizedSummaryManager] 📤 开始保存向量数据到后端API...');
            console.log('[VectorizedSummaryManager] 📊 集合ID:', collectionId);
            console.log('[VectorizedSummaryManager] 📊 数据项数:', items.length);
            console.log('[VectorizedSummaryManager] 📦 完整payload:', JSON.stringify(insertPayload, null, 2));

            const response = await fetch('/api/vector/insert', {
                method: 'POST',
                headers: context.getRequestHeaders(),
                body: JSON.stringify(insertPayload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`向量API插入失败 (${response.status}): ${errorText}`);
            }

            console.log('[VectorizedSummaryManager] ✅ 向量数据已保存到后端API');

            if (progressCallback) {
                progressCallback(90, '保存向量化记录...');
            }

            // 🔧 创建向量化记录（只保存元数据，不保存向量数据）
            // 🔧 修复：使用UI期望的数据结构（startFloor, endFloor, vectorCount）
            const floorNumbers = this.pendingSummaries.map(s => s.floorNumber || 0);
            const minFloor = Math.min(...floorNumbers);
            const maxFloor = Math.max(...floorNumbers);

            const vectorizedRecord = {
                id: `vectorized_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                collectionId: collectionId,
                startFloor: minFloor,  // 🔧 修复：使用startFloor而不是floorRange.min
                endFloor: maxFloor,    // 🔧 修复：使用endFloor而不是floorRange.max
                vectorCount: totalSummaries,  // 🔧 修复：使用vectorCount而不是summaryCount
                timestamp: Date.now(),
                summaries: this.pendingSummaries.map(s => ({
                    content: s.summary?.content || s.content || '',
                    floorNumber: s.floorNumber,
                    timestamp: s.timestamp,
                    importance: s.summary?.importance || 0.5,
                    tags: s.summary?.tags || [],
                    category: s.summary?.category || ''
                }))
            };

            // 🔧 添加到已向量化记录列表
            this.vectorizedRecords.push(vectorizedRecord);

            // 🔧 清空待向量化列表
            this.pendingSummaries = [];
            this.currentFloor = 0;

            // 🔧 保存数据
            await this.saveVectorizedRecords();
            await this.savePendingSummaries();

            if (progressCallback) {
                progressCallback(100, '向量化完成！');
            }

            // 🔧 触发向量化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('vectorized-summary:completed', {
                    record: vectorizedRecord,
                    summaryCount: totalSummaries,
                    timestamp: Date.now()
                });
            }

            console.log('[VectorizedSummaryManager] ✅ 向量化总结完成');

        } catch (error) {
            console.error('[VectorizedSummaryManager] ❌ 向量化总结失败:', error);
            this.handleError(error);
            throw error;
        }
    }

    /**
     * 🔧 生成哈希值
     */
    generateHash(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[VectorizedSummaryManager] ❌ 错误:', error);
    }
}

