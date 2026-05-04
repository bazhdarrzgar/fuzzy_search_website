/**
 * Search Service to manage background workers and parallelize search tasks
 */

class SearchService {
  constructor() {
    this.workers = [];
    this.poolSize = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;
    this.taskQueue = [];
    this.activeTasks = new Map();
    this.taskIdCounter = 0;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(new URL('./search.worker.js', import.meta.url));
      worker.onmessage = (e) => this.handleWorkerMessage(i, e.data);
      this.workers.push({
        worker,
        busy: false
      });
    }
    this.initialized = true;
  }

  handleWorkerMessage(workerIndex, data) {
    const { id, type, payload } = data;
    const task = this.activeTasks.get(id);
    
    if (task) {
      if (type === 'SEARCH_SUCCESS') {
        task.resolve(payload);
      } else {
        task.reject(new Error(payload || 'Search failed'));
      }
      this.activeTasks.delete(id);
    }
    
    this.workers[workerIndex].busy = false;
    this.processQueue();
  }

  processQueue() {
    if (this.taskQueue.length === 0) return;

    const freeWorkerIndex = this.workers.findIndex(w => !w.busy);
    if (freeWorkerIndex === -1) return;

    const task = this.taskQueue.shift();
    const workerInfo = this.workers[freeWorkerIndex];
    
    workerInfo.busy = true;
    workerInfo.worker.postMessage({
      id: task.id,
      type: 'SEARCH',
      payload: task.payload
    });
  }

  search(payload) {
    this.init();
    return new Promise((resolve, reject) => {
      const id = ++this.taskIdCounter;
      this.taskQueue.push({ id, payload, resolve, reject });
      this.activeTasks.set(id, { resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Run multiple searches in parallel across all available workers
   */
  async parallelSearch(searchTasks) {
    this.init();
    const promises = searchTasks.map(task => this.search(task));
    return Promise.all(promises);
  }

  terminate() {
    this.workers.forEach(w => w.worker.terminate());
    this.workers = [];
    this.initialized = false;
  }
}

const searchService = new SearchService();
export default searchService;
