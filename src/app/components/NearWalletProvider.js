'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { setupWalletSelector } from '@near-wallet-selector/core';
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet';
import { setupHereWallet } from '@near-wallet-selector/here-wallet';
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet';
import { setupModal } from '@near-wallet-selector/modal-ui';
import { providers, utils } from 'near-api-js';
import BN from 'bn.js';

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

    const NETWORK_ID = process.env.NEXT_PUBLIC_NETWORK_ID ; // Change to 'mainnet' for production
    // const CONTRACT_ID = process.env.NEXT_PUBLIC_MPC_CONTRACT ; // Example contract

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
                    // contractId: CONTRACT_ID,
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
    };

    const sendTransaction = async (receiverId, amount) => {
        if (!selector || !accountId) {
            throw new Error('Wallet not connected');
        }

        try {
            const wallet = await selector.wallet();

            // Convert amount to yoctoNEAR (1 NEAR = 10^24 yoctoNEAR)
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
        } catch (error) {
            console.error('Transaction failed:', error);
            throw error;
        }
    };

    // const signMessage = async (message) => {
    //     if (!selector || !accountId) {
    //         throw new Error('Wallet not connected');
    //     }

    //     try {
    //         const wallet = await selector.wallet();

    //         // Convert message to bytes
    //         const messageBytes = new TextEncoder().encode(message);

    //         // Sign the message
    //         const signature = await wallet.signMessage({
    //             message: messageBytes,
    //             recipient: accountId,
    //             nonce: Buffer.from(crypto.getRandomValues(new Uint8Array(32))),
    //         });

    //         return signature;
    //     } catch (error) {
    //         console.error('Message signing failed:', error);
    //         throw error;
    //     }
    // };
    const signMessage = async (message) => {
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
                nonce: Buffer.from(crypto.getRandomValues(new Uint8Array(32))),
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

    const value = {
        selector,
        modal,
        accounts,
        accountId,
        loading,
        connectWallet,
        disconnectWallet,
        sendTransaction,
        signMessage,
        getBalance,
        isConnected: !!accountId,
    };

    return (
        <NearWalletContext.Provider value={value}>
            {children}
        </NearWalletContext.Provider>
    );
};