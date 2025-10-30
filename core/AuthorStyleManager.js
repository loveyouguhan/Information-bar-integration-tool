/**
 * 📚 AuthorStyleManager - 作家文风管理器
 * 
 * 功能：
 * - 管理作家文风数据库
 * - 分析作家的写作特点
 * - 提取作家的写作手法
 * - 生成文风指导建议
 */

export class AuthorStyleManager {
    constructor(dependencies = {}) {
        console.log('[AuthorStyleManager] 📚 作家文风管理器初始化');

        // 依赖注入
        this.novelAnalyzer = dependencies.novelAnalyzer || window.SillyTavernInfobar?.modules?.novelAnalyzer;
        this.infoBarSettings = dependencies.infoBarSettings || window.SillyTavernInfobar?.modules?.settings;
        this.eventSource = dependencies.eventSource || window.SillyTavernInfobar?.eventSource;
        this.context = dependencies.context || window.SillyTavern?.getContext?.();

        // 初始化作家文风数据库（内存缓存）
        this.authorStyles = new Map();

        // 配置
        this.config = {
            enabled: false,                    // 是否启用作家模仿功能
            targetAuthor: '',                   // 目标作家名称
            analysisDepth: 'comprehensive',     // 分析深度：quick/standard/comprehensive
            cacheExpiry: 7 * 24 * 60 * 60 * 1000, // 缓存过期时间（7天）
            maxWorksToAnalyze: 3                // 最多分析几部作品
        };

        // 内置知名作家数据库（预设信息）
        this.knownAuthors = this.initKnownAuthors();

        this.initialized = false;
    }

    /**
     * 初始化
     */
    async init() {
        try {
            console.log('[AuthorStyleManager] 🚀 开始初始化...');

            // 加载配置
            await this.loadConfig();

            // 从本地存储恢复缓存的作家文风数据
            await this.restoreCachedStyles();

            this.initialized = true;
            console.log('[AuthorStyleManager] ✅ 初始化完成');

        } catch (error) {
            console.error('[AuthorStyleManager] ❌ 初始化失败:', error);
            throw error;
        }
    }

    /**
     * 初始化知名作家数据库（预设）
     */
    initKnownAuthors() {
        return {
            '天蚕土豆': {
                代表作品: ['斗破苍穹', '武动乾坤', '大主宰'],
                写作特点: [
                    '强调修炼等级体系，层次分明',
                    '情节推进节奏快，爽点密集',
                    '善用悬念和反转',
                    '人物成长线清晰，有逆袭感',
                    '战斗场面描写细腻'
                ],
                文风标签: ['热血', '爽文', '升级流', '玄幻'],
                语言风格: '通俗易懂，节奏明快，情节紧凑'
            },
            '辰东': {
                代表作品: ['遮天', '完美世界', '圣墟'],
                写作特点: [
                    '宏大的世界观构建',
                    '伏笔埋设深远，前后呼应',
                    '人物塑造立体，配角也有血肉',
                    '情节跌宕起伏，大气磅礴',
                    '善于营造史诗感'
                ],
                文风标签: ['玄幻', '史诗', '热血', '宏大叙事'],
                语言风格: '大气恢弘，文笔细腻，富有诗意'
            },
            '猫腻': {
                代表作品: ['庆余年', '将夜', '间客'],
                写作特点: [
                    '人物性格复杂，立体丰满',
                    '对话幽默风趣，富有哲理',
                    '细节描写细腻，情感真挚',
                    '世界观独特，设定新颖',
                    '擅长铺垫和伏笔'
                ],
                文风标签: ['玄幻', '人文', '幽默', '深度'],
                语言风格: '文笔优美，富有哲理性，对话生动'
            },
            '烽火戏诸侯': {
                代表作品: ['雪中悍刀行', '剑来', '陈二狗的妖孽人生'],
                写作特点: [
                    '人物刻画深刻，有血有肉',
                    '江湖气息浓厚',
                    '对话犀利，富有个性',
                    '情节张弛有度',
                    '善于营造氛围'
                ],
                文风标签: ['武侠', '江湖', '侠义', '深度'],
                语言风格: '豪迈洒脱，富有江湖气，文字老练'
            },
            '爱潜水的乌贼': {
                代表作品: ['诡秘之主', '武道宗师', '一世之尊'],
                写作特点: [
                    '设定严谨，逻辑缜密',
                    '伏笔众多，环环相扣',
                    '氛围营造出色',
                    '悬念设置精妙',
                    '世界观宏大且自洽'
                ],
                文风标签: ['玄幻', '克苏鲁', '悬疑', '严谨'],
                语言风格: '严谨细腻，氛围感强，逻辑清晰'
            },
            '耳根': {
                代表作品: ['仙逆', '我欲封天', '一念永恒'],
                写作特点: [
                    '主角性格鲜明，意志坚定',
                    '情感描写细腻',
                    '修炼体系完善',
                    '善于渲染悲壮氛围',
                    '伏笔设置巧妙'
                ],
                文风标签: ['仙侠', '悲壮', '意志', '情感'],
                语言风格: '情感饱满，富有感染力，意境深远'
            },
            '忘语': {
                代表作品: ['凡人修仙传', '玄界之门', '百炼成仙'],
                写作特点: [
                    '主角智商在线，步步为营',
                    '修炼过程细致入微',
                    '设定严谨，自成体系',
                    '小人物逆袭路线',
                    '谋略布局精彩'
                ],
                文风标签: ['仙侠', '智谋', '细腻', '修仙'],
                语言风格: '平实细腻，逻辑严密，层次分明'
            }
        };
    }

    /**
     * 加载配置
     */
    async loadConfig() {
        try {
            const extensionSettings = this.context?.extensionSettings;
            const configs = extensionSettings?.['Information bar integration tool'] || {};
            const authorStyleConfig = configs.authorStyle || {};

            this.config = {
                ...this.config,
                ...authorStyleConfig
            };

            console.log('[AuthorStyleManager] ✅ 配置加载完成:', this.config);

        } catch (error) {
            console.error('[AuthorStyleManager] ❌ 加载配置失败:', error);
        }
    }

    /**
     * 保存配置
     */
    async saveConfig() {
        try {
            const extensionSettings = this.context?.extensionSettings;
            if (!extensionSettings['Information bar integration tool']) {
                extensionSettings['Information bar integration tool'] = {};
            }

            extensionSettings['Information bar integration tool'].authorStyle = this.config;
            this.context?.saveSettingsDebounced();

            console.log('[AuthorStyleManager] ✅ 配置保存完成');

        } catch (error) {
            console.error('[AuthorStyleManager] ❌ 保存配置失败:', error);
        }
    }

    /**
     * 恢复缓存的作家文风数据
     */
    async restoreCachedStyles() {
        try {
            const cached = localStorage.getItem('infobar_author_styles_cache');
            if (!cached) {
                console.log('[AuthorStyleManager] ℹ️ 没有缓存的作家文风数据');
                return;
            }

            const data = JSON.parse(cached);
            const now = Date.now();

            let restoredCount = 0;
            let expiredCount = 0;

            for (const [author, styleData] of Object.entries(data)) {
                // 检查是否过期
                if (styleData.cachedAt && (now - styleData.cachedAt) < this.config.cacheExpiry) {
                    this.authorStyles.set(author, styleData);
                    restoredCount++;
                } else {
                    expiredCount++;
                }
            }

            console.log('[AuthorStyleManager] ✅ 恢复缓存完成:', {
                恢复数量: restoredCount,
                过期数量: expiredCount
            });

        } catch (error) {
            console.error('[AuthorStyleManager] ❌ 恢复缓存失败:', error);
        }
    }

    /**
     * 保存作家文风数据到缓存
     */
    async saveCachedStyles() {
        try {
            const data = {};
            for (const [author, styleData] of this.authorStyles.entries()) {
                data[author] = styleData;
            }

            localStorage.setItem('infobar_author_styles_cache', JSON.stringify(data));
            console.log('[AuthorStyleManager] 💾 缓存已保存');

        } catch (error) {
            console.error('[AuthorStyleManager] ❌ 保存缓存失败:', error);
        }
    }

    /**
     * 🔍 获取作家文风分析
     * @param {string} authorName - 作家名称
     * @param {boolean} forceRefresh - 是否强制刷新
     * @returns {Object} 文风分析结果
     */
    async getAuthorStyle(authorName, forceRefresh = false) {
        try {
            if (!authorName || typeof authorName !== 'string') {
                throw new Error('作家名称不能为空');
            }

            console.log('[AuthorStyleManager] 🔍 获取作家文风:', authorName);

            // 1. 检查缓存
            if (!forceRefresh && this.authorStyles.has(authorName)) {
                const cached = this.authorStyles.get(authorName);
                const now = Date.now();

                // 检查是否过期
                if (cached.cachedAt && (now - cached.cachedAt) < this.config.cacheExpiry) {
                    console.log('[AuthorStyleManager] ✅ 使用缓存数据');
                    return cached;
                } else {
                    console.log('[AuthorStyleManager] ⚠️ 缓存已过期，重新分析');
                }
            }

            // 2. 检查是否是内置知名作家
            if (this.knownAuthors[authorName]) {
                console.log('[AuthorStyleManager] 📚 使用内置作家数据');
                const knownData = this.knownAuthors[authorName];

                // 如果需要更详细的分析，调用AI分析
                if (this.config.analysisDepth === 'comprehensive') {
                    console.log('[AuthorStyleManager] 🤖 进行深度AI分析...');
                    const aiAnalysis = await this.analyzeAuthorWithAI(authorName, knownData);
                    const mergedData = this.mergeStyleData(knownData, aiAnalysis);
                    
                    // 缓存结果
                    mergedData.cachedAt = Date.now();
                    this.authorStyles.set(authorName, mergedData);
                    await this.saveCachedStyles();
                    
                    return mergedData;
                } else {
                    // 使用内置数据
                    const styleData = {
                        ...knownData,
                        cachedAt: Date.now(),
                        source: 'builtin'
                    };
                    
                    this.authorStyles.set(authorName, styleData);
                    await this.saveCachedStyles();
                    
                    return styleData;
                }
            }

            // 3. 未知作家，使用AI全面分析
            console.log('[AuthorStyleManager] 🤖 未知作家，使用AI全面分析...');
            const aiAnalysis = await this.analyzeAuthorWithAI(authorName);
            
            // 缓存结果
            aiAnalysis.cachedAt = Date.now();
            aiAnalysis.source = 'ai';
            this.authorStyles.set(authorName, aiAnalysis);
            await this.saveCachedStyles();
            
            return aiAnalysis;

        } catch (error) {
            console.error('[AuthorStyleManager] ❌ 获取作家文风失败:', error);
            throw error;
        }
    }

    /**
     * 🤖 使用AI分析作家文风
     */
    async analyzeAuthorWithAI(authorName, knownData = null) {
        try {
            console.log('[AuthorStyleManager] 🤖 开始AI分析作家文风:', authorName);

            // 构建分析提示词
            let prompt = `你是一位资深的文学评论家和写作导师。请深入分析作家"${authorName}"的写作风格和创作特点。

【分析要求】
1. 如果你了解这位作家，请列出其代表作品
2. 分析其核心写作特点（至少5条）
3. 总结其文风标签和类型
4. 描述其语言风格特征
5. 分析其叙事手法和结构特点
6. 提取其常用的修辞技巧
7. 分析其人物塑造方法
8. 总结其对话风格特点
9. 分析其场景描写特色
10. 提供模仿建议（如何学习这位作家的风格）

`;

            // 如果有内置数据，加入提示
            if (knownData) {
                prompt += `【已知信息参考】
代表作品: ${knownData.代表作品.join('、')}
已知特点: ${knownData.写作特点.join('；')}
文风标签: ${knownData.文风标签.join('、')}

请在此基础上进行更深入的分析和扩展。

`;
            }

            prompt += `【输出格式】
请严格按照以下JSON格式输出分析结果：

{
    "代表作品": ["作品1", "作品2", "作品3"],
    "写作特点": [
        "特点1：具体描述",
        "特点2：具体描述",
        "特点3：具体描述",
        "特点4：具体描述",
        "特点5：具体描述"
    ],
    "文风标签": ["标签1", "标签2", "标签3"],
    "语言风格": "语言风格的详细描述",
    "叙事手法": {
        "视角": "第一人称/第三人称/多视角等",
        "结构": "结构特点描述",
        "节奏": "节奏特点描述",
        "特色手法": ["手法1", "手法2"]
    },
    "修辞技巧": [
        "技巧1：具体说明",
        "技巧2：具体说明",
        "技巧3：具体说明"
    ],
    "人物塑造": {
        "主角特点": "主角塑造特点",
        "配角处理": "配角处理方式",
        "人物对话": "对话风格特点",
        "性格刻画": "性格刻画方法"
    },
    "场景描写": {
        "环境描写": "环境描写特色",
        "氛围营造": "氛围营造手法",
        "细节处理": "细节处理方式"
    },
    "模仿建议": [
        "建议1：具体指导",
        "建议2：具体指导",
        "建议3：具体指导",
        "建议4：具体指导",
        "建议5：具体指导"
    ],
    "注意事项": [
        "注意1：需要避免的问题",
        "注意2：需要注意的要点"
    ]
}

⚠️ 重要：必须返回有效的JSON格式，不要添加任何额外的说明文字。`;

            // 调用AI
            const result = await this.callAI(prompt);

            // 解析JSON
            const styleData = this.parseJSONResponse(result);

            console.log('[AuthorStyleManager] ✅ AI分析完成');

            return styleData;

        } catch (error) {
            console.error('[AuthorStyleManager] ❌ AI分析失败:', error);
            
            // 返回基础数据
            return {
                代表作品: knownData?.代表作品 || [],
                写作特点: knownData?.写作特点 || ['分析失败，请重试'],
                文风标签: knownData?.文风标签 || [],
                语言风格: knownData?.语言风格 || '分析失败',
                模仿建议: ['AI分析失败，请检查API配置后重试']
            };
        }
    }

    /**
     * 🤖 调用AI
     */
    async callAI(prompt) {
        try {
            console.log('[AuthorStyleManager] 📡 调用AI...');

            // 使用InfoBarSettings的sendCustomAPIRequest方法
            if (!this.infoBarSettings || typeof this.infoBarSettings.sendCustomAPIRequest !== 'function') {
                throw new Error('InfoBarSettings未初始化或sendCustomAPIRequest方法不可用');
            }

            const messages = [
                {
                    role: 'user',
                    content: prompt
                }
            ];

            const result = await this.infoBarSettings.sendCustomAPIRequest(messages, {
                skipSystemPrompt: true
            });

            if (result && result.success && result.text) {
                console.log('[AuthorStyleManager] ✅ AI调用成功');
                return result.text;
            } else {
                throw new Error('AI返回了空内容或失败');
            }

        } catch (error) {
            console.error('[AuthorStyleManager] ❌ AI调用失败:', error);
            throw error;
        }
    }

    /**
     * 📝 解析JSON响应
     */
    parseJSONResponse(text) {
        try {
            // 尝试提取JSON内容（可能被markdown包裹）
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return JSON.parse(text);
        } catch (error) {
            console.error('[AuthorStyleManager] ❌ JSON解析失败:', error);
            console.error('[AuthorStyleManager] 原始文本:', text);
            throw new Error('AI返回的数据格式错误，无法解析JSON');
        }
    }

    /**
     * 🔀 合并文风数据（内置数据 + AI分析）
     */
    mergeStyleData(knownData, aiData) {
        try {
            return {
                代表作品: aiData.代表作品 || knownData.代表作品,
                写作特点: this.mergeArrays(knownData.写作特点, aiData.写作特点),
                文风标签: this.mergeArrays(knownData.文风标签, aiData.文风标签),
                语言风格: aiData.语言风格 || knownData.语言风格,
                叙事手法: aiData.叙事手法 || {},
                修辞技巧: aiData.修辞技巧 || [],
                人物塑造: aiData.人物塑造 || {},
                场景描写: aiData.场景描写 || {},
                模仿建议: aiData.模仿建议 || [],
                注意事项: aiData.注意事项 || []
            };
        } catch (error) {
            console.error('[AuthorStyleManager] ❌ 合并数据失败:', error);
            return knownData;
        }
    }

    /**
     * 🔀 合并数组（去重）
     */
    mergeArrays(arr1, arr2) {
        const combined = [...(arr1 || []), ...(arr2 || [])];
        return [...new Set(combined)];
    }

    /**
     * 📋 生成剧情优化的文风指导
     * @param {string} authorName - 作家名称
     * @returns {string} 文风指导文本
     */
    async generateStyleGuidance(authorName) {
        try {
            console.log('[AuthorStyleManager] 📋 生成文风指导:', authorName);

            const styleData = await this.getAuthorStyle(authorName);

            // 构建指导文本
            let guidance = `\n═══════════════════════════════════════════════════════════════\n`;
            guidance += `【模仿作家：${authorName}】\n`;
            guidance += `═══════════════════════════════════════════════════════════════\n\n`;

            // 代表作品
            if (styleData.代表作品 && styleData.代表作品.length > 0) {
                guidance += `**📚 代表作品**\n`;
                guidance += `${styleData.代表作品.join('、')}\n\n`;
            }

            // 核心写作特点
            if (styleData.写作特点 && styleData.写作特点.length > 0) {
                guidance += `**✍️ 核心写作特点**\n`;
                styleData.写作特点.forEach((item, index) => {
                    guidance += `${index + 1}. ${item}\n`;
                });
                guidance += `\n`;
            }

            // 语言风格
            if (styleData.语言风格) {
                guidance += `**🎨 语言风格**\n`;
                guidance += `${styleData.语言风格}\n\n`;
            }

            // 叙事手法
            if (styleData.叙事手法 && Object.keys(styleData.叙事手法).length > 0) {
                guidance += `**📖 叙事手法**\n`;
                if (styleData.叙事手法.视角) {
                    guidance += `- 视角：${styleData.叙事手法.视角}\n`;
                }
                if (styleData.叙事手法.结构) {
                    guidance += `- 结构：${styleData.叙事手法.结构}\n`;
                }
                if (styleData.叙事手法.节奏) {
                    guidance += `- 节奏：${styleData.叙事手法.节奏}\n`;
                }
                if (styleData.叙事手法.特色手法 && styleData.叙事手法.特色手法.length > 0) {
                    guidance += `- 特色手法：${styleData.叙事手法.特色手法.join('、')}\n`;
                }
                guidance += `\n`;
            }

            // 修辞技巧
            if (styleData.修辞技巧 && styleData.修辞技巧.length > 0) {
                guidance += `**🎭 修辞技巧**\n`;
                styleData.修辞技巧.forEach((item, index) => {
                    guidance += `${index + 1}. ${item}\n`;
                });
                guidance += `\n`;
            }

            // 人物塑造
            if (styleData.人物塑造 && Object.keys(styleData.人物塑造).length > 0) {
                guidance += `**👥 人物塑造**\n`;
                if (styleData.人物塑造.主角特点) {
                    guidance += `- 主角特点：${styleData.人物塑造.主角特点}\n`;
                }
                if (styleData.人物塑造.配角处理) {
                    guidance += `- 配角处理：${styleData.人物塑造.配角处理}\n`;
                }
                if (styleData.人物塑造.人物对话) {
                    guidance += `- 人物对话：${styleData.人物塑造.人物对话}\n`;
                }
                if (styleData.人物塑造.性格刻画) {
                    guidance += `- 性格刻画：${styleData.人物塑造.性格刻画}\n`;
                }
                guidance += `\n`;
            }

            // 场景描写
            if (styleData.场景描写 && Object.keys(styleData.场景描写).length > 0) {
                guidance += `**🎬 场景描写**\n`;
                if (styleData.场景描写.环境描写) {
                    guidance += `- 环境描写：${styleData.场景描写.环境描写}\n`;
                }
                if (styleData.场景描写.氛围营造) {
                    guidance += `- 氛围营造：${styleData.场景描写.氛围营造}\n`;
                }
                if (styleData.场景描写.细节处理) {
                    guidance += `- 细节处理：${styleData.场景描写.细节处理}\n`;
                }
                guidance += `\n`;
            }

            // 模仿建议
            if (styleData.模仿建议 && styleData.模仿建议.length > 0) {
                guidance += `**💡 模仿建议**\n`;
                styleData.模仿建议.forEach((item, index) => {
                    guidance += `${index + 1}. ${item}\n`;
                });
                guidance += `\n`;
            }

            // 注意事项
            if (styleData.注意事项 && styleData.注意事项.length > 0) {
                guidance += `**⚠️ 注意事项**\n`;
                styleData.注意事项.forEach((item, index) => {
                    guidance += `${index + 1}. ${item}\n`;
                });
                guidance += `\n`;
            }

            guidance += `═══════════════════════════════════════════════════════════════\n`;

            console.log('[AuthorStyleManager] ✅ 文风指导生成完成');

            return guidance;

        } catch (error) {
            console.error('[AuthorStyleManager] ❌ 生成文风指导失败:', error);
            return `\n⚠️ 无法生成作家"${authorName}"的文风指导，原因：${error.message}\n`;
        }
    }

    /**
     * 📊 获取所有知名作家列表
     */
    getKnownAuthorsList() {
        return Object.keys(this.knownAuthors);
    }

    /**
     * 🔄 更新配置
     */
    async updateConfig(newConfig) {
        this.config = {
            ...this.config,
            ...newConfig
        };
        await this.saveConfig();
        console.log('[AuthorStyleManager] ✅ 配置已更新');
    }

    /**
     * 🗑️ 清除缓存
     */
    clearCache(authorName = null) {
        if (authorName) {
            // 清除特定作家的缓存
            this.authorStyles.delete(authorName);
            console.log('[AuthorStyleManager] 🗑️ 已清除缓存:', authorName);
        } else {
            // 清除所有缓存
            this.authorStyles.clear();
            localStorage.removeItem('infobar_author_styles_cache');
            console.log('[AuthorStyleManager] 🗑️ 已清除所有缓存');
        }
    }
}

