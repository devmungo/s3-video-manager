// app.js

// Initialize AWS configuration
AWS.config.region = '<your-region>';

// Create S3 service object - but don't initialize it yet
let s3;
let isUploading = false;
let currentFolder = '';
let browsingFolder = '';
const FOLDER_PREFIX = 'clients/'; // Prefix for all client folders
const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB chunks
const CONCURRENT_UPLOADS = 8; // 8 concurrent uploads
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const loadingOverlay = document.getElementById('loading-overlay');
const BUCKET_NAME = '<s3-bucket-name>';
const CLOUDFRONT_DOMAIN = '<your-cloudfront-domain>';


// Function to initialize S3 client with optimal configuration
function initializeS3() {
    if (!AWS.config.credentials) {
        throw new Error('AWS credentials not initialized');
    }

    // Check if credentials need refresh
    if (AWS.config.credentials.needsRefresh()) {
        throw new Error('AWS credentials need refresh');
    }
    
    if (!s3) {
        s3 = new AWS.S3({
            apiVersion: '2006-03-01',
            region: AWS.config.region,
            credentials: AWS.config.credentials,
            params: {
                Bucket: BUCKET_NAME
            },
            maxRetries: 10,
            signatureVersion: 'v4',
            httpOptions: {
                timeout: 0,          // Add this
                connectTimeout: 0,    // Add this
                xhrAsync: true       // Add this
            }
        });
    }
    
    return s3;
}


// Initialize Lambda client
function initializeLambda() {
    return new AWS.Lambda({
        region: AWS.config.region,
        credentials: AWS.config.credentials
    });
}

// Check authentication before any S3 operation
async function checkAuthenticated() {
    try {
        await checkAuth();
        
        // Check if credentials need refresh
        if (AWS.config.credentials && AWS.config.credentials.needsRefresh()) {
            await new Promise((resolve, reject) => {
                AWS.config.credentials.refresh((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }
        
        return true;
    } catch (error) {
        console.error('Authentication check failed:', error);
        showSection('login-section');
        showAuthMessage('Please login to continue');
        return false;
    }
}

// Utility function for error logging
function logError(message, error) {
    console.error(`${message}:`, error);
    console.error('Stack:', error.stack);
}

// Utility function for CloudFront URL generation
function getCloudFrontUrl(key) {
    const sanitizedKey = key.replace(/^\/+/, '');
    return `${CLOUDFRONT_DOMAIN}/${encodeURIComponent(sanitizedKey)}`;
}


// Calculate optimal chunk size based on file size
function calculateOptimalChunkSize(fileSize) {
    // Ensure we don't exceed 10000 parts limit (S3 limitation)
    const minChunkSize = Math.ceil(fileSize / 10000);
    return Math.max(CHUNK_SIZE, minChunkSize);
}

// Format helpers for progress display
function formatSpeed(bytesPerSecond) {
    if (bytesPerSecond >= 1024 * 1024 * 1024) {
        return `${(bytesPerSecond / (1024 * 1024 * 1024)).toFixed(2)} Gbps`;
    }
    if (bytesPerSecond >= 1024 * 1024) {
        return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} Mbps`;
    }
    if (bytesPerSecond >= 1024) {
        return `${(bytesPerSecond / 1024).toFixed(2)} Kbps`;
    }
    return `${Math.round(bytesPerSecond)} bps`;
}

function formatTime(seconds) {
    if (seconds === Infinity || isNaN(seconds)) {
        return 'Calculating...';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// Handle Lambda errors
function handleLambdaError(error) {
    if (error.code === 'AccessDeniedException') {
        return 'Permission denied. Please check your credentials.';
    }
    if (error.code === 'ResourceNotFoundException') {
        return 'Lambda function not found. Please check the function name.';
    }
    if (error.code === 'ServiceException') {
        return 'AWS Lambda service error. Please try again later.';
    }
    return error.message || 'An unknown error occurred';
}

// New Folder Creation
document.getElementById('create-folder-btn').addEventListener('click', createNewFolder);

async function createNewFolder() {
    if (!await checkAuthenticated()) return;

    const folderName = prompt("Enter the name for the new folder:");
    if (!folderName) return; // User cancelled or entered an empty string

    try {
        if (!s3) {
            initializeS3();
        }

        const folderKey = `${FOLDER_PREFIX}${folderName}/`;
        const params = {
            Bucket: BUCKET_NAME,
            Key: folderKey,
            Body: '' // Empty body for folder creation
        };

        await s3.putObject(params).promise();
        
        showStatus(`Folder "${folderName}" created successfully!`, 'success');
        
        // Refresh the folder list
        await loadFolders();
    } catch (error) {
        console.error('Error creating folder:', error);
        showStatus(`Failed to create folder: ${error.message}`, 'error');
    }
}

// Function to show share modal
function showShareModal(shareableUrl, folderName) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Folder Share Link</h3>
            <p>Share this link to provide access to all files in the folder:</p>
            <div class="share-options">
                <input type="text" 
                       value="${shareableUrl}" 
                       class="share-link" 
                       readonly>
                <button class="copy-link-btn">
                    <i class="fas fa-copy"></i> Copy Link
                </button>
            </div>
            <button class="close-btn">Close</button>
        </div>
    `;
    document.body.appendChild(modal);


    const copyBtn = modal.querySelector('.copy-link-btn');
    const closeBtn = modal.querySelector('.close-btn');
    const linkInput = modal.querySelector('.share-link');

    copyBtn.addEventListener('click', () => {
        linkInput.select();
        document.execCommand('copy');
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Link';
        }, 2000);
    });

    closeBtn.addEventListener('click', () => {
        modal.remove();
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
        }
    });
}


// Function to download all files using Lambda (modified for sharing)
async function downloadAllFiles(folderPrefix) {
    if (!await checkAuthenticated()) return;
    
    try {
        startOperation();
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
            loadingOverlay.querySelector('p').textContent = 'Generating shareable link...';
        }

        const lambda = initializeLambda();
        
        const response = await lambda.invoke({
            FunctionName: '<your-lambda-function-name>',
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify({
                folderPrefix: folderPrefix
            })
        }).promise();


        const result = JSON.parse(response.Payload);
        
        if (result.statusCode === 200 && result.body && result.body.shareableUrl) {
            showShareModal(result.body.shareableUrl, folderPrefix);
            showStatus('Shareable link generated successfully!', 'success');
        } else {
            throw new Error(result.body.error || 'Failed to generate shareable link');
        }

    } catch (error) {
        console.error('Error generating shareable link:', error);
        showStatus('Failed to generate link: ' + handleLambdaError(error), 'error');
    } finally {
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        endOperation();
    }
}



// Load client folders with retry logic
async function loadFolders() {
    if (!await checkAuthenticated()) return;

    try {
        startOperation();
        initializeS3();
        
        const params = {
            Bucket: BUCKET_NAME,
            Delimiter: '/',
            Prefix: FOLDER_PREFIX
        };

        const data = await s3.listObjectsV2(params).promise();
        const uploadFolderSelect = document.getElementById('folder-select');
        const browseFolderSelect = document.getElementById('browse-folder-select');
        const folderGrid = document.getElementById('folder-grid');
        
        // Clear existing options except the default ones
        while (uploadFolderSelect.options.length > 1) {
            uploadFolderSelect.remove(1);
        }
        while (browseFolderSelect.options.length > 1) {
            browseFolderSelect.remove(1);
        }
        folderGrid.innerHTML = '';

        // Add folders to selects and create folder cards
        if (data.CommonPrefixes) {
            data.CommonPrefixes.forEach(prefix => {
                const folderName = prefix.Prefix.replace(FOLDER_PREFIX, '').replace('/', '');
                
                // Add to upload folder select
                const uploadOption = new Option(folderName, prefix.Prefix);
                uploadFolderSelect.add(uploadOption);
                
                // Add to browse folder select
                const browseOption = new Option(folderName, prefix.Prefix);
                browseFolderSelect.add(browseOption);

                // Create folder card
                const folderCard = document.createElement('div');
                folderCard.className = 'folder-card';
                folderCard.innerHTML = `
                    <i class="fas fa-folder"></i>
                    <h4>${folderName}</h4>
                    <div class="folder-actions">
                        <button class="download-all-btn" data-folder="${prefix.Prefix}">
                            <i class="fas fa-share"></i> Share All
                        </button>
                    </div>
                `;
                folderGrid.appendChild(folderCard);

                // Add click handler for share all button
                const shareBtn = folderCard.querySelector('.download-all-btn');
                shareBtn.addEventListener('click', () => downloadAllFiles(prefix.Prefix));
            });
        }
    } catch (error) {
        console.error('Error loading folders:', error);
        showStatus('Failed to load client folders', 'error');
    } finally {
        endOperation();
    }
}

// Load and display media files
async function loadVideos() {
    if (!await checkAuthenticated()) return;

    try {
        startOperation();
        console.log('Initializing S3 client...');
        initializeS3();
        
        const videoList = document.getElementById('video-list');
        const selectedFolder = browsingFolder;

        // Show message if no folder is selected
        if (!selectedFolder) {
            videoList.innerHTML = `
                <div class="empty-state-message">
                    <i class="fas fa-folder-open"></i>
                    <p>Please select a client folder to view available media files</p>
                </div>
            `;
            return;
        }
        
        const params = {
            Bucket: BUCKET_NAME,
            Delimiter: '/',
            Prefix: selectedFolder
        };

        const data = await s3.listObjectsV2(params).promise();
        videoList.innerHTML = '';

        const mediaExtensions = [
            '.mp4', '.mov', '.avi', '.wmv', '.flv', '.mkv', '.webm',
            '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.wma', '.flac'
        ];

        let mediaCount = 0;
        let lastUploadDate = null;
        let totalSize = 0;

        if (data.Contents) {
            for (const object of data.Contents) {
                if (object.Key.endsWith('/') || object.Key.startsWith('downloads/')) {
                    continue;
                }

                const isMedia = mediaExtensions.some(ext => 
                    object.Key.toLowerCase().endsWith(ext)
                );

                if (isMedia) {
                    mediaCount++;
                    totalSize += object.Size;
                    if (!lastUploadDate || object.LastModified > lastUploadDate) {
                        lastUploadDate = object.LastModified;
                    }

                    const videoItem = document.createElement('div');
                    videoItem.className = 'video-item';

                    const fileName = object.Key.split('/').pop();
                    const cloudfrontUrl = getCloudFrontUrl(object.Key);

                    const link = document.createElement('a');
                    link.href = cloudfrontUrl;
                    link.textContent = fileName;
                    link.download = fileName;

                    const isAudioFile = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.wma', '.flac'].some(ext => 
                        fileName.toLowerCase().endsWith(ext)
                    );
                    link.className = isAudioFile ? 'audio-file' : 'video-file';

                    link.addEventListener('click', async (e) => {
                        e.preventDefault();
                        if (!await checkAuthenticated()) return;
                        window.open(cloudfrontUrl, '_blank');
                    });

                    const dateString = formatDateToUTC2(object.LastModified);
                    const sizeString = formatBytes(object.Size);
                    const infoElement = document.createElement('div');
                    infoElement.className = 'file-info';
                    infoElement.innerHTML = `
                        <span class="upload-date">Uploaded: ${dateString}</span>
                        <span class="file-size">Size: ${sizeString}</span>
                    `;

                    videoItem.appendChild(link);
                    videoItem.appendChild(infoElement);
                    videoList.appendChild(videoItem);
                }
            }
        }

        if (mediaCount > 0) {
            const statsDiv = document.createElement('div');
            statsDiv.className = 'folder-stats';
            statsDiv.innerHTML = `
                <div class="stats-item">
                    <i class="fas fa-file"></i>
                    <span class="stats-label">Files</span>
                    <span class="stats-value">${mediaCount}</span>
                </div>
                <div class="stats-item">
                    <i class="fas fa-hdd"></i>
                    <span class="stats-label">Total Size</span>
                    <span class="stats-value">${formatBytes(totalSize)}</span>
                </div>
                <div class="stats-item">
                    <i class="fas fa-clock"></i>
                    <span class="stats-label">Last Upload</span>
                    <span class="stats-value">${formatDateToUTC2(lastUploadDate)}</span>
                </div>
            `;
            videoList.insertBefore(statsDiv, videoList.firstChild);
        } else {
            videoList.innerHTML = `
                <div class="empty-state-message">
                    <i class="fas fa-file-video"></i>
                    <p>No media files found in this folder</p>
                </div>
            `;
        }

    } catch (error) {
        console.error('Full error details:', error);
        logError('Error in loadVideos', error);
        showStatus(`Failed to load media files: ${error.message}`, 'error');
    } finally {
        endOperation();
    }
}

// Utility Functions
function formatDateToUTC2(date) {
    const utc2Date = new Date(date.getTime() + (2 * 60 * 60 * 1000));
    return utc2Date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC'
    });
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('upload-status');
    statusDiv.textContent = message;
    statusDiv.className = `upload-status ${type}`;
    statusDiv.style.display = 'block';

    if (type === 'success' && !isUploading) {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }
}

// Initialize with retry
async function initializeWithRetry(maxRetries = MAX_RETRIES) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            await loadFolders();
            await loadVideos();
            return;
        } catch (error) {
            lastError = error;
            console.error(`Initialization attempt ${i + 1} failed:`, error);
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)));
            }
        }
    }
    showStatus('Failed to initialize application. Please refresh the page.', 'error');
    throw lastError;
}

// Event Listeners for Drag and Drop
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight(e) {
    dropZone.classList.add('dragover');
}

function unhighlight(e) {
    dropZone.classList.remove('dragover');
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

function handleFiles(files) {
    if (files.length > 0) {
        uploadButton.disabled = false;
        fileInput.files = files;
    }
}

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const uploadButton = document.getElementById('upload-button');
const progressBar = document.getElementById('progress-bar');
const progress = document.getElementById('progress');
const uploadForm = document.getElementById('upload-form');

// Event Listeners for Drag and Drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
});

dropZone.addEventListener('drop', handleDrop, false);
fileInput.addEventListener('change', function() {
    handleFiles(this.files);
});

async function generateUniqueFileName(s3, bucketName, folderPath, originalName) {
    // Split the filename into name and extension
    const lastDotIndex = originalName.lastIndexOf('.');
    const nameWithoutExt = originalName.substring(0, lastDotIndex);
    const ext = originalName.substring(lastDotIndex);
    
    let counter = 1;
    let newFileName = originalName;
    let exists = true;

    // Keep checking until we find a filename that doesn't exist
    while (exists) {
        try {
            // Check if file exists
            await s3.headObject({
                Bucket: bucketName,
                Key: `${folderPath}${newFileName}`
            }).promise();
            
            // If we get here, file exists, try next number
            newFileName = `${nameWithoutExt} (${counter})${ext}`;
            counter++;
        } catch (error) {
            if (error.code === 'NotFound') {
                // File doesn't exist, we can use this name
                exists = false;
            } else {
                // Some other error occurred
                throw error;
            }
        }
    }

    return newFileName;
}


// Upload form handler
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!await checkAuthenticated()) return;

    try {
        startOperation();

        if (!s3) {
            initializeS3();
        }

        const file = fileInput.files[0];
        const selectedFolder = document.getElementById('folder-select').value;

        if (!file) {
            showStatus('Please select a file', 'error');
            return;
        }

        if (selectedFolder === '') {
            showStatus('Please select a client folder', 'error');
            return;
        }

        // Show warning for large files
        if (file.size > 5 * 1024 * 1024 * 1024) { // 5GB
            const confirmLarge = confirm(
                `You are about to upload a large file (${formatBytes(file.size)}).\n\n` +
                `Estimated upload time:\n` +
                `- On 100Mbps: ${formatTime(file.size / (100 * 1024 * 1024 / 8))}\n` +
                `- On 50Mbps: ${formatTime(file.size / (50 * 1024 * 1024 / 8))}\n\n` +
                `Please ensure:\n` +
                `- Your connection is stable\n` +
                `- Your computer won't go to sleep\n` +
                `- Your browser tab remains open\n\n` +
                `Do you want to continue?`
            );
            
            if (!confirmLarge) {
                return;
            }
        }

        let filePath = `${selectedFolder}${file.name}`;

        // Check if file exists and show modal
        try {
            const exists = await s3.headObject({
                Bucket: BUCKET_NAME,
                Key: filePath
            }).promise().then(() => true).catch(() => false);

            if (exists) {
                // Show modal and wait for user choice
                const userChoice = await new Promise((resolve) => {
                    const modal = document.createElement('div');
                    modal.className = 'modal';
                    modal.innerHTML = `
                        <div class="modal-content" style="background: #1e1e1e; color: white !important;">
                            <h3 style="margin-bottom: 20px; color: white !important; font-size: 24px !important; font-weight: normal !important;">Upload options</h3>
                            <p style="color: white !important;">${file.name} already exists in this location. Do you want to replace the existing file with a new version or keep both files?</p>
                            <div style="display: flex; flex-direction: column; gap: 15px; margin: 20px 0;">
                                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: white !important;">
                                    <input type="radio" name="uploadOption" value="replace" checked>
                                    <span style="color: white !important;">Replace existing file</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: white !important;">
                                    <input type="radio" name="uploadOption" value="keep">
                                    <span style="color: white !important;">Keep both files</span>
                                </label>
                            </div>
                            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                                <button class="cancel-btn" style="padding: 8px 16px; background: transparent; color: white !important; border: 1px solid #fff; border-radius: 4px; cursor: pointer;">Cancel</button>
                                <button class="upload-btn" style="padding: 8px 16px; background: #4c8bf5; color: white !important; border: none; border-radius: 4px; cursor: pointer;">Upload</button>
                            </div>
                        </div>
                    `;

                    document.body.appendChild(modal);

                    modal.querySelector('.cancel-btn').addEventListener('click', () => {
                        modal.remove();
                        resolve(null);
                    });

                    modal.querySelector('.upload-btn').addEventListener('click', () => {
                        const selectedOption = modal.querySelector('input[name="uploadOption"]:checked').value;
                        modal.remove();
                        resolve(selectedOption);
                    });
                });

                if (!userChoice) {
                    // User cancelled
                    endOperation();
                    return;
                }

                if (userChoice === 'keep') {
                    // Generate a unique filename with numbering
                    const newFileName = await generateUniqueFileName(s3, BUCKET_NAME, selectedFolder, file.name);
                    filePath = `${selectedFolder}${newFileName}`;
                }

            }

            // Show upload preparation message
            showStatus('Preparing upload...', 'success');
            progressBar.style.display = 'block';
            uploadButton.disabled = true;
            isUploading = true;

            // Calculate optimal chunk size
            const optimalChunkSize = calculateOptimalChunkSize(file.size);
            console.log(`Uploading with chunk size: ${formatBytes(optimalChunkSize)}`);

            // Initialize upload tracking
            let uploadStartTime = Date.now();
            let lastProgressUpdate = uploadStartTime;
            let lastBytesUploaded = 0;

            const upload = new AWS.S3.ManagedUpload({
            params: {
                Bucket: BUCKET_NAME,
                Key: filePath,
                Body: file,
                ContentType: file.type,
                ACL: 'private'
            },
            partSize: 5 * 1024 * 1024,  // Keep the reliable 5MB chunk size
            queueSize: 4,               // Use a moderate number of concurrent uploads
            leavePartsOnError: true,
            httpOptions: {              // Add timeout settings
                timeout: 0,
                connectTimeout: 0
            }
        });


            // Add upload lifecycle handlers
            upload.on('httpUploadProgress', (progressEvent) => {
                const currentTime = Date.now();
                const elapsedTime = (currentTime - lastProgressUpdate) / 1000; // seconds
                const bytesUploaded = progressEvent.loaded - lastBytesUploaded;
                const uploadSpeed = bytesUploaded / elapsedTime; // bytes per second
                
                const percentage = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                const totalElapsedTime = (currentTime - uploadStartTime) / 1000;
                const estimatedTotalTime = (totalElapsedTime / percentage) * 100;
                const remainingTime = estimatedTotalTime - totalElapsedTime;

                progress.style.width = percentage + '%';
                
                showStatus(
                    `Upload Progress: ${percentage}%\n` +
                    `Speed: ${formatSpeed(uploadSpeed * 8)}\n` + // Convert to bits for network speed
                    `Uploaded: ${formatBytes(progressEvent.loaded)} of ${formatBytes(progressEvent.total)}\n` +
                    `Estimated time remaining: ${formatTime(remainingTime)}`,
                    'success'
                );

                lastProgressUpdate = currentTime;
                lastBytesUploaded = progressEvent.loaded;
            });

            // Set up abort handler for page navigation
            const beforeUnloadHandler = (e) => {
                if (isUploading) {
                    e.preventDefault();
                    e.returnValue = 'Upload in progress. Are you sure you want to leave?';
                    return e.returnValue;
                }
            };
            window.addEventListener('beforeunload', beforeUnloadHandler);

            try {
                await upload.promise();
                
                console.log('Upload completed:', filePath);
                isUploading = false;
                showStatus('Upload successful!', 'success');
                
                // Cleanup
                window.removeEventListener('beforeunload', beforeUnloadHandler);
                
                // Reset UI
                progress.style.width = '0%';
                progressBar.style.display = 'none';
                uploadButton.disabled = false;
                fileInput.value = '';
                
                // Refresh file list if in same folder
                if (browsingFolder === selectedFolder) {
                    await loadVideos();
                }
            } catch (uploadError) {
                console.error('Upload error:', uploadError);
                
                if (uploadError.code === 'AccessDenied' || uploadError.code === 'ExpiredToken') {
                    try {
                        await forceTokenRefresh();
                        showStatus('Session refreshed. Please try upload again.', 'error');
                    } catch (refreshError) {
                        showStatus('Session expired. Please log in again.', 'error');
                        showSection('login-section');
                    }
                } else {
                    showStatus(`Upload failed: ${uploadError.message}`, 'error');
                }
            }

        } catch (error) {
            console.error('Error checking file existence:', error);
            showStatus('Error checking file existence', 'error');
            return;
        }

    } catch (error) {
        console.error('Upload error:', error);
        isUploading = false;
        showStatus('Upload failed: ' + error.message, 'error');
        progress.style.width = '0%';
        progressBar.style.display = 'none';
        uploadButton.disabled = false;
    } finally {
        endOperation();
    }
});



// Folder selection handlers
document.getElementById('folder-select').addEventListener('change', function(e) {
    currentFolder = e.target.value;
});

document.getElementById('browse-folder-select').addEventListener('change', function(e) {
    browsingFolder = e.target.value;
    loadVideos();
});

// Search functionality
document.getElementById('search-input').addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    const videoItems = document.querySelectorAll('.video-item');

    videoItems.forEach(item => {
        const videoName = item.querySelector('a').textContent.toLowerCase();
        item.style.display = videoName.includes(searchTerm) ? '' : 'none';
    });
});

// Sort functionality
let sortNameAsc = true;
let sortDateAsc = true;

document.getElementById('sort-name').addEventListener('click', function() {
    sortVideos('name', sortNameAsc);
    sortNameAsc = !sortNameAsc;
    
    // Update icon
    const icon = this.querySelector('i');
    icon.className = sortNameAsc ? 'fas fa-sort-alpha-down' : 'fas fa-sort-alpha-up';
});

document.getElementById('sort-date').addEventListener('click', function() {
    sortVideos('date', sortDateAsc);
    sortDateAsc = !sortDateAsc;
    
    // Update icon
    const icon = this.querySelector('i');
    icon.className = sortDateAsc ? 'fas fa-sort-numeric-down' : 'fas fa-sort-numeric-up';
});

function sortVideos(by, asc) {
    const videoList = document.getElementById('video-list');
    const videos = Array.from(videoList.children);

    if (videos.length > 0 && !videos[0].classList.contains('empty-state-message')) {
        videos.sort((a, b) => {
            if (by === 'name') {
                const nameA = a.querySelector('a').textContent;
                const nameB = b.querySelector('a').textContent;
                return asc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
            } else {
                const dateA = new Date(a.querySelector('.upload-date').textContent.split('Uploaded: ')[1]);
                const dateB = new Date(b.querySelector('.upload-date').textContent.split('Uploaded: ')[1]);
                return asc ? dateA - dateB : dateB - dateA;
            }
        });

        videoList.innerHTML = '';
        videos.forEach(video => videoList.appendChild(video));
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('Application initialized, waiting for authentication...');
});

// Global error handler
window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global error:', {message, source, lineno, colno, error});
    showStatus('An error occurred. Please refresh the page.', 'error');
    return false;
};
