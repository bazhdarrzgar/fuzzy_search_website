import { executeSearch } from './searchHelper';

self.onmessage = async (e) => {
  const { id, type, payload } = e.data;
  
  if (type === 'SEARCH') {
    try {
      const results = await executeSearch(payload);
      self.postMessage({ id, type: 'SEARCH_SUCCESS', payload: results });
    } catch (error) {
      self.postMessage({ id, type: 'SEARCH_ERROR', payload: error.message });
    }
  }
};
