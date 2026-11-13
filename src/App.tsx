import type { CSSProperties } from 'react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  ArrowUpRight,
  PlusSquare,
  Pin,
  Plus,
  Compass,
  Camera,
  ChevronDown,
  ChevronRight,
  Settings,
  Trash2,
  LogOut,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  Phone,
  Reply,
  Video,
  Palette,
  MoreVertical,
  Copy,
  X,
  Heart,
  MessageSquare,
  UserPlus,
  UsersRound,
  AtSign,
  CheckCheck,
} from 'lucide-react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { startPresence, setPresenceVisibility, watchPresence, type ContactPresence } from './lib/pulse-presence';
import {
  publishUserProfile,
  uploadProfilePhoto,
  removeProfilePhoto,
  uploadProfileCover,
  removeProfileCover,
  watchMemberPosts,
  setDiscoverability,
  watchFollowing,
  watchFollowers,
  watchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
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
  watchConversationReadReceipts,
  watchMessageReactions,
  setMessageReaction,
  setConversationPinnedMessage,
  watchOwnProfile,
  watchProfile,
  type PublicProfile,
  type PulseConversation,
  type PulseMessage,
  type PulsePost,
  type PulseConversationPreference,
  type PulseConversationAppearance,
  type PulseReadReceipt,
  type PulseReaction,
  type PulseNotification,
} from './lib/pulse-data';
import type { PulseMessageReply } from './lib/pulse-data';


type Tab = 'Chats' | 'Explore' | 'Create' | 'Activity' | 'Profile';


const MESSAGE_REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

const BUBBLE_COLOR_PALETTE = [
  '#2563eb', '#0ea5e9', '#0891b2', '#0d9488',
  '#16a34a', '#65a30d', '#ca8a04', '#ea580c',
  '#dc2626', '#e11d48', '#c026d3', '#9333ea',
  '#64748b', '#475569', '#334155', '#202a38',
];

function hexToHsl(hex: string) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }

  return {
    h: (h + 360) % 360,
    s: saturation * 100,
    l: lightness * 100,
  };
}

function hslToHex(h: number, s: number, l: number) {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  const [r, g, b] = h < 60 ? [chroma, x, 0]
    : h < 120 ? [x, chroma, 0]
    : h < 180 ? [0, chroma, x]
    : h < 240 ? [0, x, chroma]
    : h < 300 ? [x, 0, chroma]
    : [chroma, 0, x];

  return `#${[r, g, b].map(
    channel => Math.round((channel + m) * 255).toString(16).padStart(2, '0')
  ).join('')}`;
}


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

function messageDateSeparatorLabel(value: unknown): string {
  if (!value || typeof value !== 'object') return '';

  const timestamp = value as { toDate?: () => Date };
  if (typeof timestamp.toDate !== 'function') return '';

  const date = timestamp.toDate();
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const todayKey = Date.UTC(
    now.getFullYear(), now.getMonth(), now.getDate()
  );
  const messageKey = Date.UTC(
    date.getFullYear(), date.getMonth(), date.getDate()
  );
  const daysAgo = Math.round((todayKey - messageKey) / 86400000);

  if (daysAgo === 0) return 'TODAY';
  if (daysAgo === 1) return 'YESTERDAY';

  if (daysAgo >= 2 && daysAgo <= 6) {
    return date.toLocaleDateString([], { weekday: 'long' }).toUpperCase();
  }

  const month = date.toLocaleDateString([], { month: 'long' }).toUpperCase();
  const label = `${date.getDate()} ${month}`;

  return date.getFullYear() === now.getFullYear()
    ? label
    : `${label} ${date.getFullYear()}`;
}

function inboxDateLabel(value: unknown): string {
  if (!value || typeof value !== 'object') return '';

  const timestamp = value as { toDate?: () => Date };
  if (typeof timestamp.toDate !== 'function') return '';

  const date = timestamp.toDate();
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();

  const todayKey = Date.UTC(
    now.getFullYear(), now.getMonth(), now.getDate()
  );
  const messageKey = Date.UTC(
    date.getFullYear(), date.getMonth(), date.getDate()
  );

  const daysAgo = Math.round(
    (todayKey - messageKey) / 86400000
  );

  if (daysAgo <= 0) {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (daysAgo === 1) return 'Yesterday';

  if (daysAgo <= 6) {
    return date.toLocaleDateString([], { weekday: 'long' });
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
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

function notificationDate(value: unknown): string {
  let date: Date | null = null;

  if (value instanceof Date) {
    date = value;
  } else if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    date = (value as { toDate: () => Date }).toDate();
  }

  if (!date || Number.isNaN(date.getTime())) return 'Just now';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function App() {
  const [user, setUser] = useState<User | null>(auth?.currentUser ?? null);
  const [authReady, setAuthReady] = useState(Boolean(auth?.currentUser));
  const [booting, setBooting] = useState(true);

  const [activeTab, setActiveTab] = useState<Tab>('Chats');
  const [activitySection, setActivitySection] = useState<'Notifications' | 'Discover'>('Notifications');
  const [discoverSearch, setDiscoverSearch] = useState('');
  const [discoverShowAll, setDiscoverShowAll] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission | 'unsupported'>(() =>
      typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
    );
  const [notificationReminderDismissed, setNotificationReminderDismissed] = useState(false);

  useEffect(() => {
    if (activeTab === 'Activity') {
      setNotificationReminderDismissed(false);
    }
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;
    let permissionStatus: PermissionStatus | null = null;

    const syncNotificationPermission = () => {
      setNotificationPermission(
        typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
      );
    };

    syncNotificationPermission();
    window.addEventListener('focus', syncNotificationPermission);
    document.addEventListener('visibilitychange', syncNotificationPermission);

    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'notifications' as PermissionName })
        .then(status => {
          if (cancelled) return;
          permissionStatus = status;
          permissionStatus.addEventListener('change', syncNotificationPermission);
          syncNotificationPermission();
        })
        .catch(() => {
          // Focus and visibility events remain as the cross-browser fallback.
        });
    }

    return () => {
      cancelled = true;
      window.removeEventListener('focus', syncNotificationPermission);
      document.removeEventListener('visibilitychange', syncNotificationPermission);
      permissionStatus?.removeEventListener('change', syncNotificationPermission);
    };
  }, []);
  const [notificationFilter, setNotificationFilter] = useState<'All' | 'Likes' | 'Comments' | 'Follows' | 'Mentions'>('All');
  const [notifications, setNotifications] = useState<PulseNotification[]>([]);
  const [notificationBusy, setNotificationBusy] = useState(false);
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
  const [profileCoverBusy, setProfileCoverBusy] = useState(false);
  const [profileCoverProgress, setProfileCoverProgress] = useState(0);
  const [viewedFollowingUids, setViewedFollowingUids] = useState<string[]>([]);
  const [viewedFollowerUids, setViewedFollowerUids] = useState<string[]>([]);
  const [profileTimelinePosts, setProfileTimelinePosts] = useState<PulsePost[]>([]);
  const [profileContentTab, setProfileContentTab] = useState<'Posts' | 'Videos' | 'Photos'>('Posts');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [conversationProfiles, setConversationProfiles] = useState<Record<string, PublicProfile>>({});
  const [conversations, setConversations] = useState<PulseConversation[]>([]);
  const [latestMessages, setLatestMessages] = useState<Record<string, PulseMessage | null>>({});
  const [conversationPreferences, setConversationPreferences] = useState<Record<string, PulseConversationPreference>>({});
  const [messages, setMessages] = useState<PulseMessage[]>([]);
  const [readReceipts, setReadReceipts] = useState<Record<string, PulseReadReceipt>>({});
  const [messageReactions, setMessageReactions] = useState<Record<string, PulseReaction[]>>({});
  const messageIds = useMemo(
    () => messages.map(message => message.id).join('|'),
    [messages],
  );
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<PulseMessage | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressMessageClickRef = useRef(false);
  const quoteHighlightTimerRef = useRef<number | null>(null);
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
  const profileReturnRef = useRef<{
    activeTab: Tab;
    activitySection: 'Notifications' | 'Discover';
    discoverShowAll: boolean;
    discoverSearch: string;
    notificationFilter: 'All' | 'Likes' | 'Comments' | 'Follows' | 'Mentions';
  } | null>(null);
  const profileTargetRef = useRef<PublicProfile | null>(null);
  const followBusyRef = useRef<Set<string>>(new Set());

  const [viewedProfile, setViewedProfile] = useState<PublicProfile | null>(null);
  const [messageText, setMessageText] = useState('');
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  useEffect(() => {
    setSelectedMessageId(null);
    setReplyingTo(null);
    setConversationMenuOpen(false);
  }, [selectedId]);
  const [conversationMenuOpen, setConversationMenuOpen] = useState(false);
  const [callMenuOpen, setCallMenuOpen] = useState(false);
  const conversationHeadingRef = useRef<HTMLDivElement | null>(null);
  const conversationMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
    }
    if (quoteHighlightTimerRef.current !== null) {
      window.clearTimeout(quoteHighlightTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!conversationMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (
        !conversationHeadingRef.current?.contains(target) &&
        !conversationMenuRef.current?.contains(target)
      ) {
        setConversationMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConversationMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [conversationMenuOpen]);

  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [mediaBrowserOpen, setMediaBrowserOpen] = useState(false);
  const [pinnedMessagesOpen, setPinnedMessagesOpen] = useState(false);
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [appearanceDraft, setAppearanceDraft] = useState<PulseConversationAppearance>({
    theme: 'midnight',
    background: 'plain',
    fontSize: 'medium',
    bubbleStyle: 'rounded',
    wallpaperURL: null,
    wallpaperPath: null,
    wallpaperId: 'none',
    wallpaperMotion: 'none',
    sentBubbleColor: '#2459a6',
    receivedBubbleColor: '#202a38',
    brightness: 68,
    bubbleOpacity: 100,
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

  const discardAppearanceChanges = () => {
    const unsavedWallpaperPath = appearanceDraft.wallpaperPath;

    setAppearanceDraft({
      theme: savedConversationAppearance?.theme ?? 'midnight',
      background: savedConversationAppearance?.background ?? 'plain',
      fontSize: savedConversationAppearance?.fontSize ?? 'medium',
      bubbleStyle: savedConversationAppearance?.bubbleStyle ?? 'rounded',
      wallpaperURL: savedConversationAppearance?.wallpaperURL ?? null,
      wallpaperPath: savedConversationAppearance?.wallpaperPath ?? null,
      wallpaperId: savedConversationAppearance?.wallpaperId ?? 'none',
      wallpaperMotion: savedConversationAppearance?.wallpaperMotion ?? 'none',
      sentBubbleColor: savedConversationAppearance?.sentBubbleColor ?? '#2459a6',
      receivedBubbleColor: savedConversationAppearance?.receivedBubbleColor ?? '#202a38',
      brightness: savedConversationAppearance?.brightness ?? 68,
      bubbleOpacity: savedConversationAppearance?.bubbleOpacity ?? 100,
    });

    setAppearanceOpen(false);
    void cleanUnsavedWallpaper(unsavedWallpaperPath);
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
      wallpaperId: saved?.wallpaperId ?? 'none',
      wallpaperMotion: saved?.wallpaperMotion ?? 'none',
      sentBubbleColor: saved?.sentBubbleColor ?? '#2459a6',
      receivedBubbleColor: saved?.receivedBubbleColor ?? '#202a38',
      brightness: saved?.brightness ?? 68,
      bubbleOpacity: saved?.bubbleOpacity ?? 100,
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
      // Appearance is the top layer: Back closes it before leaving the conversation.
      if (selectedId && appearanceOpen) {
        const previousState =
          event.state && typeof event.state === 'object' ? event.state : {};

        window.history.pushState(
          { ...previousState, pulseConversationId: selectedId },
          '',
          window.location.href,
        );

        discardAppearanceChanges();
        return;
      }

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

      const nextHistoryState =
        event.state && typeof event.state === 'object' ? event.state : {};

      // Browser Forward restores a member profile.
      if (!selectedId && nextHistoryState.pulseProfile
          && profileTargetRef.current && profileReturnRef.current) {
        setViewedProfile(profileTargetRef.current);
        setRelationshipView(null);
        setEditingProfile(false);
        setActiveTab('Profile');
        return;
      }

      // Browser Forward restores the full Discover directory.
      if (!selectedId && nextHistoryState.pulseDiscoverDirectory
          && activeTab === 'Activity' && activitySection === 'Discover') {
        setDiscoverShowAll(true);
        return;
      }

      // Back from a member profile restores its originating tab and filters.
      if (!selectedId && activeTab === 'Profile' && viewedProfile
          && profileReturnRef.current) {
        const origin = profileReturnRef.current;
        setViewedProfile(null);
        setRelationshipView(null);
        setEditingProfile(false);
        setActiveTab(origin.activeTab);
        setActivitySection(origin.activitySection);
        setDiscoverShowAll(origin.discoverShowAll);
        setDiscoverSearch(origin.discoverSearch);
        setNotificationFilter(origin.notificationFilter);
        return;
      }

      // Back from the directory returns to Discover home.
      if (!selectedId && activeTab === 'Activity'
          && activitySection === 'Discover' && discoverShowAll) {
        setDiscoverShowAll(false);
        return;
      }

      // Close transient account UI before allowing the browser to leave PULSE.
      if (accountMenuOpen) setAccountMenuOpen(false);
      if (showNewChat) setShowNewChat(false);
      if (profileSettingsOpen) setProfileSettingsOpen(false);
    }

    window.addEventListener('popstate', handleBrowserBack);
    return () => window.removeEventListener('popstate', handleBrowserBack);
  }, [
    selectedId,
    activeTab,
    viewedProfile,
    activitySection,
    discoverShowAll,
    appearanceOpen,
    accountMenuOpen,
    showNewChat,
    profileSettingsOpen,
  ]);

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
      setNotifications([]);
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
          watchNotifications(
            user.uid,
            value => { if (active) setNotifications(value); },
            err => { if (active) setError('Notifications: ' + err.message); },
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
    if (!selectedId || !user) {
      setReadReceipts({});
      return;
    }

    setReadReceipts({});
    return watchConversationReadReceipts(
      selectedId,
      setReadReceipts,
      err => setError('Message read receipts: ' + err.message),
    );
  }, [selectedId, user]);

  // Subscribe to reactions by stable message IDs, not message object identity.
  // This avoids rebuilding listeners when unrelated message state changes.
  useEffect(() => {
    if (!selectedId || !user || !messageIds) {
      setMessageReactions({});
      return;
    }

    const ids = messageIds.split('|');
    const activeIds = new Set(ids);

    setMessageReactions(current =>
      Object.fromEntries(
        Object.entries(current).filter(([messageId]) => activeIds.has(messageId)),
      ),
    );

    const unsubscribers = ids.map(messageId =>
      watchMessageReactions(
        selectedId,
        messageId,
        reactions => {
          setMessageReactions(current => ({
            ...current,
            [messageId]: reactions,
          }));
        },
        err => setError('Message reactions: ' + err.message),
      ),
    );

    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [selectedId, user, messageIds]);

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

    const updateReadPosition = () => {
      if (document.visibilityState !== 'visible') return;

      void markConversationRead(user.uid, selectedId).catch(err => {
        setError(err instanceof Error ? err.message : 'Could not update read status.');
      });
    };

    updateReadPosition();
    document.addEventListener('visibilitychange', updateReadPosition);

    return () => {
      document.removeEventListener('visibilitychange', updateReadPosition);
    };
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

  useEffect(() => {
    if (!user) {
      setProfileTimelinePosts([]);
      return;
    }

    const targetUid = viewedProfile?.uid ?? user.uid;
    let active = true;

    const unsubscribe = watchMemberPosts(
      targetUid,
      items => {
        if (active) setProfileTimelinePosts(items);
      },
      error => {
        if (active) setError('Profile posts: ' + error.message);
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [user, viewedProfile?.uid]);

  useEffect(() => {
    if (!viewedProfile || viewedProfile.uid === user?.uid) {
      setViewedFollowingUids([]);
      setViewedFollowerUids([]);
      return;
    }

    let active = true;
    const unsubscribeFollowing = watchFollowing(
      viewedProfile.uid,
      items => { if (active) setViewedFollowingUids(items); },
      error => { if (active) setError('Profile following: ' + error.message); },
    );
    const unsubscribeFollowers = watchFollowers(
      viewedProfile.uid,
      items => { if (active) setViewedFollowerUids(items); },
      error => { if (active) setError('Profile followers: ' + error.message); },
    );

    return () => {
      active = false;
      unsubscribeFollowing();
      unsubscribeFollowers();
    };
  }, [viewedProfile?.uid, user?.uid]);

  useEffect(() => {
    setProfileContentTab('Posts');
    setRelationshipView(null);
  }, [viewedProfile?.uid]);

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

  const peopleYouMayKnow = useMemo(() => {
    const alreadyFollowing = new Set(followingUids);

    return [...new Set(followerUids)]
      .filter(uid => uid !== user?.uid && !alreadyFollowing.has(uid))
      .map(uid => peopleByUid.get(uid))
      .filter(
        (person): person is PublicProfile =>
          Boolean(person && person.discoverable === true),
      );
  }, [peopleByUid, followerUids, followingUids, user?.uid]);

  const newOnPulse = useMemo(() => {
    const suggestedUids = new Set(peopleYouMayKnow.map(person => person.uid));

    const createdAtMillis = (value: unknown): number => {
      if (value instanceof Date) return value.getTime();
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      if (value && typeof value === 'object') {
        const timestamp = value as {
          toMillis?: () => number;
          seconds?: number;
        };
        if (typeof timestamp.toMillis === 'function') {
          return timestamp.toMillis();
        }
        if (typeof timestamp.seconds === 'number') {
          return timestamp.seconds * 1000;
        }
      }
      return 0;
    };

    return people
      .filter(person => !suggestedUids.has(person.uid))
      .slice()
      .sort((a, b) => createdAtMillis(b.createdAt) - createdAtMillis(a.createdAt));
  }, [people, peopleYouMayKnow]);

  const unreadNotificationCount = notifications.filter(
    notification => notification.readAt == null,
  ).length;

  const visibleNotifications = useMemo(() => {
    if (notificationFilter === 'All') return notifications;

    const typeByFilter = {
      Likes: 'like',
      Comments: 'comment',
      Follows: 'follow',
      Mentions: 'mention',
    } as const;

    return notifications.filter(
      notification => notification.type === typeByFilter[notificationFilter],
    );
  }, [notifications, notificationFilter]);

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
    () => profileTimelinePosts.filter(post => {
      if (post.ownerUid !== (viewedProfile?.uid ?? user?.uid)) return false;
      if (!post.expiresAt) return true;

      const expiryValue = post.expiresAt as {
        toDate?: () => Date;
        toMillis?: () => number;
      };

      if (typeof expiryValue.toMillis === 'function') {
        return expiryValue.toMillis() > Date.now();
      }
      if (typeof expiryValue.toDate === 'function') {
        return expiryValue.toDate().getTime() > Date.now();
      }
      return true;
    }),
    [profileTimelinePosts, viewedProfile?.uid, user?.uid],
  );

  const visibleProfilePosts = useMemo(
    () => profileContentTab === 'Videos'
      ? profilePosts.filter(post => post.postType === 'video')
      : profileContentTab === 'Photos'
        ? profilePosts.filter(post => post.postType === 'image')
        : profilePosts,
    [profilePosts, profileContentTab],
  );

  const displayedFollowerUids = viewedProfile
    ? viewedFollowerUids
    : followerUids;

  const displayedFollowingUids = viewedProfile
    ? viewedFollowingUids
    : followingUids;

  const selectedConversation = conversations.find(
    conversation => conversation.id === selectedId,
  );

  const selectedPerson = selectedConversation
    ? peopleByUid.get(otherUid(selectedConversation))
    : undefined;

  const conversationMedia = messages.filter(
    item => item.type !== 'text' && Boolean(item.attachmentURL),
  );

  const conversationLinks = messages.flatMap(item => {
    const matches = item.text?.match(/https?:\/\/[^\s<>"']+/g) ?? [];
    return matches.map(url => ({
      id: `${item.id}-${url}`,
      url: url.replace(/[),.!?;:]+$/, ''),
      message: item,
    }));
  });

  const pinnedMessageIds = selectedId
    ? conversationPreferences[selectedId]?.pinnedMessageIds ?? []
    : [];

  const pinnedMessages = messages.filter(item => pinnedMessageIds.includes(item.id));
  const selectedMessage = messages.find(item => item.id === selectedMessageId) ?? null;

  const normalizedMessageSearch = messageSearchQuery.trim().toLocaleLowerCase();
  const messageSearchResults = normalizedMessageSearch
    ? [...messages].reverse().filter(item =>
        `${item.text ?? ''} ${item.attachmentName ?? ''}`
          .toLocaleLowerCase()
          .includes(normalizedMessageSearch),
      )
    : [];

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

  async function enableBrowserNotifications() {
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request notification permission.');
    }
  }

  async function toggleFollow(person: PublicProfile) {
    if (!user || followBusyRef.current.has(person.uid)) return;

    followBusyRef.current.add(person.uid);
    setError('');
    try {
      if (followingUids.includes(person.uid)) {
        await unfollowMember(user.uid, person.uid);
      } else {
        await followMember(user.uid, person.uid);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Follow action failed.');
    } finally {
      followBusyRef.current.delete(person.uid);
    }
  }

  function openMemberProfile(person: PublicProfile) {
    profileReturnRef.current = {
      activeTab,
      activitySection,
      discoverShowAll,
      discoverSearch,
      notificationFilter,
    };
    profileTargetRef.current = person;

    window.history.pushState(
      {
        ...(window.history.state && typeof window.history.state === 'object'
          ? window.history.state
          : {}),
        pulseProfile: true,
      },
      '',
      window.location.href,
    );

    setViewedProfile(person);
    setRelationshipView(null);
    setEditingProfile(false);
    setActiveTab('Profile');
  }

  function openDiscoverDirectory() {
    window.history.pushState(
      {
        ...(window.history.state && typeof window.history.state === 'object'
          ? window.history.state
          : {}),
        pulseDiscoverDirectory: true,
      },
      '',
      window.location.href,
    );

    setDiscoverSearch('');
    setDiscoverShowAll(true);
  }

  async function markAllActivityRead() {
    if (!user || notificationBusy || unreadNotificationCount === 0) return;

    setNotificationBusy(true);
    setError('');

    try {
      await markAllNotificationsRead(user.uid, notifications);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Notifications could not be marked as read.');
    } finally {
      setNotificationBusy(false);
    }
  }

  async function markActivityRead(notification: PulseNotification) {
    if (!user || notification.readAt != null) return;

    try {
      await markNotificationRead(user.uid, notification.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Notification could not be marked as read.');
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

  function createReplySnapshot(item: PulseMessage): PulseMessageReply {
    return {
      messageId: item.id,
      senderId: item.senderId,
      senderName: item.senderId === user?.uid
        ? (profile?.displayName || user?.displayName || 'You')
        : (selectedPerson?.displayName || 'Contact'),
      text: item.text || '',
      type: item.type,
      ...(item.attachmentName ? { attachmentName: item.attachmentName } : {}),
    };
  }

  function startReply(item: PulseMessage) {
    setReplyingTo(item);
    setSelectedMessageId(null);
    setConversationMenuOpen(false);
  }

  function jumpToQuotedMessage(messageId: string) {
    setSelectedMessageId(messageId);
    window.requestAnimationFrame(() => {
      document.getElementById(`pulse-message-${messageId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });

    if (quoteHighlightTimerRef.current !== null) {
      window.clearTimeout(quoteHighlightTimerRef.current);
    }
    quoteHighlightTimerRef.current = window.setTimeout(() => {
      setSelectedMessageId(current => current === messageId ? null : current);
      quoteHighlightTimerRef.current = null;
    }, 2200);
  }

  async function sendMessage() {
    if (!user || !selectedId || !messageText.trim() || sending) return;

    setSending(true);
    setError('');

    try {
      await sendTextMessage(
        selectedId,
        user.uid,
        messageText,
        replyingTo ? createReplySnapshot(replyingTo) : undefined,
      );
      setMessageText('');
      setReplyingTo(null);
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

  async function changeProfileCover(file: File | undefined) {
    if (!user || !file || profileCoverBusy) return;

    setProfileCoverBusy(true);
    setProfileCoverProgress(0);
    setError('');

    try {
      await uploadProfileCover(user.uid, file, setProfileCoverProgress);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cover photo upload failed.');
    } finally {
      setProfileCoverBusy(false);
    }
  }

  async function clearProfileCover() {
    if (!user || profileCoverBusy || !profile?.coverPhotoURL) return;

    setProfileCoverBusy(true);
    setError('');

    try {
      await removeProfileCover(user.uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cover photo could not be removed.');
    } finally {
      setProfileCoverBusy(false);
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
      {activeTab === 'Chats' && !selectedId && (
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

      <main className={`pulse-content ${activeTab === 'Chats' ? 'pulse-content-chats' : ''} ${activeTab === 'Chats' && selectedId ? 'pulse-conversation-active' : ''} ${activeTab === 'Activity' ? 'pulse-content-activity' : ''}`}>

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
                  <div ref={conversationHeadingRef} className="pulse-chat-heading">
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
                        setConversationMenuOpen(false);
                      }}
                    >
                      <Avatar
                        name={selectedPerson?.displayName ?? 'PULSE member'}
                        photoURL={selectedPerson?.photoURL}
                      />
                      <span className="pulse-chat-contact-identity">
                        <strong>{selectedPerson?.displayName ?? 'PULSE member'}</strong>
                        <small>{selectedPerson ? `@${selectedPerson.username}` : 'Private conversation'}</small>
                      </span>
                    </button>

                    <div className="pulse-chat-presence-slot" aria-live="polite">
                      {selectedPerson && contactPresence.available ? (
                        <span className={`pulse-chat-presence-label ${contactPresence.online ? 'online' : 'offline'}`}>
                          <span />
                          {contactPresence.online
                            ? 'Online'
                            : formatPresenceLastSeen(contactPresence.lastSeen, presenceNow)}
                        </span>
                      ) : (
                        <span className="pulse-chat-presence-label"> </span>
                      )}
                    </div>

                    <div className="pulse-chat-call-actions">
                      <div className="pulse-call-dropdown-wrap">
                        <button
                          type="button"
                          className="pulse-call-dropdown-trigger"
                          title="Calling options"
                          aria-label="Open voice and video calling options"
                          aria-haspopup="menu"
                          aria-expanded={callMenuOpen}
                          onClick={() => {
                            setCallMenuOpen(value => !value);
                            setConversationMenuOpen(false);
                          }}
                        >
                          <Phone size={18} />
                          <ChevronDown size={14} />
                        </button>
                        {callMenuOpen && (
                          <div className="pulse-call-dropdown" role="menu" aria-label="Calling options">
                            <button type="button" role="menuitem" disabled title="Voice calling will be available in the WebRTC audio/video milestone">
                              <Phone size={16} />
                              <span>Voice call</span>
                              <small>Coming soon</small>
                            </button>
                            <button type="button" role="menuitem" disabled title="Video calling will be available in the WebRTC audio/video milestone">
                              <Video size={16} />
                              <span>Video call</span>
                              <small>Coming soon</small>
                            </button>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="pulse-chat-menu-trigger"
                        title="Conversation options"
                        aria-label="Open conversation options"
                        aria-haspopup="menu"
                        aria-expanded={conversationMenuOpen}
                        onClick={() => setConversationMenuOpen(value => !value)}
                      >
                        <MoreVertical size={19} />
                      </button>
                    </div>
                  </div>

                  {conversationMenuOpen && (
                    <div
                      ref={conversationMenuRef}
                      className="pulse-conversation-menu"
                      role="menu"
                      aria-label={selectedMessage ? 'Selected message options' : 'Conversation options'}
                    >
                      {selectedMessage ? (
                        <>
                          <div className="pulse-context-menu-heading">
                            <strong>Message options</strong>
                            <small>{selectedMessage.text || selectedMessage.attachmentName || 'Shared attachment'}</small>
                          </div>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              startReply(selectedMessage);
                              setConversationMenuOpen(false);
                              setSelectedMessageId(null);
                            }}
                          >
                            <Reply size={17} /> Reply
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={async () => {
                              const pinned = pinnedMessageIds.includes(selectedMessage.id);
                              try {
                                await setConversationPinnedMessage(
                                  user.uid,
                                  selectedId!,
                                  selectedMessage.id,
                                  !pinned,
                                );
                                setConversationMenuOpen(false);
                                setSelectedMessageId(null);
                              } catch (actionError) {
                                setError(actionError instanceof Error ? actionError.message : 'Could not update pinned message.');
                              }
                            }}
                          >
                            <Pin size={17} /> {pinnedMessageIds.includes(selectedMessage.id) ? 'Unpin message' : 'Pin message'}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            disabled={!selectedMessage.text}
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(selectedMessage.text);
                                setConversationMenuOpen(false);
                                setSelectedMessageId(null);
                              } catch {
                                setError('Clipboard access is unavailable in this browser.');
                              }
                            }}
                          >
                            <Copy size={17} /> Copy text
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setConversationMenuOpen(false);
                              setSelectedMessageId(null);
                            }}
                          >
                            <X size={17} /> Dismiss selection
                          </button>
                        </>
                      ) : (
                        <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setConversationMenuOpen(false);
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
                        <UserRound size={17} /> View contact
                      </button>

                      <div className="pulse-conversation-menu-divider" />

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setConversationMenuOpen(false);
                          setAppearanceOpen(true);
                        }}
                      >
                        <Palette size={17} /> Chat theme
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setConversationMenuOpen(false);
                          setMessageSearchQuery('');
                          setMessageSearchOpen(true);
                        }}
                      >
                        <Search size={17} /> Search messages
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setConversationMenuOpen(false);
                          setMediaBrowserOpen(true);
                        }}
                      >
                        <Camera size={17} /> Media, links and documents
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setConversationMenuOpen(false);
                          setPinnedMessagesOpen(true);
                        }}
                      >
                        <Pin size={17} /> Pinned messages
                        {pinnedMessages.length > 0 && <small>{pinnedMessages.length}</small>}
                      </button>

                      <div className="pulse-conversation-menu-divider" />

                      <button type="button" role="menuitem" disabled title="Conversation notification controls are being implemented">
                        <Bell size={17} /> Mute notifications
                        <small>Coming soon</small>
                      </button>

                      <button type="button" role="menuitem" disabled title="Disappearing messages are being implemented">
                        <X size={17} /> Disappearing messages
                        <small>Coming soon</small>
                      </button>
                        </>
                      )}
                    </div>
                  )}

                  {messageSearchOpen && selectedId && (
                    <section className="pulse-message-search" aria-label="Search conversation messages">
                      <div className="pulse-message-search-heading">
                        <div>
                          <strong>Search messages</strong>
                          <small>Search text and attachment names in this conversation.</small>
                        </div>
                        <button
                          type="button"
                          aria-label="Close message search"
                          onClick={() => {
                            setMessageSearchOpen(false);
                            setMessageSearchQuery('');
                          }}
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div className="pulse-message-search-input">
                        <Search size={17} />
                        <input
                          autoFocus
                          type="search"
                          value={messageSearchQuery}
                          onChange={event => setMessageSearchQuery(event.target.value)}
                          placeholder="Search this conversation…"
                          aria-label="Search this conversation"
                        />
                        {messageSearchQuery && (
                          <button
                            type="button"
                            aria-label="Clear search"
                            onClick={() => setMessageSearchQuery('')}
                          >
                            <X size={15} />
                          </button>
                        )}
                      </div>

                      <div className="pulse-message-search-results" aria-live="polite">
                        {!normalizedMessageSearch ? (
                          <p className="pulse-message-search-hint">
                            Enter a word, phrase or attachment name to search.
                          </p>
                        ) : messageSearchResults.length === 0 ? (
                          <p className="pulse-message-search-hint">
                            No messages found for “{messageSearchQuery.trim()}”.
                          </p>
                        ) : (
                          <>
                            <div className="pulse-message-search-count">
                              {messageSearchResults.length} {messageSearchResults.length === 1 ? 'result' : 'results'}
                            </div>
                            {messageSearchResults.map(item => (
                              <button
                                type="button"
                                className="pulse-message-search-result"
                                key={item.id}
                                onClick={() => {
                                  setMessageSearchOpen(false);
                                  window.requestAnimationFrame(() => {
                                    document
                                      .getElementById(`pulse-message-${item.id}`)
                                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  });
                                }}
                              >
                                <span className="pulse-message-search-result-top">
                                  <strong>
                                    {item.senderId === user?.uid
                                      ? 'You'
                                      : selectedPerson?.displayName || 'Contact'}
                                  </strong>
                                  <small>{timestampLabel(item.createdAt)}</small>
                                </span>
                                <span className="pulse-message-search-result-text">
                                  {item.text || item.attachmentName || 'Shared attachment'}
                                </span>
                                {item.type !== 'text' && (
                                  <small className="pulse-message-search-attachment">
                                    {item.type.toUpperCase()} attachment
                                  </small>
                                )}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    </section>
                  )}

                  {mediaBrowserOpen && selectedId && (
                    <section className="pulse-conversation-library" aria-label="Conversation media">
                      <div className="pulse-library-heading">
                        <div>
                          <strong>Media, links and documents</strong>
                          <small>{conversationMedia.length} shared files · {conversationLinks.length} links</small>
                        </div>
                        <button type="button" aria-label="Close media library" onClick={() => setMediaBrowserOpen(false)}>
                          <X size={18} />
                        </button>
                      </div>

                      <div className="pulse-library-section">
                        <strong>Shared media and documents</strong>
                        {conversationMedia.length === 0 ? (
                          <p className="pulse-library-empty">No files have been shared in this conversation yet.</p>
                        ) : (
                          <div className="pulse-library-grid">
                            {[...conversationMedia].reverse().map(item => (
                              <a className="pulse-library-item" href={item.attachmentURL} target="_blank" rel="noreferrer" key={item.id}>
                                {item.type === 'image' ? (
                                  <img src={item.attachmentURL} alt={item.attachmentName || 'Shared image'} loading="lazy" />
                                ) : item.type === 'video' ? (
                                  <video src={item.attachmentURL} preload="metadata" />
                                ) : (
                                  <span className="pulse-library-document">
                                    <strong>DOC</strong>
                                    <small>{item.attachmentContentType || 'Document'}</small>
                                  </span>
                                )}
                                <span className="pulse-library-file-name">{item.attachmentName || item.type}</span>
                                <small>{timestampLabel(item.createdAt)}</small>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pulse-library-section">
                        <strong>Shared links</strong>
                        {conversationLinks.length === 0 ? (
                          <p className="pulse-library-empty">No links have been shared in this conversation yet.</p>
                        ) : (
                          <div className="pulse-shared-links">
                            {[...conversationLinks].reverse().map(link => (
                              <a href={link.url} target="_blank" rel="noopener noreferrer" key={link.id}>
                                <span>{link.url}</span>
                                <small>{link.message.senderId === user?.uid ? 'You' : selectedPerson?.displayName || 'Contact'} · {timestampLabel(link.message.createdAt)}</small>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {pinnedMessagesOpen && selectedId && user && (
                    <section className="pulse-conversation-library" aria-label="Pinned messages">
                      <div className="pulse-library-heading">
                        <div>
                          <strong>Pinned messages</strong>
                          <small>Private to your PULSE account</small>
                        </div>
                        <button type="button" aria-label="Close pinned messages" onClick={() => setPinnedMessagesOpen(false)}>
                          <X size={18} />
                        </button>
                      </div>
                      {pinnedMessages.length === 0 ? (
                        <p className="pulse-library-empty">No pinned messages yet. Select a message and choose Pin to save it here.</p>
                      ) : (
                        <div className="pulse-pinned-list">
                          {pinnedMessages.map(item => (
                            <button type="button" className="pulse-pinned-item" key={item.id} onClick={() => {
                              setPinnedMessagesOpen(false);
                              window.requestAnimationFrame(() => {
                                document.getElementById(`pulse-message-${item.id}`)
                                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              });
                            }}>
                              <strong>{item.senderId === user.uid ? 'You' : selectedPerson?.displayName || 'Contact'}</strong>
                              <span>{item.text || item.attachmentName || 'Shared attachment'}</span>
                              <small>{timestampLabel(item.createdAt)}</small>
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                  )}

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

                      <div className="pulse-appearance-scroll">
                      <div
                        className="pulse-appearance-preview"
                        data-theme={appearanceDraft.theme}
                        data-background={appearanceDraft.background}
                        data-font-size={appearanceDraft.fontSize}
                        data-bubble-style={appearanceDraft.bubbleStyle}
                        data-wallpaper={appearanceDraft.wallpaperId ?? 'none'}
                        data-brightness={appearanceDraft.brightness ?? 68}
                        data-bubble-opacity={appearanceDraft.bubbleOpacity ?? 100}
                        style={{
                          '--pulse-sent-bubble': appearanceDraft.sentBubbleColor ?? '#2459a6',
                          '--pulse-received-bubble': appearanceDraft.receivedBubbleColor ?? '#202a38',
                          '--pulse-bubble-opacity': (appearanceDraft.bubbleOpacity ?? 100) / 100,
                          '--pulse-wallpaper-dim': Math.max(0, (100 - (appearanceDraft.brightness ?? 68)) / 100 * 0.72),
                          ...(appearanceDraft.wallpaperURL ? {
                            backgroundImage: `url("${appearanceDraft.wallpaperURL}")`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          } : {}),
                        } as CSSProperties}
                      >
                        <div className="pulse-appearance-preview-heading">
                          <strong>Live preview</strong>
                          <span>Changes appear here before saving</span>
                        </div>
                        <div className="pulse-appearance-preview-messages">
                          <div className="pulse-preview-bubble incoming">
                            Hey! How are you?
                            <small>10:42</small>
                          </div>
                          <div className="pulse-preview-bubble outgoing">
                            I'm good, thanks!
                            <small>10:43 <span className="pulse-read-receipt is-read">✓✓</span></small>
                          </div>
                        </div>
                      </div>

                      <div className="pulse-appearance-grid">
                        <label>Theme
                          <select value={appearanceDraft.theme} onChange={event => setAppearanceDraft(v => ({ ...v, theme: event.target.value as PulseConversationAppearance['theme'] }))}>
                            <option value="midnight">Classic Dark</option>
                            <option value="pulse-blue">PULSE Blue</option>
                            <option value="ocean">Oceanic</option>
                            <option value="light">Classic Light</option>
                            <option value="amoled">AMOLED Black</option>
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
                            <option value="rounded">Classic rounded</option>
                            <option value="soft">Soft rounded</option>
                            <option value="square">Square</option>
                            <option value="compact">Compact</option>
                            <option value="whatsapp">WhatsApp style</option>
                            <option value="messenger">Messenger style</option>
                            <option value="pill">Pill</option>
                            <option value="minimal">Minimal / flat</option>
                          </select>
                        </label>
                      </div>

                      <section className="pulse-theme-library" aria-label="Wallpaper library">
                        <div className="pulse-theme-section-heading">
                          <strong>Wallpaper library</strong>
                          <small>Choose a background for this conversation.</small>
                        </div>

                        <div className="pulse-wallpaper-grid">
                          {([
                            ['none', 'Original', 'original'],
                            ['minimal', 'Minimal', 'minimal'],
                            ['doodle', 'Doodles', 'doodle'],
                            ['nature-ocean', 'Ocean', 'ocean'],
                            ['nature-forest', 'Forest', 'forest'],
                            ['nature-mountains', 'Mountains', 'mountains'],
                            ['nature-sunset', 'Sunset', 'sunset'],
                            ['aurora', 'Aurora', 'aurora'],
                          ] as const).map(([id, label, preview]) => (
                            <button
                              key={id}
                              type="button"
                              className="pulse-wallpaper-choice"
                              data-wallpaper-preview={preview}
                              data-selected={(appearanceDraft.wallpaperId ?? 'none') === id}
                              aria-pressed={(appearanceDraft.wallpaperId ?? 'none') === id}
                              onClick={async () => {
                                // Remove an uploaded draft wallpaper when it is
                                // replaced by a built-in wallpaper. Saved files
                                // are protected by cleanUnsavedWallpaper().
                                await cleanUnsavedWallpaper(appearanceDraft.wallpaperPath);

                                setAppearanceDraft(v => ({
                                  ...v,
                                  wallpaperId: id,
                                  wallpaperMotion: id === 'aurora' ? 'aurora' : 'none',
                                  wallpaperURL: null,
                                  wallpaperPath: null,
                                }));
                              }}
                            >
                              <span className="pulse-wallpaper-swatch" />
                              <span>{label}</span>
                            </button>
                          ))}
                        </div>
                      </section>

                      <section className="pulse-theme-controls" aria-label="Message appearance controls">
                        <div className="pulse-theme-section-heading">
                          <strong>Message bubbles</strong>
                          <small>Personalise incoming and outgoing messages.</small>
                        </div>

                        <div className="pulse-bubble-color-editors">
                          {([
                            { key: 'sentBubbleColor', label: 'Sent messages', fallback: '#2459a6' },
                            { key: 'receivedBubbleColor', label: 'Received messages', fallback: '#202a38' },
                          ] as const).map(({ key, label, fallback }) => {
                            const selectedColor = appearanceDraft[key] ?? fallback;
                            const hue = hexToHsl(selectedColor);

                            return (
                              <div className="pulse-bubble-color-editor" key={key}>
                                <div className="pulse-bubble-color-title">
                                  <strong>{label}</strong>
                                  <span>{selectedColor.toUpperCase()}</span>
                                </div>

                                <div className="pulse-bubble-color-palette">
                                  {BUBBLE_COLOR_PALETTE.map(color => (
                                    <button
                                      key={color}
                                      type="button"
                                      className="pulse-bubble-color-swatch"
                                      style={{ backgroundColor: color }}
                                      data-selected={selectedColor.toLowerCase() === color}
                                      aria-label={`${label} colour ${color}`}
                                      aria-pressed={selectedColor.toLowerCase() === color}
                                      onClick={() => setAppearanceDraft(v => ({
                                        ...v, [key]: color,
                                      }))}
                                    />
                                  ))}
                                </div>

                                <label className="pulse-bubble-hue-control">
                                  <span>
                                    Adjust colour
                                    <strong>{Math.round(hue.h)}°</strong>
                                  </span>
                                  <input
                                    type="range"
                                    min="0"
                                    max="359"
                                    step="1"
                                    value={Math.round(hue.h)}
                                    onChange={event => setAppearanceDraft(v => ({
                                      ...v,
                                      [key]: hslToHex(
                                        Number(event.target.value),
                                        Math.max(55, hue.s),
                                        hue.l,
                                      ),
                                    }))}
                                  />
                                </label>
                              </div>
                            );
                          })}
                        </div>

                        <label className="pulse-theme-range">
                          <span>Background brightness <strong>{appearanceDraft.brightness ?? 68}%</strong></span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={appearanceDraft.brightness ?? 68}
                            onChange={event => setAppearanceDraft(v => ({
                              ...v, brightness: Number(event.target.value),
                            }))}
                          />
                        </label>

                        <label className="pulse-theme-range">
                          <span>Bubble transparency <strong>{appearanceDraft.bubbleOpacity ?? 100}%</strong></span>
                          <input
                            type="range"
                            min="50"
                            max="100"
                            step="1"
                            value={appearanceDraft.bubbleOpacity ?? 100}
                            onChange={event => setAppearanceDraft(v => ({
                              ...v, bubbleOpacity: Number(event.target.value),
                            }))}
                          />
                        </label>

                        <label className="pulse-theme-motion">
                          <span>Wallpaper motion</span>
                          <select
                            value={appearanceDraft.wallpaperMotion ?? 'none'}
                            onChange={event => setAppearanceDraft(v => ({
                              ...v,
                              wallpaperMotion: event.target.value as NonNullable<PulseConversationAppearance['wallpaperMotion']>,
                            }))}
                          >
                            <option value="none">Still wallpaper</option>
                            <option value="aurora">Moving aurora</option>
                            <option value="flow">Flowing gradient</option>
                          </select>
                        </label>
                      </section>

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

                      </div>

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
                              wallpaperId: 'none',
                              wallpaperMotion: 'none',
                              sentBubbleColor: '#2459a6',
                              receivedBubbleColor: '#202a38',
                              brightness: 68,
                              bubbleOpacity: 100,
                            });
                          }}
                        >Reset preview</button>
                        <button
                          type="button"
                          disabled={appearanceSaving}
                          onClick={() => void discardAppearanceChanges()}
                        >Cancel</button>
                        <button
                          type="button"
                          disabled={appearanceSaving}
                          onClick={async () => {
                            if (appearanceSaving) return;

                            setAppearanceSaving(true);
                            try {
                              const savedAppearance = { ...appearanceDraft };
                              const previousWallpaperPath =
                                savedConversationAppearance?.wallpaperPath ?? null;

                              await setConversationAppearance(
                                user.uid,
                                selectedId,
                                savedAppearance,
                              );

                              // Update the active conversation immediately instead of
                              // waiting for the Firestore preferences listener.
                              setConversationPreferences(current => ({
                                ...current,
                                [selectedId]: {
                                  ...current[selectedId],
                                  appearance: savedAppearance,
                                },
                              }));
                              setAppearanceDraft(savedAppearance);
                              setAppearanceOpen(false);
                              setError('');

                              // Storage cleanup must not delay the successful save UI.
                              if (
                                previousWallpaperPath &&
                                previousWallpaperPath !== savedAppearance.wallpaperPath
                              ) {
                                void removeConversationWallpaper(previousWallpaperPath)
                                  .catch(cleanupError => {
                                    console.warn(
                                      'Appearance saved, but the previous wallpaper could not be deleted:',
                                      cleanupError,
                                    );
                                  });
                              }
                            } catch (saveError) {
                              setError(saveError instanceof Error
                                ? saveError.message
                                : 'Could not save chat appearance.');
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
                    data-wallpaper={appearanceDraft.wallpaperId ?? 'none'}
                    data-motion={appearanceDraft.wallpaperMotion ?? 'none'}
                    data-brightness={appearanceDraft.brightness ?? 68}
                    data-bubble-opacity={appearanceDraft.bubbleOpacity ?? 100}
                    style={{
                      '--pulse-sent-bubble': appearanceDraft.sentBubbleColor ?? '#2459a6',
                      '--pulse-received-bubble': appearanceDraft.receivedBubbleColor ?? '#202a38',
                      '--pulse-bubble-opacity': (appearanceDraft.bubbleOpacity ?? 100) / 100,
                      '--pulse-wallpaper-dim': Math.max(0, (100 - (appearanceDraft.brightness ?? 68)) / 100 * 0.72),
                      ...(appearanceDraft.wallpaperURL ? {
                        backgroundImage: `url("${appearanceDraft.wallpaperURL}")`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      } : {}),
                    } as CSSProperties}
                  >
                    {messages.length === 0 ? (
                      <div className="pulse-empty-chat">
                        <ShieldCheck size={27} />
                        <strong>Start a private conversation</strong>
                        <p>Your messages are stored in your PULSE account and synchronized live.</p>
                      </div>
                    ) : messages.map((item, index) => {
                      const mine = item.senderId === user.uid;
                      const currentDateLabel = messageDateSeparatorLabel(item.createdAt);
                      const previousDateLabel = index > 0
                        ? messageDateSeparatorLabel(messages[index - 1].createdAt)
                        : '';
                      const showDateSeparator = Boolean(
                        currentDateLabel && currentDateLabel !== previousDateLabel
                      );
                      const recipientReadAt = selectedPerson?.uid
                        ? timestampMillis(readReceipts[selectedPerson.uid]?.lastReadAt)
                        : 0;
                      const messageCreatedAt = timestampMillis(item.createdAt);
                      const wasRead = mine
                        && messageCreatedAt > 0
                        && recipientReadAt >= messageCreatedAt;
                      return (
                        <Fragment key={item.id}>
                          {showDateSeparator && (
                            <div className="pulse-date-separator" role="separator">
                              <span>{currentDateLabel}</span>
                            </div>
                          )}
                          <div
                          id={`pulse-message-${item.id}`}
                          className={`pulse-message-row ${mine ? 'mine' : ''}${selectedMessageId === item.id ? ' is-selected' : ''}`}
                          onClick={() => {
                            if (suppressMessageClickRef.current) {
                              suppressMessageClickRef.current = false;
                              return;
                            }
                            setSelectedMessageId(current => current === item.id ? null : item.id);
                            setConversationMenuOpen(false);
                          }}
                          onTouchStart={event => {
                            const touch = event.touches[0];
                            if (!touch) return;
                            touchStartRef.current = {
                              x: touch.clientX,
                              y: touch.clientY,
                            };
                            suppressMessageClickRef.current = false;

                            if (longPressTimerRef.current !== null) {
                              window.clearTimeout(longPressTimerRef.current);
                            }
                            longPressTimerRef.current = window.setTimeout(() => {
                              setSelectedMessageId(item.id);
                              setConversationMenuOpen(false);
                              suppressMessageClickRef.current = true;
                              longPressTimerRef.current = null;
                            }, 520);
                          }}
                          onTouchMove={event => {
                            const touch = event.touches[0];
                            const start = touchStartRef.current;
                            if (!touch || !start) return;

                            const dx = touch.clientX - start.x;
                            const dy = touch.clientY - start.y;

                            if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                              if (longPressTimerRef.current !== null) {
                                window.clearTimeout(longPressTimerRef.current);
                                longPressTimerRef.current = null;
                              }
                            }

                            if (dx > 58 && Math.abs(dx) > Math.abs(dy) * 1.35) {
                              if (longPressTimerRef.current !== null) {
                                window.clearTimeout(longPressTimerRef.current);
                                longPressTimerRef.current = null;
                              }
                              touchStartRef.current = null;
                              suppressMessageClickRef.current = true;
                              if (event.cancelable) event.preventDefault();
                              startReply(item);
                            }
                          }}
                          onTouchEnd={() => {
                            if (longPressTimerRef.current !== null) {
                              window.clearTimeout(longPressTimerRef.current);
                              longPressTimerRef.current = null;
                            }
                            touchStartRef.current = null;
                            if (suppressMessageClickRef.current) {
                              window.setTimeout(() => {
                                suppressMessageClickRef.current = false;
                              }, 500);
                            }
                          }}
                          onTouchCancel={() => {
                            if (longPressTimerRef.current !== null) {
                              window.clearTimeout(longPressTimerRef.current);
                              longPressTimerRef.current = null;
                            }
                            touchStartRef.current = null;
                          }}
                          onContextMenu={event => {
                            event.preventDefault();
                            setSelectedMessageId(item.id);
                            setConversationMenuOpen(false);
                          }}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedMessageId(current => current === item.id ? null : item.id);
                            }
                          }}
                          tabIndex={0}
                          aria-label={`Message from ${mine ? 'you' : selectedPerson?.displayName || 'contact'}. Select for reactions and message options.`}
                        >
                          {selectedMessageId === item.id && (
                            <div className="pulse-message-reaction-picker" aria-label="Add a reaction">
                              {MESSAGE_REACTION_EMOJIS.map(emoji => {
                                const ownReaction = (messageReactions[item.id] ?? [])
                                  .find(reaction => reaction.uid === user.uid)?.emoji;
                                return (
                                  <button
                                    type="button"
                                    key={emoji}
                                    className={ownReaction === emoji ? 'is-active' : ''}
                                    aria-label={`${ownReaction === emoji ? 'Remove' : 'React with'} ${emoji}`}
                                    aria-pressed={ownReaction === emoji}
                                    onClick={async event => {
                                      event.stopPropagation();
                                      try {
                                        await setMessageReaction(
                                          user.uid,
                                          selectedId!,
                                          item.id,
                                          ownReaction === emoji ? null : emoji,
                                        );
                                        setSelectedMessageId(current =>
                                          current === item.id ? null : current,
                                        );
                                      } catch (actionError) {
                                        setError(actionError instanceof Error
                                          ? actionError.message
                                          : 'Could not save reaction.');
                                      }
                                    }}
                                  >
                                    {emoji}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <div className={`pulse-message-bubble${(messageReactions[item.id] ?? []).length > 0 ? ' has-reactions' : ''}`}>
                            {item.replyTo && (
                              <button
                                type="button"
                                className="pulse-message-quote"
                                onClick={event => {
                                  event.stopPropagation();
                                  jumpToQuotedMessage(item.replyTo!.messageId);
                                }}
                                aria-label={`Jump to message from ${item.replyTo.senderName}`}
                              >
                                <strong>{item.replyTo.senderName}</strong>
                                <span>
                                  {item.replyTo.type === 'image' ? 'Photo' :
                                   item.replyTo.type === 'video' ? 'Video' :
                                   item.replyTo.type === 'document'
                                     ? (item.replyTo.attachmentName || 'Document')
                                     : (item.replyTo.text || 'Message')}
                                </span>
                              </button>
                            )}
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
                            {pinnedMessageIds.includes(item.id) && (
                              <span className="pulse-message-pinned-indicator" title="Pinned message">
                                <Pin size={11} /> Pinned
                              </span>
                            )}
                            <small className="pulse-message-meta">
                              <span>{timestampLabel(item.createdAt)}</span>
                              {mine && (
                                <span
                                  className={`pulse-read-receipt${wasRead ? ' is-read' : ''}`}
                                  aria-label={wasRead ? 'Read' : 'Unread'}
                                  title={wasRead ? 'Read' : 'Sent, not yet read'}
                                >✓✓</span>
                              )}
                            </small>
                            {(messageReactions[item.id] ?? []).length > 0 && (
                              <div className="pulse-message-reaction-summary" aria-label="Message reactions">
                                {MESSAGE_REACTION_EMOJIS.map(emoji => {
                                  const count = (messageReactions[item.id] ?? [])
                                    .filter(reaction => reaction.emoji === emoji).length;
                                  if (!count) return null;
                                  const own = (messageReactions[item.id] ?? [])
                                    .some(reaction => reaction.uid === user.uid && reaction.emoji === emoji);
                                  return (
                                    <span key={emoji} className={own ? 'is-own-reaction' : ''}>
                                      {emoji}<small>{count}</small>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>

                  <div className="pulse-composer-dock">
                  {attachmentBusy && (
                    <div className="pulse-upload-progress">
                      <span>Uploading attachment… {attachmentProgress}%</span>
                      <progress value={attachmentProgress} max="100" />
                    </div>
                  )}
                  {replyingTo && (
                    <div className="pulse-reply-composer-preview">
                      <div>
                        <strong>Replying to {
                          replyingTo.senderId === user?.uid
                            ? 'yourself'
                            : (selectedPerson?.displayName || 'Contact')
                        }</strong>
                        <span>
                          {replyingTo.type === 'image' ? 'Photo' :
                           replyingTo.type === 'video' ? 'Video' :
                           replyingTo.type === 'document'
                             ? (replyingTo.attachmentName || 'Document')
                             : (replyingTo.text || 'Message')}
                        </span>
                      </div>
                      <button
                        type="button"
                        aria-label="Cancel reply"
                        onClick={() => setReplyingTo(null)}
                      >
                        <X size={17} />
                      </button>
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
                  </div>
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
                        openMemberProfile(author);
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
          <section className="pulse-standard-page pulse-activity-page">
            <span className="pulse-eyebrow">YOUR PULSE COMMUNITY</span>
            <div className="pulse-activity-heading">
              <div>
                <h1>What’s happening</h1>
                <p className="pulse-lead">Catch up with your people, discover new connections and see what’s happening across PULSE.</p>
              </div>
              {unreadNotificationCount > 0 && (
                <span className="pulse-activity-unread-count">
                  {unreadNotificationCount} unread
                </span>
              )}
            </div>

            {notificationPermission !== 'granted' &&
              notificationPermission !== 'unsupported' &&
              !notificationReminderDismissed && (
                <div className="pulse-notification-permission" role="status">
                  <div className="pulse-notification-permission-copy">
                    <strong>Stay in the loop</strong>
                    <p>
                      {notificationPermission === 'denied'
                        ? 'Notifications are blocked for PULSE. Change this site’s notification permission in your browser settings, then return here.'
                        : 'Get browser alerts for activity on PULSE. You can change this permission later in your browser settings.'}
                    </p>
                  </div>
                  <div className="pulse-notification-permission-actions">
                    {notificationPermission === 'default' && (
                      <button
                        type="button"
                        className="pulse-profile-action primary"
                        onClick={() => void enableBrowserNotifications()}
                      >
                        <Bell size={15} /> Enable notifications
                      </button>
                    )}
                    <button
                      type="button"
                      className="pulse-notification-dismiss"
                      onClick={() => setNotificationReminderDismissed(true)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

            <div className="pulse-activity-sections" role="tablist" aria-label="Activity sections">
              <button
                type="button"
                role="tab"
                aria-selected={activitySection === 'Notifications'}
                className={activitySection === 'Notifications' ? 'active' : ''}
                onClick={() => setActivitySection('Notifications')}
              >
                <Bell size={17} />
                Notifications
                {unreadNotificationCount > 0 && (
                  <span>{unreadNotificationCount}</span>
                )}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activitySection === 'Discover'}
                className={activitySection === 'Discover' ? 'active' : ''}
                onClick={() => setActivitySection('Discover')}
              >
                <UsersRound size={17} />
                Discover
              </button>
            </div>

            {activitySection === 'Notifications' ? (
              <>
                <div className="pulse-notification-toolbar">
                  <div className="pulse-notification-filters" aria-label="Filter notifications">
                    {(['All', 'Likes', 'Comments', 'Follows', 'Mentions'] as const).map(filter => (
                      <button
                        type="button"
                        key={filter}
                        className={notificationFilter === filter ? 'active' : ''}
                        aria-pressed={notificationFilter === filter}
                        onClick={() => setNotificationFilter(filter)}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="pulse-mark-read"
                    disabled={notificationBusy || unreadNotificationCount === 0}
                    onClick={markAllActivityRead}
                  >
                    <CheckCheck size={15} />
                    Mark all as read
                  </button>
                </div>

                {visibleNotifications.length > 0 ? (
                  <div className="pulse-notification-list">
                    {visibleNotifications.map(notification => {
                      const actor = peopleByUid.get(notification.actorUid);
                      const isUnread = notification.readAt == null;
                      const message = notification.type === 'follow'
                        ? 'started following you'
                        : notification.type === 'like'
                          ? 'liked your post'
                          : notification.type === 'comment'
                            ? 'commented on your post'
                            : notification.type === 'mention'
                              ? 'mentioned you'
                              : 'reposted your post';

                      return (
                        <article
                          className={`pulse-notification-item${isUnread ? ' unread' : ''}`}
                          key={notification.id}
                        >
                          <button
                            type="button"
                            className="pulse-notification-main"
                            onClick={() => {
                              void markActivityRead(notification);
                              if (!actor) return;
                              openMemberProfile(actor);
                            }}
                          >
                            {actor ? (
                              <Avatar name={actor.displayName} photoURL={actor.photoURL} />
                            ) : (
                              <span className="pulse-notification-avatar">
                                {notification.type === 'follow' ? <UserPlus size={19} /> : <Bell size={19} />}
                              </span>
                            )}
                            <span className="pulse-notification-copy">
                              <strong>{actor?.displayName || 'A PULSE member'}</strong>
                              <span>{message}</span>
                              <small>{notificationDate(notification.createdAt)}</small>
                            </span>
                          </button>
                          {isUnread && <span className="pulse-notification-unread-dot" aria-label="Unread" />}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="pulse-empty-card pulse-activity-empty">
                    {notificationFilter === 'All' ? <Bell size={30} /> :
                      notificationFilter === 'Likes' ? <Heart size={30} /> :
                      notificationFilter === 'Comments' ? <MessageSquare size={30} /> :
                      notificationFilter === 'Follows' ? <UserPlus size={30} /> :
                      <AtSign size={30} />}
                    <h2>
                      {notificationFilter === 'All'
                        ? 'You’re all caught up'
                        : `No ${notificationFilter.toLowerCase()} yet`}
                    </h2>
                    <p>
                      {notificationFilter === 'All'
                        ? 'New follows and other genuine interactions will appear here.'
                        : notificationFilter === 'Follows'
                          ? 'When someone follows you, their activity will appear here.'
                          : `${notificationFilter} notifications will appear when those real interaction features are available.`}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="pulse-discover-panel">
                {discoverShowAll ? (
                  <>
                    <div className="pulse-discover-intro">
                      <div>
                        <h2>Explore people</h2>
                        <p>Find members and choose who you'd like to connect with.</p>
                      </div>
                      <button
                        type="button"
                        className="pulse-discover-text-action"
                        onClick={() => window.history.back()}
                      >
                        Back to Discover
                      </button>
                    </div>

                    <label className="pulse-discover-search">
                      <Search size={17} />
                      <input
                        type="search"
                        value={discoverSearch}
                        onChange={event => setDiscoverSearch(event.target.value)}
                        placeholder="Search by name or username"
                        aria-label="Search PULSE members"
                      />
                      {discoverSearch && (
                        <button
                          type="button"
                          onClick={() => setDiscoverSearch('')}
                          aria-label="Clear search"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </label>

                    {(() => {
                      const term = discoverSearch.trim().toLowerCase();
                      const members = people.filter(person =>
                        !term ||
                        person.displayName.toLowerCase().includes(term) ||
                        person.username.toLowerCase().includes(term)
                      );

                      return members.length > 0 ? (
                        <div className="pulse-discover-directory">
                          {members.map(person => {
                            const isFollowing = followingUids.includes(person.uid);
                            const followsYou = followerUids.includes(person.uid);

                            return (
                              <article className="pulse-discover-directory-item" key={person.uid}>
                                <button
                                  type="button"
                                  className="pulse-discover-person"
                                  onClick={() => {
                                    openMemberProfile(person);
                                  }}
                                >
                                  <Avatar name={person.displayName} photoURL={person.photoURL} />
                                  <span className="pulse-discover-person-copy">
                                    <strong>{person.displayName}</strong>
                                    <span>@{person.username}</span>
                                    {followsYou && <small>Follows you</small>}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  className={`pulse-profile-action${isFollowing ? '' : ' primary'}`}
                                  onClick={() => void toggleFollow(person)}
                                >
                                  {isFollowing ? 'Following' : followsYou ? 'Follow back' : 'Follow'}
                                </button>
                              </article>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="pulse-discover-section-empty">
                          {term
                            ? 'No members match that search. Try another name or username.'
                            : 'No discoverable members are available yet.'}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <div className="pulse-discover-intro">
                      <div>
                        <h2>Discover</h2>
                        <p>Find people to connect with across your PULSE community.</p>
                      </div>
                      <span>{people.length} members</span>
                    </div>

                    <section className="pulse-discover-feature">
                      <div className="pulse-discover-feature-heading">
                        <div>
                          <span className="pulse-discover-kicker">BUILD CONNECTIONS</span>
                          <h3>People you may know</h3>
                          <p>Members who already follow you.</p>
                        </div>
                        <span className="pulse-discover-count">{peopleYouMayKnow.length}</span>
                      </div>

                      {peopleYouMayKnow.length > 0 ? (
                        <div className="pulse-discover-people-row">
                          {peopleYouMayKnow.slice(0, 8).map(person => (
                            <article className="pulse-discover-person-tile" key={person.uid}>
                              <button
                                type="button"
                                className="pulse-discover-person-tile-profile"
                                onClick={() => {
                                  openMemberProfile(person);
                                }}
                              >
                                <Avatar name={person.displayName} photoURL={person.photoURL} />
                                <strong>{person.displayName}</strong>
                                <span>@{person.username}</span>
                                <small>Follows you</small>
                              </button>
                              <button
                                type="button"
                                className={`pulse-profile-action${followingUids.includes(person.uid) ? '' : ' primary'}`}
                                onClick={() => void toggleFollow(person)}
                              >
                                {followingUids.includes(person.uid) ? 'Following' : 'Follow back'}
                              </button>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="pulse-discover-section-empty">
                          No new follow-back suggestions right now. New connections will appear here.
                        </div>
                      )}
                    </section>

                    <section className="pulse-discover-feature pulse-discover-new">
                      <div className="pulse-discover-feature-heading">
                        <div>
                          <span className="pulse-discover-kicker">FRESH CONNECTIONS</span>
                          <h3>New on PULSE</h3>
                          <p>Recently joined discoverable members.</p>
                        </div>
                        <button
                          type="button"
                          className="pulse-discover-text-action"
                          onClick={() => {
                            openDiscoverDirectory();
                          }}
                        >
                          See all <ArrowUpRight size={15} />
                        </button>
                      </div>

                      {newOnPulse.length > 0 ? (
                        <div className="pulse-discover-new-preview">
                          {newOnPulse.slice(0, 3).map(person => (
                            <button
                              type="button"
                              className="pulse-discover-new-person"
                              key={person.uid}
                              onClick={() => {
                                openMemberProfile(person);
                              }}
                            >
                              <Avatar name={person.displayName} photoURL={person.photoURL} small />
                              <span>
                                <strong>{person.displayName}</strong>
                                <small>@{person.username}</small>
                              </span>
                              <ChevronRight size={17} />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="pulse-discover-section-empty">
                          New member profiles will appear here when people join PULSE.
                        </div>
                      )}
                    </section>

                    <div className="pulse-discover-directory-link">
                      <div>
                        <strong>Looking for someone?</strong>
                        <p>Search the discoverable PULSE community.</p>
                      </div>
                      <button
                        type="button"
                        className="pulse-profile-action primary"
                        onClick={() => {
                          openDiscoverDirectory();
                        }}
                      >
                        Explore people <ArrowUpRight size={15} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {activeTab === 'Profile' && (
          <section className="pulse-standard-page pulse-social-profile-page">
            {viewedProfile && viewedProfile.uid !== user.uid ? (
              <>
                <div className="pulse-social-cover">
                  {viewedProfile.coverPhotoURL ? (
                    <img src={viewedProfile.coverPhotoURL} alt={`${viewedProfile.displayName}'s cover`} />
                  ) : (
                    <div className="pulse-social-cover-placeholder" aria-hidden="true" />
                  )}
                </div>

                <div className="pulse-social-profile-heading">
                  <Avatar
                    name={viewedProfile.displayName}
                    photoURL={viewedProfile.photoURL}
                  />
                  <h1>{viewedProfile.displayName}</h1>
                  <span>@{viewedProfile.username}</span>
                  {viewedProfile.bio && <p>{viewedProfile.bio}</p>}
                  {viewedProfile.location && (
                    <span className="pulse-profile-location">{viewedProfile.location}</span>
                  )}
                  {timestampMillis((viewedProfile as PublicProfile & { createdAt?: unknown }).createdAt) > 0 && (
                    <span className="pulse-profile-joined">
                      Joined {new Date(timestampMillis((viewedProfile as PublicProfile & { createdAt?: unknown }).createdAt)).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </span>
                  )}

                  <div className="pulse-social-stats pulse-social-stats-three pulse-public-profile-stats">
                    <div>
                      <strong>{profilePosts.length}</strong>
                      <span>Posts</span>
                    </div>
                    <div>
                      <strong>{displayedFollowerUids.length}</strong>
                      <span>Followers</span>
                    </div>
                    <div>
                      <strong>{displayedFollowingUids.length}</strong>
                      <span>Following</span>
                    </div>
                  </div>

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

                <div className="pulse-profile-content-tabs" role="tablist" aria-label="Profile content">
                  {(['Posts', 'Videos', 'Photos'] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={profileContentTab === tab}
                      className={profileContentTab === tab ? 'active' : ''}
                      onClick={() => setProfileContentTab(tab)}
                    >
                      {tab}
                      <span>
                        {tab === 'Posts'
                          ? profilePosts.length
                          : profilePosts.filter(post => tab === 'Videos'
                            ? post.postType === 'video'
                            : post.postType === 'image').length}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="pulse-profile-post-grid">
                  {visibleProfilePosts.map(post => (
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
                  {visibleProfilePosts.length === 0 && (
                    <div className="pulse-profile-no-posts">
                      {profileContentTab === 'Posts'
                        ? 'This member has not published any posts yet.'
                        : `No ${profileContentTab.toLowerCase()} have been shared yet.`}
                    </div>
                  )}
                </div>
                <p className="pulse-profile-privacy-note">
                  Only public profile information and published posts are shown here.
                </p>
              </>
            ) : (
              <>
                <div className="pulse-social-cover">
                  {profile?.coverPhotoURL ? (
                    <img src={profile.coverPhotoURL} alt="Your profile cover" />
                  ) : (
                    <div className="pulse-social-cover-placeholder" aria-hidden="true" />
                  )}
                  <div className="pulse-cover-controls">
                    <label className="pulse-photo-upload">
                      <Camera size={15} />
                      {profileCoverBusy
                        ? `Uploading ${profileCoverProgress}%`
                        : 'Change cover'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={profileCoverBusy}
                        onChange={event => {
                          const file = event.currentTarget.files?.[0];
                          void changeProfileCover(file);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                    {profile?.coverPhotoURL && (
                      <button
                        type="button"
                        className="pulse-photo-remove"
                        onClick={() => void clearProfileCover()}
                        disabled={profileCoverBusy}
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    )}
                  </div>
                </div>

                <div className="pulse-social-profile-heading">
                  <Avatar name={displayName} photoURL={profile?.photoURL} />
                  <h1>{displayName}</h1>
                  <span>@{profile?.username ?? user.uid.slice(0, 10)}</span>
                  {profile?.bio && <p>{profile.bio}</p>}
                  {profile?.location && (
                    <span className="pulse-profile-location">{profile.location}</span>
                  )}
                  {timestampMillis((profile as (PublicProfile & { createdAt?: unknown }) | null)?.createdAt) > 0 && (
                    <span className="pulse-profile-joined">
                      Joined {new Date(timestampMillis((profile as (PublicProfile & { createdAt?: unknown }) | null)?.createdAt)).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </span>
                  )}
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
                    <strong>{displayedFollowerUids.length}</strong>
                    <span>Followers</span>
                  </button>
                  <button onClick={() => setRelationshipView(relationshipView === 'following' ? null : 'following')}>
                    <strong>{displayedFollowingUids.length}</strong>
                    <span>Following</span>
                  </button>
                </div>

                {relationshipView && (
                  <div className="pulse-settings-card">
                    <h3>{relationshipView === 'followers' ? 'Your followers' : 'People you follow'}</h3>
                    {(relationshipView === 'followers' ? displayedFollowerUids : displayedFollowingUids).map(uid => {
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
                    {(relationshipView === 'followers' ? displayedFollowerUids : displayedFollowingUids).length === 0 && (
                      <p>No {relationshipView} yet.</p>
                    )}
                  </div>
                )}

                <div className="pulse-profile-content-tabs" role="tablist" aria-label="Your profile content">
                  {(['Posts', 'Videos', 'Photos'] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={profileContentTab === tab}
                      className={profileContentTab === tab ? 'active' : ''}
                      onClick={() => setProfileContentTab(tab)}
                    >
                      {tab}
                      <span>
                        {tab === 'Posts'
                          ? profilePosts.length
                          : profilePosts.filter(post => tab === 'Videos'
                            ? post.postType === 'video'
                            : post.postType === 'image').length}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="pulse-profile-post-grid">
                  {visibleProfilePosts.map(post => (
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
                  {visibleProfilePosts.length === 0 && (
                    <div className="pulse-profile-no-posts">
                      {profileContentTab === 'Posts'
                        ? 'Your published posts will appear here.'
                        : `You have not shared any ${profileContentTab.toLowerCase()} yet.`}
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
              if (label === 'Activity') {
                setActivitySection('Notifications');
                setNotificationFilter('All');
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
