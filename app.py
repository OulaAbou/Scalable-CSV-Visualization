from flask import Flask, request, jsonify, render_template, send_file
import pandas as pd
from Cluster import Cluster
from similarityMatrix import SimilarityMatrix
import io

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/process_file', methods=['POST'])
def process_file():
    data = request.json
    file_path = data.get('file_path')
    
    if not file_path:
        return jsonify({'error': 'No file path provided'}), 400
    
    try:
        # Read the data file
        data = pd.read_csv(file_path)
        data_array = data.to_numpy()
        
        # Create a Cluster object and get clusters
        cluster = Cluster(data_array)
        clusters = cluster.getClusters(1.0)
        
        # Convert clusters to a serializable format
        clusters_serializable = [cluster.tolist() for cluster in clusters]
        
        return jsonify({'clusters': clusters_serializable})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/visual_similarity_matrix', methods=['POST'])
def visual_similarity_matrix():
    data = request.json
    file_path = data.get('file_path')
    
    if not file_path:
        return jsonify({'error': 'No file path provided'}), 400
    
    try:
        # Create a SimilarityMatrix object and generate the plot
        similarity_matrix = SimilarityMatrix(file_path)
        fig = similarity_matrix.plotMatrix()
        
        # Save the plot to a BytesIO object
        img = io.BytesIO()
        fig.savefig(img, format='png')
        img.seek(0)
        
        return send_file(img, mimetype='image/png')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)