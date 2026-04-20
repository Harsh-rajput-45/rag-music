import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Ensure the app can import rag_app correctly
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from rag_app import recommend_songs

load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

@app.route('/api/recommend', methods=['POST'])
def recommend():
    data = request.get_json()
    if not data or 'query' not in data:
        return jsonify({"error": "Missing 'query' in request body"}), 400
    
    query = data['query']
    fast_mode = data.get('fast_mode', False)
    reference_song = data.get('reference_song', None)
    
    # Check for huggingface token
    if not os.environ.get("HUGGINGFACEHUB_API_TOKEN"):
        return jsonify({"error": "Missing HUGGINGFACEHUB_API_TOKEN in backend environment"}), 500

    try:
        # recommend_songs returns a dict like {"JioSaavn": [song1, song2, ...]}
        results = recommend_songs(query, fast_mode=fast_mode, reference_song=reference_song)
        if not results or not results.get("JioSaavn"):
            return jsonify({"results": []})
            
        return jsonify({"results": results.get("JioSaavn", [])})
    except Exception as e:
        print("Error during recommendation:", e)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Run the Flask app on port 5000
    app.run(host='0.0.0.0', port=5000, debug=False)
