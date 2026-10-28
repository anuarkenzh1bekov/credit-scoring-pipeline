import pandas as pd
from sklearn.model_selection import train_test_split
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
df = pd.read_csv(DATA/"GiveMeSomeCredit-training.csv", index_col=0)

model_df, future_df = train_test_split(
    df,
    test_size=0.3,
    stratify=df['SeriousDlqin2yrs'],
    random_state=42,
)

Path("data").mkdir(exist_ok=True)
model_df.to_csv(DATA / "model_data.csv")
future_df.to_csv(DATA / "future_data.csv")

Path(DATA / "batches").mkdir(exist_ok=True)
batch_size = 1000
for i, start in enumerate(range(0, len(future_df), batch_size)):
    batch = future_df.iloc[start:start + batch_size]
    batch.to_csv(DATA / "batches" / f"batch_{i:03d}.csv")

