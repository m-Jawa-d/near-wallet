// services/api.js
'use client'
const API_BASE_URL = 'https://api.pai3.ai';

export const apiService = {
    /**
     * Get nonce from the API
     * @param {string} accountId - Account ID
     * @returns {Promise<Object>} Nonce response with mpcVerificationRequired flag
     */
    async getNonce(accountId) {
        try {
            if (!accountId) {
                throw new Error('accountId is required for this POST request.');
            }

            const response = await fetch(`${API_BASE_URL}/auth-service/v1/near/users/nonce`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accountId: accountId
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'No error message available' }));
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.message || response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error in getNonce:', error);
            throw new Error(`Failed to perform nonce request: ${error.message}`);
        }
    },

    /**
     * Get token after successful signature
     * @param {string} accountId - Account ID
     * @param {string} nonce - Nonce value
     * @param {string} signature - Signature from wallet
     * @param {string} mpcTxHash - MPC transaction hash from v1.signer contract (empty string if no MPC verification required)
     * @param {string} publicKey - Public key (optional)
     * @returns {Promise<Object>} Token response
     */
    async getToken(accountId, nonce, signature, mpcTxHash = '', publicKey = null) {
        try {
            if (!accountId || !nonce || !signature) {
                throw new Error('accountId, nonce, and signature are required for this POST request.');
            }

            // mpcTxHash can be empty string if mpcVerificationRequired is false
            const requestBody = {
                accountId: accountId,
                nonce: nonce,
                mpcTxHash: mpcTxHash, // Can be empty string
                signature: signature
            };

            // Only add publicKey if it's provided and not null/undefined
            if (publicKey) {
                requestBody.publicKey = publicKey;
            }

            const response = await fetch(`${API_BASE_URL}/auth-service/v1/near/users/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'No error message available' }));
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.message || response.statusText}`);
            }

            const data = await response.json();

            // Store access token in localStorage if received
            if (data.accessToken) {
                localStorage.setItem('accessToken', data.accessToken);
            }

            return data;
        } catch (error) {
            console.error('Error in getToken:', error);
            throw new Error(`Failed to get token: ${error.message}`);
        }
    },

    /**
     * Get available currencies for deposits
     * @returns {Promise<Array>} Array of available currencies
     */
    async getCurrencies() {
        try {
            const bearerToken = localStorage.getItem('accessToken');

            if (!bearerToken) {
                throw new Error('Bearer token not found. Please login first.');
            }

            const response = await fetch(`${API_BASE_URL}/node-manager/v1/deposits/currencies`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${bearerToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // Token might be expired, clear it
                    localStorage.removeItem('accessToken');
                    throw new Error('Authentication failed. Please login again.');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching currencies:', error);
            throw new Error(`Failed to fetch currencies: ${error.message}`);
        }
    },

    /**
     * Calculate deposit amount for NFTs
     * @param {number} nftAmount - Number of NFTs to deposit
     * @param {string} currency - Selected currency token (e.g., 'NEAR', 'USDT', 'USDC')
     * @returns {Promise<Object>} Deposit calculation response
     */
    async calculateDeposit(nftAmount, currency = 'NEAR') {
        try {
            const bearerToken = localStorage.getItem('accessToken');

            if (!bearerToken) {
                throw new Error('Bearer token not found. Please login first.');
            }

            const response = await fetch(`${API_BASE_URL}/node-manager/v1/deposits`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${bearerToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    nftAmount: nftAmount,
                    chain: "NEAR",
                    currency: currency
                }),
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // Token might be expired, clear it
                    localStorage.removeItem('accessToken');
                    throw new Error('Authentication failed. Please login again.');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error calculating deposit:', error);
            throw new Error(`Failed to calculate deposit: ${error.message}`);
        }
    },

    /**
     * Submit transaction hash after deposit
     * @param {number} intentId - Intent ID from deposit calculation
     * @param {string} txHash - Transaction hash from NEAR wallet
     * @returns {Promise<Object>} Hash submission response
     */
    async submitTransactionHash(intentId, txHash) {
        try {
            const bearerToken = localStorage.getItem('accessToken');

            if (!bearerToken) {
                throw new Error('Bearer token not found. Please login first.');
            }

            const response = await fetch(`${API_BASE_URL}/node-manager/v1/deposits/hash`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${bearerToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    intentId: intentId,
                    txHash: txHash
                }),
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // Token might be expired, clear it
                    localStorage.removeItem('accessToken');
                    throw new Error('Authentication failed. Please login again.');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error submitting transaction hash:', error);
            throw new Error(`Failed to submit transaction hash: ${error.message}`);
        }
    },

    /**
     * Check if user is currently logged in
     * @returns {boolean} True if user has valid access token
     */
    isLoggedIn() {
        return !!localStorage.getItem('accessToken');
    },

    /**
     * Logout user by clearing access token
     */
    logout() {
        localStorage.removeItem('accessToken');
    }
};