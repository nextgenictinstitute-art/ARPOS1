import { Product, Sale, Purchase, ShopProfile } from '../types';
import { INITIAL_PRODUCTS } from '../constants';

const DB_NAME = 'ARPrintersDB';
const DB_VERSION = 2; // Incremented for updates

const DEFAULT_PROFILE: ShopProfile = {
  name: 'AR PRINTERS',
  address: 'Mukkarawewa, Horowpothana',
  phone: '0778824235',
  email: 'arprintersmk@gmail.com',
  footerNote: 'Thank you for choosing AR Printers!',
  logo: ''
};

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains('products')) {
        const prodStore = db.createObjectStore('products', { keyPath: 'id' });
        INITIAL_PRODUCTS.forEach(p => prodStore.add(p));
      }
      
      if (!db.objectStoreNames.contains('sales')) {
        db.createObjectStore('sales', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('purchases')) {
        db.createObjectStore('purchases', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('settings')) {
        const settingsStore = db.createObjectStore('settings', { keyPath: 'id' });
        settingsStore.add({ id: 'profile', ...DEFAULT_PROFILE });
      }
    };
  });
};

const getAll = async <T>(storeName: string): Promise<T[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const getOne = async <T>(storeName: string, key: string): Promise<T | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const putItem = async <T>(storeName: string, item: T): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const db = {
  getProducts: () => getAll<Product>('products'),
  addProduct: (product: Product) => putItem('products', product),
  updateProduct: (product: Product) => putItem('products', product),

  getSales: () => getAll<Sale>('sales'),
  saveSale: async (sale: Sale): Promise<void> => {
    const database = await openDB();
    const tx = database.transaction(['sales', 'products'], 'readwrite');
    
    const salesStore = tx.objectStore('sales');
    salesStore.add(sale);

    const productStore = tx.objectStore('products');
    for (const item of sale.items) {
      if (!item.id.startsWith('manual-')) {
        const req = productStore.get(item.id);
        req.onsuccess = () => {
          const product = req.result as Product;
          if (product) {
            product.stock -= item.quantity;
            productStore.put(product);
          }
        };
      }
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  updateSale: (updatedSale: Sale) => putItem('sales', updatedSale),

  getPurchases: () => getAll<Purchase>('purchases'),
  savePurchase: async (purchase: Purchase): Promise<void> => {
    const database = await openDB();
    const tx = database.transaction(['purchases', 'products'], 'readwrite');
    
    tx.objectStore('purchases').add(purchase);
    const productStore = tx.objectStore('products');
    
    for (const item of purchase.items) {
      const req = productStore.get(item.productId);
      req.onsuccess = () => {
        const product = req.result as Product;
        if (product) {
          product.stock += item.quantity;
          product.cost = item.unitCost;
          productStore.put(product);
        }
      };
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  getShopProfile: async (): Promise<ShopProfile> => {
    const profile = await getOne<{id: string} & ShopProfile>('settings', 'profile');
    if (profile) {
        const { id, ...rest } = profile;
        return rest as ShopProfile;
    }
    return DEFAULT_PROFILE;
  },

  saveShopProfile: (profile: ShopProfile) => putItem('settings', { id: 'profile', ...profile })
};