import json

file_path = r'd:\Lean\season 4\Aprendizagem Máquina II\practical\Music-Analysis\code_files\EDA.ipynb'

with open(file_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

# The new markdown cell
md_cell = {
    "cell_type": "markdown",
    "id": "heatmap_md_id_123",
    "metadata": {},
    "source": [
        "# **4) Bivariate Analysis: Correlation Heatmap**"
    ]
}

# The new code cell
code_cell = {
    "cell_type": "code",
    "execution_count": None,
    "id": "heatmap_code_id_123",
    "metadata": {},
    "outputs": [],
    "source": [
        "numerical_cols = ['energy', 'tempo', 'danceability', 'loudness', 'liveness', \n",
        "                  'valence', 'speechiness', 'instrumentalness', 'duration_ms', 'acousticness']\n",
        "\n",
        "plt.figure(figsize=(12, 8))\n",
        "corr_matrix = df[numerical_cols].corr()\n",
        "\n",
        "# Plotting the heatmap\n",
        "sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', fmt='.2f', vmin=-1, vmax=1, linewidths=0.5)\n",
        "plt.title('Correlation Heatmap of Audio Features', fontsize=16)\n",
        "plt.tight_layout()\n",
        "plt.show()"
    ]
}

nb['cells'].append(md_cell)
nb['cells'].append(code_cell)

with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)
