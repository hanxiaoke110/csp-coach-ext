/**
 * Storage - chrome.storage 封装
 * 提供类型化的存储接口，统一使用 csp_ 前缀
 */
const STORAGE_PREFIX = 'csp_';

class Storage {
  /**
   * 获取存储前缀
   * @returns {string}
   */
  static getPrefix() {
    return STORAGE_PREFIX;
  }

  /**
   * 生成带前缀的键名
   * @param {string} key - 原始键名
   * @returns {string}
   */
  static key(key) {
    return `${STORAGE_PREFIX}${key}`;
  }

  /**
   * 从存储中读取数据
   * @param {string} key - 键名（不含前缀）
   * @param {*} defaultValue - 默认值
   * @returns {Promise<*>}
   */
  static async get(key, defaultValue = null) {
    try {
      const result = await chrome.storage.local.get(this.key(key));
      return result[this.key(key)] ?? defaultValue;
    } catch (error) {
      console.error(`[Storage] Error getting key "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * 保存数据到存储
   * @param {string} key - 键名（不含前缀）
   * @param {*} value - 要存储的值
   * @returns {Promise<void>}
   */
  static async set(key, value) {
    try {
      await chrome.storage.local.set({ [this.key(key)]: value });
    } catch (error) {
      console.error(`[Storage] Error setting key "${key}":`, error);
      throw error;
    }
  }

  /**
   * 删除存储中的数据
   * @param {string} key - 键名（不含前缀）
   * @returns {Promise<void>}
   */
  static async remove(key) {
    try {
      await chrome.storage.local.remove(this.key(key));
    } catch (error) {
      console.error(`[Storage] Error removing key "${key}":`, error);
      throw error;
    }
  }

  /**
   * 清除所有 CSP 相关存储
   * @returns {Promise<void>}
   */
  static async clearAll() {
    try {
      const all = await chrome.storage.local.get();
      const cspKeys = Object.keys(all).filter(k => k.startsWith(STORAGE_PREFIX));
      if (cspKeys.length > 0) {
        await chrome.storage.local.remove(cspKeys);
      }
    } catch (error) {
      console.error('[Storage] Error clearing storage:', error);
      throw error;
    }
  }

  /**
   * 批量获取多个键值
   * @param {string[]} keys - 键名数组
   * @returns {Promise<Object>}
   */
  static async getMultiple(keys) {
    try {
      const prefixedKeys = keys.map(k => this.key(k));
      const result = await chrome.storage.local.get(prefixedKeys);
      const output = {};
      keys.forEach((k, i) => {
        output[k] = result[prefixedKeys[i]];
      });
      return output;
    } catch (error) {
      console.error('[Storage] Error getting multiple keys:', error);
      throw error;
    }
  }
}

// 存储键名常量
export const STORAGE_KEYS = {
  CONFIG: 'config',
  SESSION: 'session',
  SESSIONS: 'sessions',
  CURRENT_MODE: 'current_mode',
  THEME: 'theme'
};

export default Storage;
export { Storage };
