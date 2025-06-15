'use client';

import { useState, useEffect } from 'react';
import { useNearWallet } from './NearWalletProvider';
import { apiService } from '@/services/api';
import { styles } from '@/constant';
import { urlHandler } from '@/utils/urlHandler';

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

    useEffect(() => {
        if (accountId) {
            getBalance(accountId).then(setBalance);
        }
    }, [accountId, getBalance]);

    // Restore deposit data from sessionStorage on component mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedDepositData = sessionStorage.getItem('pendingDepositData');
            if (storedDepositData) {
                try {
                    const parsedData = JSON.parse(storedDepositData);
                    setDepositData(parsedData);
                    setIsCalculated(true);
                    // Restore NFT amount if available
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
                // Handle transaction response
                if (urlData.transactionHashes) {
                    const txHash = urlData.transactionHashes;
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
                    } else {
                        console.warn('No deposit data available for hash submission. Transaction completed but hash not submitted.');
                        alert('Transaction completed successfully, but deposit data was not found. Please contact support if needed.');
                    }

                    // Refresh balance
                    if (accountId) {
                        const newBalance = await getBalance(accountId);
                        setBalance(newBalance);
                    }

                    // Reset loading state
                    setTxLoading(false);
                }

                // Handle signing response
                if (urlData.signature && !urlData.transactionHashes) {
                    // For signing, we need to reconstruct the message that was signed
                    try {
                        const currencies = await apiService.getDepositCurrencies();
                        const messageToSign = currencies.length > 0 ? currencies[0].name : 'No currencies available';

                        setSignResult({
                            message: messageToSign,
                            signature: {
                                signature: urlData.signature,
                                publicKey: urlData.publicKey,
                                accountId: urlData.accountId
                            },
                            currencies: currencies
                        });
                    } catch (error) {
                        console.error('Error processing signing response:', error);
                    }

                    // Reset loading state
                    setSignLoading(false);
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
                // Clean up the URL (both hash and query parameters)
                urlHandler.cleanUrl();
            }
        };

        handleWalletResponse();
    }, [accountId, getBalance, depositData]);

    const handleNftAmountChange = (newAmount) => {
        setNftAmount(newAmount);
        // Reset calculation when amount changes
        setIsCalculated(false);
        setDepositData(null);
        setTxResult(null);
        setHashSubmissionResult(null);

        // Clear stored deposit data when amount changes
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

            // Store deposit data with NFT amount in sessionStorage for persistence across page reloads
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

    const handleSendTransaction = async () => {
        if (!depositData) {
            alert('Please calculate deposit amount first');
            return;
        }

        setTxLoading(true);
        setTxResult(null);
        setHashSubmissionResult(null);

        try {
            // This will redirect to NEAR wallet and return via URL hash
            await sendTransaction(depositData.depositAddress, depositData.depositAmount.toString());
            // Note: The actual result handling happens in the useEffect that processes URL hash
        } catch (error) {
            alert(`Transaction failed: ${error.message}`);
            setTxLoading(false);
        }
        // Don't set loading false here - it will be handled when URL response is processed
    };

    const handleSignMessage = async () => {
        setSignLoading(true);
        setSignResult(null);

        try {
            // Step 1: Call API to get currencies
            const currencies = await apiService.getDepositCurrencies();

            // Step 2: Extract the name parameter from the first currency
            const messageToSign = currencies.length > 0 ? currencies[0].name : 'No currencies available';

            // Step 3: Sign the message using NEAR wallet (this will redirect)
            await signMessage(messageToSign);
            // Note: The actual result handling happens in the useEffect that processes URL hash
        } catch (error) {
            alert(`Message signing failed: ${error.message}`);
            setSignLoading(false);
        }
        // Don't set loading false here - it will be handled when URL response is processed
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
                        <h3 style={styles.cardTitle}>Sign Currency Message</h3>
                        <p style={styles.description}>
                            This will fetch currencies from the API and sign the first currency name.
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
                            {signLoading ? 'Fetching & Signing...' : 'Sign Currency Message'}
                        </button>

                        {signResult && (
                            <div style={styles.successAlert}>
                                <p style={styles.alertTitle}>Message Signed Successfully!</p>

                                <div style={{ marginTop: '16px' }}>
                                    <p style={{ ...styles.label, marginBottom: '8px' }}>Signed Message:</p>
                                    <div style={styles.codeBlock}>
                                        {signResult.message}
                                    </div>
                                </div>

                                <div style={{ marginTop: '16px' }}>
                                    <p style={{ ...styles.label, marginBottom: '8px' }}>Signature:</p>
                                    <pre style={styles.codeBlock}>
                                        {JSON.stringify(signResult.signature, null, 2)}
                                    </pre>
                                </div>

                                <div style={{ marginTop: '16px' }}>
                                    <p style={{ ...styles.label, marginBottom: '8px' }}>Available Currencies:</p>
                                    <pre style={styles.codeBlock}>
                                        {JSON.stringify(signResult.currencies, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
// import { useState, useEffect } from 'react';
// import { useNearWallet } from './NearWalletProvider';
// import { apiService } from '@/services/api';
// import { styles } from '@/constant';

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

//     useEffect(() => {
//         if (accountId) {
//             getBalance(accountId).then(setBalance);
//         }
//     }, [accountId, getBalance]);

//     const handleNftAmountChange = (newAmount) => {
//         setNftAmount(newAmount);
//         // Reset calculation when amount changes
//         setIsCalculated(false);
//         setDepositData(null);
//         setTxResult(null);
//         setHashSubmissionResult(null);
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
//         } catch (error) {
//             alert(`Calculation failed: ${error.message}`);
//         } finally {
//             setCalculateLoading(false);
//         }
//     };

//     const handleSendTransaction = async () => {
//         if (!depositData) {
//             alert('Please calculate deposit amount first');
//             return;
//         }

//         setTxLoading(true);
//         setTxResult(null);
//         setHashSubmissionResult(null);

//         try {
//             const result = await sendTransaction(depositData.depositAddress, depositData.depositAmount.toString());
//             setTxResult(result);

//             // Submit transaction hash to API
//             if (result.transaction?.hash) {
//                 try {
//                     const hashResult = await apiService.submitTransactionHash(
//                         depositData.intentId,
//                         result.transaction.hash
//                     );
//                     setHashSubmissionResult(hashResult);
//                 } catch (hashError) {
//                     console.error('Hash submission failed:', hashError);
//                     alert(`Transaction sent but hash submission failed: ${hashError.message}`);
//                 }
//             }

//             // Refresh balance
//             const newBalance = await getBalance(accountId);
//             setBalance(newBalance);
//         } catch (error) {
//             alert(`Transaction failed: ${error.message}`);
//         } finally {
//             setTxLoading(false);
//         }
//     };

//     const handleSignMessage = async () => {
//         setSignLoading(true);
//         setSignResult(null);

//         try {
//             // Step 1: Call API to get currencies
//             const currencies = await apiService.getDepositCurrencies();

//             // // Step 2: Extract the name parameter from the first currency (or handle multiple)
//             const messageToSign = currencies.length > 0 ? currencies[0].name : 'No currencies available';

//             // Step 3: Sign the message using NEAR wallet
//             const signature = await signMessage(messageToSign);

//             // Step 4: Set the result with both the message and signature
//             setSignResult({
//                 message: messageToSign,
//                 signature: signature,
//                 currencies: currencies
//             });

//         } catch (error) {
//             alert(`Message signing failed: ${error.message}`);
//         } finally {
//             setSignLoading(false);
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
//                             </div>
//                         )}
//                     </div>
//                 </>
//             )}
//         </div>
//     );
// }
// // import { useState, useEffect } from 'react';
// // import { useNearWallet } from './NearWalletProvider';
// // import { apiService } from '@/services/api';

// // export default function WalletInterface() {
// //     const {
// //         accountId,
// //         loading,
// //         connectWallet,
// //         disconnectWallet,
// //         sendTransaction,
// //         signMessage,
// //         getBalance,
// //         isConnected,
// //     } = useNearWallet();

// //     const [balance, setBalance] = useState(null);
// //     const [nftAmount, setNftAmount] = useState(1);
// //     const [depositData, setDepositData] = useState(null);
// //     const [isCalculated, setIsCalculated] = useState(false);
// //     const [calculateLoading, setCalculateLoading] = useState(false);
// //     const [txLoading, setTxLoading] = useState(false);
// //     const [signLoading, setSignLoading] = useState(false);
// //     const [txResult, setTxResult] = useState(null);
// //     const [signResult, setSignResult] = useState(null);
// //     const [hashSubmissionResult, setHashSubmissionResult] = useState(null);

// //     useEffect(() => {
// //         if (accountId) {
// //             getBalance(accountId).then(setBalance);
// //         }
// //     }, [accountId, getBalance]);

// //     const handleNftAmountChange = (newAmount) => {
// //         setNftAmount(newAmount);
// //         // Reset calculation when amount changes
// //         setIsCalculated(false);
// //         setDepositData(null);
// //         setTxResult(null);
// //         setHashSubmissionResult(null);
// //     };

// //     const handleCalculateDeposit = async () => {
// //         if (nftAmount < 1) {
// //             alert('Please select at least 1 NFT');
// //             return;
// //         }

// //         setCalculateLoading(true);
// //         setDepositData(null);
// //         setIsCalculated(false);
// //         setTxResult(null);
// //         setHashSubmissionResult(null);

// //         try {
// //             const result = await apiService.calculateDeposit(nftAmount);
// //             setDepositData(result);
// //             setIsCalculated(true);
// //         } catch (error) {
// //             alert(`Calculation failed: ${error.message}`);
// //         } finally {
// //             setCalculateLoading(false);
// //         }
// //     };

// //     const handleSendTransaction = async () => {
// //         if (!depositData) {
// //             alert('Please calculate deposit amount first');
// //             return;
// //         }

// //         setTxLoading(true);
// //         setTxResult(null);
// //         setHashSubmissionResult(null);

// //         try {
// //             const result = await sendTransaction(depositData.depositAddress, depositData.depositAmount.toString());
// //             setTxResult(result);

// //             // Submit transaction hash to API
// //             if (result.transaction?.hash) {
// //                 try {
// //                     const hashResult = await apiService.submitTransactionHash(
// //                         depositData.intentId,
// //                         result.transaction.hash
// //                     );
// //                     setHashSubmissionResult(hashResult);
// //                 } catch (hashError) {
// //                     console.error('Hash submission failed:', hashError);
// //                     alert(`Transaction sent but hash submission failed: ${hashError.message}`);
// //                 }
// //             }

// //             // Refresh balance
// //             const newBalance = await getBalance(accountId);
// //             setBalance(newBalance);
// //         } catch (error) {
// //             alert(`Transaction failed: ${error.message}`);
// //         } finally {
// //             setTxLoading(false);
// //         }
// //     };

// //     const handleSignMessage = async () => {
// //         setSignLoading(true);
// //         setSignResult(null);

// //         try {
// //             // Step 1: Call API to get currencies
// //             const currencies = await apiService.getDepositCurrencies();

// //             // Step 2: Extract the name parameter from the first currency (or handle multiple)
// //             const messageToSign = currencies.length > 0 ? currencies[0].name : 'No currencies available';

// //             // Step 3: Sign the message using NEAR wallet
// //             const signature = await signMessage(messageToSign);

// //             // Step 4: Set the result with both the message and signature
// //             setSignResult({
// //                 message: messageToSign,
// //                 signature: signature,
// //                 currencies: currencies
// //             });

// //         } catch (error) {
// //             alert(`Message signing failed: ${error.message}`);
// //         } finally {
// //             setSignLoading(false);
// //         }
// //     };

// //     if (loading) {
// //         return (
// //             <div style={{ padding: '20px', textAlign: 'center' }}>
// //                 <p>Loading wallet...</p>
// //             </div>
// //         );
// //     }

// //     return (
// //         <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
// //             <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>NEAR Wallet Integration</h1>

// //             {!isConnected ? (
// //                 <div style={{ textAlign: 'center', marginBottom: '30px' }}>
// //                     <button
// //                         onClick={connectWallet}
// //                         style={{
// //                             background: '#00C08B',
// //                             color: 'white',
// //                             border: 'none',
// //                             padding: '12px 24px',
// //                             borderRadius: '8px',
// //                             fontSize: '16px',
// //                             cursor: 'pointer'
// //                         }}
// //                     >
// //                         Connect NEAR Wallet
// //                     </button>
// //                 </div>
// //             ) : (
// //                 <>
// //                     {/* Wallet Info */}
// //                     <div style={{
// //                             background: '#313030',
// //                         padding: '20px',
// //                         borderRadius: '8px',
// //                         marginBottom: '30px'
// //                     }}>
// //                         <h3>Wallet Connected</h3>
// //                         <p><strong>Account ID:</strong> {accountId}</p>
// //                         <p><strong>Balance:</strong> {balance ? `${balance} NEAR` : 'Loading...'}</p>
// //                         <button
// //                             onClick={disconnectWallet}
// //                             style={{
// //                                 background: '#dc3545',
// //                                 color: 'white',
// //                                 border: 'none',
// //                                 padding: '8px 16px',
// //                                 borderRadius: '4px',
// //                                 cursor: 'pointer'
// //                             }}
// //                         >
// //                             Disconnect
// //                         </button>
// //                     </div>

// //                     {/* NFT Deposit Transaction */}
// //                     <div style={{
// //                         background: '#313030',
// //                         padding: '20px',
// //                         borderRadius: '8px',
// //                         marginBottom: '30px'
// //                     }}>
// //                         <h3>NFT Deposit Transaction</h3>

// //                         {/* NFT Amount Counter */}
// //                         <div style={{ marginBottom: '20px', width: '100%' }}>
// //                             <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
// //                                 Select NFT Amount:
// //                             </label>
// //                             <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
// //                                 <button
// //                                     onClick={() => handleNftAmountChange(Math.max(1, nftAmount - 1))}
// //                                     style={{
// //                                         background: '#6c757d',
// //                                         color: 'white',
// //                                         border: 'none',
// //                                         width: '40px',
// //                                         height: '40px',
// //                                         borderRadius: '4px',
// //                                         cursor: 'pointer',
// //                                         fontSize: '18px'
// //                                     }}
// //                                 >
// //                                     -
// //                                 </button>
// //                                 <span style={{
// //                                     minWidth: '60px',
// //                                     textAlign: 'center',
// //                                     fontSize: '18px',
// //                                     fontWeight: 'bold',
// //                                     padding: '8px 12px',
// //                                     border: '2px solid #007bff',
// //                                     borderRadius: '4px'
// //                                 }}>
// //                                     {nftAmount}
// //                                 </span>
// //                                 <button
// //                                     onClick={() => handleNftAmountChange(nftAmount + 1)}
// //                                     style={{
// //                                         background: '#6c757d',
// //                                         color: 'white',
// //                                         border: 'none',
// //                                         width: '40px',
// //                                         height: '40px',
// //                                         borderRadius: '4px',
// //                                         cursor: 'pointer',
// //                                         fontSize: '18px'
// //                                     }}
// //                                 >
// //                                     +
// //                                 </button>
// //                             </div>
// //                         </div>

// //                         {/* Deposit Details (shown after calculation) */}
// //                         {depositData && isCalculated && (
// //                             <div style={{
// //                                     background: '#262626',
// //                                 padding: '15px',
// //                                 borderRadius: '4px',
// //                                 marginBottom: '20px'
// //                             }}>
// //                                 <h4 style={{ marginTop: '0', marginBottom: '10px' }}>Deposit Details:</h4>
// //                                 <p><strong>Intent ID:</strong> {depositData.intentId}</p>
// //                                 <p><strong>Exchange Rate:</strong> {depositData.exchangeRate}</p>
// //                                 <p><strong>Deposit Deadline:</strong> {depositData.depositDeadline}</p>
// //                                 <p><strong>Asset ID:</strong> {depositData.assetId}</p>
// //                             </div>
// //                         )}

// //                         {/* Transaction Fields */}
// //                         <div style={{ marginBottom: '15px' }}>
// //                             <label style={{ display: 'block', marginBottom: '5px' }}>
// //                                 Recipient Account ID:
// //                             </label>
// //                             <input
// //                                 type="text"
// //                                 value={isCalculated && depositData ? depositData.depositAddress : ''}
// //                                 disabled={true}
// //                                 placeholder="Address will appear after calculation"
// //                                 style={{
// //                                     width: '100%',
// //                                     padding: '8px',
// //                                     borderRadius: '4px',
// //                                     border: '1px solid #ddd',
// //                                     background: (isCalculated && depositData) ? '#f8f9fa' : '#e9ecef',
// //                                     color: (isCalculated && depositData) ? '#495057' : '#6c757d'
// //                                 }}
// //                             />
// //                         </div>
// //                         <div style={{ marginBottom: '20px' }}>
// //                             <label style={{ display: 'block', marginBottom: '5px' }}>
// //                                 Amount (NEAR):
// //                             </label>
// //                             <input
// //                                 type="text"
// //                                 value={isCalculated && depositData ? depositData.depositAmount : ''}
// //                                 disabled={true}
// //                                 placeholder="Amount will appear after calculation"
// //                                 style={{
// //                                     width: '100%',
// //                                     padding: '8px',
// //                                     borderRadius: '4px',
// //                                     border: '1px solid #ddd',
// //                                     background: (isCalculated && depositData) ? '#f8f9fa' : '#e9ecef',
// //                                     color: (isCalculated && depositData) ? '#495057' : '#6c757d'
// //                                 }}
// //                             />
// //                         </div>

// //                         {/* Calculate or Transfer Button */}
// //                         {!isCalculated ? (
// //                             <button
// //                                 onClick={handleCalculateDeposit}
// //                                 disabled={calculateLoading}
// //                                 style={{
// //                                     background: calculateLoading ? '#ccc' : '#17a2b8',
// //                                     color: 'white',
// //                                     border: 'none',
// //                                     padding: '10px 20px',
// //                                     borderRadius: '4px',
// //                                     cursor: calculateLoading ? 'not-allowed' : 'pointer',
// //                                     width: '100%'
// //                                 }}
// //                             >
// //                                 {calculateLoading ? 'Calculating...' : 'Calculate Deposit'}
// //                             </button>
// //                         ) : (
// //                             <div style={{ display: 'flex', gap: '10px' }}>
// //                                 <button
// //                                     onClick={handleCalculateDeposit}
// //                                     disabled={calculateLoading}
// //                                     style={{
// //                                         background: calculateLoading ? '#ccc' : '#17a2b8',
// //                                         color: 'white',
// //                                         border: 'none',
// //                                         padding: '10px 20px',
// //                                         borderRadius: '4px',
// //                                         cursor: calculateLoading ? 'not-allowed' : 'pointer',
// //                                         flex: '1'
// //                                     }}
// //                                 >
// //                                     {calculateLoading ? 'Calculating...' : 'Recalculate'}
// //                                 </button>
// //                                 <button
// //                                     onClick={handleSendTransaction}
// //                                     disabled={txLoading}
// //                                     style={{
// //                                         background: txLoading ? '#ccc' : '#28a745',
// //                                         color: 'white',
// //                                         border: 'none',
// //                                         padding: '10px 20px',
// //                                         borderRadius: '4px',
// //                                         cursor: txLoading ? 'not-allowed' : 'pointer',
// //                                         flex: '1'
// //                                     }}
// //                                 >
// //                                     {txLoading ? 'Transferring...' : 'Transfer Amount'}
// //                                 </button>
// //                             </div>
// //                         )}

// //                         {/* Transaction Result */}
// //                         {txResult && (
// //                             <div style={{
// //                                 marginTop: '15px',
// //                                 padding: '10px',
// //                                 background: '#d4edda',
// //                                 borderRadius: '4px'
// //                             }}>
// //                                 <p><strong>Transaction Successful!</strong></p>
// //                                 <p>Transaction Hash: {txResult.transaction?.hash}</p>

// //                                 {hashSubmissionResult && (
// //                                     <div style={{
// //                                         marginTop: '10px',
// //                                         padding: '10px',
// //                                         background: '#d1ecf1',
// //                                         borderRadius: '4px'
// //                                     }}>
// //                                         <p><strong>Hash Submitted Successfully!</strong></p>
// //                                         <pre style={{
// //                                             background: '#f8f9fa',
// //                                             padding: '8px',
// //                                             borderRadius: '4px',
// //                                             fontSize: '12px',
// //                                             overflow: 'auto'
// //                                         }}>
// //                                             {JSON.stringify(hashSubmissionResult, null, 2)}
// //                                         </pre>
// //                                     </div>
// //                                 )}
// //                             </div>
// //                         )}
// //                     </div>

// //                     {/* Sign Message */}
// //                     <div style={{
// //                         background: '#313030',
// //                         padding: '20px',
// //                         borderRadius: '8px',
// //                         marginBottom: '30px'
// //                     }}>
// //                         <h3>Sign Currency Message</h3>
// //                         <p style={{ color: '#666', marginBottom: '15px' }}>
// //                             This will fetch currencies from the API and sign the first currency name.
// //                         </p>
// //                         <button
// //                             onClick={handleSignMessage}
// //                             disabled={signLoading}
// //                             style={{
// //                                 background: signLoading ? '#ccc' : '#28a745',
// //                                 color: 'white',
// //                                 border: 'none',
// //                                 padding: '10px 20px',
// //                                 borderRadius: '4px',
// //                                 cursor: signLoading ? 'not-allowed' : 'pointer'
// //                             }}
// //                         >
// //                             {signLoading ? 'Fetching & Signing...' : 'Sign Currency Message'}
// //                         </button>

// //                         {signResult && (
// //                             <div style={{
// //                                 marginTop: '15px',
// //                                 padding: '15px',
// //                                 background: '#d4edda',
// //                                 borderRadius: '4px'
// //                             }}>
// //                                 <p><strong>Message Signed Successfully!</strong></p>

// //                                 <div style={{ marginTop: '10px' }}>
// //                                     <p><strong>Signed Message:</strong></p>
// //                                     <div style={{
// //                                         background: '#f8f9fa',
// //                                         padding: '10px',
// //                                         borderRadius: '4px',
// //                                         marginBottom: '10px',
// //                                         fontFamily: 'monospace'
// //                                     }}>
// //                                         {signResult.message}
// //                                     </div>
// //                                 </div>

// //                                 <div style={{ marginTop: '10px' }}>
// //                                     <p><strong>Signature:</strong></p>
// //                                     <pre style={{
// //                                         background: '#f8f9fa',
// //                                         padding: '10px',
// //                                         borderRadius: '4px',
// //                                         fontSize: '12px',
// //                                         overflow: 'auto',
// //                                         marginBottom: '10px'
// //                                     }}>
// //                                         {JSON.stringify(signResult.signature, null, 2)}
// //                                     </pre>
// //                                 </div>

// //                                 <div style={{ marginTop: '10px' }}>
// //                                     <p><strong>Available Currencies:</strong></p>
// //                                     <pre style={{
// //                                         background: '#f8f9fa',
// //                                         padding: '10px',
// //                                         borderRadius: '4px',
// //                                         fontSize: '12px',
// //                                         overflow: 'auto'
// //                                     }}>
// //                                         {JSON.stringify(signResult.currencies, null, 2)}
// //                                     </pre>
// //                                 </div>
// //                             </div>
// //                         )}
// //                     </div>
// //                 </>
// //             )}
// //         </div>
// //     );
// // }