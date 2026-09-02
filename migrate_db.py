import sqlite3

conn = sqlite3.connect('backend/datashield.db')
cursor = conn.cursor()

for col, coltype in [('snapshot_path', 'VARCHAR(512)')]:
    try:
        cursor.execute(f"ALTER TABLE recovery_candidates ADD COLUMN {col} {coltype}")
        conn.commit()
        print(f"Added column: {col}")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print(f"Column {col} already exists, skipping.")
        else:
            raise

conn.close()
print("Migration complete.")
