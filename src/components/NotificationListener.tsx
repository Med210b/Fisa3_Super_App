import { useEffect, useRef } from 'react';
import { useAuth } from '../services/auth';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';

export default function NotificationListener() {
  const { user } = useAuth();
  const lastStatuses = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!user) {
      lastStatuses.current = {};
      return;
    }

    const q = query(
      collection(db, 'orders'),
      where('customerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const orderData = change.doc.data();
        const orderId = change.doc.id;
        const currentStatus = orderData.status;
        const previousStatus = lastStatuses.current[orderId];

        if (change.type === 'modified' && previousStatus !== currentStatus) {
          // Status has changed
          if (currentStatus === 'ACCEPTED_BY_STORE') {
            toast.success('Commande Confirmée ! ✅', {
              description: `Le restaurant ${orderData.storeName || ''} a accepté votre commande et commence la préparation.`,
              duration: 5000,
            });
            playNotificationSound();
          } else if (currentStatus === 'PREPARING') {
            toast.success('Le restaurant prépare votre commande ! 🍳', {
              description: `Votre commande #${orderId.slice(-6).toUpperCase()} est en cours de préparation.`,
              duration: 5000,
            });
            playNotificationSound();
          } else if (currentStatus === 'PICKED_UP') {
            toast.info('Votre commande a été récupérée ! 🛵', {
              description: `Le livreur ${orderData.riderName || ''} a récupéré votre commande.`,
              duration: 5000,
            });
            playNotificationSound();
          } else if (currentStatus === 'ON_THE_WAY') {
            toast.info('Votre commande est en route ! 🛵', {
              description: `Le livreur est en chemin vers votre adresse.`,
              duration: 5000,
            });
            playNotificationSound();
          } else if (currentStatus === 'DELIVERED') {
            toast.success('Commande livrée ! 🎉', {
              description: 'Bon appétit !',
              duration: 5000,
            });
            playNotificationSound();
          }
        }

        // Update last known status
        lastStatuses.current[orderId] = currentStatus;
      });

      // Initialize statuses on first run if needed
      if (Object.keys(lastStatuses.current).length === 0) {
        snapshot.docs.forEach(doc => {
          lastStatuses.current[doc.id] = doc.data().status;
        });
      }
    });

    return () => unsubscribe();
  }, [user]);

  const playNotificationSound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.volume = 0.4;
      audio.play().catch(() => {
          // Ignore audio play errors (e.g. if user hasn't interacted with the page)
      });
    } catch (e) {}
  };

  return null;
}
