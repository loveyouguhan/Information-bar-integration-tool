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

        // 分页设置
        this.pagination = {
            currentPage: 1,
            pageSize: 20,
            totalPages: 0,
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
                            <div class="success-notification" style="display: block;">
                                <span class="success-text">数据表格已成功加载！</span>
                            </div>
                            <button class="modal-close" onclick="this.closest('.data-table-modal').style.display='none'">×</button>
                        </div>
                    </div>

                    <!-- 顶部工具栏 -->
                    <div class="table-toolbar">
                        <div class="toolbar-left">
                            <button class="btn-tool active" data-action="table-records">
                                表格记录
                            </button>
                            <button class="btn-tool" data-action="lock-data">
                                锁定数据
                            </button>
                            <button class="btn-tool" data-action="export-data">
                                导出数据
                            </button>
                            <button class="btn-tool" data-action="import-data">
                                导入数据
                            </button>
                            <button class="btn-tool" data-action="backup-data">
                                备份数据
                            </button>
                        </div>
                        <div class="toolbar-right">
                            <div class="search-box">
                                <input type="text" placeholder="搜索数据..." class="search-input" />
                                <button class="btn-search">搜索</button>
                            </div>
                            <button class="btn-tool" data-action="refresh">
                                刷新
                            </button>
                        </div>
                    </div>

                    <!-- 主体内容区域 -->
                    <div class="modal-body">
                        ${this.createGroupedTables()}
                    </div>

                    <!-- 底部状态栏 -->
                    <div class="modal-footer">
                        <div class="footer-left">
                            <span class="status-text">数据加载完成</span>
                            <span class="record-count">共 <span class="count-number">0</span> 条记录</span>
                        </div>
                        <div class="footer-right">
                            <button class="btn-pagination" data-action="prev-page">上一页</button>
                            <span class="page-info">第 <span class="current-page">1</span> 页，共 <span class="total-pages">1</span> 页</span>
                            <button class="btn-pagination" data-action="next-page">下一页</button>
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
                                    <th class="select-column">
                                        <input type="checkbox" class="select-all-checkbox" />
                                    </th>
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
                            allSubItems.push({
                                name: this.getSubItemDisplayName(panelId, key), // 转换为中文显示名称
                                key: key,
                                enabled: true,
                                value: panel[key].value || '',
                                source: 'basicSettings' // 标记来源
                            });
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
                        const subItems = panel.subItems || [];
                        if (subItems.length > 0) {
                            enabledPanels.push({
                                id: panelId,
                                type: 'custom',
                                name: panel.name || '未命名面板',
                                icon: '🔧',
                                subItems: subItems,
                                count: subItems.length
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
            if (window.SillyTavernInfobar?.infoBarSettings) {
                const completeMapping = window.SillyTavernInfobar.infoBarSettings.getCompleteDisplayNameMapping();
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
            <div class="table-group">
                <div class="group-header">
                    <div class="group-title">
    
                        <span class="group-name">${panel.name}</span>
                        <span class="group-count">(${panel.count} 项)</span>
                    </div>
                    <div class="group-actions">
                        <button class="btn-group-action" data-action="expand-group" data-group="${panel.id}">
                            <span class="expand-icon">▼</span>
                        </button>
                        <button class="btn-group-action" data-action="edit-group" data-group="${panel.id}">
                            编辑
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
                { name: '小雨', key: 'xiaoyu', value: '朋友' },
                { name: '张经理', key: 'zhangjingli', value: '同事' },
                { name: '李医生', key: 'liyisheng', value: '医患关系' },
                { name: '王老师', key: 'wanglaoshi', value: '师生关系' },
                { name: '陈同学', key: 'chentongxue', value: '同学' },
                { name: '刘邻居', key: 'liulinju', value: '邻居' }
            ]
        };

        return defaultConfigs[panelId] || [];
    }

    /**
     * 创建动态表格 - 支持所有类型的面板
     */
    createDynamicTable(panel) {
        try {
            // 检查是否为交互对象面板且有多NPC数据
            if (panel.key === 'interaction') {
                return this.createInteractionTable(panel);
            }

            // 🔧 智能计算自适应列宽
            const columnAnalysis = this.calculateAdaptiveColumnWidths(panel);
            
            // 生成表头
            const headers = columnAnalysis.map((analysis, index) => {
                const { item, adaptiveWidth } = analysis;
                return `<th class="col-property" style="
                    width: ${adaptiveWidth}px;
                    min-width: 50px;
                    max-width: 300px;
                    padding: 8px;
                    text-align: center;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                ">${item.name}</th>`;
            }).join('');

            // 生成数据行 - 根据面板类型获取对应的数据值
            const dataRow = panel.subItems.map(item => {
                const value = this.getPanelItemValue(panel, item);
                const formattedValue = this.formatCellValue(value);
                return `<td class="cell-value" data-property="${item.name}" title="${this.escapeHtml(value)}" style="
                    padding: 8px;
                    vertical-align: top;
                    word-wrap: break-word;
                    max-width: 300px;
                ">${formattedValue}</td>`;
            }).join('');

            return `
                <div class="data-table-container" style="overflow-x: auto; max-width: 100%;">
                    <table class="data-table dark-table horizontal-layout" style="
                        table-layout: fixed;
                        width: auto;
                        min-width: fit-content;
                        border-collapse: collapse;
                    ">
                        <thead>
                            <tr>
                                <th class="col-select">
                                    <input type="checkbox" class="select-all-checkbox" />
                                </th>
                                ${headers}
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="data-row">
                                <td class="cell-select">
                                    <input type="checkbox" class="row-checkbox" />
                                </td>
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
     * 创建交互对象表格 - 支持多NPC数据（所有NPC同时显示）
     */
    createInteractionTable(panel) {
        try {
            // 获取交互数据
            const interactionData = this.getInteractionData();
            if (!interactionData) {
                return this.createEmptyTable(panel);
            }

            // 按NPC分组数据
            const npcGroups = this.groupNpcData(interactionData);
            const npcList = Object.entries(npcGroups);

            console.log('[DataTable] 🔍 交互表格NPC分组:', Object.keys(npcGroups));

            if (npcList.length === 0) {
                return this.createEmptyTable(panel);
            }

            // 🔧 智能计算自适应列宽（包含NPC名称列）
            const columnAnalysis = this.calculateAdaptiveColumnWidths(panel);
            
            // 生成表头（添加NPC名称列）
            const headers = `
                <th class="col-property" style="
                    width: 100px;
                    min-width: 80px;
                    max-width: 150px;
                    padding: 8px;
                    text-align: center;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                ">NPC名称</th>
                ${columnAnalysis.map(analysis => {
                    const { item, adaptiveWidth } = analysis;
                    return `<th class="col-property" style="
                        width: ${adaptiveWidth}px;
                        min-width: 50px;
                        max-width: 300px;
                        padding: 8px;
                        text-align: center;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    ">${item.name}</th>`;
                }).join('')}
            `;

            // 为每个NPC生成数据行
            const npcDataRows = npcList.map(([npcId, npcData]) => {
                const npcName = this.getNpcDisplayName(npcId, npcData);
                const dataRow = panel.subItems.map(item => {
                    const value = this.getNpcFieldValue(npcData, item);
                    const formattedValue = this.formatCellValue(value);
                    return `<td class="cell-value" data-property="${item.name}" title="${this.escapeHtml(value)}" style="
                        padding: 8px;
                        vertical-align: top;
                        word-wrap: break-word;
                        max-width: 300px;
                    ">${formattedValue}</td>`;
                }).join('');

                return `
                    <tr class="data-row npc-data-row" data-npc-id="${npcId}">
                        <td class="cell-select">
                            <input type="checkbox" class="row-checkbox" />
                        </td>
                        <td class="cell-value npc-name-cell" data-property="NPC名称">${npcName}</td>
                        ${dataRow}
                    </tr>
                `;
            }).join('');

            return `
                <div class="data-table-container" style="overflow-x: auto; max-width: 100%;">
                    <table class="data-table dark-table horizontal-layout" style="
                        table-layout: fixed;
                        width: auto;
                        min-width: fit-content;
                        border-collapse: collapse;
                    ">
                        <thead>
                            <tr>
                                <th class="col-select">
                                    <input type="checkbox" class="select-all-checkbox" />
                                </th>
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
            // 从数据核心获取实际的面板数据
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
                            return String(fieldValue);
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
                return String(fieldValue);
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
     * 增强字段值查找逻辑，支持多种字段名格式
     */
    findFieldValue(panelData, item) {
        try {
            // 构建可能的字段名列表
            const possibleFieldNames = [
                item.key,           // 原始key
                item.name,          // 显示名称
                item.id,            // ID
                item.fieldName,     // 字段名
                item.originalKey    // 原始键名
            ].filter(name => name); // 过滤掉空值

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

            console.log(`[DataTable] ❌ 字段查找失败，尝试的字段名:`, possibleFieldNames);
            console.log(`[DataTable] 📊 可用的字段:`, Object.keys(panelData));
            return null;

        } catch (error) {
            console.error('[DataTable] ❌ 字段值查找失败:', error);
            return null;
        }
    }

    /**
     * 格式化单元格内容，控制文本长度和显示方式
     */
    formatCellValue(value) {
        try {
            if (!value || value === '') {
                return '';
            }

            // 将值转换为字符串
            const strValue = String(value);

            // 🔧 控制文本长度，避免单元格过高
            const maxLength = 100; // 最大显示字符数
            const maxLines = 3;    // 最大显示行数

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
                max-width: 300px;
                max-height: 80px;
                overflow: hidden;
                white-space: pre-wrap;
                word-wrap: break-word;
                word-break: break-word;
                line-height: 1.4;
                text-overflow: ellipsis;
                display: -webkit-box;
                -webkit-line-clamp: 3;
                -webkit-box-orient: vertical;
            ">${this.escapeHtml(result)}</div>`;

        } catch (error) {
            console.error('[DataTable] ❌ 格式化单元格内容失败:', error);
            return this.escapeHtml(String(value || ''));
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
                
                // 获取该列的样本数据来估算内容长度
                const sampleValue = this.getPanelItemValue(panel, item);
                const sampleLength = String(sampleValue || '').length;
                dataLengths.push(sampleLength);
                
                // 计算最大内容长度
                const maxContentLength = Math.max(headerLength, ...dataLengths);
                
                // 🔧 根据内容长度和类型智能计算列宽
                let adaptiveWidth;
                
                // 特殊字段类型的优化处理
                const fieldName = item.name.toLowerCase();
                if (fieldName.includes('年龄') || fieldName.includes('age')) {
                    adaptiveWidth = 70; // 年龄通常是1-3位数字
                } else if (fieldName.includes('性别') || fieldName.includes('gender')) {
                    adaptiveWidth = 70; // 性别通常是2-3个字符
                } else if (fieldName.includes('身高') || fieldName.includes('体重') || fieldName.includes('血型')) {
                    adaptiveWidth = 85; // 身高体重血型等固定格式
                } else if (fieldName.includes('生日') || fieldName.includes('date')) {
                    adaptiveWidth = 95; // 日期格式
                } else {
                    // 根据内容长度动态计算
                    if (maxContentLength <= 2) {
                        adaptiveWidth = 65; // 很短的内容（如O型、男）
                    } else if (maxContentLength <= 5) {
                        adaptiveWidth = 85; // 短内容（如学生、女性）
                    } else if (maxContentLength <= 10) {
                        adaptiveWidth = 110; // 中等内容（如软件工程师）
                    } else if (maxContentLength <= 20) {
                        adaptiveWidth = 150; // 较长内容（如详细地址）
                    } else if (maxContentLength <= 40) {
                        adaptiveWidth = 200; // 长内容
                    } else {
                        adaptiveWidth = 250; // 很长内容（如详细描述）
                    }
                }
                
                // 考虑中文字符的显示宽度（中文字符通常比英文宽）
                const headerText = item.name || '';
                const chineseCharCount = (headerText.match(/[\u4e00-\u9fa5]/g) || []).length;
                const baseHeaderWidth = headerText.length * 14; // 每个字符约14px
                const minimumForHeader = Math.max(baseHeaderWidth, 50);
                
                // 确保列宽足够显示表头
                adaptiveWidth = Math.max(adaptiveWidth, minimumForHeader);
                
                return {
                    item,
                    headerLength,
                    maxContentLength,
                    adaptiveWidth: Math.min(Math.max(adaptiveWidth, 50), 300) // 限制在50-300px之间
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

        // 工具栏按钮事件（包括展开/收起）
        this.modal.addEventListener('click', (e) => {
            const actionElement = e.target.closest('[data-action]');
            if (actionElement) {
                e.preventDefault();
                e.stopPropagation();
                const action = actionElement.getAttribute('data-action');
                this.handleToolbarAction(action, e);
            }
        });

        // 复选框事件
        this.modal.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                this.handleCheckboxChange(e);
            }
        });
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
            case 'table-records':
                this.showTableRecords();
                break;
            case 'lock-data':
                this.toggleDataLock();
                break;
            case 'export-data':
                this.exportData();
                break;
            case 'import-data':
                this.importData();
                break;
            case 'backup-data':
                this.backupData();
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
     * 编辑分组
     */
    editGroup(groupName) {
        console.log(`[DataTable] ✏️ 编辑分组: ${groupName}`);
        // 这里可以添加编辑分组的逻辑
        this.showMessage(`编辑分组: ${groupName}`, 'info');
    }

    /**
     * 处理复选框变更
     */
    handleCheckboxChange(event) {
        const checkbox = event.target;

        if (checkbox.classList.contains('select-all-checkbox')) {
            // 全选/取消全选
            const table = checkbox.closest('table');
            const rowCheckboxes = table.querySelectorAll('.row-checkbox');
            rowCheckboxes.forEach(cb => cb.checked = checkbox.checked);
        }

        this.updateSelectionCount();
    }

    /**
     * 更新选择计数
     */
    updateSelectionCount() {
        const selectedCount = this.modal.querySelectorAll('.row-checkbox:checked').length;
        const countElement = this.modal.querySelector('.count-number');
        if (countElement) {
            countElement.textContent = selectedCount;
        }
    }

    // 工具栏操作方法的占位符实现
    showTableRecords() { console.log('[DataTable] 显示表格记录'); }
    toggleDataLock() { console.log('[DataTable] 切换数据锁定'); }
    exportData() { console.log('[DataTable] 导出数据'); }
    importData() { console.log('[DataTable] 导入数据'); }
    backupData() { console.log('[DataTable] 备份数据'); }
    refreshData() { console.log('[DataTable] 刷新数据'); }

    /**
     * 创建表格容器
     */
    createTableContainer() {
        return `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr class="table-header">
                            <th class="select-column">
                                <input type="checkbox" class="select-all-checkbox" />
                            </th>
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
     * 转换面板数据格式
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
                // 为每个面板的字段创建一行数据
                Object.entries(panelData).forEach(([fieldName, fieldValue]) => {
                    // 跳过元数据字段
                    if (['lastUpdated', 'source'].includes(fieldName)) {
                        return;
                    }

                    transformedData.push({
                        id: idCounter++,
                        timestamp: panelData.lastUpdated || Date.now(),
                        category: 'panel',
                        panel: panelName,
                        title: `${panelName} - ${fieldName}`,
                        field: fieldName,
                        content: String(fieldValue),
                        status: 'active',
                        source: panelData.source || 'unknown'
                    });
                });
            });

            console.log(`[DataTable] ✅ 转换完成，共 ${transformedData.length} 条面板数据`);
            return transformedData;

        } catch (error) {
            console.error('[DataTable] ❌ 转换面板数据格式失败:', error);
            return [];
        }
    }

    /**
     * 应用筛选
     */
    applyFilters() {
        try {
            let filtered = [...this.data];
            
            // 搜索筛选
            if (this.filters.search) {
                const searchTerm = this.filters.search.toLowerCase();
                filtered = filtered.filter(item => 
                    item.title.toLowerCase().includes(searchTerm) ||
                    String(item.content).toLowerCase().includes(searchTerm)
                );
            }
            
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
     * 渲染表格
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

            // 检查是否存在表格结构
            const groupedTables = this.modal.querySelector('.grouped-tables');

            if (!groupedTables) {
                // 如果没有表格结构，重新生成
                console.log('[DataTable] 🔄 没有表格结构，重新生成表格内容');
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
                }
            } else {
                // 检查是否有数据行，并验证数据结构是否匹配
                const tableGroups = groupedTables.querySelectorAll('.table-group');
                let hasValidDataRows = false;

                // 获取当前聊天的面板数据结构
                const currentChatId = this.dataCore.getCurrentChatId();
                const chatData = currentChatId ? this.dataCore.getChatData(currentChatId) : null;
                const currentPanels = chatData?.infobar_data?.panels || {};
                const currentPanelIds = Object.keys(currentPanels);

                // 检查表格结构是否与当前数据匹配
                if (currentPanelIds.length > 0) {
                    let matchingGroups = 0;

                    tableGroups.forEach(group => {
                        const editButton = group.querySelector('[data-action="edit-group"]');
                        if (editButton) {
                            const panelId = editButton.getAttribute('data-group');
                            if (panelId && currentPanelIds.includes(panelId)) {
                                const tbody = group.querySelector('tbody');
                                if (tbody) {
                                    const dataRows = tbody.querySelectorAll('tr:not(.empty-row)');
                                    if (dataRows.length > 0) {
                                        matchingGroups++;
                                    }
                                }
                            }
                        }
                    });

                    // 如果匹配的组数量与当前数据的面板数量相符，则认为结构匹配
                    hasValidDataRows = (matchingGroups === currentPanelIds.length && matchingGroups > 0);

                    console.log(`[DataTable] 🔍 数据结构检查: 当前面板${currentPanelIds.length}个, 匹配组${matchingGroups}个, 结构匹配: ${hasValidDataRows}`);
                }

                if (hasValidDataRows) {
                    // 如果有有效的数据行且结构匹配，直接更新数据
                    console.log('[DataTable] 🔄 数据结构匹配，更新数据内容');
                    this.updateGroupedTablesData();
                } else {
                    // 如果没有数据行或结构不匹配，重新生成表格内容
                    console.log('[DataTable] 🔄 数据结构不匹配或无数据行，重新生成表格内容');
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
                    }
                }
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
    updateGroupedTablesData() {
        try {
            if (!this.modal) return;

            // 获取所有表格组
            const tableGroups = this.modal.querySelectorAll('.table-group');

            tableGroups.forEach(group => {
                // 获取面板ID
                const editButton = group.querySelector('[data-action="edit-group"]');
                if (!editButton) return;

                const panelId = editButton.getAttribute('data-group');
                if (!panelId) return;

                // 更新该面板的数据
                this.updatePanelGroupData(group, panelId);
            });

            console.log('[DataTable] 🔄 分组表格数据已更新');

        } catch (error) {
            console.error('[DataTable] ❌ 更新分组表格数据失败:', error);
        }
    }

    /**
     * 更新单个面板组的数据
     */
    updatePanelGroupData(groupElement, panelId) {
        try {
            // 获取当前聊天数据
            const currentChatId = this.dataCore.getCurrentChatId();
            if (!currentChatId) return;

            const chatData = this.dataCore.getChatData(currentChatId);
            const panels = this.extractPanelsFromChatData(chatData);
            if (!panels) return;

            const panelData = panels[panelId];
            if (!panelData) return;

            // 更新表格中的数据单元格
            const dataCells = groupElement.querySelectorAll('.cell-value');

            dataCells.forEach(cell => {
                const property = cell.getAttribute('data-property');
                if (!property) return;

                // 查找对应的字段值
                let fieldValue = null;

                // 尝试不同的字段名匹配方式
                for (const [key, value] of Object.entries(panelData)) {
                    if (key === property ||
                        key.toLowerCase() === property.toLowerCase() ||
                        this.getFieldDisplayName(key) === property) {
                        fieldValue = value;
                        break;
                    }
                }

                // 更新单元格内容
                if (fieldValue !== null && fieldValue !== undefined) {
                    cell.textContent = String(fieldValue);
                    cell.setAttribute('title', `${property}: ${fieldValue}`);
                } else {
                    cell.textContent = '-';
                    cell.setAttribute('title', `${property}: 无数据`);
                }
            });

            console.log(`[DataTable] 📊 面板 ${panelId} 数据已更新`);

        } catch (error) {
            console.error(`[DataTable] ❌ 更新面板组数据失败 (${panelId}):`, error);
        }
    }

    /**
     * 获取字段的显示名称 - 使用统一的完整映射表
     */
    getFieldDisplayName(fieldKey, panelType = null) {
        try {
            // 🔧 修复：使用InfoBarSettings的完整映射表，确保所有字段都有正确的中文显示
            if (window.SillyTavernInfobar?.infoBarSettings) {
                const completeMapping = window.SillyTavernInfobar.infoBarSettings.getCompleteDisplayNameMapping();
                
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
     * 按NPC分组数据 - 修复版本 (与MessageInfoBarRenderer保持一致)
     */
    groupNpcData(interactionData) {
        const npcGroups = {};
        const globalFields = {}; // 存储全局字段

        console.log('[DataTable] 🔍 开始NPC数据分组，原始字段数:', Object.keys(interactionData).length);

        // 第一遍：收集所有NPC特定字段和全局字段
        Object.entries(interactionData).forEach(([key, value]) => {
            const match = key.match(/^(npc\d+)\.(.+)$/);
            if (match) {
                const [, npcId, fieldName] = match;
                if (!npcGroups[npcId]) {
                    npcGroups[npcId] = {};
                }
                npcGroups[npcId][fieldName] = value;
                console.log(`[DataTable] 📝 NPC字段: ${npcId}.${fieldName} = ${value}`);
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
            // 尝试不同的字段名匹配方式
            const possibleFieldNames = [
                item.key,
                item.name,
                item.name?.toLowerCase(),
                item.key?.toLowerCase()
            ].filter(Boolean);

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
                            <th class="col-select">
                                <input type="checkbox" class="select-all-checkbox" />
                            </th>
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
        
        // 清空现有列头（保留选择列）
        const selectColumn = headerRow.querySelector('.select-column');
        headerRow.innerHTML = '';
        headerRow.appendChild(selectColumn);
        
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
            
            // 选择列
            const selectTd = document.createElement('td');
            selectTd.className = 'select-column';
            selectTd.innerHTML = `<input type="checkbox" class="row-checkbox" value="${row.id}" />`;
            tr.appendChild(selectTd);
            
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

            // 搜索事件
            const searchInput = this.modal.querySelector('.search-input');
            searchInput.addEventListener('input', this.debounce((e) => {
                this.filters.search = e.target.value;
                this.applyFilters();
                if (this.modal) {
                    this.renderTable();
                }
            }, 300));

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
     * 刷新表格结构
     */
    refreshTableStructure() {
        try {
            if (!this.modal || this.modal.style.display === 'none') {
                console.log('[DataTable] 📋 表格未显示，标记需要刷新');
                this.needsRefresh = true;
                return;
            }

            console.log('[DataTable] 🔄 开始刷新表格结构...');

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
            case 'first-page':
                this.goToPage(1);
                break;
            case 'prev-page':
                this.goToPage(this.pagination.currentPage - 1);
                break;
            case 'next-page':
                this.goToPage(this.pagination.currentPage + 1);
                break;
            case 'last-page':
                this.goToPage(this.pagination.totalPages);
                break;
            case 'goto-page':
                this.goToPage(parseInt(e.target.dataset.page));
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
        
        // 页面大小变更
        if (e.target.classList.contains('page-size-select')) {
            this.pagination.pageSize = parseInt(e.target.value);
            this.pagination.currentPage = 1;
            this.applyFilters();
            if (this.modal) {
                this.renderTable();
            }
        }
        
        // 行选择变更
        if (e.target.classList.contains('row-checkbox')) {
            const rowId = e.target.value;
            if (e.target.checked) {
                this.selectedRows.add(rowId);
            } else {
                this.selectedRows.delete(rowId);
            }
            this.updateBatchActions();
        }
        
        // 全选变更
        if (e.target.classList.contains('select-all-checkbox')) {
            this.toggleSelectAll(e.target.checked);
        }
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

    /**
     * 全选/取消全选
     */
    toggleSelectAll(checked) {
        const checkboxes = this.modal.querySelectorAll('.row-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
            const rowId = checkbox.value;
            if (checked) {
                this.selectedRows.add(rowId);
            } else {
                this.selectedRows.delete(rowId);
            }
        });
        
        this.updateBatchActions();
    }

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
     * 销毁组件
     */
    destroy() {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
        
        this.initialized = false;
        console.log('[DataTable] 💥 数据表格界面已销毁');
    }
}
