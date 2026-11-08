import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  PlusSquare,
  Pin,
  Plus,
  Compass,
  Camera,
  ChevronDown,
  Settings,
  Trash2,
  LogOut,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  Phone,
  Video,
  Palette,
  X,
} from 'lucide-react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { startPresence, setPresenceVisibility, watchPresence, type ContactPresence } from './lib/pulse-presence';
import {
  publishUserProfile,
  uploadProfilePhoto,
  removeProfilePhoto,
  setDiscoverability,
  watchFollowing,
  watchFollowers,
  followMember,
  unfollowMember,
  updateOwnProfile,
  sendTextMessage,
  uploadConversationAttachment,
  publishPost,
  watchExplorePosts,
  startDirectConversation,
  watchConversations,
  watchDiscoverablePeople,
  watchMessages,
  watchLatestMessage,
  watchConversationPreferences,
  setConversationPinned,
  setConversationAppearance,
  uploadConversationWallpaper,
  removeConversationWallpaper,
  markConversationRead,
  watchOwnProfile,
  watchProfile,
  type PublicProfile,
  type PulseConversation,
  type PulseMessage,
  type PulsePost,
  type PulseConversationPreference,
  type PulseConversationAppearance,
} from './lib/pulse-data';


type Tab = 'Chats' | 'Explore' | 'Create' | 'Activity' | 'Profile';

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0] || '')
    .join('')
    .toUpperCase() || 'P';
}

function Avatar({
  name,
  photoURL,
  small = false,
}: {
  name: string;
  photoURL?: string | null;
  small?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [photoURL]);

  return (
    <div className={`pulse-avatar ${small ? 'small' : ''}`}>
      {photoURL && !imageFailed
        ? <img src={photoURL} alt="" onError={() => setImageFailed(true)} />
        : <span>{initials(name)}</span>}
    </div>
  );
}

function timestampMillis(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  const timestamp = value as { toMillis?: () => number; toDate?: () => Date };
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
  return 0;
}

function timestampLabel(value: unknown): string {
  if (!value || typeof value !== 'object') return '';

  const timestamp = value as { toDate?: () => Date };
  if (typeof timestamp.toDate !== 'function') return '';

  return timestamp.toDate().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function inboxDateLabel(value: unknown): string {
  if (!value || typeof value !== 'object') return '';

  const timestamp = value as { toDate?: () => Date };
  if (typeof timestamp.toDate !== 'function') return '';

  const date = timestamp.toDate();
  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const daysAgo = Math.floor(
    (today.getTime() - messageDay.getTime()) / 86400000
  );

  if (daysAgo <= 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';

  return date.toLocaleDateString([], { weekday: 'long' });
}

function formatPresenceLastSeen(timestamp: number | null, now: number): string {
  if (!timestamp) return 'Last seen unavailable';

  const elapsed = Math.max(0, now - timestamp);
  const minutes = Math.floor(elapsed / 60000);

  if (minutes < 1) return 'Last seen just now';
  if (minutes < 60) return `Last seen ${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;

  const date = new Date(timestamp);
  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const time = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (sameDay(date, yesterday)) return `Last seen yesterday at ${time}`;

  return `Last seen ${date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })} at ${time}`;
}

function App() {
  const [user, setUser] = useState<User | null>(auth?.currentUser ?? null);
  const [authReady, setAuthReady] = useState(Boolean(auth?.currentUser));
  const [booting, setBooting] = useState(true);

  const [activeTab, setActiveTab] = useState<Tab>('Chats');
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [people, setPeople] = useState<PublicProfile[]>([]);
  const [followingUids, setFollowingUids] = useState<string[]>([]);
  const [followerUids, setFollowerUids] = useState<string[]>([]);
  const [relationshipProfiles, setRelationshipProfiles] = useState<Record<string, PublicProfile>>({});
  const [relationshipView, setRelationshipView] = useState<'followers' | 'following' | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profilePhotoBusy, setProfilePhotoBusy] = useState(false);
  const [profilePhotoProgress, setProfilePhotoProgress] = useState(0);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [conversationProfiles, setConversationProfiles] = useState<Record<string, PublicProfile>>({});
  const [conversations, setConversations] = useState<PulseConversation[]>([]);
  const [latestMessages, setLatestMessages] = useState<Record<string, PulseMessage | null>>({});
  const [conversationPreferences, setConversationPreferences] = useState<Record<string, PulseConversationPreference>>({});
  const [messages, setMessages] = useState<PulseMessage[]>([]);
  const [contactPresence, setContactPresence] = useState<ContactPresence>({
    online: false,
    available: false,
    lastSeen: null,
  });
  const [presenceNow, setPresenceNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setPresenceNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const conversationHistoryRef = useRef<string | null>(null);
  const handlingPopStateRef = useRef(false);

  const [viewedProfile, setViewedProfile] = useState<PublicProfile | null>(null);
  const [messageText, setMessageText] = useState('');
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [appearanceDraft, setAppearanceDraft] = useState<PulseConversationAppearance>({
    theme: 'midnight',
    background: 'plain',
    fontSize: 'medium',
    bubbleStyle: 'rounded',
    wallpaperURL: null,
    wallpaperPath: null,
  });

  const savedConversationAppearance = selectedId
    ? conversationPreferences[selectedId]?.appearance
    : undefined;

  const cleanUnsavedWallpaper = async (path?: string | null) => {
    if (!path || path === savedConversationAppearance?.wallpaperPath) return;
    try {
      await removeConversationWallpaper(path);
    } catch (cleanupError) {
      console.warn('Could not clean up an unused conversation wallpaper:', cleanupError);
    }
  };

  const discardAppearanceChanges = async () => {
    await cleanUnsavedWallpaper(appearanceDraft.wallpaperPath);

    setAppearanceDraft({
      theme: savedConversationAppearance?.theme ?? 'midnight',
      background: savedConversationAppearance?.background ?? 'plain',
      fontSize: savedConversationAppearance?.fontSize ?? 'medium',
      bubbleStyle: savedConversationAppearance?.bubbleStyle ?? 'rounded',
      wallpaperURL: savedConversationAppearance?.wallpaperURL ?? null,
      wallpaperPath: savedConversationAppearance?.wallpaperPath ?? null,
    });

    setAppearanceOpen(false);
  };
  const [posts, setPosts] = useState<PulsePost[]>([]);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentProgress, setAttachmentProgress] = useState(0);
  const [createCaption, setCreateCaption] = useState('');
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [createTemporary, setCreateTemporary] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  useEffect(() => {
    if (appearanceOpen) return;

    const saved = selectedId
      ? conversationPreferences[selectedId]?.appearance
      : undefined;

    setAppearanceDraft({
      theme: saved?.theme ?? 'midnight',
      background: saved?.background ?? 'plain',
      fontSize: saved?.fontSize ?? 'medium',
      bubbleStyle: saved?.bubbleStyle ?? 'rounded',
      wallpaperURL: saved?.wallpaperURL ?? null,
      wallpaperPath: saved?.wallpaperPath ?? null,
    });
  }, [selectedId, conversationPreferences, appearanceOpen]);

  const [conversationSearch, setConversationSearch] = useState('');
  const [inboxFilter, setInboxFilter] = useState<'all' | 'unread' | 'pinned'>('all');
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);

  const [sending, setSending] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [error, setError] = useState('');
  // Keep conversation navigation in browser history so Android Back,
  // browser Back and installed-PWA Back return to the previous chat state.
  useEffect(() => {
    if (handlingPopStateRef.current) {
      handlingPopStateRef.current = false;
      conversationHistoryRef.current = selectedId;
      return;
    }

    if (!selectedId) {
      const currentState = window.history.state;
      if (currentState && typeof currentState === 'object'
          && 'pulseConversationId' in currentState) {
        const nextState = { ...currentState };
        delete nextState.pulseConversationId;
        window.history.replaceState(nextState, '', window.location.href);
      }
      conversationHistoryRef.current = null;
      return;
    }

    if (conversationHistoryRef.current === selectedId) return;

    window.history.pushState(
      {
        ...(window.history.state && typeof window.history.state === 'object'
          ? window.history.state
          : {}),
        pulseConversationId: selectedId,
      },
      '',
      window.location.href,
    );
    conversationHistoryRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    function handleBrowserBack(event: PopStateEvent) {
      // A contact profile opened from a conversation is the top navigation layer.
      if (selectedId && activeTab === 'Profile' && viewedProfile) {
        setViewedProfile(null);
        setActiveTab('Chats');
        return;
      }

      if (selectedId) {
        const previousId =
          event.state && typeof event.state === 'object'
            ? event.state.pulseConversationId
            : null;

        handlingPopStateRef.current = true;

        if (typeof previousId === 'string' && previousId.length > 0) {
          conversationHistoryRef.current = previousId;
          setSelectedId(previousId);
        } else {
          conversationHistoryRef.current = null;
          setSelectedId(null);
        }

        setActiveTab('Chats');
        return;
      }

      // Close transient account UI before allowing the browser to leave PULSE.
      if (accountMenuOpen) setAccountMenuOpen(false);
      if (showNewChat) setShowNewChat(false);
      if (profileSettingsOpen) setProfileSettingsOpen(false);
    }

    window.addEventListener('popstate', handleBrowserBack);
    return () => window.removeEventListener('popstate', handleBrowserBack);
  }, [selectedId, activeTab, viewedProfile, accountMenuOpen, showNewChat, profileSettingsOpen]);

  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      setBooting(false);
      return;
    }

    return onAuthStateChanged(auth, nextUser => {
      setUser(nextUser);
      setAuthReady(true);
    });
  }, []);

  // Each signed-in device maintains its own Realtime Database connection.
  useEffect(() => {
    if (!user) return;
    return startPresence(user.uid);
  }, [user?.uid]);

  // Mirror the account's existing discoverability preference into presence privacy.
  useEffect(() => {
    if (!user || !profile) return;

    setPresenceVisibility(user.uid, profile.discoverable).catch(error => {
      console.error('PULSE presence privacy update failed:', error);
    });
  }, [user?.uid, profile?.discoverable]);


  useEffect(() => {
    if (!user) {
      setProfile(null);
      setPeople([]);
      setFollowingUids([]);
      setFollowerUids([]);
      setRelationshipProfiles({});
      setConversationProfiles({});
      setConversations([]);
      setMessages([]);
      setBooting(false);
      return;
    }

    let active = true;
    const subscriptions: Array<() => void> = [];

    setBooting(true);
    setError('');

    publishUserProfile(user)
      .then(() => {
        if (!active) return;

        subscriptions.push(
          watchOwnProfile(
            user.uid,
            value => {
              if (active) setProfile(value);
            },
            err => {
              if (active) setError('Own profile: ' + err.message);
            },
          ),
        );

        subscriptions.push(
          watchDiscoverablePeople(
            user.uid,
            value => {
              if (active) setPeople(value);
            },
            err => {
              if (active) setError('Member directory: ' + err.message);
            },
          ),
        );

        subscriptions.push(
          watchConversations(
            user.uid,
            value => {
              if (active) setConversations(value);
            },
            err => {
              if (active) setError('Conversation inbox: ' + err.message);
            },
          ),
        );

        subscriptions.push(
          watchFollowing(
            user.uid,
            value => { if (active) setFollowingUids(value); },
            err => { if (active) setError('Following: ' + err.message); },
          ),
        );

        subscriptions.push(
          watchFollowers(
            user.uid,
            value => { if (active) setFollowerUids(value); },
            err => { if (active) setError('Followers: ' + err.message); },
          ),
        );

        setBooting(false);
      })
      .catch(err => {
        if (!active) return;
        setError('Account setup: ' + (err instanceof Error ? err.message : 'Could not prepare your account.'));
        setBooting(false);
      });

    return () => {
      active = false;
      subscriptions.forEach(unsubscribe => unsubscribe());
    };
  }, [user]);


  useEffect(() => {
    if (!user || conversations.length === 0) {
      setConversationProfiles({});
      return;
    }

    let active = true;

    const partnerUids = [
      ...new Set(
        conversations
          .map(conversation =>
            conversation.participants.find(uid => uid !== user.uid),
          )
          .filter((uid): uid is string => Boolean(uid)),
      ),
    ];

    const subscriptions = partnerUids.map(uid =>
      watchProfile(
        uid,
        value => {
          if (!active) return;

          setConversationProfiles(previous => {
            const next = { ...previous };

            if (value) {
              next[uid] = value;
            } else {
              delete next[uid];
            }

            return next;
          });
        },
        err => {
          if (active) setError('Conversation partner profile: ' + err.message);
        },
      ),
    );

    return () => {
      active = false;
      subscriptions.forEach(unsubscribe => unsubscribe());
    };
  }, [conversations, user]);

  useEffect(() => {
    if (!user) {
      setConversationPreferences({});
      return;
    }

    return watchConversationPreferences(
      user.uid,
      setConversationPreferences,
      err => setError('Inbox preferences: ' + err.message),
    );
  }, [user]);

  useEffect(() => {
    if (!selectedId || !user) {
      setMessages([]);
      return;
    }

    setMessages([]);

    return watchMessages(
      selectedId,
      setMessages,
      err => setError('Conversation messages: ' + err.message),
    );
  }, [selectedId, user]);

  useEffect(() => {
    if (!user) {
      setPosts([]);
      return;
    }

    return watchExplorePosts(
      setPosts,
      err => setError('Explore posts: ' + err.message),
    );
  }, [user]);

  useEffect(() => {
    if (!user || !selectedId || messages.length === 0) return;

    void markConversationRead(user.uid, selectedId).catch(err => {
      setError(err instanceof Error ? err.message : 'Could not update read status.');
    });
  }, [user, selectedId, messages[messages.length - 1]?.id]);

  // Each inbox row listens to the latest real message in its shared conversation.
  // This keeps previews and ordering synchronized without client-side writes
  // to protected conversation metadata.
  useEffect(() => {
    if (!user || conversations.length === 0) {
      setLatestMessages({});
      return;
    }

    let active = true;
    const ids = conversations.map(conversation => conversation.id);

    setLatestMessages(previous => {
      const next: Record<string, PulseMessage | null> = {};
      ids.forEach(id => {
        if (Object.prototype.hasOwnProperty.call(previous, id)) {
          next[id] = previous[id];
        }
      });
      return next;
    });

    const subscriptions = conversations.map(conversation =>
      watchLatestMessage(
        conversation.id,
        message => {
          if (!active) return;
          setLatestMessages(previous => ({
            ...previous,
            [conversation.id]: message,
          }));
        },
        err => {
          if (active) setError('Latest message preview: ' + err.message);
        },
      ),
    );

    return () => {
      active = false;
      subscriptions.forEach(unsubscribe => unsubscribe());
    };
  }, [conversations, user]);


  useEffect(() => {
    if (!user) return;

    const ids = [...new Set([...followingUids, ...followerUids])];
    if (ids.length === 0) {
      setRelationshipProfiles({});
      return;
    }

    let active = true;
    const subscriptions = ids.map(uid =>
      watchProfile(
        uid,
        value => {
          if (!active) return;
          setRelationshipProfiles(previous => {
            const next = { ...previous };
            if (value) next[uid] = value;
            else delete next[uid];
            return next;
          });
        },
        err => { if (active) setError('Relationship profile: ' + err.message); },
      ),
    );

    return () => {
      active = false;
      subscriptions.forEach(unsubscribe => unsubscribe());
    };
  }, [user, followingUids, followerUids]);

  const peopleByUid = useMemo(
    () => new Map([
      ...people.map(person => [person.uid, person] as const),
      ...Object.values(relationshipProfiles).map(person => [person.uid, person] as const),
      ...Object.values(conversationProfiles).map(
        person => [person.uid, person] as const,
      ),
    ]),
    [people, relationshipProfiles, conversationProfiles],
  );

  const otherUid = (conversation: PulseConversation) =>
    conversation.participants.find(uid => uid !== user?.uid) ?? '';

  const inboxConversations = useMemo(() => {
    const term = conversationSearch.trim().toLowerCase();

    return conversations
      .map(conversation => {
        const partnerUid = conversation.participants.find(uid => uid !== user?.uid) ?? '';
        const partner = peopleByUid.get(partnerUid) ?? {
          uid: partnerUid,
          displayName: 'PULSE member',
          username: partnerUid.slice(0, 10),
          photoURL: null,
          bio: '',
          discoverable: false,
        };
        const latest = latestMessages[conversation.id] ?? null;
        const preference = conversationPreferences[conversation.id];
        const latestTime = timestampMillis(latest?.createdAt);
        const lastReadTime = timestampMillis(preference?.lastReadAt);
        const unread = Boolean(
          latest &&
          latest.senderId !== user?.uid &&
          latestTime > lastReadTime
        );

        return { conversation, partner, latest, preference, unread };
      })
      .filter(item => {
        if (inboxFilter === 'unread' && !item.unread) return false;
        if (inboxFilter === 'pinned' && !item.preference?.pinned) return false;

        if (!term) return true;
        return (
          item.partner.displayName.toLowerCase().includes(term) ||
          item.partner.username.toLowerCase().includes(term) ||
          (item.latest?.text ?? '').toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        const pinDifference =
          Number(Boolean(b.preference?.pinned)) -
          Number(Boolean(a.preference?.pinned));

        if (pinDifference !== 0) return pinDifference;

        const aTime = timestampMillis(a.latest?.createdAt) ||
          timestampMillis(a.conversation.updatedAt) ||
          timestampMillis(a.conversation.createdAt);
        const bTime = timestampMillis(b.latest?.createdAt) ||
          timestampMillis(b.conversation.updatedAt) ||
          timestampMillis(b.conversation.createdAt);

        return bTime - aTime;
      });
  }, [
    conversations,
    conversationSearch,
    conversationPreferences,
    inboxFilter,
    latestMessages,
    peopleByUid,
    user,
  ]);

  const activePosts = useMemo(
    () => posts.filter(post => {
      if (!post.expiresAt || typeof post.expiresAt !== 'object' || !('toDate' in post.expiresAt)) {
        return true;
      }
      const expiry = (post.expiresAt as { toDate: () => Date }).toDate();
      return expiry.getTime() > Date.now();
    }),
    [posts],
  );

  const profilePosts = useMemo(
    () => activePosts.filter(post => post.ownerUid === (viewedProfile?.uid ?? user?.uid)),
    [activePosts, viewedProfile, user?.uid],
  );

  const selectedConversation = conversations.find(
    conversation => conversation.id === selectedId,
  );

  const selectedPerson = selectedConversation
    ? peopleByUid.get(otherUid(selectedConversation))
    : undefined;

  useEffect(() => {
    if (!user || !selectedPerson) {
      setContactPresence({ online: false, available: false, lastSeen: null });
      return;
    }

    return watchPresence(
      selectedPerson.uid,
      setContactPresence,
      error => console.error('PULSE contact presence:', error),
    );
  }, [user?.uid, selectedPerson?.uid]);


  async function openMessage(person: PublicProfile) {
    if (!user) return;

    setError('');

    try {
      const existing = conversations.find(conversation =>
        conversation.type === 'direct' &&
        conversation.participants.length === 2 &&
        conversation.participants.includes(user.uid) &&
        conversation.participants.includes(person.uid)
      );

      const id = existing
        ? existing.id
        : await startDirectConversation(user.uid, person.uid);

      setSelectedId(id);
      setViewedProfile(null);
      setShowNewChat(false);
      setActiveTab('Chats');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open this conversation.');
    }
  }

  async function toggleFollow(person: PublicProfile) {
    if (!user) return;
    setError('');
    try {
      if (followingUids.includes(person.uid)) {
        await unfollowMember(user.uid, person.uid);
      } else {
        await followMember(user.uid, person.uid);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Follow action failed.');
    }
  }

  async function saveProfile() {
    if (!user || profileSaving) return;
    setProfileSaving(true);
    setError('');
    try {
      await updateOwnProfile(user.uid, {
        displayName: editDisplayName,
        username: editUsername,
        bio: editBio,
      });
      setEditingProfile(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profile could not be saved.');
    } finally {
      setProfileSaving(false);
    }
  }

  async function sendMessage() {
    if (!user || !selectedId || !messageText.trim() || sending) return;

    setSending(true);
    setError('');

    try {
      await sendTextMessage(selectedId, user.uid, messageText);
      setMessageText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  }

  async function sendAttachment(file: File | undefined) {
    if (!user || !selectedId || !file || attachmentBusy) return;

    setAttachmentBusy(true);
    setAttachmentProgress(0);
    setError('');

    try {
      await uploadConversationAttachment(
        selectedId,
        user.uid,
        file,
        setAttachmentProgress,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attachment could not be sent.');
    } finally {
      setAttachmentBusy(false);
      setAttachmentProgress(0);
    }
  }

  async function publishCurrentPost() {
    if (!user || publishing) return;

    setPublishing(true);
    setPublishProgress(0);
    setError('');

    try {
      await publishPost(
        user.uid,
        {
          displayName: profile?.displayName || user.displayName || 'PULSE member',
          username: profile?.username || '',
          photoURL: profile?.photoURL || user.photoURL || '',
        },
        createCaption,
        createFile,
        createTemporary,
        setPublishProgress,
      );

      setCreateCaption('');
      setCreateFile(null);
      setCreateTemporary(false);
      setActiveTab('Explore');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your post could not be published.');
    } finally {
      setPublishing(false);
      setPublishProgress(0);
    }
  }

  async function changeProfilePhoto(file: File | undefined) {
    if (!user || !file || profilePhotoBusy) return;

    setProfilePhotoBusy(true);
    setProfilePhotoProgress(0);
    setError('');

    try {
      await uploadProfilePhoto(user.uid, file, setProfilePhotoProgress);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profile photo upload failed.');
    } finally {
      setProfilePhotoBusy(false);
    }
  }

  async function clearProfilePhoto() {
    if (!user || profilePhotoBusy || !profile?.photoURL) return;

    setProfilePhotoBusy(true);
    setError('');

    try {
      await removeProfilePhoto(user.uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profile photo could not be removed.');
    } finally {
      setProfilePhotoBusy(false);
    }
  }

  async function toggleDiscoverability() {
    if (!user || !profile || privacyBusy) return;

    setPrivacyBusy(true);
    setError('');

    try {
      await setDiscoverability(user.uid, !profile.discoverable);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Privacy setting could not be updated.');
    } finally {
      setPrivacyBusy(false);
    }
  }

  async function handleSignOut() {
    if (!auth) return;

    try {
      await signOut(auth);
      setSelectedId(null);
      setAccountMenuOpen(false);
      setActiveTab('Chats');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign out failed.');
    }
  }

  const tabs: Array<{ label: Tab; icon: typeof MessageCircle }> = [
    { label: 'Chats', icon: MessageCircle },
    { label: 'Explore', icon: Compass },
    { label: 'Create', icon: PlusSquare },
    { label: 'Activity', icon: Bell },
    { label: 'Profile', icon: UserRound },
  ];

  const displayName =
    profile?.displayName ||
    user?.displayName ||
    'PULSE member';

  if (!authReady || booting) {
    return (
      <main className="pulse-loading">
        <div className="pulse-loading-mark"><MessageCircle size={28} /></div>
        <strong>PULSE</strong>
        <span>Connecting your account and live data…</span>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="pulse-loading">
        <strong>PULSE</strong>
        <p>Your session has ended. Please sign in again.</p>
      </main>
    );
  }

  return (
    <div className="pulse-live-app">
      {!(activeTab === 'Chats' && selectedId) && (
      <header className="pulse-topbar">
        <button
          type="button"
          className="pulse-wordmark pulse-home-button"
          onClick={() => {
            setSelectedId(null);
            setActiveTab('Chats');
          }}
          aria-label="PULSE Home - open Chats"
        >
          <span className="pulse-wordmark-icon"><MessageCircle size={21} /></span>
          <strong>PULSE</strong>
        </button>

        <div className="pulse-topbar-actions">
          <div className="pulse-account-menu-wrap">
          <button
            type="button"
            className="pulse-topbar-account"
            aria-expanded={accountMenuOpen}
            aria-label="Open account menu"
            onClick={() => setAccountMenuOpen(value => !value)}
          >
            <Avatar name={displayName} photoURL={profile?.photoURL} small />
          </button>

          {accountMenuOpen && (
            <div className="pulse-account-menu">
              <div className="pulse-account-menu-heading">
                <Avatar name={displayName} photoURL={profile?.photoURL} small />
                <span>
                  <strong>{displayName}</strong>
                  <small>{profile?.username ? `@${profile.username}` : 'Your PULSE account'}</small>
                </span>
              </div>
              <button type="button" onClick={() => {
                setViewedProfile(null);
                setRelationshipView(null);
                setActiveTab('Profile');
                setAccountMenuOpen(false);
              }}>
                <UserRound size={16} /> View my profile
              </button>
              <button type="button" onClick={() => {
                setViewedProfile(null);
                setRelationshipView(null);
                setEditDisplayName(profile?.displayName ?? displayName);
                setEditUsername(profile?.username ?? '');
                setEditBio(profile?.bio ?? '');
                setEditingProfile(true);
                setActiveTab('Profile');
                setAccountMenuOpen(false);
              }}>
                <Settings size={16} /> Edit profile
              </button>
              <button
                type="button"
                className="pulse-account-signout"
                onClick={() => {
                  setAccountMenuOpen(false);
                  void handleSignOut();
                }}
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>
          )}
          </div>
        </div>
      </header>
      )}

      <main className={`pulse-content ${activeTab === 'Chats' ? 'pulse-content-chats' : ''} ${activeTab === 'Chats' && selectedId ? 'pulse-conversation-active' : ''}`}>

        {error && (
          <div className="pulse-error" role="alert">
            <span>{error}</span>
            <button onClick={() => setError('')} aria-label="Dismiss error">×</button>
          </div>
        )}

        {activeTab === 'Chats' && (
          <section className={`pulse-chat-layout ${selectedId ? 'conversation-open' : ''}`}>
              <div className={`pulse-inbox ${selectedId ? "pulse-inbox-hidden" : ""}`}>
              <div className="pulse-page-heading pulse-people-heading">
                <h1>Your people</h1>
                <button
                  type="button"
                  className="pulse-new-conversation"
                  onClick={() => setShowNewChat(value => !value)}
                  aria-expanded={showNewChat}
                >
                  <Plus size={17} /> {showNewChat ? 'Close' : 'New chat'}
                </button>
              </div>

              <label className="pulse-search">
                <Search size={17} />
                <input
                  value={conversationSearch}
                  onChange={event => setConversationSearch(event.target.value)}
                  placeholder="Search conversations"
                />
              </label>

              <div className="pulse-inbox-filters" aria-label="Filter conversations">
                <button
                  type="button"
                  className={inboxFilter === 'all' ? 'active' : ''}
                  onClick={() => setInboxFilter('all')}
                >
                  All
                </button>
                <button
                  type="button"
                  className={inboxFilter === 'unread' ? 'active' : ''}
                  onClick={() => setInboxFilter('unread')}
                >
                  Unread
                </button>
                <button
                  type="button"
                  className={inboxFilter === 'pinned' ? 'active' : ''}
                  onClick={() => setInboxFilter('pinned')}
                >
                  Pinned
                </button>
              </div>

              {showNewChat && (
                <div className="pulse-new-chat-people">
                  <div className="pulse-new-chat-heading">
                    <strong>Start a conversation</strong>
                    <span>People who follow you and people you follow</span>
                  </div>
                  {[...new Set([...followingUids, ...followerUids])]
                    .filter(uid => uid !== user.uid)
                    .map(uid => {
                      const person = relationshipProfiles[uid];
                      if (!person) return null;

                      const followsYou = followerUids.includes(uid);
                      const youFollow = followingUids.includes(uid);

                      return (
                        <button
                          type="button"
                          className="pulse-new-chat-person"
                          key={uid}
                          onClick={() => void openMessage(person)}
                        >
                          <Avatar name={person.displayName} photoURL={person.photoURL} />
                          <span>
                            <strong>{person.displayName}</strong>
                            <small>
                              @{person.username} · {[
                                youFollow ? 'Following' : '',
                                followsYou ? 'Follows you' : '',
                              ].filter(Boolean).join(' · ')}
                            </small>
                          </span>
                          <MessageCircle size={18} />
                        </button>
                      );
                    })}
                  {[...new Set([...followingUids, ...followerUids])].length === 0 && (
                    <p className="pulse-new-chat-empty">
                      Your followers and the people you follow will appear here.
                    </p>
                  )}
                </div>
              )}

              <div className={`pulse-inbox-list ${showNewChat ? 'pulse-inbox-list-hidden' : ''}`}>
                {inboxConversations.map(({ conversation, partner, latest, preference, unread }) => (
                  <div
                    key={conversation.id}
                    className={`pulse-conversation ${selectedId === conversation.id ? 'active' : ''}`}
                  >
                    <button
                      type="button"
                      className="pulse-conversation-open"
                      onClick={() => {
                        setSelectedId(conversation.id);
                        setActiveTab('Chats');
                      }}
                    >
                      <Avatar name={partner.displayName} photoURL={partner.photoURL} />
                      <span className="pulse-conversation-copy">
                        <strong>{partner.displayName}</strong>
                        <small>
                          {latest
                            ? `${latest.senderId === user.uid ? 'You: ' : ''}${latest.text}`
                            : `@${partner.username} · Start a conversation`}
                        </small>
                      </span>
                      <span className="pulse-conversation-meta">
                        {latest ? inboxDateLabel(latest.createdAt) : ''}
                        {unread && <span className="pulse-unread-dot" aria-label="Unread message" />}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`pulse-pin-button ${preference?.pinned ? 'pinned' : ''}`}
                      aria-label={preference?.pinned ? 'Unpin conversation' : 'Pin conversation'}
                      title={preference?.pinned ? 'Unpin conversation' : 'Pin conversation'}
                      onClick={() => {
                        void setConversationPinned(
                          user.uid,
                          conversation.id,
                          !preference?.pinned,
                        ).catch(err => {
                          setError(err instanceof Error ? err.message : 'Could not update pinned conversation.');
                        });
                      }}
                    >
                      <Pin size={15} />
                    </button>
                  </div>
                ))}

                {inboxConversations.length === 0 && (
                  <div className="pulse-empty-small">
                    <MessageCircle size={25} />
                    <strong>
                      {conversations.length === 0 ? 'Your inbox is ready' : inboxFilter === 'unread' ? 'No unread conversations' : inboxFilter === 'pinned' ? 'No pinned conversations' : 'No matching conversations'}
                    </strong>
                    <p>
                      {conversations.length === 0
                        ? 'When you message another registered PULSE member, your shared conversation will appear here automatically.'
                        : 'Try another name, username or message keyword.'}
                    </p>
                    {conversations.length === 0 && (
                      <button onClick={() => setActiveTab('Explore')}>Discover members</button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {selectedId && (
              <div className="pulse-chat-window">
                <>
                  <div className="pulse-chat-heading">
                    <button
                      type="button"
                      className="pulse-chat-profile-trigger"
                      disabled={!selectedPerson}
                      onClick={() => {
                        if (!selectedPerson) return;
                        window.history.pushState(
                          {
                            ...(window.history.state && typeof window.history.state === 'object'
                              ? window.history.state
                              : {}),
                            pulseContactProfile: true,
                          },
                          '',
                          window.location.href,
                        );
                        setViewedProfile(selectedPerson);
                        setActiveTab('Profile');
                      }}
                    >
                      <Avatar
                        name={selectedPerson?.displayName ?? 'PULSE member'}
                        photoURL={selectedPerson?.photoURL}
                      />
                      <span>
                        <strong>{selectedPerson?.displayName ?? 'PULSE member'}</strong>
                        <small>{selectedPerson ? `@${selectedPerson.username}` : 'Private conversation'}</small>
                        {selectedPerson && contactPresence.available && (
                          <small className={`pulse-contact-presence ${contactPresence.online ? 'online' : 'offline'}`}>
                            <span />
                            {contactPresence.online
                              ? 'Online'
                              : formatPresenceLastSeen(contactPresence.lastSeen, presenceNow)}
                          </small>
                        )}
                      </span>
                    </button>
                    <div className="pulse-chat-call-actions">
                      <button
                        type="button"
                        className="pulse-appearance-trigger"
                        title="Customize this conversation"
                        aria-label="Customize conversation appearance"
                        onClick={() => setAppearanceOpen(value => !value)}
                      >
                        <Palette size={18} />
                      </button>
                      <button
                        type="button"
                        disabled
                        title="Voice calling will be available in the calling milestone"
                        aria-label="Voice calling coming soon"
                      >
                        <Phone size={18} />
                      </button>
                      <button
                        type="button"
                        disabled
                        title="Video calling will be available in the calling milestone"
                        aria-label="Video calling coming soon"
                      >
                        <Video size={19} />
                      </button>
                    </div>
                  </div>

                  {appearanceOpen && selectedId && user && (
                    <section className="pulse-appearance-panel" aria-label="Conversation appearance">
                      <div className="pulse-appearance-heading">
                        <div>
                          <strong>Chat appearance</strong>
                          <small>Personal settings for this conversation.</small>
                        </div>
                        <button type="button" aria-label="Close appearance settings" onClick={() => void discardAppearanceChanges()}>
                          <X size={17} />
                        </button>
                      </div>

                      <div className="pulse-appearance-grid">
                        <label>Theme
                          <select value={appearanceDraft.theme} onChange={event => setAppearanceDraft(v => ({ ...v, theme: event.target.value as PulseConversationAppearance['theme'] }))}>
                            <option value="midnight">Midnight</option>
                            <option value="ocean">Ocean</option>
                            <option value="light">Light</option>
                          </select>
                        </label>
                        <label>Background
                          <select value={appearanceDraft.background} onChange={event => setAppearanceDraft(v => ({ ...v, background: event.target.value as PulseConversationAppearance['background'] }))}>
                            <option value="plain">Plain</option>
                            <option value="gradient">Gradient</option>
                            <option value="dots">Subtle dots</option>
                          </select>
                        </label>
                        <label>Message font
                          <select value={appearanceDraft.fontSize} onChange={event => setAppearanceDraft(v => ({ ...v, fontSize: event.target.value as PulseConversationAppearance['fontSize'] }))}>
                            <option value="small">Small</option>
                            <option value="medium">Medium</option>
                            <option value="large">Large</option>
                          </select>
                        </label>
                        <label>Bubble shape
                          <select value={appearanceDraft.bubbleStyle} onChange={event => setAppearanceDraft(v => ({ ...v, bubbleStyle: event.target.value as PulseConversationAppearance['bubbleStyle'] }))}>
                            <option value="rounded">Rounded</option>
                            <option value="soft">Soft</option>
                            <option value="square">Square</option>
                          </select>
                        </label>
                      </div>

                      <label className="pulse-wallpaper-upload">
                        <Camera size={16} /> Upload wallpaper
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={appearanceSaving}
                          onChange={async event => {
                            const file = event.currentTarget.files?.[0];
                            event.currentTarget.value = '';
                            if (!file || !user || !selectedId) return;
                            if (file.size > 8 * 1024 * 1024) {
                              setError('Choose a wallpaper smaller than 8 MB.');
                              return;
                            }
                            try {
                              setAppearanceSaving(true);
                              const uploaded = await uploadConversationWallpaper(user.uid, selectedId, file);
                              await cleanUnsavedWallpaper(appearanceDraft.wallpaperPath);
              setAppearanceDraft(v => ({ ...v, wallpaperURL: uploaded.url, wallpaperPath: uploaded.path }));
                              setError('');
                            } catch (uploadError) {
                              setError(uploadError instanceof Error ? uploadError.message : 'Wallpaper upload failed.');
                            } finally {
                              setAppearanceSaving(false);
                            }
                          }}
                        />
                      </label>

                      {appearanceDraft.wallpaperURL && (
                        <button type="button" className="pulse-wallpaper-remove" onClick={async () => {
                          await cleanUnsavedWallpaper(appearanceDraft.wallpaperPath);
                          setAppearanceDraft(v => ({ ...v, wallpaperURL: null, wallpaperPath: null }));
                        }}>
                          Remove custom wallpaper
                        </button>
                      )}

                      <div className="pulse-appearance-actions">
                        <button
                          type="button"
                          disabled={appearanceSaving}
                          onClick={async () => {
                            await cleanUnsavedWallpaper(appearanceDraft.wallpaperPath);
                            setAppearanceDraft({
                              theme: 'midnight',
                              background: 'plain',
                              fontSize: 'medium',
                              bubbleStyle: 'rounded',
                              wallpaperURL: null,
                              wallpaperPath: null,
                            });
                          }}
                        >Reset preview</button>
                        <button
                          type="button"
                          disabled={appearanceSaving}
                          onClick={async () => {
                            try {
                              setAppearanceSaving(true);

                              const previousWallpaperPath =
                                savedConversationAppearance?.wallpaperPath ?? null;

                              await setConversationAppearance(
                                user.uid,
                                selectedId,
                                appearanceDraft,
                              );

                              if (
                                previousWallpaperPath &&
                                previousWallpaperPath !== appearanceDraft.wallpaperPath
                              ) {
                                try {
                                  await removeConversationWallpaper(previousWallpaperPath);
                                } catch (cleanupError) {
                                  console.warn(
                                    'Appearance saved, but the previous wallpaper could not be deleted:',
                                    cleanupError,
                                  );
                                }
                              }

                              setAppearanceOpen(false);
                              setError('');
                            } catch (saveError) {
                              setError(saveError instanceof Error ? saveError.message : 'Could not save chat appearance.');
                            } finally {
                              setAppearanceSaving(false);
                            }
                          }}
                        >
                          {appearanceSaving ? 'Saving…' : 'Save appearance'}
                        </button>
                      </div>
                    </section>
                  )}

                  <div
                    className="pulse-message-list"
                    data-theme={appearanceDraft.theme}
                    data-background={appearanceDraft.background}
                    data-font-size={appearanceDraft.fontSize}
                    data-bubble-style={appearanceDraft.bubbleStyle}
                    style={appearanceDraft.wallpaperURL ? {
                      backgroundImage: `linear-gradient(rgba(8, 12, 20, .68), rgba(8, 12, 20, .68)), url("${appearanceDraft.wallpaperURL}")`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    } : undefined}
                  >
                    {messages.length === 0 ? (
                      <div className="pulse-empty-chat">
                        <ShieldCheck size={27} />
                        <strong>Start a private conversation</strong>
                        <p>Your messages are stored in your PULSE account and synchronized live.</p>
                      </div>
                    ) : messages.map(item => {
                      const mine = item.senderId === user.uid;
                      return (
                        <div key={item.id} className={`pulse-message-row ${mine ? 'mine' : ''}`}>
                          <div className="pulse-message-bubble">
                            {item.type === 'image' && item.attachmentURL && (
                              <a href={item.attachmentURL} target="_blank" rel="noreferrer">
                                <img className="pulse-chat-attachment-image" src={item.attachmentURL} alt={item.attachmentName || 'Shared image'} />
                              </a>
                            )}
                            {item.type === 'video' && item.attachmentURL && (
                              <video className="pulse-chat-attachment-video" src={item.attachmentURL} controls preload="metadata" />
                            )}
                            {item.type === 'document' && item.attachmentURL && (
                              <a className="pulse-chat-document" href={item.attachmentURL} target="_blank" rel="noreferrer">
                                {item.attachmentName || 'Open document'}
                              </a>
                            )}
                            {item.type === 'text' && <span>{item.text}</span>}
                            <small>{timestampLabel(item.createdAt)}</small>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {attachmentBusy && (
                    <div className="pulse-upload-progress">
                      <span>Uploading attachment… {attachmentProgress}%</span>
                      <progress value={attachmentProgress} max="100" />
                    </div>
                  )}
                  <form
                    className="pulse-composer"
                    onSubmit={event => {
                      event.preventDefault();
                      void sendMessage();
                    }}
                  >
                    <label className="pulse-attachment-button" title="Attach a photo, video or document">
                      <Plus size={19} />
                      <input
                        type="file"
                        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                        disabled={attachmentBusy}
                        onChange={event => {
                          void sendAttachment(event.target.files?.[0]);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                    <label className="pulse-attachment-button pulse-camera-button" title="Take a photo">
                      <Camera size={18} />
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        disabled={attachmentBusy}
                        onChange={event => {
                          void sendAttachment(event.target.files?.[0]);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                    <input
                      value={messageText}
                      onChange={event => setMessageText(event.target.value)}
                      placeholder="Write a message…"
                      maxLength={5000}
                    />
                    <button type="submit" disabled={!messageText.trim() || sending}>
                      <Send size={18} />
                    </button>
                  </form>
                </>
              </div>
            )}
          </section>
        )}

        {activeTab === 'Create' && (
          <section className="pulse-standard-page">
            <span className="pulse-eyebrow">SHARE YOUR WORLD</span>
            <h1>Create</h1>
            <p className="pulse-lead">
              Share a thought, photograph or video with your PULSE community.
            </p>

            <div className="pulse-create-card">
              <textarea
                value={createCaption}
                onChange={event => setCreateCaption(event.target.value)}
                maxLength={2200}
                placeholder="What would you like to share?"
                rows={5}
              />
              <div className="pulse-create-media">
                <label className="pulse-create-file">
                  <Camera size={18} /> Choose photo or video
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={event => setCreateFile(event.target.files?.[0] || null)}
                  />
                </label>
                {createFile && (
                  <div className="pulse-selected-file">
                    <span>{createFile.name}</span>
                    <button type="button" onClick={() => setCreateFile(null)}>Remove</button>
                  </div>
                )}
              </div>
              <label className="pulse-temporary-toggle">
                <input
                  type="checkbox"
                  checked={createTemporary}
                  onChange={event => setCreateTemporary(event.target.checked)}
                />
                Make this a temporary 24-hour post
              </label>
              {publishing && (
                <div className="pulse-upload-progress">
                  <span>Publishing… {publishProgress}%</span>
                  <progress value={publishProgress} max="100" />
                </div>
              )}
              <button
                type="button"
                className="pulse-publish-button"
                disabled={publishing || (!createCaption.trim() && !createFile)}
                onClick={() => void publishCurrentPost()}
              >
                <PlusSquare size={18} /> {publishing ? 'Publishing…' : 'Publish to Explore'}
              </button>
            </div>
          </section>
        )}

        {activeTab === 'Explore' && (
          <section className="pulse-standard-page pulse-explore-page">
            <span className="pulse-eyebrow">YOUR WORLD ON PULSE</span>
            <h1>Explore</h1>
            <p className="pulse-lead">Discover photos, videos and moments shared by the community.</p>

            <div className="pulse-post-feed">
              {activePosts.map(post => (
                <article className="pulse-post-card" key={post.id}>
                  <button
                    type="button"
                    className="pulse-post-author pulse-post-author-button"
                    onClick={() => {
                      const author = post.ownerUid === user.uid
                        ? profile
                        : people.find(person => person.uid === post.ownerUid);
                      if (author) {
                        setViewedProfile(author);

                        setRelationshipView(null);
                        setEditingProfile(false);
                        setActiveTab('Profile');
                      }
                    }}
                  >
                    <Avatar name={post.authorName || 'PULSE member'} photoURL={post.authorPhotoURL} small />
                    <span className="pulse-post-author-copy">
                      <strong>{post.authorName || 'PULSE member'}</strong>
                      <small>@{post.authorUsername || 'member'}</small>
                    </span>
                    {Boolean(post.expiresAt) && <span className="pulse-post-temporary">24-hour post</span>}
                  </button>
                  {post.caption && <p className="pulse-post-caption">{post.caption}</p>}
                  {post.postType === 'image' && post.mediaURL && (
                    <img
                      className="pulse-post-media"
                      src={post.mediaURL}
                      alt="Post shared by a PULSE member"
                      loading="lazy"
                    />
                  )}
                  {post.postType === 'video' && post.mediaURL && (
                    <video className="pulse-post-media" src={post.mediaURL} controls preload="metadata" />
                  )}
                </article>
              ))}

              {activePosts.length === 0 && (
                <div className="pulse-post-empty">
                  <strong>No posts yet</strong>
                  <span>Real posts shared by PULSE members will appear here.</span>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'Activity' && (
          <section className="pulse-standard-page">
            <span className="pulse-eyebrow">WHAT IS HAPPENING</span>
            <h1>Activity</h1>
            <p className="pulse-lead">Important interactions and account activity.</p>
            <div className="pulse-empty-card">
              <Bell size={30} />
              <h2>No activity yet</h2>
              <p>There are no activity records for this account. Notifications will appear here once real follow, reply, mention and interaction services are implemented.</p>
            </div>
          </section>
        )}

        {activeTab === 'Profile' && (
          <section className="pulse-standard-page pulse-social-profile-page">
            {viewedProfile && viewedProfile.uid !== user.uid ? (
              <>
                <div className="pulse-social-cover" aria-hidden="true" />
                <div className="pulse-social-profile-heading">
                  <Avatar
                    name={viewedProfile.displayName}
                    photoURL={viewedProfile.photoURL}
                  />
                  <h1>{viewedProfile.displayName}</h1>
                  <span>@{viewedProfile.username}</span>
                  <p>{viewedProfile.bio || 'This member has not added a bio yet.'}</p>
                  <div className="pulse-public-profile-actions">
                    <button
                      className={`pulse-profile-action ${followingUids.includes(viewedProfile.uid) ? '' : 'primary'}`}
                      onClick={() => void toggleFollow(viewedProfile)}
                    >
                      {followingUids.includes(viewedProfile.uid) ? 'Following' : 'Follow'}
                    </button>
                    <button
                      className="pulse-profile-action primary"
                      onClick={() => void openMessage(viewedProfile)}
                    >
                      <MessageCircle size={16} /> Message
                    </button>
                  </div>
                </div>

                <div className="pulse-profile-post-heading">
                  <strong>Posts</strong>
                  <span>{profilePosts.length}</span>
                </div>
                <div className="pulse-profile-post-grid">
                  {profilePosts.map(post => (
                    <article className="pulse-profile-post-tile" key={post.id}>
                      {post.postType === 'image' && post.mediaURL ? (
                        <img src={post.mediaURL} alt="Profile post" loading="lazy" />
                      ) : post.postType === 'video' && post.mediaURL ? (
                        <video src={post.mediaURL} controls preload="metadata" />
                      ) : (
                        <p>{post.caption || 'Post'}</p>
                      )}
                    </article>
                  ))}
                  {profilePosts.length === 0 && (
                    <div className="pulse-profile-no-posts">
                      This member has not published any posts yet.
                    </div>
                  )}
                </div>
                <p className="pulse-profile-privacy-note">
                  Only public profile information and published posts are shown here.
                </p>
              </>
            ) : (
              <>
                <div className="pulse-social-cover" aria-hidden="true" />
                <div className="pulse-social-profile-heading">
                  <Avatar name={displayName} photoURL={profile?.photoURL} />
                  <h1>{displayName}</h1>
                  <span>@{profile?.username ?? user.uid.slice(0, 10)}</span>
                  <p>{profile?.bio || 'Your PULSE profile.'}</p>
                  <div className="pulse-profile-photo-controls">
                    <label className="pulse-photo-upload">
                      <Camera size={16} />
                      {profilePhotoBusy
                        ? `Uploading ${profilePhotoProgress}%`
                        : 'Change photo'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={profilePhotoBusy}
                        onChange={event => {
                          const file = event.currentTarget.files?.[0];
                          void changeProfilePhoto(file);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                    {profile?.photoURL && (
                      <button
                        type="button"
                        className="pulse-photo-remove"
                        onClick={() => void clearProfilePhoto()}
                        disabled={profilePhotoBusy}
                      >
                        <Trash2 size={15} /> Remove
                      </button>
                    )}
                  </div>
                </div>

                <div className="pulse-social-stats pulse-social-stats-three">
                  <div>
                    <strong>{profilePosts.length}</strong>
                    <span>Posts</span>
                  </div>
                  <button onClick={() => setRelationshipView(relationshipView === 'followers' ? null : 'followers')}>
                    <strong>{followerUids.length}</strong>
                    <span>Followers</span>
                  </button>
                  <button onClick={() => setRelationshipView(relationshipView === 'following' ? null : 'following')}>
                    <strong>{followingUids.length}</strong>
                    <span>Following</span>
                  </button>
                </div>

                {relationshipView && (
                  <div className="pulse-settings-card">
                    <h3>{relationshipView === 'followers' ? 'Your followers' : 'People you follow'}</h3>
                    {(relationshipView === 'followers' ? followerUids : followingUids).map(uid => {
                      const person = relationshipProfiles[uid];
                      return (
                        <div className="pulse-relationship-row" key={uid}>
                          {person ? (
                            <>
                              <Avatar name={person.displayName} photoURL={person.photoURL} small />
                              <span>
                                <strong>{person.displayName}</strong>
                                <small>@{person.username}</small>
                              </span>
                            </>
                          ) : (
                            <span><small>Loading member profile…</small></span>
                          )}
                          {relationshipView === 'following' && (
                            <button onClick={() => person && void toggleFollow(person)}>Unfollow</button>
                          )}
                        </div>
                      );
                    })}
                    {(relationshipView === 'followers' ? followerUids : followingUids).length === 0 && (
                      <p>No {relationshipView} yet.</p>
                    )}
                  </div>
                )}

                <div className="pulse-profile-post-heading">
                  <strong>Your posts</strong>
                  <span>{profilePosts.length}</span>
                </div>
                <div className="pulse-profile-post-grid">
                  {profilePosts.map(post => (
                    <article className="pulse-profile-post-tile" key={post.id}>
                      {post.postType === 'image' && post.mediaURL ? (
                        <img src={post.mediaURL} alt="Your post" loading="lazy" />
                      ) : post.postType === 'video' && post.mediaURL ? (
                        <video src={post.mediaURL} controls preload="metadata" />
                      ) : (
                        <p>{post.caption || 'Post'}</p>
                      )}
                    </article>
                  ))}
                  {profilePosts.length === 0 && (
                    <div className="pulse-profile-no-posts">
                      Your published posts will appear here.
                    </div>
                  )}
                </div>

                <section className="pulse-profile-settings">
                  <button
                    type="button"
                    className="pulse-profile-settings-trigger"
                    aria-expanded={profileSettingsOpen}
                    onClick={() => setProfileSettingsOpen(value => !value)}
                  >
                    <span>
                      <strong><Settings size={17} /> Profile settings</strong>
                      <small>Edit your details, photo and discoverability</small>
                    </span>
                    <ChevronDown size={18} className={profileSettingsOpen ? 'pulse-chevron-open' : ''} />
                  </button>

                  {profileSettingsOpen && (
                    <div className="pulse-profile-settings-content">
                      <div className="pulse-settings-card">
                        <div className="pulse-settings-heading">
                          <div>
                            <strong>Edit your profile</strong>
                            <p>Update your display name, username and biography.</p>
                          </div>
                        </div>
                        {!editingProfile ? (
                          <button onClick={() => {
                            setEditDisplayName(profile?.displayName ?? displayName);
                            setEditUsername(profile?.username ?? '');
                            setEditBio(profile?.bio ?? '');
                            setEditingProfile(true);
                          }}>
                            Edit profile details
                          </button>
                        ) : (
                          <form className="pulse-profile-edit-form" onSubmit={event => {
                            event.preventDefault();
                            void saveProfile();
                          }}>
                            <label>Display name
                              <input value={editDisplayName} onChange={event => setEditDisplayName(event.target.value)} maxLength={60} required />
                            </label>
                            <label>Username
                              <input value={editUsername} onChange={event => setEditUsername(event.target.value)} maxLength={30} required />
                            </label>
                            <label>Bio
                              <textarea value={editBio} onChange={event => setEditBio(event.target.value)} maxLength={160} rows={3} />
                              <small>{editBio.length}/160</small>
                            </label>
                            <div className="pulse-profile-actions">
                              <button type="button" onClick={() => setEditingProfile(false)}>Cancel</button>
                              <button type="submit" disabled={profileSaving}>
                                {profileSaving ? 'Saving…' : 'Save profile'}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>

                      <div className="pulse-settings-card">
                        <div className="pulse-settings-heading">
                          <ShieldCheck size={20} />
                          <div>
                            <strong>Discoverability</strong>
                            <p>Control whether other PULSE members can find your public profile.</p>
                          </div>
                        </div>
                        <button
                          className={`pulse-privacy-toggle ${profile?.discoverable ? 'enabled' : ''}`}
                          onClick={() => void toggleDiscoverability()}
                          disabled={privacyBusy || !profile}
                          aria-pressed={Boolean(profile?.discoverable)}
                        >
                          <span>{profile?.discoverable ? 'Discoverable' : 'Hidden from Explore'}</span>
                          <span className="pulse-toggle-track"><i /></span>
                        </button>
                        <p className="pulse-privacy-explanation">
                          {profile?.discoverable
                            ? 'Your public profile can be found by other members. Your email address remains private.'
                            : 'Your profile is excluded from member discovery. You can turn discoverability back on at any time.'}
                        </p>
                      </div>
                    </div>
                  )}
                </section>
              </>
            )}
          </section>
        )}

      </main>

      {!(activeTab === 'Chats' && selectedId) && (
      <nav className="pulse-bottom-nav" aria-label="Main navigation">
        {tabs.map(({ label, icon: Icon }) => (
          <button
            key={label}
            className={activeTab === label ? 'active' : ''}
            onClick={() => {
              setAccountMenuOpen(false);
              if (label === 'Chats') {
                setSelectedId(null);
                setActiveTab('Chats');
                return;
              }
              if (label === 'Profile') {
                setViewedProfile(null);
                setRelationshipView(null);
                setEditingProfile(false);
              }
              setActiveTab(label);
            }}
            aria-current={activeTab === label ? 'page' : undefined}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      )}
    </div>
  );
}

export default App;
