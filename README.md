# S3 Video Management System

## Description

A secure, single-page web application for managing video files in Amazon S3. Built with vanilla JavaScript and AWS services, it provides an intuitive interface for uploading, managing, and accessing video content through CloudFront. Features Cognito user authentication for secure access control.

## Features

- Secure user authentication via Amazon Cognito
- Drag-and-drop file upload to Amazon S3
- Secure video delivery through CloudFront
- Real-time upload progress tracking
- Video browsing with search and sort capabilities
- Responsive design for all devices
- Administrator-controlled user access

## Technologies Used

- Frontend:
  - Vanilla JavaScript
  - HTML5
  - CSS3
  - Font Awesome icons

- AWS Services:
  - Amazon S3 for storage
  - Amazon CloudFront for content delivery
  - Amazon Cognito for authentication
  - AWS SDK for JavaScript

## Prerequisites

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

## Project Structure

```
├── index.html          # Main HTML file
├── styles.css         # Styles and layout
├── auth.js           # Authentication handling
├── app.js            # Main application logic
└── README.md         # Documentation
```

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
