import pandas as pd
import json

def prepare():
    print("Reading data...")
    df = pd.read_csv('../data/combined_spotify_data.csv', encoding='utf-8')
    
    # We select numerical features suitable for clustering.
    features = [
        'danceability', 'energy', 'loudness', 'speechiness',
        'acousticness', 'instrumentalness', 'liveness', 'valence', 'tempo'
    ]
    
    # Drop rows with NaN in features
    df = df.dropna(subset=features).copy()
    
    subset = df[features].copy()
    
    # Standardize the features
    print("Standardizing features...")
    scaled = (subset - subset.mean()) / subset.std()
    
    df['track_name'] = df['track_name'].fillna('Unknown Track')
    df['track_artist'] = df['track_artist'].fillna('Unknown Artist')
    
    # Combine original for tooltips/axes, scaled for kmeans calculations, and name/artist
    json_data = {
        'features': features,
        'data': []
    }
    
    print("Converting to JSON format...")
    # Iterate and build the payload
    # This loop is quite fast for 4800 rows
    for i in range(len(df)):
        item = {
            'id': int(i),
            'name': str(df['track_name'].iloc[i]),
            'artist': str(df['track_artist'].iloc[i]),
            'popularity': int(df['track_popularity'].iloc[i]) if 'track_popularity' in df.columns else 50,
            'album': str(df['track_album_name'].iloc[i]) if 'track_album_name' in df.columns else 'Unknown Album',
            'duration_ms': int(df['duration_ms'].iloc[i]) if 'duration_ms' in df.columns else 0,
            'scaled': [float(scaled[feat].iloc[i]) for feat in features],
            'original': {feat: float(df[feat].iloc[i]) for feat in features}
        }
        json_data['data'].append(item)
        
    out_file = 'data.js'
    print(f"Writing to {out_file}...")
    with open(out_file, 'w', encoding='utf-8') as f:
        # Prepend 'const musicData = ' to bypass CORS
        f.write("const musicData = ")
        json.dump(json_data, f)
        f.write(";\n")
        
    print("Done! Data ready for the web app.")

if __name__ == '__main__':
    prepare()
