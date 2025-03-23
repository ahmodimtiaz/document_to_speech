import os
import logging
import tempfile
import time
from flask import Flask, render_template, request, jsonify, send_file, session
from werkzeug.utils import secure_filename
from flask_socketio import SocketIO
from utils import extract_text_from_file, detect_language, text_to_speech

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "default-secret-key")

# Initialize Socket.IO with eventlet
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Set the socketio instance in utils
import utils
utils.socketio = socketio

# Configure upload folder
UPLOAD_FOLDER = os.path.join(tempfile.gettempdir(), 'uploads')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Set allowed file extensions
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'txt'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': f'File type not allowed. Please use one of: {", ".join(ALLOWED_EXTENSIONS)}'}), 400

    try:
        # Save the uploaded file
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Extract text from file
        text = extract_text_from_file(filepath)
        
        if not text or text.strip() == "":
            return jsonify({'error': 'Could not extract any text from the file'}), 400
        
        # Detect language
        language = detect_language(text)
        
        # Store text and language in session for later use
        session['text'] = text
        session['language'] = language
        
        # Return success response with extracted text and detected language
        return jsonify({
            'success': True,
            'text': text[:500] + ('...' if len(text) > 500 else ''),  # Preview only
            'language': language,
            'fullTextLength': len(text)
        })
    
    except Exception as e:
        logger.exception("Error processing file")
        return jsonify({'error': f'Error processing file: {str(e)}'}), 500

@app.route('/generate-speech', methods=['POST'])
def generate_speech():
    try:
        data = request.json
        
        # Get text either from session (uploaded document) or direct input
        text = data.get('inputText')
        if not text:
            text = session.get('text')
            
        language = data.get('language', session.get('language', 'en'))
        gender = data.get('gender', 'female')
        
        if not text:
            return jsonify({'error': 'No text found. Please either upload a document or input text directly.'}), 400
            
        # Store text in session (if it came from direct input)
        if data.get('inputText'):
            session['text'] = text
            
            # Try to detect language if not explicitly selected
            if not data.get('language'):
                detected_language = detect_language(text)
                language = detected_language
                session['language'] = language
        
        # Generate speech from text
        audio_filepath = text_to_speech(text, language, gender)
        
        # Store the audio filepath in the session
        session['audio_filepath'] = audio_filepath
        
        return jsonify({
            'success': True,
            'message': 'Speech generated successfully',
            'detectedLanguage': language if data.get('inputText') and not data.get('language') else None
        })
        
    except Exception as e:
        logger.exception("Error generating speech")
        return jsonify({'error': f'Error generating speech: {str(e)}'}), 500

@app.route('/get-audio')
def get_audio():
    audio_filepath = session.get('audio_filepath')
    
    if not audio_filepath or not os.path.exists(audio_filepath):
        return jsonify({'error': 'Audio file not found. Please generate speech first.'}), 404
    
    # Ensure we explicitly send the file as an mp3
    return send_file(audio_filepath, mimetype='audio/mp3', as_attachment=False, 
                    download_name='audio.mp3')

@app.route('/download-audio')
def download_audio():
    audio_filepath = session.get('audio_filepath')
    
    if not audio_filepath or not os.path.exists(audio_filepath):
        return jsonify({'error': 'Audio file not found. Please generate speech first.'}), 404
    
    # Get the original filename from the session or use a default name
    original_filename = secure_filename(request.args.get('filename', 'audio'))
    # Ensure .mp3 extension is added
    filename = f"{os.path.splitext(original_filename)[0]}.mp3"
    
    return send_file(audio_filepath, mimetype='audio/mp3', as_attachment=True, 
                     download_name=filename)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
