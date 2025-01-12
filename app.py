from flask import Flask, request, jsonify, render_template
import pandas as pd
from biclustering import MixedTypeBiclustering

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

if __name__ == '__main__':
    app.run(debug=True)