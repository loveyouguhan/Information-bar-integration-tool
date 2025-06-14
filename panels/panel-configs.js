/**
 * 面板配置管理器
 * 动态加载和管理所有面板配置
 */

window.InfoBarPanelConfigs = (() => {
    'use strict';

    // 面板配置缓存
    let panelConfigs = {};
    let themesConfig = {};
    let isLoaded = false;

    // 扩展路径
    const EXTENSION_PATH = '/scripts/extensions/third-party/advanced-infobar-system';

    /**
     * 初始化配置管理器
     */
    async function initialize() {
        if (isLoaded) return;
        
        try {
            console.log('[PanelConfigs] 开始加载面板配置...');
            
            // 加载所有面板配置
            await loadAllPanelConfigs();
            
            // 加载主题配置
            await loadThemesConfig();
            
            isLoaded = true;
            console.log('[PanelConfigs] 面板配置加载完成');
            
        } catch (error) {
            console.error('[PanelConfigs] 配置加载失败:', error);
            
            // 使用内置默认配置
            loadDefaultConfigs();
        }
    }

    /**
     * 加载所有面板配置
     */
    async function loadAllPanelConfigs() {
        const panelFiles = [
            'personal', 'interaction', 'tasks', 'world', 
            'company', 'internet', 'inventory', 'abilities', 'story'
        ];

        for (const panelName of panelFiles) {
            try {
                const config = await loadPanelConfig(panelName);
                if (config) {
                    panelConfigs[panelName] = config;
                }
            } catch (error) {
                console.warn(`[PanelConfigs] 加载面板 ${panelName} 配置失败:`, error);
                // 使用默认配置
                panelConfigs[panelName] = getDefaultPanelConfig(panelName);
            }
        }
    }

    /**
     * 加载单个面板配置
     */
    async function loadPanelConfig(panelName) {
        const url = `${EXTENSION_PATH}/panels/${panelName}.json`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.warn(`[PanelConfigs] 无法从 ${url} 加载配置，使用内置配置`);
            return null;
        }
    }

    /**
     * 加载主题配置
     */
    async function loadThemesConfig() {
        try {
            const url = `${EXTENSION_PATH}/panels/themes.json`;
            const response = await fetch(url);
            if (response.ok) {
                themesConfig = await response.json();
            } else {
                themesConfig = getDefaultThemesConfig();
            }
        } catch (error) {
            console.warn('[PanelConfigs] 主题配置加载失败，使用默认主题');
            themesConfig = getDefaultThemesConfig();
        }
    }

    /**
     * 加载默认配置（内置备份）
     */
    function loadDefaultConfigs() {
        panelConfigs = {
            personal: getDefaultPanelConfig('personal'),
            interaction: getDefaultPanelConfig('interaction'),
            tasks: getDefaultPanelConfig('tasks'),
            world: getDefaultPanelConfig('world'),
            company: getDefaultPanelConfig('company'),
            internet: getDefaultPanelConfig('internet'),
            inventory: getDefaultPanelConfig('inventory'),
            abilities: getDefaultPanelConfig('abilities'),
            story: getDefaultPanelConfig('story')
        };
        
        themesConfig = getDefaultThemesConfig();
        isLoaded = true;
    }

    /**
     * 获取默认面板配置
     */
    function getDefaultPanelConfig(panelName) {
        const defaultConfigs = {
            personal: {
                id: 'personal',
                label: '个人信息',
                icon: 'fa-user-circle',
                description: '关于角色自身的基础信息设置',
                defaultEnabled: true,
                items: [
                    { id: 'name', label: '姓名', type: 'toggle', defaultValue: true },
                    { id: 'age', label: '年龄', type: 'toggle', defaultValue: true },
                    { id: 'gender', label: '性别', type: 'toggle', defaultValue: true },
                    { id: 'race', label: '种族', type: 'toggle', defaultValue: true },
                    { id: 'occupation', label: '职业', type: 'toggle', defaultValue: true },
                    { id: 'currentLocation', label: '当前位置', type: 'toggle', defaultValue: true },
                    { id: 'mood', label: '情绪', type: 'toggle', defaultValue: true },
                    { id: 'thoughts', label: '当前想法', type: 'toggle', defaultValue: true },
                    { id: 'status', label: '身体状态', type: 'toggle', defaultValue: true }
                ]
            },
            interaction: {
                id: 'interaction',
                label: '交互对象',
                icon: 'fa-users',
                description: '显示当前场景中主要NPC的信息',
                defaultEnabled: true,
                items: [
                    { id: 'name', label: '姓名', type: 'toggle', defaultValue: true },
                    { id: 'age', label: '年龄', type: 'toggle', defaultValue: true },
                    { id: 'gender', label: '性别', type: 'toggle', defaultValue: true },
                    { id: 'identity', label: '身份', type: 'toggle', defaultValue: true },
                    { id: 'mood', label: '情绪', type: 'toggle', defaultValue: true },
                    { id: 'currentState', label: '当前状态', type: 'toggle', defaultValue: true },
                    { id: 'affection', label: '好感度', type: 'toggle', defaultValue: true },
                    { id: 'relationship', label: '关系', type: 'toggle', defaultValue: true }
                ]
            },
            tasks: {
                id: 'tasks',
                label: '任务系统',
                icon: 'fa-tasks',
                description: '当前的主要任务、支线任务和目标管理',
                defaultEnabled: true,
                items: [
                    { id: 'showTaskType', label: '显示任务类型', type: 'toggle', defaultValue: true },
                    { id: 'showTaskStatus', label: '显示任务状态', type: 'toggle', defaultValue: true },
                    { id: 'showTaskDescription', label: '显示任务描述', type: 'toggle', defaultValue: true },
                    { id: 'mainQuest', label: '主线任务', type: 'toggle', defaultValue: true },
                    { id: 'sideQuests', label: '支线任务', type: 'toggle', defaultValue: true }
                ]
            },
            world: {
                id: 'world',
                label: '世界面板',
                icon: 'fa-globe-americas',
                description: '世界背景和环境信息',
                defaultEnabled: true,
                items: [
                    { id: 'time', label: '世界时间', type: 'toggle', defaultValue: true },
                    { id: 'location', label: '世界地点', type: 'toggle', defaultValue: true },
                    { id: 'weather', label: '世界天气', type: 'toggle', defaultValue: true },
                    { id: 'worldEvents', label: '世界事件', type: 'toggle', defaultValue: true }
                ]
            },
            company: {
                id: 'company',
                label: '公司信息',
                icon: 'fa-building',
                description: '关于角色当前主要关注的组织/公司信息',
                defaultEnabled: false,
                items: [
                    { id: 'name', label: '公司名称', type: 'toggle', defaultValue: true },
                    { id: 'type', label: '组织类型', type: 'toggle', defaultValue: true },
                    { id: 'status', label: '当前状态', type: 'toggle', defaultValue: true }
                ]
            },
            internet: {
                id: 'internet',
                label: '资讯内容',
                icon: 'fa-newspaper',
                description: '社交媒体、论坛、新闻和其他网络信息',
                defaultEnabled: false,
                items: [
                    { id: 'socialMediaFeed', label: '社交媒体流', type: 'toggle', defaultValue: true },
                    { id: 'forumPosts', label: '热门论坛帖子', type: 'toggle', defaultValue: true },
                    { id: 'newsHeadlines', label: '新闻头条', type: 'toggle', defaultValue: false }
                ]
            },
            inventory: {
                id: 'inventory',
                label: '背包/仓库',
                icon: 'fa-box',
                description: '管理角色的物品和资源',
                defaultEnabled: true,
                items: [
                    { id: 'inventoryItems', label: '背包物品', type: 'toggle', defaultValue: true },
                    { id: 'equipment', label: '装备物品', type: 'toggle', defaultValue: true },
                    { id: 'currency', label: '货币数量', type: 'toggle', defaultValue: true }
                ]
            },
            abilities: {
                id: 'abilities',
                label: '能力系统',
                icon: 'fa-magic',
                description: '角色的特殊能力和已习得技能',
                defaultEnabled: true,
                items: [
                    { id: 'specialAbilities', label: '特殊能力', type: 'toggle', defaultValue: true },
                    { id: 'learnedSkills', label: '已获得技能', type: 'toggle', defaultValue: true }
                ]
            },
            story: {
                id: 'story',
                label: '剧情面板',
                icon: 'fa-book',
                description: '管理剧情进展和关键事件',
                defaultEnabled: true,
                items: [
                    { id: 'mainQuest', label: '主线任务', type: 'toggle', defaultValue: true },
                    { id: 'keyEvents', label: '关键事件', type: 'toggle', defaultValue: true },
                    { id: 'storySummary', label: '剧情摘要', type: 'toggle', defaultValue: true }
                ]
            }
        };

        return defaultConfigs[panelName] || {};
    }

    /**
     * 获取默认主题配置
     */
    function getDefaultThemesConfig() {
        return {
            themes: {
                'modern-dark': {
                    name: '现代深色',
                    variables: {
                        '--infobar-bg': '#2d3748',
                        '--infobar-text': '#e2e8f0',
                        '--infobar-border': '#4a5568',
                        '--infobar-primary': '#4299e1'
                    }
                },
                'light': {
                    name: '浅色模式',
                    variables: {
                        '--infobar-bg': '#ffffff',
                        '--infobar-text': '#2d3748',
                        '--infobar-border': '#e2e8f0',
                        '--infobar-primary': '#3182ce'
                    }
                },
                'cyberpunk': {
                    name: '赛博朋克',
                    variables: {
                        '--infobar-bg': '#0a0f21',
                        '--infobar-text': '#00f0c0',
                        '--infobar-border': '#301b49',
                        '--infobar-primary': '#ff007f'
                    }
                }
            }
        };
    }

    // 公共API
    return {
        initialize,
        getPanelConfig: (panelName) => panelConfigs[panelName],
        getAllPanelConfigs: () => panelConfigs,
        getThemesConfig: () => themesConfig,
        isLoaded: () => isLoaded
    };
})();
