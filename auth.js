// auth.js

// Authentication configuration with maximum token lifetimes
const TOKEN_REFRESH_INTERVAL = 82800000; // 23 hours in milliseconds
const TOKEN_EXPIRATION = 86400; // 24 hours in seconds

const poolData = {
    UserPoolId: '<UserPoolID', // Replace with your Cognito User Pool ID
    ClientId: '<Client-id>',   // Replace with your App Client ID 
    TokenValidation: {
        accessTokenValiditySeconds: TOKEN_EXPIRATION,
        idTokenValiditySeconds: TOKEN_EXPIRATION,
        refreshTokenValidityDays: 3650 // 10 years
    }
};

const IDENTITY_POOL_ID = '<IDENTITY_POOL_ID>'; // Your Identity Pool ID
const REGION = '<your-region>'; // Your region
const MAX_OPERATION_TIME = 3600000; // 1 hour default timeout for operations

const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
let currentUser = null;
let sessionRefreshTimer = null;
let activeOperations = 0;
let pendingRefresh = null;

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

// Operation tracking functions
function startOperation() {
    activeOperations++;
    console.log(`Operation started. Active operations: ${activeOperations}`);
}

async function endOperation() {
    activeOperations--;
    console.log(`Operation ended. Active operations: ${activeOperations}`);

    // If this was the last operation and there's a pending refresh, execute it
    if (activeOperations === 0 && pendingRefresh) {
        const { idToken, resolve, reject } = pendingRefresh;
        pendingRefresh = null;
        try {
            await configureAWS(idToken, true);
            resolve();
        } catch (error) {
            reject(error);
        }
    }
}

// Session refresh logic
async function refreshSession() {
    const user = userPool.getCurrentUser();
    if (!user) return null;

    return new Promise((resolve, reject) => {
        user.getSession((err, session) => {
            if (err) {
                reject(err);
                return;
            }
            if (session.isValid()) {
                resolve(session);
            } else {
                user.refreshSession(session.getRefreshToken(), (err, newSession) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(newSession);
                });
            }
        });
    });
}

// Force token refresh function
async function forceTokenRefresh() {
    try {
        const session = await refreshSession();
        if (session) {
            await configureAWS(session.getIdToken().getJwtToken(), true);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Force token refresh failed:', error);
        return false;
    }
}

// Configure AWS SDK with Identity Pool
async function configureAWS(idToken, forceRefresh = false) {
    return new Promise((resolve, reject) => {
        console.log('Setting up AWS credentials...');
        
        // If there are active operations and this isn't a forced refresh, queue it
        if (activeOperations > 0 && !forceRefresh) {
            console.log('Active operations detected, queueing credential refresh');
            pendingRefresh = { idToken, resolve, reject };
            return;
        }

        AWS.config.region = REGION;
        
        const credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: IDENTITY_POOL_ID,
            Logins: {
                [`cognito-idp.${REGION}.amazonaws.com/${poolData.UserPoolId}`]: idToken
            }
        });

        AWS.config.credentials = credentials;

        credentials.refresh((error) => {
            if (error) {
                console.error('Credentials refresh error:', error);
                reject(error);
                return;
            }
            
            console.log('Successfully obtained credentials');
            
            AWS.config.update({
                region: REGION,
                credentials: credentials
            });

            // Set up periodic refresh - now using 23-hour interval
            if (sessionRefreshTimer) clearInterval(sessionRefreshTimer);
            sessionRefreshTimer = setInterval(async () => {
                try {
                    const session = await refreshSession();
                    if (session) {
                        await configureAWS(session.getIdToken().getJwtToken());
                    }
                } catch (error) {
                    console.error('Session refresh failed:', error);
                    // Don't redirect to login if there's an active upload
                    if (activeOperations === 0) {
                        showSection('login-section');
                    } else {
                        console.warn('Delaying session redirect due to active operations');
                    }
                }
            }, TOKEN_REFRESH_INTERVAL);

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
                    await configureAWS(idToken);
                    resolve(result);
                } catch (error) {
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
    if (sessionRefreshTimer) {
        clearInterval(sessionRefreshTimer);
        sessionRefreshTimer = null;
    }

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
    try {
        const session = await refreshSession();
        if (session) {
            await configureAWS(session.getIdToken().getJwtToken());
            return true;
        }
        return false;
    } catch (error) {
        console.error('Auth check failed:', error);
        return false;
    }
}

// Initialize the application
async function initializeApp() {
    try {
        if (!AWS.config.credentials) {
            throw new Error('No credentials available');
        }
        
        // Wait for credentials to be available
        if (AWS.config.credentials.needsRefresh()) {
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

        // Now initialize the app components
        await loadFolders();
        await loadVideos();
    } catch (error) {
        console.error('Failed to initialize app:', error);
        showAuthMessage('Failed to initialize application. Please refresh the page.');
    }
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
            await initializeApp();
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
        .then(async isAuthenticated => {
            if (isAuthenticated) {
                const user = userPool.getCurrentUser();
                if (user) {
                    document.getElementById('user-email').textContent = user.getUsername();
                    showSection('main-content');
                    document.getElementById('user-info').style.display = 'block';
                    await initializeApp();
                }
            } else {
                showSection('login-section');
            }
        })
        .catch(() => {
            showSection('login-section');
        });
});

// Export functions for use in app.js
window.checkAuth = checkAuth;
window.showAuthMessage = showAuthMessage;
window.startOperation = startOperation;
window.endOperation = endOperation;
window.initializeApp = initializeApp;
window.forceTokenRefresh = forceTokenRefresh;
