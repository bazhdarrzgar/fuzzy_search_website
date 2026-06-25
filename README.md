# Excel Explorer - Advanced Fuzzy Search

Upload, explore, filter, pivot, and export Excel (XLSX) files entirely in your browser. Features **13 different fuzzy search engines** for optimal search performance, column tools, virtual scrolling for large datasets, data cleaning helpers, MongoDB storage for views and history, and shareable views.

## 🔍 Search Engines (13 Available)

Choose from 13 different search engines, each optimized for specific use cases:

### **High-Performance Engines**
- **🚀 uFuzzy** - Ultra-fast fuzzy search with typo tolerance and advanced scoring
- **⚡ Fast Fuzzy** - Very fast fuzzy string matching with advanced options and Unicode support
- **🏃 FlexSearch** - Extremely fast, supports phonetic and partial matching

### **Comprehensive Full-Text Search**
- **📚 Fuse.js** - Token + character scoring, configurable weights per field, most popular
- **🔎 MiniSearch** - Full-text search with fuzzy matching, relevance ranking, and BM25 scoring
- **📖 Lunr.js** - Search index with tf-idf scoring, excellent for full-text search

### **Specialized Fuzzy Matching**
- **🎯 FuzzySort** - Very fast fuzzy string matching (RapidFuzz-like performance)
- **🪶 FuzzySearch** - Simple and lightweight fuzzy string searching
- **📝 Fuzzy.js** - Simple fuzzy filter for arrays of strings
- **🔬 MicroFuzz** - Minimal fuzzy search implementation (custom built)

### **Advanced Matching Algorithms**
- **🎲 Match Sorter** - Simple, expected, and deterministic best-match sorting
- **📊 String Similarity** - Finds degree of similarity between strings using Dice coefficient
- **⚡ MeiliSearch** - Instant full-text search engine (client-side mode)

## Quick Start

1. **Environment Setup**

Create/update .env (already present) with:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=excel_explorer
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

2. **Run the Application**

The platform includes cross-platform launchers for both Windows and Linux to run in either Development or Production (Build) mode.

**Development Mode:**
* **Windows**: Run `Run\launcher.bat` to start the Control Panel.
* **Linux**: Run `./Run/launcher.sh` to start the Control Panel.

**Production (Build) Mode:**
* **Windows**: Run `Run\launcher_build.bat` to build the app and start the production server.
* **Linux**: Run `./Run/launcher_build.sh` to build the app and start the production server.

Alternatively, you can use the standard commands:
```bash
nub install
nub run dev
```

Open http://localhost:3000 (or the port shown in the Control Panel)


## Key Features

### **📊 Data Management**
- **Upload & Preview**: Drag-and-drop or file picker with multi-sheet support and tabs
- **Export Options**: Export filtered data to CSV/XLSX formats
- **Virtual Scrolling**: Automatic virtualization for large datasets (1000+ rows)
- **Multi-Sheet Support**: Handle Excel files with multiple worksheets

### **🔍 Advanced Search & Filtering**
- **13 Search Engines**: Choose the best search algorithm for your data
- **Smart Search Options**: 
  - Exact match vs fuzzy matching
  - Case sensitive/insensitive search
  - Search specific columns or all columns
  - Real-time search with highlighting
- **Advanced Filters**: Filter Builder with AND/OR logic and rich operators:
  - Equals, contains, between, is empty, greater than, less than, etc.

### **🛠️ Column Management Tools**
- **Show/Hide Columns**: Toggle column visibility
- **Pin Columns**: Pin important columns to render first
- **Drag-and-Drop Reordering**: Reorder columns using dnd-kit
- **Resizable Columns**: Adjust column widths (persisted in views)
- **Column Statistics**: Quick insights with frequency charts

### **💾 Data Persistence & Views**
- **Save/Load Views**: Store complete view configurations in MongoDB
- **View Management**: Update, rename, delete saved views
- **Shareable Views**: Generate share slugs for collaborative access
- **History Tracking**: 
  - Upload history with file metadata
  - Search history with query tracking
  - Export history to CSV

### **🧹 Data Cleaning Tools**
- **Whitespace Trimming**: Remove leading/trailing spaces
- **Type Detection**: Automatically detect and convert data types
- **Duplicate Removal**: Remove duplicates based on selected columns
- **Case Conversion**: Convert text to uppercase/lowercase
- **Empty Row Removal**: Clean up empty data rows

### **⚡ Performance Features**
- **Bulk Operations**: Select, delete, duplicate multiple rows
- **Sorting**: Click column headers to sort data
- **Pagination**: Navigate large datasets efficiently  
- **Cell Editing**: In-place editing of cell values
- **Export Selected**: Export only selected rows

## API Endpoints

All API endpoints are under `/api` prefix:

### **Views Management**
- `GET /api/views` — List all views (without _id)
- `POST /api/views` — Create new view
- `GET /api/views/:id` — Get single view by ID
- `PUT /api/views/:id` — Update view fields
- `DELETE /api/views/:id` — Delete view
- `GET /api/views/share/:slug` — Fetch shared view by slug

### **History Tracking**
- `GET /api/history/upload` — List recent uploads
- `POST /api/history/upload` — Add upload record
- `DELETE /api/history/upload` — Clear upload history
- `GET /api/history/search` — List recent searches
- `POST /api/history/search` — Add search record
- `DELETE /api/history/search` — Clear search history

### **Status & Health**
- `GET /api/root` or `GET /api/` — Hello World
- `GET/POST /api/status` — Health check endpoints

## Data Model (MongoDB)

### **Views Collection**
```javascript
{
  id: "uuid",
  name: "string",
  fileName: "string", 
  sheet: "string",
  columns: ["array of column names"],
  visibleColumns: ["array"],
  pinnedColumns: ["array"],
  searchColumns: ["array"],
  searchEngine: "string", // Selected search engine
  filterBuilder: {
    groupOperator: "AND|OR",
    filters: [...]
  },
  pivot: {
    g1: "string", 
    g2: "string", 
    measure: "string", 
    agg: "string"
  },
  columnWidths: {
    "columnName": "number (pixels)"
  },
  query: "string",
  caseSensitive: "boolean",
  exact: "boolean",
  sortBy: "string",
  sortDir: "asc|desc",
  virtualizeEnabled: "boolean",
  shareSlug: "string (optional)",
  createdAt: "Date"
}
```

### **Upload History Collection**
```javascript
{
  id: "uuid",
  fileName: "string",
  totalRows: "number",
  sheetCount: "number", 
  sheets: [{
    name: "string",
    rowCount: "number",
    colCount: "number"
  }],
  createdAt: "Date"
}
```

### **Search History Collection**
```javascript
{
  id: "uuid",
  query: "string",
  caseSensitive: "boolean",
  exact: "boolean", 
  searchColumns: ["array"],
  searchEngine: "string",
  sheet: "string",
  fileName: "string",
  createdAt: "Date"
}
```

## Search Engine Performance Comparison

| Engine | Speed | Memory | Fuzzy Quality | Best For |
|--------|-------|---------|---------------|----------|
| uFuzzy | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Large datasets, typo tolerance |
| Fast Fuzzy | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Unicode text, fast results |
| FlexSearch | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | Phonetic matching |
| FuzzySort | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Simple fuzzy matching |
| Fuse.js | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Configurable, weighted search |
| MiniSearch | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | Full-text with BM25 |
| Match Sorter | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | Deterministic sorting |
| String Similarity | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | Similarity scoring |

## Advanced Features

### **Per-View File Loading**
When applying a saved view that references a different file, the UI prompts you to select the expected file from your device. This maintains view compatibility across different datasets.

### **Smart Search Features**
- **Column-specific search**: Limit search to selected columns
- **Search highlighting**: Visual highlighting of matched terms
- **Search history**: Track and reuse previous queries
- **Real-time search**: Instant results as you type

### **Data Cleaning Pipeline**
1. **Trim whitespace** from all text fields
2. **Detect and convert** data types automatically  
3. **Remove duplicates** based on selected columns
4. **Case conversion** (upper/lower case)
5. **Empty row removal**

## Technical Notes

- **Client-side Processing**: Files remain in browser memory, no server storage
- **UUID-based IDs**: All identifiers are UUIDs for JSON compatibility
- **MongoDB Optional**: Core features work without database connection
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Performance Optimized**: Virtual scrolling for datasets with 1000+ rows

## Tech Stack

### **Frontend**
- **Next.js 14** (App Router) - React framework
- **React 18** - UI library with hooks and context
- **Tailwind CSS + shadcn/ui** - Styling and components
- **@tanstack/react-virtual** - Virtual scrolling for performance
- **@dnd-kit** - Drag-and-drop functionality
- **Recharts** - Data visualization and quick insights

### **Search Libraries**
- **13 Search Engines** - Comprehensive search capabilities:
  - Fuse.js, MiniSearch, FlexSearch, Lunr.js, FuzzySort
  - uFuzzy, FuzzySearch, Fuzzy.js, MicroFuzz
  - Match Sorter, Fast Fuzzy, String Similarity, MeiliSearch

### **Data Processing**
- **SheetJS (xlsx)** - Excel file parsing and export
- **MongoDB** - View and history metadata storage

### **Development**
- **TypeScript** - Type safety (where applicable)
- **ESLint** - Code linting
- **Yarn** - Package management

## Performance Recommendations

### **For Small Datasets (< 1,000 rows)**
- **Fuse.js**: Best overall fuzzy search experience
- **Match Sorter**: Simple and predictable results
- **String Similarity**: For similarity-based ranking

### **For Medium Datasets (1,000 - 10,000 rows)**  
- **uFuzzy**: Excellent performance with typo tolerance
- **Fast Fuzzy**: Great Unicode support and speed
- **FlexSearch**: Fast with phonetic matching

### **For Large Datasets (> 10,000 rows)**
- **uFuzzy**: Top choice for large datasets
- **FlexSearch**: Extremely fast indexing
- **FuzzySort**: Minimal memory footprint

## Development & Deployment

### **Local Development**
```bash
# Install dependencies
nub install

# Start development server
nub run dev

# The app will be available at http://localhost:3000
```

### **Environment Variables**
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=excel_explorer
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### **Production Deployment**
- Built for serverless and traditional hosting
- MongoDB connection required for view persistence
- Static file serving for optimal performance

## Roadmap

### **Planned Features**
- **Stable row keys** by selecting unique column per sheet
- **Advanced pivot builder** with columns-as-headers
- **User authentication** + per-user history and views  
- **Bulk transformation recipes** with undo/redo stack
- **Real-time collaboration** on shared views
- **Advanced data visualization** with charts and graphs
- **Export to more formats** (JSON, PDF, etc.)
- **API integrations** for external data sources

### **Performance Improvements**
- **Web Workers**: Move search processing to background threads
- **Streaming**: Support for very large files (100MB+)
- **Caching**: Intelligent caching of search results
- **Progressive loading**: Load data incrementally