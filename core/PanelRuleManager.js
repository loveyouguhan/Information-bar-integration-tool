/**
 * 面板规则管理器
 * 
 * 负责管理面板级别的规则系统：
 * - 面板记录规则定义
 * - 面板过滤条件管理
 * - 智能记录约束
 * - 规则模板系统
 * 
 * @class PanelRuleManager
 */

export class PanelRuleManager {
    constructor(unifiedDataCore, eventSystem) {
        console.log('[PanelRuleManager] 🔧 面板规则管理器初始化开始');
        
        this.unifiedDataCore = unifiedDataCore;
        this.eventSystem = eventSystem;
        
        // 规则存储
        this.panelRules = new Map(); // panelId -> rule
        this.ruleTemplates = new Map(); // templateName -> template
        
        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        
        console.log('[PanelRuleManager] 🏗️ 构造函数完成');
    }

    /**
     * 初始化面板规则管理器
     */
    async init() {
        try {
            console.log('[PanelRuleManager] 📊 开始初始化面板规则管理器...');
            
            // 加载已保存的面板规则
            await this.loadPanelRules();
            
            // 初始化内置规则模板
            this.initBuiltinTemplates();
            
            // 绑定事件监听器
            this.bindEventListeners();
            
            this.initialized = true;
            console.log('[PanelRuleManager] ✅ 面板规则管理器初始化完成');
            
        } catch (error) {
            console.error('[PanelRuleManager] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 加载已保存的面板规则
     */
    async loadPanelRules() {
        try {
            if (!this.unifiedDataCore) return;
            
            const savedRules = await this.unifiedDataCore.getData('panel_rules');
            if (savedRules && typeof savedRules === 'object') {
                for (const [key, rule] of Object.entries(savedRules)) {
                    this.panelRules.set(key, rule);
                }
                console.log('[PanelRuleManager] ✅ 已加载面板规则:', this.panelRules.size, '条');
            }
            
        } catch (error) {
            console.error('[PanelRuleManager] ❌ 加载面板规则失败:', error);
        }
    }

    /**
     * 保存面板规则
     */
    async savePanelRules() {
        try {
            if (!this.unifiedDataCore) return;
            
            const rulesObject = Object.fromEntries(this.panelRules);
            await this.unifiedDataCore.setData('panel_rules', rulesObject);
            
            console.log('[PanelRuleManager] 💾 面板规则已保存');
            
        } catch (error) {
            console.error('[PanelRuleManager] ❌ 保存面板规则失败:', error);
        }
    }

    /**
     * 初始化内置规则模板
     */
    initBuiltinTemplates() {
        console.log('[PanelRuleManager] 📋 初始化内置规则模板...');
        
        // 交互对象性别过滤模板
        this.ruleTemplates.set('interaction_gender', {
            name: '交互对象性别过滤',
            description: '根据性别筛选记录的交互对象',
            panelType: 'interaction',
            rules: {
                description: '只记录指定性别的交互对象，帮助AI更好地理解角色关系',
                filterType: 'gender',
                options: [
                    { value: 'all', label: '记录所有性别', description: '不进行性别过滤' },
                    { value: 'female', label: '只记录女性', description: '只记录女性交互对象' },
                    { value: 'male', label: '只记录男性', description: '只记录男性交互对象' }
                ]
            },
            examples: [
                { condition: '女性角色出现', action: '记录到面板', note: '当设置为"只记录女性"时' },
                { condition: '男性角色出现', action: '忽略记录', note: '当设置为"只记录女性"时' }
            ]
        });

        // 个人信息重要性过滤模板
        this.ruleTemplates.set('personal_importance', {
            name: '个人信息重要性过滤',
            description: '根据信息重要性筛选记录内容',
            panelType: 'personal',
            rules: {
                description: '只记录重要的个人信息变化，避免记录琐碎细节',
                filterType: 'importance',
                options: [
                    { value: 'all', label: '记录所有信息', description: '记录所有个人信息变化' },
                    { value: 'important', label: '只记录重要信息', description: '只记录关键的个人信息变化' },
                    { value: 'critical', label: '只记录关键信息', description: '只记录最关键的个人信息变化' }
                ]
            },
            examples: [
                { condition: '姓名、年龄变化', action: '记录到面板', note: '关键信息变化' },
                { condition: '心情、临时状态', action: '根据设置决定', note: '可能被过滤的信息' }
            ]
        });

        // 任务系统状态过滤模板
        this.ruleTemplates.set('tasks_status', {
            name: '任务系统状态过滤',
            description: '根据任务状态筛选记录内容',
            panelType: 'tasks',
            rules: {
                description: '只记录特定状态的任务，保持任务面板的整洁',
                filterType: 'status',
                options: [
                    { value: 'all', label: '记录所有任务', description: '记录所有任务状态变化' },
                    { value: 'active', label: '只记录活跃任务', description: '只记录进行中和待完成的任务' },
                    { value: 'incomplete', label: '只记录未完成任务', description: '只记录尚未完成的任务' }
                ]
            },
            examples: [
                { condition: '新任务创建', action: '记录到面板', note: '所有设置都会记录' },
                { condition: '任务完成', action: '根据设置决定', note: '可能被过滤掉' }
            ]
        });

        console.log('[PanelRuleManager] ✅ 内置规则模板初始化完成:', this.ruleTemplates.size, '个');
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        if (!this.eventSystem) return;

        console.log('[PanelRuleManager] 🔗 绑定事件监听器...');

        // 监听面板规则更新事件
        this.eventSystem.on('panelRule:updated', (data) => {
            this.handlePanelRuleUpdated(data);
        });

        // 监听面板规则删除事件
        this.eventSystem.on('panelRule:deleted', (data) => {
            this.handlePanelRuleDeleted(data);
        });

        console.log('[PanelRuleManager] ✅ 事件监听器绑定完成');
    }

    /**
     * 设置面板规则
     */
    async setPanelRule(panelId, rule) {
        try {
            // 验证规则格式
            const validatedRule = this.validateRule(rule);
            
            // 保存规则
            this.panelRules.set(panelId, {
                ...validatedRule,
                panelId,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            
            // 持久化保存
            await this.savePanelRules();
            
            // 触发事件
            if (this.eventSystem) {
                this.eventSystem.emit('panelRule:updated', {
                    panelId,
                    rule: validatedRule,
                    timestamp: Date.now()
                });
            }
            
            console.log('[PanelRuleManager] ✅ 面板规则已设置:', panelId);
            return true;
            
        } catch (error) {
            console.error('[PanelRuleManager] ❌ 设置面板规则失败:', error);
            return false;
        }
    }

    /**
     * 获取面板规则
     */
    getPanelRule(panelId) {
        return this.panelRules.get(panelId) || null;
    }

    /**
     * 删除面板规则
     */
    async deletePanelRule(panelId) {
        try {
            if (this.panelRules.has(panelId)) {
                this.panelRules.delete(panelId);
                
                // 持久化保存
                await this.savePanelRules();
                
                // 触发事件
                if (this.eventSystem) {
                    this.eventSystem.emit('panelRule:deleted', {
                        panelId,
                        timestamp: Date.now()
                    });
                }
                
                console.log('[PanelRuleManager] ✅ 面板规则已删除:', panelId);
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('[PanelRuleManager] ❌ 删除面板规则失败:', error);
            return false;
        }
    }

    /**
     * 验证规则格式
     */
    validateRule(rule) {
        const validatedRule = {
            enabled: rule.enabled !== false, // 默认启用
            filterType: rule.filterType || 'none',
            filterValue: rule.filterValue || 'all',
            description: rule.description || '',
            conditions: rule.conditions || [],
            actions: rule.actions || []
        };
        
        // 验证条件格式
        if (Array.isArray(validatedRule.conditions)) {
            validatedRule.conditions = validatedRule.conditions.filter(condition => 
                condition && typeof condition === 'object' && condition.type && condition.value
            );
        }
        
        // 验证动作格式
        if (Array.isArray(validatedRule.actions)) {
            validatedRule.actions = validatedRule.actions.filter(action => 
                action && typeof action === 'object' && action.type && action.value
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
     * 根据面板类型获取适用的规则模板
     */
    getTemplatesForPanelType(panelType) {
        return this.getAllRuleTemplates().filter(template => 
            !template.panelType || template.panelType === panelType
        );
    }

    /**
     * 处理面板规则更新事件
     */
    handlePanelRuleUpdated(data) {
        console.log('[PanelRuleManager] 📡 面板规则已更新:', data);
    }

    /**
     * 处理面板规则删除事件
     */
    handlePanelRuleDeleted(data) {
        console.log('[PanelRuleManager] 📡 面板规则已删除:', data);
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[PanelRuleManager] ❌ 错误:', error);
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            initialized: this.initialized,
            rulesCount: this.panelRules.size,
            templatesCount: this.ruleTemplates.size,
            errorCount: this.errorCount
        };
    }
}
