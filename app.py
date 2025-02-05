from flask import Flask, request, jsonify, render_template
import pandas as pd
from biclustering import MixedTypeBiclustering
from similarity_matrix_mixed_clustering import OptimizedDualSimilarityMatrix

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_clusters', methods=['POST'])
def get_clusters():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        row_clusters = int(request.form.get('rowClusters', 5))
        col_clusters = int(request.form.get('colClusters', 5))

        # Read the CSV file
        data = pd.read_csv(file)

        # Create a MixedTypeBiclustering instance and fit the data
        biclustering = MixedTypeBiclustering(n_row_clusters=row_clusters, n_col_clusters=col_clusters)
        biclustering.fit(data)

        # Separate mixed-type blocks
        separated_blocks = biclustering.separate_mixed_type_blocks(data)
        final_sorted_blocks = biclustering.sort_blocks_globally(separated_blocks)

        # Convert separated blocks to a serializable format with column information
        blocks_serializable = {
            f"{row_cluster},{col_cluster},{block_id},{block_type}": {
                'data': block.values.tolist(),
                'columns': block.columns.tolist()
            }
            for (row_cluster, col_cluster, block_id, block_type), block in final_sorted_blocks.items()
        }

        return jsonify({'blocks': blocks_serializable})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    

# Add this new route to your app.py file

@app.route('/get_vsm', methods=['POST'])
def get_vsm():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        # Read the CSV file
        data = pd.read_csv(file)
        
        # Create VSM instance
        vsm = OptimizedDualSimilarityMatrix(data)
        
        # Get similarity matrices
        row_similarity, col_similarity = vsm.get_similarity_matrices()
        
        # Convert numpy arrays to lists for JSON serialization
        response_data = {
            'row_similarity': row_similarity.tolist(),
            'column_similarity': col_similarity.tolist()
        }
        
        return jsonify(response_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)