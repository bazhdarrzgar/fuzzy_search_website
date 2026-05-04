import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function POST(request) {
  try {
    const body = await request.json()
    const { fileName, data, timestamp } = body

    if (!data) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 })
    }

    const backupDir = path.join(process.cwd(), 'backup')
    
    // Ensure backup directory exists
    await fs.mkdir(backupDir, { recursive: true })

    // Create a safe filename
    const safeFileName = fileName ? fileName.replace(/[^a-z0-9.]/gi, '_') : 'backup'
    const dateStr = timestamp ? new Date(timestamp).toISOString().replace(/[:.]/g, '-') : new Date().toISOString().replace(/[:.]/g, '-')
    const fullPath = path.join(backupDir, `${safeFileName}_${dateStr}.json`)

    await fs.writeFile(fullPath, JSON.stringify(data, null, 2))

    return NextResponse.json({ ok: true, path: fullPath })
  } catch (error) {
    console.error('Backup Error:', error)
    return NextResponse.json({ error: 'Failed to save backup: ' + error.message }, { status: 500 })
  }
}
