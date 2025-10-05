/**
 * 消息过滤Hook - 条件过滤版本
 * 
 * 只在特定情况下过滤消息内容：
 * 1. 使用自定义API时 - 过滤所有标签（自定义API不需要这些标签）
 * 2. 使用主API时 - 不过滤（主API需要这些标签来生成信息栏内容）
 * 3. 生成总结时 - 过滤标签（总结不应包含这些内部标签）
 * 
 * @class MessageFilterHook
 */

export class MessageFilterHook {
    constructor(contentFilterManager) {
        console.log('[MessageFilterHook] 🔧 消息过滤Hook初始化开始 (条件过滤版本)');
        
        this.contentFilterManager = contentFilterManager;
        this.hooked = false;
        this.originalMessages = new Map(); // 存储原始消息内容
        this.isFiltering = false;
        
        console.log('[MessageFilterHook] ✅ 消息过滤Hook初始化完成');
    }
    
    /**
     * 安装Hook
     */
    install() {
        try {
            if (this.hooked) {
                console.log('[MessageFilterHook] ⚠️ Hook已经安装');
                return;
            }
            
            console.log('[MessageFilterHook] 🔗 开始安装消息过滤Hook (条件过滤版本)...');
            
            // 方法1: 使用事件监听（仅在使用自定义API时过滤）
            this.hookWithEvents();
            
            // 方法2: Hook扩展提示词系统（条件过滤）
            this.hookExtensionPrompts();
            
            this.hooked = true;
            console.log('[MessageFilterHook] ✅ 消息过滤Hook安装完成');
            
        } catch (error) {
            console.error('[MessageFilterHook] ❌ 安装Hook失败:', error);
        }
    }
    
    /**
     * 使用事件监听方式Hook
     */
    hookWithEvents() {
        try {
            const context = window.SillyTavern?.getContext?.();
            if (!context || !context.eventSource || !context.event_types) {
                console.warn('[MessageFilterHook] ⚠️ 无法获取事件系统');
                return;
            }
            
            const { eventSource, event_types } = context;
            
            // 监听生成开始事件 - 条件过滤
            eventSource.on(event_types.GENERATION_STARTED, () => {
                this.applyConditionalFilter();
            });
            
            // 监听生成结束事件
            eventSource.on(event_types.GENERATION_ENDED, () => {
                this.restoreOriginal();
            });
            
            console.log('[MessageFilterHook] ✅ 事件监听Hook安装成功（条件过滤）');
            
        } catch (error) {
            console.error('[MessageFilterHook] ❌ Hook事件监听失败:', error);
        }
    }
    
    /**
     * Hook扩展提示词系统
     */
    hookExtensionPrompts() {
        try {
            const context = window.SillyTavern?.getContext?.();
            if (!context) {
                console.warn('[MessageFilterHook] ⚠️ 无法获取context');
                return;
            }
            
            // Hook setExtensionPrompt（条件过滤）
            if (typeof context.setExtensionPrompt === 'function') {
                const originalSetExtensionPrompt = context.setExtensionPrompt;
                const filterManager = this.contentFilterManager;
                
                context.setExtensionPrompt = function(identifier, prompt, priority, position, depth, role) {
                    // 检查是否需要过滤
                    const shouldFilter = window.MessageFilterHook_ShouldFilter?.();
                    
                    let filteredPrompt = prompt;
                    if (shouldFilter && filterManager && typeof prompt === 'string') {
                        filteredPrompt = filterManager.filterForMainAPI(prompt);
                        if (filteredPrompt !== prompt) {
                            console.log('[MessageFilterHook] 🔒 已过滤扩展提示词内容');
                        }
                    }
                    
                    // 调用原始函数
                    return originalSetExtensionPrompt.call(this, identifier, filteredPrompt, priority, position, depth, role);
                };
                
                console.log('[MessageFilterHook] ✅ setExtensionPrompt Hook安装成功');
            }
            
        } catch (error) {
            console.error('[MessageFilterHook] ❌ Hook扩展提示词系统失败:', error);
        }
    }
    
    /**
     * 条件过滤 - 只在使用自定义API时过滤
     */
    applyConditionalFilter() {
        try {
            if (this.isFiltering) {
                console.log('[MessageFilterHook] ⚠️ 已经在过滤状态中');
                return;
            }
            
            // 🔧 关键修复：检查是否使用自定义API
            const shouldFilter = this.shouldFilterForCurrentAPI();
            
            if (!shouldFilter) {
                console.log('[MessageFilterHook] ℹ️ 使用主API模式，不过滤标签（主API需要这些标签生成信息栏内容）');
                return;
            }
            
            console.log('[MessageFilterHook] 🔍 使用自定义API模式，开始过滤标签...');
            
            const context = window.SillyTavern?.getContext?.();
            if (!context || !context.chat) {
                console.warn('[MessageFilterHook] ⚠️ 无法获取聊天上下文');
                return;
            }
            
            this.isFiltering = true;
            this.originalMessages.clear();
            
            // 遍历所有消息，保存原始内容并应用过滤
            context.chat.forEach((message, index) => {
                if (message && message.mes && typeof message.mes === 'string') {
                    // 保存原始内容
                    this.originalMessages.set(index, message.mes);
                    
                    // 应用过滤
                    const filteredMes = this.contentFilterManager.filterForMainAPI(message.mes);
                    if (filteredMes !== message.mes) {
                        console.log(`[MessageFilterHook] 🔒 过滤消息 #${index}，原始长度: ${message.mes.length}，过滤后长度: ${filteredMes.length}`);
                        message.mes = filteredMes;
                    }
                }
            });
            
            console.log(`[MessageFilterHook] ✅ 消息过滤完成，共过滤 ${this.originalMessages.size} 条消息`);
            
        } catch (error) {
            console.error('[MessageFilterHook] ❌ 应用过滤失败:', error);
            this.isFiltering = false;
        }
    }
    
    /**
     * 检查是否应该为当前API模式过滤
     */
    shouldFilterForCurrentAPI() {
        try {
            const context = window.SillyTavern?.getContext?.();
            const extensionSettings = context?.extensionSettings?.['Information bar integration tool'];
            const apiConfig = extensionSettings?.apiConfig;
            
            // 如果自定义API启用且配置完整，则需要过滤
            const isCustomAPIEnabled = apiConfig?.enabled === true && 
                                     apiConfig?.apiKey && 
                                     apiConfig?.model;
            
            console.log('[MessageFilterHook] 🔍 API模式检查:', {
                customAPIEnabled: isCustomAPIEnabled,
                apiProvider: apiConfig?.provider,
                apiModel: apiConfig?.model
            });
            
            return isCustomAPIEnabled;
            
        } catch (error) {
            console.error('[MessageFilterHook] ❌ 检查API模式失败:', error);
            return false;
        }
    }
    
    /**
     * 恢复原始内容
     */
    restoreOriginal() {
        try {
            if (!this.isFiltering) {
                return;
            }
            
            console.log('[MessageFilterHook] 🔄 恢复原始消息内容...');
            
            const context = window.SillyTavern?.getContext?.();
            if (!context || !context.chat) {
                console.warn('[MessageFilterHook] ⚠️ 无法获取聊天上下文');
                return;
            }
            
            // 恢复所有消息的原始内容
            this.originalMessages.forEach((originalMes, index) => {
                if (context.chat[index]) {
                    context.chat[index].mes = originalMes;
                }
            });
            
            console.log(`[MessageFilterHook] ✅ 已恢复 ${this.originalMessages.size} 条消息的原始内容`);
            
            this.originalMessages.clear();
            this.isFiltering = false;
            
        } catch (error) {
            console.error('[MessageFilterHook] ❌ 恢复原始内容失败:', error);
            this.isFiltering = false;
        }
    }
    
    /**
     * 为总结过滤消息内容
     * @param {Array} messages - 消息数组
     * @returns {Array} 过滤后的消息数组
     */
    filterMessagesForSummary(messages) {
        try {
            console.log('[MessageFilterHook] 📝 为总结过滤消息内容...');
            
            if (!Array.isArray(messages)) {
                return messages;
            }
            
            const filteredMessages = messages.map(msg => {
                if (!msg || !msg.mes) return msg;
                
                const filteredMes = this.contentFilterManager.filterForMainAPI(msg.mes);
                
                return {
                    ...msg,
                    mes: filteredMes
                };
            });
            
            console.log('[MessageFilterHook] ✅ 总结消息过滤完成');
            return filteredMessages;
            
        } catch (error) {
            console.error('[MessageFilterHook] ❌ 过滤总结消息失败:', error);
            return messages;
        }
    }
    
    /**
     * 卸载Hook
     */
    uninstall() {
        try {
            if (!this.hooked) {
                console.log('[MessageFilterHook] ⚠️ Hook未安装');
                return;
            }
            
            console.log('[MessageFilterHook] 🔓 开始卸载消息过滤Hook...');
            
            // 恢复所有原始内容
            this.restoreOriginal();
            
            this.hooked = false;
            console.log('[MessageFilterHook] ✅ 消息过滤Hook卸载完成');
            
        } catch (error) {
            console.error('[MessageFilterHook] ❌ 卸载Hook失败:', error);
        }
    }
}
