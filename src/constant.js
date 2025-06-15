export const styles = {
    container: {
        padding: '32px 24px',
        maxWidth: '800px',
        margin: '0 auto',
        backgroundColor: '#000000',
        color: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        minHeight: '100vh'
    },
    title: {
        textAlign: 'center',
        marginBottom: '48px',
        fontSize: '32px',
        fontWeight: '700',
        letterSpacing: '-0.025em',
        background: 'linear-gradient(135deg, #ffffff 0%, #a0a0a0 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
    },
    connectContainer: {
        textAlign: 'center',
        marginBottom: '48px'
    },
    connectButton: {
        background: 'linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%)',
        color: '#000000',
        border: 'none',
        padding: '16px 32px',
        borderRadius: '12px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 16px rgba(255, 255, 255, 0.1)',
        ':hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 24px rgba(255, 255, 255, 0.15)'
        }
    },
    card: {
        background: 'linear-gradient(145deg, #1a1a1a 0%, #0d0d0d 100%)',
        border: '1px solid #333333',
        borderRadius: '16px',
        padding: '32px',
        marginBottom: '32px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(10px)'
    },
    cardTitle: {
        fontSize: '24px',
        fontWeight: '700',
        marginBottom: '24px',
        color: '#ffffff',
        letterSpacing: '-0.025em'
    },
    infoRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        padding: '12px 0',
        borderBottom: '1px solid #333333'
    },
    label: {
        fontSize: '14px',
        fontWeight: '500',
        color: '#a0a0a0',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
    },
    value: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#ffffff',
        fontFamily: 'Monaco, "Cascadia Code", "Roboto Mono", monospace'
    },
    disconnectButton: {
        background: 'transparent',
        color: '#ff4444',
        border: '1px solid #ff4444',
        padding: '8px 16px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        marginTop: '16px'
    },
    amountSelector: {
        marginBottom: '32px'
    },
    selectorLabel: {
        display: 'block',
        marginBottom: '16px',
        fontSize: '16px',
        fontWeight: '600',
        color: '#ffffff'
    },
    selectorContainer: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '20px',
        background: '#1a1a1a',
        borderRadius: '12px',
        border: '1px solid #333333'
    },
    selectorButton: {
        background: '#333333',
        color: '#ffffff',
        border: 'none',
        width: '48px',
        height: '48px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '20px',
        fontWeight: '700',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    amountDisplay: {
        minWidth: '80px',
        textAlign: 'center',
        fontSize: '24px',
        fontWeight: '700',
        color: '#ffffff',
        padding: '12px 20px',
        background: '#000000',
        border: '2px solid #ffffff',
        borderRadius: '8px'
    },
    depositDetails: {
        background: '#0d0d0d',
        padding: '24px',
        borderRadius: '12px',
        marginBottom: '32px',
        border: '1px solid #333333'
    },
    depositTitle: {
        fontSize: '18px',
        fontWeight: '600',
        marginBottom: '20px',
        color: '#ffffff'
    },
    depositItem: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '12px',
        padding: '8px 0',
        borderBottom: '1px solid #2a2a2a'
    },
    inputGroup: {
        marginBottom: '24px'
    },
    inputLabel: {
        display: 'block',
        marginBottom: '8px',
        fontSize: '14px',
        fontWeight: '500',
        color: '#a0a0a0'
    },
    input: {
        width: '100%',
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid #333333',
        background: '#1a1a1a',
        color: '#ffffff',
        fontSize: '16px',
        fontFamily: 'Monaco, "Cascadia Code", "Roboto Mono", monospace',
        transition: 'all 0.3s ease'
    },
    buttonPrimary: {
        background: 'linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%)',
        color: '#000000',
        border: 'none',
        padding: '16px 24px',
        borderRadius: '8px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        width: '100%',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 16px rgba(255, 255, 255, 0.1)'
    },
    buttonSecondary: {
        background: 'transparent',
        color: '#ffffff',
        border: '1px solid #ffffff',
        padding: '16px 24px',
        borderRadius: '8px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        flex: '1',
        transition: 'all 0.3s ease'
    },
    buttonSuccess: {
        background: 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)',
        color: '#000000',
        border: 'none',
        padding: '16px 24px',
        borderRadius: '8px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        flex: '1',
        transition: 'all 0.3s ease'
    },
    buttonGroup: {
        display: 'flex',
        gap: '16px'
    },
    successAlert: {
        marginTop: '24px',
        padding: '20px',
        background: 'linear-gradient(135deg, #00ff8820 0%, #00cc6a20 100%)',
        border: '1px solid #00ff88',
        borderRadius: '12px',
        color: '#ffffff'
    },
    alertTitle: {
        fontWeight: '700',
        marginBottom: '12px',
        color: '#00ff88'
    },
    codeBlock: {
        background: '#0d0d0d',
        padding: '16px',
        borderRadius: '8px',
        fontSize: '12px',
        fontFamily: 'Monaco, "Cascadia Code", "Roboto Mono", monospace',
        overflow: 'auto',
        border: '1px solid #333333',
        color: '#a0a0a0'
    },
    loadingSpinner: {
        display: 'inline-block',
        width: '16px',
        height: '16px',
        border: '2px solid #333333',
        borderTop: '2px solid #ffffff',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginRight: '8px'
    },
    description: {
        color: '#a0a0a0',
        marginBottom: '24px',
        fontSize: '14px',
        lineHeight: '1.6'
    }
};