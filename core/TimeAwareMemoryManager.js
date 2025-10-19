/**
 * 时间感知记忆管理系统
 * 
 * 核心功能：
 * - 记忆时间线管理
 * - Ebbinghaus遗忘曲线时间衰减
 * - 时间窗口查询
 * - 时间聚合分析
 * - 记忆刷新机制
 * 
 * 基于认知科学的记忆模型：
 * - 遗忘曲线：R = e^(-t/S)
 * - 间隔重复：优化记忆保留
 * - 时间衰减：随时间降低重要性
 * 
 * @class TimeAwareMemoryManager
 */

export class TimeAwareMemoryManager {
    constructor(unifiedDataCore, eventSystem, deepMemoryManager) {
        console.log('[TimeAwareMemoryManager] ⏰ 时间感知记忆管理系统初始化开始');
        
        this.unifiedDataCore = unifiedDataCore;
        this.eventSystem = eventSystem;
        this.deepMemoryManager = deepMemoryManager;
        
        // 时间管理设置
        this.settings = {
            enabled: false,                         // 🔧 修复：默认禁用时间感知
            
            // 时间衰减设置
            enableDecay: true,                      // 启用时间衰减
            decayHalfLife: 30,                      // 半衰期（天）
            minImportance: 0.1,                     // 最小重要性
            
            // 刷新设置
            enableRefresh: true,                    // 启用记忆刷新
            refreshInterval: 7,                     // 刷新间隔（天）
            refreshThreshold: 0.7,                  // 刷新阈值
            
            // 时间窗口设置
            recentWindow: 24,                       // 最近时间窗口（小时）
            shortTermWindow: 7,                     // 短期时间窗口（天）
            longTermWindow: 30                      // 长期时间窗口（天）
        };
        
        // 时间线存储（聊天级别隔离）
        this.timelines = new Map();                 // chatId -> Timeline
        this.currentChatId = null;                  // 当前聊天ID
        
        // 刷新队列
        this.refreshQueue = new Map();              // memoryId -> nextRefreshTime
        
        // 统计信息
        this.stats = {
            totalMemories: 0,                       // 总记忆数
            decayedMemories: 0,                     // 已衰减记忆数
            refreshedMemories: 0,                   // 已刷新记忆数
            avgRetention: 0,                        // 平均保留率
            lastDecayTime: 0,                       // 最后衰减时间
            lastRefreshTime: 0                      // 最后刷新时间
        };
        
        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        
        // 🔧 修复：添加定时器管理
        this.periodicTimers = {
            decay: null,
            refresh: null
        };
        
        console.log('[TimeAwareMemoryManager] 🏗️ 构造函数完成');
    }

    /**
     * 初始化时间感知记忆管理系统
     */
    async init() {
        try {
            console.log('[TimeAwareMemoryManager] 📊 开始初始化时间感知记忆管理系统...');

            // 加载设置
            await this.loadSettings();

            // 🔧 修复：如果禁用，跳过初始化
            if (!this.settings.enabled) {
                console.log('[TimeAwareMemoryManager] ⏸️ 时间感知记忆管理系统已禁用，跳过初始化');
                this.initialized = true;
                return;
            }

            // 获取当前聊天ID
            this.currentChatId = this.unifiedDataCore?.getCurrentChatId?.();
            console.log('[TimeAwareMemoryManager] 📍 当前聊天ID:', this.currentChatId);

            // 加载现有时间线
            await this.loadTimelines();

            // 绑定事件监听器
            this.bindEventListeners();

            // 启动定期任务
            this.startPeriodicTasks();

            this.initialized = true;
            console.log('[TimeAwareMemoryManager] ✅ 时间感知记忆管理系统初始化完成');

            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('time-aware-memory:initialized', {
                    timestamp: Date.now(),
                    currentChatId: this.currentChatId
                });
            }

        } catch (error) {
            console.error('[TimeAwareMemoryManager] ❌ 初始化失败:', error);
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

                if (memoryEnhancement?.enhancement?.timeAware !== undefined) {
                    this.settings.enabled = memoryEnhancement.enhancement.timeAware;
                    console.log('[TimeAwareMemoryManager] 📥 从extensionSettings加载enabled:', this.settings.enabled);
                }
            } catch (error) {
                console.warn('[TimeAwareMemoryManager] ⚠️ 从extensionSettings加载设置失败:', error);
            }

            // 向后兼容：从unifiedDataCore加载其他设置
            if (this.unifiedDataCore) {
                const savedSettings = await this.unifiedDataCore.getData('time_aware_memory_settings');
                if (savedSettings) {
                    this.settings = { ...savedSettings, ...this.settings };
                    console.log('[TimeAwareMemoryManager] ✅ 设置已加载');
                }
            }

        } catch (error) {
            console.error('[TimeAwareMemoryManager] ❌ 加载设置失败:', error);
        }
    }

    /**
     * 🔧 新增：更新设置
     */
    async updateSettings(newSettings) {
        try {
            console.log('[TimeAwareMemoryManager] 🔄 更新设置:', newSettings);

            const oldEnabled = this.settings.enabled;
            this.settings = { ...this.settings, ...newSettings };

            // 如果启用状态改变
            if (newSettings.hasOwnProperty('enabled') && oldEnabled !== newSettings.enabled) {
                if (newSettings.enabled) {
                    console.log('[TimeAwareMemoryManager] ✅ 启用时间感知记忆');
                    this.startPeriodicTasks();
                } else {
                    console.log('[TimeAwareMemoryManager] ⏸️ 禁用时间感知记忆');
                    this.stopPeriodicTasks();
                }
            }

            // 保存设置
            if (this.unifiedDataCore) {
                await this.unifiedDataCore.setData('time_aware_memory_settings', this.settings);
            }

            console.log('[TimeAwareMemoryManager] ✅ 设置更新完成');

        } catch (error) {
            console.error('[TimeAwareMemoryManager] ❌ 更新设置失败:', error);
        }
    }

    /**
     * 加载现有时间线
     */
    async loadTimelines() {
        try {
            if (!this.unifiedDataCore) return;
            
            // 加载当前聊天的时间线
            if (this.currentChatId) {
                const timelineKey = `timeline_${this.currentChatId}`;
                const timeline = await this.unifiedDataCore.getData(timelineKey);
                
                if (timeline) {
                    this.timelines.set(this.currentChatId, timeline);
                    console.log('[TimeAwareMemoryManager] 📥 已加载聊天时间线:', this.currentChatId);
                } else {
                    // 创建新时间线
                    const newTimeline = this.createEmptyTimeline(this.currentChatId);
                    this.timelines.set(this.currentChatId, newTimeline);
                    console.log('[TimeAwareMemoryManager] 🆕 创建新时间线:', this.currentChatId);
                }
            }
            
        } catch (error) {
            console.error('[TimeAwareMemoryManager] ❌ 加载时间线失败:', error);
        }
    }

    /**
     * 创建空时间线
     */
    createEmptyTimeline(chatId) {
        return {
            chatId: chatId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            
            // 时间线事件
            events: [],                             // TimelineEvent[]
            
            // 时间索引
            hourIndex: new Map(),                   // hour -> event IDs
            dayIndex: new Map(),                    // day -> event IDs
            weekIndex: new Map(),                   // week -> event IDs
            monthIndex: new Map(),                  // month -> event IDs
            
            // 统计
            stats: {
                eventCount: 0,
                firstEventTime: null,
                lastEventTime: null
            }
        };
    }

    /**
     * 创建时间线事件
     */
    createTimelineEvent(memoryId, content, timestamp = Date.now()) {
        return {
            id: this.generateEventId(),
            memoryId: memoryId,
            content: content,
            timestamp: timestamp,
            importance: 1.0,                        // 初始重要性
            decayedImportance: 1.0,                 // 衰减后重要性
            lastRefreshTime: timestamp,             // 最后刷新时间
            refreshCount: 0                         // 刷新次数
        };
    }

    /**
     * 生成事件ID
     */
    generateEventId() {
        return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        try {
            if (!this.eventSystem) {
                console.warn('[TimeAwareMemoryManager] ⚠️ 事件系统未提供，跳过事件绑定');
                return;
            }
            
            // 监听聊天切换事件
            this.eventSystem.on('chat:changed', async (data) => {
                await this.handleChatSwitch(data);
            });
            
            // 监听记忆添加事件
            this.eventSystem.on('memory:added', async (data) => {
                await this.handleMemoryAdded(data);
            });
            
            console.log('[TimeAwareMemoryManager] 🔗 事件监听器已绑定');
            
        } catch (error) {
            console.error('[TimeAwareMemoryManager] ❌ 绑定事件监听器失败:', error);
        }
    }

    /**
     * 启动定期任务
     */
    startPeriodicTasks() {
        try {
            // 🔧 修复：先停止现有的定时器
            this.stopPeriodicTasks();
            
            // 每小时执行一次时间衰减
            if (this.settings.enableDecay) {
                this.periodicTimers.decay = setInterval(() => {
                    this.applyTimeDecay();
                }, 3600000); // 1小时
            }
            
            // 每天执行一次记忆刷新
            if (this.settings.enableRefresh) {
                this.periodicTimers.refresh = setInterval(() => {
                    this.refreshMemories();
                }, 86400000); // 24小时
            }
            
            console.log('[TimeAwareMemoryManager] ⏰ 定期任务已启动');
            
        } catch (error) {
            console.error('[TimeAwareMemoryManager] ❌ 启动定期任务失败:', error);
        }
    }

    /**
     * 🔧 修复：停止定期任务
     */
    stopPeriodicTasks() {
        try {
            // 清除时间衰减定时器
            if (this.periodicTimers.decay) {
                clearInterval(this.periodicTimers.decay);
                this.periodicTimers.decay = null;
                console.log('[TimeAwareMemoryManager] ⏹️ 已停止时间衰减定时器');
            }
            
            // 清除记忆刷新定时器
            if (this.periodicTimers.refresh) {
                clearInterval(this.periodicTimers.refresh);
                this.periodicTimers.refresh = null;
                console.log('[TimeAwareMemoryManager] ⏹️ 已停止记忆刷新定时器');
            }
            
            console.log('[TimeAwareMemoryManager] ⏹️ 所有定期任务已停止');
            
        } catch (error) {
            console.error('[TimeAwareMemoryManager] ❌ 停止定期任务失败:', error);
        }
    }

    /**
     * 处理聊天切换事件
     */
    async handleChatSwitch(data) {
        try {
            console.log('[TimeAwareMemoryManager] 🔄 处理聊天切换事件');
            
            if (!this.settings.enabled) return;
            
            // 获取新的聊天ID
            const newChatId = data?.chatId || this.unifiedDataCore?.getCurrentChatId?.();
            if (!newChatId || newChatId === this.currentChatId) {
                console.log('[TimeAwareMemoryManager] ℹ️ 聊天ID未变化，跳过处理');
                return;
            }
            
            console.log('[TimeAwareMemoryManager] 🔄 聊天切换:', this.currentChatId, '->', newChatId);
            
            // 保存当前聊天的时间线
            if (this.currentChatId) {
                await this.saveTimeline(this.currentChatId);
            }
            
            // 更新当前聊天ID
            this.currentChatId = newChatId;
            
            // 加载新聊天的时间线
            await this.loadChatTimeline(newChatId);
            
            console.log('[TimeAwareMemoryManager] ✅ 聊天切换处理完成');
            
        } catch (error) {
            console.error('[TimeAwareMemoryManager] ❌ 处理聊天切换事件失败:', error);
        }
    }

    /**
     * 加载聊天时间线
     */
    async loadChatTimeline(chatId) {
        try {
            if (!chatId) return;

            // 检查是否已在内存中
            if (this.timelines.has(chatId)) {
                console.log('[TimeAwareMemoryManager] 📥 从内存加载时间线:', chatId);
                return this.timelines.get(chatId);
            }

            // 从存储加载
            const timelineKey = `timeline_${chatId}`;
            const timeline = await this.unifiedDataCore?.getData(timelineKey);

            if (timeline) {
                this.timelines.set(chatId, timeline);
                console.log('[TimeAwareMemoryManager] 📥 从存储加载时间线:', chatId);
                return timeline;
            } else {
                // 创建新时间线
                const newTimeline = this.createEmptyTimeline(chatId);
                this.timelines.set(chatId, newTimeline);
                console.log('[TimeAwareMemoryManager] 🆕 创建新时间线:', chatId);
                return newTimeline;
            }

        } catch (error) {
            console.error('[TimeAwareMemoryManager] ❌ 加载聊天时间线失败:', error);
            return null;
        }
    }

    /**
     * 保存时间线
     */
    async saveTimeline(chatId) {
        try {
            if (!chatId || !this.unifiedDataCore) return;

            const timeline = this.timelines.get(chatId);
            if (!timeline) return;

            const timelineKey = `timeline_${chatId}`;
            await this.unifiedDataCore.setData(timelineKey, timeline);

            console.log('[TimeAwareMemoryManager] 💾 时间线已保存:', chatId);

        } catch (error) {
            console.error('[TimeAwareMemoryManager] ❌ 保存时间线失败:', error);
        }
    }

    /**
     * 处理记忆添加事件
     */
    async handleMemoryAdded(data) {
        try {
            if (!this.settings.enabled) return;

            const chatId = this.currentChatId || data?.chatId;
            if (!chatId) return;

            const memory = data?.memory;
            if (!memory) return;

            // 添加到时间线
            await this.addToTimeline(chatId, memory);

        } catch (error) {
            console.error('[TimeAwareMemoryManager] ❌ 处理记忆添加事件失败:', error);
        }
    }

    /**
     * 添加记忆到时间线
     */
    async addToTimeline(chatId, memory) {
        try {
            const timeline = this.timelines.get(chatId);
            if (!timeline) return;

            const timestamp = memory.timestamp || Date.now();
            const content = memory.content || '';
            const memoryId = memory.id || this.generateEventId();

            // 创建时间线事件
            const event = this.createTimelineEvent(memoryId, content, timestamp);
            event.importance = memory.metadata?.importance || 1.0;
            event.decayedImportance = event.importance;

            // 添加到事件列表
            timeline.events.push(event);
            timeline.stats.eventCount++;

            // 更新时间统计
            if (!timeline.stats.firstEventTime) {
                timeline.stats.firstEventTime = timestamp;
            }
            timeline.stats.lastEventTime = timestamp;

            // 更新时间索引
            this.updateTimeIndexes(timeline, event);

            // 更新时间戳
            timeline.updatedAt = Date.now();

            // 保存时间线
            await this.saveTimeline(chatId);

            console.log('[TimeAwareMemoryManager] ✅ 记忆已添加到时间线:', memoryId);

        } catch (error) {
            console.error('[TimeAwareMemoryManager] ❌ 添加记忆到时间线失败:', error);
        }
    }

    /**
     * 更新时间索引
     */
    updateTimeIndexes(timeline, event) {
        try {
            const date = new Date(event.timestamp);

            // 小时索引
            const hour = date.getHours();
            if (!timeline.hourIndex.has(hour)) {
                timeline.hourIndex.set(hour, []);
            }
            timeline.hourIndex.get(hour).push(event.id);

            // 日索引
            const day = date.toISOString().split('T')[0];
            if (!timeline.dayIndex.has(day)) {
                timeline.dayIndex.set(day, []);
            }
            timeline.dayIndex.get(day).push(event.id);

            // 周索引
            const week = this.getWeekKey(date);
            if (!timeline.weekIndex.has(week)) {
                timeline.weekIndex.set(week, []);
            }
            timeline.weekIndex.get(week).push(event.id);

            // 月索引
            const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!timeline.monthIndex.has(month)) {
                timeline.monthIndex.set(month, []);
            }
            timeline.monthIndex.get(month).push(event.id);

        } catch (error) {
            console.error('[TimeAwareMemoryManager] ❌ 更新时间索引失败:', error);
        }
    }

    /**
     * 获取周键
     */
    getWeekKey(date) {
        const year = date.getFullYear();
        const week = this.getWeekNumber(date);
        return `${year}-W${String(week).padStart(2, '0')}`;
    }

    /**
     * 获取周数
     */
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[TimeAwareMemoryManager] ❌ 错误:', error);

        if (this.eventSystem) {
            this.eventSystem.emit('time-aware-memory:error', {
                error: error.message,
                timestamp: Date.now(),
                errorCount: this.errorCount
            });
        }
    }

    /**
     * ⏳ 应用时间衰减（Ebbinghaus遗忘曲线）
     * 公式：R = e^(-t/S)
     * R: 保留率, t: 时间, S: 记忆强度（半衰期）
     */
    async applyTimeDecay() {
        try {
            if (!this.settings.enableDecay) return;

            console.log('[TimeAwareMemoryManager] ⏳ 开始应用时间衰减...');

            const now = Date.now();
            let decayedCount = 0;

            // 遍历所有时间线
            for (const [chatId, timeline] of this.timelines) {
                for (const event of timeline.events) {
                    // 计算时间差（天）
                    const timeDiff = (now - event.timestamp) / (1000 * 60 * 60 * 24);

                    // 应用指数衰减
                    const decayFactor = Math.exp(-timeDiff / this.settings.decayHalfLife);
                    const newImportance = event.importance * decayFactor;

                    // 更新衰减后重要性
                    if (newImportance >= this.settings.minImportance) {
                        event.decayedImportance = newImportance;
                    } else {
                        event.decayedImportance = this.settings.minImportance;
                    }

                    decayedCount++;
                }

                // 保存时间线
                await this.saveTimeline(chatId);
            }

            // 更新统计
            this.stats.decayedMemories = decayedCount;
            this.stats.lastDecayTime = now;

            console.log('[TimeAwareMemoryManager] ✅ 时间衰减完成，处理', decayedCount, '个记忆');

        } catch (error) {
            console.error('[TimeAwareMemoryManager] ❌ 应用时间衰减失败:', error);
        }
    }

    /**
     * 🔄 刷新记忆（间隔重复）
     */
    async refreshMemories() {
        try {
            if (!this.settings.enableRefresh) return;

            console.log('[TimeAwareMemoryManager] 🔄 开始刷新记忆...');

            const now = Date.now();
            let refreshedCount = 0;

            // 遍历所有时间线
            for (const [chatId, timeline] of this.timelines) {
                for (const event of timeline.events) {
                    // 检查是否需要刷新
                    const timeSinceRefresh = (now - event.lastRefreshTime) / (1000 * 60 * 60 * 24);

                    if (timeSinceRefresh >= this.settings.refreshInterval &&
                        event.decayedImportance >= this.settings.refreshThreshold) {

                        // 刷新记忆：重置衰减
                        event.decayedImportance = event.importance;
                        event.lastRefreshTime = now;
                        event.refreshCount++;

                        refreshedCount++;
                    }
                }

                // 保存时间线
                await this.saveTimeline(chatId);
            }

            // 更新统计
            this.stats.refreshedMemories = refreshedCount;
            this.stats.lastRefreshTime = now;

            console.log('[TimeAwareMemoryManager] ✅ 记忆刷新完成，刷新', refreshedCount, '个记忆');

        } catch (error) {
            console.error('[TimeAwareMemoryManager] ❌ 刷新记忆失败:', error);
        }
    }

    /**
     * 🔍 按时间窗口查询记忆
     */
    queryByTimeWindow(window = 'recent', chatId = null) {
        try {
            const targetChatId = chatId || this.currentChatId;
            const timeline = this.timelines.get(targetChatId);

            if (!timeline) return [];

            const now = Date.now();
            let startTime;

            // 确定时间窗口
            switch (window) {
                case 'recent':
                    startTime = now - (this.settings.recentWindow * 60 * 60 * 1000);
                    break;
                case 'today':
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    startTime = today.getTime();
                    break;
                case 'yesterday':
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    yesterday.setHours(0, 0, 0, 0);
                    const yesterdayEnd = new Date(yesterday);
                    yesterdayEnd.setHours(23, 59, 59, 999);
                    return timeline.events.filter(e =>
                        e.timestamp >= yesterday.getTime() &&
                        e.timestamp <= yesterdayEnd.getTime()
                    );
                case 'week':
                    startTime = now - (7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startTime = now - (30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startTime = 0;
            }

            // 过滤事件
            const events = timeline.events.filter(e => e.timestamp >= startTime);

            console.log('[TimeAwareMemoryManager] 🔍 查询时间窗口:', window, '找到', events.length, '个记忆');

            return events;

        } catch (error) {
            console.error('[TimeAwareMemoryManager] ❌ 按时间窗口查询失败:', error);
            return [];
        }
    }

    /**
     * 🔍 按时间范围查询记忆
     */
    queryByTimeRange(startTime, endTime, chatId = null) {
        try {
            const targetChatId = chatId || this.currentChatId;
            const timeline = this.timelines.get(targetChatId);

            if (!timeline) return [];

            const events = timeline.events.filter(e =>
                e.timestamp >= startTime && e.timestamp <= endTime
            );

            console.log('[TimeAwareMemoryManager] 🔍 查询时间范围:', new Date(startTime), '-', new Date(endTime), '找到', events.length, '个记忆');

            return events;

        } catch (error) {
            console.error('[TimeAwareMemoryManager] ❌ 按时间范围查询失败:', error);
            return [];
        }
    }

    /**
     * 📊 时间聚合分析
     */
    analyzeTimeDistribution(chatId = null) {
        try {
            const targetChatId = chatId || this.currentChatId;
            const timeline = this.timelines.get(targetChatId);

            if (!timeline) return null;

            const analysis = {
                totalEvents: timeline.stats.eventCount,
                firstEvent: timeline.stats.firstEventTime,
                lastEvent: timeline.stats.lastEventTime,

                // 按小时分布
                hourlyDistribution: {},

                // 按星期分布
                weeklyDistribution: {},

                // 活跃时段
                activeHours: [],

                // 平均间隔
                avgInterval: 0
            };

            // 计算小时分布
            for (let hour = 0; hour < 24; hour++) {
                const count = timeline.hourIndex.get(hour)?.length || 0;
                analysis.hourlyDistribution[hour] = count;
            }

            // 找出活跃时段（前5个小时）
            const hourCounts = Object.entries(analysis.hourlyDistribution)
                .map(([hour, count]) => ({ hour: parseInt(hour), count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            analysis.activeHours = hourCounts.map(h => h.hour);

            // 计算平均间隔
            if (timeline.events.length > 1) {
                const sortedEvents = [...timeline.events].sort((a, b) => a.timestamp - b.timestamp);
                let totalInterval = 0;

                for (let i = 1; i < sortedEvents.length; i++) {
                    totalInterval += sortedEvents[i].timestamp - sortedEvents[i - 1].timestamp;
                }

                analysis.avgInterval = totalInterval / (sortedEvents.length - 1);
            }

            return analysis;

        } catch (error) {
            console.error('[TimeAwareMemoryManager] ❌ 时间聚合分析失败:', error);
            return null;
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
            timelinesCount: this.timelines.size,
            currentTimeline: this.timelines.get(this.currentChatId),
            stats: this.stats,
            errorCount: this.errorCount
        };
    }
}

