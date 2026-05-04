'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import searchService from '@/lib/search-service'
import { useTheme } from 'next-themes'
import { Columns3, Download, FileUp, Loader2, Save, Search, SlidersHorizontal, Table as TableIcon, Trash2, GripVertical, Pencil, Check, X as XIcon, RefreshCw, Link as LinkIcon, History as HistoryIcon, Sun, Moon, Monitor, Eye, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useVirtualizer } from '@tanstack/react-virtual'
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { storage, serverBackup } from '@/lib/storage'
import { Database, RotateCcw, CloudUpload, FileCheck, FileArchive, File as FileIcon } from 'lucide-react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import ExcelJS from 'exceljs'

const PAGE_SIZE = 50
const VIRTUAL_ROW_HEIGHT = 36

// ---------- Helpers ----------
const readFileAsArrayBuffer = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = (e) => resolve(e.target?.result)
  reader.onerror = reject
  reader.readAsArrayBuffer(file)
})

const buildRows = (sheet) => {
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
  return rows.map((r, i) => ({ ...r, __rowNum: i + 2 })) // Assuming row 1 is header
}
const buildColumns = (rows) => Object.keys(rows?.[0] || {})

const highlightMatch = (text, query) => {
  if (!query) return String(text)
  try {
    const idx = String(text).toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return String(text)
    const before = String(text).slice(0, idx)
    const match = String(text).slice(idx, idx + query.length)
    const after = String(text).slice(idx + query.length)
    return (
      <span>
        {before}
        <mark className="bg-yellow-200 text-black rounded px-0.5">{match}</mark>
        {after}
      </span>
    )
  } catch {
    return String(text)
  }
}

const isNumericVal = (v) => { if (v === null || v === undefined || v === '') return false; const n = Number(v); return !Number.isNaN(n) && Number.isFinite(n) }

function SortableColumnChip({ id, onTogglePinned, onRemoveVisible, pinned }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-2 px-2 py-1 rounded border bg-background ${isDragging ? 'ring-2 ring-ring' : ''}`}>
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" {...attributes} {...listeners} />
      <span className="truncate max-w-[160px]" title={id}>{id}</span>
      <div className="ml-auto flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs">
          <Checkbox checked={pinned} onCheckedChange={onTogglePinned} /> pin
        </label>
        <Button size="icon" variant="ghost" className="h-6 w-6" title="Hide" onClick={onRemoveVisible}>
          <XIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

export default function App() {
  // Theme
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [lastBackupTime, setLastBackupTime] = useState(null)

  // Core state
  const [mainTab, setMainTab] = useState('single')
  const [loadedFiles, setLoadedFiles] = useState([])
  const [activeFileId, setActiveFileId] = useState('')
  const [activeSheet, setActiveSheet] = useState('')

  // Persistence Effects
  useEffect(() => {
    const restoreSession = async () => {
      setIsRestoring(true)
      try {
        const savedData = await storage.load('lastSession')
        if (savedData && savedData.loadedFiles?.length > 0) {
          setLoadedFiles(savedData.loadedFiles)
          setActiveFileId(savedData.activeFileId || '')
          setActiveSheet(savedData.activeSheet || '')
          toast.success('Previous session restored')
        }
      } catch (err) {
        console.error('Failed to restore session:', err)
      } finally {
        setIsRestoring(false)
      }
    }
    restoreSession()
  }, [])

  useEffect(() => {
    if (mounted && !isRestoring && loadedFiles.length > 0) {
      const timer = setTimeout(() => {
        storage.save('lastSession', {
          loadedFiles,
          activeFileId,
          activeSheet,
          timestamp: new Date().toISOString()
        })
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [loadedFiles, activeFileId, activeSheet, mounted, isRestoring])

  const handleBackupToServer = async () => {
    if (loadedFiles.length === 0) {
      toast.error('No data to backup')
      return
    }

    const toastId = toast.loading('Creating server backup...')
    try {
      const result = await serverBackup(fileName || 'bulk_backup', {
        loadedFiles,
        activeFileId,
        activeSheet
      })

      if (result.ok) {
        setLastBackupTime(new Date())
        toast.success(`Backup saved to: ${result.path}`, { id: toastId })
      } else {
        throw new Error(result.error)
      }
    } catch (err) {
      toast.error('Backup failed: ' + err.message, { id: toastId })
    }
  }

  const clearSession = async () => {
    if (confirm('Are you sure you want to clear the current session and all loaded files?')) {
      await storage.clear()
      setLoadedFiles([])
      setActiveFileId('')
      setActiveSheet('')
      toast.success('Session cleared')
    }
  }

  const activeFile = useMemo(() => loadedFiles.find(f => f.id === activeFileId), [loadedFiles, activeFileId])
  const sheets = useMemo(() => activeFile ? activeFile.sheets : [], [activeFile])
  const fileName = useMemo(() => activeFile ? activeFile.name : '', [activeFile])

  const setSheets = (newSheets) => {
    if (!activeFileId) return;
    setLoadedFiles(prev => prev.map(f => f.id === activeFileId ? { 
      ...f, 
      sheets: typeof newSheets === 'function' ? newSheets(f.sheets) : newSheets,
      modified: true 
    } : f))
  }
  const setFileName = (newName) => {
    if (!activeFileId) return;
    setLoadedFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, name: newName } : f))
  }
  
  const active = useMemo(() => sheets.find(s => s.name === activeSheet), [sheets, activeSheet])
  const baseRows = useMemo(() => (active?.rows || []), [active?.rows])

  
  // Search/Filter/Sort
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [exact, setExact] = useState(false)
  const [searchColumns, setSearchColumns] = useState([])
  const [searchEngine, setSearchEngine] = useState('fuse') // Shared between single and global

  // Global search state
  const [globalQuery, setGlobalQuery] = useState('')
  const [globalResults, setGlobalResults] = useState([])
  const [globalActiveFileId, setGlobalActiveFileId] = useState('')
  const [isGlobalSearching, setIsGlobalSearching] = useState(false)

  useEffect(() => {
    if (!globalQuery.trim() || loadedFiles.length === 0) {
      setGlobalResults([]);
      setGlobalActiveFileId('');
      return;
    }
    setIsGlobalSearching(true);
    
    const t = setTimeout(async () => {
      try {
        const tasks = [];
        const taskMap = [];

        loadedFiles.forEach(file => {
          file.sheets.forEach(sheet => {
            tasks.push({
              engine: searchEngine,
              query: globalQuery,
              rows: sheet.rows,
              columns: sheet.columns,
              exact,
              caseSensitive
            });
            taskMap.push({ fileId: file.id, fileName: file.name, sheetName: sheet.name, columns: sheet.columns });
          });
        });

        const allMatches = await searchService.parallelSearch(tasks);
        const resultsByFileMap = new Map();

        allMatches.forEach((matches, index) => {
          if (matches.length > 0) {
            const { fileId, fileName, sheetName, columns } = taskMap[index];
            if (!resultsByFileMap.has(fileId)) {
              resultsByFileMap.set(fileId, { fileId, fileName, sheets: [] });
            }
            resultsByFileMap.get(fileId).sheets.push({
              sheetName,
              matches,
              columns
            });
          }
        });

        const resultsByFile = Array.from(resultsByFileMap.values());
        setGlobalResults(resultsByFile);
        if (resultsByFile.length > 0 && (!globalActiveFileId || !resultsByFile.find(f => f.fileId === globalActiveFileId))) {
          setGlobalActiveFileId(resultsByFile[0].fileId);
        }
      } catch (err) {
        console.error('Global search error:', err);
        toast.error('Global search failed');
      } finally {
        setIsGlobalSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [globalQuery, loadedFiles, searchEngine, exact, caseSensitive]);

  const [sortBy, setSortBy] = useState('')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)
  const [isSearching, setIsSearching] = useState(false)
  const [filtered, setFiltered] = useState([])

  useEffect(() => {
    if (!baseRows.length) {
      setFiltered([])
      return
    }
    if (!query) {
      setFiltered(baseRows)
      return
    }
    
    setIsSearching(true)
    const t = setTimeout(async () => {
      try {
        const results = await searchService.search({
          engine: searchEngine,
          query,
          rows: baseRows,
          columns: searchColumns?.length ? searchColumns : active?.columns,
          exact,
          caseSensitive
        })
        setFiltered(results)
      } catch (err) {
        console.error('Search error:', err)
        setFiltered(baseRows)
      } finally {
        setIsSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [baseRows, query, searchEngine, searchColumns, active?.columns, exact, caseSensitive])

  useEffect(() => {
    return () => {
      searchService.terminate()
    }
  }, [])

  // Views
  const [saving, setSaving] = useState(false)
  const [savedViews, setSavedViews] = useState([])
  const [selectedViewId, setSelectedViewId] = useState('')
  const [editingViewId, setEditingViewId] = useState('')
  const [editingName, setEditingName] = useState('')
  const [viewName, setViewName] = useState('')
  const [shareSlug, setShareSlug] = useState('')
  const [shareUrl, setShareUrl] = useState('')

  // Cell editing state
  const [editingCell, setEditingCell] = useState({ rowIndex: -1, column: '', value: '' })
  const [isEditing, setIsEditing] = useState(false)

  // Cell editing functions
  const startEditingCell = (rowIndex, column, currentValue) => {
    setEditingCell({ rowIndex, column, value: String(currentValue || '') })
    setIsEditing(true)
  }

  const saveEditingCell = () => {
    if (editingCell.rowIndex === -1) return
    
    const targetRow = sorted[editingCell.rowIndex]
    if (targetRow) {
      targetRow[editingCell.column] = editingCell.value
      
      // Update in the original data
      const sheetIndex = sheets.findIndex(s => s.name === activeSheet)
      if (sheetIndex !== -1) {
        const originalRowIndex = active.rows.findIndex(r => 
          JSON.stringify(r) === JSON.stringify(targetRow)
        )
        if (originalRowIndex !== -1) {
          active.rows[originalRowIndex][editingCell.column] = editingCell.value
        }
      }
      
      setSheets([...sheets])
      toast.success('Cell updated')
    }
    
    setIsEditing(false)
    setEditingCell({ rowIndex: -1, column: '', value: '' })
  }

  const cancelEditingCell = () => {
    setIsEditing(false)
    setEditingCell({ rowIndex: -1, column: '', value: '' })
  }

  // Additional state for enhanced features
  const [selectedColumn, setSelectedColumn] = useState('')

  // Bulk operations function
  const bulkOperation = (operation) => {
    if (!active) return
    
    switch (operation) {
      case 'selectAll':
        const allIndices = new Set(Array.from({length: active.rows.length}, (_, i) => String(i)))
        setSelectedRows(allIndices)
        toast.success(`Selected all ${active.rows.length} rows`)
        break
        
      case 'selectVisible':
        const visibleIndices = new Set(sorted.map((_, i) => String(i)))
        setSelectedRows(visibleIndices)
        toast.success(`Selected ${sorted.length} visible rows`)
        break
        
      case 'deselectAll':
        setSelectedRows(new Set())
        toast.success('Deselected all rows')
        break
        
      case 'invertSelection':
        const allRows = new Set(Array.from({length: active.rows.length}, (_, i) => String(i)))
        const invertedSelection = new Set(
          Array.from(allRows).filter(idx => !selectedRows.has(idx))
        )
        setSelectedRows(invertedSelection)
        toast.success(`Selected ${invertedSelection.size} rows`)
        break
        
      case 'deleteSelected':
        if (selectedRows.size === 0) {
          toast.error('No rows selected')
          return
        }
        const selectedIndices = Array.from(selectedRows).map(Number).sort((a, b) => b - a)
        selectedIndices.forEach(index => {
          active.rows.splice(index, 1)
        })
        setSheets([...sheets])
        setSelectedRows(new Set())
        toast.success(`Deleted ${selectedIndices.length} rows`)
        break
        
      case 'duplicateSelected':
        if (selectedRows.size === 0) {
          toast.error('No rows selected')
          return
        }
        const rowsToDuplicate = Array.from(selectedRows).map(Number).map(i => active.rows[i]).filter(Boolean)
        active.rows.push(...rowsToDuplicate.map(row => ({...row})))
        setSheets([...sheets])
        setSelectedRows(new Set())
        toast.success(`Duplicated ${rowsToDuplicate.length} rows`)
        break
        
      default:
        toast.error('Unknown bulk operation')
    }
  }

  // Columns and rendering
  const [visibleColumns, setVisibleColumns] = useState([])
  const [pinnedColumns, setPinnedColumns] = useState([])
  const [virtualizeEnabled, setVirtualizeEnabled] = useState(false)
  const [columnWidths, setColumnWidths] = useState({}) // {col: px}

  // Selection
  const [selectedRows, setSelectedRows] = useState(new Set())


  const [dedupeOpen, setDedupeOpen] = useState(false)
  const [dedupeColumns, setDedupeColumns] = useState([])



  // History
  const [uploadHistory, setUploadHistory] = useState([])
  const [searchHistory, setSearchHistory] = useState([])
  const searchLogRef = useRef(new Set())
  const searchDebounceRef = useRef(null)

  // Load-view file dialog
  const [loadDialogOpen, setLoadDialogOpen] = useState(false)
  const [expectedFileName, setExpectedFileName] = useState('')
  const pendingViewRef = useRef(null)

  // Refs and computed
  const fileInputRef = useRef(null)
  const bodyContainerRef = useRef(null)



  // Theme mounting effect
  useEffect(() => {
    setMounted(true)
  }, [])

  // Theme status text
  const getThemeStatus = () => {
    if (!mounted) return 'Loading...'
    switch (theme) {
      case 'light': return 'Light Mode'
      case 'dark': return 'Dark Mode'
      case 'system': return 'System Mode'
      default: return 'System Mode'
    }
  }

  useEffect(() => {
    // Try query param share view
    const url = new URL(window.location.href)
    const slug = url.searchParams.get('view')
    if (slug) {
      fetch(`/api/views/share/${slug}`).then(r => r.ok ? r.json() : null).then(v => { if (v) applyView(v) }).catch(()=>{})
    }
  }, [])

  useEffect(() => {
    if (active?.columns) {
      setVisibleColumns(active.columns)
      setPinnedColumns([])
      setColumnWidths({})
      setSelectedRows(new Set())
    }
  }, [active?.columns])



  // Search engines setup

  const sorted = useMemo(() => {
    if (!sortBy) return filtered
    const data = [...filtered]
    data.sort((a, b) => {
      const av = a?.[sortBy]
      const bv = b?.[sortBy]
      if (av == null && bv == null) return 0
      if (av == null) return sortDir === 'asc' ? -1 : 1
      if (bv == null) return sortDir === 'asc' ? 1 : -1
      const na = parseFloat(av)
      const nb = parseFloat(bv)
      const bothNumbers = !Number.isNaN(na) && !Number.isNaN(nb)
      if (bothNumbers) return sortDir === 'asc' ? na - nb : nb - na
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
    return data
  }, [filtered, sortBy, sortDir])

  const displayColumns = useMemo(() => {
    const set = new Set(visibleColumns)
    const vis = (active?.columns || []).filter(c => set.has(c))
    const pin = new Set(pinnedColumns)
    return [...vis.filter(c => pin.has(c)), ...vis.filter(c => !pin.has(c))]
  }, [active?.columns, visibleColumns, pinnedColumns])

  const hiddenColumns = useMemo(() => {
    const set = new Set(visibleColumns)
    return (active?.columns || []).filter(c => !set.has(c))
  }, [active?.columns, visibleColumns])

  const totalPages = Math.max(1, Math.ceil((sorted?.length || 0) / PAGE_SIZE))
  const pageRows = useMemo(() => { const start = (page - 1) * PAGE_SIZE; return sorted.slice(start, start + PAGE_SIZE) }, [sorted, page])

  useEffect(() => { setPage(1) }, [query, sortBy, sortDir, activeSheet])
  useEffect(() => { setVirtualizeEnabled(sorted.length > 1000) }, [sorted.length])

  const rowVirtualizer = useVirtualizer({ count: sorted.length, getScrollElement: () => bodyContainerRef.current, estimateSize: () => VIRTUAL_ROW_HEIGHT, overscan: 12 })

  // ---------- History helpers ----------
  const postUploadHistory = async (meta) => { try { await fetch('/api/history/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(meta) }); loadHistory() } catch {} }
  const loadHistory = async () => {
    try {
      const [u, s] = await Promise.all([
        fetch('/api/history/upload').then(r => r.ok ? r.json() : []),
        fetch('/api/history/search').then(r => r.ok ? r.json() : []),
      ])
      setUploadHistory(u || [])
      setSearchHistory(s || [])
    } catch {}
  }
  useEffect(() => { loadHistory() }, [])

  // Debounced search history log
  useEffect(() => {
    if (!query.trim()) return
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(async () => {
      const key = `${query}|${activeSheet}|${caseSensitive}|${exact}|${(searchColumns||[]).join(',')}`
      if (searchLogRef.current.has(key)) return
      searchLogRef.current.add(key)
      try {
        await fetch('/api/history/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, caseSensitive, exact, searchColumns, sheet: activeSheet, fileName }) })
        loadHistory()
      } catch {}
    }, 600)
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current) }
  }, [query, activeSheet, caseSensitive, exact, JSON.stringify(searchColumns), fileName])

  const clearUploads = async () => { try { await fetch('/api/history/upload', { method: 'DELETE' }); setUploadHistory([]); toast.success('Uploads history cleared') } catch { toast.error('Failed to clear') } }
  const clearSearches = async () => { try { await fetch('/api/history/search', { method: 'DELETE' }); setSearchHistory([]); toast.success('Search history cleared') } catch { toast.error('Failed to clear') } }
  
  // Additional helper functions for enhanced UI
  const clearUploadHistory = clearUploads
  const clearSearchHistory = clearSearches
  
  const applySearchFromHistory = (search) => {
    setQuery(search.query || '')
    setCaseSensitive(!!search.caseSensitive)
    setExact(!!search.exact)
    setSearchColumns(search.searchColumns || [])
    if (search.sheet && search.sheet !== activeSheet) {
      setActiveSheet(search.sheet)
    }
    toast.success('Applied search from history')
  }
  
  const cleanData = (type) => {
    if (!active) return
    
    switch (type) {
      case 'trim':
        active.rows = active.rows.map(r => 
          Object.fromEntries(Object.entries(r).map(([k,v]) => 
            [k, typeof v === 'string' ? v.trim() : v]
          ))
        )
        toast.success('Trimmed whitespace from all text fields')
        break
        
      case 'duplicates':
        const seen = new Set()
        const uniqueRows = []
        for (const row of active.rows) {
          const key = JSON.stringify(row)
          if (!seen.has(key)) {
            seen.add(key)
            uniqueRows.push(row)
          }
        }
        active.rows = uniqueRows
        toast.success(`Removed ${active.rows.length - uniqueRows.length} duplicate rows`)
        break
        
      case 'empty':
        const nonEmptyRows = active.rows.filter(row => 
          Object.values(row).some(val => val !== '' && val !== null && val !== undefined)
        )
        const removedCount = active.rows.length - nonEmptyRows.length
        active.rows = nonEmptyRows
        toast.success(`Removed ${removedCount} empty rows`)
        break
        
      case 'lowercase':
        active.rows = active.rows.map(r => 
          Object.fromEntries(Object.entries(r).map(([k,v]) => 
            [k, typeof v === 'string' ? v.toLowerCase() : v]
          ))
        )
        toast.success('Converted all text to lowercase')
        break
        
      case 'uppercase':
        active.rows = active.rows.map(r => 
          Object.fromEntries(Object.entries(r).map(([k,v]) => 
            [k, typeof v === 'string' ? v.toUpperCase() : v]
          ))
        )
        toast.success('Converted all text to uppercase')
        break
        
      default:
        toast.error('Unknown cleaning operation')
        return
    }
    
    setSheets([...sheets])
  }

  const exportHistoryCSV = (rows, filename) => {
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'History')
    XLSX.writeFile(wb, filename, { bookType: 'csv' })
  }

  // ---------- File actions ----------
  const onFiles = async (files) => {
    if (!files?.length) return
    
    let newLoadedFiles = [...loadedFiles]
    let lastFileId = activeFileId
    let lastSheetName = activeSheet
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const buf = await readFileAsArrayBuffer(file)
        const wb = XLSX.read(buf, { type: 'array' })
        const newSheets = wb.SheetNames.map(name => { const rows = buildRows(wb.Sheets[name]); const columns = buildColumns(rows); return { name, rows, columns } })
        
        const newFileId = crypto.randomUUID()
        newLoadedFiles.push({
          id: newFileId,
          name: file.name,
          sheets: newSheets,
          modified: false,
          originalBuffer: buf // Store original buffer for styles
        })
        lastFileId = newFileId
        lastSheetName = newSheets?.[0]?.name || ''
        
        const uploadMeta = { fileName: file.name, totalRows: newSheets.reduce((a,s)=>a+(s.rows?.length||0),0), sheetCount: newSheets.length, sheets: newSheets.map(s => ({ name: s.name, rowCount: s.rows?.length || 0, colCount: s.columns?.length || 0 })) }
        postUploadHistory(uploadMeta)
        toast.success(`File ${file.name} parsed`)
      } catch { toast.error(`Failed to parse ${file.name}`) }
    }
    
    setLoadedFiles(newLoadedFiles)
    if (!activeFileId || files.length === 1) {
      setActiveFileId(lastFileId)
      setActiveSheet(lastSheetName)
      setSearchColumns([])
      setSelectedViewId('')
    }
  }
  const onDrop = (e) => { e.preventDefault(); onFiles(e.dataTransfer?.files) }
  const onBrowse = () => fileInputRef.current?.click()

  // Share link helpers (slug only on client for now)
  const createShareLink = () => { 
    const slug = Math.random().toString(36).slice(2,10)
    setShareSlug(slug)
    const url = new URL(window.location.href)
    url.searchParams.set('view', slug)
    setShareUrl(url.toString())
    toast.message('Share slug generated. Save/Update to persist.') 
  }
  const copyShareLink = async () => { 
    const slug = shareSlug || Math.random().toString(36).slice(2,10)
    setShareSlug(slug)
    const url = new URL(window.location.href)
    url.searchParams.set('view', slug)
    const urlString = url.toString()
    setShareUrl(urlString)
    await navigator.clipboard.writeText(urlString)
    toast.success('Share link copied') 
  }

  // Sorting toggle
  const toggleSort = (col) => { if (sortBy !== col) { setSortBy(col); setSortDir('asc'); return } setSortDir(prev => prev === 'asc' ? 'desc' : 'asc') }

  // Export helpers
  const exportRows = (rows, ext) => { if (!rows?.length) return toast.error('No data to export'); const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, activeSheet || 'Sheet1'); XLSX.writeFile(wb, `${fileName || 'data'}-filtered.${ext}`, { bookType: ext }) }
  const downloadCSV = () => exportRows(sorted, 'csv')
  const downloadXLSX = () => exportRows(sorted, 'xlsx')

  const exportWithStyles = async (file) => {
    if (!file.originalBuffer) {
      const wb = XLSX.utils.book_new()
      file.sheets.forEach(sheet => {
        const ws = XLSX.utils.json_to_sheet(sheet.rows)
        XLSX.utils.book_append_sheet(wb, ws, sheet.name)
      })
      return XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    }

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(file.originalBuffer)

    // To preserve styles safely and avoid corruption from spliceRows, 
    // we'll reconstruct the sheets we modified.
    for (const sheetData of file.sheets) {
      const originalSheet = workbook.getWorksheet(sheetData.name)
      if (!originalSheet) continue

      // Create a temporary name that won't collide
      const tempName = `TMP_${Math.random().toString(36).slice(2, 7)}`
      const newSheet = workbook.addWorksheet(tempName)
      
      // Copy sheet-level properties
      newSheet.properties = originalSheet.properties
      newSheet.pageSetup = originalSheet.pageSetup
      newSheet.views = originalSheet.views

      // Copy column dimensions
      originalSheet.columns?.forEach((col, i) => {
        if (newSheet.getColumn(i + 1)) {
          newSheet.getColumn(i + 1).width = col.width
          newSheet.getColumn(i + 1).style = col.style
        }
      })

      // Copy and update header (row 1)
      const headerRow = originalSheet.getRow(1)
      const newHeaderRow = newSheet.getRow(1)
      headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const newCell = newHeaderRow.getCell(colNumber)
        newCell.value = cell.value
        newCell.style = cell.style
      })
      newHeaderRow.height = headerRow.height

      const colMap = {}
      headerRow.eachCell((cell, cIdx) => {
        if (cell.value) colMap[String(cell.value)] = cIdx
      })

      // Copy and update data rows
      sheetData.rows.forEach((row, index) => {
        const originalRow = originalSheet.getRow(row.__rowNum)
        const newRow = newSheet.getRow(index + 2) // index + 2 because row 1 is header

        // Copy original styles and values first
        originalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
           const newCell = newRow.getCell(colNumber)
           newCell.style = cell.style
           newCell.value = cell.value
        })
        newRow.height = originalRow.height

        // Overwrite with current JSON values for known columns
        sheetData.columns.forEach((colName) => {
          const colIdx = colMap[colName]
          if (colIdx) {
            newRow.getCell(colIdx).value = row[colName]
          }
        })
      })

      // Remove the original and rename the new one
      const originalName = originalSheet.name
      const originalId = originalSheet.id
      workbook.removeWorksheet(originalId)
      newSheet.name = originalName
    }

    return await workbook.xlsx.writeBuffer()
  }

  const downloadActiveFile = async () => {
    if (!activeFile) return toast.error('No active file selected')
    const toastId = toast.loading(`Preparing ${activeFile.name} with styles...`)
    try {
      const buffer = await exportWithStyles(activeFile)
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      saveAs(blob, activeFile.name.endsWith('.xlsx') || activeFile.name.endsWith('.xls') ? activeFile.name : `${activeFile.name}.xlsx`)
      toast.success(`Downloaded ${activeFile.name}`, { id: toastId })
    } catch (err) {
      console.error('Download error:', err)
      toast.error('Failed to download', { id: toastId })
    }
  }

  const downloadZip = async (type = 'all') => {
    const filesToDownload = type === 'modified' 
      ? loadedFiles.filter(f => f.modified)
      : loadedFiles

    if (filesToDownload.length === 0) {
      return toast.error(type === 'modified' ? 'No modified files to download' : 'No files loaded')
    }

    const zip = new JSZip()
    const toastId = toast.loading(`Preparing ${filesToDownload.length} files with styles...`)

    try {
      for (const file of filesToDownload) {
        const buffer = await exportWithStyles(file)
        zip.file(file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ? file.name : `${file.name}.xlsx`, buffer)
      }

      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `exported_files_${type}_${new Date().toISOString().slice(0,10)}.zip`)
      toast.success('Download started', { id: toastId })
    } catch (err) {
      console.error('ZIP error:', err)
      toast.error('Failed to create ZIP', { id: toastId })
    }
  }

  // View payload
  const buildViewPayload = () => ({
    name: viewName.trim(), fileName, sheet: activeSheet,
    columns: active?.columns || [], visibleColumns, pinnedColumns,
    searchColumns, query, caseSensitive, exact, searchEngine, sortBy, sortDir,
    virtualizeEnabled, columnWidths, shareSlug,
  })

  const saveView = async () => {
    if (!active) return toast.error('No data to save')
    if (!viewName.trim()) return toast.error('Please enter a view name before saving')
    setSaving(true)
    try {
      const payload = { id: crypto.randomUUID(), ...buildViewPayload(), createdAt: new Date().toISOString() }
      const res = await fetch('/api/views', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('Failed')
      toast.success('View saved')
      setViewName('')
      loadViews()
    } catch { toast.error('Could not save view') } finally { setSaving(false) }
  }

  const updateView = async () => {
    if (!selectedViewId) return
    if (!viewName.trim()) return toast.error('Please enter a view name before updating')
    try {
      const payload = buildViewPayload()
      const res = await fetch(`/api/views/${selectedViewId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('Failed')
      toast.success('View updated')
      loadViews()
    } catch { toast.error('Update failed') }
  }

  const loadViews = async () => { 
    try { 
      const r = await fetch('/api/views'); 
      const data = await r.json(); 
      setSavedViews(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to load views:', error)
      setSavedViews([])
    } 
  }

  const loadHistoryData = async () => {
    try {
      const uploadRes = await fetch('/api/history/upload')
      const searchRes = await fetch('/api/history/search')
      
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json()
        setUploadHistory(Array.isArray(uploadData) ? uploadData : [])
      }
      
      if (searchRes.ok) {
        const searchData = await searchRes.json()
        setSearchHistory(Array.isArray(searchData) ? searchData : [])
      }
    } catch (error) {
      console.error('Failed to load history:', error)
    }
  }

  useEffect(() => { 
    loadViews()
    loadHistoryData()
  }, [])

  const applyDirect = (v) => {
    setSelectedViewId(v.id || '')
    setViewName(v.name || '')
    setQuery(v.query || '')
    setCaseSensitive(!!v.caseSensitive)
    setExact(!!v.exact)
    setSearchColumns(v.searchColumns || [])
    setSearchEngine(v.searchEngine || 'fuse') // Restore search engine preference
    setSortBy(v.sortBy || '')
    setSortDir(v.sortDir || 'asc')
    setVisibleColumns(v.visibleColumns?.length ? v.visibleColumns : (active?.columns || []))
    setPinnedColumns(v.pinnedColumns || [])
    setVirtualizeEnabled(!!v.virtualizeEnabled)
    if (v.columnWidths) setColumnWidths(v.columnWidths)
    if (v.sheet && v.sheet !== activeSheet) setActiveSheet(v.sheet)
  }

  const applyView = (v) => {
    if (v.fileName && v.fileName !== fileName) {
      // Ask user to load the expected file, then re-apply
      pendingViewRef.current = v
      setExpectedFileName(v.fileName)
      setLoadDialogOpen(true)
      return
    }
    applyDirect(v)
    toast.success('View applied')
  }

  const handleLoadExpectedFile = async (files) => {
    const f = files?.[0]
    if (!f) return
    try {
      const buf = await readFileAsArrayBuffer(f)
      const wb = XLSX.read(buf, { type: 'array' })
      const newSheets = wb.SheetNames.map(name => { const rows = buildRows(wb.Sheets[name]); const columns = buildColumns(rows); return { name, rows, columns } })
      
      const newFileId = crypto.randomUUID()
      setLoadedFiles(prev => [...prev, { id: newFileId, name: f.name, sheets: newSheets, modified: false, originalBuffer: buf }])
      setActiveFileId(newFileId)
      setActiveSheet(newSheets?.[0]?.name || '')
      
      // post upload into history
      postUploadHistory({ fileName: f.name, totalRows: newSheets.reduce((a,s)=>a+(s.rows?.length||0),0), sheetCount: newSheets.length, sheets: newSheets.map(s => ({ name: s.name, rowCount: s.rows?.length || 0, colCount: s.columns?.length || 0 })) })
      // re-apply pending view
      if (pendingViewRef.current) applyDirect(pendingViewRef.current)
      setLoadDialogOpen(false)
      toast.success('Loaded expected file and applied view')
    } catch { toast.error('Failed to load file') }
  }

  const deleteView = async (id) => { try { const res = await fetch(`/api/views/${id}`, { method: 'DELETE' }); if (!res.ok) throw new Error('Failed'); setSavedViews(prev => prev.filter(v => v.id !== id)); if (selectedViewId === id) setSelectedViewId(''); toast.success('Deleted') } catch { toast.error('Delete failed') } }
  const renameView = async (id, name) => { try { const res = await fetch(`/api/views/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); if (!res.ok) throw new Error('Failed'); setSavedViews(prev => prev.map(v => v.id === id ? { ...v, name } : v)); if (selectedViewId === id) setViewName(name); setEditingViewId(''); setEditingName(''); toast.success('Renamed') } catch { toast.error('Rename failed') } }

  // Cleaning
  const trimWhitespace = () => { if (!active) return; active.rows = active.rows.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, typeof v === 'string' ? v.trim() : v]))); toast.success('Trimmed whitespace'); setSheets([...sheets]) }
  const detectTypes = () => { if (!active) return; const toDate = (s) => { const d = new Date(s); return isNaN(d.getTime()) ? s : d.toISOString() }; active.rows = active.rows.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => { if (typeof v === 'string') { if (isNumericVal(v)) return [k, Number(v)]; if (/^\d{4}-\d{2}-\d{2}/.test(v) || /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(v)) return [k, toDate(v)] } return [k, v] }))); toast.success('Detected basic types'); setSheets([...sheets]) }
  const removeDuplicates = () => { if (!active) return; const keyFn = (r) => JSON.stringify(dedupeColumns.map(c => r?.[c])); const seen = new Set(); const out = []; for (const r of active.rows) { const k = keyFn(r); if (!seen.has(k)) { seen.add(k); out.push(r) } } active.rows = out; toast.success('Removed duplicates'); setSheets([...sheets]); setDedupeOpen(false) }

  // Selection
  const rowKey = (row, idx) => `${idx}`
  const toggleRow = (row, idx) => { const k = rowKey(row, idx); const next = new Set(selectedRows); next.has(k) ? next.delete(k) : next.add(k); setSelectedRows(next) }
  const allOnPageSelected = pageRows.every((r, i) => selectedRows.has(rowKey(r, i + (page-1)*PAGE_SIZE)))
  const toggleAllOnPage = () => { const next = new Set(selectedRows); pageRows.forEach((r, i) => { const k = rowKey(r, i + (page-1)*PAGE_SIZE); allOnPageSelected ? next.delete(k) : next.add(k) }); setSelectedRows(next) }
  const exportSelected = (ext) => { const rows = []; pageRows.forEach((r, i) => { const k = rowKey(r, i + (page-1)*PAGE_SIZE); if (selectedRows.has(k)) rows.push(r) }); if (!rows.length) return toast.error('Select some rows first'); const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, activeSheet || 'Sheet1'); XLSX.writeFile(wb, `${fileName || 'data'}-selected.${ext}`, { bookType: ext }) }
  const copySelected = async () => { const rows = []; pageRows.forEach((r, i) => { const k = rowKey(r, i + (page-1)*PAGE_SIZE); if (selectedRows.has(k)) rows.push(r) }); if (!rows.length) return toast.error('Select some rows first'); await navigator.clipboard.writeText(JSON.stringify(rows, null, 2)); toast.success('Copied to clipboard') }

  // Resizer
  const onResizerMouseDown = (col, e) => { const th = e.currentTarget.parentElement; const startWidth = th.offsetWidth; const startX = e.clientX; const move = (ev) => { const w = Math.max(60, startWidth + (ev.clientX - startX)); setColumnWidths(prev => ({ ...prev, [col]: w })) }; const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }; document.addEventListener('mousemove', move); document.addEventListener('mouseup', up) }



  // DnD
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor))
  const onDragEnd = (event) => { const { active: act, over } = event; if (!over || act.id === over.id) return; const oldIndex = visibleColumns.indexOf(act.id); const newIndex = visibleColumns.indexOf(over.id); if (oldIndex === -1 || newIndex === -1) return; setVisibleColumns(prev => arrayMove(prev, oldIndex, newIndex)) }

  return (
    <div className="container py-8 theme-transition">
      <Card className="mb-6 theme-transition">
        <CardHeader>
          <div className="flex flex-col gap-6">
            {/* Title Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <TableIcon className="h-6 w-6"/>
                  Excel Explorer
                </CardTitle>
                <CardDescription className="text-base mt-2">
                  Upload XLSX, fuzzy search, filter, sort, paginate or virtual-scroll and export. Save filters to MongoDB.
                </CardDescription>
              </div>
              
              {/* Theme Toggle */}
              <div className="flex items-center gap-2">
                {mounted && (
                  <>
                    <div className="text-xs text-muted-foreground hidden sm:block">
                      {getThemeStatus()}
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex items-center gap-2">
                          {theme === 'light' ? (
                            <Sun className="h-4 w-4" />
                          ) : theme === 'dark' ? (
                            <Moon className="h-4 w-4" />
                          ) : (
                            <Monitor className="h-4 w-4" />
                          )}
                          Theme
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48">
                        <div className="space-y-2">
                          <div className="font-medium text-sm">Choose Theme</div>
                          <Button 
                            variant={theme === 'light' ? 'default' : 'outline'} 
                            size="sm" 
                            className="w-full justify-start"
                            onClick={() => setTheme('light')}
                          >
                            <Sun className="h-4 w-4 mr-2" />
                            Light
                          </Button>
                          <Button 
                            variant={theme === 'dark' ? 'default' : 'outline'} 
                            size="sm" 
                            className="w-full justify-start"
                            onClick={() => setTheme('dark')}
                          >
                            <Moon className="h-4 w-4 mr-2" />
                            Dark
                          </Button>
                          <Button 
                            variant={theme === 'system' ? 'default' : 'outline'} 
                            size="sm" 
                            className="w-full justify-start"
                            onClick={() => setTheme('system')}
                          >
                            <Monitor className="h-4 w-4 mr-2" />
                            System
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </>
                )}
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="space-y-4">
              {/* Export Actions */}
              <div className="flex flex-col gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-primary"/>
                    <span className="text-sm font-medium text-muted-foreground">Download Options</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {loadedFiles.length} files loaded • {loadedFiles.filter(f => f.modified).length} modified
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Button variant="outline" onClick={() => downloadZip('all')} className="flex items-center gap-2 h-12 bg-background hover:bg-primary/5 border-primary/20">
                    <FileArchive className="h-5 w-5 text-blue-500"/>
                    <div className="text-left">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Choice 1</div>
                      <div className="text-sm">All Loaded Files</div>
                    </div>
                  </Button>
                  
                  <Button variant="outline" onClick={() => downloadZip('modified')} className="flex items-center gap-2 h-12 bg-background hover:bg-primary/5 border-primary/20">
                    <FileCheck className="h-5 w-5 text-green-500"/>
                    <div className="text-left">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Choice 2</div>
                      <div className="text-sm">Modified Files Only</div>
                    </div>
                  </Button>
                  
                  <Button variant="outline" onClick={downloadActiveFile} className="flex items-center gap-2 h-12 bg-background hover:bg-primary/5 border-primary/20">
                    <FileIcon className="h-5 w-5 text-orange-500"/>
                    <div className="text-left">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Choice 3</div>
                      <div className="text-sm">Single (Active) File</div>
                    </div>
                  </Button>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                  <span className="text-xs font-medium text-muted-foreground">Quick Export (Current View):</span>
                  <Button variant="ghost" size="sm" onClick={downloadCSV} className="h-7 text-xs gap-1">
                    <Download className="h-3 w-3"/> CSV
                  </Button>
                  <Button variant="ghost" size="sm" onClick={downloadXLSX} className="h-7 text-xs gap-1">
                    <Download className="h-3 w-3"/> XLSX
                  </Button>
                </div>
              </div>

              {/* View Management */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Save className="h-4 w-4 text-primary"/>
                  <span className="text-sm font-medium text-muted-foreground">View Management</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Input 
                    value={viewName} 
                    onChange={(e) => setViewName(e.target.value)} 
                    placeholder="Enter view name..." 
                    className="w-48" 
                  />
                  <Button variant="outline" onClick={() => { setSelectedViewId(''); setViewName(''); toast.message('New view'); }} className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4"/>
                    New View
                  </Button>
                  {selectedViewId && (
                    <Button variant="secondary" onClick={updateView} className="flex items-center gap-2">
                      <Save className="h-4 w-4"/>
                      Update View
                    </Button>
                  )}
                  <Button onClick={saveView} disabled={saving} className="flex items-center gap-2">
                    <Save className="h-4 w-4"/>
                    {saving ? 'Saving...' : 'Save View'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Secondary Action Buttons - Organized in groups */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Data Tools Group */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <h3 className="text-sm font-semibold text-foreground">Data Tools</h3>
                </div>
                <div className="space-y-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start h-10">
                        <RefreshCw className="h-4 w-4 mr-2"/>
                        Clean Data
                        <span className="ml-auto text-xs text-muted-foreground">5 tools</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-4">
                        <div className="font-medium text-base">Data Cleaning Tools</div>
                        <div className="space-y-2">
                          <Button onClick={() => cleanData('trim')} variant="outline" className="w-full justify-start">
                            <RefreshCw className="h-4 w-4 mr-2"/>
                            Trim Whitespace
                          </Button>
                          <Button onClick={() => cleanData('duplicates')} variant="outline" className="w-full justify-start">
                            <Trash2 className="h-4 w-4 mr-2"/>
                            Remove Duplicates
                          </Button>
                          <Button onClick={() => cleanData('empty')} variant="outline" className="w-full justify-start">
                            <XIcon className="h-4 w-4 mr-2"/>
                            Remove Empty Rows
                          </Button>
                          <Button onClick={() => cleanData('lowercase')} variant="outline" className="w-full justify-start">
                            <span className="mr-2 text-xs">a</span>
                            Convert to Lowercase
                          </Button>
                          <Button onClick={() => cleanData('uppercase')} variant="outline" className="w-full justify-start">
                            <span className="mr-2 text-xs font-bold">A</span>
                            Convert to Uppercase
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start h-10">
                        <Columns3 className="h-4 w-4 mr-2"/>
                        Bulk Operations
                        <span className="ml-auto text-xs text-muted-foreground">6 ops</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-4">
                        <div className="font-medium text-base">Bulk Operations</div>
                        <div className="space-y-2">
                          <Button onClick={() => bulkOperation('selectAll')} variant="outline" className="w-full justify-start">
                            <Check className="h-4 w-4 mr-2"/>
                            Select All Rows
                          </Button>
                          <Button onClick={() => bulkOperation('selectVisible')} variant="outline" className="w-full justify-start">
                            <Eye className="h-4 w-4 mr-2"/>
                            Select Visible Rows
                          </Button>
                          <Button onClick={() => bulkOperation('deselectAll')} variant="outline" className="w-full justify-start">
                            <XIcon className="h-4 w-4 mr-2"/>
                            Deselect All
                          </Button>
                          <Button onClick={() => bulkOperation('invertSelection')} variant="outline" className="w-full justify-start">
                            <RefreshCw className="h-4 w-4 mr-2"/>
                            Invert Selection
                          </Button>
                          <Button onClick={() => bulkOperation('deleteSelected')} variant="destructive" className="w-full justify-start">
                            <Trash2 className="h-4 w-4 mr-2"/>
                            Delete Selected Rows
                          </Button>
                          <Button onClick={() => bulkOperation('duplicateSelected')} variant="outline" className="w-full justify-start">
                            <Copy className="h-4 w-4 mr-2"/>
                            Duplicate Selected Rows
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* History Group */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <h3 className="text-sm font-semibold text-foreground">History & Views</h3>
                </div>
                <div className="space-y-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start h-10">
                        <HistoryIcon className="h-4 w-4 mr-2"/>
                        Activity History
                        <span className="ml-auto text-xs text-muted-foreground">2 types</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-96">
                      <div className="space-y-4">
                        <div>
                          <div className="font-medium mb-2">Upload History</div>
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {uploadHistory.length === 0 ? (
                              <div className="text-sm text-muted-foreground">No uploads yet</div>
                            ) : (
                              uploadHistory.map(upload => (
                                <div key={upload.id} className="flex items-center justify-between px-2 py-1 bg-muted/40 rounded text-sm">
                                  <span className="truncate">{upload.fileName}</span>
                                  <span className="text-muted-foreground ml-2">{upload.totalRows} rows</span>
                                </div>
                              ))
                            )}
                          </div>
                          <Button size="sm" variant="outline" className="mt-2" onClick={() => clearUploadHistory()}>
                            Clear Upload History
                          </Button>
                        </div>
                        
                        <div>
                          <div className="font-medium mb-2">Search History</div>
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {searchHistory.length === 0 ? (
                              <div className="text-sm text-muted-foreground">No searches yet</div>
                            ) : (
                              searchHistory.slice(0, 10).map(search => (
                                <div key={search.id} className="flex items-center justify-between px-2 py-1 bg-muted/40 rounded text-sm">
                                  <span className="truncate">"{search.query}"</span>
                                  <Button size="sm" variant="ghost" onClick={() => applySearchFromHistory(search)}>
                                    Apply
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>
                          <Button size="sm" variant="outline" className="mt-2" onClick={() => clearSearchHistory()}>
                            Clear Search History
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground font-medium">Quick Actions</div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={trimWhitespace} 
                        className="h-8 text-xs"
                        title="Remove leading/trailing whitespace from all text fields"
                      >
                        <RefreshCw className="h-3 w-3 mr-1"/>
                        Trim
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={detectTypes} 
                        className="h-8 text-xs"
                        title="Automatically detect and convert data types"
                      >
                        <span className="mr-1 text-xs font-bold">T</span>
                        Types
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions Group */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
                </div>
                <div className="space-y-3">
                  <Dialog open={dedupeOpen} onOpenChange={setDedupeOpen}>
                    <Button size="sm" variant="outline" onClick={() => setDedupeOpen(true)} className="w-full justify-start h-10">
                      <Trash2 className="h-4 w-4 mr-2"/>
                      Remove Duplicates
                      <span className="ml-auto text-xs text-muted-foreground">Custom</span>
                    </Button>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Remove duplicates</DialogTitle></DialogHeader>
                      <div className="text-sm text-muted-foreground">Choose columns to define uniqueness</div>
                      <div className="grid grid-cols-2 gap-2 max-h-60 overflow-auto mt-3">
                        {(active?.columns || []).map(c => (
                          <label key={c} className="flex items-center gap-2 text-sm">
                            <Checkbox checked={dedupeColumns.includes(c)} onCheckedChange={() => setDedupeColumns(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} />
                            <span>{c}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setDedupeOpen(false)}>Cancel</Button>
                        <Button onClick={removeDuplicates} disabled={dedupeColumns.length===0}>Remove</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  {/* Quick Theme Toggle */}
                  {mounted && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                      className="w-full justify-start h-10"
                      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                    >
                      {theme === 'light' ? (
                        <Moon className="h-4 w-4 mr-2" />
                      ) : (
                        <Sun className="h-4 w-4 mr-2" />
                      )}
                      {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                      <span className="ml-auto text-xs text-muted-foreground">Theme</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Session & Backup Group */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <h3 className="text-sm font-semibold text-foreground">Session & Backup</h3>
                </div>
                <div className="space-y-3">
                  <Button 
                    onClick={handleBackupToServer} 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start h-10 border-orange-200 dark:border-orange-900/30 hover:bg-orange-50 dark:hover:bg-orange-900/10"
                  >
                    <CloudUpload className="h-4 w-4 mr-2 text-orange-600"/>
                    Backup to Server
                    {lastBackupTime && (
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {lastBackupTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </Button>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      onClick={() => window.location.reload()} 
                      variant="outline" 
                      size="sm" 
                      className="justify-start"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-2"/>
                      Reload
                    </Button>
                    <Button 
                      onClick={clearSession} 
                      variant="outline" 
                      size="sm" 
                      className="justify-start text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2"/>
                      Clear
                    </Button>
                  </div>
                  
                  <p className="text-[10px] text-muted-foreground px-1 italic">
                    Session is automatically saved to browser storage. Click 'Backup to Server' to save a physical file in the /backup folder.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
          <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
            <div className="flex justify-center mb-6">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="single">Single File Search</TabsTrigger>
                <TabsTrigger value="global">Global Search</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="global" className="mt-0">
              <div className="space-y-4">
                <div className="relative">
                  <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"/>
                  <Input 
                    value={globalQuery} 
                    onChange={(e) => setGlobalQuery(e.target.value)} 
                    placeholder="Search across all loaded files and sheets..." 
                    className="pl-10 h-12 text-lg bg-background"
                  />
                </div>
                
                {/* Global Search Options */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium whitespace-nowrap">Search Engine</Label>
                    <Select value={searchEngine} onValueChange={setSearchEngine}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fuse">Fuse.js</SelectItem>
                        <SelectItem value="minisearch">MiniSearch</SelectItem>
                        <SelectItem value="flexsearch">FlexSearch</SelectItem>
                        <SelectItem value="lunr">Lunr.js</SelectItem>
                        <SelectItem value="fuzzysort">FuzzySort</SelectItem>
                        <SelectItem value="ufuzzy">uFuzzy</SelectItem>
                        <SelectItem value="fuzzysearch">FuzzySearch</SelectItem>
                        <SelectItem value="fuzzy">Fuzzy.js</SelectItem>
                        <SelectItem value="microfuzz">MicroFuzz</SelectItem>
                        <SelectItem value="meilisearch">MeiliSearch</SelectItem>
                        <SelectItem value="matchsorter">Match Sorter</SelectItem>
                        <SelectItem value="fastfuzzy">Fast Fuzzy</SelectItem>
                        <SelectItem value="stringsimilarity">String Similarity</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-muted-foreground"/>
                      <Label htmlFor="exact-global" className="text-sm font-medium">Exact Match</Label>
                      <Switch id="exact-global" checked={exact} onCheckedChange={setExact}/>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="case-global" className="text-sm font-medium">Case Sensitive</Label>
                      <Switch id="case-global" checked={caseSensitive} onCheckedChange={setCaseSensitive}/>
                    </div>
                  </div>
                </div>

                {isGlobalSearching ? (
                  <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : globalResults.length > 0 ? (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">Found matches in {globalResults.length} file(s)</div>
                    <Tabs value={globalActiveFileId} onValueChange={setGlobalActiveFileId} className="w-full">
                      <TabsList className="flex flex-wrap h-auto mb-4">
                        {globalResults.map(f => (
                          <TabsTrigger key={f.fileId} value={f.fileId} className="whitespace-nowrap">
                            {f.fileName}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      
                      {globalResults.map(f => (
                        <TabsContent key={f.fileId} value={f.fileId} className="space-y-6">
                          {f.sheets.map((sheet, sIdx) => (
                            <div key={sIdx} className="space-y-2">
                              <h3 className="font-semibold flex items-center gap-2">
                                <TableIcon className="h-4 w-4" />
                                {sheet.sheetName}
                                <span className="text-xs text-muted-foreground font-normal">({sheet.matches.length} matches)</span>
                              </h3>
                              <div className="border rounded-md overflow-hidden bg-background">
                                <div className="max-h-[500px] overflow-auto">
                                  <table className="w-full text-sm">
                                    <thead className="bg-muted sticky top-0 z-10">
                                      <tr>
                                        {sheet.columns.map(c => (
                                          <th key={c} className="text-left px-3 py-2 whitespace-nowrap">{c}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sheet.matches.slice(0, 100).map((row, rIdx) => (
                                        <tr 
                                          key={rIdx} 
                                          className={`cursor-pointer hover:bg-muted/60 ${rIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                                          title="Double-click to edit in Single File view"
                                          onDoubleClick={() => {
                                            setActiveFileId(f.fileId);
                                            setActiveSheet(sheet.sheetName);
                                            setQuery(globalQuery);
                                            setMainTab('single');
                                            toast.success(`Jumped to ${f.fileName} - ${sheet.sheetName}`);
                                          }}
                                        >
                                          {sheet.columns.map(c => (
                                            <td key={c} className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                                              {highlightMatch(row[c] || '', globalQuery)}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                {sheet.matches.length > 100 && (
                                  <div className="p-2 text-center text-xs text-muted-foreground bg-muted/10 border-t">
                                    Showing first 100 matches. Double-click any row to view all in Single File mode.
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </TabsContent>
                      ))}
                    </Tabs>
                  </div>
                ) : globalQuery ? (
                  <div className="text-center p-12 text-muted-foreground border rounded-md border-dashed">No matches found across all files.</div>
                ) : (
                  <div className="text-center p-12 text-muted-foreground border rounded-md border-dashed">Enter a query to search across all files.</div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="single" className="mt-0">
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1 min-w-0 order-2 lg:order-1">
                  {loadedFiles.length === 0 ? (
                    <div className="border border-dashed rounded-lg p-12 flex flex-col items-center justify-center text-center bg-muted/30">
                      <FileUp className="h-10 w-10 mb-4 text-muted-foreground"/>
                      <div className="font-medium text-lg mb-1">Drag &amp; drop files here</div>
                      <div className="text-sm text-muted-foreground mb-4">Support for multiple XLSX/XLS files</div>
                      <Button onClick={onBrowse}>Browse Files</Button>
                    </div>
                  ) : activeFileId && sheets?.length > 0 ? (
                    <div className="space-y-6">
              {/* Search and Filter Controls */}
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <div className="relative flex-1 min-w-[280px]">
                    {isSearching ? (
                      <Loader2 className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-primary animate-spin"/>
                    ) : (
                      <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"/>
                    )}
                    <Input 
                      value={query} 
                      onChange={(e) => setQuery(e.target.value)} 
                      placeholder={isSearching ? "Searching..." : "Search across all columns..."}
                      className="pl-10 h-10 text-base"
                    />
                  </div>
                  
                  {/* Search Engine Selection */}
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium whitespace-nowrap">Search Engine</Label>
                    <Select value={searchEngine} onValueChange={setSearchEngine}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fuse">
                          <div className="flex flex-col">
                            <span className="font-medium">Fuse.js</span>
                            <span className="text-xs text-muted-foreground">Token + character scoring, weights per field</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="minisearch">
                          <div className="flex flex-col">
                            <span className="font-medium">MiniSearch</span>
                            <span className="text-xs text-muted-foreground">Full-text search with fuzzy matching, relevance ranking</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="flexsearch">
                          <div className="flex flex-col">
                            <span className="font-medium">FlexSearch</span>
                            <span className="text-xs text-muted-foreground">Extremely fast, supports phonetic and partial matching</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="lunr">
                          <div className="flex flex-col">
                            <span className="font-medium">Lunr.js</span>
                            <span className="text-xs text-muted-foreground">Search index, tf-idf scoring, good for full text</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="fuzzysort">
                          <div className="flex flex-col">
                            <span className="font-medium">FuzzySort</span>
                            <span className="text-xs text-muted-foreground">Very fast fuzzy string matching (RapidFuzz-like performance)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="ufuzzy">
                          <div className="flex flex-col">
                            <span className="font-medium">uFuzzy</span>
                            <span className="text-xs text-muted-foreground">Ultra-fast fuzzy search with typo tolerance</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="fuzzysearch">
                          <div className="flex flex-col">
                            <span className="font-medium">FuzzySearch</span>
                            <span className="text-xs text-muted-foreground">Simple and lightweight fuzzy string searching</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="fuzzy">
                          <div className="flex flex-col">
                            <span className="font-medium">Fuzzy.js</span>
                            <span className="text-xs text-muted-foreground">Simple fuzzy filter for arrays of strings</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="microfuzz">
                          <div className="flex flex-col">
                            <span className="font-medium">MicroFuzz</span>
                            <span className="text-xs text-muted-foreground">Minimal fuzzy search implementation</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="meilisearch">
                          <div className="flex flex-col">
                            <span className="font-medium">MeiliSearch</span>
                            <span className="text-xs text-muted-foreground">Instant full-text search (client-side mode)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="matchsorter">
                          <div className="flex flex-col">
                            <span className="font-medium">Match Sorter</span>
                            <span className="text-xs text-muted-foreground">Simple, expected, and deterministic best-match sorting</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="fastfuzzy">
                          <div className="flex flex-col">
                            <span className="font-medium">Fast Fuzzy</span>
                            <span className="text-xs text-muted-foreground">Very fast fuzzy string matching with advanced options</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="stringsimilarity">
                          <div className="flex flex-col">
                            <span className="font-medium">String Similarity</span>
                            <span className="text-xs text-muted-foreground">Finds degree of similarity between strings (Dice coefficient)</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Search Options */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-muted-foreground"/>
                      <Label htmlFor="exact" className="text-sm font-medium">Exact Match</Label>
                      <Switch id="exact" checked={exact} onCheckedChange={setExact}/>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="case" className="text-sm font-medium">Case Sensitive</Label>
                      <Switch id="case" checked={caseSensitive} onCheckedChange={setCaseSensitive}/>
                    </div>
                  </div>
                </div>

                {/* Column Management */}
                <div className="flex items-center gap-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="flex items-center gap-2">
                        <Columns3 className="h-4 w-4"/>
                        Manage Columns
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[720px]">
                      <div className="space-y-4">
                        <div className="text-sm font-medium">Visible Columns (drag to reorder)</div>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                          <SortableContext items={visibleColumns} strategy={rectSortingStrategy}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-auto pr-1">
                              {visibleColumns.map(col => (
                                <SortableColumnChip key={col} id={col} pinned={pinnedColumns.includes(col)} onTogglePinned={() => setPinnedColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col])} onRemoveVisible={() => setVisibleColumns(prev => prev.filter(c => c !== col))} />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setVisibleColumns(active?.columns || [])}>Show All</Button>
                          <Button size="sm" variant="outline" onClick={() => setVisibleColumns([])}>Hide All</Button>
                          <Button size="sm" variant="outline" onClick={() => setPinnedColumns([])}>Unpin All</Button>
                        </div>
                        <div className="text-sm font-medium pt-2">Hidden Columns</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto pr-1">
                          {hiddenColumns.map(col => (
                            <div key={col} className="flex items-center gap-2 px-2 py-1 rounded border bg-muted/40">
                              <span className="truncate" title={col}>{col}</span>
                              <div className="ml-auto flex items-center gap-2">
                                <Button size="sm" variant="outline" onClick={() => setVisibleColumns(prev => [...prev, col])}>Show</Button>
                                <label className="flex items-center gap-1 text-xs">
                                  <Checkbox checked={pinnedColumns.includes(col)} onCheckedChange={() => setPinnedColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col])} /> pin
                                </label>
                              </div>
                            </div>
                          ))}
                          {hiddenColumns.length === 0 && (<div className="text-sm text-muted-foreground">No hidden columns.</div>)}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  
                  {/* Quick Stats */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Showing {visibleColumns.length} of {active?.columns?.length || 0} columns</span>
                    <span>•</span>
                    <span>{sorted.length} rows filtered</span>
                  </div>
                </div>
              </div>





              {/* Sheets */}
              <Tabs value={activeSheet} onValueChange={setActiveSheet}>
                <TabsList className="flex-wrap">{sheets.map(s => (<TabsTrigger key={s.name} value={s.name}>{s.name}</TabsTrigger>))}</TabsList>
                {sheets.map(s => (
                  <TabsContent key={s.name} value={s.name} className="mt-4">
                    <div className="overflow-hidden border rounded-md">
                      <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                        <thead className="bg-muted sticky top-0 z-10">
                          <tr>
                            <th className="px-2 py-2 w-10"><Checkbox checked={allOnPageSelected} onCheckedChange={toggleAllOnPage}/></th>
                            {displayColumns.map(col => (
                              <th key={col} className="text-left px-3 py-2 cursor-pointer select-none relative" onClick={() => toggleSort(col)} style={{ width: columnWidths[col] ? `${columnWidths[col]}px` : undefined }}>
                                <div className="flex items-center gap-2">
                                  <span className="truncate" title={col}>{col}</span>
                                  {sortBy === col && <span className="text-xs text-muted-foreground">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                                </div>
                                <span onMouseDown={(e) => { e.stopPropagation(); onResizerMouseDown(col, e) }} className="absolute right-0 top-0 h-full w-1 cursor-col-resize" />
                              </th>
                            ))}
                          </tr>
                        </thead>
                      </table>
                      {virtualizeEnabled ? (
                        <div ref={bodyContainerRef} className="overflow-auto" style={{ height: 480 }}>
                          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
                            {rowVirtualizer.getVirtualItems().map(vi => { const row = sorted[vi.index]; const globalIdx = vi.index; return (
                              <div key={vi.key} style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }}>
                                <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                                  <tbody>
                                    <tr className={vi.index % 2 === 0 ? 'bg-background' : 'bg-muted/40'} style={{ height: VIRTUAL_ROW_HEIGHT }}>
                                      <td className="px-2 py-2 w-10"><Checkbox checked={selectedRows.has(String(globalIdx))} onCheckedChange={() => toggleRow(row, globalIdx)} /></td>
                                      {displayColumns.map(col => (
                                        <td 
                                          key={col} 
                                          className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis cursor-pointer hover:bg-muted/60" 
                                          style={{ width: columnWidths[col] ? `${columnWidths[col]}px` : undefined }}
                                          onDoubleClick={() => startEditingCell(vi.index, col, row?.[col])}
                                        >
                                          {isEditing && editingCell.rowIndex === vi.index && editingCell.column === col ? (
                                            <Input
                                              value={editingCell.value}
                                              onChange={(e) => setEditingCell(prev => ({...prev, value: e.target.value}))}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') saveEditingCell()
                                                if (e.key === 'Escape') cancelEditingCell()
                                              }}
                                              onBlur={saveEditingCell}
                                              className="h-6 px-1 text-xs"
                                              autoFocus
                                            />
                                          ) : (
                                            highlightMatch(row?.[col] ?? '', query)
                                          )}
                                        </td>
                                      ))}
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            ) })}
                          </div>
                        </div>
                      ) : (
                        <div className="overflow-auto">
                          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                            <tbody>
                              {pageRows.map((row, idx) => { const globalIdx = (page - 1) * PAGE_SIZE + idx; return (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/40'}>
                                  <td className="px-2 py-2 w-10"><Checkbox checked={selectedRows.has(String(globalIdx))} onCheckedChange={() => toggleRow(row, globalIdx)} /></td>
                                  {displayColumns.map(col => (
                                    <td 
                                      key={col} 
                                      className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis cursor-pointer hover:bg-muted/60" 
                                      style={{ width: columnWidths[col] ? `${columnWidths[col]}px` : undefined }}
                                      onDoubleClick={() => startEditingCell(globalIdx, col, row?.[col])}
                                    >
                                      {isEditing && editingCell.rowIndex === globalIdx && editingCell.column === col ? (
                                        <Input
                                          value={editingCell.value}
                                          onChange={(e) => setEditingCell(prev => ({...prev, value: e.target.value}))}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') saveEditingCell()
                                            if (e.key === 'Escape') cancelEditingCell()
                                          }}
                                          onBlur={saveEditingCell}
                                          className="h-6 px-1 text-xs"
                                          autoFocus
                                        />
                                      ) : (
                                        highlightMatch(row?.[col] ?? '', query)
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ) })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {!virtualizeEnabled && (
                      <div className="mt-4 space-y-4">
                        {/* Row Selection Summary */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-muted-foreground">Total: <span className="font-medium text-foreground">{sorted.length}</span> rows</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-muted-foreground">Selected: <span className="font-medium text-foreground">{selectedRows.size}</span></span>
                          </div>
                          
                          {selectedRows.size > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => exportSelected('csv')} className="flex items-center gap-2">
                                <Download className="h-3 w-3"/>
                                Export CSV
                              </Button>
                              <Button size="sm" onClick={() => exportSelected('xlsx')} className="flex items-center gap-2">
                                <Download className="h-3 w-3"/>
                                Export Excel
                              </Button>
                              <Button size="sm" variant="secondary" onClick={copySelected} className="flex items-center gap-2">
                                <Copy className="h-3 w-3"/>
                                Copy JSON
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-center">
                          <Pagination>
                            <PaginationContent>
                              <PaginationItem>
                                <PaginationPrevious 
                                  onClick={() => setPage(p => Math.max(1, p - 1))}
                                  className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                                />
                              </PaginationItem>
                              <div className="px-4 py-2 text-sm bg-muted/50 rounded-md">
                                Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
                              </div>
                              <PaginationItem>
                                <PaginationNext 
                                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                  className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
                                />
                              </PaginationItem>
                            </PaginationContent>
                          </Pagination>
                        </div>
                      </div>
                    )}

                    {/* Saved Views */}
                    <div className="mt-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Save className="h-4 w-4 text-primary"/>
                        <span className="font-medium">Saved Views</span>
                        <span className="text-sm text-muted-foreground">({Array.isArray(savedViews) ? savedViews.length : 0})</span>
                      </div>
                      
                      {!Array.isArray(savedViews) || savedViews.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Save className="h-8 w-8 mx-auto mb-2 opacity-50"/>
                          <div className="text-sm">No saved views yet</div>
                          <div className="text-xs">Save your current filters and column setup as a view</div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {savedViews.map(v => (
                            <div key={v.id} className={`p-3 rounded-lg border transition-colors ${selectedViewId === v.id ? 'bg-secondary border-secondary-foreground/20' : 'bg-background hover:bg-muted/50'}`}>
                              {editingViewId === v.id ? (
                                <div className="space-y-2">
                                  <Input 
                                    value={editingName} 
                                    onChange={(e) => setEditingName(e.target.value)} 
                                    className="h-8 text-sm"
                                    placeholder="View name"
                                  />
                                  <div className="flex gap-1">
                                    <Button size="sm" className="h-7 flex-1" onClick={() => renameView(v.id, editingName)}>
                                      <Check className="h-3 w-3 mr-1"/>
                                      Save
                                    </Button>
                                    <Button size="sm" variant="outline" className="h-7 flex-1" onClick={() => { setEditingViewId(''); setEditingName('') }}>
                                      <XIcon className="h-3 w-3 mr-1"/>
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between">
                                    <button 
                                      onClick={() => applyView(v)} 
                                      className="text-left hover:underline font-medium text-sm"
                                      title="Click to apply this view"
                                    >
                                      {v.name || v.fileName || 'View'}
                                    </button>
                                    <div className="flex gap-1">
                                      <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-6 w-6" 
                                        title="Rename view"
                                        onClick={() => { setEditingViewId(v.id); setEditingName(v.name || '') }}
                                      >
                                        <Pencil className="h-3 w-3"/>
                                      </Button>
                                      <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-6 w-6 text-destructive hover:text-destructive" 
                                        title="Delete view"
                                        onClick={() => deleteView(v.id)}
                                      >
                                        <Trash2 className="h-3 w-3"/>
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Sheet: {v.sheet} • {v.totalRows || 'Unknown'} rows
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* History */}
                    <div className="mt-6">
                      <div className="flex items-center gap-2 mb-4">
                        <HistoryIcon className="h-5 w-5 text-primary"/>
                        <span className="text-lg font-semibold">Activity History</span>
                      </div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="border-primary/20">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileUp className="h-4 w-4 text-blue-500"/>
                                <div>
                                  <CardTitle className="text-base">File Uploads</CardTitle>
                                  <CardDescription>Recent files you've processed</CardDescription>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => exportHistoryCSV(uploadHistory, 'uploads-history.csv')} className="text-xs">
                                  <Download className="h-3 w-3 mr-1"/>
                                  Export
                                </Button>
                                <Button size="sm" variant="destructive" onClick={clearUploads} className="text-xs">
                                  <Trash2 className="h-3 w-3 mr-1"/>
                                  Clear
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {uploadHistory.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <FileUp className="h-8 w-8 mx-auto mb-2 opacity-50"/>
                                <div className="text-sm">No uploads yet</div>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-64 overflow-auto">
                                {uploadHistory.map((h,i)=> (
                                  <div key={i} className={`p-3 rounded-lg border transition-colors ${i%2===0?'bg-background':'bg-muted/30'}`}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm truncate">{h.fileName}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {new Date(h.createdAt).toLocaleString()}
                                        </div>
                                      </div>
                                      <div className="text-right text-xs text-muted-foreground ml-2">
                                        <div>{h.sheetCount} sheets</div>
                                        <div>{h.totalRows} rows</div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                        
                        <Card className="border-primary/20">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Search className="h-4 w-4 text-green-500"/>
                                <div>
                                  <CardTitle className="text-base">Search History</CardTitle>
                                  <CardDescription>Recent fuzzy searches performed</CardDescription>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => exportHistoryCSV(searchHistory, 'search-history.csv')} className="text-xs">
                                  <Download className="h-3 w-3 mr-1"/>
                                  Export
                                </Button>
                                <Button size="sm" variant="destructive" onClick={clearSearches} className="text-xs">
                                  <Trash2 className="h-3 w-3 mr-1"/>
                                  Clear
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {searchHistory.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <Search className="h-8 w-8 mx-auto mb-2 opacity-50"/>
                                <div className="text-sm">No searches yet</div>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-64 overflow-auto">
                                {searchHistory.map((h,i)=> (
                                  <div key={i} className={`p-3 rounded-lg border transition-colors ${i%2===0?'bg-background':'bg-muted/30'}`}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm">"{h.query}"</div>
                                        <div className="text-xs text-muted-foreground">
                                          {new Date(h.createdAt).toLocaleString()} • {h.sheet}
                                        </div>
                                        {[h.caseSensitive?'case':null, h.exact?'exact':null, (h.searchColumns||[]).length?`cols:${h.searchColumns.length}`:null].filter(Boolean).length > 0 && (
                                          <div className="text-xs text-muted-foreground mt-1">
                                            {[h.caseSensitive?'case':null, h.exact?'exact':null, (h.searchColumns||[]).length?`cols:${h.searchColumns.length}`:null].filter(Boolean).join(' • ')}
                                          </div>
                                        )}
                                      </div>
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        onClick={() => applySearchFromHistory(h)}
                                        className="ml-2 text-xs"
                                        title="Apply this search"
                                      >
                                        Apply
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </div>




                  </TabsContent>
                ))}
              </Tabs>
                    </div>
                  ) : (
                    <div className="text-center p-12 border border-dashed rounded-lg text-muted-foreground">
                      Select a file from the sidebar to view it.
                    </div>
                  )}
                </div>

                {/* Sidebar for loaded files tree */}
                <div className="w-full lg:w-72 shrink-0 order-1 lg:order-2">
                  <Card className="sticky top-4">
                    <CardHeader className="pb-3 px-4">
                      <CardTitle className="text-base flex justify-between items-center">
                        Loaded Files
                        <Button variant="outline" size="sm" onClick={onBrowse} title="Add more files" className="h-8">
                          <FileUp className="h-4 w-4 mr-2" />
                          Add
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="max-h-[600px] overflow-y-auto p-4 pt-0 space-y-2">
                        {loadedFiles.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">No files loaded.</div>}
                        {loadedFiles.map(f => (
                          <div key={f.id} className="space-y-1">
                            <div 
                              className={`font-medium text-sm px-3 py-2 rounded-md cursor-pointer flex items-center justify-between transition-colors ${activeFileId === f.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted bg-muted/30'}`}
                              onClick={() => { setActiveFileId(f.id); if(!activeSheet || !f.sheets.find(s=>s.name===activeSheet)) setActiveSheet(f.sheets[0]?.name||''); }}
                            >
                              <span className="truncate pr-2">{f.name}</span>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className={`h-6 w-6 shrink-0 ${activeFileId === f.id ? 'text-primary-foreground hover:bg-primary-foreground/20' : 'text-muted-foreground hover:text-destructive'}`} 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setLoadedFiles(prev => prev.filter(x => x.id !== f.id)); 
                                  if (activeFileId === f.id) {
                                    const rem = loadedFiles.filter(x => x.id !== f.id);
                                    setActiveFileId(rem.length ? rem[0].id : '');
                                    setActiveSheet(rem.length ? rem[0].sheets[0]?.name||'' : '');
                                  }
                                }}
                              >
                                 <XIcon className="h-4 w-4" />
                              </Button>
                            </div>
                            {activeFileId === f.id && f.sheets.length > 1 && (
                              <div className="pl-3 space-y-1 border-l-2 border-muted ml-3 my-1">
                                {f.sheets.map(s => (
                                  <div 
                                    key={s.name} 
                                    className={`text-xs px-2 py-1.5 rounded cursor-pointer truncate transition-colors ${activeSheet === s.name ? 'bg-muted font-medium text-foreground' : 'hover:bg-muted/50 text-muted-foreground'}`}
                                    onClick={() => setActiveSheet(s.name)}
                                  >
                                    {s.name}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={(e) => onFiles(e.target.files)}/>
        </CardContent>
      </Card>

      {/* Load expected file dialog */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Load the last used file</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">This view was saved for file: <span className="font-medium text-foreground">{expectedFileName}</span>. Please select that file to apply the view correctly.</div>
          <div className="mt-4">
            <input type="file" accept=".xlsx,.xls" onChange={(e) => handleLoadExpectedFile(e.target.files)} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}