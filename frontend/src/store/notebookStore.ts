import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { sessionApi, sourceApi, streamChatCompletion } from '@/api';
import type { ChatMessage, NotebookSession } from '@/api';

// --- 类型定义 ---
export interface LocalSource {
    id: string;
    name: string;
    type: 'pdf' | 'website' | 'text';
    status: 'parsing' | 'ready' | 'error';
    content: string;
    isSelected: boolean;
    errorMessage?: string;
    wordCount?: number;
}

export interface LocalChatMessage {
    role: 'user' | 'ai' | 'system';
    content: string;
    timestamp: number;
    isStreaming?: boolean;
}

export interface MindMapNode {
    id: string;
    label: string;
    children?: MindMapNode[];
    collapsed?: boolean;
}

export interface NoteCard {
    id: string;
    title: string;
    type: 'summary' | 'mindmap';
    status: 'generating' | 'done';
    content: string | MindMapNode;
    createdAt?: string;  // 添加创建时间字段
    meta?: {
        isPlaying?: boolean;
    };
}

// 本地会话接口（兼容前端）
export interface LocalNotebookSession {
    id: string;
    title: string;
    timestamp: number;
    sources: LocalSource[];
    chatHistory: LocalChatMessage[];
    notes: NoteCard[];
    preview: string;
}


export const useNotebookStore = defineStore('notebook', () => {

    // --- State ---
    const sources = ref<LocalSource[]>([]);
    const chatHistory = ref<LocalChatMessage[]>([]);

    // 上传进度状态
    const uploadProgress = ref<{
        isUploading: boolean;
        step: number;
        message: string;
    }>({ isUploading: false, step: 0, message: '' });
    const notes = ref<NoteCard[]>([]);

    // 会话相关（现在从后端获取）
    const sessions = ref<NotebookSession[]>([]);
    const currentSessionId = ref<number | null>(null);

    // 控制器引用
    let chatAbortController: AbortController | null = null;
    let artifactAbortController: AbortController | null = null;

    // --- Computed ---
    const activeSourceNames = computed(() => {
        const selected = sources.value.filter(s => s.isSelected && s.status === 'ready');
        if (selected.length === 0) return '';
        return selected.map(s => s.name).join('、');
    });

    const isGenerating = computed(() => {
        return chatHistory.value.some(m => m.isStreaming) || notes.value.some(n => n.status === 'generating');
    });

    // --- Actions ---

    /**
     * 加载所有会话（从后端）
     */
    const loadSessions = async () => {
        try {
            sessions.value = await sessionApi.getAll();
        } catch (error: any) {
            console.error('Failed to load sessions:', error);
        }
    };

    /**
     * 加载指定会话
     */
    const loadSession = async (sessionId: number) => {
        try {
            const session = await sessionApi.getById(sessionId);

            // 转换为本地格式
            currentSessionId.value = session.id;
            sources.value = (session.sources || []).map(s => ({
                id: s.id.toString(),
                name: s.name,
                type: s.type as 'pdf' | 'website' | 'text',
                status: s.status as 'parsing' | 'ready' | 'error',
                content: s.content || '',
                isSelected: true,
                wordCount: (s.metadata as any)?.wordCount || s.content?.length || 0
            }));

            // 加载 notes
            notes.value = ((session as any).notes || []).map((n: any) => ({
                id: n.id.toString(),
                title: n.title,
                type: n.type as 'summary' | 'mindmap',
                status: n.status as 'generating' | 'done',
                content: n.content,
                createdAt: n.createdAt  // 保留后端返回的时间
            }));

            // TODO: 从后端加载 chatHistory 和 notes
            // 目前这些存在 localStorage，后续需要迁移到数据库
            chatHistory.value = [];

        } catch (error: any) {
            console.error('Failed to load session:', error);
        }
    };

    /**
     * 添加来源（PDF 或网页）
     */
    const addSource = async (input: File | string, type: 'website' | 'pdf') => {
        try {
            let session: NotebookSession;

            if (type === 'pdf' && input instanceof File) {
                // 上传 PDF（使用新的MinIO预签名URL流程，带进度显示）
                uploadProgress.value.isUploading = true;

                session = await sourceApi.uploadPdf(input, (step, message) => {
                    uploadProgress.value.step = step;
                    uploadProgress.value.message = message;
                    console.log(`📤 Upload progress [${step}/4]: ${message}`);
                });

                uploadProgress.value.isUploading = false;
            } else if (type === 'website' && typeof input === 'string') {
                // 从 URL 创建会话（后端自动抓取 + RAG）
                session = await sessionApi.createFromUrl(input);
            } else {
                throw new Error('无效的输入类型');
            }

            // 加载新创建的会话
            await loadSession(session.id);

            // 更新会话列表
            await loadSessions();

        } catch (error: any) {
            console.error('Add source error:', error);
            uploadProgress.value.isUploading = false;

            // 创建错误提示的 source
            const id = Date.now().toString();
            sources.value.push({
                id,
                name: typeof input === 'string' ? input : input.name,
                type,
                status: 'error',
                content: '',
                isSelected: false,
                errorMessage: error.message || '添加失败'
            });
        }
    };

    /**
     * 删除来源
     */
    const removeSource = async (id: string) => {
        const source = sources.value.find(s => s.id === id);
        if (!source) return;

        try {
            // 调用后端 API 删除（包含向量数据）
            await sourceApi.delete(parseInt(id));

            // 从本地移除
            const index = sources.value.findIndex(s => s.id === id);
            sources.value.splice(index, 1);

            // 如果没有其他来源，清空对话和笔记
            if (sources.value.length === 0) {
                chatHistory.value = [];
                notes.value = [];
            }
        } catch (error: any) {
            console.error('Remove source error:', error);
        }
    };

    const toggleSourceSelection = (id: string) => {
        const s = sources.value.find(s => s.id === id);
        if (s) s.isSelected = !s.isSelected;
    };

    /**
     * 停止生成
     */
    const stopGeneration = () => {
        if (chatAbortController) {
            chatAbortController.abort();
            chatAbortController = null;
        }
        const lastMsg = chatHistory.value[chatHistory.value.length - 1];
        if (lastMsg && lastMsg.role === 'ai' && lastMsg.isStreaming) {
            lastMsg.isStreaming = false;
        }
    };

    /**
     * 发送消息（使用后端 RAG）
     */
    const sendMessage = async (text: string) => {
        stopGeneration();

        chatHistory.value.push({ role: 'user', content: text, timestamp: Date.now() });
        const aiMsgIndex = chatHistory.value.push({
            role: 'ai', content: '', timestamp: Date.now(), isStreaming: true
        }) - 1;

        // 转换为 API 格式
        const apiMessages: ChatMessage[] = chatHistory.value
            .slice(-6)
            .filter(m => !m.isStreaming)
            .map(m => ({
                role: m.role === 'ai' ? 'assistant' : m.role as 'user' | 'assistant' | 'system',
                content: m.content
            }));

        apiMessages.push({ role: 'user', content: text });

        chatAbortController = new AbortController();

        // 收集完整响应
        let fullResponse = '';

        try {
            // 流式接收，收集所有内容
            await streamChatCompletion(
                currentSessionId.value,
                apiMessages,
                (chunk: string) => {
                    fullResponse += chunk;
                },
                { signal: chatAbortController.signal }
            );

            // 收集完成后，逐字符显示（模拟打字机效果）
            if (chatHistory.value[aiMsgIndex]) {
                const displaySpeed = 30; // 每个字符延迟（ms）
                let currentIndex = 0;

                const typewriter = () => {
                    if (currentIndex < fullResponse.length && chatHistory.value[aiMsgIndex]) {
                        // 每次显示1-3个字符（加速效果）
                        const chunkSize = Math.min(3, fullResponse.length - currentIndex);
                        chatHistory.value[aiMsgIndex].content += fullResponse.substring(currentIndex, currentIndex + chunkSize);
                        currentIndex += chunkSize;

                        setTimeout(typewriter, displaySpeed);
                    } else {
                        // 完成后切换到Markdown渲染
                        if (chatHistory.value[aiMsgIndex]) {
                            chatHistory.value[aiMsgIndex].isStreaming = false;
                        }
                    }
                };

                typewriter();
            }
        } catch (error: any) {
            console.error('Send message error:', error);
            if (chatHistory.value[aiMsgIndex]) {
                chatHistory.value[aiMsgIndex].content += `\n\n[错误: ${error.message}]`;
            }
        } finally {
            // typewriter 函数会在完成后设置 isStreaming = false
            chatAbortController = null;
        }
    };

    /**
     * 生成制品（Summary/MindMap）
     * 注意：这个功能暂时保持前端直接调用 AI（不使用 RAG）
     */
    const generateArtifact = async (type: 'summary' | 'mindmap') => {
        const activeCount = sources.value.filter(s => s.isSelected && s.status === 'ready').length;

        if (activeCount === 0) {
            // 无来源提示
            const newNote: NoteCard = {
                id: Date.now().toString(),
                title: type === 'mindmap' ? '思维导图' : '重点简报',
                type,
                status: 'done',
                content: type === 'mindmap'
                    ? {
                        id: 'root', label: '⚠️ 请先选择至少一个来源', children: [
                            { id: 'tip1', label: '在左侧面板添加 PDF 或网页' },
                            { id: 'tip2', label: '勾选要使用的来源' },
                            { id: 'tip3', label: '然后再生成思维导图' }
                        ]
                    }
                    : '## ⚠️ 无法生成简报\n\n请先选择知识来源'
            };
            notes.value.unshift(newNote);
            return;
        }

        const id = Date.now().toString();
        const title = type === 'mindmap' ? '核心知识图谱' : '重点简报';

        const newNote: NoteCard = {
            id,
            title,
            type,
            status: 'generating',
            content: type === 'mindmap' ? { id: 'root', label: '生成中...', children: [] } : '',
            createdAt: new Date().toISOString()  // 添加创建时间
        };

        notes.value.unshift(newNote);
        const noteRef = notes.value[0];

        if (artifactAbortController) artifactAbortController.abort();
        artifactAbortController = new AbortController();

        const context = sources.value
            .filter(s => s.isSelected && s.status === 'ready')
            .map(s => `--- ${s.name} ---\n${s.content}`)
            .join('\n\n')
            .slice(0, 15000); // 恢复到15000，max_tokens已增加

        // 构建 API messages
        const apiMessages: ChatMessage[] = type === 'summary'
            ? [{
                role: 'user',
                content: `请阅读以下资料，生成一份结构清晰的重点简报。使用 Markdown 列表格式，提炼 3-5 个核心观点。\n\n资料内容：\n${context}`
            }]
            : [{
                role: 'user',
                content: `请阅读以下资料，提取核心知识结构，生成思维导图JSON。

严格要求：
1. 返回合法JSON字符串
2. 不要包含 markdown 代码块标记
3. 结构：{ id: string, label: string, children?: [...] }
4. 根节点 id 为 "root"
5. 最多 3 层（根节点+2层子节点）
6. 每层最多 5 个节点

资料内容：
${context}`
            }];

        try {
            if (type === 'summary') {
                await streamChatCompletion(
                    null, // 不使用 RAG
                    apiMessages,
                    (chunk: string) => {
                        if (noteRef && typeof noteRef.content === 'string') {
                            noteRef.content += chunk;
                        }
                    },
                    { signal: artifactAbortController.signal }
                );
            } else {
                let fullJson = '';
                await streamChatCompletion(
                    null,
                    apiMessages,
                    (chunk: string) => {
                        fullJson += chunk;
                    },
                    { signal: artifactAbortController.signal }
                );

                console.log('📄 Received full response:', fullJson.substring(0, 200));

                const cleanJson = fullJson.replace(/```json/g, '').replace(/```/g, '').trim();
                console.log('🧹 Cleaned JSON:', cleanJson.substring(0, 200));

                try {
                    const parsedData = JSON.parse(cleanJson);
                    if (parsedData && (parsedData.id || parsedData.label)) {
                        if (noteRef) {
                            noteRef.content = parsedData;
                        }
                    } else {
                        throw new Error("Invalid JSON structure");
                    }
                } catch (parseError) {
                    console.error("JSON Parse Error:", parseError);
                    console.error("Full JSON:", fullJson);
                    console.error("Clean JSON:", cleanJson);

                    if (noteRef) {
                        noteRef.content = {
                            id: 'root',
                            label: '生成失败',
                            children: [
                                { id: 'tip1', label: '⚠️ AI 返回的不是有效的 JSON 格式' },
                                { id: 'tip2', label: '💡 尝试：重新选择内容较少的来源' },
                                { id: 'tip3', label: '或者尝试生成重点简报' }
                            ]
                        };
                    }
                }
            }
        } catch (e) {
            console.error("Artifact generation error:", e);
            const errorMessage = (e as Error).message || '未知错误';
            if (noteRef) {
                noteRef.content = type === 'mindmap'
                    ? {
                        id: 'root',
                        label: '⚠️ 生成失败',
                        children: [
                            { id: 'error', label: `错误: ${errorMessage}` },
                            { id: 'tip', label: '💡 请检查个人中心的系统配置' }
                        ]
                    } as MindMapNode
                    : `## ⚠️ 生成失败\n\n**错误信息:** ${errorMessage}\n\n💡 **提示:** 请前往个人中心配置 API Key 和 API URL`;
            }
        } finally {
            if (noteRef) {
                noteRef.status = 'done';

                // 保存到后端数据库
                if (currentSessionId.value && noteRef.content) {
                    try {
                        const savedNote = await sessionApi.saveNote(currentSessionId.value, {
                            title: noteRef.title,
                            type: noteRef.type,
                            content: noteRef.content
                        });
                        noteRef.id = savedNote.id.toString();
                        console.log('✅ Note saved:', savedNote.id);
                    } catch (err) {
                        console.error('❌ Save note failed:', err);
                    }
                }
            }
            artifactAbortController = null;
        }
    };

    const deleteNote = async (noteId: string) => {
        try {
            await sessionApi.deleteNote(parseInt(noteId));
            notes.value = notes.value.filter(n => n.id !== noteId);
            console.log('✅ Note deleted:', noteId);
        } catch (error) {
            console.error('❌ Delete note error:', error);
        }
    };

    const toggleAllNodes = (noteId: string, expand: boolean) => {
        const note = notes.value.find(n => n.id === noteId);
        if (note && note.type === 'mindmap' && typeof note.content === 'object') {
            const traverse = (node: MindMapNode) => {
                node.collapsed = !expand;
                if (node.children) node.children.forEach(traverse);
            };
            traverse(note.content as MindMapNode);
        }
    };

    /**
     * 创建新会话
     */
    const createNewSession = () => {
        sources.value = [];
        chatHistory.value = [];
        notes.value = [];
        currentSessionId.value = null;
    };

    /**
     * 删除会话
     */
    const deleteSession = async (sessionId: number) => {
        try {
            await sessionApi.delete(sessionId);
            await loadSessions();

            if (currentSessionId.value === sessionId) {
                createNewSession();
            }
        } catch (error: any) {
            console.error('Delete session error:', error);
        }
    };

    /**
     * 重命名会话
     */
    const renameSession = async (sessionId: number, newTitle: string) => {
        try {
            await sessionApi.update(sessionId, { title: newTitle });
            await loadSessions();
        } catch (error: any) {
            console.error('Rename session error:', error);
        }
    };

    // 初始化：加载会话列表
    loadSessions();

    return {
        sources, chatHistory, notes, isGenerating, activeSourceNames,
        addSource, removeSource, toggleSourceSelection, sendMessage, generateArtifact, toggleAllNodes, deleteNote, stopGeneration,
        // 会话管理
        sessions, currentSessionId,
        loadSessions, createNewSession, loadSession, deleteSession, renameSession,
        // 上传进度
        uploadProgress
    };
});