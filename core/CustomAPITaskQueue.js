/**
 * 自定义API任务队列管理系统
 * 解决自定义API模式下的频繁调用和并发问题
 *
 * 功能特性：
 * - 任务队列管理：确保API调用按顺序执行
 * - 防抖机制：避免频繁重复调用
 * - 优先级管理：重要任务优先执行
 * - 错误重试：失败任务自动重试
 * - 状态监控：实时监控队列状态
 */

export class CustomAPITaskQueue {
    constructor(dependencies = {}) {
        // 依赖注入
        this.infoBarSettings = dependencies.infoBarSettings || window.SillyTavernInfobar?.modules?.settings;
        this.eventSystem = dependencies.eventSystem || window.SillyTavernInfobar?.eventSource;

        // 任务队列
        this.taskQueue = [];
        this.processingTask = null;
        this.isProcessing = false;

        // 防抖配置
        this.debounceTimers = new Map();
        this.defaultDebounceDelay = 2000; // 2秒防抖

        // 优先级定义
        this.priorities = {
            CRITICAL: 1,    // 关键任务（用户手动触发）
            HIGH: 2,        // 高优先级（信息栏数据生成）
            MEDIUM: 3,      // 中优先级（总结生成）
            LOW: 4          // 低优先级（记忆处理）
        };

        // 任务类型配置
        this.taskTypes = {
            INFOBAR_DATA: {
                name: 'infobar_data',
                priority: this.priorities.HIGH,
                debounceDelay: 2000,
                maxRetries: 3,
                timeout: 9999000  // 默认9999秒
            },
            SUMMARY: {
                name: 'summary',
                priority: this.priorities.MEDIUM,
                debounceDelay: 5000,
                maxRetries: 2,
                timeout: 9999000  // 默认9999秒
            },
            MEMORY: {
                name: 'memory',
                priority: this.priorities.LOW,
                debounceDelay: 3000,
                maxRetries: 2,
                timeout: 9999000  // 默认9999秒
            },
            AI_MEMORY_SUMMARY: {
                name: 'ai_memory_summary',
                priority: this.priorities.MEDIUM,
                debounceDelay: 3000,
                maxRetries: 2,
                timeout: 9999000  // 默认9999秒
            },
            MANUAL: {
                name: 'manual',
                priority: this.priorities.CRITICAL,
                debounceDelay: 0,
                maxRetries: 5,
                timeout: 9999000  // 默认9999秒
            }
        };

        // 统计信息
        this.stats = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            averageProcessingTime: 0,
            lastProcessingTime: 0
        };
        // 冷却控制，避免短时间重复总结任务
        this.lastSummaryEnqueueTime = 0;
        this.summaryCooldownMs = 15000; // 15秒冷却

        // 🆕 延迟生成队列
        this.delayedTaskQueue = []; // 存储待延迟处理的任务
        this.aiMessageCounter = 0; // AI消息计数器

        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;

        console.log('[CustomAPITaskQueue] 任务队列管理系统初始化');
        this.init();
    }

    /**
     * 初始化任务队列系统
     */
    async init() {
        try {
            // 🔧 修复：仅恢复状态，不立即处理任务
            await this.restoreDelayedGenerationState(false);

            // 启动队列处理器
            this.startQueueProcessor();

            // 绑定事件监听器
            this.bindEventListeners();

            this.initialized = true;
            console.log('[CustomAPITaskQueue] ✅ 任务队列系统初始化完成');

        } catch (error) {
            console.error('[CustomAPITaskQueue] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 启动队列处理器
     */
    startQueueProcessor() {
        // 每100ms检查一次队列
        setInterval(() => {
            if (!this.isProcessing && this.taskQueue.length > 0) {
                this.processNextTask();
            }
        }, 100);

        console.log('[CustomAPITaskQueue] 🔄 队列处理器已启动');
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        if (this.eventSystem) {
            // 监听主API返回事件
            this.eventSystem.on('message_received', (data) => {
                this.handleMainAPIResponse(data);
            });

            // 监听生成结束事件
            this.eventSystem.on('generation_ended', (data) => {
                this.handleGenerationEnded(data);
            });

            // 🆕 监听自定义API内部完成事件（若上游触发此事件，则可提前结束可视倒计时）
            if (typeof this.eventSystem.on === 'function') {
                this.eventSystem.on('custom_api:done', () => {
                    console.log('[CustomAPITaskQueue] 🏁 收到 custom_api:done 事件');
                    // 标记当前任务已无须继续显示“进行中”提示
                    // 实际状态结算仍由processNextTask中的完成逻辑统一处理
                });
            }

            // 🔧 新增：监听聊天切换事件
            this.eventSystem.on('chat_changed', async (data) => {
                await this.handleChatSwitch(data);
            });

            console.log('[CustomAPITaskQueue] 🔗 事件监听器已绑定');
        }
    }

    /**
     * 🔧 新增：处理聊天切换事件
     */
    async handleChatSwitch(data) {
        try {
            console.log('[CustomAPITaskQueue] 🔄 检测到聊天切换，清理延迟生成状态...');

            // 保存当前聊天的延迟生成状态
            await this.saveDelayedGenerationState();

            // 清空当前状态
            this.aiMessageCounter = 0;
            this.delayedTaskQueue = [];

            console.log('[CustomAPITaskQueue] 🧹 延迟生成状态已清空');

            // 恢复新聊天的延迟生成状态（不立即处理）
            await this.restoreDelayedGenerationState(false);

            console.log('[CustomAPITaskQueue] ✅ 聊天切换处理完成');

        } catch (error) {
            console.error('[CustomAPITaskQueue] ❌ 处理聊天切换失败:', error);
        }
    }

    /**
     * 处理主API返回事件
     */
    async handleMainAPIResponse(data) {
        try {
            // 🔧 修复：message_received事件传递的是消息ID（数字），需要获取消息对象
            let messageData = data;

            // 如果data是数字（消息ID），从聊天中获取消息对象
            if (typeof data === 'number') {
                const context = SillyTavern?.getContext?.();
                const chat = context?.chat;
                if (!chat || !Array.isArray(chat)) {
                    console.log('[CustomAPITaskQueue] ⚠️ 无法获取聊天数据');
                    return;
                }

                messageData = chat[data];
                if (!messageData) {
                    console.log('[CustomAPITaskQueue] ⚠️ 无法找到消息ID对应的消息:', data);
                    return;
                }
            }

            // 检查是否为AI消息
            if (!messageData || messageData.is_user === true) {
                return;
            }

            console.log('[CustomAPITaskQueue] 📨 检测到主API返回，准备排队处理任务');

            // 🔧 新增：检查是否启用表格记录
            const context = SillyTavern?.getContext?.();
            const extensionSettings = context?.extensionSettings?.['Information bar integration tool'] || {};
            const basicSettings = extensionSettings.basic || {};
            const tableRecordsEnabled = basicSettings.tableRecords?.enabled !== false;

            console.log('[CustomAPITaskQueue] 🔧 表格记录启用状态:', tableRecordsEnabled);

            if (!tableRecordsEnabled) {
                console.log('[CustomAPITaskQueue] ℹ️ 表格记录已禁用，跳过信息栏数据生成任务');
                return;
            }

            // 🔧 新增：检查数据表格的API模式配置
            const tableRecordsAPIMode = basicSettings.tableRecords?.apiMode || 'auto';
            const apiConfig = extensionSettings.apiConfig || {};
            const isGlobalCustomAPIEnabled = apiConfig.enabled && apiConfig.apiKey && apiConfig.model;

            // 判断数据表格应该使用哪个API
            let tableRecordsTargetAPI = 'main';
            if (tableRecordsAPIMode === 'custom') {
                tableRecordsTargetAPI = 'custom';
            } else if (tableRecordsAPIMode === 'main') {
                tableRecordsTargetAPI = 'main';
            } else if (tableRecordsAPIMode === 'auto') {
                tableRecordsTargetAPI = isGlobalCustomAPIEnabled ? 'custom' : 'main';
            }

            console.log('[CustomAPITaskQueue] 🎯 数据表格API模式配置:', {
                apiMode: tableRecordsAPIMode,
                targetAPI: tableRecordsTargetAPI,
                globalCustomAPIEnabled: isGlobalCustomAPIEnabled
            });

            // 🔧 修复：如果数据表格配置为主API模式，不添加自定义API任务
            if (tableRecordsTargetAPI === 'main') {
                console.log('[CustomAPITaskQueue] ℹ️ 数据表格配置为主API模式，跳过自定义API任务');
                return;
            }

            // 🔧 修复：从messageData获取消息内容
            const messageContent = messageData.mes || '';

            // 🔧 新增：检查消息字数是否达到阈值
            const messageLength = messageContent.length;
            const minLength = this.getMinMessageLength();

            console.log(`[CustomAPITaskQueue] 📏 消息字数检查: ${messageLength}字 (阈值: ${minLength}字)`);

            if (messageLength < minLength) {
                console.log(`[CustomAPITaskQueue] ⚠️ 消息字数(${messageLength})低于阈值(${minLength})，跳过信息栏数据生成`);
                this.showLowLengthNotification(messageLength, minLength);
                return;
            }

            console.log(`[CustomAPITaskQueue] ✅ 消息字数达到阈值，继续处理`);

            // 🔧 修复：检查是否已有相同内容的任务在队列中或正在处理
            const contentHash = this.hashString(messageContent);
            const hasDuplicateTask = this.taskQueue.some(t =>
                t.type === 'INFOBAR_DATA' &&
                t.contentHash === contentHash &&
                (t.status === 'pending' || t.status === 'processing')
            );

            if (hasDuplicateTask) {
                console.log('[CustomAPITaskQueue] ⏸️ 检测到重复任务，跳过添加');
                return;
            }

            // 🆕 检查是否启用延迟生成（apiConfig已在上面定义）
            const delayedGeneration = apiConfig.delayedGeneration === true;
            const delayFloors = parseInt(apiConfig.delayFloors) || 1;

            if (delayedGeneration) {
                console.log(`[CustomAPITaskQueue] ⏱️ 延迟生成已启用，延迟 ${delayFloors} 层`);

                // 🔧 修复：检查是否已经处理过这条消息（防止同层重复结算）
                const existingTask = this.delayedTaskQueue.find(t => t.contentHash === contentHash);
                if (existingTask) {
                    console.log('[CustomAPITaskQueue] ⏸️ 该消息已在延迟队列中，跳过重复添加');
                    return;
                }

                // 增加AI消息计数器
                this.aiMessageCounter++;
                console.log(`[CustomAPITaskQueue] 📊 AI消息计数器增加: ${this.aiMessageCounter}`);

                // 将当前任务添加到延迟队列
                this.delayedTaskQueue.push({
                    type: 'INFOBAR_DATA',
                    data: { content: messageContent },
                    source: 'main_api_response',
                    contentHash: contentHash,
                    messageIndex: this.aiMessageCounter,
                    timestamp: Date.now()
                });

                console.log(`[CustomAPITaskQueue] 📝 任务已添加到延迟队列 (消息索引: ${this.aiMessageCounter})`);

                // 🆕 保存延迟生成状态
                await this.saveDelayedGenerationState();

                // 🔧 修复：只有当计数器真正增加时才处理延迟队列
                console.log(`[CustomAPITaskQueue] 🔄 检查是否有符合条件的延迟任务...`);
                await this.processDelayedTasks(delayFloors);

            } else {
                // 立即添加信息栏数据生成任务（高优先级）
                this.addTask({
                    type: 'INFOBAR_DATA',
                    data: { content: messageContent },
                    source: 'main_api_response',
                    contentHash: contentHash
                });
            }

            // 检查是否需要生成总结（遵循楼层阈值 + 冷却时间 + 去重）
            if (this.shouldGenerateSummary()) {
                // 若队列中已有未处理的SUMMARY任务，避免重复添加
                const hasPendingSummary = this.taskQueue.some(t => t.type === 'SUMMARY');
                const now = Date.now();
                const inCooldown = (this.summaryCooldownMs && (now - (this.lastSummaryEnqueueTime || 0) < this.summaryCooldownMs));

                if (!hasPendingSummary && !inCooldown) {
                    this.addTask({
                        type: 'SUMMARY',
                        data: { content: messageContent },
                        source: 'main_api_response'
                    });
                    this.lastSummaryEnqueueTime = now;
                } else {
                    console.log('[CustomAPITaskQueue] ⏸️ 已存在待处理SUMMARY任务或处于冷却期，跳过新增');
                }
            }

            // 🔧 修复：记忆处理任务改为非阻塞，且不调用AI记忆总结（AI记忆总结已内置在智能提示词中，由AI自动生成）
            // 只进行记忆分类和存储，不再调用API生成AI记忆总结
            // this.addTask({
            //     type: 'MEMORY',
            //     data: { content: messageContent },
            //     source: 'main_api_response'
            // });

        } catch (error) {
            console.error('[CustomAPITaskQueue] ❌ 处理主API返回事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 处理生成结束事件
     * 🔧 修复：在generation_ended事件中检查是否需要添加自定义API任务
     * 这是为了处理"两个功能都配置为自定义API"的情况，此时主API不会生成内容，也不会触发message_received事件
     */
    async handleGenerationEnded(data) {
        try {
            console.log('[CustomAPITaskQueue] 🏁 检测到生成结束事件');

            // 🔧 新增：检查是否需要添加自定义API任务
            const context = SillyTavern?.getContext?.();
            const extensionSettings = context?.extensionSettings?.['Information bar integration tool'] || {};
            const basicSettings = extensionSettings.basic || {};
            const memoryEnhancementSettings = extensionSettings?.memoryEnhancement?.ai || {};

            // 检查数据表格是否启用
            const tableRecordsEnabled = basicSettings.tableRecords?.enabled !== false;
            // 🔧 新增：检查AI记忆总结是否启用
            const aiMemorySummaryEnabled = memoryEnhancementSettings.enabled === true;

            // 如果两个功能都未启用，跳过
            if (!tableRecordsEnabled && !aiMemorySummaryEnabled) {
                console.log('[CustomAPITaskQueue] ℹ️ 数据表格和AI记忆总结都已禁用，跳过任务添加');
                return;
            }

            // 检查API模式配置
            const tableRecordsAPIMode = basicSettings.tableRecords?.apiMode || 'auto';
            const aiMemorySummaryAPIMode = memoryEnhancementSettings.apiMode || 'auto';
            const apiConfig = extensionSettings.apiConfig || {};
            const isGlobalCustomAPIEnabled = apiConfig.enabled && apiConfig.apiKey && apiConfig.model;

            // 判断数据表格应该使用哪个API
            let tableRecordsTargetAPI = 'main';
            if (tableRecordsAPIMode === 'custom') {
                tableRecordsTargetAPI = 'custom';
            } else if (tableRecordsAPIMode === 'main') {
                tableRecordsTargetAPI = 'main';
            } else if (tableRecordsAPIMode === 'auto') {
                tableRecordsTargetAPI = isGlobalCustomAPIEnabled ? 'custom' : 'main';
            }

            // 🔧 新增：判断AI记忆总结应该使用哪个API
            let aiMemorySummaryTargetAPI = 'main';
            if (aiMemorySummaryAPIMode === 'custom') {
                aiMemorySummaryTargetAPI = 'custom';
            } else if (aiMemorySummaryAPIMode === 'main') {
                aiMemorySummaryTargetAPI = 'main';
            } else if (aiMemorySummaryAPIMode === 'auto') {
                aiMemorySummaryTargetAPI = isGlobalCustomAPIEnabled ? 'custom' : 'main';
            }

            console.log('[CustomAPITaskQueue] 🎯 API模式配置:', {
                tableRecords: {
                    enabled: tableRecordsEnabled,
                    apiMode: tableRecordsAPIMode,
                    targetAPI: tableRecordsTargetAPI
                },
                aiMemorySummary: {
                    enabled: aiMemorySummaryEnabled,
                    apiMode: aiMemorySummaryAPIMode,
                    targetAPI: aiMemorySummaryTargetAPI
                },
                globalCustomAPIEnabled: isGlobalCustomAPIEnabled
            });

            // 🔧 修复：检查是否需要添加任务（至少有一个功能配置为自定义API）
            const needTableRecordsTask = tableRecordsEnabled && tableRecordsTargetAPI === 'custom';
            const needAIMemorySummaryTask = aiMemorySummaryEnabled && aiMemorySummaryTargetAPI === 'custom';

            if (!needTableRecordsTask && !needAIMemorySummaryTask) {
                console.log('[CustomAPITaskQueue] ℹ️ 没有功能配置为自定义API模式，跳过任务添加');
                return;
            }

            // 🔧 新增：获取最新的AI消息
            const chat = context?.chat;
            if (!chat || !Array.isArray(chat) || chat.length === 0) {
                console.log('[CustomAPITaskQueue] ⚠️ 无法获取聊天数据');
                return;
            }

            // 获取最后一条消息
            const lastMessage = chat[chat.length - 1];
            if (!lastMessage || lastMessage.is_user === true) {
                console.log('[CustomAPITaskQueue] ℹ️ 最后一条消息不是AI消息，跳过任务添加');
                return;
            }

            // 获取消息内容
            const messageContent = lastMessage.mes || '';

            // 检查消息字数是否达到阈值
            const messageLength = messageContent.length;
            const minLength = this.getMinMessageLength();

            console.log(`[CustomAPITaskQueue] 📏 消息字数检查: ${messageLength}字 (阈值: ${minLength}字)`);

            if (messageLength < minLength) {
                console.log(`[CustomAPITaskQueue] ⚠️ 消息字数(${messageLength})低于阈值(${minLength})，跳过任务添加`);
                this.showLowLengthNotification(messageLength, minLength);
                return;
            }

            // 🔧 修复：根据配置添加相应的任务
            if (needTableRecordsTask) {
                console.log('[CustomAPITaskQueue] ➕ 添加数据表格自定义API任务到队列（来源：generation_ended）');
                this.addTask({
                    type: 'INFOBAR_DATA',
                    data: { content: messageContent },
                    source: 'generation_ended'
                });
            }

            // 🔧 新增：如果AI记忆总结配置为自定义API，添加AI记忆总结任务
            if (needAIMemorySummaryTask) {
                console.log('[CustomAPITaskQueue] ➕ 添加AI记忆总结自定义API任务到队列（来源：generation_ended）');
                this.addTask({
                    type: 'AI_MEMORY_SUMMARY',
                    data: { content: messageContent },
                    source: 'generation_ended'
                });
            }

        } catch (error) {
            console.error('[CustomAPITaskQueue] ❌ 处理生成结束事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 添加任务到队列
     */
    addTask(taskConfig) {
        try {
            const taskType = this.taskTypes[taskConfig.type];
            if (!taskType) {
                throw new Error(`未知的任务类型: ${taskConfig.type}`);
            }

            const task = {
                id: this.generateTaskId(),
                type: taskConfig.type,
                priority: taskType.priority,
                data: taskConfig.data || {},
                source: taskConfig.source || 'unknown',
                retries: 0,
                maxRetries: taskType.maxRetries,
                timeout: taskType.timeout,
                createdAt: Date.now(),
                status: 'pending'
            };

            // 防抖处理
            if (taskType.debounceDelay > 0) {
                const debounceKey = `${task.type}_${task.source}`;

                // 清除之前的防抖定时器
                if (this.debounceTimers.has(debounceKey)) {
                    clearTimeout(this.debounceTimers.get(debounceKey));
                }

                // 设置新的防抖定时器
                const timer = setTimeout(() => {
                    this.enqueueTask(task);
                    this.debounceTimers.delete(debounceKey);
                }, taskType.debounceDelay);

                this.debounceTimers.set(debounceKey, timer);

                console.log(`[CustomAPITaskQueue] ⏳ 任务 ${task.id} 已设置防抖延迟 ${taskType.debounceDelay}ms`);
            } else {
                // 立即入队
                this.enqueueTask(task);
            }

        } catch (error) {
            console.error('[CustomAPITaskQueue] ❌ 添加任务失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 将任务加入队列
     */
    enqueueTask(task) {
        // 检查是否已有相同类型的任务在队列中
        const existingTaskIndex = this.taskQueue.findIndex(
            t => t.type === task.type && t.source === task.source && t.status === 'pending'
        );

        if (existingTaskIndex !== -1) {
            // 替换现有任务
            this.taskQueue[existingTaskIndex] = task;
            console.log(`[CustomAPITaskQueue] 🔄 替换现有任务 ${task.type}`);
        } else {
            // 添加新任务
            this.taskQueue.push(task);
            console.log(`[CustomAPITaskQueue] ➕ 新任务已入队: ${task.id} (${task.type})`);
        }

        // 按优先级排序
        this.taskQueue.sort((a, b) => a.priority - b.priority);

        this.stats.totalTasks++;

        console.log(`[CustomAPITaskQueue] 📊 当前队列长度: ${this.taskQueue.length}`);
    }

    /**
     * 处理下一个任务
     */
    async processNextTask() {
        if (this.isProcessing || this.taskQueue.length === 0) {
            return;
        }

        this.isProcessing = true;
        const task = this.taskQueue.shift();
        this.processingTask = task;

        // 🆕 关键修复：将interval提升到外层作用域，以便finally能访问
        let timeoutInterval = null;
        let stopped = false;

        try {
            console.log(`[CustomAPITaskQueue] 🚀 开始处理任务: ${task.id} (${task.type})`);

            task.status = 'processing';
            task.startTime = Date.now();

            // 🔧 修复：设置超时处理，且在任务结束时彻底停止倒计时与日志
            const timeoutPromise = new Promise((_, reject) => {
                const startAt = Date.now();
                let adjustedStart = startAt; // 通过调整起始时间来"暂停"计时
                let lastTick = startAt;

                const tick = () => {
                    if (stopped) {
                        if (timeoutInterval) clearInterval(timeoutInterval);
                        return;
                    }

                    const now = Date.now();
                    // 若在等待确认，则把本段时间加到 adjustedStart 里，相当于暂停
                    if (task.waitingForConfirmation) {
                        adjustedStart += (now - lastTick);
                        lastTick = now;
                        return; // 本次不做其它处理
                    }

                    lastTick = now;
                    const elapsed = now - adjustedStart;

                    // 进度日志（仅信息栏任务且超过30秒后）
                    if (task.type === 'INFOBAR_DATA' && elapsed > 30000) {
                        const remainingTime = Math.max(0, Math.round((task.timeout - elapsed) / 1000));
                        console.log(`[CustomAPITaskQueue] ⏳ 任务 ${task.id} 执行中... (已用时: ${Math.round(elapsed/1000)}秒, 剩余: ${remainingTime}秒)`);
                    }

                    if (elapsed >= task.timeout) {
                        if (timeoutInterval) clearInterval(timeoutInterval);
                        reject(new Error(`任务超时 (执行时间: ${Math.round(elapsed/1000)}秒)`));
                    }
                };

                timeoutInterval = setInterval(tick, 1000);
            });

            // 执行任务
            const taskPromise = this.executeTask(task);

            // 等待任务完成或超时
            await Promise.race([taskPromise, timeoutPromise]);

            // 🆕 关键修复：任务成功完成，立即停止倒计时
            stopped = true;
            if (timeoutInterval) {
                clearInterval(timeoutInterval);
                timeoutInterval = null;
            }

            // 任务成功完成
            task.status = 'completed';
            task.completedAt = Date.now();
            task.processingTime = task.completedAt - task.startTime;

            this.stats.completedTasks++;
            this.updateAverageProcessingTime(task.processingTime);

            console.log(`[CustomAPITaskQueue] ✅ 任务完成: ${task.id} (耗时: ${task.processingTime}ms)`);

        } catch (error) {
            console.error(`[CustomAPITaskQueue] ❌ 任务执行失败: ${task.id}`, error);

            // 🔧 修复：检查是否是用户主动中止的错误
            const isUserAbort = error.name === 'AbortError' || error.isUserAbort === true;
            
            // 🔧 修复：检查是否是超时错误
            const isTimeout = error.message?.includes('任务超时');

            if (isUserAbort) {
                // 用户主动中止，不重试，直接标记为取消
                task.status = 'cancelled';
                task.error = '用户已中止';
                this.stats.failedTasks++;
                console.log(`[CustomAPITaskQueue] 🛑 任务已被用户中止: ${task.id}`);
            } else if (isTimeout && task.type === 'INFOBAR_DATA') {
                // 🔧 修复：自定义API超时，根据情况决定是否重试
                console.warn(`[CustomAPITaskQueue] ⏱️ 自定义API任务超时: ${task.id}`);
                
                // 🆕 关键修复：超时时也要停止倒计时
                stopped = true;
                if (timeoutInterval) {
                    clearInterval(timeoutInterval);
                    timeoutInterval = null;
                }
                
                // 如果是第一次超时，可以尝试重试一次
                if (task.retries === 0) {
                    task.retries++;
                    task.status = 'pending';
                    task.timeout = 9999000; // 重试时使用默认超时时间（9999秒）
                    
                    setTimeout(() => {
                        this.taskQueue.unshift(task);
                        console.log(`[CustomAPITaskQueue] 🔄 超时任务重试: ${task.id} (使用默认超时时间9999秒)`);
                    }, 5000); // 5秒后重试
                } else {
                    // 已经重试过，标记为失败
                    task.status = 'failed';
                    task.error = '自定义API响应超时';
                    this.stats.failedTasks++;
                    console.error(`[CustomAPITaskQueue] 💀 任务因超时最终失败: ${task.id}`);
                }
            } else {
                // 🆕 关键修复：任何错误情况都要停止倒计时
                stopped = true;
                if (timeoutInterval) {
                    clearInterval(timeoutInterval);
                    timeoutInterval = null;
                }
                
                // 其他错误，执行正常重试逻辑
                if (task.retries < task.maxRetries) {
                    task.retries++;
                    task.status = 'pending';

                    // 重新入队，延迟重试
                    setTimeout(() => {
                        this.taskQueue.unshift(task);
                        console.log(`[CustomAPITaskQueue] 🔄 任务重试: ${task.id} (第${task.retries}次)`);
                    }, 1000 * task.retries); // 递增延迟

                } else {
                    // 重试次数用尽，标记为失败
                    task.status = 'failed';
                    task.error = error.message;
                    this.stats.failedTasks++;

                    console.error(`[CustomAPITaskQueue] 💀 任务最终失败: ${task.id}`);
                }

                this.handleError(error);
            }
        } finally {
            // 🆕 关键修复：停止并清理倒计时与日志输出
            stopped = true;
            if (timeoutInterval) {
                clearInterval(timeoutInterval);
                timeoutInterval = null;
                console.log(`[CustomAPITaskQueue] 🛑 任务 ${task.id} 倒计时已停止`);
            }

            this.isProcessing = false;
            this.processingTask = null;
        }
    }

    /**
     * 执行具体任务
     */
    async executeTask(task) {
        switch (task.type) {
            case 'INFOBAR_DATA':
                return await this.executeInfobarDataTask(task);
            case 'SUMMARY':
                return await this.executeSummaryTask(task);
            case 'MEMORY':
                return await this.executeMemoryTask(task);
            case 'AI_MEMORY_SUMMARY':
                return await this.executeAIMemorySummaryTask(task);
            case 'MANUAL':
                return await this.executeManualTask(task);
            default:
                throw new Error(`未支持的任务类型: ${task.type}`);
        }
    }

    /**
     * 执行信息栏数据生成任务
     */
    async executeInfobarDataTask(task) {
        if (!this.infoBarSettings || typeof this.infoBarSettings.processWithCustomAPIDirectly !== 'function') {
            throw new Error('InfoBarSettings模块不可用');
        }

        // 🆕 检查是否启用了请求询问，且任务未被确认过
        const requestConfirmation = await this.checkRequestConfirmation();
        
        // 🔧 修复：只有主API自动触发的任务才需要确认
        const needsConfirmation = requestConfirmation && 
                                 !task.userConfirmed && 
                                 task.source === 'main_api_response';
        
        if (needsConfirmation) {
            console.log('[CustomAPITaskQueue] 🔔 主API触发的任务需要确认...');
            
            // 🔧 修复：标记任务正在等待用户确认，防止超时
            task.waitingForConfirmation = true;
            
            // 显示确认对话框
            const userConfirmed = await this.showConfirmationDialog();
            
            // 清除等待标记
            task.waitingForConfirmation = false;
            
            if (!userConfirmed) {
                console.log('[CustomAPITaskQueue] ⏸️ 用户取消了数据生成，任务中止');
                // 🔧 修复：创建用户中止错误，设置特殊标记
                const abortError = new Error('用户取消了数据生成');
                abortError.isUserAbort = true;
                throw abortError;
            }
            
            // 🔧 修复：标记任务已被用户确认，重试时不再显示确认框
            task.userConfirmed = true;
            console.log('[CustomAPITaskQueue] ✅ 用户确认继续生成数据');
        } else if (!requestConfirmation || task.source !== 'main_api_response') {
            console.log('[CustomAPITaskQueue] 📊 跳过确认（来源: ' + task.source + '）');
        }

        console.log('[CustomAPITaskQueue] 📊 执行信息栏数据生成任务');
        await this.infoBarSettings.processWithCustomAPIDirectly(task.data.content);

        // 🆕 关键修复：当自定义API流程内部完成后，显式通知任务完成，便于外部倒计时结束
        try {
            if (this.eventSystem) {
                this.eventSystem.emit('custom-api-queue:task_completed', {
                    id: task.id,
                    type: task.type,
                    timestamp: Date.now()
                });
            }
        } catch (e) {
            console.warn('[CustomAPITaskQueue] ⚠️ 发送task_completed事件失败(可忽略):', e);
        }
    }

    /**
     * 执行总结生成任务
     */
    async executeSummaryTask(task) {
        const summaryManager = window.SillyTavernInfobar?.modules?.summaryManager;
        if (!summaryManager || typeof summaryManager.generateSummary !== 'function') {
            throw new Error('SummaryManager模块不可用');
        }

        // 🔧 关键修复：在执行前再次检查传统总结是否启用
        if (!summaryManager.settings?.autoSummaryEnabled) {
            console.log('[CustomAPITaskQueue] ⏸️ 传统总结已禁用，跳过总结任务');
            return;
        }

        console.log('[CustomAPITaskQueue] 📝 执行总结生成任务');
        await summaryManager.generateSummary({ type: 'auto' });
    }

    /**
     * 执行记忆处理任务
     */
    async executeMemoryTask(task) {
        const deepMemoryManager = window.SillyTavernInfobar?.modules?.deepMemoryManager;
        const aiMemoryInjector = window.SillyTavernInfobar?.modules?.aiMemoryDatabaseInjector;

        if (!deepMemoryManager && !aiMemoryInjector) {
            console.log('[CustomAPITaskQueue] ℹ️ 记忆管理模块不可用，跳过记忆处理任务');
            return;
        }

        console.log('[CustomAPITaskQueue] 🧠 执行记忆处理任务');

        try {
            const content = task.data?.content;
            if (!content || content.length < 10) {
                console.log('[CustomAPITaskQueue] ⚠️ 记忆内容太短，跳过处理');
                return;
            }

            // 使用深度记忆管理器处理记忆
            if (deepMemoryManager && deepMemoryManager.settings.enabled) {
                const memoryData = {
                    content: content,
                    type: 'ai_response',
                    source: 'custom_api_task',
                    metadata: {
                        taskId: task.id,
                        timestamp: Date.now()
                    }
                };

                await deepMemoryManager.addMemoryToSensoryLayer(memoryData);
                console.log('[CustomAPITaskQueue] ✅ 记忆已添加到深度记忆管理器');
            }

            // 使用AI记忆数据库注入器处理记忆
            if (aiMemoryInjector && aiMemoryInjector.initialized) {
                await aiMemoryInjector.addToMemoryDatabase('ai_response', {
                    content: content,
                    importance: 0.6,
                    source: 'custom_api_task'
                });
                console.log('[CustomAPITaskQueue] ✅ 记忆已添加到AI记忆数据库');
            }

        } catch (error) {
            console.error('[CustomAPITaskQueue] ❌ 记忆处理任务失败:', error);
            throw error;
        }
    }

    /**
     * 🆕 执行AI记忆总结任务
     */
    async executeAIMemorySummaryTask(task) {
        console.log('[CustomAPITaskQueue] 🧠 执行AI记忆总结任务');

        try {
            const content = task.data?.content;
            if (!content || content.length < 10) {
                console.log('[CustomAPITaskQueue] ⚠️ 消息内容太短，跳过AI记忆总结');
                return;
            }

            // 获取AIMemorySummarizer实例
            const aiMemorySummarizer = window.SillyTavernInfobar?.modules?.summaryManager?.aiMemorySummarizer;
            if (!aiMemorySummarizer) {
                console.warn('[CustomAPITaskQueue] ⚠️ AIMemorySummarizer不可用，无法生成AI记忆总结');
                return;
            }

            console.log('[CustomAPITaskQueue] 🤖 调用自定义API生成AI记忆总结...');

            // 构建AI记忆总结提示词
            const summaryPrompt = `请为以下对话内容生成AI记忆总结：

${content}

请按照以下格式输出：

<ai_memory_summary>
<!--
"type": "ai_memory",
"content": "简洁的剧情总结内容（100-200字）",
"importance": 0.8,
"tags": ["关键词1", "关键词2"],
"category": "剧情发展"
-->
</ai_memory_summary>

要求：
- 提取核心剧情要点和重要对话
- 突出角色行为和情感变化
- 保持客观中性的叙述
- 长度控制在100-200字`;

            // 调用自定义API
            const summaryContent = await aiMemorySummarizer.summaryManager.callSummaryAPI(summaryPrompt);

            console.log('[CustomAPITaskQueue] ✅ AI记忆总结生成完成，长度:', summaryContent.length);

            // 解析并处理总结内容
            const smartPromptSystem = window.SillyTavernInfobar?.modules?.smartPromptSystem;
            if (smartPromptSystem && typeof smartPromptSystem.handleGeneratedMessage === 'function') {
                await smartPromptSystem.handleGeneratedMessage({ message: summaryContent });
                console.log('[CustomAPITaskQueue] ✅ AI记忆总结已处理');
            }

        } catch (error) {
            console.error('[CustomAPITaskQueue] ❌ AI记忆总结任务失败:', error);
            throw error;
        }
    }

    /**
     * 执行手动任务
     */
    async executeManualTask(task) {
        // 手动任务通常是用户直接触发的，优先级最高
        console.log('[CustomAPITaskQueue] 👤 执行手动任务');

        if (task.data.callback && typeof task.data.callback === 'function') {
            await task.data.callback(task.data);
        }
    }

    /**
     * 🆕 处理延迟任务队列
     */
    async processDelayedTasks(delayFloors) {
        try {
            console.log(`[CustomAPITaskQueue] 🔍 检查延迟队列，当前消息索引: ${this.aiMessageCounter}, 延迟楼层: ${delayFloors}`);

            // 找出所有需要处理的任务
            // 判断条件：当前消息索引 - 任务消息索引 >= 延迟楼层
            // 例如：延迟1层，当前索引2，任务索引1，则 2 - 1 = 1 >= 1，可以处理
            // 例如：延迟1层，当前索引2，任务索引2，则 2 - 2 = 0 < 1，不能处理
            // 例如：延迟2层，当前索引3，任务索引1，则 3 - 1 = 2 >= 2，可以处理
            const tasksToProcess = this.delayedTaskQueue.filter(task => {
                const floorsPassed = this.aiMessageCounter - task.messageIndex;
                const shouldProcess = floorsPassed >= delayFloors;
                if (shouldProcess) {
                    console.log(`[CustomAPITaskQueue] ✅ 任务符合处理条件 (消息索引: ${task.messageIndex}, 当前索引: ${this.aiMessageCounter}, 已过楼层: ${floorsPassed}, 需要: ${delayFloors})`);
                } else {
                    console.log(`[CustomAPITaskQueue] ⏳ 任务还需等待 (消息索引: ${task.messageIndex}, 已过楼层: ${floorsPassed}, 还需: ${delayFloors - floorsPassed})`);
                }
                return shouldProcess;
            });

            if (tasksToProcess.length === 0) {
                console.log('[CustomAPITaskQueue] ℹ️ 暂无符合条件的延迟任务');
                return;
            }

            console.log(`[CustomAPITaskQueue] 📋 找到 ${tasksToProcess.length} 个需要处理的延迟任务`);

            // 将符合条件的任务添加到主队列
            tasksToProcess.forEach(task => {
                this.addTask({
                    type: task.type,
                    data: task.data,
                    source: task.source,
                    contentHash: task.contentHash
                });

                console.log(`[CustomAPITaskQueue] ➕ 延迟任务已添加到主队列 (消息索引: ${task.messageIndex})`);
            });

            // 从延迟队列中移除已处理的任务
            this.delayedTaskQueue = this.delayedTaskQueue.filter(task =>
                !tasksToProcess.includes(task)
            );

            console.log(`[CustomAPITaskQueue] 🗑️ 已清理延迟队列，剩余任务: ${this.delayedTaskQueue.length}`);

            // 🆕 保存延迟生成状态
            await this.saveDelayedGenerationState();

        } catch (error) {
            console.error('[CustomAPITaskQueue] ❌ 处理延迟任务失败:', error);
        }
    }

    /**
     * 🆕 保存延迟生成状态到localStorage
     */
    async saveDelayedGenerationState() {
        try {
            const context = SillyTavern?.getContext?.();
            const chatId = context?.chatId;

            if (!chatId) {
                console.warn('[CustomAPITaskQueue] ⚠️ 无法获取chatId，跳过延迟生成状态保存');
                return;
            }

            const state = {
                aiMessageCounter: this.aiMessageCounter,
                delayedTaskQueue: this.delayedTaskQueue,
                timestamp: Date.now()
            };

            const stateKey = `delayedGeneration_${chatId}`;
            localStorage.setItem(stateKey, JSON.stringify(state));

            console.log(`[CustomAPITaskQueue] 💾 延迟生成状态已保存 (消息计数: ${this.aiMessageCounter}, 延迟任务: ${this.delayedTaskQueue.length})`);

        } catch (error) {
            console.error('[CustomAPITaskQueue] ❌ 保存延迟生成状态失败:', error);
        }
    }

    /**
     * 🆕 从localStorage恢复延迟生成状态
     * @param {boolean} processImmediately - 是否立即处理延迟任务（默认false）
     */
    async restoreDelayedGenerationState(processImmediately = false) {
        try {
            const context = SillyTavern?.getContext?.();
            const chatId = context?.chatId;

            if (!chatId) {
                console.warn('[CustomAPITaskQueue] ⚠️ 无法获取chatId，跳过延迟生成状态恢复');
                return;
            }

            const stateKey = `delayedGeneration_${chatId}`;
            const savedState = localStorage.getItem(stateKey);

            if (!savedState) {
                console.log('[CustomAPITaskQueue] ℹ️ 未找到保存的延迟生成状态，初始化为空');
                // 🔧 修复：新聊天时重置计数器
                this.aiMessageCounter = 0;
                this.delayedTaskQueue = [];
                return;
            }

            const state = JSON.parse(savedState);

            // 恢复消息计数器和延迟任务队列
            this.aiMessageCounter = state.aiMessageCounter || 0;
            this.delayedTaskQueue = state.delayedTaskQueue || [];

            console.log(`[CustomAPITaskQueue] ✅ 延迟生成状态已恢复 (消息计数: ${this.aiMessageCounter}, 延迟任务: ${this.delayedTaskQueue.length})`);

            // 🔧 修复：只有明确要求时才立即处理
            if (processImmediately && this.delayedTaskQueue.length > 0) {
                console.log('[CustomAPITaskQueue] 🔄 检查恢复的延迟任务是否需要处理...');

                const extensionSettings = context?.extensionSettings?.['Information bar integration tool'] || {};
                const apiConfig = extensionSettings.apiConfig || {};
                const delayFloors = parseInt(apiConfig.delayFloors) || 1;

                // 处理延迟队列
                await this.processDelayedTasks(delayFloors);
            } else if (this.delayedTaskQueue.length > 0) {
                console.log('[CustomAPITaskQueue] ⏸️ 延迟任务已恢复，等待新消息触发处理');
            }

        } catch (error) {
            console.error('[CustomAPITaskQueue] ❌ 恢复延迟生成状态失败:', error);
            // 🔧 修复：出错时重置为安全状态
            this.aiMessageCounter = 0;
            this.delayedTaskQueue = [];
        }
    }

    /**
     * 生成任务ID
     */
    generateTaskId() {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 检查是否需要生成总结
     */
    shouldGenerateSummary() {
        try {
            const sm = window.SillyTavernInfobar?.modules?.summaryManager;
            if (!sm) {
                console.log('[CustomAPITaskQueue] ℹ️ SummaryManager未初始化，不生成总结');
                return false;
            }

            // 🔧 关键修复：第一优先级检查 - 自动总结开关必须启用
            if (!sm.settings || sm.settings.autoSummaryEnabled !== true) {
                console.log('[CustomAPITaskQueue] ⏸️ 传统总结未启用 (autoSummaryEnabled=false)，不生成总结');
                return false;
            }

            // 避免总结过程中的重复触发
            if (sm.summaryInProgress) {
                console.log('[CustomAPITaskQueue] ⏸️ 总结正在进行中，跳过');
                return false;
            }

            // 冷却时间：防止短时间内频繁触发
            const now = Date.now();
            if (this.summaryCooldownMs && (now - (this.lastSummaryEnqueueTime || 0) < this.summaryCooldownMs)) {
                console.log('[CustomAPITaskQueue] ⏸️ 总结冷却期中，跳过');
                return false;
            }

            // 使用SummaryManager的触发判断（基于楼层）
            const context = window.SillyTavern?.getContext?.();
            const currentCount = context?.chat?.length ?? sm.lastMessageCount ?? 0;
            if (typeof sm.shouldTriggerSummary === 'function') {
                const shouldTrigger = sm.shouldTriggerSummary(currentCount);
                console.log('[CustomAPITaskQueue] 📊 楼层检查结果:', { currentCount, shouldTrigger });
                return shouldTrigger;
            }

            // 兜底：按楼层阈值判断
            const lastId = sm.lastSummaryMessageId ?? 0;
            const floor = sm.settings?.summaryFloorCount ?? 20;
            const shouldTrigger = (currentCount - lastId) >= floor;
            console.log('[CustomAPITaskQueue] 📊 兜底楼层检查:', { currentCount, lastId, floor, shouldTrigger });
            return shouldTrigger;
        } catch (e) {
            console.error('[CustomAPITaskQueue] shouldGenerateSummary error:', e);
            return false;
        }
    }

    /**
     * 更新平均处理时间
     */
    updateAverageProcessingTime(processingTime) {
        if (this.stats.completedTasks === 1) {
            this.stats.averageProcessingTime = processingTime;
        } else {
            this.stats.averageProcessingTime =
                (this.stats.averageProcessingTime * (this.stats.completedTasks - 1) + processingTime) / this.stats.completedTasks;
        }
        this.stats.lastProcessingTime = processingTime;
    }

    /**
     * 获取队列状态
     */
    getQueueStatus() {
        return {
            queueLength: this.taskQueue.length,
            isProcessing: this.isProcessing,
            processingTask: this.processingTask ? {
                id: this.processingTask.id,
                type: this.processingTask.type,
                startTime: this.processingTask.startTime
            } : null,
            stats: { ...this.stats },
            initialized: this.initialized,
            errorCount: this.errorCount
        };
    }

    /**
     * 清空队列
     */
    clearQueue() {
        this.taskQueue = [];

        // 清除所有防抖定时器
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();

        console.log('[CustomAPITaskQueue] 🧹 队列已清空');
    }

    /**
     * 🆕 生成字符串哈希（用于去重）
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return hash.toString();
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[CustomAPITaskQueue] ❌ 错误:', error);

        // 触发错误事件
        if (this.eventSystem) {
            this.eventSystem.emit('custom-api-queue:error', {
                error: error.message,
                timestamp: Date.now(),
                errorCount: this.errorCount
            });
        }
    }

    /**
     * 获取系统状态
     */
    getStatus() {
        return {
            initialized: this.initialized,
            errorCount: this.errorCount,
            queueStatus: this.getQueueStatus()
        };
    }

    /**
     * 🆕 检查是否启用了请求询问
     */
    async checkRequestConfirmation() {
        try {
            const context = SillyTavern?.getContext?.();
            const extensionSettings = context?.extensionSettings?.['Information bar integration tool'] || {};
            const apiConfig = extensionSettings.apiConfig || {};
            
            return apiConfig.requestConfirmation === true;
        } catch (error) {
            console.error('[CustomAPITaskQueue] ❌ 检查请求询问配置失败:', error);
            return false;
        }
    }

    /**
     * 🆕 显示确认对话框（右上角小弹窗样式）
     */
    async showConfirmationDialog() {
        return new Promise((resolve) => {
            try {
                console.log('[CustomAPITaskQueue] 💬 显示数据生成确认对话框');
                
                // 🔧 检测屏幕尺寸，判断是否为移动端
                const isMobile = window.innerWidth <= 768;
                console.log(`[CustomAPITaskQueue] 📱 检测到设备类型: ${isMobile ? '移动端' : '桌面端'}, 屏幕宽度: ${window.innerWidth}px`);
                
                // 创建确认对话框
                const dialog = document.createElement('div');
                dialog.className = 'custom-api-confirmation-toast';
                
                // 🔧 移动端和桌面端使用不同的定位策略
                if (isMobile) {
                    // 移动端：居中显示，尺寸更紧凑
                    dialog.style.cssText = `
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        background: var(--theme-bg-primary, #2a2a2a);
                        border: 2px solid var(--theme-primary-color, #4CAF50);
                        border-radius: 8px;
                        padding: 12px 16px;
                        width: calc(100vw - 40px);
                        max-width: 320px;
                        box-shadow: 0 4px 16px rgba(0,0,0,0.5);
                        z-index: 10000;
                        animation: fadeInScale 0.3s ease-out;
                    `;
                } else {
                    // 桌面端：右上角显示
                    dialog.style.cssText = `
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: var(--theme-bg-primary, #2a2a2a);
                        border: 2px solid var(--theme-primary-color, #4CAF50);
                        border-radius: 8px;
                        padding: 16px 20px;
                        min-width: 280px;
                        max-width: 360px;
                        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
                        z-index: 10000;
                        animation: slideInRight 0.3s ease-out;
                    `;
                }
                
                dialog.innerHTML = `
                    <div class="toast-header" style="
                        margin-bottom: ${isMobile ? '8px' : '12px'};
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    ">
                        <span style="font-size: ${isMobile ? '18px' : '20px'};">🤔</span>
                        <span style="
                            color: var(--theme-text-primary, #fff);
                            font-size: ${isMobile ? '14px' : '16px'};
                            font-weight: 600;
                        ">是否进行数据生成？</span>
                    </div>
                    
                    <div class="toast-body" style="
                        margin-bottom: ${isMobile ? '12px' : '16px'};
                        color: var(--theme-text-secondary, #ccc);
                        font-size: ${isMobile ? '12px' : '13px'};
                        line-height: 1.5;
                    ">
                        系统检测到AI消息，即将调用自定义API生成信息栏数据。
                    </div>
                    
                    <div class="toast-footer" style="
                        display: flex;
                        gap: 8px;
                        justify-content: flex-end;
                    ">
                        <button class="btn-cancel" style="
                            padding: ${isMobile ? '8px 12px' : '6px 16px'};
                            background: var(--theme-bg-secondary, #555);
                            color: var(--theme-text-primary, #fff);
                            border: 1px solid var(--theme-border-color, #666);
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: ${isMobile ? '12px' : '13px'};
                            transition: all 0.2s;
                            flex: ${isMobile ? '1' : 'none'};
                        ">
                            取消
                        </button>
                        <button class="btn-confirm" style="
                            padding: ${isMobile ? '8px 12px' : '6px 16px'};
                            background: var(--theme-primary-color, #4CAF50);
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: ${isMobile ? '12px' : '13px'};
                            font-weight: 500;
                            transition: all 0.2s;
                            flex: ${isMobile ? '1' : 'none'};
                        ">
                            确认
                        </button>
                    </div>
                    
                    <style>
                        /* 桌面端动画 */
                        @keyframes slideInRight {
                            from {
                                opacity: 0;
                                transform: translateX(100px);
                            }
                            to {
                                opacity: 1;
                                transform: translateX(0);
                            }
                        }
                        
                        @keyframes slideOutRight {
                            from {
                                opacity: 1;
                                transform: translateX(0);
                            }
                            to {
                                opacity: 0;
                                transform: translateX(100px);
                            }
                        }
                        
                        /* 移动端动画 */
                        @keyframes fadeInScale {
                            from {
                                opacity: 0;
                                transform: translate(-50%, -50%) scale(0.9);
                            }
                            to {
                                opacity: 1;
                                transform: translate(-50%, -50%) scale(1);
                            }
                        }
                        
                        @keyframes fadeOutScale {
                            from {
                                opacity: 1;
                                transform: translate(-50%, -50%) scale(1);
                            }
                            to {
                                opacity: 0;
                                transform: translate(-50%, -50%) scale(0.9);
                            }
                        }
                        
                        .custom-api-confirmation-toast .btn-cancel:hover {
                            background: var(--theme-bg-hover, #666) !important;
                        }
                        
                        .custom-api-confirmation-toast .btn-confirm:hover {
                            background: #45a049 !important;
                        }
                        
                        /* 移动端按钮触摸优化 */
                        @media (max-width: 768px) {
                            .custom-api-confirmation-toast .btn-cancel,
                            .custom-api-confirmation-toast .btn-confirm {
                                min-height: 44px;
                                -webkit-tap-highlight-color: transparent;
                            }
                            
                            .custom-api-confirmation-toast .btn-cancel:active {
                                opacity: 0.8;
                            }
                            
                            .custom-api-confirmation-toast .btn-confirm:active {
                                opacity: 0.8;
                            }
                        }
                    </style>
                `;
                
                // 添加到页面
                document.body.appendChild(dialog);
                
                // 按钮事件
                const btnCancel = dialog.querySelector('.btn-cancel');
                const btnConfirm = dialog.querySelector('.btn-confirm');
                
                const closeDialog = (confirmed) => {
                    // 🔧 根据设备类型使用不同的退出动画
                    dialog.style.animation = isMobile 
                        ? 'fadeOutScale 0.2s ease-in'
                        : 'slideOutRight 0.2s ease-in';
                    setTimeout(() => {
                        if (dialog.parentNode) {
                            dialog.remove();
                        }
                    }, 200);
                    resolve(confirmed);
                };
                
                btnCancel.addEventListener('click', () => closeDialog(false));
                btnConfirm.addEventListener('click', () => closeDialog(true));
                
                // ESC键取消
                const handleKeyDown = (e) => {
                    if (e.key === 'Escape') {
                        closeDialog(false);
                        document.removeEventListener('keydown', handleKeyDown);
                    }
                };
                document.addEventListener('keydown', handleKeyDown);
                
                console.log(`[CustomAPITaskQueue] ✅ 确认对话框已显示（${isMobile ? '居中模式' : '右上角模式'}）`);
                
            } catch (error) {
                console.error('[CustomAPITaskQueue] ❌ 显示确认对话框失败:', error);
                // 出错时默认允许继续
                resolve(true);
            }
        });
    }

    /**
     * 🆕 获取最小消息字数阈值
     */
    getMinMessageLength() {
        try {
            const context = window.SillyTavern?.getContext?.();
            if (!context) {
                console.warn('[CustomAPITaskQueue] ⚠️ 无法获取SillyTavern上下文，使用默认阈值500');
                return 500;
            }

            const extensionSettings = context.extensionSettings;
            const apiConfig = extensionSettings?.['Information bar integration tool']?.apiConfig || {};

            // 获取用户设置的阈值，默认500字
            const minLength = apiConfig.minMessageLength || 500;

            return minLength;
        } catch (error) {
            console.error('[CustomAPITaskQueue] ❌ 获取最小消息字数阈值失败:', error);
            return 500; // 默认500字
        }
    }

    /**
     * 🆕 显示字数不足通知
     */
    showLowLengthNotification(actualLength, minLength) {
        try {
            // 尝试使用SillyTavern的通知系统
            if (typeof toastr !== 'undefined') {
                toastr.info(
                    `AI消息字数(${actualLength})低于阈值(${minLength})，已跳过信息栏数据生成`,
                    '信息栏数据生成',
                    { timeOut: 3000 }
                );
            } else {
                console.log(`[CustomAPITaskQueue] 💡 AI消息字数(${actualLength})低于阈值(${minLength})，已跳过信息栏数据生成`);
            }
        } catch (error) {
            console.error('[CustomAPITaskQueue] ❌ 显示通知失败:', error);
        }
    }
}
