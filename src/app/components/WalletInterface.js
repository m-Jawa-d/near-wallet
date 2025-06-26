'use client';

import { useState, useEffect, useRef } from 'react';
import { useNearWallet } from './NearWalletProvider';
import { apiService } from '@/services/api';
import { styles } from '@/constant';
import { urlHandler } from '@/utils/urlHandler';
import SignatureVerificationComponent from './SignatureVerificationComponent';

// Add NETWORK_ID constant
const NETWORK_ID = process.env.NEXT_PUBLIC_NETWORK_ID || 'testnet';
// Add MPC Contract ID
const MPC_CONTRACT_ID = 'v1.signer';

export default function WalletInterface() {
    const {
        accountId,
        loading,
        connectWallet,
        disconnectWallet,
        sendTransaction,
        signMessage,
        getBalance,
        getTokenBalance,
        isConnected,
        selector,
        sendContractTransaction,
    } = useNearWallet();

    const [balance, setBalance] = useState(null);
    const [tokenBalance, setTokenBalance] = useState(null);
    const [nftAmount, setNftAmount] = useState(1);
    const [depositData, setDepositData] = useState(null);
    const [isCalculated, setIsCalculated] = useState(false);
    const [calculateLoading, setCalculateLoading] = useState(false);
    const [txLoading, setTxLoading] = useState(false);
    const [signLoading, setSignLoading] = useState(false);
    const [txResult, setTxResult] = useState(null);
    const [signResult, setSignResult] = useState(null);
    const [hashSubmissionResult, setHashSubmissionResult] = useState(null);
    const [tokenResult, setTokenResult] = useState(null);
    const [currentWallet, setCurrentWallet] = useState(null);
    const [mpcTxHash, setMpcTxHash] = useState(null);
    const [accessToken, setAccessToken] = useState(localStorage.getItem('accessToken'));
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // New states for currency selection
    const [availableCurrencies, setAvailableCurrencies] = useState([]);
    const [selectedCurrency, setSelectedCurrency] = useState('NEAR');
    const [currenciesLoading, setCurrenciesLoading] = useState(false);

    // Keep track of pending operations
    const pendingOperationRef = useRef(null);

    // Check if user is logged in on component mount
    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        setIsLoggedIn(!!token);
    }, []);

    useEffect(() => {
        if (accountId) {
            getBalance(accountId).then(setBalance);
        }
    }, [accountId, getBalance]);

    // Fetch token balance when currency changes
    useEffect(() => {
        const fetchTokenBalance = async () => {
            if (accountId && selectedCurrency && availableCurrencies.length > 0) {
                const currencyInfo = availableCurrencies.find(c => c.token === selectedCurrency);
                if (currencyInfo && currencyInfo.token !== 'NEAR') {
                    try {
                        const balance = await getTokenBalance(accountId, currencyInfo.contract, currencyInfo.decimals);
                        setTokenBalance(balance);
                    } catch (error) {
                        console.error('Error fetching token balance:', error);
                        setTokenBalance(null);
                    }
                } else {
                    // For NEAR, use the regular balance
                    setTokenBalance(null);
                }
            }
        };

        fetchTokenBalance();
    }, [accountId, selectedCurrency, availableCurrencies, getTokenBalance]);

    // Get current wallet info
    useEffect(() => {
        const getCurrentWallet = async () => {
            if (selector && accountId) {
                try {
                    const wallet = await selector.wallet();
                    setCurrentWallet(wallet.id);
                    console.log('Current wallet:', wallet.id);
                } catch (error) {
                    console.error('Error getting wallet info:', error);
                }
            }
        };
        getCurrentWallet();
    }, [selector, accountId]);

    // Fetch available currencies when user logs in
    useEffect(() => {
        const fetchCurrencies = async () => {
            if (isLoggedIn && localStorage.getItem('accessToken')) {
                setCurrenciesLoading(true);
                try {
                    const currencies = await apiService.getCurrencies();
                    setAvailableCurrencies(currencies);
                    console.log('Available currencies:', currencies);

                    // Set default currency to NEAR if available
                    const nearCurrency = currencies.find(c => c.token === 'NEAR');
                    if (nearCurrency) {
                        setSelectedCurrency('NEAR');
                    } else if (currencies.length > 0) {
                        setSelectedCurrency(currencies[0].token);
                    }
                } catch (error) {
                    console.error('Error fetching currencies:', error);
                    alert(`Failed to fetch available currencies: ${error.message}`);
                } finally {
                    setCurrenciesLoading(false);
                }
            }
        };

        fetchCurrencies();
    }, [isLoggedIn]);

    // Restore deposit data from sessionStorage on component mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedDepositData = sessionStorage.getItem('pendingDepositData');
            if (storedDepositData) {
                try {
                    const parsedData = JSON.parse(storedDepositData);
                    setDepositData(parsedData);
                    setIsCalculated(true);
                    if (parsedData.nftAmount) {
                        setNftAmount(parsedData.nftAmount);
                    }
                    if (parsedData.selectedCurrency) {
                        setSelectedCurrency(parsedData.selectedCurrency);
                    }
                } catch (error) {
                    console.error('Error parsing stored deposit data:', error);
                    sessionStorage.removeItem('pendingDepositData');
                }
            }
        }
    }, []);

    // Handle URL hash data from wallet redirects
    useEffect(() => {
        const handleWalletResponse = async () => {
            const urlData = urlHandler.parseWalletResponse();

            if (!urlData) return;

            try {
                // Check if this is an MPC transaction response
                const pendingMpcData = sessionStorage.getItem('pendingMpcData');
                if (pendingMpcData && urlData.transactionHashes) {
                    const mpcData = JSON.parse(pendingMpcData);
                    await handleMpcTransactionResponse(urlData.transactionHashes, mpcData);
                    sessionStorage.removeItem('pendingMpcData');
                    return;
                }

                // Handle regular transaction response from URL
                if (urlData.transactionHashes && !pendingMpcData) {
                    await handleTransactionResponse(urlData.transactionHashes);
                }

                // Handle signing response from URL
                if (urlData.signature && !urlData.transactionHashes) {
                    await handleSigningResponse(urlData);
                }

                // Handle errors
                if (urlData.errorCode || urlData.errorMessage) {
                    alert(`Wallet operation failed: ${urlData.errorMessage || 'Unknown error'}`);
                    setTxLoading(false);
                    setSignLoading(false);
                }

            } catch (error) {
                console.error('Error handling wallet response:', error);
                setTxLoading(false);
                setSignLoading(false);
            } finally {
                // Clean up the URL
                urlHandler.cleanUrl();
            }
        };

        if (accountId) {
            handleWalletResponse();
        }
    }, [accountId, getBalance, depositData]);

    // Helper function to handle MPC transaction responses
    const handleMpcTransactionResponse = async (txHash, mpcData) => {
        setMpcTxHash(txHash);

        // Continue with the token request
        try {
            const tokenResponse = await apiService.getToken(
                accountId,
                mpcData.nonce,
                mpcData.signature,
                txHash, // Use the actual transaction hash
                mpcData.publicKey || null
            );
            setTokenResult(tokenResponse);
            setIsLoggedIn(true);
            setAccessToken(tokenResponse.accessToken);
            console.log('Token received:', tokenResponse);

            setSignResult({
                message: mpcData.nonce,
                signature: {
                    signature: mpcData.signature,
                    publicKey: mpcData.publicKey || 'N/A',
                    accountId: accountId
                },
                currencies: mpcData.currencies,
                mpcTxHash: txHash
            });
        } catch (tokenError) {
            console.error('Token request failed:', tokenError);
            alert(`MPC transaction successful but token request failed: ${tokenError.message}`);
        }

        setSignLoading(false);
    };

    // Helper function to handle transaction responses
    const handleTransactionResponse = async (txHash) => {
        setTxResult({
            transaction: { hash: txHash }
        });

        // Get deposit data from state or sessionStorage
        let currentDepositData = depositData;
        if (!currentDepositData && typeof window !== 'undefined') {
            const storedData = sessionStorage.getItem('pendingDepositData');
            if (storedData) {
                try {
                    currentDepositData = JSON.parse(storedData);
                    setDepositData(currentDepositData);
                    setIsCalculated(true);
                } catch (error) {
                    console.error('Error parsing stored deposit data:', error);
                }
            }
        }

        // Submit hash to API if we have deposit data
        if (currentDepositData && currentDepositData.intentId) {
            try {
                const hashResult = await apiService.submitTransactionHash(
                    currentDepositData.intentId,
                    txHash
                );
                setHashSubmissionResult(hashResult);

                // Clear stored deposit data after successful hash submission
                if (typeof window !== 'undefined') {
                    sessionStorage.removeItem('pendingDepositData');
                }
            } catch (hashError) {
                console.error('Hash submission failed:', hashError);
                alert(`Transaction completed but hash submission failed: ${hashError.message}`);
            }
        }

        // Refresh balances
        if (accountId) {
            const newBalance = await getBalance(accountId);
            setBalance(newBalance);

            // Refresh token balance if it's not NEAR
            if (selectedCurrency !== 'NEAR') {
                const currencyInfo = availableCurrencies.find(c => c.token === selectedCurrency);
                if (currencyInfo) {
                    try {
                        const newTokenBalance = await getTokenBalance(accountId, currencyInfo.contract, currencyInfo.decimals);
                        setTokenBalance(newTokenBalance);
                    } catch (error) {
                        console.error('Error refreshing token balance:', error);
                    }
                }
            }
        }

        setTxLoading(false);
    };

    // Helper function to handle signing responses
    const handleSigningResponse = async (urlData) => {
        try {
            const currencies = await apiService.getNonce(accountId);
            const messageToSign = currencies ? currencies.nonce : 'No currencies available';

            setSignResult({
                message: messageToSign,
                signature: {
                    signature: urlData.signature,
                    publicKey: urlData.publicKey,
                    accountId: urlData.accountId
                },
                currencies: currencies
            });

            // Call token API after successful signature
            try {
                const tokenResponse = await apiService.getToken(
                    accountId,
                    currencies.nonce,
                    urlData.signature,
                    '' // Empty string for mpcTxHash when no MPC verification required
                );
                if (tokenResponse) {
                    setAccessToken(tokenResponse.accessToken);
                    setIsLoggedIn(true);
                    localStorage.setItem('accessToken', tokenResponse.accessToken);
                    setTokenResult(tokenResponse);
                    console.log('Token received:', tokenResponse.accessToken);
                }
            } catch (tokenError) {
                console.error('Token request failed:', tokenError);
                alert(`Signature successful but token request failed: ${tokenError.message}`);
            }

        } catch (error) {
            console.error('Error processing signing response:', error);
        }

        setSignLoading(false);
    };

    const handleNftAmountChange = (newAmount) => {
        setNftAmount(newAmount);
        setIsCalculated(false);
        setDepositData(null);
        setTxResult(null);
        setHashSubmissionResult(null);

        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('pendingDepositData');
        }
    };

    const handleCurrencyChange = (newCurrency) => {
        setSelectedCurrency(newCurrency);
        setIsCalculated(false);
        setDepositData(null);
        setTxResult(null);
        setHashSubmissionResult(null);

        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('pendingDepositData');
        }
    };

    const handleCalculateDeposit = async () => {
        if (nftAmount < 1) {
            alert('Please select at least 1 NFT');
            return;
        }

        setCalculateLoading(true);
        setDepositData(null);
        setIsCalculated(false);
        setTxResult(null);
        setHashSubmissionResult(null);

        try {
            const result = await apiService.calculateDeposit(nftAmount, selectedCurrency);
            setDepositData(result);
            setIsCalculated(true);

            if (typeof window !== 'undefined') {
                sessionStorage.setItem('pendingDepositData', JSON.stringify({
                    ...result,
                    nftAmount: nftAmount,
                    selectedCurrency: selectedCurrency
                }));
            }
        } catch (error) {
            alert(`Calculation failed: ${error.message}`);
        } finally {
            setCalculateLoading(false);
        }
    };

    // Auto-calculate deposit when user is logged in and has currencies
    useEffect(() => {
        if (isLoggedIn && localStorage.getItem('accessToken') && availableCurrencies.length > 0) {
            handleCalculateDeposit();
        }
    }, [isLoggedIn, availableCurrencies, selectedCurrency]);

    const handleSendTransaction = async () => {
        if (!depositData) {
            alert('Please calculate deposit amount first');
            return;
        }

        const selectedCurrencyInfo = getSelectedCurrencyInfo();
        if (!selectedCurrencyInfo) {
            alert('Currency information not found');
            return;
        }

        // Check balance
        if (balance !== null) {
            const balanceFloat = parseFloat(balance);
            const gasBuffer = 0.1; // NEAR needed for gas fees

            if (selectedCurrency === 'NEAR') {
                // For native NEAR, check total amount needed
                const depositAmountFloat = parseFloat(depositData.depositAmount);
                const requiredAmount = depositAmountFloat + gasBuffer;

                if (balanceFloat < requiredAmount) {
                    alert(
                        `Insufficient balance!\n\n` +
                        `Required: ${depositAmountFloat} ${selectedCurrency} + ${gasBuffer} NEAR (gas fees) = ${requiredAmount} NEAR\n` +
                        `Available: ${balanceFloat} NEAR\n` +
                        `Shortage: ${(requiredAmount - balanceFloat).toFixed(4)} NEAR\n\n` +
                        `Please add more NEAR to your wallet before proceeding.`
                    );
                    return;
                }
            } else {
                // For fungible tokens, check both token balance and NEAR for gas
                const depositAmountFloat = parseFloat(depositData.depositAmount);

                // Check NEAR balance for gas fees
                if (balanceFloat < gasBuffer) {
                    alert(
                        `Insufficient NEAR for gas fees!\n\n` +
                        `Required: ${gasBuffer} NEAR (gas fees)\n` +
                        `Available: ${balanceFloat} NEAR\n` +
                        `Shortage: ${(gasBuffer - balanceFloat).toFixed(4)} NEAR\n\n` +
                        `Please add more NEAR to your wallet for gas fees.`
                    );
                    return;
                }

                // Check token balance if available
                if (tokenBalance !== null) {
                    const tokenBalanceFloat = parseFloat(tokenBalance);
                    if (tokenBalanceFloat < depositAmountFloat) {
                        alert(
                            `Insufficient ${selectedCurrency} balance!\n\n` +
                            `Required: ${depositAmountFloat} ${selectedCurrency}\n` +
                            `Available: ${tokenBalanceFloat} ${selectedCurrency}\n` +
                            `Shortage: ${(depositAmountFloat - tokenBalanceFloat).toFixed(6)} ${selectedCurrency}\n\n` +
                            `Please add more ${selectedCurrency} to your wallet before proceeding.`
                        );
                        return;
                    }
                }
            }
        }

        setTxLoading(true);
        setTxResult(null);
        setHashSubmissionResult(null);
        pendingOperationRef.current = 'transaction';

        try {
            const result = await sendTransaction(
                depositData.depositAddress,
                depositData.depositAmount.toString(),
                selectedCurrencyInfo
            );

            // Check if we got a direct response (e.g., from Meteor wallet)
            if (result && result.transaction && result.transaction.hash) {
                console.log('Direct transaction response received:', result);
                await handleTransactionResponse(result.transaction.hash);
            } else {
                console.log('Transaction initiated, waiting for redirect response...');
                // For wallets that redirect, the response will be handled by the URL effect
            }
        } catch (error) {
            console.error('Transaction error:', error);
            alert(`Transaction failed: ${error.message}`);
            setTxLoading(false);
            pendingOperationRef.current = null;
        }
    };

    const handleSignMessage = async () => {
        setSignLoading(true);
        setSignResult(null);
        setTokenResult(null);
        setMpcTxHash(null);
        pendingOperationRef.current = 'signing';

        try {
            // Step 1: Get nonce and check mpcVerificationRequired
            const currencies = await apiService.getNonce(accountId);
            console.log('Currencies received:', currencies);

            if (!currencies || !currencies.nonce) {
                throw new Error('No nonce received from API');
            }

            const messageToSign = currencies.nonce;
            const bufferNonce = currencies.rawNonce;
            // Check if MPC verification is required
            if (!currencies.mpcVerificationRequired) {
                console.log('MPC verification not required, proceeding with simple signature');

                // Simple signature flow without MPC transaction
                try {
                    const sign = await signMessage(messageToSign, bufferNonce);
                    console.log('Signature received:', sign);

                    // Call token API with empty mpcTxHash
                    const tokenResponse = await apiService.getToken(
                        accountId,
                        messageToSign,
                        sign.signature,
                        '', // Empty string for mpcTxHash
                        sign?.publicKey
                    );

                    if (tokenResponse) {
                        setAccessToken(tokenResponse.accessToken);
                        setIsLoggedIn(true);
                        localStorage.setItem('accessToken', tokenResponse.accessToken);
                        setTokenResult(tokenResponse);
                        console.log('Token received:', tokenResponse);

                        setSignResult({
                            message: messageToSign,
                            signature: {
                                signature: sign.signature,
                                publicKey: sign?.publicKey || 'N/A',
                                accountId: accountId
                            },
                            currencies: currencies,
                            mpcTxHash: null
                        });
                    }
                } catch (signError) {
                    console.error('Simple signature error:', signError);
                    alert(`Signature failed: ${signError.message}`);
                }

                setSignLoading(false);
                return;
            }

            // MPC verification required - proceed with MPC transaction
            console.log('MPC verification required, proceeding with MPC transaction');

            if (!currencies.rawNonce) {
                throw new Error('No rawNonce received from API for MPC verification');
            }


            const sign = await signMessage(messageToSign, bufferNonce);

            // Step 2: Send MPC transaction to v1.signer contract
            const mpcPayload = {
                request: {
                    path: "ethereum-1",
                    payload: currencies.rawNonce, // Use the bufferNonce array directly
                    key_version: 0
                }
            };

            console.log('Sending MPC transaction with payload:', mpcPayload);

            // Store data for processing after redirect
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('pendingMpcData', JSON.stringify({
                    nonce: messageToSign,
                    signature: sign.signature,
                    currencies: currencies,
                    publicKey: sign?.publicKey
                }));
            }

            const result = await sendContractTransaction(
                MPC_CONTRACT_ID,
                'sign',
                mpcPayload,
                '300000000000000', // 300 TGas
                '1000000000000000000' // No deposit required            
            );

            // Check if we got a direct response
            if (result && result.transaction && result.transaction.hash) {
                console.log('Direct MPC transaction response received:', result);

                await handleMpcTransactionResponse(result.transaction.hash, {
                    nonce: messageToSign,
                    signature: sign.signature,
                    currencies: currencies,
                    publicKey: sign?.publicKey
                });
            } else {
                console.log('MPC transaction initiated, waiting for redirect response...');
                // For wallets that redirect, the response will be handled by the URL effect
            }

        } catch (error) {
            console.error('Authentication error:', error);
            alert(`Authentication failed: ${error.message}`);
            setSignLoading(false);
            pendingOperationRef.current = null;

            // Clear any pending data
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem('pendingMpcData');
            }
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('accessToken');
        setAccessToken(null);
        setIsLoggedIn(false);
        setTokenResult(null);
        setSignResult(null);
        setDepositData(null);
        setIsCalculated(false);
        setTxResult(null);
        setHashSubmissionResult(null);
        setAvailableCurrencies([]);
        setSelectedCurrency('NEAR');
        setTokenBalance(null);

        // Clear any stored deposit data
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('pendingDepositData');
        }
    };

    const getSelectedCurrencyInfo = () => {
        return availableCurrencies.find(c => c.token === selectedCurrency);
    };

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                    <div style={styles.loadingSpinner}></div>
                    <p style={{ color: '#a0a0a0', fontSize: '18px' }}>Initializing wallet connection...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <style jsx>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(255, 255, 255, 0.15);
                }
                
                button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none !important;
                }
                
                input:focus, select:focus {
                    outline: none;
                    border-color: #ffffff;
                    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
                }

                select {
                    appearance: none;
                    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e");
                    background-repeat: no-repeat;
                    background-position: right 12px center;
                    background-size: 16px;
                    padding-right: 40px;
                }
            `}</style>

            <h1 style={styles.title}>NEAR Wallet Interface</h1>

            {!isConnected ? (
                <div style={styles.connectContainer}>
                    <button
                        onClick={connectWallet}
                        style={styles.connectButton}
                    >
                        Connect NEAR Wallet
                    </button>
                </div>
            ) : (
                <>
                    {/* Wallet Info */}
                    <div style={styles.card}>
                        <h3 style={styles.cardTitle}>Wallet Status</h3>
                        <div style={styles.infoRow}>
                            <span style={styles.label}>Account ID</span>
                            <span style={styles.value}>{accountId}</span>
                        </div>
                        <div style={styles.infoRow}>
                            <span style={styles.label}>Wallet Type</span>
                            <span style={styles.value}>{currentWallet || 'Loading...'}</span>
                        </div>
                        <div style={styles.infoRow}>
                            <span style={styles.label}>NEAR Balance</span>
                            <span style={styles.value}>
                                {balance ? `${balance} NEAR` : 'Loading...'}
                            </span>
                        </div>
                        {selectedCurrency !== 'NEAR' && tokenBalance !== null && (
                            <div style={styles.infoRow}>
                                <span style={styles.label}>{selectedCurrency} Balance</span>
                                <span style={styles.value}>
                                    {tokenBalance} {selectedCurrency}
                                </span>
                            </div>
                        )}
                        <div style={styles.infoRow}>
                            <span style={styles.label}>Login Status</span>
                            <span style={styles.value}>
                                {isLoggedIn ? 'Logged In' : 'Not Logged In'}
                            </span>
                        </div>
                        <div style={styles.buttonGroup}>
                            <button
                                onClick={disconnectWallet}
                                style={styles.disconnectButton}
                            >
                                Disconnect Wallet
                            </button>
                            {isLoggedIn && (
                                <button
                                    onClick={handleLogout}
                                    style={{ ...styles.disconnectButton, marginLeft: '10px' }}
                                >
                                    Logout
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Show Sign Message UI when user is NOT logged in */}
                    {!isLoggedIn && (
                        <div style={styles.card}>
                            <h3 style={styles.cardTitle}>Authentication Required</h3>
                            <p style={styles.description}>
                                Please authenticate to access the deposit functionality. This will fetch nonce from the API and handle the authentication process.
                                {currentWallet && (
                                    <span style={{ display: 'block', marginTop: '8px', fontSize: '14px', color: '#888' }}>
                                        Using {currentWallet} wallet
                                    </span>
                                )}
                            </p>
                            <button
                                onClick={handleSignMessage}
                                disabled={signLoading}
                                style={{
                                    ...styles.buttonPrimary,
                                    opacity: signLoading ? 0.5 : 1
                                }}
                            >
                                {signLoading && <div style={styles.loadingSpinner}></div>}
                                {signLoading ? 'Processing Authentication...' : 'Sign In'}
                            </button>

                            {signResult && (
                                <div style={styles.successAlert}>
                                    <p style={styles.alertTitle}>Authentication Successful!</p>

                                    {mpcTxHash && (
                                        <div style={{ marginTop: '16px' }}>
                                            <p style={{ ...styles.label, marginBottom: '8px' }}>MPC Transaction Hash:</p>
                                            <div style={styles.codeBlock}>
                                                {mpcTxHash}
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ marginTop: '16px' }}>
                                        <p style={{ ...styles.label, marginBottom: '8px' }}>Signed Nonce:</p>
                                        <div style={styles.codeBlock}>
                                            {signResult.message}
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '16px' }}>
                                        <p style={{ ...styles.label, marginBottom: '8px' }}>Available Currencies:</p>
                                        <pre style={styles.codeBlock}>
                                            {JSON.stringify(signResult.currencies, null, 2)}
                                        </pre>
                                    </div>

                                    {tokenResult && (
                                        <div style={{ marginTop: '16px', padding: '16px', background: '#0d4d0d', borderRadius: '8px' }}>
                                            <p style={styles.alertTitle}>Token Retrieved Successfully!</p>
                                            <pre style={styles.codeBlock}>
                                                {JSON.stringify(tokenResult, null, 2)}
                                            </pre>
                                        </div>
                                    )}

                                    {/* Add the signature verification component here */}
                                    <div style={{ marginTop: '20px' }}>
                                        <SignatureVerificationComponent
                                            signResult={signResult}
                                            accountId={accountId}
                                            networkId={NETWORK_ID}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Show NFT Deposit Transaction UI when user IS logged in */}
                    {isLoggedIn && (
                        <div style={styles.card}>
                            <h3 style={styles.cardTitle}>NFT Deposit Transaction</h3>

                            {/* Currency Selection Dropdown */}
                            <div style={styles.inputGroup}>
                                <label style={styles.inputLabel}>
                                    Select Currency
                                </label>
                                {currenciesLoading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ ...styles.loadingSpinner, width: '20px', height: '20px', borderWidth: '2px' }}></div>
                                        <span style={{ color: '#888', fontSize: '14px' }}>Loading currencies...</span>
                                    </div>
                                ) : (
                                    <select
                                        value={selectedCurrency}
                                        onChange={(e) => handleCurrencyChange(e.target.value)}
                                        style={styles.input}
                                        disabled={!availableCurrencies.length}
                                    >
                                        {availableCurrencies.map((currency) => (
                                            <option key={currency.token} value={currency.token}>
                                                {currency.name} ({currency.token})
                                            </option>
                                        ))}
                                    </select>
                                )}

                                {/* Show selected currency info */}
                                {getSelectedCurrencyInfo() && (
                                    <div style={{
                                        marginTop: '8px',
                                        padding: '12px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        borderRadius: '6px',
                                        fontSize: '14px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ color: '#888' }}>Contract:</span>
                                            <span style={{ color: '#fff', fontFamily: 'monospace' }}>
                                                {getSelectedCurrencyInfo().contract}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#888' }}>Decimals:</span>
                                            <span style={{ color: '#fff' }}>
                                                {getSelectedCurrencyInfo().decimals}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* NFT Amount Counter */}
                            <div style={styles.amountSelector}>
                                <label style={styles.selectorLabel}>
                                    Select NFT Amount
                                </label>
                                <div style={styles.selectorContainer}>
                                    <button
                                        onClick={() => handleNftAmountChange(Math.max(1, nftAmount - 1))}
                                        style={styles.selectorButton}
                                    >
                                        −
                                    </button>
                                    <span style={styles.amountDisplay}>
                                        {nftAmount}
                                    </span>
                                    <button
                                        onClick={() => handleNftAmountChange(nftAmount + 1)}
                                        style={styles.selectorButton}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            {/* Deposit Details */}
                            {depositData && isCalculated && (
                                <div style={styles.depositDetails}>
                                    <h4 style={styles.depositTitle}>Deposit Details</h4>
                                    <div style={styles.depositItem}>
                                        <span style={styles.label}>Intent ID</span>
                                        <span style={styles.value}>{depositData.intentId}</span>
                                    </div>
                                    <div style={styles.depositItem}>
                                        <span style={styles.label}>Selected Currency</span>
                                        <span style={styles.value}>{selectedCurrency}</span>
                                    </div>
                                    <div style={styles.depositItem}>
                                        <span style={styles.label}>Exchange Rate</span>
                                        <span style={styles.value}>{depositData.exchangeRate}</span>
                                    </div>
                                    <div style={styles.depositItem}>
                                        <span style={styles.label}>Deposit Deadline</span>
                                        <span style={styles.value}>{depositData.depositDeadline}</span>
                                    </div>
                                    <div style={styles.depositItem}>
                                        <span style={styles.label}>Asset ID</span>
                                        <span style={styles.value}>{depositData.assetId}</span>
                                    </div>
                                </div>
                            )}

                            {/* Transaction Fields */}
                            <div style={styles.inputGroup}>
                                <label style={styles.inputLabel}>
                                    Recipient Account ID
                                </label>
                                <input
                                    type="text"
                                    value={isCalculated && depositData ? depositData.depositAddress : ''}
                                    disabled={true}
                                    placeholder="Address will appear after calculation"
                                    style={{
                                        ...styles.input,
                                        opacity: (isCalculated && depositData) ? 1 : 0.5
                                    }}
                                />
                            </div>
                            <div style={styles.inputGroup}>
                                <label style={styles.inputLabel}>
                                    Amount ({selectedCurrency})
                                </label>
                                <input
                                    type="text"
                                    value={isCalculated && depositData ? depositData.depositAmount : ''}
                                    disabled={true}
                                    placeholder="Amount will appear after calculation"
                                    style={{
                                        ...styles.input,
                                        opacity: (isCalculated && depositData) ? 1 : 0.5
                                    }}
                                />
                            </div>

                            {/* Action Buttons */}
                            {!isCalculated ? (
                                <button
                                    onClick={handleCalculateDeposit}
                                    disabled={calculateLoading || !availableCurrencies.length}
                                    style={{
                                        ...styles.buttonPrimary,
                                        opacity: (calculateLoading || !availableCurrencies.length) ? 0.5 : 1
                                    }}
                                >
                                    {calculateLoading && <div style={styles.loadingSpinner}></div>}
                                    {calculateLoading ? 'Calculating...' : 'Calculate Deposit'}
                                </button>
                            ) : (
                                <div style={styles.buttonGroup}>
                                    <button
                                        onClick={handleCalculateDeposit}
                                        disabled={calculateLoading}
                                        style={{
                                            ...styles.buttonSecondary,
                                            opacity: calculateLoading ? 0.5 : 1
                                        }}
                                    >
                                        {calculateLoading && <div style={styles.loadingSpinner}></div>}
                                        {calculateLoading ? 'Calculating...' : 'Recalculate'}
                                    </button>
                                    <button
                                        onClick={handleSendTransaction}
                                        disabled={txLoading}
                                        style={{
                                            ...styles.buttonSuccess,
                                            opacity: txLoading ? 0.5 : 1
                                        }}
                                    >
                                        {txLoading && <div style={styles.loadingSpinner}></div>}
                                        {txLoading ? 'Processing...' : 'Transfer Amount'}
                                    </button>
                                </div>
                            )}

                            {/* Transaction Result */}
                            {txResult && (
                                <div style={styles.successAlert}>
                                    <p style={styles.alertTitle}>Transaction Successful!</p>
                                    <p>Transaction Hash: <span style={styles.value}>{txResult.transaction?.hash}</span></p>

                                    {hashSubmissionResult && (
                                        <div style={{ marginTop: '16px', padding: '16px', background: '#0d0d0d', borderRadius: '8px' }}>
                                            <p style={styles.alertTitle}>Hash Submitted Successfully!</p>
                                            <pre style={styles.codeBlock}>
                                                {JSON.stringify(hashSubmissionResult, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}