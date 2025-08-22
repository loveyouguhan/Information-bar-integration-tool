/**
 * TemplateManager.js - 模板管理器
 * 
 * 功能特性:
 * - 模板保存和加载
 * - 模板导入导出
 * - 模板库管理
 * - 模板验证和预览
 * - 模板分类和标签
 * 
 * @version 1.0.0
 * @author Information Bar Integration Tool Developer
 */

export class TemplateManager {
    constructor(dependencies = {}) {
        // 🔧 依赖注入
        this.configManager = dependencies.configManager || window.SillyTavernInfobar?.modules?.configManager;
        this.eventSystem = dependencies.eventSystem || window.SillyTavernInfobar?.eventSource;
        this.htmlTemplateParser = dependencies.htmlTemplateParser;

        // 🚀 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        this.templates = new Map(); // 模板缓存
        this.categories = new Map(); // 分类管理

        // 📚 内置模板库
        this.builtInTemplates = {
            'character-card': {
                id: 'character-card',
                name: '角色卡片',
                description: '显示角色基本信息和状态的卡片式布局',
                category: 'character',
                tags: ['角色', '状态', '卡片'],
                author: 'System',
                version: '1.0.0',
                template: this.getCharacterCardTemplate(),
                preview: 'character-card-preview.png',
                dataRequirements: ['name', 'class', 'level', 'health', 'maxHealth']
            },
            'status-bar': {
                id: 'status-bar',
                name: '状态栏',
                description: '简洁的横向状态栏显示',
                category: 'status',
                tags: ['状态', '简洁', '横向'],
                author: 'System',
                version: '1.0.0',
                template: this.getStatusBarTemplate(),
                preview: 'status-bar-preview.png',
                dataRequirements: ['name', 'health', 'energy']
            },
            'inventory-grid': {
                id: 'inventory-grid',
                name: '物品网格',
                description: '网格式物品展示界面',
                category: 'inventory',
                tags: ['物品', '网格', '背包'],
                author: 'System',
                version: '1.0.0',
                template: this.getInventoryGridTemplate(),
                preview: 'inventory-grid-preview.png',
                dataRequirements: ['items']
            },
            'rpg-dashboard': {
                id: 'rpg-dashboard',
                name: 'RPG仪表板',
                description: '完整的RPG游戏界面仪表板',
                category: 'dashboard',
                tags: ['RPG', '仪表板', '完整'],
                author: 'System',
                version: '1.0.0',
                template: this.getRPGDashboardTemplate(),
                preview: 'rpg-dashboard-preview.png',
                dataRequirements: ['name', 'class', 'level', 'health', 'energy', 'items', 'skills']
            }
        };

        console.log('[TemplateManager] 🚀 模板管理器初始化完成');
    }

    /**
     * 初始化模板管理器
     */
    async init() {
        try {
            console.log('[TemplateManager] 📊 开始初始化模板管理器...');

            // 加载用户模板
            await this.loadUserTemplates();

            // 初始化分类
            this.initializeCategories();

            // 绑定事件监听器
            this.bindEventListeners();

            this.initialized = true;
            console.log('[TemplateManager] ✅ 模板管理器初始化完成');

            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('template-manager:initialized', {
                    templateCount: this.templates.size,
                    builtInCount: Object.keys(this.builtInTemplates).length,
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('[TemplateManager] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 保存模板
     * @param {Object} templateData - 模板数据
     * @returns {Promise<string>} 模板ID
     */
    async saveTemplate(templateData) {
        try {
            console.log('[TemplateManager] 💾 保存模板:', templateData.name);

            // 验证模板数据
            this.validateTemplateData(templateData);

            // 生成模板ID
            const templateId = templateData.id || this.generateTemplateId(templateData.name);

            // 添加元数据
            const template = {
                ...templateData,
                id: templateId,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                author: templateData.author || 'User',
                version: templateData.version || '1.0.0'
            };

            // 保存到缓存
            this.templates.set(templateId, template);

            // 保存到配置
            await this.saveTemplatesToConfig();

            console.log('[TemplateManager] ✅ 模板保存成功:', templateId);

            // 触发保存事件
            if (this.eventSystem) {
                this.eventSystem.emit('template:saved', {
                    templateId,
                    template,
                    timestamp: Date.now()
                });
            }

            return templateId;

        } catch (error) {
            console.error('[TemplateManager] ❌ 保存模板失败:', error);
            this.handleError(error);
            throw error;
        }
    }

    /**
     * 加载模板
     * @param {string} templateId - 模板ID
     * @returns {Object} 模板数据
     */
    getTemplate(templateId) {
        try {
            // 先从用户模板中查找
            if (this.templates.has(templateId)) {
                return this.templates.get(templateId);
            }

            // 再从内置模板中查找
            if (this.builtInTemplates[templateId]) {
                return this.builtInTemplates[templateId];
            }

            throw new Error(`模板不存在: ${templateId}`);

        } catch (error) {
            console.error('[TemplateManager] ❌ 获取模板失败:', error);
            return null;
        }
    }

    /**
     * 删除模板
     * @param {string} templateId - 模板ID
     */
    async deleteTemplate(templateId) {
        try {
            console.log('[TemplateManager] 🗑️ 删除模板:', templateId);

            // 不能删除内置模板
            if (this.builtInTemplates[templateId]) {
                throw new Error('不能删除内置模板');
            }

            if (!this.templates.has(templateId)) {
                throw new Error('模板不存在');
            }

            // 从缓存中删除
            this.templates.delete(templateId);

            // 保存到配置
            await this.saveTemplatesToConfig();

            console.log('[TemplateManager] ✅ 模板删除成功:', templateId);

            // 触发删除事件
            if (this.eventSystem) {
                this.eventSystem.emit('template:deleted', {
                    templateId,
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('[TemplateManager] ❌ 删除模板失败:', error);
            this.handleError(error);
            throw error;
        }
    }

    /**
     * 获取所有模板
     * @param {Object} filters - 过滤条件
     * @returns {Array} 模板列表
     */
    getAllTemplates(filters = {}) {
        try {
            const allTemplates = [
                ...Object.values(this.builtInTemplates),
                ...Array.from(this.templates.values())
            ];

            // 应用过滤条件
            let filteredTemplates = allTemplates;

            if (filters.category) {
                filteredTemplates = filteredTemplates.filter(t => t.category === filters.category);
            }

            if (filters.tags && filters.tags.length > 0) {
                filteredTemplates = filteredTemplates.filter(t => 
                    t.tags && t.tags.some(tag => filters.tags.includes(tag))
                );
            }

            if (filters.author) {
                filteredTemplates = filteredTemplates.filter(t => t.author === filters.author);
            }

            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                filteredTemplates = filteredTemplates.filter(t => 
                    t.name.toLowerCase().includes(searchTerm) ||
                    t.description.toLowerCase().includes(searchTerm)
                );
            }

            return filteredTemplates;

        } catch (error) {
            console.error('[TemplateManager] ❌ 获取模板列表失败:', error);
            return [];
        }
    }

    /**
     * 导出模板
     * @param {string} templateId - 模板ID
     * @returns {string} 导出的JSON字符串
     */
    exportTemplate(templateId) {
        try {
            const template = this.getTemplate(templateId);
            if (!template) {
                throw new Error('模板不存在');
            }

            const exportData = {
                ...template,
                exportedAt: Date.now(),
                exportVersion: '1.0.0'
            };

            return JSON.stringify(exportData, null, 2);

        } catch (error) {
            console.error('[TemplateManager] ❌ 导出模板失败:', error);
            throw error;
        }
    }

    /**
     * 导入模板
     * @param {string} templateJson - 模板JSON字符串
     * @returns {Promise<string>} 导入的模板ID
     */
    async importTemplate(templateJson) {
        try {
            console.log('[TemplateManager] 📥 导入模板...');

            const templateData = JSON.parse(templateJson);
            
            // 验证导入数据
            this.validateImportData(templateData);

            // 生成新的ID避免冲突
            const newId = this.generateTemplateId(templateData.name);
            templateData.id = newId;
            templateData.importedAt = Date.now();

            // 保存模板
            const templateId = await this.saveTemplate(templateData);

            console.log('[TemplateManager] ✅ 模板导入成功:', templateId);
            return templateId;

        } catch (error) {
            console.error('[TemplateManager] ❌ 导入模板失败:', error);
            throw error;
        }
    }

    /**
     * 验证模板数据
     */
    validateTemplateData(templateData) {
        if (!templateData.name) {
            throw new Error('模板名称不能为空');
        }

        if (!templateData.template) {
            throw new Error('模板内容不能为空');
        }

        if (!templateData.category) {
            throw new Error('模板分类不能为空');
        }

        // 验证HTML模板语法
        if (this.htmlTemplateParser) {
            try {
                this.htmlTemplateParser.validateTemplateSecurity(templateData.template);
            } catch (error) {
                throw new Error(`模板安全验证失败: ${error.message}`);
            }
        }
    }

    /**
     * 验证导入数据
     */
    validateImportData(templateData) {
        if (!templateData.exportVersion) {
            throw new Error('无效的模板导出格式');
        }

        this.validateTemplateData(templateData);
    }

    /**
     * 生成模板ID
     */
    generateTemplateId(name) {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const nameStr = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        return `${nameStr}-${timestamp}-${randomStr}`;
    }

    /**
     * 获取角色卡片模板
     */
    getCharacterCardTemplate() {
        return `
            <div class="character-card" style="background: #2a2a2a; border-radius: 10px; padding: 20px; color: #fff;">
                <div class="character-header" style="display: flex; align-items: center; margin-bottom: 15px;">
                    <div class="character-avatar" style="width: 60px; height: 60px; border-radius: 50%; background: #007bff; display: flex; align-items: center; justify-content: center; margin-right: 15px;">
                        <i class="fas fa-user" style="font-size: 24px;"></i>
                    </div>
                    <div class="character-info">
                        <h3 style="margin: 0; color: #fff;">{{data.name}}</h3>
                        <p style="margin: 5px 0 0 0; color: #888;">{{data.class}} - Lv.{{data.level}}</p>
                    </div>
                </div>
                <div class="character-stats">
                    <div class="stat-bar" style="margin: 10px 0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span>生命值</span>
                            <span>{{data.health}}/{{data.maxHealth}}</span>
                        </div>
                        <div style="background: #333; height: 8px; border-radius: 4px; overflow: hidden;">
                            <div style="background: #4CAF50; height: 100%; width: {{computed.healthPercentage}}%; transition: width 0.3s ease;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 获取状态栏模板
     */
    getStatusBarTemplate() {
        return `
            <div class="status-bar" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; border-radius: 8px; color: #fff;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>{{data.name}}</strong>
                        <span style="margin-left: 10px; opacity: 0.8;">{{data.location}}</span>
                    </div>
                    <div style="display: flex; gap: 15px;">
                        <div style="text-align: center;">
                            <div style="font-size: 12px; opacity: 0.8;">HP</div>
                            <div style="font-weight: bold;">{{computed.healthPercentage}}%</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 12px; opacity: 0.8;">MP</div>
                            <div style="font-weight: bold;">{{computed.energyPercentage}}%</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 获取物品网格模板
     */
    getInventoryGridTemplate() {
        return `
            <div class="inventory-grid" style="background: #1a1a1a; padding: 20px; border-radius: 10px;">
                <h4 style="color: #fff; margin: 0 0 15px 0;">
                    <i class="fas fa-backpack"></i> 背包物品
                </h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 10px;">
                    {{#each data.items}}
                    <div style="background: #333; border-radius: 8px; padding: 10px; text-align: center; border: 1px solid #555;">
                        <div style="font-size: 24px; margin-bottom: 5px;">📦</div>
                        <div style="font-size: 12px; color: #ccc;">{{this.name}}</div>
                        <div style="font-size: 10px; color: #888;">×{{this.quantity}}</div>
                    </div>
                    {{/each}}
                </div>
            </div>
        `;
    }

    /**
     * 获取RPG仪表板模板
     */
    getRPGDashboardTemplate() {
        return `
            <div class="rpg-dashboard" style="background: #1a1a1a; border-radius: 15px; padding: 25px; color: #fff;">
                <div style="display: grid; grid-template-columns: 1fr 2fr 1fr; gap: 20px;">
                    <!-- 角色信息 -->
                    <div class="character-section">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <div style="width: 80px; height: 80px; border-radius: 50%; background: #007bff; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; font-size: 32px;">👤</div>
                            <h3 style="margin: 0;">{{data.name}}</h3>
                            <p style="margin: 5px 0; color: #888;">{{data.class}} - Lv.{{data.level}}</p>
                        </div>
                        <div class="stats">
                            <div style="margin: 10px 0;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                    <span>HP</span>
                                    <span>{{data.health}}/{{data.maxHealth}}</span>
                                </div>
                                <div style="background: #333; height: 6px; border-radius: 3px;">
                                    <div style="background: #4CAF50; height: 100%; width: {{computed.healthPercentage}}%; border-radius: 3px;"></div>
                                </div>
                            </div>
                            <div style="margin: 10px 0;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                    <span>MP</span>
                                    <span>{{data.energy}}/{{data.maxEnergy}}</span>
                                </div>
                                <div style="background: #333; height: 6px; border-radius: 3px;">
                                    <div style="background: #2196F3; height: 100%; width: {{computed.energyPercentage}}%; border-radius: 3px;"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 中央信息 -->
                    <div class="main-section">
                        <div style="background: #2a2a2a; border-radius: 10px; padding: 15px; margin-bottom: 15px;">
                            <h4 style="margin: 0 0 10px 0;">当前状态</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <div>位置: {{data.location}}</div>
                                <div>心情: {{data.mood}}</div>
                                <div>时间: {{data.time}}</div>
                                <div>天气: {{data.weather}}</div>
                            </div>
                        </div>
                        <div style="background: #2a2a2a; border-radius: 10px; padding: 15px;">
                            <h4 style="margin: 0 0 10px 0;">快速物品</h4>
                            <div style="display: flex; gap: 10px;">
                                {{#each data.quickItems}}
                                <div style="background: #333; border-radius: 5px; padding: 8px; text-align: center; flex: 1;">
                                    <div style="font-size: 16px;">{{this.icon}}</div>
                                    <div style="font-size: 10px; margin-top: 2px;">{{this.name}}</div>
                                </div>
                                {{/each}}
                            </div>
                        </div>
                    </div>

                    <!-- 技能和装备 -->
                    <div class="skills-section">
                        <h4 style="margin: 0 0 15px 0;">技能</h4>
                        {{#each data.skills}}
                        <div style="background: #2a2a2a; border-radius: 5px; padding: 8px; margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between;">
                                <span>{{this.name}}</span>
                                <span>Lv.{{this.level}}</span>
                            </div>
                        </div>
                        {{/each}}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 加载用户模板
     */
    async loadUserTemplates() {
        try {
            if (!this.configManager) return;

            const templates = await this.configManager.getConfig('userTemplates') || {};

            Object.entries(templates).forEach(([templateId, templateData]) => {
                this.templates.set(templateId, templateData);
            });

            console.log('[TemplateManager] 📦 已加载用户模板:', this.templates.size);

        } catch (error) {
            console.error('[TemplateManager] ❌ 加载用户模板失败:', error);
        }
    }

    /**
     * 保存模板到配置
     */
    async saveTemplatesToConfig() {
        try {
            if (!this.configManager) return;

            const templatesObj = {};
            this.templates.forEach((template, id) => {
                templatesObj[id] = template;
            });

            await this.configManager.setConfig('userTemplates', templatesObj);
            console.log('[TemplateManager] 💾 用户模板已保存到配置');

        } catch (error) {
            console.error('[TemplateManager] ❌ 保存模板到配置失败:', error);
        }
    }

    /**
     * 初始化分类
     */
    initializeCategories() {
        const categories = [
            { id: 'character', name: '角色', description: '角色信息相关模板' },
            { id: 'status', name: '状态', description: '状态显示相关模板' },
            { id: 'inventory', name: '物品', description: '物品和背包相关模板' },
            { id: 'dashboard', name: '仪表板', description: '综合信息仪表板模板' },
            { id: 'custom', name: '自定义', description: '用户自定义模板' }
        ];

        categories.forEach(category => {
            this.categories.set(category.id, category);
        });
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        if (this.eventSystem) {
            // 监听模板请求事件
            this.eventSystem.on('template:request', (data) => {
                this.handleTemplateRequest(data);
            });

            // 监听配置变更事件
            this.eventSystem.on('config:updated', () => {
                this.loadUserTemplates();
            });
        }
    }

    /**
     * 处理模板请求
     */
    async handleTemplateRequest(data) {
        try {
            const { templateId, callback } = data;
            const template = this.getTemplate(templateId);

            if (callback && typeof callback === 'function') {
                callback(null, template);
            }

        } catch (error) {
            console.error('[TemplateManager] ❌ 处理模板请求失败:', error);

            if (data.callback && typeof data.callback === 'function') {
                data.callback(error, null);
            }
        }
    }

    /**
     * 获取分类列表
     */
    getCategories() {
        return Array.from(this.categories.values());
    }

    /**
     * 预览模板
     * @param {string} templateId - 模板ID
     * @param {Object} sampleData - 示例数据
     * @returns {string} 渲染后的HTML
     */
    previewTemplate(templateId, sampleData = null) {
        try {
            const template = this.getTemplate(templateId);
            if (!template) {
                throw new Error('模板不存在');
            }

            // 使用示例数据或默认数据
            const data = sampleData || this.getDefaultSampleData();

            // 使用HTML模板解析器渲染
            if (this.htmlTemplateParser) {
                return this.htmlTemplateParser.parseTemplate(template.template, data);
            } else {
                // 简单渲染
                return this.simpleRender(template.template, data);
            }

        } catch (error) {
            console.error('[TemplateManager] ❌ 预览模板失败:', error);
            return `<div style="color: red;">预览失败: ${error.message}</div>`;
        }
    }

    /**
     * 获取默认示例数据
     */
    getDefaultSampleData() {
        return {
            data: {
                name: '示例角色',
                class: '战士',
                level: 25,
                health: 850,
                maxHealth: 1000,
                energy: 320,
                maxEnergy: 400,
                location: '新手村',
                mood: '愉快',
                time: '上午',
                weather: '晴朗',
                items: [
                    { name: '铁剑', quantity: 1, icon: '⚔️' },
                    { name: '治疗药水', quantity: 5, icon: '🧪' },
                    { name: '面包', quantity: 10, icon: '🍞' }
                ],
                quickItems: [
                    { name: '药水', icon: '🧪' },
                    { name: '食物', icon: '🍞' },
                    { name: '卷轴', icon: '📜' }
                ],
                skills: [
                    { name: '剑术', level: 15 },
                    { name: '防御', level: 12 },
                    { name: '治疗', level: 8 }
                ]
            },
            computed: {
                healthPercentage: 85,
                energyPercentage: 80,
                timestamp: new Date().toLocaleString()
            }
        };
    }

    /**
     * 简单渲染（备用方案）
     */
    simpleRender(template, data) {
        let result = template;

        // 简单的数据绑定替换
        result = result.replace(/\{\{data\.(\w+)\}\}/g, (match, field) => {
            return data.data[field] || '';
        });

        result = result.replace(/\{\{computed\.(\w+)\}\}/g, (match, field) => {
            return data.computed[field] || '';
        });

        return result;
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            userTemplates: this.templates.size,
            builtInTemplates: Object.keys(this.builtInTemplates).length,
            categories: this.categories.size,
            errorCount: this.errorCount,
            initialized: this.initialized
        };
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[TemplateManager] ❌ 错误:', error);
    }
}
