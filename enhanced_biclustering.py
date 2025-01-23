import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional
from sklearn.preprocessing import StandardScaler, LabelEncoder
from scipy.spatial.distance import pdist, squareform
from scipy.cluster.hierarchy import linkage, fcluster, leaves_list, dendrogram
import matplotlib.pyplot as plt
from collections import defaultdict

class ComprehensiveMixedBiclustering:
    def __init__(self, 
                 n_row_clusters: int = 3, 
                 n_col_clusters: int = 3, 
                 distance_metric: str = 'mixed',
                 consider_missing_patterns: bool = True):
        """
        Initialize the Comprehensive Mixed-Type Biclustering algorithm
        
        Parameters:
        -----------
        n_row_clusters : int, default 3
            Number of row clusters to create
        n_col_clusters : int, default 3
            Number of column clusters to create
        distance_metric : str, default 'mixed'
            Distance metric to use for clustering
        consider_missing_patterns : bool, default True
            Whether to consider patterns of missing values in clustering
        """
        self.n_row_clusters = n_row_clusters
        self.n_col_clusters = n_col_clusters
        self.consider_missing_patterns = consider_missing_patterns
        self._row_clusters = None
        self._col_clusters = None
        self._row_cluster_labels = None
        self._col_cluster_labels = None
        self._column_clustering_result = None
        self._missing_patterns = None
        
    def _identify_missing_patterns(self, data: pd.DataFrame) -> Dict[str, List[int]]:
        """
        Identify patterns of missing values across columns
        
        Parameters:
        -----------
        data : pd.DataFrame
            Input data
            
        Returns:
        --------
        Dict[str, List[int]]
            Dictionary mapping missing value patterns to row indices
        """
        # Create binary matrix of missing values
        missing_matrix = data.isna().astype(int)
        
        # Convert each row's missing pattern to a string for grouping
        patterns = {}
        for idx, row in missing_matrix.iterrows():
            pattern = ''.join(row.astype(str))
            if pattern not in patterns:
                patterns[pattern] = []
            patterns[pattern].append(idx)
            
        return patterns

    # def _mixed_distance(self, X: np.ndarray, missing_patterns: Optional[Dict[str, List[int]]] = None) -> np.ndarray:
    #     """
    #     Compute a custom distance matrix for mixed-type data
        
    #     Parameters:
    #     -----------
    #     X : np.ndarray
    #         Input data matrix
    #     missing_patterns : Optional[Dict[str, List[int]]]
    #         Dictionary of missing value patterns
        
    #     Returns:
    #     --------
    #     np.ndarray
    #         Distance matrix
    #     """
    #     def mixed_pairwise_distance(x1: np.ndarray, x2: np.ndarray) -> float:
    #         """
    #         Compute distance between two data points with mixed types
    #         """
    #         distances = []
    #         for i in range(len(x1)):
    #             # Handle missing values
    #             if pd.isna(x1[i]) or pd.isna(x2[i]):
    #                 distances.append(1.0)  # Maximum distance for missing values
    #             # Numeric type handling
    #             elif np.issubdtype(x1[i].dtype, np.number):
    #                 distances.append((x1[i] - x2[i])**2)
    #             # Categorical type handling
    #             else:
    #                 distances.append(0 if x1[i] == x2[i] else 1)
    #         return np.sqrt(np.sum(distances))

    #     n_samples = X.shape[0]
    #     distances = np.zeros((n_samples, n_samples))

    #     if missing_patterns and self.consider_missing_patterns:
    #         # Create reverse mapping of row indices to patterns
    #         row_to_pattern = {}
    #         for pattern, indices in missing_patterns.items():
    #             for idx in indices:
    #                 row_to_pattern[idx] = pattern

    #         for i in range(n_samples):
    #             for j in range(i + 1, n_samples):
    #                 # Compute base distance
    #                 base_dist = mixed_pairwise_distance(X[i], X[j])
                    
    #                 # Adjust distance based on missing patterns
    #                 pattern_match = row_to_pattern[i] == row_to_pattern[j]
    #                 pattern_factor = 0.5 if pattern_match else 2.0
                    
    #                 distances[i, j] = base_dist * pattern_factor
    #                 distances[j, i] = distances[i, j]
    #     else:
    #         # Use standard distance computation
    #         distances = squareform(pdist(X, metric=mixed_pairwise_distance))

    #     return distances

    def _mixed_distance(self, X: np.ndarray, missing_patterns: Optional[Dict[str, List[int]]] = None) -> np.ndarray:
        """
        Compute a custom distance matrix for mixed-type data ensuring symmetry
        
        Parameters:
        -----------
        X : np.ndarray
            Input data matrix
        missing_patterns : Optional[Dict[str, List[int]]]
            Dictionary of missing value patterns
        
        Returns:
        --------
        np.ndarray
            Symmetric distance matrix
        """
        def mixed_metric(u: np.ndarray, v: np.ndarray) -> float:
            """
            Custom metric for pdist
            """
            distances = []
            for i in range(len(u)):
                # Handle missing values
                if pd.isna(u[i]) or pd.isna(v[i]):
                    distances.append(1.0)
                # Numeric type handling
                elif np.issubdtype(type(u[i]), np.number) and np.issubdtype(type(v[i]), np.number):
                    distances.append((float(u[i]) - float(v[i]))**2)
                # Categorical type handling
                else:
                    distances.append(0 if u[i] == v[i] else 1)
            return np.sqrt(np.sum(distances))

        if missing_patterns and self.consider_missing_patterns:
            # Create reverse mapping of row indices to patterns
            row_to_pattern = defaultdict(str)
            for pattern, indices in missing_patterns.items():
                for idx in indices:
                    row_to_pattern[idx] = pattern

            def pattern_adjusted_metric(u: np.ndarray, v: np.ndarray, idx1: int, idx2: int) -> float:
                base_dist = mixed_metric(u, v)
                pattern_match = row_to_pattern[idx1] == row_to_pattern[idx2]
                pattern_factor = 0.5 if pattern_match else 2.0
                return base_dist * pattern_factor

            # Calculate pairwise distances
            n = X.shape[0]
            distances = np.zeros((n, n))
            
            # Use pdist with the custom metric
            condensed_distances = pdist(np.arange(n), metric=lambda i, j: pattern_adjusted_metric(
                X[int(i)], X[int(j)], int(i), int(j)
            ))
            
            # Convert to square form
            distances = squareform(condensed_distances)
            
        else:
            # Use pdist directly with the mixed metric
            distances = squareform(pdist(X, metric=mixed_metric))

        # Ensure diagonal is zero
        np.fill_diagonal(distances, 0)
        
        # Ensure perfect symmetry
        distances = (distances + distances.T) / 2
        
        return distances
    
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
        # Identify missing patterns if enabled
        if self.consider_missing_patterns:
            self._missing_patterns = self._identify_missing_patterns(data)
        
        # Preprocess the data
        prep_data = self._preprocess_data(data)
        processed_df = prep_data['processed_data']
        
        # Compute distance matrices for rows and columns
        row_dist_matrix = self._mixed_distance(processed_df.values, self._missing_patterns)
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
        
        # Store column clustering details
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
        
        block_counter = 0
        
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

    def sort_blocks_globally(self, blocks: Dict[tuple, pd.DataFrame]) -> Dict[tuple, pd.DataFrame]:
        """
        Sort blocks using global optimization across all clusters
        
        Parameters:
        -----------
        blocks : Dict[tuple, pd.DataFrame]
            Dictionary of separated blocks
        
        Returns:
        --------
        Dict[tuple, pd.DataFrame]
            Sorted blocks with globally optimal row and column ordering
        """
        # Create global indices
        all_rows = list(set().union(*(block.index for block in blocks.values())))
        all_cols = list(set().union(*(block.columns for block in blocks.values())))
        
        # Initialize distance matrices
        n_rows = len(all_rows)
        n_cols = len(all_cols)
        row_dist_matrix = np.zeros((n_rows, n_rows))
        col_dist_matrix = np.zeros((n_cols, n_cols))
        
        # Create index mappings
        row_to_idx = {row: idx for idx, row in enumerate(all_rows)}
        col_to_idx = {col: idx for idx, col in enumerate(all_cols)}
        
        # Process blocks efficiently
        for (row_cluster, col_cluster, block_id, dtype), block in blocks.items():
            if dtype == 'numerical':
                # Process numerical blocks
                block_values = block.values
                
                # Update row distances
                if block_values.shape[1] > 0:
                    block_row_dists = pdist(block_values)
                    block_row_indices = [row_to_idx[idx] for idx in block.index]
                    block_row_dists_square = squareform(block_row_dists)
                    
                    for i, row_i in enumerate(block_row_indices):
                        for j, row_j in enumerate(block_row_indices):
                            if i < j:
                                row_dist_matrix[row_i, row_j] += block_row_dists_square[i, j]
                                row_dist_matrix[row_j, row_i] += block_row_dists_square[i, j]
                
                # Update column distances
                if block_values.shape[0] > 1:
                    corr = np.corrcoef(block_values.T)
                    corr = np.nan_to_num(corr, 0)
                    block_col_indices = [col_to_idx[col] for col in block.columns]
                    
                    for i, col_i in enumerate(block_col_indices):
                        for j, col_j in enumerate(block_col_indices):
                            if i < j:
                                dist = 1 - abs(corr[i, j])
                                col_dist_matrix[col_i, col_j] += dist
                                col_dist_matrix[col_j, col_i] += dist
                    
            else:  # categorical
                block_values = block.values
                block_row_indices = [row_to_idx[idx] for idx in block.index]
                block_col_indices = [col_to_idx[col] for col in block.columns]
                
                # Update row distances using vectorized operations
                for i, row_i in enumerate(block_row_indices):
                    mismatches = (block_values[i:i+1] != block_values).sum(axis=1)
                    for j, row_j in enumerate(block_row_indices[i+1:], i+1):
                        row_dist_matrix[row_i, row_j] += mismatches[j]
                        row_dist_matrix[row_j, row_i] += mismatches[j]
                
                # Update column distances using vectorized operations
                if block_values.shape[0] > 0:
                    for i, col_i in enumerate(block_col_indices):
                        col1_values = block_values[:, i]
                        for j, col_j in enumerate(block_col_indices[i+1:], i+1):
                            col2_values = block_values[:, j]
                            unique_vals = np.unique(np.concatenate([col1_values, col2_values]))
                            dist1 = np.array([(col1_values == val).sum() for val in unique_vals]) / len(col1_values)
                            dist2 = np.array([(col2_values == val).sum() for val in unique_vals]) / len(col2_values)
                            dist = np.sum(np.abs(dist1 - dist2))
                            col_dist_matrix[col_i, col_j] += dist
                            col_dist_matrix[col_j, col_i] += dist
        
        # Get optimal orderings using condensed distance matrices
        row_order = leaves_list(linkage(squareform(row_dist_matrix), method='ward'))
        col_order = leaves_list(linkage(squareform(col_dist_matrix), method='ward'))
        
        ordered_rows = [all_rows[i] for i in row_order]
        ordered_cols = [all_cols[i] for i in col_order]
        
        # Efficiently reindex blocks
        sorted_blocks = {}
        for key, block in blocks.items():
            block_rows = block.index.intersection(ordered_rows)
            block_cols = block.columns.intersection(ordered_cols)
            sorted_blocks[key] = block.reindex(index=block_rows, columns=block_cols)
        
        return sorted_blocks
            
    def visualize_clusters(self, original_data: pd.DataFrame, figsize=(12, 8)):
        """
        Visualize the clustering results with enhanced visualization including missing patterns
        
        Parameters:
        -----------
        original_data : pd.DataFrame
            Original input data
        figsize : tuple, default (12, 8)
            Figure size for the plot
        """
        if self._row_clusters is None or self._col_clusters is None:
            raise ValueError("Must call fit() first")

        plt.figure(figsize=figsize)
        
        # Create a subplot grid
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=figsize)
        
        # Plot 1: Cluster assignments
        cluster_matrix = np.zeros((len(self._row_clusters), len(self._col_clusters)))
        for i, (row_cluster, col_cluster) in enumerate(zip(self._row_clusters, self._col_clusters)):
            cluster_matrix[i] = col_cluster
        
        im1 = ax1.imshow(cluster_matrix, aspect='auto', cmap='viridis')
        ax1.set_title('Cluster Assignments')
        ax1.set_xlabel('Columns')
        ax1.set_ylabel('Rows')
        plt.colorbar(im1, ax=ax1, label='Cluster ID')
        
        # Plot 2: Missing value patterns if enabled
        if self.consider_missing_patterns and self._missing_patterns:
            missing_matrix = original_data.isna().astype(int)
            im2 = ax2.imshow(missing_matrix, aspect='auto', cmap='RdYlBu')
            ax2.set_title('Missing Value Patterns')
            ax2.set_xlabel('Columns')
            ax2.set_ylabel('Rows')
            plt.colorbar(im2, ax=ax2, label='Missing (1) vs Present (0)')
        
        plt.tight_layout()
        plt.show()

def compare_block_sorting(original_blocks, sorted_blocks):
    """
    Display original and sorted blocks sequentially for easy comparison
    
    Parameters:
    -----------
    original_blocks : Dict[tuple, pd.DataFrame]
        Original blocks before sorting
    sorted_blocks : Dict[tuple, pd.DataFrame]
        Blocks after sorting
    """
    # Get unique row clusters
    row_clusters = set(key[0] for key in original_blocks.keys())
    
    for row_cluster in sorted(row_clusters):
        print(f"\n{'='*80}")
        print(f"Row Cluster {row_cluster}")
        print(f"{'='*80}")
        
        # Get all blocks for this row cluster
        cluster_blocks_original = {k: v for k, v in original_blocks.items() if k[0] == row_cluster}
        cluster_blocks_sorted = {k: v for k, v in sorted_blocks.items() if k[0] == row_cluster}
        
        for key in cluster_blocks_original.keys():
            row_cluster, col_cluster, block_id, block_type = key
            
            print(f"\nBlock {block_id}: Column Cluster {col_cluster} - {block_type}")
            print("\nORIGINAL:")
            print("-" * 40)
            print(cluster_blocks_original[key])
            
            print("\nAFTER ROW AND COLUMN SORTING:")
            print("-" * 40)
            print(cluster_blocks_sorted[key])
            print("\n")



# Create the clusterer with missing pattern detection enabled
clusterer = ComprehensiveMixedBiclustering(
    n_row_clusters=3,
    n_col_clusters=3,
    consider_missing_patterns=True
)

data = pd.read_csv('breast+cancer+wisconsin+diagnostic/wdbc_withHeaders_withEmptyCells.csv')

# Fit the model
clusterer.fit(data)

# Get and analyze the blocks
blocks = clusterer.separate_mixed_type_blocks(data)
sorted_blocks = clusterer.sort_blocks_globally(blocks)

# Visualize the results
clusterer.visualize_clusters(data)

# Compare original and sorted blocks
compare_block_sorting(blocks, sorted_blocks)