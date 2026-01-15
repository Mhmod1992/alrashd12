


import { mockSettings, mockEmployees, mockClients, mockCars, mockCarMakes, mockCarModels, mockInspectionTypes, mockBrokers, mockCustomFindingCategories, mockPredefinedFindings, mockRequests } from '../data/mockData';
import { uuidv4 } from './utils';

const DB_NAME = 'WorkshopDB';
const DB_VERSION = 1;

export const STORES = [
  'app_settings',
  'employees',
  'clients',
  'cars',
  'car_makes',
  'car_models',
  'inspection_types',
  'brokers',
  'custom_finding_categories',
  'predefined_findings',
  'inspection_requests',
  'expenses',
  'notifications'
];

class LocalDB {
  private db: IDBDatabase | null = null;

  async connect(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error("IndexedDB error:", request.error);
        reject(request.error);
      };

      request.onsuccess = (event) => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = request.result;
        STORES.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        });
      };
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getById<T>(storeName: string, id: string | number): Promise<T | undefined> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async insert<T>(storeName: string, data: T): Promise<T> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(data);

      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  async update<T>(storeName: string, data: T): Promise<T> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, id: string | number): Promise<void> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  async clear(storeName: string): Promise<void> {
      const db = await this.connect();
      return new Promise((resolve, reject) => {
          const transaction = db.transaction(storeName, 'readwrite');
          const store = transaction.objectStore(storeName);
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
      });
  }

  // Seed data if empty
  async seedIfNeeded() {
      const db = await this.connect();
      
      const checkAndSeed = async (storeName: string, mockData: any[]) => {
          const count = await new Promise<number>((resolve) => {
              const transaction = db.transaction(storeName, 'readonly');
              const store = transaction.objectStore(storeName);
              const req = store.count();
              req.onsuccess = () => resolve(req.result);
          });

          if (count === 0 && mockData.length > 0) {
              const transaction = db.transaction(storeName, 'readwrite');
              const store = transaction.objectStore(storeName);
              mockData.forEach(item => store.add(item));
              return new Promise<void>((resolve) => {
                  transaction.oncomplete = () => resolve();
              });
          }
      };

      await checkAndSeed('app_settings', [{ id: 1, settings_data: mockSettings }]);
      
      // Start with an empty employee list to trigger the setup wizard for the General Manager.
      await checkAndSeed('employees', []); 
      
      // Seed other configuration data for a better out-of-the-box experience.
      await checkAndSeed('car_makes', mockCarMakes);
      await checkAndSeed('car_models', mockCarModels);
      await checkAndSeed('inspection_types', mockInspectionTypes);
      await checkAndSeed('brokers', mockBrokers);
      await checkAndSeed('custom_finding_categories', mockCustomFindingCategories);
      await checkAndSeed('predefined_findings', mockPredefinedFindings);
      // We don't seed transactional data like requests, clients, or cars to start with a clean slate.
      // await checkAndSeed('clients', mockClients);
      // await checkAndSeed('cars', mockCars);
      // await checkAndSeed('inspection_requests', mockRequests); 
  }
}

export const localDb = new LocalDB();