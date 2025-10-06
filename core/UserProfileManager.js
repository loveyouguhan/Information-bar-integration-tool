/**
 * 用户画像管理系统
 * 
 * 核心功能：
 * - 用户偏好学习和管理
 * - 行为模式分析
 * - 个性化记忆管理
 * - 画像动态更新和演化
 * - 聊天级别画像隔离
 * 
 * 基于LangMem的用户画像最佳实践：
 * - Pydantic风格的数据模型
 * - 增量更新机制
 * - 命名空间隔离
 * 
 * @class UserProfileManager
 */

export class UserProfileManager {
    constructor(unifiedDataCore, eventSystem, deepMemoryManager, contextualRetrieval) {
        console.log('[UserProfileManager] 👤 用户画像管理系统初始化开始');
        
        this.unifiedDataCore = unifiedDataCore;
        this.eventSystem = eventSystem;
        this.deepMemoryManager = deepMemoryManager;
        this.contextualRetrieval = contextualRetrieval;
        
        // 画像管理设置
        this.settings = {
            enabled: false,                         // 🔧 修复：默认禁用用户画像
            
            // 学习策略
            autoLearn: true,                        // 自动学习用户偏好
            learningRate: 0.1,                      // 学习速率
            minConfidence: 0.6,                     // 最小置信度阈值
            
            // 更新策略
            updateFrequency: 5,                     // 每N条消息更新一次画像
            enableIncrementalUpdate: true,          // 启用增量更新
            
            // 个性化策略
            enablePersonalizedMemory: true,         // 启用个性化记忆
            enablePersonalizedRetrieval: true,      // 启用个性化检索
            
            // 隔离策略
            chatLevelIsolation: true,               // 聊天级别隔离
            globalProfile: false                    // 是否使用全局画像
        };
        
        // 用户画像存储（聊天级别隔离）
        this.profiles = new Map();                  // chatId -> UserProfile
        this.currentChatId = null;                  // 当前聊天ID

        // 消息计数器（用于触发更新）
        this.messageCounters = new Map();           // chatId -> count

        // 临时消息缓存（用于学习）
        this.messageCache = new Map();              // chatId -> messages[]
        
        // 统计信息
        this.stats = {
            totalProfiles: 0,                       // 总画像数
            totalUpdates: 0,                        // 总更新次数
            totalLearnings: 0,                      // 总学习次数
            avgConfidence: 0,                       // 平均置信度
            lastUpdateTime: 0                       // 最后更新时间
        };
        
        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        
        console.log('[UserProfileManager] 🏗️ 构造函数完成');
    }

    /**
     * 初始化用户画像管理系统
     */
    async init() {
        try {
            console.log('[UserProfileManager] 📊 开始初始化用户画像管理系统...');

            // 加载设置
            await this.loadSettings();

            // 🔧 修复：如果禁用，跳过初始化
            if (!this.settings.enabled) {
                console.log('[UserProfileManager] ⏸️ 用户画像管理系统已禁用，跳过初始化');
                this.initialized = true;
                return;
            }

            // 获取当前聊天ID
            this.currentChatId = this.unifiedDataCore?.getCurrentChatId?.();
            console.log('[UserProfileManager] 📍 当前聊天ID:', this.currentChatId);

            // 加载现有画像
            await this.loadProfiles();

            // 绑定事件监听器
            this.bindEventListeners();

            this.initialized = true;
            console.log('[UserProfileManager] ✅ 用户画像管理系统初始化完成');

            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('user-profile:initialized', {
                    timestamp: Date.now(),
                    currentChatId: this.currentChatId
                });
            }

        } catch (error) {
            console.error('[UserProfileManager] ❌ 初始化失败:', error);
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

                if (memoryEnhancement?.enhancement?.userProfile !== undefined) {
                    this.settings.enabled = memoryEnhancement.enhancement.userProfile;
                    console.log('[UserProfileManager] 📥 从extensionSettings加载enabled:', this.settings.enabled);
                }
            } catch (error) {
                console.warn('[UserProfileManager] ⚠️ 从extensionSettings加载设置失败:', error);
            }

            // 向后兼容：从unifiedDataCore加载其他设置
            if (this.unifiedDataCore) {
                const savedSettings = await this.unifiedDataCore.getData('user_profile_settings');
                if (savedSettings) {
                    this.settings = { ...savedSettings, ...this.settings };
                    console.log('[UserProfileManager] ✅ 设置已加载');
                }
            }

        } catch (error) {
            console.error('[UserProfileManager] ❌ 加载设置失败:', error);
        }
    }

    /**
     * 🔧 新增：更新设置
     */
    async updateSettings(newSettings) {
        try {
            console.log('[UserProfileManager] 🔄 更新设置:', newSettings);
            this.settings = { ...this.settings, ...newSettings };

            // 保存设置
            if (this.unifiedDataCore) {
                await this.unifiedDataCore.setData('user_profile_settings', this.settings);
            }

            console.log('[UserProfileManager] ✅ 设置更新完成');

        } catch (error) {
            console.error('[UserProfileManager] ❌ 更新设置失败:', error);
        }
    }

    /**
     * 加载现有画像
     */
    async loadProfiles() {
        try {
            if (!this.unifiedDataCore) return;
            
            // 加载当前聊天的画像
            if (this.currentChatId) {
                const profileKey = `user_profile_${this.currentChatId}`;
                const profile = await this.unifiedDataCore.getData(profileKey);
                
                if (profile) {
                    this.profiles.set(this.currentChatId, profile);
                    this.stats.totalProfiles++;
                    console.log('[UserProfileManager] 📥 已加载聊天画像:', this.currentChatId);
                } else {
                    // 创建新画像
                    const newProfile = this.createEmptyProfile(this.currentChatId);
                    this.profiles.set(this.currentChatId, newProfile);
                    console.log('[UserProfileManager] 🆕 创建新画像:', this.currentChatId);
                }
            }
            
        } catch (error) {
            console.error('[UserProfileManager] ❌ 加载画像失败:', error);
        }
    }

    /**
     * 创建空画像
     */
    createEmptyProfile(chatId) {
        return {
            chatId: chatId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            
            // 基本信息
            name: null,
            preferredName: null,
            language: null,
            timezone: null,
            
            // 偏好信息
            preferences: {
                responseStyle: null,            // 回复风格偏好
                topics: [],                     // 感兴趣的话题
                avoidTopics: [],                // 避免的话题
                communicationStyle: null,       // 沟通风格
                formality: 0.5                  // 正式程度 (0-1)
            },
            
            // 兴趣和技能
            interests: [],                      // 兴趣列表
            skills: [],                         // 技能列表
            goals: [],                          // 目标列表
            
            // 行为模式
            behaviorPatterns: {
                activeHours: [],                // 活跃时间段
                messageFrequency: 0,            // 消息频率
                averageMessageLength: 0,        // 平均消息长度
                topicSwitchRate: 0,             // 话题切换频率
                questionAsking: 0               // 提问频率
            },
            
            // 记忆偏好
            memoryPreferences: {
                importanceThreshold: 0.5,       // 重要性阈值
                retentionPeriod: 90,            // 保留期（天）
                preferredMemoryTypes: []        // 偏好的记忆类型
            },
            
            // 元数据
            metadata: {
                confidence: 0,                  // 画像置信度
                updateCount: 0,                 // 更新次数
                messageCount: 0,                // 消息计数
                lastInteraction: Date.now()     // 最后交互时间
            }
        };
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        try {
            if (!this.eventSystem) {
                console.warn('[UserProfileManager] ⚠️ 事件系统未提供，跳过事件绑定');
                return;
            }
            
            // 监听聊天切换事件
            this.eventSystem.on('chat:changed', async (data) => {
                await this.handleChatSwitch(data);
            });
            
            // 监听消息接收事件（用于学习）
            this.eventSystem.on('message:received', async (data) => {
                await this.handleMessageReceived(data);
            });
            
            console.log('[UserProfileManager] 🔗 事件监听器已绑定');
            
        } catch (error) {
            console.error('[UserProfileManager] ❌ 绑定事件监听器失败:', error);
        }
    }

    /**
     * 处理聊天切换事件
     */
    async handleChatSwitch(data) {
        try {
            console.log('[UserProfileManager] 🔄 处理聊天切换事件');
            
            if (!this.settings.enabled) return;
            
            // 获取新的聊天ID
            const newChatId = data?.chatId || this.unifiedDataCore?.getCurrentChatId?.();
            if (!newChatId || newChatId === this.currentChatId) {
                console.log('[UserProfileManager] ℹ️ 聊天ID未变化，跳过处理');
                return;
            }
            
            console.log('[UserProfileManager] 🔄 聊天切换:', this.currentChatId, '->', newChatId);
            
            // 保存当前聊天的画像
            if (this.currentChatId) {
                await this.saveProfile(this.currentChatId);
            }
            
            // 更新当前聊天ID
            this.currentChatId = newChatId;
            
            // 加载新聊天的画像
            await this.loadChatProfile(newChatId);
            
            console.log('[UserProfileManager] ✅ 聊天切换处理完成');
            
        } catch (error) {
            console.error('[UserProfileManager] ❌ 处理聊天切换事件失败:', error);
        }
    }

    /**
     * 加载聊天画像
     */
    async loadChatProfile(chatId) {
        try {
            if (!chatId) return;

            // 检查是否已在内存中
            if (this.profiles.has(chatId)) {
                console.log('[UserProfileManager] 📥 从内存加载画像:', chatId);
                return this.profiles.get(chatId);
            }

            // 从存储加载
            const profileKey = `user_profile_${chatId}`;
            const profile = await this.unifiedDataCore?.getData(profileKey);

            if (profile) {
                this.profiles.set(chatId, profile);
                console.log('[UserProfileManager] 📥 从存储加载画像:', chatId);
                return profile;
            } else {
                // 创建新画像
                const newProfile = this.createEmptyProfile(chatId);
                this.profiles.set(chatId, newProfile);
                console.log('[UserProfileManager] 🆕 创建新画像:', chatId);
                return newProfile;
            }

        } catch (error) {
            console.error('[UserProfileManager] ❌ 加载聊天画像失败:', error);
            return null;
        }
    }

    /**
     * 保存画像
     */
    async saveProfile(chatId) {
        try {
            if (!chatId || !this.unifiedDataCore) return;

            const profile = this.profiles.get(chatId);
            if (!profile) return;

            const profileKey = `user_profile_${chatId}`;
            await this.unifiedDataCore.setData(profileKey, profile);

            console.log('[UserProfileManager] 💾 画像已保存:', chatId);

        } catch (error) {
            console.error('[UserProfileManager] ❌ 保存画像失败:', error);
        }
    }

    /**
     * 处理消息接收事件
     */
    async handleMessageReceived(data) {
        try {
            console.log('[UserProfileManager] 📝 处理消息接收事件', data);

            if (!this.settings.enabled || !this.settings.autoLearn) {
                console.log('[UserProfileManager] ⚠️ 功能未启用，跳过处理');
                return;
            }

            const chatId = this.currentChatId || data?.chatId;
            if (!chatId) {
                console.log('[UserProfileManager] ⚠️ 无聊天ID，跳过处理');
                return;
            }

            console.log('[UserProfileManager] 📍 处理聊天:', chatId);

            // 获取或创建画像
            let profile = this.profiles.get(chatId);
            if (!profile) {
                profile = await this.loadChatProfile(chatId);
            }

            // 缓存消息用于学习
            const message = data?.message;
            if (message) {
                if (!this.messageCache.has(chatId)) {
                    this.messageCache.set(chatId, []);
                }
                const cache = this.messageCache.get(chatId);
                cache.push(message);

                // 限制缓存大小
                if (cache.length > 50) {
                    cache.shift();
                }
            }

            // 更新消息计数
            profile.metadata.messageCount++;
            profile.metadata.lastInteraction = Date.now();

            // 增加消息计数器
            const currentCount = (this.messageCounters.get(chatId) || 0) + 1;
            this.messageCounters.set(chatId, currentCount);

            // 检查是否需要更新画像
            if (currentCount >= this.settings.updateFrequency) {
                await this.updateProfile(chatId, data);
                this.messageCounters.set(chatId, 0);
            }

        } catch (error) {
            console.error('[UserProfileManager] ❌ 处理消息接收事件失败:', error);
        }
    }

    /**
     * 更新用户画像
     */
    async updateProfile(chatId, messageData) {
        try {
            console.log('[UserProfileManager] 🔄 开始更新用户画像:', chatId);

            const profile = this.profiles.get(chatId);
            if (!profile) return;

            // 获取最近的对话历史
            const recentHistory = await this.getRecentHistory(chatId, 10);
            if (!recentHistory || recentHistory.length === 0) {
                console.log('[UserProfileManager] ⚠️ 无对话历史，跳过画像更新');
                return;
            }

            console.log('[UserProfileManager] 📚 获取到', recentHistory.length, '条对话历史');

            // 学习用户偏好
            await this.learnPreferences(profile, recentHistory);

            // 分析行为模式
            await this.analyzeBehaviorPatterns(profile, recentHistory);

            // 更新元数据
            profile.updatedAt = Date.now();
            profile.metadata.updateCount++;
            this.stats.totalUpdates++;
            this.stats.lastUpdateTime = Date.now();

            // 保存画像
            await this.saveProfile(chatId);

            console.log('[UserProfileManager] ✅ 用户画像更新完成');

            // 触发更新事件
            if (this.eventSystem) {
                this.eventSystem.emit('user-profile:updated', {
                    chatId: chatId,
                    timestamp: Date.now(),
                    confidence: profile.metadata.confidence
                });
            }

        } catch (error) {
            console.error('[UserProfileManager] ❌ 更新用户画像失败:', error);
        }
    }

    /**
     * 获取最近的对话历史
     */
    async getRecentHistory(chatId, limit = 10) {
        try {
            // 优先从消息缓存获取
            if (this.messageCache.has(chatId)) {
                const cache = this.messageCache.get(chatId);
                if (cache && cache.length > 0) {
                    console.log('[UserProfileManager] 📥 从缓存获取对话历史:', cache.length, '条');
                    return cache.slice(-limit);
                }
            }

            // 从UnifiedDataCore获取
            if (!this.unifiedDataCore) return [];

            const history = await this.unifiedDataCore.getData('recent_history');
            if (!history || !Array.isArray(history)) return [];

            return history.slice(-limit);

        } catch (error) {
            console.error('[UserProfileManager] ❌ 获取对话历史失败:', error);
            return [];
        }
    }

    /**
     * 学习用户偏好
     */
    async learnPreferences(profile, messages) {
        try {
            console.log('[UserProfileManager] 🧠 开始学习用户偏好...');

            // 分析消息内容
            for (const msg of messages) {
                const content = msg.mes || msg.content || '';
                if (!content) continue;

                // 提取话题关键词
                const topics = this.extractTopics(content);
                for (const topic of topics) {
                    if (!profile.preferences.topics.includes(topic)) {
                        profile.preferences.topics.push(topic);
                    }
                }

                // 分析沟通风格
                const style = this.analyzeCommunicationStyle(content);
                if (style) {
                    profile.preferences.communicationStyle = style;
                }

                // 提取兴趣和技能
                const interests = this.extractInterests(content);
                for (const interest of interests) {
                    if (!profile.interests.includes(interest)) {
                        profile.interests.push(interest);
                    }
                }
            }

            // 更新置信度
            profile.metadata.confidence = Math.min(
                1.0,
                profile.metadata.confidence + this.settings.learningRate
            );

            this.stats.totalLearnings++;
            console.log('[UserProfileManager] ✅ 偏好学习完成');

        } catch (error) {
            console.error('[UserProfileManager] ❌ 学习用户偏好失败:', error);
        }
    }

    /**
     * 分析行为模式
     */
    async analyzeBehaviorPatterns(profile, messages) {
        try {
            console.log('[UserProfileManager] 📊 开始分析行为模式...');

            if (messages.length === 0) return;

            // 计算平均消息长度
            const totalLength = messages.reduce((sum, msg) => {
                const content = msg.mes || msg.content || '';
                return sum + content.length;
            }, 0);
            profile.behaviorPatterns.averageMessageLength = Math.round(totalLength / messages.length);

            // 计算消息频率（消息/小时）
            const timeSpan = messages[messages.length - 1].timestamp - messages[0].timestamp;
            if (timeSpan > 0) {
                profile.behaviorPatterns.messageFrequency =
                    (messages.length / timeSpan) * 3600000; // 转换为消息/小时
            }

            // 分析活跃时间段
            const hours = messages.map(msg => {
                const date = new Date(msg.timestamp);
                return date.getHours();
            });
            profile.behaviorPatterns.activeHours = [...new Set(hours)];

            console.log('[UserProfileManager] ✅ 行为模式分析完成');

        } catch (error) {
            console.error('[UserProfileManager] ❌ 分析行为模式失败:', error);
        }
    }

    /**
     * 提取话题关键词
     */
    extractTopics(text) {
        try {
            // 简单的关键词提取（可以后续使用更复杂的NLP）
            const keywords = [];
            const commonTopics = [
                '编程', '代码', 'JavaScript', 'Python', 'AI', '机器学习', '深度学习',
                '记忆', '向量', '检索', '数据库', '算法', '设计', '架构',
                '音乐', '电影', '游戏', '运动', '旅行', '美食', '阅读'
            ];

            for (const topic of commonTopics) {
                if (text.includes(topic)) {
                    keywords.push(topic);
                }
            }

            return keywords;

        } catch (error) {
            return [];
        }
    }

    /**
     * 分析沟通风格
     */
    analyzeCommunicationStyle(text) {
        try {
            // 检测emoji使用
            const hasEmoji = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]/u.test(text);

            // 检测正式程度
            const hasFormalWords = /请|您|敬请|恳请/.test(text);
            const hasCasualWords = /哈|嘿|哇|呀/.test(text);

            if (hasEmoji && hasCasualWords) {
                return 'casual_friendly';
            } else if (hasFormalWords) {
                return 'formal_polite';
            } else {
                return 'neutral';
            }

        } catch (error) {
            return null;
        }
    }

    /**
     * 提取兴趣
     */
    extractInterests(text) {
        try {
            const interests = [];

            // 检测兴趣表达
            const interestPatterns = [
                /喜欢(.{1,10})/g,
                /爱好(.{1,10})/g,
                /感兴趣(.{1,10})/g,
                /热爱(.{1,10})/g
            ];

            for (const pattern of interestPatterns) {
                const matches = text.matchAll(pattern);
                for (const match of matches) {
                    if (match[1]) {
                        interests.push(match[1].trim());
                    }
                }
            }

            return interests;

        } catch (error) {
            return [];
        }
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[UserProfileManager] ❌ 错误:', error);

        if (this.eventSystem) {
            this.eventSystem.emit('user-profile:error', {
                error: error.message,
                timestamp: Date.now(),
                errorCount: this.errorCount
            });
        }
    }

    /**
     * 🎯 获取当前用户画像
     */
    getCurrentProfile() {
        try {
            if (!this.currentChatId) return null;
            return this.profiles.get(this.currentChatId);
        } catch (error) {
            console.error('[UserProfileManager] ❌ 获取当前画像失败:', error);
            return null;
        }
    }

    /**
     * 🎯 个性化记忆重要性评估
     * 根据用户画像调整记忆的重要性分数
     */
    personalizeMemoryImportance(memory, profile = null) {
        try {
            if (!this.settings.enablePersonalizedMemory) {
                return memory.metadata?.importance || 0.5;
            }

            const currentProfile = profile || this.getCurrentProfile();
            if (!currentProfile) {
                return memory.metadata?.importance || 0.5;
            }

            let importance = memory.metadata?.importance || 0.5;
            const content = memory.content || '';

            // 根据用户兴趣调整重要性
            for (const interest of currentProfile.interests) {
                if (content.includes(interest)) {
                    importance += 0.1;
                }
            }

            // 根据用户偏好话题调整重要性
            for (const topic of currentProfile.preferences.topics) {
                if (content.includes(topic)) {
                    importance += 0.15;
                }
            }

            // 根据用户技能调整重要性
            for (const skill of currentProfile.skills) {
                if (content.includes(skill)) {
                    importance += 0.1;
                }
            }

            // 限制在0-1范围内
            importance = Math.max(0, Math.min(1, importance));

            return importance;

        } catch (error) {
            console.error('[UserProfileManager] ❌ 个性化记忆重要性评估失败:', error);
            return memory.metadata?.importance || 0.5;
        }
    }

    /**
     * 🎯 个性化检索查询增强
     * 根据用户画像增强检索查询
     */
    personalizeQuery(query, profile = null) {
        try {
            if (!this.settings.enablePersonalizedRetrieval) {
                return query;
            }

            const currentProfile = profile || this.getCurrentProfile();
            if (!currentProfile) {
                return query;
            }

            let enhancedQuery = query;

            // 添加用户偏好上下文
            if (currentProfile.preferences.topics.length > 0) {
                const topTopics = currentProfile.preferences.topics.slice(0, 3);
                enhancedQuery += ` [用户关注: ${topTopics.join(', ')}]`;
            }

            // 添加用户兴趣上下文
            if (currentProfile.interests.length > 0) {
                const topInterests = currentProfile.interests.slice(0, 2);
                enhancedQuery += ` [用户兴趣: ${topInterests.join(', ')}]`;
            }

            return enhancedQuery;

        } catch (error) {
            console.error('[UserProfileManager] ❌ 个性化查询增强失败:', error);
            return query;
        }
    }

    /**
     * 🎯 个性化检索结果重排序
     * 根据用户画像重新排序检索结果
     */
    personalizeResults(results, profile = null) {
        try {
            if (!this.settings.enablePersonalizedRetrieval) {
                return results;
            }

            const currentProfile = profile || this.getCurrentProfile();
            if (!currentProfile) {
                return results;
            }

            // 为每个结果计算个性化分数
            const scoredResults = results.map(result => {
                let personalScore = result.score || result.fusedScore || 0;
                const content = result.content || '';

                // 根据用户兴趣加分
                for (const interest of currentProfile.interests) {
                    if (content.includes(interest)) {
                        personalScore *= 1.2;
                    }
                }

                // 根据用户偏好话题加分
                for (const topic of currentProfile.preferences.topics) {
                    if (content.includes(topic)) {
                        personalScore *= 1.15;
                    }
                }

                // 根据用户技能加分
                for (const skill of currentProfile.skills) {
                    if (content.includes(skill)) {
                        personalScore *= 1.1;
                    }
                }

                return {
                    ...result,
                    personalScore: personalScore,
                    originalScore: result.score || result.fusedScore || 0
                };
            });

            // 按个性化分数排序
            scoredResults.sort((a, b) => b.personalScore - a.personalScore);

            return scoredResults;

        } catch (error) {
            console.error('[UserProfileManager] ❌ 个性化结果重排序失败:', error);
            return results;
        }
    }

    /**
     * 🎯 获取用户偏好摘要
     */
    getPreferencesSummary(profile = null) {
        try {
            const currentProfile = profile || this.getCurrentProfile();
            if (!currentProfile) {
                return '暂无用户画像信息';
            }

            const parts = [];

            if (currentProfile.name) {
                parts.push(`姓名: ${currentProfile.name}`);
            }

            if (currentProfile.preferences.topics.length > 0) {
                parts.push(`关注话题: ${currentProfile.preferences.topics.slice(0, 5).join(', ')}`);
            }

            if (currentProfile.interests.length > 0) {
                parts.push(`兴趣爱好: ${currentProfile.interests.slice(0, 5).join(', ')}`);
            }

            if (currentProfile.skills.length > 0) {
                parts.push(`技能特长: ${currentProfile.skills.slice(0, 5).join(', ')}`);
            }

            if (currentProfile.preferences.communicationStyle) {
                parts.push(`沟通风格: ${currentProfile.preferences.communicationStyle}`);
            }

            parts.push(`置信度: ${(currentProfile.metadata.confidence * 100).toFixed(1)}%`);
            parts.push(`更新次数: ${currentProfile.metadata.updateCount}`);

            return parts.join('\n');

        } catch (error) {
            console.error('[UserProfileManager] ❌ 获取偏好摘要失败:', error);
            return '获取用户画像失败';
        }
    }

    /**
     * 🎯 手动更新用户信息
     */
    async updateUserInfo(updates) {
        try {
            const profile = this.getCurrentProfile();
            if (!profile) {
                console.warn('[UserProfileManager] ⚠️ 当前无画像，无法更新');
                return false;
            }

            // 更新基本信息
            if (updates.name) profile.name = updates.name;
            if (updates.preferredName) profile.preferredName = updates.preferredName;
            if (updates.language) profile.language = updates.language;
            if (updates.timezone) profile.timezone = updates.timezone;

            // 更新偏好
            if (updates.preferences) {
                profile.preferences = { ...profile.preferences, ...updates.preferences };
            }

            // 更新兴趣
            if (updates.interests) {
                profile.interests = [...new Set([...profile.interests, ...updates.interests])];
            }

            // 更新技能
            if (updates.skills) {
                profile.skills = [...new Set([...profile.skills, ...updates.skills])];
            }

            // 更新元数据
            profile.updatedAt = Date.now();
            profile.metadata.updateCount++;

            // 保存
            await this.saveProfile(this.currentChatId);

            console.log('[UserProfileManager] ✅ 用户信息已更新');
            return true;

        } catch (error) {
            console.error('[UserProfileManager] ❌ 更新用户信息失败:', error);
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
            profilesCount: this.profiles.size,
            currentProfile: this.getCurrentProfile(),
            stats: this.stats,
            errorCount: this.errorCount
        };
    }
}

