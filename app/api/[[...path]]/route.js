import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'

let client
let db

async function connectToMongo() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
  }
  return db
}

function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    const db = await connectToMongo()

    if ((route === '/' || route === '/root') && method === 'GET') {
      return handleCORS(NextResponse.json({ message: 'Hello World' }))
    }

    // Views CRUD
    if (route === '/views' && method === 'GET') {
      const items = await db.collection('views').find({}).sort({ createdAt: -1 }).limit(200).toArray()
      const cleaned = items.map(({ _id, ...rest }) => rest)
      return handleCORS(NextResponse.json(cleaned))
    }

    if (route === '/views' && method === 'POST') {
      const body = await request.json()
      const item = {
        id: body.id || uuidv4(),
        name: body.name || '',
        fileName: body.fileName || '',
        sheet: body.sheet || '',
        columns: Array.isArray(body.columns) ? body.columns : [],
        visibleColumns: Array.isArray(body.visibleColumns) ? body.visibleColumns : [],
        pinnedColumns: Array.isArray(body.pinnedColumns) ? body.pinnedColumns : [],
        searchColumns: Array.isArray(body.searchColumns) ? body.searchColumns : [],
        filterBuilder: body.filterBuilder || null,
        pivot: body.pivot || null,
        columnWidths: body.columnWidths || {},
        query: body.query || '',
        caseSensitive: !!body.caseSensitive,
        exact: !!body.exact,
        sortBy: body.sortBy || '',
        sortDir: body.sortDir === 'desc' ? 'desc' : 'asc',
        virtualizeEnabled: !!body.virtualizeEnabled,
        shareSlug: body.shareSlug || null,
        createdAt: body.createdAt ? new Date(body.createdAt) : new Date(),
      }
      await db.collection('views').insertOne(item)
      return handleCORS(NextResponse.json({ ok: true, id: item.id }))
    }

    if (route.startsWith('/views/share/') && method === 'GET') {
      const slug = route.split('/')[3]
      const doc = await db.collection('views').findOne({ shareSlug: slug })
      if (!doc) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const { _id, ...rest } = doc
      return handleCORS(NextResponse.json(rest))
    }

    if (route.startsWith('/views/') && method === 'GET') {
      const id = route.split('/')[2]
      const doc = await db.collection('views').findOne({ id })
      if (!doc) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const { _id, ...rest } = doc
      return handleCORS(NextResponse.json(rest))
    }

    if (route.startsWith('/views/') && method === 'PUT') {
      const id = route.split('/')[2]
      const body = await request.json()
      const $set = {}
      const allowed = ['name','fileName','sheet','columns','visibleColumns','pinnedColumns','searchColumns','filterBuilder','pivot','columnWidths','query','caseSensitive','exact','sortBy','sortDir','virtualizeEnabled','shareSlug']
      for (const k of allowed) if (k in body) $set[k] = body[k]
      await db.collection('views').updateOne({ id }, { $set })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    if (route.startsWith('/views/') && method === 'DELETE') {
      const id = route.split('/')[2]
      await db.collection('views').deleteOne({ id })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // History: uploads
    if (route === '/history/upload' && method === 'GET') {
      const items = await db.collection('upload_history').find({}).sort({ createdAt: -1 }).limit(200).toArray()
      const cleaned = items.map(({ _id, ...rest }) => rest)
      return handleCORS(NextResponse.json(cleaned))
    }

    if (route === '/history/upload' && method === 'POST') {
      const body = await request.json()
      const item = {
        id: uuidv4(),
        fileName: body.fileName || '',
        totalRows: body.totalRows || 0,
        sheetCount: body.sheetCount || 0,
        sheets: Array.isArray(body.sheets) ? body.sheets : [],
        createdAt: new Date(),
      }
      await db.collection('upload_history').insertOne(item)
      return handleCORS(NextResponse.json({ ok: true }))
    }

    if (route === '/history/upload' && method === 'DELETE') {
      await db.collection('upload_history').deleteMany({})
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // History: searches
    if (route === '/history/search' && method === 'GET') {
      const items = await db.collection('search_history').find({}).sort({ createdAt: -1 }).limit(300).toArray()
      const cleaned = items.map(({ _id, ...rest }) => rest)
      return handleCORS(NextResponse.json(cleaned))
    }

    if (route === '/history/search' && method === 'POST') {
      const body = await request.json()
      const item = {
        id: uuidv4(),
        query: body.query || '',
        caseSensitive: !!body.caseSensitive,
        exact: !!body.exact,
        searchColumns: Array.isArray(body.searchColumns) ? body.searchColumns : [],
        sheet: body.sheet || '',
        fileName: body.fileName || '',
        createdAt: new Date(),
      }
      if (!item.query) return handleCORS(NextResponse.json({ ok: true }))
      await db.collection('search_history').insertOne(item)
      return handleCORS(NextResponse.json({ ok: true }))
    }

    if (route === '/history/search' && method === 'DELETE') {
      await db.collection('search_history').deleteMany({})
      return handleCORS(NextResponse.json({ ok: true }))
    }

    return handleCORS(NextResponse.json({ error: `Route ${route} not found` }, { status: 404 }))
  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute