# Excel Explorer

Upload, explore, filter, pivot, and export Excel (XLSX) files entirely in your browser. Save views and metadata to MongoDB. Includes fuzzy search, column tools (show/hide, pin, reorder, resize), virtual scrolling for large data, data cleaning helpers, history (uploads and searches), and shareable views.

## Quick Start

1. Environment

Create/update .env (already present) with:

- MONGO_URL=mongodb://localhost:27017
- DB_NAME=excel_explorer   # pick a DB name you want
- NEXT_PUBLIC_BASE_URL=... # provided by platform

2. Run

The platform runs Next.js dev server under supervisor. If you changed .env, restart:

sudo supervisorctl restart nextjs

Open http://localhost:3000

## Key Features

- Upload & Preview: drag-and-drop or file picker. Multi-sheet with tabs.
- Fuzzy Search: Fuse.js across all or selected columns, exact/case toggles, highlight matches.
- Filters: Filter Builder with AND/OR and rich operators (equals, contains, between, is empty, etc.).
- Column Tools:
  - Show/Hide columns
  - Pin columns to render first
  - Drag-and-drop column reordering (dnd-kit)
  - Resizable column widths (persisted in views)
- Sorting: Click headers.
- Pagination or Virtual Scroll: automatic virtualization for large datasets.
- Export: filtered rows to CSV/XLSX.
- Views: Save/Load views to MongoDB (name required). Update, inline rename, delete.
- Quick Insights: per-column stats + frequency bar chart.
- Data Cleaning: trim whitespace, detect basic types, remove duplicates by columns.
- History: upload history and search history with clear and CSV export.
- Share View Links: generate share slug and copy ?view=slug link (no auth yet).

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