import pandas as pd
import gower
import seaborn as sns
import matplotlib.pyplot as plt
from scipy.cluster.hierarchy import linkage, leaves_list
import matplotlib

matplotlib.use('Agg')

class SimilarityMatrix:
    def __init__(self, data):
        self.data = data

    def getGower(self):
        # data = self.data.to_numpy()
        gower_distances = gower.gower_matrix(self.data)
        return gower_distances

    def reorderMatrix(self):
        similarity_matrix = 1 - self.getGower()
        # Perform hierarchical clustering
        linkage_matrix = linkage(similarity_matrix, method='average', optimal_ordering=True)

        # Get the order of the leaves
        ordered_indices = leaves_list(linkage_matrix)

        # Reorder the similarity matrix
        ordered_similarity_matrix = similarity_matrix[ordered_indices, :][:, ordered_indices]

        return ordered_similarity_matrix
    
    def plotMatrix(self):
        ordered_similarity_matrix = self.reorderMatrix()
        plt.figure(figsize=(10, 8))
        sns_plot = sns.heatmap(ordered_similarity_matrix, cmap='binary')
        plt.title('Reordered Similarity Matrix Heatmap')
        
        # Save the figure to a variable
        fig = sns_plot.get_figure()
        return fig

# Example usage
# similarity_matrix = SimilarityMatrix('breast+cancer+wisconsin+diagnostic/wdbc.csv')
# fig = similarity_matrix.plotMatrix()
# fig.savefig('similarity_matrix_heatmap.png')