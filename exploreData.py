# # import pandas as pd
# # import gower
# # import seaborn as sns
# # import matplotlib.pyplot as plt
# # from scipy.cluster.hierarchy import linkage, fcluster
# # import numpy as np

# # columns_names = ['ID', 'Diagnosis', 'radius1', 'texture1', 'perimeter1', 'area1', 'smoothness1',
# #                  'compactness1', 'concavity1', 'concave_points1', 'symmetry1', 'fractal_dimension1',
# #                  'radius2', 'texture2', 'perimeter2', 'area2', 'smoothness2', 'compactness2',
# #                  'concavity2', 'concave_points2', 'symmetry2', 'fractal_dimension2',
# #                  'radius3', 'texture3', 'perimeter3', 'area3', 'smoothness3', 'compactness3',
# #                  'concavity3', 'concave_points3', 'symmetry3', 'fractal_dimension3'
# #                 ]

# # data = pd.read_csv('breast+cancer+wisconsin+diagnostic/wdbc.csv', names=columns_names)
# # data_array = data.to_numpy()

# # # Calculate Gower's distance matrix
# # gower_distances = gower.gower_matrix(data_array)

# # # Perform hierarchical clustering
# # linkage_matrix = linkage(gower_distances, method='average', optimal_ordering=True)

# # # Define the distance threshold
# # distance_threshold = 1.0  # Change this to the desired threshold

# # # Get cluster labels
# # cluster_labels = fcluster(linkage_matrix, distance_threshold, criterion='distance')

# # # Create subarrays for each cluster
# # unique_clusters = np.unique(cluster_labels)
# # for cluster_num in unique_clusters:
# #     cluster_indices = np.where(cluster_labels == cluster_num)[0]
# #     cluster_data = data_array[cluster_indices]
    
# #     print(f'Cluster {cluster_num} Data:')
# #     print(cluster_data)
# #     print('\n')

# # print(unique_clusters)

# import pandas as pd
# import gower
# import seaborn as sns
# import matplotlib.pyplot as plt
# from scipy.cluster.hierarchy import linkage, fcluster
# import numpy as np

# columns_names = ['ID', 'Diagnosis', 'radius1', 'texture1', 'perimeter1', 'area1', 'smoothness1',
#                  'compactness1', 'concavity1', 'concave_points1', 'symmetry1', 'fractal_dimension1',
#                  'radius2', 'texture2', 'perimeter2', 'area2', 'smoothness2', 'compactness2',
#                  'concavity2', 'concave_points2', 'symmetry2', 'fractal_dimension2',
#                  'radius3', 'texture3', 'perimeter3', 'area3', 'smoothness3', 'compactness3',
#                  'concavity3', 'concave_points3', 'symmetry3', 'fractal_dimension3'
#                 ]

# data = pd.read_csv('breast+cancer+wisconsin+diagnostic/wdbc.csv', names=columns_names)
# data_array = data.to_numpy()

# # Calculate Gower's distance matrix
# gower_distances = gower.gower_matrix(data_array)

# # Convert Gower's distance matrix to similarity matrix
# similarity_matrix = 1 - gower_distances

# # Perform hierarchical clustering
# linkage_matrix = linkage(similarity_matrix, method='average', optimal_ordering=True)

# # Define the distance threshold
# distance_threshold = 1.0  # Change this to the desired threshold

# # Get cluster labels
# cluster_labels = fcluster(linkage_matrix, distance_threshold, criterion='distance')

# # Create subarrays for each cluster
# unique_clusters = np.unique(cluster_labels)
# for cluster_num in unique_clusters:
#     cluster_indices = np.where(cluster_labels == cluster_num)[0]
#     cluster_data = data_array[cluster_indices]
    
#     print(f'Cluster {cluster_num} Data:')
#     print(cluster_data)
#     print('\n')

import pandas as pd
import gower
import seaborn as sns
import matplotlib.pyplot as plt
from scipy.cluster.hierarchy import linkage, fcluster, leaves_list
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

# Convert Gower's distance matrix to similarity matrix
similarity_matrix = 1 - gower_distances

# Perform hierarchical clustering
linkage_matrix = linkage(similarity_matrix, method='average', optimal_ordering=True)

# Get the order of the leaves
ordered_indices = leaves_list(linkage_matrix)

# Reorder the similarity matrix
ordered_similarity_matrix = similarity_matrix[ordered_indices, :][:, ordered_indices]

# Plot the reordered similarity matrix as a heatmap with black and white gradient
plt.figure(figsize=(10, 8))
sns.heatmap(ordered_similarity_matrix, cmap='binary')
plt.title('Reordered Similarity Matrix Heatmap')
plt.show()

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