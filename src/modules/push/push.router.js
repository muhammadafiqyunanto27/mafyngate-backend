const express = require('express');
const router = express.Router();
const PushController = require('./push.controller');
const authMiddleware = require('../../middleware/auth.middleware');

const pushController = new PushController();

router.post('/subscribe', authMiddleware, pushController.subscribe);
router.post('/unsubscribe', authMiddleware, pushController.unsubscribe);

module.exports = router;
