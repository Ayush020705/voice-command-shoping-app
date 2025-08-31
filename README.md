# Voice Command Shopping Assistant

A complete, locally runnable implementation of a voice-based shopping list manager with smart suggestions.

## Stack
- Frontend: React (Vite) + Web Speech API (voice recognition + TTS)
- Backend: Node.js + Express (shopping list, search, suggestions)
- ML (NLP): Python + FastAPI (intent classification + entity extraction)

## Features
- Voice input to add/remove/search products; multilingual recognition via browser's Web Speech API language setting
- Smart suggestions from history, seasonal flags, and substitutes
- Categorized shopping list with quantities
- Voice-activated search with brand/price filters
- Minimal, mobile-friendly UI with real-time visual feedback

## Monorepo Structure
```
voice-command-shopping-assistant/
├─ frontend/          # React app
├─ backend/           # Node/Express API
└─ ml/                # FastAPI NLP microservice
```

## Prerequisites
- Node.js 18+ and npm
- Python 3.9+
- (Optional) A modern Chromium-based browser for best speech support

## Quick Start (3 terminals)
### 1) ML service
```
cd ml
python -m venv .venv && . .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

### 2) Backend
```
cd backend
npm install
npm run dev
```

### 3) Frontend
```
cd frontend
npm install
npm run dev
```
Open the printed local URL (usually http://localhost:5173).
Deployed Project Link (usually [http://localhost:5173](https://voice-command-shopin-git-5d406a-ayush-mishras-projects-7813fe2a.vercel.app/)).

## Notes
- The ML service trains on startup using a lightweight synthetic dataset that covers typical phrasings
  in English and Hindi. You can replace or augment the dataset in `ml/app.py` under `seed_training_data`.
- The backend stores data in-memory (process-lifetime). For persistence, swap in a database (MongoDB, Postgres).

## Deployment
- You can deploy the backend and ML service on any free tier (e.g., Render, Railway) and host the frontend on Netlify/Vercel.
- Be sure to set the `VITE_API_BASE` env var in the frontend to point to your backend URL.
#
