import Fuse from 'fuse.js'
import MiniSearch from 'minisearch'
import FlexSearch from 'flexsearch'
import lunr from 'lunr'
import fuzzysort from 'fuzzysort'
import uFuzzy from '@leeoniya/ufuzzy'
import fuzzysearch from 'fuzzysearch'
import fuzzy from 'fuzzy'
import { matchSorter } from 'match-sorter'
import { search as fastFuzzySearch } from 'fast-fuzzy'
import stringSimilarity from 'string-similarity'
import { pipeline, env } from '@xenova/transformers'

env.allowLocalModels = false;

class PipelineSingleton {
  static task = 'feature-extraction';
  static model = 'Xenova/all-MiniLM-L6-v2';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

const documentEmbeddingCache = new Map();

async function getDocumentEmbedding(text, extractor) {
  if (documentEmbeddingCache.has(text)) {
    return documentEmbeddingCache.get(text);
  }
  const docOutput = await extractor(text, { pooling: 'mean', normalize: true });
  const docVector = Array.from(docOutput.data);
  documentEmbeddingCache.set(text, docVector);
  return docVector;
}

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function executeSearch({
  engine,
  query,
  rows,
  columns,
  exact = false,
  caseSensitive = false
}) {
  if (!rows || !rows.length || !query) return rows;
  const targetColumns = columns || Object.keys(rows[0] || {});

  try {
    switch (engine) {
      case 'fuse': {
        const keys = targetColumns.map(k => ({ name: k, weight: 1 }));
        if (exact) {
          const pattern = caseSensitive ? `=${query}` : `=${query.toLowerCase()}`;
          const lowered = caseSensitive ? rows : rows.map(r => 
            Object.fromEntries(Object.entries(r).map(([k,v]) => 
              [k, typeof v === 'string' ? v.toLowerCase() : v]
            ))
          );
          const f = new Fuse(lowered, { 
            keys, 
            useExtendedSearch: true 
          });
          return f.search(pattern).map(r => r.item);
        }
        
        const f = new Fuse(rows, {
          keys,
          includeMatches: true,
          threshold: 0.4,
          isCaseSensitive: caseSensitive,
          ignoreLocation: true,
          minMatchCharLength: 1,
        });
        return f.search(query).map(r => r.item);
      }
      
      case 'minisearch': {
        const ms = new MiniSearch({
          fields: targetColumns,
          storeFields: targetColumns,
          searchOptions: {
            fuzzy: !exact,
            prefix: true,
            boost: {},
            weights: { fuzzy: 0.2, prefix: 0.8 }
          }
        });
        const documentsWithId = rows.map((row, index) => ({ id: index, ...row }));
        ms.addAll(documentsWithId);
        const results = ms.search(query, {
          fuzzy: !exact,
          prefix: !exact,
          combineWith: 'AND'
        });
        return results.map(result => rows[result.id]).filter(Boolean);
      }
      
      case 'flexsearch': {
        const index = new FlexSearch.Index({
          charset: "latin:extra",
          tokenize: "forward",
          resolution: 9
        });
        rows.forEach((row, idx) => {
          const searchText = targetColumns.map(col => String(row[col] || '')).join(' ');
          index.add(idx, searchText);
        });
        const results = index.search(query);
        return results.map(idx => rows[idx]).filter(Boolean);
      }
      
      case 'lunr': {
        const idx = lunr(function () {
          this.ref('id');
          targetColumns.forEach(col => this.field(col));
          rows.forEach((row, id) => {
            const doc = { id };
            targetColumns.forEach(col => { doc[col] = String(row[col] || ''); });
            this.add(doc);
          });
        });
        const searchQuery = exact ? query : `${query}~1 ${query}*`;
        const results = idx.search(searchQuery);
        return results.map(result => rows[parseInt(result.ref)]).filter(Boolean);
      }
      
      case 'fuzzysort': {
        const preparedData = rows.map((row, idx) => {
          const searchableFields = {};
          targetColumns.forEach(col => {
            const value = String(row[col] || '');
            if (value) searchableFields[col] = fuzzysort.prepare(value);
          });
          return { index: idx, originalRow: row, prepared: searchableFields };
        });
        
        const results = [];
        preparedData.forEach(item => {
          let bestScore = -Infinity;
          let hasMatch = false;
          Object.keys(item.prepared).forEach(fieldName => {
            const preparedField = item.prepared[fieldName];
            if (preparedField) {
              const result = fuzzysort.single(query, preparedField);
              if (result && result.score > -1000) {
                hasMatch = true;
                bestScore = Math.max(bestScore, result.score);
              }
            }
          });
          if (hasMatch) results.push({ item: item.originalRow, score: bestScore });
        });
        results.sort((a, b) => b.score - a.score);
        return results.map(r => r.item);
      }

      case 'ufuzzy': {
        const uf = new uFuzzy();
        const haystack = rows.map(row => targetColumns.map(col => String(row[col] || '')).join(' '));
        const idxs = uf.filter(haystack, query);
        if (idxs?.length) {
          const info = uf.info(idxs, haystack, query);
          const order = uf.sort(info, haystack, query);
          return order.map(i => rows[idxs[i]]).filter(Boolean);
        }
        return [];
      }

      case 'fuzzysearch': {
        const needle = caseSensitive ? query : query.toLowerCase();
        return rows.filter(row => {
          const text = targetColumns.map(col => String(row[col] || '')).join(' ');
          const haystack = caseSensitive ? text : text.toLowerCase();
          return fuzzysearch(needle, haystack);
        });
      }

      case 'fuzzy': {
        const options = { extract: (row) => targetColumns.map(col => String(row[col] || '')).join(' ') };
        const results = fuzzy.filter(query, rows, options);
        return results.map(r => r.original);
      }

      case 'microfuzz': {
        const needle = caseSensitive ? query : query.toLowerCase();
        const results = [];
        rows.forEach(row => {
          const text = targetColumns.map(col => String(row[col] || '')).join(' ');
          const haystack = caseSensitive ? text : text.toLowerCase();
          let score = 0;
          let lastIndex = -1;
          let matches = 0;
          for (let i = 0; i < needle.length; i++) {
            const char = needle[i];
            const index = haystack.indexOf(char, lastIndex + 1);
            if (index !== -1) {
              matches++;
              score += needle.length - (index - lastIndex);
              lastIndex = index;
            }
          }
          if (matches === needle.length || haystack.includes(needle)) {
            results.push({ row, score });
          }
        });
        results.sort((a, b) => b.score - a.score);
        return results.map(r => r.row);
      }

      case 'meilisearch': {
        const needle = caseSensitive ? query : query.toLowerCase();
        return rows.filter(row => {
          const text = targetColumns.map(col => String(row[col] || '')).join(' ');
          const haystack = caseSensitive ? text : text.toLowerCase();
          return haystack.includes(needle);
        });
      }

      case 'matchsorter': {
        const data = rows.map((row, index) => ({
          row,
          searchableText: targetColumns.map(col => String(row[col] || '')).join(' ')
        }));
        const results = matchSorter(data, query, {
          keys: ['searchableText'],
          threshold: exact ? matchSorter.rankings.EQUAL : matchSorter.rankings.CONTAINS
        });
        return results.map(r => r.row);
      }

      case 'fastfuzzy': {
        const data = rows.map(row => ({
          row,
          searchText: targetColumns.map(col => String(row[col] || '')).join(' ')
        }));
        const results = [];
        data.forEach(item => {
          const options = { ignoreCase: !caseSensitive, returnMatchData: true };
          const result = fastFuzzySearch(query, [item.searchText], options);
          if (result.length > 0) {
            results.push({ item, score: result[0].score || 0 });
          }
        });
        results.sort((a, b) => b.score - a.score);
        return results.map(r => r.item.row);
      }

      case 'stringsimilarity': {
        const needle = caseSensitive ? query : query.toLowerCase();
        const results = [];
        rows.forEach(row => {
          const text = targetColumns.map(col => String(row[col] || '')).join(' ');
          const haystack = caseSensitive ? text : text.toLowerCase();
          const similarity = stringSimilarity.compareTwoStrings(needle, haystack);
          if (similarity > 0.1 || haystack.includes(needle)) {
            results.push({ row, similarity });
          }
        });
        results.sort((a, b) => b.similarity - a.similarity);
        return results.map(r => r.row);
      }
      
      case 'hybrid': {
        // 1. Traditional Keyword/Fuzzy Matching (using Fuse.js)
        const keys = targetColumns.map(k => ({ name: k, weight: 1 }));
        const f = new Fuse(rows, {
          keys,
          includeScore: true,
          threshold: 0.6,
          isCaseSensitive: caseSensitive,
          ignoreLocation: true,
          minMatchCharLength: 1,
        });
        const fuzzyResults = f.search(query);
        const fuzzyRankMap = new Map();
        fuzzyResults.forEach((res, index) => {
          fuzzyRankMap.set(res.item, index + 1);
        });

        // 2. Vector Search (using Machine Learning embeddings via Transformers.js)
        const extractor = await PipelineSingleton.getInstance();
        const queryVector = await getDocumentEmbedding(query, extractor);
        
        const vectorResults = [];
        for (const row of rows) {
          const text = targetColumns.map(col => String(row[col] || '')).join(' ');
          const docVector = await getDocumentEmbedding(text, extractor);
          const similarity = cosineSimilarity(queryVector, docVector);
          
          // Only include somewhat relevant vectors to avoid huge RRF maps
          if (similarity > 0.1) {
            vectorResults.push({ item: row, score: similarity });
          }
        }
        vectorResults.sort((a, b) => b.score - a.score);
        
        const vectorRankMap = new Map();
        vectorResults.forEach((res, index) => {
          vectorRankMap.set(res.item, index + 1);
        });

        // 3. Blending results using RRF (Reciprocal Rank Fusion)
        const k = 60; // Standard RRF constant
        const rrfScores = new Map();
        
        const allItems = new Set([...fuzzyResults.map(r => r.item), ...vectorResults.map(r => r.item)]);
        
        allItems.forEach(item => {
          const rank1 = fuzzyRankMap.has(item) ? fuzzyRankMap.get(item) : 10000;
          const rank2 = vectorRankMap.has(item) ? vectorRankMap.get(item) : 10000;
          const rrfScore = (1 / (k + rank1)) + (1 / (k + rank2));
          rrfScores.set(item, rrfScore);
        });

        const hybridResults = Array.from(allItems).map(item => ({
          item,
          score: rrfScores.get(item)
        }));

        hybridResults.sort((a, b) => b.score - a.score);

        return hybridResults.map(r => r.item);
      }
      
      case 'semantic': {
        const extractor = await PipelineSingleton.getInstance();
        const queryVector = await getDocumentEmbedding(query, extractor);
        
        const vectorResults = [];
        for (const row of rows) {
          const text = targetColumns.map(col => String(row[col] || '')).join(' ');
          const docVector = await getDocumentEmbedding(text, extractor);
          const similarity = cosineSimilarity(queryVector, docVector);
          
          if (similarity > 0.1) {
            vectorResults.push({ item: row, score: similarity });
          }
        }
        
        vectorResults.sort((a, b) => b.score - a.score);
        return vectorResults.map(r => r.item);
      }

      default:
        return rows;
    }
  } catch (error) {
    console.error(`Search engine ${engine} error:`, error);
    return rows;
  }
}
