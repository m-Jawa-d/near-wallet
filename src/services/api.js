// services/api.js

const API_BASE_URL = 'https://api.pai3.ai';

export const apiService = {
    /**
     * Get deposit currencies from the API
     * @returns {Promise<Array>} Array of currency objects
     */
    async getNonce(accountId) {
        try {
            // Assuming API_BASE_URL is defined elsewhere, e.g., in a config file or as a global variable.
            // For demonstration, let's define it here if it's not present in the user's context.
            // const API_BASE_URL = "https://your-api-base-url.com/"; 

            if (!accountId) {
                throw new Error('accountId is required for this POST request.');
            }

            const response = await fetch(`${API_BASE_URL}/auth-service/v1/near/users/nonce`, {
                method: 'POST', // Changed from GET to POST
                headers: {
                    'Content-Type': 'application/json', // Specify content type for JSON body
                },
                body: JSON.stringify({ // Add the request body with accountId
                    accountId: accountId
                }),
            });

            if (!response.ok) {
                // If the response status is not in the 2xx range, throw an error
                const errorData = await response.json().catch(() => ({ message: 'No error message available' }));
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.message || response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error in postNonce:', error);
            // Re-throw the error to be handled by the caller
            throw new Error(`Failed to perform nonce POST request: ${error.message}`);
        }
    },

    /**
     * Get token after successful signature
     * @param {string} accountId - Account ID
     * @param {string} nonce - Nonce value
     * @param {string} signature - Signature from wallet
     * @returns {Promise<Object>} Token response
     */
    async getToken(accountId, nonce, signature) {
        try {
            if (!accountId || !nonce || !signature) {
                throw new Error('accountId, nonce, and signature are required for this POST request.');
            }

            // Generate a dummy MPC transaction hash (you can replace this with actual logic if needed)
            const mpcTxHash = 'BjnRrCTWt91ycY8mbjxsqSRyp1jha49rgKVs7eRZTC8q';

            const response = await fetch(`${API_BASE_URL}/auth-service/v1/near/users/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accountId: accountId,
                    nonce: nonce,
                    mpcTxHash: mpcTxHash,
                    signature: signature
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'No error message available' }));
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.message || response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error in getToken:', error);
            throw new Error(`Failed to get token: ${error.message}`);
        }
    },

    /**
     * Calculate deposit amount for NFTs
     * @param {number} nftAmount - Number of NFTs to deposit
     * @returns {Promise<Object>} Deposit calculation response
     */
    async calculateDeposit(nftAmount) {
        try {
            const bearerToken = process.env.NEXT_PUBLIC_BEARER_TOKEN;

            if (!bearerToken) {
                throw new Error('Bearer token not found in environment variables');
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
                    currency: "WNEAR"
                }),
            });

            if (!response.ok) {
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
            const bearerToken = process.env.NEXT_PUBLIC_BEARER_TOKEN;

            if (!bearerToken) {
                throw new Error('Bearer token not found in environment variables');
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
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error submitting transaction hash:', error);
            throw new Error(`Failed to submit transaction hash: ${error.message}`);
        }
    }
};