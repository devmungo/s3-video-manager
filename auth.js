// auth.js

// Authentication configuration
const poolData = {
    UserPoolId: '<UserPoolID', // Replace with your Cognito User Pool ID
    ClientId: '<Client-id>'   // Replace with your App Client ID
};

const IDENTITY_POOL_ID = '<IDENTITY_POOL_ID>'; // Your Identity Pool ID
const REGION = 'region'; // Your region

const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
let currentUser = null;

// Utility functions
function showSection(sectionId) {
    ['login-section', 'main-content', 'user-info', 'new-password-section'].forEach(id => {
        document.getElementById(id).style.display = id === sectionId ? 'block' : 'none';
    });
}

function showAuthMessage(message, type = 'error') {
    const existingMessage = document.querySelector('.auth-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `auth-message ${type}`;
    messageDiv.textContent = message;

    const authSection = document.getElementById('auth-section');
    authSection.insertBefore(messageDiv, authSection.firstChild);

    if (type === 'success') {
        setTimeout(() => messageDiv.remove(), 3000);
    }
}

// Configure AWS SDK with Identity Pool
function configureAWS(idToken) {
    return new Promise((resolve, reject) => {
        console.log('Setting up AWS credentials...');
        
        AWS.config.region = REGION;
        
        console.log('Configuring AWS credentials with:', {
            IdentityPoolId: IDENTITY_POOL_ID,
            UserPoolId: poolData.UserPoolId,
            LoginKey: `cognito-idp.${REGION}.amazonaws.com/${poolData.UserPoolId}`,
            Region: REGION
        });

        const credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: IDENTITY_POOL_ID,
            Logins: {
                [`cognito-idp.${REGION}.amazonaws.com/${poolData.UserPoolId}`]: idToken
            }
        });

        AWS.config.credentials = credentials;

        // Refresh credentials
        credentials.refresh((error) => {
            if (error) {
                console.error('Credentials refresh error:', error);
                console.error('Full error details:', JSON.stringify(error, null, 2));
                reject(error);
                return;
            }
            
            console.log('Successfully obtained credentials');
            console.log('Identity Id:', credentials.identityId);
            
            AWS.config.update({
                region: REGION,
                credentials: credentials
            });

            resolve();
        });
    });
}

// Login
async function login(username, password) {
    return new Promise((resolve, reject) => {
        const authenticationData = {
            Username: username,
            Password: password
        };

        const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);

        const userData = {
            Username: username,
            Pool: userPool
        };

        const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
        
        cognitoUser.authenticateUser(authenticationDetails, {
            onSuccess: async (result) => {
                try {
                    currentUser = cognitoUser;
                    const idToken = result.getIdToken().getJwtToken();
                    
                    console.log('Authentication successful, configuring AWS...');
                    
                    await configureAWS(idToken);
                    
                    console.log('AWS configuration complete');
                    
                    resolve(result);
                } catch (error) {
                    console.error('Error during AWS configuration:', error);
                    reject(error);
                }
            },
            onFailure: (err) => {
                console.error('Authentication failed:', err);
                reject(err);
            },
            newPasswordRequired: (userAttributes, requiredAttributes) => {
                showSection('new-password-section');
                window.tempCognitoUser = cognitoUser;
            }
        });
    });
}

// Logout
function logout() {
    const user = userPool.getCurrentUser();
    if (user) {
        user.signOut();
        currentUser = null;
        if (AWS.config.credentials) {
            AWS.config.credentials.clearCachedId();
        }
    }
    showSection('login-section');
}

// Check Authentication State
async function checkAuth() {
    return new Promise((resolve, reject) => {
        const user = userPool.getCurrentUser();
        if (!user) {
            reject(new Error('No user found'));
            return;
        }

        user.getSession(async (err, session) => {
            if (err) {
                reject(err);
                return;
            }
            if (!session.isValid()) {
                reject(new Error('Invalid session'));
                return;
            }

            currentUser = user;
            const idToken = session.getIdToken().getJwtToken();

            try {
                console.log('Session valid, configuring AWS...');
                await configureAWS(idToken);
                console.log('AWS configuration complete for session check');
                resolve(user);
            } catch (error) {
                console.error('Error during session AWS configuration:', error);
                reject(error);
            }
        });
    });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Login Form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            await login(username, password);
            document.getElementById('user-email').textContent = username;
            showSection('main-content');
            document.getElementById('user-info').style.display = 'block';
            // Refresh the video list after successful login
            if (typeof loadVideos === 'function') {
                loadVideos();
            }
        } catch (error) {
            showAuthMessage(error.message);
        }
    });

    // New Password Form
    document.getElementById('new-password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        const confirmNewPassword = document.getElementById('confirm-new-password').value;

        if (newPassword !== confirmNewPassword) {
            showAuthMessage('Passwords do not match', 'error');
            return;
        }

        try {
            const userAttributes = {};
            
            await new Promise((resolve, reject) => {
                window.tempCognitoUser.completeNewPasswordChallenge(
                    newPassword,
                    userAttributes,
                    {
                        onSuccess: (result) => {
                            currentUser = window.tempCognitoUser;
                            resolve(result);
                        },
                        onFailure: (err) => {
                            reject(err);
                        }
                    }
                );
            });

            // Clear the temporary storage
            window.tempCognitoUser = null;
            window.tempUserAttributes = null;

            showAuthMessage('Password set successfully. Please log in with your new password.', 'success');
            showSection('login-section');
        } catch (error) {
            showAuthMessage(error.message, 'error');
        }
    });

    // Logout Button
    document.getElementById('logout-button').addEventListener('click', logout);

    // Check initial auth state
    checkAuth()
        .then(user => {
            const username = user.getUsername();
            document.getElementById('user-email').textContent = username;
            showSection('main-content');
            document.getElementById('user-info').style.display = 'block';
            // Load videos after authentication check
            if (typeof loadVideos === 'function') {
                loadVideos();
            }
        })
        .catch(() => {
            showSection('login-section');
        });
});

// Export functions for use in app.js
window.checkAuth = checkAuth;
window.showAuthMessage = showAuthMessage;