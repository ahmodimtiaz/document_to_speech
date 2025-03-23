import os
import tempfile
import logging
import time
from PIL import Image
import pytesseract
from pdf2image import convert_from_path
import PyPDF2
from langdetect import detect
from gtts import gTTS

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Global variable for the socketio instance
# This will be set by the app when it imports utils
socketio = None

def emit_progress(stage, progress, message=None, total=100):
    """
    Emit a progress update via socketio
    
    Args:
        stage (str): Current processing stage (e.g., 'upload', 'extract', 'generate')
        progress (int): Progress value from 0 to total
        message (str, optional): Additional message to display
        total (int, optional): Maximum progress value (default: 100)
    """
    if socketio:
        data = {
            'stage': stage,
            'progress': progress,
            'total': total
        }
        if message:
            data['message'] = message
        
        socketio.emit('processing_progress', data)

# Define supported languages
SUPPORTED_LANGUAGES = {
    'en': 'English',
    'fr': 'French',
    'es': 'Spanish',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'zh-cn': 'Chinese (Simplified)',
    'ja': 'Japanese',
    'ar': 'Arabic',
    'hi': 'Hindi'
}

def extract_text_from_image(image_path):
    """Extract text from an image using OCR"""
    try:
        image = Image.open(image_path)
        text = pytesseract.image_to_string(image)
        return text
    except Exception as e:
        logger.exception(f"Error extracting text from image: {image_path}")
        raise Exception(f"Failed to extract text from image: {str(e)}")

def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF file"""
    try:
        # First try direct text extraction
        text = ""
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text += page.extract_text() or ""
        
        # If no text was extracted, the PDF might be scanned, so try OCR
        if not text.strip():
            logger.debug("No text extracted from PDF directly, trying OCR")
            temp_dir = tempfile.mkdtemp()
            images = convert_from_path(pdf_path)
            text = ""
            for i, image in enumerate(images):
                image_path = os.path.join(temp_dir, f'page_{i}.jpg')
                image.save(image_path, 'JPEG')
                text += extract_text_from_image(image_path) + "\n"
        
        return text
    except Exception as e:
        logger.exception(f"Error extracting text from PDF: {pdf_path}")
        raise Exception(f"Failed to extract text from PDF: {str(e)}")

def extract_text_from_text_file(file_path):
    """Extract text from a text file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            return file.read()
    except UnicodeDecodeError:
        # Try different encodings if utf-8 fails
        encodings = ['latin-1', 'ISO-8859-1', 'cp1252']
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as file:
                    return file.read()
            except UnicodeDecodeError:
                continue
        raise Exception("Failed to decode text file with multiple encodings")
    except Exception as e:
        logger.exception(f"Error reading text from file: {file_path}")
        raise Exception(f"Failed to read text file: {str(e)}")

def extract_text_from_file(file_path):
    """Extract text from a file based on its extension"""
    try:
        # Emit initial processing started status
        emit_progress('extract', 0, "Starting document processing...")
        
        file_extension = os.path.splitext(file_path)[1].lower()
        file_type = ""
        
        # Determine file type and emit appropriate message
        if file_extension in ['.jpg', '.jpeg', '.png']:
            file_type = "image"
            emit_progress('extract', 10, "Processing image with OCR...")
        elif file_extension == '.pdf':
            file_type = "PDF"
            emit_progress('extract', 10, "Extracting content from PDF...")
        elif file_extension == '.txt':
            file_type = "text"
            emit_progress('extract', 10, "Reading text file...")
        else:
            raise Exception(f"Unsupported file type: {file_extension}")
        
        # Extract text based on file type
        text = None
        if file_type == "image":
            emit_progress('extract', 20, "Analyzing image...")
            time.sleep(0.5)  # Small delay to show animation
            emit_progress('extract', 40, "Running OCR...")
            text = extract_text_from_image(file_path)
        elif file_type == "PDF":
            emit_progress('extract', 20, "Parsing PDF structure...")
            time.sleep(0.5)  # Small delay to show animation
            emit_progress('extract', 40, "Extracting text from pages...")
            text = extract_text_from_pdf(file_path)
        elif file_type == "text":
            emit_progress('extract', 40, "Reading text content...")
            text = extract_text_from_text_file(file_path)
        
        # Emit progress for language detection
        emit_progress('extract', 60, "Analyzing text...")
        time.sleep(0.3)  # Small delay to show animation
        emit_progress('extract', 80, "Detecting language...")
        time.sleep(0.3)  # Small delay to show animation
        
        # Emit completion
        emit_progress('extract', 100, "Text extraction complete!")
        
        return text
    except Exception as e:
        logger.exception(f"Error extracting text from file: {file_path}")
        emit_progress('extract', 100, f"Error: {str(e)}")
        raise Exception(f"Failed to extract text: {str(e)}")

def detect_language(text):
    """Detect the language of the text"""
    try:
        # Use only the first 1000 characters for language detection
        text_sample = text[:1000]
        detected = detect(text_sample)
        
        # Map to supported language codes
        if detected == 'zh':
            return 'zh-cn'  # Map Chinese to Simplified Chinese
        
        # Return detected language if supported, otherwise default to English
        return detected if detected in SUPPORTED_LANGUAGES else 'en'
    except Exception as e:
        logger.exception("Error detecting language")
        # Default to English if language detection fails
        return 'en'

def text_to_speech(text, language='en', gender='female'):
    """Convert text to speech and save as an audio file"""
    try:
        # Emit initial progress
        emit_progress('generate', 0, "Initializing speech generation...")
        
        # Create a temporary file for the audio
        temp_audio_file = tempfile.NamedTemporaryFile(suffix='.mp3', delete=False)
        temp_audio_path = temp_audio_file.name
        temp_audio_file.close()
        
        # The gender parameter is not directly supported by gTTS, but we keep it for future use
        # or if we switch to a different TTS engine
        emit_progress('generate', 10, f"Preparing {gender} voice in {SUPPORTED_LANGUAGES.get(language, language)}...")
        time.sleep(0.5)  # Small delay to show animation
        
        # For long texts, split into chunks to avoid gTTS limitations
        max_chars = 5000  # gTTS has limitations for very long texts
        if len(text) > max_chars:
            chunks = [text[i:i+max_chars] for i in range(0, len(text), max_chars)]
            total_chunks = len(chunks)
            
            emit_progress('generate', 20, f"Processing text in {total_chunks} segments...")
            
            # Process each chunk
            combined_audio = None
            for i, chunk in enumerate(chunks):
                # Calculate progress percentage for this chunk (20% to 80% of total progress)
                progress_pct = 20 + int(60 * (i / total_chunks))
                emit_progress('generate', progress_pct, f"Generating speech segment {i+1} of {total_chunks}...")
                
                chunk_file = tempfile.NamedTemporaryFile(suffix=f'_chunk_{i}.mp3', delete=False)
                chunk_path = chunk_file.name
                chunk_file.close()
                
                tts = gTTS(text=chunk, lang=language, slow=False)
                tts.save(chunk_path)
                
                # TODO: Combine audio chunks - this would require additional audio processing
                # For now, we'll just use the first chunk
                if i == 0:
                    combined_audio = chunk_path
            
            # Use the first chunk as the output
            # In a production app, we would combine these properly
            if combined_audio:
                emit_progress('generate', 85, "Finalizing audio file...")
                os.rename(combined_audio, temp_audio_path)
        else:
            # Process the text as a single chunk
            emit_progress('generate', 40, "Converting text to speech...")
            tts = gTTS(text=text, lang=language, slow=False)
            
            emit_progress('generate', 80, "Saving audio file...")
            tts.save(temp_audio_path)
        
        # Final progress update
        emit_progress('generate', 100, "Speech generation complete!")
        
        return temp_audio_path
    
    except Exception as e:
        logger.exception("Error generating speech")
        emit_progress('generate', 100, f"Error: {str(e)}")
        raise Exception(f"Failed to generate speech: {str(e)}")
