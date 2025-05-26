# S3 Video Management System

## Description

A secure, single-page web application for managing video files in Amazon S3. Built with vanilla JavaScript and AWS services, it provides an intuitive interface for uploading, managing, and accessing video content through CloudFront. Features Cognito user authentication for secure access control.

### Key Features

- 🎥 Support for various media formats (video and audio)
- 📁 Client folder organization
- ⚡ High-performance chunked uploads
- 🔄 Resume-capable file transfers
- 🔍 Advanced search and sort capabilities
- 🔐 Secure AWS Cognito authentication
- 🌐 CloudFront content delivery
- 📱 Responsive design
- 🎯 Drag and drop interface

## Technical Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Cloud Services**: 
  - AWS S3 for storage
  - AWS Cognito for authentication
  - AWS CloudFront for content delivery
  - AWS Lambda for serverless operations
  - 
- **Libraries**:
  - AWS SDK for JavaScript
  - Amazon Cognito Identity SDK
  - JSZip for bulk downloads
  - Font Awesome for icons

## Setup and Configuration

### Prerequisites

- AWS Account
- Configured S3 bucket
- CloudFront distribution
- Cognito User Pool
- Cognito Identity Pool

## AWS Configuration Requirements

1. S3 Bucket:
   - Appropriate CORS configuration
   - Bucket policy for CloudFront access
   - Proper IAM roles and permissions

2. CloudFront Distribution:
   - Configured with S3 origin
   - Appropriate response headers policy for CORS
   - SSL/TLS certificate (if using custom domain)

3. Cognito User Pool:
   - Username-based authentication
   - Appropriate password policies
   - App client configured

4. Cognito Identity Pool:
   - Linked to User Pool
   - Appropriate IAM roles for authenticated users
  
##  AWS Lambda Configuration

1. Create a new Lambda function:
- Go to AWS Lambda console
- Click "Create function"
- Choose "Author from scratch"
- Set Runtime to Node.js 18.x
- Set appropriate IAM role with necessary permissions
- 
2. Required IAM Permissions for Lambda:

{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:ListBucket",
                "s3:DeleteObject"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket-name",
                "arn:aws:s3:::your-bucket-name/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "cloudfront:CreateInvalidation",
                "cloudfront:GetDistribution"
            ],
            "Resource": "*"
        }
    ]
}

3. Lambda Function Code:

const { S3Client, ListObjectsCommand, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3Client = new S3Client({ region: "<provide-region>" });
const CLOUDFRONT_DOMAIN = '<CLOUDFRONT_DOMAIN>';

exports.handler = async (event) => {
    try {
        const { folderPrefix } = event;  // Removed expirationDays parameter
        
        if (!folderPrefix) {
            throw new Error('folderPrefix is required');
        }

        // List objects in the folder
        const listCommand = new ListObjectsCommand({
            Bucket: 'cptsiteza',
            Prefix: folderPrefix
        });
        
        const listedObjects = await s3Client.send(listCommand);

        // Generate CloudFront URLs for each file
        const fileUrls = listedObjects.Contents
            .filter(obj => obj.Size > 0)
            .map(obj => ({
                name: obj.Key.split('/').pop(),
                url: `https://${CLOUDFRONT_DOMAIN}/${encodeURIComponent(obj.Key)}`,
                size: obj.Size,
                lastModified: obj.LastModified
            }));

        // Create HTML page with styling (removed expiration notice)
        const landingPage = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shared Files</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .file-list {
            list-style: none;
            padding: 0;
        }
        .file-item {
            background: white;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .file-name {
            font-weight: bold;
            margin-bottom: 5px;
        }
        .file-meta {
            font-size: 0.9em;
            color: #666;
            margin-bottom: 10px;
        }
        .download-btn {
            background: #2196F3;
            color: white;
            padding: 8px 16px;
            text-decoration: none;
            border-radius: 4px;
            display: inline-block;
        }
        .download-btn:hover {
            background: #1976D2;
        }
        h1 {
            color: #2196F3;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <h1>Shared Files</h1>
    <div class="file-list">
        ${fileUrls.map(file => `
            <div class="file-item">
                <div class="file-name">${file.name}</div>
                <div class="file-meta">
                    Size: ${formatBytes(file.size)} | 
                    Modified: ${new Date(file.lastModified).toLocaleString()}
                </div>
                <a href="${file.url}" class="download-btn" download="${file.name}">Download</a>
            </div>
        `).join('')}
    </div>
</body>
</html>`;

        // Create a unique key for the share page
        const shareKey = `shares/${Date.now()}-${folderPrefix.replace(/\//g, '-')}index.html`;
        
        // Upload the HTML page to S3
        const putCommand = new PutObjectCommand({
            Bucket: 'cptsiteza',
            Key: shareKey,
            Body: landingPage,
            ContentType: 'text/html'
        });
        
        await s3Client.send(putCommand);

        // Generate the CloudFront URL for the share page
        const shareUrl = `https://${CLOUDFRONT_DOMAIN}/${encodeURIComponent(shareKey)}`;

        return {
            statusCode: 200,
            body: {
                shareableUrl: shareUrl
            }
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: error.statusCode || 500,
            body: {
                error: error.message || 'An unexpected error occurred'
            }
        };
    }
};

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/s3-video-management.git
```

2. Update AWS configuration in `auth.js`:
```javascript
const poolData = {
    UserPoolId: 'your-user-pool-id',
    ClientId: 'your-app-client-id'
};

const IDENTITY_POOL_ID = 'your-identity-pool-id';
const REGION = 'your-region';
```

3. Update S3 and CloudFront configuration in `app.js`:
```javascript
const BUCKET_NAME = 'your-bucket-name';
const CLOUDFRONT_DOMAIN = 'your-cloudfront-domain';
```

## User Management

- Users are managed by administrators through the AWS Cognito Console
- New users can be created and managed directly in Cognito
- Password policies and requirements are enforced by Cognito
- First-time login requires password change

## Security Features

- Secure user authentication
- Protected S3 bucket access
- CloudFront content delivery
- CORS protection
- Automatic session handling
- Secure credential management

## Usage

1. Access the application through your web browser
2. Log in with credentials provided by your administrator
3. Upload videos using drag-and-drop or file selection
4. Browse, search, and sort your video collection
5. Access videos through secure CloudFront URLs

## Features in Detail

### Secure File Upload
- Chunked upload support for large files
- Progress tracking with speed and time estimation
- Automatic retry on failure
- File existence checking
- Duplicate file handling
  
### File Management
- Create and organize client folders
- Sort files by name or date
- Search functionality
- File type filtering
- Detailed file statistics

### Sharing Capabilities
- Generate secure sharing links
- Bulk download functionality
-CloudFront integration for fast delivery
- Link expiration management
  
### Security Features
- AWS Cognito authentication
- Session management
-Token refresh handling
- Secure file access controls
   

## Project Structure

```
├── index.html          # Main HTML file
├── styles.css         # Styles and layout
├── auth.js           # Authentication handling
├── app.js            # Main application logic
└── README.md         # Documentation
```

### Authentication System (auth.js)
Cognito integration
Session management
Token refresh logic

### File Management (app.js)
Upload handling
Download management
Folder organization
Search and sort functionality

### User Interface (styles.css)
Responsive design
Modern UI components
Progress indicators
Toast notifications

## Future Improvements

- Video preview functionality
- Bulk upload capabilities
- Video categorization
- Advanced search filters
- Usage analytics
- Custom video player integration
- Thumbnail generation

## License

This project is licensed under the MIT License - see the LICENSE.mdfile for details.
