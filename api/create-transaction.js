const admin = require('firebase-admin');

// Khởi tạo Firebase
let app;
if (!admin.apps.length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : null;

    if (serviceAccount) {
        app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: 'https://nuoidev-default-rtdb.asia-southeast1.firebasedatabase.app'
        });
    } else {
        app = admin.initializeApp({ projectId: 'nuoidev' });
    }
}

const db = admin.firestore();

/**
 * Tạo pending transaction
 * POST /api/create-transaction
 * Body: { userId, coins, vnd, paymentCode }
 */
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { userId, coins, vnd, paymentCode } = req.body;

        if (!userId || !paymentCode) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Tạo pending transaction
        const pendingRef = await db.collection('pendingTransactions').add({
            userId,
            coins,
            vnd,
            paymentCode,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: admin.firestore.Timestamp.fromDate(
                new Date(Date.now() + 30 * 60 * 1000) // 30 phút
            ),
        });

        console.log(`📝 Created pending transaction: ${pendingRef.id}`);

        return res.status(200).json({
            success: true,
            transactionId: pendingRef.id,
            paymentCode
        });

    } catch (error) {
        console.error('Error creating transaction:', error);
        return res.status(500).json({ error: error.message });
    }
};
