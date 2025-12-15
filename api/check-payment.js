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
 * Kiểm tra trạng thái thanh toán
 * GET /api/check-payment?code=NUOIDEV123456
 */
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { code } = req.query;

        if (!code) {
            return res.status(400).json({ error: 'Missing payment code' });
        }

        // Tìm transaction
        const pendingRef = db.collection('pendingTransactions');
        const query = await pendingRef
            .where('paymentCode', '==', code)
            .limit(1)
            .get();

        if (query.empty) {
            return res.status(200).json({ status: 'not_found' });
        }

        const transaction = query.docs[0].data();

        return res.status(200).json({
            status: transaction.status,
            coins: transaction.actualCoins || transaction.coins,
            completedAt: transaction.completedAt?.toDate() || null
        });

    } catch (error) {
        console.error('Error checking payment:', error);
        return res.status(500).json({ error: error.message });
    }
};
