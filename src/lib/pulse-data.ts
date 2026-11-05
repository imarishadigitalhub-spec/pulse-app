import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, storage } from './firebase';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';

export type PublicProfile = {
  uid: string;
  displayName: string;
  username: string;
  photoURL: string | null;
  bio: string;
  discoverable: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};


/**
 * Watches the authenticated member's real following relationships.
 * Following records are stored under users/{uid}/following/{targetUid}.
 */

export type FollowRelationship = {
  id: string;
  followerUid: string;
  followingUid: string;
  createdAt?: unknown;
};

export function watchFollowing(
  uid: string,
  callback: (uids: string[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(database(), 'followRelationships'),
    where('followerUid', '==', uid),
  );

  return onSnapshot(
    q,
    snapshot => callback(snapshot.docs.map(item => String(item.data().followingUid))),
    error => onError?.(error),
  );
}

export function watchFollowers(
  uid: string,
  callback: (uids: string[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(database(), 'followRelationships'),
    where('followingUid', '==', uid),
  );

  return onSnapshot(
    q,
    snapshot => callback(snapshot.docs.map(item => String(item.data().followerUid))),
    error => onError?.(error),
  );
}

export async function followMember(
  currentUid: string,
  targetUid: string,
): Promise<void> {
  if (!currentUid || !targetUid || currentUid === targetUid) {
    throw new Error('Choose another PULSE member to follow.');
  }

  const dbRef = database();
  const target = await getDoc(doc(dbRef, 'publicProfiles', targetUid));

  if (!target.exists() || target.data().discoverable !== true) {
    throw new Error('This member is not currently available to follow.');
  }

  await setDoc(
    doc(dbRef, 'followRelationships', `${currentUid}_${targetUid}`),
    {
      followerUid: currentUid,
      followingUid: targetUid,
      createdAt: serverTimestamp(),
    },
  );
}

export async function unfollowMember(
  currentUid: string,
  targetUid: string,
): Promise<void> {
  if (!currentUid || !targetUid || currentUid === targetUid) {
    throw new Error('This following relationship could not be verified.');
  }

  await deleteDoc(
    doc(database(), 'followRelationships', `${currentUid}_${targetUid}`),
  );
}

export async function updateOwnProfile(
  uid: string,
  values: {
    displayName: string;
    username: string;
    bio: string;
  },
): Promise<void> {
  const displayName = values.displayName.trim();
  const username = values.username.trim().replace(/^@/, '').toLowerCase();
  const bio = values.bio.trim();

  if (displayName.length < 2 || displayName.length > 60) {
    throw new Error('Display name must contain 2–60 characters.');
  }

  if (!/^[a-z0-9._]{3,30}$/.test(username)) {
    throw new Error('Username must be 3–30 characters using letters, numbers, dots or underscores.');
  }

  if (bio.length > 160) {
    throw new Error('Your bio cannot exceed 160 characters.');
  }

  const dbRef = database();

  await updateDoc(doc(dbRef, 'publicProfiles', uid), {
    displayName,
    username,
    bio,
    updatedAt: serverTimestamp(),
  });

  await setDoc(
    doc(dbRef, 'users', uid),
    { displayName, username, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export type PulseConversation = {
  id: string;
  participants: string[];
  type: 'direct';
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type PulseMessage = {
  id: string;
  senderId: string;
  text: string;
  type: 'text' | 'image' | 'video' | 'document';
  attachmentURL?: string;
  attachmentName?: string;
  attachmentPath?: string;
  attachmentContentType?: string;
  attachmentSize?: number;
  createdAt?: unknown;
};

export type PulsePost = {
  id: string;
  ownerUid: string;
  authorName: string;
  authorUsername: string;
  authorPhotoURL?: string;
  caption: string;
  postType: 'text' | 'image' | 'video';
  mediaURL?: string;
  mediaPath?: string;
  mediaType?: string;
  createdAt?: unknown;
  expiresAt?: unknown;
};

function database() {
  if (!db) {
    throw new Error('PULSE database is not configured. Check your Firebase environment variables.');
  }
  return db;
}

/**
 * Publishes a real Firebase user's profile.
 * Existing privacy settings and profile information are preserved.
 */
export async function publishUserProfile(user: User): Promise<void> {
  const profileRef = doc(database(), 'publicProfiles', user.uid);
  const existing = await getDoc(profileRef);
  const previous = existing.data();

  const displayName = (
    user.displayName ||
    previous?.displayName ||
    'PULSE member'
  ).trim();

  const username = (
    previous?.username ||
    user.email?.split('@')[0] ||
    user.uid.slice(0, 10)
  ).trim().replace(/^@/, '').toLowerCase();

  await setDoc(profileRef, {
    uid: user.uid,
    displayName,
    username,
    photoURL: user.photoURL ?? previous?.photoURL ?? null,
    bio: previous?.bio ?? '',
    discoverable:
      typeof previous?.discoverable === 'boolean'
        ? previous.discoverable
        : true,
    ...(existing.exists()
      ? {}
      : { createdAt: serverTimestamp() }),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await setDoc(doc(database(), 'users', user.uid), {
    displayName,
    username,
    email: user.email ?? null,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export function watchOwnProfile(
  uid: string,
  onProfile: (profile: PublicProfile | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(database(), 'publicProfiles', uid),
    snapshot => {
      onProfile(
        snapshot.exists()
          ? snapshot.data() as PublicProfile
          : null,
      );
    },
    error => onError?.(error),
  );
}

export function watchProfile(
  uid: string,
  onProfile: (profile: PublicProfile | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(database(), 'publicProfiles', uid),
    snapshot => {
      onProfile(
        snapshot.exists()
          ? snapshot.data() as PublicProfile
          : null,
      );
    },
    error => onError?.(error),
  );
}

export async function setDiscoverability(
  uid: string,
  discoverable: boolean,
): Promise<void> {
  await updateDoc(doc(database(), 'publicProfiles', uid), {
    discoverable,
    updatedAt: serverTimestamp(),
  });
}

export function watchDiscoverablePeople(
  currentUid: string,
  onPeople: (people: PublicProfile[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const peopleQuery = query(
    collection(database(), 'publicProfiles'),
    where('discoverable', '==', true),
  );

  return onSnapshot(
    peopleQuery,
    snapshot => {
      const people = snapshot.docs
        .map(item => item.data() as PublicProfile)
        .filter(person => person.uid !== currentUid)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

      onPeople(people);
    },
    error => onError?.(error),
  );
}

export function watchConversations(
  uid: string,
  onConversations: (items: PulseConversation[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const conversationsQuery = query(
    collection(database(), 'conversations'),
    where('participants', 'array-contains', uid),
  );

  return onSnapshot(
    conversationsQuery,
    snapshot => {
      const items = snapshot.docs.map(item => ({
        id: item.id,
        ...item.data(),
      }) as PulseConversation);

      items.sort((a, b) => {
        const time = (value: unknown) => {
          if (value && typeof value === 'object' && 'toMillis' in value) {
            const timestamp = value as { toMillis?: () => number };
            return typeof timestamp.toMillis === 'function'
              ? timestamp.toMillis()
              : 0;
          }
          return 0;
        };

        return time(b.updatedAt) - time(a.updatedAt);
      });

      onConversations(items);
    },
    error => onError?.(error),
  );
}

export function watchMessages(
  conversationId: string,
  onMessages: (items: PulseMessage[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const messagesQuery = query(
    collection(database(), 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'asc'),
  );

  return onSnapshot(
    messagesQuery,
    snapshot => {
      onMessages(snapshot.docs.map(item => ({
        id: item.id,
        ...item.data(),
      }) as PulseMessage));
    },
    error => onError?.(error),
  );
}

/**
 * Reuses an existing direct conversation.
 * It creates a document only when one does not already exist.
 */

/**
 * Watches the latest real message in a conversation.
 * Firestore rules restrict this read to conversation participants.
 */
export function watchLatestMessage(
  conversationId: string,
  onMessage: (message: PulseMessage | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const latestQuery = query(
    collection(database(), 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(1),
  );

  return onSnapshot(
    latestQuery,
    snapshot => {
      const latest = snapshot.docs[0];
      onMessage(
        latest
          ? ({ id: latest.id, ...latest.data() } as PulseMessage)
          : null,
      );
    },
    error => onError?.(error),
  );
}


export type PulseConversationPreference = {
  id: string;
  pinned?: boolean;
  lastReadAt?: unknown;
  updatedAt?: unknown;
};

/**
 * Private, per-member inbox preferences.
 * These records never modify shared conversation metadata.
 */
export function watchConversationPreferences(
  uid: string,
  onPreferences: (items: Record<string, PulseConversationPreference>) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(database(), 'users', uid, 'conversationPreferences'),
    snapshot => {
      const items: Record<string, PulseConversationPreference> = {};
      snapshot.docs.forEach(item => {
        items[item.id] = {
          id: item.id,
          ...item.data(),
        } as PulseConversationPreference;
      });
      onPreferences(items);
    },
    error => onError?.(error),
  );
}

export async function setConversationPinned(
  uid: string,
  conversationId: string,
  pinned: boolean,
): Promise<void> {
  await setDoc(
    doc(database(), 'users', uid, 'conversationPreferences', conversationId),
    { pinned, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function markConversationRead(
  uid: string,
  conversationId: string,
): Promise<void> {
  await setDoc(
    doc(database(), 'users', uid, 'conversationPreferences', conversationId),
    { lastReadAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function startDirectConversation(
  currentUid: string,
  otherUid: string,
): Promise<string> {
  if (!currentUid || !otherUid || currentUid === otherUid) {
    throw new Error('Choose another PULSE member to start a conversation.');
  }

  const participants = [currentUid, otherUid].sort();
  const conversationId = `direct_${participants.join('_')}`;
  const conversationRef = doc(database(), 'conversations', conversationId);

  await runTransaction(database(), async transaction => {
    const existing = await transaction.get(conversationRef);

    if (existing.exists()) {
      const data = existing.data();

      if (
        data.type !== 'direct' ||
        !Array.isArray(data.participants) ||
        !participants.every(uid => data.participants.includes(uid))
      ) {
        throw new Error('This conversation could not be verified.');
      }

      return;
    }

    transaction.set(conversationRef, {
      participants,
      type: 'direct',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return conversationId;
}

export async function sendTextMessage(
  conversationId: string,
  senderId: string,
  text: string,
): Promise<void> {
  const value = text.trim();

  if (!value) return;

  if (value.length > 5000) {
    throw new Error('Messages must be 5,000 characters or fewer.');
  }

  await addDoc(
    collection(database(), 'conversations', conversationId, 'messages'),
    {
      senderId,
      text: value,
      type: 'text',
      createdAt: serverTimestamp(),
    },
  );
}


/**
 * Upload a real conversation attachment and create its message record.
 * Storage rules must permit the conversationAttachments path before this works.
 */
export async function uploadConversationAttachment(
  conversationId: string,
  senderId: string,
  file: File,
  onProgress?: (percentage: number) => void,
): Promise<void> {
  if (!conversationId || !senderId) {
    throw new Error('Open a conversation before attaching a file.');
  }
  if (!storage) throw new Error('Firebase Storage is not configured.');

  const contentType = file.type || 'application/octet-stream';
  const isImage = contentType.startsWith('image/');
  const isVideo = contentType.startsWith('video/');
  const isDocument = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ].includes(contentType);

  if (!isImage && !isVideo && !isDocument) {
    throw new Error('Choose an image, video, PDF, Word, Excel or text document.');
  }

  const maxSize = isVideo ? 50 : 20;
  if (file.size > maxSize * 1024 * 1024) {
    throw new Error(`This file is too large. The limit is ${maxSize} MB.`);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'attachment';
  const path = `conversationAttachments/${conversationId}/${senderId}/${Date.now()}_${safeName}`;
  const fileRef = ref(storage, path);
  const task = uploadBytesResumable(fileRef, file, { contentType });

  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      snapshot => {
        const percentage = snapshot.totalBytes
          ? Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100)
          : 0;
        onProgress?.(percentage);
      },
      reject,
      resolve,
    );
  });

  const url = await getDownloadURL(task.snapshot.ref);
  const messageType = isImage ? 'image' : isVideo ? 'video' : 'document';

  await addDoc(
    collection(database(), 'conversations', conversationId, 'messages'),
    {
      senderId,
      text: file.name,
      type: messageType,
      attachmentURL: url,
      attachmentName: file.name,
      attachmentPath: path,
      attachmentContentType: contentType,
      attachmentSize: file.size,
      createdAt: serverTimestamp(),
    },
  );
}

/** Publish a real post owned by the signed-in member. */
export async function publishPost(
  uid: string,
  author: { displayName: string; username: string; photoURL?: string },
  caption: string,
  file: File | null,
  expiresAfter24Hours: boolean,
  onProgress?: (percentage: number) => void,
): Promise<void> {
  if (!uid) throw new Error('Sign in before publishing.');
  if (!storage && file) throw new Error('Firebase Storage is not configured.');

  const value = caption.trim();
  if (!value && !file) throw new Error('Write something or choose a photo or video.');
  if (value.length > 2200) throw new Error('Captions must be 2,200 characters or fewer.');

  let mediaURL: string | undefined;
  let mediaPath: string | undefined;
  let mediaType: string | undefined;
  let postType: 'text' | 'image' | 'video' = 'text';

  if (file) {
    mediaType = file.type;
    if (file.type.startsWith('image/')) {
      postType = 'image';
      if (file.size > 20 * 1024 * 1024) throw new Error('Images must be 20 MB or smaller.');
    } else if (file.type.startsWith('video/')) {
      postType = 'video';
      if (file.size > 100 * 1024 * 1024) throw new Error('Videos must be 100 MB or smaller.');
    } else {
      throw new Error('Create posts support photos and videos.');
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'media';
    mediaPath = `postMedia/${uid}/${Date.now()}_${safeName}`;
    const task = uploadBytesResumable(ref(storage!, mediaPath), file, {
      contentType: file.type,
    });

    await new Promise<void>((resolve, reject) => {
      task.on(
        'state_changed',
        snapshot => {
          const percentage = snapshot.totalBytes
            ? Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100)
            : 0;
          onProgress?.(percentage);
        },
        reject,
        resolve,
      );
    });

    mediaURL = await getDownloadURL(task.snapshot.ref);
  }

  await addDoc(collection(database(), 'posts'), {
    ownerUid: uid,
    authorName: author.displayName,
    authorUsername: author.username,
    authorPhotoURL: author.photoURL || '',
    caption: value,
    postType,
    ...(mediaURL ? { mediaURL, mediaPath, mediaType } : {}),
    createdAt: serverTimestamp(),
    expiresAt: expiresAfter24Hours
      ? Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000))
      : null,
  });
}

/** Live Explore feed. Expired temporary posts are filtered by the client. */
export function watchExplorePosts(
  onPosts: (items: PulsePost[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const postsQuery = query(
    collection(database(), 'posts'),
    orderBy('createdAt', 'desc'),
    limit(50),
  );

  return onSnapshot(
    postsQuery,
    snapshot => {
      onPosts(snapshot.docs.map(item => ({
        id: item.id,
        ...item.data(),
      }) as PulsePost));
    },
    error => onError?.(error),
  );
}

/**
 * Upload or replace the signed-in member's profile photo.
 * The returned URL is saved in the public profile and private user record.
 */
export async function uploadProfilePhoto(
  uid: string,
  file: File,
  onProgress?: (percentage: number) => void,
): Promise<string> {
  if (!uid) throw new Error('Sign in before uploading a profile photo.');
  if (!storage) throw new Error('Firebase Storage is not configured.');

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPG, PNG or WebP image.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Profile photos must be 5 MB or smaller.');
  }

  const photoRef = ref(storage, `profilePhotos/${uid}/avatar`);
  const task = uploadBytesResumable(photoRef, file, {
    contentType: file.type,
  });

  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      snapshot => {
        const percentage = snapshot.totalBytes
          ? Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100)
          : 0;
        onProgress?.(percentage);
      },
      reject,
      resolve,
    );
  });

  const photoURL = await getDownloadURL(task.snapshot.ref);

  await updateDoc(doc(database(), 'publicProfiles', uid), {
    photoURL,
    updatedAt: serverTimestamp(),
  });

  await setDoc(
    doc(database(), 'users', uid),
    { photoURL, updatedAt: serverTimestamp() },
    { merge: true },
  );

  return photoURL;
}

/** Remove the signed-in member's profile photo. */
export async function removeProfilePhoto(uid: string): Promise<void> {
  if (!uid) throw new Error('Sign in before changing your profile photo.');
  if (!storage) throw new Error('Firebase Storage is not configured.');

  const photoRef = ref(storage, `profilePhotos/${uid}/avatar`);

  try {
    await deleteObject(photoRef);
  } catch (error) {
    if ((error as { code?: string })?.code !== 'storage/object-not-found') {
      throw error;
    }
  }

  await updateDoc(doc(database(), 'publicProfiles', uid), {
    photoURL: null,
    updatedAt: serverTimestamp(),
  });

  await setDoc(
    doc(database(), 'users', uid),
    { photoURL: null, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

