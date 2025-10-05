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
                timeout: 30000
            },
            SUMMARY: {
                name: 'summary',
                priority: this.priorities.MEDIUM,
                debounceDelay: 5000,
                maxRetries: 2,
                timeout: 45000
            },
            MEMORY: {
                name: 'memory',
                priority: this.priorities.LOW,
                debounceDelay: 3000,
                maxRetries: 2,
                timeout: 30000
            },
            MANUAL: {
                name: 'manual',
                priority: this.priorities.CRITICAL,
                debounceDelay: 0,
                maxRetries: 5,
                timeout: 60000
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

            console.log('[CustomAPITaskQueue] 🔗 事件监听器已绑定');
        }
    }

    /**
     * 处理主API返回事件
     */
    async handleMainAPIResponse(data) {
        try {
            // 检查是否为AI消息
            if (!data || data.is_user === true) {
                return;
            }

            console.log('[CustomAPITaskQueue] 📨 检测到主API返回，准备排队处理任务');

            // 获取消息内容
            const messageContent = data.mes || '';

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

            // 添加信息栏数据生成任务（高优先级）
            this.addTask({
                type: 'INFOBAR_DATA',
                data: { content: messageContent },
                source: 'main_api_response'
            });

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
     */
    async handleGenerationEnded(data) {
        try {
            console.log('[CustomAPITaskQueue] 🏁 检测到生成结束事件');

            // 可以在这里添加生成结束后的特殊处理逻辑
            // 例如：清理过期任务、更新统计信息等

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

        try {
            console.log(`[CustomAPITaskQueue] 🚀 开始处理任务: ${task.id} (${task.type})`);

            task.status = 'processing';
            task.startTime = Date.now();

            // 设置超时处理
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('任务超时')), task.timeout);
            });

            // 执行任务
            const taskPromise = this.executeTask(task);

            // 等待任务完成或超时
            await Promise.race([taskPromise, timeoutPromise]);

            // 任务成功完成
            task.status = 'completed';
            task.completedAt = Date.now();
            task.processingTime = task.completedAt - task.startTime;

            this.stats.completedTasks++;
            this.updateAverageProcessingTime(task.processingTime);

            console.log(`[CustomAPITaskQueue] ✅ 任务完成: ${task.id} (耗时: ${task.processingTime}ms)`);

        } catch (error) {
            console.error(`[CustomAPITaskQueue] ❌ 任务执行失败: ${task.id}`, error);

            // 重试逻辑
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
        } finally {
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

        console.log('[CustomAPITaskQueue] 📊 执行信息栏数据生成任务');
        await this.infoBarSettings.processWithCustomAPIDirectly(task.data.content);
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
