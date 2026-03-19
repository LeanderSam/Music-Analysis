import pandas as pd

# 1. Load the datasets
df_high = pd.read_csv('high_popularity_spotify_data.csv')
df_low = pd.read_csv('low_popularity_spotify_data.csv')

# 2. Concatenate (merge) the datasets vertically
# The ignore_index=True argument resets the row numbers so they flow sequentially from 0 to the end
combined_df = pd.concat([df_high, df_low], ignore_index=True)

# 3. Save the merged dataset to a new CSV file
combined_df.to_csv('combined_spotify_data.csv', index=False)