/**
 * 角色扮演专用词汇表和权重调整系统
 * 
 * 针对角色扮演对话场景的关键词汇进行权重优化
 * 确保重要的角色、情感、关系词汇在向量化时获得更高权重
 * 
 * @version 1.0.0
 */

(() => {
    'use strict';

    /**
     * 角色扮演专用词汇表配置
     */
    const RoleplayVocabulary = {
        
        // ===== 高权重词汇 (权重 x3.0) =====
        highPriority: {
            // 人物角色相关
            characters: [
                '角色', '主角', '人物', '性格', '特征', '背景',
                'character', 'personality', 'trait', 'background',
                '朋友', '敌人', '盟友', '伙伴', '同伴',
                'friend', 'enemy', 'ally', 'companion', 'partner'
            ],
            
            // 情感状态
            emotions: [
                '开心', '愉快', '兴奋', '激动', '喜悦',
                '伤心', '难过', '痛苦', '绝望', '沮丧',
                '愤怒', '生气', '愤慨', '不满', '恼火',
                '紧张', '焦虑', '担心', '恐惧', '害怕',
                '平静', '安详', '宁静', '放松', '舒缓',
                'happy', 'excited', 'joyful', 'cheerful',
                'sad', 'depressed', 'upset', 'disappointed',
                'angry', 'furious', 'annoyed', 'irritated',
                'nervous', 'anxious', 'worried', 'scared',
                'calm', 'peaceful', 'relaxed', 'serene'
            ],
            
            // 关系动态
            relationships: [
                '关系', '友谊', '爱情', '亲情', '信任',
                '背叛', '冲突', '和解', '合作', '竞争',
                'relationship', 'friendship', 'love', 'trust',
                'betrayal', 'conflict', 'cooperation', 'competition',
                '师父', '弟子', '导师', '学生', '同事',
                'master', 'student', 'mentor', 'colleague'
            ],
            
            // 重要动作
            actions: [
                '决定', '选择', '行动', '改变', '成长',
                '战斗', '探索', '发现', '学习', '修炼',
                'decide', 'choose', 'action', 'change', 'grow',
                'fight', 'explore', 'discover', 'learn', 'practice'
            ]
        },

        // ===== 中等权重词汇 (权重 x2.0) =====
        mediumPriority: {
            // 场景描述
            scenes: [
                '地点', '环境', '氛围', '场景', '背景',
                '房间', '街道', '公园', '学校', '公司',
                'location', 'environment', 'atmosphere', 'scene',
                'room', 'street', 'park', 'school', 'office',
                '时间', '白天', '夜晚', '早晨', '傍晚',
                'time', 'morning', 'evening', 'night', 'day'
            ],
            
            // 物品道具
            items: [
                '物品', '道具', '装备', '工具', '武器',
                '衣服', '食物', '书籍', '手机', '电脑',
                'item', 'equipment', 'tool', 'weapon',
                'clothes', 'food', 'book', 'phone', 'computer',
                '金钱', '钥匙', '信件', '照片', '礼物',
                'money', 'key', 'letter', 'photo', 'gift'
            ],
            
            // 能力技能
            abilities: [
                '能力', '技能', '天赋', '才能', '专长',
                '力量', '速度', '智慧', '魅力', '运气',
                'ability', 'skill', 'talent', 'strength',
                'speed', 'wisdom', 'charm', 'luck',
                '魔法', '法术', '咒语', '治疗', '攻击',
                'magic', 'spell', 'healing', 'attack'
            ],
            
            // 目标任务
            objectives: [
                '目标', '任务', '使命', '责任', '义务',
                '计划', '策略', '方法', '步骤', '过程',
                'goal', 'mission', 'responsibility', 'duty',
                'plan', 'strategy', 'method', 'process',
                '成功', '失败', '胜利', '挫折', '困难',
                'success', 'failure', 'victory', 'difficulty'
            ]
        },

        // ===== 特殊权重词汇 (权重 x2.5) =====
        specialPriority: {
            // 记忆关键词
            memory: [
                '记忆', '回忆', '想起', '忘记', '印象',
                '经历', '体验', '感受', '想法', '思考',
                'memory', 'remember', 'forget', 'impression',
                'experience', 'feeling', 'thought', 'idea',
                '过去', '现在', '未来', '历史', '传说',
                'past', 'present', 'future', 'history', 'legend'
            ],
            
            // 对话交流
            communication: [
                '对话', '交流', '沟通', '谈话', '讨论',
                '问题', '回答', '解释', '建议', '意见',
                'dialogue', 'communication', 'conversation',
                'question', 'answer', 'explanation', 'advice',
                '同意', '反对', '理解', '困惑', '误解',
                'agree', 'disagree', 'understand', 'confused'
            ],
            
            // 故事情节
            plot: [
                '故事', '情节', '剧情', '发展', '转折',
                '开始', '结局', '高潮', '冲突', '解决',
                'story', 'plot', 'development', 'twist',
                'beginning', 'ending', 'climax', 'resolution',
                '秘密', '真相', '谜团', '线索', '发现',
                'secret', 'truth', 'mystery', 'clue', 'discovery'
            ]
        },

        // ===== 情景权重词汇 (动态权重) =====
        contextual: {
            // 面板特定词汇
            panels: {
                personal: ['姓名', '年龄', '性别', '外貌', '性格', 'name', 'age', 'appearance'],
                world: ['时间', '地点', '天气', '环境', 'time', 'location', 'weather'],
                interaction: ['对话', '交互', '互动', '会面', 'dialogue', 'interaction'],
                tasks: ['任务', '目标', '完成', '进度', 'task', 'goal', 'progress'],
                organization: ['组织', '团体', '公司', '学校', 'organization', 'company'],
                news: ['新闻', '事件', '消息', '通知', 'news', 'event', 'notice'],
                inventory: ['物品', '道具', '装备', '携带', 'item', 'equipment'],
                abilities: ['能力', '技能', '属性', '等级', 'ability', 'skill', 'level'],
                plot: ['剧情', '故事', '情节', '发展', 'plot', 'story', 'development'],
                cultivation: ['修炼', '境界', '功法', '提升', 'cultivation', 'realm'],
                fantasy: ['魔法', '奇幻', '法术', '神秘', 'magic', 'fantasy', 'mystical'],
                modern: ['现代', '科技', '都市', '生活', 'modern', 'technology', 'urban'],
                historical: ['历史', '古代', '传统', '文化', 'historical', 'ancient'],
                magic: ['魔法', '法师', '咒语', '魔力', 'magic', 'wizard', 'spell'],
                training: ['训练', '练习', '提升', '学习', 'training', 'practice']
            },
            
            // 情感强度词汇
            intensity: {
                high: ['非常', '极其', '特别', '相当', '十分', 'very', 'extremely', 'quite'],
                medium: ['比较', '有些', '稍微', '略微', 'somewhat', 'rather', 'slightly'],
                low: ['一点', '轻微', '淡淡', '微微', 'a little', 'slightly', 'faintly']
            }
        },

        // ===== 停用词 (权重 x0.1) =====
        stopWords: {
            chinese: [
                '的', '了', '是', '在', '有', '和', '就', '都', '而', '及',
                '与', '或', '但', '却', '然', '所', '以', '为', '被', '把',
                '个', '些', '这', '那', '每', '各', '其', '此', '何', '多',
                '很', '更', '最', '太', '也', '还', '又', '再', '已', '将'
            ],
            english: [
                'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
                'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'over',
                'after', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
                'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your'
            ]
        }
    };

    /**
     * 权重计算器
     */
    class VocabularyWeightCalculator {
        constructor() {
            this.weightCache = new Map();
            this.contextBoost = 1.0;
            this.panelContext = null;
            
            // 预计算权重映射
            this.buildWeightMappings();
        }

        /**
         * 构建权重映射表
         */
        buildWeightMappings() {
            this.weightMap = new Map();
            
            // 高权重词汇
            Object.values(RoleplayVocabulary.highPriority).forEach(category => {
                category.forEach(word => {
                    this.weightMap.set(word.toLowerCase(), 3.0);
                });
            });
            
            // 中等权重词汇
            Object.values(RoleplayVocabulary.mediumPriority).forEach(category => {
                category.forEach(word => {
                    this.weightMap.set(word.toLowerCase(), 2.0);
                });
            });
            
            // 特殊权重词汇
            Object.values(RoleplayVocabulary.specialPriority).forEach(category => {
                category.forEach(word => {
                    this.weightMap.set(word.toLowerCase(), 2.5);
                });
            });
            
            // 停用词
            Object.values(RoleplayVocabulary.stopWords).forEach(category => {
                category.forEach(word => {
                    this.weightMap.set(word.toLowerCase(), 0.1);
                });
            });
            
            console.log('[VocabularyWeightCalculator] ✅ 权重映射表构建完成，词汇数量:', this.weightMap.size);
        }

        /**
         * 设置面板上下文
         */
        setPanelContext(panelType) {
            this.panelContext = panelType;
            this.contextBoost = 1.2; // 上下文相关词汇获得20%权重提升
        }

        /**
         * 获取词汇权重
         */
        getWordWeight(word) {
            const normalizedWord = word.toLowerCase();
            
            // 检查缓存
            const cacheKey = `${normalizedWord}_${this.panelContext || 'default'}`;
            if (this.weightCache.has(cacheKey)) {
                return this.weightCache.get(cacheKey);
            }
            
            let weight = 1.0; // 默认权重
            
            // 获取基础权重
            if (this.weightMap.has(normalizedWord)) {
                weight = this.weightMap.get(normalizedWord);
            }
            
            // 应用上下文权重提升
            if (this.panelContext && this.isContextualWord(normalizedWord, this.panelContext)) {
                weight *= this.contextBoost;
            }
            
            // 应用强度修饰符
            const intensityMultiplier = this.getIntensityMultiplier(normalizedWord);
            weight *= intensityMultiplier;
            
            // 缓存结果
            this.weightCache.set(cacheKey, weight);
            
            return weight;
        }

        /**
         * 检查是否为上下文相关词汇
         */
        isContextualWord(word, panelType) {
            const panelWords = RoleplayVocabulary.contextual.panels[panelType];
            return panelWords && panelWords.some(pw => pw.toLowerCase() === word);
        }

        /**
         * 获取强度修饰符
         */
        getIntensityMultiplier(word) {
            const intensity = RoleplayVocabulary.contextual.intensity;
            
            if (intensity.high.some(w => w.toLowerCase() === word)) {
                return 1.5;
            } else if (intensity.medium.some(w => w.toLowerCase() === word)) {
                return 1.2;
            } else if (intensity.low.some(w => w.toLowerCase() === word)) {
                return 1.1;
            }
            
            return 1.0;
        }

        /**
         * 批量计算词汇权重
         */
        calculateWeights(words, panelType = null) {
            if (panelType) {
                this.setPanelContext(panelType);
            }
            
            const weights = {};
            for (const word of words) {
                weights[word] = this.getWordWeight(word);
            }
            
            return weights;
        }

        /**
         * 获取统计信息
         */
        getStatistics() {
            const stats = {
                totalMappedWords: this.weightMap.size,
                cacheSize: this.weightCache.size,
                contextBoost: this.contextBoost,
                currentPanel: this.panelContext,
                weightDistribution: {
                    highPriority: 0,
                    mediumPriority: 0,
                    specialPriority: 0,
                    stopWords: 0,
                    normal: 0
                }
            };
            
            // 统计权重分布
            for (const weight of this.weightMap.values()) {
                if (weight >= 3.0) stats.weightDistribution.highPriority++;
                else if (weight >= 2.5) stats.weightDistribution.specialPriority++;
                else if (weight >= 2.0) stats.weightDistribution.mediumPriority++;
                else if (weight <= 0.1) stats.weightDistribution.stopWords++;
                else stats.weightDistribution.normal++;
            }
            
            return stats;
        }
    }

    // 导出模块
    if (typeof window !== 'undefined') {
        window.RoleplayVocabulary = RoleplayVocabulary;
        window.VocabularyWeightCalculator = VocabularyWeightCalculator;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { RoleplayVocabulary, VocabularyWeightCalculator };
    }

    console.log('[RoleplayVocabulary] ✅ 角色扮演专用词汇表系统加载完成');

})();
