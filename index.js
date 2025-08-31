import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'

const app = express()
app.use(cors())
app.use(express.json())

/** In-memory state **/
let list = [] // {item, quantity, category}
const historyCounts = {} // item -> count

const catalog = [
  { name: 'Milk 1L', brand: 'DairyPure', price: 2.5, category: 'dairy', seasonal: false },
  { name: 'Almond Milk 1L', brand: 'Almond Dream', price: 3.0, category: 'dairy', seasonal: false },
  { name: 'Bread loaf', brand: 'BakeHouse', price: 1.8, category: 'bakery', seasonal: false },
  { name: 'Apples 1kg (Organic)', brand: 'FreshFields', price: 3.2, category: 'produce', seasonal: true },
  { name: 'Bananas 1kg', brand: 'TropicFarm', price: 1.5, category: 'produce', seasonal: true },
  { name: 'Toothpaste 100g', brand: 'Sparkle', price: 2.2, category: 'personal', seasonal: false },
  { name: 'Bottled Water 1L', brand: 'ClearSpring', price: 0.9, category: 'beverages', seasonal: false },
  { name: 'Yogurt 500g', brand: 'DairyPure', price: 1.6, category: 'dairy', seasonal: false },
  { name: 'Eggs dozen', brand: 'FarmNest', price: 2.9, category: 'dairy', seasonal: false },
  { name: 'Rice 5kg', brand: 'GrainGold', price: 6.5, category: 'staples', seasonal: false }
]

const substitutes = {
  'milk': ['almond milk', 'oat milk', 'soy milk'],
  'bread': ['brown bread', 'multigrain bread'],
  'yogurt': ['greek yogurt'],
  'toothpaste': ['gel toothpaste', 'herbal toothpaste']
}

function incrementHistory(item) {
  const key = (item || '').toLowerCase()
  historyCounts[key] = (historyCounts[key] || 0) + 1
}

app.get('/api/list', (req, res) => {
  res.json({ items: list })
})

app.post('/api/list/add', (req, res) => {
  const { item, quantity = 1, category = 'uncategorized' } = req.body || {}
  if (!item) return res.status(400).json({ error: 'item required' })
  const idx = list.findIndex(x => x.item.toLowerCase() === item.toLowerCase())
  if (idx >= 0) {
    list[idx].quantity += Number(quantity) || 1
  } else {
    list.push({ item, quantity: Number(quantity) || 1, category })
  }
  incrementHistory(item)
  res.json({ ok: true })
})

app.post('/api/list/remove', (req, res) => {
  const { item } = req.body || {}
  if (!item) return res.status(400).json({ error: 'item required' })
  list = list.filter(x => x.item.toLowerCase() !== item.toLowerCase())
  res.json({ ok: true })
})

app.post('/api/search', (req, res) => {
  const { query = '', brand = '', maxPrice } = req.body || {}
  const q = query.toLowerCase()
  const results = catalog.filter(p => {
    const hit = p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    const brandOk = brand ? p.brand.toLowerCase().includes(brand.toLowerCase()) : true
    const priceOk = typeof maxPrice === 'number' ? p.price <= maxPrice : true
    return hit && brandOk && priceOk
  })
  res.json({ results })
})

app.get('/api/suggest', (req, res) => {
  const suggestions = []
  // History-based
  const sortedHist = Object.entries(historyCounts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k])=>k)
  sortedHist.forEach(k => suggestions.push(`You often buy ${k}. Want to add it?`))
  // Seasonal
  catalog.filter(c => c.seasonal).slice(0,2).forEach(c => suggestions.push(`It's a good season for ${c.name}.`))
  // Substitutes prompt
  const last = list[list.length-1]
  if (last) {
    const base = (last.item || '').toLowerCase()
    Object.keys(substitutes).forEach(k => {
      if (base.includes(k)) {
        suggestions.push(`If ${base} is unavailable, try ${substitutes[k][0]}.`)
      }
    })
  }
  res.json({ suggestions })
})

// Proxy to ML service for parsing
const ML_URL = process.env.ML_URL || 'http://localhost:8000/parse'
app.post('/api/parse', async (req, res) => {
  try {
    const r = await fetch(ML_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    })
    const data = await r.json()
    res.json(data)
  } catch (e) {
    // Simple fallback parser if ML is down
    const text = (req.body?.text || '').toLowerCase()
    let intent = 'unknown', item = '', qty = 1
    if (text.startsWith('add ') || text.includes(' add ')) intent='add_item'
    if (text.startsWith('remove ') || text.includes(' remove ')) intent='remove_item'
    const mQty = text.match(/(\d+)/)
    if (mQty) qty = Number(mQty[1])
    const tokens = text.replace(/add|remove|please|to|my|list|find|search/g,'').trim()
    item = tokens.split(' ').slice(-2).join(' ')
    res.json({ intent, item, quantity: qty, speech: `Okay, ${intent} ${item || ''}`.trim() })
  }
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log('API listening on', PORT))
