import numpy as np
import pandas as pd
from typing import List, Dict, Any
from sklearn.preprocessing import StandardScaler, LabelEncoder
from scipy.spatial.distance import pdist, squareform
from scipy.cluster.hierarchy import linkage, fcluster
import matplotlib.pyplot as plt
# import seaborn as sns

class MixedTypeBiclustering:
    def __init__(self, 
                 n_row_clusters: int = 3, 
                 n_col_clusters: int = 3, 
                 distance_metric: str = 'mixed'):
        """
        Initialize the Mixed-Type Biclustering algorithm
        
        Parameters:
        -----------
        n_row_clusters : int, default 3
            Number of row clusters to create
        n_col_clusters : int, default 3
            Number of column clusters to create
        distance_metric : str, default 'mixed'
            Distance metric to use for clustering
        """
        self.n_row_clusters = n_row_clusters
        self.n_col_clusters = n_col_clusters
        self._row_clusters = None
        self._col_clusters = None
        self._row_cluster_labels = None
        self._col_cluster_labels = None
        self._column_clustering_result = None
        
    def _mixed_distance(self, X: np.ndarray) -> np.ndarray:
        """
        Compute a custom distance matrix for mixed-type data
        
        Parameters:
        -----------
        X : np.ndarray
            Input data matrix
        
        Returns:
        --------
        np.ndarray
            Distance matrix
        """
        def mixed_pairwise_distance(x1: np.ndarray, x2: np.ndarray) -> float:
            """
            Compute distance between two data points with mixed types
            """
            distances = []
            for i in range(len(x1)):
                # Numeric type handling
                if np.issubdtype(x1[i].dtype, np.number):
                    distances.append((x1[i] - x2[i])**2)
                # Categorical type handling
                else:
                    distances.append(0 if x1[i] == x2[i] else 1)
            return np.sqrt(np.sum(distances))
        
        return squareform(pdist(X, metric=mixed_pairwise_distance))
    
    def _preprocess_data(self, data: pd.DataFrame) -> Dict[str, Any]:
        """
        Preprocess the input data by separating and encoding different types
        
        Parameters:
        -----------
        data : pd.DataFrame
            Input data
        
        Returns:
        --------
        Dict containing processed data and type information
        """
        # Identify column types
        numeric_cols = data.select_dtypes(include=[np.number]).columns
        categorical_cols = data.select_dtypes(include=['object', 'category']).columns
        
        # Prepare processed data
        processed_data = data.copy()
        type_encodings = {}
        
        # Handle numeric columns - standardize
        if len(numeric_cols) > 0:
            scaler = StandardScaler()
            processed_data[numeric_cols] = scaler.fit_transform(processed_data[numeric_cols])
        
        # Handle categorical columns - label encode
        for col in categorical_cols:
            le = LabelEncoder()
            processed_data[col] = le.fit_transform(processed_data[col].astype(str))
            type_encodings[col] = {
                'encoder': le,
                'original_categories': le.classes_
            }
        
        return {
            'processed_data': processed_data,
            'type_encodings': type_encodings,
            'numeric_cols': list(numeric_cols),
            'categorical_cols': list(categorical_cols)
        }
    
    def fit(self, data: pd.DataFrame):
        """
        Perform biclustering on the input data
        
        Parameters:
        -----------
        data : pd.DataFrame
            Input data to cluster
        """
        # Preprocess the data
        prep_data = self._preprocess_data(data)
        processed_df = prep_data['processed_data']
        
        # Compute distance matrices for rows and columns
        row_dist_matrix = self._mixed_distance(processed_df.values)
        col_dist_matrix = self._mixed_distance(processed_df.values.T)
        
        # Perform hierarchical clustering on rows
        row_linkage = linkage(row_dist_matrix, method='ward')
        row_clusters = fcluster(row_linkage, t=self.n_row_clusters, criterion='maxclust')
        
        # Perform hierarchical clustering on columns
        col_linkage = linkage(col_dist_matrix, method='ward')
        col_clusters = fcluster(col_linkage, t=self.n_col_clusters, criterion='maxclust')
        
        # Store cluster information
        self._row_clusters = row_clusters
        self._col_clusters = col_clusters
        self._row_cluster_labels = row_clusters
        self._col_cluster_labels = col_clusters
        
        # Store column clustering details for later analysis
        self._column_clustering_result = {
            'linkage': col_linkage,
            'clusters': col_clusters
        }
        
        return self
    
    def get_column_clusters(self, original_data: pd.DataFrame) -> Dict[int, List[str]]:
        """
        Get the columns clustered together
        
        Parameters:
        -----------
        original_data : pd.DataFrame
            Original input data
        
        Returns:
        --------
        Dictionary of column clusters
        """
        if self._column_clustering_result is None:
            raise ValueError("Must call fit() first")
        
        # Create a dictionary to store column clusters
        column_clusters = {}
        
        # Group columns by their cluster
        for cluster in np.unique(self._col_clusters):
            # Find columns in this cluster
            cluster_columns = original_data.columns[self._col_clusters == cluster].tolist()
            column_clusters[cluster] = cluster_columns
        
        return column_clusters
    
    def visualize_column_clusters(self, original_data: pd.DataFrame):
        """
        Visualize column clusters using a dendrogram
        
        Parameters:
        -----------
        original_data : pd.DataFrame
            Original input data
        """
        if self._column_clustering_result is None:
            raise ValueError("Must call fit() first")
        
        plt.figure(figsize=(10, 6))
        plt.title('Column Clustering Dendrogram')
        
        # Plot dendrogram
        from scipy.cluster.hierarchy import dendrogram
        dendrogram(
            self._column_clustering_result['linkage'],
            labels=original_data.columns,
            leaf_rotation=90,
            leaf_font_size=8
        )
        
        plt.tight_layout()
        plt.show()
    
    def get_cluster_blocks(self, original_data: pd.DataFrame) -> Dict[tuple, pd.DataFrame]:
        """
        Extract cluster blocks ensuring no mixed types within a cluster
        
        Parameters:
        -----------
        original_data : pd.DataFrame
            Original input data
        
        Returns:
        --------
        Dict of cluster blocks
        """
        if self._row_clusters is None or self._col_clusters is None:
            raise ValueError("Must call fit() first")
        
        # Prepare block dictionary
        blocks = {}
        
        # Iterate through unique row and column cluster combinations
        unique_row_clusters = np.unique(self._row_clusters)
        unique_col_clusters = np.unique(self._col_clusters)
        
        for row_cluster in unique_row_clusters:
            for col_cluster in unique_col_clusters:
                # Extract rows and columns for this cluster
                row_mask = self._row_clusters == row_cluster
                col_mask = self._col_clusters == col_cluster
                
                # Extract block
                block = original_data.loc[row_mask, col_mask]
                
                # Verify single type within block
                block_types = block.dtypes.unique()
                if len(block_types) == 1:
                    blocks[(row_cluster, col_cluster)] = block
        
        return blocks
    
    def separate_mixed_type_blocks(self, original_data: pd.DataFrame) -> Dict[tuple, pd.DataFrame]:
        """
        Separate mixed-type blocks into unique numerical and categorical blocks
        
        Parameters:
        -----------
        original_data : pd.DataFrame
            Original input data
        
        Returns:
        --------
        Dictionary of separated blocks with both numerical and categorical blocks
        """
        if self._row_clusters is None or self._col_clusters is None:
            raise ValueError("Must call fit() first")
        
        # Prepare block dictionary
        separated_blocks = {}
        
        # Iterate through unique row and column cluster combinations
        unique_row_clusters = np.unique(self._row_clusters)
        unique_col_clusters = np.unique(self._col_clusters)
        
        block_counter = 0  # To create unique block identifiers
        
        for row_cluster in unique_row_clusters:
            for col_cluster in unique_col_clusters:
                # Extract rows and columns for this cluster
                row_mask = self._row_clusters == row_cluster
                col_mask = self._col_clusters == col_cluster
                
                # Extract block
                block = original_data.loc[row_mask, col_mask]
                
                # Separate numerical and categorical columns
                numeric_cols = block.select_dtypes(include=[np.number]).columns
                categorical_cols = block.select_dtypes(include=['object', 'category']).columns
                
                # Create sub-blocks with unique identifiers
                if len(numeric_cols) > 0:
                    numeric_block = block[numeric_cols]
                    separated_blocks[(row_cluster, col_cluster, block_counter, 'numerical')] = numeric_block
                    block_counter += 1
                
                if len(categorical_cols) > 0:
                    categorical_block = block[categorical_cols]
                    separated_blocks[(row_cluster, col_cluster, block_counter, 'categorical')] = categorical_block
                    block_counter += 1
        
        return separated_blocks
    
    def visualize_clusters(self, original_data: pd.DataFrame):
        """
        Visualize the clustering results
        
        Parameters:
        -----------
        original_data : pd.DataFrame
            Original input data
        """
        import matplotlib.pyplot as plt
        import seaborn as sns
        
        # Create a heatmap showing cluster assignments
        plt.figure(figsize=(12, 8))
        
        # Create a color-coded matrix of cluster assignments
        cluster_matrix = np.zeros((len(self._row_clusters), len(self._col_clusters)))
        for i, (row_cluster, col_cluster) in enumerate(zip(self._row_clusters, self._col_clusters)):
            cluster_matrix[i] = col_cluster
        
        sns.heatmap(cluster_matrix, cmap='viridis', 
                    xticklabels=original_data.columns, 
                    yticklabels=original_data.index)
        plt.title('Biclustering Cluster Assignments')
        plt.xlabel('Columns')
        plt.ylabel('Rows')
        plt.show()

# Example usage
if __name__ == "__main__":
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

    # Create biclustering instance
    biclustering = MixedTypeBiclustering(n_row_clusters=5, n_col_clusters=5)
    
    # Fit the model
    biclustering.fit(data)

    # Separate mixed-type blocks
    separated_blocks = biclustering.separate_mixed_type_blocks(data)

    # Print out the separated blocks
    for (row_cluster, col_cluster, block_id, block_type), block in separated_blocks.items():
        print(f"Block {block_id}: Cluster ({row_cluster}, {col_cluster}) - {block_type}:")
        print(block)
        print("\n")

    # # Optional: Visualize column clusters
    # biclustering.visualize_column_clusters(data)

    # # Optional: Visualize clusters
    # biclustering.visualize_clusters(data)