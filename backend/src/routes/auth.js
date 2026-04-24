const { Router } = require('express');
const auth = require('../middleware/auth');
const { sendOtp, verifyOtp, setupPin, loginWithPin, getMe } = require('../controllers/authController');

const router = Router();

// POST /auth/send-otp  — request an SMS OTP
router.post('/send-otp', sendOtp);

// POST /auth/verify-otp  — validate OTP, get session token
router.post('/verify-otp', verifyOtp);

// POST /auth/setup-pin  — first-time PIN creation (protected)
router.post('/setup-pin', auth, setupPin);

// POST /auth/login-pin  — PIN-based login for returning crew
router.post('/login-pin', loginWithPin);

// GET /auth/me  — return current crew member (protected)
router.get('/me', auth, getMe);

module.exports = router;
