import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createDashboardPdf } from '@/services/export.service'

const PNG_PATH = path.resolve(import.meta.dirname, 'fixtures/dashboard-capture.png')
const WIDTH = 96
const HEIGHT = 96

let dataUrl: string

beforeAll(async () => {
  const buffer = await readFile(PNG_PATH)
  dataUrl = 'data:image/png;base64,' + buffer.toString('base64')
})

describe('PDF export', () => {
  it('compresses the embedded capture instead of storing raw pixels', async () => {
    const pdf = await createDashboardPdf(dataUrl, WIDTH, HEIGHT)
    const bytes = Buffer.from(pdf.output('arraybuffer'))
    const text = bytes.toString('latin1')

    const imageStart = text.indexOf('/Subtype /Image')
    const imageDict = text.slice(imageStart, text.indexOf('stream', imageStart))
    expect(imageStart).toBeGreaterThan(-1)
    expect(imageDict).toContain('/Filter /FlateDecode')
    expect(bytes.length).toBeLessThan(WIDTH * HEIGHT * 3)
  })

  it('splits a tall capture across pages and reuses one image', async () => {
    const pdf = await createDashboardPdf(dataUrl, WIDTH, HEIGHT * 6)
    const text = Buffer.from(pdf.output('arraybuffer')).toString('latin1')

    expect(pdf.getNumberOfPages()).toBeGreaterThan(1)
    expect(text.match(/\/Subtype \/Image/g)).toHaveLength(1)
  })

  it('rejects an invalid capture size', async () => {
    await expect(createDashboardPdf(dataUrl, 0, HEIGHT)).rejects.toThrow(
      'Ukuran gambar dashboard tidak valid.',
    )
  })
})