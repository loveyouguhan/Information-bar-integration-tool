/**
 * 前端显示管理器
 * 
 * 负责前端显示功能的实现：
 * - AI消息包装和预览窗口
 * - 面板按钮和子项显示
 * - 交互式添加框框
 * - 弹窗和菜单管理
 * 
 * @class FrontendDisplayManager
 */

export class FrontendDisplayManager {
    constructor(configManager, eventSystem, dataCore) {
        console.log('[FrontendDisplayManager] 🖥️ 前端显示管理器初始化开始');
        
        this.configManager = configManager;
        this.eventSystem = eventSystem;
        this.dataCore = dataCore;
        
        // 状态管理
        this.enabled = false;
        this.settings = {
            position: 'top',
            style: 'comfortable',
            showAddButtons: false,
            animationEnabled: true,
            maxPanels: 6,
            buttonSize: 'medium',
            autoHide: false,
            showTooltips: true,
            // 布局由设置面板维护: { top: [...], bottom: [...] }
            layout: { top: [], bottom: [] }
        };
        
        // UI元素
        this.wrappers = new Map(); // 存储AI消息包装器
        this.activePopups = new Set(); // 活动的弹窗
        
        // 事件绑定
        this.bindEvents();
        
        console.log('[FrontendDisplayManager] ✅ 前端显示管理器初始化完成');
        
        // 🔧 新增：注册全局方法，供前端调用
        this.registerGlobalMethods();
    }

    /**
     * 🔧 新增：注册全局方法
     */
    registerGlobalMethods() {
        try {
            // 确保全局对象存在
            if (!window.SillyTavernInfobar) {
                window.SillyTavernInfobar = {};
            }
            if (!window.SillyTavernInfobar.modules) {
                window.SillyTavernInfobar.modules = {};
            }
            
            // 注册前端显示管理器
            window.SillyTavernInfobar.modules.frontendDisplayManager = this;
            
            console.log('[FrontendDisplayManager] 🌐 全局方法已注册');
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 注册全局方法失败:', error);
        }
    }

    /**
     * 初始化方法
     */
    async init() {
        console.log('[FrontendDisplayManager] 🚀 开始初始化前端显示管理器');
        
        try {
            // 从配置中读取启用状态
            const saved = await this.getSavedFrontendDisplayConfig();
            console.log('[FrontendDisplayManager] 📋 加载的配置:', saved);

            // 自动启用逻辑：如果配置中enabled为true，或者存在任何配置项，则启用
            const hasConfiguredItems = (
                Array.isArray(saved?.topPanels) && saved.topPanels.length > 0
            ) || (
                Array.isArray(saved?.bottomPanels) && saved.bottomPanels.length > 0
            ) || (
                Array.isArray(saved?.topSubitems) && saved.topSubitems.length > 0
            ) || (
                Array.isArray(saved?.bottomSubitems) && saved.bottomSubitems.length > 0
            );

            // 严格按照用户设置的enabled状态执行，不进行自动启用
            if (saved.enabled === true) {
                console.log('[FrontendDisplayManager] 🔄 启用前端显示 (用户设置: enabled=' + saved.enabled + ')');
                await this.setEnabled(true);
                console.log('[FrontendDisplayManager] ✅ 前端显示已启用');
            } else {
                console.log('[FrontendDisplayManager] ⚠️ 前端显示保持禁用状态 (用户设置: enabled=' + saved.enabled + ')');
                await this.setEnabled(false);
            }
            
            // 设置初始化标志
            this.initialized = true;
            
            // 🔧 新增：初始化完成后立即尝试一次包装（无需等待启用后的延时）
            if (this.enabled) {
                setTimeout(() => this.wrapExistingMessagesWithRetry(0), 300);
            }
            
            console.log('[FrontendDisplayManager] ✅ 前端显示管理器初始化完成');
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 初始化失败:', error);
            this.initialized = false;
        }
    }

    /**
     * 绑定事件监听
     */
    bindEvents() {
        try {
            // 监听设置变更
            if (this.eventSystem) {
                this.eventSystem.on('frontend-display:settings-changed', (data) => {
                    this.updateSettings(data.settings);
                });

                this.eventSystem.on('frontend-display:enabled', (data) => {
                    this.setEnabled(data.enabled);
                });
                // 应用就绪与聊天切换后，做一次全面检查
                this.eventSystem.on('app:ready', () => {
                    if (this.enabled) {
                        this.ensureThemeVariables();
                        setTimeout(() => this.wrapExistingMessagesWithRetry(0), 300);
                    }
                });
                this.eventSystem.on('chat:changed', () => {
                    if (this.enabled) {
                        setTimeout(() => this.wrapExistingMessagesWithRetry(0), 300);
                    }
                });

                // 监听AI消息生成事件（兼容来源）
                this.eventSystem.on('message:generated', (data) => {
                    if (this.enabled && data?.messageElement) {
                        this.wrapAIMessage(data.messageElement);
                    }
                });

                // 监听内部消息事件：接收/渲染后再尝试包装（更可靠）
                this.eventSystem.on('message:received', () => {
                    if (this.enabled) {
                        setTimeout(() => this.checkAndWrapNewMessages(), 50);
                    }
                });
                this.eventSystem.on('message:regenerated', () => {
                    if (this.enabled) {
                        setTimeout(() => this.checkAndWrapNewMessages(), 50);
                    }
                });
                this.eventSystem.on('message:sent', () => {
                    if (this.enabled) {
                        // 用户消息发送后，下一条通常是AI，稍长延迟再检查
                        setTimeout(() => this.checkAndWrapNewMessages(), 1200);
                    }
                });
            }
            
            // 🔧 修复：监听SillyTavern原生事件，确保新AI消息被包装
            if (window.eventSource) {
                window.eventSource.on('message_received', (data) => {
                    console.log('[FrontendDisplayManager] 📨 收到SillyTavern原生消息接收事件');
                    if (this.enabled) {
                        // 延迟包装新消息，确保DOM已更新
                        setTimeout(() => {
                            this.checkAndWrapNewMessages();
                        }, 300);
                    }
                });

                window.eventSource.on('character_message_rendered', (data) => {
                    console.log('[FrontendDisplayManager] 🎭 收到角色消息渲染事件');
                    if (this.enabled) {
                        setTimeout(() => {
                            this.checkAndWrapNewMessages();
                        }, 100);
                    }
                });
            }

            console.log('[FrontendDisplayManager] 🔗 事件绑定完成');

        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 绑定事件失败:', error);
        }
    }

    /**
     * 观察消息DOM变化
     */
    observeMessages() {
        try {
            // 观察聊天容器的变化
            const chatContainer = document.querySelector('#chat');
            if (chatContainer) {
                this.messageObserver = new MutationObserver((mutations) => {
                    if (!this.enabled) return;

                    mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                // 检查是否是AI消息
                                const aiMessages = node.querySelectorAll ? 
                                    node.querySelectorAll('.mes[is_user="false"]') : 
                                    (node.classList && node.classList.contains('mes') && node.getAttribute('is_user') === 'false' ? [node] : []);
                                
                                // 🔧 修复：动态包装每条新的AI消息，不清理现有包装器
                                if (aiMessages.length > 0) {
                                    aiMessages.forEach(message => {
                                        // 确保消息有ID
                                        if (!message.id) {
                                            message.id = `mes_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                                        }
                                        
                                        // 只包装未包装的消息
                                        if (!this.wrappers.has(message.id)) {
                                            setTimeout(() => {
                                                console.log(`[FrontendDisplayManager] 📦 动态包装新AI消息: ${message.id}`);
                                                this.wrapAIMessage(message);
                                            }, 100);
                                        }
                                    });
                                }
                            }
                        });
                    });
                });

                this.messageObserver.observe(chatContainer, {
                    childList: true,
                    subtree: true
                });

                console.log('[FrontendDisplayManager] 👁️ 消息观察器已启动');
            }

        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 消息观察器启动失败:', error);
        }
    }

    /**
     * 🔧 修复：检查并包装新消息 - 动态包装所有未包装的AI消息
     */
    checkAndWrapNewMessages() {
        try {
            const aiMessages = document.querySelectorAll('.mes[is_user="false"]');
            console.log(`[FrontendDisplayManager] 🔍 检查 ${aiMessages.length} 条AI消息的包装状态`);
            
            let wrappedCount = 0;
            aiMessages.forEach(message => {
                // 确保消息有ID
                if (!message.id) {
                    message.id = `mes_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                }
                
                // 只包装未包装的消息
                if (!this.wrappers.has(message.id)) {
                    console.log(`[FrontendDisplayManager] 📦 包装AI消息: ${message.id}`);
                    this.wrapAIMessage(message);
                    wrappedCount++;
                }
            });
            
            if (wrappedCount > 0) {
                console.log(`[FrontendDisplayManager] ✅ 已包装 ${wrappedCount} 条新AI消息`);
            } else {
                console.log(`[FrontendDisplayManager] ℹ️ 所有AI消息均已包装`);
            }
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 检查新消息失败:', error);
        }
    }

    /**
     * 🔧 修复：清理现有的包装器（仅在禁用时使用）
     */
    cleanupExistingWrappers() {
        try {
            console.log('[FrontendDisplayManager] 🧹 开始清理现有包装器...');
            let removedCount = 0;
            
            this.wrappers.forEach((wrapper, messageId) => {
                this.removeMessageWrapper(messageId);
                removedCount++;
            });
            
            console.log(`[FrontendDisplayManager] 🧹 已清理 ${removedCount} 个包装器`);
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 清理包装器失败:', error);
        }
    }

    /**
     * 🔧 新增：清理前端显示
     * 禁用前端显示时调用，清理所有包装器
     */
    cleanupFrontendDisplay() {
        try {
            console.log('[FrontendDisplayManager] 🧹 清理前端显示');
            
            // 停止消息观察器
            if (this.messageObserver) {
                this.messageObserver.disconnect();
                this.messageObserver = null;
            }
            
            // 清理所有包装器
            this.cleanupExistingWrappers();
            
            console.log('[FrontendDisplayManager] ✅ 前端显示清理完成');
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 清理前端显示失败:', error);
        }
    }

    /**
     * 设置启用状态
     */
    async setEnabled(enabled) {
        try {
            this.enabled = enabled;
            console.log(`[FrontendDisplayManager] 🖥️ 前端显示${enabled ? '已启用' : '已禁用'}`);

            // 持久化启用状态，避免刷新后丢失
            try {
                const fd = await this.getSavedFrontendDisplayConfig();
                if (fd.enabled !== enabled) {
                    await this.saveFrontendDisplayConfig({ ...fd, enabled });
                }
            } catch (persistErr) {
                console.warn('[FrontendDisplayManager] ⚠️ 持久化启用状态失败:', persistErr);
            }

            if (enabled) {
                // 🔧 修复：启用时不清理现有包装器，只添加新的包装器
                // 初始化前端显示
                this.initializeFrontendDisplay();
                // 启动消息观察器
                this.observeMessages();
                
                // 🔧 修复：延迟包装现有消息，确保DOM已完全加载
                // 使用多重延迟重试机制
                setTimeout(() => {
                    this.wrapExistingMessagesWithRetry(0);
                }, 2000);
            } else {
                this.cleanupFrontendDisplay();
            }

        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 设置启用状态失败:', error);
        }
    }

    /**
     * 更新设置
     */
    async updateSettings(newSettings) {
        try {
            // 合并设置并从上下文补齐布局
            const merged = { ...this.settings, ...newSettings };
            const saved = await this.getSavedFrontendDisplayConfig();
            if (saved && saved.layout) {
                merged.layout = saved.layout;
            }
            this.settings = merged;
            console.log('[FrontendDisplayManager] ⚙️ 设置已更新:', this.settings);

            // 应用新设置到现有包装器
            this.applySettingsToWrappers();
            await this.renderLayoutForAllMessages();

        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 更新设置失败:', error);
        }
    }

    /**
     * 🔧 修复：初始化前端显示 - 动态包装所有AI消息
     */
    initializeFrontendDisplay() {
        try {
            console.log('[FrontendDisplayManager] 🚀 初始化前端显示功能');

            // 确保主题变量已存在：若InfoBarSettings尚未打开，尝试从保存的主题同步一次
            this.ensureThemeVariables();

            // 🔧 修复：包装所有未包装的AI消息
            const existingMessages = document.querySelectorAll('.mes[is_user="false"]');
            if (existingMessages.length > 0) {
                let wrappedCount = 0;
                
                existingMessages.forEach(message => {
                    // 确保消息有ID
                    if (!message.id) {
                        message.id = `mes_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        console.log('[FrontendDisplayManager] 🆔 为AI消息生成ID:', message.id);
                    }
                    
                    // 只包装未包装的消息
                    if (!this.wrappers.has(message.id)) {
                        // 包装消息
                        this.wrapAIMessage(message);
                        wrappedCount++;
                        
                        // 延迟渲染内容和修复样式，确保DOM完全更新
                        setTimeout(async () => {
                            await this.renderLayoutForMessage(message);
                            
                            // 修复包装器样式确保可见
                            const wrapper = message.previousElementSibling;
                            if (wrapper && wrapper.classList.contains('frontend-message-wrapper')) {
                                this.fixWrapperVisibility(wrapper, message);
                            }
                        }, 100 + wrappedCount * 50); // 错开渲染时间
                    }
                });
                
                console.log(`[FrontendDisplayManager] ✅ 已包装 ${wrappedCount} 条AI消息`);
            } else {
                console.log(`[FrontendDisplayManager] ℹ️ 没有找到AI消息`);
            }

        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 初始化前端显示失败:', error);
        }
    }

    /**
     * 🔧 新增：确保主题CSS变量已同步
     */
    ensureThemeVariables() {
        try {
            const root = document.documentElement;
            // 如果核心变量缺失，尝试从InfoBarSettings加载一次主题
            const bg = getComputedStyle(root).getPropertyValue('--theme-bg-primary');
            if (!bg || bg.trim() === '') {
                const tool = window.SillyTavernInfobar;
                const settings = tool?.infoBarSettings;
                if (settings && typeof settings.getThemeById === 'function') {
                    const context = SillyTavern.getContext();
                    const themeId = context?.extensionSettings?.['Information bar integration tool']?.theme?.current;
                    const theme = themeId ? settings.getThemeById(themeId) : null;
                    if (theme && typeof settings.applyTheme === 'function') {
                        settings.applyTheme(theme);
                        tool?.eventSystem?.emit('theme:changed', { themeId: theme.id, colors: theme.colors });
                        console.log('[FrontendDisplayManager] 🎨 已在初始化时同步主题变量');
                    }
                }
            }
        } catch (e) {
            console.warn('[FrontendDisplayManager] ⚠️ 同步主题变量失败（可忽略）:', e);
        }
    }

    /**
     * 🔧 新增：包装现有消息（带重试机制）
     * 延迟包装现有的AI消息，确保DOM已完全加载
     */
    wrapExistingMessagesWithRetry(retryCount = 0) {
        const maxRetries = 5;
        const retryDelay = 1000; // 每次重试间隔1秒
        
        try {
            console.log(`[FrontendDisplayManager] 🎁 开始延迟包装现有AI消息 (尝试 ${retryCount + 1}/${maxRetries + 1})`);

            // 查找所有AI消息
            const existingMessages = document.querySelectorAll('.mes[is_user="false"]');
            console.log(`[FrontendDisplayManager] 📋 找到 ${existingMessages.length} 条AI消息`);
            
            if (existingMessages.length > 0) {
                // 🔧 修复：包装所有未包装的AI消息，而不是只包装最后一条
                let wrappedCount = 0;
                let alreadyWrappedCount = 0;
                
                existingMessages.forEach(message => {
                    // 确保消息有ID
                    if (!message.id) {
                        message.id = `mes_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        console.log('[FrontendDisplayManager] 🆔 为AI消息生成ID:', message.id);
                    }
                    
                    // 检查是否已经包装过
                    if (this.wrappers.has(message.id)) {
                        alreadyWrappedCount++;
                        return;
                    }
                    
                    // 包装消息
                    this.wrapAIMessage(message);
                    wrappedCount++;
                    
                    // 延迟渲染内容
                    setTimeout(async () => {
                        await this.renderLayoutForMessage(message);
                        
                        // 修复包装器样式确保可见
                        const wrapper = message.previousElementSibling;
                        if (wrapper && wrapper.classList.contains('frontend-message-wrapper')) {
                            this.fixWrapperVisibility(wrapper, message);
                        }
                    }, 100 + wrappedCount * 50); // 错开渲染时间
                });
                
                console.log(`[FrontendDisplayManager] 🎁 已延迟包装 ${wrappedCount} 条AI消息，${alreadyWrappedCount} 条已存在`);
            } else {
                // 没有找到AI消息，进行重试
                if (retryCount < maxRetries) {
                    console.log(`[FrontendDisplayManager] ⏳ 未找到AI消息，${retryDelay}ms后重试...`);
                    setTimeout(() => {
                        this.wrapExistingMessagesWithRetry(retryCount + 1);
                    }, retryDelay);
                } else {
                    console.warn('[FrontendDisplayManager] ⚠️ 达到最大重试次数，停止尝试包装');
                }
            }

        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 延迟包装现有消息失败:', error);
            // 错误时也进行重试
            if (retryCount < maxRetries) {
                setTimeout(() => {
                    this.wrapExistingMessagesWithRetry(retryCount + 1);
                }, retryDelay);
            }
        }
    }

    /**
     * 🔧 新增：包装现有消息（兼容旧方法）
     * 延迟包装现有的AI消息，确保DOM已完全加载
     */
    wrapExistingMessages() {
        this.wrapExistingMessagesWithRetry(0);
    }

    /**
     * 修复包装器可见性
     */
    fixWrapperVisibility(wrapper, messageElement) {
        try {
            console.log('[FrontendDisplayManager] 🔧 修复包装器可见性');
            
            // CSS已经修复了基本样式，这里主要确保滚动位置
            setTimeout(() => {
                messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                console.log('[FrontendDisplayManager] 📍 包装器已滚动到可见位置');
            }, 200);
            
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 修复包装器可见性失败:', error);
        }
    }

    /**
     * 清理前端显示
     */
    cleanupFrontendDisplay() {
        try {
            console.log('[FrontendDisplayManager] 🧹 清理前端显示功能');

            // 停止消息观察器
            if (this.messageObserver) {
                this.messageObserver.disconnect();
                this.messageObserver = null;
                console.log('[FrontendDisplayManager] 👁️ 消息观察器已停止');
            }

            // 移除所有包装器
            this.wrappers.forEach((wrapper, messageId) => {
                this.removeMessageWrapper(messageId);
            });

            // 关闭所有弹窗
            this.activePopups.forEach(popup => {
                if (popup.parentNode) {
                    popup.parentNode.removeChild(popup);
                }
            });
            this.activePopups.clear();

            // 恢复被隐藏的信息栏
            this.restoreHiddenInfoBars();

            console.log('[FrontendDisplayManager] ✅ 前端显示清理完成');

        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 清理前端显示失败:', error);
        }
    }

    /**
     * 恢复被隐藏的信息栏
     */
    restoreHiddenInfoBars() {
        try {
            const hiddenInfoBars = document.querySelectorAll('.message-infobar[style*="display: none"], .infobar-panel[style*="display: none"], [data-infobar-rendered="true"][style*="display: none"]');
            hiddenInfoBars.forEach(infoBar => {
                infoBar.style.display = '';
            });
            console.log(`[FrontendDisplayManager] 🔄 已恢复 ${hiddenInfoBars.length} 个被隐藏的信息栏`);
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 恢复信息栏失败:', error);
        }
    }

    /**
     * 包装AI消息
     */
    wrapAIMessage(messageElement) {
        try {
            if (!messageElement) {
                console.warn('[FrontendDisplayManager] ⚠️ 无效的消息元素');
                return;
            }

            // 生成唯一ID（如果没有的话）
            if (!messageElement.id) {
                messageElement.id = 'mes_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            }

            if (this.wrappers.has(messageElement.id)) {
                console.log('[FrontendDisplayManager] ℹ️ 消息已包装，跳过:', messageElement.id);
                return; // 已经包装过
            }

            console.log('[FrontendDisplayManager] 📦 包装AI消息:', messageElement.id);

            // 完整包装逻辑：将AI消息完整包装在前端交互框架内
            const parentContainer = messageElement.parentNode;
            if (!parentContainer) {
                console.error('[FrontendDisplayManager] ❌ 消息元素没有父节点');
                return;
            }

            // 创建前端交互框架
            const frontendFrame = document.createElement('div');
            frontendFrame.className = 'frontend-message-wrapper';
            frontendFrame.dataset.messageId = messageElement.id;
            
            // 在原消息位置插入前端框架
            parentContainer.insertBefore(frontendFrame, messageElement);
            
            // 创建完整框架结构：顶部交互区 + AI消息 + 底部交互区
            frontendFrame.innerHTML = `
                <div class="frontend-top-interaction">
                    <div class="embedded-panels-container top-panels">
                        <!-- 顶部面板和子项将在这里渲染 -->
                    </div>
                </div>
                <div class="ai-message-container">
                    <div class="message-header">
                        <div class="message-avatar-section">
                            <!-- 头像将被移动到这里 -->
                        </div>
                        <div class="message-info-section">
                            <!-- 楼层号、角色名、时间等信息将显示在这里 -->
                        </div>
                        <div class="message-actions-section">
                            <!-- 操作按钮将被移动到这里 -->
                        </div>
                    </div>
                    <div class="message-content">
                        <!-- AI消息内容将被移动到这里 -->
                    </div>
                </div>
                <div class="frontend-bottom-interaction">
                    <div class="embedded-panels-container bottom-panels">
                        <!-- 底部面板和子项将在这里渲染 -->
                    </div>
                </div>
            `;
            
            // 将AI消息移动到框架内部并重新组织结构
            const aiMessageContainer = frontendFrame.querySelector('.ai-message-container');
            const messageContentArea = frontendFrame.querySelector('.message-content');
            messageContentArea.appendChild(messageElement);
            
            // 🔧 新增：重新组织消息元素到专门的头部区域
            this.reorganizeMessageElements(frontendFrame, messageElement);

            // 关键：在AI消息后插入一个清除浮动的分隔元素，确保下一个外部消息换行显示
            const clearfix = document.createElement('div');
            clearfix.className = 'clearfix-separator';
            aiMessageContainer.appendChild(clearfix);

            // 存储包装器引用
            this.wrappers.set(messageElement.id, frontendFrame);
            
            // 绑定包装器事件
            this.bindWrapperEvents(frontendFrame, messageElement);

            // 隐藏原有信息栏（如果存在）
            this.hideOriginalInfoBar(messageElement);

            // 根据已保存的布局渲染内容
            this.renderLayoutForMessage(messageElement);

            console.log('[FrontendDisplayManager] ✅ AI消息包装完成');

        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 包装AI消息失败:', error);
        }
    }

    /**
     * 🔧 新增：重新组织消息元素到专门的头部区域
     * 将头像、楼层号、角色名、操作按钮等元素重新组织到清晰的布局中
     */
    reorganizeMessageElements(frontendFrame, messageElement) {
        try {
            console.log('[FrontendDisplayManager] 🎨 开始重新组织消息元素');
            
            // 获取各个目标容器
            const avatarContainer = frontendFrame.querySelector('.message-avatar-section');
            const infoContainer = frontendFrame.querySelector('.message-info-section');
            const actionsContainer = frontendFrame.querySelector('.message-actions-section');
            
            // 1. 重新组织头像
            const originalAvatar = messageElement.querySelector('.avatar img');
            if (originalAvatar && avatarContainer) {
                const newAvatar = originalAvatar.cloneNode(true);
                newAvatar.className = 'reorganized-avatar';
                avatarContainer.appendChild(newAvatar);
                console.log('[FrontendDisplayManager] ✅ 头像重新组织完成');
            }
            
            // 2. 重新组织信息区域（角色名、楼层号等）
            if (infoContainer) {
                const infoWrapper = document.createElement('div');
                infoWrapper.className = 'message-meta-info';
                
                // 角色名称
                const originalName = messageElement.querySelector('.name_text');
                if (originalName) {
                    const newName = document.createElement('div');
                    newName.className = 'reorganized-character-name';
                    newName.textContent = originalName.textContent;
                    infoWrapper.appendChild(newName);
                }
                
                // 楼层号
                const messageNumber = messageElement.querySelector('.mesIDDisplay');
                if (messageNumber) {
                    const newNumber = document.createElement('div');
                    newNumber.className = 'reorganized-message-number';
                    newNumber.textContent = messageNumber.textContent;
                    infoWrapper.appendChild(newNumber);
                } else {
                    // 如果没有楼层号，从消息ID自动生成
                    const messageId = messageElement.id;
                    const numberMatch = messageId.match(/\d+/);
                    if (numberMatch) {
                        const syntheticNumber = document.createElement('div');
                        syntheticNumber.className = 'reorganized-message-number synthetic-number';
                        syntheticNumber.textContent = `#${numberMatch[0]}`;
                        infoWrapper.appendChild(syntheticNumber);
                    }
                }
                
                // 时间戳（如果有）
                const timestamp = messageElement.getAttribute('timestamp');
                if (timestamp) {
                    const timeElement = document.createElement('div');
                    timeElement.className = 'reorganized-timestamp';
                    timeElement.textContent = timestamp;
                    infoWrapper.appendChild(timeElement);
                }
                
                infoContainer.appendChild(infoWrapper);
                console.log('[FrontendDisplayManager] ✅ 信息区域重新组织完成');
            }
            
            // 3. 重新组织操作按钮（只保留消息操作和编辑按钮）
            if (actionsContainer) {
                const buttonWrapper = document.createElement('div');
                buttonWrapper.className = 'message-action-buttons';

                // 只保留关键的两个按钮
                const keyButtons = this.getKeyMessageButtons(messageElement);
                keyButtons.forEach((button) => {
                    const newButton = button.cloneNode(true);
                    newButton.className += ' reorganized-action';
                    // 复制事件
                    this.cloneButtonEvents(button, newButton);
                    buttonWrapper.appendChild(newButton);
                });

                // 如果没有检测到三个点按钮，则创建占位按钮
                const hasActionsButton = keyButtons.some(b => 
                    b.classList.contains('extraMesButtonsHint') || 
                    b.classList.contains('fa-ellipsis') ||
                    (b.title && b.title.includes('消息操作'))
                );
                
                if (!hasActionsButton) {
                    const actionsBtn = document.createElement('button');
                    actionsBtn.className = 'mes_button extraMesButtonsHint fa-solid fa-ellipsis reorganized-action';
                    actionsBtn.title = '消息操作';
                    // 点击后展开自定义菜单
                    actionsBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.toggleActionsMenu(actionsBtn, messageElement);
                    });
                    buttonWrapper.appendChild(actionsBtn);
                }

                const hasEditButton = keyButtons.some(b => 
                    b.classList.contains('mes_edit') ||
                    (b.title && b.title.includes('编辑'))
                );
                
                if (!hasEditButton) {
                    const editBtn = document.createElement('button');
                    editBtn.className = 'mes_button mes_edit fa-solid fa-pencil reorganized-action';
                    editBtn.title = '编辑';
                    // 映射到原始编辑按钮
                    editBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const orig = messageElement.querySelector('.mes_edit, [title*="编辑"], [class*="edit"]:not([class*="edit_done"]):not([class*="edit_cancel"])');
                        if (orig) orig.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                    });
                    buttonWrapper.appendChild(editBtn);
                }

                actionsContainer.appendChild(buttonWrapper);
                console.log(`[FrontendDisplayManager] ✅ 关键操作按钮重新组织完成: ${buttonWrapper.children.length}`);

                // 构建并挂载左侧展开的功能菜单（与消息操作关联）
                this.attachActionsMenu(buttonWrapper, messageElement);
                // 🔧 删除：用户不需要底部swipes计数器分页按钮
                // this.handleSwipesCounter(frontendFrame, messageElement);
            }
            
            // 4. 隐藏原始元素（保持DOM结构完整但不显示）
            this.hideOriginalElements(messageElement);
            
            console.log('[FrontendDisplayManager] ✅ 消息元素重新组织完成');
            
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 重新组织消息元素失败:', error);
        }
    }

    /**
     * 🔧 新增：获取关键的消息按钮（只保留消息操作和编辑按钮）
     */
    getKeyMessageButtons(messageElement) {
        const keyButtons = [];
        try {
            const messageActionsButton = messageElement.querySelector('.extraMesButtonsHint, .fa-ellipsis, [title*="消息操作"], [class*="extraMes"]');
            if (messageActionsButton) keyButtons.push(messageActionsButton);

            const editButton = messageElement.querySelector('.mes_edit, [title*="编辑"], [class*="edit"]:not([class*="edit_done"]):not([class*="edit_cancel"])');
            if (editButton) keyButtons.push(editButton);
        } catch (e) {
            console.error('[FrontendDisplayManager] ❌ 获取关键按钮失败:', e);
        }
        return keyButtons;
    }

    /**
     * 在头部区域挂载"消息操作"左展开菜单
     */
    attachActionsMenu(buttonWrapper, messageElement) {
        try {
            const actionsBtn = buttonWrapper.querySelector('.extraMesButtonsHint, .fa-ellipsis, [title*="消息操作"], [data-action="message-actions"]');
            if (!actionsBtn) return;

            // 构建菜单容器（默认隐藏，向左展开的图标按钮组）
            const menu = document.createElement('div');
            menu.className = 'message-actions-menu left hidden';
            menu.innerHTML = `
                <button class="menu-icon-item" data-action="translate" title="翻译消息"><i class="fa-solid fa-language"></i></button>
                <button class="menu-icon-item" data-action="generateImage" title="生成图片"><i class="fa-solid fa-image"></i></button>
                <button class="menu-icon-item" data-action="exclude" title="从提示词中排除消息"><i class="fa-solid fa-ban"></i></button>
                <button class="menu-icon-item" data-action="embed" title="嵌入文件或图像"><i class="fa-solid fa-paperclip"></i></button>
                <button class="menu-icon-item" data-action="checkpoint" title="创建检查点"><i class="fa-solid fa-flag-checkered"></i></button>
                <button class="menu-icon-item" data-action="branch" title="创建分支"><i class="fa-solid fa-code-branch"></i></button>
                <button class="menu-icon-item" data-action="copy" title="复制"><i class="fa-solid fa-copy"></i></button>
            `;
            // 挂载到按钮父容器，采用绝对定位
            buttonWrapper.appendChild(menu);

            // 菜单处理
            actionsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.classList.toggle('hidden');
            });
            // 点击外部关闭
            document.addEventListener('click', () => menu.classList.add('hidden'));
            menu.addEventListener('click', (e) => e.stopPropagation());

            // 逐项绑定
            menu.querySelectorAll('.menu-icon-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = item.getAttribute('data-action');
                    this.triggerOriginalAction(action, messageElement);
                    menu.classList.add('hidden');
                });
            });
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 构建消息操作菜单失败:', error);
        }
    }

    toggleActionsMenu(actionsBtn, messageElement) {
        try {
            const wrapper = actionsBtn.parentElement;
            let menu = wrapper.querySelector('.message-actions-menu');
            
            if (!menu) {
                // 如果菜单不存在，创建菜单
                this.attachActionsMenu(wrapper, messageElement);
                menu = wrapper.querySelector('.message-actions-menu');
            }
            
            if (menu) {
                menu.classList.toggle('hidden');
                console.log('[FrontendDisplayManager] 🎭 菜单状态切换:', menu.classList.contains('hidden') ? '隐藏' : '显示');
            }
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 切换菜单状态失败:', error);
        }
    }

    /**
     * 将自定义菜单动作映射到原生功能
     */
    triggerOriginalAction(action, messageElement) {
        try {
            const click = (el) => el && el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

            const mapDirect = {
                copy: () => click(messageElement.querySelector('.mes_copy, [title*="复制"], .fa-copy')),
                generateImage: () => click(messageElement.querySelector('[title*="生成图片"], [data-action*="image"], .fa-image')),
                translate: () => click(messageElement.querySelector('[title*="翻译"], [data-action*="translate"], .fa-language')),
                exclude: () => click(messageElement.querySelector('[title*="排除"], [data-action*="exclude"], .fa-ban')),
                embed: () => click(messageElement.querySelector('[title*="嵌入"], [data-action*="embed"], .fa-paperclip')),
                checkpoint: () => click(messageElement.querySelector('[title*="检查点"], [data-action*="checkpoint"], .fa-flag-checkered')),
                branch: () => click(messageElement.querySelector('[title*="分支"], [data-action*="branch"], .fa-code-branch')),
            };

            // 先尝试直接命中
            if (mapDirect[action] && mapDirect[action]()) return;

            // 否则通过原"消息操作"菜单间接触发
            const openBtn = messageElement.querySelector('.extraMesButtonsHint, .fa-ellipsis, [title*="消息操作"], [class*="extraMes"]');
            if (openBtn) {
                openBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                setTimeout(() => {
                    const menuRoot = document.querySelector('.menu, .popup, .dropdown, [role="menu"]');
                    if (!menuRoot) return;
                    const tryClickByText = (text) => {
                        const el = Array.from(menuRoot.querySelectorAll('*')).find(n => n.textContent && n.textContent.includes(text));
                        if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                    };
                    const textMap = {
                        translate: '翻译',
                        generateImage: '生成图片',
                        exclude: '排除',
                        embed: '嵌入',
                        checkpoint: '检查点',
                        branch: '分支',
                        copy: '复制',
                    };
                    tryClickByText(textMap[action] || '');
                }, 50);
            }
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 执行动作失败:', error);
        }
    }

    // 🔧 删除：handleSwipesCounter函数已删除 - 用户不需要分页按钮
    // 原函数功能：处理swipes计数器显示（左右箭头按钮和1/1计数器）
    // 删除原因：用户明确表示不需要前端交互界面的分页按钮功能

    /**
     * 🔧 新增：触发原生swipe菜单或功能
     */
    triggerSwipeMenu(messageElement) {
        try {
            console.log('[FrontendDisplayManager] 🔄 尝试触发swipe菜单');
            
            // 方法1: 查找原生的swipe相关按钮或菜单
            const swipeMenuBtn = messageElement.querySelector('.swipe_menu, .mes_swipe, [class*="swipe"][class*="menu"], [title*="swipe"], [title*="变体"]');
            if (swipeMenuBtn) {
                console.log('[FrontendDisplayManager] ✅ 找到swipe菜单按钮，触发点击');
                swipeMenuBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                return;
            }
            
            // 方法2: 查找消息操作菜单中的swipe选项
            const messageActionsBtn = messageElement.querySelector('.extraMesButtonsHint, .fa-ellipsis, [title*="消息操作"], [class*="extraMes"]');
            if (messageActionsBtn) {
                console.log('[FrontendDisplayManager] 🔄 通过消息操作菜单触发swipe功能');
                messageActionsBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                
                // 延迟查找swipe相关选项
                setTimeout(() => {
                    const popup = document.querySelector('.menu, .popup, .dropdown, [role="menu"]');
                    if (popup) {
                        const swipeOption = Array.from(popup.querySelectorAll('*')).find(el => 
                            el.textContent && (el.textContent.includes('swipe') || el.textContent.includes('变体') || el.textContent.includes('Swipe'))
                        );
                        if (swipeOption) {
                            console.log('[FrontendDisplayManager] ✅ 找到swipe选项，触发点击');
                            swipeOption.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                        }
                    }
                }, 50);
                return;
            }
            
            // 方法3: 尝试直接触发swipe事件或键盘快捷键
            const messageId = messageElement.getAttribute('mesid');
            if (messageId) {
                console.log('[FrontendDisplayManager] 🔄 尝试触发swipe相关事件');
                // 触发自定义swipe事件
                const swipeEvent = new CustomEvent('swipeMenu', {
                    detail: { messageId: messageId, element: messageElement },
                    bubbles: true
                });
                messageElement.dispatchEvent(swipeEvent);
                
                // 尝试触发全局swipe功能
                if (window.openSwipeMenu) {
                    window.openSwipeMenu(messageId);
                } else if (window.showSwipeOptions) {
                    window.showSwipeOptions(messageElement);
                }
            }
            
            console.log('[FrontendDisplayManager] ⚠️ 未找到可用的swipe触发方式');
            
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 触发swipe菜单失败:', error);
        }
    }

    /**
     * 🔧 新增：克隆按钮的事件监听器
     */
    cloneButtonEvents(originalButton, newButton) {
        try {
            // 复制基本的点击事件
            newButton.addEventListener('click', (e) => {
                // 阻止事件冒泡到包装器
                e.stopPropagation();
                
                // 触发原按钮的点击事件
                const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                originalButton.dispatchEvent(clickEvent);
            });
            
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 克隆按钮事件失败:', error);
        }
    }

    /**
     * 🔧 新增：隐藏原始消息中的重复元素
     */
    hideOriginalElements(messageElement) {
        try {
            // 隐藏原始头像
            const originalAvatar = messageElement.querySelector('.mesAvatarWrapper');
            if (originalAvatar) {
                originalAvatar.style.display = 'none';
            }
            
            // 隐藏原始按钮容器
            const originalButtons = messageElement.querySelector('.mes_buttons');
            if (originalButtons) {
                originalButtons.style.display = 'none';
            }
            
            // 隐藏原始名称和楼层号
            const originalName = messageElement.querySelector('.name_text');
            if (originalName) {
                originalName.style.display = 'none';
            }
            
            const originalNumber = messageElement.querySelector('.mesIDDisplay');
            if (originalNumber) {
                originalNumber.style.display = 'none';
            }
            
            console.log('[FrontendDisplayManager] ✅ 原始元素隐藏完成');
            
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 隐藏原始元素失败:', error);
        }
    }

    /**
     * 隐藏原有信息栏
     */
    hideOriginalInfoBar(messageElement) {
        try {
            // 查找并隐藏原有的信息栏
            const existingInfoBar = messageElement.querySelector('.message-infobar, .infobar-panel');
            if (existingInfoBar) {
                existingInfoBar.style.display = 'none';
                console.log('[FrontendDisplayManager] 🙈 已隐藏原有信息栏');
            }

            // 也可以隐藏消息中的信息栏渲染器产生的内容
            const infoBarRendered = messageElement.querySelector('[data-infobar-rendered="true"]');
            if (infoBarRendered) {
                infoBarRendered.style.display = 'none';
                console.log('[FrontendDisplayManager] 🙈 已隐藏信息栏渲染内容');
            }

        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 隐藏原有信息栏失败:', error);
        }
    }

    /**
     * 创建消息包装器
     */
    createMessageWrapper(messageElement) {
        const wrapper = document.createElement('div');
        wrapper.className = `frontend-message-wrapper ${this.settings.style}`;
        wrapper.dataset.messageId = messageElement.id;

        wrapper.innerHTML = `
            ${this.settings.showAddButtons ? this.createAddSlots('top') : ''}
            
            <div class="ai-message-container">
                <!-- 原AI消息将被移入这里 -->
            </div>
            
            <div class="embedded-panels-container">
                <!-- 动态添加的面板和子项将显示在这里 -->
            </div>
            
            ${this.settings.showAddButtons ? this.createAddSlots('bottom') : ''}
        `;

        return wrapper;
    }

    /**
     * 创建添加槽位
     */
    createAddSlots(position) {
        const slotsCount = Math.min(this.settings.maxPanels, 6);
        const slots = Array.from({ length: slotsCount }, (_, index) => {
            return `<div class="add-slot ${this.settings.buttonSize}" data-position="${position}-${index + 1}" title="点击添加面板或子项">+</div>`;
        }).join('');

        return `
            <div class="add-panel-slots ${position}-slots">
                ${slots}
            </div>
        `;
    }

    /**
     * 绑定包装器事件
     */
    bindWrapperEvents(wrapper, messageElement) {
        try {
            // 添加槽位点击事件
            wrapper.addEventListener('click', (e) => {
                // 🔧 修复：检查是否是插件相关的点击，只有在处理插件功能时才阻止事件传播
                
                const addSlot = e.target.closest('.add-slot');
                if (addSlot) {
                    e.stopPropagation(); // 只在处理添加槽位时阻止传播
                    console.log('[FrontendDisplayManager] 🎯 点击添加槽位:', addSlot.dataset.position);
                    const position = addSlot.dataset.position;
                    this.showAddPanelMenu(position, addSlot, messageElement);
                    return;
                }

                // 面板按钮点击事件
                const panelButton = e.target.closest('.panel-button');
                if (panelButton && !panelButton.classList.contains('demo')) {
                    e.stopPropagation(); // 只在处理面板按钮时阻止传播
                    console.log('[FrontendDisplayManager] 🎭 点击面板按钮:', panelButton.dataset.panel);
                    const panelId = panelButton.dataset.panel || panelButton.dataset.panelId;
                    this.showPanelPopup(panelId, messageElement);
                    return;
                }

                // 🔧 修复：对于其他点击（如消息内的按钮），让事件正常传播
                // 不调用 stopPropagation()，让消息按钮的点击事件能够正常处理
                console.log('[FrontendDisplayManager] 🔄 允许事件传播给消息内按钮');
            });

            console.log('[FrontendDisplayManager] 🔗 包装器事件绑定完成');

        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 绑定包装器事件失败:', error);
        }
    }

    /**
     * 🔧 修改：从ConfigManager读取前端显示配置
     * 使用统一的配置管理接口
     */
    async getSavedFrontendDisplayConfig() {
        try {
            // 优先使用ConfigManager获取配置
            if (this.configManager && this.configManager.initialized) {
                const config = await this.configManager.getFrontendDisplayConfig();
                if (config) {
                    console.log('[FrontendDisplayManager] 📋 从ConfigManager获取前端显示配置:', config);
                    return config;
                }
            }

            // 🔧 兼容性处理：如果ConfigManager未初始化，回退到原有方式
            console.warn('[FrontendDisplayManager] ⚠️ ConfigManager未就绪，使用兼容模式');
            const context = window.SillyTavern?.getContext?.() || SillyTavern.getContext();
            if (!context) return {};
            if (!context.extensionSettings) context.extensionSettings = {};
            if (!context.extensionSettings['Information bar integration tool']) {
                context.extensionSettings['Information bar integration tool'] = {};
            }

            // 读取已保存配置（不做破坏性重置）
            const configs = context.extensionSettings['Information bar integration tool'];
            const fd = { ...(configs.frontendDisplay || {}) };

            // 按字段逐一补全默认值，避免覆盖已保存的数组
            const beforeJson = JSON.stringify(fd);
            // 默认关闭前端显示（首次安装）
            if (typeof fd.enabled !== 'boolean') fd.enabled = false;
            if (!fd.position) fd.position = 'both';
            if (!fd.style) fd.style = 'compact';
            if (typeof fd.showAddButtons !== 'boolean') fd.showAddButtons = true;
            if (typeof fd.animationEnabled !== 'boolean') fd.animationEnabled = true;
            if (typeof fd.maxPanels !== 'number') fd.maxPanels = 8;
            if (!fd.buttonSize) fd.buttonSize = 'small';
            if (typeof fd.autoHide !== 'boolean') fd.autoHide = true;
            if (typeof fd.showTooltips !== 'boolean') fd.showTooltips = true;
            // 历史遗留字段，若不存在不再强制创建，避免触发误判清空
            if (!Array.isArray(fd.topPanels)) fd.topPanels = [];
            if (!Array.isArray(fd.bottomPanels)) fd.bottomPanels = [];
            if (!Array.isArray(fd.topSubitems)) fd.topSubitems = [];
            if (!Array.isArray(fd.bottomSubitems)) fd.bottomSubitems = [];

            // 仅当补全了默认值时回写一次，避免反复覆盖
            if (JSON.stringify(fd) !== beforeJson) {
                configs.frontendDisplay = fd;
                window.saveSettingsDebounced?.();
                console.log('[FrontendDisplayManager] 📋 前端显示配置已补全默认值并保存');
            }

            return fd;
        } catch (e) {
            console.error('[FrontendDisplayManager] ❌ 获取配置失败:', e);
            return {};
        }
    }

    /**
     * 🔧 修改：保存前端显示配置（供内部与设置面板复用）
     * 使用统一的配置管理接口
     */
    async saveFrontendDisplayConfig(config) {
        try {
            // 优先使用ConfigManager保存配置
            if (this.configManager && this.configManager.initialized) {
                await this.configManager.saveFrontendDisplayConfig(config);
                console.log('[FrontendDisplayManager] 💾 通过ConfigManager保存前端显示配置:', config);
                return;
            }

            // 🔧 兼容性处理：如果ConfigManager未初始化，回退到原有方式
            console.warn('[FrontendDisplayManager] ⚠️ ConfigManager未就绪，使用兼容模式保存');
            const context = window.SillyTavern?.getContext?.() || SillyTavern.getContext();
            if (!context.extensionSettings) context.extensionSettings = {};
            if (!context.extensionSettings['Information bar integration tool']) {
                context.extensionSettings['Information bar integration tool'] = {};
            }
            const existing = context.extensionSettings['Information bar integration tool'].frontendDisplay || {};
            const merged = { ...existing, ...config };
            context.extensionSettings['Information bar integration tool'].frontendDisplay = merged;
            window.saveSettingsDebounced?.();
            console.log('[FrontendDisplayManager] 💾 前端显示配置已保存:', merged);
        } catch (e) {
            console.error('[FrontendDisplayManager] ❌ 保存配置失败:', e);
        }
    }

    /**
     * 为所有已包装的消息应用布局渲染
     */
    async renderLayoutForAllMessages() {
        for (const [messageId, wrapper] of this.wrappers) {
            const messageElement = wrapper.querySelector('.mes');
            if (messageElement) {
                await this.renderLayoutForMessage(messageElement);
            }
        }
    }

    /**
     * 根据选择的面板/子项为消息渲染内容
     */
    async renderLayoutForMessage(messageElement) {
        try {
            const wrapper = this.wrappers.get(messageElement.id);
            if (!wrapper) return;

            const topContainer = wrapper.querySelector('.top-panels');
            const bottomContainer = wrapper.querySelector('.bottom-panels');
            
            if (!topContainer || !bottomContainer) {
                console.warn('[FrontendDisplayManager] ⚠️ 找不到顶部或底部容器');
                return;
            }

            // 清空现有内容
            topContainer.innerHTML = '';
            bottomContainer.innerHTML = '';

            const fd = await this.getSavedFrontendDisplayConfig();
            
            // 渲染顶部内容
            const topPanels = fd.topPanels || [];
            const topSubitems = fd.topSubitems || [];
            
            topPanels.forEach(panelId => {
                this.addPanelButton(panelId, 'configured', messageElement, 'top');
            });
            
            // 🔧 修复：并行异步处理所有顶部子项
            await Promise.all(topSubitems.map(subitemId => 
                this.addSubItemDisplay(subitemId, 'configured', messageElement, 'top')
            ));

            // 渲染底部内容
            const bottomPanels = fd.bottomPanels || [];
            const bottomSubitems = fd.bottomSubitems || [];
            
            bottomPanels.forEach(panelId => {
                this.addPanelButton(panelId, 'configured', messageElement, 'bottom');
            });
            
            // 🔧 修复：并行异步处理所有底部子项
            await Promise.all(bottomSubitems.map(subitemId => 
                this.addSubItemDisplay(subitemId, 'configured', messageElement, 'bottom')
            ));

            // 添加用户可配置的添加按钮
            this.addConfigurationButtons(topContainer, bottomContainer, messageElement);

            console.log(`[FrontendDisplayManager] ✅ 已渲染顶部: ${topPanels.length}个面板, ${topSubitems.length}个子项; 底部: ${bottomPanels.length}个面板, ${bottomSubitems.length}个子项`);

        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 渲染消息布局失败:', error);
        }
    }

    /**
     * 添加配置按钮，让用户可以添加面板和子项
     */
    addConfigurationButtons(topContainer, bottomContainer, messageElement) {
        try {
            // 禁用前端直接添加，避免误触导致DOM结构被重建
            // 请在设置页的"交互预览"中添加，随后这里只做渲染
            if (topContainer) topContainer.querySelectorAll('.add-content-button').forEach(el => el.remove());
            if (bottomContainer) bottomContainer.querySelectorAll('.add-content-button').forEach(el => el.remove());
            console.log('[FrontendDisplayManager] 🔧 前端添加按钮已禁用（仅设置页可添加）');
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 添加配置按钮失败:', error);
        }
    }

    /**
     * 显示添加面板菜单
     */
    showAddPanelMenu(position, slotElement, messageElement) {
        try {
            console.log(`[FrontendDisplayManager] 📝 显示添加面板菜单: ${position}`);

            // 创建菜单
            const menu = document.createElement('div');
            menu.className = 'add-panel-menu';
            
            // 获取可用的面板和子项
            const availablePanels = this.getAvailablePanels();
            const availableSubItems = this.getAvailableSubItems();

            menu.innerHTML = `
                <div class="menu-content">
                    <div class="menu-header">
                        <h4>选择要添加的内容</h4>
                        <button class="menu-close-btn">×</button>
                    </div>
                    <div class="menu-body">
                        <div class="menu-section">
                            <h5>面板按钮</h5>
                            <div class="menu-options">
                                ${availablePanels.map(panel => `
                                    <div class="menu-option" data-type="panel" data-id="${panel.id}">
                                        <span class="option-icon">${panel.icon}</span>
                                        <span class="option-text">${panel.name}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <div class="menu-section">
                            <h5>子项显示</h5>
                            <div class="menu-options">
                                ${availableSubItems.map(item => `
                                    <div class="menu-option" data-type="subitem" data-id="${item.id}">
                                        <span class="option-icon">🔤</span>
                                        <span class="option-text">${item.name}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // 定位菜单
            this.positionMenu(menu, slotElement);
            
            // 添加到页面
            document.body.appendChild(menu);
            this.activePopups.add(menu);

            // 绑定菜单事件
            this.bindMenuEvents(menu, position, messageElement);

            console.log('[FrontendDisplayManager] ✅ 添加面板菜单已显示');

        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 显示添加面板菜单失败:', error);
        }
    }

    /**
     * 绑定菜单事件
     */
    bindMenuEvents(menu, position, messageElement) {
        // 关闭按钮
        const closeBtn = menu.querySelector('.menu-close-btn');
        closeBtn.addEventListener('click', () => {
            this.closeMenu(menu);
        });

        // 点击外部关闭
        setTimeout(() => {
            document.addEventListener('click', (e) => {
                if (!menu.contains(e.target)) {
                    this.closeMenu(menu);
                }
            }, { once: true });
        }, 100);

        // 选项点击
        menu.addEventListener('click', async (e) => {
            const option = e.target.closest('.menu-option');
            if (option) {
                const type = option.dataset.type;
                const id = option.dataset.id;
                
                if (type === 'panel') {
                    this.addPanelButton(id, position, messageElement);
                } else if (type === 'subitem') {
                    // 🔧 修复：异步添加子项显示
                    await this.addSubItemDisplay(id, position, messageElement);
                }
                
                this.closeMenu(menu);
            }
        });
    }

    /**
     * 关闭菜单
     */
    closeMenu(menu) {
        if (menu.parentNode) {
            menu.parentNode.removeChild(menu);
        }
        this.activePopups.delete(menu);
    }

    /**
     * 添加面板按钮
     */
    addPanelButton(panelId, position, messageElement, location = 'top') {
        try {
            console.log(`[FrontendDisplayManager] ➕ 添加面板按钮: ${panelId} (${location})`);

            const wrapper = this.wrappers.get(messageElement.id);
            if (!wrapper) return;

            const panelInfo = this.getPanelInfo(panelId);
            if (!panelInfo) return;

            // 创建面板按钮
            const button = document.createElement('div');
            button.className = `panel-button ${this.settings.buttonSize}`;
            button.dataset.panel = panelId;
            button.dataset.panelId = panelId;
            button.innerHTML = `
                <span class="panel-name">${panelInfo.name}</span>
            `;

            // 添加点击事件处理
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(`[FrontendDisplayManager] 🔄 面板按钮点击: ${panelId}, 消息ID: ${messageElement.id}`);
                this.showPanelPopup(panelId, messageElement);
            });

            // 根据位置添加到对应容器
            const containerSelector = location === 'top' ? '.top-panels' : '.bottom-panels';
            const container = wrapper.querySelector(containerSelector);
            if (container) {
                container.appendChild(button);
            } else {
                console.warn(`[FrontendDisplayManager] ⚠️ 找不到${location}容器`);
                return;
            }

            // 应用动画
            if (this.settings.animationEnabled) {
                button.style.opacity = '0';
                button.style.transform = 'scale(0.8)';
                setTimeout(() => {
                    button.style.transition = 'all 0.3s ease';
                    button.style.opacity = '1';
                    button.style.transform = 'scale(1)';
                }, 50);
            }

            console.log('[FrontendDisplayManager] ✅ 面板按钮添加完成');

        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 添加面板按钮失败:', error);
        }
    }

    /**
     * 显示面板弹窗（带有实际聊天数据）
     */
    async showPanelPopup(panelId, messageElement) {
        try {
            console.log(`[FrontendDisplayManager] 🎭 显示面板弹窗: ${panelId}, 消息ID: ${messageElement.id}`);

            // 移除现有弹窗
            const existingPopup = document.querySelector('.panel-popup');
            if (existingPopup) {
                existingPopup.remove();
            }

            // 获取面板配置和实际数据
            const panelInfo = this.getPanelInfo(panelId);
            if (!panelInfo) {
                console.error(`[FrontendDisplayManager] ❌ 找不到面板配置: ${panelId}`);
                return;
            }

            // 获取聊天相关数据
            const chatData = this.getChatDataForMessage(messageElement);
            const panelData = await this.getPanelDataForChat(panelId, chatData);

            // 渲染面板数据HTML
            const panelDataHTML = this.renderPanelData(panelId, panelData);
            console.log(`[FrontendDisplayManager] 🏗️ 构建弹窗HTML，数据HTML:`, panelDataHTML);

            // 创建弹窗
            const popup = document.createElement('div');
            popup.className = 'panel-popup';
            popup.innerHTML = `
                <div class="popup-content">
                    <div class="popup-header">
                        <h3>${panelInfo.name}</h3>
                        <button class="popup-close-btn">&times;</button>
                    </div>
                    <div class="popup-body">
                        <div class="panel-data">
                            ${panelDataHTML}
                        </div>
                    </div>
                </div>
            `;

            // 使用全屏遮罩容器 + 居中内容，确保完美居中
            popup.style.setProperty('position', 'fixed', 'important');
            popup.style.setProperty('top', '0', 'important');
            popup.style.setProperty('left', '0', 'important');
            popup.style.setProperty('right', '0', 'important');
            popup.style.setProperty('bottom', '0', 'important');
            popup.style.setProperty('width', '100vw', 'important');
            popup.style.setProperty('height', '100vh', 'important');
            popup.style.setProperty('display', 'flex', 'important');
            popup.style.setProperty('align-items', 'center', 'important');
            popup.style.setProperty('justify-content', 'center', 'important');
            popup.style.setProperty('z-index', '10000', 'important');
            popup.style.setProperty('background', 'rgba(0,0,0,0.5)', 'important');
            popup.style.setProperty('margin', '0', 'important');
            popup.style.setProperty('padding', '20px', 'important');
            popup.style.setProperty('box-sizing', 'border-box', 'important');

            const content = popup.querySelector('.popup-content');
            if (content) {
                content.style.setProperty('background', 'var(--theme-bg-primary, #2a2a2a)', 'important');
                content.style.setProperty('color', 'var(--theme-text-primary, #ffffff)', 'important');
                content.style.setProperty('border', '1px solid var(--theme-border-color, rgba(255,255,255,0.1))', 'important');
                content.style.setProperty('border-radius', '12px', 'important');
                content.style.setProperty('padding', '0', 'important');
                content.style.setProperty('min-width', '300px', 'important');
                content.style.setProperty('max-width', '90vw', 'important');
                content.style.setProperty('min-height', '200px', 'important');
                content.style.setProperty('max-height', '90vh', 'important');
                content.style.setProperty('overflow-y', 'auto', 'important');
                content.style.setProperty('box-shadow', '0 8px 32px rgba(0,0,0,0.5)', 'important');
                content.style.setProperty('position', 'relative', 'important');
                content.style.setProperty('margin', '0', 'important');
                content.style.setProperty('flex-shrink', '0', 'important');
            }
            
            // 移动端适配 - 简化尺寸适配，保持居中
            const isMobile = window.innerWidth <= 768;
            if (isMobile && content) {
                console.log('[FrontendDisplayManager] 📱 应用移动端弹窗适配');
                
                // 移动端优化宽度，保持居中
                content.style.setProperty('width', '95vw', 'important');
                content.style.setProperty('max-width', '380px', 'important');
                content.style.setProperty('max-height', '85vh', 'important');
                
                console.log('[FrontendDisplayManager] ✅ 移动端弹窗适配完成');
            }

            // 添加到页面
            document.body.appendChild(popup);

            // 绑定关闭事件
            const closeBtn = popup.querySelector('.popup-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    popup.remove();
                });
            }

            // 点击外部关闭（点击遮罩层）
            setTimeout(() => {
                const clickOutside = (e) => {
                    // 只有点击遮罩层（popup本身）时才关闭，避免误关闭
                    if (e.target === popup) {
                        popup.remove();
                        document.removeEventListener('click', clickOutside);
                    }
                };
                document.addEventListener('click', clickOutside);
            }, 100);

            console.log(`[FrontendDisplayManager] ✅ 面板弹窗已显示`);

        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 显示面板弹窗失败:', error);
        }
    }

    /**
     * 获取消息对应的聊天数据
     */
    getChatDataForMessage(messageElement) {
        try {
            const chatId = window.SillyTavern?.getContext?.()?.chatId || 
                          window.SillyTavern?.getContext?.()?.sessionId ||
                          'current_chat';
            
            return {
                chatId: chatId,
                messageId: messageElement.id,
                timestamp: new Date().toISOString(),
                character: window.SillyTavern?.getContext?.()?.name2 || '未知角色'
            };
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 获取聊天数据失败:', error);
            return {
                chatId: 'unknown',
                messageId: messageElement.id,
                timestamp: new Date().toISOString(),
                character: '未知角色'
            };
        }
    }

    /**
     * 获取面板的实际数据
     */
    async getPanelDataForChat(panelId, chatData) {
        try {
            console.log(`[FrontendDisplayManager] 📊 获取面板数据: ${panelId}`);
            
            // 获取启用的面板配置
            const settings = window.SillyTavernInfobar?.modules?.settings;
            const enabledPanels = settings?.getEnabledPanels?.() || {};
            const panelConfig = enabledPanels[panelId];
            
            console.log(`[FrontendDisplayManager] ⚙️ 面板配置:`, panelConfig);
            
            if (!panelConfig) {
                console.warn(`[FrontendDisplayManager] ⚠️ 面板配置不存在: ${panelId}`);
                return { source: '配置不存在' };
            }
            
            let realData = {};
            
            // 获取数据核心中的实际数据
            const dataCore = window.SillyTavernInfobar?.modules?.dataCore;
            if (dataCore) {
                try {
                    // 获取聊天数据
                    const chatId = chatData.chatId;
                    const fullChatData = await dataCore.getChatData(chatId);
                    
                    // 从infobar_data.panels获取面板数据
                    const panelData = fullChatData?.infobar_data?.panels?.[panelId] || {};
                    
                    console.log(`[FrontendDisplayManager] 🔍 聊天ID:`, chatId);
                    console.log(`[FrontendDisplayManager] 🔍 完整聊天数据:`, fullChatData);
                    console.log(`[FrontendDisplayManager] 🔍 面板数据 [${panelId}]:`, panelData);
                    
                    // 🔧 特殊处理：交互面板支持多NPC格式
                    if (panelId === 'interaction' && Object.keys(panelData).length > 0) {
                        console.log('[FrontendDisplayManager] 🎯 处理交互面板多NPC数据');
                        return this.processInteractionPanelData(panelData, panelConfig);
                    }
                    
                    // 遍历启用的字段
                    Object.entries(panelConfig).forEach(([fieldKey, fieldConfig]) => {
                        if (fieldConfig?.enabled === true && fieldKey !== 'enabled' && fieldKey !== 'subItems') {
                            const displayName = this.getFieldDisplayName(fieldKey);
                            const fieldValue = panelData[fieldKey];
                            
                            if (fieldValue && fieldValue.trim() !== '') {
                                realData[displayName] = fieldValue;
                            } else {
                                realData[displayName] = '未设置';
                            }
                        }
                    });
                    
                    // 添加子项数据
                    const subItems = panelConfig.subItems || [];
                    subItems.forEach(subItem => {
                        if (subItem.enabled) {
                            const subItemData = panelData[subItem.key] || panelData[subItem.id];
                            realData[subItem.displayName || subItem.name] = subItemData || '未设置';
                        }
                    });
                    
                    console.log(`[FrontendDisplayManager] ✅ 处理后的数据:`, realData);
                    
                } catch (dataError) {
                    console.error('[FrontendDisplayManager] ❌ 数据核心访问失败:', dataError);
                }
            }
            
            // 如果没有实际数据，创建示例数据来展示字段结构
            if (Object.keys(realData).length === 0) {
                console.log(`[FrontendDisplayManager] 🔄 创建启用字段结构展示`);
                
                Object.entries(panelConfig).forEach(([fieldKey, fieldConfig]) => {
                    if (fieldConfig?.enabled === true && fieldKey !== 'enabled' && fieldKey !== 'subItems') {
                        const displayName = this.getFieldDisplayName(fieldKey);
                        realData[displayName] = '未设置';
                    }
                });
                
                // 添加子项
                const subItems = panelConfig.subItems || [];
                subItems.forEach(subItem => {
                    if (subItem.enabled) {
                        realData[subItem.displayName || subItem.name] = '未设置';
                    }
                });
            }
            
            // 总是显示启用的字段结构，即使数据核心中没有数据
            Object.entries(panelConfig).forEach(([fieldKey, fieldConfig]) => {
                if (fieldConfig?.enabled === true && fieldKey !== 'enabled' && fieldKey !== 'subItems') {
                    const displayName = this.getFieldDisplayName(fieldKey);
                    if (!realData[displayName]) {
                        realData[displayName] = '未设置';
                    }
                }
            });
            
            // 添加启用的子项
            const subItems = panelConfig.subItems || [];
            subItems.forEach(subItem => {
                if (subItem.enabled) {
                    const itemName = subItem.displayName || subItem.name;
                    if (!realData[itemName]) {
                        realData[itemName] = '未设置';
                    }
                }
            });

            return {
                ...realData,
                source: dataCore ? '数据核心查询' : '字段结构展示'
            };
            
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 获取面板数据失败:', error);
            return { 
                '错误': '数据获取失败',
                '原因': error.message,
                source: '错误信息' 
            };
        }
    }

    /**
     * 获取字段显示名称 - 使用统一的完整映射表
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
            console.warn('[FrontendDisplayManager] ⚠️ 获取字段显示名称失败:', error);
            return fieldKey;
        }
    }



    /**
     * 添加子项显示
     */
    async addSubItemDisplay(subItemId, position, messageElement, location = 'top') {
        try {
            console.log(`[FrontendDisplayManager] ➕ 添加子项显示: ${subItemId} (${location})`);

            const wrapper = this.wrappers.get(messageElement.id);
            if (!wrapper) return;

            const subItemInfo = this.getSubItemInfo(subItemId);
            if (!subItemInfo) return;

            // 🔧 修复：异步获取子项的实际值
            let actualValue = '未设置';
            try {
                const [panelId, fieldKey] = subItemId.split('.');
                const chatData = this.getChatDataForMessage(messageElement);
                const dataCore = window.SillyTavernInfobar?.modules?.dataCore;
                
                if (dataCore && chatData.chatId) {
                    const fullChatData = await dataCore.getChatData(chatData.chatId);
                    const panelData = fullChatData?.infobar_data?.panels?.[panelId] || {};
                    
                    if (panelData[fieldKey] !== undefined) {
                        actualValue = panelData[fieldKey];
                        console.log(`[FrontendDisplayManager] 📊 异步获取子项值: ${subItemId} = "${actualValue}"`);
                    }
                }
            } catch (error) {
                console.warn(`[FrontendDisplayManager] ⚠️ 异步获取子项值失败: ${subItemId}`, error);
            }

            // 创建子项显示
            const display = document.createElement('div');
            display.className = 'subitem-display';
            display.dataset.subitem = subItemId;
            display.innerHTML = `
                <span class="field-name">${subItemInfo.displayName}:</span>
                <span class="field-value">${actualValue}</span>
            `;

            // 根据位置添加到对应容器
            const containerSelector = location === 'top' ? '.top-panels' : '.bottom-panels';
            const container = wrapper.querySelector(containerSelector);
            if (container) {
                container.appendChild(display);
            } else {
                console.warn(`[FrontendDisplayManager] ⚠️ 找不到${location}容器`);
                return;
            }

            // 应用动画
            if (this.settings.animationEnabled) {
                display.style.opacity = '0';
                display.style.transform = 'translateY(10px)';
                setTimeout(() => {
                    display.style.transition = 'all 0.3s ease';
                    display.style.opacity = '1';
                    display.style.transform = 'translateY(0)';
                }, 50);
            }

            console.log('[FrontendDisplayManager] ✅ 子项显示添加完成');

        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 添加子项显示失败:', error);
        }
    }



    /**
     * 获取可用面板列表 - 🔧 修复：优化启用状态检查逻辑
     */
    getAvailablePanels() {
        try {
            const context = window.SillyTavern?.getContext?.() || SillyTavern.getContext();
            const extensionSettings = context.extensionSettings || {};
            const configs = extensionSettings['Information bar integration tool'] || {};

            const result = [];
            const basicPanelIds = [
                'personal','world','interaction','tasks','organization',
                'news','inventory','abilities','plot','cultivation',
                'fantasy','modern','historical','magic','training'
            ];

            console.log('[FrontendDisplayManager] 📋 检查基础面板启用状态...');

            basicPanelIds.forEach(id => {
                const panel = configs[id];
                if (panel) {
                    // 🔧 修复：与其他模块保持一致的启用检查逻辑
                    const isEnabled = panel.enabled !== false; // 默认为true，除非明确设置为false
                    
                    if (isEnabled) {
                        const name = this.getBasicPanelDisplayName(id);
                        result.push({ id, name, icon: this.getBasicPanelIcon(id) });
                        console.log(`[FrontendDisplayManager] ✅ 基础面板启用: ${id} (${name})`);
                    } else {
                        console.log(`[FrontendDisplayManager] ❌ 基础面板禁用: ${id}`);
                    }
                } else {
                    console.log(`[FrontendDisplayManager] ⚠️ 基础面板未配置: ${id}`);
                }
            });

            // 🔧 修复：检查自定义面板
            const customPanels = configs.customPanels || {};
            console.log(`[FrontendDisplayManager] 📋 检查 ${Object.keys(customPanels).length} 个自定义面板...`);
            
            Object.entries(customPanels).forEach(([id, panel]) => {
                if (panel && panel.enabled === true) {
                    const panelName = panel.name || id;
                    result.push({ 
                        id, 
                        name: panelName, 
                        icon: panel.icon || '🔧',
                        type: 'custom'
                    });
                    console.log(`[FrontendDisplayManager] ✅ 自定义面板启用: ${id} (${panelName})`);
                } else {
                    console.log(`[FrontendDisplayManager] ❌ 自定义面板禁用或未配置: ${id}`);
                }
            });

            console.log(`[FrontendDisplayManager] 📊 总共找到 ${result.length} 个可用面板`);
            return result;
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 获取可用面板失败:', error);
            return [];
        }
    }

    /**
     * 获取可用子项列表 - 🔧 修复：优化启用状态检查和中文映射
     */
    getAvailableSubItems() {
        try {
            const context = window.SillyTavern?.getContext?.() || SillyTavern.getContext();
            const extensionSettings = context.extensionSettings || {};
            const configs = extensionSettings['Information bar integration tool'] || {};

            const result = [];
            const basicPanelIds = [
                'personal','world','interaction','tasks','organization',
                'news','inventory','abilities','plot','cultivation',
                'fantasy','modern','historical','magic','training'
            ];

            console.log('[FrontendDisplayManager] 📋 检查基础面板子项...');

            // 🔧 修复：优化字段显示名称获取
            const getDisplayName = (panelType, key) => {
                try {
                    // 优先使用InfoBarSettings的完整映射
                    const infoBarTool = window.SillyTavernInfobar;
                    const infoBarSettings = infoBarTool?.modules?.infoBarSettings || infoBarTool?.modules?.settings;
                    if (infoBarSettings?.getCompleteDisplayNameMapping) {
                        const completeMapping = infoBarSettings.getCompleteDisplayNameMapping();
                        if (completeMapping[panelType] && completeMapping[panelType][key]) {
                            return completeMapping[panelType][key];
                        }
                    }
                    
                    // 备用方案：使用DataTable的映射
                    const settingsModule = window.SillyTavernInfobar?.modules?.settings;
                    if (settingsModule?.getDataTableDisplayName) {
                        return settingsModule.getDataTableDisplayName(panelType, key) || key;
                    }
                    
                    return key;
                } catch (error) {
                    console.warn(`[FrontendDisplayManager] ⚠️ 获取字段显示名称失败: ${panelType}.${key}`, error);
                    return key;
                }
            };

            const pushEnabled = (panelType, key) => {
                const displayName = getDisplayName(panelType, key);
                result.push({ id: `${panelType}.${key}`, name: displayName });
                console.log(`[FrontendDisplayManager] ✅ 子项启用: ${panelType}.${key} (${displayName})`);
            };

            basicPanelIds.forEach(panelId => {
                const panel = configs[panelId];
                if (!panel) {
                    console.log(`[FrontendDisplayManager] ⚠️ 面板未配置: ${panelId}`);
                    return;
                }
                
                // 🔧 修复：与其他模块保持一致的启用检查逻辑
                const isPanelEnabled = panel.enabled !== false; // 默认为true，除非明确设置为false
                if (!isPanelEnabled) {
                    console.log(`[FrontendDisplayManager] ❌ 面板禁用，跳过子项: ${panelId}`);
                    return;
                }

                console.log(`[FrontendDisplayManager] 🔍 检查面板 ${panelId} 的子项...`);

                // 基础复选项字段
                let fieldCount = 0;
                Object.keys(panel).forEach(key => {
                    if (
                        key !== 'enabled' &&
                        key !== 'subItems' &&
                        key !== 'description' &&
                        key !== 'icon' &&
                        key !== 'required' &&
                        key !== 'memoryInject' &&
                        key !== 'prompts' &&
                        typeof panel[key] === 'object' &&
                        panel[key].enabled === true
                    ) {
                        pushEnabled(panelId, key);
                        fieldCount++;
                    }
                });

                // 面板管理的子项
                let customSubItemCount = 0;
                if (Array.isArray(panel.subItems)) {
                    panel.subItems.forEach(sub => {
                        if (sub && sub.enabled !== false) {
                            const key = sub.key;
                            const displayName = sub.displayName || key;
                            result.push({ id: `${panelId}.${key}`, name: displayName });
                            console.log(`[FrontendDisplayManager] ✅ 自定义子项启用: ${panelId}.${key} (${displayName})`);
                            customSubItemCount++;
                        }
                    });
                }

                console.log(`[FrontendDisplayManager] 📊 面板 ${panelId}: ${fieldCount} 个基础字段 + ${customSubItemCount} 个自定义子项`);
            });

            // 自定义面板
            const customPanels = configs.customPanels || {};
            console.log(`[FrontendDisplayManager] 📋 检查 ${Object.keys(customPanels).length} 个自定义面板的子项...`);
            
            Object.entries(customPanels).forEach(([id, panel]) => {
                if (panel && panel.enabled === true && Array.isArray(panel.subItems)) {
                    let subItemCount = 0;
                    panel.subItems.forEach(sub => {
                        if (sub && sub.enabled !== false) {
                            const displayName = sub.displayName || sub.key;
                            result.push({ id: `${id}.${sub.key}`, name: displayName });
                            console.log(`[FrontendDisplayManager] ✅ 自定义面板子项启用: ${id}.${sub.key} (${displayName})`);
                            subItemCount++;
                        }
                    });
                    console.log(`[FrontendDisplayManager] 📊 自定义面板 ${id}: ${subItemCount} 个子项`);
                }
            });

            console.log(`[FrontendDisplayManager] 📊 总共找到 ${result.length} 个可用子项`);
            return result;
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 获取可用子项失败:', error);
            return [];
        }
    }

    /**
     * 获取面板信息
     */
    getPanelInfo(panelId) {
        const panels = this.getAvailablePanels();
        return panels.find(panel => panel.id === panelId);
    }

    /**
     * 获取子项信息
     */
    getSubItemInfo(subItemId) {
        const subItems = this.getAvailableSubItems();
        const subItem = subItems.find(item => item.id === subItemId);
        
        if (subItem) {
            return {
                ...subItem,
                displayName: subItem.name,
                value: this.getSubItemValue(subItemId)
            };
        }
        
        return null;
    }

    /**
     * 基础面板中文名称 - 🔧 修复：使用正确的英文ID作为key
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
     * 🔧 新增：获取基础面板图标
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
            'cultivation': '🏔️',
            'fantasy': '🐲',
            'modern': '🏙️',
            'historical': '🏛️',
            'magic': '🪄',
            'training': '🏋️'
        };
        return iconMap[panelId] || '📊';
    }

    /**
     * 获取子项值
     */
    getSubItemValue(subItemId) {
        try {
            const [panelId, fieldKey] = subItemId.split('.');
            
            // 🔧 修复：使用正确的数据获取方式，类似面板弹窗的做法
            const dataCore = window.SillyTavernInfobar?.modules?.dataCore;
            if (dataCore) {
                try {
                    // 获取当前聊天ID
                    const chatId = dataCore.currentChatId;
                    if (chatId) {
                        // 使用带参数的getChatData方法
                        const fullChatData = dataCore.getChatData(chatId);
                        const panelData = fullChatData?.infobar_data?.panels?.[panelId] || {};
                        
                        if (panelData[fieldKey] !== undefined) {
                            console.log(`[FrontendDisplayManager] 📊 从面板数据获取: ${subItemId} = "${panelData[fieldKey]}"`);
                            return panelData[fieldKey];
                        }
                    }
                } catch (error) {
                    console.warn(`[FrontendDisplayManager] ⚠️ 从数据核心获取失败: ${subItemId}`, error);
                }
            }
            
            // 备用方案：从统一数据核心获取实际值（原有逻辑）
            if (this.dataCore && this.dataCore.getChatData) {
                try {
                    const chatData = this.dataCore.getChatData();
                    if (chatData && chatData[panelId] && chatData[panelId][fieldKey] !== undefined) {
                        console.log(`[FrontendDisplayManager] 📊 从数据核心获取: ${subItemId} = "${chatData[panelId][fieldKey]}"`);
                        return chatData[panelId][fieldKey];
                    }
                } catch (error) {
                    console.warn(`[FrontendDisplayManager] ⚠️ 备用数据获取失败: ${subItemId}`, error);
                }
            }
            
            // 兜底：返回未设置
            console.log(`[FrontendDisplayManager] ⚠️ 子项值未找到: ${subItemId}`);
            return '未设置';
        } catch (error) {
            console.error(`[FrontendDisplayManager] ❌ 获取子项值失败: ${subItemId}`, error);
            return '未设置';
        }
    }

    /**
     * 获取面板数据
     */
    getPanelData(panelType, panelId) {
        try {
            // 从统一数据核心获取实际面板数据
            if (this.dataCore && this.dataCore.getChatData) {
                const chatData = this.dataCore.getChatData();
                if (chatData && chatData[panelType]) {
                    return chatData[panelType];
                }
            }
            
            // 兜底：返回空数据
            return {};
        } catch (error) {
            console.error(`[FrontendDisplayManager] ❌ 获取面板数据失败: ${panelType}`, error);
            return {};
        }
    }



    /**
     * 绑定弹窗事件
     */
    bindPopupEvents(popup) {
        // 关闭按钮
        const closeBtn = popup.querySelector('.popup-close-btn');
        closeBtn.addEventListener('click', () => {
            this.closePopup(popup);
        });

        // 点击外部关闭
        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                this.closePopup(popup);
            }
        });

        // ESC键关闭
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closePopup(popup);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    /**
     * 关闭弹窗
     */
    closePopup(popup) {
        if (this.settings.animationEnabled) {
            popup.style.opacity = '0';
            setTimeout(() => {
                if (popup.parentNode) {
                    popup.parentNode.removeChild(popup);
                }
            }, 300);
        } else {
            if (popup.parentNode) {
                popup.parentNode.removeChild(popup);
            }
        }
        
        this.activePopups.delete(popup);
    }

    /**
     * 定位菜单
     */
    positionMenu(menu, slotElement) {
        const rect = slotElement.getBoundingClientRect();
        const isMobile = window.innerWidth <= 768;
        
        menu.style.position = 'fixed';
        menu.style.zIndex = '10000';
        
        if (isMobile) {
            console.log('[FrontendDisplayManager] 📱 应用移动端菜单完美居中定位');
            
            // 🔧 参考面板规则编辑界面的完美居中实现
            menu.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                opacity: 0;
                visibility: visible;
                transition: opacity 0.3s ease;
            `;
            
            // 🔧 优化menu-content移动端完美居中显示
            const menuContent = menu.querySelector('.menu-content');
            if (menuContent) {
                menuContent.style.cssText = `
                    background: var(--theme-bg-primary, #2a2a2a);
                    color: var(--theme-text-primary, #ffffff);
                    border: 1px solid var(--theme-border-color, rgba(255,255,255,0.1));
                    border-radius: 16px;
                    padding: 0;
                    width: 380px;
                    max-width: 90vw;
                    max-height: 80vh;
                    overflow-y: auto;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                    margin: 0;
                    flex-shrink: 0;
                `;
            }
            
            // 🔧 添加显示动画
            setTimeout(() => {
                menu.style.opacity = '1';
            }, 10);
            
            console.log('[FrontendDisplayManager] ✅ 移动端菜单完美居中定位完成');
        } else {
            // 桌面端保持原有定位逻辑
            menu.style.left = `${rect.left}px`;
            menu.style.top = `${rect.bottom + 10}px`;
        }
    }

    /**
     * 应用设置到现有包装器
     */
    applySettingsToWrappers() {
        this.wrappers.forEach((wrapper, messageId) => {
            // 更新包装器样式类
            wrapper.className = `frontend-message-wrapper ${this.settings.style}`;
            
            // 更新添加按钮显示状态
            const addSlots = wrapper.querySelectorAll('.add-panel-slots');
            addSlots.forEach(slots => {
                slots.style.display = this.settings.showAddButtons ? 'flex' : 'none';
            });
        });
    }

    /**
     * 移除消息包装器
     */
    removeMessageWrapper(messageId) {
        const wrapper = this.wrappers.get(messageId);
        if (!wrapper) return;

        // 包装器内部应包含该消息，把消息节点放回原位置（包装器所在位置）
        const messageElement = wrapper.querySelector('.ai-message-container .mes');
        if (messageElement && wrapper.parentNode) {
            wrapper.parentNode.insertBefore(messageElement, wrapper.nextSibling);
            // 恢复原信息栏显示
            const hiddenInfoBars = messageElement.querySelectorAll('.message-infobar[style*="display: none"], .infobar-panel[style*="display: none"], [data-infobar-rendered="true"][style*="display: none"]');
            hiddenInfoBars.forEach(infoBar => {
                infoBar.style.display = '';
            });
        }

        // 移除包装器
        if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
        this.wrappers.delete(messageId);
        console.log(`[FrontendDisplayManager] 🔄 已移除包装器并恢复消息: ${messageId}`);
    }

    /**
     * NPC数据分组函数 - 用于处理多NPC交互面板数据
     * 类似于MessageInfoBarRenderer.js中的groupNpcData函数
     */
    groupNpcData(interactionData) {
        const npcGroups = {};
        const globalFields = {}; // 存储全局字段

        console.log('[FrontendDisplayManager] 🔍 开始NPC数据分组，原始字段数:', Object.keys(interactionData).length);

        // 第一遍：收集所有NPC特定字段和全局字段
        Object.entries(interactionData).forEach(([key, value]) => {
            const match = key.match(/^(npc\d+)\.(.+)$/);
            if (match) {
                const [, npcId, fieldName] = match;
                if (!npcGroups[npcId]) {
                    npcGroups[npcId] = {};
                }
                npcGroups[npcId][fieldName] = value;
                console.log(`[FrontendDisplayManager] 📝 NPC字段: ${npcId}.${fieldName} = ${value}`);
            } else {
                // 全局字段，稍后分配
                globalFields[key] = value;
                console.log(`[FrontendDisplayManager] 🌐 全局字段: ${key} = ${value}`);
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
                    console.log(`[FrontendDisplayManager] 🔄 分配全局字段到 ${npcId}.${fieldName} = ${value}`);
                }
            });
        });

        console.log('[FrontendDisplayManager] ✅ NPC数据分组完成:');
        Object.keys(npcGroups).forEach(npcId => {
            console.log(`[FrontendDisplayManager]   ${npcId}: ${Object.keys(npcGroups[npcId]).length} 个字段`);
        });

        return npcGroups;
    }

    /**
     * 获取NPC显示名称
     */
    getNpcDisplayName(npcId, npcData) {
        try {
            // 优先使用name字段
            if (npcData.name && npcData.name.trim() !== '' && npcData.name !== '未设置') {
                return npcData.name;
            }
            
            // 其次使用对象名称
            if (npcData['对象名称'] && npcData['对象名称'].trim() !== '' && npcData['对象名称'] !== '未设置') {
                return npcData['对象名称'];
            }
            
            // 最后使用NPC ID
            const npcNumber = npcId.replace('npc', '');
            return `NPC ${npcNumber}`;
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 获取NPC显示名称失败:', error);
            return npcId;
        }
    }

    /**
     * 处理交互面板的多NPC数据
     */
    processInteractionPanelData(panelData, panelConfig) {
        try {
            console.log('[FrontendDisplayManager] 🔍 开始处理交互面板数据');
            
            // 使用NPC分组函数处理数据
            const npcGroups = this.groupNpcData(panelData);
            const npcList = Object.entries(npcGroups);
            
            if (npcList.length === 0) {
                return { 
                    '交互对象': '暂无数据',
                    source: '多NPC处理'
                };
            }
            
            // 为前端显示创建特殊的多NPC数据结构
            const processedData = {
                _npcData: npcGroups, // 存储原始NPC分组数据
                _npcList: npcList,   // 存储NPC列表
                _isMultiNpc: true,   // 标记为多NPC数据
                source: '多NPC处理'
            };
            
            // 添加NPC选择器信息
            processedData['NPC选择器'] = `共 ${npcList.length} 个交互对象`;
            
            // 为每个NPC添加摘要信息
            npcList.forEach(([npcId, npcData], index) => {
                const npcName = this.getNpcDisplayName(npcId, npcData);
                const fieldsCount = Object.keys(npcData).filter(key => 
                    npcData[key] && npcData[key] !== '未设置'
                ).length;
                
                processedData[`${npcName} (${npcId})`] = `${fieldsCount} 个字段有数据`;
            });
            
            console.log('[FrontendDisplayManager] ✅ 交互面板数据处理完成:', processedData);
            return processedData;
            
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 处理交互面板数据失败:', error);
            return { 
                '错误': '多NPC数据处理失败',
                '原因': error.message,
                source: '错误信息'
            };
        }
    }

    /**
     * 渲染面板数据 - 重写以支持多NPC交互面板
     */
    renderPanelData(panelId, panelData) {
        try {
            console.log(`[FrontendDisplayManager] 🎨 渲染面板数据: ${panelId}`);
            
            // 🔧 特殊处理：多NPC交互面板
            if (panelId === 'interaction' && panelData._isMultiNpc) {
                return this.renderInteractionPanelData(panelData);
            }
            
            // 原有的通用面板数据渲染逻辑
            const dataEntries = Object.entries(panelData).filter(([key]) => 
                !key.startsWith('_') && key !== 'source'
            );
            
            console.log(`[FrontendDisplayManager] 📊 数据条目:`, dataEntries);
            
            if (dataEntries.length === 0) {
                return '<div class="data-row"><span class="data-value">暂无数据</span></div>';
            }
            
            let html = '';
            dataEntries.forEach(([key, value]) => {
                html += `
                        <div class="data-row">
                            <span class="data-label">${this.escapeHtml(key)}</span>
                            <span class="data-value">${this.escapeHtml(String(value))}</span>
                        </div>
                    `;
            });
            
            console.log(`[FrontendDisplayManager] ✅ 渲染HTML长度: ${html.length}`);
            return html;
            
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 渲染面板数据失败:', error);
            return '<div class="data-row"><span class="data-value">渲染失败</span></div>';
        }
    }

    /**
     * 渲染交互面板的多NPC数据
     */
    renderInteractionPanelData(panelData) {
        try {
            console.log('[FrontendDisplayManager] 🎭 渲染多NPC交互面板');
            
            const npcGroups = panelData._npcData;
            const npcList = panelData._npcList;
            
            if (!npcGroups || !npcList || npcList.length === 0) {
                return '<div class="data-row"><span class="data-value">暂无交互对象数据</span></div>';
            }
            
            let html = '';
            
            // 添加NPC选择器
            html += `
                <div class="data-row npc-selector-row">
                    <span class="data-label">选择交互对象:</span>
                    <select class="data-npc-selector" onchange="window.SillyTavernInfobar?.modules?.frontendDisplayManager?.switchNpcDisplay(this)">
            `;
            
            npcList.forEach(([npcId, npcData], index) => {
                const npcName = this.getNpcDisplayName(npcId, npcData);
                html += `<option value="${npcId}" ${index === 0 ? 'selected' : ''}>${this.escapeHtml(npcName)}</option>`;
            });
            
            html += '</select></div>';
            
            // 为每个NPC创建数据显示区域
            npcList.forEach(([npcId, npcData], index) => {
                const displayStyle = index === 0 ? 'block' : 'none';
                html += `<div class="npc-data-container" data-npc-id="${npcId}" style="display: ${displayStyle};">`;
                
                // 渲染NPC的字段数据
                Object.entries(npcData).forEach(([fieldName, value]) => {
                    if (this.isValidDataValue(value)) {
                        const displayLabel = this.getFieldDisplayName(fieldName);
                        html += `
                            <div class="data-row">
                                <span class="data-label">${this.escapeHtml(displayLabel)}:</span>
                                <span class="data-value">${this.escapeHtml(String(value))}</span>
                            </div>
                        `;
                    }
                });
                
                html += '</div>';
            });
            
            console.log('[FrontendDisplayManager] ✅ 多NPC交互面板渲染完成');
            return html;
            
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 渲染多NPC交互面板失败:', error);
            return '<div class="data-row"><span class="data-value">多NPC渲染失败</span></div>';
        }
    }

    /**
     * 切换NPC显示 - 供前端选择器调用
     */
    switchNpcDisplay(selectElement) {
        try {
            const selectedNpcId = selectElement.value;
            const container = selectElement.closest('.popup-body, .panel-content');
            
            if (!container) return;
            
            // 隐藏所有NPC数据容器
            const allContainers = container.querySelectorAll('.npc-data-container');
            allContainers.forEach(container => {
                container.style.display = 'none';
            });
            
            // 显示选中的NPC数据容器
            const selectedContainer = container.querySelector(`[data-npc-id="${selectedNpcId}"]`);
            if (selectedContainer) {
                selectedContainer.style.display = 'block';
                console.log(`[FrontendDisplayManager] 🔄 切换到NPC: ${selectedNpcId}`);
            }
            
        } catch (error) {
            console.error('[FrontendDisplayManager] ❌ 切换NPC显示失败:', error);
        }
    }

    /**
     * 检查数据值是否有效
     */
    isValidDataValue(value) {
        return value !== null && 
               value !== undefined && 
               String(value).trim() !== '' && 
               String(value).trim() !== '未设置';
    }

    /**
     * 转义HTML字符
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}