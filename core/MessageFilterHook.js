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
     * 🔧 修复：Hook提示词生成事件，在发送前过滤
     */
    hookWithEvents() {
        try {
            const context = window.SillyTavern?.getContext?.();
            if (!context || !context.eventSource || !context.event_types) {
                console.warn('[MessageFilterHook] ⚠️ 无法获取事件系统');
                return;
            }
            
            const { eventSource, event_types } = context;
            const filterManager = this.contentFilterManager;
            
            // 🔧 修复：Hook CHAT_COMPLETION_PROMPT_READY 事件，过滤发送给AI的提示词
            eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, (data) => {
                if (data && Array.isArray(data.messages)) {
                    console.log('[MessageFilterHook] 🔍 过滤提示词消息...');
                    
                    data.messages.forEach((msg, index) => {
                        if (msg && msg.content && typeof msg.content === 'string') {
                            const originalContent = msg.content;
                            const filteredContent = filterManager.filterForMainAPI(originalContent);
                            
                            if (filteredContent !== originalContent) {
                                msg.content = filteredContent;
                                console.log(`[MessageFilterHook] 🔒 已过滤消息#${index}，长度: ${originalContent.length} → ${filteredContent.length}`);
                            }
                        }
                    });
                }
            });
            
            console.log('[MessageFilterHook] ✅ 事件监听Hook安装成功（提示词过滤）');
            
        } catch (error) {
            console.error('[MessageFilterHook] ❌ Hook事件监听失败:', error);
        }
    }
    
    /**
     * Hook扩展提示词系统
     * 🔧 修复：在提示词发送时过滤，不修改原始消息
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
                    // 🔧 修复：始终过滤提示词中的标签（不管是主API还是自定义API）
                    // 因为这些标签只用于自定义API生成数据，不应该发送给主API
                    let filteredPrompt = prompt;
                    if (filterManager && typeof prompt === 'string') {
                        filteredPrompt = filterManager.filterForMainAPI(prompt);
                        if (filteredPrompt !== prompt) {
                            console.log('[MessageFilterHook] 🔒 已过滤扩展提示词中的标签内容');
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
     * 🔧 修复：不修改原始消息，只在发送时过滤
     */
    applyConditionalFilter() {
        try {
            // 🔧 修复：不再修改消息内容，过滤逻辑移到 hookExtensionPrompts 中处理
            console.log('[MessageFilterHook] ℹ️ 过滤逻辑已移至提示词Hook，不修改原始消息');
            
        } catch (error) {
            console.error('[MessageFilterHook] ❌ 应用过滤失败:', error);
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
     * 🔧 修复：不再需要恢复，因为不再修改原始消息
     */
    restoreOriginal() {
        try {
            // 🔧 修复：不再修改原始消息，所以不需要恢复
            console.log('[MessageFilterHook] ℹ️ 不需要恢复（未修改原始消息）');
            
        } catch (error) {
            console.error('[MessageFilterHook] ❌ 恢复原始内容失败:', error);
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
