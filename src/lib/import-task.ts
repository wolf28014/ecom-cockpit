/**
 * 全局导入任务状态管理
 * 用模块级变量 + 事件订阅，让导入进度在所有页面可见
 * 即使关闭导入页面，后台任务仍继续，进度可从其他页面查看
 */

export interface ImportTask {
  id: string;
  storeId: string;
  storeName: string;
  total: number;
  success: number;
  failed: number;
  status: "running" | "completed" | "failed";
  startedAt: number;
  finishedAt?: number;
}

type Listener = (tasks: ImportTask[]) => void;

class ImportTaskManager {
  private tasks: ImportTask[] = [];
  private listeners: Set<Listener> = new Set();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.tasks);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const snapshot = [...this.tasks];
    this.listeners.forEach(l => l(snapshot));
  }

  addTask(storeId: string, storeName: string, total: number): string {
    const id = `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const task: ImportTask = {
      id, storeId, storeName, total,
      success: 0, failed: 0,
      status: "running",
      startedAt: Date.now(),
    };
    this.tasks = [task, ...this.tasks];
    this.notify();
    return id;
  }

  updateProgress(id: string, success: number, failed: number) {
    this.tasks = this.tasks.map(t =>
      t.id === id ? { ...t, success, failed } : t
    );
    this.notify();
  }

  completeTask(id: string, status: "completed" | "failed" = "completed") {
    this.tasks = this.tasks.map(t =>
      t.id === id ? { ...t, status, finishedAt: Date.now() } : t
    );
    this.notify();
  }

  removeTask(id: string) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.notify();
  }

  getTasks(): ImportTask[] {
    return [...this.tasks];
  }

  hasRunning(): boolean {
    return this.tasks.some(t => t.status === "running");
  }
}

export const importManager = new ImportTaskManager();
