// // Initialize AWS configuration
// AWS.config.region = 'us-east-1';

// // Create S3 service object - but don't initialize it yet
// let s3;

// const BUCKET_NAME = 'loaddyshed';
// const CLOUDFRONT_DOMAIN = 'https://d1aj86wp1ynrv7.cloudfront.net';

// // Function to initialize S3 client
// function initializeS3() {
//     if (!AWS.config.credentials) {
//         throw new Error('AWS credentials not initialized');
//     }
    
//     s3 = new AWS.S3({
//         apiVersion: '2006-03-01',
//         region: AWS.config.region,
//         credentials: AWS.config.credentials
//     });
// }

// // Utility function for error logging
// function logError(message, error) {
//     console.error(`${message}:`, error);
//     console.error('Stack:', error.stack);
// }

// // Utility function for CloudFront URL generation
// function getCloudFrontUrl(key) {
//     const sanitizedKey = key.replace(/^\/+/, '');
//     return `${CLOUDFRONT_DOMAIN}/${encodeURIComponent(sanitizedKey)}`;
// }

// // Check authentication before any S3 operation
// async function checkAuthenticated() {
//     try {
//         await checkAuth();
//         return true;
//     } catch (error) {
//         showSection('login-section');
//         showAuthMessage('Please login to continue');
//         return false;
//     }
// }

// // DOM Elements
// const dropZone = document.getElementById('drop-zone');
// const fileInput = document.getElementById('file-input');
// const uploadButton = document.getElementById('upload-button');
// const progressBar = document.getElementById('progress-bar');
// const progress = document.getElementById('progress');
// const uploadForm = document.getElementById('upload-form');

// // Utility Functions
// function formatDateToUTC2(date) {
//     const utc2Date = new Date(date.getTime() + (2 * 60 * 60 * 1000));
//     return utc2Date.toLocaleString('en-US', {
//         year: 'numeric',
//         month: 'short',
//         day: 'numeric',
//         hour: '2-digit',
//         minute: '2-digit',
//         hour12: true,
//         timeZone: 'UTC'
//     });
// }

// function showStatus(message, type) {
//     const statusDiv = document.getElementById('upload-status');
//     statusDiv.textContent = message;
//     statusDiv.className = `upload-status ${type}`;
//     statusDiv.style.display = 'block';

//     if (type === 'success') {
//         setTimeout(() => {
//             statusDiv.style.display = 'none';
//         }, 3000);
//     }
// }

// function updateStats(videoCount, lastUploadDate) {
//     document.getElementById('video-count').textContent = videoCount;
//     document.getElementById('last-upload').textContent = lastUploadDate ?
//         formatDateToUTC2(new Date(lastUploadDate)) : 'Never';
// }

// // Drag and Drop Handlers
// function preventDefaults(e) {
//     e.preventDefault();
//     e.stopPropagation();
// }

// function highlight(e) {
//     dropZone.classList.add('dragover');
// }

// function unhighlight(e) {
//     dropZone.classList.remove('dragover');
// }

// function handleDrop(e) {
//     const dt = e.dataTransfer;
//     const files = dt.files;
//     handleFiles(files);
// }

// function handleFiles(files) {
//     if (files.length > 0) {
//         uploadButton.disabled = false;
//         fileInput.files = files;
//     }
// }

// // Event Listeners for Drag and Drop
// ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
//     dropZone.addEventListener(eventName, preventDefaults, false);
// });

// ['dragenter', 'dragover'].forEach(eventName => {
//     dropZone.addEventListener(eventName, highlight, false);
// });

// ['dragleave', 'drop'].forEach(eventName => {
//     dropZone.addEventListener(eventName, unhighlight, false);
// });

// dropZone.addEventListener('drop', handleDrop, false);
// fileInput.addEventListener('change', function() {
//     handleFiles(this.files);
// });

// // Load and display videos
// async function loadVideos() {
//     if (!await checkAuthenticated()) return;

//     try {
//         console.log('Initializing S3 client...');
//         initializeS3();
        
//         console.log('Starting to load videos...');
//         const params = {
//             Bucket: BUCKET_NAME,
//             Delimiter: '/'
//         };

//         console.log('Request parameters:', params);

//         const data = await s3.listObjectsV2(params).promise();
//         console.log('S3 list response:', data);

//         const videoList = document.getElementById('video-list');
//         videoList.innerHTML = '';

//         const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.mkv', '.webm'];
//         let videoCount = 0;
//         let lastUploadDate = null;

//         for (const object of data.Contents) {
//             const isVideo = videoExtensions.some(ext => 
//                 object.Key.toLowerCase().endsWith(ext)
//             );
//             const isInRoot = object.Key.indexOf('/') === -1;

//             if (isVideo && isInRoot) {
//                 videoCount++;
//                 if (!lastUploadDate || object.LastModified > lastUploadDate) {
//                     lastUploadDate = object.LastModified;
//                 }

//                 const videoItem = document.createElement('div');
//                 videoItem.className = 'video-item';

//                 const cloudfrontUrl = getCloudFrontUrl(object.Key);
//                 console.log(`Generated URL for ${object.Key}:`, cloudfrontUrl);

//                 const link = document.createElement('a');
//                 link.href = cloudfrontUrl;
//                 link.textContent = object.Key;
//                 link.download = object.Key;

//                 link.addEventListener('click', async (e) => {
//                     e.preventDefault();
//                     if (!await checkAuthenticated()) return;

//                     try {
//                         const response = await fetch(cloudfrontUrl, {
//                             method: 'HEAD',
//                             mode: 'cors',
//                             headers: {
//                                 'Accept': 'video/*',
//                                 'Origin': window.location.origin
//                             }
//                         });
                        
//                         if (response.ok) {
//                             window.open(cloudfrontUrl, '_blank');
//                         } else {
//                             throw new Error(`HTTP error! status: ${response.status}`);
//                         }
//                     } catch (error) {
//                         console.error('Error handling video click:', error);
//                         // If HEAD request fails, try direct access
//                         window.open(cloudfrontUrl, '_blank');
//                     }
//                 });

//                 const dateString = formatDateToUTC2(object.LastModified);
//                 const dateElement = document.createElement('span');
//                 dateElement.textContent = `Uploaded: ${dateString}`;

//                 videoItem.appendChild(link);
//                 videoItem.appendChild(dateElement);
//                 videoList.appendChild(videoItem);
//             }
//         }

//         updateStats(videoCount, lastUploadDate);
//         console.log(`Loaded ${videoCount} videos`);

//     } catch (error) {
//         console.error('Full error details:', error);
//         logError('Error in loadVideos', error);
//         showStatus(`Failed to load videos: ${error.message}`, 'error');
//     }
// }

// // Upload form handler
// uploadForm.addEventListener('submit', async (e) => {
//     e.preventDefault();
//     if (!await checkAuthenticated()) return;

//     try {
//         if (!s3) {
//             initializeS3();
//         }

//         const file = fileInput.files[0];

//         if (!file) {
//             showStatus('Please select a file', 'error');
//             return;
//         }

//         progressBar.style.display = 'block';
//         uploadButton.disabled = true;

//         const params = {
//             Bucket: BUCKET_NAME,
//             Key: file.name,
//             Body: file,
//             ContentType: file.type,
//             ACL: 'private'
//         };

//         // Configure the upload
//         const upload = new AWS.S3.ManagedUpload({
//             params: params,
//             service: s3,
//             partSize: 5 * 1024 * 1024, // 5MB parts
//             queueSize: 1
//         });

//         // Add upload progress handler
//         upload.on('httpUploadProgress', (progressEvent) => {
//             const percentage = Math.round((progressEvent.loaded / progressEvent.total) * 100);
//             progress.style.width = percentage + '%';
//             showStatus(`Upload progress: ${percentage}%`, 'success');
//         });

//         // Perform the upload
//         await upload.promise();
        
//         console.log('Upload completed:', file.name);
//         showStatus('Upload successful!', 'success');
//         progress.style.width = '0%';
//         progressBar.style.display = 'none';
//         uploadButton.disabled = false;
//         fileInput.value = '';
//         loadVideos();
//     } catch (error) {
//         console.error('Upload error:', error);
//         showStatus('Upload failed: ' + error.message, 'error');
//         progress.style.width = '0%';
//         progressBar.style.display = 'none';
//         uploadButton.disabled = false;
//     }
// });

// // Search functionality
// document.getElementById('search-input').addEventListener('input', function(e) {
//     const searchTerm = e.target.value.toLowerCase();
//     const videoItems = document.querySelectorAll('.video-item');

//     videoItems.forEach(item => {
//         const videoName = item.querySelector('a').textContent.toLowerCase();
//         item.style.display = videoName.includes(searchTerm) ? '' : 'none';
//     });
// });

// // Sort functionality
// let sortNameAsc = true;
// let sortDateAsc = true;

// document.getElementById('sort-name').addEventListener('click', function() {
//     sortVideos('name', sortNameAsc);
//     sortNameAsc = !sortNameAsc;
// });

// document.getElementById('sort-date').addEventListener('click', function() {
//     sortVideos('date', sortDateAsc);
//     sortDateAsc = !sortDateAsc;
// });

// function sortVideos(by, asc) {
//     const videoList = document.getElementById('video-list');
//     const videos = Array.from(videoList.children);

//     videos.sort((a, b) => {
//         if (by === 'name') {
//             const nameA = a.querySelector('a').textContent;
//             const nameB = b.querySelector('a').textContent;
//             return asc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
//         } else {
//             const dateA = new Date(a.querySelector('span').textContent.split('Uploaded: ')[1]);
//             const dateB = new Date(b.querySelector('span').textContent.split('Uploaded: ')[1]);
//             return asc ? dateA - dateB : dateB - dateA;
//         }
//     });

//     videoList.innerHTML = '';
//     videos.forEach(video => videoList.appendChild(video));
// }

// // Initialize the application
// document.addEventListener('DOMContentLoaded', async () => {
//     console.log('Application initialized, waiting for authentication...');
// });


// Initialize AWS configuration
AWS.config.region = 'us-east-1';

// Create S3 service object - but don't initialize it yet
let s3;
let isUploading = false;

const BUCKET_NAME = 'loaddyshed';
const CLOUDFRONT_DOMAIN = 'https://d1aj86wp1ynrv7.cloudfront.net';

// Function to initialize S3 client
function initializeS3() {
    if (!AWS.config.credentials) {
        throw new Error('AWS credentials not initialized');
    }
    
    s3 = new AWS.S3({
        apiVersion: '2006-03-01',
        region: AWS.config.region,
        credentials: AWS.config.credentials
    });
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

// Check authentication before any S3 operation
async function checkAuthenticated() {
    try {
        await checkAuth();
        return true;
    } catch (error) {
        showSection('login-section');
        showAuthMessage('Please login to continue');
        return false;
    }
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

    // Only auto-hide if it's not an upload progress message and not currently uploading
    if (type === 'success' && !isUploading) {
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
    if (!await checkAuthenticated()) return;

    try {
        console.log('Initializing S3 client...');
        initializeS3();
        
        console.log('Starting to load videos...');
        const params = {
            Bucket: BUCKET_NAME,
            Delimiter: '/'
        };

        console.log('Request parameters:', params);

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

                link.addEventListener('click', async (e) => {
                    e.preventDefault();
                    if (!await checkAuthenticated()) return;

                    try {
                        const response = await fetch(cloudfrontUrl, {
                            method: 'HEAD',
                            mode: 'cors',
                            headers: {
                                'Accept': 'video/*',
                                'Origin': window.location.origin
                            }
                        });
                        
                        if (response.ok) {
                            window.open(cloudfrontUrl, '_blank');
                        } else {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                    } catch (error) {
                        console.error('Error handling video click:', error);
                        // If HEAD request fails, try direct access
                        window.open(cloudfrontUrl, '_blank');
                    }
                });

                const dateString = formatDateToUTC2(object.LastModified);
                const dateElement = document.createElement('span');
                dateElement.textContent = `Uploaded: ${dateString}`;

                videoItem.appendChild(link);
                videoItem.appendChild(dateElement);
                videoList.appendChild(videoItem);
            }
        }

        updateStats(videoCount, lastUploadDate);
        console.log(`Loaded ${videoCount} videos`);

    } catch (error) {
        console.error('Full error details:', error);
        logError('Error in loadVideos', error);
        showStatus(`Failed to load videos: ${error.message}`, 'error');
    }
}

// Upload form handler
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!await checkAuthenticated()) return;

    try {
        if (!s3) {
            initializeS3();
        }

        const file = fileInput.files[0];

        if (!file) {
            showStatus('Please select a file', 'error');
            return;
        }

        progressBar.style.display = 'block';
        uploadButton.disabled = true;
        isUploading = true; // Set flag when upload starts

        const params = {
            Bucket: BUCKET_NAME,
            Key: file.name,
            Body: file,
            ContentType: file.type,
            ACL: 'private'
        };

        // Configure the upload
        const upload = new AWS.S3.ManagedUpload({
            params: params,
            service: s3,
            partSize: 5 * 1024 * 1024,
            queueSize: 1
        });

        // Add upload progress handler
        upload.on('httpUploadProgress', (progressEvent) => {
            const percentage = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            progress.style.width = percentage + '%';
            showStatus(`Upload progress: ${percentage}%`, 'success');
        });

        // Perform the upload
        await upload.promise();
        
        console.log('Upload completed:', file.name);
        isUploading = false; // Reset flag when upload completes
        showStatus('Upload successful!', 'success');
        progress.style.width = '0%';
        progressBar.style.display = 'none';
        uploadButton.disabled = false;
        fileInput.value = '';
        loadVideos();
    } catch (error) {
        console.error('Upload error:', error);
        isUploading = false; // Reset flag on error
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

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Application initialized, waiting for authentication...');
});
