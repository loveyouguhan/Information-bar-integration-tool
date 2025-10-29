/**
 * 剧情优化拦截器
 *
 * 核心功能：
 * - 提前触发机制：在MESSAGE_SENT事件时就开始剧情优化
 * - 缓存机制：将优化结果缓存，Generate时直接使用
 * - 零等待：避免502超时问题
 *
 * @module PlotOptimizationInterceptor
 */

/**
 * 显示通知
 * @param {string} message - 通知消息
 * @param {string} type - 通知类型 (success/error/warning/info)
 */
function showNotification(message, type = 'info') {
    try {
        // 使用SillyTavern的toastr通知系统
        if (typeof toastr !== 'undefined') {
            toastr[type](message);
        } else {
            console.log(`[通知] ${type.toUpperCase()}: ${message}`);
        }
    } catch (error) {
        console.error('[PlotOptimizationInterceptor] ❌ 显示通知失败:', error);
    }
}

/**
 * 初始化剧情优化拦截器
 * @param {Object} plotOptimizationSystem - 剧情优化系统实例
 */
export function initPlotOptimizationInterceptor(plotOptimizationSystem) {
    console.log('[PlotOptimizationInterceptor] 🚀 初始化拦截器...');
    
    const ctx = window.SillyTavern?.getContext?.();
    if (!ctx || !plotOptimizationSystem) {
        console.warn('[PlotOptimizationInterceptor] ⚠️ 系统未就绪');
        return;
    }
    
    const pos = plotOptimizationSystem;
    
    // 🔧 新增：提前优化缓存与结果表（避免在Generate阶段等待Promise）
    if (!pos.preOptimizationCache) {
        pos.preOptimizationCache = new Map(); // messageId -> Promise<{ suggestion, messageId, floorNumber }>
    }
    if (!pos.preOptimizationResults) {
        pos.preOptimizationResults = new Map(); // messageId -> { suggestion, messageId, floorNumber, timestamp }
    }

    // 🔧 监听MESSAGE_SENT事件，提前开始剧情优化
    if (ctx.eventSource && ctx.event_types) {
        // 移除旧的监听器（如果存在）
        if (pos._preOptimizationListener) {
            ctx.eventSource.removeListener(ctx.event_types.MESSAGE_SENT, pos._preOptimizationListener);
        }
        
        // 创建新的监听器
        pos._preOptimizationListener = async (data) => {
            try {
                if (!pos.config?.enabled) return;

                const runtimeChat = ctx.chat;
                if (!Array.isArray(runtimeChat) || runtimeChat.length === 0) return;

                // 获取最后一条用户消息
                const lastMessage = runtimeChat[runtimeChat.length - 1];
                if (!lastMessage?.is_user) return;

                // 🔧 修复：使用楼层号作为messageId，确保一致性
                const floorNumber = runtimeChat.length;
                const messageId = `floor_${floorNumber}`;

                console.log('[PlotOptimization] 📊 MESSAGE_SENT - messageId:', messageId, 'floorNumber:', floorNumber);

                // 🔧 修复：检查是否已经有剧情优化建议
                const existing = pos.plotSuggestions?.get?.(messageId);
                if (existing && existing.suggestion) {
                    console.log('[PlotOptimization] ⏭️ 该用户消息已有剧情优化建议，跳过 (floor:', floorNumber, ')');
                    return;
                }

                // 检查预优化结果表（零等待）
                if (pos.preOptimizationResults?.has(messageId)) {
                    console.log('[PlotOptimization] ⏭️ 预优化结果已存在，跳过 (floor:', floorNumber, ')');
                    return;
                }

                // 检查是否已经有预优化缓存（正在进行中）
                if (pos.preOptimizationCache.has(messageId)) {
                    console.log('[PlotOptimization] ⏭️ 预优化正在进行中，跳过 (floor:', floorNumber, ')');
                    return;
                }

                console.log('[PlotOptimization] 🚀 提前开始剧情优化 (MESSAGE_SENT), floor:', floorNumber);
                
                // 🔧 创建异步优化Promise并缓存
                const optimizationPromise = (async () => {
                    try {
                        const contextMessages = await pos.getContextMessages();
                        if (!contextMessages?.length) {
                            console.log('[PlotOptimization] ⏸️ 无上下文，跳过预优化');
                            showNotification('⏸️ 剧情优化跳过：无足够上下文', 'warning');
                            return null;
                        }

                        console.log('[PlotOptimization] 📡 开始调用剧情优化API (预优化)...');
                        const start = Date.now();
                        const suggestion = await pos.getPlotSuggestion(contextMessages);
                        const elapsed = Date.now() - start;

                        if (suggestion) {
                            console.log(`[PlotOptimization] ✅ 预优化完成, 耗时: ${elapsed}ms (${(elapsed/1000).toFixed(1)}秒)`);
                            showNotification(`✅ 剧情优化已完成 (耗时: ${(elapsed/1000).toFixed(1)}秒)`, 'success');
                            const result = { suggestion, messageId, floorNumber, timestamp: Date.now() };
                            try {
                                // 🔧 写入结果表，供Generate零等待读取
                                pos.preOptimizationResults.set(messageId, result);
                                // 🔧 预存到plotSuggestions，便于后续再生成检测与预览
                                if (pos.plotSuggestions && typeof pos.plotSuggestions.set === 'function') {
                                    pos.plotSuggestions.set(messageId, { suggestion, floorNumber, timestamp: result.timestamp });
                                }
                                // 💾 同步持久化到对应的用户消息，刷新后可恢复
                                try {
                                    const idx = Math.max(0, Number(floorNumber) - 1);
                                    const userMsg = Array.isArray(ctx.chat) ? ctx.chat[idx] : null;
                                    if (userMsg && userMsg.is_user) {
                                        userMsg.infobar_plot_optimization = {
                                            suggestion,
                                            timestamp: result.timestamp,
                                            floorNumber,
                                            messageId,
                                            version: 1,
                                        };
                                        if (typeof ctx.saveChat === 'function') {
                                            await ctx.saveChat();
                                            console.log('[PlotOptimization] 💾 已持久化预优化建议到用户消息并保存聊天');
                                        }
                                    }
                                } catch (persistErr) {
                                    console.warn('[PlotOptimization] ⚠️ 持久化预优化建议失败:', persistErr);
                                }
                            } catch (wErr) {
                                console.warn('[PlotOptimization] ⚠️ 写入预优化结果表失败:', wErr);
                            }
                            return result;
                        } else {
                            console.warn('[PlotOptimization] ⚠️ 预优化未获取到建议');
                            showNotification('⚠️ 剧情优化失败：未获取到有效建议', 'warning');
                            return null;
                        }
                    } catch (e) {
                        console.error('[PlotOptimization] ❌ 预优化失败:', e);
                        const errorMsg = e.message || '未知错误';
                        showNotification(`❌ 剧情优化失败：${errorMsg}`, 'error');
                        return null;
                    }
                })();
                
                // 缓存Promise
                pos.preOptimizationCache.set(messageId, optimizationPromise);
                
                // 设置5分钟后自动清理缓存
                setTimeout(() => {
                    if (pos.preOptimizationCache.has(messageId)) {
                        pos.preOptimizationCache.delete(messageId);
                        console.log('[PlotOptimization] 🗑️ 清理过期的预优化缓存');
                    }
                }, 5 * 60 * 1000);
                
            } catch (err) {
                console.error('[PlotOptimization] ❌ 预优化监听器错误:', err);
            }
        };
        
        // 绑定监听器
        ctx.eventSource.on(ctx.event_types.MESSAGE_SENT, pos._preOptimizationListener);
        console.log('[PlotOptimizationInterceptor] ✅ 已绑定MESSAGE_SENT预优化监听器');
    }
    
    console.log('[PlotOptimizationInterceptor] ✅ 拦截器初始化完成');
}

/**
 * 创建Generate拦截器函数
 * @returns {Function} 拦截器函数
 */
export function createGenerateInterceptor() {
    return async function (coreChat, contextSize, abort, type) {
        try {
            const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null;
            const modules = window.SillyTavernInfobar?.modules || {};
            const pos = modules.plotOptimizationSystem;

            if (!ctx || !pos || !pos.config?.enabled) {
                return;
            }

            // 仅跳过不会影响正向生成流程的类型；允许 regenerate/continue 走优化流程
            const blockedTypes = new Set(['quiet', 'swipe', 'impersonate']);
            if (blockedTypes.has(String(type))) {
                console.debug('[InfoBarTool][Interceptor] 跳过非正常生成类型, skip:', type);
                return;
            }

            const runtimeChat = ctx.chat;
            if (!Array.isArray(runtimeChat) || runtimeChat.length === 0) return;

            let userIndex = runtimeChat.length - 1;
            const last = runtimeChat[userIndex];
            const secondLast = runtimeChat[userIndex - 1];
            let userMessage = null;
            if (last?.is_user) {
                userMessage = last;
            } else if (secondLast?.is_user) {
                userIndex = userIndex - 1;
                userMessage = secondLast;
            } else {
                console.debug('[InfoBarTool][Interceptor] 未找到用户消息, skip');
                return;
            }

            // 🔧 修复：使用楼层号作为messageId，确保一致性
            const floorNumber = userIndex + 1;
            const messageId = `floor_${floorNumber}`;

            console.log('[InfoBarTool][Interceptor] 📊 Generate - messageId:', messageId, 'floorNumber:', floorNumber, 'type:', type);

            let suggestion = null;
            const existing = pos.plotSuggestions?.get?.(messageId);
            if (existing && existing.floorNumber === floorNumber) {
                suggestion = existing.suggestion;
                console.log('[InfoBarTool][Interceptor] ♻️ 使用已存在的剧情建议, floor:', floorNumber);
            }

            console.log('[InfoBarTool][Interceptor] 🎬 开始剧情优化处理, floor:', floorNumber, 'type:', type);
            const start = Date.now();
            
            // 🔧 优先使用已完成的预优化结果（零等待）
            if (!suggestion && pos.preOptimizationResults && pos.preOptimizationResults.has(messageId)) {
                const cached = pos.preOptimizationResults.get(messageId);
                if (cached && cached.suggestion) {
                    suggestion = cached.suggestion;
                    console.log('[InfoBarTool][Interceptor] ✅ 预优化结果命中（零等待）');
                }
                // 使用后清理对应的promise与结果
                pos.preOptimizationResults.delete(messageId);
                if (pos.preOptimizationCache) pos.preOptimizationCache.delete(messageId);
            }
            
            //
            // 不再在Generate阶段调用API，避免阻塞主生成流程导致502；
            // 仅在已有建议或预优化结果可用时进行注入
            //

            if (suggestion) {
                console.log('[InfoBarTool][Interceptor] 💉 注入剧情建议到主API提示词...');
                await pos.injectSuggestion(suggestion, messageId, floorNumber);
                pos.stats.totalOptimizations = (pos.stats.totalOptimizations || 0) + 1;
                pos.stats.successCount = (pos.stats.successCount || 0) + 1;
                pos.lastProcessedChatLength = runtimeChat.length;
                pos.lastProcessedMessageId = messageId;
                pos.lastOptimizationTime = Date.now();
                if (pos) {
                    pos.pendingRetry = { messageId, floorNumber, chatLengthBefore: runtimeChat.length, attempted: false };
                }
                const elapsed = Date.now() - start;
                console.log(`[InfoBarTool][Interceptor] ✅ 剧情优化完成, 耗时: ${elapsed}ms (${(elapsed/1000).toFixed(1)}秒)`);
            } else {
                // ⏭️ 无可用建议（预优化尚未完成或失败），不阻塞主生成流程，直接跳过注入
                console.log('[InfoBarTool][Interceptor] ⏭️ 无可用剧情建议，跳过注入（不阻塞主API调用）');
            }
        } catch (err) {
            const pos = window.SillyTavernInfobar?.modules?.plotOptimizationSystem;
            if (pos) pos.errorCount = (pos.errorCount || 0) + 1;
            console.error('[InfoBarTool][Interceptor] ❌ 拦截器错误:', err);
        }
    };
}

