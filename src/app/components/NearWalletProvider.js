'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { setupWalletSelector } from '@near-wallet-selector/core';
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet';
import { setupHereWallet } from '@near-wallet-selector/here-wallet';
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet';
import { setupModal } from '@near-wallet-selector/modal-ui';
import { providers, utils } from 'near-api-js';

const NearWalletContext = createContext();
// Import the required CSS for the modal UI
import '@near-wallet-selector/modal-ui/styles.css';

export const useNearWallet = () => {
    const context = useContext(NearWalletContext);
    if (!context) {
        throw new Error('useNearWallet must be used within a NearWalletProvider');
    }
    return context;
};

export const NearWalletProvider = ({ children }) => {
    const [selector, setSelector] = useState(null);
    const [modal, setModal] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [accountId, setAccountId] = useState(null);
    const [loading, setLoading] = useState(true);

    const NETWORK_ID = process.env.NEXT_PUBLIC_NETWORK_ID; // Change to 'mainnet' for production
    const CONTRACT_ID = process.env.NEXT_PUBLIC_MPC_CONTRACT; // Example contract

    useEffect(() => {
        const init = async () => {
            try {
                const _selector = await setupWalletSelector({
                    network: NETWORK_ID,
                    debug: true,
                    modules: [
                        setupMyNearWallet(),
                        setupHereWallet(),
                        setupMeteorWallet(),
                    ],
                });

                const _modal = setupModal(_selector, {
                    contractId: CONTRACT_ID,
                });

                const state = _selector.store.getState();
                setAccounts(state.accounts);
                setAccountId(state.accounts[0]?.accountId || null);

                setSelector(_selector);
                setModal(_modal);
            } catch (error) {
                console.error('Failed to initialize wallet selector:', error);
            } finally {
                setLoading(false);
            }
        };

        init();
    }, []);

    useEffect(() => {
        if (!selector) return;

        const subscription = selector.store.observable
            .subscribe((state) => {
                setAccounts(state.accounts);
                setAccountId(state.accounts[0]?.accountId || null);
            });

        return () => subscription.unsubscribe();
    }, [selector]);

    const connectWallet = async () => {
        if (!modal) return;
        modal.show();
    };

    const disconnectWallet = async () => {
        if (!selector) return;

        const wallet = await selector.wallet();
        await wallet.signOut();
        setAccountId(null);
        setAccounts([]);
        localStorage.removeItem('accessToken');
    };

    // Helper function to convert amount based on token decimals
    const convertAmount = (amount, decimals) => {
        if (decimals === 24) {
            // For NEAR and WNEAR (24 decimals)
            return utils.format.parseNearAmount(amount.toString());
        } else {
            // For USDT, USDC (6 decimals) and other tokens
            const amountFloat = parseFloat(amount.toString());
            if (isNaN(amountFloat)) {
                throw new Error('Invalid amount provided');
            }

            // Convert to string with proper decimal places and then to base units
            const multiplier = Math.pow(10, decimals);
            const baseUnits = Math.floor(amountFloat * multiplier);
            return baseUnits.toString();
        }
    };

    const sendTransaction = async (receiverId, amount, currencyInfo = null) => {
        if (!selector || !accountId) {
            throw new Error('Wallet not connected');
        }

        try {
            const wallet = await selector.wallet();

            // If no currencyInfo provided, assume native NEAR transfer
            if (!currencyInfo || currencyInfo.token === 'NEAR') {
                // Native NEAR transfer
                const amountInYocto = utils.format.parseNearAmount(amount.toString());

                const result = await wallet.signAndSendTransaction({
                    signerId: accountId,
                    receiverId: receiverId,
                    actions: [
                        {
                            type: 'Transfer',
                            params: {
                                deposit: amountInYocto,
                            },
                        },
                    ],
                });

                return result;
            } else {
                // Fungible token transfer
                const amountConverted = convertAmount(amount, currencyInfo.decimals);

                console.log(`Transferring ${amount} ${currencyInfo.token} (${amountConverted} base units) to ${receiverId}`);
                console.log(`Using contract: ${currencyInfo.contract}`);

                const result = await wallet.signAndSendTransaction({
                    signerId: accountId,
                    receiverId: currencyInfo.contract, // Token contract address
                    actions: [
                        {
                            type: 'FunctionCall',
                            params: {
                                methodName: 'ft_transfer',
                                args: {
                                    receiver_id: receiverId,
                                    amount: amountConverted,
                                    memo: `Transfer ${amount} ${currencyInfo.token} via wallet interface`
                                },
                                gas: '30000000000000', // 30 TGas
                                deposit: '1', // 1 yoctoNEAR for security
                            },
                        },
                    ],
                });

                return result;
            }
        } catch (error) {
            console.error('Transaction failed:', error);

            // Provide more specific error messages
            if (error.message.includes('insufficient')) {
                throw new Error(`Insufficient ${currencyInfo?.token || 'NEAR'} balance or allowance`);
            } else if (error.message.includes('gas')) {
                throw new Error('Transaction failed due to gas limit. Please try again.');
            } else {
                throw error;
            }
        }
    };

    const sendContractTransaction = async (contractId, methodName, args, gas = '30000000000000', deposit = '0') => {
        if (!selector || !accountId) {
            throw new Error('Wallet not connected');
        }

        try {
            const wallet = await selector.wallet();

            const result = await wallet.signAndSendTransaction({
                signerId: accountId,
                receiverId: contractId,
                actions: [
                    {
                        type: 'FunctionCall',
                        params: {
                            methodName: methodName,
                            args: args,
                            gas: gas,
                            deposit: deposit,
                        },
                    },
                ],
            });

            return result;
        } catch (error) {
            console.error('Contract transaction failed:', error);
            throw error;
        }
    };

    const signMessage = async (message, bufferNonce) => {
        if (!selector || !accountId) {
            throw new Error('Wallet not connected');
        }

        try {
            const wallet = await selector.wallet();

            // Pass the message as a string, not as bytes
            // The wallet selector will handle the conversion internally
            const signature = await wallet.signMessage({
                message: message, // Keep as string
                recipient: accountId,
                nonce: Buffer.from(bufferNonce, 'hex'),
                callbackUrl: 'https://www.google.com/'
            });
            console.log(signature, 'signMessagesignMessagesignMessage');

            return signature;
        } catch (error) {
            console.error('Message signing failed:', error);
            throw error;
        }
    };

    const getBalance = async (accountId) => {
        if (!accountId) return null;

        try {
            const provider = new providers.JsonRpcProvider({
                url: NETWORK_ID === 'mainnet'
                    ? 'https://rpc.mainnet.near.org'
                    : 'https://convincing-winter-sky.near-testnet.quiknode.pro/6da9a1620c12ff51aeaf0f190d8b27b0ea4b6665'
            });

            const account = await provider.query({
                request_type: 'view_account',
                finality: 'final',
                account_id: accountId,
            });

            return utils.format.formatNearAmount(account.amount, 2);
        } catch (error) {
            console.error('Failed to get balance:', error);
            return null;
        }
    };

    // New function to get fungible token balance
    const getTokenBalance = async (accountId, tokenContract, decimals = 24) => {
        if (!accountId || !tokenContract) return null;

        try {
            const provider = new providers.JsonRpcProvider({
                url: NETWORK_ID === 'mainnet'
                    ? 'https://rpc.mainnet.near.org'
                    : 'https://convincing-winter-sky.near-testnet.quiknode.pro/6da9a1620c12ff51aeaf0f190d8b27b0ea4b6665'
            });

            const result = await provider.query({
                request_type: 'call_function',
                finality: 'final',
                account_id: tokenContract,
                method_name: 'ft_balance_of',
                args_base64: Buffer.from(JSON.stringify({
                    account_id: accountId
                })).toString('base64'),
            });

            const balance = JSON.parse(Buffer.from(result.result).toString());

            // Convert balance based on decimals
            if (decimals === 24) {
                return utils.format.formatNearAmount(balance, 2);
            } else {
                const balanceFloat = parseFloat(balance);
                const divisor = Math.pow(10, decimals);
                const formattedBalance = balanceFloat / divisor;
                return formattedBalance.toFixed(6);
            }
        } catch (error) {
            console.error('Failed to get token balance:', error);
            return null;
        }
    };

    const value = {
        selector,
        modal,
        accounts,
        accountId,
        loading,
        connectWallet,
        disconnectWallet,
        sendTransaction,
        sendContractTransaction,
        signMessage,
        getBalance,
        getTokenBalance,
        isConnected: !!accountId,
    };

    return (
        <NearWalletContext.Provider value={value}>
            {children}
        </NearWalletContext.Provider>
    );
};