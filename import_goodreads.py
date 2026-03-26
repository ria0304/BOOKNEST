
import sqlite3
import os
import sys
import json

# ── DB path ───────────────────────────────────────────────────────────────────
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bookhaven.db')
print(f" Database: {db_path}")

# Safety check to avoid accidental data loss
if os.path.exists(db_path):
    r = input("  Database exists. This will REBUILD the Goodreads table. Continue? (y/n): ")
    if r.lower() != 'y':
        print("Exiting."); sys.exit(0)

# ── Load dataset ──────────────────────────────────────────────────────────────
print("\n Loading BrightData/Goodreads-Books dataset...")
try:
    from datasets import load_dataset
    ds = load_dataset("BrightData/Goodreads-Books")
    train = ds["train"]
    print(f" {len(train):,} books loaded from cache.")
except ImportError:
    print(" Error: 'datasets' library not found. Run 'pip install datasets'.")
    sys.exit(1)

# ── Helpers ───────────────────────────────────────────────────────────────────
def clean_str(val, max_len=None):
    if val is None:
        return None
    s = str(val).strip()
    if s in ("", "None", "null", "nan"):
        return None
    if max_len and len(s) > max_len:
        s = s[:max_len]
    return s

def parse_author(val):
    """Goodreads authors are often stored as JSON strings like ['Author Name']"""
    s = clean_str(val)
    if not s:
        return "Unknown Author"
    if s.startswith("["):
        try:
            lst = json.loads(s)
            if isinstance(lst, list):
                return clean_str(", ".join(str(x).strip() for x in lst if x), 300)
        except:
            # Fallback if JSON parsing fails
            return s.strip("[]").replace('"', '').replace("'", "").strip()
    return clean_str(s, 300)

# ── Database Setup ────────────────────────────────────────────────────────────
conn = sqlite3.connect(db_path)
cur  = conn.cursor()

print("Cleaning old data...")
cur.execute("DROP TABLE IF EXISTS goodreads_books")

cur.execute('''
CREATE TABLE goodreads_books (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    title            TEXT,
    author           TEXT,
    star_rating      REAL,
    num_ratings      INTEGER,
    num_reviews      INTEGER,
    summary          TEXT,
    genres           TEXT,
    first_published  TEXT,
    goodreads_url    TEXT
)''')

# Create indexes to ensure the 'Discover' search is fast
cur.execute('CREATE INDEX idx_goodreads_title ON goodreads_books(title)')
cur.execute('CREATE INDEX idx_goodreads_author ON goodreads_books(author)')
conn.commit()

# ── Import Logic ──────────────────────────────────────────────────────────────
BATCH_SIZE = 5000
total = len(train)
INSERT = '''
    INSERT INTO goodreads_books 
    (title, author, star_rating, num_ratings, num_reviews, summary, genres, first_published, goodreads_url) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
'''

print(f"\n Starting import of {total:,} books...")

done = 0
errors = 0

for start in range(0, total, BATCH_SIZE):
    end = min(start + BATCH_SIZE, total)
    batch = train[start:end]
    rows = []
    
    for i in range(len(batch["name"])):
        try:
            # Map 'name' from dataset to 'title' in DB
            title   = clean_str(batch["name"][i], 500)
            author  = parse_author(batch["author"][i])
            rating  = batch["star_rating"][i]
            n_rat   = batch["num_ratings"][i]
            n_rev   = batch["num_reviews"][i]
            summary = clean_str(batch["summary"][i], 5000)
            genres  = clean_str(batch["genres"][i], 500)
            pub     = clean_str(batch["first_published"][i], 50)
            url     = clean_str(batch["url"][i], 500)

            rows.append((title, author, rating, n_rat, n_rev, summary, genres, pub, url))
            done += 1
        except Exception:
            errors += 1

    cur.executemany(INSERT, rows)
    conn.commit()

    if done % 100000 == 0 or done == total:
        print(f"    Progress: {done:,} / {total:,} books inserted...")

# ── Verification ──────────────────────────────────────────────────────────────
final_count = cur.execute("SELECT COUNT(*) FROM goodreads_books").fetchone()[0]
print("\n" + "="*40)
print(f" IMPORT COMPLETE")
print(f"   Total Rows: {final_count:,}")
print(f"   Errors:     {errors:,}")
print("="*40)

conn.close()
print("\n You can now restart your server and search in the Discover tab!")
