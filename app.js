// Configure AWS SDK
AWS.config.update({
    region: '', // e.g., 'us-east-1'
    credentials: new AWS.Credentials({
        accessKeyId: '',
        secretAccessKey: ''
    })
});

// Create S3 service object
const s3 = new AWS.S3({
    apiVersion: '2006-03-01'
});

const BUCKET_NAME = '';
const CLOUDFRONT_DOMAIN = ''; // e.g., 'd123456789.cloudfront.net'
const EXPIRATION_TIME = 30; // 30 seconds for testing (change to 604800 for 7 days in production)

// Utility function for error logging
function logError(message, error) {
    console.error(`${message}:`, error);
    console.error('Stack:', error.stack);
}

// Utility function for CloudFront URL generation
function getCloudFrontUrl(key) {
    const sanitizedKey = key.replace(/^\/+/, '');
    return `https://${CLOUDFRONT_DOMAIN}/${encodeURIComponent(sanitizedKey)}`;
}

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const uploadButton = document.getElementById('upload-button');
const progressBar = document.getElementById('progress-bar');
const progress = document.getElementById('progress');
const uploadForm = document.getElementById('upload-form');

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

    if (type === 'success') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }
}

function updateStats(videoCount, lastUploadDate) {
    document.getElementById('video-count').textContent = videoCount;
    document.getElementById('last-upload').textContent = lastUploadDate ? 
        formatDateToUTC2(new Date(lastUploadDate)) : 'Never';
}

function startCountdown(timerSpan, link, refreshButton) {
    let timeLeft = EXPIRATION_TIME;
    let timer;

    const updateTimer = () => {
        if (timeLeft > 0) {
            const days = Math.floor(timeLeft / 86400);
            const hours = Math.floor((timeLeft % 86400) / 3600);
            const minutes = Math.floor((timeLeft % 3600) / 60);
            const seconds = timeLeft % 60;
            
            let timeString = '';
            if (days > 0) timeString += `${days}d `;
            if (hours > 0 || days > 0) timeString += `${hours}h `;
            if (minutes > 0 || hours > 0 || days > 0) timeString += `${minutes}m `;
            timeString += `${seconds}s`;
            
            timerSpan.textContent = ` (Expires in: ${timeString})`;
            refreshButton.style.display = 'none';
            timeLeft--;
        } else {
            timerSpan.textContent = ' (Link expired)';
            link.removeAttribute('href');
            link.classList.add('expired');
            refreshButton.style.display = 'inline-block';
            if (timer) {
                clearInterval(timer);
            }
        }
    };

    updateTimer();
    timer = setInterval(updateTimer, 1000);
    return () => {
        if (timer) {
            clearInterval(timer);
        }
    };
}

// Drag and Drop Handlers
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

// Load and display videos
async function loadVideos() {
    try {
        console.log('Starting to load videos...');
        const params = {
            Bucket: BUCKET_NAME,
            Delimiter: '/'
        };

        const data = await s3.listObjectsV2(params).promise();
        console.log('S3 list response:', data);

        const videoList = document.getElementById('video-list');
        videoList.innerHTML = '';

        const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.mkv', '.webm'];
        let videoCount = 0;
        let lastUploadDate = null;

        for (const object of data.Contents) {
            const isVideo = videoExtensions.some(ext => 
                object.Key.toLowerCase().endsWith(ext)
            );
            const isInRoot = object.Key.indexOf('/') === -1;

            if (isVideo && isInRoot) {
                videoCount++;
                if (!lastUploadDate || object.LastModified > lastUploadDate) {
                    lastUploadDate = object.LastModified;
                }

                const videoItem = document.createElement('div');
                videoItem.className = 'video-item';

                const cloudfrontUrl = getCloudFrontUrl(object.Key);
                console.log(`Generated URL for ${object.Key}:`, cloudfrontUrl);

                const link = document.createElement('a');
                link.href = cloudfrontUrl;
                link.textContent = object.Key;
                link.download = object.Key;

                // Add click handler to manage headers
                link.addEventListener('click', async (e) => {
                    e.preventDefault();
                    try {
                        const response = await fetch(cloudfrontUrl, {
                            method: 'GET',
                            headers: {
                                'Accept': 'video/*',
                                'Origin': window.location.origin
                            }
                        });
                        
                        if (response.ok) {
                            window.location.href = cloudfrontUrl;
                        } else {
                            console.error('Error fetching video:', response.status);
                            showStatus('Error accessing video', 'error');
                        }
                    } catch (error) {
                        console.error('Error handling video click:', error);
                        showStatus('Error accessing video', 'error');
                    }
                });

                const refreshButton = document.createElement('button');
                refreshButton.className = 'video-refresh-button';
                refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
                refreshButton.style.display = 'none';

                refreshButton.onclick = async (e) => {
                    e.preventDefault();
                    const newUrl = getCloudFrontUrl(object.Key);
                    link.href = newUrl;
                    link.classList.remove('expired');
                    refreshButton.style.display = 'none';
                    startCountdown(timerSpan, link, refreshButton);
                    showStatus(`Link refreshed for ${object.Key}`, 'success');
                };

                const timerSpan = document.createElement('span');
                timerSpan.className = 'timer';

                const dateString = formatDateToUTC2(object.LastModified);
                const dateElement = document.createElement('span');
                dateElement.textContent = `Uploaded: ${dateString}`;

                const videoControls = document.createElement('div');
                videoControls.className = 'video-controls';
                videoControls.appendChild(refreshButton);

                videoItem.appendChild(link);
                videoItem.appendChild(dateElement);
                videoItem.appendChild(timerSpan);
                videoItem.appendChild(videoControls);
                videoList.appendChild(videoItem);

                startCountdown(timerSpan, link, refreshButton);
            }
        }

        updateStats(videoCount, lastUploadDate);
        console.log(`Loaded ${videoCount} videos`);

    } catch (error) {
        logError('Error in loadVideos', error);
        showStatus(`Failed to load videos: ${error.message}`, 'error');
    }
}

// Upload form handler
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = fileInput.files[0];

    if (!file) {
        showStatus('Please select a file', 'error');
        return;
    }

    try {
        progressBar.style.display = 'block';
        uploadButton.disabled = true;

        const params = {
            Bucket: BUCKET_NAME,
            Key: file.name,
            Body: file,
            ContentType: file.type
        };

        console.log('Starting upload:', file.name);
        const upload = s3.upload(params);
        
        upload.on('httpUploadProgress', (progressEvent) => {
            const percentage = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            progress.style.width = percentage + '%';
            showStatus(`Upload progress: ${percentage}%`, 'success');
        });

        await upload.promise();
        console.log('Upload completed:', file.name);
        showStatus('Upload successful!', 'success');
        progress.style.width = '0%';
        progressBar.style.display = 'none';
        uploadButton.disabled = false;
        fileInput.value = '';
        loadVideos();
    } catch (error) {
        console.error('Upload error:', error);
        showStatus('Upload failed: ' + error.message, 'error');
        progress.style.width = '0%';
        progressBar.style.display = 'none';
        uploadButton.disabled = false;
    }
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
});

document.getElementById('sort-date').addEventListener('click', function() {
    sortVideos('date', sortDateAsc);
    sortDateAsc = !sortDateAsc;
});

function sortVideos(by, asc) {
    const videoList = document.getElementById('video-list');
    const videos = Array.from(videoList.children);
    
    videos.sort((a, b) => {
        if (by === 'name') {
            const nameA = a.querySelector('a').textContent;
            const nameB = b.querySelector('a').textContent;
            return asc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        } else {
            const dateA = new Date(a.querySelector('span').textContent.split('Uploaded: ')[1]);
            const dateB = new Date(b.querySelector('span').textContent.split('Uploaded: ')[1]);
            return asc ? dateA - dateB : dateB - dateA;
        }
    });
    
    videoList.innerHTML = '';
    videos.forEach(video => videoList.appendChild(video));
}

// Initial load of videos
console.log('Initializing application...');
loadVideos();
