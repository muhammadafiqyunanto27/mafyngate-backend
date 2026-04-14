const prisma = require('../../config/db');
const webpush = require('web-push');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:example@yourdomain.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn('[Push] VAPID keys not configured. Push notifications will be disabled.');
}

class PushController {
  async subscribe(req, res, next) {
    try {
      const { subscription } = req.body;
      const userId = req.user.id.toString();

      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ success: false, message: 'Subscription data required' });
      }

      // Store or update subscription
      await prisma.pushSubscription.upsert({
        where: { endpoint: subscription.endpoint },
        update: {
          userId,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        create: {
          userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      });

      res.status(201).json({ success: true, message: 'Successfully subscribed to push notifications' });
    } catch (error) {
      next(error);
    }
  }

  async unsubscribe(req, res, next) {
    try {
      const { endpoint } = req.body;
      if (!endpoint) return res.status(400).json({ success: false, message: 'Endpoint required' });

      await prisma.pushSubscription.delete({
        where: { endpoint },
      });

      res.status(200).json({ success: true, message: 'Unsubscribed successfully' });
    } catch (error) {
      next(error);
    }
  }

  // Utility to send push to a user
  static async sendToUser(userId, payload) {
    try {
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId: userId.toString() },
      });

      const notifications = subscriptions.map(sub => {
        const pushConfig = {
          endpoint: sub.endpoint,
          keys: {
            auth: sub.auth,
            p256dh: sub.p256dh,
          },
        };

        return webpush.sendNotification(pushConfig, JSON.stringify(payload))
          .catch(async (err) => {
            // 404/410: Expired/Gone, 401/403: Invalid/Mismatched credentials
            if ([401, 403, 404, 410].includes(err.statusCode)) {
              console.log(`[Push] Removing invalid subscription (${err.statusCode}): ${sub.endpoint}`);
              await prisma.pushSubscription.delete({ where: { id: sub.id } });
            } else {
              console.error(`[Push] Error sending to ${sub.endpoint}:`, err);
            }
          });
      });

      await Promise.all(notifications);
    } catch (err) {
      console.error('[Push] sendToUser error:', err);
    }
  }
}

module.exports = PushController;
