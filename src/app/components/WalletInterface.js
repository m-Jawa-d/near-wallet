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
        isConnected,
        selector,
        sendContractTransaction,
    } = useNearWallet();

    const [balance, setBalance] = useState(null);
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

    // Keep track of pending operations
    const pendingOperationRef = useRef(null);

    useEffect(() => {
        if (accountId) {
            getBalance(accountId).then(setBalance);
        }
    }, [accountId, getBalance]);

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
                txHash // Use the actual transaction hash
            );
            setTokenResult(tokenResponse);
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

        // Refresh balance
        if (accountId) {
            const newBalance = await getBalance(accountId);
            setBalance(newBalance);
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
                    urlData.signature
                );
                setTokenResult(tokenResponse);
                console.log('Token received:', tokenResponse);
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
            const result = await apiService.calculateDeposit(nftAmount);
            setDepositData(result);
            setIsCalculated(true);

            if (typeof window !== 'undefined') {
                sessionStorage.setItem('pendingDepositData', JSON.stringify({
                    ...result,
                    nftAmount: nftAmount
                }));
            }
        } catch (error) {
            alert(`Calculation failed: ${error.message}`);
        } finally {
            setCalculateLoading(false);
        }
    };

    useEffect(() => {
        handleCalculateDeposit()
    }, [])

    const handleSendTransaction = async () => {
        if (!depositData) {
            alert('Please calculate deposit amount first');
            return;
        }

        // Check balance
        if (balance !== null) {
            const depositAmountFloat = parseFloat(depositData.depositAmount);
            const balanceFloat = parseFloat(balance);
            const gasBuffer = 0.1;
            const requiredAmount = depositAmountFloat + gasBuffer;

            if (balanceFloat < requiredAmount) {
                alert(
                    `Insufficient balance!\n\n` +
                    `Required: ${depositAmountFloat} NEAR + ${gasBuffer} NEAR (gas fees) = ${requiredAmount} NEAR\n` +
                    `Available: ${balanceFloat} NEAR\n` +
                    `Shortage: ${(requiredAmount - balanceFloat).toFixed(4)} NEAR\n\n` +
                    `Please add more NEAR to your wallet before proceeding.`
                );
                return;
            }
        }

        setTxLoading(true);
        setTxResult(null);
        setHashSubmissionResult(null);
        pendingOperationRef.current = 'transaction';

        try {
            const result = await sendTransaction(depositData.depositAddress, depositData.depositAmount.toString());

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
            // Step 1: Get nonce and bufferNonce from API
            const currencies = await apiService.getNonce(accountId);
            console.log('Currencies received:', currencies);

            if (!currencies || !currencies.rawNonce) {
                throw new Error('No bufferNonce received from API');
            }

            const messageToSign = currencies.nonce;
            const bufferNonce = currencies.rawNonce;

            // Step 2: Send MPC transaction to v1.signer contract
            const mpcPayload = {
                path: "ethereum-1",
                payload: bufferNonce, // Use the bufferNonce array directly
                key_version: "0"
            };

            console.log('Sending MPC transaction with payload:', mpcPayload);

            // Store data for processing after redirect
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('pendingMpcData', JSON.stringify({
                    nonce: messageToSign,
                    signature: 'pending', // Will be replaced after transaction
                    currencies: currencies,
                    publicKey: null
                }));
            }

            const result = await sendContractTransaction(
                MPC_CONTRACT_ID,
                'sign',
                mpcPayload,
                '300000000000000', // 300 TGas
               '0'// No deposit required
            );

            // Check if we got a direct response
            if (result && result.transaction && result.transaction.hash) {
                console.log('Direct MPC transaction response received:', result);
                await handleMpcTransactionResponse(result.transaction.hash, {
                    nonce: messageToSign,
                    signature: 'mpc_signature', // Placeholder
                    currencies: currencies
                });
            } else {
                console.log('MPC transaction initiated, waiting for redirect response...');
                // For wallets that redirect, the response will be handled by the URL effect
            }

        } catch (error) {
            console.error('MPC signing error:', error);
            alert(`MPC signing failed: ${error.message}`);
            setSignLoading(false);
            pendingOperationRef.current = null;

            // Clear any pending data
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem('pendingMpcData');
            }
        }
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
                
                input:focus {
                    outline: none;
                    border-color: #ffffff;
                    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
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
                            <span style={styles.label}>Balance</span>
                            <span style={styles.value}>
                                {balance ? `${balance} NEAR` : 'Loading...'}
                            </span>
                        </div>
                        <button
                            onClick={disconnectWallet}
                            style={styles.disconnectButton}
                        >
                            Disconnect Wallet
                        </button>
                    </div>

                    {/* NFT Deposit Transaction */}
                    <div style={styles.card}>
                        <h3 style={styles.cardTitle}>NFT Deposit Transaction</h3>

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
                                Amount (NEAR)
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
                                disabled={calculateLoading}
                                style={{
                                    ...styles.buttonPrimary,
                                    opacity: calculateLoading ? 0.5 : 1
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

                    {/* Sign Message */}
                    <div style={styles.card}>
                        <h3 style={styles.cardTitle}>MPC Sign Transaction</h3>
                        <p style={styles.description}>
                            This will fetch nonce from the API and send an MPC signing transaction to v1.signer contract.
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
                            {signLoading ? 'Processing MPC Transaction...' : 'Send MPC Sign Transaction'}
                        </button>

                        {signResult && (
                            <div style={styles.successAlert}>
                                <p style={styles.alertTitle}>MPC Transaction Successful!</p>

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
                </>
            )}
        </div>
    );
}
// 'use client';

// import { useState, useEffect, useRef } from 'react';
// import { useNearWallet } from './NearWalletProvider';
// import { apiService } from '@/services/api';
// import { styles } from '@/constant';
// import { urlHandler } from '@/utils/urlHandler';
// import SignatureVerificationComponent from './SignatureVerificationComponent';

// // Add NETWORK_ID constant
// const NETWORK_ID = process.env.NEXT_PUBLIC_NETWORK_ID || 'testnet';

// export default function WalletInterface() {
//     const {
//         accountId,
//         loading,
//         connectWallet,
//         disconnectWallet,
//         sendTransaction,
//         signMessage,
//         getBalance,
//         isConnected,
//         selector,
//     } = useNearWallet();

//     const [balance, setBalance] = useState(null);
//     const [nftAmount, setNftAmount] = useState(1);
//     const [depositData, setDepositData] = useState(null);
//     const [isCalculated, setIsCalculated] = useState(false);
//     const [calculateLoading, setCalculateLoading] = useState(false);
//     const [txLoading, setTxLoading] = useState(false);
//     const [signLoading, setSignLoading] = useState(false);
//     const [txResult, setTxResult] = useState(null);
//     const [signResult, setSignResult] = useState(null);
//     const [hashSubmissionResult, setHashSubmissionResult] = useState(null);
//     const [tokenResult, setTokenResult] = useState(null);
//     const [currentWallet, setCurrentWallet] = useState(null);

//     // Keep track of pending operations
//     const pendingOperationRef = useRef(null);

//     useEffect(() => {
//         if (accountId) {
//             getBalance(accountId).then(setBalance);
//         }
//     }, [accountId, getBalance]);

//     // Get current wallet info
//     useEffect(() => {
//         const getCurrentWallet = async () => {
//             if (selector && accountId) {
//                 try {
//                     const wallet = await selector.wallet();
//                     setCurrentWallet(wallet.id);
//                     console.log('Current wallet:', wallet.id);
//                 } catch (error) {
//                     console.error('Error getting wallet info:', error);
//                 }
//             }
//         };
//         getCurrentWallet();
//     }, [selector, accountId]);

//     // Restore deposit data from sessionStorage on component mount
//     useEffect(() => {
//         if (typeof window !== 'undefined') {
//             const storedDepositData = sessionStorage.getItem('pendingDepositData');
//             if (storedDepositData) {
//                 try {
//                     const parsedData = JSON.parse(storedDepositData);
//                     setDepositData(parsedData);
//                     setIsCalculated(true);
//                     if (parsedData.nftAmount) {
//                         setNftAmount(parsedData.nftAmount);
//                     }
//                 } catch (error) {
//                     console.error('Error parsing stored deposit data:', error);
//                     sessionStorage.removeItem('pendingDepositData');
//                 }
//             }
//         }
//     }, []);
//     // Handle URL hash data from wallet redirects
//     useEffect(() => {
//         const handleWalletResponse = async () => {
//             const urlData = urlHandler.parseWalletResponse();

//             if (!urlData) return;

//             try {
//                 // Handle transaction response from URL
//                 if (urlData.transactionHashes) {
//                     await handleTransactionResponse(urlData.transactionHashes);
//                 }

//                 // Handle signing response from URL
//                 if (urlData.signature && !urlData.transactionHashes) {
//                     await handleSigningResponse(urlData);
//                 }

//                 // Handle errors
//                 if (urlData.errorCode || urlData.errorMessage) {
//                     alert(`Wallet operation failed: ${urlData.errorMessage || 'Unknown error'}`);
//                     setTxLoading(false);
//                     setSignLoading(false);
//                 }

//             } catch (error) {
//                 console.error('Error handling wallet response:', error);
//                 setTxLoading(false);
//                 setSignLoading(false);
//             } finally {
//                 // Clean up the URL
//                 urlHandler.cleanUrl();
//             }
//         };

//         if (accountId) {
//             handleWalletResponse();
//         }
//     }, [accountId, getBalance, depositData]);

//     // Helper function to handle transaction responses
//     const handleTransactionResponse = async (txHash) => {
//         setTxResult({
//             transaction: { hash: txHash }
//         });

//         // Get deposit data from state or sessionStorage
//         let currentDepositData = depositData;
//         if (!currentDepositData && typeof window !== 'undefined') {
//             const storedData = sessionStorage.getItem('pendingDepositData');
//             if (storedData) {
//                 try {
//                     currentDepositData = JSON.parse(storedData);
//                     setDepositData(currentDepositData);
//                     setIsCalculated(true);
//                 } catch (error) {
//                     console.error('Error parsing stored deposit data:', error);
//                 }
//             }
//         }

//         // Submit hash to API if we have deposit data
//         if (currentDepositData && currentDepositData.intentId) {
//             try {
//                 const hashResult = await apiService.submitTransactionHash(
//                     currentDepositData.intentId,
//                     txHash
//                 );
//                 setHashSubmissionResult(hashResult);

//                 // Clear stored deposit data after successful hash submission
//                 if (typeof window !== 'undefined') {
//                     sessionStorage.removeItem('pendingDepositData');
//                 }
//             } catch (hashError) {
//                 console.error('Hash submission failed:', hashError);
//                 alert(`Transaction completed but hash submission failed: ${hashError.message}`);
//             }
//         }

//         // Refresh balance
//         if (accountId) {
//             const newBalance = await getBalance(accountId);
//             setBalance(newBalance);
//         }

//         setTxLoading(false);
//     };

//     // Helper function to handle signing responses
//     const handleSigningResponse = async (urlData) => {
//         try {
//             const currencies = await apiService.getNonce(accountId);
//             const messageToSign = currencies ? currencies.nonce : 'No currencies available';

//             setSignResult({
//                 message: messageToSign,
//                 signature: {
//                     signature: urlData.signature,
//                     publicKey: urlData.publicKey,
//                     accountId: urlData.accountId
//                 },
//                 currencies: currencies
//             });

//             // Call token API after successful signature
//             try {
//                 const tokenResponse = await apiService.getToken(
//                     accountId,
//                     currencies.nonce,
//                     urlData.signature
//                 );
//                 setTokenResult(tokenResponse);
//                 console.log('Token received:', tokenResponse);
//             } catch (tokenError) {
//                 console.error('Token request failed:', tokenError);
//                 alert(`Signature successful but token request failed: ${tokenError.message}`);
//             }

//         } catch (error) {
//             console.error('Error processing signing response:', error);
//         }

//         setSignLoading(false);
//     };

//     const handleNftAmountChange = (newAmount) => {
//         setNftAmount(newAmount);
//         setIsCalculated(false);
//         setDepositData(null);
//         setTxResult(null);
//         setHashSubmissionResult(null);

//         if (typeof window !== 'undefined') {
//             sessionStorage.removeItem('pendingDepositData');
//         }
//     };

//     const handleCalculateDeposit = async () => {
//         if (nftAmount < 1) {
//             alert('Please select at least 1 NFT');
//             return;
//         }

//         setCalculateLoading(true);
//         setDepositData(null);
//         setIsCalculated(false);
//         setTxResult(null);
//         setHashSubmissionResult(null);

//         try {
//             const result = await apiService.calculateDeposit(nftAmount);
//             setDepositData(result);
//             setIsCalculated(true);

//             if (typeof window !== 'undefined') {
//                 sessionStorage.setItem('pendingDepositData', JSON.stringify({
//                     ...result,
//                     nftAmount: nftAmount
//                 }));
//             }
//         } catch (error) {
//             alert(`Calculation failed: ${error.message}`);
//         } finally {
//             setCalculateLoading(false);
//         }
//     };

//     useEffect(() => {
//         handleCalculateDeposit()
//     }, [])

//     const handleSendTransaction = async () => {
//         if (!depositData) {
//             alert('Please calculate deposit amount first');
//             return;
//         }

//         // Check balance
//         if (balance !== null) {
//             const depositAmountFloat = parseFloat(depositData.depositAmount);
//             const balanceFloat = parseFloat(balance);
//             const gasBuffer = 0.1;
//             const requiredAmount = depositAmountFloat + gasBuffer;

//             if (balanceFloat < requiredAmount) {
//                 alert(
//                     `Insufficient balance!\n\n` +
//                     `Required: ${depositAmountFloat} NEAR + ${gasBuffer} NEAR (gas fees) = ${requiredAmount} NEAR\n` +
//                     `Available: ${balanceFloat} NEAR\n` +
//                     `Shortage: ${(requiredAmount - balanceFloat).toFixed(4)} NEAR\n\n` +
//                     `Please add more NEAR to your wallet before proceeding.`
//                 );
//                 return;
//             }
//         }

//         setTxLoading(true);
//         setTxResult(null);
//         setHashSubmissionResult(null);
//         pendingOperationRef.current = 'transaction';

//         try {
//             const result = await sendTransaction(depositData.depositAddress, depositData.depositAmount.toString());

//             // Check if we got a direct response (e.g., from Meteor wallet)
//             if (result && result.transaction && result.transaction.hash) {
//                 console.log('Direct transaction response received:', result);
//                 await handleTransactionResponse(result.transaction.hash);
//             } else {
//                 console.log('Transaction initiated, waiting for redirect response...');
//                 // For wallets that redirect, the response will be handled by the URL effect
//             }
//         } catch (error) {
//             console.error('Transaction error:', error);
//             alert(`Transaction failed: ${error.message}`);
//             setTxLoading(false);
//             pendingOperationRef.current = null;
//         }
//     };

//     const handleSignMessage = async () => {
//         setSignLoading(true);
//         setSignResult(null);
//         setTokenResult(null);
//         pendingOperationRef.current = 'signing';

//         try {
//             // Step 1: Get currencies
//             const currencies = await apiService.getNonce(accountId);
//             console.log('Currencies received:', currencies);

//             const messageToSign = currencies ? currencies.nonce : 'No currencies available';
//             const bufferNonce = currencies?.rawNonce;

//             // Step 2: Sign the message
//             const result = await signMessage(messageToSign, bufferNonce);

//             // Check if we got a direct response (e.g., from Meteor wallet)
//             if (result && result.signature) {
//                 console.log('Direct signing response received:', result);

//                 setSignResult({
//                     message: messageToSign,
//                     signature: result,
//                     currencies: currencies
//                 });

//                 // Call token API
//                 try {
//                     const tokenResponse = await apiService.getToken(
//                         accountId,
//                         currencies.nonce,
//                         result.signature
//                     );
//                     setTokenResult(tokenResponse);
//                     console.log('Token received:', tokenResponse);
//                 } catch (tokenError) {
//                     console.error('Token request failed:', tokenError);
//                     alert(`Signature successful but token request failed: ${tokenError.message}`);
//                 }

//                 setSignLoading(false);
//                 pendingOperationRef.current = null;
//             } else {
//                 console.log('Signing initiated, waiting for redirect response...');
//                 // For wallets that redirect, the response will be handled by the URL effect
//             }
//         } catch (error) {
//             console.error('Signing error:', error);
//             alert(`Message signing failed: ${error.message}`);
//             setSignLoading(false);
//             pendingOperationRef.current = null;
//         }
//     };

//     if (loading) {
//         return (
//             <div style={styles.container}>
//                 <div style={{ textAlign: 'center', padding: '80px 20px' }}>
//                     <div style={styles.loadingSpinner}></div>
//                     <p style={{ color: '#a0a0a0', fontSize: '18px' }}>Initializing wallet connection...</p>
//                 </div>
//             </div>
//         );
//     }

//     return (
//         <div style={styles.container}>
//             <style jsx>{`
//                 @keyframes spin {
//                     0% { transform: rotate(0deg); }
//                     100% { transform: rotate(360deg); }
//                 }
                
//                 button:hover {
//                     transform: translateY(-2px);
//                     box-shadow: 0 8px 24px rgba(255, 255, 255, 0.15);
//                 }
                
//                 button:disabled {
//                     opacity: 0.5;
//                     cursor: not-allowed;
//                     transform: none !important;
//                 }
                
//                 input:focus {
//                     outline: none;
//                     border-color: #ffffff;
//                     box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
//                 }
//             `}</style>

//             <h1 style={styles.title}>NEAR Wallet Interface</h1>

//             {!isConnected ? (
//                 <div style={styles.connectContainer}>
//                     <button
//                         onClick={connectWallet}
//                         style={styles.connectButton}
//                     >
//                         Connect NEAR Wallet
//                     </button>
//                 </div>
//             ) : (
//                 <>
//                     {/* Wallet Info */}
//                     <div style={styles.card}>
//                         <h3 style={styles.cardTitle}>Wallet Status</h3>
//                         <div style={styles.infoRow}>
//                             <span style={styles.label}>Account ID</span>
//                             <span style={styles.value}>{accountId}</span>
//                         </div>
//                         <div style={styles.infoRow}>
//                             <span style={styles.label}>Wallet Type</span>
//                             <span style={styles.value}>{currentWallet || 'Loading...'}</span>
//                         </div>
//                         <div style={styles.infoRow}>
//                             <span style={styles.label}>Balance</span>
//                             <span style={styles.value}>
//                                 {balance ? `${balance} NEAR` : 'Loading...'}
//                             </span>
//                         </div>
//                         <button
//                             onClick={disconnectWallet}
//                             style={styles.disconnectButton}
//                         >
//                             Disconnect Wallet
//                         </button>
//                     </div>

//                     {/* NFT Deposit Transaction */}
//                     <div style={styles.card}>
//                         <h3 style={styles.cardTitle}>NFT Deposit Transaction</h3>

//                         {/* NFT Amount Counter */}
//                         <div style={styles.amountSelector}>
//                             <label style={styles.selectorLabel}>
//                                 Select NFT Amount
//                             </label>
//                             <div style={styles.selectorContainer}>
//                                 <button
//                                     onClick={() => handleNftAmountChange(Math.max(1, nftAmount - 1))}
//                                     style={styles.selectorButton}
//                                 >
//                                     −
//                                 </button>
//                                 <span style={styles.amountDisplay}>
//                                     {nftAmount}
//                                 </span>
//                                 <button
//                                     onClick={() => handleNftAmountChange(nftAmount + 1)}
//                                     style={styles.selectorButton}
//                                 >
//                                     +
//                                 </button>
//                             </div>
//                         </div>

//                         {/* Deposit Details */}
//                         {depositData && isCalculated && (
//                             <div style={styles.depositDetails}>
//                                 <h4 style={styles.depositTitle}>Deposit Details</h4>
//                                 <div style={styles.depositItem}>
//                                     <span style={styles.label}>Intent ID</span>
//                                     <span style={styles.value}>{depositData.intentId}</span>
//                                 </div>
//                                 <div style={styles.depositItem}>
//                                     <span style={styles.label}>Exchange Rate</span>
//                                     <span style={styles.value}>{depositData.exchangeRate}</span>
//                                 </div>
//                                 <div style={styles.depositItem}>
//                                     <span style={styles.label}>Deposit Deadline</span>
//                                     <span style={styles.value}>{depositData.depositDeadline}</span>
//                                 </div>
//                                 <div style={styles.depositItem}>
//                                     <span style={styles.label}>Asset ID</span>
//                                     <span style={styles.value}>{depositData.assetId}</span>
//                                 </div>
//                             </div>
//                         )}

//                         {/* Transaction Fields */}
//                         <div style={styles.inputGroup}>
//                             <label style={styles.inputLabel}>
//                                 Recipient Account ID
//                             </label>
//                             <input
//                                 type="text"
//                                 value={isCalculated && depositData ? depositData.depositAddress : ''}
//                                 disabled={true}
//                                 placeholder="Address will appear after calculation"
//                                 style={{
//                                     ...styles.input,
//                                     opacity: (isCalculated && depositData) ? 1 : 0.5
//                                 }}
//                             />
//                         </div>
//                         <div style={styles.inputGroup}>
//                             <label style={styles.inputLabel}>
//                                 Amount (NEAR)
//                             </label>
//                             <input
//                                 type="text"
//                                 value={isCalculated && depositData ? depositData.depositAmount : ''}
//                                 disabled={true}
//                                 placeholder="Amount will appear after calculation"
//                                 style={{
//                                     ...styles.input,
//                                     opacity: (isCalculated && depositData) ? 1 : 0.5
//                                 }}
//                             />
//                         </div>

//                         {/* Action Buttons */}
//                         {!isCalculated ? (
//                             <button
//                                 onClick={handleCalculateDeposit}
//                                 disabled={calculateLoading}
//                                 style={{
//                                     ...styles.buttonPrimary,
//                                     opacity: calculateLoading ? 0.5 : 1
//                                 }}
//                             >
//                                 {calculateLoading && <div style={styles.loadingSpinner}></div>}
//                                 {calculateLoading ? 'Calculating...' : 'Calculate Deposit'}
//                             </button>
//                         ) : (
//                             <div style={styles.buttonGroup}>
//                                 <button
//                                     onClick={handleCalculateDeposit}
//                                     disabled={calculateLoading}
//                                     style={{
//                                         ...styles.buttonSecondary,
//                                         opacity: calculateLoading ? 0.5 : 1
//                                     }}
//                                 >
//                                     {calculateLoading && <div style={styles.loadingSpinner}></div>}
//                                     {calculateLoading ? 'Calculating...' : 'Recalculate'}
//                                 </button>
//                                 <button
//                                     onClick={handleSendTransaction}
//                                     disabled={txLoading}
//                                     style={{
//                                         ...styles.buttonSuccess,
//                                         opacity: txLoading ? 0.5 : 1
//                                     }}
//                                 >
//                                     {txLoading && <div style={styles.loadingSpinner}></div>}
//                                     {txLoading ? 'Processing...' : 'Transfer Amount'}
//                                 </button>
//                             </div>
//                         )}

//                         {/* Transaction Result */}
//                         {txResult && (
//                             <div style={styles.successAlert}>
//                                 <p style={styles.alertTitle}>Transaction Successful!</p>
//                                 <p>Transaction Hash: <span style={styles.value}>{txResult.transaction?.hash}</span></p>

//                                 {hashSubmissionResult && (
//                                     <div style={{ marginTop: '16px', padding: '16px', background: '#0d0d0d', borderRadius: '8px' }}>
//                                         <p style={styles.alertTitle}>Hash Submitted Successfully!</p>
//                                         <pre style={styles.codeBlock}>
//                                             {JSON.stringify(hashSubmissionResult, null, 2)}
//                                         </pre>
//                                     </div>
//                                 )}
//                             </div>
//                         )}
//                     </div>

//                     {/* Sign Message */}
//                     <div style={styles.card}>
//                         <h3 style={styles.cardTitle}>Sign Currency Message</h3>
//                         <p style={styles.description}>
//                             This will fetch currencies from the API and sign the first currency name.
//                             {currentWallet && (
//                                 <span style={{ display: 'block', marginTop: '8px', fontSize: '14px', color: '#888' }}>
//                                     Using {currentWallet} wallet - {currentWallet === 'meteor-wallet' ? 'Direct response' : 'Redirect response'}
//                                 </span>
//                             )}
//                         </p>
//                         <button
//                             onClick={handleSignMessage}
//                             disabled={signLoading}
//                             style={{
//                                 ...styles.buttonPrimary,
//                                 opacity: signLoading ? 0.5 : 1
//                             }}
//                         >
//                             {signLoading && <div style={styles.loadingSpinner}></div>}
//                             {signLoading ? 'Fetching & Signing...' : 'Sign Currency Message'}
//                         </button>

//                         {signResult && (
//                             <div style={styles.successAlert}>
//                                 <p style={styles.alertTitle}>Message Signed Successfully!</p>

//                                 <div style={{ marginTop: '16px' }}>
//                                     <p style={{ ...styles.label, marginBottom: '8px' }}>Signed Message:</p>
//                                     <div style={styles.codeBlock}>
//                                         {signResult.message}
//                                     </div>
//                                 </div>

//                                 <div style={{ marginTop: '16px' }}>
//                                     <p style={{ ...styles.label, marginBottom: '8px' }}>Signature:</p>
//                                     <pre style={styles.codeBlock}>
//                                         {JSON.stringify(signResult.signature, null, 2)}
//                                     </pre>
//                                 </div>

//                                 <div style={{ marginTop: '16px' }}>
//                                     <p style={{ ...styles.label, marginBottom: '8px' }}>Available Currencies:</p>
//                                     <pre style={styles.codeBlock}>
//                                         {JSON.stringify(signResult.currencies, null, 2)}
//                                     </pre>
//                                 </div>

//                                 {tokenResult && (
//                                     <div style={{ marginTop: '16px', padding: '16px', background: '#0d4d0d', borderRadius: '8px' }}>
//                                         <p style={styles.alertTitle}>Token Retrieved Successfully!</p>
//                                         <pre style={styles.codeBlock}>
//                                             {JSON.stringify(tokenResult, null, 2)}
//                                         </pre>
//                                     </div>
//                                 )}

//                                 {/* Add the signature verification component here */}
//                                 <div style={{ marginTop: '20px' }}>
//                                     <SignatureVerificationComponent
//                                         signResult={signResult}
//                                         accountId={accountId}
//                                         networkId={NETWORK_ID}
//                                     />
//                                 </div>
//                             </div>
//                         )}
//                     </div>
//                 </>
//             )}
//         </div>
//     );
// }