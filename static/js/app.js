document.addEventListener('DOMContentLoaded', function() {
    // Initialize Socket.IO connection
    const socket = io();
    
    // Elements - Common
    const generateSpeechBtn = document.getElementById('generateSpeechBtn');
    const languageSelect = document.getElementById('languageSelect');
    const genderRadios = document.getElementsByName('genderRadio');
    const audioPlayerCard = document.getElementById('audioPlayerCard');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const playPauseIcon = document.getElementById('playPauseIcon');
    const restartBtn = document.getElementById('restartBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const audioProgress = document.getElementById('audioProgress');
    const currentTimeDisplay = document.getElementById('currentTime');
    const totalTimeDisplay = document.getElementById('totalTime');
    const progressContainer = document.getElementById('progressContainer');
    const generateError = document.getElementById('generateError');
    const speedControl = document.getElementById('speedControl');
    const textPreviewCard = document.getElementById('textPreviewCard');
    const textPreview = document.getElementById('textPreview');
    const speechOptionsCard = document.getElementById('speechOptionsCard');
    const detectedLanguageBadge = document.getElementById('detectedLanguageBadge');
    
    // Processing UI elements - Document extraction
    const processingContainer = document.getElementById('processingContainer');
    const processingStage = document.getElementById('processingStage');
    const processingPercentage = document.getElementById('processingPercentage');
    const processingProgressBar = document.getElementById('processingProgressBar');
    const processingStatusMessage = document.getElementById('processingStatusMessage');
    
    // Processing UI elements - Speech generation
    const generateProcessingContainer = document.getElementById('generateProcessingContainer');
    const generateProcessingStage = document.getElementById('generateProcessingStage');
    const generateProcessingPercentage = document.getElementById('generateProcessingPercentage');
    const generateProcessingProgressBar = document.getElementById('generateProcessingProgressBar');
    const generateProcessingStatusMessage = document.getElementById('generateProcessingStatusMessage');
    
    // Direct text input elements
    const directTextInput = document.getElementById('directTextInput');
    const processTextBtn = document.getElementById('processTextBtn');
    const directTextError = document.getElementById('directTextError');
    
    // Socket.IO event handlers for progress updates
    socket.on('processing_progress', function(data) {
        // Update the appropriate progress UI based on stage
        if (data.stage === 'extract') {
            updateProgressUI(
                processingContainer, 
                processingStage,
                processingPercentage, 
                processingProgressBar, 
                processingStatusMessage,
                data
            );
        } else if (data.stage === 'generate') {
            updateProgressUI(
                generateProcessingContainer,
                generateProcessingStage,
                generateProcessingPercentage,
                generateProcessingProgressBar,
                generateProcessingStatusMessage,
                data
            );
        }
    });
    
    // Helper function to update progress UI elements
    function updateProgressUI(container, stageElement, percentageElement, progressBar, messageElement, data) {
        // Show the container if it's not already visible
        container.style.display = 'block';
        
        // Update the progress percentage
        const percentage = Math.round((data.progress / data.total) * 100);
        percentageElement.textContent = `${percentage}%`;
        
        // Update progress bar
        progressBar.style.width = `${percentage}%`;
        progressBar.setAttribute('aria-valuenow', percentage);
        
        // Update status message if provided
        if (data.message) {
            messageElement.textContent = data.message;
        }
        
        // If process is complete, handle completion after a delay
        if (percentage >= 100) {
            setTimeout(() => {
                // We don't hide the container here as the success response
                // from the server will trigger the next UI update
            }, 1000);
        }
    }
    
    // Audio player
    let sound = null;
    let isPlaying = false;
    let currentSpeed = 1.0;
    
    // Format time in seconds to MM:SS format
    function formatTime(secs) {
        const minutes = Math.floor(secs / 60) || 0;
        const seconds = Math.floor(secs - minutes * 60) || 0;
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
    
    // Generate speech
    generateSpeechBtn.addEventListener('click', function() {
        // Get the selected language and gender
        const language = languageSelect.value;
        let gender = 'female';
        
        for (let i = 0; i < genderRadios.length; i++) {
            if (genderRadios[i].checked) {
                gender = genderRadios[i].value;
                break;
            }
        }
        
        // Show processing container and hide error message
        generateProcessingContainer.style.display = 'block';
        generateProcessingPercentage.textContent = '0%';
        generateProcessingProgressBar.style.width = '0%';
        generateProcessingProgressBar.setAttribute('aria-valuenow', 0);
        generateProcessingStatusMessage.textContent = 'Initializing speech generation...';
        generateError.style.display = 'none';
        
        // Disable the generate button while processing
        generateSpeechBtn.disabled = true;
        
        // Make the API request to generate speech
        fetch('/generate-speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                language: language,
                gender: gender
            })
        })
        .then(response => response.json())
        .then(data => {
            generateProcessingContainer.style.display = 'none';
            generateSpeechBtn.disabled = false;
            
            if (data.success) {
                // Initialize the audio player
                initAudioPlayer();
            } else {
                // Show error message
                generateError.textContent = data.error || 'An error occurred while generating speech.';
                generateError.style.display = 'block';
            }
        })
        .catch(error => {
            generateProcessingContainer.style.display = 'none';
            generateSpeechBtn.disabled = false;
            
            // Show error message
            generateError.textContent = 'An error occurred while generating speech.';
            generateError.style.display = 'block';
            console.error('Error:', error);
        });
    });
    
    // Initialize the audio player
    function initAudioPlayer() {
        // Show the audio player card
        audioPlayerCard.style.display = 'block';
        
        // Create a timestamp to prevent caching
        const timestamp = new Date().getTime();
        
        // Initialize Howler.js with the audio file
        if (sound) {
            sound.unload(); // Unload previous sound
        }
        
        sound = new Howl({
            src: [`/get-audio?t=${timestamp}`],
            format: ['mp3'],
            html5: true,
            preload: true,
            rate: currentSpeed, // Set the initial playback rate
            onplay: function() {
                isPlaying = true;
                playPauseIcon.className = 'fas fa-pause';
                requestAnimationFrame(updateProgress);
            },
            onpause: function() {
                isPlaying = false;
                playPauseIcon.className = 'fas fa-play';
            },
            onstop: function() {
                isPlaying = false;
                playPauseIcon.className = 'fas fa-play';
            },
            onend: function() {
                isPlaying = false;
                playPauseIcon.className = 'fas fa-play';
            },
            onload: function() {
                // Update the total time display
                totalTimeDisplay.textContent = formatTime(sound.duration());
                // Show the progress bar
                progressContainer.style.display = 'block';
                // Reset progress
                audioProgress.value = 0;
                currentTimeDisplay.textContent = '0:00';
                // Hide any error message if audio loaded successfully
                generateError.style.display = 'none';
            },
            onloaderror: function(id, error) {
                console.error('Error loading audio:', error);
                generateError.textContent = 'Error loading audio file. Please try again.';
                generateError.style.display = 'block';
            }
        });
    }
    
    // Update the progress bar
    function updateProgress() {
        if (sound && sound.playing()) {
            const currentTime = sound.seek();
            const duration = sound.duration();
            audioProgress.value = (currentTime / duration) * 100 || 0;
            currentTimeDisplay.textContent = formatTime(currentTime);
            requestAnimationFrame(updateProgress);
        }
    }
    
    // Play/Pause button
    playPauseBtn.addEventListener('click', function() {
        if (!sound) return;
        
        if (isPlaying) {
            sound.pause();
        } else {
            sound.play();
        }
    });
    
    // Restart button
    restartBtn.addEventListener('click', function() {
        if (!sound) return;
        
        sound.stop();
        sound.play();
    });
    
    // Download button
    downloadBtn.addEventListener('click', function() {
        // Get the original file name from the dropzone if available
        let filename = 'audio.mp3';
        const dropzoneElement = document.querySelector('.dz-filename');
        if (dropzoneElement) {
            const filenameSpan = dropzoneElement.querySelector('span');
            if (filenameSpan && filenameSpan.textContent) {
                // Use the original filename but change the extension to .mp3
                const originalFilename = filenameSpan.textContent;
                const nameWithoutExtension = originalFilename.split('.').slice(0, -1).join('.');
                filename = nameWithoutExtension || 'audio';
            }
        }
        
        // Redirect to download endpoint
        window.location.href = `/download-audio?filename=${encodeURIComponent(filename)}`;
    });
    
    // Progress bar seek
    audioProgress.addEventListener('input', function() {
        if (!sound) return;
        
        const seekPosition = sound.duration() * (audioProgress.value / 100);
        sound.seek(seekPosition);
        currentTimeDisplay.textContent = formatTime(seekPosition);
    });
    
    // Speed control
    speedControl.addEventListener('change', function() {
        if (!sound) return;
        
        currentSpeed = parseFloat(speedControl.value);
        sound.rate(currentSpeed);
        
        // If currently playing, apply the rate change immediately
        if (sound.playing()) {
            const currentPosition = sound.seek();
            sound.stop();
            sound.play();
            sound.seek(currentPosition);
        }
    });
    
    // Process direct text input
    processTextBtn.addEventListener('click', function() {
        const text = directTextInput.value.trim();
        
        if (!text) {
            directTextError.textContent = 'Please enter some text to convert to speech.';
            directTextError.style.display = 'block';
            return;
        }
        
        directTextError.style.display = 'none';
        
        // Initialize and show the processing container
        processingContainer.style.display = 'block';
        processingPercentage.textContent = '0%';
        processingProgressBar.style.width = '0%';
        processingProgressBar.setAttribute('aria-valuenow', 0);
        processingStatusMessage.textContent = 'Analyzing text input...';
        
        // Show text preview
        textPreviewCard.style.display = 'block';
        textPreview.innerHTML = text.replace(/\n/g, '<br>');
        
        // Show speech options
        speechOptionsCard.style.display = 'block';
        
        // Make API call to process text
        fetch('/generate-speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputText: text
            })
        })
        .then(response => response.json())
        .then(data => {
            // Hide processing container
            processingContainer.style.display = 'none';
            
            if (data.success) {
                // Initialize the audio player
                initAudioPlayer();
                
                // If a language was detected, update the language dropdown
                if (data.detectedLanguage) {
                    // Update the language dropdown
                    const languageOptions = languageSelect.options;
                    for (let i = 0; i < languageOptions.length; i++) {
                        if (languageOptions[i].value === data.detectedLanguage) {
                            languageSelect.selectedIndex = i;
                            break;
                        }
                    }
                    
                    // Update the language badge
                    const languageMap = {
                        'en': 'English',
                        'fr': 'French',
                        'es': 'Spanish',
                        'de': 'German',
                        'it': 'Italian',
                        'pt': 'Portuguese',
                        'ru': 'Russian',
                        'zh-cn': 'Chinese',
                        'ja': 'Japanese',
                        'ar': 'Arabic',
                        'hi': 'Hindi'
                    };
                    
                    detectedLanguageBadge.textContent = languageMap[data.detectedLanguage] || data.detectedLanguage;
                }
            } else {
                directTextError.textContent = data.error || 'An error occurred while processing text.';
                directTextError.style.display = 'block';
            }
        })
        .catch(error => {
            // Hide processing container on error
            processingContainer.style.display = 'none';
            
            directTextError.textContent = 'An error occurred while processing text.';
            directTextError.style.display = 'block';
            console.error('Error:', error);
        });
    });
});
