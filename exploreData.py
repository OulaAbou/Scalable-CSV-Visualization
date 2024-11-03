import pandas as pd
import gower
import seaborn as sns
import matplotlib.pyplot as plt
from scipy.cluster.hierarchy import linkage, leaves_list

columns_names = ['ID', 'Diagnosis', 'radius1', 'texture1', 'perimeter1', 'area1', 'smoothness1',
                 'compactness1', 'concavity1', 'concave_points1', 'symmetry1', 'fractal_dimension1',
                 'radius2', 'texture2', 'perimeter2', 'area2', 'smoothness2', 'compactness2',
                 'concavity2', 'concave_points2', 'symmetry2', 'fractal_dimension2',
                 'radius3', 'texture3', 'perimeter3', 'area3', 'smoothness3', 'compactness3',
                 'concavity3', 'concave_points3', 'symmetry3', 'fractal_dimension3'
                ]

data = pd.read_csv('breast+cancer+wisconsin+diagnostic/wdbc.csv', names=columns_names)
data_array = data.to_numpy()

# Calculate Gower's distance matrix
gower_distances = gower.gower_matrix(data_array)

# Perform hierarchical clustering
linkage_matrix = linkage(gower_distances, method='average')

# Get the order of the leaves
ordered_indices = leaves_list(linkage_matrix)

# Reorder the distance matrix
ordered_distances = gower_distances[ordered_indices, :][:, ordered_indices]

# Plot the reordered similarity matrix as a heatmap
plt.figure(figsize=(10, 8))
sns.heatmap(ordered_distances, cmap='viridis')
plt.title('Reordered Gower\'s Distance Similarity Matrix')
plt.show()