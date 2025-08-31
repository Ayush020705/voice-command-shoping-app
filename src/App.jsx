import React, { useEffect, useRef, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

const synth = window.speechSynthesis

function speak(text) {
  if (!synth) return
  const utter = new SpeechSynthesisUtterance(text)
  synth.speak(utter)
}

export default function App() {
  const [transcript, setTranscript] = useState('')
  const [list, setList] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [lang, setLang] = useState('en-US') // try 'hi-IN' for Hindi
  const [listening, setListening] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [query, setQuery] = useState('')
  const [brand, setBrand] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  const recRef = useRef(null)

  useEffect(() => {
    refreshList()
    refreshSuggestions()
  }, [])

  function refreshList() {
    setListLoading(true)
    fetch(`${API_BASE}/api/list`)
      .then(r => r.json())
      .then(data => setList(data.items || []))
      .catch(err => setListError(String(err)))
      .finally(() => setListLoading(false))
  }

  function refreshSuggestions() {
    fetch(`${API_BASE}/api/suggest`)
      .then(r => r.json())
      .then(data => setSuggestions(data.suggestions || []))
      .catch(() => {})
  }

  function onResult(text) {
    setTranscript(text)
  }

  async function parseAndAct(text) {
    try {
      const res = await fetch(`${API_BASE}/api/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: lang })
      })
      const data = await res.json()
      if (data.speech) speak(data.speech)

      // Act based on intent
      if (data.intent === 'add_item' && data.item) {
        await fetch(`${API_BASE}/api/list/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item: data.item, quantity: data.quantity || 1, category: data.category || 'uncategorized' })
        })
        refreshList()
        refreshSuggestions()
      } else if (data.intent === 'remove_item' && data.item) {
        await fetch(`${API_BASE}/api/list/remove`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item: data.item })
        })
        refreshList()
        refreshSuggestions()
      } else if (data.intent === 'search_item') {
        setQuery(data.item || '')
        if (data.filters?.brand) setBrand(data.filters.brand)
        if (data.filters?.maxPrice) setMaxPrice(String(data.filters.maxPrice))
        await runSearch(data.item || query, data.filters?.brand || brand, data.filters?.maxPrice || maxPrice)
      }
    } catch (e) {
      console.error(e)
    }
  }

  async function runSearch(q, b, p) {
    const res = await fetch(`${API_BASE}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, brand: b, maxPrice: p ? Number(p) : undefined })
    })
    const data = await res.json()
    alert('Search results:\n' + data.results.map(r => `${r.name} (${r.brand}) - $${r.price}`).join('\n'))
  }

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Your browser does not support Web Speech API.')
      return
    }
    const rec = new SpeechRecognition()
    rec.lang = lang
    rec.interimResults = true
    rec.continuous = false
    rec.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join(' ')
      onResult(t)
    }
    rec.onend = async () => {
      setListening(false)
      if (transcript.trim()) {
        await parseAndAct(transcript.trim())
      }
    }
    rec.onerror = () => setListening(false)
    recRef.current = rec
    setListening(true)
    rec.start()
  }

  function stopListening() {
    if (recRef.current) recRef.current.stop()
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 16, maxWidth: 900, margin: '0 auto' }}>
      <h1>🛒 Voice Shopping Assistant</h1>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={lang} onChange={e => setLang(e.target.value)}>
          <option value="en-US">English (US)</option>
          <option value="en-IN">English (India)</option>
          <option value="hi-IN">Hindi (India)</option>
        </select>
        {!listening ? (
          <button onClick={startListening}>🎙️ Start</button>
        ) : (
          <button onClick={stopListening}>⏹ Stop</button>
        )}
        <div style={{ flex: 1, minWidth: 240, border: '1px solid #ccc', padding: 8, borderRadius: 8 }}>
          <strong>Heard:</strong> {transcript || '—'}
        </div>
      </div>

      <h2 style={{ marginTop: 24 }}>Your List</h2>
      {listLoading ? <p>Loading…</p> : listError ? <p style={{color:'red'}}>{listError}</p> : (
        <ul>
          {list.map((it, idx) => (
            <li key={idx}>
              {it.item} — {it.quantity} {it.category ? `(${it.category})` : ''}
            </li>
          ))}
        </ul>
      )}

      <h2 style={{ marginTop: 24 }}>Voice Search (or type)</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="query (e.g., organic apples)" value={query} onChange={e => setQuery(e.target.value)} />
        <input placeholder="brand (optional)" value={brand} onChange={e => setBrand(e.target.value)} />
        <input placeholder="max price (optional)" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
        <button onClick={() => runSearch(query, brand, maxPrice)}>Search</button>
      </div>

      <h2 style={{ marginTop: 24 }}>Smart Suggestions</h2>
      <ul>
        {suggestions.map((s, i) => <li key={i}>{s}</li>)}
      </ul>

      <p style={{opacity:.7, marginTop: 32}}>
        Tip: Try saying <em>"Add two bottles of water"</em>, <em>"Remove milk"</em>, 
        <em>"Find toothpaste under five dollars"</em>, or in Hindi <em>"Do bread jodo"</em>.
      </p>
    </div>
  )
}
