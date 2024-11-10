import pandas as pd
import gower
import seaborn as sns
import matplotlib.pyplot as plt
from scipy.cluster.hierarchy import linkage, fcluster
import numpy as np

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
linkage_matrix = linkage(gower_distances, method='average', optimal_ordering=True)

# Define the distance threshold
distance_threshold = 1.0  # Change this to the desired threshold

# Get cluster labels
cluster_labels = fcluster(linkage_matrix, distance_threshold, criterion='distance')

# Create subarrays for each cluster
unique_clusters = np.unique(cluster_labels)
for cluster_num in unique_clusters:
    cluster_indices = np.where(cluster_labels == cluster_num)[0]
    cluster_data = data_array[cluster_indices]
    
    print(f'Cluster {cluster_num} Data:')
    print(cluster_data)
    print('\n')

print(unique_clusters)