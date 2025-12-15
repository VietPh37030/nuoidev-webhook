const admin = require('firebase-admin');

// Khởi tạo Firebase Admin với service account
// Trong Vercel, set biến môi trường FIREBASE_SERVICE_ACCOUNT
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
        // Fallback cho development
        app = admin.initializeApp({
            projectId: 'nuoidev'
        });
    }
}

const db = admin.firestore();

/**
 * SePay Webhook Handler
 * URL: https://your-vercel-app.vercel.app/api/sepay-webhook
 */
module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const data = req.body;
        console.log('📥 SePay webhook received:', JSON.stringify(data));

        // Lấy thông tin từ SePay
        const {
            transferAmount,  // Số tiền chuyển (VND)
            content,         // Nội dung chuyển khoản
            code,            // Mã thanh toán được SePay nhận diện
            transactionDate, // Thời gian giao dịch
            referenceCode,   // Mã tham chiếu
            accountNumber,   // Số tài khoản nhận
        } = data;

        // Kiểm tra có mã thanh toán không
        if (!code || !code.startsWith('NUOIDEV')) {
            console.log('❌ Invalid payment code:', code);
            return res.status(200).json({
                success: false,
                message: 'Invalid payment code'
            });
        }

        const paymentCode = code;

        // Tính số coins (1,000 VND = 1 coin)
        const amount = parseInt(transferAmount) || 0;
        const coins = Math.floor(amount / 1000);

        if (coins <= 0) {
            console.log('❌ Invalid amount:', amount);
            return res.status(200).json({
                success: false,
                message: 'Invalid amount'
            });
        }

        // Tìm pending transaction trong Firestore
        const pendingRef = db.collection('pendingTransactions');
        const pendingQuery = await pendingRef
            .where('paymentCode', '==', paymentCode)
            .where('status', '==', 'pending')
            .limit(1)
            .get();

        let userId = null;
        let transactionDoc = null;

        if (!pendingQuery.empty) {
            // Tìm thấy pending transaction
            transactionDoc = pendingQuery.docs[0];
            userId = transactionDoc.data().userId;
            console.log('✅ Found pending transaction for user:', userId);

            // Cập nhật pending transaction thành completed
            await transactionDoc.ref.update({
                status: 'completed',
                actualAmount: amount,
                actualCoins: coins,
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                sepayData: data,
            });

            // Cộng coins cho user
            const userRef = db.collection('users').doc(userId);
            await userRef.update({
                coins: admin.firestore.FieldValue.increment(coins),
                totalDonated: admin.firestore.FieldValue.increment(amount),
                lastDonation: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Ghi lại transaction history
            await db.collection('transactions').add({
                userId,
                type: 'topup',
                paymentCode,
                amount,
                coins,
                content,
                transactionDate,
                referenceCode,
                status: 'completed',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

        } else {
            // Anonymous donation
            console.log('⚠️ No pending transaction, recording as anonymous');
            await db.collection('donations').add({
                paymentCode,
                amount,
                coins,
                content,
                transactionDate,
                referenceCode,
                accountNumber,
                anonymous: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        // Cập nhật dev status
        const devStatusRef = db.collection('devStatus').doc('current');
        const devStatus = await devStatusRef.get();

        if (devStatus.exists) {
            await devStatusRef.update({
                totalCoins: admin.firestore.FieldValue.increment(coins),
                totalDonations: admin.firestore.FieldValue.increment(1),
                lastDonation: admin.firestore.FieldValue.serverTimestamp(),
            });
        } else {
            await devStatusRef.set({
                totalCoins: coins,
                totalDonations: 1,
                mood: 'hungry',
                lastDonation: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        console.log(`✅ SUCCESS: Credited ${coins} coins from ${amount} VND`);

        return res.status(200).json({
            success: true,
            message: 'Payment processed',
            userId,
            coins,
            amount
        });

    } catch (error) {
        console.error('❌ Webhook error:', error);
        return res.status(200).json({
            success: false,
            error: error.message
        });
    }
};
