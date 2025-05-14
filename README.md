# S3 Video Management System

## Description

This project is a web-based application that provides a user-friendly interface for managing video files stored in Amazon S3. It integrates with CloudFront for secure content delivery and offers features such as drag-and-drop uploads, video browsing, searching, and sorting.

## Features

- Drag-and-drop file upload to Amazon S3
- Secure video delivery through CloudFront
- List, search, and sort uploaded videos
- Progress bar for upload status
- Responsive design for various device sizes
- Automatic expiration and refresh of video links

## Technologies Used

- Frontend: HTML, CSS, JavaScript
- Backend: Amazon S3 for storage
- CDN: Amazon CloudFront
- AWS SDK for JavaScript

## Setup

1. Clone the repository
2. Update the AWS configuration in `app.js`:
   - Set your AWS region
   - Update the S3 bucket name
   - Set your CloudFront domain
3. Ensure your AWS IAM user has the necessary permissions
4. Configure your S3 bucket policy to allow access from both CloudFront and your IAM user
5. Set up CORS configuration for your S3 bucket

## Usage

1. Open the `index.html` file in a web browser
2. Use the file input or drag-and-drop area to select videos for upload
3. Click the upload button to start the upload process
4. Use the search bar to find specific videos
5. Click on the sort buttons to organize videos by name or upload date
6. Click on a video link to download or stream the video

## Security Considerations

- Ensure that your AWS credentials are kept secure and not exposed in client-side code
- Use IAM roles and policies to restrict access to your AWS resources
- Regularly rotate your AWS access keys
- Monitor your AWS resources for any unauthorized access or unusual activity

## Future Improvements

- Implement user authentication and authorization
- Add video preview functionality
- Integrate with AWS Transcribe for automatic caption generation
- Implement server-side processing for larger files

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## Acknowledgments

- Amazon Web Services for providing the cloud infrastructure
- The AWS SDK for JavaScript team for their excellent documentation
