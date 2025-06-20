import React, { useState } from 'react';
import * as borsh from 'borsh';
import { PublicKey } from '@near-js/crypto';
import js_sha256 from 'js-sha256';
import { styles_verify } from '@/constant';

// Payload class for borsh serialization
class Payload {
    constructor({ message, nonce, recipient, callbackUrl }) {
        this.tag = 2147484061;
        this.message = message;
        this.nonce = nonce;
        this.recipient = recipient;
        if (callbackUrl) {
            this.callbackUrl = callbackUrl;
        }
    }
}

// Borsh schema for payload serialization
const payloadSchema = {
    struct: {
        tag: 'u32',
        message: 'string',
        nonce: { array: { type: 'u8', len: 32 } },
        recipient: 'string',
        callbackUrl: { option: 'string' }
    }
};

const SignatureVerificationComponent = ({ signResult, accountId, networkId }) => {
    const [verificationStatus, setVerificationStatus] = useState(null);
    const [verificationDetails, setVerificationDetails] = useState(null);
    const [isVerifying, setIsVerifying] = useState(false);

    // Get RPC URL based on network
    const getRpcUrl = () => {
        return networkId === 'mainnet'
            ? 'https://rpc.mainnet.near.org'
            : 'https://test.rpc.fastnear.com';
    };

    // Fetch all user keys from RPC
    const fetchAllUserKeys = async (accountId) => {
        try {
            const response = await fetch(getRpcUrl(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'query',
                    params: [`access_key/${accountId}`, ''],
                    id: 1
                })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching user keys:', error);
            return null;
        }
    };

    // Verify that the public key belongs to the user and is a Full Access Key
    const verifyFullKeyBelongsToUser = async (publicKey, accountId) => {
        const data = await fetchAllUserKeys(accountId);

        if (!data || !data.result || !data.result.keys) {
            return { belongs: false, reason: 'No keys found for account' };
        }

        for (const key of data.result.keys) {
            if (key.public_key === publicKey) {
                const isFullAccess = key.access_key.permission === 'FullAccess';
                return {
                    belongs: true,
                    isFullAccess,
                    reason: isFullAccess
                        ? 'Key found and is Full Access'
                        : 'Key found but is not Full Access'
                };
            }
        }

        return { belongs: false, reason: 'Public key not found in account keys' };
    };

    // Verify the signature
    const verifySignature = ({ publicKey, signature, message, recipient, nonce }) => {
        try {
            // Convert hex nonce to Uint8Array
            const nonceArray = new Uint8Array(Buffer.from(nonce, 'hex'));

            // Reconstruct the payload
            const payload = new Payload({
                message,
                recipient,
                nonce: nonceArray,
                callbackUrl: undefined // Add if needed
            });

            // Serialize the payload
            const serialized = borsh.serialize(payloadSchema, payload);

            // Hash the serialized payload
            const toSign = Uint8Array.from(js_sha256.sha256.array(serialized));

            // Reconstruct the signature from base64
            const realSignature = Buffer.from(signature, 'base64');

            // Create public key instance and verify
            const publicKeyInstance = PublicKey.from(publicKey);
            return publicKeyInstance.verify(toSign, realSignature);
        } catch (error) {
            console.error('Signature verification error:', error);
            return false;
        }
    };

    // Main authentication function
    const authenticate = async () => {
        if (!signResult || !signResult.signature) {
            setVerificationStatus('error');
            setVerificationDetails({ error: 'No signature data available' });
            return;
        }

        setIsVerifying(true);
        setVerificationStatus(null);
        setVerificationDetails(null);

        try {
            const { signature, message, currencies } = signResult;
            const { signature: sig, publicKey, accountId: signedAccountId } = signature;

            // Get the raw nonce from currencies
            const nonce = currencies.rawNonce;
            const recipient = signedAccountId || accountId;

            // Step 1: Verify the signature
            const validSignature = verifySignature({
                publicKey,
                signature: sig,
                message : message,
                recipient,
                nonce
            });
console.log('signResult', signResult, 'validSignature', validSignature, 'publicKey', publicKey, 'recipient', recipient, 'nonce', nonce);

            // Step 2: Verify the key belongs to the user and is Full Access
            const keyVerification = await verifyFullKeyBelongsToUser(publicKey, recipient);

            // Determine overall authentication status
            const isAuthenticated = validSignature && keyVerification.belongs && keyVerification.isFullAccess;

            setVerificationStatus(isAuthenticated ? 'success' : 'failed');
            setVerificationDetails({
                signatureValid: validSignature,
                keyBelongsToUser: keyVerification.belongs,
                isFullAccessKey: keyVerification.isFullAccess,
                keyVerificationReason: keyVerification.reason,
                overallAuthentication: isAuthenticated,
                verifiedAt: new Date().toISOString(),
                accountId: recipient,
                publicKey
            });
        } catch (error) {
            console.error('Authentication error:', error);
            setVerificationStatus('error');
            setVerificationDetails({
                error: error.message,
                stack: error.stack
            });
        } finally {
            setIsVerifying(false);
        }
    };

    // Styles
  

    return (
        <div style={styles_verify.container}>
            <style jsx>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>

            <h4 style={styles_verify.title}>Signature Verification</h4>

            <button
                onClick={authenticate}
                disabled={isVerifying || !signResult}
                style={{
                    ...styles_verify.button,
                    ...(isVerifying || !signResult ? styles_verify.buttonDisabled : {})
                }}
            >
                {isVerifying && <div style={styles_verify.loadingSpinner}></div>}
                {isVerifying ? 'Verifying...' : 'Verify Signature'}
            </button>

            {verificationStatus && verificationDetails && (
                <div
                    style={{
                        ...styles_verify.resultContainer,
                        ...(verificationStatus === 'success'
                            ? styles_verify.successContainer
                            : verificationStatus === 'failed'
                                ? styles_verify.failedContainer
                                : styles_verify.errorContainer)
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                        <span style={styles_verify.statusIcon}>
                            {verificationStatus === 'success' ? '✅' : verificationStatus === 'failed' ? '❌' : '⚠️'}
                        </span>
                        <strong>
                            {verificationStatus === 'success'
                                ? 'Signature Verified & Authenticated!'
                                : verificationStatus === 'failed'
                                    ? 'Verification Failed'
                                    : 'Verification Error'}
                        </strong>
                    </div>

                    {verificationStatus !== 'error' && (
                        <div style={styles_verify.detailsGrid}>
                            <div style={styles_verify.detailItem}>
                                <span style={styles_verify.detailLabel}>Signature Valid</span>
                                <span style={styles_verify.detailValue}>
                                    {verificationDetails.signatureValid ? (
                                        <span style={styles_verify.checkmark}>✓ Yes</span>
                                    ) : (
                                        <span style={styles_verify.cross}>✗ No</span>
                                    )}
                                </span>
                            </div>

                            <div style={styles_verify.detailItem}>
                                <span style={styles_verify.detailLabel}>Key Belongs to User</span>
                                <span style={styles_verify.detailValue}>
                                    {verificationDetails.keyBelongsToUser ? (
                                        <span style={styles_verify.checkmark}>✓ Yes</span>
                                    ) : (
                                        <span style={styles_verify.cross}>✗ No</span>
                                    )}
                                </span>
                            </div>

                            <div style={styles_verify.detailItem}>
                                <span style={styles_verify.detailLabel}>Full Access Key</span>
                                <span style={styles_verify.detailValue}>
                                    {verificationDetails.isFullAccessKey ? (
                                        <span style={styles_verify.checkmark}>✓ Yes</span>
                                    ) : (
                                        <span style={styles_verify.cross}>✗ No</span>
                                    )}
                                </span>
                            </div>

                            <div style={styles_verify.detailItem}>
                                <span style={styles_verify.detailLabel}>Overall Authentication</span>
                                <span style={styles_verify.detailValue}>
                                    {verificationDetails.overallAuthentication ? (
                                        <span style={styles_verify.checkmark}>✓ Passed</span>
                                    ) : (
                                        <span style={styles_verify.cross}>✗ Failed</span>
                                    )}
                                </span>
                            </div>
                        </div>
                    )}

                    {verificationDetails.error && (
                        <div style={{ marginTop: '12px' }}>
                            <div style={styles_verify.label}>Error Details:</div>
                            <div style={{ ...styles_verify.value, color: '#ef4444' }}>
                                {verificationDetails.error}
                            </div>
                        </div>
                    )}

                    {verificationDetails.keyVerificationReason && (
                        <div style={{ marginTop: '12px', fontSize: '12px', color: '#888' }}>
                            Note: {verificationDetails.keyVerificationReason}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SignatureVerificationComponent;