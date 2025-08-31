from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.svm import LinearSVC
from sklearn.pipeline import Pipeline
import re

app = FastAPI(title='NLP Parser')

class ParseIn(BaseModel):
    text: str
    language: Optional[str] = 'en-US'

class ParseOut(BaseModel):
    intent: str
    item: Optional[str] = None
    quantity: Optional[int] = 1
    unit: Optional[str] = None
    category: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None
    speech: Optional[str] = None

INTENTS = ['add_item','remove_item','search_item','other']

# Seed synthetic training data with both English and Hindi phrasings
def seed_training_data():
    data = [
        ('add milk', 'add_item'),
        ('please add two bottles of water', 'add_item'),
        ('add bread to my list', 'add_item'),
        ('insert apples', 'add_item'),
        ('remove milk', 'remove_item'),
        ('delete bananas from list', 'remove_item'),
        ('take out bread', 'remove_item'),
        ('find organic apples', 'search_item'),
        ('search toothpaste under five dollars', 'search_item'),
        ('find rice brand grain gold', 'search_item'),
        ('hello', 'other'),
        ('what is on my list', 'other'),

        # Hindi (very lightweight examples)
        ('doodh jodo', 'add_item'),
        ('do bread jodo', 'add_item'),
        ('doodh hatao', 'remove_item'),
        ('toothpaste dhundo', 'search_item'),
        ('paanch dollar se kam toothpaste', 'search_item'),
    ]
    X, y = zip(*data)
    return list(X), list(y)

X_train, y_train = seed_training_data()

clf: Pipeline = Pipeline([
    ('vec', CountVectorizer(ngram_range=(1,2))),
    ('svm', LinearSVC())
])
clf.fit(X_train, y_train)

CATEGORY_MAP = {
    'milk': 'dairy', 'yogurt': 'dairy', 'cheese': 'dairy',
    'apple': 'produce', 'apples': 'produce', 'banana': 'produce', 'bananas': 'produce',
    'bread': 'bakery', 'toothpaste': 'personal', 'water': 'beverages', 'rice': 'staples'
}

UNITS = ['bottle','bottles','kg','g','packet','packets','dozen','litre','liter','l','ml']

def extract_quantity(text: str):
    # numbers (both words and digits), simple
    # words mapping
    words = {'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9,'ten':10,
             'ek':1,'do':2,'teen':3,'char':4,'paanch':5}
    qty = 1
    for w,v in words.items():
        if re.search(r'\b' + re.escape(w) + r'\b', text):
            qty = v
    m = re.search(r'(\d+)', text)
    if m:
        qty = int(m.group(1))
    unit = None
    for u in UNITS:
        if re.search(r'\b' + re.escape(u) + r'\b', text):
            unit = u
            break
    return qty, unit

def extract_brand_and_price(text: str):
    # look for brand after 'brand' and price thresholds
    brand = None
    max_price = None
    m = re.search(r'brand\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*)', text)
    if m:
        brand = m.group(1).strip()
    m2 = re.search(r'(?:under|below|<=?)\s*(\d+(?:\.\d+)?)', text)
    if m2:
        max_price = float(m2.group(1))
    # Hindi simple numeric e.g. "paanch dollar se kam"
    if 'kam' in text and any(w in text for w in ['dollar','rs','rup','₹']):
        # pick any digit present
        m3 = re.search(r'(\d+)', text)
        if m3:
            max_price = float(m3.group(1))
    return brand, max_price

def extract_item(text: str):
    # naive: take last noun-like token by filtering stopwords/verbs heuristically
    tokens = re.findall(r'[a-zA-Z]+', text.lower())
    stop = set(['please','add','remove','delete','from','my','list','find','search','under','below','brand','to','the'])
    cand = [t for t in tokens if t not in stop]
    # prefer known catalog words
    for t in reversed(cand):
        if t in CATEGORY_MAP or t in ['milk','apples','apple','bananas','banana','bread','toothpaste','water','rice','yogurt']:
            return t
    return cand[-1] if cand else None

@app.post('/parse', response_model=ParseOut)
def parse(inp: ParseIn):
    text = inp.text.strip()
    if not text:
        return ParseOut(intent='other', speech='I did not catch that.')
    # classify
    intent = clf.predict([text])[0]
    qty, unit = extract_quantity(text.lower())
    item = extract_item(text)
    cat = CATEGORY_MAP.get(item or '', None)
    brand, max_price = extract_brand_and_price(text.lower())

    filters = {}
    if brand: filters['brand'] = brand
    if max_price is not None: filters['maxPrice'] = max_price

    # Build speech
    if intent == 'add_item' and item:
        speech = f'Adding {qty} {unit or ""} {item}.'
    elif intent == 'remove_item' and item:
        speech = f'Removing {item}.'
    elif intent == 'search_item':
        base = item or 'item'
        if brand and max_price is not None:
            speech = f'Searching {base} brand {brand} under {int(max_price)}.'
        elif brand:
            speech = f'Searching {base} brand {brand}.'
        elif max_price is not None:
            speech = f'Searching {base} under {int(max_price)}.'
        else:
            speech = f'Searching {base}.'
    else:
        speech = 'Okay.'

    return ParseOut(
        intent=intent,
        item=item,
        quantity=qty,
        unit=unit,
        category=cat,
        filters=filters or None,
        speech=speech
    )
