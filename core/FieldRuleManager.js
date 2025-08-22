/**
 * 字段规则管理器
 * 
 * 负责管理数据表格中字段的规则系统：
 * - 字段示例管理
 * - 字段规则定义
 * - 动态调节规则
 * - 规则模板系统
 * 
 * @class FieldRuleManager
 */

export class FieldRuleManager {
    constructor(unifiedDataCore, eventSystem) {
        console.log('[FieldRuleManager] 🔧 字段规则管理器初始化开始');
        
        this.unifiedDataCore = unifiedDataCore;
        this.eventSystem = eventSystem;
        
        // 规则存储
        this.fieldRules = new Map(); // panelName.fieldName -> rule
        this.ruleTemplates = new Map(); // templateName -> template
        
        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        
        console.log('[FieldRuleManager] 🏗️ 构造函数完成');
    }

    /**
     * 初始化字段规则管理器
     */
    async init() {
        try {
            console.log('[FieldRuleManager] 📊 开始初始化字段规则管理器...');
            
            // 加载已保存的字段规则
            await this.loadFieldRules();
            
            // 初始化内置规则模板
            this.initBuiltinTemplates();
            
            // 绑定事件监听器
            this.bindEventListeners();
            
            this.initialized = true;
            console.log('[FieldRuleManager] ✅ 字段规则管理器初始化完成');
            
        } catch (error) {
            console.error('[FieldRuleManager] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 加载已保存的字段规则
     */
    async loadFieldRules() {
        try {
            if (!this.unifiedDataCore) return;
            
            const savedRules = await this.unifiedDataCore.getData('field_rules');
            if (savedRules && typeof savedRules === 'object') {
                for (const [key, rule] of Object.entries(savedRules)) {
                    this.fieldRules.set(key, rule);
                }
                console.log('[FieldRuleManager] ✅ 已加载字段规则:', this.fieldRules.size, '条');
            }
            
        } catch (error) {
            console.error('[FieldRuleManager] ❌ 加载字段规则失败:', error);
        }
    }

    /**
     * 保存字段规则
     */
    async saveFieldRules() {
        try {
            if (!this.unifiedDataCore) return;
            
            const rulesObject = Object.fromEntries(this.fieldRules);
            await this.unifiedDataCore.setData('field_rules', rulesObject);
            
            console.log('[FieldRuleManager] 💾 字段规则已保存');
            
        } catch (error) {
            console.error('[FieldRuleManager] ❌ 保存字段规则失败:', error);
        }
    }

    /**
     * 初始化内置规则模板
     */
    initBuiltinTemplates() {
        console.log('[FieldRuleManager] 📋 初始化内置规则模板...');
        
        // 好感度模板
        this.ruleTemplates.set('affection', {
            name: '好感度',
            description: '人物对用户的好感度数值',
            examples: [
                { value: '30', description: '陌生人 - 初次见面，保持距离' },
                { value: '50', description: '普通朋友 - 基本信任' },
                { value: '70', description: '好友 - 相处融洽，愿意帮助' },
                { value: '85', description: '亲密朋友 - 深度信任，无话不谈' },
                { value: '95', description: '挚友/恋人 - 完全信任，生死与共' }
            ],
            rules: {
                description: '根据剧情发展和互动质量精确调整好感度',
                format: '数字(0-100)',
                constraints: [
                    '数值范围: 0-100',
                    '每次变化: ±1-10',
                    '重大事件可变化: ±10-30'
                ]
            },
            dynamicRules: [
                {
                    condition: '正面互动',
                    action: '增加1-5点',
                    examples: ['日常聊天 +1', '帮助解决问题 +3', '送礼物 +5', '救命之恩 +15']
                },
                {
                    condition: '负面互动',
                    action: '减少1-15点',
                    examples: ['轻微冲突 -2', '严重争吵 -8', '背叛信任 -20', '伤害身体 -30']
                }
            ]
        });

        // 时间格式模板
        this.ruleTemplates.set('time', {
            name: '时间',
            description: '当前时间的详细描述',
            examples: [
                { value: '07:30 清晨', description: '早晨时光，阳光初现' },
                { value: '12:00 正午', description: '午时阳光正烈' },
                { value: '18:30 黄昏', description: '夕阳西下，天色渐暗' },
                { value: '22:00 深夜', description: '夜深人静，月明星稀' }
            ],
            rules: {
                description: '使用具体时间+时段描述的格式',
                format: 'HH:MM + 时段描述',
                constraints: [
                    '时间格式: 24小时制',
                    '包含氛围描述',
                    '符合剧情发展节奏'
                ]
            },
            dynamicRules: [
                {
                    condition: '剧情推进',
                    action: '时间自然流逝',
                    examples: ['对话场景 +10-30分钟', '行动场景 +1-3小时', '休息场景 +6-8小时']
                }
            ]
        });

        // 情绪状态模板
        this.ruleTemplates.set('mood', {
            name: '情绪状态',
            description: '角色当前的情绪和心理状态',
            examples: [
                { value: '平静', description: '心情平和，没有特别的情绪波动' },
                { value: '开心', description: '心情愉悦，面带微笑' },
                { value: '兴奋', description: '情绪高涨，充满活力' },
                { value: '紧张', description: '内心不安，有些焦虑' },
                { value: '愤怒', description: '情绪激动，怒火中烧' }
            ],
            rules: {
                description: '根据当前情境和互动结果调整情绪',
                format: '情绪词汇 + 简短描述',
                constraints: [
                    '情绪要符合角色性格',
                    '情绪变化要有逻辑性',
                    '避免情绪过于极端'
                ]
            },
            dynamicRules: [
                {
                    condition: '正面事件',
                    action: '情绪向积极方向变化',
                    examples: ['收到好消息 → 开心', '完成目标 → 兴奋', '获得帮助 → 感激']
                },
                {
                    condition: '负面事件',
                    action: '情绪向消极方向变化',
                    examples: ['遇到挫折 → 沮丧', '被误解 → 委屈', '面临危险 → 恐惧']
                }
            ]
        });

        console.log('[FieldRuleManager] ✅ 内置规则模板初始化完成:', this.ruleTemplates.size, '个');
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        if (!this.eventSystem) return;

        console.log('[FieldRuleManager] 🔗 绑定事件监听器...');

        // 监听字段规则更新事件
        this.eventSystem.on('fieldRule:updated', (data) => {
            this.handleFieldRuleUpdated(data);
        });

        // 监听字段规则删除事件
        this.eventSystem.on('fieldRule:deleted', (data) => {
            this.handleFieldRuleDeleted(data);
        });

        console.log('[FieldRuleManager] ✅ 事件监听器绑定完成');
    }

    /**
     * 🔄 标准化面板和字段名为中文键名
     */
    normalizeNames(panelName, fieldName) {
        try {
            // 如果有 UnifiedDataCore，使用其标准化方法
            if (this.unifiedDataCore && this.unifiedDataCore.getChineseFieldName) {
                const normalizedFieldName = this.unifiedDataCore.getChineseFieldName(fieldName, panelName);
                return {
                    panelName: panelName, // 面板名通常已经是中文
                    fieldName: normalizedFieldName || fieldName
                };
            }

            // 否则直接返回原名
            return { panelName, fieldName };

        } catch (error) {
            console.error('[FieldRuleManager] ❌ 标准化名称失败:', error);
            return { panelName, fieldName };
        }
    }

    /**
     * 设置字段规则（现在使用中文键名）
     */
    async setFieldRule(panelName, fieldName, rule) {
        try {
            // 标准化名称为中文键名
            const { panelName: normalizedPanelName, fieldName: normalizedFieldName } = this.normalizeNames(panelName, fieldName);
            const ruleKey = `${normalizedPanelName}.${normalizedFieldName}`;

            // 验证规则格式
            const validatedRule = this.validateRule(rule);

            // 保存规则
            this.fieldRules.set(ruleKey, {
                ...validatedRule,
                panelName: normalizedPanelName,
                fieldName: normalizedFieldName,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });

            // 持久化保存
            await this.saveFieldRules();

            // 触发事件
            if (this.eventSystem) {
                this.eventSystem.emit('fieldRule:updated', {
                    panelName: normalizedPanelName,
                    fieldName: normalizedFieldName,
                    rule: validatedRule,
                    timestamp: Date.now()
                });
            }

            console.log('[FieldRuleManager] ✅ 字段规则已设置:', ruleKey);
            return true;

        } catch (error) {
            console.error('[FieldRuleManager] ❌ 设置字段规则失败:', error);
            return false;
        }
    }

    /**
     * 获取字段规则（现在使用中文键名）
     */
    getFieldRule(panelName, fieldName) {
        try {
            // 标准化名称为中文键名
            const { panelName: normalizedPanelName, fieldName: normalizedFieldName } = this.normalizeNames(panelName, fieldName);
            const ruleKey = `${normalizedPanelName}.${normalizedFieldName}`;
            return this.fieldRules.get(ruleKey) || null;
        } catch (error) {
            console.error('[FieldRuleManager] ❌ 获取字段规则失败:', error);
            return null;
        }
    }

    /**
     * 删除字段规则（现在使用中文键名）
     */
    async deleteFieldRule(panelName, fieldName) {
        try {
            // 标准化名称为中文键名
            const { panelName: normalizedPanelName, fieldName: normalizedFieldName } = this.normalizeNames(panelName, fieldName);
            const ruleKey = `${normalizedPanelName}.${normalizedFieldName}`;

            if (this.fieldRules.has(ruleKey)) {
                this.fieldRules.delete(ruleKey);

                // 持久化保存
                await this.saveFieldRules();

                // 触发事件
                if (this.eventSystem) {
                    this.eventSystem.emit('fieldRule:deleted', {
                        panelName: normalizedPanelName,
                        fieldName: normalizedFieldName,
                        timestamp: Date.now()
                    });
                }

                console.log('[FieldRuleManager] ✅ 字段规则已删除:', ruleKey);
                return true;
            }

            return false;

        } catch (error) {
            console.error('[FieldRuleManager] ❌ 删除字段规则失败:', error);
            return false;
        }
    }

    /**
     * 验证规则格式
     */
    validateRule(rule) {
        // 🔧 修复：支持新的简化格式
        if (rule.type === 'simple' && rule.content) {
            // 新的简化格式：只有content字段
            return {
                content: rule.content,
                type: rule.type,
                examples: [],
                rules: {},
                dynamicRules: []
            };
        }

        // 兼容旧格式，保留所有原始属性
        const validatedRule = {
            type: rule.type,
            format: rule.format,
            range: rule.range,
            changeRate: rule.changeRate,
            validation: rule.validation,
            unit: rule.unit,
            units: rule.units,
            preferredUnit: rule.preferredUnit,  // 🔧 新增：优先单位
            categories: rule.categories,
            intensity: rule.intensity,
            levels: rule.levels,
            examples: rule.examples || [],
            rules: rule.rules || {},
            dynamicRules: rule.dynamicRules || []
        };

        // 验证示例格式
        if (Array.isArray(validatedRule.examples)) {
            validatedRule.examples = validatedRule.examples.filter(example =>
                example && typeof example === 'object' && example.value !== undefined
            );
        }

        // 验证动态规则格式
        if (Array.isArray(validatedRule.dynamicRules)) {
            validatedRule.dynamicRules = validatedRule.dynamicRules.filter(rule =>
                rule && typeof rule === 'object' && rule.condition && rule.action
            );
        }
        
        return validatedRule;
    }

    /**
     * 获取规则模板
     */
    getRuleTemplate(templateName) {
        return this.ruleTemplates.get(templateName) || null;
    }

    /**
     * 获取所有规则模板
     */
    getAllRuleTemplates() {
        return Array.from(this.ruleTemplates.entries()).map(([key, template]) => ({
            key,
            ...template
        }));
    }

    /**
     * 处理字段规则更新事件
     */
    handleFieldRuleUpdated(data) {
        console.log('[FieldRuleManager] 📡 字段规则已更新:', data);
    }

    /**
     * 处理字段规则删除事件
     */
    handleFieldRuleDeleted(data) {
        console.log('[FieldRuleManager] 📡 字段规则已删除:', data);
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[FieldRuleManager] ❌ 错误:', error);
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            initialized: this.initialized,
            rulesCount: this.fieldRules.size,
            templatesCount: this.ruleTemplates.size,
            errorCount: this.errorCount
        };
    }
}
