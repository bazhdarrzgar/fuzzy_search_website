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

The platform runs Next.js dev server under supervisor. If you changed .env, restart:

```bash
sudo supervisorctl restart frontend
```

Open http://localhost:3000

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

## API Endpoints (all under /api)

Views
- GET /api/views — list views (without _id)
- POST /api/views — create view
- GET /api/views/:id — get single view
- PUT /api/views/:id — update view fields
- DELETE /api/views/:id — delete view
- GET /api/views/share/:slug — fetch a shared view by slug

History
- GET /api/history/upload — list recent uploads
- POST /api/history/upload — add upload record
- DELETE /api/history/upload — clear upload history
- GET /api/history/search — list recent searches
- POST /api/history/search — add search record
- DELETE /api/history/search — clear search history

Status (sample)
- GET /api/root or GET /api/ — Hello World
- GET/POST /api/status — sample health endpoints

## Data Model (MongoDB)

- views
  - id (uuid)
  - name, fileName, sheet
  - columns, visibleColumns, pinnedColumns, searchColumns
  - filterBuilder: { groupOperator, filters[] }
  - pivot: { g1, g2, measure, agg }
  - columnWidths: { [column]: number(px) }
  - query, caseSensitive, exact, sortBy, sortDir
  - virtualizeEnabled
  - shareSlug (optional)
  - createdAt (Date)

- upload_history
  - id (uuid)
  - fileName
  - totalRows, sheetCount
  - sheets: [{ name, rowCount, colCount }]
  - createdAt (Date)

- search_history
  - id (uuid)
  - query, caseSensitive, exact, searchColumns[], sheet, fileName
  - createdAt (Date)

## Per-View “Load Last Used File”

When you apply a saved view that references a different fileName than the one currently loaded, the UI prompts you to select that file from your device. This is required because browsers cannot auto-load local files without user interaction. After you select the expected file, the app parses it and reapplies the view.

## Notes

- If MongoDB is unreachable or DB_NAME is not set, client-side features still work (upload, preview, search, export), but saving/loading views and history will fail silently or show toasts.
- IDs are UUIDs, not ObjectIDs, to keep responses JSON-friendly.
- No external file storage is implemented; files remain client-side.

## Roadmap Ideas

- Stable row keys by selecting a unique column per sheet (improves selection across pages)
- Advanced pivot builder with columns-as-headers
- Auth + per-user history and views
- Bulk transformation recipes and undo stack

## Tech Stack

- Next.js (App Router), React 18, Tailwind + shadcn/ui
- SheetJS (xlsx) for parsing and export
- Fuse.js for fuzzy search
- @tanstack/react-virtual for virtualization
- @dnd-kit for drag-and-drop
- Recharts for quick insights
- MongoDB for view/history metadata