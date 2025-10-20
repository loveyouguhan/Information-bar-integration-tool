/**
 * XML数据解析器
 *
 * 负责解析SillyTavern消息中的infobar_data XML标签：
 * - 提取<infobar_data>标签内容
 * - 解析XML注释格式的面板数据
 * - 转换为结构化的JavaScript对象
 * - 验证数据完整性和格式正确性
 *
 * @class XMLDataParser
 */

export class XMLDataParser {
    constructor(eventSystem = null) {
        console.log('[XMLDataParser] 🔧 XML数据解析器初始化开始');

        this.eventSystem = eventSystem;

        // 解析统计
        this.parseStats = {
            totalParsed: 0,
            successfulParsed: 0,
            errors: 0,
            lastParseTime: 0
        };

        // 🔧 修复：动态获取支持的面板类型，包括自定义面板和自定义子项
        this.updateSupportedPanels();

        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;

        // 🔧 优化：添加解析缓存，避免重复解析相同消息
        this.parsedMessageCache = new Map();
        this.maxCacheSize = 100; // 最大缓存100条消息

        console.log('[XMLDataParser] ✅ XML数据解析器初始化完成');
        this.initialized = true;
    }

    /**
     * 🔧 重构：动态更新支持的面板类型（统一从customPanels获取）
     * 移除中英文映射，直接使用中文键名
     */
    updateSupportedPanels() {
        try {
            console.log('[XMLDataParser] 🔄 动态更新支持的面板类型...');

            // 获取SillyTavern上下文
            const context = window.SillyTavern?.getContext?.();
            if (!context) {
                console.log('[XMLDataParser] ⚠️ 无法获取SillyTavern上下文，跳过面板更新');
                this.supportedPanels = new Set();
                this.customSubItems = new Map();
                return;
            }

            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings?.['Information bar integration tool'] || {};

            // 🔧 新架构：从customPanels获取所有面板
            this.supportedPanels = new Set();
            this.customSubItems = new Map();

            const customPanels = configs.customPanels || {};

            // 遍历所有customPanels
            Object.entries(customPanels).forEach(([panelKey, panel]) => {
                if (!panel) return;

                // 只添加启用的面板到支持列表
                if (panel.enabled !== false) {
                    // 使用面板的键名（中文）作为标识符
                    this.supportedPanels.add(panelKey);
                    console.log(`[XMLDataParser] ✅ 添加面板支持: ${panelKey} (${panel.name || '未命名'})`);

                    // 获取面板的子项信息
                    if (panel.subItems && Array.isArray(panel.subItems)) {
                        const subItems = panel.subItems.map(subItem => ({
                            key: subItem.key || subItem.name?.toLowerCase().replace(/\s+/g, '_'),
                            name: subItem.displayName || subItem.name,
                            enabled: subItem.enabled !== false
                        }));

                        if (subItems.length > 0) {
                            this.customSubItems.set(panelKey, subItems);
                            console.log(`[XMLDataParser] 📊 面板 ${panelKey} 包含 ${subItems.length} 个子项`);
                        }
                    }
                }
            });

            console.log(`[XMLDataParser] ✅ 支持的面板更新完成，共 ${this.supportedPanels.size} 个面板`);
            console.log(`[XMLDataParser] 📋 面板子项信息: ${this.customSubItems.size} 个面板包含子项`);

        } catch (error) {
            console.error('[XMLDataParser] ❌ 更新支持的面板失败:', error);
            // 降级处理：使用空集合
            this.supportedPanels = new Set();
            this.customSubItems = new Map();
        }
    }

    /**
     * 解析消息中的infobar_data
     * @param {string} messageContent - 消息内容
     * @param {Object} options - 解析选项
     * @returns {Promise<Object|null>} 解析结果
     */
    async parseInfobarData(messageContent, options = {}) {
        try {
            const { skipIfCached = true, messageId = null } = options;

            // 🔧 优化：检查是否已经解析过此消息
            if (skipIfCached && messageId) {
                const cacheKey = this.generateCacheKey(messageContent, messageId);
                if (this.parsedMessageCache.has(cacheKey)) {
                    console.log('[XMLDataParser] 📋 使用缓存的解析结果:', messageId);
                    return this.parsedMessageCache.get(cacheKey);
                }
            }

            console.log('[XMLDataParser] 🔍 开始解析infobar_data...');
            this.parseStats.totalParsed++;

            if (!messageContent || typeof messageContent !== 'string') {
                console.warn('[XMLDataParser] ⚠️ 消息内容为空或格式无效');
                return null;
            }

            // 🔧 修复：在每次解析前更新支持的面板类型
            this.updateSupportedPanels();

            // 提取infobar_data标签内容
            const infobarContent = this.extractInfobarDataContent(messageContent);
            if (!infobarContent) {
                console.log('[XMLDataParser] ℹ️ 消息中未找到infobar_data标签');
                return null;
            }

            // 🔧 修复：parseXMLCommentData是异步方法，必须使用await
            let parsedData = await this.parseXMLCommentData(infobarContent);

            // 如果XML注释格式解析失败，尝试直接解析面板数据格式
            if (!parsedData) {
                console.log('[XMLDataParser] ℹ️ XML注释格式解析失败，尝试直接面板格式解析...');
                // 🔧 修复：parseDirectPanelFormat是异步方法，必须使用await
                parsedData = await this.parseDirectPanelFormat(infobarContent);
            }

            if (!parsedData) {
                console.warn('[XMLDataParser] ⚠️ 所有格式的数据解析都失败');
                return null;
            }

            // 🚀 检查是否是操作指令格式
            if (parsedData.__format === 'operation_commands') {
                console.log('[XMLDataParser] 🚀 处理操作指令格式结果');

                this.parseStats.successfulParsed++;
                this.parseStats.lastParseTime = Date.now();

                console.log('[XMLDataParser] ✅ 操作指令解析成功，包含', parsedData.__operations?.length || 0, '个操作');

                // 🔧 优化：缓存解析结果
                if (options.messageId) {
                    const cacheKey = this.generateCacheKey(messageContent, options.messageId);
                    this.cacheParseResult(cacheKey, parsedData);
                }

                // 触发操作指令解析完成事件
                if (this.eventSystem) {
                    this.eventSystem.emit('xml:operation:parsed', {
                        operations: parsedData.__operations,
                        metadata: parsedData.__metadata,
                        timestamp: Date.now(),
                        operationCount: parsedData.__operations?.length || 0
                    });
                }

                return parsedData;
            }

            // 验证和清理数据（传统面板格式）
            const validatedData = this.validateAndCleanData(parsedData);

            // 🚨 移除兼容性处理：不再自动修复错误格式，让AI学会输出正确格式
            // const fixedData = this.fixNpcDataMixing(validatedData);
            const fixedData = validatedData; // 直接使用验证后的数据，不进行格式修复

            this.parseStats.successfulParsed++;
            this.parseStats.lastParseTime = Date.now();

            console.log('[XMLDataParser] ✅ infobar_data解析成功，包含', Object.keys(fixedData).length, '个面板');

            // 🔧 优化：缓存解析结果
            if (options.messageId) {
                const cacheKey = this.generateCacheKey(messageContent, options.messageId);
                this.cacheParseResult(cacheKey, fixedData);
            }

            // 触发解析完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('xml:data:parsed', {
                    data: fixedData,
                    timestamp: Date.now(),
                    panelCount: Object.keys(fixedData).length
                });
            }

            return fixedData;

        } catch (error) {
            console.error('[XMLDataParser] ❌ 解析infobar_data失败:', error);
            this.parseStats.errors++;
            this.handleError(error);
            return null;
        }
    }

    /**
     * 提取infobar_data标签内容（宽松模式）
     * 参考Amily2项目的extractContentByTag方法，支持多种格式
     * @param {string} content - 消息内容
     * @returns {string|null} 提取的内容
     */
    extractInfobarDataContent(content) {
        try {
            console.log('[XMLDataParser] 🔍 开始提取infobar_data标签内容...');

            // 🔧 修复：使用indexOf方法精确提取，支持被HTML标签包裹的情况
            const startTag = '<infobar_data>';
            const endTag = '</infobar_data>';

            const startIndex = content.indexOf(startTag);
            if (startIndex === -1) {
                console.log('[XMLDataParser] ℹ️ 未找到<infobar_data>开始标签');
                return null;
            }

            const endIndex = content.indexOf(endTag, startIndex);
            if (endIndex === -1) {
                console.log('[XMLDataParser] ⚠️ 未找到</infobar_data>结束标签，尝试提取部分内容');

                // 🚀 策略: 部分标签 - 只有开始标签
                const partialContent = content.substring(startIndex + startTag.length).trim();
                if (partialContent.length > 20) {
                    console.log('[XMLDataParser] ⚠️ 提取成功（部分标签），长度:', partialContent.length);
                    return partialContent;
                }

                return null;
            }

            // 提取标签之间的内容
            const extractedContent = content.substring(startIndex + startTag.length, endIndex).trim();
            console.log('[XMLDataParser] ✅ 提取成功（增强提取），长度:', extractedContent.length);
            return extractedContent;

        } catch (error) {
            console.error('[XMLDataParser] ❌ 提取infobar_data内容失败:', error);
            return null;
        }
    }

    /**
     * 解析XML注释格式的数据（宽松模式）
     * 参考Amily2项目，支持多种注释格式和不完整的注释
     * @param {string} content - XML注释内容
     * @returns {Promise<Object|null>} 解析结果
     */
    async parseXMLCommentData(content) {
        try {
            console.log('[XMLDataParser] � 开始解析XML注释格式...');

            // 🚀 宽松检查：只要包含注释标记之一即可
            const hasCommentStart = content.includes('<!--');
            const hasCommentEnd = content.includes('-->');

            if (!hasCommentStart && !hasCommentEnd) {
                console.log('[XMLDataParser] ℹ️ 内容不包含XML注释格式，跳过解析');
                return null;
            }

            let totalParsed = {};
            let hasValidData = false;

            // � 策略1: 标准完整注释 - <!--...-->
            const completeComments = content.match(/<!--([\s\S]*?)-->/g);
            if (completeComments && completeComments.length > 0) {
                console.log(`[XMLDataParser] 📝 找到 ${completeComments.length} 个完整XML注释`);

                for (const commentMatch of completeComments) {
                    const match = commentMatch.match(/<!--([\s\S]*?)-->/);
                    if (!match || !match[1]) continue;

                    const dataContent = match[1].trim();

                    // 🚀 宽松验证：只要内容长度足够就尝试解析
                    if (dataContent.length < 10) {
                        console.log('[XMLDataParser] ℹ️ 注释内容太短，跳过');
                        continue;
                    }

                    console.log('[XMLDataParser] 📝 尝试解析注释内容，长度:', dataContent.length);

                    const parseResult = await this.parsePanelData(dataContent);

                    if (parseResult && typeof parseResult === 'object' && Object.keys(parseResult).length > 0) {
                        Object.assign(totalParsed, parseResult);
                        hasValidData = true;
                        console.log('[XMLDataParser] ✅ 注释解析成功');
                    }
                }
            }

            // 🚀 策略2: 不完整注释 - 只有开始标记 <!--...
            if (!hasValidData && hasCommentStart && !hasCommentEnd) {
                console.log('[XMLDataParser] 🔍 检测到不完整注释（缺少结束标记），尝试解析...');
                const incompleteMatch = content.match(/<!--([\s\S]*)$/);
                if (incompleteMatch && incompleteMatch[1]) {
                    const dataContent = incompleteMatch[1].trim();

                    if (dataContent.length >= 10) {
                        console.log('[XMLDataParser] � 尝试解析不完整注释，长度:', dataContent.length);
                        const parseResult = await this.parsePanelData(dataContent);

                        if (parseResult && typeof parseResult === 'object' && Object.keys(parseResult).length > 0) {
                            Object.assign(totalParsed, parseResult);
                            hasValidData = true;
                            console.log('[XMLDataParser] ✅ 不完整注释解析成功');
                        }
                    }
                }
            }

            // 🚀 策略3: 只有结束标记 ...-->
            if (!hasValidData && !hasCommentStart && hasCommentEnd) {
                console.log('[XMLDataParser] � 检测到不完整注释（缺少开始标记），尝试解析...');
                const incompleteMatch = content.match(/^([\s\S]*?)-->/);
                if (incompleteMatch && incompleteMatch[1]) {
                    const dataContent = incompleteMatch[1].trim();

                    if (dataContent.length >= 10) {
                        console.log('[XMLDataParser] 📝 尝试解析不完整注释，长度:', dataContent.length);
                        const parseResult = await this.parsePanelData(dataContent);

                        if (parseResult && typeof parseResult === 'object' && Object.keys(parseResult).length > 0) {
                            Object.assign(totalParsed, parseResult);
                            hasValidData = true;
                            console.log('[XMLDataParser] ✅ 不完整注释解析成功');
                        }
                    }
                }
            }

            if (!hasValidData) {
                console.log('[XMLDataParser] ℹ️ 所有XML注释都未能解析出有效数据');
                return null;
            }

            console.log('[XMLDataParser] ✅ XML注释解析完成，共解析出', Object.keys(totalParsed).length, '个面板');
            return totalParsed;

        } catch (error) {
            console.error('[XMLDataParser] ❌ 解析XML注释数据失败:', error);
            return null;
        }
    }

    /**
     * 直接解析面板数据格式（非XML注释格式，宽松模式）
     * 参考Amily2项目，尝试多种解析策略
     * @param {string} content - 面板数据内容
     * @returns {Promise<Object|null>} 解析结果
     */
    async parseDirectPanelFormat(content) {
        try {
            console.log('[XMLDataParser] 🔍 开始直接面板格式解析（宽松模式）...');

            if (!content || typeof content !== 'string') {
                console.log('[XMLDataParser] ℹ️ 内容为空或格式不正确');
                return null;
            }

            // 🚀 宽松验证：只要内容长度足够就尝试解析
            if (content.trim().length < 10) {
                console.log('[XMLDataParser] ℹ️ 内容太短，跳过解析');
                return null;
            }

            console.log('[XMLDataParser] 📝 开始解析直接面板数据，长度:', content.length);

            // � 策略1: 直接尝试解析（最宽松）
            let parseResult = await this.parsePanelData(content);

            if (parseResult && typeof parseResult === 'object' && Object.keys(parseResult).length > 0) {
                console.log('[XMLDataParser] ✅ 直接面板格式解析成功（策略1），包含', Object.keys(parseResult).length, '个面板');
                return parseResult;
            }

            // 🚀 策略2: 尝试清理内容后再解析
            console.log('[XMLDataParser] 🔍 策略1失败，尝试清理内容后再解析...');
            const cleanedContent = content
                .replace(/^[\s\n\r]+/, '') // 移除开头空白
                .replace(/[\s\n\r]+$/, '') // 移除结尾空白
                .replace(/\r\n/g, '\n')    // 统一换行符
                .replace(/\r/g, '\n');     // 统一换行符

            parseResult = await this.parsePanelData(cleanedContent);

            if (parseResult && typeof parseResult === 'object' && Object.keys(parseResult).length > 0) {
                console.log('[XMLDataParser] ✅ 直接面板格式解析成功（策略2），包含', Object.keys(parseResult).length, '个面板');
                return parseResult;
            }

            // 🚀 策略3: 尝试提取可能的面板数据块
            console.log('[XMLDataParser] 🔍 策略2失败，尝试提取面板数据块...');
            const panelBlockMatch = content.match(/【[^】]+】[\s\S]*?(?=【|$)/g);
            if (panelBlockMatch && panelBlockMatch.length > 0) {
                console.log(`[XMLDataParser] 📝 找到 ${panelBlockMatch.length} 个可能的面板数据块`);
                const combinedBlocks = panelBlockMatch.join('\n');
                parseResult = await this.parsePanelData(combinedBlocks);

                if (parseResult && typeof parseResult === 'object' && Object.keys(parseResult).length > 0) {
                    console.log('[XMLDataParser] ✅ 直接面板格式解析成功（策略3），包含', Object.keys(parseResult).length, '个面板');
                    return parseResult;
                }
            }

            console.log('[XMLDataParser] ℹ️ 所有解析策略都未能提取有效数据');
            return null;

        } catch (error) {
            console.error('[XMLDataParser] ❌ 直接面板格式解析失败:', error);
            return null;
        }
    }

    /**
     * 🚀 验证内容是否像面板数据格式或操作指令格式
     * @param {string} content - 内容
     * @returns {boolean} 是否像面板数据格式
     */
    isValidPanelDataFormat(content) {
        if (!content || typeof content !== 'string') return false;

        // 🚀 新增：检查是否是操作指令格式
        const isOperationFormat = this.isOperationCommandFormat(content);
        if (isOperationFormat) {
            console.log('[XMLDataParser] 🚀 检测到操作指令格式');
            return true;
        }

        // 🔧 修复：放宽面板格式检查，支持更多格式变体
        const hasColonAndEquals = content.includes(':') && content.includes('=');

        // 🔧 修复：更灵活的面板模式匹配，支持中文字段名和复杂值
        const hasPanelPattern = /\w+:\s*[\w\u4e00-\u9fff]+.*?=/.test(content) || // 支持中文
                               /\w+:\s*npc\d+\.\w+\s*=/.test(content) || // 支持NPC格式
                               /\w+:\s*org\d+\.\w+\s*=/.test(content) || // 支持组织格式
                               /\w+:\s*\w+\s*=/.test(content); // 原始格式

        const isNotPureNarrative = !this.isPureNarrativeContent(content);

        console.log('[XMLDataParser] 🔍 格式验证详情:');
        console.log('  是否操作指令格式:', isOperationFormat);
        console.log('  包含冒号和等号:', hasColonAndEquals);
        console.log('  匹配面板模式:', hasPanelPattern);
        console.log('  非纯叙述内容:', isNotPureNarrative);
        console.log('  内容预览:', content.substring(0, 100));

        return hasColonAndEquals && hasPanelPattern && isNotPureNarrative;
    }

    /**
     * 检查是否是纯叙述性内容
     * @param {string} content - 内容
     * @returns {boolean} 是否是纯叙述性内容
     */
    isPureNarrativeContent(content) {
        // 🔧 修复：更准确的叙述性内容检测

        // 先检查是否明显是面板数据格式
        const hasPanelStructure = /\w+:\s*[\w\u4e00-\u9fff]+.*?=/.test(content) ||
                                 /\w+:\s*npc\d+\.\w+\s*=/.test(content) ||
                                 /\w+:\s*org\d+\.\w+\s*=/.test(content) ||
                                 /\w+:\s*\w+\s*=/.test(content);
        if (hasPanelStructure) {
            console.log('[XMLDataParser] 🔍 检测到面板结构，非纯叙述内容');
            return false; // 有面板结构，不是纯叙述
        }

        // 如果没有面板结构，检查常见的叙述性词汇或句式
        const narrativePatterns = [
            /感到|心中|情绪|享受|保持|开放|期待/,  // 情感描述
            /^[a-zA-Z]+:\s*\([^)]+\)/, // consider: (内容) 格式
            /温柔|愉悦|沉静|专注|理解|被回应/, // 描述性词汇
            /她.*，|他.*，|弥生.*，/, // 人物描述句式
        ];

        return narrativePatterns.some(pattern => pattern.test(content));
    }

    /**
     * 解析面板数据（宽松模式，支持多种格式）
     * @param {string} dataContent - 数据内容
     * @returns {Promise<Object>} 解析结果
     */
    async parsePanelData(dataContent) {
        try {
            const result = {};

            // 🔧 修复：检查数据格式是否有效
            if (!dataContent || typeof dataContent !== 'string') {
                console.warn('[XMLDataParser] ⚠️ 数据内容无效或为空');
                return null; // 返回null而不是空对象，表示解析失败
            }

            // 🚀 新增：检查是否是操作指令格式
            if (this.isOperationCommandFormat(dataContent)) {
                console.log('[XMLDataParser] 🚀 检测到操作指令格式，使用操作指令解析器');
                // 🔧 修复：parseOperationCommands是异步方法，必须使用await
                return await this.parseOperationCommands(dataContent);
            }

            // 🚀 新增：尝试简化格式解析（类似Amily2的宽松解析）
            const simpleFormatResult = this.parseSimpleFormat(dataContent);
            if (simpleFormatResult && Object.keys(simpleFormatResult).length > 0) {
                console.log('[XMLDataParser] ✅ 简化格式解析成功');
                return simpleFormatResult;
            }

            // 🔧 严格验证：检查是否包含有效的面板数据格式
            if (!this.isValidPanelDataFormat(dataContent)) {
                console.warn('[XMLDataParser] ⚠️ 数据内容不符合面板格式，内容:', dataContent.substring(0, 200));
                console.warn('[XMLDataParser] 🔍 预期格式: panelName: field1="value1", field2="value2" 或操作指令格式');
                return null; // 返回null表示格式不正确
            }

            // 按行分割数据
            const lines = dataContent.split('\n').filter(line => line.trim());

            console.log('[XMLDataParser] 📊 开始解析', lines.length, '行面板数据');

            lines.forEach((line, index) => {
                try {
                    const trimmedLine = line.trim();
                    if (!trimmedLine || !trimmedLine.includes(':')) {
                        console.log('[XMLDataParser] ℹ️ 跳过第', index + 1, '行（无冒号）:', trimmedLine.substring(0, 50));
                        return;
                    }

                    // 分割面板名和数据
                    const colonIndex = trimmedLine.indexOf(':');
                    const panelName = trimmedLine.substring(0, colonIndex).trim();
                    const panelDataStr = trimmedLine.substring(colonIndex + 1).trim();

                    if (!panelName || !panelDataStr) {
                        console.warn('[XMLDataParser] ⚠️ 第', index + 1, '行格式无效:', trimmedLine);
                        return;
                    }

                    // 解析面板字段
                    const panelData = this.parseFieldData(panelDataStr);
                    if (panelData && Object.keys(panelData).length > 0) {
                        result[panelName] = panelData;
                        console.log('[XMLDataParser] ✅ 解析面板:', panelName, '包含', Object.keys(panelData).length, '个字段');
                    }

                } catch (error) {
                    console.error('[XMLDataParser] ❌ 解析第', index + 1, '行失败:', error);
                }
            });

            console.log('[XMLDataParser] 📋 面板数据解析完成，共', Object.keys(result).length, '个面板');

            // 🔧 修复：如果没有解析出任何面板，返回null而不是空对象
            if (Object.keys(result).length === 0) {
                console.warn('[XMLDataParser] ⚠️ 未解析出任何有效面板数据');
                return null;
            }

            return result;

        } catch (error) {
            console.error('[XMLDataParser] ❌ 解析面板数据失败:', error);
            return null; // 返回null表示解析失败
        }
    }

    /**
     * 🚀 检查是否是操作指令格式
     * @param {string} content - 内容
     * @returns {boolean} 是否是操作指令格式
     */
    isOperationCommandFormat(content) {
        if (!content || typeof content !== 'string') return false;

        // 检查是否包含操作指令格式的特征 - 支持大小写
        const operationPattern = /^(add|update|delete|ADD|UPDATE|DELETE)\s+\w+\(/mi;
        const result = operationPattern.test(content.trim());
        
        if (result) {
            console.log('[XMLDataParser] ✅ 检测到操作指令格式');
        }
        
        return result;
    }

    /**
     * 🚀 解析操作指令格式
     * @param {string} dataContent - 操作指令内容
     * @returns {Promise<Object>} 解析结果
     */
    async parseOperationCommands(dataContent) {
        try {
            console.log('[XMLDataParser] 🚀 开始解析操作指令格式...');

            const operations = [];
            const lines = dataContent.split('\n').filter(line => line.trim());

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('#')) {
                    continue; // 跳过空行和注释
                }

                // 🔧 修复：parseOperationCommand是异步方法，必须使用await
                const operation = await this.parseOperationCommand(trimmedLine);
                if (operation) {
                    operations.push(operation);
                    console.log(`[XMLDataParser] ✅ 解析操作指令:`, operation);
                }
            }

            console.log(`[XMLDataParser] ✅ 解析了 ${operations.length} 个操作指令`);

            // 返回操作指令格式的结果
            return {
                __format: 'operation_commands',
                __operations: operations,
                __metadata: {
                    timestamp: Date.now(),
                    source: 'xml-parser',
                    operationCount: operations.length
                }
            };

        } catch (error) {
            console.error('[XMLDataParser] ❌ 解析操作指令失败:', error);
            return null;
        }
    }

    /**
     * 🚀 解析单个操作指令
     * @param {string} commandLine - 操作指令行
     * @returns {Promise<Object|null>} 操作对象
     */
    async parseOperationCommand(commandLine) {
        try {
            // 正则表达式匹配操作指令格式：add persona(1 {"1"，"张三"，"2"，"24"}) - 支持大小写
            const operationRegex = /^(add|update|delete|ADD|UPDATE|DELETE)\s+(\w+)\((\d+)(?:\s*\{([^}]*)\})?\)$/i;
            const match = commandLine.match(operationRegex);

            if (!match) {
                console.warn(`[XMLDataParser] ⚠️ 无法解析操作指令: ${commandLine}`);
                return null;
            }

            const [, operation, panelName, rowNumber, dataParams] = match;

            // 🚨 新增：严格验证面板名称是否在支持列表中
            if (!this.isValidPanelName(panelName)) {
                const errorMsg = `🚨🚨🚨 CRITICAL ERROR: AI尝试操作不存在的面板 "${panelName}"！
❌ 禁止操作：AI不能创建新面板或操作未启用的面板
✅ 允许的面板：${Array.from(this.supportedPanels).join(', ')}
🚨 系统拒绝此操作以防止数据污染！`;

                console.error('[XMLDataParser] 🚨 面板验证失败:', errorMsg);
                throw new Error(errorMsg);
            }

            const operationData = {
                type: operation.toLowerCase(), // 统一转换为小写
                panel: panelName,
                row: parseInt(rowNumber),
                data: {}
            };

            console.log(`[XMLDataParser] 🔍 解析指令: ${operation.toUpperCase()} ${panelName}(${rowNumber})`);

            // 解析数据参数（如果存在）
            if (dataParams && dataParams.trim()) {
                operationData.data = this.parseOperationDataParameters(dataParams);

                // 🚨 新增：验证字段是否在允许的字段列表中
                // 🔧 修复：validatePanelFields是异步方法，必须使用await
                const isValid = await this.validatePanelFields(panelName, operationData.data);
                if (!isValid) {
                    const errorMsg = `🚨🚨🚨 CRITICAL ERROR: AI尝试在面板 "${panelName}" 中使用不存在的字段！
❌ 禁止操作：AI不能创建新字段或使用未启用的字段
🚨 系统拒绝此操作以防止数据污染！`;

                    console.error('[XMLDataParser] 🚨 字段验证失败:', errorMsg);
                    throw new Error(errorMsg);
                }
            }

            return operationData;

        } catch (error) {
            console.error(`[XMLDataParser] ❌ 解析操作指令失败: ${commandLine}`, error);
            throw error; // 重新抛出错误，确保上层能够捕获
        }
    }

    /**
     * 🚀 解析操作指令数据参数
     * @param {string} dataParams - 数据参数字符串
     * @returns {Object} 解析后的数据对象
     */
    parseOperationDataParameters(dataParams) {
        try {
            const data = {};

            console.log(`[XMLDataParser] 🔍 开始解析操作数据参数: ${dataParams.substring(0, 200)}...`);

            // 🔧 修复：使用更智能的解析方法，处理引号内的逗号
            const parts = this.parseQuotedParameters(dataParams);

            console.log(`[XMLDataParser] 🔍 智能分割后的参数部分:`, parts);

            // 按照 "列号"，"值"，"列号"，"值" 的格式解析
            for (let i = 0; i < parts.length; i += 2) {
                if (i + 1 < parts.length) {
                    // 移除双引号并解析列号
                    const columnStr = parts[i].replace(/^"(.*)"$/, '$1');
                    const valueStr = parts[i + 1].replace(/^"(.*)"$/, '$1');

                    const columnNumber = parseInt(columnStr);

                    if (!isNaN(columnNumber) && valueStr !== undefined) {
                        // 🚨 修复：直接使用列号作为key，不添加前缀
                        data[columnNumber.toString()] = valueStr;
                        console.log(`[XMLDataParser] 📊 解析操作参数: 列${columnNumber} = "${valueStr}"`);
                    } else {
                        console.warn(`[XMLDataParser] ⚠️ 无效操作参数: "${parts[i]}" -> "${parts[i + 1]}"`);
                    }
                }
            }

            console.log(`[XMLDataParser] ✅ 解析完成，共${Object.keys(data).length}个字段:`, data);
            return data;

        } catch (error) {
            console.error('[XMLDataParser] ❌ 解析操作数据参数失败:', error);
            return {};
        }
    }

    /**
     * 🔧 智能解析带引号的参数，正确处理引号内的逗号
     * @param {string} dataParams - 数据参数字符串
     * @returns {Array} 解析后的参数数组
     */
    parseQuotedParameters(dataParams) {
        try {
            const parts = [];
            let current = '';
            let inQuotes = false;
            let quoteChar = '';

            for (let i = 0; i < dataParams.length; i++) {
                const char = dataParams[i];

                if ((char === '"' || char === "'") && !inQuotes) {
                    // 开始引号
                    inQuotes = true;
                    quoteChar = char;
                    current += char;
                } else if (char === quoteChar && inQuotes) {
                    // 结束引号
                    inQuotes = false;
                    current += char;
                    quoteChar = '';
                } else if ((char === ',' || char === '，') && !inQuotes) {
                    // 在引号外的逗号，分割参数
                    if (current.trim()) {
                        parts.push(current.trim());
                        current = '';
                    }
                } else {
                    // 普通字符或引号内的逗号
                    current += char;
                }
            }

            // 添加最后一个参数
            if (current.trim()) {
                parts.push(current.trim());
            }

            console.log(`[XMLDataParser] 🔧 智能分割完成，共${parts.length}个参数`);
            return parts;

        } catch (error) {
            console.error('[XMLDataParser] ❌ 智能分割失败，回退到简单分割:', error);

            // 回退到原来的简单分割方法
            if (dataParams.includes('，')) {
                return dataParams.split('，').map(part => part.trim());
            } else if (dataParams.includes(',')) {
                return dataParams.split(',').map(part => part.trim());
            } else {
                return [dataParams];
            }
        }
    }

    /**
     * 解析字段数据
     * @param {string} fieldDataStr - 字段数据字符串
     * @returns {Object} 字段数据对象
     */
    parseFieldData(fieldDataStr) {
        try {
            const result = {};

            // 🔧 修复：使用更智能的解析方法处理复杂的嵌套引号格式
            // 支持格式：fieldName="value", fieldName="complex value with nested quotes"

            console.log(`[XMLDataParser] 🔍 开始解析字段数据: ${fieldDataStr.substring(0, 100)}...`);

            // 使用状态机方式解析，处理嵌套引号
            const fields = this.parseComplexFieldData(fieldDataStr);

            // 处理解析结果
            Object.keys(fields).forEach(fieldName => {
                const fieldValue = fields[fieldName];
                if (fieldName && fieldValue !== undefined) {
                    result[fieldName] = fieldValue;
                    console.log(`[XMLDataParser] 🔍 解析字段: ${fieldName} = "${fieldValue.substring(0, 50)}${fieldValue.length > 50 ? '...' : ''}"`);
                }
            });

            console.log(`[XMLDataParser] ✅ 字段解析完成，共 ${Object.keys(result).length} 个字段`);
            return result;

        } catch (error) {
            console.error('[XMLDataParser] ❌ 解析字段数据失败:', error);
            return {};
        }
    }

    /**
     * 解析复杂字段数据（处理嵌套引号）
     * @param {string} fieldDataStr - 字段数据字符串
     * @returns {Object} 解析结果
     */
    parseComplexFieldData(fieldDataStr) {
        const result = {};

        console.log(`[XMLDataParser] 🔍 开始解析复杂字段数据: ${fieldDataStr.substring(0, 100)}...`);

        // 🔧 使用简单但可靠的状态机方法
        let i = 0;
        const len = fieldDataStr.length;

        while (i < len) {
            // 跳过空白字符和逗号
            while (i < len && (/\s/.test(fieldDataStr[i]) || fieldDataStr[i] === ',')) {
                i++;
            }

            if (i >= len) break;

            // 查找字段名（到等号为止）
            let fieldName = '';
            while (i < len && fieldDataStr[i] !== '=') {
                fieldName += fieldDataStr[i];
                i++;
            }

            fieldName = fieldName.trim();
            if (!fieldName || i >= len) break;

            // 跳过等号
            i++; // 跳过 '='

            // 跳过空白字符
            while (i < len && /\s/.test(fieldDataStr[i])) {
                i++;
            }

            if (i >= len || fieldDataStr[i] !== '"') {
                // 没有引号，跳过这个字段
                continue;
            }

            // 解析字段值（处理复杂嵌套）
            const valueResult = this.parseFieldValue(fieldDataStr, i);
            const fieldValue = valueResult.value;
            i = valueResult.nextIndex;

            // 存储解析结果
            if (fieldName && fieldValue !== undefined) {
                result[fieldName] = fieldValue;
                console.log(`[XMLDataParser] 🔍 解析字段: ${fieldName} = "${fieldValue.substring(0, 50)}${fieldValue.length > 50 ? '...' : ''}"`);
            }
        }

        console.log(`[XMLDataParser] ✅ 字段解析完成，共 ${Object.keys(result).length} 个字段`);
        return result;
    }

    /**
     * 解析字段值（处理复杂嵌套引号）
     * @param {string} str - 完整字符串
     * @param {number} startIndex - 开始位置（应该是引号位置）
     * @returns {Object} {value: string, nextIndex: number}
     */
    parseFieldValue(str, startIndex) {
        let i = startIndex;

        if (str[i] !== '"') {
            return { value: '', nextIndex: i };
        }

        i++; // 跳过开始引号
        let value = '';

        while (i < str.length) {
            const char = str[i];

            if (char === '"') {
                // 检查是否是结束引号
                const nextChar = i + 1 < str.length ? str[i + 1] : '';

                if (nextChar === '"') {
                    // 双引号，这是嵌套内容
                    value += '""';
                    i += 2; // 跳过两个引号
                } else if (nextChar === ',' || nextChar === ' ' || nextChar === '' || i === str.length - 1) {
                    // 这是字段的结束引号
                    i++; // 跳过结束引号
                    break;
                } else {
                    // 这可能是嵌套结构中的引号
                    value += char;
                    i++;
                }
            } else {
                value += char;
                i++;
            }
        }

        return { value: value, nextIndex: i };
    }

    /**
     * 处理嵌套引号
     * @param {string} value - 包含嵌套引号的值
     * @returns {string} 处理后的值
     */
    processNestedQuotes(value) {
        // 将双引号转换为单引号，保持内容的可读性
        return value.replace(/""/g, '"');
    }

    /**
     * 解析剩余字段（正则表达式未匹配的部分）
     * @param {string} remaining - 剩余字符串
     * @returns {Object} 解析结果
     */
    parseRemainingFields(remaining) {
        const result = {};
        // 这里可以添加更复杂的解析逻辑
        // 暂时返回空对象
        return result;
    }

    /**
     * 智能分割字段（考虑引号内的逗号和复杂嵌套）
     * @param {string} str - 要分割的字符串
     * @returns {Array} 分割后的字段数组
     */
    smartSplitFields(str) {
        const fields = [];
        let i = 0;

        while (i < str.length) {
            // 跳过空白字符
            while (i < str.length && /\s/.test(str[i])) {
                i++;
            }

            if (i >= str.length) break;

            // 查找字段名（到等号为止）
            let fieldStart = i;
            while (i < str.length && str[i] !== '=') {
                i++;
            }

            if (i >= str.length) break;

            // 跳过等号
            i++; // 跳过 '='

            // 跳过空白字符
            while (i < str.length && /\s/.test(str[i])) {
                i++;
            }

            if (i >= str.length || str[i] !== '"') {
                // 没有引号，跳过这个字段
                continue;
            }

            // 找到字段值的结束位置
            i++; // 跳过开始引号

            let quoteCount = 1;
            let valueEnd = i;

            while (i < str.length && quoteCount > 0) {
                if (str[i] === '"') {
                    quoteCount--;
                    if (quoteCount === 0) {
                        valueEnd = i + 1;
                        break;
                    }
                }
                i++;
            }

            // 提取完整字段
            const field = str.substring(fieldStart, valueEnd).trim();
            if (field) {
                fields.push(field);
            }

            // 跳过逗号和空白字符
            while (i < str.length && (str[i] === ',' || /\s/.test(str[i]))) {
                i++;
            }
        }

        return fields;
    }

    /**
     * 检查是否是有效的字段格式
     * @param {string} field - 字段字符串
     * @returns {boolean} 是否有效
     */
    isValidField(field) {
        // 检查是否包含等号和引号
        const hasEqual = field.includes('=');
        const hasQuotes = field.includes('"');

        // 如果没有等号，不是有效字段
        if (!hasEqual) return false;

        // 如果有等号但没有引号，也不是有效字段
        if (!hasQuotes) return false;

        // 检查引号是否配对
        const quoteCount = (field.match(/"/g) || []).length;

        // 简单的字段应该有偶数个引号
        if (quoteCount % 2 === 0 && quoteCount >= 2) {
            return true;
        }

        // 复杂字段可能有奇数个引号，需要更复杂的检查
        const equalIndex = field.indexOf('=');
        const afterEqual = field.substring(equalIndex + 1).trim();

        // 如果等号后面以引号开始，认为是有效字段
        return afterEqual.startsWith('"');
    }

    /**
     * 仅保留启用的子项字段
     */
    filterEnabledSubItems(panelId, panelData) {
        try {
            const result = {};

            // 从SillyTavern上下文读取启用字段配置
            const context = window.SillyTavern?.getContext?.();
            const configs = context?.extensionSettings?.['Information bar integration tool'] || {};
            const panelConfig = configs?.[panelId];

            // 若无配置，直接返回原数据（兼容性）
            if (!panelConfig) return panelData;

            // 收集启用字段键列表（基础设置 + 自定义子项）
            const enabledKeys = new Set();

            // 基础设置里的子项：panelConfig[key].enabled === true
            Object.keys(panelConfig).forEach(key => {
                const val = panelConfig[key];
                if (
                    key !== 'enabled' &&
                    key !== 'subItems' &&
                    key !== 'description' &&
                    key !== 'icon' &&
                    key !== 'required' &&
                    key !== 'memoryInject' &&
                    key !== 'prompts' &&
                    typeof val === 'object' &&
                    val?.enabled === true
                ) {
                    enabledKeys.add(key);
                }
            });

            // 面板管理中的自定义子项
            if (Array.isArray(panelConfig.subItems)) {
                panelConfig.subItems.forEach(subItem => {
                    if (subItem && subItem.enabled !== false) {
                        const key = subItem.key || subItem.name?.toLowerCase?.().replace?.(/\s+/g, '_');
                        if (key) enabledKeys.add(key);
                    }
                });
            }

            // 若未收集到启用字段，直接返回原数据（避免误删）
            if (enabledKeys.size === 0) return panelData;

            // 过滤面板数据，仅保留启用子项
            Object.keys(panelData).forEach(field => {
                let shouldInclude = false;

                if (panelId === 'interaction') {
                    // 🔧 特殊处理：交互对象面板的动态NPC字段格式 (npcX.fieldName)
                    const npcFieldMatch = field.match(/^npc\d+\.(.+)$/);
                    if (npcFieldMatch) {
                        // 提取基础字段名并检查是否启用
                        const baseFieldName = npcFieldMatch[1];
                        shouldInclude = enabledKeys.has(baseFieldName);
                        if (shouldInclude) {
                            console.log(`[XMLDataParser] ✅ 交互对象动态字段匹配: ${field} -> ${baseFieldName}`);
                        } else {
                            console.log(`[XMLDataParser] ❌ 交互对象动态字段未启用: ${field} (${baseFieldName})`);
                        }
                    } else {
                        // 非动态格式，直接匹配
                        shouldInclude = enabledKeys.has(field);
                    }
                } else if (panelId === 'organization') {
                    // 🔧 特殊处理：组织架构面板的动态组织字段格式 (orgX.fieldName)
                    const orgFieldMatch = field.match(/^org\d+\.(.+)$/);
                    if (orgFieldMatch) {
                        // 提取基础字段名并检查是否启用
                        const baseFieldName = orgFieldMatch[1];
                        shouldInclude = enabledKeys.has(baseFieldName);
                        if (shouldInclude) {
                            console.log(`[XMLDataParser] ✅ 组织架构动态字段匹配: ${field} -> ${baseFieldName}`);
                        } else {
                            console.log(`[XMLDataParser] ❌ 组织架构动态字段未启用: ${field} (${baseFieldName})`);
                        }
                    } else {
                        // 非动态格式，直接匹配
                        shouldInclude = enabledKeys.has(field);
                    }
                } else {
                    // 其他面板使用直接匹配
                    shouldInclude = enabledKeys.has(field);
                }

                if (shouldInclude) {
                    result[field] = panelData[field];
                }
            });

            return result;
        } catch (e) {
            console.warn('[XMLDataParser] 启用字段过滤失败，回退为原数据:', e?.message);
            return panelData;
        }
    }

    /**
     * 验证和清理数据
     * @param {Object} data - 原始数据
     * @returns {Object} 验证后的数据
     */
    validateAndCleanData(data) {
        try {
            const cleanedData = {};

            Object.keys(data).forEach(panelName => {
                const panelData = data[panelName];

                // 🔧 新架构：直接使用中文面板名作为键名
                const panelKey = panelName;

                // 验证面板数据
                if (this.isValidPanelData(panelName, panelData)) {
                    // 依据启用配置过滤子项，只保留启用字段
                    const filtered = this.filterEnabledSubItems(panelKey, panelData);
                    if (Object.keys(filtered).length > 0) {
                        // 🔧 组织架构面板特殊处理：智能分解合并格式
                        if (panelKey === '组织架构') {
                            cleanedData[panelKey] = this.smartSplitOrganizationData(filtered);
                        } else {
                            cleanedData[panelKey] = this.cleanPanelData(filtered);
                        }
                    } else {
                        console.log('[XMLDataParser] ℹ️ 过滤后无启用字段，跳过面板:', panelKey);
                    }
                } else {
                    console.warn('[XMLDataParser] ⚠️ 面板数据验证失败:', panelName);
                }
            });

            console.log('[XMLDataParser] 🧹 数据验证和清理完成，保留', Object.keys(cleanedData).length, '个有效面板');
            return cleanedData;

        } catch (error) {
            console.error('[XMLDataParser] ❌ 验证和清理数据失败:', error);
            return data; // 返回原始数据作为降级处理
        }
    }

    /**
     * 验证面板数据是否有效
     * @param {string} panelName - 面板名称
     * @param {Object} panelData - 面板数据
     * @returns {boolean} 是否有效
     */
    isValidPanelData(panelName, panelData) {
        try {
            // 检查面板名称
            if (!panelName || typeof panelName !== 'string') {
                return false;
            }

            // 检查面板数据
            if (!panelData || typeof panelData !== 'object') {
                return false;
            }

            // 检查是否有字段
            if (Object.keys(panelData).length === 0) {
                return false;
            }

            // 🚨 修复：严格验证面板是否在支持列表中，拒绝未知面板
            if (!this.isValidPanelName(panelName)) {
                console.error(`[XMLDataParser] 🚨 拒绝不支持的面板类型: ${panelName}`);
                console.error(`[XMLDataParser] 📋 支持的面板列表: ${Array.from(this.supportedPanels).join(', ')}`);
                return false;
            }

            console.log(`[XMLDataParser] ✅ 面板类型验证通过: ${panelName}`);
            return true;

        } catch (error) {
            console.error('[XMLDataParser] ❌ 验证面板数据失败:', error);
            return false;
        }
    }

    /**
     * 🚨 验证面板名称是否有效（严格模式）
     * @param {string} panelName - 面板名称
     * @returns {boolean} 是否为有效的面板名称
     */
    isValidPanelName(panelName) {
        if (!panelName || typeof panelName !== 'string') {
            return false;
        }

        // 🔧 新架构：直接检查中文面板名是否在支持列表中
        const isSupported = this.supportedPanels.has(panelName);

        if (!isSupported) {
            console.error(`[XMLDataParser] 🚨 面板名称验证失败: "${panelName}"`);
            console.error(`[XMLDataParser] 📋 当前支持的面板: ${Array.from(this.supportedPanels).join(', ')}`);
            return false;
        }

        return true;
    }

    /**
     * 🚨 验证面板字段是否有效（严格模式）
     * @param {string} panelName - 面板名称
     * @param {Object} fieldData - 字段数据
     * @returns {boolean} 是否所有字段都有效
     */
    validatePanelFields(panelName, fieldData) {
        try {
            if (!fieldData || typeof fieldData !== 'object') {
                return true; // 空数据认为是有效的
            }

            // 获取面板的启用字段配置
            const enabledFields = this.getEnabledFieldsForPanel(panelName);
            if (!enabledFields || enabledFields.length === 0) {
                console.warn(`[XMLDataParser] ⚠️ 无法获取面板 "${panelName}" 的字段配置，跳过字段验证`);
                return true; // 如果无法获取配置，暂时允许通过
            }

            // 检查每个字段是否在允许列表中
            const fieldKeys = Object.keys(fieldData);
            const invalidFields = [];

            for (const fieldKey of fieldKeys) {
                // 字段key应该是数字（列号）
                const columnIndex = parseInt(fieldKey);
                if (isNaN(columnIndex) || columnIndex < 1 || columnIndex > enabledFields.length) {
                    invalidFields.push(`列号${fieldKey}(超出范围1-${enabledFields.length})`);
                }
            }

            if (invalidFields.length > 0) {
                console.error(`[XMLDataParser] 🚨 面板 "${panelName}" 包含无效字段: ${invalidFields.join(', ')}`);
                console.error(`[XMLDataParser] 📋 允许的列号范围: 1-${enabledFields.length}`);
                console.error(`[XMLDataParser] 📋 启用的字段: ${enabledFields.map((f, i) => `${i+1}.${f.key}`).join(', ')}`);
                return false;
            }

            return true;

        } catch (error) {
            console.error(`[XMLDataParser] ❌ 验证面板字段失败: ${panelName}`, error);
            return false; // 验证失败时拒绝
        }
    }

    /**
     * 🚨 获取面板的启用字段列表 - 修复：与SmartPromptSystem保持一致
     * @param {string} panelName - 面板名称
     * @returns {Array} 启用的字段列表
     */
    getEnabledFieldsForPanel(panelName) {
        try {
            // 获取SillyTavern上下文和扩展设置
            const context = window.SillyTavern?.getContext?.();
            if (!context) {
                console.warn(`[XMLDataParser] ⚠️ 无法获取SillyTavern上下文`);
                return null;
            }

            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings?.['Information bar integration tool'] || {};

            // 🔧 新架构：直接从customPanels获取面板配置
            const customPanels = configs.customPanels || {};
            const panelConfig = customPanels[panelName];
            
            if (!panelConfig) {
                console.warn(`[XMLDataParser] ⚠️ 无法获取面板 "${panelName}" 的配置`);
                return null;
            }

            // 🔧 修复：同时处理基础设置复选框和面板管理自定义子项（与SmartPromptSystem.getEnabledPanels保持一致）
            const allSubItems = [];

            // 1. 处理基础设置中的复选框配置（panel[key].enabled格式）
            const subItemKeys = Object.keys(panelConfig).filter(key =>
                key !== 'enabled' &&
                key !== 'subItems' &&     // 排除自定义子项数组
                key !== 'description' &&  // 排除面板属性
                key !== 'icon' &&
                key !== 'required' &&
                key !== 'memoryInject' &&
                key !== 'prompts' &&
                !key.startsWith('custom_field_') && // 🔧 修复：排除custom_field字段，这些字段应该只通过subItems管理
                typeof panelConfig[key] === 'object' &&
                panelConfig[key].enabled !== undefined
            );
            const enabledSubItems = subItemKeys.filter(key => panelConfig[key].enabled === true);

            // 添加基础设置的子项
            enabledSubItems.forEach(key => {
                allSubItems.push({
                    key: key,
                    name: panelConfig[key].name || key,
                    enabled: true,
                    value: panelConfig[key].value || '',
                    source: 'basicSettings' // 标记来源
                });
            });

            // 2. 处理面板管理中的自定义子项（panel.subItems数组格式）
            let enabledCustomSubItems = [];
            if (panelConfig.subItems && Array.isArray(panelConfig.subItems)) {
                enabledCustomSubItems = panelConfig.subItems.filter(subItem => subItem.enabled === true);

                // 🔧 修复：创建键名集合，避免重复添加
                const existingKeys = new Set(allSubItems.map(item => item.key));

                enabledCustomSubItems.forEach(subItem => {
                    const key = subItem.key || subItem.name.toLowerCase().replace(/\s+/g, '_');

                    // 🔧 修复：检查是否已存在，避免重复
                    if (!existingKeys.has(key)) {
                        allSubItems.push({
                            key: key,
                            name: subItem.displayName || subItem.name,
                            enabled: true,
                            value: subItem.value || '',
                            source: 'panelManagement' // 标记来源
                        });
                        existingKeys.add(key);
                    } else {
                        console.log(`[XMLDataParser] ⚠️ 跳过重复的自定义子项: ${key} (基础面板 ${englishPanelId} 已存在该键)`);
                    }
                });
            }

            console.log(`[XMLDataParser] 📊 面板 "${englishPanelId}" 启用字段统计: 基础设置=${enabledSubItems.length}, 自定义子项=${enabledCustomSubItems.length}, 总计=${allSubItems.length}`);

            return allSubItems;

        } catch (error) {
            console.error(`[XMLDataParser] ❌ 获取面板字段配置失败: ${panelName}`, error);
            return null;
        }
    }

    /**
     * 智能分解组织数据 - 检测并拆分合并格式
     * @param {Object} panelData - 组织面板数据
     * @returns {Object} 分解后的数据
     */
    smartSplitOrganizationData(panelData) {
        try {
            console.log('[XMLDataParser] 🔍 开始智能分解组织数据:', panelData);

            // 检查是否已经是org前缀格式
            const hasOrgPrefix = Object.keys(panelData).some(key => key.match(/^org\d+\./));
            if (hasOrgPrefix) {
                console.log('[XMLDataParser] ✅ 数据已是org前缀格式，直接清理');
                return this.cleanPanelData(panelData);
            }

            // 检测合并格式字段
            const fieldArrays = {};
            let maxOrgCount = 0;

            // 分析每个字段，检测逗号分隔的多个值
            Object.keys(panelData).forEach(fieldName => {
                const fieldValue = String(panelData[fieldName]).trim();
                
                if (fieldValue.includes(',')) {
                    // 分割并清理值
                    const values = fieldValue.split(',').map(v => v.trim()).filter(v => v && v !== '未知' && v !== '暂无');
                    
                    if (values.length > 1) {
                        fieldArrays[fieldName] = values;
                        maxOrgCount = Math.max(maxOrgCount, values.length);
                        console.log(`[XMLDataParser] 🔍 检测到合并字段 ${fieldName}: ${values.length} 个值`);
                    } else {
                        fieldArrays[fieldName] = [fieldValue];
                    }
                } else {
                    fieldArrays[fieldName] = [fieldValue];
                }
            });

            // 如果没有检测到多个组织，直接返回清理的数据
            if (maxOrgCount <= 1) {
                console.log('[XMLDataParser] ℹ️ 未检测到多组织格式，返回单组织数据');
                return this.cleanPanelData(panelData);
            }

            console.log(`[XMLDataParser] 🎯 检测到 ${maxOrgCount} 个组织，开始分解`);

            // 生成分解后的org前缀格式数据
            const splitData = {};

            for (let orgIndex = 0; orgIndex < maxOrgCount; orgIndex++) {
                Object.keys(fieldArrays).forEach(fieldName => {
                    const values = fieldArrays[fieldName];
                    const value = values[orgIndex] || values[0] || '未知'; // 使用对应值或第一个值或默认值
                    
                    const orgFieldName = `org${orgIndex}.${fieldName}`;
                    splitData[orgFieldName] = value;
                    
                    console.log(`[XMLDataParser] 📝 生成字段: ${orgFieldName} = "${value}"`);
                });
            }

            console.log(`[XMLDataParser] ✅ 组织数据分解完成，生成 ${Object.keys(splitData).length} 个字段`);
            return splitData;

        } catch (error) {
            console.error('[XMLDataParser] ❌ 智能分解组织数据失败:', error);
            return this.cleanPanelData(panelData);
        }
    }

    /**
     * 清理面板数据
     * @param {Object} panelData - 面板数据
     * @returns {Object} 清理后的数据
     */
    cleanPanelData(panelData) {
        try {
            const cleaned = {};

            Object.keys(panelData).forEach(fieldName => {
                const fieldValue = panelData[fieldName];

                // 清理字段名和值
                const cleanedFieldName = String(fieldName).trim();
                const cleanedFieldValue = typeof fieldValue === 'string' ? fieldValue.trim() : fieldValue;

                if (cleanedFieldName && cleanedFieldValue !== '') {
                    cleaned[cleanedFieldName] = cleanedFieldValue;
                }
            });

            return cleaned;

        } catch (error) {
            console.error('[XMLDataParser] ❌ 清理面板数据失败:', error);
            return panelData;
        }
    }

    /**
     * 获取解析统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            ...this.parseStats,
            successRate: this.parseStats.totalParsed > 0 ?
                (this.parseStats.successfulParsed / this.parseStats.totalParsed * 100).toFixed(2) + '%' : '0%'
        };
    }

    /**
     * 重置解析统计
     */
    resetStats() {
        this.parseStats = {
            totalParsed: 0,
            successfulParsed: 0,
            errors: 0,
            lastParseTime: 0
        };
        console.log('[XMLDataParser] 📊 解析统计已重置');
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error(`[XMLDataParser] ❌ 错误 #${this.errorCount}:`, error);

        // 触发错误事件
        if (this.eventSystem) {
            this.eventSystem.emit('xml:parser:error', {
                error: error.message,
                count: this.errorCount,
                timestamp: Date.now()
            });
        }
    }

    /**
     * 生成缓存键
     * @param {string} messageContent - 消息内容
     * @param {string} messageId - 消息ID
     * @returns {string} 缓存键
     */
    generateCacheKey(messageContent, messageId) {
        // 使用消息ID和内容哈希作为缓存键
        const contentHash = this.simpleHash(messageContent);
        return `${messageId}_${contentHash}`;
    }

    /**
     * 简单哈希函数
     * @param {string} str - 字符串
     * @returns {string} 哈希值
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * 缓存解析结果
     * @param {string} cacheKey - 缓存键
     * @param {Object} data - 解析结果
     */
    cacheParseResult(cacheKey, data) {
        // 检查缓存大小，如果超过限制则清理旧缓存
        if (this.parsedMessageCache.size >= this.maxCacheSize) {
            const firstKey = this.parsedMessageCache.keys().next().value;
            this.parsedMessageCache.delete(firstKey);
        }

        this.parsedMessageCache.set(cacheKey, data);
        console.log('[XMLDataParser] 💾 缓存解析结果:', cacheKey);
    }

    /**
     * 清理缓存
     */
    clearCache() {
        this.parsedMessageCache.clear();
        console.log('[XMLDataParser] 🗑️ 缓存已清理');
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            initialized: this.initialized,
            errorCount: this.errorCount,
            stats: this.getStats(),
            supportedPanelsCount: this.supportedPanels.size,
            cacheSize: this.parsedMessageCache.size
        };
    }

    /**
     * 🔧 新增：检测并修复交互面板的NPC信息混合问题
     * @param {Object} data - 解析后的数据
     * @returns {Object} 修复后的数据
     */
    fixNpcDataMixing(data) {
        try {
            if (!data || typeof data !== 'object') {
                return data;
            }

            console.log('[XMLDataParser] 🔍 开始检测NPC信息混合问题...');

            const fixedData = { ...data };
            let hasFixed = false;

            // 检查交互面板
            if (fixedData.interaction && typeof fixedData.interaction === 'object') {
                console.log('[XMLDataParser] 🎭 检测交互面板NPC数据混合...');

                const originalInteraction = fixedData.interaction;
                const fixedInteraction = this.fixInteractionNpcMixing(originalInteraction);

                if (fixedInteraction !== originalInteraction) {
                    fixedData.interaction = fixedInteraction;
                    hasFixed = true;
                    console.log('[XMLDataParser] ✅ 修复了交互面板的NPC信息混合问题');
                }
            }

            if (hasFixed) {
                console.log('[XMLDataParser] 🔧 NPC信息混合修复完成');
            } else {
                console.log('[XMLDataParser] ✅ 未发现NPC信息混合问题');
            }

            return fixedData;

        } catch (error) {
            console.error('[XMLDataParser] ❌ 修复NPC信息混合失败:', error);
            return data; // 返回原始数据
        }
    }

    /**
     * 🔧 修复交互面板的NPC信息混合
     * @param {Object} interactionData - 交互面板数据
     * @returns {Object} 修复后的交互面板数据
     */
    fixInteractionNpcMixing(interactionData) {
        try {
            console.log('[XMLDataParser] 🔍 分析交互面板字段:', Object.keys(interactionData));

                // 预规范化：将未带 npc 前缀的字段统一归一到 npc0.<field>
                try {
                    const normalized = {};
                    const keys = Object.keys(interactionData || {});
                    // 是否存在任何已带前缀的键，用作参考（不直接决定逻辑，仅用于调试）
                    const hasPrefixed = keys.some(k => /^npc\d+\./.test(k));
                    if (hasPrefixed) {
                        console.log('[XMLDataParser] 🧭 已检测到带前缀字段，进行规范化合并');
                    } else {
                        console.log('[XMLDataParser] 🧭 未检测到带前缀字段，将非前缀字段归到 npc0');
                    }

                    for (const [k, v] of Object.entries(interactionData)) {
                        if (/^npc\d+\./.test(k)) {
                            // 已是标准格式，直接保留
                            normalized[k] = v;
                            continue;
                        }
                        const baseKey = String(k).trim();
                        // 如果已存在 npcX.baseKey 的键，优先保留显式带前缀的数据，避免覆盖
                        const existsPrefixed = keys.some(x => new RegExp(`^npc\\d+\\.${baseKey}$`).test(x));
                        if (!existsPrefixed) {
                            normalized[`npc0.${baseKey}`] = v;
                            console.log(`[XMLDataParser] 🔧 规范化交互字段: ${k} -> npc0.${baseKey}`);
                        } else {
                            console.log(`[XMLDataParser] ↪ 跳过非前缀字段(已有前缀版本): ${k}`);
                        }
                    }

                    // 若规范化后有内容，则用其继续后续分析
                    if (Object.keys(normalized).length > 0) {
                        interactionData = normalized;
                    }
                } catch (e) {
                    console.warn('[XMLDataParser] ⚠️ 交互字段规范化失败（降级继续）:', e);
                }


            // 第一步：检测所有字段中的混合信息，确定NPC数量
            const fieldAnalysis = {};
            let maxNpcCount = 1;

            Object.entries(interactionData).forEach(([key, value]) => {
                if (!value || typeof value !== 'string') {
                    fieldAnalysis[key] = { hasMixed: false, values: [value] };
                    return;
                }

                // 🔧 修复：只检测name相关字段中的多NPC情况
                const isNameField = this.isNameField(key);
                const hasMixedInfo = isNameField ? this.detectMixedNpcInfo(value) : false;

                if (hasMixedInfo) {
                    const separatedValues = this.separateNpcInfo(value);
                    fieldAnalysis[key] = { hasMixed: true, values: separatedValues };
                    maxNpcCount = Math.max(maxNpcCount, separatedValues.length);
                    console.log(`[XMLDataParser] 🚨 检测到混合NPC名称: ${key} = "${value}" -> ${separatedValues.length}个NPC`);
                } else {
                    fieldAnalysis[key] = { hasMixed: false, values: [value] };
                    if (isNameField) {
                        console.log(`[XMLDataParser] ✅ 单一NPC名称: ${key} = "${value}"`);
                    }
                }
            });

            console.log(`[XMLDataParser] 📊 检测到最大NPC数量: ${maxNpcCount}`);

            // 第二步：重新组织数据，确保每个NPC有完整的字段组
            const fixedData = {};

            // 如果没有检测到混合信息，保持原样
            if (maxNpcCount === 1) {
                console.log('[XMLDataParser] ✅ 未检测到NPC信息混合，保持原样');
                return interactionData;
            }

            // 为每个NPC创建完整的字段组
            for (let npcIndex = 0; npcIndex < maxNpcCount; npcIndex++) {
                Object.entries(fieldAnalysis).forEach(([fieldKey, analysis]) => {
                    const cleanFieldKey = fieldKey.replace(/^npc\d+\./, '');
                    const npcKey = `npc${npcIndex}.${cleanFieldKey}`;

                    if (analysis.hasMixed && analysis.values[npcIndex]) {
                        // 使用分离后的值
                        fixedData[npcKey] = analysis.values[npcIndex].trim();
                        console.log(`[XMLDataParser] ✅ 分离NPC信息: ${npcKey} = "${analysis.values[npcIndex].trim()}"`);
                    } else if (!analysis.hasMixed && npcIndex === 0) {
                        // 对于没有混合的字段，只给第一个NPC赋值
                        fixedData[npcKey] = analysis.values[0];
                        console.log(`[XMLDataParser] ✅ 保持原有信息: ${npcKey} = "${analysis.values[0]}"`);
                    }
                    // 其他情况不创建字段（避免空值）
                });
            }

            return fixedData;

        } catch (error) {
            console.error('[XMLDataParser] ❌ 修复交互面板NPC混合失败:', error);
            return interactionData;
        }
    }

    /**
     * 🔧 判断字段是否为名称字段
     * @param {string} fieldKey - 字段键名
     * @returns {boolean} 是否为名称字段
     */
    isNameField(fieldKey) {
        // 移除npc前缀后检查字段名
        const cleanFieldKey = fieldKey.replace(/^npc\d+\./, '');
        const nameFields = [
            'name', '姓名', 'npc_name', 'npcName',
            '名字', '名称', '角色名', '角色名称',
            'character_name', 'characterName',
            'person_name', 'personName'
        ];
        return nameFields.includes(cleanFieldKey.toLowerCase()) || nameFields.includes(cleanFieldKey);
    }

    /**
     * 🔍 检测是否包含混合的NPC信息
     * @param {string} value - 字段值
     * @returns {boolean} 是否包含混合信息
     */
    detectMixedNpcInfo(value) {
        if (!value || typeof value !== 'string') {
            return false;
        }

        // 检测常见的分隔符模式
        const mixingPatterns = [
            /,\s*[^,\s]/,           // 逗号分隔: "A, B, C"
            /\/[^\/\s]/,            // 斜杠分隔: "A/B/C"
            /、[^、\s]/,            // 中文顿号分隔: "A、B、C"
            /；[^；\s]/,            // 中文分号分隔: "A；B；C"
            /\s+和\s+/,             // "和"连接: "A 和 B"
            /\s+与\s+/,             // "与"连接: "A 与 B"
            /\s+以及\s+/,           // "以及"连接: "A 以及 B"
        ];

        return mixingPatterns.some(pattern => pattern.test(value));
    }

    /**
     * 🔧 分离混合的NPC信息
     * @param {string} value - 包含混合信息的值
     * @returns {Array} 分离后的值数组
     */
    separateNpcInfo(value) {
        if (!value || typeof value !== 'string') {
            return [value];
        }

        // 尝试不同的分隔符
        let separated = [];

        // 优先使用逗号分隔
        if (value.includes(',')) {
            separated = value.split(',').map(v => v.trim()).filter(v => v);
        }
        // 其次使用斜杠分隔
        else if (value.includes('/')) {
            separated = value.split('/').map(v => v.trim()).filter(v => v);
        }
        // 中文顿号分隔
        else if (value.includes('、')) {
            separated = value.split('、').map(v => v.trim()).filter(v => v);
        }
        // 中文分号分隔
        else if (value.includes('；')) {
            separated = value.split('；').map(v => v.trim()).filter(v => v);
        }
        // "和"连接
        else if (value.includes(' 和 ')) {
            separated = value.split(' 和 ').map(v => v.trim()).filter(v => v);
        }
        // "与"连接
        else if (value.includes(' 与 ')) {
            separated = value.split(' 与 ').map(v => v.trim()).filter(v => v);
        }
        // "以及"连接
        else if (value.includes(' 以及 ')) {
            separated = value.split(' 以及 ').map(v => v.trim()).filter(v => v);
        }
        else {
            // 没有找到分隔符，返回原值
            separated = [value];
        }

        // 过滤掉空值和过短的值
        return separated.filter(v => v && v.length > 0);
    }

    /**
     * 🚀 解析简化格式（宽松模式，参考Amily2项目）
     * 支持格式：
     * 【面板名】
     * 字段1: 值1
     * 字段2: 值2
     * @param {string} content - 内容
     * @returns {Object|null} 解析结果
     */
    parseSimpleFormat(content) {
        try {
            console.log('[XMLDataParser] 🔍 尝试简化格式解析...');

            const result = {};
            const lines = content.split('\n');
            let currentPanel = null;
            let currentPanelData = {};

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;

                // 检测面板标题：【面板名】或 [面板名]
                const panelMatch = trimmedLine.match(/^[【\[]([^】\]]+)[】\]]/);
                if (panelMatch) {
                    // 保存上一个面板的数据
                    if (currentPanel && Object.keys(currentPanelData).length > 0) {
                        result[currentPanel] = currentPanelData;
                        console.log(`[XMLDataParser] ✅ 解析面板: ${currentPanel}, 包含 ${Object.keys(currentPanelData).length} 个字段`);
                    }

                    // 开始新面板
                    currentPanel = panelMatch[1].trim();
                    currentPanelData = {};
                    console.log(`[XMLDataParser] 📝 检测到面板: ${currentPanel}`);
                    continue;
                }

                // 检测字段：字段名: 值 或 字段名：值
                const fieldMatch = trimmedLine.match(/^([^:：]+)[:：]\s*(.+)$/);
                if (fieldMatch && currentPanel) {
                    const fieldName = fieldMatch[1].trim();
                    const fieldValue = fieldMatch[2].trim();

                    // 将字段名映射到英文（如果需要）
                    const mappedFieldName = this.mapChineseFieldToEnglish(fieldName);
                    currentPanelData[mappedFieldName] = fieldValue;
                    console.log(`[XMLDataParser] 📝 解析字段: ${fieldName} (${mappedFieldName}) = ${fieldValue}`);
                }
            }

            // 保存最后一个面板的数据
            if (currentPanel && Object.keys(currentPanelData).length > 0) {
                result[currentPanel] = currentPanelData;
                console.log(`[XMLDataParser] ✅ 解析面板: ${currentPanel}, 包含 ${Object.keys(currentPanelData).length} 个字段`);
            }

            if (Object.keys(result).length > 0) {
                console.log(`[XMLDataParser] ✅ 简化格式解析成功，共解析 ${Object.keys(result).length} 个面板`);
                return result;
            }

            console.log('[XMLDataParser] ℹ️ 简化格式解析未找到有效数据');
            return null;

        } catch (error) {
            console.error('[XMLDataParser] ❌ 简化格式解析失败:', error);
            return null;
        }
    }

    /**
     * 🚀 将中文字段名映射到英文
     * @param {string} chineseField - 中文字段名
     * @returns {string} 英文字段名
     */
    mapChineseFieldToEnglish(chineseField) {
        const mapping = {
            '姓名': 'name',
            '名字': 'name',
            '年龄': 'age',
            '性别': 'gender',
            '职业': 'occupation',
            '身份': 'identity',
            '地点': 'location',
            '位置': 'location',
            '时间': 'time',
            '状态': 'status',
            '心情': 'mood',
            '关系': 'relationship',
            '描述': 'description',
            '备注': 'notes'
        };

        return mapping[chineseField] || chineseField;
    }
}
