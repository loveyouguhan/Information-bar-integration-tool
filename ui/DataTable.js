/**
 * 数据表格界面
 * 
 * 负责管理数据表格的显示和交互：
 * - 表格数据的显示和渲染
 * - 数据筛选和搜索功能
 * - 分页和排序功能
 * - 数据导入导出功能
 * - 表格配置和自定义
 * 
 * @class DataTable
 */

export class DataTable {
    constructor(dataCore, configManager, eventSystem) {
        console.log('[DataTable] 🔧 数据表格界面初始化开始');
        
        this.dataCore = dataCore;
        this.configManager = configManager;
        this.eventSystem = eventSystem;
        
        // UI元素引用
        this.container = null;
        this.modal = null;
        this.table = null;
        this.toolbar = null;
        
        // 表格数据
        this.data = [];
        this.filteredData = [];
        this.columns = [];

        // 🔧 新增：表格持久化状态管理（修复版）
        this.tableState = {
            initialized: false,
            structure: null,
            lastDataHash: this.loadPersistedDataHash(), // 🔧 修复：从持久化存储加载哈希值
            cellPositions: new Map(), // 单元格位置缓存
            panelStructures: new Map() // 面板结构缓存
        };

        // 分页设置 - 已移除分页功能，保留属性以避免错误
        this.pagination = {
            currentPage: 1,
            pageSize: 999999, // 设置为大数值，显示所有数据
            totalPages: 1,
            totalItems: 0
        };

        // 刷新状态标记
        this.needsRefresh = false;
        
        // 排序设置
        this.sorting = {
            column: null,
            direction: 'asc' // 'asc' | 'desc'
        };
        
        // 筛选设置
        this.filters = {
            search: '',
            dateRange: { start: null, end: null },
            category: '',
            status: ''
        };
        
        // 选中的行
        this.selectedRows = new Set();
        
        // 初始化状态
        this.initialized = false;
        this.visible = false;
        this.errorCount = 0;
        
        // 绑定方法
        this.init = this.init.bind(this);
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.loadData = this.loadData.bind(this);
        this.renderTable = this.renderTable.bind(this);
        this.applyFilters = this.applyFilters.bind(this);
    }

    /**
     * 初始化数据表格界面
     */
    async init() {
        try {
            console.log('[DataTable] 📊 开始初始化数据表格界面...');
            
            if (!this.dataCore) {
                throw new Error('数据核心未初始化');
            }
            
            // 创建UI
            this.createUI();
            
            // 初始化表格列配置
            this.initColumns();
            
            // 加载数据
            await this.loadData();
            
            // 绑定事件
            this.bindEvents();

            // 监听主题变化事件
            this.bindThemeEvents();

            // 监听设置变更事件
            this.bindSettingsEvents();

            // 监听数据变更事件
            this.bindDataChangeEvents();

            // 加载并应用保存的主题
            await this.loadAndApplyTheme();

            this.initialized = true;
            console.log('[DataTable] ✅ 数据表格界面初始化完成');
            
        } catch (error) {
            console.error('[DataTable] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 创建UI界面
     */
    createUI() {
        try {
            // 创建新的深色主题数据表格界面
            this.modal = document.createElement('div');
            this.modal.id = 'data-table-modal';
            this.modal.className = 'data-table-modal datatable-modal-new';
            this.modal.style.display = 'none';

            this.modal.innerHTML = `
                <div class="modal-overlay" onclick="this.closest('.data-table-modal').style.display='none'"></div>
                <div class="modal-container">
                    <!-- 顶部标题栏 -->
                    <div class="modal-header">
                        <div class="header-left">
                            <h2>数据表格</h2>
                        </div>
                        <div class="header-right">
                            <button class="modal-close" onclick="this.closest('.data-table-modal').style.display='none'">×</button>
                        </div>
                    </div>

                    <!-- 顶部工具栏 -->
                    <div class="table-toolbar">
                        <div class="toolbar-left">
                            <button class="btn-toolbar btn-compact" data-action="add-panel" title="增加新面板">
                                增加面板
                            </button>
                        </div>
                        <div class="toolbar-right">
                            <button class="btn-toolbar btn-compact" data-action="export-preset" title="导出预设配置">
                                导出预设
                            </button>
                            <button class="btn-toolbar btn-compact" data-action="import-preset" title="导入预设配置">
                                导入预设
                            </button>
                        </div>
                    </div>

                    <!-- 主体内容区域 -->
                    <div class="modal-body">
                        ${this.createGroupedTables()}
                    </div>

                    <!-- 底部状态栏 - 简化版本 -->
                    <div class="modal-footer">
                        <div class="footer-left">
                            <span class="status-text">数据加载完成</span>
                            <span class="record-count">共 <span class="count-number">0</span> 条记录</span>
                        </div>
                        <div class="footer-right">
                            <button id="refill-data-btn" class="refill-data-btn">
                                <i class="fa-solid fa-rotate-right"></i>
                                重新填表
                            </button>
                            <button id="generate-variables-btn" class="generate-variables-btn">
                                <i class="fa-solid fa-code"></i>
                                生成变量
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // 添加到页面
            document.body.appendChild(this.modal);

            // 获取关键元素引用
            this.toolbar = this.modal.querySelector('.table-toolbar');
            this.tableContainer = this.modal.querySelector('.modal-body');

            // 绑定新的事件处理
            this.bindNewEvents();

            console.log('[DataTable] 🎨 新UI界面创建完成');

        } catch (error) {
            console.error('[DataTable] ❌ 创建UI失败:', error);
            throw error;
        }
    }

    /**
     * 创建数据表格内容 - 显示实际的面板数据
     */
    createDataTableContent() {
        try {
            console.log('[DataTable] 🔄 创建数据表格内容...');

            return `
                <div class="data-table-content">
                    <div class="table-container">
                        <table class="data-table">
                            <thead class="table-header">
                                <tr>
                                    <!-- 列头将通过 renderTableHeader 动态生成 -->
                                </tr>
                            </thead>
                            <tbody class="table-body">
                                <!-- 数据行将通过 renderTableBody 动态生成 -->
                            </tbody>
                        </table>
                    </div>

                    <!-- 加载状态 -->
                    <div class="loading-overlay" style="display: none;">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">正在加载数据...</div>
                    </div>

                    <!-- 空状态 -->
                    <div class="empty-state" style="display: none;">
                        
                        <h3>暂无数据</h3>
                        <p>当前聊天中没有面板数据</p>
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('[DataTable] ❌ 创建数据表格内容失败:', error);
            return `
                <div class="data-table-content">
                    <div class="error-message">
                        
                        <h3>表格创建失败</h3>
                        <p>请刷新页面重试</p>
                    </div>
                </div>
            `;
        }
    }

    /**
     * 创建分组表格 - 完全动态识别所有面板 (保留原方法用于面板配置显示)
     */
    createGroupedTables() {
        try {
            console.log('[DataTable] 🔄 开始动态生成面板表格...');

            // 获取所有启用的面板配置
            const enabledPanels = this.getAllEnabledPanels();

            if (enabledPanels.length === 0) {
                return `
                    <div class="grouped-tables">
                        <div class="no-panels-message">
                            
                            <h3>暂无启用的面板</h3>
                            <p>请在设置中启用至少一个面板</p>
                        </div>
                    </div>
                `;
            }

            // 动态生成所有面板的HTML
            const panelsHtml = enabledPanels.map(panel => this.createPanelGroup(panel)).join('');

            console.log(`[DataTable] ✅ 动态生成完成，共 ${enabledPanels.length} 个面板`);

            return `
                <div class="grouped-tables">
                    ${panelsHtml}
                </div>
            `;

        } catch (error) {
            console.error('[DataTable] ❌ 动态生成面板失败:', error);
            return `
                <div class="grouped-tables">
                    <div class="error-message">
                        
                        <h3>面板生成失败</h3>
                        <p>请检查面板配置或刷新页面重试</p>
                    </div>
                </div>
            `;
        }
    }

    /**
     * 获取所有启用的面板配置
     */
    getAllEnabledPanels() {
        try {
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};

            const enabledPanels = [];

            // 处理基础面板 - 修复：基础面板直接存储在configs根级别
            const basicPanelIds = ['personal', 'world', 'interaction', 'tasks', 'organization', 'news', 'inventory', 'abilities', 'plot', 'cultivation', 'fantasy', 'modern', 'historical', 'magic', 'training'];

            basicPanelIds.forEach(panelId => {
                if (configs[panelId]) {
                    const panel = configs[panelId];
                    const isEnabled = panel.enabled !== false; // 默认为true，除非明确设置为false

                    if (isEnabled) {
                        // 🔧 修复：同时处理基础设置复选框和面板管理自定义子项
                        const allSubItems = [];

                        // 1. 处理基础设置中的复选框配置（panel[key].enabled格式）
                        const subItemKeys = Object.keys(panel).filter(key => 
                            key !== 'enabled' && 
                            key !== 'subItems' && 
                            key !== 'description' && 
                            key !== 'icon' && 
                            key !== 'required' && 
                            key !== 'memoryInject' && 
                            key !== 'prompts' && 
                            typeof panel[key] === 'object' && 
                            panel[key].enabled !== undefined
                        );
                        const enabledSubItems = subItemKeys.filter(key => panel[key].enabled === true);

                        // 添加基础设置的子项
                        enabledSubItems.forEach(key => {
                            const displayName = this.getSubItemDisplayName(panelId, key);

                            // 🔧 检查是否在subItems中被禁用
                            let isDisabledInSubItems = false;
                            if (panel.subItems && Array.isArray(panel.subItems)) {
                                const subItem = panel.subItems.find(item =>
                                    item.name === displayName ||
                                    item.key === key ||
                                    item.key === displayName
                                );
                                if (subItem && subItem.enabled === false) {
                                    isDisabledInSubItems = true;
                                    console.log(`[DataTable] 🚫 基础字段 ${displayName} 在subItems中被禁用，跳过`);
                                }
                            }

                            // 只有在subItems中没有被禁用的字段才添加
                            if (!isDisabledInSubItems) {
                                allSubItems.push({
                                    name: displayName,
                                    key: key,
                                    enabled: true,
                                    value: panel[key].value || '',
                                    source: 'basicSettings' // 标记来源
                                });
                            }
                        });

                        // 2. 处理面板管理中的自定义子项（panel.subItems数组格式）
                        if (panel.subItems && Array.isArray(panel.subItems)) {
                            const enabledCustomSubItems = panel.subItems.filter(subItem => subItem.enabled !== false);
                            enabledCustomSubItems.forEach(subItem => {
                                const subItemKey = subItem.key || subItem.name.toLowerCase().replace(/\s+/g, '_');
                                
                                // 🔧 修复：检查是否已经存在相同的子项，避免重复添加
                                const existingItem = allSubItems.find(item => 
                                    item.key === subItemKey || 
                                    item.name === (subItem.displayName || subItem.name)
                                );
                                
                                if (!existingItem) {
                                    allSubItems.push({
                                        name: subItem.displayName || subItem.name,
                                        key: subItemKey,
                                        enabled: true,
                                        value: subItem.value || '',
                                        source: 'panelManagement' // 标记来源
                                    });
                                } else {
                                    console.log(`[DataTable] ⚠️ 跳过重复的子项: ${subItem.name} (已存在: ${existingItem.name})`);
                                }
                            });
                        }

                        if (allSubItems.length > 0) {
                            enabledPanels.push({
                                id: panelId,
                                key: panelId,
                                type: 'basic',
                                name: this.getBasicPanelDisplayName(panelId),
                                icon: this.getBasicPanelIcon(panelId),
                                subItems: allSubItems,
                                count: allSubItems.length
                            });

                            console.log(`[DataTable] 📊 基础面板 ${panelId}: ${allSubItems.length} 个子项 (基础设置: ${enabledSubItems.length}, 自定义: ${panel.subItems?.length || 0})`);
                        }
                    }
                }
            });

            // 处理自定义面板
            if (configs.customPanels) {
                Object.keys(configs.customPanels).forEach(panelId => {
                    const panel = configs.customPanels[panelId];
                    if (panel.enabled) {
                        const allSubItems = panel.subItems || [];
                        // 🔧 修复：只显示启用的子项，与基础面板逻辑保持一致
                        const enabledSubItems = allSubItems.filter(subItem => subItem.enabled !== false);
                        console.log(`[DataTable] 📊 自定义面板 ${panelId}: 所有子项 ${allSubItems.length}, 启用子项 ${enabledSubItems.length}`);
                        
                        if (enabledSubItems.length > 0) {
                            enabledPanels.push({
                                id: panelId,
                                type: 'custom',
                                name: panel.name || '未命名面板',
                                icon: '🔧',
                                subItems: enabledSubItems, // 🔧 修复：使用过滤后的启用子项
                                count: enabledSubItems.length // 🔧 修复：统计启用子项数量
                            });
                        }
                    }
                });
            }

            console.log(`[DataTable] 📋 找到 ${enabledPanels.length} 个启用的面板:`, enabledPanels.map(p => p.name));
            return enabledPanels;

        } catch (error) {
            console.error('[DataTable] ❌ 获取启用面板失败:', error);
            return [];
        }
    }

    /**
     * 获取基础面板显示名称
     */
    getBasicPanelDisplayName(panelId) {
        const nameMap = {
            'personal': '个人信息',
            'world': '世界信息',
            'interaction': '交互对象',
            'tasks': '任务系统',
            'organization': '组织架构',
            'news': '新闻资讯',
            'inventory': '物品清单',
            'abilities': '能力技能',
            'plot': '剧情发展',
            'cultivation': '修炼体系',
            'fantasy': '奇幻设定',
            'modern': '现代设定',
            'historical': '历史设定',
            'magic': '魔法系统',
            'training': '训练系统'
        };
        return nameMap[panelId] || panelId;
    }

    /**
     * 获取基础面板图标
     */
    getBasicPanelIcon(panelId) {
        const iconMap = {
            'personal': '👤',
            'world': '🌍',
            'interaction': '👥',
            'tasks': '📋',
            'organization': '🏢',
            'news': '📰',
            'inventory': '🎒',
            'abilities': '⚡',
            'plot': '📖',
            'cultivation': '🌱',
            'fantasy': '🧙',
            'modern': '🏙️',
            'historical': '🏛️',
            'magic': '✨',
            'training': '🎯'
        };
        return iconMap[panelId] || '📋';
    }
    /**
     * 获取子项显示名称 - 使用统一的完整映射表
     */
    getSubItemDisplayName(panelType, key) {
        try {
            // 🔧 修复：使用InfoBarSettings的完整映射表，确保所有字段都有正确的中文显示
            const infoBarTool = window.SillyTavernInfobar;
            const infoBarSettings = infoBarTool?.modules?.infoBarSettings || infoBarTool?.modules?.settings;
            if (infoBarSettings) {
                const completeMapping = infoBarSettings.getCompleteDisplayNameMapping();
                return completeMapping[panelType]?.[key] || key;
            }
            
            // 如果没有找到映射，返回原始键名
            return key;
            
        } catch (error) {
            console.warn('[DataTable] ⚠️ 获取子项显示名称失败:', error);
            return key;
        }
    }

    /**
     * 创建单个面板组
     */
    createPanelGroup(panel) {
        return `
            <div class="table-group" data-panel="${panel.id}">
                <div class="group-header">
                    <div class="group-title">

                        <span class="group-name">${panel.name}</span>
                        <span class="group-count">(${panel.count} 项)</span>
                    </div>
                    <div class="group-actions">
                        <button class="btn-group-action" data-action="move-panel-up" data-panel="${panel.id}" title="向上移动面板">
                            ⬆️
                        </button>
                        <button class="btn-group-action" data-action="move-panel-down" data-panel="${panel.id}" title="向下移动面板">
                            ⬇️
                        </button>
                        <button class="btn-group-action" data-action="expand-group" data-group="${panel.id}">
                            <span class="expand-icon">▼</span>
                        </button>
                        <button class="btn-group-action" data-action="edit-group" data-group="${panel.id}">
                            面板规则
                        </button>
                    </div>
                </div>
                <div class="group-content expanded">
                    ${this.createDynamicTable(panel)}
                </div>
            </div>
        `;
    }

    /**
     * 获取面板配置数据
     */
    getPanelConfig(panelId) {
        try {
            // 从 SillyTavern 扩展设置中获取配置
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};

            // 获取基础面板配置
            if (panelId === 'personal' || panelId === 'world' || panelId === 'interaction') {
                // 从基础面板配置中获取子项
                const basicPanels = configs.basicPanels || {};
                const panelConfig = basicPanels[panelId];

                if (panelConfig && panelConfig.subItems) {
                    const enabledItems = panelConfig.subItems.filter(item => item.enabled === true);
                    console.log(`[DataTable] 📋 ${panelId}面板启用的子项:`, enabledItems.length, '个');
                    return enabledItems;
                }
            }

            // 如果没有找到配置，返回默认配置
            return this.getDefaultPanelConfig(panelId);
        } catch (error) {
            console.error('[DataTable] ❌ 获取面板配置失败:', error);
            return this.getDefaultPanelConfig(panelId);
        }
    }

    /**
     * 获取默认面板配置
     */
    getDefaultPanelConfig(panelId) {
        const defaultConfigs = {
            personal: [
                { name: '姓名', key: 'name', value: '林天' },
                { name: '年龄', key: 'age', value: '25' },
                { name: '职业', key: 'job', value: '软件工程师' },
                { name: '性格', key: 'personality', value: '开朗、友善' },
                { name: '爱好', key: 'hobbies', value: '编程、阅读、音乐' },
                { name: '身高', key: 'height', value: '175cm' },
                { name: '体重', key: 'weight', value: '70kg' },
                { name: '血型', key: 'bloodType', value: 'O型' }
            ],
            world: [
                { name: '世界名称', key: 'worldName', value: '现代都市' },
                { name: '时代背景', key: 'era', value: '21世纪' },
                { name: '地理位置', key: 'location', value: '中国上海' },
                { name: '气候环境', key: 'climate', value: '亚热带季风气候' },
                { name: '科技水平', key: 'technology', value: '高度发达' },
                { name: '社会制度', key: 'society', value: '现代社会' },
                { name: '文化特色', key: 'culture', value: '中西融合' }
            ],
            interaction: [
                { name: 'NPC姓名', key: 'npc0.name', value: '小雨' },
                { name: 'NPC类型', key: 'npc0.type', value: '朋友' },
                { name: 'NPC状态', key: 'npc0.status', value: '开心' },
                { name: 'NPC关系', key: 'npc0.relationship', value: '好友' },
                { name: 'NPC心情', key: 'npc0.mood', value: '愉快' },
                { name: 'NPC位置', key: 'npc0.location', value: '咖啡厅' }
            ],
            organization: [
                { name: '组织名称', key: 'org0.组织名称', value: '天剑宗' },
                { name: '组织类型', key: 'org0.组织类型', value: '修仙门派' },
                { name: '组织等级', key: 'org0.组织等级', value: '一流门派' },
                { name: '掌门', key: 'org0.掌门', value: '剑无极' },
                { name: '成员数量', key: 'org0.成员数量', value: '3000人' },
                { name: '势力范围', key: 'org0.势力范围', value: '东域' }
            ]
        };

        return defaultConfigs[panelId] || [];
    }

    /**
     * 🔧 加载持久化的数据哈希值
     */
    loadPersistedDataHash() {
        try {
            const storageKey = 'infobar_data_table_hash';
            const persistedHash = localStorage.getItem(storageKey);
            if (persistedHash) {
                console.log('[DataTable] 📋 从持久化存储加载哈希值:', persistedHash);
                return persistedHash;
            }
            return null;
        } catch (error) {
            console.error('[DataTable] ❌ 加载持久化哈希值失败:', error);
            return null;
        }
    }

    /**
     * 🔧 保存数据哈希值到持久化存储
     */
    savePersistedDataHash(hash) {
        try {
            const storageKey = 'infobar_data_table_hash';
            localStorage.setItem(storageKey, hash);
            console.log('[DataTable] 💾 哈希值已保存到持久化存储:', hash);
        } catch (error) {
            console.error('[DataTable] ❌ 保存持久化哈希值失败:', error);
        }
    }

    /**
     * 🔧 计算数据哈希值 - 用于检测数据结构变化（修复版）
     */
    calculateDataHash(data) {
        try {
            // 🔧 修复：创建稳定的数据结构表示，排除动态内容
            const structure = data.map(item => {
                // 只包含影响表格结构的稳定字段
                const stableStructure = {
                    panel: item.panel,
                    field: item.field,
                    hasRowData: !!item.rowData
                };

                // 🔧 修复：只统计数据字段的数量和类型，不包含具体值
                if (item.rowData) {
                    const keys = Object.keys(item.rowData).sort();
                    // 过滤掉可能包含时间戳或随机ID的字段
                    const stableKeys = keys.filter(key => {
                        const value = item.rowData[key];
                        // 排除包含时间戳、UUID、随机数的字段
                        if (typeof value === 'string') {
                            return !value.match(/\d{4}-\d{2}-\d{2}|\d{13,}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
                        }
                        return true;
                    });

                    stableStructure.fieldCount = stableKeys.length;
                    stableStructure.fieldTypes = stableKeys.map(key => typeof item.rowData[key]).sort();
                } else {
                    stableStructure.fieldCount = 0;
                    stableStructure.fieldTypes = [];
                }

                return stableStructure;
            });

            // 🔧 修复：生成稳定的哈希值
            const structureString = JSON.stringify(structure);
            let hash = 0;
            for (let i = 0; i < structureString.length; i++) {
                const char = structureString.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // 转换为32位整数
            }

            const finalHash = Math.abs(hash).toString();
            console.log('[DataTable] 🔍 稳定哈希计算完成:', finalHash);
            return finalHash;
        } catch (error) {
            console.error('[DataTable] ❌ 计算数据哈希失败:', error);
            return 'fallback_hash'; // 使用固定的降级方案
        }
    }

    /**
     * 🔧 缓存单元格位置信息
     */
    cacheCellPositions(panelId, fieldMapping) {
        try {
            const cacheKey = `${panelId}_positions`;
            this.tableState.cellPositions.set(cacheKey, {
                panelId: panelId,
                fieldMapping: { ...fieldMapping },
                timestamp: Date.now()
            });

            console.log(`[DataTable] 💾 缓存面板 ${panelId} 的单元格位置`);
        } catch (error) {
            console.error('[DataTable] ❌ 缓存单元格位置失败:', error);
        }
    }

    /**
     * 🔧 获取缓存的单元格位置
     */
    getCachedCellPositions(panelId) {
        try {
            const cacheKey = `${panelId}_positions`;
            const cached = this.tableState.cellPositions.get(cacheKey);

            if (cached && cached.fieldMapping) {
                console.log(`[DataTable] 📋 使用缓存的面板 ${panelId} 单元格位置`);
                return cached.fieldMapping;
            }

            return null;
        } catch (error) {
            console.error('[DataTable] ❌ 获取缓存单元格位置失败:', error);
            return null;
        }
    }

    /**
     * 🔧 统一字段映射管理器 - 解决数据填充错位问题
     */
    getFieldMapping(panelId) {
        // 🔧 修复：只保留真正的基础字段静态映射，移除所有用户自定义字段
        const staticMappings = {
            'personal': {
                // 🔧 基于getDefaultPanelConfig的真实基础字段
                '姓名': 'col_1',
                '年龄': 'col_2', 
                '职业': 'col_3',
                '性格': 'col_4',
                '爱好': 'col_5',
                '身高': 'col_6',
                '体重': 'col_7',
                '血型': 'col_8'
                // 🔧 移除了所有非基础字段：衣服、附近银行、交互、附近的人、新建子项2等
            },
            'world': {
                // 🔧 基于getDefaultPanelConfig的真实基础字段
                '世界名称': 'col_1',
                '时代背景': 'col_2',
                '地理位置': 'col_3',
                '气候环境': 'col_4',
                '科技水平': 'col_5',
                '社会制度': 'col_6',
                '文化特色': 'col_7'
                // 🔧 移除了硬编码的世界类型、世界风格等非基础字段
            },
            'interaction': {
                // 🔧 基于getDefaultPanelConfig的真实基础字段（只有6个基础字段）
                'NPC姓名': 'col_1',
                'NPC类型': 'col_2', 
                'NPC状态': 'col_3',
                'NPC关系': 'col_4',
                'NPC心情': 'col_5',
                'NPC位置': 'col_6',
                // 🔧 用户界面字段名与基础字段的对应关系
                '对象名称': 'col_1',  // 对应 NPC姓名
                '对象类型': 'col_2',  // 对应 NPC类型
                '当前状态': 'col_3',  // 对应 NPC状态
                '关系类型': 'col_4',  // 对应 NPC关系
                '亲密度': 'col_5',    // 对应 NPC心情
                '历史记录': 'col_6'   // 对应 NPC位置
                // 🔧 '自动记录'字段应该通过动态映射分配到col_7，而不是硬编码
                // 🔧 移除了所有非基础字段：新建子项、衣服、附近银行等
            },
            'organization': {
                // 🔧 基于getDefaultPanelConfig的真实基础字段
                '组织名称': 'col_1',
                '组织类型': 'col_2',
                '组织等级': 'col_3',
                '掌门': 'col_4',
                '成员数量': 'col_5',
                '势力范围': 'col_6'
                // 🔧 移除了所有非基础字段：层级结构、职位设置、成员管理、新增字段等
            }
            // 🔧 重要修复：移除所有其他面板的硬编码映射！
            // tasks, news, inventory, abilities, plot, cultivation, fantasy, 
            // modern, historical, magic, training 等面板的字段应该完全依赖动态映射
            // 
            // 🚨 完全移除非基础面板：info面板是用户自定义的，不应该硬编码！
        };

        // 获取基础静态映射
        const baseMapping = staticMappings[panelId] || {};

        // 🔧 关键修复：动态生成完整映射（使用getAllEnabledPanels的正确数据结构）
        try {
            // 🔧 修复：使用getAllEnabledPanels()获取正确的面板配置，而不是直接从configs获取
            const enabledPanels = this.getAllEnabledPanels();
            const panelConfig = enabledPanels.find(panel => panel.key === panelId || panel.id === panelId);

            if (panelConfig && panelConfig.subItems && Array.isArray(panelConfig.subItems)) {
                console.log(`[DataTable] 🔧 开始为面板 ${panelId} 生成动态字段映射，共${panelConfig.subItems.length}个字段`);
                
                // 🔧 重要修复：创建完全基于用户界面配置顺序的映射
                const dynamicMapping = {};

                // 🔧 修复：按照用户界面subItems的实际顺序分配列号
                panelConfig.subItems.forEach((subItem, index) => {
                    if (subItem.enabled !== false) { // 只包含启用的字段
                        const fieldName = subItem.name || subItem.displayName;
                        const fieldKey = subItem.key || fieldName;
                        const colIndex = index + 1; // 🔧 关键修复：直接使用index+1

                        // 添加字段名映射
                        dynamicMapping[fieldName] = `col_${colIndex}`;

                        // 同时添加字段键的映射（如果不同）
                        if (fieldKey !== fieldName) {
                            dynamicMapping[fieldKey] = `col_${colIndex}`;
                        }

                        console.log(`[DataTable] 🔧 动态映射: ${fieldName} (key:${fieldKey}) -> col_${colIndex} (用户界面第${index + 1}个字段)`);
                    }
                });

                // 🔧 补充静态映射中未覆盖的字段（用于向后兼容）
                Object.keys(baseMapping).forEach(staticField => {
                    if (!dynamicMapping[staticField]) {
                        dynamicMapping[staticField] = baseMapping[staticField];
                        console.log(`[DataTable] 🔧 补充静态映射: ${staticField} -> ${baseMapping[staticField]} (向后兼容)`);
                    }
                });

                console.log(`[DataTable] ✅ 面板 ${panelId} 最终字段映射:`, dynamicMapping);
                return dynamicMapping;
            } else {
                console.log(`[DataTable] ⚠️ 面板 ${panelId} 无subItems配置，使用静态映射`);
            }
        } catch (error) {
            console.warn('[DataTable] ⚠️ 生成动态字段映射失败，使用静态映射:', error.message);
        }

        return baseMapping;
    }
    /**
     * 创建动态表格 - 支持所有类型的面板
     */
    createDynamicTable(panel) {
        try {
            // 🔧 统一多行数据处理：检查是否有多行数据，如果有则使用多行处理逻辑
            if (this.data && this.data.length > 0) {
                const panelDataItems = this.data.filter(item => item.panel === panel.key || item.panel === panel.id);
                if (panelDataItems.length > 1) {
                    console.log(`[DataTable] 📊 检测到面板 ${panel.key} 有多行数据 (${panelDataItems.length}行)，使用多行处理逻辑`);
                    return this.createMultiRowDynamicTable(panel, panelDataItems);
                } else if (panelDataItems.length === 1) {
                    console.log(`[DataTable] 📋 面板 ${panel.key} 有单行数据，使用单行处理逻辑`);
                } else {
                    console.log(`[DataTable] 📭 面板 ${panel.key} 无数据，使用默认处理逻辑`);
                }
            }

            // 🔧 智能计算自适应列宽
            const columnAnalysis = this.calculateAdaptiveColumnWidths(panel);

            // 🔧 修复：生成表头时使用中文显示名称
            const headers = columnAnalysis.map((analysis, index) => {
                const { item, adaptiveWidth } = analysis;
                // 获取字段的中文显示名称
                const displayName = this.getFieldDisplayName(item.name, panel.key) || item.name;
                console.log(`[DataTable] 🔍 字段映射: ${item.name} -> ${displayName} (面板: ${panel.key})`);

                return `<th class="col-property"
                    data-column-index="${index}"
                    data-property="${item.name}"
                    style="
                    width: ${adaptiveWidth}px;
                    min-width: ${Math.max(adaptiveWidth, 80)}px;
                    padding: 8px;
                    text-align: center;
                    white-space: nowrap;
                    overflow: visible;
                    word-wrap: break-word;
                ">${displayName}</th>`;
            }).join('');

            // 生成数据行 - 根据面板类型获取对应的数据值
            const dataRow = panel.subItems.map((item, index) => {
                const value = this.getPanelItemValue(panel, item);
                const formattedValue = this.formatCellValue(value);
                const { adaptiveWidth } = columnAnalysis[index];

                // 🔧 为单元格生成唯一标识
                const cellId = `${panel.key}_0_${index}_${item.name}`;

                return `<td class="cell-value"
                    data-property="${item.name}"
                    data-cell-id="${cellId}"
                    data-panel-id="${panel.key}"
                    data-row-index="0"
                    data-col-index="${index}"
                    title="${this.escapeHtml(value)}"
                    style="
                        padding: 8px;
                        vertical-align: top;
                        word-wrap: break-word;
                        width: ${adaptiveWidth}px;
                        min-width: ${Math.max(adaptiveWidth, 80)}px;
                        overflow: visible;
                    ">${formattedValue}</td>`;
            }).join('');

            return `
                <div class="data-table-container" style="
                    overflow-x: auto;
                    width: 100%;
                    max-width: 100%;
                    position: relative;
                ">
                    <table class="data-table dark-table horizontal-layout" style="
                        table-layout: fixed;
                        width: max-content;
                        min-width: 100%;
                        border-collapse: collapse;
                    ">
                        <thead>
                            <tr>
                                ${headers}
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="data-row">
                                ${dataRow}
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;

        } catch (error) {
            console.error(`[DataTable] ❌ 创建动态表格失败 (${panel.name}):`, error);
            return `
                <div class="data-table-container">
                    <div class="table-error">

                        <p>表格生成失败: ${panel.name}</p>
                    </div>
                </div>
            `;
        }
    }

    /**
     * 🆕 创建多行动态表格 - 支持所有面板的多行数据显示
     */
    createMultiRowDynamicTable(panel, panelDataItems) {
        try {
            console.log(`[DataTable] 🔧 创建多行动态表格: ${panel.name} (${panelDataItems.length}行)`);

            // 🔧 智能计算自适应列宽
            const columnAnalysis = this.calculateAdaptiveColumnWidths(panel);

            // 🔧 检查是否需要添加特殊的标识列
            let specialColumnHeader = '';
            let hasSpecialColumn = false;

            if (panel.key === 'interaction') {
                // 交互对象面板添加NPC名称列
                specialColumnHeader = `<th class="col-property" style="
                    width: 120px;
                    min-width: 100px;
                    padding: 8px;
                    text-align: center;
                    white-space: nowrap;
                    overflow: visible;
                    word-wrap: break-word;
                ">NPC名称</th>`;
                hasSpecialColumn = true;
            } else if (panel.key === 'organization') {
                // 组织架构面板添加组织名称列
                specialColumnHeader = `<th class="col-org-name" style="
                    width: 120px;
                    min-width: 120px;
                    max-width: 200px;
                    padding: 8px;
                    text-align: center;
                    font-weight: bold;
                    border-right: 1px solid var(--theme-border-color, #dee2e6);
                ">组织名称</th>`;
                hasSpecialColumn = true;
            }

            // 🔧 生成表头时使用中文显示名称
            const dataHeaders = columnAnalysis.map((analysis, index) => {
                const { item, adaptiveWidth } = analysis;
                // 获取字段的中文显示名称
                const displayName = this.getFieldDisplayName(item.name, panel.key) || item.name;

                const columnIndex = hasSpecialColumn ? index + 1 : index;
                return `<th class="col-property"
                    data-column-index="${columnIndex}"
                    data-property="${item.name}"
                    style="
                    width: ${adaptiveWidth}px;
                    min-width: ${Math.max(adaptiveWidth, 80)}px;
                    padding: 8px;
                    text-align: center;
                    white-space: nowrap;
                    overflow: visible;
                    word-wrap: break-word;
                ">${displayName}</th>`;
            }).join('');

            const headers = specialColumnHeader + dataHeaders;

            // 🔧 为每个数据项生成数据行
            const dataRows = panelDataItems.map((dataItem, rowIndex) => {
                // 🔧 生成特殊列的单元格（如果需要）
                let specialCell = '';
                if (hasSpecialColumn) {
                    let specialValue = '';
                    if (panel.key === 'interaction') {
                        // 获取NPC名称（从第一列数据）
                        specialValue = dataItem.rowData?.col_1 || `NPC ${rowIndex + 1}`;
                    } else if (panel.key === 'organization') {
                        // 获取组织名称（从第一列数据）
                        specialValue = dataItem.rowData?.col_1 || `组织 ${rowIndex + 1}`;
                    }

                    const formattedSpecialValue = this.formatCellValue(specialValue);
                    const specialCellId = `${panel.key}_${rowIndex}_special_name`;

                    specialCell = `<td class="cell-value special-name-cell"
                        data-property="name"
                        data-cell-id="${specialCellId}"
                        data-panel-id="${panel.key}"
                        data-row-index="${rowIndex}"
                        data-col-index="0"
                        title="${this.escapeHtml(specialValue)}"
                        style="
                            padding: 8px;
                            vertical-align: top;
                            word-wrap: break-word;
                            width: 120px;
                            min-width: 100px;
                            font-weight: bold;
                            ${panel.key === 'organization' ? 'border-right: 1px solid var(--theme-border-color, #dee2e6);' : ''}
                        ">${formattedSpecialValue}</td>`;
                }

                // 生成该行的所有数据单元格
                const dataCells = panel.subItems.map((item, colIndex) => {
                    // 从数据项中获取对应字段的值
                    let value = '';
                    if (dataItem.rowData) {
                        // 🔧 修复：增强字段名匹配，支持旧架构字段名
                        const possibleFieldNames = [
                            item.name,
                            item.key,
                            `col_${colIndex + 1}`,
                            `_${item.name.match(/_(\d+)$/)?.[1] || ''}`,
                            // 🆕 添加旧架构字段名映射
                            this.mapDisplayNameToLegacyField(item.name, panel.key),
                            this.mapDisplayNameToLegacyField(item.key, panel.key)
                        ].filter(name => name && name !== item.name && name !== item.key); // 去重

                        // 先尝试原始字段名
                        for (const fieldName of [item.name, item.key]) {
                            if (fieldName && dataItem.rowData[fieldName] !== undefined) {
                                value = dataItem.rowData[fieldName];
                                break;
                            }
                        }

                        // 如果没找到，尝试其他可能的字段名
                        if (value === '' || value === undefined) {
                            for (const fieldName of possibleFieldNames) {
                                if (fieldName && dataItem.rowData[fieldName] !== undefined) {
                                    value = dataItem.rowData[fieldName];
                                    break;
                                }
                            }
                        }
                    }

                    const formattedValue = this.formatCellValue(value);
                    const { adaptiveWidth } = columnAnalysis[colIndex];

                    // 🔧 为单元格生成唯一标识
                    const actualColIndex = hasSpecialColumn ? colIndex + 1 : colIndex;
                    const cellId = `${panel.key}_${rowIndex}_${actualColIndex}_${item.name}`;

                    return `<td class="cell-value"
                        data-property="${item.name}"
                        data-cell-id="${cellId}"
                        data-panel-id="${panel.key}"
                        data-row-index="${rowIndex}"
                        data-col-index="${actualColIndex}"
                        title="${this.escapeHtml(value)}"
                        style="
                            padding: 8px;
                            vertical-align: top;
                            word-wrap: break-word;
                            width: ${adaptiveWidth}px;
                            min-width: ${Math.max(adaptiveWidth, 80)}px;
                            overflow: visible;
                            ${panel.key === 'organization' ? 'border-right: 1px solid var(--theme-border-color, #dee2e6);' : ''}
                        ">${formattedValue}</td>`;
                }).join('');

                const allCells = specialCell + dataCells;
                return `<tr class="data-row" data-row-index="${rowIndex}">${allCells}</tr>`;
            }).join('');

            return `
                <div class="data-table-container" style="
                    overflow-x: auto;
                    width: 100%;
                    max-width: 100%;
                    position: relative;
                ">
                    <table class="data-table dark-table horizontal-layout" style="
                        table-layout: fixed;
                        width: max-content;
                        min-width: 100%;
                        border-collapse: collapse;
                    ">
                        <thead>
                            <tr>
                                ${headers}
                            </tr>
                        </thead>
                        <tbody>
                            ${dataRows}
                        </tbody>
                    </table>
                </div>
            `;

        } catch (error) {
            console.error(`[DataTable] ❌ 创建多行动态表格失败 (${panel.name}):`, error);
            return this.createEmptyTable(panel);
        }
    }

    /**
     * 创建交互对象表格 - 支持多NPC数据（所有NPC同时显示）
     */
    createInteractionTable(panel) {
        try {
            // 🔧 修复：直接从数据表格的数据中获取交互对象数据
            if (!this.data || this.data.length === 0) {
                return this.createEmptyTable(panel);
            }

            // 获取交互对象面板的数据项
            const interactionDataItems = this.data.filter(item => item.panel === 'interaction');

            console.log('[DataTable] 🔍 交互对象数据项:', interactionDataItems.length);

            if (interactionDataItems.length === 0) {
                return this.createEmptyTable(panel);
            }

            // 🔧 智能计算自适应列宽（包含NPC名称列）
            const columnAnalysis = this.calculateAdaptiveColumnWidths(panel);

            // 生成表头（添加NPC名称列）
            const headers = `
                <th class="col-property" style="
                    width: 120px;
                    min-width: 100px;
                    padding: 8px;
                    text-align: center;
                    white-space: nowrap;
                    overflow: visible;
                    word-wrap: break-word;
                ">NPC名称</th>
                ${columnAnalysis.map((analysis, index) => {
                    const { item, adaptiveWidth } = analysis;
                    // 获取字段的中文显示名称
                    const displayName = this.getFieldDisplayName(item.name, 'interaction') || item.name;
                    return `<th class="col-property"
                        data-column-index="${index + 1}"
                        data-property="${item.name}"
                        style="
                        width: ${adaptiveWidth}px;
                        min-width: ${Math.max(adaptiveWidth, 80)}px;
                        padding: 8px;
                        text-align: center;
                        white-space: nowrap;
                        overflow: visible;
                        word-wrap: break-word;
                    ">${displayName}</th>`;
                }).join('')}
            `;

            // 🔧 修复：为每个交互对象数据项生成数据行
            const npcDataRows = interactionDataItems.map((dataItem, index) => {
                // 获取NPC名称（从第一列数据）
                const npcName = dataItem.rowData?.col_1 || `NPC ${index + 1}`;

                // 🔧 使用统一的字段映射管理器
                const fieldMapping = this.getFieldMapping('interaction');

                // 生成数据行
                const dataRow = panel.subItems.map((item, itemIndex) => {
                    // 🔧 修复：增强字段匹配，支持旧架构字段名
                    let value = '-';
                    let colKey = `col_${itemIndex + 1}`;

                    const possibleFieldNames = [
                        item.name,
                        item.key,
                        fieldMapping[item.name],
                        `col_${itemIndex + 1}`,
                        this.mapDisplayNameToLegacyField(item.name, 'interaction')
                    ].filter(name => name);

                    for (const fieldName of possibleFieldNames) {
                        if (dataItem.rowData?.[fieldName] !== undefined) {
                            value = dataItem.rowData[fieldName];
                            colKey = fieldName;
                            break;
                        }
                    }

                    const formattedValue = this.formatCellValue(value);
                    const { adaptiveWidth } = columnAnalysis[itemIndex];

                    console.log(`[DataTable] 🔍 交互对象字段映射: ${item.name} -> ${colKey} = "${value}"`);

                    // 🔧 为交互对象单元格生成唯一标识
                    const cellId = `interaction_${index}_${itemIndex}_${item.name}`;

                    return `<td class="cell-value"
                        data-property="${item.name}"
                        data-cell-id="${cellId}"
                        data-panel-id="interaction"
                        data-row-index="${index}"
                        data-col-index="${itemIndex}"
                        title="${this.escapeHtml(value)}"
                        style="
                            padding: 8px;
                            vertical-align: top;
                            word-wrap: break-word;
                            width: ${adaptiveWidth}px;
                            min-width: ${Math.max(adaptiveWidth, 80)}px;
                            overflow: visible;
                        ">${formattedValue}</td>`;
                }).join('');

                // 🔧 为NPC名称单元格生成唯一标识
                const npcCellId = `interaction_${index}_0_NPC名称`;

                return `
                    <tr class="data-row npc-data-row" data-npc-id="npc${index}">
                        <td class="cell-value npc-name-cell"
                            data-property="NPC名称"
                            data-cell-id="${npcCellId}"
                            data-panel-id="interaction"
                            data-row-index="${index}"
                            data-col-index="0"
                            style="
                                padding: 8px;
                                vertical-align: top;
                                word-wrap: break-word;
                                width: 120px;
                                min-width: 100px;
                                overflow: visible;
                            ">${this.escapeHtml(npcName)}</td>
                        ${dataRow}
                    </tr>
                `;
            }).join('');

            return `
                <div class="data-table-container" style="
                    overflow-x: auto;
                    width: 100%;
                    max-width: 100%;
                    position: relative;
                ">
                    <table class="data-table dark-table horizontal-layout" style="
                        table-layout: fixed;
                        width: max-content;
                        min-width: 100%;
                        border-collapse: collapse;
                    ">
                        <thead>
                            <tr>
                                ${headers}
                            </tr>
                        </thead>
                        <tbody>
                            ${npcDataRows}
                        </tbody>
                    </table>
                </div>
            `;

        } catch (error) {
            console.error('[DataTable] ❌ 创建交互表格失败:', error);
            return this.createEmptyTable(panel);
        }
    }
    /**
     * 获取面板子项的数据值
     */
    getPanelItemValue(panel, item) {
        try {
            // 🔧 检查字段是否被禁用
            if (item.enabled === false) {
                console.log(`[DataTable] 🚫 字段 ${item.name} 已被禁用，跳过数据获取`);
                return '';
            }
            // 🔧 修复：直接从数据表格的数据中获取对应的字段值
            if (this.data && this.data.length > 0) {
                // 查找对应面板的数据项
                const panelDataItems = this.data.filter(dataItem => dataItem.panel === panel.id);

                if (panelDataItems.length > 0) {
                    // 对于交互对象面板，返回第一个NPC的对应字段值
                    if (panel.id === 'interaction') {
                        const firstNpcData = panelDataItems[0];
                        if (firstNpcData && firstNpcData.rowData) {
                            // 🔧 使用统一的字段映射管理器
                            const fieldMapping = this.getFieldMapping('interaction');

                            // 🔧 修复：正确的字段映射逻辑，避免错误降级到col_1
                            let colKey = fieldMapping[item.name];

                            if (!colKey) {
                                // 如果没有找到映射，尝试其他可能的字段名
                                const possibleNames = [item.key, item.id, item.fieldName];
                                for (const name of possibleNames) {
                                    if (name && fieldMapping[name]) {
                                        colKey = fieldMapping[name];
                                        break;
                                    }
                                }
                            }

                            if (!colKey) {
                                // 最后降级方案：使用实际的列索引而不是固定的1
                                const itemIndex = panel.subItems.findIndex(subItem => subItem.name === item.name);
                                colKey = `col_${itemIndex + 1}`;
                                console.warn(`[DataTable] ⚠️ 交互对象字段 ${item.name} 未找到映射，使用列索引: ${colKey}`);
                            }

                            // 🔧 修复：支持纯数字字段名，如果col_X格式找不到，尝试纯数字格式
                            let value = firstNpcData.rowData[colKey];

                            // 如果col_X格式找不到数据，尝试纯数字格式
                            if ((value === undefined || value === null) && colKey.startsWith('col_')) {
                                const numericKey = colKey.replace('col_', '');
                                value = firstNpcData.rowData[numericKey];
                                console.log(`[DataTable] 🔧 交互对象col_X格式未找到，尝试数字格式: ${colKey} -> ${numericKey} = "${value}"`);
                            }

                            if (value !== undefined && value !== null) {
                                console.log(`[DataTable] 🔍 交互对象字段值: ${item.name} -> ${colKey} = "${value}"`);
                                return this.formatFieldValue(value);
                            }
                        }
                    }
                    // 对于其他面板（个人信息、世界信息等）
                    else {
                        const panelData = panelDataItems[0];
                        if (panelData && panelData.rowData) {
                            // 🔧 使用统一的字段映射管理器
                            const fieldMapping = this.getFieldMapping(panel.id);

                            // 🔧 修复：正确的字段映射逻辑，避免错误降级到col_1
                            let colKey = fieldMapping[item.name];

                            if (!colKey) {
                                // 如果没有找到映射，尝试其他可能的字段名
                                const possibleNames = [item.key, item.id, item.fieldName];
                                for (const name of possibleNames) {
                                    if (name && fieldMapping[name]) {
                                        colKey = fieldMapping[name];
                                        break;
                                    }
                                }
                            }

                            if (!colKey) {
                                // 最后降级方案：使用实际的列索引而不是固定的1
                                const itemIndex = panel.subItems.findIndex(subItem => subItem.name === item.name);
                                colKey = `col_${itemIndex + 1}`;
                                console.warn(`[DataTable] ⚠️ ${panel.id}字段 ${item.name} 未找到映射，使用列索引: ${colKey}`);
                            }

                            // 🔧 修复：支持纯数字字段名，如果col_X格式找不到，尝试纯数字格式
                            let value = panelData.rowData[colKey];

                            // 如果col_X格式找不到数据，尝试纯数字格式
                            if ((value === undefined || value === null) && colKey.startsWith('col_')) {
                                const numericKey = colKey.replace('col_', '');
                                value = panelData.rowData[numericKey];
                                console.log(`[DataTable] 🔧 col_X格式未找到，尝试数字格式: ${colKey} -> ${numericKey} = "${value}"`);
                            }

                            if (value !== undefined && value !== null) {
                                console.log(`[DataTable] 🔍 ${panel.id}字段值: ${item.name} -> ${colKey} = "${value}"`);
                                return this.formatFieldValue(value);
                            }
                        }
                    }
                }
            }

            // 🔧 备用方案：从数据核心获取实际的面板数据
            const currentChatId = this.dataCore.getCurrentChatId();
            if (!currentChatId) {
                // 无聊天ID时，静默返回默认值，不输出警告
                return item.value || '';
            }

            // 获取聊天数据 - 注意这是同步方法，不是异步的
            const chatDataPromise = this.dataCore.getChatData(currentChatId);

            // 如果返回的是Promise，说明方法是异步的，我们需要使用缓存的数据
            if (chatDataPromise && typeof chatDataPromise.then === 'function') {
                // 尝试从缓存获取数据（chatDataCache是Map对象）
                const cachedData = this.dataCore.chatDataCache?.get(currentChatId);
                if (cachedData && cachedData.infobar_data && cachedData.infobar_data.panels) {
                    // 对于自定义面板，需要特殊处理面板ID映射
                    let panelData = null;

                    if (panel.type === 'custom') {
                        // 尝试多种面板标识符查找数据
                        const possiblePanelIds = [
                            panel.key,           // 新的键名格式 (Custom, Custom1, Custom2)
                            panel.id,            // 原始ID格式 (custom_1753766001805)
                            panel.name           // 面板名称
                        ].filter(id => id);

                        for (const panelId of possiblePanelIds) {
                            if (cachedData.infobar_data.panels[panelId]) {
                                panelData = cachedData.infobar_data.panels[panelId];
                                console.log(`[DataTable] 🔍 找到自定义面板数据: ${panelId}`);
                                break;
                            }
                        }
                    } else {
                        // 基础面板直接使用ID
                        panelData = cachedData.infobar_data.panels[panel.id];
                    }

                    if (panelData) {
                        // 增强字段值查找逻辑，支持多种字段名格式
                        const fieldValue = this.findFieldValue(panelData, item);
                        if (fieldValue !== undefined && fieldValue !== null) {
                            console.log(`[DataTable] 🔍 找到字段值: ${panel.id}.${item.key || item.name} = "${fieldValue}"`);
                            return this.formatFieldValue(fieldValue);
                        }
                    }
                }
                // 数据尚未加载时，静默返回默认值，减少日志噪音
                return item.value || '';
            }

            // 如果是同步数据
            const chatData = chatDataPromise;
            const panels = this.extractPanelsFromChatData(chatData);

            if (!panels) {
                console.warn('[DataTable] ⚠️ 无法获取面板数据');
                return item.value || '';
            }

            // 获取对应面板的数据（同样需要处理自定义面板的ID映射）
            let panelData = null;

            if (panel.type === 'custom') {
                // 尝试多种面板标识符查找数据
                const possiblePanelIds = [
                    panel.key,           // 新的键名格式 (Custom, Custom1, Custom2)
                    panel.id,            // 原始ID格式 (custom_1753766001805)
                    panel.name           // 面板名称
                ].filter(id => id);

                for (const panelId of possiblePanelIds) {
                    if (panels[panelId]) {
                        panelData = panels[panelId];
                        console.log(`[DataTable] 🔍 找到自定义面板数据: ${panelId}`);
                        break;
                    }
                }
            } else {
                // 基础面板直接使用ID
                panelData = panels[panel.id];
            }

            if (!panelData) {
                console.warn(`[DataTable] ⚠️ 面板 ${panel.id} 无数据`);
                return item.value || '';
            }

            // 增强字段值查找逻辑，支持多种字段名格式
            const fieldValue = this.findFieldValue(panelData, item);

            if (fieldValue !== undefined && fieldValue !== null) {
                console.log(`[DataTable] 🔍 找到字段值: ${panel.id}.${item.key || item.name} = "${fieldValue}"`);
                // 🔧 修复：正确处理对象类型的字段值，避免显示[object Object]
                return this.formatFieldValue(fieldValue);
            }

            // 如果没有找到数据，返回默认值
            console.warn(`[DataTable] ⚠️ 未找到字段值: ${panel.id}.${item.key || item.name}，使用默认值`);
            return item.value || item.defaultValue || '';

        } catch (error) {
            console.error(`[DataTable] ❌ 获取面板项值失败 (${panel.name} - ${item.name}):`, error);
            return item.value || '';
        }
    }

    /**
     * 🔧 新增：格式化字段值，正确处理对象类型
     */
    formatFieldValue(value) {
        try {
            // 处理null和undefined
            if (value === null || value === undefined) {
                return '';
            }

            // 处理数组类型
            if (Array.isArray(value)) {
                if (value.length === 0) {
                    return '';
                }
                // 如果数组元素都是简单类型，用逗号分隔
                if (value.every(item => typeof item !== 'object' || item === null)) {
                    return value.filter(item => item !== null && item !== undefined).join(', ');
                }
                // 如果数组包含对象，格式化为JSON
                return JSON.stringify(value, null, 2);
            }

            // 处理对象类型
            if (typeof value === 'object') {
                // 🔧 修复：对于对象类型，格式化为可读的JSON字符串
                try {
                    // 检查是否是简单的键值对对象
                    const keys = Object.keys(value);
                    if (keys.length <= 3) {
                        // 简单对象，格式化为 key: value 形式
                        return keys.map(key => `${key}: ${value[key]}`).join(', ');
                    } else {
                        // 复杂对象，格式化为JSON
                        return JSON.stringify(value, null, 2);
                    }
                } catch (e) {
                    console.warn('[DataTable] 对象格式化失败，使用toString:', e);
                    return String(value);
                }
            }

            // 处理字符串类型
            if (typeof value === 'string') {
                return value;
            }

            // 处理其他基本类型
            return String(value);

        } catch (error) {
            console.error('[DataTable] ❌ 格式化字段值失败:', error);
            return String(value);
        }
    }

    /**
     * 获取字段在面板配置中的索引位置
     */
    getFieldIndexInPanel(item, panelData) {
        try {
            // 如果item有明确的索引信息，直接使用
            if (item.index !== undefined) {
                return item.index;
            }

            // 如果item有columnIndex信息，使用它
            if (item.columnIndex !== undefined) {
                return item.columnIndex;
            }

            // 尝试从字段名中提取索引
            if (item.key && typeof item.key === 'string') {
                // 检查是否是col_X格式
                const colMatch = item.key.match(/^col_(\d+)$/);
                if (colMatch) {
                    return parseInt(colMatch[1]) - 1; // col_1对应索引0
                }

                // 检查是否是数字格式
                const numMatch = item.key.match(/^\d+$/);
                if (numMatch) {
                    return parseInt(item.key) - 1; // 1对应索引0
                }
            }

            // 尝试从name中提取索引
            if (item.name && typeof item.name === 'string') {
                const numMatch = item.name.match(/(\d+)/);
                if (numMatch) {
                    return parseInt(numMatch[1]) - 1;
                }
            }

            // 如果都没有，返回-1表示无法确定索引
            return -1;

        } catch (error) {
            console.error('[DataTable] ❌ 获取字段索引失败:', error);
            return -1;
        }
    }

    /**
     * 增强字段值查找逻辑，支持多种字段名格式
     */
    findFieldValue(panelData, item) {
        try {
            // 🔧 修复：添加英文到中文的字段映射
            const fieldMapping = {
                // 个人信息字段映射
                'name': '姓名',
                'age': '年龄',
                'gender': '性别',
                'occupation': '职业',
                'height': '身高',
                'weight': '体重',
                'bloodType': '血型',
                'zodiac': '星座',
                'birthday': '生日',
                'birthplace': '出生地',
                'nationality': '国籍',
                'ethnicity': '民族',
                'hairColor': '发色',
                'hairStyle': '发型',
                'eyeColor': '眼色',
                'skinColor': '肤色',
                'appearance': '外貌',
                'personality': '性格',
                'hobbies': '爱好',

                // 世界信息字段映射
                'time': '时间',
                'weather': '天气',
                'location': '位置',
                'geography': '地理环境',
                'locations': '重要地点',

                // 交互对象字段映射
                'status': '状态',
                'mood': '心情',
                'activity': '活动',
                'relationship': '关系',
                'intimacy': '亲密度',
                'trust': '信任度',
                'history': '历史记录',

                // 其他常用字段映射
                'class': '职业',
                'level': '等级',
                'health': '生命值',
                'maxHealth': '最大生命值',
                'energy': '能量',
                'maxEnergy': '最大能量',
                'gold': '金币',
                'currentLocation': '当前位置'
            };

            // 构建可能的字段名列表
            const possibleFieldNames = [
                item.key,           // 原始key
                item.name,          // 显示名称
                item.id,            // ID
                item.fieldName,     // 字段名
                item.originalKey    // 原始键名
            ].filter(name => name); // 过滤掉空值

            // 🔧 修复：添加中文映射字段名
            possibleFieldNames.forEach(fieldName => {
                if (fieldMapping[fieldName]) {
                    possibleFieldNames.push(fieldMapping[fieldName]);
                }
            });

            // 🔧 新增：添加对col_X格式字段的支持
            // 检查是否有col_X格式的字段，如果有，根据字段顺序映射
            const availableKeys = Object.keys(panelData);
            const colKeys = availableKeys.filter(key => key.startsWith('col_')).sort((a, b) => {
                const numA = parseInt(a.replace('col_', ''));
                const numB = parseInt(b.replace('col_', ''));
                return numA - numB;
            });

            if (colKeys.length > 0) {
                // 如果数据使用col_X格式，尝试根据字段顺序映射
                // 获取当前字段在面板配置中的索引
                const fieldIndex = this.getFieldIndexInPanel(item, panelData);
                if (fieldIndex >= 0 && fieldIndex < colKeys.length) {
                    const mappedColKey = colKeys[fieldIndex];
                    possibleFieldNames.push(mappedColKey);
                    console.log(`[DataTable] 🔧 col_X格式映射: 字段索引${fieldIndex} -> ${mappedColKey}`);
                }
            }

            // 对于自定义面板，需要特殊处理字段名匹配
            if (item.name && typeof item.name === 'string') {
                // 提取时间戳部分（自定义面板字段名格式：显示名_时间戳）
                const timestampMatch = item.name.match(/_(\d+)$/);
                if (timestampMatch) {
                    const timestamp = timestampMatch[1];
                    // 添加只有时间戳的字段名（AI输出格式）
                    possibleFieldNames.push(`_${timestamp}`);
                    // 添加数字格式的字段名
                    const numberMatch = item.name.match(/^[^_]*(\d+)_\d+$/);
                    if (numberMatch) {
                        possibleFieldNames.push(`${numberMatch[1]}_${timestamp}`);
                    }
                }
            }

            // 对于交互对象面板，还要尝试npc格式的字段名
            if (item.key && typeof item.key === 'string') {
                // 如果是简单字段名，尝试添加npc0前缀
                if (!item.key.includes('.') && !item.key.startsWith('npc')) {
                    possibleFieldNames.push(`npc0.${item.key}`);
                }

                // 如果已经是npc格式，也尝试不带前缀的版本
                if (item.key.startsWith('npc0.')) {
                    possibleFieldNames.push(item.key.replace('npc0.', ''));
                }
            }

            // 遍历所有可能的字段名
            for (const fieldName of possibleFieldNames) {
                if (fieldName && panelData.hasOwnProperty(fieldName)) {
                    const value = panelData[fieldName];
                    if (value !== undefined && value !== null && value !== '') {
                        console.log(`[DataTable] 🎯 字段匹配成功: "${fieldName}" = "${value}"`);
                        return value;
                    }
                }
            }

            // 如果直接匹配失败，尝试模糊匹配
            const allKeys = Object.keys(panelData);
            for (const possibleName of possibleFieldNames) {
                if (!possibleName) continue;

                // 尝试不区分大小写的匹配
                const matchedKey = allKeys.find(key =>
                    key.toLowerCase() === possibleName.toLowerCase()
                );

                if (matchedKey) {
                    const value = panelData[matchedKey];
                    if (value !== undefined && value !== null && value !== '') {
                        console.log(`[DataTable] 🎯 模糊匹配成功: "${matchedKey}" = "${value}"`);
                        return value;
                    }
                }
            }

            // 最后尝试部分匹配（针对自定义面板的时间戳字段）
            if (item.name && typeof item.name === 'string') {
                const timestampMatch = item.name.match(/_(\d+)$/);
                if (timestampMatch) {
                    const timestamp = timestampMatch[1];
                    // 查找包含该时间戳的字段
                    const matchedKey = allKeys.find(key => key.includes(timestamp));
                    if (matchedKey) {
                        const value = panelData[matchedKey];
                        if (value !== undefined && value !== null && value !== '') {
                            console.log(`[DataTable] 🎯 时间戳匹配成功: "${matchedKey}" = "${value}"`);
                            return value;
                        }
                    }
                }
            }

            // 🔧 修复：最后尝试使用统一的字段映射系统
            const unifiedMapping = this.getUnifiedFieldMapping();
            for (const possibleName of possibleFieldNames) {
                if (!possibleName) continue;
                
                // 尝试通过统一映射系统查找
                const mappedKey = unifiedMapping.findMatchingKey(panelData, possibleName);
                if (mappedKey && panelData[mappedKey] !== undefined && panelData[mappedKey] !== null && panelData[mappedKey] !== '') {
                    console.log(`[DataTable] 🎯 统一映射匹配成功: "${possibleName}" -> "${mappedKey}" = "${panelData[mappedKey]}"`);
                    return panelData[mappedKey];
                }
            }

            console.log(`[DataTable] ❌ 字段查找失败，尝试的字段名:`, possibleFieldNames);
            console.log(`[DataTable] 📊 可用的字段:`, Object.keys(panelData));
            console.log(`[DataTable] 🔍 建议检查字段映射配置或数据格式兼容性`);
            return null;

        } catch (error) {
            console.error('[DataTable] ❌ 字段值查找失败:', error);
            console.error('[DataTable] 📊 调试信息:', {
                itemKey: item.key,
                itemName: item.name,
                availableKeys: Object.keys(panelData),
                panelDataType: typeof panelData,
                isArray: Array.isArray(panelData)
            });
            return null;
        }
    }
    /**
     * 🚀 获取统一字段映射系统
     */
    getUnifiedFieldMapping() {
        return {
            // 中文字段名到col_X的映射
            chineseToColMapping: {
                '姓名': 'col_1',
                '年龄': 'col_2',
                '性别': 'col_3',
                '职业': 'col_4',
                '外貌': 'col_5',
                '性格': 'col_6',
                '想法': 'col_7',
                '衣服': 'col_8',
                '对象名称': 'col_1',
                'NPC名称': 'col_1',
                '对象类型': 'col_2',
                '当前状态': 'col_3',
                '关系类型': 'col_4',
                '亲密度': 'col_5',
                '组织名称': 'col_1',
                '组织类型': 'col_2',
                '世界名称': 'col_1',
                '世界类型': 'col_2',
                '世界风格': 'col_3',
                '地理环境': 'col_4',
                '重要地点': 'col_5',
                '时间设定': 'col_6'
            },
            
            // 英文字段名映射
            englishMapping: {
                'name': '姓名',
                'age': '年龄',
                'gender': '性别',
                'profession': '职业',
                'appearance': '外貌',
                'personality': '性格',
                'thoughts': '想法',
                'clothes': '衣服'
            },
            
            // 查找匹配的键
            findMatchingKey(panelData, fieldName) {
                const availableKeys = Object.keys(panelData);
                
                // 直接匹配
                if (availableKeys.includes(fieldName)) {
                    return fieldName;
                }
                
                // 中文到col_X映射
                const colKey = this.chineseToColMapping[fieldName];
                if (colKey && availableKeys.includes(colKey)) {
                    return colKey;
                }
                
                // 英文到中文再到col_X映射
                const chineseName = this.englishMapping[fieldName];
                if (chineseName) {
                    const mappedColKey = this.chineseToColMapping[chineseName];
                    if (mappedColKey && availableKeys.includes(mappedColKey)) {
                        return mappedColKey;
                    }
                }
                
                // 不区分大小写匹配
                const caseInsensitiveMatch = availableKeys.find(key => 
                    key.toLowerCase() === fieldName.toLowerCase()
                );
                if (caseInsensitiveMatch) {
                    return caseInsensitiveMatch;
                }
                
                return null;
            }
        };
    }

    /**
     * 格式化单元格内容，控制文本长度和显示方式（增强版：支持多行数据）
     */
    formatCellValue(value) {
        try {
            if (!value || value === '') {
                return '';
            }

            // 🆕 检查是否为多行数据数组格式
            if (Array.isArray(value)) {
                return this.formatMultiRowArray(value);
            }

            // 🆕 检查是否为JSON格式的多行数据
            if (typeof value === 'string' && value.trim().startsWith('[') && value.trim().endsWith(']')) {
                try {
                    const parsedArray = JSON.parse(value);
                    if (Array.isArray(parsedArray)) {
                        return this.formatMultiRowArray(parsedArray);
                    }
                } catch (e) {
                    // 不是有效的JSON，按普通字符串处理
                }
            }

            // 传统字符串处理
            const strValue = String(value);

            // 🔧 控制文本长度，避免单元格过高
            const maxLength = 120; // 增加最大显示字符数以适应多行内容
            const maxLines = 4;    // 增加最大显示行数

            // 处理换行符，限制行数
            const lines = strValue.split('\n');
            let truncatedLines = lines.slice(0, maxLines);

            // 如果有更多行，添加省略号
            if (lines.length > maxLines) {
                if (truncatedLines[maxLines - 1].length > 0) {
                    truncatedLines[maxLines - 1] += '...';
                } else {
                    truncatedLines.push('...');
                }
            }

            // 合并行并限制总长度
            let result = truncatedLines.join('\n');
            
            // 如果总长度超过限制，进行截断
            if (result.length > maxLength) {
                result = result.substring(0, maxLength - 3) + '...';
            }

            // 🔧 应用CSS样式，确保横向显示为主
            return `<div class="cell-content" style="
                max-width: 350px;
                max-height: 100px;
                overflow: hidden;
                white-space: pre-wrap;
                word-wrap: break-word;
                word-break: break-word;
                line-height: 1.4;
                text-overflow: ellipsis;
                display: -webkit-box;
                -webkit-line-clamp: 4;
                -webkit-box-orient: vertical;
            ">${this.escapeHtml(result)}</div>`;

        } catch (error) {
            console.error('[DataTable] ❌ 格式化单元格内容失败:', error);
            return this.escapeHtml(String(value || ''));
        }
    }

    /**
     * 🆕 格式化多行数据数组
     * @param {Array} dataArray - 多行数据数组
     * @returns {string} 格式化后的HTML
     */
    formatMultiRowArray(dataArray) {
        try {
            if (!Array.isArray(dataArray) || dataArray.length === 0) {
                return '';
            }

            const maxItems = 3; // 最多显示3个条目
            const displayItems = dataArray.slice(0, maxItems);
            const hasMoreItems = dataArray.length > maxItems;

            // 构建显示内容
            const itemsHtml = displayItems.map((item, index) => {
                let content = '';
                let timestamp = '';
                
                if (typeof item === 'string') {
                    content = item;
                } else if (typeof item === 'object' && item.content) {
                    content = item.content;
                    if (item.timestamp) {
                        const date = new Date(item.timestamp);
                        timestamp = date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
                    }
                } else {
                    content = String(item);
                }

                // 限制单个条目长度
                if (content.length > 50) {
                    content = content.substring(0, 47) + '...';
                }

                return `<div class="multirow-item" style="
                    margin: 2px 0;
                    padding: 2px 4px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 3px;
                    font-size: 0.9em;
                    position: relative;
                ">
                    <span class="item-content">${this.escapeHtml(content)}</span>
                    ${timestamp ? `<span class="item-timestamp" style="
                        font-size: 0.8em;
                        color: rgba(255,255,255,0.6);
                        margin-left: 6px;
                    ">${timestamp}</span>` : ''}
                </div>`;
            }).join('');

            // 添加"更多"提示
            const moreIndicator = hasMoreItems ? 
                `<div class="multirow-more" style="
                    font-size: 0.8em;
                    color: rgba(255,255,255,0.7);
                    text-align: center;
                    margin-top: 4px;
                    font-style: italic;
                ">+${dataArray.length - maxItems} 更多条目</div>` : '';

            return `<div class="multirow-container" style="
                max-width: 350px;
                max-height: 120px;
                overflow: hidden;
                line-height: 1.2;
            ">
                ${itemsHtml}
                ${moreIndicator}
            </div>`;

        } catch (error) {
            console.error('[DataTable] ❌ 格式化多行数据数组失败:', error);
            return this.escapeHtml(String(dataArray));
        }
    }

    /**
     * HTML转义函数，防止XSS攻击
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 智能计算表格列宽，根据内容长度自适应
     */
    calculateAdaptiveColumnWidths(panel) {
        try {
            const columnAnalysis = panel.subItems.map(item => {
                // 分析列标题长度
                const headerLength = (item.name || '').length;
                
                // 分析该列所有数据的长度
                const dataLengths = [];
                
                // 🔧 特殊处理：组织架构面板使用分组数据而不是合并数据
                let sampleValue;
                if (panel.key === 'organization') {
                    // 对于组织架构面板，从原始分组数据中获取样本值
                    const organizationData = this.getOrganizationDataSync();
                    if (organizationData) {
                        const orgGroups = this.groupOrgData(organizationData);
                        const firstOrg = Object.values(orgGroups)[0];
                        if (firstOrg) {
                            sampleValue = firstOrg[item.name] || item.value || '';
                        } else {
                            sampleValue = item.value || '';
                        }
                    } else {
                        sampleValue = item.value || '';
                    }
                } else {
                    // 其他面板使用原有逻辑
                    sampleValue = this.getPanelItemValue(panel, item);
                }
                
                const sampleLength = String(sampleValue || '').length;
                dataLengths.push(sampleLength);
                
                // 计算最大内容长度
                const maxContentLength = Math.max(headerLength, ...dataLengths);
                
                // 🔧 根据内容长度和类型智能计算列宽（移动端优化）
                let adaptiveWidth;

                // 检测是否为移动端
                const isMobile = window.innerWidth <= 768;

                // 特殊字段类型的优化处理
                const fieldName = item.name.toLowerCase();
                if (fieldName.includes('年龄') || fieldName.includes('age')) {
                    adaptiveWidth = isMobile ? 60 : 70; // 移动端更紧凑
                } else if (fieldName.includes('性别') || fieldName.includes('gender')) {
                    adaptiveWidth = isMobile ? 60 : 70; // 移动端更紧凑
                } else if (fieldName.includes('身高') || fieldName.includes('体重') || fieldName.includes('血型')) {
                    adaptiveWidth = isMobile ? 75 : 85; // 移动端更紧凑
                } else if (fieldName.includes('生日') || fieldName.includes('date')) {
                    adaptiveWidth = isMobile ? 85 : 95; // 移动端更紧凑
                } else {
                    // 根据内容长度动态计算（移动端优化）
                    if (maxContentLength <= 2) {
                        adaptiveWidth = isMobile ? 60 : 70; // 很短的内容（如O型、男）
                    } else if (maxContentLength <= 5) {
                        adaptiveWidth = isMobile ? 80 : 95; // 短内容（如学生、女性）
                    } else if (maxContentLength <= 10) {
                        adaptiveWidth = isMobile ? 110 : 130; // 中等内容（如软件工程师）
                    } else if (maxContentLength <= 20) {
                        adaptiveWidth = isMobile ? 140 : 180; // 较长内容（如详细地址）
                    } else if (maxContentLength <= 40) {
                        adaptiveWidth = isMobile ? 180 : 240; // 长内容
                    } else if (maxContentLength <= 60) {
                        adaptiveWidth = isMobile ? 220 : 300; // 很长内容
                    } else {
                        adaptiveWidth = isMobile ? 250 : 350; // 超长内容（如详细描述）
                    }
                }

                // 考虑中文字符的显示宽度（中文字符通常比英文宽）
                const headerText = item.name || '';
                const chineseCharCount = (headerText.match(/[\u4e00-\u9fa5]/g) || []).length;
                const baseHeaderWidth = headerText.length * (isMobile ? 12 : 14); // 移动端字体更小
                const minimumForHeader = Math.max(baseHeaderWidth, isMobile ? 45 : 50);

                // 确保列宽足够显示表头
                adaptiveWidth = Math.max(adaptiveWidth, minimumForHeader);

                // 移动端限制最大宽度，避免表格过宽
                const maxWidth = isMobile ? 280 : 400;
                const minWidth = isMobile ? 50 : 60;

                return {
                    item,
                    headerLength,
                    maxContentLength,
                    adaptiveWidth: Math.min(Math.max(adaptiveWidth, minWidth), maxWidth)
                };
            });
            
            console.log(`[DataTable] 📊 ${panel.name} 列宽分析:`, 
                columnAnalysis.map(col => `${col.item.name}:${col.adaptiveWidth}px`)
            );
            
            return columnAnalysis;
            
        } catch (error) {
            console.error('[DataTable] ❌ 计算自适应列宽失败:', error);
            // 回退到默认宽度
            return panel.subItems.map(item => ({
                item,
                adaptiveWidth: 150
            }));
        }
    }

    /**
     * 获取基础面板子项的数据值
     */
    getBasicPanelItemValue(panelId, item) {
        // 这里可以根据实际需求从数据源获取值
        // 目前返回预设的示例数据，使用中文显示名称作为键
        const sampleData = {
            'personal': {
                '姓名': '林天',
                '年龄': '25',
                '性别': '男',
                '职业': '软件工程师',
                '身高': '175cm',
                '体重': '70kg',
                '外貌': '清秀',
                '性格': '开朗、友善'
            },
            'world': {
                '世界名称': '现代都市',
                '时代背景': '21世纪',
                '地理位置': '中国上海',
                '气候环境': '亚热带季风气候',
                '科技水平': '高度发达',
                '社会制度': '现代社会',
                '文化特色': '中西融合'
            },
            'interaction': {
                '小雨': '朋友',
                '张经理': '同事',
                '李医生': '医患关系',
                '王老师': '师生关系',
                '陈同学': '同学',
                '刘邻居': '邻居'
            },
            'organization': {
                '天剑宗': '修仙门派',
                '商会联盟': '商业组织',
                '皇室': '政治势力',
                '学院': '教育机构',
                '医院': '医疗机构',
                '公司': '企业组织'
            }
        };

        return sampleData[panelId]?.[item.name] || item.value || '';
    }

    /**
     * 获取自定义面板子项的数据值
     */
    getCustomPanelItemValue(panelId, item) {
        // 自定义面板可以从配置中获取默认值或从数据源获取
        return item.value || item.defaultValue || '';
    }



    /**
     * 绑定新的事件处理
     */
    bindNewEvents() {
        if (!this.modal) return;

        // 🔧 修复：移除重复的事件监听器绑定
        // 这些事件已经在 bindEvents() 中绑定，避免重复绑定导致多次触发
        console.log('[DataTable] 🔧 跳过重复的事件绑定，事件已在 bindEvents() 中处理');

        // 如果需要重新绑定特定事件，应该先移除旧的监听器
        // 但目前所有必要的事件都已在 bindEvents() 中正确绑定
    }

    /**
     * 🆕 处理表格单元格点击事件
     */
    handleCellClick(cellElement, event) {
        try {
            console.log('[DataTable] 🖱️ 单元格被点击');

            // 获取单元格相关信息
            let property = cellElement.getAttribute('data-property');
            const value = cellElement.textContent.trim();
            const row = cellElement.closest('tr');

            if (!property || !row) {
                console.warn('[DataTable] ⚠️ 无法获取单元格信息');
                return;
            }

            // 获取面板信息
            const tableGroup = cellElement.closest('.table-group');
            const panelId = this.getPanelIdFromTableGroup(tableGroup);

            if (!panelId) {
                console.warn('[DataTable] ⚠️ 无法获取面板ID');
                return;
            }

            // 获取NPC信息（如果是NPC表格）
            const npcId = row.getAttribute('data-npc-id');
            
            // 🔧 新增：获取组织ID（优先从行属性，其次从属性名前缀）
            let orgId = row.getAttribute('data-org-id'); // 直接从行获取组织ID
            let extractedNpcId = npcId;
            
            // 检查属性名是否包含前缀
            const npcMatch = property.match(/^(npc\d+)\./);
            const orgMatch = property.match(/^(org\d+)\./);
            
            if (npcMatch) {
                extractedNpcId = npcMatch[1];
                // 去掉前缀，获取实际字段名
                property = property.substring(extractedNpcId.length + 1);
            } else if (orgMatch) {
                orgId = orgMatch[1]; // 如果属性名有前缀，使用前缀中的组织ID
                // 去掉前缀，获取实际字段名
                property = property.substring(orgId.length + 1);
            }

            console.log('[DataTable] 📊 单元格信息:', {
                panelId,
                property,
                value,
                npcId: extractedNpcId || '无',
                orgId: orgId || '无'
            });

            // 解析单元格位置信息（用于多行数据识别）
            const cellId = cellElement.getAttribute('data-cell-id') || '';
            // 形如: `${panel.key}_${rowIndex}_${actualColIndex}_${item.name}`
            let parsedRowIndex = undefined;
            let parsedColumnIndex = undefined;
            try {
                const parts = cellId.split('_');
                if (parts.length >= 3) {
                    // 倒数第三个是行索引，倒数第二个是列索引
                    // e.g. [panel, rowIndex, colIndex, ...]
                    parsedRowIndex = parseInt(parts[1]);
                    parsedColumnIndex = parseInt(parts[2]);
                }
            } catch {}

            // 显示操作选项菜单
            this.showCellActionMenu(cellElement, {
                panelId,
                property,
                value,
                npcId: extractedNpcId,
                orgId,
                event,
                rowIndex: isNaN(parsedRowIndex) ? undefined : parsedRowIndex,
                columnIndex: isNaN(parsedColumnIndex) ? undefined : parsedColumnIndex
            });

        } catch (error) {
            console.error('[DataTable] ❌ 处理单元格点击失败:', error);
        }
    }
    /**
     * 🆕 处理表格字段名称点击事件
     */
    handleHeaderClick(headerElement, event) {
        try {
            console.log('[DataTable] 🖱️ 字段名称被点击');

            // 获取字段名称文本
            const fieldName = headerElement.textContent.trim();
            
            // 获取表格组信息
            const tableGroup = headerElement.closest('.table-group');
            const panelId = this.getPanelIdFromTableGroup(tableGroup);

            if (!panelId) {
                console.warn('[DataTable] ⚠️ 无法从字段名称获取面板ID');
                return;
            }

            // 尝试从data属性获取property信息（如果有的话）
            let property = headerElement.getAttribute('data-property');
            if (!property) {
                // 如果没有data-property属性，尝试从字段名称推断
                // 查找当前面板的子项配置来获取准确的property值
                try {
                    const infoBarTool = window.SillyTavernInfobar;
                    const configManager = infoBarTool?.modules?.configManager;
                    if (configManager) {
                        const context = SillyTavern.getContext();
                        const configs = context.extensionSettings['Information bar integration tool'] || {};
                        const panelConfig = configs[panelId];
                        
                        if (panelConfig && panelConfig.subItems) {
                            // 从面板配置中查找匹配的字段
                            const matchedField = panelConfig.subItems.find(item => 
                                item.name === fieldName || item.displayName === fieldName
                            );
                            if (matchedField) {
                                property = matchedField.key || matchedField.name;
                            }
                        }
                    }
                } catch (error) {
                    console.warn('[DataTable] ⚠️ 获取字段配置失败:', error);
                }

                // 如果仍然无法获取property，使用字段名称作为fallback
                if (!property) {
                    property = fieldName;
                }
            }

            console.log('[DataTable] 📊 字段名称信息:', {
                panelId,
                property,
                fieldName,
                headerText: fieldName
            });

            // 获取列索引
            let columnIndex = headerElement.getAttribute('data-column-index');
            if (columnIndex !== null) {
                columnIndex = parseInt(columnIndex);
            } else {
                // 如果没有data-column-index属性，尝试从表格中计算
                const headerRow = headerElement.closest('tr');
                const headers = headerRow.querySelectorAll('th');
                columnIndex = Array.from(headers).indexOf(headerElement);
            }

            console.log('[DataTable] 📊 字段名称信息:', {
                panelId,
                property,
                fieldName,
                columnIndex,
                headerText: fieldName
            });

            // 显示操作选项菜单（与单元格点击使用相同的菜单）
            this.showCellActionMenu(headerElement, {
                panelId,
                property,
                value: `[字段: ${fieldName}]`, // 字段名称点击时显示特殊标识
                fieldName,
                columnIndex,
                isHeaderClick: true, // 标记这是字段名称点击
                event
            });

        } catch (error) {
            console.error('[DataTable] ❌ 处理字段名称点击失败:', error);
        }
    }

    /**
     * 🆕 处理重新填表按钮点击
     */
    async handleRefillData(event) {
        try {
            console.log('[DataTable] 🔄 开始重新填表...');

            // 防止重复点击
            if (this._refillInProgress) {
                console.warn('[DataTable] ⚠️ 重新填表已在进行中，忽略重复点击');
                this.showNotification('⏳ 重新填表正在进行中，请耐心等待...', 'warning');
                return;
            }

            // 设置进行中标志
            this._refillInProgress = true;

            // 显示加载状态
            const button = event.target.closest('#refill-data-btn');
            if (button) {
                const originalText = button.innerHTML;
                button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 重新填表中...';
                button.disabled = true;

                try {
                    // 🔧 获取最新的AI消息内容
                    const latestAIMessage = this.getLatestAIMessage();
                    if (!latestAIMessage) {
                        throw new Error('未找到AI消息，无法重新生成数据');
                    }

                    console.log('[DataTable] 📝 获取到AI消息，长度:', latestAIMessage.length);

                    // 🔧 获取InfoBarSettings实例并调用processWithCustomAPI
                    const infoBarSettings = window.SillyTavernInfobar?.modules?.settings;
                    if (!infoBarSettings || typeof infoBarSettings.processWithCustomAPI !== 'function') {
                        throw new Error('InfoBarSettings模块未就绪，请稍后重试');
                    }

                    // 调用自定义API重新生成数据
                    await infoBarSettings.processWithCustomAPI(latestAIMessage);

                    // 显示成功状态
                    button.innerHTML = '<i class="fa-solid fa-check"></i> 重新填表完成';
                    this.showNotification('✅ 数据重新生成完成', 'success');

                    // 2秒后恢复按钮状态
                    setTimeout(() => {
                        if (button) {
                            button.innerHTML = originalText;
                            button.disabled = false;
                        }
                    }, 2000);

                    // 🔧 刷新数据表格显示
                    setTimeout(() => {
                        this.updateGroupedTablesData();
                    }, 1000);

                } catch (error) {
                    console.error('[DataTable] ❌ 重新填表失败:', error);
                    
                    // 恢复按钮状态
                    button.innerHTML = originalText;
                    button.disabled = false;
                    
                    // 显示用户友好的错误消息
                    let errorMessage = '❌ 重新填表失败';
                    if (error.message?.includes('未找到AI消息')) {
                        errorMessage = '❌ 未找到AI消息内容，请先进行一次对话';
                    } else if (error.message?.includes('429')) {
                        errorMessage = '❌ API请求过于频繁，请稍后再试';
                    } else if (error.message?.includes('500')) {
                        errorMessage = '❌ 服务器错误，请稍后重试';
                    } else if (error.message?.includes('未就绪')) {
                        errorMessage = '❌ 系统未就绪，请稍后重试';
                    } else if (error.message) {
                        errorMessage += ': ' + error.message;
                    }
                    
                    this.showNotification(errorMessage, 'error');
                }
            }

        } catch (error) {
            console.error('[DataTable] ❌ 处理重新填表失败:', error);
            this.showNotification('❌ 重新填表功能出现错误', 'error');
        } finally {
            // 清除进行中标志
            this._refillInProgress = false;
        }
    }

    /**
     * 🔧 获取最新的AI消息内容
     */
    getLatestAIMessage() {
        try {
            const context = SillyTavern.getContext();
            if (!context || !context.chat || context.chat.length === 0) {
                return null;
            }

            // 从后往前查找最新的AI消息
            for (let i = context.chat.length - 1; i >= 0; i--) {
                const message = context.chat[i];
                if (message && message.is_user === false && message.mes) {
                    console.log('[DataTable] ✅ 找到最新AI消息，位置:', i);
                    return message.mes;
                }
            }

            return null;
        } catch (error) {
            console.error('[DataTable] ❌ 获取最新AI消息失败:', error);
            return null;
        }
    }

    /**
     * 🆕 处理生成变量按钮点击事件
     */
    async handleGenerateVariables(event) {
        try {
            console.log('[DataTable] 🔧 开始生成STScript变量结构');

            // 显示加载状态
            const button = event.target.closest('#generate-variables-btn');
            if (button) {
                const originalText = button.innerHTML;
                button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 生成中...';
                button.disabled = true;

                try {
                    await this.generateSTScriptVariables();
                    
                    // 显示成功状态
                    button.innerHTML = '<i class="fa-solid fa-check"></i> 生成完成';
                    setTimeout(() => {
                        button.innerHTML = originalText;
                        button.disabled = false;
                    }, 2000);

                } catch (error) {
                    // 显示错误状态
                    button.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> 生成失败';
                    setTimeout(() => {
                        button.innerHTML = originalText;
                        button.disabled = false;
                    }, 2000);
                    throw error;
                }
            }

        } catch (error) {
            console.error('[DataTable] ❌ 生成变量失败:', error);
            this.showNotification('生成变量失败: ' + error.message, 'error');
        }
    }

    /**
     * 🆕 生成STScript变量结构的核心逻辑
     */
    async generateSTScriptVariables() {
        try {
            // 1. 获取启用的面板信息
            const smartPromptSystem = window.SillyTavernInfobar?.modules?.smartPromptSystem;
            if (!smartPromptSystem) {
                throw new Error('无法获取智能提示系统');
            }

            const enabledPanels = await smartPromptSystem.getEnabledPanels();
            console.log('[DataTable] 📋 获取到启用面板:', enabledPanels);

            if (!enabledPanels || enabledPanels.length === 0) {
                throw new Error('没有找到启用的面板');
            }

            // 2. 获取STScript同步模块
            const stScriptSync = window.SillyTavernInfobar?.modules?.stScriptDataSync;
            if (!stScriptSync) {
                throw new Error('无法获取STScript同步模块');
            }

            // 3. 为每个启用的面板生成变量结构
            const generatedStructures = {};
            
            for (const panel of enabledPanels) {
                console.log('[DataTable] 🔧 处理面板:', panel.id);
                
                // 构建面板的变量结构
                const panelStructure = {};
                
                // 添加启用的子项，如果没有数据则为空
                if (panel.subItems && panel.subItems.length > 0) {
                    for (const subItem of panel.subItems) {
                        if (subItem.enabled !== false) {
                            // 根据子项键创建变量，数值为空字符串（用户可以后续填充）
                            panelStructure[subItem.key] = [''];
                        }
                    }
                }

                // 如果面板有规则，也添加到结构中
                const panelRules = stScriptSync.getPanelRules?.(panel.id);
                if (panelRules) {
                    panelStructure['Panel Rules'] = panelRules;
                }

                generatedStructures[panel.id] = panelStructure;
            }

            console.log('[DataTable] 🎯 生成的变量结构:', generatedStructures);

            // 4. 同步到STScript变量系统 - 每个面板分别同步到根级别
            for (const [panelName, panelStructure] of Object.entries(generatedStructures)) {
                await stScriptSync.updateInfobarStructure(panelName, panelStructure);
                console.log(`[DataTable] ✅ 面板 ${panelName} 已同步到STScript根级别`);
            }

            // 5. 无需额外的全量同步，各面板已直接更新

            console.log('[DataTable] ✅ STScript变量结构生成完成');
            this.showNotification('STScript变量结构已成功生成', 'success');

            // 6. 触发数据刷新事件
            if (this.eventSystem) {
                this.eventSystem.emit('variables:generated', {
                    structures: generatedStructures,
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('[DataTable] ❌ 生成STScript变量结构失败:', error);
            throw error;
        }
    }

    /**
     * 🆕 显示通知消息
     */
    showNotification(message, type = 'info') {
        try {
            // 创建通知元素
            const notification = document.createElement('div');
            notification.className = `data-table-notification notification-${type}`;
            notification.innerHTML = `
                <div class="notification-content">
                    <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                    <span>${message}</span>
                </div>
            `;

            // 添加样式
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10001;
                font-family: Arial, sans-serif;
                font-size: 14px;
                max-width: 400px;
                word-wrap: break-word;
                animation: slideInRight 0.3s ease-out;
            `;

            // 添加到页面
            document.body.appendChild(notification);

            // 3秒后自动移除
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.style.animation = 'slideOutRight 0.3s ease-in';
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                    }, 300);
                }
            }, 3000);

        } catch (error) {
            console.error('[DataTable] ❌ 显示通知失败:', error);
        }
    }

    /**
     * 🆕 从表格组获取面板ID
     */
    getPanelIdFromTableGroup(tableGroup) {
        if (!tableGroup) return null;

        // 尝试从编辑按钮获取
        const editButton = tableGroup.querySelector('[data-action="edit-group"]');
        if (editButton) {
            return editButton.getAttribute('data-group');
        }

        // 尝试从其他属性获取
        return tableGroup.getAttribute('data-panel-id') || null;
    }

    /**
     * 🆕 解析在数据存储中的实际键名（优先 col_X，其次英文，再次原名）
     */
    resolveDataKeyForPanel(panelId, property) {
        try {
            // 1) 动态字段映射（col_X）
            const fieldMapping = this.getFieldMapping(panelId) || {};
            if (fieldMapping[property]) return fieldMapping[property];

            // 2) 英文字段名
            const english = this.dataCore?.getEnglishFieldName?.(property, panelId);
            if (english) return english;

            // 3) 原字段名
            return property;
        } catch (e) {
            return property;
        }
    }
    /**
     * 🆕 显示单元格操作菜单
     */
    showCellActionMenu(cellElement, cellInfo) {
        try {
            // 移除已存在的菜单
            this.hideCellActionMenu();

            // 根据点击类型设置菜单标题和信息
            const isHeaderClick = cellInfo.isHeaderClick;
            const menuTitle = isHeaderClick ? '字段操作' : '单元格操作';
            const menuInfo = isHeaderClick ? 
                `字段: ${cellInfo.fieldName || cellInfo.property}` : 
                cellInfo.property;

            // 创建操作菜单
            const menu = document.createElement('div');
            menu.className = 'cell-action-menu';
            menu.innerHTML = `
                <div class="menu-overlay"></div>
                <div class="menu-content">
                    <div class="menu-header">
                        <span class="menu-title">${menuTitle}</span>
                        <span class="menu-info">${menuInfo}</span>
                    </div>
                    <div class="menu-actions">
                        <button class="menu-btn edit-btn" data-action="edit-cell">
                            <span class="btn-text">表格编辑</span>
                        </button>
                        <button class="menu-btn rule-btn" data-action="edit-field-rule">
                            <span class="btn-text">字段规则</span>
                        </button>
                        <button class="menu-btn history-btn" data-action="view-history">
                            <span class="btn-text">表格记录</span>
                        </button>

                        ${isHeaderClick ? `
                        <!-- 🆕 字段结构操作 -->
                        <div class="menu-separator"></div>
                        <div class="menu-section-title">字段结构</div>
                        <button class="menu-btn add-field-before-btn" data-action="add-field-before">
                            <span class="btn-text">向前增加字段</span>
                        </button>
                        <button class="menu-btn add-field-after-btn" data-action="add-field-after">
                            <span class="btn-text">向后增加字段</span>
                        </button>
                        <button class="menu-btn delete-field-btn" data-action="delete-field">
                            <span class="btn-text">删除字段</span>
                        </button>
                        ` : `
                        <!-- 🔧 数据操作 -->
                        <div class="menu-separator"></div>
                        <button class="menu-btn delete-data-btn" data-action="delete-data">
                            <span class="btn-text">删除数据</span>
                        </button>
                        <button class="menu-btn delete-row-btn" data-action="delete-row">
                            <span class="btn-text">删除数据行</span>
                        </button>
                        `}
                    </div>
                </div>
            `;

            // 添加到页面
            document.body.appendChild(menu);

            // 计算菜单位置
            const rect = cellElement.getBoundingClientRect();
            const menuContent = menu.querySelector('.menu-content');

            // 设置初始位置
            menuContent.style.left = `${rect.left + rect.width / 2}px`;
            menuContent.style.top = `${rect.bottom + 10}px`;

            // 检查边界并调整位置
            setTimeout(() => {
                const menuRect = menuContent.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                // 水平边界检查
                if (menuRect.right > viewportWidth - 20) {
                    menuContent.style.left = `${viewportWidth - menuRect.width - 20}px`;
                }
                if (menuRect.left < 20) {
                    menuContent.style.left = '20px';
                }

                // 垂直边界检查
                if (menuRect.bottom > viewportHeight - 20) {
                    menuContent.style.top = `${rect.top - menuRect.height - 10}px`;
                }
            }, 0);

            // 绑定菜单事件
            this.bindCellActionMenuEvents(menu, cellInfo);

            // 显示菜单
            setTimeout(() => {
                menu.classList.add('show');
            }, 10);

            console.log('[DataTable] 📋 操作菜单已显示');

        } catch (error) {
            console.error('[DataTable] ❌ 显示操作菜单失败:', error);
        }
    }

    /**
     * 🆕 隐藏单元格操作菜单
     */
    hideCellActionMenu() {
        const existingMenu = document.querySelector('.cell-action-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
    }

    /**
     * 🆕 绑定单元格操作菜单事件
     */
    bindCellActionMenuEvents(menu, cellInfo) {
        // 点击遮罩层关闭菜单
        const overlay = menu.querySelector('.menu-overlay');
        overlay.addEventListener('click', () => {
            this.hideCellActionMenu();
        });

        // 菜单按钮事件
        menu.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.getAttribute('data-action');

            if (action === 'edit-cell') {
                this.hideCellActionMenu();
                this.showEditCellDialog(cellInfo);
            } else if (action === 'edit-field-rule') {
                this.hideCellActionMenu();
                this.showFieldRuleDialog(cellInfo);
            } else if (action === 'view-history') {
                this.hideCellActionMenu();
                this.showCellHistoryDialog(cellInfo);
            } else if (action === 'add-field-before') {
                this.hideCellActionMenu();
                this.showAddFieldDialog(cellInfo, 'before');
            } else if (action === 'add-field-after') {
                this.hideCellActionMenu();
                this.showAddFieldDialog(cellInfo, 'after');
            } else if (action === 'delete-field') {
                this.hideCellActionMenu();
                this.showDeleteFieldConfirmation(cellInfo);
            } else if (action === 'delete-data') {
                this.hideCellActionMenu();
                this.showDeleteDataConfirmation(cellInfo);
            } else if (action === 'delete-row') {
                this.hideCellActionMenu();
                this.showDeleteRowConfirmation(cellInfo);
            }
        });

        // ESC键关闭菜单
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                this.hideCellActionMenu();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
    }

    /**
     * 处理NPC选择器变更
     */
    handleNpcSelectorChange(event) {
        try {
            const selectedNpcId = event.target.value;
            console.log('[DataTable] 🔄 NPC选择器变更:', selectedNpcId);

            // 找到对应的表格容器
            const tableContainer = event.target.closest('.data-table-container');
            if (!tableContainer) return;

            // 隐藏所有NPC数据行
            const allNpcRows = tableContainer.querySelectorAll('.npc-data-row');
            allNpcRows.forEach(row => {
                row.style.display = 'none';
            });

            // 显示选中的NPC数据行
            const selectedRow = tableContainer.querySelector(`.npc-data-row[data-npc-id="${selectedNpcId}"]`);
            if (selectedRow) {
                selectedRow.style.display = 'table-row';
                console.log('[DataTable] ✅ 已切换到NPC:', selectedNpcId);
            }

        } catch (error) {
            console.error('[DataTable] ❌ 处理NPC选择器变更失败:', error);
        }
    }

    /**
     * 处理工具栏操作
     */
    handleToolbarAction(action, event) {
        console.log('[DataTable] 工具栏操作:', action);

        switch (action) {
            case 'export-data':
                this.exportData();
                break;
            case 'refresh':
                this.refreshData();
                break;
            case 'expand-group':
                event.preventDefault();
                event.stopPropagation();
                const groupName = event.target.closest('[data-group]')?.getAttribute('data-group');
                if (groupName) {
                    this.toggleGroup(groupName);
                }
                break;
            case 'edit-group':
                const editGroupName = event.target.closest('[data-group]')?.getAttribute('data-group');
                if (editGroupName) {
                    this.editGroup(editGroupName);
                }
                break;
            case 'move-panel-up':
                event.preventDefault();
                event.stopPropagation();
                const upPanelId = event.target.closest('[data-panel]')?.getAttribute('data-panel');
                if (upPanelId) {
                    this.movePanelUp(upPanelId);
                }
                break;
            case 'move-panel-down':
                event.preventDefault();
                event.stopPropagation();
                const downPanelId = event.target.closest('[data-panel]')?.getAttribute('data-panel');
                if (downPanelId) {
                    this.movePanelDown(downPanelId);
                }
                break;
            case 'add-panel':
                event.preventDefault();
                event.stopPropagation();
                this.showAddPanelDialog();
                break;
            case 'export-preset':
                event.preventDefault();
                event.stopPropagation();
                this.exportPreset();
                break;
            case 'import-preset':
                event.preventDefault();
                event.stopPropagation();
                this.importPreset();
                break;
            default:
                console.log('[DataTable] 未知操作:', action);
        }
    }

    /**
     * 切换分组显示状态
     */
    toggleGroup(groupName) {
        // 防抖机制，避免重复触发
        const now = Date.now();
        const lastToggle = this.lastToggleTime || 0;
        if (now - lastToggle < 100) {
            console.log(`[DataTable] ⏸️ 防抖跳过: ${groupName}`);
            return;
        }
        this.lastToggleTime = now;

        const group = this.modal.querySelector(`[data-group="${groupName}"]`).closest('.table-group');
        const content = group.querySelector('.group-content');
        const expandIcon = group.querySelector('.expand-icon');

        if (content.classList.contains('expanded')) {
            content.classList.remove('expanded');
            expandIcon.textContent = '▶';
            console.log(`[DataTable] 📁 收起分组: ${groupName}`);
        } else {
            content.classList.add('expanded');
            expandIcon.textContent = '▼';
            console.log(`[DataTable] 📂 展开分组: ${groupName}`);
        }
    }

    /**
     * 编辑分组 - 打开面板规则编辑界面
     */
    editGroup(groupName) {
        console.log(`[DataTable] ✏️ 编辑面板规则: ${groupName}`);
        this.showPanelRuleDialog(groupName);
    }

    /**
     * 🆕 向上移动面板
     */
    movePanelUp(panelId) {
        try {
            console.log(`[DataTable] ⬆️ 向上移动面板: ${panelId}`);

            const groupedTables = this.modal.querySelector('.grouped-tables');
            if (!groupedTables) {
                console.warn('[DataTable] ⚠️ 未找到表格容器');
                return;
            }

            const currentPanel = groupedTables.querySelector(`[data-panel="${panelId}"]`);
            if (!currentPanel) {
                console.warn(`[DataTable] ⚠️ 未找到面板: ${panelId}`);
                return;
            }

            const previousPanel = currentPanel.previousElementSibling;
            if (!previousPanel) {
                console.log(`[DataTable] ℹ️ 面板 ${panelId} 已经是第一个，无法上移`);
                this.showMessage('该面板已经是第一个，无法上移', 'info');
                return;
            }

            // 交换两个面板的位置
            groupedTables.insertBefore(currentPanel, previousPanel);

            console.log(`[DataTable] ✅ 面板 ${panelId} 已向上移动`);
            this.showSuccessMessage(`面板已向上移动`);

        } catch (error) {
            console.error('[DataTable] ❌ 向上移动面板失败:', error);
            this.showErrorMessage('移动面板失败: ' + error.message);
        }
    }

    /**
     * 🆕 向下移动面板
     */
    movePanelDown(panelId) {
        try {
            console.log(`[DataTable] ⬇️ 向下移动面板: ${panelId}`);

            const groupedTables = this.modal.querySelector('.grouped-tables');
            if (!groupedTables) {
                console.warn('[DataTable] ⚠️ 未找到表格容器');
                return;
            }

            const currentPanel = groupedTables.querySelector(`[data-panel="${panelId}"]`);
            if (!currentPanel) {
                console.warn(`[DataTable] ⚠️ 未找到面板: ${panelId}`);
                return;
            }

            const nextPanel = currentPanel.nextElementSibling;
            if (!nextPanel) {
                console.log(`[DataTable] ℹ️ 面板 ${panelId} 已经是最后一个，无法下移`);
                this.showMessage('该面板已经是最后一个，无法下移', 'info');
                return;
            }

            // 交换两个面板的位置
            groupedTables.insertBefore(nextPanel, currentPanel);

            console.log(`[DataTable] ✅ 面板 ${panelId} 已向下移动`);
            this.showSuccessMessage(`面板已向下移动`);

        } catch (error) {
            console.error('[DataTable] ❌ 向下移动面板失败:', error);
            this.showErrorMessage('移动面板失败: ' + error.message);
        }
    }
    /**
     * 🆕 显示增加面板对话框
     */
    showAddPanelDialog() {
        try {
            console.log('[DataTable] 📝 显示增加面板对话框');

            // 检查是否为移动端
            const isMobile = window.innerWidth <= 768;

            // 创建对话框HTML - 根据设备类型使用不同的样式策略
            const dialogHtml = `
                <div class="add-panel-dialog-overlay ${isMobile ? 'mobile-mode' : ''}" ${isMobile ? '' : `style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.6);
                    z-index: 10001;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    box-sizing: border-box;
                "`}>
                    <div class="add-panel-dialog ${isMobile ? 'mobile-mode' : ''}" ${isMobile ? '' : `style="
                        background: var(--theme-bg-primary, #1a1a1a);
                        border: 1px solid var(--theme-border-color, #333);
                        border-radius: 8px;
                        padding: 24px;
                        min-width: 400px;
                        max-width: 500px;
                        width: 100%;
                        max-height: 90vh;
                        overflow-y: auto;
                        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                    "`}>
                        <div class="dialog-header" style="
                            margin-bottom: 20px;
                            border-bottom: 1px solid var(--theme-border-color, #333);
                            padding-bottom: 16px;
                        ">
                            <h3 style="margin: 0; color: var(--theme-text-primary, #ffffff);">增加新面板</h3>
                        </div>

                        <div class="dialog-body">
                            <div class="form-group" style="margin-bottom: 16px;">
                                <label for="panel-name-input" style="
                                    display: block;
                                    margin-bottom: 8px;
                                    font-weight: 500;
                                    color: var(--theme-text-primary, #ffffff);
                                ">面板名称：</label>
                                <input
                                    type="text"
                                    id="panel-name-input"
                                    placeholder="请输入面板名称（如：自定义面板）"
                                    style="
                                        width: 100%;
                                        padding: 10px;
                                        border: 1px solid var(--theme-border-color, #333);
                                        border-radius: 4px;
                                        font-size: 14px;
                                        box-sizing: border-box;
                                        background: var(--theme-bg-secondary, #2d2d2d);
                                        color: var(--theme-text-primary, #ffffff);
                                    "
                                />
                            </div>

                            <div class="form-group" style="margin-bottom: 20px;">
                                <label for="panel-id-input" style="
                                    display: block;
                                    margin-bottom: 8px;
                                    font-weight: 500;
                                    color: var(--theme-text-primary, #ffffff);
                                ">面板ID：</label>
                                <input
                                    type="text"
                                    id="panel-id-input"
                                    placeholder="自动生成（可手动修改）"
                                    style="
                                        width: 100%;
                                        padding: 10px;
                                        border: 1px solid var(--theme-border-color, #333);
                                        border-radius: 4px;
                                        font-size: 14px;
                                        box-sizing: border-box;
                                        background: var(--theme-bg-secondary, #2d2d2d);
                                        color: var(--theme-text-primary, #ffffff);
                                    "
                                />
                            </div>

                            <div class="form-note" style="
                                background: var(--theme-bg-secondary, #2d2d2d);
                                border: 1px solid var(--theme-border-color, #333);
                                padding: 12px;
                                border-radius: 4px;
                                font-size: 13px;
                                color: var(--theme-text-secondary, #cccccc);
                                margin-bottom: 20px;
                            ">
                                <strong>说明：</strong>新增的面板将作为自定义面板添加到表格中，您可以在其中添加自定义字段和数据。
                            </div>
                        </div>

                        <div class="dialog-footer" style="
                            display: flex;
                            justify-content: flex-end;
                            gap: 12px;
                            padding-top: 16px;
                            border-top: 1px solid var(--theme-border-color, #333);
                        ">
                            <button class="btn-cancel" style="
                                padding: 10px 16px;
                                border: 1px solid var(--theme-border-color, #333);
                                background: var(--theme-bg-secondary, #2d2d2d);
                                color: var(--theme-text-primary, #ffffff);
                                border-radius: 4px;
                                cursor: pointer;
                                transition: all 0.3s ease;
                            ">取消</button>
                            <button class="btn-confirm" style="
                                padding: 10px 16px;
                                border: none;
                                background: var(--theme-primary-color, #4299e1);
                                color: var(--theme-text-primary, #ffffff);
                                border-radius: 4px;
                                cursor: pointer;
                                transition: all 0.3s ease;
                            ">确认添加</button>
                        </div>
                    </div>
                </div>
            `;

            // 添加对话框到页面
            document.body.insertAdjacentHTML('beforeend', dialogHtml);

            // 绑定事件
            this.bindAddPanelDialogEvents();

        } catch (error) {
            console.error('[DataTable] ❌ 显示增加面板对话框失败:', error);
            this.showErrorMessage('显示对话框失败: ' + error.message);
        }
    }

    /**
     * 🆕 绑定增加面板对话框事件
     */
    bindAddPanelDialogEvents() {
        const dialog = document.querySelector('.add-panel-dialog-overlay');
        if (!dialog) return;

        const nameInput = dialog.querySelector('#panel-name-input');
        const idInput = dialog.querySelector('#panel-id-input');
        const cancelBtn = dialog.querySelector('.btn-cancel');
        const confirmBtn = dialog.querySelector('.btn-confirm');

        // 面板名称输入时自动生成ID
        nameInput?.addEventListener('input', (e) => {
            const name = e.target.value.trim();
            if (name && !idInput.value) {
                // 生成英文ID：将中文转换为拼音或使用通用前缀
                let id = '';

                // 简单的中文到英文映射
                const chineseToEnglish = {
                    '测试': 'test',
                    '面板': 'panel',
                    '自定义': 'custom',
                    '用户': 'user',
                    '数据': 'data',
                    '信息': 'info',
                    '管理': 'manage',
                    '设置': 'setting'
                };

                // 尝试转换中文词汇
                let converted = name;
                Object.entries(chineseToEnglish).forEach(([chinese, english]) => {
                    converted = converted.replace(new RegExp(chinese, 'g'), english);
                });

                // 移除非英文字符，只保留字母、数字、下划线
                id = converted
                    .replace(/[^a-zA-Z0-9]/g, '_')
                    .replace(/_{2,}/g, '_')
                    .replace(/^_|_$/g, '')
                    .toLowerCase();

                // 如果转换后为空或无效，使用默认前缀
                if (!id || !/^[a-zA-Z]/.test(id)) {
                    id = 'custom_panel_' + Date.now().toString().slice(-6);
                }

                idInput.value = id;
            }
        });

        // 取消按钮
        cancelBtn?.addEventListener('click', () => {
            this.closeAddPanelDialog();
        });

        // 确认按钮
        confirmBtn?.addEventListener('click', () => {
            this.executeAddPanel();
        });

        // 点击遮罩层关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                this.closeAddPanelDialog();
            }
        });

        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAddPanelDialog();
            }
        });

        // 聚焦到名称输入框
        nameInput?.focus();
    }

    /**
     * 🆕 关闭增加面板对话框
     */
    closeAddPanelDialog() {
        const dialog = document.querySelector('.add-panel-dialog-overlay');
        if (dialog) {
            dialog.remove();
        }
    }

    /**
     * 🆕 执行增加面板操作
     */
    async executeAddPanel() {
        try {
            const dialog = document.querySelector('.add-panel-dialog-overlay');
            if (!dialog) return;

            const nameInput = dialog.querySelector('#panel-name-input');
            const idInput = dialog.querySelector('#panel-id-input');

            const panelName = nameInput?.value?.trim();
            const panelId = idInput?.value?.trim();

            // 验证输入
            if (!panelName) {
                this.showErrorMessage('请输入面板名称');
                nameInput?.focus();
                return;
            }

            if (!panelId) {
                this.showErrorMessage('请输入面板ID');
                idInput?.focus();
                return;
            }

            // 验证ID格式（只允许字母、数字、下划线）
            if (!/^[a-zA-Z0-9_]+$/.test(panelId)) {
                this.showErrorMessage('面板ID只能包含字母、数字和下划线');
                idInput?.focus();
                return;
            }

            // 检查ID是否已存在
            const existingPanel = document.querySelector(`[data-panel="${panelId}"]`);
            if (existingPanel) {
                this.showErrorMessage('该面板ID已存在，请使用其他ID');
                idInput?.focus();
                return;
            }

            console.log(`[DataTable] 🆕 创建新面板: ${panelName} (${panelId})`);

            // 创建新面板
            await this.createNewPanel(panelId, panelName);

            // 关闭对话框
            this.closeAddPanelDialog();

            // 显示成功消息
            this.showSuccessMessage(`面板 "${panelName}" 已成功添加`);

        } catch (error) {
            console.error('[DataTable] ❌ 执行增加面板失败:', error);
            this.showErrorMessage('添加面板失败: ' + error.message);
        }
    }

    /**
     * 🆕 创建新面板
     */
    async createNewPanel(panelId, panelName) {
        try {
            console.log(`[DataTable] 🔨 创建新面板: ${panelName} (${panelId})`);

            // 创建新面板配置
            const newPanel = {
                id: panelId,
                name: panelName,
                type: 'custom',
                count: 3, // 默认3个字段
                subItems: [
                    { key: 'field1', name: '字段1', type: 'text' },
                    { key: 'field2', name: '字段2', type: 'text' },
                    { key: 'field3', name: '字段3', type: 'text' }
                ]
            };

            // 生成面板HTML
            const panelHtml = this.createPanelGroup(newPanel);

            // 找到表格容器
            const groupedTables = this.modal.querySelector('.grouped-tables');
            if (!groupedTables) {
                throw new Error('未找到表格容器');
            }

            // 将新面板添加到表格末尾
            groupedTables.insertAdjacentHTML('beforeend', panelHtml);

            // 初始化新面板的数据
            console.log(`[DataTable] 🔧 开始初始化面板数据: ${panelId}`);
            await this.initializeNewPanelData(panelId);
            console.log(`[DataTable] ✅ 面板数据初始化完成: ${panelId}`);

            // 重新绑定事件（因为添加了新的DOM元素）
            this.bindNewEvents();

            console.log(`[DataTable] ✅ 新面板 "${panelName}" 创建完成`);

        } catch (error) {
            console.error('[DataTable] ❌ 创建新面板失败:', error);
            throw error;
        }
    }

    /**
     * 🆕 初始化新面板数据
     */
    async initializeNewPanelData(panelId) {
        try {
            console.log(`[DataTable] 🔧 开始初始化面板数据: ${panelId}`);

            // 创建空的面板数据
            const emptyData = [{
                id: `${panelId}_1`,
                rowData: {
                    'col_1': '',
                    'col_2': '',
                    'col_3': ''
                }
            }];

            // 保存到数据核心
            const dataCore = window.InfoBarData;
            if (dataCore && typeof dataCore.setData === 'function') {
                dataCore.setData(panelId, emptyData);
                console.log(`[DataTable] 📊 初始化面板 ${panelId} 数据完成`);
            } else {
                console.warn(`[DataTable] ⚠️ 数据核心不可用，跳过数据初始化`);
            }

            // 注册面板到设置中进行持久化保存
            console.log(`[DataTable] 🔧 开始注册面板到设置: ${panelId}`);
            const infoBarSettings = window.SillyTavernInfobar?.modules?.settings;
            console.log(`[DataTable] 📊 Settings模块存在:`, !!infoBarSettings);
            console.log(`[DataTable] 📊 addCustomPanel方法存在:`, typeof infoBarSettings?.addCustomPanel === 'function');

            if (infoBarSettings && typeof infoBarSettings.saveCustomPanel === 'function') {
                // 创建符合InfoBarSettings要求的面板数据格式
                const displayName = this.getDisplayNameForPanel(panelId);
                console.log(`[DataTable] 📊 面板显示名称: ${displayName}`);

                const panelData = {
                    id: panelId,
                    key: panelId,
                    name: displayName,
                    description: `自定义面板：${displayName}`,
                    icon: '📊',
                    type: 'custom',
                    enabled: true,
                    subItems: [
                        { key: 'field1', name: '字段1', type: 'text', enabled: true },
                        { key: 'field2', name: '字段2', type: 'text', enabled: true },
                        { key: 'field3', name: '字段3', type: 'text', enabled: true }
                    ],
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };

                console.log(`[DataTable] 📊 准备保存面板数据:`, panelData);
                await infoBarSettings.saveCustomPanel(panelData);
                console.log(`[DataTable] 💾 面板 ${panelId} 已注册到设置并持久化保存`);
            } else {
                console.warn(`[DataTable] ⚠️ saveCustomPanel方法不可用，跳过持久化保存`);
            }

        } catch (error) {
            console.error('[DataTable] ❌ 初始化新面板数据失败:', error);
        }
    }

    /**
     * 🆕 获取面板的显示名称
     */
    getDisplayNameForPanel(panelId) {
        // 从当前DOM中查找面板的显示名称
        const panelElement = document.querySelector(`[data-panel="${panelId}"]`);
        if (panelElement) {
            const groupName = panelElement.querySelector('.group-name')?.textContent?.trim();
            if (groupName) {
                return groupName;
            }
        }

        // 如果找不到，返回默认名称
        return panelId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // 复选框相关方法已删除 - 不再需要复选框功能

    // 工具栏操作方法已移除，保持界面简洁
    // refreshData() 方法已被移除

    /**
     * 创建表格容器
     */
    createTableContainer() {
        return `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr class="table-header">
                            <!-- 动态生成列头 -->
                        </tr>
                    </thead>
                    <tbody class="table-body">
                        <!-- 动态生成数据行 -->
                    </tbody>
                </table>
                
                <div class="table-loading" style="display: none;">
                    <div class="loading-spinner"></div>
                    <span>加载中...</span>
                </div>
                
                <div class="table-empty" style="display: none;">
                    
                    <h3>暂无数据</h3>
                    <p>还没有任何数据记录</p>
                    <button class="btn btn-primary" data-action="add-data">添加数据</button>
                </div>
            </div>
        `;
    }

    /**
     * 创建分页组件
     */
    createPagination() {
        return `
            <div class="table-pagination">
                <div class="pagination-info">
                    <span>显示 <span class="current-range">1-20</span> 条，共 <span class="total-items">0</span> 条</span>
                    
                    <select class="page-size-select">
                        <option value="10">10条/页</option>
                        <option value="20" selected>20条/页</option>
                        <option value="50">50条/页</option>
                        <option value="100">100条/页</option>
                    </select>
                </div>
                
                <div class="pagination-controls">
                    <button class="btn btn-small" data-action="first-page" disabled>首页</button>
                    <button class="btn btn-small" data-action="prev-page" disabled>上一页</button>
                    
                    <div class="page-numbers">
                        <!-- 动态生成页码 -->
                    </div>
                    
                    <button class="btn btn-small" data-action="next-page" disabled>下一页</button>
                    <button class="btn btn-small" data-action="last-page" disabled>末页</button>
                </div>
            </div>
        `;
    }
    /**
     * 初始化表格列配置
     */
    initColumns() {
        this.columns = [
            {
                key: 'id',
                title: 'ID',
                width: '60px',
                sortable: true,
                type: 'text'
            },
            {
                key: 'panel',
                title: '面板',
                width: '120px',
                sortable: true,
                type: 'text',
                formatter: (value) => {
                    // 面板名称映射
                    const panelMap = {
                        'personal': '个人信息',
                        'world': '世界设定',
                        'abilities': '能力属性',
                        'plot': '剧情进展',
                        'tasks': '任务管理',
                        'organization': '组织信息',
                        'news': '新闻资讯',
                        'cultivation': '修炼境界',
                        'fantasy': '奇幻设定',
                        'modern': '现代背景',
                        'historical': '历史背景',
                        'magic': '魔法系统',
                        'training': '训练记录'
                    };
                    return panelMap[value] || value;
                }
            },
            {
                key: 'field',
                title: '字段',
                width: '120px',
                sortable: true,
                type: 'text'
            },
            {
                key: 'content',
                title: '内容',
                width: '200px',
                sortable: false,
                type: 'text'
            },
            {
                key: 'timestamp',
                title: '更新时间',
                width: '150px',
                sortable: true,
                type: 'datetime',
                formatter: (value) => new Date(value).toLocaleString()
            },
            {
                key: 'content',
                title: '内容',
                width: '300px',
                sortable: false,
                type: 'text',
                formatter: (value) => {
                    if (typeof value === 'object') {
                        return JSON.stringify(value).substring(0, 100) + '...';
                    }
                    return String(value).substring(0, 100) + (value.length > 100 ? '...' : '');
                }
            },
            {
                key: 'status',
                title: '状态',
                width: '80px',
                sortable: true,
                type: 'status',
                formatter: (value) => {
                    const statusMap = {
                        'active': '<span class="status-badge status-active">活跃</span>',
                        'inactive': '<span class="status-badge status-inactive">非活跃</span>',
                        'archived': '<span class="status-badge status-archived">已归档</span>'
                    };
                    return statusMap[value] || value;
                }
            },
            {
                key: 'actions',
                title: '操作',
                width: '120px',
                sortable: false,
                type: 'actions',
                formatter: (value, row) => {
                    return `
                        <div class="action-buttons">
                            <button class="btn btn-small" data-action="view" data-id="${row.id}">查看</button>
                            <button class="btn btn-small" data-action="edit" data-id="${row.id}">编辑</button>
                            <button class="btn btn-small btn-danger" data-action="delete" data-id="${row.id}">删除</button>
                        </div>
                    `;
                }
            }
        ];
    }

    /**
     * 加载数据
     */
    async loadData() {
        try {
            console.log('[DataTable] 📥 开始加载数据...');

            if (!this.dataCore) {
                throw new Error('数据核心未初始化');
            }

            this.showLoading(true);

            // 获取当前聊天ID
            const currentChatId = this.dataCore.getCurrentChatId();
            console.log('[DataTable] 📍 当前聊天ID:', currentChatId);

            if (currentChatId) {
                // 从数据核心获取当前聊天的面板数据
                const chatData = await this.dataCore.getChatData(currentChatId);
                console.log('[DataTable] 📊 聊天数据:', chatData);

                // 转换面板数据格式
                this.data = this.transformPanelData(chatData);
            } else {
                console.warn('[DataTable] ⚠️ 无法获取当前聊天ID，显示空数据');
                this.data = [];
            }

            // 应用筛选
            this.applyFilters();

            // 渲染表格（检查模态框是否存在）
            if (this.modal) {
                this.renderTable();
            } else {
                console.warn('[DataTable] ⚠️ 模态框不存在，跳过表格渲染');
            }

            this.showLoading(false);

            console.log(`[DataTable] ✅ 数据加载完成，共 ${this.data.length} 条记录`);

        } catch (error) {
            console.error('[DataTable] ❌ 加载数据失败:', error);
            this.showLoading(false);
            this.showEmpty(true);
            this.handleError(error);
        }
    }

    /**
     * 转换数据格式
     */
    transformData(rawData) {
        const transformedData = [];
        let idCounter = 1;
        
        // 处理全局数据
        if (rawData.global) {
            for (const [key, value] of Object.entries(rawData.global)) {
                transformedData.push({
                    id: idCounter++,
                    timestamp: Date.now(),
                    category: 'system',
                    title: key,
                    content: value,
                    status: 'active',
                    source: 'global'
                });
            }
        }
        
        // 处理聊天数据
        if (rawData.chat) {
            for (const [key, value] of Object.entries(rawData.chat)) {
                transformedData.push({
                    id: idCounter++,
                    timestamp: Date.now(),
                    category: 'chat',
                    title: key,
                    content: value,
                    status: 'active',
                    source: 'chat'
                });
            }
        }
        
        return transformedData;
    }

    /**
     * 从聊天数据中提取面板数据（兼容新旧格式）
     */
    extractPanelsFromChatData(chatData) {
        if (!chatData) {
            return null;
        }

        // 检查是否是数组格式（新格式）
        if (Array.isArray(chatData)) {
            console.log('[DataTable] 🔍 检测到数组格式数据，尝试提取面板数据...');
            // 查找包含panels的数据项
            for (const item of chatData) {
                if (item && item.panels) {
                    console.log('[DataTable] ✅ 从数组项中找到面板数据:', Object.keys(item.panels));
                    return item.panels;
                }
                // 兼容：数组项中如果嵌套了 infobar_data.panels 也进行提取
                if (item && item.infobar_data && item.infobar_data.panels) {
                    console.log('[DataTable] ✅ 从数组项的infobar_data中找到面板数据:', Object.keys(item.infobar_data.panels));
                    return item.infobar_data.panels;
                }
            }
            // 兼容：数组对象本身可能挂载了 infobar_data 属性（如 chatData.infobar_data.panels）
            if (chatData.infobar_data && chatData.infobar_data.panels) {
                console.log('[DataTable] ✅ 从数组对象的附加属性中找到面板数据:', Object.keys(chatData.infobar_data.panels));
                return chatData.infobar_data.panels;
            }
            console.log('[DataTable] 📊 数组格式中没有找到面板数据');
            return null;
        }
        // 检查是否是对象格式（旧格式）
        else if (chatData.infobar_data && chatData.infobar_data.panels) {
            console.log('[DataTable] 🔍 从对象格式中找到面板数据:', Object.keys(chatData.infobar_data.panels));
            return chatData.infobar_data.panels;
        }

        console.log('[DataTable] 📊 没有找到面板数据，数据格式不匹配');
        console.log('[DataTable] 🔍 数据结构:', typeof chatData, Array.isArray(chatData) ? '数组' : '对象');
        return null;
    }

    /**
     * 🚀 转换面板数据格式 - 支持多行数据
     */
    transformPanelData(chatData) {
        try {
            const transformedData = [];

            // 使用辅助函数提取面板数据
            const panels = this.extractPanelsFromChatData(chatData);

            if (!panels) {
                console.log('[DataTable] 📊 没有找到面板数据');
                return [];
            }

            let idCounter = 1;

            // 转换每个面板的数据
            Object.entries(panels).forEach(([panelName, panelData]) => {
                console.log(`[DataTable] 🔍 处理面板: ${panelName}`, panelData);

                // 🚀 检查是否是多行数据格式（数组）
                if (Array.isArray(panelData)) {
                    console.log(`[DataTable] 📊 检测到多行数据格式: ${panelName} (${panelData.length}行)`);

                    // 处理多行数据
                    panelData.forEach((rowData, rowIndex) => {
                        if (rowData && typeof rowData === 'object') {
                            // 为每行数据创建一个表格行
                            const rowContent = this.formatRowData(rowData);

                            transformedData.push({
                                id: idCounter++,
                                timestamp: rowData.lastUpdated || Date.now(),
                                category: 'panel',
                                panel: panelName,
                                title: `${panelName} - 行${rowIndex + 1}`,
                                field: `row_${rowIndex + 1}`,
                                content: rowContent,
                                status: 'active',
                                source: rowData.source || 'multi-row',
                                rowIndex: rowIndex,
                                rowData: rowData
                            });
                        }
                    });
                } else if (panelData && typeof panelData === 'object') {
                    // 🔧 处理单行数据格式（向后兼容）- 修复旧架构数据显示
                    console.log(`[DataTable] 📊 检测到单行数据格式: ${panelName}`);

                    // 🆕 特殊处理：交互对象和组织关系面板的多数据前缀格式（npcX. / orgX.）
                    if (panelName === 'interaction' || panelName === 'organization') {
                        const multiRowData = this.convertPrefixDataToMultiRow(panelData, panelName);

                        if (multiRowData.length > 0) {
                            console.log(`[DataTable] 🔄 ${panelName}面板前缀数据转换: ${multiRowData.length}行`);

                            // 为每行前缀数据创建表格项（转换为表格可识别的格式）
                            multiRowData.forEach((rowData, rowIndex) => {
                                const rowContent = this.formatRowData(rowData);

                                transformedData.push({
                                    id: idCounter++,
                                    timestamp: panelData.lastUpdated || Date.now(),
                                    category: 'panel',
                                    panel: panelName,
                                    title: `${panelName} - 行${rowIndex + 1}`,
                                    field: `row_${rowIndex + 1}`,
                                    content: rowContent,
                                    status: 'active',
                                    source: panelData.source || 'legacy-prefix-multirow',
                                    rowIndex: rowIndex,
                                    rowData: rowData
                                });
                            });

                            // 已按前缀完成转换，跳过默认单行合并
                            return;
                        }
                    }

                    // 🆕 默认：将旧架构数据组合成完整的行数据，而不是分割成单独字段
                    const cleanRowData = {};
                    let hasValidData = false;

                    // 提取有效的数据字段（排除元数据）
                    Object.entries(panelData).forEach(([fieldName, fieldValue]) => {
                        // 跳过元数据字段和空值
                        if (!['lastUpdated', 'source', 'enabled'].includes(fieldName) && 
                            fieldValue !== null && 
                            fieldValue !== undefined && 
                            String(fieldValue).trim() !== '') {
                            cleanRowData[fieldName] = fieldValue;
                            hasValidData = true;
                        }
                    });

                    // 如果有有效数据，创建一个完整的行数据项
                    if (hasValidData) {
                        const rowContent = this.formatRowData(cleanRowData);
                        
                        transformedData.push({
                            id: idCounter++,
                            timestamp: panelData.lastUpdated || Date.now(),
                            category: 'panel',
                            panel: panelName,
                            title: `${panelName} - 第1行`,
                            field: 'row_1',
                            content: rowContent,
                            status: 'active',
                            source: panelData.source || 'legacy-single-row',
                            rowIndex: 0,
                            rowData: cleanRowData  // 🔑 关键修复：提供完整的行数据
                        });
                        
                        console.log(`[DataTable] ✅ 旧架构数据转换: ${panelName}`, cleanRowData);
                    } else {
                        console.log(`[DataTable] ⚠️ 面板 ${panelName} 没有有效数据`);
                    }
                }
            });

            console.log(`[DataTable] ✅ 转换完成，共 ${transformedData.length} 条面板数据`);

            // 🔧 修复：交互对象去重（同名同类型同关系/状态视为同一NPC行）
            const seen = new Set();
            const deduped = [];
            transformedData.forEach(item => {
                if (item.panel !== 'interaction' || !item.rowData) {
                    deduped.push(item);
                    return;
                }
                const r = item.rowData || {};
                const key = JSON.stringify([
                    r.col_1 || r['NPC名称'] || '',
                    r.col_2 || r['对象类型'] || '',
                    r.col_4 || r['关系类型'] || '',
                    r.col_3 || r['当前状态'] || ''
                ]);
                if (seen.has(key)) {
                    return; // 跳过重复
                }
                seen.add(key);
                deduped.push(item);
            });

            return deduped;

        } catch (error) {
            console.error('[DataTable] ❌ 转换面板数据格式失败:', error);
            return [];
        }
    }

    /**
     * 🚀 格式化行数据为显示内容（支持新旧架构）
     * @param {Object} rowData - 行数据对象
     * @returns {string} 格式化后的内容
     */
    formatRowData(rowData) {
        try {
            const parts = [];

            // 🔧 检查是否为新架构（col_X格式）
            const colFields = Object.entries(rowData)
                .filter(([key]) => key.startsWith('col_'))
                .sort(([a], [b]) => {
                    const numA = parseInt(a.replace('col_', ''));
                    const numB = parseInt(b.replace('col_', ''));
                    return numA - numB;
                });

            if (colFields.length > 0) {
                // 新架构数据：显示col_X格式
                colFields.forEach(([key, value]) => {
                    if (this.isValidDisplayValue(value)) {
                        const colNum = key.replace('col_', '');
                        parts.push(`列${colNum}: ${value}`);
                    }
                });
            } else {
                // 🆕 旧架构数据：转换旧字段名为显示名称
                const legacyFields = this.convertLegacyFieldsToDisplay(rowData);
                legacyFields.forEach(({ displayName, value }) => {
                    if (this.isValidDisplayValue(value)) {
                        parts.push(`${displayName}: ${value}`);
                    }
                });
            }

            return parts.length > 0 ? parts.join(' | ') : '暂无有效数据';

        } catch (error) {
            console.error('[DataTable] ❌ 格式化行数据失败:', error);
            return JSON.stringify(rowData);
        }
    }
    /**
     * 🆕 将旧架构字段转换为显示格式
     * @param {Object} rowData - 行数据对象
     * @returns {Array} 转换后的字段数组
     */
    convertLegacyFieldsToDisplay(rowData) {
        try {
            const legacyFields = [];
            
            // 🔧 旧架构字段映射表（按常见字段优先级排序）
            const legacyFieldMappings = {
                // 个人信息面板
                'name': '姓名',
                'age': '年龄', 
                'gender': '性别',
                'occupation': '职业',
                'appearance': '外貌',
                'personality': '性格',
                'background': '背景',
                'status': '状态',
                'location': '位置',
                'emotion': '情绪',
                'relationship': '关系',
                'notes': '备注',
                
                // 世界信息面板
                'world_name': '世界名称',
                'type': '类型',
                'genre': '风格',
                'geography': '地理环境',
                'locations': '重要地点',
                'time': '时间设定',
                'culture': '文化',
                'theme': '主题',
                'history': '历史',
                
                // 交互对象面板
                'name': 'NPC名称',
                'type': 'NPC类型', 
                'relation': '关系类型',
                'status': '当前状态',
                'description': '描述',
                'notes': '备注',
                'extra': '额外信息',
                'npc_name': 'NPC名称',
                'npc_type': 'NPC类型',
                'current_state': '当前状态',
                'relation_type': '关系类型',
                'intimacy': '亲密度',
                'interaction_history': '历史记录',
                'auto_notes': '自动记录',
                
                // 任务状态面板
                'task_name': '任务名称',
                'task_type': '任务类型',
                'task_status': '任务状态',
                'progress': '进度',
                'deadline': '截止时间',
                'priority': '优先级',
                'description': '描述',
                
                // 组织关系面板
                'name': '组织名称',
                'type': '组织类型',
                'level': '层级',
                'leader': '负责人',
                'description': '描述',
                'org_name': '组织名称',
                'org_type': '组织类型',
                'hierarchy': '层级',
                'leader': '负责人',
                'member_count': '成员数量',
                
                // 物品清单面板
                'item_name': '物品名称',
                'item_type': '物品类型',
                'quantity': '数量',
                'condition': '状态',
                'value': '价值',
                'special_properties': '特殊属性',
                
                // 能力属性面板
                'ability_name': '能力名称',
                'level': '等级',
                'experience': '经验值',
                'category': '类别',
                'effect': '效果'
            };

            // 按字段名排序处理，确保显示顺序一致
            const sortedFields = Object.entries(rowData)
                .filter(([key, value]) => 
                    key !== 'enabled' && 
                    key !== 'lastUpdated' && 
                    !key.startsWith('_') &&
                    this.isValidDisplayValue(value)
                )
                .sort(([a], [b]) => {
                    // 优先显示有映射的字段
                    const aMapped = legacyFieldMappings[a] ? 1 : 0;
                    const bMapped = legacyFieldMappings[b] ? 1 : 0;
                    if (aMapped !== bMapped) return bMapped - aMapped;
                    
                    // 其次按字母顺序
                    return a.localeCompare(b);
                });

            sortedFields.forEach(([fieldKey, value]) => {
                const displayName = legacyFieldMappings[fieldKey] || fieldKey;
                legacyFields.push({ displayName, value });
                console.log(`[DataTable] 🔄 旧字段转换: ${fieldKey} => ${displayName}`);
            });

            return legacyFields;

        } catch (error) {
            console.error('[DataTable] ❌ 转换旧架构字段失败:', error);
            return [];
        }
    }

    /**
     * 🔧 检查值是否适合显示
     * @param {*} value - 要检查的值
     * @returns {boolean}
     */
    isValidDisplayValue(value) {
        return value !== null && 
               value !== undefined && 
               value !== '' && 
               String(value).trim() !== '' &&
               String(value).trim() !== '-';
    }

    /**
     * 🆕 将中文显示名称映射回旧架构字段名
     * @param {string} displayName - 中文显示名称
     * @param {string} panelKey - 面板键名
     * @returns {string} 旧架构字段名
     */
    mapDisplayNameToLegacyField(displayName, panelKey) {
        try {
            // 反向映射表：中文显示名 -> 旧架构字段名
            const reverseMappings = {
                // 个人信息面板
                '姓名': 'name',
                '年龄': 'age', 
                '性别': 'gender',
                '职业': 'occupation',
                '外貌': 'appearance',
                '性格': 'personality',
                '背景': 'background',
                '状态': 'status',
                '位置': 'location',
                '情绪': 'emotion',
                '关系': 'relationship',
                '备注': 'notes',
                
                // 世界信息面板
                '世界名称': 'name',
                '类型': 'type',
                '风格': 'genre',
                '地理环境': 'geography',
                '重要地点': 'locations',
                '时间设定': 'time',
                '文化': 'culture',
                '主题': 'theme',
                '历史': 'history',
                
                // 交互对象面板
                'NPC名称': 'name',
                '对象名称': 'name', 
                'NPC类型': 'type',
                '对象类型': 'type', 
                '关系类型': 'relation',
                '当前状态': 'status',
                '描述': 'description',
                '备注': 'notes',
                '额外信息': 'extra',
                '亲密度': 'intimacy',
                '历史记录': 'history',
                '自动记录': 'autoRecord',
                
                // 组织关系面板
                '组织名称': 'name',
                '组织类型': 'type',
                '层级': 'level',
                '层级结构': 'hierarchy',
                '负责人': 'leader',
                '职位设置': 'positions',
                '成员管理': 'members',
                '描述': 'description',
                
                // 任务状态面板
                '任务创建': 'creation',
                '任务编辑': 'editing',
                '任务删除': 'deletion',
                '任务完成': 'completion',
                '通知提醒': 'notifications',
                '列表视图': 'listView',
                '排序功能': 'sorting',

                // 新闻事件面板
                '突发新闻': 'breaking',
                '政治新闻': 'politics',
                '经济新闻': 'economy',
                '官方公告': 'official',
                '新闻创建': 'creation',

                // 物品清单面板
                '物品存储': 'storage',
                '物品取出': 'retrieval',
                '物品整理': 'organization',
                '武器装备': 'weapons',
                '防具装备': 'armor',
                '容量管理': 'capacity',

                // 能力属性面板
                '力量属性': 'strength',
                '敏捷属性': 'agility',
                '智力属性': 'intelligence',
                '剑术技能': 'swordsmanship',
                '魔法技能': 'magic',

                // 剧情进展面板
                '主线剧情': 'mainStory',
                '支线任务': 'sideQuests',
                '子剧情': 'subplots',
                '背景说明': 'exposition',

                // 修炼境界面板
                '炼气期': 'qiRefining',
                '筑基期': 'foundation',
                '金丹期': 'goldenCore',
                '呼吸法': 'breathingTechnique',
                '灵力值': 'spiritualPower',

                // 奇幻设定面板
                '人类种族': 'human',
                '精灵种族': 'elf',
                '矮人种族': 'dwarf',
                '火系魔法': 'fireMagic',

                // 现代背景面板
                '城市环境': 'city',
                '区域设定': 'district',
                '交通工具': 'transport',
                '职业工作': 'job',
                '收入水平': 'income',
                '智能手机': 'smartphone',
                '社交媒体': 'social',

                // 历史背景面板
                '朝代背景': 'dynasty',
                '历史时期': 'period',
                '社会阶层': 'class',
                '家族背景': 'family',
                '教育程度': 'education',
                '武艺修为': 'martial',
                '服饰风格': 'clothing',
                '职业身份': 'profession',

                // 魔法系统面板
                '塑能系': 'evocation',
                '幻术系': 'illusion',
                '戏法法术': 'cantrip',
                '法术等级': 'level',
                '法力值': 'mana',
                '法术书': 'spellbook',
                '火元素': 'fire',
                '等级1': 'level1',

                // 通用字段
                '名称': 'name',
                '类型': 'type',
                '状态': 'status',
                '描述': 'description',
                '备注': 'notes'
            };

            return reverseMappings[displayName] || null;
        } catch (error) {
            console.warn('[DataTable] ⚠️ 显示名称映射失败:', error);
            return null;
        }
    }

    /**
     * 🆕 将前缀数据转换为多行数据（处理 npcX. / orgX. 格式）
     * @param {Object} panelData - 面板数据对象
     * @param {string} panelName - 面板名称 
     * @returns {Array} 多行数据数组
     */
    convertPrefixDataToMultiRow(panelData, panelName) {
        try {
            console.log(`[DataTable] 🔄 开始转换${panelName}面板的前缀数据...`);
            
            const prefixPattern = panelName === 'interaction' ? /^npc(\d+)\.(.+)$/ : /^org(\d+)\.(.+)$/;
            const multiRowMap = new Map(); // 使用Map按索引组织数据
            
            // 🔍 扫描所有前缀字段
            Object.entries(panelData).forEach(([fieldName, fieldValue]) => {
                const match = fieldName.match(prefixPattern);
                if (match) {
                    const [, index, fieldKey] = match;
                    const rowIndex = parseInt(index);
                    
                    if (!multiRowMap.has(rowIndex)) {
                        multiRowMap.set(rowIndex, {});
                    }
                    
                    // 🔧 保持旧字段名，让formatRowData进行转换显示
                    multiRowMap.get(rowIndex)[fieldKey] = fieldValue;
                    
                    console.log(`[DataTable] 🔍 前缀字段提取: ${fieldName} -> ${fieldKey} = "${fieldValue}"`);
                }
            });
            
            // 🔄 将Map转换为数组，确保按索引顺序
            const multiRowData = [];
            const sortedIndices = Array.from(multiRowMap.keys()).sort((a, b) => a - b);
            
            sortedIndices.forEach(index => {
                const rowData = multiRowMap.get(index);
                if (Object.keys(rowData).length > 0) {
                    multiRowData.push(rowData);
                    console.log(`[DataTable] ✅ 转换行${index}:`, rowData);
                }
            });
            
            console.log(`[DataTable] 🎉 ${panelName}面板前缀数据转换完成: ${multiRowData.length}行`);
            return multiRowData;
            
        } catch (error) {
            console.error('[DataTable] ❌ 前缀数据转换失败:', error);
            return [];
        }
    }

    /**
     * 应用筛选
     */
    applyFilters() {
        try {
            let filtered = [...this.data];
            
            // 搜索筛选 - 已移除搜索功能
            // 搜索功能已被移除以简化界面
            
            // 分类筛选
            if (this.filters.category) {
                filtered = filtered.filter(item => item.category === this.filters.category);
            }
            
            // 状态筛选
            if (this.filters.status) {
                filtered = filtered.filter(item => item.status === this.filters.status);
            }
            
            // 日期范围筛选
            if (this.filters.dateRange.start) {
                const startDate = new Date(this.filters.dateRange.start).getTime();
                filtered = filtered.filter(item => item.timestamp >= startDate);
            }
            
            if (this.filters.dateRange.end) {
                const endDate = new Date(this.filters.dateRange.end).getTime() + 24 * 60 * 60 * 1000; // 包含结束日期
                filtered = filtered.filter(item => item.timestamp <= endDate);
            }
            
            // 排序
            if (this.sorting.column) {
                filtered.sort((a, b) => {
                    const aValue = a[this.sorting.column];
                    const bValue = b[this.sorting.column];
                    
                    let comparison = 0;
                    if (aValue < bValue) comparison = -1;
                    if (aValue > bValue) comparison = 1;
                    
                    return this.sorting.direction === 'desc' ? -comparison : comparison;
                });
            }
            
            this.filteredData = filtered;
            
            // 更新分页信息
            this.updatePagination();
            
            console.log(`[DataTable] 🔍 筛选完成，显示 ${filtered.length} 条记录`);
            
        } catch (error) {
            console.error('[DataTable] ❌ 应用筛选失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 更新分页信息
     */
    updatePagination() {
        this.pagination.totalItems = this.filteredData.length;
        this.pagination.totalPages = Math.ceil(this.pagination.totalItems / this.pagination.pageSize);
        
        // 确保当前页在有效范围内
        if (this.pagination.currentPage > this.pagination.totalPages) {
            this.pagination.currentPage = Math.max(1, this.pagination.totalPages);
        }
    }

    /**
     * 🔧 智能表格渲染 - 基于持久化机制
     */
    renderTable() {
        try {
            // 检查模态框是否存在
            if (!this.modal) {
                console.warn('[DataTable] ⚠️ 模态框不存在，跳过表格渲染');
                return;
            }

            if (this.filteredData.length === 0) {
                this.showEmpty(true);
                return;
            }

            this.showEmpty(false);

            // 🔧 计算当前数据的哈希值
            const currentDataHash = this.calculateDataHash(this.filteredData);
            console.log('[DataTable] 🔍 当前数据哈希:', currentDataHash);

            // 检查是否存在表格结构
            const groupedTables = this.modal.querySelector('.grouped-tables');
            const hasExistingStructure = !!groupedTables;

            // 🔧 智能决策：是否需要重建表格结构
            let shouldRebuildStructure = false;

            if (!groupedTables) {
                // 情况1：没有表格结构
                console.log('[DataTable] 🔄 没有表格结构，需要重新生成');
                shouldRebuildStructure = true;
            } else if (this.tableState.lastDataHash !== currentDataHash) {
                // 情况2：数据结构发生变化
                console.log('[DataTable] 🔄 数据结构变化，需要重新生成表格');
                console.log(`[DataTable] 📊 旧哈希: ${this.tableState.lastDataHash}, 新哈希: ${currentDataHash}`);
                shouldRebuildStructure = true;
            } else {
                // 情况3：数据结构未变化，只需更新数据内容
                console.log('[DataTable] 🔄 数据结构未变化，只更新数据内容');
                shouldRebuildStructure = false;
            }

            if (shouldRebuildStructure) {
                // 重建表格结构
                console.log('[DataTable] 🏗️ 重建表格结构...');
                const modalBody = this.modal.querySelector('.modal-body');
                if (modalBody) {
                    modalBody.innerHTML = this.createGroupedTables();

                    // 重新绑定事件
                    this.bindNewEvents();

                    // 重新应用当前主题
                    const currentTheme = this.getCurrentTheme();
                    if (currentTheme) {
                        this.applyTheme(currentTheme);
                    }

                    // 🔧 修复：更新表格状态并持久化保存哈希值
                    this.tableState.lastDataHash = currentDataHash;
                    this.savePersistedDataHash(currentDataHash); // 持久化保存
                    this.tableState.initialized = true;

                    console.log('[DataTable] ✅ 表格结构重建完成');
                }
            } else {
                // 只更新数据内容，保持表格结构
                console.log('[DataTable] 🔄 智能更新：只更新数据内容');
                this.updateGroupedTablesDataSmart();

                // 🔧 修复：智能更新时也要保存哈希值并持久化
                this.tableState.lastDataHash = currentDataHash;
                this.savePersistedDataHash(currentDataHash); // 持久化保存
                console.log('[DataTable] ✅ 智能更新完成，哈希值已保存');
            }

            // 更新数据统计
            this.updateTableData();

            console.log('[DataTable] 🎨 分组表格渲染完成');

        } catch (error) {
            console.error('[DataTable] ❌ 渲染表格失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 更新表格数据
     */
    updateTableData() {
        if (!this.modal) return;

        // 更新记录计数
        const countElement = this.modal.querySelector('.count-number');
        if (countElement) {
            const totalRecords = this.data ? this.data.length : 0;
            countElement.textContent = totalRecords;
        }

        // 更新状态文本
        const statusText = this.modal.querySelector('.status-text');
        if (statusText) {
            statusText.textContent = '数据加载完成';
        }

        console.log('[DataTable] 📊 表格数据已更新');
    }

    /**
     * 更新分组表格数据
     */
    async updateGroupedTablesData() {
        try {
            if (!this.modal) return;

            // 获取所有表格组
            const tableGroups = this.modal.querySelectorAll('.table-group');

            // 使用 Promise.all 并行更新所有面板
            const updatePromises = Array.from(tableGroups).map(async (group) => {
                // 获取面板ID
                const editButton = group.querySelector('[data-action="edit-group"]');
                if (!editButton) return;

                const panelId = editButton.getAttribute('data-group');
                if (!panelId) return;

                // 更新该面板的数据
                await this.updatePanelGroupData(group, panelId);
            });

            await Promise.all(updatePromises);
            console.log('[DataTable] 🔄 分组表格数据已更新');

        } catch (error) {
            console.error('[DataTable] ❌ 更新分组表格数据失败:', error);
        }
    }

    /**
     * 更新单个面板组的数据
     */
    async updatePanelGroupData(groupElement, panelId) {
        try {
            console.log('[DataTable] 🔄 更新面板组数据:', panelId);

            // 🔧 修复：直接从数据表格的数据中获取对应面板的数据
            const panelDataItems = this.data.filter(item => item.panel === panelId);
            if (!panelDataItems || panelDataItems.length === 0) {
                console.warn('[DataTable] ⚠️ 无法获取面板数据:', panelId);
                return;
            }

            console.log('[DataTable] 📊 获取到面板数据项:', panelId, panelDataItems.length, '条');

            // 🔧 修复：根据面板类型使用不同的更新策略
            if (panelId === 'interaction') {
                this.updateInteractionTableData(groupElement, panelDataItems);
            } else if (panelId === 'organization') {
                this.updateOrganizationTableData(groupElement, panelDataItems);
            } else {
                this.updateRegularTableData(groupElement, panelDataItems, panelId);
            }

            console.log(`[DataTable] 📊 面板 ${panelId} 数据已更新`);

        } catch (error) {
            console.error(`[DataTable] ❌ 更新面板组数据失败 (${panelId}):`, error);
        }
    }
    /**
     * 🔧 通用数据更新方法 - 基于统一字段映射
     */
    updateTableDataWithMapping(groupElement, panelDataItems, panelId, fieldNames) {
        try {
            console.log(`[DataTable] 🔄 更新${panelId}表格数据`);

            const dataRows = groupElement.querySelectorAll('tbody tr.data-row');
            const fieldMapping = this.getFieldMapping(panelId);

            panelDataItems.forEach((dataItem, index) => {
                if (index >= dataRows.length) return;

                const row = dataRows[index];
                const cells = row.querySelectorAll('.cell-value');

                console.log(`[DataTable] 📋 更新${panelId}行 ${index + 1}:`, dataItem.rowData);

                // 更新每个单元格
                cells.forEach((cell, cellIndex) => {
                    const property = cell.getAttribute('data-property');
                    let colKey;
                    let value;
                    let updated = false;

                    // 🔧 修复：增强字段匹配，支持字段删除后的单元格清空
                    if (property) {
                        const possibleFieldNames = [
                            property,
                            fieldMapping[property],
                            `col_${cellIndex + 1}`,
                            this.mapDisplayNameToLegacyField(property, panelId)
                        ].filter(name => name);

                        for (const fieldName of possibleFieldNames) {
                            if (dataItem.rowData?.hasOwnProperty(fieldName)) {
                                value = dataItem.rowData[fieldName] || '';  // 支持空值和删除后的清空
                                colKey = fieldName;
                                updated = true;
                                break;
                            }
                        }
                    } else if (fieldNames && fieldNames[cellIndex]) {
                        const fieldName = fieldNames[cellIndex];
                        const possibleFieldNames = [
                            fieldName,
                            fieldMapping[fieldName],
                            `col_${cellIndex + 1}`,
                            this.mapDisplayNameToLegacyField(fieldName, panelId)
                        ].filter(name => name);

                        for (const fn of possibleFieldNames) {
                            if (dataItem.rowData?.hasOwnProperty(fn)) {
                                value = dataItem.rowData[fn] || '';  // 支持空值和删除后的清空
                                colKey = fn;
                                updated = true;
                                break;
                            }
                        }
                    }

                    // 如果没有找到对应的新值，保持现有显示，跳过
                    if (!updated) {
                        console.log(`[DataTable] ↪ 跳过无更新字段: ${panelId}.${property || `col_${cellIndex + 1}`}`);
                        return;
                    }

                    // 执行更新
                    const currentValue = cell.textContent?.trim() || '';
                    if (String(currentValue) !== String(value)) {
                        cell.textContent = value;
                        cell.setAttribute('title', `${property || `列${cellIndex + 1}`}: ${value}`);
                        console.log(`[DataTable] 🔍 ${panelId}字段更新: ${property} -> ${colKey} = "${value}"`);
                    }
                });
            });

        } catch (error) {
            console.error(`[DataTable] ❌ 更新${panelId}表格数据失败:`, error);
        }
    }

    /**
     * 🔧 按面板分组数据
     */
    groupDataByPanel(data) {
        try {
            const groups = {};

            data.forEach(item => {
                const panelId = item.panel;
                if (!groups[panelId]) {
                    groups[panelId] = [];
                }
                groups[panelId].push(item);
            });

            console.log('[DataTable] 📊 数据分组完成:', Object.keys(groups));
            return groups;

        } catch (error) {
            console.error('[DataTable] ❌ 数据分组失败:', error);
            return {};
        }
    }

    /**
     * 🔧 智能数据更新方法 - 基于缓存的精确定位
     */
    updateGroupedTablesDataSmart() {
        try {
            console.log('[DataTable] 🧠 开始智能数据更新...');

            if (!this.modal) {
                console.warn('[DataTable] ⚠️ 模态框不存在，跳过数据更新');
                return;
            }

            const groupedTables = this.modal.querySelector('.grouped-tables');
            if (!groupedTables) {
                console.warn('[DataTable] ⚠️ 表格容器不存在，跳过数据更新');
                return;
            }

            // 按面板分组数据
            const panelGroups = this.groupDataByPanel(this.filteredData);

            // 🔧 修复：只更新实际存在的面板，避免警告
            // 首先获取表格中实际存在的面板
            const existingPanels = Array.from(groupedTables.querySelectorAll('[data-panel]'))
                .map(element => element.getAttribute('data-panel'))
                .filter(panelId => panelId);

            console.log(`[DataTable] 📊 表格中存在的面板: ${existingPanels.join(', ')}`);

            // 只更新存在的面板数据
            Object.entries(panelGroups).forEach(([panelId, panelDataItems]) => {
                if (!existingPanels.includes(panelId)) {
                    console.log(`[DataTable] ⏭️ 跳过不存在的面板: ${panelId}`);
                    return;
                }

                const groupElement = groupedTables.querySelector(`[data-panel="${panelId}"]`);
                if (groupElement) {
                    console.log(`[DataTable] 🔄 智能更新面板 ${panelId} 数据`);

                    // 使用缓存的字段映射或获取新的映射
                    let fieldMapping = this.getCachedCellPositions(panelId);
                    if (!fieldMapping) {
                        fieldMapping = this.getFieldMapping(panelId);
                        this.cacheCellPositions(panelId, fieldMapping);
                    }

                    // 执行精确的数据更新
                    this.updateTableDataWithPreciseMapping(groupElement, panelDataItems, panelId, fieldMapping);
                } else {
                    // 这种情况理论上不应该发生，因为我们已经检查了存在性
                    console.warn(`[DataTable] ⚠️ 意外情况：面板 ${panelId} 在检查后消失`);
                }
            });

            console.log('[DataTable] ✅ 智能数据更新完成');

        } catch (error) {
            console.error('[DataTable] ❌ 智能数据更新失败:', error);
        }
    }

    /**
     * 🔧 精确数据更新方法 - 基于唯一标识的单元格定位
     */
    updateTableDataWithPreciseMapping(groupElement, panelDataItems, panelId, fieldMapping) {
        try {
            console.log(`[DataTable] 🎯 精确更新面板 ${panelId} 数据`);

            const dataRows = groupElement.querySelectorAll('tbody tr.data-row');

            panelDataItems.forEach((dataItem, rowIndex) => {
                if (rowIndex >= dataRows.length) return;

                const row = dataRows[rowIndex];
                const cells = row.querySelectorAll('.cell-value');

                console.log(`[DataTable] 📋 更新${panelId}行 ${rowIndex + 1}:`, dataItem.rowData);

                // 为每个单元格创建唯一标识并精确更新
                cells.forEach((cell, cellIndex) => {
                    const property = cell.getAttribute('data-property');
                    const cellId = `${panelId}_${rowIndex}_${cellIndex}_${property}`;

                    // 设置单元格唯一标识
                    cell.setAttribute('data-cell-id', cellId);

                    let colKey;
                    let value;
                    let updated = false;

                    // 🔧 修复：增强字段匹配，支持旧架构字段名（仅当新值存在时才更新）
                    if (property) {
                        const possibleFieldNames = [
                            property,
                            fieldMapping[property],
                            `col_${cellIndex + 1}`,
                            this.mapDisplayNameToLegacyField(property, panelId)
                        ].filter(name => name);

                        for (const fieldName of possibleFieldNames) {
                            if (dataItem.rowData?.[fieldName] !== undefined) {
                                value = dataItem.rowData[fieldName];
                                colKey = fieldName;
                                updated = true;
                                break;
                            }
                        }
                    }

                    // 如果没有找到对应的新值，保持现有显示，跳过
                    if (!updated) {
                        console.log(`[DataTable] ↪ 跳过无更新字段: ${panelId}.${property || `col_${cellIndex + 1}`}`);
                        return;
                    }

                    // 只在值发生变化时更新DOM
                    const currentValue = cell.textContent?.trim() || '';
                    if (String(currentValue) !== String(value)) {
                        cell.textContent = value;
                        cell.setAttribute('title', `${property || `列${cellIndex + 1}`}: ${value}`);

                        console.log(`[DataTable] 🔍 ${panelId}精确更新: ${property} -> ${colKey} = "${value}" (单元格ID: ${cellId})`);
                    }
                });
            });

        } catch (error) {
            console.error(`[DataTable] ❌ 精确数据更新失败 (${panelId}):`, error);
        }
    }

    /**
     * 🔧 新增：更新交互对象表格数据
     */
    updateInteractionTableData(groupElement, panelDataItems) {
        const fieldNames = ['对象名称', '对象类型', '外貌描述', '当前状态', '关系类型', '性格特点', '背景故事', '技能能力', '重要物品', '衣服', '附近银行', '交互'];
        this.updateTableDataWithMapping(groupElement, panelDataItems, 'interaction', fieldNames);
    }

    /**
     * 🔧 新增：更新组织表格数据
     */
    updateOrganizationTableData(groupElement, panelDataItems) {
        const fieldNames = ['组织名称', '组织类型', '层级结构', '职位设置', '成员管理', '组织级别', '相关人员'];
        this.updateTableDataWithMapping(groupElement, panelDataItems, 'organization', fieldNames);
    }

    /**
     * 🔧 新增：更新常规表格数据（个人信息、世界信息等）
     */
    updateRegularTableData(groupElement, panelDataItems, panelId) {
        // 使用统一的数据更新方法
        this.updateTableDataWithMapping(groupElement, panelDataItems, panelId, null);
    }

    /**
     * 🆕 获取英文字段名（中文显示名 -> 英文字段名）
     */
    getEnglishFieldName(chineseDisplayName, panelId) {
        try {
            // 获取完整的字段映射表
            const infoBarTool = window.SillyTavernInfobar;
            const infoBarSettings = infoBarTool?.modules?.infoBarSettings || infoBarTool?.modules?.settings;
            if (!infoBarSettings) {
                console.warn('[DataTable] ⚠️ InfoBarSettings 不可用');
                return null;
            }

            const completeMapping = infoBarSettings.getCompleteDisplayNameMapping();

            // 首先在指定面板中查找
            if (panelId && completeMapping[panelId]) {
                for (const [englishName, chineseName] of Object.entries(completeMapping[panelId])) {
                    if (chineseName === chineseDisplayName) {
                        console.log('[DataTable] 🎯 找到字段映射:', chineseDisplayName, '->', englishName);
                        return englishName;
                    }
                }
            }

            // 如果在指定面板中没找到，在所有面板中查找
            for (const [panelKey, panelMapping] of Object.entries(completeMapping)) {
                if (panelMapping && typeof panelMapping === 'object') {
                    for (const [englishName, chineseName] of Object.entries(panelMapping)) {
                        if (chineseName === chineseDisplayName) {
                            console.log('[DataTable] 🎯 在面板', panelKey, '中找到字段映射:', chineseDisplayName, '->', englishName);
                            return englishName;
                        }
                    }
                }
            }

            console.log('[DataTable] ⚠️ 未找到字段映射:', chineseDisplayName);
            return null;

        } catch (error) {
            console.error('[DataTable] ❌ 获取英文字段名失败:', error);
            return null;
        }
    }

    /**
     * 获取字段的显示名称 - 使用统一的完整映射表
     */
    getFieldDisplayName(fieldKey, panelType = null) {
        try {
            // 🔧 修复：使用InfoBarSettings的完整映射表，确保所有字段都有正确的中文显示
            const infoBarTool = window.SillyTavernInfobar;
            const infoBarSettings = infoBarTool?.modules?.infoBarSettings || infoBarTool?.modules?.settings;
            if (infoBarSettings) {
                const completeMapping = infoBarSettings.getCompleteDisplayNameMapping();
                
                // 如果指定了面板类型，优先从对应面板的映射中查找
                if (panelType && completeMapping[panelType] && completeMapping[panelType][fieldKey]) {
                    return completeMapping[panelType][fieldKey];
                }
                
                // 否则在所有面板映射中查找
                for (const [panelId, panelMapping] of Object.entries(completeMapping)) {
                    if (panelMapping[fieldKey]) {
                        return panelMapping[fieldKey];
                    }
                }
            }
            
            // 如果没有找到映射，返回原始键名
            return fieldKey;
            
        } catch (error) {
            console.warn('[DataTable] ⚠️ 获取字段显示名称失败:', error);
            return fieldKey;
        }
    }

    /**
     * 🔧 新增：创建组织架构表格 - 支持多组织数据（所有组织同时显示）
     */
    createOrganizationTable(panel) {
        try {
            // 🔧 修复：直接从数据表格的数据中获取组织架构数据
            if (!this.data || this.data.length === 0) {
                return this.createEmptyTable(panel);
            }

            // 获取组织架构面板的数据项
            const organizationDataItems = this.data.filter(item => item.panel === 'organization');

            console.log('[DataTable] 🔍 组织架构数据项:', organizationDataItems.length);

            if (organizationDataItems.length === 0) {
                return this.createEmptyTable(panel);
            }

            // 🔧 智能计算自适应列宽（包含组织名称列）
            const columnAnalysis = this.calculateAdaptiveColumnWidths(panel);

            // 生成表头（添加组织名称列）
            const headers = `
                <th class="col-org-name" style="
                    width: 120px;
                    min-width: 120px;
                    max-width: 200px;
                    padding: 8px;
                    text-align: center;
                    font-weight: bold;
                    border-right: 1px solid var(--theme-border-color, #dee2e6);
                ">组织名称</th>
                ${panel.subItems.map((item, index) => {
                    const { adaptiveWidth } = columnAnalysis[index];
                    const displayName = this.getFieldDisplayName(item.name, panel.key) || item.name;
                    return `<th class="col-property"
                        data-column-index="${index + 1}"
                        data-property="${item.name}"
                        style="
                        width: ${adaptiveWidth}px;
                        min-width: ${Math.max(adaptiveWidth, 80)}px;
                        max-width: ${Math.min(adaptiveWidth, 300)}px;
                        padding: 8px;
                        text-align: center;
                        font-weight: bold;
                        border-right: 1px solid var(--theme-border-color, #dee2e6);
                    ">${displayName}</th>`;
                }).join('')}
            `;

            // 🔧 修复：为每个组织数据项生成数据行
            const orgDataRows = organizationDataItems.map((dataItem, index) => {
                // 获取组织名称（从第一列数据）
                const orgName = dataItem.rowData?.col_1 || `组织 ${index + 1}`;

                // 🔧 使用统一的字段映射管理器
                const fieldMapping = this.getFieldMapping('organization');

                // 生成数据行
                const dataRow = panel.subItems.map((item, itemIndex) => {
                    // 🔧 修复：增强字段匹配，支持旧架构字段名
                    let value = '-';
                    let colKey = `col_${itemIndex + 1}`;

                    const possibleFieldNames = [
                        item.name,
                        item.key,
                        fieldMapping[item.name],
                        `col_${itemIndex + 1}`,
                        this.mapDisplayNameToLegacyField(item.name, 'organization')
                    ].filter(name => name);

                    for (const fieldName of possibleFieldNames) {
                        if (dataItem.rowData?.[fieldName] !== undefined) {
                            value = dataItem.rowData[fieldName];
                            colKey = fieldName;
                            break;
                        }
                    }

                    const formattedValue = this.formatCellValue(value);
                    const { adaptiveWidth } = columnAnalysis[itemIndex];

                    console.log(`[DataTable] 🔍 组织架构字段映射: ${item.name} -> ${colKey} = "${value}"`);

                    // 🔧 为组织单元格生成唯一标识
                    const cellId = `organization_${index}_${itemIndex}_${item.name}`;

                    return `<td class="cell-value"
                        data-property="${item.name}"
                        data-cell-id="${cellId}"
                        data-panel-id="organization"
                        data-row-index="${index}"
                        data-col-index="${itemIndex}"
                        title="${this.escapeHtml(value)}"
                        style="
                            width: ${adaptiveWidth}px;
                            min-width: ${Math.max(adaptiveWidth, 80)}px;
                            max-width: ${Math.min(adaptiveWidth, 300)}px;
                            padding: 8px;
                            vertical-align: top;
                            word-wrap: break-word;
                            overflow: visible;
                        ">${formattedValue}</td>`;
                }).join('');

                // 🔧 为组织名称单元格生成唯一标识
                const orgCellId = `organization_${index}_0_组织名称`;

                return `
                    <tr class="data-row org-data-row" data-org-id="org${index}">
                        <td class="cell-value org-name-cell"
                            data-property="组织名称"
                            data-cell-id="${orgCellId}"
                            data-panel-id="organization"
                            data-row-index="${index}"
                            data-col-index="0"
                            style="
                                padding: 8px;
                                vertical-align: top;
                                word-wrap: break-word;
                                width: 120px;
                                min-width: 120px;
                                max-width: 200px;
                                font-weight: 500;
                            ">${this.escapeHtml(orgName)}</td>
                        ${dataRow}
                    </tr>
                `;
            }).join('');

            return `
                <div class="data-table-container" style="
                    overflow-x: auto;
                    width: 100%;
                    max-width: 100%;
                    position: relative;
                ">
                    <table class="data-table dark-table horizontal-layout" style="
                        table-layout: fixed;
                        width: max-content;
                        min-width: 100%;
                        border-collapse: collapse;
                    ">
                        <thead>
                            <tr class="table-header">
                                ${headers}
                            </tr>
                        </thead>
                        <tbody class="table-body">
                            ${orgDataRows}
                        </tbody>
                    </table>
                </div>
            `;

        } catch (error) {
            console.error('[DataTable] ❌ 创建组织表格失败:', error);
            return this.createEmptyTable(panel);
        }
    }
    /**
     * 🔧 新增：按组织分组数据 - 类似NPC分组逻辑
     */
    groupOrgData(organizationData) {
        const orgGroups = {};
        const globalFields = {}; // 存储全局字段

        console.log('[DataTable] 🔍 开始组织数据分组，原始字段数:', Object.keys(organizationData).length);

        // 第一遍：收集所有组织特定字段和全局字段
        Object.entries(organizationData).forEach(([key, value]) => {
            const match = key.match(/^(org\d+)\.(.+)$/);
            if (match) {
                const [, orgId, fieldName] = match;
                if (!orgGroups[orgId]) {
                    orgGroups[orgId] = {};
                }
                orgGroups[orgId][fieldName] = value;
                console.log(`[DataTable] 📝 组织字段: ${orgId}.${fieldName} = ${value}`);
            } else {
                // 全局字段，稍后分配
                globalFields[key] = value;
                console.log(`[DataTable] 🌐 全局字段: ${key} = ${value}`);
            }
        });

        // 第二遍：🔧 修复全局字段分配逻辑，避免跨组织污染
        // 全局字段不应该自动分配给所有组织，这会导致删除时的数据污染
        const orgIds = Object.keys(orgGroups);
        if (orgIds.length === 0) {
            // 如果没有组织特定字段，创建默认组织
            orgGroups['org0'] = {};
            orgIds.push('org0');
        }

        // 🚫 删除全局字段自动分配逻辑，防止删除单个组织字段时影响其他组织
        console.log('[DataTable] 🔧 发现全局字段，但不自动分配以避免删除时的数据污染:', Object.keys(globalFields));

        console.log('[DataTable] ✅ 组织数据分组完成:');
        Object.keys(orgGroups).forEach(orgId => {
            console.log(`[DataTable]   ${orgId}: ${Object.keys(orgGroups[orgId]).length} 个字段`);
        });

        return orgGroups;
    }

    /**
     * 🔧 新增：获取组织字段值
     */
    getOrgFieldValue(orgData, item) {
        // 🔧 首先尝试直接使用字段名获取值（英文字段名）
        if (orgData[item.name] !== undefined) {
            return orgData[item.name];
        }

        // 🔧 如果是中文显示名，转换为英文字段名
        const fieldNameMapping = {
            '组织名称': 'name',
            '组织类型': 'type', 
            '层级结构': 'hierarchy',
            '职位设置': 'positions',
            '成员管理': 'members'
        };
        
        const englishFieldName = fieldNameMapping[item.name];
        if (englishFieldName && orgData[englishFieldName] !== undefined) {
            return orgData[englishFieldName];
        }

        // 如果没有找到值，返回默认值
        return item.value || '';
    }

    /**
     * 🔧 新增：获取组织数据（同步方式）
     */
    getOrganizationDataSync() {
        try {
            const currentChatId = this.dataCore.getCurrentChatId();
            if (!currentChatId) {
                console.log('[DataTable] ⚠️ 当前聊天ID未找到');
                return null;
            }

            // 尝试从缓存获取数据
            const cachedData = this.dataCore.chatDataCache?.get(currentChatId);
            if (cachedData && cachedData.infobar_data && cachedData.infobar_data.panels) {
                const organizationData = cachedData.infobar_data.panels.organization;
                
                if (!organizationData || typeof organizationData !== 'object') {
                    console.log('[DataTable] ⚠️ 组织数据为空或格式错误');
                    return null;
                }

                console.log('[DataTable] 📊 获取到组织数据:', organizationData);
                return organizationData;
            }

            console.log('[DataTable] ⚠️ 缓存中未找到组织数据');
            return null;

        } catch (error) {
            console.error('[DataTable] ❌ 获取组织数据失败:', error);
            return null;
        }
    }

    /**
     * 🔧 新增：获取组织数据（异步方式）
     */
    async getOrganizationData() {
        try {
            // 🔧 修复：使用正确的方法获取面板数据
            const organizationData = await this.dataCore.getPanelData('organization');
            
            if (!organizationData || typeof organizationData !== 'object') {
                console.log('[DataTable] ⚠️ 组织数据为空或格式错误');
                return null;
            }

            console.log('[DataTable] 📊 获取到组织数据:', organizationData);
            return organizationData;

        } catch (error) {
            console.error('[DataTable] ❌ 获取组织数据失败:', error);
            return null;
        }
    }

    /**
     * 按NPC分组数据 - 修复版本 (与MessageInfoBarRenderer保持一致)
     */
    groupNpcData(interactionData) {
        const npcGroups = {};
        const globalFields = {}; // 存储全局字段

        console.log('[DataTable] 🔍 开始NPC数据分组，原始字段数:', Object.keys(interactionData).length);

        // 第一遍：收集所有NPC特定字段和全局字段（统一字段名为英文，避免中英文冲突）
        Object.entries(interactionData).forEach(([key, value]) => {
            const match = key.match(/^(npc\d+)\.(.+)$/);
            if (match) {
                const [, npcId, rawFieldName] = match;
                if (!npcGroups[npcId]) {
                    npcGroups[npcId] = {};
                }

                // 将中文字段名映射为英文，以最新（英文优先）为准
                const normalizedFieldName = this.dataCore?.getEnglishFieldName?.(rawFieldName, 'interaction') || rawFieldName;

                // 英文优先：若当前是英文或尚未有值，则写入；若已有英文值且当前是中文别名，则不覆盖
                const isEnglish = normalizedFieldName === rawFieldName;
                const existing = npcGroups[npcId][normalizedFieldName];
                if (isEnglish || existing === undefined || existing === null || existing === '') {
                    npcGroups[npcId][normalizedFieldName] = value;
                }

                console.log(`[DataTable] 📝 NPC字段: ${npcId}.${rawFieldName} -> ${normalizedFieldName} = ${value}`);
            } else {
                // 全局字段，稍后分配
                globalFields[key] = value;
                console.log(`[DataTable] 🌐 全局字段: ${key} = ${value}`);
            }
        });

        // 第二遍：将全局字段分配给所有NPC（如果NPC没有对应的特定字段）
        const npcIds = Object.keys(npcGroups);
        if (npcIds.length === 0) {
            // 如果没有NPC特定字段，创建默认NPC
            npcGroups['npc0'] = {};
            npcIds.push('npc0');
        }

        Object.entries(globalFields).forEach(([fieldName, value]) => {
            npcIds.forEach(npcId => {
                // 只有当NPC没有这个字段时，才分配全局字段
                if (!npcGroups[npcId].hasOwnProperty(fieldName)) {
                    npcGroups[npcId][fieldName] = value;
                    console.log(`[DataTable] 🔄 分配全局字段到 ${npcId}.${fieldName} = ${value}`);
                }
            });
        });

        console.log('[DataTable] ✅ NPC数据分组完成:');
        Object.keys(npcGroups).forEach(npcId => {
            console.log(`[DataTable]   ${npcId}: ${Object.keys(npcGroups[npcId]).length} 个字段`);
        });

        return npcGroups;
    }

    /**
     * 获取NPC显示名称 (复制自MessageInfoBarRenderer)
     */
    getNpcDisplayName(npcId, npcData) {
        // 优先使用name字段
        if (npcData.name && npcData.name.trim()) {
            return npcData.name.trim();
        }

        // 如果没有name，使用npcId作为显示名
        return npcId.toUpperCase();
    }

    /**
     * 获取交互数据
     */
    getInteractionData() {
        try {
            const currentChatId = this.dataCore.getCurrentChatId();
            if (!currentChatId) {
                return null;
            }

            // 尝试从缓存获取数据
            const cachedData = this.dataCore.chatDataCache?.get(currentChatId);
            if (cachedData && cachedData.infobar_data && cachedData.infobar_data.panels) {
                return cachedData.infobar_data.panels.interaction;
            }

            return null;
        } catch (error) {
            console.error('[DataTable] ❌ 获取交互数据失败:', error);
            return null;
        }
    }

    /**
     * 获取NPC字段值
     */
    getNpcFieldValue(npcData, item) {
        try {
            // 尝试不同的字段名匹配方式（增强：加入中英互映）
            const mapCnToEn = (name) => this.dataCore?.getEnglishFieldName?.(name, 'interaction') || name;
            const mapEnToCn = (name) => this.getFieldDisplayName?.(name, 'interaction') || name;

            const baseNames = [item.key, item.name].filter(Boolean);
            const expanded = new Set();
            for (const n of baseNames) {
                expanded.add(n);
                expanded.add(String(n).toLowerCase());
                // 中->英
                expanded.add(mapCnToEn(n));
                // 英->中
                expanded.add(mapEnToCn(n));
            }

            // 兼容旧key: npc0.field 和不带前缀的 field
            const withAndWithoutNpc0 = new Set();
            for (const n of expanded) {
                if (!n) continue;
                withAndWithoutNpc0.add(n);
                if (typeof n === 'string') {
                    if (!n.includes('.') && !n.startsWith('npc')) {
                        withAndWithoutNpc0.add(`npc0.${n}`);
                    } else if (n.startsWith('npc0.')) {
                        withAndWithoutNpc0.add(n.replace('npc0.', ''));
                    }
                }
            }

            const possibleFieldNames = Array.from(withAndWithoutNpc0).filter(Boolean);

            for (const fieldName of possibleFieldNames) {
                if (npcData.hasOwnProperty(fieldName)) {
                    const value = npcData[fieldName];
                    if (value !== undefined && value !== null && value !== '') {
                        return String(value);
                    }
                }
            }

            return item.value || item.defaultValue || '-';
        } catch (error) {
            console.error('[DataTable] ❌ 获取NPC字段值失败:', error);
            return '-';
        }
    }

    /**
     * 创建空表格
     */
    createEmptyTable(panel) {
        const headers = panel.subItems.map(item =>
            `<th class="col-property">${item.name}</th>`
        ).join('');

        return `
            <div class="data-table-container">
                <table class="data-table dark-table horizontal-layout">
                    <thead>
                        <tr>
                            ${headers}
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="empty-row">
                            <td colspan="${panel.subItems.length + 1}" class="empty-cell">
                                <div class="empty-message">
                                    
                                    <span>暂无数据</span>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * 渲染分页信息
     */
    renderPagination() {
        if (!this.modal) return;

        const currentPageElement = this.modal.querySelector('.current-page');
        const totalPagesElement = this.modal.querySelector('.total-pages');

        if (currentPageElement) {
            currentPageElement.textContent = this.pagination.currentPage;
        }

        if (totalPagesElement) {
            totalPagesElement.textContent = this.pagination.totalPages;
        }

        console.log('[DataTable] 📄 分页信息已更新:', this.pagination.currentPage, '/', this.pagination.totalPages);
    }





    /**
     * 渲染表头
     */
    renderTableHeader() {
        const headerRow = this.table.querySelector('.table-header');
        
        // 清空现有列头
        headerRow.innerHTML = '';
        
        // 添加数据列头
        this.columns.forEach(column => {
            const th = document.createElement('th');
            th.className = 'table-column';
            th.style.width = column.width;
            th.dataset.column = column.key;
            
            let headerContent = column.title;
            
            // 添加排序指示器
            if (column.sortable) {
                th.classList.add('sortable');
                const sortIcon = this.sorting.column === column.key 
                    ? (this.sorting.direction === 'asc' ? '↑' : '↓')
                    : '↕';
                headerContent += ` <span class="sort-icon">${sortIcon}</span>`;
            }
            
            th.innerHTML = headerContent;
            headerRow.appendChild(th);
        });
    }

    /**
     * 渲染表体
     */
    renderTableBody() {
        const tbody = this.table.querySelector('.table-body');
        tbody.innerHTML = '';
        
        // 计算当前页的数据范围
        const startIndex = (this.pagination.currentPage - 1) * this.pagination.pageSize;
        const endIndex = Math.min(startIndex + this.pagination.pageSize, this.filteredData.length);
        const pageData = this.filteredData.slice(startIndex, endIndex);
        
        // 渲染数据行
        pageData.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'table-row';
            tr.dataset.id = row.id;
            
            // 选择列已删除 - 不再需要复选框
            
            // 数据列
            this.columns.forEach(column => {
                const td = document.createElement('td');
                td.className = 'table-cell';
                td.dataset.column = column.key;
                
                let cellContent = row[column.key];
                
                // 应用格式化器
                if (column.formatter) {
                    cellContent = column.formatter(cellContent, row);
                }
                
                // 处理HTML内容
                if (column.type === 'status' || column.type === 'actions') {
                    td.innerHTML = cellContent;
                } else {
                    td.textContent = cellContent || '';
                }
                
                tr.appendChild(td);
            });
            
            tbody.appendChild(tr);
        });
    }

    /**
     * 渲染分页
     */
    renderPagination() {
        // 更新分页信息
        const currentRangeEl = this.modal.querySelector('.current-range');
        const totalItemsEl = this.modal.querySelector('.total-items');
        
        const startIndex = (this.pagination.currentPage - 1) * this.pagination.pageSize + 1;
        const endIndex = Math.min(this.pagination.currentPage * this.pagination.pageSize, this.pagination.totalItems);
        
        currentRangeEl.textContent = `${startIndex}-${endIndex}`;
        totalItemsEl.textContent = this.pagination.totalItems;
        
        // 更新分页按钮状态
        const firstBtn = this.modal.querySelector('[data-action="first-page"]');
        const prevBtn = this.modal.querySelector('[data-action="prev-page"]');
        const nextBtn = this.modal.querySelector('[data-action="next-page"]');
        const lastBtn = this.modal.querySelector('[data-action="last-page"]');
        
        firstBtn.disabled = prevBtn.disabled = this.pagination.currentPage <= 1;
        nextBtn.disabled = lastBtn.disabled = this.pagination.currentPage >= this.pagination.totalPages;
        
        // 渲染页码
        this.renderPageNumbers();
    }

    /**
     * 渲染页码
     */
    renderPageNumbers() {
        const pageNumbersContainer = this.modal.querySelector('.page-numbers');
        pageNumbersContainer.innerHTML = '';
        
        const { currentPage, totalPages } = this.pagination;
        
        // 计算显示的页码范围
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, currentPage + 2);
        
        // 调整范围以显示5个页码
        if (endPage - startPage < 4) {
            if (startPage === 1) {
                endPage = Math.min(totalPages, startPage + 4);
            } else {
                startPage = Math.max(1, endPage - 4);
            }
        }
        
        // 渲染页码按钮
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `btn btn-small page-btn ${i === currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.dataset.action = 'goto-page';
            pageBtn.dataset.page = i;
            
            pageNumbersContainer.appendChild(pageBtn);
        }
    }
    /**
     * 绑定事件
     */
    bindEvents() {
        try {
            // 模态框事件
            this.modal.addEventListener('click', (e) => {
                this.handleClick(e);
            });

            // 搜索事件 - 已移除搜索功能
            // const searchInput = this.modal.querySelector('.search-input');
            // 搜索功能已被移除以简化界面

            // 筛选事件
            this.modal.addEventListener('change', (e) => {
                this.handleFilterChange(e);
            });

            // 表格排序事件 - 使用新的事件处理
            this.bindNewEvents();

            console.log('[DataTable] 🔗 事件绑定完成');

        } catch (error) {
            console.error('[DataTable] ❌ 绑定事件失败:', error);
            throw error;
        }
    }

    /**
     * 绑定主题事件
     */
    bindThemeEvents() {
        try {
            if (this.eventSystem) {
                // 监听主题变化事件
                this.eventSystem.on('theme:changed', (themeData) => {
                    console.log('[DataTable] 🎨 收到主题变化事件:', themeData);
                    this.applyTheme(themeData);
                });

                console.log('[DataTable] 🎨 主题事件监听已绑定');
            } else {
                console.warn('[DataTable] ⚠️ 事件系统未初始化，无法监听主题变化');
            }
        } catch (error) {
            console.error('[DataTable] ❌ 绑定主题事件失败:', error);
        }
    }

    /**
     * 绑定设置变更事件
     */
    bindSettingsEvents() {
        try {
            // 监听 SillyTavern 的设置更新事件
            if (window.eventSource) {
                window.eventSource.on('settings_updated', () => {
                    console.log('[DataTable] ⚙️ 收到设置更新事件，刷新表格结构');
                    this.refreshTableStructure();
                });
            }

            // 监听自定义的面板配置变更事件
            if (this.eventSystem) {
                this.eventSystem.on('panel:config:changed', () => {
                    console.log('[DataTable] 📋 收到面板配置变更事件，刷新表格结构');
                    this.refreshTableStructure();
                });
            }

            console.log('[DataTable] ⚙️ 设置变更事件监听已绑定');
        } catch (error) {
            console.error('[DataTable] ❌ 绑定设置事件失败:', error);
        }
    }

    /**
     * 绑定数据变更事件
     */
    bindDataChangeEvents() {
        try {
            if (!this.eventSystem) {
                console.warn('[DataTable] ⚠️ 事件系统未初始化，无法绑定数据变更事件');
                return;
            }

            // 创建防抖的数据变更处理函数（300ms防抖延迟，1000ms最大等待时间）
            this.debouncedHandleDataChange = this.debounce((data) => {
                this.handleDataChange(data);
            }, 300, 1000); // 300ms防抖延迟，1000ms最大等待时间

            // 监听聊天数据变更事件
            this.eventSystem.on('chat:data:changed', (data) => {
                console.log('[DataTable] 📊 收到聊天数据变更事件:', data);
                this.debouncedHandleDataChange(data);
            });

            // 监听数据变更事件
            this.eventSystem.on('data:changed', (data) => {
                console.log('[DataTable] 📊 收到数据变更事件:', data);
                this.debouncedHandleDataChange(data);
            });

            // 🔧 修复：监听数据解析失败事件，避免清空现有数据
            this.eventSystem.on('infobar_data_parse_failed', (data) => {
                console.log('[DataTable] ⚠️ 收到数据解析失败事件:', data);
                console.log('[DataTable] 🔒 保持现有数据不变，不执行数据刷新');
                // 不执行任何数据操作，保持现有数据表格状态
            });

            // 监听聊天切换事件（通过UnifiedDataCore的监听器机制）
            if (this.dataCore && typeof this.dataCore.addChatSwitchListener === 'function') {
                this.dataCore.addChatSwitchListener((chatId) => {
                    console.log('[DataTable] 🔄 收到聊天切换事件:', chatId);
                    this.handleChatSwitch(chatId);
                });
                console.log('[DataTable] 🔗 聊天切换事件监听器已绑定（通过DataCore）');
            } else {
                console.warn('[DataTable] ⚠️ 无法绑定聊天切换事件监听器');
            }

            console.log('[DataTable] 🔗 数据变更事件监听器已绑定（含防抖机制）');

        } catch (error) {
            console.error('[DataTable] ❌ 绑定数据变更事件失败:', error);
        }
    }

    /**
     * 处理数据变更
     */
    async handleDataChange(data) {
        try {
            console.log('[DataTable] 🔄 处理数据变更（防抖后）:', data);

            // 如果表格当前可见，立即刷新数据
            if (this.visible) {
                console.log('[DataTable] 👁️ 表格可见，执行防抖后的数据刷新');
                await this.loadData();
                if (this.modal) {
                    this.renderTable();
                }
            } else {
                // 如果表格不可见，标记需要刷新
                this.needsRefresh = true;
                console.log('[DataTable] 📝 表格不可见，标记需要刷新');
            }

        } catch (error) {
            console.error('[DataTable] ❌ 处理数据变更失败:', error);
        }
    }

    /**
     * 处理聊天切换
     * @param {string} chatId - 新的聊天ID
     */
    async handleChatSwitch(chatId) {
        try {
            console.log('[DataTable] 🔄 处理聊天切换:', chatId);

            // 如果表格当前可见，立即刷新数据
            if (this.visible) {
                console.log('[DataTable] 👁️ 表格可见，立即刷新数据');
                await this.loadData();

                // 检查是否有数据，如果没有数据则不强制刷新表格结构
                if (this.data && this.data.length > 0) {
                    console.log('[DataTable] 📊 有数据，正常渲染表格');
                    if (this.modal) {
                        this.renderTable();
                    }
                } else {
                    console.log('[DataTable] 📊 无数据，保持当前表格结构，只显示空状态');
                    // 无数据时只显示空状态，不重新生成表格结构
                    this.showEmpty(true);
                }
            } else {
                // 如果表格不可见，标记需要刷新
                this.needsRefresh = true;
                console.log('[DataTable] 📝 表格不可见，标记需要刷新');
            }

        } catch (error) {
            console.error('[DataTable] ❌ 处理聊天切换失败:', error);
        }
    }

    /**
     * 刷新表格结构（修复版）
     */
    refreshTableStructure() {
        try {
            if (!this.modal || this.modal.style.display === 'none') {
                console.log('[DataTable] 📋 表格未显示，标记需要刷新');
                this.needsRefresh = true;
                return;
            }

            console.log('[DataTable] 🔄 开始刷新表格结构...');

            // 🔧 修复：在刷新前保存当前的哈希值
            const currentHash = this.tableState.lastDataHash;
            console.log('[DataTable] 💾 保存当前哈希值:', currentHash);

            // 重新生成表格内容
            const modalBody = this.modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = this.createGroupedTables();

                // 重新绑定事件
                this.bindNewEvents();

                // 重新应用当前主题
                const currentTheme = this.getCurrentTheme();
                if (currentTheme) {
                    this.applyTheme(currentTheme);
                }

                // 🔧 修复：恢复哈希值，避免重置，并持久化保存
                if (currentHash) {
                    this.tableState.lastDataHash = currentHash;
                    this.savePersistedDataHash(currentHash); // 持久化保存
                    console.log('[DataTable] ✅ 哈希值已恢复:', currentHash);
                }

                // 清除刷新标记
                this.needsRefresh = false;

                console.log('[DataTable] ✅ 表格结构刷新完成');
            }
        } catch (error) {
            console.error('[DataTable] ❌ 刷新表格结构失败:', error);
        }
    }

    /**
     * 加载并应用保存的主题
     */
    async loadAndApplyTheme() {
        try {
            console.log('[DataTable] 🎨 开始加载保存的主题...');

            // 从 SillyTavern 标准存储机制获取主题配置
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;

            if (!extensionSettings['Information bar integration tool']) {
                console.log('[DataTable] 🎨 未找到扩展设置，使用默认主题');
                this.applyDefaultTheme();
                return;
            }

            const configs = extensionSettings['Information bar integration tool'];

            // 检查是否有保存的主题配置
            if (configs.theme && configs.theme.current) {
                const themeId = configs.theme.current;
                console.log('[DataTable] 🎨 找到保存的主题配置:', themeId);

                // 获取主题数据
                const theme = this.getThemeById(themeId);
                if (theme) {
                    // 应用主题
                    this.applyTheme({
                        themeId: themeId,
                        colors: theme.colors
                    });
                    console.log('[DataTable] ✅ 主题加载并应用成功:', themeId);
                } else {
                    console.warn('[DataTable] ⚠️ 未找到主题数据，使用默认主题');
                    this.applyDefaultTheme();
                }
            } else {
                console.log('[DataTable] 🎨 未找到保存的主题配置，使用默认主题');
                this.applyDefaultTheme();
            }

        } catch (error) {
            console.error('[DataTable] ❌ 加载主题失败:', error);
            this.applyDefaultTheme();
        }
    }

    /**
     * 应用默认主题
     */
    applyDefaultTheme() {
        try {
            const defaultTheme = this.getThemeById('default-dark');
            if (defaultTheme) {
                this.applyTheme({
                    themeId: 'default-dark',
                    colors: defaultTheme.colors
                });
                console.log('[DataTable] ✅ 默认主题应用成功');
            }
        } catch (error) {
            console.error('[DataTable] ❌ 应用默认主题失败:', error);
        }
    }

    /**
     * 根据主题ID获取主题配置
     */
    getThemeById(themeId) {
        const themes = {
            'default-dark': {
                id: 'default-dark',
                name: '默认深色',
                colors: { bg: '#1a1a1a', text: '#ffffff', primary: '#007bff', border: '#333' }
            },
            'default-light': {
                id: 'default-light',
                name: '默认浅色',
                colors: { bg: '#ffffff', text: '#333333', primary: '#007bff', border: '#dee2e6' }
            },
            'ocean-blue': {
                id: 'ocean-blue',
                name: '海洋蓝',
                colors: { bg: '#0f1419', text: '#e6fffa', primary: '#00d4aa', border: '#1e3a8a' }
            },
            'forest-green': {
                id: 'forest-green',
                name: '森林绿',
                colors: { bg: '#0d1b0d', text: '#e8f5e8', primary: '#22c55e', border: '#166534' }
            },
            'sunset-orange': {
                id: 'sunset-orange',
                name: '日落橙',
                colors: { bg: '#1a0f0a', text: '#fff5e6', primary: '#ff8c00', border: '#cc6600' }
            },
            'purple-night': {
                id: 'purple-night',
                name: '紫夜',
                colors: { bg: '#1a0d1a', text: '#f0e6ff', primary: '#9d4edd', border: '#6a1b9a' }
            },
            'cherry-blossom': {
                id: 'cherry-blossom',
                name: '樱花粉',
                colors: { bg: '#1a0f14', text: '#ffe6f0', primary: '#ff69b4', border: '#d1477a' }
            },
            'golden-sand': {
                id: 'golden-sand',
                name: '金沙',
                colors: { bg: '#1a1a0d', text: '#fffacd', primary: '#ffd700', border: '#b8860b' }
            },
            'ice-blue': {
                id: 'ice-blue',
                name: '冰蓝',
                colors: { bg: '#0d1419', text: '#e6f7ff', primary: '#87ceeb', border: '#4682b4' }
            },
            'rose-red': {
                id: 'rose-red',
                name: '玫瑰红',
                colors: { bg: '#1a0d0f', text: '#ffe6ea', primary: '#dc143c', border: '#b91c3c' }
            },
            'mint-green': {
                id: 'mint-green',
                name: '薄荷绿',
                colors: { bg: '#0d1a14', text: '#e6fff0', primary: '#00fa9a', border: '#00cc7a' }
            },
            'lavender': {
                id: 'lavender',
                name: '薰衣草',
                colors: { bg: '#14101a', text: '#f0e6ff', primary: '#9370db', border: '#7b68ee' }
            },
            'coffee-brown': {
                id: 'coffee-brown',
                name: '咖啡棕',
                colors: { bg: '#1a140d', text: '#f5f0e6', primary: '#8b4513', border: '#a0522d' }
            },
            'slate-gray': {
                id: 'slate-gray',
                name: '石板灰',
                colors: { bg: '#1a1a1a', text: '#e6e6e6', primary: '#708090', border: '#556b7d' }
            },
            'custom': {
                id: 'custom',
                name: '自定义',
                colors: { bg: '#1a1a1a', text: '#ffffff', primary: '#007bff', border: '#333' }
            }
        };

        return themes[themeId] || null;
    }

    /**
     * 获取当前主题
     */
    getCurrentTheme() {
        try {
            // 从全局变量或存储中获取当前主题
            if (window.SillyTavernInfobar && window.SillyTavernInfobar.currentTheme) {
                return window.SillyTavernInfobar.currentTheme;
            }
            return null;
        } catch (error) {
            console.error('[DataTable] ❌ 获取当前主题失败:', error);
            return null;
        }
    }

    /**
     * 应用主题到数据表格
     * @param {Object} themeData - 主题数据 {themeId, colors}
     */
    applyTheme(themeData) {
        try {
            if (!this.modal || !themeData || !themeData.colors) {
                console.warn('[DataTable] ⚠️ 主题数据无效或模态框不存在');
                return;
            }

            console.log('[DataTable] 🎨 应用主题:', themeData.themeId);

            // 计算衍生颜色
            const bgSecondary = this.adjustColor(themeData.colors.bg, 10);
            const textSecondary = this.adjustColor(themeData.colors.text, -20);
            const bgHover = this.adjustColor(themeData.colors.bg, 15);

            // 直接设置模态框的CSS变量
            const modal = this.modal;
            modal.style.setProperty('--theme-bg-primary', themeData.colors.bg);
            modal.style.setProperty('--theme-bg-secondary', bgSecondary);
            modal.style.setProperty('--theme-bg-hover', bgHover);
            modal.style.setProperty('--theme-text-primary', themeData.colors.text);
            modal.style.setProperty('--theme-text-secondary', textSecondary);
            modal.style.setProperty('--theme-primary-color', themeData.colors.primary);
            modal.style.setProperty('--theme-border-color', themeData.colors.border);

            console.log('[DataTable] ✅ 主题应用完成');

        } catch (error) {
            console.error('[DataTable] ❌ 应用主题失败:', error);
        }
    }

    /**
     * 颜色调整算法
     * @param {string} color - 原始颜色 (hex格式)
     * @param {number} percent - 调整百分比 (正数变亮，负数变暗)
     * @returns {string} 调整后的颜色
     */
    adjustColor(color, percent) {
        try {
            // 移除 # 号
            const hex = color.replace('#', '');

            // 转换为 RGB
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);

            // 调整亮度
            const adjust = (c) => {
                const adjusted = c + (c * percent / 100);
                return Math.max(0, Math.min(255, Math.round(adjusted)));
            };

            const newR = adjust(r);
            const newG = adjust(g);
            const newB = adjust(b);

            // 转换回 hex
            const toHex = (c) => c.toString(16).padStart(2, '0');
            return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;

        } catch (error) {
            console.error('[DataTable] ❌ 颜色调整失败:', error);
            return color; // 返回原始颜色
        }
    }
    /**
     * 处理点击事件
     */
    handleClick(e) {
        // 🔧 修复：处理重新填表按钮点击事件
        const refillDataBtn = e.target.closest('#refill-data-btn');
        if (refillDataBtn) {
            e.preventDefault();
            e.stopPropagation();
            this.handleRefillData(e);
            return;
        }

        // 🔧 修复：处理生成变量按钮点击事件
        const generateVarsBtn = e.target.closest('#generate-variables-btn');
        if (generateVarsBtn) {
            e.preventDefault();
            e.stopPropagation();
            this.handleGenerateVariables(e);
            return;
        }

        // 🔧 修复：处理表格单元格点击事件
        const cellElement = e.target.closest('.cell-value');
        if (cellElement) {
            e.preventDefault();
            e.stopPropagation();
            this.handleCellClick(cellElement, e);
            return;
        }

        // 🔧 修复：处理表格字段名称点击事件
        const headerElement = e.target.closest('.col-property');
        if (headerElement) {
            e.preventDefault();
            e.stopPropagation();
            this.handleHeaderClick(headerElement, e);
            return;
        }

        // 处理工具栏按钮事件
        const actionElement = e.target.closest('[data-action]');
        if (actionElement) {
            e.preventDefault();
            e.stopPropagation();
            const action = actionElement.getAttribute('data-action');
            this.handleToolbarAction(action, e);
            return;
        }

        const action = e.target.dataset.action;

        switch (action) {
            case 'close':
                this.hide();
                break;
            case 'refresh':
                this.loadData();
                break;
            case 'export':
                this.exportData();
                break;
            case 'import':
                this.importData();
                break;
            case 'search':
                this.performSearch();
                break;
            case 'clear-filters':
                this.clearFilters();
                break;
            case 'select-all':
                this.selectAll();
                break;
            case 'delete-selected':
                this.deleteSelected();
                break;
            case 'export-selected':
                this.exportSelected();
                break;
            // 分页相关的事件处理已移除
            case 'first-page':
            case 'prev-page':
            case 'next-page':
            case 'last-page':
            case 'goto-page':
                // 分页功能已被移除
                console.log('[DataTable] 分页功能已被移除');
                break;
            case 'view':
                this.viewItem(e.target.dataset.id);
                break;
            case 'edit':
                this.editItem(e.target.dataset.id);
                break;
            case 'delete':
                this.deleteItem(e.target.dataset.id);
                break;
        }
    }

    /**
     * 处理筛选变更
     */
    handleFilterChange(e) {
        const filterType = e.target.dataset.filter;
        
        if (filterType) {
            switch (filterType) {
                case 'category':
                    this.filters.category = e.target.value;
                    break;
                case 'status':
                    this.filters.status = e.target.value;
                    break;
                case 'dateStart':
                    this.filters.dateRange.start = e.target.value;
                    break;
                case 'dateEnd':
                    this.filters.dateRange.end = e.target.value;
                    break;
            }
            
            this.applyFilters();
            if (this.modal) {
                this.renderTable();
            }
        }
        
        // 页面大小变更 - 已移除分页功能
        if (e.target.classList.contains('page-size-select')) {
            // 分页功能已被移除
            console.log('[DataTable] 分页功能已被移除');
        }
        
        // 复选框相关事件已删除 - 不再需要复选框功能
    }

    /**
     * 处理排序
     */
    handleSort(th) {
        const column = th.dataset.column;
        
        if (this.sorting.column === column) {
            // 切换排序方向
            this.sorting.direction = this.sorting.direction === 'asc' ? 'desc' : 'asc';
        } else {
            // 新的排序列
            this.sorting.column = column;
            this.sorting.direction = 'asc';
        }
        
        this.applyFilters();
        if (this.modal) {
            this.renderTable();
        }
    }

    /**
     * 跳转到指定页
     */
    goToPage(page) {
        if (page >= 1 && page <= this.pagination.totalPages) {
            this.pagination.currentPage = page;
            if (this.modal) {
                this.renderTable();
            }
        }
    }

    /**
     * 清除筛选
     */
    clearFilters() {
        this.filters = {
            search: '',
            dateRange: { start: null, end: null },
            category: '',
            status: ''
        };
        
        // 重置表单
        this.modal.querySelector('.search-input').value = '';
        this.modal.querySelectorAll('.filter-select').forEach(select => select.value = '');
        this.modal.querySelectorAll('.filter-date').forEach(input => input.value = '');
        
        this.applyFilters();
        if (this.modal) {
            this.renderTable();
        }
    }

    // 全选功能已删除 - 不再需要复选框功能

    /**
     * 更新批量操作按钮状态
     */
    updateBatchActions() {
        const hasSelection = this.selectedRows.size > 0;
        
        this.modal.querySelector('[data-action="delete-selected"]').disabled = !hasSelection;
        this.modal.querySelector('[data-action="export-selected"]').disabled = !hasSelection;
    }

    /**
     * 显示/隐藏加载状态
     */
    showLoading(show) {
        if (!this.modal) return;

        const groupedTables = this.modal.querySelector('.grouped-tables');
        const statusText = this.modal.querySelector('.status-text');

        if (groupedTables) {
            groupedTables.style.opacity = show ? '0.5' : '1';
        }

        if (statusText) {
            statusText.textContent = show ? '正在加载数据...' : '数据加载完成';
        }

        console.log('[DataTable] 加载状态:', show ? '显示' : '隐藏');
    }

    /**
     * 显示/隐藏空状态
     */
    showEmpty(show) {
        if (!this.modal) return;

        const groupedTables = this.modal.querySelector('.grouped-tables');
        const statusText = this.modal.querySelector('.status-text');

        if (groupedTables) {
            if (show) {
                // 检查是否已有表格结构
                const existingTables = groupedTables.querySelectorAll('.table-group');

                if (existingTables.length > 0) {
                    // 如果已有表格结构，只清空数据内容，保持表格结构
                    console.log('[DataTable] 🏗️ 保持现有表格结构，只清空数据内容');
                    existingTables.forEach(panelGroup => {
                        const tableBody = panelGroup.querySelector('tbody');
                        if (tableBody) {
                            // 清空表格数据，但保持表头
                            tableBody.innerHTML = `
                                <tr class="empty-row">
                                    <td colspan="100%" class="empty-cell">
                                        <div class="empty-message">
                                            
                                            <span>暂无数据</span>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }
                    });
                } else {
                    // 如果没有表格结构，显示默认空状态
                    console.log('[DataTable] 🏗️ 没有表格结构，显示默认空状态');
                    groupedTables.innerHTML = `
                        <div class="empty-state">
                            
                            <h3>暂无数据</h3>
                            <p>请选择有数据的聊天或等待AI返回信息栏数据</p>
                        </div>
                    `;
                }
            } else {
                // 隐藏空状态时，移除空行但保持表格结构
                const emptyRows = groupedTables.querySelectorAll('.empty-row');
                emptyRows.forEach(row => row.remove());

                // 同时移除默认空状态
                const emptyState = groupedTables.querySelector('.empty-state');
                if (emptyState) {
                    emptyState.remove();
                }
            }
        }

        if (statusText) {
            statusText.textContent = show ? '暂无数据' : '数据加载完成';
        }

        console.log('[DataTable] 空状态:', show ? '显示' : '隐藏');
    }

    /**
     * 防抖函数（带最大等待时间）
     */
    debounce(func, wait, maxWait = null) {
        let timeout;
        let maxTimeout;
        let lastCallTime = 0;

        return function executedFunction(...args) {
            const now = Date.now();

            const later = () => {
                clearTimeout(timeout);
                clearTimeout(maxTimeout);
                lastCallTime = now;
                func(...args);
            };

            // 清除之前的定时器
            clearTimeout(timeout);

            // 如果设置了最大等待时间，并且距离第一次调用已经超过最大等待时间
            if (maxWait && lastCallTime && (now - lastCallTime >= maxWait)) {
                console.log('[DataTable] ⏰ 达到最大等待时间，立即执行防抖函数');
                clearTimeout(maxTimeout);
                later();
                return;
            }

            // 设置普通防抖延迟
            timeout = setTimeout(later, wait);

            // 如果设置了最大等待时间，并且是第一次调用，设置最大等待定时器
            if (maxWait && !lastCallTime) {
                lastCallTime = now;
                maxTimeout = setTimeout(() => {
                    console.log('[DataTable] ⏰ 最大等待时间到达，强制执行防抖函数');
                    clearTimeout(timeout);
                    later();
                }, maxWait);
            }
        };
    }

    /**
     * 显示数据表格界面
     */
    async show() {
        try {
            if (!this.initialized) {
                await this.init();
            }

            // 确保UI已创建
            if (!this.modal) {
                this.createUI();
            }

            // 显示模态框
            if (this.modal) {
                this.modal.style.display = 'flex';
                this.visible = true;

                // 在UI显示后再加载数据
                await this.loadData();
            } else {
                console.error('[DataTable] ❌ 模态框创建失败，无法显示');
                return;
            }

            // 如果有待刷新的标记，立即刷新表格结构
            if (this.needsRefresh) {
                console.log('[DataTable] 🔄 检测到待刷新标记，立即刷新表格结构');
                this.refreshTableStructure();
            }

            // 触发显示事件
            if (this.eventSystem) {
                this.eventSystem.emit('ui:show', {
                    component: 'DataTable',
                    timestamp: Date.now()
                });
            }

            console.log('[DataTable] 👁️ 数据表格界面已显示');

        } catch (error) {
            console.error('[DataTable] ❌ 显示界面失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 隐藏数据表格界面
     */
    hide() {
        try {
            this.modal.style.display = 'none';
            this.visible = false;
            
            // 触发隐藏事件
            if (this.eventSystem) {
                this.eventSystem.emit('ui:hide', {
                    component: 'DataTable',
                    timestamp: Date.now()
                });
            }
            
            console.log('[DataTable] 👁️ 数据表格界面已隐藏');
            
        } catch (error) {
            console.error('[DataTable] ❌ 隐藏界面失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 导出数据
     */
    async exportData() {
        try {
            const dataToExport = this.selectedRows.size > 0 
                ? this.filteredData.filter(item => this.selectedRows.has(String(item.id)))
                : this.filteredData;
            
            const exportData = {
                timestamp: Date.now(),
                version: '1.0.0',
                totalItems: dataToExport.length,
                data: dataToExport
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `data-export-${Date.now()}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            
            console.log(`[DataTable] 📤 导出了 ${dataToExport.length} 条数据`);
            
        } catch (error) {
            console.error('[DataTable] ❌ 导出数据失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error(`[DataTable] ❌ 错误 #${this.errorCount}:`, error);
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            initialized: this.initialized,
            visible: this.visible,
            dataCount: this.data.length,
            filteredCount: this.filteredData.length,
            selectedCount: this.selectedRows.size,
            currentPage: this.pagination.currentPage,
            totalPages: this.pagination.totalPages,
            errorCount: this.errorCount
        };
    }
    /**
     * 🆕 显示编辑单元格对话框
     */
    async showEditCellDialog(cellInfo) {
        try {
            console.log('[DataTable] ✏️ 显示编辑对话框:', cellInfo);

            // 获取当前值
            const currentValue = await this.getCurrentCellValue(cellInfo);

            // 创建编辑对话框
            const dialog = document.createElement('div');
            dialog.className = 'cell-edit-dialog';
            dialog.innerHTML = `
                <div class="dialog-overlay"></div>
                <div class="dialog-content">
                    <div class="dialog-header">
                        <h3>编辑字段数据</h3>
                        <button class="dialog-close" data-action="close">×</button>
                    </div>
                    <div class="dialog-body">
                        <div class="field-info">
                            <div class="info-row">
                                <span class="info-label">面板:</span>
                                <span class="info-value">${this.getPanelDisplayName(cellInfo.panelId)}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">字段:</span>
                                <span class="info-value">${cellInfo.property}</span>
                            </div>
                            ${cellInfo.npcId ? `
                            <div class="info-row">
                                <span class="info-label">NPC:</span>
                                <span class="info-value">${this.getNpcDisplayName(cellInfo.npcId)}</span>
                            </div>
                            ` : ''}
                        </div>
                        <div class="edit-form">
                            <label class="form-label">当前值:</label>
                            <div class="current-value">${this.escapeHtml(currentValue)}</div>

                            <label class="form-label">新值:</label>
                            <textarea class="form-input" placeholder="请输入新的值...">${this.escapeHtml(currentValue)}</textarea>

                            <div class="form-note">
                                💡 提示: 修改后的数据将同步到数据核心，并记录修改历史
                            </div>
                        </div>
                    </div>
                    <div class="dialog-footer">
                        <button class="btn btn-secondary" data-action="cancel">取消</button>
                        <button class="btn btn-primary" data-action="save">确认修改</button>
                    </div>
                </div>
            `;

            // 添加到页面
            document.body.appendChild(dialog);

            // 绑定事件
            this.bindEditDialogEvents(dialog, cellInfo);

            // 显示对话框
            setTimeout(() => {
                dialog.classList.add('show');

                // 🆕 移动端样式优化
                this.applyMobileStyles(dialog);

                // 聚焦到输入框并选中文本
                const input = dialog.querySelector('.form-input');
                input.focus();
                input.select();
            }, 10);

            console.log('[DataTable] ✅ 编辑对话框已显示');

        } catch (error) {
            console.error('[DataTable] ❌ 显示编辑对话框失败:', error);
        }
    }

    /**
     * 🆕 绑定编辑对话框事件
     */
    bindEditDialogEvents(dialog, cellInfo) {
        // 关闭对话框
        const closeDialog = () => {
            dialog.classList.remove('show');
            setTimeout(() => dialog.remove(), 300);
        };

        // 点击遮罩层关闭
        dialog.querySelector('.dialog-overlay').addEventListener('click', closeDialog);

        // 按钮事件
        dialog.addEventListener('click', (e) => {
            const action = e.target.getAttribute('data-action');

            if (action === 'close' || action === 'cancel') {
                closeDialog();
            } else if (action === 'save') {
                this.saveCellEdit(dialog, cellInfo, closeDialog);
            }
        });

        // ESC键关闭
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeDialog();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);

        // Enter键保存（Ctrl+Enter）
        dialog.querySelector('.form-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.saveCellEdit(dialog, cellInfo, closeDialog);
            }
        });
    }

    /**
     * 🆕 保存单元格编辑
     */
    async saveCellEdit(dialog, cellInfo, closeCallback) {
        try {
            const input = dialog.querySelector('.form-input');
            const newValue = input.value.trim();
            const oldValue = await this.getCurrentCellValue(cellInfo);

            // 验证输入
            if (newValue === oldValue) {
                console.log('[DataTable] ℹ️ 值未发生变化，无需保存');
                closeCallback();
                return;
            }

            console.log('[DataTable] 💾 保存单元格编辑:', {
                panelId: cellInfo.panelId,
                property: cellInfo.property,
                npcId: cellInfo.npcId,
                rowIndex: cellInfo.rowIndex,
                oldValue,
                newValue
            });

            // 保存到数据核心
            await this.updateCellValueInCore(cellInfo, newValue, oldValue);

            // 刷新表格显示
            await this.refreshTableData();

            // 显示成功提示
            this.showSuccessMessage(`字段 "${cellInfo.property}" 已成功更新`);

            closeCallback();

        } catch (error) {
            console.error('[DataTable] ❌ 保存单元格编辑失败:', error);
            this.showErrorMessage('保存失败: ' + error.message);
        }
    }

    /**
     * 🆕 显示历史记录对话框
     */
    async showCellHistoryDialog(cellInfo) {
        try {
            console.log('[DataTable] 📋 显示历史记录对话框:', cellInfo);

            // 获取历史记录
            const history = await this.getCellHistory(cellInfo);
            console.log('[DataTable] 📋 获取到历史记录:', history);

            // 创建历史记录对话框
            const dialog = document.createElement('div');
            dialog.className = 'cell-history-dialog';
            dialog.innerHTML = `
                <div class="dialog-overlay"></div>
                <div class="dialog-content">
                    <div class="dialog-header">
                        <h3>字段修改记录</h3>
                        <button class="dialog-close" data-action="close">×</button>
                    </div>
                    <div class="dialog-body">
                        <div class="field-info">
                            <div class="info-row">
                                <span class="info-label">面板:</span>
                                <span class="info-value">${this.getPanelDisplayName(cellInfo.panelId)}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">字段:</span>
                                <span class="info-value">${cellInfo.property}</span>
                            </div>
                            ${cellInfo.npcId ? `
                            <div class="info-row">
                                <span class="info-label">NPC:</span>
                                <span class="info-value">${this.getNpcDisplayName(cellInfo.npcId)}</span>
                            </div>
                            ` : ''}
                        </div>
                        <div class="history-list">
                            ${this.renderHistoryList(history)}
                        </div>
                    </div>
                    <div class="dialog-footer">
                        <button class="btn btn-primary" data-action="close">关闭</button>
                    </div>
                </div>
            `;

            // 添加到页面
            document.body.appendChild(dialog);

            // 绑定事件
            this.bindHistoryDialogEvents(dialog);

            // 显示对话框
            setTimeout(() => {
                dialog.classList.add('show');

                // 🆕 移动端样式优化
                this.applyMobileStyles(dialog);
            }, 10);

            console.log('[DataTable] ✅ 历史记录对话框已显示');

        } catch (error) {
            console.error('[DataTable] ❌ 显示历史记录对话框失败:', error);
        }
    }

    /**
     * 🆕 绑定历史记录对话框事件
     */
    bindHistoryDialogEvents(dialog) {
        // 关闭对话框
        const closeDialog = () => {
            dialog.classList.remove('show');
            setTimeout(() => dialog.remove(), 300);
        };

        // 点击遮罩层关闭
        dialog.querySelector('.dialog-overlay').addEventListener('click', closeDialog);

        // 按钮事件
        dialog.addEventListener('click', (e) => {
            const action = e.target.getAttribute('data-action');
            if (action === 'close') {
                closeDialog();
            }
        });

        // ESC键关闭
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeDialog();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
    }

    /**
     * 🆕 渲染历史记录列表
     */
    renderHistoryList(history) {
        if (!history || history.length === 0) {
            return `
                <div class="history-empty">
                    <div class="empty-icon">📝</div>
                    <div class="empty-text">暂无修改记录</div>
                    <div class="empty-note">当您修改此字段时，修改记录将显示在这里</div>
                </div>
            `;
        }

        return history.map(record => {
            const date = new Date(record.timestamp);
            const timeStr = date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            // 根据更新来源显示不同的图标和样式
            const sourceInfo = this.getSourceInfo(record.source);

            return `
                <div class="history-item ${record.source?.toLowerCase() || 'unknown'}">
                    <div class="history-header">
                        <div class="history-time">${timeStr}</div>
                        <div class="history-source">
                            <span class="source-icon">${sourceInfo.icon}</span>
                            <span class="source-text">${sourceInfo.text}</span>
                        </div>
                    </div>
                    <div class="history-change">
                        从 "<span class="old-value">${this.escapeHtml(record.oldValue || '')}</span>"
                        更新为 "<span class="new-value">${this.escapeHtml(record.newValue || '')}</span>"
                    </div>
                    ${record.note ? `<div class="history-note">${this.escapeHtml(record.note)}</div>` : ''}
                </div>
            `;
        }).join('');
    }

    /**
     * 🆕 获取更新来源信息
     */
    getSourceInfo(source) {
        switch (source) {
            case 'AI_UPDATE':
                return {
                    icon: '🤖',
                    text: 'AI更新'
                };
            case 'USER_EDIT':
                return {
                    icon: '👤',
                    text: '用户编辑'
                };
            default:
                return {
                    icon: '📝',
                    text: '系统更新'
                };
        }
    }

    /**
     * 🆕 获取当前单元格值
     */
    async getCurrentCellValue(cellInfo) {
        try {
            console.log('[DataTable] 🔍 获取单元格当前值:', cellInfo);

            if (cellInfo.npcId && cellInfo.npcId !== 'null' && cellInfo.npcId !== null) {
                // NPC数据 - 从交互面板数据中获取
                const interactionData = await this.dataCore.getPanelData('interaction');
                console.log('[DataTable] 📊 交互面板数据:', interactionData);
                
                if (interactionData) {
                    // 分组NPC数据
                    const npcGroups = this.groupNpcData(interactionData);
                    const npcData = npcGroups[cellInfo.npcId];
                    console.log('[DataTable] 📊 NPC数据:', npcData);
                    
                    if (npcData) {
                        // 获取英文字段名
                        const englishFieldName = this.dataCore.getEnglishFieldName(cellInfo.property, cellInfo.panelId);
                        console.log('[DataTable] 🔄 字段名映射:', {
                            chinese: cellInfo.property,
                            english: englishFieldName
                        });
                        
                        const value = this.getNpcFieldValue(npcData, { 
                            name: englishFieldName || cellInfo.property,
                            key: englishFieldName || cellInfo.property
                        }) || '';
                        console.log('[DataTable] 🎯 NPC字段值:', value);
                        return value;
                    }
                }
                
                console.log('[DataTable] ⚠️ 未找到NPC数据，使用显示值');
                const displayedValue = this.getDisplayedCellValue(cellInfo);
                return displayedValue || '';
            } else if (cellInfo.orgId && cellInfo.orgId !== 'null' && cellInfo.orgId !== null) {
                // 组织数据 - 从组织面板数据中获取
                const organizationData = await this.dataCore.getPanelData('organization');
                console.log('[DataTable] 📊 组织面板数据:', organizationData);
                
                if (organizationData) {
                    // 分组组织数据
                    const orgGroups = this.groupOrgData(organizationData);
                    const orgData = orgGroups[cellInfo.orgId];
                    console.log('[DataTable] 📊 组织数据:', orgData);
                    
                    if (orgData) {
                        // 获取英文字段名 (去掉org前缀)
                        const propertyWithoutPrefix = cellInfo.property.replace(/^org\d+\./, '');
                        const englishFieldName = this.dataCore.getEnglishFieldName(propertyWithoutPrefix, cellInfo.panelId);
                        console.log('[DataTable] 🔄 组织字段名映射:', {
                            original: cellInfo.property,
                            withoutPrefix: propertyWithoutPrefix,
                            english: englishFieldName
                        });
                        
                        const value = this.getOrgFieldValue(orgData, { 
                            name: propertyWithoutPrefix,
                            key: englishFieldName || propertyWithoutPrefix
                        }) || '';
                        console.log('[DataTable] 🎯 组织字段值:', value);
                        return value;
                    }
                }
                
                console.log('[DataTable] ⚠️ 未找到组织数据，使用显示值');
                const displayedValue = this.getDisplayedCellValue(cellInfo);
                return displayedValue || '';
            } else {
                // 面板数据 - 先尝试从当前显示的单元格获取值
                const displayedValue = this.getDisplayedCellValue(cellInfo);
                if (displayedValue !== null) {
                    console.log('[DataTable] 📺 从显示获取值:', displayedValue);
                    return displayedValue;
                }

                // 如果显示值获取失败，从数据核心获取
                const panelData = await this.dataCore.getPanelData(cellInfo.panelId);
                console.log('[DataTable] 📊 面板数据:', panelData);

                // 支持新架构多行：当 panelData 是数组时根据 rowIndex 精确取值
                if (Array.isArray(panelData)) {
                    const rowIndex = (cellInfo.rowIndex !== undefined && cellInfo.rowIndex !== null)
                        ? cellInfo.rowIndex
                        : 0;
                    const rowObj = panelData[rowIndex] || panelData[0] || {};
                    // 支持 col_X 与 英文字段名
                    const resolvedKey = this.resolveDataKeyForPanel(cellInfo.panelId, cellInfo.property);
                    const value = rowObj[resolvedKey] ?? rowObj[cellInfo.property] ?? '';
                    console.log('[DataTable] 🎯 多行面板字段值:', { rowIndex, value });
                    return value;
                }

                const value = this.getPanelItemValue(panelData, { name: cellInfo.property }) || '';
                console.log('[DataTable] 🎯 面板字段值:', value);
                return value;
            }
        } catch (error) {
            console.error('[DataTable] ❌ 获取当前单元格值失败:', error);
            return '';
        }
    }

    /**
     * 🆕 从当前显示的表格中获取单元格值
     */
    getDisplayedCellValue(cellInfo) {
        try {
            // 查找当前显示的单元格
            const cellElements = document.querySelectorAll(`.cell-value[data-property="${cellInfo.property}"]`);

            for (const cell of cellElements) {
                // 检查是否是同一个面板的单元格
                const tableGroup = cell.closest('.table-group');
                const panelId = this.getPanelIdFromTableGroup(tableGroup);

                if (panelId === cellInfo.panelId) {
                    // 如果是NPC表格，还需要检查NPC ID
                    if (cellInfo.npcId) {
                        const row = cell.closest('tr');
                        const rowNpcId = row?.getAttribute('data-npc-id');
                        if (rowNpcId === cellInfo.npcId) {
                            return cell.textContent.trim();
                        }
                    } else if (cellInfo.rowIndex !== undefined) {
                        // 多行数据：匹配行索引
                        const row = cell.closest('tr');
                        const rowIndexAttr = row?.getAttribute('data-row-index');
                        if (rowIndexAttr !== null && rowIndexAttr !== undefined) {
                            const rowIndex = parseInt(rowIndexAttr);
                            if (!isNaN(rowIndex) && rowIndex === cellInfo.rowIndex) {
                                return cell.textContent.trim();
                            }
                        }
                    } else {
                        // 单行数据或无法确定行：返回第一个匹配值
                        return cell.textContent.trim();
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('[DataTable] ❌ 从显示获取单元格值失败:', error);
            return null;
        }
    }

    /**
     * 🆕 获取面板显示名称
     */
    getPanelDisplayName(panelId) {
        try {
            const panelData = this.dataCore.getPanelData(panelId);
            return panelData?.name || panelId || '未知面板';
        } catch (error) {
            return panelId || '未知面板';
        }
    }

    /**
     * 🆕 获取单元格历史记录
     */
    async getCellHistory(cellInfo) {
        try {
            // 从数据核心获取历史记录
            const historyKey = this.buildHistoryKey(cellInfo);
            const history = await this.dataCore.getFieldHistory?.(historyKey);

            // 确保返回数组
            if (Array.isArray(history)) {
                return history;
            } else {
                console.warn('[DataTable] ⚠️ 历史记录不是数组格式:', history);
                return [];
            }
        } catch (error) {
            console.error('[DataTable] ❌ 获取历史记录失败:', error);
            return [];
        }
    }
    /**
     * 🆕 构建历史记录键
     */
    buildHistoryKey(cellInfo) {
        // 🆕 将中文字段名转换为英文字段名
        const englishFieldName = this.getEnglishFieldName(cellInfo.property, cellInfo.panelId);
        const actualFieldName = englishFieldName || cellInfo.property;

        console.log('[DataTable] 🔑 构建历史记录键:', {
            original: cellInfo.property,
            english: englishFieldName,
            actual: actualFieldName
        });

        if (cellInfo.npcId && cellInfo.npcId !== 'null' && cellInfo.npcId !== null) {
            return `npc:${cellInfo.npcId}:${actualFieldName}`;
        } else {
            return `panel:${cellInfo.panelId}:${actualFieldName}`;
        }
    }

    /**
     * 🆕 更新单元格值到数据核心
     */
    async updateCellValueInCore(cellInfo, newValue, oldValue) {
        try {
            // 记录修改历史
            await this.recordFieldChange(cellInfo, oldValue, newValue);

            if (cellInfo.npcId && cellInfo.npcId !== 'null' && cellInfo.npcId !== null) {
                // 更新NPC数据 - 需要将中文字段名映射为英文字段名
                const englishFieldName = this.dataCore.getEnglishFieldName(cellInfo.property, cellInfo.panelId);
                const actualFieldName = englishFieldName || cellInfo.property;

                console.log('[DataTable] 🔄 NPC字段名映射:', {
                    chinese: cellInfo.property,
                    english: englishFieldName,
                    actual: actualFieldName
                });

                // 1) 写入NPC专用存储
                await this.dataCore.updateNpcField(cellInfo.npcId, actualFieldName, newValue);
                // 2) 同步写入到interaction面板（以 npcX.field 的形式），以便表格刷新后立刻可见
                const prefixedField = `${cellInfo.npcId}.${actualFieldName}`;
                await this.dataCore.updatePanelField(cellInfo.panelId, prefixedField, newValue);
            } else if (cellInfo.orgId && cellInfo.orgId !== 'null' && cellInfo.orgId !== null) {
                // 更新组织数据 - 需要将中文字段名映射为英文字段名
                const propertyWithoutPrefix = cellInfo.property.replace(/^org\d+\./, '');
                const englishFieldName = this.dataCore.getEnglishFieldName(propertyWithoutPrefix, cellInfo.panelId);
                const actualFieldName = englishFieldName || propertyWithoutPrefix;
                
                console.log('[DataTable] 🔄 组织字段名映射:', {
                    original: cellInfo.property,
                    withoutPrefix: propertyWithoutPrefix,
                    english: englishFieldName,
                    actual: actualFieldName
                });
                
                // 构建完整的组织字段名
                const fullFieldName = `${cellInfo.orgId}.${actualFieldName}`;
                await this.dataCore.updatePanelField(cellInfo.panelId, fullFieldName, newValue);
            } else {
                // 更新面板数据
                if (cellInfo.rowIndex !== undefined && cellInfo.rowIndex !== null) {
                    // 多行数据：写入指定行（按存储键）
                    const resolvedKey = this.resolveDataKeyForPanel(cellInfo.panelId, cellInfo.property);
                    await this.dataCore.updatePanelRowField?.(cellInfo.panelId, cellInfo.rowIndex, resolvedKey, newValue);
                } else {
                    await this.dataCore.updatePanelField(cellInfo.panelId, cellInfo.property, newValue);
                }

                // 🔧 修复：如果是自定义子项，同时更新面板配置中的子项数据
                await this.updateCustomSubItemValue(cellInfo, newValue);
            }

            console.log('[DataTable] ✅ 数据已同步到核心');

        } catch (error) {
            console.error('[DataTable] ❌ 同步数据到核心失败:', error);
            throw error;
        }
    }

    /**
     * 🔧 新增：更新自定义子项的值到面板配置
     */
    async updateCustomSubItemValue(cellInfo, newValue) {
        try {
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};

            // 检查是否是基础面板的自定义子项
            const panelConfig = configs[cellInfo.panelId];
            if (panelConfig && panelConfig.subItems && Array.isArray(panelConfig.subItems)) {
                // 查找匹配的自定义子项
                const subItem = panelConfig.subItems.find(item => {
                    const itemKey = item.key || item.name?.toLowerCase().replace(/\s+/g, '_');
                    const itemName = item.displayName || item.name;

                    // 匹配字段名
                    return itemKey === cellInfo.property ||
                           itemName === cellInfo.property ||
                           item.name === cellInfo.property;
                });

                if (subItem) {
                    // 更新子项的值
                    subItem.value = newValue;

                    // 保存配置
                    context.saveSettingsDebounced();

                    console.log(`[DataTable] ✅ 已更新自定义子项值: ${cellInfo.panelId}.${cellInfo.property} = "${newValue}"`);
                    return true;
                }
            }

            // 检查是否是自定义面板的子项
            const customPanelConfig = configs.customPanels?.[cellInfo.panelId];
            if (customPanelConfig && customPanelConfig.subItems && Array.isArray(customPanelConfig.subItems)) {
                // 查找匹配的自定义子项
                const subItem = customPanelConfig.subItems.find(item => {
                    const itemKey = item.key || item.name?.toLowerCase().replace(/\s+/g, '_');
                    const itemName = item.displayName || item.name;

                    // 匹配字段名
                    return itemKey === cellInfo.property ||
                           itemName === cellInfo.property ||
                           item.name === cellInfo.property;
                });

                if (subItem) {
                    // 更新子项的值
                    subItem.value = newValue;

                    // 保存配置
                    context.saveSettingsDebounced();

                    console.log(`[DataTable] ✅ 已更新自定义面板子项值: ${cellInfo.panelId}.${cellInfo.property} = "${newValue}"`);
                    return true;
                }
            }

            return false;

        } catch (error) {
            console.error('[DataTable] ❌ 更新自定义子项值失败:', error);
            return false;
        }
    }

    /**
     * 🆕 记录字段修改历史
     */
    recordFieldChange(cellInfo, oldValue, newValue) {
        try {
            const historyKey = this.buildHistoryKey(cellInfo);
            const record = {
                timestamp: Date.now(),
                oldValue,
                newValue,
                property: cellInfo.property,
                panelId: cellInfo.panelId,
                npcId: cellInfo.npcId
            };

            // 添加到数据核心的历史记录
            if (this.dataCore.addFieldHistory) {
                this.dataCore.addFieldHistory(historyKey, record);
            }

            console.log('[DataTable] 📝 修改历史已记录:', record);

        } catch (error) {
            console.error('[DataTable] ❌ 记录修改历史失败:', error);
        }
    }

    /**
     * 🆕 刷新表格数据
     */
    async refreshTableData() {
        try {
            // 重新加载当前聊天数据并重建 this.data / filteredData
            const currentChatId = this.dataCore.getCurrentChatId();
            if (currentChatId) {
                const chatData = await this.dataCore.getChatData(currentChatId);
                this.data = this.transformPanelData(chatData);
                this.applyFilters();
                console.log('[DataTable] 🔄 数据已重新加载，条目数:', this.data.length);
            }

            // 更新分组表格数据
            await this.updateGroupedTablesData();
            console.log('[DataTable] 🔄 表格数据已刷新');
        } catch (error) {
            console.error('[DataTable] ❌ 刷新表格数据失败:', error);
        }
    }

    /**
     * 🆕 应用移动端样式优化
     * @param {HTMLElement} dialog - 对话框元素
     */
    applyMobileStyles(dialog) {
        try {
            // 检测是否为移动端或小屏幕
            const isMobile = window.innerWidth <= 768 ||
                           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            if (isMobile || window.innerWidth <= 1400) {
                console.log('[DataTable] 📱 应用移动端样式优化');

                // 应用移动端样式
                dialog.style.alignItems = 'flex-start';
                dialog.style.paddingTop = '20vh'; // 向下移动20%，充分利用屏幕空间
                dialog.style.justifyContent = 'center';

                // 优化对话框内容
                const dialogContent = dialog.querySelector('.dialog-content');
                if (dialogContent) {
                    dialogContent.style.maxHeight = '75vh'; // 大幅增加最大高度
                    dialogContent.style.marginTop = '0';
                    dialogContent.style.width = '90%';
                    dialogContent.style.maxWidth = 'none';
                    dialogContent.style.borderRadius = '16px';
                }

                // 优化对话框主体
                const dialogBody = dialog.querySelector('.dialog-body');
                if (dialogBody) {
                    dialogBody.style.maxHeight = '55vh'; // 大幅增加内容区域高度
                    dialogBody.style.overflowY = 'auto';
                    dialogBody.style.padding = '16px';
                }

                // 优化对话框头部和底部
                const dialogHeader = dialog.querySelector('.dialog-header');
                const dialogFooter = dialog.querySelector('.dialog-footer');
                if (dialogHeader) {
                    dialogHeader.style.padding = '16px';
                }
                if (dialogFooter) {
                    dialogFooter.style.padding = '16px';
                }

                console.log('[DataTable] ✅ 移动端样式优化完成');
            }
        } catch (error) {
            console.error('[DataTable] ❌ 应用移动端样式失败:', error);
        }
    }

    /**
     * 🆕 显示成功消息
     */
    showSuccessMessage(message) {
        this.showMessage(message, 'success');
    }

    /**
     * 🆕 显示错误消息
     */
    showErrorMessage(message) {
        this.showMessage(message, 'error');
    }

    /**
     * 🆕 显示消息提示
     */
    showMessage(message, type = 'info') {
        try {
            // 创建消息提示
            const toast = document.createElement('div');
            toast.className = `message-toast ${type}`;
            toast.innerHTML = `
                <div class="toast-content">
                    <span class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
                    <span class="toast-text">${this.escapeHtml(message)}</span>
                </div>
            `;

            // 添加到页面
            document.body.appendChild(toast);

            // 显示动画
            setTimeout(() => {
                toast.classList.add('show');
            }, 10);

            // 自动隐藏
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.remove();
                    }
                }, 300);
            }, 3000);

        } catch (error) {
            console.error('[DataTable] ❌ 显示消息失败:', error);
        }
    }

    /**
     * 🆕 显示字段规则编辑对话框
     */
    async showFieldRuleDialog(cellInfo) {
        try {
            console.log('[DataTable] 🔧 显示字段规则编辑对话框:', cellInfo);

            // 🔧 修复：获取字段规则管理器（正确的路径）
            const fieldRuleManager = window.SillyTavernInfobar?.modules?.fieldRuleManager;
            if (!fieldRuleManager) {
                console.error('[DataTable] ❌ 字段规则管理器不可用');
                console.error('[DataTable] 🔍 调试信息 - SillyTavernInfobar:', !!window.SillyTavernInfobar);
                console.error('[DataTable] 🔍 调试信息 - modules:', !!window.SillyTavernInfobar?.modules);
                console.error('[DataTable] 🔍 调试信息 - fieldRuleManager:', !!window.SillyTavernInfobar?.modules?.fieldRuleManager);
                return;
            }

            // 获取现有规则
            const existingRule = fieldRuleManager.getFieldRule(cellInfo.panelId, cellInfo.property);

            // 获取规则模板
            const templates = fieldRuleManager.getAllRuleTemplates();

            // 创建对话框
            const dialog = document.createElement('div');
            dialog.className = 'field-rule-dialog';
            dialog.innerHTML = `
                <div class="dialog-overlay"></div>
                <div class="dialog-content">
                    <div class="dialog-header">
                        <h3>字段规则编辑</h3>
                        <button class="dialog-close" data-action="close">×</button>
                    </div>
                    <div class="dialog-body">
                        <div class="field-info">
                            <div class="info-row">
                                <span class="info-label">面板:</span>
                                <span class="info-value">${this.getPanelDisplayName(cellInfo.panelId)}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">字段:</span>
                                <span class="info-value">${cellInfo.property}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">当前值:</span>
                                <span class="info-value">${cellInfo.value || '(空)'}</span>
                            </div>
                        </div>

                        <div class="rule-editor">
                            <div class="rule-form">
                                <div class="form-section">
                                    <h4>字段规则</h4>
                                    <div class="form-group">
                                        <label>规则内容:</label>
                                        <textarea class="form-control" id="field-rule-content" placeholder="输入字段的生成规则..." rows="8">${this.extractExistingRuleContent(existingRule)}</textarea>
                                        <div class="form-help">
                                            <small>在此输入字段的生成规则，例如：角色的姓名应该符合古代中国人名特点，包含姓氏和名字。</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="dialog-footer">
                        <button class="btn btn-secondary" data-action="cancel">取消</button>
                        <button class="btn btn-danger" data-action="delete-rule" ${!existingRule ? 'style="display:none"' : ''}>删除规则</button>
                        <button class="btn btn-primary" data-action="save-rule">保存规则</button>
                    </div>
                </div>
            `;

            // 添加到页面
            document.body.appendChild(dialog);

            // 绑定事件
            this.bindFieldRuleDialogEvents(dialog, cellInfo, fieldRuleManager);

            // 显示对话框
            setTimeout(() => dialog.classList.add('show'), 10);

        } catch (error) {
            console.error('[DataTable] ❌ 显示字段规则对话框失败:', error);
        }
    }

    /**
     * 🆕 绑定字段规则对话框事件
     */
    bindFieldRuleDialogEvents(dialog, cellInfo, fieldRuleManager) {
        // 关闭对话框
        const closeDialog = () => {
            dialog.classList.remove('show');
            setTimeout(() => dialog.remove(), 300);
        };

        // 点击遮罩层关闭
        dialog.querySelector('.dialog-overlay').addEventListener('click', closeDialog);

        // 按钮事件
        dialog.addEventListener('click', async (e) => {
            const action = e.target.getAttribute('data-action');

            if (action === 'close' || action === 'cancel') {
                closeDialog();
            } else if (action === 'save-rule') {
                await this.saveFieldRule(dialog, cellInfo, fieldRuleManager);
                closeDialog();
            } else if (action === 'delete-rule') {
                if (confirm('确定要删除这个字段规则吗？')) {
                    await fieldRuleManager.deleteFieldRule(cellInfo.panelId, cellInfo.property);
                    closeDialog();
                }
            } else if (action === 'add-example') {
                this.addExample(dialog);
            } else if (action === 'add-constraint') {
                this.addConstraint(dialog);
            } else if (action === 'add-dynamic-rule') {
                this.addDynamicRule(dialog);
            } else if (action === 'remove-example') {
                this.removeExample(dialog, e.target);
            } else if (action === 'remove-constraint') {
                this.removeConstraint(dialog, e.target);
            } else if (action === 'remove-dynamic-rule') {
                this.removeDynamicRule(dialog, e.target);
            }
        });

        // 模板按钮事件
        dialog.addEventListener('click', (e) => {
            if (e.target.classList.contains('template-btn')) {
                const templateKey = e.target.getAttribute('data-template');
                this.applyRuleTemplate(dialog, templateKey, fieldRuleManager);
            }
        });
    }

    /**
     * 🆕 提取现有规则内容
     */
    extractExistingRuleContent(existingRule) {
        if (!existingRule) {
            return '';
        }

        // 如果已经是简化格式（字符串）
        if (typeof existingRule === 'string') {
            return existingRule;
        }

        // 如果是对象格式，首先检查 content 属性（新的简化格式）
        if (existingRule.content && typeof existingRule.content === 'string') {
            return existingRule.content;
        }

        // 兼容旧的复杂格式，提取内容
        const parts = [];

        // 提取基础规则描述
        if (existingRule.rules && existingRule.rules.description) {
            parts.push(existingRule.rules.description);
        }

        // 提取动态规则描述
        if (existingRule.dynamicRules && Array.isArray(existingRule.dynamicRules)) {
            existingRule.dynamicRules.forEach(rule => {
                if (rule.description) {
                    parts.push(rule.description);
                }
            });
        }

        // 如果有部分内容，返回合并结果
        if (parts.length > 0) {
            return parts.join('\n');
        }

        // 最后尝试直接返回对象的字符串表示（用于调试）
        console.warn('[DataTable] ⚠️ 无法提取规则内容，规则格式:', existingRule);
        return '';
    }
    /**
     * 🆕 保存字段规则
     */
    async saveFieldRule(dialog, cellInfo, fieldRuleManager) {
        try {
            // 获取规则内容
            const ruleContent = dialog.querySelector('#field-rule-content').value.trim();

            if (!ruleContent) {
                console.warn('[DataTable] ⚠️ 规则内容为空，跳过保存');
                return;
            }

            // 创建简化的规则对象
            const rule = {
                content: ruleContent,
                type: 'simple',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            // 保存规则
            const success = await fieldRuleManager.setFieldRule(cellInfo.panelId, cellInfo.property, rule);

            if (success) {
                console.log('[DataTable] ✅ 字段规则保存成功');
            } else {
                console.error('[DataTable] ❌ 字段规则保存失败');
            }

        } catch (error) {
            console.error('[DataTable] ❌ 保存字段规则失败:', error);
        }
    }

    /**
     * 🆕 应用规则模板
     */
    applyRuleTemplate(dialog, templateKey, fieldRuleManager) {
        if (templateKey === 'custom') {
            // 清空表单
            dialog.querySelector('#rule-description').value = '';
            dialog.querySelector('#rule-format').value = '';

            // 清空示例列表
            const examplesList = dialog.querySelector('#examples-list');
            examplesList.innerHTML = this.renderExamplesList([]);

            // 清空约束列表
            const constraintsList = dialog.querySelector('#constraints-list');
            constraintsList.innerHTML = this.renderConstraintsList([]);

            // 清空动态规则列表
            const dynamicRulesList = dialog.querySelector('#dynamic-rules-list');
            dynamicRulesList.innerHTML = this.renderDynamicRulesList([]);

            console.log('[DataTable] ✅ 自定义模板已应用，所有字段已清空');
            return;
        }

        const template = fieldRuleManager.getRuleTemplate(templateKey);
        if (!template) return;

        // 填充表单
        dialog.querySelector('#rule-description').value = template.rules.description || '';
        dialog.querySelector('#rule-format').value = template.rules.format || '';

        // 更新示例列表
        const examplesList = dialog.querySelector('#examples-list');
        examplesList.innerHTML = this.renderExamplesList(template.examples || []);

        // 更新约束列表
        const constraintsList = dialog.querySelector('#constraints-list');
        constraintsList.innerHTML = this.renderConstraintsList(template.rules.constraints || []);

        // 更新动态规则列表
        const dynamicRulesList = dialog.querySelector('#dynamic-rules-list');
        dynamicRulesList.innerHTML = this.renderDynamicRulesList(template.dynamicRules || []);
    }

    /**
     * 🆕 渲染示例列表
     */
    renderExamplesList(examples) {
        if (!examples || examples.length === 0) {
            return '<div class="empty-message">暂无示例</div>';
        }

        return examples.map((example, index) => `
            <div class="example-row" data-index="${index}">
                <input type="text" class="form-control example-value" placeholder="示例值" value="${example.value || ''}">
                <input type="text" class="form-control example-description" placeholder="示例描述" value="${example.description || ''}">
                <button class="btn btn-small btn-danger remove-example" data-action="remove-example" data-index="${index}">删除</button>
            </div>
        `).join('');
    }

    /**
     * 🆕 渲染约束列表
     */
    renderConstraintsList(constraints) {
        if (!constraints || constraints.length === 0) {
            return '<div class="empty-message">暂无约束</div>';
        }

        return constraints.map((constraint, index) => `
            <div class="constraint-row" data-index="${index}">
                <input type="text" class="form-control constraint-text" placeholder="约束条件" value="${constraint || ''}">
                <button class="btn btn-small btn-danger remove-constraint" data-action="remove-constraint" data-index="${index}">删除</button>
            </div>
        `).join('');
    }

    /**
     * 🆕 渲染动态规则列表
     */
    renderDynamicRulesList(dynamicRules) {
        if (!dynamicRules || dynamicRules.length === 0) {
            return '<div class="empty-message">暂无动态规则</div>';
        }

        return dynamicRules.map((rule, index) => `
            <div class="dynamic-rule-row" data-index="${index}">
                <div class="rule-inputs">
                    <input type="text" class="form-control rule-condition" placeholder="触发条件" value="${rule.condition || ''}">
                    <input type="text" class="form-control rule-action" placeholder="执行动作" value="${rule.action || ''}">
                    <button class="btn btn-small btn-danger remove-dynamic-rule" data-action="remove-dynamic-rule" data-index="${index}">删除</button>
                </div>
                <div class="rule-examples">
                    <textarea class="form-control rule-examples-text" placeholder="示例（每行一个）">${(rule.examples || []).join('\n')}</textarea>
                </div>
            </div>
        `).join('');
    }

    /**
     * 🆕 收集示例数据
     */
    collectExamples(dialog) {
        const examples = [];
        const exampleRows = dialog.querySelectorAll('.example-row');

        exampleRows.forEach(row => {
            const value = row.querySelector('.example-value').value.trim();
            const description = row.querySelector('.example-description').value.trim();

            if (value) {
                examples.push({ value, description });
            }
        });

        return examples;
    }

    /**
     * 🆕 收集约束数据
     */
    collectConstraints(dialog) {
        const constraints = [];
        const constraintRows = dialog.querySelectorAll('.constraint-row');

        constraintRows.forEach(row => {
            const text = row.querySelector('.constraint-text').value.trim();
            if (text) {
                constraints.push(text);
            }
        });

        return constraints;
    }

    /**
     * 🆕 收集动态规则数据
     */
    collectDynamicRules(dialog) {
        const dynamicRules = [];
        const ruleRows = dialog.querySelectorAll('.dynamic-rule-row');

        ruleRows.forEach(row => {
            const condition = row.querySelector('.rule-condition').value.trim();
            const action = row.querySelector('.rule-action').value.trim();
            const examplesText = row.querySelector('.rule-examples-text').value.trim();

            if (condition && action) {
                const examples = examplesText ? examplesText.split('\n').filter(line => line.trim()) : [];
                dynamicRules.push({ condition, action, examples });
            }
        });

        return dynamicRules;
    }

    /**
     * 🆕 添加示例
     */
    addExample(dialog) {
        const examplesList = dialog.querySelector('#examples-list');
        const newIndex = examplesList.children.length;

        const exampleRow = document.createElement('div');
        exampleRow.className = 'example-row';
        exampleRow.setAttribute('data-index', newIndex);
        exampleRow.innerHTML = `
            <input type="text" class="form-control example-value" placeholder="示例值" value="">
            <input type="text" class="form-control example-description" placeholder="示例描述" value="">
            <button class="btn btn-small btn-danger remove-example" data-action="remove-example" data-index="${newIndex}">删除</button>
        `;

        examplesList.appendChild(exampleRow);
    }

    /**
     * 🆕 移除示例
     */
    removeExample(dialog, button) {
        const exampleRow = button.closest('.example-row');
        if (exampleRow) {
            exampleRow.remove();
        }
    }

    /**
     * 🆕 添加约束
     */
    addConstraint(dialog) {
        const constraintsList = dialog.querySelector('#constraints-list');
        const newIndex = constraintsList.children.length;

        const constraintRow = document.createElement('div');
        constraintRow.className = 'constraint-row';
        constraintRow.setAttribute('data-index', newIndex);
        constraintRow.innerHTML = `
            <input type="text" class="form-control constraint-text" placeholder="约束条件" value="">
            <button class="btn btn-small btn-danger remove-constraint" data-action="remove-constraint" data-index="${newIndex}">删除</button>
        `;

        constraintsList.appendChild(constraintRow);
    }

    /**
     * 🆕 移除约束
     */
    removeConstraint(dialog, button) {
        const constraintRow = button.closest('.constraint-row');
        if (constraintRow) {
            constraintRow.remove();
        }
    }

    /**
     * 🆕 添加动态规则
     */
    addDynamicRule(dialog) {
        const dynamicRulesList = dialog.querySelector('#dynamic-rules-list');
        const newIndex = dynamicRulesList.children.length;

        const dynamicRuleRow = document.createElement('div');
        dynamicRuleRow.className = 'dynamic-rule-row';
        dynamicRuleRow.setAttribute('data-index', newIndex);
        dynamicRuleRow.innerHTML = `
            <div class="form-group">
                <label>触发条件:</label>
                <input type="text" class="form-control dynamic-condition" placeholder="例如: 当某字段包含特定值时" value="">
            </div>
            <div class="form-group">
                <label>执行动作:</label>
                <input type="text" class="form-control dynamic-action" placeholder="例如: 生成相关内容" value="">
            </div>
            <div class="form-group">
                <label>示例:</label>
                <textarea class="form-control dynamic-examples" placeholder="每行一个示例" rows="3"></textarea>
            </div>
            <button class="btn btn-small btn-danger remove-dynamic-rule" data-action="remove-dynamic-rule" data-index="${newIndex}">删除规则</button>
        `;

        dynamicRulesList.appendChild(dynamicRuleRow);
    }

    /**
     * 🆕 移除动态规则
     */
    removeDynamicRule(dialog, button) {
        const dynamicRuleRow = button.closest('.dynamic-rule-row');
        if (dynamicRuleRow) {
            dynamicRuleRow.remove();
        }
    }

    /**
     * 🆕 显示删除字段确认对话框
     */
    showDeleteFieldConfirmation(cellInfo) {
        try {
            console.log('[DataTable] 🗑️ 显示删除字段确认对话框:', cellInfo);

            // 创建确认对话框
            const dialog = document.createElement('div');
            dialog.className = 'field-rule-dialog delete-field-dialog';
            dialog.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000000;
                opacity: 0;
                visibility: visible;
                transition: opacity 0.3s ease;
            `;

            dialog.innerHTML = `
                <div class="dialog-content" style="
                    background: var(--theme-bg-primary, #2a2a2a);
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                    max-width: 500px;
                    width: 90%;
                    max-height: 80vh;
                    overflow: hidden;
                    border: 1px solid var(--theme-border-color, rgba(255,255,255,0.1));
                ">
                    <div class="dialog-header" style="
                        padding: 20px 24px 16px;
                        border-bottom: 1px solid var(--theme-border-color, rgba(255,255,255,0.1));
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <h3 style="margin: 0; color: var(--theme-text-primary, #ffffff); font-size: 18px;">⚠️ 删除字段确认</h3>
                        <button class="dialog-close" data-action="close" style="
                            background: none;
                            border: none;
                            color: var(--theme-text-secondary, #aaa);
                            font-size: 24px;
                            cursor: pointer;
                            padding: 0;
                            width: 32px;
                            height: 32px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            border-radius: 4px;
                            transition: background-color 0.2s;
                        ">×</button>
                    </div>
                    <div class="dialog-body" style="
                        padding: 24px;
                    ">
                        <div class="warning-message" style="
                            background: var(--theme-warning-bg, rgba(255, 193, 7, 0.1));
                            border: 1px solid var(--theme-warning-border, rgba(255, 193, 7, 0.3));
                            border-radius: 8px;
                            padding: 16px;
                            margin-bottom: 20px;
                        ">
                            <div style="
                                color: var(--theme-warning-text, #ffc107);
                                font-weight: 500;
                                margin-bottom: 8px;
                                display: flex;
                                align-items: center;
                                gap: 8px;
                            ">
                                <span style="font-size: 20px;">⚠️</span>
                                <span>危险操作警告</span>
                            </div>
                            <div style="
                                color: var(--theme-text-primary, #fff);
                                font-size: 14px;
                                line-height: 1.5;
                            ">
                                您即将删除字段 <strong>"${cellInfo.fieldName || cellInfo.property}"</strong>，此操作将：
                                <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                                    <li>永久删除该字段的所有数据</li>
                                    <li>无法恢复已删除的数据</li>
                                    <li>影响所有相关的数据记录</li>
                                </ul>
                            </div>
                        </div>

                        <div class="field-info" style="
                            background: var(--theme-bg-secondary, rgba(255,255,255,0.05));
                            border-radius: 8px;
                            padding: 16px;
                            margin-bottom: 20px;
                        ">
                            <div style="color: var(--theme-text-primary, #fff); margin-bottom: 8px;">
                                <strong>字段信息：</strong>
                            </div>
                            <div style="color: var(--theme-text-secondary, #aaa); font-size: 14px;">
                                <div>面板：${cellInfo.panelId}</div>
                                <div>字段：${cellInfo.fieldName || cellInfo.property}</div>
                                <div>位置：第${cellInfo.columnIndex !== undefined ? cellInfo.columnIndex + 1 : '未知'}列</div>
                            </div>
                        </div>

                        <div class="confirmation-input" style="margin-bottom: 20px;">
                            <label style="
                                display: block;
                                color: var(--theme-text-primary, #fff);
                                margin-bottom: 8px;
                                font-weight: 500;
                            ">请输入 "DELETE" 确认删除：</label>
                            <input type="text" id="delete-confirmation" placeholder="输入 DELETE 确认" style="
                                width: 100%;
                                padding: 8px 12px;
                                background: var(--theme-bg-secondary, #333);
                                color: var(--theme-text-primary, #fff);
                                border: 1px solid var(--theme-border-color, #555);
                                border-radius: 4px;
                                font-size: 14px;
                                box-sizing: border-box;
                            " />
                        </div>
                    </div>
                    <div class="dialog-footer" style="
                        padding: 16px 24px 20px;
                        border-top: 1px solid var(--theme-border-color, rgba(255,255,255,0.1));
                        display: flex;
                        justify-content: flex-end;
                        gap: 12px;
                    ">
                        <button class="btn-cancel" data-action="cancel" style="
                            padding: 8px 16px;
                            background: var(--theme-bg-secondary, #555);
                            color: var(--theme-text-primary, #fff);
                            border: 1px solid var(--theme-border-color, #666);
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                        ">取消</button>
                        <button class="btn-delete" data-action="confirm-delete" style="
                            padding: 8px 16px;
                            background: var(--theme-danger-color, #dc3545);
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 500;
                            opacity: 0.5;
                            pointer-events: none;
                        ">确认删除</button>
                    </div>
                </div>
            `;

            // 添加到页面
            document.body.appendChild(dialog);

            // 绑定事件
            this.bindDeleteFieldDialogEvents(dialog, cellInfo);

            // 显示对话框
            setTimeout(() => {
                dialog.style.opacity = '1';
            }, 10);

            console.log('[DataTable] ✅ 删除字段确认对话框已显示');

        } catch (error) {
            console.error('[DataTable] ❌ 显示删除字段确认对话框失败:', error);
        }
    }
    /**
     * 🆕 绑定删除字段对话框事件
     */
    bindDeleteFieldDialogEvents(dialog, cellInfo) {
        const closeDialog = () => {
            dialog.style.opacity = '0';
            setTimeout(() => dialog.remove(), 300);
        };

        // 关闭事件
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) closeDialog();
        });
        dialog.querySelector('[data-action="close"]').addEventListener('click', closeDialog);
        dialog.querySelector('[data-action="cancel"]').addEventListener('click', closeDialog);

        // 确认输入监听
        const confirmationInput = dialog.querySelector('#delete-confirmation');
        const deleteButton = dialog.querySelector('[data-action="confirm-delete"]');

        confirmationInput.addEventListener('input', (e) => {
            if (e.target.value.trim().toUpperCase() === 'DELETE') {
                deleteButton.style.opacity = '1';
                deleteButton.style.pointerEvents = 'auto';
            } else {
                deleteButton.style.opacity = '0.5';
                deleteButton.style.pointerEvents = 'none';
            }
        });

        // 确认删除
        deleteButton.addEventListener('click', async () => {
            if (confirmationInput.value.trim().toUpperCase() === 'DELETE') {
                await this.executeDeleteField(cellInfo);
                closeDialog();
            }
        });

        // ESC键关闭
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeDialog();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
    }

    /**
     * 🆕 执行删除字段操作
     */
    async executeDeleteField(cellInfo) {
        try {
            console.log('[DataTable] 🗑️ 执行删除字段操作:', cellInfo);

            const fieldName = cellInfo.fieldName || cellInfo.property;

            // 获取字段的英文键名
            const infoBarTool = window.SillyTavernInfobar;
            const infoBarSettings = infoBarTool?.modules?.infoBarSettings || infoBarTool?.modules?.settings;

            if (!infoBarSettings) {
                throw new Error('InfoBarSettings模块未找到');
            }

            // 获取面板配置
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};

            let panelConfig = configs[cellInfo.panelId];
            if (!panelConfig) {
                panelConfig = { enabled: true };
                configs[cellInfo.panelId] = panelConfig;
            }

            // 查找字段的键名（支持基础字段和自定义字段）
            let fieldKey = null;
            let isCustomField = false;

            // 方法1：在subItems中查找自定义字段
            if (panelConfig.subItems && Array.isArray(panelConfig.subItems)) {
                const subItem = panelConfig.subItems.find(item =>
                    item.name === fieldName ||
                    item.displayName === fieldName
                );

                if (subItem) {
                    fieldKey = subItem.key || subItem.name;
                    isCustomField = true;
                    console.log('[DataTable] 🔍 找到自定义字段:', fieldKey);
                }
            }

            // 方法2：在映射表中查找基础字段
            if (!fieldKey) {
                const completeMapping = infoBarSettings.getCompleteDisplayNameMapping();
                const panelMapping = completeMapping[cellInfo.panelId];

                if (panelMapping) {
                    // 直接查找中文字段名
                    if (panelMapping[fieldName]) {
                        fieldKey = fieldName;
                    } else {
                        // 查找映射到该中文名的英文键
                        for (const [englishKey, chineseName] of Object.entries(panelMapping)) {
                            if (chineseName === fieldName) {
                                fieldKey = englishKey;
                                break;
                            }
                        }
                    }

                    if (fieldKey) {
                        console.log('[DataTable] 🔍 找到基础字段:', fieldKey);
                    }
                }
            }

            if (!fieldKey) {
                throw new Error(`字段 "${fieldName}" 未找到（既不在自定义字段中，也不在基础字段映射表中）`);
            }

            // 禁用字段而不是删除（通过设置enabled=false）
            if (isCustomField) {
                // 处理自定义字段：在subItems中禁用
                if (panelConfig.subItems && Array.isArray(panelConfig.subItems)) {
                    const subItem = panelConfig.subItems.find(item =>
                        item.name === fieldName ||
                        item.displayName === fieldName ||
                        item.key === fieldKey
                    );

                    if (subItem) {
                        subItem.enabled = false;
                        console.log('[DataTable] 🚫 已禁用自定义字段:', subItem);
                    }
                }
            } else {
                // 处理基础字段：在面板配置中禁用
                if (panelConfig[fieldKey] && typeof panelConfig[fieldKey] === 'object') {
                    panelConfig[fieldKey].enabled = false;
                    console.log('[DataTable] 🚫 已禁用基础字段:', fieldKey);
                } else {
                    // 如果基础字段配置不存在，创建一个禁用的配置
                    panelConfig[fieldKey] = { enabled: false };
                    console.log('[DataTable] 🚫 已创建禁用的基础字段配置:', fieldKey);
                }
            }

            // 保存配置
            extensionSettings['Information bar integration tool'] = configs;

            // 尝试多种保存方法
            try {
                if (context.saveSettingsDebounced) {
                    context.saveSettingsDebounced();
                    // 等待防抖函数执行
                    await new Promise(resolve => setTimeout(resolve, 100));
                } else if (typeof saveSettingsDebounced === 'function') {
                    saveSettingsDebounced();
                    await new Promise(resolve => setTimeout(resolve, 100));
                } else if (typeof saveSettings === 'function') {
                    await saveSettings();
                } else if (context.saveSettings) {
                    await context.saveSettings();
                } else {
                    console.warn('[DataTable] ⚠️ 未找到保存设置的方法，配置可能未持久化');
                }
                console.log('[DataTable] 💾 配置已保存');
            } catch (saveError) {
                console.warn('[DataTable] ⚠️ 保存配置失败，但禁用操作已完成:', saveError.message);
            }

            // 清理字段数据
            await this.cleanupFieldData(cellInfo.panelId, fieldKey);

            // 刷新表格显示
            this.refreshTableStructure();

            // 显示成功消息
            this.showSuccessMessage(`字段 "${fieldName}" 已成功删除（禁用）`);

            console.log('[DataTable] ✅ 字段删除操作完成');

        } catch (error) {
            console.error('[DataTable] ❌ 删除字段失败:', error);
            this.showErrorMessage('删除字段失败: ' + error.message);
        }
    }

    /**
     * 🆕 清理字段数据
     */
    async cleanupFieldData(panelId, fieldKey) {
        try {
            console.log('[DataTable] 🧹 开始清理字段数据:', { panelId, fieldKey });

            const dataCore = window.InfoBarData;
            if (!dataCore) {
                console.warn('[DataTable] ⚠️ 数据核心未找到，跳过数据清理');
                return;
            }

            // 获取面板数据
            const panelData = dataCore.getPanelData(panelId);
            if (!panelData || !Array.isArray(panelData)) {
                console.log('[DataTable] 📊 面板数据为空，无需清理');
                return;
            }

            let cleanedCount = 0;

            // 清理所有数据项中的该字段
            panelData.forEach((dataItem, index) => {
                if (dataItem && dataItem.rowData && typeof dataItem.rowData === 'object') {
                    // 查找所有可能的字段键名
                    const keysToDelete = [];

                    // 直接匹配字段键
                    if (dataItem.rowData[fieldKey] !== undefined) {
                        keysToDelete.push(fieldKey);
                    }

                    // 查找列索引形式的键（col_1, col_2等）
                    Object.keys(dataItem.rowData).forEach(key => {
                        if (key.startsWith('col_') && dataItem.rowData[key] !== undefined) {
                            // 检查这个列是否对应被删除的字段
                            // 这里可以通过字段映射来确定
                            const fieldMapping = this.getFieldMapping(panelId);
                            if (fieldMapping && fieldMapping[fieldKey] === key) {
                                keysToDelete.push(key);
                            }
                        }
                    });

                    // 删除找到的键
                    keysToDelete.forEach(key => {
                        delete dataItem.rowData[key];
                        cleanedCount++;
                        console.log(`[DataTable] 🗑️ 已清理数据项 ${index} 的字段 ${key}`);
                    });
                }
            });

            // 如果有数据被清理，保存数据
            if (cleanedCount > 0) {
                try {
                    await dataCore.savePanelData(panelId, panelData);
                    console.log(`[DataTable] 💾 已保存清理后的数据，共清理 ${cleanedCount} 个字段值`);
                } catch (saveError) {
                    console.warn('[DataTable] ⚠️ 保存清理后的数据失败:', saveError.message);
                }
            } else {
                console.log('[DataTable] 📊 没有找到需要清理的数据');
            }

        } catch (error) {
            console.error('[DataTable] ❌ 清理字段数据失败:', error);
        }
    }

    /**
     * 🆕 清理字段数据
     */
    async cleanupFieldData(panelId, fieldIndex) {
        try {
            console.log('[DataTable] 🧹 清理字段数据:', { panelId, fieldIndex });

            // 获取数据管理器
            const unifiedDataCore = window.InfoBarData;
            if (!unifiedDataCore) {
                console.warn('[DataTable] ⚠️ 统一数据核心未找到，跳过数据清理');
                return;
            }

            // 获取面板数据
            const panelData = unifiedDataCore.getAllPanelData()[panelId];
            if (!panelData || !Array.isArray(panelData)) {
                console.log('[DataTable] ℹ️ 面板无数据，无需清理');
                return;
            }

            // 清理每行数据中对应的字段
            const fieldKey = `col_${fieldIndex + 1}`;
            let cleanedCount = 0;

            panelData.forEach((rowData, rowIndex) => {
                if (rowData && typeof rowData === 'object' && rowData[fieldKey] !== undefined) {
                    delete rowData[fieldKey];
                    cleanedCount++;
                    console.log(`[DataTable] 🧹 清理第${rowIndex + 1}行的${fieldKey}字段`);
                }
            });

            // 重新整理字段索引（将后续字段前移）
            panelData.forEach(rowData => {
                if (rowData && typeof rowData === 'object') {
                    const keys = Object.keys(rowData).filter(key => key.startsWith('col_'));
                    keys.forEach(key => {
                        const colIndex = parseInt(key.replace('col_', ''));
                        if (colIndex > fieldIndex + 1) {
                            const newKey = `col_${colIndex - 1}`;
                            rowData[newKey] = rowData[key];
                            delete rowData[key];
                        }
                    });
                }
            });

            console.log(`[DataTable] ✅ 字段数据清理完成，共清理${cleanedCount}条记录`);

        } catch (error) {
            console.error('[DataTable] ❌ 清理字段数据失败:', error);
        }
    }
    /**
     * 🆕 显示添加字段对话框
     */
    showAddFieldDialog(cellInfo, position) {
        try {
            console.log('[DataTable] ➕ 显示添加字段对话框:', { cellInfo, position });

            // 创建对话框
            const dialog = document.createElement('div');
            dialog.className = 'field-rule-dialog add-field-dialog';
            dialog.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000000;
                opacity: 0;
                visibility: visible;
                transition: opacity 0.3s ease;
            `;

            const positionText = position === 'before' ? '向前' : '向后';
            const positionIcon = position === 'before' ? '⬅️' : '➡️';

            dialog.innerHTML = `
                <div class="dialog-content" style="
                    background: var(--theme-bg-primary, #2a2a2a);
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                    max-width: 600px;
                    width: 90%;
                    max-height: 80vh;
                    overflow: hidden;
                    border: 1px solid var(--theme-border-color, rgba(255,255,255,0.1));
                ">
                    <div class="dialog-header" style="
                        padding: 20px 24px 16px;
                        border-bottom: 1px solid var(--theme-border-color, rgba(255,255,255,0.1));
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <h3 style="margin: 0; color: var(--theme-text-primary, #ffffff); font-size: 18px;">
                            ${positionIcon} ${positionText}添加字段
                        </h3>
                        <button class="dialog-close" data-action="close" style="
                            background: none;
                            border: none;
                            color: var(--theme-text-secondary, #aaa);
                            font-size: 24px;
                            cursor: pointer;
                            padding: 0;
                            width: 32px;
                            height: 32px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            border-radius: 4px;
                            transition: background-color 0.2s;
                        ">×</button>
                    </div>
                    <div class="dialog-body" style="
                        padding: 24px;
                    ">
                        <div class="position-info" style="
                            background: var(--theme-bg-secondary, rgba(255,255,255,0.05));
                            border-radius: 8px;
                            padding: 16px;
                            margin-bottom: 20px;
                        ">
                            <div style="color: var(--theme-text-primary, #fff); margin-bottom: 8px;">
                                <strong>添加位置：</strong>
                            </div>
                            <div style="color: var(--theme-text-secondary, #aaa); font-size: 14px;">
                                在字段 "${cellInfo.fieldName || cellInfo.property}" ${positionText}添加新字段
                            </div>
                        </div>

                        <div class="form-group" style="margin-bottom: 20px;">
                            <label for="field-name" style="
                                display: block;
                                color: var(--theme-text-primary, #fff);
                                margin-bottom: 8px;
                                font-weight: 500;
                            ">字段名称 *</label>
                            <input type="text" id="field-name" placeholder="输入字段名称..." style="
                                width: 100%;
                                padding: 8px 12px;
                                background: var(--theme-bg-secondary, #333);
                                color: var(--theme-text-primary, #fff);
                                border: 1px solid var(--theme-border-color, #555);
                                border-radius: 4px;
                                font-size: 14px;
                                box-sizing: border-box;
                            " />
                            <div class="form-hint" style="
                                color: var(--theme-text-secondary, #aaa);
                                font-size: 13px;
                                line-height: 1.4;
                                margin-top: 4px;
                            ">字段的显示名称，例如：年龄、职业、状态等</div>
                        </div>

                        <div class="form-group" style="margin-bottom: 20px;">
                            <label for="field-description" style="
                                display: block;
                                color: var(--theme-text-primary, #fff);
                                margin-bottom: 8px;
                                font-weight: 500;
                            ">字段描述</label>
                            <textarea id="field-description" rows="3" placeholder="描述这个字段的用途和内容..." style="
                                width: 100%;
                                padding: 8px 12px;
                                background: var(--theme-bg-secondary, #333);
                                color: var(--theme-text-primary, #fff);
                                border: 1px solid var(--theme-border-color, #555);
                                border-radius: 4px;
                                font-size: 14px;
                                resize: vertical;
                                box-sizing: border-box;
                            "></textarea>
                            <div class="form-hint" style="
                                color: var(--theme-text-secondary, #aaa);
                                font-size: 13px;
                                line-height: 1.4;
                                margin-top: 4px;
                            ">详细描述字段的用途，帮助AI更好地理解和使用</div>
                        </div>

                        <div class="form-group" style="margin-bottom: 20px;">
                            <label for="field-type" style="
                                display: block;
                                color: var(--theme-text-primary, #fff);
                                margin-bottom: 8px;
                                font-weight: 500;
                            ">字段类型</label>
                            <select id="field-type" style="
                                width: 100%;
                                padding: 8px 12px;
                                background: var(--theme-bg-secondary, #333);
                                color: var(--theme-text-primary, #fff);
                                border: 1px solid var(--theme-border-color, #555);
                                border-radius: 4px;
                                font-size: 14px;
                            ">
                                <option value="text">文本</option>
                                <option value="number">数字</option>
                                <option value="date">日期</option>
                                <option value="status">状态</option>
                                <option value="category">分类</option>
                            </select>
                            <div class="form-hint" style="
                                color: var(--theme-text-secondary, #aaa);
                                font-size: 13px;
                                line-height: 1.4;
                                margin-top: 4px;
                            ">选择字段的数据类型，影响数据验证和显示</div>
                        </div>
                    </div>
                    <div class="dialog-footer" style="
                        padding: 16px 24px 20px;
                        border-top: 1px solid var(--theme-border-color, rgba(255,255,255,0.1));
                        display: flex;
                        justify-content: flex-end;
                        gap: 12px;
                    ">
                        <button class="btn-cancel" data-action="cancel" style="
                            padding: 8px 16px;
                            background: var(--theme-bg-secondary, #555);
                            color: var(--theme-text-primary, #fff);
                            border: 1px solid var(--theme-border-color, #666);
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                        ">取消</button>
                        <button class="btn-add" data-action="confirm-add" style="
                            padding: 8px 16px;
                            background: var(--theme-primary-color, #ff6b35);
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 500;
                        ">添加字段</button>
                    </div>
                </div>
            `;

            // 添加到页面
            document.body.appendChild(dialog);

            // 绑定事件
            this.bindAddFieldDialogEvents(dialog, cellInfo, position);

            // 显示对话框
            setTimeout(() => {
                dialog.style.opacity = '1';
            }, 10);

            console.log('[DataTable] ✅ 添加字段对话框已显示');

        } catch (error) {
            console.error('[DataTable] ❌ 显示添加字段对话框失败:', error);
        }
    }

    /**
     * 🆕 绑定添加字段对话框事件
     */
    bindAddFieldDialogEvents(dialog, cellInfo, position) {
        const closeDialog = () => {
            dialog.style.opacity = '0';
            setTimeout(() => dialog.remove(), 300);
        };

        // 关闭事件
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) closeDialog();
        });
        dialog.querySelector('[data-action="close"]').addEventListener('click', closeDialog);
        dialog.querySelector('[data-action="cancel"]').addEventListener('click', closeDialog);

        // 确认添加
        dialog.querySelector('[data-action="confirm-add"]').addEventListener('click', async () => {
            const fieldName = dialog.querySelector('#field-name').value.trim();
            const fieldDescription = dialog.querySelector('#field-description').value.trim();
            const fieldType = dialog.querySelector('#field-type').value;

            if (!fieldName) {
                this.showErrorMessage('请输入字段名称');
                return;
            }

            await this.executeAddField(cellInfo, position, {
                name: fieldName,
                description: fieldDescription,
                type: fieldType
            });
            closeDialog();
        });

        // ESC键关闭
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeDialog();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
    }

    /**
     * 🆕 执行添加字段操作
     */
    async executeAddField(cellInfo, position, fieldConfig) {
        try {
            console.log('[DataTable] ➕ 执行添加字段操作:', { cellInfo, position, fieldConfig });

            // 生成新字段的英文键名
            const fieldKey = fieldConfig.name.toLowerCase()
                .replace(/[\u4e00-\u9fff]/g, '') // 移除中文字符
                .replace(/\s+/g, '_') // 空格替换为下划线
                .replace(/[^a-z0-9_]/g, '') // 移除特殊字符
                || `custom_field_${Date.now()}`; // 如果为空则使用时间戳

            // 添加字段到面板配置
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};

            // 获取面板配置
            let panelConfig = configs[cellInfo.panelId];
            if (!panelConfig) {
                // 如果面板配置不存在，创建一个基础配置
                panelConfig = {
                    enabled: true,
                    subItems: []
                };
                configs[cellInfo.panelId] = panelConfig;
            }

            // 确保subItems数组存在
            if (!panelConfig.subItems || !Array.isArray(panelConfig.subItems)) {
                panelConfig.subItems = [];
            }

            // 确保键名唯一
            let uniqueKey = fieldKey;
            let counter = 1;
            while (panelConfig.subItems.some(item => item.key === uniqueKey)) {
                uniqueKey = `${fieldKey}_${counter}`;
                counter++;
            }

            // 创建新字段配置
            const newFieldConfig = {
                name: fieldConfig.name,
                displayName: fieldConfig.name,
                key: uniqueKey,
                enabled: true,
                description: fieldConfig.description || '',
                type: fieldConfig.type || 'text',
                required: false,
                value: '',
                createdAt: new Date().toISOString()
            };

            // 计算插入位置
            let insertIndex = panelConfig.subItems.length; // 默认添加到末尾

            if (cellInfo.columnIndex !== undefined) {
                if (position === 'before') {
                    insertIndex = cellInfo.columnIndex;
                } else {
                    insertIndex = cellInfo.columnIndex + 1;
                }
            }

            // 插入新字段配置
            panelConfig.subItems.splice(insertIndex, 0, newFieldConfig);
            console.log('[DataTable] ➕ 已添加字段配置到位置:', insertIndex, newFieldConfig);

            // 保存配置
            extensionSettings['Information bar integration tool'] = configs;

            // 尝试多种保存方法
            try {
                if (context.saveSettingsDebounced) {
                    context.saveSettingsDebounced();
                    // 等待防抖函数执行
                    await new Promise(resolve => setTimeout(resolve, 100));
                } else if (typeof saveSettingsDebounced === 'function') {
                    saveSettingsDebounced();
                    await new Promise(resolve => setTimeout(resolve, 100));
                } else if (typeof saveSettings === 'function') {
                    await saveSettings();
                } else if (context.saveSettings) {
                    await context.saveSettings();
                } else {
                    console.warn('[DataTable] ⚠️ 未找到保存设置的方法，配置可能未持久化');
                }
                console.log('[DataTable] 💾 配置已保存');
            } catch (saveError) {
                console.warn('[DataTable] ⚠️ 保存配置失败，但添加操作已完成:', saveError.message);
            }

            // 为现有数据添加新字段
            try {
                const dataCore = window.InfoBarData;
                if (dataCore) {
                    const panelData = dataCore.getPanelData(cellInfo.panelId);
                    if (panelData && Array.isArray(panelData)) {
                        panelData.forEach(rowData => {
                            if (rowData && typeof rowData === 'object') {
                                // 添加新字段，初始值为空
                                rowData[uniqueKey] = '';
                            }
                        });
                        console.log('[DataTable] ➕ 已为现有数据添加新字段');
                    }
                }
            } catch (dataError) {
                console.warn('[DataTable] ⚠️ 数据添加失败:', dataError.message);
            }

            // 刷新表格显示
            this.refreshTableStructure();

            // 显示成功消息
            const positionText = position === 'before' ? '向前' : '向后';
            this.showSuccessMessage(`字段 "${fieldConfig.name}" 已成功${positionText}添加`);

            console.log('[DataTable] ✅ 字段添加操作完成');

        } catch (error) {
            console.error('[DataTable] ❌ 添加字段失败:', error);
            this.showErrorMessage('添加字段失败: ' + error.message);
        }
    }

    /**
     * 🆕 调整字段索引
     */
    async adjustFieldIndices(panelId, insertIndex) {
        try {
            console.log('[DataTable] 🔄 调整字段索引:', { panelId, insertIndex });

            // 获取数据管理器
            const unifiedDataCore = window.InfoBarData;
            if (!unifiedDataCore) {
                console.warn('[DataTable] ⚠️ 统一数据核心未找到，跳过索引调整');
                return;
            }

            // 获取面板数据
            const panelData = unifiedDataCore.getAllPanelData()[panelId];
            if (!panelData || !Array.isArray(panelData)) {
                console.log('[DataTable] ℹ️ 面板无数据，无需调整索引');
                return;
            }

            // 调整每行数据的字段索引
            panelData.forEach((rowData, rowIndex) => {
                if (rowData && typeof rowData === 'object') {
                    // 获取所有列字段，按索引倒序处理（避免覆盖）
                    const colKeys = Object.keys(rowData)
                        .filter(key => key.startsWith('col_'))
                        .map(key => ({
                            key,
                            index: parseInt(key.replace('col_', ''))
                        }))
                        .sort((a, b) => b.index - a.index); // 倒序

                    // 将插入位置之后的字段索引后移
                    colKeys.forEach(({ key, index }) => {
                        if (index >= insertIndex + 1) {
                            const newKey = `col_${index + 1}`;
                            rowData[newKey] = rowData[key];
                            delete rowData[key];
                        }
                    });

                    console.log(`[DataTable] 🔄 调整第${rowIndex + 1}行的字段索引`);
                }
            });

            console.log('[DataTable] ✅ 字段索引调整完成');

        } catch (error) {
            console.error('[DataTable] ❌ 调整字段索引失败:', error);
        }
    }

    /**
     * 🆕 显示删除数据确认对话框
     */
    showDeleteDataConfirmation(cellInfo) {
        try {
            console.log('[DataTable] 🗑️ 显示删除数据确认对话框:', cellInfo);

            // 简单的确认对话框
            const confirmed = confirm(`确定要删除单元格数据吗？\n\n面板：${cellInfo.panelId}\n字段：${cellInfo.fieldName || cellInfo.property}${cellInfo.rowIndex !== undefined ? `\n行：${cellInfo.rowIndex + 1}` : ''}`);

            if (confirmed) {
                this.executeDeleteData(cellInfo);
            }

        } catch (error) {
            console.error('[DataTable] ❌ 显示删除数据确认对话框失败:', error);
        }
    }

    /**
     * 🆕 执行删除数据操作
     */
    async executeDeleteData(cellInfo) {
        try {
            console.log('[DataTable] 🗑️ 执行删除数据操作:', cellInfo);

            // 🔧 修复：将中文显示名转换为实际字段名
            let actualFieldName = cellInfo.property;
            
            // 尝试映射中文显示名到旧架构字段名
            const legacyFieldName = this.mapDisplayNameToLegacyField(cellInfo.property, cellInfo.panelId);
            if (legacyFieldName) {
                actualFieldName = legacyFieldName;
                console.log(`[DataTable] 🔄 字段名映射: "${cellInfo.property}" -> "${actualFieldName}"`);
            }

            // 多行数据：优先按行删除
            if (cellInfo.rowIndex !== undefined && cellInfo.rowIndex !== null) {
                // 解析实际数据键（col_X 或 英文键）
                const resolvedKey = this.resolveDataKeyForPanel(cellInfo.panelId, actualFieldName);
                await this.dataCore.deletePanelRowField?.(cellInfo.panelId, cellInfo.rowIndex, resolvedKey);
            } else {
                // 构建删除的键名
                let dataKey = this.resolveDataKeyForPanel(cellInfo.panelId, actualFieldName);
                if (cellInfo.npcId) {
                    dataKey = `${cellInfo.npcId}.${actualFieldName}`;
                } else if (cellInfo.orgId) {
                    dataKey = `${cellInfo.orgId}.${actualFieldName}`;
                }
                console.log(`[DataTable] 🔑 删除键名: "${dataKey}"`);
                // 使用统一数据核心删除数据
                await this.dataCore.deletePanelField(cellInfo.panelId, dataKey);
            }

            // 刷新表格显示
            await this.refreshTableData();

            this.showSuccessMessage(`字段 "${cellInfo.property}" 的数据已删除`);

        } catch (error) {
            console.error('[DataTable] ❌ 删除数据失败:', error);
            this.showErrorMessage('删除数据失败: ' + error.message);
        }
    }
    /**
     * 销毁组件
     */
    /**
     * 🆕 显示面板规则编辑对话框
     */
    async showPanelRuleDialog(panelId) {
        try {
            console.log('[DataTable] 🔧 显示面板规则编辑对话框:', panelId);

            // 检查是否已存在对话框，如果存在则先关闭
            const existingDialog = document.querySelector('.panel-rule-dialog');
            if (existingDialog) {
                console.log('[DataTable] 🔄 关闭已存在的面板规则对话框');
                existingDialog.remove();
            }

            // 获取面板规则管理器
            const panelRuleManager = window.SillyTavernInfobar?.modules?.panelRuleManager;
            if (!panelRuleManager) {
                console.error('[DataTable] ❌ 面板规则管理器不可用');
                this.showErrorMessage('面板规则管理器不可用，请检查系统配置');
                return;
            }

            // 获取现有规则
            const existingRule = panelRuleManager.getPanelRule(panelId);

            // 获取面板信息
            const panelInfo = this.getPanelInfo(panelId);

            // 🔧 新架构：不再需要模板

            // 创建面板规则编辑对话框 - 使用与字段规则对话框相同的样式
            const dialog = document.createElement('div');
            dialog.className = 'field-rule-dialog panel-rule-dialog';
            dialog.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000000;
                opacity: 0;
                visibility: visible;
                transition: opacity 0.3s ease;
            `;

            dialog.innerHTML = `
                <div class="dialog-content" style="
                    background: var(--theme-bg-primary, #2a2a2a);
                    color: var(--theme-text-primary, #ffffff);
                    border: 1px solid var(--theme-border-color, rgba(255,255,255,0.1));
                    border-radius: 12px;
                    padding: 0;
                    width: 500px;
                    max-width: 90vw;
                    max-height: 80vh;
                    overflow-y: auto;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                ">
                    <div class="dialog-header" style="
                        padding: 20px 24px 16px;
                        border-bottom: 1px solid var(--theme-border-color, rgba(255,255,255,0.1));
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <h3 style="margin: 0; color: var(--theme-text-primary, #ffffff); font-size: 18px;">面板规则编辑</h3>
                        <button class="dialog-close" data-action="close" style="
                            background: none;
                            border: none;
                            color: var(--theme-text-secondary, #aaa);
                            font-size: 24px;
                            cursor: pointer;
                            padding: 0;
                            width: 32px;
                            height: 32px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            border-radius: 4px;
                        ">×</button>
                    </div>
                    <div class="dialog-body" style="padding: 20px 24px;">
                        <div class="panel-info" style="
                            background: var(--theme-bg-secondary, rgba(255,255,255,0.05));
                            padding: 16px;
                            border-radius: 8px;
                            margin-bottom: 20px;
                        ">
                            <div class="info-row" style="display: flex; margin-bottom: 8px;">
                                <span class="info-label" style="
                                    color: var(--theme-text-secondary, #aaa);
                                    min-width: 60px;
                                    font-weight: 500;
                                ">面板:</span>
                                <span class="info-value" style="color: var(--theme-text-primary, #fff);">${panelInfo.name}</span>
                            </div>
                            <div class="info-row" style="display: flex;">
                                <span class="info-label" style="
                                    color: var(--theme-text-secondary, #aaa);
                                    min-width: 60px;
                                    font-weight: 500;
                                ">类型:</span>
                                <span class="info-value" style="color: var(--theme-text-primary, #fff);">${panelInfo.type}</span>
                            </div>
                        </div>

                        <div class="rule-form">
                            <!-- 🔧 新架构：删除启用面板规则和规则模板，专注于操作规则 -->

                                <div class="form-group" style="margin-bottom: 20px;">
                                    <label for="rule-description" style="
                                        display: block;
                                        color: var(--theme-text-primary, #fff);
                                        margin-bottom: 8px;
                                        font-weight: 500;
                                    ">规则描述</label>
                                    <textarea id="rule-description" rows="3" placeholder="描述这个面板应该记录什么样的内容..." style="
                                        width: 100%;
                                        padding: 8px 12px;
                                        background: var(--theme-bg-secondary, #333);
                                        color: var(--theme-text-primary, #fff);
                                        border: 1px solid var(--theme-border-color, #555);
                                        border-radius: 4px;
                                        font-size: 14px;
                                        resize: vertical;
                                        box-sizing: border-box;
                                    ">${existingRule?.description || ''}</textarea>
                                    <div class="form-hint" style="
                                        color: var(--theme-text-secondary, #aaa);
                                        font-size: 13px;
                                        line-height: 1.4;
                                        margin-top: 4px;
                                    ">详细描述面板的记录规则，帮助AI更好地理解记录要求</div>
                                </div>

                                <!-- 🆕 新增：更新规则 -->
                                <div class="form-group" style="margin-bottom: 20px;">
                                    <label for="update-rule" style="
                                        display: block;
                                        color: var(--theme-text-primary, #fff);
                                        margin-bottom: 8px;
                                        font-weight: 500;
                                    ">更新规则</label>
                                    <textarea id="update-rule" rows="3" placeholder="描述什么情况下需要更新现有数据..." style="
                                        width: 100%;
                                        padding: 8px 12px;
                                        background: var(--theme-bg-secondary, #333);
                                        color: var(--theme-text-primary, #fff);
                                        border: 1px solid var(--theme-border-color, #555);
                                        border-radius: 4px;
                                        font-size: 14px;
                                        resize: vertical;
                                        box-sizing: border-box;
                                    ">${existingRule?.updateRule || ''}</textarea>
                                    <div class="form-hint" style="
                                        color: var(--theme-text-secondary, #aaa);
                                        font-size: 13px;
                                        line-height: 1.4;
                                        margin-top: 4px;
                                    ">指导AI在什么情况下更新现有数据，例如：状态变化、位置改变、属性修改等</div>
                                </div>

                                <!-- 🆕 新增：增加规则 -->
                                <div class="form-group" style="margin-bottom: 20px;">
                                    <label for="add-rule" style="
                                        display: block;
                                        color: var(--theme-text-primary, #fff);
                                        margin-bottom: 8px;
                                        font-weight: 500;
                                    ">增加规则</label>
                                    <textarea id="add-rule" rows="3" placeholder="描述什么情况下需要增加新数据..." style="
                                        width: 100%;
                                        padding: 8px 12px;
                                        background: var(--theme-bg-secondary, #333);
                                        color: var(--theme-text-primary, #fff);
                                        border: 1px solid var(--theme-border-color, #555);
                                        border-radius: 4px;
                                        font-size: 14px;
                                        resize: vertical;
                                        box-sizing: border-box;
                                    ">${existingRule?.addRule || ''}</textarea>
                                    <div class="form-hint" style="
                                        color: var(--theme-text-secondary, #aaa);
                                        font-size: 13px;
                                        line-height: 1.4;
                                        margin-top: 4px;
                                    ">指导AI在什么情况下添加新数据，例如：新角色出现、新物品获得、新任务接受等</div>
                                </div>

                                <!-- 🆕 新增：删除规则 -->
                                <div class="form-group" style="margin-bottom: 20px;">
                                    <label for="delete-rule" style="
                                        display: block;
                                        color: var(--theme-text-primary, #fff);
                                        margin-bottom: 8px;
                                        font-weight: 500;
                                    ">删除规则</label>
                                    <textarea id="delete-rule" rows="3" placeholder="描述什么情况下需要删除数据..." style="
                                        width: 100%;
                                        padding: 8px 12px;
                                        background: var(--theme-bg-secondary, #333);
                                        color: var(--theme-text-primary, #fff);
                                        border: 1px solid var(--theme-border-color, #555);
                                        border-radius: 4px;
                                        font-size: 14px;
                                        resize: vertical;
                                        box-sizing: border-box;
                                    ">${existingRule?.deleteRule || ''}</textarea>
                                    <div class="form-hint" style="
                                        color: var(--theme-text-secondary, #aaa);
                                        font-size: 13px;
                                        line-height: 1.4;
                                        margin-top: 4px;
                                    ">指导AI在什么情况下删除数据，例如：角色离开、物品丢失、任务完成等</div>
                                </div>


                        </div>
                    </div>
                    <div class="dialog-footer" style="
                        padding: 16px 24px 20px;
                        border-top: 1px solid var(--theme-border-color, rgba(255,255,255,0.1));
                        display: flex;
                        justify-content: flex-end;
                        gap: 12px;
                    ">
                        <button class="btn-cancel" data-action="cancel" style="
                            padding: 8px 16px;
                            background: var(--theme-bg-secondary, #555);
                            color: var(--theme-text-primary, #fff);
                            border: 1px solid var(--theme-border-color, #666);
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                        ">取消</button>
                        <button class="btn-save" data-action="save" style="
                            padding: 8px 16px;
                            background: var(--theme-primary-color, #ff6b35);
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 500;
                        ">保存规则</button>
                    </div>
                </div>
            `;

            // 添加到页面
            document.body.appendChild(dialog);

            // 绑定事件
            this.bindPanelRuleDialogEvents(dialog, panelId, panelRuleManager);

            // 显示对话框
            setTimeout(() => {
                dialog.style.opacity = '1';
            }, 10);

            console.log('[DataTable] ✅ 面板规则编辑对话框已显示');

        } catch (error) {
            console.error('[DataTable] ❌ 显示面板规则编辑对话框失败:', error);
            this.showErrorMessage('显示面板规则编辑对话框失败: ' + error.message);
        }
    }

    /**
     * 🆕 获取面板信息
     */
    getPanelInfo(panelId) {
        const panelNameMap = {
            'personal': { name: '个人信息', type: 'personal' },
            'interaction': { name: '交互对象', type: 'interaction' },
            'tasks': { name: '任务系统', type: 'tasks' },
            'world': { name: '世界信息', type: 'world' },
            'organization': { name: '组织信息', type: 'organization' },
            'news': { name: '资讯内容', type: 'news' },
            'inventory': { name: '背包仓库', type: 'inventory' },
            'abilities': { name: '能力系统', type: 'abilities' },
            'plot': { name: '剧情面板', type: 'plot' },
            'cultivation': { name: '修仙世界', type: 'cultivation' },
            'fantasy': { name: '玄幻世界', type: 'fantasy' },
            'modern': { name: '都市现代', type: 'modern' },
            'historical': { name: '历史古代', type: 'historical' },
            'magic': { name: '魔法能力', type: 'magic' },
            'training': { name: '调教系统', type: 'training' }
        };

        return panelNameMap[panelId] || { name: panelId, type: 'custom' };
    }

    /**
     * 🆕 绑定面板规则对话框事件
     */
    bindPanelRuleDialogEvents(dialog, panelId, panelRuleManager) {
        // 关闭对话框
        const closeDialog = () => {
            dialog.style.opacity = '0';
            setTimeout(() => dialog.remove(), 300);
        };

        // 点击对话框外部关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                closeDialog();
            }
        });

        // 关闭按钮
        dialog.querySelector('[data-action="close"]').addEventListener('click', closeDialog);
        dialog.querySelector('[data-action="cancel"]').addEventListener('click', closeDialog);

        // 🔧 新架构：删除启用规则和模板相关的事件处理

        // 保存按钮
        dialog.querySelector('[data-action="save"]').addEventListener('click', async () => {
            await this.savePanelRule(dialog, panelId, panelRuleManager, closeDialog);
        });

        // ESC键关闭
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeDialog();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
    }




    /**
     * 🆕 保存面板规则
     */
    async savePanelRule(dialog, panelId, panelRuleManager, closeCallback) {
        try {
            const description = dialog.querySelector('#rule-description').value.trim();
            const updateRule = dialog.querySelector('#update-rule').value.trim();
            const addRule = dialog.querySelector('#add-rule').value.trim();
            const deleteRule = dialog.querySelector('#delete-rule').value.trim();

            // 验证必填字段
            if (!description) {
                this.showErrorMessage('请填写规则描述');
                return;
            }

            // 构建规则对象
            const rule = {
                description,
                updateRule,
                addRule,
                deleteRule,
                updatedAt: new Date().toISOString()
            };

            console.log('[DataTable] 💾 保存面板规则:', panelId, rule);

            // 保存规则
            const success = await panelRuleManager.setPanelRule(panelId, rule);

            if (success) {
                this.showSuccessMessage(`面板 "${this.getPanelInfo(panelId).name}" 的规则已成功保存`);
                closeCallback();
            } else {
                this.showErrorMessage('保存面板规则失败，请重试');
            }

        } catch (error) {
            console.error('[DataTable] ❌ 保存面板规则失败:', error);
            this.showErrorMessage('保存面板规则失败: ' + error.message);
        }
    }

    /**
     * 🔧 新增：显示删除字段数据确认对话框（旧方法，重命名避免冲突）
     */
    async showDeleteFieldDataConfirmation(cellInfo) {
        try {
            console.log('[DataTable] 🗑️ 显示删除字段确认对话框:', cellInfo);

            // 获取当前值
            const currentValue = await this.getCurrentCellValue(cellInfo);
            
            // 创建确认对话框
            const dialog = document.createElement('div');
            dialog.className = 'delete-confirmation-dialog';
            dialog.innerHTML = `
                <div class="dialog-overlay"></div>
                <div class="dialog-content">
                    <div class="dialog-header">
                        <h3>⚠️ 确认删除数据</h3>
                        <button class="dialog-close" data-action="close">×</button>
                    </div>
                    <div class="dialog-body">
                        <div class="warning-message">
                            <p>您即将删除以下字段的数据：</p>
                        </div>
                        <div class="field-info">
                            <div class="info-row">
                                <span class="info-label">面板:</span>
                                <span class="info-value">${this.getPanelDisplayName(cellInfo.panelId)}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">字段:</span>
                                <span class="info-value">${cellInfo.property}</span>
                            </div>
                            ${cellInfo.npcId ? `
                            <div class="info-row">
                                <span class="info-label">NPC:</span>
                                <span class="info-value">${this.getNpcDisplayName(cellInfo.npcId)}</span>
                            </div>
                            ` : ''}
                            ${cellInfo.orgId ? `
                            <div class="info-row">
                                <span class="info-label">组织:</span>
                                <span class="info-value">${this.getOrgDisplayName(cellInfo.orgId)}</span>
                            </div>
                            ` : ''}
                            <div class="info-row">
                                <span class="info-label">当前值:</span>
                                <span class="info-value current-value">${this.escapeHtml(currentValue)}</span>
                            </div>
                        </div>
                        <div class="warning-note">
                            <p><strong>注意：</strong>此操作将清空该字段的数据，但不会影响其他字段。</p>
                        </div>
                    </div>
                    <div class="dialog-footer">
                        <button class="btn btn-secondary" data-action="cancel">取消</button>
                        <button class="btn btn-danger" data-action="confirm-delete-field">确认删除</button>
                    </div>
                </div>
            `;

            // 添加到页面
            document.body.appendChild(dialog);

            // 绑定事件
            this.bindDeleteConfirmationEvents(dialog, cellInfo, 'field');

            // 显示对话框
            setTimeout(() => {
                dialog.classList.add('show');
            }, 10);

        } catch (error) {
            console.error('[DataTable] ❌ 显示删除字段确认对话框失败:', error);
        }
    }
    /**
     * 🔧 新增：显示删除数据行确认对话框
     */
    async showDeleteRowConfirmation(cellInfo) {
        try {
            console.log('[DataTable] 🗂️ 显示删除数据行确认对话框:', cellInfo);

            // 获取行数据预览
            const rowData = await this.getRowData(cellInfo);
            
            // 创建确认对话框
            const dialog = document.createElement('div');
            dialog.className = 'delete-confirmation-dialog';
            dialog.innerHTML = `
                <div class="dialog-overlay"></div>
                <div class="dialog-content">
                    <div class="dialog-header">
                        <h3>⚠️ 确认删除数据行</h3>
                        <button class="dialog-close" data-action="close">×</button>
                    </div>
                    <div class="dialog-body">
                        <div class="warning-message">
                            <p>您即将删除以下数据行的所有数据：</p>
                        </div>
                        <div class="field-info">
                            <div class="info-row">
                                <span class="info-label">面板:</span>
                                <span class="info-value">${this.getPanelDisplayName(cellInfo.panelId)}</span>
                            </div>
                            ${cellInfo.npcId ? `
                            <div class="info-row">
                                <span class="info-label">目标NPC:</span>
                                <span class="info-value">${this.getNpcDisplayName(cellInfo.npcId)}</span>
                            </div>
                            ` : ''}
                            ${cellInfo.orgId ? `
                            <div class="info-row">
                                <span class="info-label">目标组织:</span>
                                <span class="info-value">${this.getOrgDisplayName(cellInfo.orgId)}</span>
                            </div>
                            ` : ''}
                        </div>
                        <div class="row-data-preview">
                            <h4>将要删除的数据：</h4>
                            <div class="data-preview">
                                ${this.generateRowDataPreview(rowData)}
                            </div>
                        </div>
                        <div class="warning-note">
                            <p><strong>注意：</strong>此操作将删除该行的所有字段数据，且不可恢复！</p>
                            ${(cellInfo.npcId || cellInfo.orgId) ? `
                            <p><strong>特别提醒：</strong>这将删除整个${cellInfo.npcId ? 'NPC' : '组织'}的所有数据，不会影响其他${cellInfo.npcId ? 'NPC' : '组织'}。</p>
                            ` : ''}
                        </div>
                    </div>
                    <div class="dialog-footer">
                        <button class="btn btn-secondary" data-action="cancel">取消</button>
                        <button class="btn btn-danger" data-action="confirm-delete-row">确认删除</button>
                    </div>
                </div>
            `;

            // 添加到页面
            document.body.appendChild(dialog);

            // 绑定事件
            this.bindDeleteConfirmationEvents(dialog, cellInfo, 'row');

            // 显示对话框
            setTimeout(() => {
                dialog.classList.add('show');
            }, 10);

        } catch (error) {
            console.error('[DataTable] ❌ 显示删除数据行确认对话框失败:', error);
        }
    }

    /**
     * 🔧 新增：绑定删除确认对话框事件
     */
    bindDeleteConfirmationEvents(dialog, cellInfo, deleteType) {
        // 关闭对话框
        const closeDialog = () => {
            dialog.classList.remove('show');
            setTimeout(() => dialog.remove(), 300);
        };

        // 点击遮罩层关闭
        dialog.querySelector('.dialog-overlay').addEventListener('click', closeDialog);
        
        // 关闭按钮
        dialog.querySelector('[data-action="close"]').addEventListener('click', closeDialog);
        dialog.querySelector('[data-action="cancel"]').addEventListener('click', closeDialog);

        // 确认删除按钮
        const confirmAction = deleteType === 'field' ? 'confirm-delete-field' : 'confirm-delete-row';
        dialog.querySelector(`[data-action="${confirmAction}"]`).addEventListener('click', async () => {
            const confirmButton = dialog.querySelector(`[data-action="${confirmAction}"]`);
            confirmButton.disabled = true;
            confirmButton.textContent = '删除中...';

            try {
                if (deleteType === 'field') {
                    await this.executeDeleteFieldData(cellInfo);
                } else {
                    await this.executeDeleteRow(cellInfo);
                }
                closeDialog();
            } catch (error) {
                console.error(`[DataTable] ❌ 执行删除${deleteType === 'field' ? '字段' : '数据行'}失败:`, error);
                confirmButton.disabled = false;
                confirmButton.textContent = '确认删除';
            }
        });

        // ESC键关闭
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeDialog();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
    }

    /**
     * 🔧 新增：执行删除字段数据（旧方法，重命名避免冲突）
     */
    async executeDeleteFieldData(cellInfo) {
        try {
            console.log('[DataTable] 🗑️ 执行删除字段数据:', cellInfo);

            // 🔧 修复：将中文显示名转换为实际字段名
            let actualFieldName = cellInfo.property;
            
            // 尝试映射中文显示名到旧架构字段名
            const legacyFieldName = this.mapDisplayNameToLegacyField(cellInfo.property, cellInfo.panelId);
            if (legacyFieldName) {
                actualFieldName = legacyFieldName;
                console.log(`[DataTable] 🔄 字段名映射: "${cellInfo.property}" -> "${actualFieldName}"`);
            }

            // 构建删除的键名
            let dataKey = actualFieldName;
            if (cellInfo.npcId) {
                dataKey = `${cellInfo.npcId}.${actualFieldName}`;
            } else if (cellInfo.orgId) {
                dataKey = `${cellInfo.orgId}.${actualFieldName}`;
            }

            console.log(`[DataTable] 🔑 删除键名: "${dataKey}"`);

            // 删除数据
            await this.dataCore.deletePanelField(cellInfo.panelId, dataKey);

            // 刷新表格显示
            await this.refreshTableData();

            this.showSuccessMessage(`字段 "${cellInfo.property}" 的数据已删除`);

        } catch (error) {
            console.error('[DataTable] ❌ 删除字段数据失败:', error);
            this.showErrorMessage('删除字段数据失败: ' + error.message);
            throw error;
        }
    }

    /**
     * 🔧 新增：执行删除数据行
     */
    async executeDeleteRow(cellInfo) {
        try {
            console.log('[DataTable] 🗂️ 执行删除数据行:', cellInfo);

            if (cellInfo.npcId) {
                // 删除整个NPC的所有数据（行级别）
                await this.deleteNpcData(cellInfo.panelId, cellInfo.npcId);
                this.showSuccessMessage(`NPC "${this.getNpcDisplayName(cellInfo.npcId)}" 的所有数据已删除`);
            } else if (cellInfo.orgId) {
                // 删除整个组织的所有数据（行级别）
                await this.deleteOrgData(cellInfo.panelId, cellInfo.orgId);
                this.showSuccessMessage(`组织 "${this.getOrgDisplayName(cellInfo.orgId)}" 的所有数据已删除`);
            } else if (cellInfo.rowIndex !== undefined && cellInfo.rowIndex !== null) {
                // 多行数据：仅删除选中行
                await this.dataCore.deletePanelRow?.(cellInfo.panelId, cellInfo.rowIndex);
                this.showSuccessMessage(`已删除第 ${cellInfo.rowIndex + 1} 行数据`);
            } else {
                // 删除整个面板的数据
                await this.deletePanelData(cellInfo.panelId);
                this.showSuccessMessage(`面板 "${this.getPanelDisplayName(cellInfo.panelId)}" 的所有数据已删除`);
            }

            // 刷新表格显示
            await this.refreshTableData();

        } catch (error) {
            console.error('[DataTable] ❌ 删除数据行失败:', error);
            this.showErrorMessage('删除数据行失败: ' + error.message);
            throw error;
        }
    }

    /**
     * 🔧 新增：删除NPC数据（完整版本）
     */
    async deleteNpcData(panelId, npcId) {
        // 使用数据核心的完整删除方法，确保清理所有相关数据存储位置
        await this.dataCore.deleteNpcCompletely(panelId, npcId);
    }

    /**
     * 🔧 新增：删除组织数据（完整版本）
     */
    async deleteOrgData(panelId, orgId) {
        // 使用数据核心的完整删除方法，确保清理所有相关数据存储位置
        await this.dataCore.deleteOrganizationCompletely(panelId, orgId);
    }

    /**
     * 🔧 新增：删除面板数据
     */
    async deletePanelData(panelId) {
        // 清空整个面板的数据
        await this.dataCore.deletePanelData(panelId);
    }

    /**
     * 🔧 新增：获取行数据
     */
    async getRowData(cellInfo) {
        try {
            const panelData = await this.dataCore.getPanelData(cellInfo.panelId) || {};
            const rowData = {};

            if (cellInfo.npcId) {
                // 获取NPC的所有数据
                const prefix = cellInfo.npcId + '.';
                for (const key in panelData) {
                    if (key.startsWith(prefix)) {
                        const fieldName = key.substring(prefix.length);
                        rowData[fieldName] = panelData[key];
                    }
                }
            } else if (cellInfo.orgId) {
                // 获取组织的所有数据
                const prefix = cellInfo.orgId + '.';
                for (const key in panelData) {
                    if (key.startsWith(prefix)) {
                        const fieldName = key.substring(prefix.length);
                        rowData[fieldName] = panelData[key];
                    }
                }
            } else {
                // 普通面板：支持多行数据
                if (Array.isArray(panelData)) {
                    const idx = (cellInfo.rowIndex !== undefined && cellInfo.rowIndex !== null) ? cellInfo.rowIndex : 0;
                    const rowObj = panelData[idx] || {};
                    return { ...rowObj };
                }
                // 兼容：对象格式且键为数字索引 {0: {...}, 1: {...}}
                const numericKeys = Object.keys(panelData)
                    .filter(k => /^\d+$/.test(k))
                    .sort((a, b) => parseInt(a) - parseInt(b));
                if (numericKeys.length > 0) {
                    const idx = (cellInfo.rowIndex !== undefined && cellInfo.rowIndex !== null) ? cellInfo.rowIndex : 0;
                    const key = numericKeys[idx];
                    return key ? { ...panelData[key] } : {};
                }
                // 单行数据
                return panelData;
            }

            return rowData;
        } catch (error) {
            console.error('[DataTable] ❌ 获取行数据失败:', error);
            return {};
        }
    }

    /**
     * 🔧 新增：生成行数据预览
     */
    generateRowDataPreview(rowData) {
        const entries = Object.entries(rowData);
        if (entries.length === 0) {
            return '<p class="no-data">暂无数据</p>';
        }

        return entries.map(([key, value]) => `
            <div class="data-item">
                <span class="data-key">${key}:</span>
                <span class="data-value">${this.escapeHtml(String(value))}</span>
            </div>
        `).join('');
    }

    /**
     * 🔧 新增：获取NPC显示名称
     */
    getNpcDisplayName(npcId) {
        // 从npcId提取显示名称，例如npc0 -> NPC 1
        const match = npcId.match(/npc(\d+)/);
        if (match) {
            return `NPC ${parseInt(match[1]) + 1}`;
        }
        return npcId;
    }

    /**
     * 🔧 新增：获取组织显示名称
     */
    getOrgDisplayName(orgId, orgData = null) {
        // 🔧 修复：如果有组织数据，优先使用实际名称
        if (orgData && orgData.name && orgData.name.trim()) {
            return orgData.name.trim();
        }
        
        // 🔧 修复：如果没有组织数据，尝试从当前数据中获取
        if (!orgData) {
            const organizationData = this.getOrganizationDataSync();
            if (organizationData) {
                const orgGroups = this.groupOrgData(organizationData);
                const targetOrg = orgGroups[orgId];
                if (targetOrg && targetOrg.name && targetOrg.name.trim()) {
                    return targetOrg.name.trim();
                }
            }
        }
        
        // 最后使用默认格式
        const match = orgId.match(/org(\d+)/);
        if (match) {
            return `组织 ${parseInt(match[1]) + 1}`;
        }
        return orgId;
    }

    /**
     * 🆕 导出预设配置
     */
    async exportPreset() {
        try {
            console.log('[DataTable] 📤 开始导出预设配置...');

            // 获取当前所有配置数据
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};

            // 构建导出数据结构
            const exportData = {
                version: '2.0.0', // 🔧 升级版本号
                timestamp: new Date().toISOString(),
                description: '信息栏数据表格预设配置（包含完整表格结构）',
                panels: {},
                customPanels: {},
                fieldRules: {},
                panelRules: {},
                tableStructure: {}, // 🆕 添加表格结构信息
                fieldMappings: {}, // 🆕 添加字段映射信息
                dataLayout: {} // 🆕 添加数据布局信息
            };

            // 🆕 获取当前数据表格的实际结构
            const currentTableStructure = await this.getCurrentTableStructure();

            // 导出基础面板配置
            const standardPanels = [
                'personal', 'world', 'interaction', 'inventory', 'abilities',
                'tasks', 'organization', 'news', 'plot', 'cultivation',
                'fantasy', 'modern', 'historical', 'magic', 'training'
            ];

            standardPanels.forEach(panelId => {
                if (configs[panelId]) {
                    exportData.panels[panelId] = {
                        enabled: configs[panelId].enabled || false,
                        name: configs[panelId].name || panelId,
                        icon: configs[panelId].icon || 'fa-solid fa-info',
                        defaultCollapsed: configs[panelId].defaultCollapsed || false,
                        subItems: configs[panelId].subItems || [],
                        // 🆕 添加表格结构信息
                        tableStructure: currentTableStructure[panelId] || null
                    };
                }
            });

            // 导出自定义面板配置
            if (configs.customPanels) {
                Object.entries(configs.customPanels).forEach(([panelId, panelConfig]) => {
                    exportData.customPanels[panelId] = {
                        enabled: panelConfig.enabled || false,
                        name: panelConfig.name || panelId,
                        icon: panelConfig.icon || 'fa-solid fa-info',
                        defaultCollapsed: panelConfig.defaultCollapsed || false,
                        subItems: panelConfig.subItems || [],
                        // 🆕 添加表格结构信息
                        tableStructure: currentTableStructure[panelId] || null
                    };
                });
            }

            // 导出字段规则
            if (configs.fieldRules) {
                exportData.fieldRules = JSON.parse(JSON.stringify(configs.fieldRules));
            }

            // 导出面板规则
            if (configs.panelRules) {
                exportData.panelRules = JSON.parse(JSON.stringify(configs.panelRules));
            }

            // 🆕 导出表格结构信息
            exportData.tableStructure = currentTableStructure;

            // 🆕 导出字段映射信息
            exportData.fieldMappings = await this.getFieldMappings();

            // 🆕 导出数据布局信息
            exportData.dataLayout = await this.getDataLayout();

            // 生成文件名
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = `infobar-preset-${timestamp}.json`;

            // 创建下载链接
            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('[DataTable] ✅ 预设配置导出完成:', filename);
            this.showSuccessMessage(`预设配置已导出: ${filename}`);

        } catch (error) {
            console.error('[DataTable] ❌ 导出预设配置失败:', error);
            this.showErrorMessage('导出预设配置失败: ' + error.message);
        }
    }
    /**
     * 🆕 导入预设配置
     */
    async importPreset() {
        try {
            console.log('[DataTable] 📥 开始导入预设配置...');

            // 创建文件选择器
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.style.display = 'none';

            input.onchange = async (event) => {
                const file = event.target.files[0];
                if (!file) return;

                try {
                    const text = await file.text();
                    const importData = JSON.parse(text);

                    // 验证导入数据格式
                    if (!importData.version || !importData.panels) {
                        throw new Error('无效的预设配置文件格式');
                    }

                    console.log('[DataTable] 📋 导入数据验证通过，版本:', importData.version);
                    console.log('[DataTable] 📋 开始应用配置...');

                    // 获取当前配置
                    const context = SillyTavern.getContext();
                    const extensionSettings = context.extensionSettings;
                    let configs = extensionSettings['Information bar integration tool'] || {};

                    // 应用基础面板配置
                    Object.entries(importData.panels).forEach(([panelId, panelConfig]) => {
                        if (!configs[panelId]) {
                            configs[panelId] = {};
                        }

                        // 🆕 处理新版本的表格结构信息
                        const cleanConfig = { ...panelConfig };
                        if (cleanConfig.tableStructure) {
                            console.log(`[DataTable] 📊 导入面板 ${panelId} 的表格结构:`, cleanConfig.tableStructure);
                            // 表格结构信息用于重建界面，不保存到配置中
                            delete cleanConfig.tableStructure;
                        }

                        Object.assign(configs[panelId], cleanConfig);
                    });

                    // 应用自定义面板配置
                    if (importData.customPanels) {
                        if (!configs.customPanels) {
                            configs.customPanels = {};
                        }
                        Object.entries(importData.customPanels).forEach(([panelId, panelConfig]) => {
                            // 🆕 处理新版本的表格结构信息
                            const cleanConfig = { ...panelConfig };
                            if (cleanConfig.tableStructure) {
                                console.log(`[DataTable] 📊 导入自定义面板 ${panelId} 的表格结构:`, cleanConfig.tableStructure);
                                // 表格结构信息用于重建界面，不保存到配置中
                                delete cleanConfig.tableStructure;
                            }

                            configs.customPanels[panelId] = cleanConfig;
                        });
                    }

                    // 应用字段规则
                    if (importData.fieldRules) {
                        configs.fieldRules = importData.fieldRules;
                    }

                    // 应用面板规则
                    if (importData.panelRules) {
                        configs.panelRules = importData.panelRules;
                    }

                    // 🆕 处理表格结构信息（用于重建界面）
                    if (importData.tableStructure) {
                        console.log('[DataTable] 📊 导入表格结构信息:', Object.keys(importData.tableStructure).length, '个面板');
                        // 可以在这里根据表格结构信息重建界面
                    }

                    // 🆕 处理字段映射信息
                    if (importData.fieldMappings) {
                        console.log('[DataTable] 🗺️ 导入字段映射信息');
                        // 字段映射信息可以用于字段名称的正确显示
                    }

                    // 🆕 处理数据布局信息
                    if (importData.dataLayout) {
                        console.log('[DataTable] 📐 导入数据布局信息');
                        // 数据布局信息可以用于恢复表格的视觉布局
                    }

                    // 保存配置
                    extensionSettings['Information bar integration tool'] = configs;
                    await context.saveSettingsDebounced();

                    console.log('[DataTable] ✅ 预设配置导入完成');
                    this.showSuccessMessage('预设配置导入成功，正在刷新界面...');

                    // 刷新界面
                    setTimeout(() => {
                        this.refreshTableStructure();
                    }, 1000);

                } catch (parseError) {
                    console.error('[DataTable] ❌ 解析导入文件失败:', parseError);
                    this.showErrorMessage('导入失败: ' + parseError.message);
                }
            };

            document.body.appendChild(input);
            input.click();
            document.body.removeChild(input);

        } catch (error) {
            console.error('[DataTable] ❌ 导入预设配置失败:', error);
            this.showErrorMessage('导入预设配置失败: ' + error.message);
        }
    }

    /**
     * 🆕 获取当前表格结构信息
     */
    async getCurrentTableStructure() {
        try {
            const tableStructure = {};

            // 获取当前数据
            const dataCore = this.unifiedDataCore;
            if (!dataCore) return tableStructure;

            const allData = dataCore.getAllData();
            if (!allData || !allData.panels) return tableStructure;

            // 遍历所有面板，获取表格结构
            Object.entries(allData.panels).forEach(([panelId, panelData]) => {
                if (Array.isArray(panelData) && panelData.length > 0) {
                    // 多行数据面板
                    const firstRow = panelData[0];
                    const fields = Object.keys(firstRow).filter(key => !this.SYSTEM_FIELDS?.has(key));

                    tableStructure[panelId] = {
                        type: 'multiRow',
                        rowCount: panelData.length,
                        columnCount: fields.length,
                        fields: fields.map((fieldKey, index) => ({
                            key: fieldKey,
                            columnIndex: index,
                            displayName: this.getFieldDisplayName(fieldKey, panelId),
                            dataType: this.inferDataType(firstRow[fieldKey])
                        })),
                        sampleData: panelData.slice(0, 3) // 保存前3行作为样本
                    };
                } else if (panelData && typeof panelData === 'object') {
                    // 单行数据面板
                    const fields = Object.keys(panelData).filter(key => !this.SYSTEM_FIELDS?.has(key));

                    tableStructure[panelId] = {
                        type: 'singleRow',
                        rowCount: 1,
                        columnCount: fields.length,
                        fields: fields.map((fieldKey, index) => ({
                            key: fieldKey,
                            columnIndex: index,
                            displayName: this.getFieldDisplayName(fieldKey, panelId),
                            dataType: this.inferDataType(panelData[fieldKey])
                        })),
                        sampleData: [panelData]
                    };
                }
            });

            console.log('[DataTable] 📊 获取表格结构完成:', Object.keys(tableStructure).length, '个面板');
            return tableStructure;

        } catch (error) {
            console.error('[DataTable] ❌ 获取表格结构失败:', error);
            return {};
        }
    }

    /**
     * 🆕 获取字段映射信息
     */
    async getFieldMappings() {
        try {
            const fieldMappings = {};

            // 获取InfoBarSettings的字段映射
            const infoBarTool = window.SillyTavernInfobar;
            const infoBarSettings = infoBarTool?.modules?.infoBarSettings || infoBarTool?.modules?.settings;

            if (infoBarSettings && infoBarSettings.getCompleteFieldMapping) {
                const completeMapping = infoBarSettings.getCompleteFieldMapping();
                fieldMappings.complete = completeMapping;
            }

            // 获取本地字段标签映射
            if (this.FIELD_LABELS) {
                fieldMappings.local = this.FIELD_LABELS;
            }

            console.log('[DataTable] 🗺️ 获取字段映射完成');
            return fieldMappings;

        } catch (error) {
            console.error('[DataTable] ❌ 获取字段映射失败:', error);
            return {};
        }
    }

    /**
     * 🆕 获取数据布局信息
     */
    async getDataLayout() {
        try {
            const dataLayout = {};

            // 获取当前表格的DOM结构信息
            const tableGroups = this.modal?.querySelectorAll('.table-group');
            if (tableGroups) {
                tableGroups.forEach((group, index) => {
                    const panelId = group.getAttribute('data-panel');
                    if (panelId) {
                        const table = group.querySelector('.data-table');
                        const headers = table?.querySelectorAll('th');
                        const rows = table?.querySelectorAll('tbody tr');

                        dataLayout[panelId] = {
                            groupIndex: index,
                            headerCount: headers?.length || 0,
                            rowCount: rows?.length || 0,
                            headers: Array.from(headers || []).map(th => ({
                                text: th.textContent.trim(),
                                width: th.style.width || 'auto'
                            }))
                        };
                    }
                });
            }

            console.log('[DataTable] 📐 获取数据布局完成');
            return dataLayout;

        } catch (error) {
            console.error('[DataTable] ❌ 获取数据布局失败:', error);
            return {};
        }
    }

    /**
     * 🆕 推断数据类型
     */
    inferDataType(value) {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'string') {
            if (value.match(/^\d{4}-\d{2}-\d{2}/)) return 'date';
            if (value.match(/^https?:\/\//)) return 'url';
            if (value.length > 100) return 'longtext';
            return 'text';
        }
        if (Array.isArray(value)) return 'array';
        if (typeof value === 'object') return 'object';
        return 'unknown';
    }

    /**
     * 🆕 获取字段显示名称（统一方法）
     */
    getFieldDisplayName(fieldKey, panelId) {
        try {
            // 尝试多种方式获取字段显示名称
            let displayName = null;

            // 1. 从面板配置获取
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};
            const panelConfig = configs[panelId] || configs.customPanels?.[panelId];

            if (panelConfig && panelConfig.subItems) {
                const subItem = panelConfig.subItems.find(item =>
                    item.key === fieldKey || item.name === fieldKey
                );
                if (subItem && subItem.displayName) {
                    displayName = subItem.displayName;
                }
            }

            // 2. 从字段映射获取
            if (!displayName) {
                displayName = this.mapColFieldToDisplayName?.(fieldKey, panelId);
            }

            // 3. 从本地标签获取
            if (!displayName && this.FIELD_LABELS) {
                displayName = this.FIELD_LABELS[fieldKey];
            }

            // 4. 使用原始字段名
            return displayName || fieldKey;

        } catch (error) {
            console.error('[DataTable] ❌ 获取字段显示名称失败:', error);
            return fieldKey;
        }
    }

    destroy() {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }

        this.initialized = false;
        console.log('[DataTable] 💥 数据表格界面已销毁');
    }
}