/**
 * 剧情规划助手
 * 
 * 核心功能：
 * - 基于AI记忆数据库的剧情规划优化
 * - 智能关键词提取和上下文分析
 * - 多维度记忆检索（关键词、时间线、重要性）
 * - 剧情发展建议生成
 * - 与SmartPromptSystem深度集成
 * 
 * 工作流程：
 * 1. 监听用户消息发送事件
 * 2. 分析当前对话上下文，提取关键词
 * 3. 从AI记忆数据库检索相关记忆
 * 4. 分析记忆内容，生成剧情规划建议
 * 5. 将建议注入到AI提示词中
 * 6. AI根据建议生成更连贯的剧情回复
 * 
 * @class StoryPlanningAssistant
 */

export class StoryPlanningAssistant {
    constructor(dependencies = {}) {
        console.log('[StoryPlanningAssistant] 📖 剧情规划助手初始化开始');
        
        // 🔧 依赖注入
        this.unifiedDataCore = dependencies.unifiedDataCore || window.InfoBarData;
        this.eventSystem = dependencies.eventSystem || window.SillyTavernInfobar?.eventSource;
        this.configManager = dependencies.configManager || window.SillyTavernInfobar?.modules?.configManager;
        this.aiMemoryDatabase = dependencies.aiMemoryDatabase || null;
        this.smartPromptSystem = dependencies.smartPromptSystem || null;
        this.contextualRetrieval = dependencies.contextualRetrieval || null;
        this.deepMemoryManager = dependencies.deepMemoryManager || null;
        
        // 🚀 配置
        this.config = {
            enabled: false,                         // 默认禁用，需要在设置中启用
            autoActivate: true,                     // 自动激活剧情规划
            minMessageLength: 10,                   // 最小消息长度（触发条件）
            maxKeywords: 10,                        // 最大关键词数量
            minKeywordLength: 2,                    // 最小关键词长度
            maxMemoryResults: 15,                   // 最大记忆检索结果数
            minMemoryImportance: 0.5,               // 最小记忆重要性阈值
            contextWindowSize: 5,                   // 上下文窗口大小（消息数）
            enableSemanticAnalysis: true,           // 启用语义分析
            enableTimelineAware: true,              // 启用时间线感知
            enablePlotContinuity: true,             // 启用剧情连续性检查
            suggestionDetailLevel: 'detailed',      // 建议详细程度：'brief'|'detailed'|'comprehensive'
            injectTiming: 'before_generate',        // 注入时机：'before_generate'|'on_demand'
            cacheEnabled: true,                     // 启用缓存
            cacheDuration: 300000                   // 缓存持续时间（5分钟）
        };
        
        // 📊 统计信息
        this.stats = {
            totalPlannings: 0,                      // 总规划次数
            totalKeywordsExtracted: 0,              // 总提取关键词数
            totalMemoriesRetrieved: 0,              // 总检索记忆数
            totalSuggestionsGenerated: 0,           // 总生成建议数
            avgProcessingTime: 0,                   // 平均处理时间
            cacheHits: 0,                           // 缓存命中次数
            lastPlanningTime: 0                     // 最后规划时间
        };
        
        // 🧠 关键词提取器
        this.keywordExtractor = {
            // 中文停用词
            stopWords: new Set([
                '的', '了', '和', '是', '就', '都', '而', '及', '与', '着', '或', '一个', 
                '没有', '我们', '你们', '他们', '她们', '它们', '这个', '那个', '什么', 
                '怎么', '为什么', '因为', '所以', '但是', '然后', '如果', '虽然', '不过',
                '可以', '应该', '需要', '能够', '必须', '可能', '也许', '大概', '好像'
            ]),
            
            // 关键词类型权重
            typeWeights: {
                person: 1.5,        // 人物名称
                location: 1.3,      // 地点
                event: 1.4,         // 事件
                emotion: 1.2,       // 情感
                object: 1.1,        // 物品
                action: 1.0,        // 动作
                default: 1.0        // 默认
            },
            
            // 重要标记词
            importantMarkers: [
                '重要', '关键', '决定', '转折', '突然', '发现', '意外', '惊讶',
                '秘密', '危险', '机会', '冲突', '矛盾', '解决', '改变', '影响'
            ]
        };
        
        // 🎭 剧情规划缓存
        this.planningCache = new Map();             // messageHash -> planningResult
        
        // 🔖 上下文历史
        this.contextHistory = [];                   // 最近的对话上下文
        this.maxContextHistory = 20;                // 最大上下文历史数
        
        // 📝 当前剧情状态
        this.currentPlotState = {
            mainCharacters: new Set(),              // 主要角色
            currentLocation: null,                  // 当前地点
            activeEvents: new Set(),                // 活跃事件
            plotPoints: [],                         // 剧情点
            timeline: [],                           // 时间线
            conflicts: [],                          // 冲突
            resolutions: []                         // 解决方案
        };
        
        // 🚀 初始化状态
        this.initialized = false;
        this.isProcessing = false;
        this.errorCount = 0;
        
        console.log('[StoryPlanningAssistant] 🏗️ 构造函数完成');
    }

    /**
     * 初始化剧情规划助手
     */
    async init() {
        try {
            console.log('[StoryPlanningAssistant] 📊 开始初始化剧情规划助手...');

            // 加载配置
            await this.loadConfig();

            // 验证依赖（即使禁用也要验证）
            if (!this.aiMemoryDatabase) {
                console.warn('[StoryPlanningAssistant] ⚠️ AI记忆数据库不可用，部分功能受限');
            }

            if (!this.smartPromptSystem) {
                console.warn('[StoryPlanningAssistant] ⚠️ 智能提示词系统不可用，无法注入规划建议');
            }

            // 🔧 修复：无论是否启用，都先完成基础初始化
            this.initialized = true;

            // 🔧 只有在启用时才绑定事件监听器和初始化剧情状态
            if (this.config.enabled) {
                console.log('[StoryPlanningAssistant] ✅ 剧情规划助手已启用，绑定事件监听器...');
                
                // 绑定事件监听器
                this.bindEventListeners();

                // 初始化剧情状态
                await this.initializePlotState();

                console.log('[StoryPlanningAssistant] ✅ 剧情规划助手初始化完成（已启用）');

                // 触发初始化完成事件
                this.eventSystem?.emit('storyPlanning:initialized', {
                    timestamp: Date.now(),
                    config: this.config
                });
            } else {
                console.log('[StoryPlanningAssistant] ⏸️ 剧情规划助手已初始化但未启用（不绑定事件监听器）');
            }

        } catch (error) {
            this.errorCount++;
            console.error('[StoryPlanningAssistant] ❌ 初始化失败:', error);
            throw error;
        }
    }

    /**
     * 加载配置
     */
    async loadConfig() {
        try {
            if (!this.configManager) {
                console.warn('[StoryPlanningAssistant] ⚠️ ConfigManager不可用，使用默认配置');
                return;
            }

            const context = SillyTavern.getContext();
            const extensionSettings = context?.extensionSettings?.['Information bar integration tool'] || {};
            const savedConfig = extensionSettings.aiEnhancement?.storyPlanning || {};

            // 合并配置
            this.config = {
                ...this.config,
                ...savedConfig
            };

            console.log('[StoryPlanningAssistant] ✅ 配置已加载:', this.config);

        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 加载配置失败:', error);
        }
    }

    /**
     * 保存配置
     */
    async saveConfig() {
        try {
            if (!this.configManager) {
                console.warn('[StoryPlanningAssistant] ⚠️ ConfigManager不可用，无法保存配置');
                return;
            }

            const context = SillyTavern.getContext();
            const extensionSettings = context?.extensionSettings?.['Information bar integration tool'] || {};

            if (!extensionSettings.aiEnhancement) {
                extensionSettings.aiEnhancement = {};
            }

            extensionSettings.aiEnhancement.storyPlanning = this.config;
            context.extensionSettings['Information bar integration tool'] = extensionSettings;

            await context.saveSettingsDebounced();
            console.log('[StoryPlanningAssistant] ✅ 配置已保存');

        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 保存配置失败:', error);
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        try {
            console.log('[StoryPlanningAssistant] 🔗 绑定事件监听器...');

            // 1. 监听SillyTavern的全局事件（通过eventSource）
            const globalEventSource = SillyTavern.getContext()?.eventSource;
            if (globalEventSource) {
                // 监听生成开始事件（在用户消息发送后、AI生成前触发）
                globalEventSource.on('generation_started', async (data) => {
                    await this.handleGenerationStarted(data);
                });
                
                // 也监听用户消息发送事件作为备用
                globalEventSource.on('message_sent', async (data) => {
                    await this.handleMessageSent(data);
                });
                
                console.log('[StoryPlanningAssistant] ✅ 已绑定SillyTavern全局事件');
            } else {
                console.warn('[StoryPlanningAssistant] ⚠️ SillyTavern全局eventSource不可用');
            }

            // 2. 监听内部EventSystem的事件
            if (this.eventSystem) {
                // 监听聊天切换事件
                this.eventSystem.on('chat:switched', (data) => {
                    this.handleChatSwitched(data);
                });

                // 监听记忆更新事件
                this.eventSystem.on('deepMemory:memoryAdded', (data) => {
                    this.handleMemoryUpdated(data);
                });

                // 监听配置变更事件
                this.eventSystem.on('config:changed', (data) => {
                    if (data.module === 'storyPlanning') {
                        this.handleConfigChanged(data);
                    }
                });
                
                console.log('[StoryPlanningAssistant] ✅ 已绑定内部EventSystem事件');
            } else {
                console.warn('[StoryPlanningAssistant] ⚠️ 内部EventSystem不可用');
            }

            console.log('[StoryPlanningAssistant] ✅ 所有事件监听器绑定完成');

        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 绑定事件监听器失败:', error);
        }
    }

    /**
     * 初始化剧情状态
     */
    async initializePlotState() {
        try {
            console.log('[StoryPlanningAssistant] 🎭 初始化剧情状态...');

            // 从现有记忆中恢复剧情状态
            if (this.aiMemoryDatabase && this.aiMemoryDatabase.initialized) {
                await this.restorePlotStateFromMemories();
            }

            console.log('[StoryPlanningAssistant] ✅ 剧情状态初始化完成');

        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 初始化剧情状态失败:', error);
        }
    }

    /**
     * 从记忆中恢复剧情状态
     */
    async restorePlotStateFromMemories() {
        try {
            if (!this.aiMemoryDatabase) return;

            // 获取所有记忆
            const memories = Array.from(this.aiMemoryDatabase.database.memories.values());
            
            // 提取角色信息
            for (const memory of memories) {
                if (memory.category === 'character' || memory.keywords?.some(k => k.includes('角色') || k.includes('人物'))) {
                    // 提取角色名称
                    const characterNames = this.extractCharacterNames(memory.summary || memory.content);
                    characterNames.forEach(name => this.currentPlotState.mainCharacters.add(name));
                }
                
                // 提取地点信息
                if (memory.category === 'location' || memory.keywords?.some(k => k.includes('地点') || k.includes('场所'))) {
                    this.currentPlotState.currentLocation = memory.summary || memory.content;
                }
                
                // 提取事件信息
                if (memory.category === 'event' || memory.keywords?.some(k => k.includes('事件') || k.includes('发生'))) {
                    this.currentPlotState.activeEvents.add(memory.summary || memory.content);
                }
            }

            console.log('[StoryPlanningAssistant] 📊 剧情状态恢复完成:', {
                characters: this.currentPlotState.mainCharacters.size,
                location: this.currentPlotState.currentLocation,
                events: this.currentPlotState.activeEvents.size
            });

        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 恢复剧情状态失败:', error);
        }
    }

    /**
     * 处理生成开始事件（核心功能 - 在AI生成前触发）
     */
    async handleGenerationStarted(data) {
        try {
            if (!this.config.enabled || !this.config.autoActivate) {
                return;
            }

            if (this.isProcessing) {
                console.log('[StoryPlanningAssistant] ⏳ 正在处理中，跳过本次规划');
                return;
            }

            const startTime = Date.now();
            this.isProcessing = true;

            console.log('[StoryPlanningAssistant] 🎬 开始剧情规划分析（generation_started）...');

            // 从SillyTavern上下文获取聊天历史
            const context = SillyTavern.getContext();
            const chat = context.chat;
            
            if (!chat || chat.length === 0) {
                console.log('[StoryPlanningAssistant] ℹ️ 聊天记录为空，跳过规划');
                this.isProcessing = false;
                return;
            }

            // 构建上下文：获取最近的对话（包括用户和AI的消息）
            const recentMessages = this.getRecentContext(chat, this.config.contextWindowSize);
            
            if (recentMessages.length === 0) {
                console.log('[StoryPlanningAssistant] ℹ️ 没有足够的上下文，跳过规划');
                this.isProcessing = false;
                return;
            }

            // 合并上下文消息
            const contextText = recentMessages.map(msg => msg.mes).join(' ');
            console.log('[StoryPlanningAssistant] 📝 上下文长度:', contextText.length, '字符，消息数:', recentMessages.length);
            console.log('[StoryPlanningAssistant] 📝 上下文预览:', contextText.substring(0, 100) + (contextText.length > 100 ? '...' : ''));
            
            await this.performPlanning(contextText, startTime);

        } catch (error) {
            this.errorCount++;
            console.error('[StoryPlanningAssistant] ❌ 处理生成开始事件失败:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 处理消息发送事件（备用方案）
     */
    async handleMessageSent(data) {
        try {
            if (!this.config.enabled || !this.config.autoActivate) {
                return;
            }

            if (this.isProcessing) {
                return;
            }

            const startTime = Date.now();
            this.isProcessing = true;

            console.log('[StoryPlanningAssistant] 🎬 开始剧情规划分析（message_sent）...');

            const message = data.message || data.text || '';
            
            if (message.length < this.config.minMessageLength) {
                this.isProcessing = false;
                return;
            }

            await this.performPlanning(message, startTime);

        } catch (error) {
            this.errorCount++;
            console.error('[StoryPlanningAssistant] ❌ 处理消息发送事件失败:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 获取最近的对话上下文
     */
    getRecentContext(chat, windowSize) {
        try {
            // 获取最近N条消息（不包括系统消息）
            const messages = chat.filter(msg => !msg.is_system);
            
            // 获取最近的消息
            const recent = messages.slice(-windowSize);
            
            console.log('[StoryPlanningAssistant] 📚 获取上下文: 总消息', messages.length, '条，取最近', recent.length, '条');
            
            return recent;
            
        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 获取上下文失败:', error);
            return [];
        }
    }

    /**
     * 执行剧情规划的核心逻辑
     */
    async performPlanning(message, startTime) {
        try {
            // 1. 提取关键词
            const keywords = await this.extractKeywords(message);
            console.log('[StoryPlanningAssistant] 🔑 提取关键词:', keywords);

            // 2. 检索相关记忆
            const memories = await this.retrieveRelevantMemories(keywords, message);
            console.log('[StoryPlanningAssistant] 🧠 检索到记忆数量:', memories.length);

            // 3. 分析剧情上下文
            const plotContext = await this.analyzePlotContext(message, memories);
            console.log('[StoryPlanningAssistant] 📖 剧情上下文:', plotContext);

            // 4. 生成剧情规划建议
            const suggestions = await this.generatePlotSuggestions(plotContext, memories);
            console.log('[StoryPlanningAssistant] 💡 生成建议数量:', suggestions.length);

            // 5. 注入到提示词系统
            if (suggestions.length > 0 && this.smartPromptSystem) {
                await this.injectPlotSuggestions(suggestions, memories, plotContext);
            }

            // 更新统计
            const processingTime = Date.now() - startTime;
            this.updateStats(keywords.length, memories.length, suggestions.length, processingTime);

            console.log('[StoryPlanningAssistant] ✅ 剧情规划完成，耗时:', processingTime, 'ms');

            // 触发事件
            this.eventSystem?.emit('storyPlanning:completed', {
                keywords,
                memoriesCount: memories.length,
                suggestionsCount: suggestions.length,
                processingTime
            });

        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 执行剧情规划失败:', error);
            throw error;
        }
    }

    /**
     * 提取关键词
     */
    async extractKeywords(text) {
        try {
            const keywords = [];
            
            // 简单的中文分词（基于常见分隔符）
            const segments = text.split(/[，。！？；：、\s,\.!\?;:\s]+/).filter(Boolean);
            
            for (const segment of segments) {
                // 跳过停用词
                if (this.keywordExtractor.stopWords.has(segment)) continue;
                
                // 跳过过短的词
                if (segment.length < this.config.minKeywordLength) continue;
                
                // 计算权重
                let weight = 1.0;
                
                // 检查是否包含重要标记
                for (const marker of this.keywordExtractor.importantMarkers) {
                    if (segment.includes(marker)) {
                        weight *= 1.5;
                        break;
                    }
                }
                
                keywords.push({
                    text: segment,
                    weight,
                    type: this.classifyKeywordType(segment)
                });
            }
            
            // 按权重排序并限制数量
            keywords.sort((a, b) => b.weight - a.weight);
            const topKeywords = keywords.slice(0, this.config.maxKeywords);
            
            // 更新统计
            this.stats.totalKeywordsExtracted += topKeywords.length;
            
            return topKeywords.map(k => k.text);
            
        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 提取关键词失败:', error);
            return [];
        }
    }

    /**
     * 分类关键词类型
     */
    classifyKeywordType(keyword) {
        // 简单的类型分类逻辑
        const personIndicators = ['名字', '人', '角色', '他', '她', '我'];
        const locationIndicators = ['在', '到', '去', '地方', '处'];
        const eventIndicators = ['发生', '事', '做', '进行'];
        const emotionIndicators = ['感觉', '心情', '情绪', '开心', '难过', '愤怒'];
        const objectIndicators = ['东西', '物品', '道具', '装备'];
        
        if (personIndicators.some(ind => keyword.includes(ind))) return 'person';
        if (locationIndicators.some(ind => keyword.includes(ind))) return 'location';
        if (eventIndicators.some(ind => keyword.includes(ind))) return 'event';
        if (emotionIndicators.some(ind => keyword.includes(ind))) return 'emotion';
        if (objectIndicators.some(ind => keyword.includes(ind))) return 'object';
        
        return 'default';
    }

    /**
     * 检索相关记忆
     */
    async retrieveRelevantMemories(keywords, context) {
        try {
            if (!this.aiMemoryDatabase || !this.aiMemoryDatabase.initialized) {
                console.warn('[StoryPlanningAssistant] ⚠️ AI记忆数据库不可用');
                return [];
            }

            const allMemories = [];
            
            // 1. 基于关键词检索
            for (const keyword of keywords) {
                const results = await this.aiMemoryDatabase.searchByKeywords([keyword], {
                    maxResults: 5,
                    minImportance: this.config.minMemoryImportance
                });
                
                if (results && results.length > 0) {
                    allMemories.push(...results);
                }
            }
            
            // 2. 如果启用了上下文检索，使用混合检索
            if (this.contextualRetrieval && this.contextualRetrieval.settings.enabled) {
                const contextResults = await this.contextualRetrieval.search(context, {
                    maxResults: 10,
                    includeContext: true
                });
                
                if (contextResults && contextResults.length > 0) {
                    allMemories.push(...contextResults);
                }
            }
            
            // 3. 去重和排序
            const uniqueMemories = this.deduplicateMemories(allMemories);
            const sortedMemories = this.sortMemoriesByRelevance(uniqueMemories, keywords);
            
            // 限制数量
            const finalMemories = sortedMemories.slice(0, this.config.maxMemoryResults);
            
            // 更新统计
            this.stats.totalMemoriesRetrieved += finalMemories.length;
            
            return finalMemories;
            
        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 检索记忆失败:', error);
            return [];
        }
    }

    /**
     * 去重记忆
     */
    deduplicateMemories(memories) {
        const seen = new Set();
        const unique = [];
        
        for (const memory of memories) {
            const id = memory.id || memory.memoryId;
            if (!seen.has(id)) {
                seen.add(id);
                unique.push(memory);
            }
        }
        
        return unique;
    }

    /**
     * 按相关性排序记忆
     */
    sortMemoriesByRelevance(memories, keywords) {
        return memories.sort((a, b) => {
            // 计算相关性分数
            let scoreA = (a.importance || 0.5) * 0.5;
            let scoreB = (b.importance || 0.5) * 0.5;
            
            // 关键词匹配度
            const keywordsA = a.keywords || [];
            const keywordsB = b.keywords || [];
            
            for (const keyword of keywords) {
                if (keywordsA.some(k => k.includes(keyword) || keyword.includes(k))) {
                    scoreA += 0.1;
                }
                if (keywordsB.some(k => k.includes(keyword) || keyword.includes(k))) {
                    scoreB += 0.1;
                }
            }
            
            // 时间衰减（可选）
            if (this.config.enableTimelineAware) {
                const timeFactorA = this.calculateTimeDecay(a.timestamp);
                const timeFactorB = this.calculateTimeDecay(b.timestamp);
                scoreA *= timeFactorA;
                scoreB *= timeFactorB;
            }
            
            return scoreB - scoreA;
        });
    }

    /**
     * 计算时间衰减因子
     */
    calculateTimeDecay(timestamp) {
        if (!timestamp) return 1.0;
        
        const now = Date.now();
        const ageInDays = (now - timestamp) / (1000 * 60 * 60 * 24);
        
        // 指数衰减：7天内保持100%，之后每7天衰减10%
        if (ageInDays <= 7) return 1.0;
        return Math.max(0.3, 1.0 - (ageInDays - 7) / 70);
    }

    /**
     * 分析剧情上下文
     */
    async analyzePlotContext(message, memories) {
        try {
            const context = {
                // 当前消息分析
                currentMessage: {
                    text: message,
                    length: message.length,
                    sentiment: this.analyzeSentiment(message),
                    topics: this.extractTopics(message)
                },
                
                // 记忆相关分析
                memoryInsights: {
                    totalMemories: memories.length,
                    categories: this.categorizeMemories(memories),
                    keyThemes: this.extractKeyThemes(memories),
                    characters: this.extractCharactersFromMemories(memories),
                    locations: this.extractLocationsFromMemories(memories),
                    events: this.extractEventsFromMemories(memories)
                },
                
                // 剧情状态
                plotState: {
                    mainCharacters: Array.from(this.currentPlotState.mainCharacters),
                    currentLocation: this.currentPlotState.currentLocation,
                    activeEvents: Array.from(this.currentPlotState.activeEvents),
                    plotPoints: this.currentPlotState.plotPoints.slice(-5) // 最近5个剧情点
                },
                
                // 连续性检查
                continuity: this.config.enablePlotContinuity ? 
                    await this.checkPlotContinuity(message, memories) : null
            };
            
            return context;
            
        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 分析剧情上下文失败:', error);
            return {};
        }
    }

    /**
     * 分析情感
     */
    analyzeSentiment(text) {
        // 简单的情感分析
        const positiveWords = ['开心', '高兴', '快乐', '喜欢', '爱', '好', '棒', '优秀', '成功'];
        const negativeWords = ['难过', '伤心', '生气', '讨厌', '恨', '坏', '失败', '痛苦', '危险'];
        
        let score = 0;
        positiveWords.forEach(word => {
            if (text.includes(word)) score += 1;
        });
        negativeWords.forEach(word => {
            if (text.includes(word)) score -= 1;
        });
        
        if (score > 0) return 'positive';
        if (score < 0) return 'negative';
        return 'neutral';
    }

    /**
     * 提取主题
     */
    extractTopics(text) {
        const topics = [];
        const topicPatterns = {
            '战斗': ['战斗', '打', '攻击', '防御', '战争', '敌人'],
            '对话': ['说', '讲', '聊', '谈话', '交流', '沟通'],
            '探索': ['探索', '寻找', '发现', '调查', '搜索', '前往'],
            '情感': ['感情', '爱', '喜欢', '讨厌', '关系', '友谊'],
            '成长': ['学习', '成长', '进步', '提升', '训练', '修炼']
        };
        
        for (const [topic, patterns] of Object.entries(topicPatterns)) {
            if (patterns.some(pattern => text.includes(pattern))) {
                topics.push(topic);
            }
        }
        
        return topics;
    }

    /**
     * 分类记忆
     */
    categorizeMemories(memories) {
        const categories = {};
        
        for (const memory of memories) {
            const category = memory.category || 'other';
            if (!categories[category]) {
                categories[category] = 0;
            }
            categories[category]++;
        }
        
        return categories;
    }

    /**
     * 提取关键主题
     */
    extractKeyThemes(memories) {
        const themes = new Map();
        
        for (const memory of memories) {
            const keywords = memory.keywords || [];
            for (const keyword of keywords) {
                themes.set(keyword, (themes.get(keyword) || 0) + 1);
            }
        }
        
        // 按频率排序
        return Array.from(themes.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([theme]) => theme);
    }

    /**
     * 从记忆中提取角色
     */
    extractCharactersFromMemories(memories) {
        const characters = new Set();
        
        for (const memory of memories) {
            if (memory.category === 'character') {
                const names = this.extractCharacterNames(memory.summary || memory.content);
                names.forEach(name => characters.add(name));
            }
        }
        
        return Array.from(characters);
    }

    /**
     * 提取角色名称
     * 🔧 严重BUG修复：之前的正则过于宽泛，把所有词都当成角色了！
     */
    extractCharacterNames(text) {
        const names = [];
        
        // 🔧 修复：使用更严格的角色名称提取逻辑
        // 只提取：1) 英文大写开头的名字 2) 2-3个字的中文人名
        const namePattern = /\b([A-Z][a-z]{2,})\b|(?:^|[，。！？\s])([一-龥]{2,3})(?=[，。！？\s说道想着]|$)/g;
        const matches = text.match(namePattern);
        
        if (matches) {
            names.push(...matches);
        }
        
        return [...new Set(names)];
    }

    /**
     * 从记忆中提取地点
     */
    extractLocationsFromMemories(memories) {
        const locations = new Set();
        
        for (const memory of memories) {
            if (memory.category === 'location') {
                locations.add(memory.summary || memory.content);
            }
        }
        
        return Array.from(locations);
    }

    /**
     * 从记忆中提取事件
     */
    extractEventsFromMemories(memories) {
        const events = [];
        
        for (const memory of memories) {
            if (memory.category === 'event') {
                events.push({
                    description: memory.summary || memory.content,
                    timestamp: memory.timestamp,
                    importance: memory.importance
                });
            }
        }
        
        return events.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
    }

    /**
     * 检查剧情连续性
     * 🔧 严重BUG修复：之前的逻辑导致生成大量无用的"可以考虑介绍xxx的背景信息"
     */
    async checkPlotContinuity(message, memories) {
        try {
            const issues = [];
            const suggestions = [];
            
            // 🔧 修复：限制角色检查，避免误判
            const mentionedCharacters = this.extractCharacterNames(message);
            
            // 🔧 新增：过滤掉常见词汇，只保留真正的角色名
            const stopWords = ['当前', '何种', '情境', '时间', '夜晚', '地点', '房间', '背景', '信息', '关系', 
                             '姿势', '门口', '面前', '之间', '距离', '内容', '指令', '情况', '方式', '氛围'];
            
            const actualCharacters = mentionedCharacters.filter(name => 
                name && 
                name.length >= 2 && 
                name.length <= 4 &&
                !stopWords.includes(name) &&
                !/^[的了着过]$/.test(name)  // 过滤助词
            );
            
            // 🔧 新增：限制最多只提示3个新角色
            const limitedCharacters = actualCharacters.slice(0, 3);
            
            for (const character of limitedCharacters) {
                if (!this.currentPlotState.mainCharacters.has(character)) {
                    issues.push(`新角色出现: ${character}`);
                    suggestions.push(`可以考虑介绍${character}的背景信息`);
                    // 🔧 新增：立即将新角色添加到状态，避免重复提示
                    this.currentPlotState.mainCharacters.add(character);
                }
            }
            
            // 检查事件连贯性
            const currentTopics = this.extractTopics(message);
            const memoryTopics = this.extractKeyThemes(memories);
            
            const hasTopicContinuity = currentTopics.some(topic => 
                memoryTopics.some(memTopic => memTopic.includes(topic) || topic.includes(memTopic))
            );
            
            if (!hasTopicContinuity && currentTopics.length > 0) {
                issues.push('剧情主题发生转变');
                suggestions.push('可以添加过渡性描述，使剧情转变更自然');
            }
            
            // 🔧 新增：限制返回的suggestions数量，防止过多重复建议
            const limitedSuggestions = suggestions.slice(0, 5);
            
            console.log(`[StoryPlanningAssistant] 📊 连续性检查: ${issues.length}个问题, ${limitedSuggestions.length}个建议`);
            
            return {
                hasIssues: issues.length > 0,
                issues,
                suggestions: limitedSuggestions  // 🔧 修复：返回限制后的建议
            };
            
        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 检查剧情连续性失败:', error);
            return null;
        }
    }

    /**
     * 生成剧情规划建议（核心功能）
     */
    async generatePlotSuggestions(plotContext, memories) {
        try {
            const suggestions = [];
            
            // 1. 基于记忆的剧情发展建议
            if (memories.length > 0) {
                const memorySuggestion = this.generateMemoryBasedSuggestions(memories, plotContext);
                if (memorySuggestion) {
                    suggestions.push(memorySuggestion);
                }
            }
            
            // 2. 角色发展建议
            if (plotContext.memoryInsights?.characters?.length > 0) {
                const characterSuggestion = this.generateCharacterDevelopmentSuggestions(
                    plotContext.memoryInsights.characters,
                    memories
                );
                if (characterSuggestion) {
                    suggestions.push(characterSuggestion);
                }
            }
            
            // 3. 剧情连续性建议
            if (plotContext.continuity?.hasIssues) {
                const continuitySuggestion = this.generateContinuitySuggestions(plotContext.continuity);
                if (continuitySuggestion) {
                    suggestions.push(continuitySuggestion);
                }
            }
            
            // 4. 事件发展建议
            if (plotContext.memoryInsights?.events?.length > 0) {
                const eventSuggestion = this.generateEventDevelopmentSuggestions(
                    plotContext.memoryInsights.events
                );
                if (eventSuggestion) {
                    suggestions.push(eventSuggestion);
                }
            }
            
            // 5. 情感与氛围建议
            const sentimentSuggestion = this.generateSentimentSuggestions(
                plotContext.currentMessage?.sentiment,
                memories
            );
            if (sentimentSuggestion) {
                suggestions.push(sentimentSuggestion);
            }
            
            // 更新统计
            this.stats.totalSuggestionsGenerated += suggestions.length;
            
            return suggestions;
            
        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 生成剧情建议失败:', error);
            return [];
        }
    }

    /**
     * 生成基于记忆的建议
     */
    generateMemoryBasedSuggestions(memories, plotContext) {
        try {
            const highImportanceMemories = memories.filter(m => (m.importance || 0) >= 0.7);
            
            if (highImportanceMemories.length === 0) return null;
            
            // 提取关键记忆内容
            const keyMemories = highImportanceMemories.slice(0, 5).map(m => ({
                content: m.summary || m.content,
                keywords: m.keywords || [],
                category: m.category,
                importance: m.importance
            }));
            
            return {
                type: 'memory_based',
                priority: 'high',
                title: '基于历史记忆的剧情建议',
                content: `检测到${highImportanceMemories.length}条重要历史记忆，建议在剧情中考虑以下要素：`,
                details: keyMemories,
                actionable: `可以通过回顾或引用这些记忆来增强剧情的连贯性和深度。关键记忆包括：${keyMemories.map(m => m.content).join('；')}`
            };
            
        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 生成记忆建议失败:', error);
            return null;
        }
    }

    /**
     * 生成角色发展建议
     */
    generateCharacterDevelopmentSuggestions(characters, memories) {
        try {
            if (characters.length === 0) return null;
            
            const characterMemories = memories.filter(m => m.category === 'character');
            const characterDevelopment = [];
            
            for (const character of characters) {
                const relatedMemories = characterMemories.filter(m => 
                    (m.summary || m.content).includes(character)
                );
                
                if (relatedMemories.length > 0) {
                    characterDevelopment.push({
                        name: character,
                        memoriesCount: relatedMemories.length,
                        latestMemory: relatedMemories[0]?.summary || relatedMemories[0]?.content
                    });
                }
            }
            
            if (characterDevelopment.length === 0) return null;
            
            return {
                type: 'character_development',
                priority: 'medium',
                title: '角色发展建议',
                content: `涉及${characterDevelopment.length}个角色，建议关注其性格和关系的发展`,
                details: characterDevelopment,
                actionable: `重点角色：${characterDevelopment.map(c => c.name).join('、')}。可以深入探索这些角色的内心世界和相互关系。`
            };
            
        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 生成角色建议失败:', error);
            return null;
        }
    }

    /**
     * 生成连续性建议
     * 🔧 严重BUG修复：限制建议数量和长度，防止生成上万字符的重复内容
     */
    generateContinuitySuggestions(continuity) {
        try {
            if (!continuity || !continuity.hasIssues) return null;
            
            // 🔧 修复：限制suggestions数量，最多5个
            const limitedSuggestions = (continuity.suggestions || []).slice(0, 5);
            
            // 🔧 修复：拼接前检查总长度
            const joinedSuggestions = limitedSuggestions.join('；');
            
            // 🔧 新增：如果拼接后超过500字符，强制截断
            const maxActionableLength = 500;
            const actionableText = joinedSuggestions.length > maxActionableLength ?
                joinedSuggestions.substring(0, maxActionableLength) + '... (建议过多已截断)' :
                joinedSuggestions;
            
            console.log(`[StoryPlanningAssistant] 📊 连续性建议: ${continuity.issues.length}个问题, ${limitedSuggestions.length}个建议 (长度: ${actionableText.length}字符)`);
            
            return {
                type: 'continuity',
                priority: 'high',
                title: '剧情连续性提醒',
                content: `检测到${continuity.issues.length}个连续性问题`,
                details: {
                    issues: continuity.issues.slice(0, 3),  // 🔧 修复：也限制issues数量
                    suggestions: limitedSuggestions
                },
                actionable: actionableText  // 🔧 修复：使用限制后的文本
            };
            
        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 生成连续性建议失败:', error);
            return null;
        }
    }

    /**
     * 生成事件发展建议
     */
    generateEventDevelopmentSuggestions(events) {
        try {
            if (events.length === 0) return null;
            
            // 分析事件趋势
            const recentEvents = events.slice(0, 3);
            
            return {
                type: 'event_development',
                priority: 'medium',
                title: '事件发展建议',
                content: `基于最近的${recentEvents.length}个事件，建议考虑剧情走向`,
                details: recentEvents,
                actionable: `可以考虑这些事件的后续影响和发展。最近的关键事件：${recentEvents.map(e => e.description).join('；')}`
            };
            
        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 生成事件建议失败:', error);
            return null;
        }
    }

    /**
     * 生成情感氛围建议
     */
    generateSentimentSuggestions(currentSentiment, memories) {
        try {
            // 分析历史情感趋势
            const sentimentHistory = memories
                .filter(m => m.sentiment)
                .slice(0, 5)
                .map(m => m.sentiment);
            
            if (sentimentHistory.length === 0) return null;
            
            // 检测情感变化
            const lastSentiment = sentimentHistory[0];
            const sentimentChanged = currentSentiment !== lastSentiment;
            
            return {
                type: 'sentiment',
                priority: 'low',
                title: '情感氛围建议',
                content: sentimentChanged ? 
                    `情感氛围从${lastSentiment}转变为${currentSentiment}` :
                    `当前情感氛围保持${currentSentiment}`,
                details: {
                    current: currentSentiment,
                    history: sentimentHistory
                },
                actionable: sentimentChanged ?
                    '注意情感转变的合理性，可以添加过渡性描述' :
                    '可以继续保持当前的情感氛围，或考虑适当的变化'
            };
            
        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 生成情感建议失败:', error);
            return null;
        }
    }

    /**
     * 注入剧情建议到提示词系统
     */
    async injectPlotSuggestions(suggestions, memories, plotContext) {
        try {
            if (!this.smartPromptSystem) {
                console.warn('[StoryPlanningAssistant] ⚠️ SmartPromptSystem不可用，无法注入建议');
                return;
            }

            console.log('[StoryPlanningAssistant] 💉 注入剧情建议到提示词系统...');

            // 构建剧情规划提示词
            const plotPrompt = this.buildPlotPrompt(suggestions, memories, plotContext);

            // 注入到SmartPromptSystem
            // 通过事件系统传递，让SmartPromptSystem在生成提示词时包含这些建议
            this.eventSystem?.emit('storyPlanning:suggestionsReady', {
                prompt: plotPrompt,
                suggestions,
                memories: memories.slice(0, 5), // 只传递前5个最相关的记忆
                context: plotContext
            });

            console.log('[StoryPlanningAssistant] ✅ 剧情建议已传递');

        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 注入剧情建议失败:', error);
        }
    }

    /**
     * 构建剧情规划提示词
     */
    buildPlotPrompt(suggestions, memories, plotContext) {
        try {
            let prompt = '';

            // 根据详细程度级别构建提示词
            if (this.config.suggestionDetailLevel === 'comprehensive') {
                prompt = this.buildComprehensivePrompt(suggestions, memories, plotContext);
            } else if (this.config.suggestionDetailLevel === 'detailed') {
                prompt = this.buildDetailedPrompt(suggestions, memories);
            } else {
                prompt = this.buildBriefPrompt(suggestions);
            }

            return prompt;

        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 构建剧情提示词失败:', error);
            return '';
        }
    }

    /**
     * 构建简要提示词
     */
    buildBriefPrompt(suggestions) {
        const lines = [
            '【剧情规划建议】',
            ''
        ];

        for (const suggestion of suggestions) {
            if (suggestion.priority === 'high') {
                lines.push(`⚠️ ${suggestion.title}: ${suggestion.actionable}`);
            }
        }

        return lines.join('\n');
    }

    /**
     * 构建详细提示词
     */
    buildDetailedPrompt(suggestions, memories) {
        const lines = [
            '【🎬 剧情规划辅助系统】',
            '',
            '📊 相关历史记忆：',
            ...memories.slice(0, 5).map((m, i) => 
                `${i + 1}. [${m.category || '其他'}] ${m.summary || m.content} (重要性: ${((m.importance || 0) * 100).toFixed(0)}%)`
            ),
            '',
            '💡 剧情发展建议：'
        ];

        suggestions.forEach((suggestion, index) => {
            const priority = suggestion.priority === 'high' ? '⚠️' : 
                           suggestion.priority === 'medium' ? '📌' : 'ℹ️';
            lines.push(`${priority} ${index + 1}. ${suggestion.title}`);
            lines.push(`   ${suggestion.actionable}`);
        });

        return lines.join('\n');
    }

    /**
     * 构建全面提示词
     */
    buildComprehensivePrompt(suggestions, memories, plotContext) {
        const lines = [
            '【🎬 剧情规划辅助系统 - 全面分析】',
            '',
            '📖 当前剧情状态：',
            `   主要角色: ${plotContext.plotState?.mainCharacters?.join('、') || '无'}`,
            `   当前地点: ${plotContext.plotState?.currentLocation || '未知'}`,
            `   活跃事件: ${plotContext.plotState?.activeEvents?.size || 0}个`,
            '',
            '🧠 相关历史记忆 (共${memories.length}条)：',
            ...memories.slice(0, 8).map((m, i) => {
                const keywords = (m.keywords || []).slice(0, 3).join(', ');
                return `${i + 1}. [${m.category || '其他'}] ${m.summary || m.content}\n   关键词: ${keywords} | 重要性: ${((m.importance || 0) * 100).toFixed(0)}%`;
            }),
            '',
            '💡 剧情发展建议：'
        ];

        // 按优先级分组
        const highPriority = suggestions.filter(s => s.priority === 'high');
        const mediumPriority = suggestions.filter(s => s.priority === 'medium');
        const lowPriority = suggestions.filter(s => s.priority === 'low');

        if (highPriority.length > 0) {
            lines.push('', '⚠️ 高优先级建议：');
            highPriority.forEach((s, i) => {
                lines.push(`${i + 1}. ${s.title}`);
                lines.push(`   内容: ${s.content}`);
                lines.push(`   行动建议: ${s.actionable}`);
            });
        }

        if (mediumPriority.length > 0) {
            lines.push('', '📌 中优先级建议：');
            mediumPriority.forEach((s, i) => {
                lines.push(`${i + 1}. ${s.title}: ${s.actionable}`);
            });
        }

        if (lowPriority.length > 0) {
            lines.push('', 'ℹ️ 参考建议：');
            lowPriority.forEach((s, i) => {
                lines.push(`${i + 1}. ${s.title}: ${s.actionable}`);
            });
        }

        // 剧情连续性提醒
        if (plotContext.continuity?.hasIssues) {
            lines.push('', '🔍 连续性检查：');
            plotContext.continuity.issues.forEach(issue => {
                lines.push(`   ⚠️ ${issue}`);
            });
        }

        return lines.join('\n');
    }

    /**
     * 处理聊天切换事件
     */
    handleChatSwitched(data) {
        try {
            console.log('[StoryPlanningAssistant] 🔄 聊天切换，重置剧情状态');

            // 重置剧情状态
            this.currentPlotState = {
                mainCharacters: new Set(),
                currentLocation: null,
                activeEvents: new Set(),
                plotPoints: [],
                timeline: [],
                conflicts: [],
                resolutions: []
            };

            // 清除缓存
            this.planningCache.clear();

            // 重新初始化剧情状态
            this.initializePlotState();

        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 处理聊天切换失败:', error);
        }
    }

    /**
     * 处理记忆更新事件
     */
    handleMemoryUpdated(data) {
        try {
            console.log('[StoryPlanningAssistant] 🧠 记忆更新，刷新剧情状态');

            // 清除相关缓存
            this.planningCache.clear();

            // 可以选择性地更新剧情状态
            // this.initializePlotState();

        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 处理记忆更新失败:', error);
        }
    }

    /**
     * 处理配置变更事件
     */
    handleConfigChanged(data) {
        try {
            console.log('[StoryPlanningAssistant] ⚙️ 配置变更:', data);

            // 重新加载配置
            this.loadConfig();

        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 处理配置变更失败:', error);
        }
    }

    /**
     * 更新统计信息
     */
    updateStats(keywordsCount, memoriesCount, suggestionsCount, processingTime) {
        this.stats.totalPlannings++;
        this.stats.lastPlanningTime = Date.now();

        // 更新平均处理时间
        const totalTime = this.stats.avgProcessingTime * (this.stats.totalPlannings - 1) + processingTime;
        this.stats.avgProcessingTime = totalTime / this.stats.totalPlannings;
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.planningCache.size,
            plotStateSize: {
                characters: this.currentPlotState.mainCharacters.size,
                events: this.currentPlotState.activeEvents.size,
                plotPoints: this.currentPlotState.plotPoints.length
            }
        };
    }

    /**
     * 获取当前剧情状态
     */
    getPlotState() {
        return {
            mainCharacters: Array.from(this.currentPlotState.mainCharacters),
            currentLocation: this.currentPlotState.currentLocation,
            activeEvents: Array.from(this.currentPlotState.activeEvents),
            plotPoints: this.currentPlotState.plotPoints,
            timeline: this.currentPlotState.timeline
        };
    }

    /**
     * 手动触发剧情规划
     */
    async planStory(context) {
        try {
            console.log('[StoryPlanningAssistant] 🎬 手动触发剧情规划...');

            const message = context.message || context.text || '';
            
            // 提取关键词
            const keywords = await this.extractKeywords(message);
            
            // 检索记忆
            const memories = await this.retrieveRelevantMemories(keywords, message);
            
            // 分析上下文
            const plotContext = await this.analyzePlotContext(message, memories);
            
            // 生成建议
            const suggestions = await this.generatePlotSuggestions(plotContext, memories);
            
            return {
                keywords,
                memories,
                plotContext,
                suggestions,
                prompt: this.buildPlotPrompt(suggestions, memories, plotContext)
            };

        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 手动剧情规划失败:', error);
            throw error;
        }
    }

    /**
     * 启用/禁用剧情规划助手
     */
    async setEnabled(enabled) {
        const wasEnabled = this.config.enabled;
        this.config.enabled = enabled;
        await this.saveConfig();
        
        // 🔧 修复：如果从禁用变为启用，需要绑定事件监听器
        if (!wasEnabled && enabled && this.initialized) {
            console.log('[StoryPlanningAssistant] 🔗 从禁用变为启用，重新绑定事件监听器...');
            this.bindEventListeners();
            await this.initializePlotState();
        }
        
        console.log(`[StoryPlanningAssistant] ${enabled ? '✅ 已启用' : '⏸️ 已禁用'}剧情规划助手`);
        
        this.eventSystem?.emit('storyPlanning:enabledChanged', { enabled });
    }

    /**
     * 清理资源
     */
    async cleanup() {
        try {
            console.log('[StoryPlanningAssistant] 🧹 清理资源...');

            // 清除缓存
            this.planningCache.clear();

            // 重置状态
            this.currentPlotState = {
                mainCharacters: new Set(),
                currentLocation: null,
                activeEvents: new Set(),
                plotPoints: [],
                timeline: [],
                conflicts: [],
                resolutions: []
            };

            console.log('[StoryPlanningAssistant] ✅ 资源清理完成');

        } catch (error) {
            console.error('[StoryPlanningAssistant] ❌ 清理资源失败:', error);
        }
    }

    /**
     * 获取模块状态
     */
    getStatus() {
        return {
            initialized: this.initialized,
            enabled: this.config.enabled,
            isProcessing: this.isProcessing,
            errorCount: this.errorCount,
            stats: this.getStats(),
            dependencies: {
                aiMemoryDatabase: !!this.aiMemoryDatabase,
                smartPromptSystem: !!this.smartPromptSystem,
                contextualRetrieval: !!this.contextualRetrieval,
                deepMemoryManager: !!this.deepMemoryManager
            }
        };
    }
}

