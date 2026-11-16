import type { jsPDF } from 'jspdf'
import type { DatasetColumn, DatasetRow } from '@/domain/dataset.types'
import { toNumber } from '@/lib/value-utils'

export type ExportFormat = 'png' | 'pdf' | 'csv'

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (value instanceof Date) return formatLocalDate(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function csvEscape(value: string, forceText = false): string {
  // Quoting alone does not stop spreadsheet formula execution.
  const formulaLike = /^[\s\uFEFF]*[=+\-@]/.test(value)
  const safeValue = formulaLike && (forceText || toNumber(value) === null) ? "'" + value : value
  if (/[",\n\r]/.test(safeValue)) {
    return '"' + safeValue.replace(/"/g, '""') + '"'
  }
  return safeValue
}

export function buildCsv(rows: DatasetRow[], columns: DatasetColumn[]): string {
  const header = columns.map((column) => csvEscape(column.displayName, true)).join(',')
  const body = rows.map((row) =>
    columns.map((column) => {
      const value = row[column.id]
      const isText = typeof value === 'string' && toNumber(value) === null
      return csvEscape(formatCsvValue(value), isText)
    }).join(','),
  )
  return '\uFEFF' + [header, ...body].join('\r\n') + '\r\n'
}

export function sanitizeFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-. ]+|[-. ]+$/g, '')
  return cleaned || 'dashboard'
}

export function buildExportFileName(
  dashboardName: string,
  extension: ExportFormat,
  date = new Date(),
): string {
  const stamp = `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`
  return `${sanitizeFileName(dashboardName)}-${stamp}.${extension}`
}

export function downloadCsv(csv: string, fileName: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function captureNodeAsPng(node: HTMLElement): Promise<string> {
  const { toPng } = await import('html-to-image')
  return toPng(node, {
    pixelRatio: 2,
    backgroundColor: '#f8fafc',
    cacheBust: true,
    filter: (child) =>
      !(child instanceof HTMLElement && child.dataset.exportExclude !== undefined),
  })
}

function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function loadImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('Gambar dashboard gagal dimuat.'))
    image.src = src
  })
}

export async function createDashboardPdf(
  dataUrl: string,
  width: number,
  height: number,
): Promise<jsPDF> {
  const { jsPDF: JsPdf } = await import('jspdf')
  // Without compress, jsPDF embeds the capture as raw RGB — a 2194x2384 dashboard
  // becomes a 15 MB file instead of ~200 KB.
  const pdf = new JsPdf({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 10
  const contentWidth = pageWidth - margin * 2
  const contentHeight = pageHeight - margin * 2
  const imageHeight = contentWidth * (height / width)
  if (!(width > 0) || !(height > 0) || !Number.isFinite(imageHeight)) {
    throw new Error('Ukuran gambar dashboard tidak valid.')
  }
  const pageCount = Math.max(1, Math.ceil(imageHeight / contentHeight))

  for (let page = 0; page < pageCount; page += 1) {
    if (page > 0) pdf.addPage()
    pdf.addImage(
      dataUrl,
      'PNG',
      margin,
      margin - page * contentHeight,
      contentWidth,
      imageHeight,
    )
  }

  return pdf
}

export async function downloadPdfFromImage(
  dataUrl: string,
  fileName: string,
): Promise<void> {
  const { width, height } = await loadImageSize(dataUrl)
  const pdf = await createDashboardPdf(dataUrl, width, height)
  pdf.save(fileName)
}

export function downloadPngDataUrl(dataUrl: string, fileName: string): void {
  downloadDataUrl(dataUrl, fileName)
}

export async function waitForVisuals(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await new Promise((resolve) => setTimeout(resolve, 300))
}
