import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

// --- 类型定义 ---
export interface ProjectFile {
    id: string;
    name: string;
    path: string;
    content: string;
    language: string;
    size?: number;
}

export interface AnalysisResult {
    id: string;
    type: string;
    timestamp: string;
    title: string;
    content: any;
    isChart: boolean;
    isCode: boolean;
}

export interface CodeProject {
    id: string;
    title: string;
    timestamp: number;
    files: ProjectFile[];
    preview: string;
    results?: AnalysisResult[]; // 保存生成的结果
}

const STORAGE_KEY = 'code-archaeologist-storage';
const PROJECTS_STORAGE_KEY = 'code-projects';

export const useCodeStore = defineStore('codeArchaeologist', () => {

    // --- State ---
    const loadFromStorage = () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try { return JSON.parse(stored); } catch (e) { return null; }
        }
        return null;
    };
    const savedData = loadFromStorage();

    const files = ref<ProjectFile[]>(savedData?.files || []);
    const projects = ref<CodeProject[]>([]);
    const currentProjectId = ref<string | null>(savedData?.currentProjectId || null);
    const results = ref<AnalysisResult[]>(savedData?.results || []); // 新增：分析结果

    // --- Persistence ---
    watch([files, results], () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            files: files.value,
            currentProjectId: currentProjectId.value,
            results: results.value
        }));
    }, { deep: true });

    watch(currentProjectId, () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            files: files.value,
            currentProjectId: currentProjectId.value,
            results: results.value
        }));
    });

    // --- 文件操作 ---
    const addFile = (file: ProjectFile) => {
        files.value.push(file);
        saveCurrentProject();
    };

    const removeFile = (id: string) => {
        const index = files.value.findIndex(f => f.id === id);
        if (index !== -1) {
            files.value.splice(index, 1);
        }
        saveCurrentProject();
    };

    const clearFiles = () => {
        files.value = [];
        results.value = []; // 清空文件时也清空结果
        saveCurrentProject();
    };

    // ==================== 项目管理 ====================

    // 加载历史项目
    const loadProjects = () => {
        const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
        if (stored) {
            try {
                projects.value = JSON.parse(stored);
            } catch (e) {
                console.error('Failed to load projects:', e);
            }
        }
    };

    // 保存当前项目
    const saveCurrentProject = () => {
        // 空项目不保存
        if (files.value.length === 0) {
            return;
        }

        // 生成项目标题
        let title = '新项目';
        if (files.value.length > 0) {
            // 基于第一个文件名生成标题
            const firstFile = files.value[0];
            title = firstFile?.name || firstFile?.path?.split('/').pop() || '新项目';
        }

        // 如果当前项目 ID 存在，检查是否已经保存过
        if (currentProjectId.value) {
            const existingProject = projects.value.find(p => p.id === currentProjectId.value);
            if (existingProject) {
                // 更新现有项目
                existingProject.title = title;
                existingProject.timestamp = Date.now();
                existingProject.files = JSON.parse(JSON.stringify(files.value));
                existingProject.results = JSON.parse(JSON.stringify(results.value)); // 保存结果
                existingProject.preview = `${files.value.length} 个文件`;
                localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects.value));
                return;
            }
        }

        // 创建新项目
        const project: CodeProject = {
            id: Date.now().toString(),
            title,
            timestamp: Date.now(),
            files: JSON.parse(JSON.stringify(files.value)),
            results: JSON.parse(JSON.stringify(results.value)), // 保存结果
            preview: `${files.value.length} 个文件`
        };

        projects.value.unshift(project);

        // 限制历史数量
        if (projects.value.length > 20) {
            projects.value = projects.value.slice(0, 20);
        }

        // 保存到 localStorage
        localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects.value));
        currentProjectId.value = project.id;
    };

    // 创建新项目
    const createNewProject = () => {
        // 保存当前项目
        if (currentProjectId.value) {
            saveCurrentProject();
        }

        // 清空当前数据
        files.value = [];
        results.value = []; // 清空结果
        currentProjectId.value = null;
    };

    // 加载指定项目
    const loadProject = (projectId: string) => {
        const project = projects.value.find(p => p.id === projectId);
        if (!project) return;

        // 先保存当前项目（如果不是同一个）
        if (currentProjectId.value && currentProjectId.value !== projectId) {
            saveCurrentProject();
        }

        // 加载项目数据
        files.value = JSON.parse(JSON.stringify(project.files));
        results.value = JSON.parse(JSON.stringify(project.results || [])); // 恢复结果
        currentProjectId.value = projectId;
    };

    // 删除项目
    const deleteProject = (projectId: string) => {
        const index = projects.value.findIndex(p => p.id === projectId);
        if (index !== -1) {
            projects.value.splice(index, 1);
            localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects.value));

            // 如果删除的是当前项目，清空数据
            if (currentProjectId.value === projectId) {
                files.value = [];
                results.value = []; // 清空结果
                currentProjectId.value = null;
            }
        }
    };

    // 初始化：加载历史项目
    loadProjects();

    return {
        files,
        projects,
        currentProjectId,
        results, // 导出 results
        addFile,
        removeFile,
        clearFiles,
        saveCurrentProject,
        createNewProject,
        loadProject,
        deleteProject
    };
});
