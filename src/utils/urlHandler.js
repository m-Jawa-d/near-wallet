// utils/urlHandler.js

export const urlHandler = {
    /**
     * Parse URL hash parameters and extract wallet response data
     * @returns {Object|null} Parsed data from URL hash or null if not present
     */
    parseUrlHash() {
        if (typeof window === 'undefined') return null;

        const hash = window.location.hash;
        if (!hash || hash.length <= 1) return null;

        try {
            // Remove the # and parse the query string
            const hashParams = new URLSearchParams(hash.substring(1));
            const data = {};

            for (const [key, value] of hashParams.entries()) {
                data[key] = decodeURIComponent(value);
            }

            // Check if this looks like a NEAR wallet response
            if (data.accountId || data.signature || data.publicKey || data.transactionHashes) {
                return {
                    accountId: data.accountId,
                    signature: data.signature,
                    publicKey: data.publicKey,
                    transactionHashes: data.transactionHashes,
                    errorCode: data.errorCode,
                    errorMessage: data.errorMessage,
                    // Include any other parameters
                    ...data
                };
            }

            return null;
        } catch (error) {
            console.error('Error parsing URL hash:', error);
            return null;
        }
    },

    /**
     * Parse URL query parameters and extract wallet response data
     * @returns {Object|null} Parsed data from URL query params or null if not present
     */
    parseUrlQuery() {
        if (typeof window === 'undefined') return null;

        const search = window.location.search;
        if (!search || search.length <= 1) return null;

        try {
            // Remove the ? and parse the query string
            const queryParams = new URLSearchParams(search);
            const data = {};

            for (const [key, value] of queryParams.entries()) {
                data[key] = decodeURIComponent(value);
            }

            // Check if this looks like a NEAR wallet response
            if (data.accountId || data.signature || data.publicKey || data.transactionHashes) {
                return {
                    accountId: data.accountId,
                    signature: data.signature,
                    publicKey: data.publicKey,
                    transactionHashes: data.transactionHashes,
                    errorCode: data.errorCode,
                    errorMessage: data.errorMessage,
                    // Include any other parameters
                    ...data
                };
            }

            return null;
        } catch (error) {
            console.error('Error parsing URL query:', error);
            return null;
        }
    },

    /**
     * Parse both URL hash and query parameters to get wallet response data
     * @returns {Object|null} Parsed data from URL or null if not present
     */
    parseWalletResponse() {
        // Try hash first, then query parameters
        return this.parseUrlHash() || this.parseUrlQuery();
    },

    /**
     * Clean the URL hash to remove wallet response data
     */
    cleanUrlHash() {
        if (typeof window === 'undefined') return;

        // Replace the current URL without the hash, without triggering a page reload
        const cleanUrl = window.location.pathname + window.location.search;
        window.history.replaceState(null, '', cleanUrl);
    },

    /**
     * Clean the URL query parameters to remove wallet response data
     */
    cleanUrlQuery() {
        if (typeof window === 'undefined') return;

        const url = new URL(window.location.href);
        const queryParams = new URLSearchParams(url.search);

        // Remove wallet-related parameters
        const walletParams = ['transactionHashes', 'accountId', 'signature', 'publicKey', 'errorCode', 'errorMessage'];
        let hasWalletParams = false;

        walletParams.forEach(param => {
            if (queryParams.has(param)) {
                queryParams.delete(param);
                hasWalletParams = true;
            }
        });

        if (hasWalletParams) {
            // Build clean URL
            const cleanUrl = window.location.pathname + (queryParams.toString() ? '?' + queryParams.toString() : '');
            window.history.replaceState(null, '', cleanUrl);
        }
    },

    /**
     * Clean both URL hash and query parameters
     */
    cleanUrl() {
        this.cleanUrlHash();
        this.cleanUrlQuery();
    },

    /**
     * Check if URL contains transaction response
     * @returns {boolean}
     */
    hasTransactionResponse() {
        const data = this.parseWalletResponse();
        return !!(data && (data.transactionHashes || data.signature));
    },

    /**
     * Check if URL contains signing response
     * @returns {boolean}
     */
    hasSigningResponse() {
        const data = this.parseWalletResponse();
        return !!(data && data.signature && !data.transactionHashes);
    }
};