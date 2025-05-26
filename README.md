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
