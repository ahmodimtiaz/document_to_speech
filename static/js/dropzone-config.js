// Initialize Dropzone
Dropzone.autoDiscover = false;

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the document dropzone
    const myDropzone = new Dropzone("#documentDropzone", {
        url: "/upload",
        acceptedFiles: ".pdf,.jpg,.jpeg,.png,.txt",
        maxFilesize: 10, // MB
        maxFiles: 1,
        autoProcessQueue: true,
        addRemoveLinks: true,
        dictDefaultMessage: "Drop files here to upload",
        dictFallbackMessage: "Your browser does not support drag'n'drop file uploads.",
        dictFileTooBig: "File is too big ({{filesize}}MB). Max filesize: {{maxFilesize}}MB.",
        dictInvalidFileType: "You can't upload files of this type.",
        dictResponseError: "Server responded with {{statusCode}} code.",
        dictCancelUpload: "Cancel upload",
        dictUploadCanceled: "Upload canceled.",
        dictRemoveFile: "Remove file",
        dictMaxFilesExceeded: "You can only upload {{maxFiles}} file at a time.",
        
        // Show processing message when file is uploaded
        init: function() {
            this.on("sending", function(file) {
                // Show the processing container instead of the alert
                const processingContainer = document.getElementById('processingContainer');
                const processingPercentage = document.getElementById('processingPercentage');
                const processingProgressBar = document.getElementById('processingProgressBar');
                const processingStatusMessage = document.getElementById('processingStatusMessage');
                
                // Initialize the progress indicators
                processingContainer.style.display = 'block';
                processingPercentage.textContent = '0%';
                processingProgressBar.style.width = '0%';
                processingProgressBar.setAttribute('aria-valuenow', 0);
                processingStatusMessage.textContent = 'Preparing document upload...';
                
                document.getElementById('uploadError').style.display = 'none';
                
                // Hide previous results
                document.getElementById('textPreviewCard').style.display = 'none';
                document.getElementById('speechOptionsCard').style.display = 'none';
                document.getElementById('audioPlayerCard').style.display = 'none';
            });
            
            this.on("success", function(file, response) {
                document.getElementById('processingContainer').style.display = 'none';
                
                // Display the extracted text
                const textPreview = document.getElementById('textPreview');
                textPreview.innerHTML = response.text;
                document.getElementById('textPreviewCard').style.display = 'block';
                
                // Set the detected language
                const languageSelect = document.getElementById('languageSelect');
                if (response.language && languageSelect) {
                    languageSelect.value = response.language;
                }
                
                // Update language badge
                const languageBadge = document.getElementById('detectedLanguageBadge');
                const languageOptions = document.getElementById('languageSelect').options;
                for (let i = 0; i < languageOptions.length; i++) {
                    if (languageOptions[i].value === response.language) {
                        languageBadge.textContent = languageOptions[i].text;
                        break;
                    }
                }
                
                // Show speech options
                document.getElementById('speechOptionsCard').style.display = 'block';
            });
            
            this.on("error", function(file, errorMessage, xhr) {
                document.getElementById('processingContainer').style.display = 'none';
                
                // Show error message
                const uploadError = document.getElementById('uploadError');
                uploadError.textContent = typeof errorMessage === 'string' 
                    ? errorMessage 
                    : (errorMessage.error || 'An unknown error occurred during upload.');
                uploadError.style.display = 'block';
                
                // Remove the file from dropzone
                this.removeFile(file);
            });
        }
    });
});
