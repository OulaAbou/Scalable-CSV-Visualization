import pandas as pd
import numpy as np
from scipy.cluster.hierarchy import linkage, fcluster

class Cluster:
    def __init__(self, data):
        self.data = data

    def getGower(self):
        import gower
        gower_distances = gower.gower_matrix(self.data)
        similarity_matrix = 1 - gower_distances
        return similarity_matrix
    
    def getClusters(self, distance_threshold):
        # Perform hierarchical clustering
        linkage_matrix = linkage(self.getGower(), method='average', optimal_ordering=True)
        # Get cluster labels
        cluster_labels = fcluster(linkage_matrix, distance_threshold, criterion='distance')

        # Create subarrays for each cluster
        unique_clusters = np.unique(cluster_labels)
        all_cluster_data = []
        for cluster_num in unique_clusters:
            cluster_indices = np.where(cluster_labels == cluster_num)[0]
            cluster_data = self.data[cluster_indices]
            all_cluster_data.append(cluster_data)

        return all_cluster_data

# Example usage
# test = pd.read_csv('breast+cancer+wisconsin+diagnostic/wdbc.csv')
# data_array = test.to_numpy()
# cluster = Cluster(data_array)
# clusters = cluster.getClusters(1.0)
# # print(clusters)

# # Print the clusters
# for i, cluster_data in enumerate(clusters):
#     print(f'Cluster {i + 1} Data:')
#     print(cluster_data)
#     print('\n')

