import {
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  type DatabaseReference,
} from 'firebase/database';
import { rtdb } from './firebase';

export type ContactPresence = {
  online: boolean;
  available: boolean;
  lastSeen: number | null;
};

export function startPresence(
  uid: string,
  onConnectionChange?: (connected: boolean) => void,
): () => void {
  const database = rtdb;
  if (!database) return () => {};

  const connectedRef = ref(database, '.info/connected');
  let connectionRef: DatabaseReference | null = null;
  let disposed = false;

  const unsubscribe = onValue(
    connectedRef,
    snapshot => {
      const connected = snapshot.val() === true;
      onConnectionChange?.(connected);

      if (!connected) {
        connectionRef = null;
        return;
      }

      if (connectionRef) return;

      const newConnectionRef = push(ref(database, `presence/${uid}/connections`));
      connectionRef = newConnectionRef;

      void (async () => {
        try {
          await onDisconnect(newConnectionRef).remove();

          // Record the real server time when this device disconnects.
          await onDisconnect(
            ref(database, `presence/${uid}/lastSeen`),
          ).set(serverTimestamp());

          if (disposed) {
            await remove(newConnectionRef);
            return;
          }

          await set(newConnectionRef, {
            connectedAt: serverTimestamp(),
          });
        } catch (error) {
          if (connectionRef === newConnectionRef) {
            connectionRef = null;
          }
          console.error('PULSE presence connection failed:', error);
        }
      })();
    },
    error => {
      console.error('PULSE connection monitor failed:', error);
      onConnectionChange?.(false);
    },
  );

  return () => {
    disposed = true;
    unsubscribe();

    if (connectionRef) {
      const activeConnection = connectionRef;
      connectionRef = null;
      void onDisconnect(activeConnection).cancel()
        .then(() => remove(activeConnection))
        .catch(error => {
          console.error('PULSE presence cleanup failed:', error);
        });
    }
  };
}

export async function setPresenceVisibility(
  uid: string,
  discoverable: boolean,
): Promise<void> {
  if (!rtdb) return;

  await set(
    ref(rtdb, `presence/${uid}/visibility`),
    discoverable ? 'public' : 'private',
  );
}

export function watchPresence(
  uid: string,
  onChange: (presence: ContactPresence) => void,
  onError?: (error: Error) => void,
): () => void {
  if (!rtdb) {
    onChange({ online: false, available: false, lastSeen: null });
    return () => {};
  }

  return onValue(
    ref(rtdb, `presence/${uid}`),
    snapshot => {
      const connections = snapshot.child('connections');
      const lastSeenValue = snapshot.child('lastSeen').val();

      onChange({
        online: connections.exists() && connections.hasChildren(),
        available: true,
        lastSeen: typeof lastSeenValue === 'number' ? lastSeenValue : null,
      });
    },
    error => {
      onChange({ online: false, available: false, lastSeen: null });
      onError?.(error);
    },
  );
}
