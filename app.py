# from flask import Flask, request, jsonify, render_template, send_file
# from flask_cors import CORS
# import pandas as pd
# # from Cluster import Cluster
# # from clusters_by_number import ClusterByNumber
# from similarityMatrix import SimilarityMatrix
# import io
# import logging
# from biclustering import MixedTypeBiclustering

# # from flask import Flask, request, jsonify, render_template
# # import pandas as pd
# # from biclustering import MixedTypeBiclustering

# app = Flask(__name__)

# @app.route('/')
# def index():
#     return render_template('index.html')

# @app.route('/get_clusters', methods=['POST'])
# def get_clusters():
#     if 'file' not in request.files:
#         return jsonify({'error': 'No file part'}), 400

#     file = request.files['file']
#     if file.filename == '':
#         return jsonify({'error': 'No selected file'}), 400

#     try:
#         # Read the CSV file
#         data = pd.read_csv(file)

#         # Create a MixedTypeBiclustering instance and fit the data
#         biclustering = MixedTypeBiclustering(n_row_clusters=5, n_col_clusters=5)
#         biclustering.fit(data)

#         # Separate mixed-type blocks
#         separated_blocks = biclustering.separate_mixed_type_blocks(data)

#         # Convert separated blocks to a serializable format
#         blocks_serializable = {
#             (row_cluster, col_cluster, block_id, block_type): block.values.tolist()
#             for (row_cluster, col_cluster, block_id, block_type), block in separated_blocks.items()
#         }

#         return jsonify({'blocks': blocks_serializable})
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500

# if __name__ == '__main__':
#     app.run(debug=True)

# # app = Flask(__name__)
# # CORS(app)  # Enable CORS for all routes

# # # Configure logging
# # logging.basicConfig(level=logging.DEBUG)

# # @app.route('/')
# # def index():
# #     return render_template('index.html')

# # @app.route('/process_file', methods=['POST'])
# # def process_file():
# #     data = request.json
# #     file_path = data.get('file_path')
    
# #     if not file_path:
# #         return jsonify({'error': 'No file path provided'}), 400
    
# #     try:
# #         # Read the data file
# #         data = pd.read_csv(file_path)
# #         data_array = data.to_numpy()
        
# #         # Create a Cluster object and get clusters
# #         cluster = Cluster(data_array)
# #         clusters = cluster.getClusters(1.0)
        
# #         # Convert clusters to a serializable format
# #         clusters_serializable = [cluster.tolist() for cluster in clusters]
        
# #         return jsonify({'clusters': clusters_serializable})
# #     except Exception as e:
# #         logging.error(f"Error processing file: {e}")
# #         return jsonify({'error': str(e)}), 500

# # @app.route('/visual_similarity_matrix', methods=['POST'])
# # def visual_similarity_matrix():
# #     data = request.json
# #     file_path = data.get('file_path')
    
# #     if not file_path:
# #         return jsonify({'error': 'No file path provided'}), 400
    
# #     try:
# #         # Read the data file
# #         data = pd.read_csv(file_path)
# #         data = data.to_numpy()

# #         # Create a SimilarityMatrix object and generate the plot
# #         similarity_matrix = SimilarityMatrix(data)
# #         fig = similarity_matrix.plotMatrix()
        
# #         # Save the plot to a BytesIO object
# #         img = io.BytesIO()
# #         fig.savefig(img, format='png')
# #         img.seek(0)
        
# #         return send_file(img, mimetype='image/png')
# #     except Exception as e:
# #         logging.error(f"Error generating similarity matrix: {e}")
# #         return jsonify({'error': str(e)}), 500

# # @app.route('/cluster_by_number', methods=['POST'])
# # def cluster_by_number():
# #     data = request.json
# #     file_path = data.get('file_path')
# #     num_clusters = data.get('num_clusters')
    
# #     if not file_path or not num_clusters:
# #         return jsonify({'error': 'No file path or number of clusters provided'}), 400
    
# #     try:
# #         # Read the data file
# #         data = pd.read_csv(file_path)
# #         data_array = data.to_numpy()
        
# #         # Create a ClusterByNumber object and get clusters
# #         cluster = ClusterByNumber(data_array)
# #         clusters = cluster.getClusters(num_clusters)
        
# #         # Convert clusters to a serializable format
# #         clusters_serializable = [cluster.tolist() for cluster in clusters]
        
# #         return jsonify({'clusters': clusters_serializable})
# #     except Exception as e:
# #         logging.error(f"Error processing file: {e}")
# #         return jsonify({'error': str(e)}), 500

# # if __name__ == '__main__':
# #     app.run(debug=True, host='0.0.0.0', port=5001)

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
        # Read the CSV file
        data = pd.read_csv(file)

        # Create a MixedTypeBiclustering instance and fit the data
        biclustering = MixedTypeBiclustering(n_row_clusters=5, n_col_clusters=5)
        biclustering.fit(data)

        # Separate mixed-type blocks
        separated_blocks = biclustering.separate_mixed_type_blocks(data)

        # Convert separated blocks to a serializable format with column information
        blocks_serializable = {
            f"{row_cluster},{col_cluster},{block_id},{block_type}": {
                'data': block.values.tolist(),
                'columns': block.columns.tolist()
            }
            for (row_cluster, col_cluster, block_id, block_type), block in separated_blocks.items()
        }

        return jsonify({'blocks': blocks_serializable})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)