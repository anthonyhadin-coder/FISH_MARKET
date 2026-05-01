import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'VoiceQueueDB';
const STORE_NAME = 'voice_tasks';

export interface VoiceTask {
  id?: number;
  audioBlob: Blob;
  timestamp: number;
  lang: 'ta' | 'en';
  status: 'pending' | 'syncing' | 'failed';
}

class VoiceQueueManager {
  private db: Promise<IDBPDatabase>;

  constructor() {
    this.db = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      },
    });
  }

  async addTask(audioBlob: Blob, lang: 'ta' | 'en') {
    const db = await this.db;
    return db.add(STORE_NAME, {
      audioBlob,
      lang,
      timestamp: Date.now(),
      status: 'pending'
    });
  }

  async getPendingTasks(): Promise<VoiceTask[]> {
    const db = await this.db;
    return db.getAll(STORE_NAME);
  }

  async deleteTask(id: number) {
    const db = await this.db;
    return db.delete(STORE_NAME, id);
  }
}

export const voiceQueue = new VoiceQueueManager();
