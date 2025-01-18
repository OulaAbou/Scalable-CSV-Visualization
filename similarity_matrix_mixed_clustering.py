import numpy as np
import pandas as pd
from scipy.spatial.distance import pdist, squareform
from scipy.cluster.hierarchy import linkage, leaves_list
from sklearn.preprocessing import StandardScaler, LabelEncoder
import matplotlib.pyplot as plt
import seaborn as sns
from numba import jit
from typing import Tuple, Optional

class OptimizedDualSimilarityMatrix:
    def __init__(self, data: pd.DataFrame):
        self.data = data
        self._processed_data = None
        self._row_similarity: Optional[np.ndarray] = None
        self._col_similarity: Optional[np.ndarray] = None
    
    def _preprocess_data(self) -> np.ndarray:
        numeric_cols = self.data.select_dtypes(include=[np.number]).columns
        categorical_cols = self.data.select_dtypes(include=['object', 'category']).columns
        
        processed_data = self.data.copy()
        
        if len(numeric_cols) > 0:
            scaler = StandardScaler()
            processed_data[numeric_cols] = scaler.fit_transform(processed_data[numeric_cols])
        
        for col in categorical_cols:
            le = LabelEncoder()
            processed_data[col] = le.fit_transform(processed_data[col].astype(str))
        
        self._processed_data = processed_data.values
        self._column_types = np.array([np.issubdtype(processed_data[col].dtype, np.number) 
                                     for col in processed_data.columns])
        return self._processed_data

    @staticmethod
    @jit(nopython=True)
    def _mixed_distance(X: np.ndarray, column_types: np.ndarray) -> np.ndarray:
        n_samples = X.shape[0]
        distances = np.zeros((n_samples, n_samples))
        
        for i in range(n_samples):
            for j in range(i + 1, n_samples):
                dist = 0.0
                for k in range(X.shape[1]):
                    if column_types[k]:
                        dist += (X[i, k] - X[j, k]) ** 2
                    else:
                        dist += 0.0 if X[i, k] == X[j, k] else 1.0
                distances[i, j] = distances[j, i] = np.sqrt(dist)
        
        return distances

    def get_similarity_matrices(self) -> Tuple[np.ndarray, np.ndarray]:
        if self._row_similarity is not None and self._col_similarity is not None:
            return self._row_similarity, self._col_similarity
            
        if self._processed_data is None:
            self._preprocess_data()
        
        row_distance_matrix = self._mixed_distance(self._processed_data, self._column_types)
        row_max = np.max(row_distance_matrix)
        self._row_similarity = 1 - (row_distance_matrix / row_max) if row_max != 0 else np.ones_like(row_distance_matrix)
        
        col_distance_matrix = self._mixed_distance(self._processed_data.T, ~self._column_types)
        col_max = np.max(col_distance_matrix)
        self._col_similarity = 1 - (col_distance_matrix / col_max) if col_max != 0 else np.ones_like(col_distance_matrix)
        
        return self._row_similarity, self._col_similarity

    def get_reordered_matrices(self) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """Get similarity matrices with enhanced block-structure ordering"""
        row_similarity, col_similarity = self.get_similarity_matrices()
        
        # Convert similarity to distance matrices in condensed form
        row_distances = squareform(1 - row_similarity)
        col_distances = squareform(1 - col_similarity)
        
        # Perform hierarchical clustering
        row_linkage = linkage(row_distances, method='average')
        col_linkage = linkage(col_distances, method='average')
        
        # Get ordering that maximizes similarity between adjacent elements
        row_ordered_indices = leaves_list(row_linkage)
        col_ordered_indices = leaves_list(col_linkage)
        
        # Reorder matrices to show block structure
        ordered_row_similarity = row_similarity[np.ix_(row_ordered_indices, row_ordered_indices)]
        ordered_col_similarity = col_similarity[np.ix_(col_ordered_indices, col_ordered_indices)]
        
        return (ordered_row_similarity, row_ordered_indices, row_linkage,
                ordered_col_similarity, col_ordered_indices, col_linkage)

    def plot_row_similarity(self, figsize: Tuple[int, int] = (8, 8)) -> plt.Figure:
        ordered_row_similarity, _, _, _, _, _ = self.get_reordered_matrices()
        
        fig = plt.figure(figsize=figsize)
        ax = plt.gca()
        sns.heatmap(ordered_row_similarity, cmap='Greys', ax=ax,
                   xticklabels=False, yticklabels=False)
        ax.set_title('Row Similarity Matrix')
        plt.tight_layout()
        return fig

    def plot_column_similarity(self, figsize: Tuple[int, int] = (8, 8)) -> plt.Figure:
        _, _, _, ordered_col_similarity, _, _ = self.get_reordered_matrices()
        
        fig = plt.figure(figsize=figsize)
        ax = plt.gca()
        sns.heatmap(ordered_col_similarity, cmap='Greys', ax=ax,
                   xticklabels=False, yticklabels=False)
        ax.set_title('Column Similarity Matrix')
        plt.tight_layout()
        return fig
    
# Columns names
columns_names = ['ID', 'Diagnosis', 'radius1', 'texture1', 'perimeter1', 'area1', 'smoothness1',
                    'compactness1', 'concavity1', 'concave_points1', 'symmetry1', 'fractal_dimension1',
                    'radius2', 'texture2', 'perimeter2', 'area2', 'smoothness2', 'compactness2',
                    'concavity2', 'concave_points2', 'symmetry2', 'fractal_dimension2',
                    'radius3', 'texture3', 'perimeter3', 'area3', 'smoothness3', 'compactness3',
                    'concavity3', 'concave_points3', 'symmetry3', 'fractal_dimension3'
                ]

# Load data
data = pd.read_csv('breast+cancer+wisconsin+diagnostic/wdbc.csv', names=columns_names)
data = data.drop(columns=['ID'])

# Example usage
VSM = OptimizedDualSimilarityMatrix(data)
VSM.plot_row_similarity()
plt.show()
VSM.plot_column_similarity()
plt.show()