/**
 * AITemplateAssistant.js - AI模板助手
 * 
 * 功能特性:
 * - AI一键修改HTML模板
 * - 根据当前启用面板智能调整模板
 * - 数据源分析和模板优化建议
 * - 模板生成和自动完成
 * 
 * @version 1.0.0
 * @author Information Bar Integration Tool Developer
 */

export class AITemplateAssistant {
    constructor(dependencies = {}) {
        // 🔧 依赖注入
        this.unifiedDataCore = dependencies.unifiedDataCore || window.InfoBarData;
        this.eventSystem = dependencies.eventSystem || window.SillyTavernInfobar?.eventSource;
        this.configManager = dependencies.configManager || window.SillyTavernInfobar?.modules?.configManager;
        this.apiIntegration = dependencies.apiIntegration || window.SillyTavernInfobar?.modules?.apiIntegration;
        this.htmlTemplateParser = dependencies.htmlTemplateParser;

        // 🚀 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        this.requestCount = 0;

        // 🎯 AI提示词模板
        this.promptTemplates = {
            modifyTemplate: `你是一个专业的HTML模板优化助手。请根据以下信息修改用户提供的HTML模板：

当前启用的数据面板：
{enabledPanels}

可用的数据字段：
{availableFields}

数据获取途径：
{dataSource}

用户的HTML模板：
{userTemplate}

请按照以下要求修改模板：
1. 使用 {{data.fieldName}} 语法绑定数据字段
2. 确保所有数据字段都有对应的显示位置
3. 保持原有的样式和布局结构
4. 添加必要的条件渲染 {{#if condition}}...{{/if}}
5. 为数组数据添加循环渲染 {{#each array}}...{{/each}}
6. 确保HTML结构语义化和可访问性
7. 使用现代CSS样式，支持深色主题
8. 添加适当的图标和视觉元素
9. 确保响应式设计
10. 优化用户体验和可读性

请直接返回修改后的HTML代码，不需要额外说明。`,

            generateTemplate: `请为以下数据结构生成一个美观的HTML模板：

数据面板：
{enabledPanels}

数据字段：
{availableFields}

样式要求：
- 使用现代CSS样式
- 响应式设计
- 深色主题适配
- 清晰的信息层次

请生成完整的HTML模板代码。`,

            optimizeTemplate: `请优化以下HTML模板的性能和可读性：

原始模板：
{userTemplate}

优化要求：
1. 减少DOM层级
2. 优化CSS选择器
3. 提高渲染性能
4. 改善代码可读性

请返回优化后的HTML代码。`,

            analyzeTemplate: `请分析以下HTML模板并提供改进建议：

模板代码：
{userTemplate}

请从以下方面进行分析：
1. 代码结构和语义化
2. 样式和布局优化
3. 数据绑定的合理性
4. 性能优化建议
5. 可访问性改进
6. 响应式设计建议

请提供详细的分析报告和具体的改进建议。`,

            createFromData: `请根据以下数据结构创建一个美观的HTML模板：

数据结构：
{dataStructure}

设计要求：
1. 现代化的UI设计
2. 深色主题适配
3. 响应式布局
4. 清晰的信息层次
5. 适当的图标和视觉元素
6. 良好的用户体验

请生成完整的HTML模板代码。`,

            fixTemplate: `请修复以下HTML模板中的问题：

模板代码：
{userTemplate}

已知问题：
{issues}

请修复这些问题并返回修正后的HTML代码。`
        };

        console.log('[AITemplateAssistant] 🚀 AI模板助手初始化完成');
    }

    /**
     * 初始化AI助手
     */
    async init() {
        try {
            console.log('[AITemplateAssistant] 📊 开始初始化AI模板助手...');

            // 检查API集成是否可用
            if (!this.apiIntegration || !this.apiIntegration.initialized) {
                console.warn('[AITemplateAssistant] ⚠️ API集成未初始化，AI功能将受限');
            }

            // 绑定事件监听器
            this.bindEventListeners();

            this.initialized = true;
            console.log('[AITemplateAssistant] ✅ AI模板助手初始化完成');

            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('ai-template-assistant:initialized', {
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('[AITemplateAssistant] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * AI一键修改模板
     * @param {string} userTemplate - 用户提供的HTML模板
     * @param {Object} options - 修改选项
     * @returns {Promise<string>} 修改后的HTML模板
     */
    async modifyTemplate(userTemplate, options = {}) {
        try {
            console.log('[AITemplateAssistant] 🤖 开始AI一键修改模板...');
            this.requestCount++;

            // 获取当前启用的面板信息（改为从SmartPromptSystem与UnifiedDataCore联合获取）
            const enabledPanels = await this.getEnabledPanelsInfo();

            // 获取可用的数据字段（改为直接读取当前chat的 infobar_data.panels）
            const availableFields = await this.getAvailableFields();

            // 获取数据源信息
            const dataSource = await this.getDataSourceInfo();

            // 构建AI提示词
            const prompt = this.buildModifyPrompt(userTemplate, {
                enabledPanels,
                availableFields,
                dataSource,
                ...options
            });

            // 调用AI API
            const modifiedTemplate = await this.callAI(prompt);

            // 验证修改后的模板
            const validatedTemplate = this.validateModifiedTemplate(modifiedTemplate);

            console.log('[AITemplateAssistant] ✅ AI模板修改完成');
            
            // 触发修改完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('ai-template-assistant:template-modified', {
                    original: userTemplate,
                    modified: validatedTemplate,
                    timestamp: Date.now()
                });
            }

            return validatedTemplate;

        } catch (error) {
            console.error('[AITemplateAssistant] ❌ AI修改模板失败:', error);
            this.handleError(error);
            throw error;
        }
    }

    /**
     * 生成新模板
     * @param {Object} requirements - 模板需求
     * @returns {Promise<string>} 生成的HTML模板
     */
    async generateTemplate(requirements = {}) {
        try {
            console.log('[AITemplateAssistant] 🎨 开始AI生成模板...');

            const enabledPanels = await this.getEnabledPanelsInfo();
            const availableFields = await this.getAvailableFields();

            const prompt = this.promptTemplates.generateTemplate
                .replace('{enabledPanels}', JSON.stringify(enabledPanels, null, 2))
                .replace('{availableFields}', JSON.stringify(availableFields, null, 2));

            const generatedTemplate = await this.callAI(prompt);
            const validatedTemplate = this.validateModifiedTemplate(generatedTemplate);

            console.log('[AITemplateAssistant] ✅ AI模板生成完成');
            return validatedTemplate;

        } catch (error) {
            console.error('[AITemplateAssistant] ❌ AI生成模板失败:', error);
            this.handleError(error);
            throw error;
        }
    }

    /**
     * 获取当前启用的面板信息
     * @returns {Promise<Object>} 面板信息
     */
    async getEnabledPanelsInfo() {
        try {
            const result = {};

            // 1) 优先从SmartPromptSystem的实时启用面板获取
            const sps = window.SillyTavernInfobar?.modules?.smartPromptSystem;
            if (sps && typeof sps.getEnabledPanels === 'function') {
                const panels = await sps.getEnabledPanels();
                panels.forEach(p => {
                    result[p.id] = {
                        name: p.name || p.id,
                        description: p.description || '',
                        fields: (p.subItems || []).map(si => si.key),
                        icon: p.icon || 'fa-solid fa-info'
                    };
                });
            }

            // 2) 回退：从扩展设置内的 customPanels 与基础面板读取
            if (Object.keys(result).length === 0 && this.configManager?.getConfig) {
                const extConfigs = window.SillyTavern?.getContext?.()?.extensionSettings?.['Information bar integration tool'] || {};
                const basicIds = ['personal','world','interaction','tasks','organization','news','inventory','abilities','plot','cultivation','fantasy','modern','historical','magic','training'];
                basicIds.forEach(id => {
                    const cfg = extConfigs[id];
                    if (cfg && cfg.enabled !== false) {
                        const fields = [];
                        Object.keys(cfg).forEach(k => {
                            const v = cfg[k];
                            if (v && typeof v === 'object' && v.enabled !== undefined) {
                                if (v.enabled === true) fields.push(k);
                            }
                        });
                        if (Array.isArray(cfg.subItems)) {
                            cfg.subItems.forEach(si => fields.push(si.key || si.name));
                        }
                        result[id] = { name: this._panelName(id), description: cfg.description || '', fields, icon: cfg.icon || 'fa-solid fa-info' };
                    }
                });
                if (extConfigs.customPanels) {
                    Object.entries(extConfigs.customPanels).forEach(([id, cfg]) => {
                        if (cfg && cfg.enabled !== false) {
                            const fields = Array.isArray(cfg.subItems) ? cfg.subItems.map(si => si.key || si.name) : [];
                            result[id] = { name: cfg.name || id, description: cfg.description || '', fields, icon: cfg.icon || 'fa-solid fa-palette' };
                        }
                    });
                }
            }

            return result;

        } catch (error) {
            console.error('[AITemplateAssistant] ❌ 获取面板信息失败:', error);
            return {};
        }
    }

    /**
     * 获取可用的数据字段
     * @returns {Promise<Object>} 数据字段信息
     */
    async getAvailableFields() {
        try {
            const dataCore = window.SillyTavernInfobar?.modules?.unifiedDataCore;
            const fields = {};
            if (!dataCore) return fields;

            const chatId = dataCore.getCurrentChatId?.();
            const chatData = chatId ? await dataCore.getChatData(chatId) : null;
            const panels = (chatData && chatData.infobar_data && chatData.infobar_data.panels) ? chatData.infobar_data.panels : {};

            Object.entries(panels).forEach(([panelId, panelData]) => {
                fields[panelId] = Object.keys(panelData || {});
            });

            return fields;

        } catch (error) {
            console.error('[AITemplateAssistant] ❌ 获取数据字段失败:', error);
            return {};
        }
    }

    /**
     * 获取数据源信息
     * @returns {Promise<Object>} 数据源信息
     */
    async getDataSourceInfo() {
        const dataCore = window.SillyTavernInfobar?.modules?.unifiedDataCore;
        const chatId = dataCore?.getCurrentChatId?.();
        return {
            source: '数据核心(当前聊天)',
            chatId: chatId || 'unknown',
            format: 'dataCore.chatMetadata.chat_<chatId>.infobar_data.panels',
            updateFrequency: 'AI消息/编辑变更/回滚同步',
            dataFlow: 'AI解析 -> UnifiedDataCore.merge -> infobar_data.panels -> HTML渲染'
        };
    }

    /**
     * 构建修改提示词
     * @param {string} userTemplate - 用户模板
     * @param {Object} context - 上下文信息
     * @returns {string} 提示词
     */
    buildModifyPrompt(userTemplate, context) {
        return this.promptTemplates.modifyTemplate
            .replace('{enabledPanels}', JSON.stringify(context.enabledPanels, null, 2))
            .replace('{availableFields}', JSON.stringify(context.availableFields, null, 2))
            .replace('{dataSource}', JSON.stringify(context.dataSource, null, 2))
            .replace('{userTemplate}', userTemplate);
    }

    /**
     * 调用AI API
     * @param {string} prompt - 提示词
     * @returns {Promise<string>} AI响应
     */
    async callAI(prompt) {
        try {
            if (!this.apiIntegration || !this.apiIntegration.initialized) {
                throw new Error('AI API未配置或未初始化');
            }

            console.log('[AITemplateAssistant] 🔄 调用AI API...');
            
            const response = await this.apiIntegration.generateText(prompt, {
                maxTokens: 4000,
                temperature: 0.3,
                systemPrompt: '你是一个专业的HTML模板开发助手，专注于生成高质量、语义化的HTML代码。'
            });

            if (!response || !response.text) {
                throw new Error('AI API返回空响应');
            }

            return response.text.trim();

        } catch (error) {
            console.error('[AITemplateAssistant] ❌ AI API调用失败:', error);
            throw new Error(`AI服务暂时不可用: ${error.message}`);
        }
    }

    /**
     * 验证修改后的模板
     * @param {string} template - 模板代码
     * @returns {string} 验证后的模板
     */
    validateModifiedTemplate(template) {
        try {
            // 基本HTML结构验证
            if (!template || typeof template !== 'string') {
                throw new Error('模板内容无效');
            }

            // 移除可能的代码块标记
            let cleanTemplate = template.replace(/```html\n?/g, '').replace(/```\n?/g, '');
            
            // 验证HTML结构
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cleanTemplate;
            
            // 检查是否有内容
            if (tempDiv.innerHTML.trim().length === 0) {
                throw new Error('模板内容为空');
            }

            // 🔧 放宽安全检查：只记录，不阻断
            if (this.htmlTemplateParser) {
                try {
                    const ok = this.htmlTemplateParser.validateTemplateSecurity(cleanTemplate);
                    if (!ok) console.warn('[AITemplateAssistant] ⚠️ 模板存在潜在不安全内容，按要求继续');
                } catch (e) {
                    console.warn('[AITemplateAssistant] ⚠️ 安全校验异常，已忽略:', e?.message);
                }
            }

            return cleanTemplate;

        } catch (error) {
            console.error('[AITemplateAssistant] ❌ 模板验证失败:', error);
            // 返回一个基本的错误模板
            return `<div class="template-validation-error" style="color: red; padding: 10px; border: 1px solid red;">
                <h4>模板验证失败</h4>
                <p>${error.message}</p>
                <details>
                    <summary>原始内容</summary>
                    <pre>${this.escapeHtml(template)}</pre>
                </details>
            </div>`;
        }
    }

    // 内部：基础面板中文名
    _panelName(id) {
        const map = { personal:'个人信息', world:'世界状态', interaction:'交互对象', tasks:'任务状态', organization:'组织关系', news:'新闻事件', inventory:'物品清单', abilities:'能力属性', plot:'剧情进展', cultivation:'修炼境界', fantasy:'奇幻设定', modern:'现代背景', historical:'历史背景', magic:'魔法系统', training:'训练记录' };
        return map[id] || id;
    }

    /**
     * HTML转义
     * @param {string} text - 文本
     * @returns {string} 转义后的文本
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        if (this.eventSystem) {
            // 监听配置变更
            this.eventSystem.on('config:updated', () => {
                console.log('[AITemplateAssistant] 📊 配置已更新');
            });
        }
    }

    /**
     * 分析模板
     * @param {string} template - HTML模板
     * @returns {Promise<string>} 分析报告
     */
    async analyzeTemplate(template) {
        try {
            console.log('[AITemplateAssistant] 🔍 开始分析模板...');

            const prompt = this.promptTemplates.analyzeTemplate
                .replace('{userTemplate}', template);

            const analysis = await this.callAI(prompt);

            console.log('[AITemplateAssistant] ✅ 模板分析完成');
            return analysis;

        } catch (error) {
            console.error('[AITemplateAssistant] ❌ 分析模板失败:', error);
            throw error;
        }
    }

    /**
     * 根据数据结构创建模板
     * @param {Object} dataStructure - 数据结构
     * @returns {Promise<string>} 生成的模板
     */
    async createTemplateFromData(dataStructure) {
        try {
            console.log('[AITemplateAssistant] 🎨 根据数据结构创建模板...');

            const prompt = this.promptTemplates.createFromData
                .replace('{dataStructure}', JSON.stringify(dataStructure, null, 2));

            const template = await this.callAI(prompt);
            const validatedTemplate = this.validateModifiedTemplate(template);

            console.log('[AITemplateAssistant] ✅ 模板创建完成');
            return validatedTemplate;

        } catch (error) {
            console.error('[AITemplateAssistant] ❌ 创建模板失败:', error);
            throw error;
        }
    }

    /**
     * 修复模板问题
     * @param {string} template - 有问题的模板
     * @param {Array} issues - 问题列表
     * @returns {Promise<string>} 修复后的模板
     */
    async fixTemplate(template, issues) {
        try {
            console.log('[AITemplateAssistant] 🔧 修复模板问题...');

            const prompt = this.promptTemplates.fixTemplate
                .replace('{userTemplate}', template)
                .replace('{issues}', issues.join('\n'));

            const fixedTemplate = await this.callAI(prompt);
            const validatedTemplate = this.validateModifiedTemplate(fixedTemplate);

            console.log('[AITemplateAssistant] ✅ 模板修复完成');
            return validatedTemplate;

        } catch (error) {
            console.error('[AITemplateAssistant] ❌ 修复模板失败:', error);
            throw error;
        }
    }

    /**
     * 优化模板性能
     * @param {string} template - 原始模板
     * @returns {Promise<string>} 优化后的模板
     */
    async optimizeTemplate(template) {
        try {
            console.log('[AITemplateAssistant] ⚡ 优化模板性能...');

            const prompt = this.promptTemplates.optimizeTemplate
                .replace('{userTemplate}', template);

            const optimizedTemplate = await this.callAI(prompt);
            const validatedTemplate = this.validateModifiedTemplate(optimizedTemplate);

            console.log('[AITemplateAssistant] ✅ 模板优化完成');
            return validatedTemplate;

        } catch (error) {
            console.error('[AITemplateAssistant] ❌ 优化模板失败:', error);
            throw error;
        }
    }

    /**
     * 智能建议模板改进
     * @param {string} template - 模板代码
     * @param {Object} context - 上下文信息
     * @returns {Promise<Object>} 建议信息
     */
    async suggestImprovements(template, context = {}) {
        try {
            console.log('[AITemplateAssistant] 💡 生成改进建议...');

            // 分析模板
            const analysis = await this.analyzeTemplate(template);

            // 获取当前数据结构
            const enabledPanels = await this.getEnabledPanelsInfo();
            const availableFields = await this.getAvailableFields();

            return {
                analysis,
                suggestions: {
                    dataBinding: this.generateDataBindingSuggestions(template, availableFields),
                    styling: this.generateStylingSuggestions(template),
                    performance: this.generatePerformanceSuggestions(template),
                    accessibility: this.generateAccessibilitySuggestions(template)
                },
                enabledPanels,
                availableFields
            };

        } catch (error) {
            console.error('[AITemplateAssistant] ❌ 生成改进建议失败:', error);
            throw error;
        }
    }

    /**
     * 生成数据绑定建议
     */
    generateDataBindingSuggestions(template, availableFields) {
        const suggestions = [];

        // 检查未使用的字段
        Object.entries(availableFields).forEach(([panelId, fields]) => {
            fields.forEach(field => {
                const bindingPattern = `{{data.${field}}}`;
                if (!template.includes(bindingPattern)) {
                    suggestions.push({
                        type: 'unused-field',
                        message: `字段 "${field}" 可以使用 ${bindingPattern} 绑定`,
                        field,
                        panelId,
                        binding: bindingPattern
                    });
                }
            });
        });

        return suggestions;
    }

    /**
     * 生成样式建议
     */
    generateStylingSuggestions(template) {
        const suggestions = [];

        // 检查是否使用了内联样式
        if (template.includes('style=')) {
            suggestions.push({
                type: 'inline-styles',
                message: '建议将内联样式提取到CSS类中以提高可维护性'
            });
        }

        // 检查是否有响应式设计
        if (!template.includes('flex') && !template.includes('grid')) {
            suggestions.push({
                type: 'responsive-design',
                message: '建议使用Flexbox或Grid布局实现响应式设计'
            });
        }

        return suggestions;
    }

    /**
     * 生成性能建议
     */
    generatePerformanceSuggestions(template) {
        const suggestions = [];

        // 检查DOM层级
        const divCount = (template.match(/<div/g) || []).length;
        if (divCount > 10) {
            suggestions.push({
                type: 'dom-complexity',
                message: `DOM层级较深(${divCount}个div)，建议简化结构`
            });
        }

        return suggestions;
    }

    /**
     * 生成可访问性建议
     */
    generateAccessibilitySuggestions(template) {
        const suggestions = [];

        // 检查是否有alt属性
        if (template.includes('<img') && !template.includes('alt=')) {
            suggestions.push({
                type: 'missing-alt',
                message: '图片缺少alt属性，影响可访问性'
            });
        }

        // 检查是否有语义化标签
        if (!template.includes('<h') && !template.includes('<section') && !template.includes('<article')) {
            suggestions.push({
                type: 'semantic-html',
                message: '建议使用语义化HTML标签提高可访问性'
            });
        }

        return suggestions;
    }

    /**
     * 获取使用统计
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            requestCount: this.requestCount,
            errorCount: this.errorCount,
            initialized: this.initialized
        };
    }

    /**
     * 错误处理
     * @param {Error} error - 错误对象
     */
    handleError(error) {
        this.errorCount++;
        console.error('[AITemplateAssistant] ❌ 错误:', error);
    }
}
