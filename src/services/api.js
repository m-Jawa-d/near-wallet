// services/api.js

const API_BASE_URL = 'https://api.pai3.ai/node-manager/v1';

export const apiService = {
    /**
     * Get deposit currencies from the API
     * @returns {Promise<Array>} Array of currency objects
     */
    async getDepositCurrencies() {
        try {
            const bearerToken = process.env.NEXT_PUBLIC_BEARER_TOKEN;

            if (!bearerToken) {
                throw new Error('Bearer token not found in environment variables');
            }

            const response = await fetch(`${API_BASE_URL}/deposits/currencies`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${bearerToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching deposit currencies:', error);
            throw new Error(`Failed to fetch currencies: ${error.message}`);
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

            const response = await fetch(`${API_BASE_URL}/deposits`, {
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

            const response = await fetch(`${API_BASE_URL}/deposits/hash`, {
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