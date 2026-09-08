/**
 * Tests for multi-platform menu extractors.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  STRUCTURED_MIN_ITEMS,
  extractChowbus,
  extractGenericJsonMenu,
  extractStructuredMenu,
  extractStructuredMenuFromHtml,
  isMostlyTemplatePlaceholders,
  looksLikeBotWall,
  parseHonorMenuCategoryGroup,
} from './menuExtractors.js'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = (name) => readFileSync(join(here, 'fixtures', name), 'utf8')

describe('extractChowbus', () => {
  it('extracts dishes from Chowbus-like embedded JSON', () => {
    const items = extractChowbus(fixture('chowbus-snippet.html'))
    expect(items.length).toBeGreaterThanOrEqual(STRUCTURED_MIN_ITEMS)
    expect(items.some((i) => /edamame/i.test(i.name))).toBe(true)
    expect(items.find((i) => /salmon nigiri/i.test(i.name))?.listPrice).toBe(3.5)
  })
})

describe('parseHonorMenuCategoryGroup', () => {
  it('parses cents prices into dollars', () => {
    const payload = JSON.parse(fixture('honormenu-categoryGroup.json'))
    const items = parseHonorMenuCategoryGroup(payload)
    expect(items.length).toBeGreaterThanOrEqual(STRUCTURED_MIN_ITEMS)
    const miso = items.find((i) => /miso soup/i.test(i.name))
    expect(miso).toBeTruthy()
    expect(miso.listPrice).toBe(2.95)
  })
})

describe('extractGenericJsonMenu', () => {
  it('mines __NEXT_DATA__ style menus', () => {
    const items = extractGenericJsonMenu(fixture('generic-json-menu.html'))
    expect(items.length).toBeGreaterThanOrEqual(STRUCTURED_MIN_ITEMS)
    expect(items.some((i) => /dragon roll/i.test(i.name))).toBe(true)
  })
})

describe('empty SPA shells', () => {
  it('does not invent dishes from Vue placeholders', () => {
    const result = extractStructuredMenuFromHtml({
      url: 'https://order.example.honormenu.com/',
      html: fixture('empty-vue-shell.html'),
    })
    expect(result.items.length).toBe(0)
    expect(isMostlyTemplatePlaceholders('{{a}} {{b}} {{c}} xx')).toBe(true)
  })
})

describe('looksLikeBotWall', () => {
  it('detects common challenge pages', () => {
    expect(looksLikeBotWall('<title>Just a moment...</title>cf-browser-verification', '')).toBe(
      true,
    )
    expect(looksLikeBotWall('<html>Salmon Nigiri $3</html>', 'Salmon Nigiri')).toBe(false)
  })
})

describe('extractStructuredMenu HonorMenu HTTP', () => {
  it('uses categoryGroup API for honormenu hosts', async () => {
    const payload = JSON.parse(fixture('honormenu-categoryGroup.json'))
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify(payload),
    }))
    const result = await extractStructuredMenu({
      url: 'https://order.5122435880.honormenu.com/',
      html: fixture('empty-vue-shell.html'),
      fetchImpl,
    })
    expect(fetchImpl).toHaveBeenCalled()
    expect(result.platform).toBe('honormenu')
    expect(result.items.length).toBeGreaterThanOrEqual(STRUCTURED_MIN_ITEMS)
  })
})
