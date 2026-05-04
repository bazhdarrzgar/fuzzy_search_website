import { executeSearch } from './searchHelper';

self.onmessage = (e) => {
  const { id, type, payload } = e.data;
  
  if (type === 'SEARCH') {
    try {
      const results = executeSearch(payload);
      self.postMessage({ id, type: 'SEARCH_SUCCESS', payload: results });
    } catch (error) {
      self.postMessage({ id, type: 'SEARCH_ERROR', payload: error.message });
    }
  }
};
