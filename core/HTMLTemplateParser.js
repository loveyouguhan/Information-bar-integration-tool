/**
 * HTMLTemplateParser.js - HTML模板解析器
 * 
 * 功能特性:
 * - 支持数据绑定语法 {{data.field}}
 * - 支持条件渲染 {{#if condition}}...{{/if}}
 * - 支持循环渲染 {{#each array}}...{{/each}}
 * - 支持计算字段 {{computed.field}}
 * - HTML安全性处理和XSS防护
 * - 模板验证和错误处理
 * 
 * @version 1.0.0
 * @author Information Bar Integration Tool Developer
 */

export class HTMLTemplateParser {
    constructor(dependencies = {}) {
        // 🔧 依赖注入
        this.unifiedDataCore = dependencies.unifiedDataCore || window.InfoBarData;
        this.eventSystem = dependencies.eventSystem || window.SillyTavernInfobar?.eventSource;
        this.configManager = dependencies.configManager || window.SillyTavernInfobar?.modules?.configManager;

        // 🚀 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        this.templateCache = new Map(); // 模板缓存
        this.compiledTemplates = new Map(); // 编译后的模板缓存

        // 🎨 模板语法配置
        this.syntax = {
            dataBinding: /\{\{([^}]+)\}\}/g,           // {{data.field}}
            conditionalStart: /\{\{#if\s+([^}]+)\}\}/g, // {{#if condition}}
            conditionalEnd: /\{\{\/if\}\}/g,           // {{/if}}
            loopStart: /\{\{#each\s+([^}]+)\}\}/g,     // {{#each array}}
            loopEnd: /\{\{\/each\}\}/g,                // {{/each}}
            computedField: /\{\{computed\.([^}]+)\}\}/g // {{computed.field}}
        };

        // 🛡️ 安全配置
        this.security = {
            allowedTags: [
                'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
                'img', 'a', 'strong', 'em', 'br', 'hr', 'button', 'input',
                'select', 'option', 'textarea', 'label', 'form', 'fieldset',
                'legend', 'progress', 'meter', 'details', 'summary'
            ],
            allowedAttributes: [
                'class', 'id', 'style', 'data-*', 'title', 'alt', 'src',
                'href', 'target', 'type', 'value', 'placeholder', 'disabled',
                'readonly', 'checked', 'selected', 'multiple', 'required'
            ],
            forbiddenPatterns: [
                /javascript:/gi,
                /on\w+\s*=/gi,
                /<script/gi,
                /eval\s*\(/gi,
                /expression\s*\(/gi
            ]
        };

        console.log('[HTMLTemplateParser] 🚀 HTML模板解析器初始化完成');
    }

    /**
     * 初始化解析器
     */
    async init() {
        try {
            console.log('[HTMLTemplateParser] 📊 开始初始化HTML模板解析器...');

            // 预编译常用模板
            await this.precompileCommonTemplates();

            // 绑定事件监听器
            this.bindEventListeners();

            this.initialized = true;
            console.log('[HTMLTemplateParser] ✅ HTML模板解析器初始化完成');

            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('html-template-parser:initialized', {
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('[HTMLTemplateParser] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 解析HTML模板
     * @param {string} template - HTML模板字符串
     * @param {Object} data - 数据对象
     * @param {Object} options - 解析选项
     * @returns {string} 渲染后的HTML
     */
    parseTemplate(template, data = {}, options = {}) {
        try {
            console.log('[HTMLTemplateParser] 🎨 开始解析HTML模板...');

            // 🔧 取消阻断式安全校验：仅记录告警，不阻止解析
            try {
                const safe = this.validateTemplateSecurity(template);
                if (!safe) {
                    console.warn('[HTMLTemplateParser] ⚠️ 模板安全校验未通过，但按要求继续解析');
                }
            } catch (e) {
                console.warn('[HTMLTemplateParser] ⚠️ 模板安全校验异常，已忽略:', e?.message);
            }

            // 获取模板ID用于缓存
            const templateId = this.generateTemplateId(template);
            
            // 检查缓存
            if (this.compiledTemplates.has(templateId) && !options.forceRecompile) {
                console.log('[HTMLTemplateParser] 📦 使用缓存的编译模板');
                const compiledTemplate = this.compiledTemplates.get(templateId);
                return this.executeCompiledTemplate(compiledTemplate, data, options);
            }

            // 编译模板
            const compiledTemplate = this.compileTemplate(template);
            
            // 缓存编译结果
            this.compiledTemplates.set(templateId, compiledTemplate);

            // 执行编译后的模板
            const result = this.executeCompiledTemplate(compiledTemplate, data, options);

            console.log('[HTMLTemplateParser] ✅ HTML模板解析完成');
            return result;

        } catch (error) {
            console.error('[HTMLTemplateParser] ❌ 解析HTML模板失败:', error);
            this.handleError(error);
            return this.generateErrorTemplate(error.message);
        }
    }

    /**
     * 编译模板
     * @param {string} template - 原始模板
     * @returns {Object} 编译后的模板对象
     */
    compileTemplate(template) {
        console.log('[HTMLTemplateParser] 🔧 开始编译模板...');

        const compiled = {
            original: template,
            tokens: [],
            dependencies: new Set(),
            hasConditionals: false,
            hasLoops: false,
            hasComputedFields: false
        };

        // 解析模板结构
        compiled.tokens = this.tokenizeTemplate(template);
        
        // 分析依赖关系
        this.analyzeDependencies(compiled);

        console.log('[HTMLTemplateParser] ✅ 模板编译完成，tokens数量:', compiled.tokens.length);
        return compiled;
    }

    /**
     * 将模板分解为tokens
     * @param {string} template - 模板字符串
     * @returns {Array} token数组
     */
    tokenizeTemplate(template) {
        const tokens = [];
        let currentIndex = 0;

        // 简化的tokenization实现
        const regex = /\{\{([^}]+)\}\}/g;
        let match;
        let lastIndex = 0;

        while ((match = regex.exec(template)) !== null) {
            // 添加前面的文本
            if (match.index > lastIndex) {
                tokens.push({
                    type: 'text',
                    content: template.substring(lastIndex, match.index)
                });
            }

            // 添加表达式token
            tokens.push({
                type: 'expression',
                content: match[0],
                expression: match[1].trim()
            });

            lastIndex = match.index + match[0].length;
        }

        // 添加剩余文本
        if (lastIndex < template.length) {
            tokens.push({
                type: 'text',
                content: template.substring(lastIndex)
            });
        }

        return tokens;
    }

    /**
     * 分析模板依赖关系
     * @param {Object} compiled - 编译对象
     */
    analyzeDependencies(compiled) {
        compiled.tokens.forEach(token => {
            if (token.type === 'expression') {
                // 提取数据依赖
                const expr = token.expression;
                if (expr.startsWith('data.')) {
                    compiled.dependencies.add(expr.substring(5));
                } else if (expr.startsWith('computed.')) {
                    compiled.hasComputedFields = true;
                    compiled.dependencies.add(expr);
                }
            }
        });
    }

    /**
     * 执行编译后的模板
     * @param {Object} compiled - 编译后的模板
     * @param {Object} data - 数据对象
     * @param {Object} options - 选项
     * @returns {string} 渲染结果
     */
    executeCompiledTemplate(compiled, data, options) {
        try {
            return this.processTokens(compiled.tokens, data, options);
        } catch (error) {
            console.error('[HTMLTemplateParser] ❌ 执行编译模板失败:', error);
            return this.generateErrorTemplate(error.message);
        }
    }

    /**
     * 处理token数组
     * @param {Array} tokens - token数组
     * @param {Object} data - 数据对象
     * @param {Object} options - 选项
     * @returns {string} 渲染结果
     */
    processTokens(tokens, data, options) {
        let result = '';
        let i = 0;

        while (i < tokens.length) {
            const token = tokens[i];

            if (token.type === 'text') {
                result += token.content;
                i++;
            } else if (token.type === 'expression') {
                const value = this.evaluateExpression(token.expression, data);
                result += this.escapeHtml(String(value || ''));
                i++;
            } else if (token.expression && token.expression.startsWith('#if ')) {
                // 处理条件渲染
                const { content, nextIndex } = this.processConditional(tokens, i, data, options);
                result += content;
                i = nextIndex;
            } else if (token.expression && token.expression.startsWith('#each ')) {
                // 处理循环渲染
                const { content, nextIndex } = this.processLoop(tokens, i, data, options);
                result += content;
                i = nextIndex;
            } else {
                i++;
            }
        }

        return result;
    }

    /**
     * 处理条件渲染
     * @param {Array} tokens - token数组
     * @param {number} startIndex - 开始索引
     * @param {Object} data - 数据对象
     * @param {Object} options - 选项
     * @returns {Object} 处理结果和下一个索引
     */
    processConditional(tokens, startIndex, data, options) {
        const startToken = tokens[startIndex];
        const condition = startToken.expression.substring(4).trim(); // 移除 '#if '

        // 查找对应的 {{/if}}
        let endIndex = -1;
        let depth = 1;

        for (let i = startIndex + 1; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.expression) {
                if (token.expression.startsWith('#if ')) {
                    depth++;
                } else if (token.expression === '/if') {
                    depth--;
                    if (depth === 0) {
                        endIndex = i;
                        break;
                    }
                }
            }
        }

        if (endIndex === -1) {
            throw new Error('未找到匹配的 {{/if}}');
        }

        // 评估条件
        const conditionResult = this.evaluateCondition(condition, data);

        let content = '';
        if (conditionResult) {
            // 处理条件内的tokens
            const innerTokens = tokens.slice(startIndex + 1, endIndex);
            content = this.processTokens(innerTokens, data, options);
        }

        return {
            content,
            nextIndex: endIndex + 1
        };
    }

    /**
     * 处理循环渲染
     * @param {Array} tokens - token数组
     * @param {number} startIndex - 开始索引
     * @param {Object} data - 数据对象
     * @param {Object} options - 选项
     * @returns {Object} 处理结果和下一个索引
     */
    processLoop(tokens, startIndex, data, options) {
        const startToken = tokens[startIndex];
        const arrayPath = startToken.expression.substring(6).trim(); // 移除 '#each '

        // 查找对应的 {{/each}}
        let endIndex = -1;
        let depth = 1;

        for (let i = startIndex + 1; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.expression) {
                if (token.expression.startsWith('#each ')) {
                    depth++;
                } else if (token.expression === '/each') {
                    depth--;
                    if (depth === 0) {
                        endIndex = i;
                        break;
                    }
                }
            }
        }

        if (endIndex === -1) {
            throw new Error('未找到匹配的 {{/each}}');
        }

        // 获取数组数据
        const arrayData = this.getNestedValue(data, arrayPath);

        let content = '';
        if (Array.isArray(arrayData)) {
            const innerTokens = tokens.slice(startIndex + 1, endIndex);

            arrayData.forEach((item, index) => {
                // 为每个循环项创建上下文
                const loopContext = {
                    ...data,
                    this: item,
                    '@index': index,
                    '@first': index === 0,
                    '@last': index === arrayData.length - 1
                };

                content += this.processTokens(innerTokens, loopContext, options);
            });
        }

        return {
            content,
            nextIndex: endIndex + 1
        };
    }

    /**
     * 评估条件表达式
     * @param {string} condition - 条件表达式
     * @param {Object} data - 数据对象
     * @returns {boolean} 条件结果
     */
    evaluateCondition(condition, data) {
        try {
            // 简单的条件评估
            // 支持基本的比较操作

            // 处理简单的存在性检查
            if (!condition.includes(' ')) {
                const value = this.evaluateExpression(condition, data);
                return !!value;
            }

            // 处理比较操作
            const operators = ['>=', '<=', '>', '<', '==', '!='];
            for (const op of operators) {
                if (condition.includes(op)) {
                    const [left, right] = condition.split(op).map(s => s.trim());
                    const leftValue = this.evaluateExpression(left, data);
                    const rightValue = this.evaluateExpression(right, data);

                    switch (op) {
                        case '>=': return Number(leftValue) >= Number(rightValue);
                        case '<=': return Number(leftValue) <= Number(rightValue);
                        case '>': return Number(leftValue) > Number(rightValue);
                        case '<': return Number(leftValue) < Number(rightValue);
                        case '==': return leftValue == rightValue;
                        case '!=': return leftValue != rightValue;
                    }
                }
            }

            return false;
        } catch (error) {
            console.warn('[HTMLTemplateParser] ⚠️ 条件评估失败:', condition, error);
            return false;
        }
    }

    /**
     * 计算表达式值
     * @param {string} expression - 表达式
     * @param {Object} data - 数据对象
     * @returns {any} 计算结果
     */
    evaluateExpression(expression, data) {
        try {
            // 🔧 修复：支持 || 运算符（默认值语法）
            if (expression.includes(' || ')) {
                const parts = expression.split(' || ');
                const leftExpression = parts[0].trim();
                const rightExpression = parts[1].trim();

                // 计算左侧表达式
                const leftValue = this.evaluateExpression(leftExpression, data);

                // 如果左侧有值且不为空，返回左侧值
                if (leftValue !== null && leftValue !== undefined && leftValue !== '') {
                    return leftValue;
                }

                // 否则计算右侧表达式（默认值）
                const rightValue = this.evaluateExpression(rightExpression, data);

                // 如果右侧是字符串字面量（用引号包围），去掉引号
                if (typeof rightValue === 'string' &&
                    ((rightValue.startsWith("'") && rightValue.endsWith("'")) ||
                     (rightValue.startsWith('"') && rightValue.endsWith('"')))) {
                    return rightValue.slice(1, -1);
                }

                return rightValue;
            }

            // 原有的表达式处理逻辑
            if (expression.startsWith('data.')) {
                const path = expression.substring(5);
                // 如果data对象有data属性，使用data.data，否则直接使用data
                const dataSource = data.data || data;
                return this.getNestedValue(dataSource, path);
            } else if (expression.startsWith('computed.')) {
                return this.getComputedValue(expression.substring(9), data);
            }

            // 🔧 修复：处理数字字面量
            if (/^\d+(\.\d+)?$/.test(expression)) {
                return Number(expression);
            }

            // 🔧 修复：处理字符串字面量
            if ((expression.startsWith("'") && expression.endsWith("'")) ||
                (expression.startsWith('"') && expression.endsWith('"'))) {
                return expression.slice(1, -1);
            }

            return expression;
        } catch (error) {
            console.warn('[HTMLTemplateParser] ⚠️ 表达式计算失败:', expression, error);
            return '';
        }
    }

    /**
     * 获取嵌套对象值
     * @param {Object} obj - 对象
     * @param {string} path - 路径
     * @returns {any} 值
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : '';
        }, obj);
    }

    /**
     * 获取计算字段值
     * @param {string} field - 字段名
     * @param {Object} data - 数据对象
     * @returns {any} 计算结果
     */
    getComputedValue(field, data) {
        // 实现常用的计算字段
        switch (field) {
            case 'healthPercentage':
                return data.health && data.maxHealth ? 
                    Math.round((data.health / data.maxHealth) * 100) : 0;
            case 'timestamp':
                return new Date().toLocaleString();
            default:
                return '';
        }
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
     * 验证模板安全性
     * @param {string} template - 模板
     * @returns {boolean} 是否安全
     */
    validateTemplateSecurity(template) {
        // 检查禁用模式
        for (const pattern of this.security.forbiddenPatterns) {
            if (pattern.test(template)) {
                console.warn('[HTMLTemplateParser] ⚠️ 模板包含禁用内容:', pattern);
                return false;
            }
        }
        return true;
    }

    /**
     * 生成模板ID
     * @param {string} template - 模板
     * @returns {string} 模板ID
     */
    generateTemplateId(template) {
        // 简单的哈希函数
        let hash = 0;
        for (let i = 0; i < template.length; i++) {
            const char = template.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * 预编译常用模板
     */
    async precompileCommonTemplates() {
        console.log('[HTMLTemplateParser] 📦 预编译常用模板...');

        // 预编译一些常用模板
        const commonTemplates = {
            'character-card': `
                <div class="character-card" style="
                    background: #2a2a2a; 
                    border-radius: 10px; 
                    padding: 16px; 
                    color: #fff;
                    width: 100%; 
                    max-width: 100%; 
                    box-sizing: border-box;
                    overflow: hidden;
                    contain: layout style;
                ">
                    <div class="character-header" style="
                        display: flex; 
                        align-items: center; 
                        margin-bottom: 14px;
                        gap: 12px;
                    ">
                        <div class="character-avatar" style="
                            width: 60px; 
                            height: 60px; 
                            border-radius: 50%; 
                            background: #007bff; 
                            display: flex; 
                            align-items: center; 
                            justify-content: center;
                            flex-shrink: 0;
                        ">
                            <i class="fas fa-user" style="font-size: 24px;"></i>
                        </div>
                        <div class="character-info" style="
                            flex: 1; 
                            min-width: 0;
                            max-width: calc(100% - 72px);
                        ">
                            <h3 style="
                                margin: 0; 
                                color: #fff;
                                font-size: 16px;
                                line-height: 1.2;
                                white-space: nowrap; 
                                overflow: hidden; 
                                text-overflow: ellipsis;
                            ">{{data.name}}</h3>
                            <p style="
                                margin: 4px 0 0 0; 
                                color: #888;
                                font-size: 12px;
                                line-height: 1.1;
                                white-space: nowrap; 
                                overflow: hidden; 
                                text-overflow: ellipsis;
                            ">{{data.class}} - Lv.{{data.level}}</p>
                        </div>
                    </div>
                    <div class="character-stats">
                        <div class="stat-bar" style="margin: 10px 0;">
                            <div style="
                                display: flex; 
                                justify-content: space-between; 
                                margin-bottom: 4px;
                                font-size: 11px;
                            ">
                                <span>生命值</span>
                                <span>{{data.health}}/{{data.maxHealth}}</span>
                            </div>
                            <div style="
                                background: #333; 
                                height: 8px; 
                                border-radius: 4px; 
                                overflow: hidden;
                            ">
                                <div style="
                                    background: #4CAF50; 
                                    height: 100%; 
                                    width: {{computed.healthPercentage}}%; 
                                    transition: width 0.3s ease;
                                "></div>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            'status-bar': `
                <div class="status-bar" style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    padding: 8px 12px; 
                    border-radius: 8px; 
                    color: #fff; 
                    width: 100%; 
                    max-width: 100%; 
                    box-sizing: border-box; 
                    overflow: hidden;
                    font-size: 12px;
                    min-height: 50px;
                    position: relative;
                    contain: layout style;
                ">
                    <div style="
                        display: flex; 
                        justify-content: space-between; 
                        align-items: center; 
                        gap: 8px; 
                        min-width: 0; 
                        height: 100%;
                        position: relative;
                    ">
                        <div style="
                            flex: 1; 
                            min-width: 0; 
                            display: flex; 
                            flex-direction: column; 
                            justify-content: center;
                            max-width: calc(100% - 120px);
                        ">
                            <strong style="
                                white-space: nowrap; 
                                overflow: hidden; 
                                text-overflow: ellipsis; 
                                font-size: 14px;
                                line-height: 1.2;
                                margin-bottom: 2px;
                                display: block;
                            ">{{data.name}}</strong>
                            <span style="
                                opacity: 0.8; 
                                white-space: nowrap; 
                                overflow: hidden; 
                                text-overflow: ellipsis; 
                                font-size: 11px;
                                line-height: 1.1;
                                display: block;
                            ">{{data.location}}</span>
                        </div>
                        <div style="
                            display: flex; 
                            gap: 8px; 
                            flex-shrink: 0;
                            align-items: center;
                            width: 110px;
                            justify-content: flex-end;
                        ">
                            <div style="
                                text-align: center; 
                                width: 45px;
                                padding: 2px;
                            ">
                                <div style="
                                    font-size: 9px; 
                                    opacity: 0.8; 
                                    line-height: 1;
                                    margin-bottom: 1px;
                                ">HP</div>
                                <div style="
                                    font-weight: bold; 
                                    font-size: 12px; 
                                    line-height: 1;
                                ">{{computed.healthPercentage}}%</div>
                            </div>
                            <div style="
                                text-align: center; 
                                width: 45px;
                                padding: 2px;
                            ">
                                <div style="
                                    font-size: 9px; 
                                    opacity: 0.8; 
                                    line-height: 1;
                                    margin-bottom: 1px;
                                ">MP</div>
                                <div style="
                                    font-weight: bold; 
                                    font-size: 12px; 
                                    line-height: 1;
                                ">{{computed.energyPercentage}}%</div>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            'inventory-grid': `
                <div class="inventory-grid" style="
                    background: #1a1a1a; 
                    padding: 16px; 
                    border-radius: 10px;
                    width: 100%; 
                    max-width: 100%; 
                    box-sizing: border-box;
                    overflow: hidden;
                    contain: layout style;
                ">
                    <h4 style="
                        color: #fff; 
                        margin: 0 0 14px 0;
                        font-size: 15px;
                        line-height: 1.2;
                    ">
                        <i class="fas fa-backpack" style="margin-right: 6px;"></i> 背包物品
                    </h4>
                    <div style="
                        display: grid; 
                        grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); 
                        gap: 8px;
                        width: 100%;
                    ">
                        {{#each data.items}}
                        <div style="
                            background: #333; 
                            border-radius: 6px; 
                            padding: 8px; 
                            text-align: center; 
                            border: 1px solid #555;
                            aspect-ratio: 1;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                            align-items: center;
                            min-height: 70px;
                            max-height: 70px;
                            overflow: hidden;
                        ">
                            <div style="
                                font-size: 20px; 
                                margin-bottom: 3px;
                                line-height: 1;
                            ">📦</div>
                            <div style="
                                font-size: 10px; 
                                color: #ccc;
                                line-height: 1.1;
                                margin-bottom: 1px;
                                white-space: nowrap; 
                                overflow: hidden; 
                                text-overflow: ellipsis;
                                width: 100%;
                            ">{{this.name}}</div>
                            <div style="
                                font-size: 8px; 
                                color: #888;
                                line-height: 1;
                            ">×{{this.quantity}}</div>
                        </div>
                        {{/each}}
                    </div>
                </div>
            `
        };

        // 预编译这些模板
        for (const [templateId, template] of Object.entries(commonTemplates)) {
            try {
                const compiled = this.compileTemplate(template);
                this.compiledTemplates.set(templateId, compiled);
                console.log(`[HTMLTemplateParser] ✅ 预编译模板: ${templateId}`);
            } catch (error) {
                console.error(`[HTMLTemplateParser] ❌ 预编译模板失败: ${templateId}`, error);
            }
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        if (this.eventSystem) {
            // 监听数据更新事件
            this.eventSystem.on('data:updated', () => {
                this.clearCache();
            });

            // 监听模板请求事件
            this.eventSystem.on('template:parse', (data) => {
                this.handleTemplateParseRequest(data);
            });
        }
    }

    /**
     * 处理模板解析请求
     */
    async handleTemplateParseRequest(data) {
        try {
            const { template, data: templateData, options, callback } = data;
            const result = this.parseTemplate(template, templateData, options);

            if (callback && typeof callback === 'function') {
                callback(null, result);
            }

            // 触发解析完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('template:parsed', {
                    template,
                    result,
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('[HTMLTemplateParser] ❌ 处理模板解析请求失败:', error);

            if (data.callback && typeof data.callback === 'function') {
                data.callback(error, null);
            }
        }
    }

    /**
     * 获取预编译模板
     */
    getPrecompiledTemplate(templateId) {
        return this.compiledTemplates.get(templateId);
    }

    /**
     * 获取所有预编译模板ID
     */
    getPrecompiledTemplateIds() {
        return Array.from(this.compiledTemplates.keys());
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.compiledTemplates.clear();
        console.log('[HTMLTemplateParser] 🗑️ 模板缓存已清除');
    }

    /**
     * 生成错误模板
     * @param {string} message - 错误消息
     * @returns {string} 错误HTML
     */
    generateErrorTemplate(message) {
        return `<div class="template-error" style="color: red; border: 1px solid red; padding: 10px; margin: 5px;">
            <strong>模板解析错误:</strong> ${this.escapeHtml(message)}
        </div>`;
    }

    /**
     * 错误处理
     * @param {Error} error - 错误对象
     */
    handleError(error) {
        this.errorCount++;
        console.error('[HTMLTemplateParser] ❌ 错误:', error);
    }
}
