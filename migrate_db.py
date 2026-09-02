import sqlite3

conn = sqlite3.connect('backend/datashield.db')
cursor = conn.cursor()

# Add original_path column if it doesn't exist
try:
    cursor.execute("ALTER TABLE recovery_candidates ADD COLUMN original_path VARCHAR(512)")
    conn.commit()
    print("Added original_path column successfully.")
except sqlite3.OperationalError as e:
    if "duplicate column" in str(e).lower():
        print("Column already exists, skipping.")
    else:
        raise

conn.close()
print("Database migration complete.")
