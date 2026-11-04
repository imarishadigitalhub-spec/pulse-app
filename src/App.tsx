import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Bell,
  CirclePlay,
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
} from 'lucide-react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from './lib/firebase';
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
  startDirectConversation,
  watchConversations,
  watchDiscoverablePeople,
  watchMessages,
  watchLatestMessage,
  watchOwnProfile,
  watchProfile,
  type PublicProfile,
  type PulseConversation,
  type PulseMessage,
} from './lib/pulse-data';

type Tab = 'Chats' | 'Updates' | 'Explore' | 'Activity' | 'Profile';

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
  const [profileReturnTo, setProfileReturnTo] = useState<'chat' | 'explore'>('explore');
  const [conversationProfiles, setConversationProfiles] = useState<Record<string, PublicProfile>>({});
  const [conversations, setConversations] = useState<PulseConversation[]>([]);
  const [latestMessages, setLatestMessages] = useState<Record<string, PulseMessage | null>>({});
  const [messages, setMessages] = useState<PulseMessage[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewedProfile, setViewedProfile] = useState<PublicProfile | null>(null);
  const [messageText, setMessageText] = useState('');
  const [conversationSearch, setConversationSearch] = useState('');
  const [peopleSearch, setPeopleSearch] = useState('');

  const [sending, setSending] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [error, setError] = useState('');

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
        return {
          conversation,
          partner,
          latest: latestMessages[conversation.id] ?? null,
        };
      })
      .filter(item => {
        if (!term) return true;
        return (
          item.partner.displayName.toLowerCase().includes(term) ||
          item.partner.username.toLowerCase().includes(term) ||
          (item.latest?.text ?? '').toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        const aTime = timestampMillis(a.latest?.createdAt) ||
          timestampMillis(a.conversation.updatedAt) ||
          timestampMillis(a.conversation.createdAt);
        const bTime = timestampMillis(b.latest?.createdAt) ||
          timestampMillis(b.conversation.updatedAt) ||
          timestampMillis(b.conversation.createdAt);
        return bTime - aTime;
      });
  }, [conversations, conversationSearch, latestMessages, peopleByUid, user]);

  const filteredPeople = useMemo(() => {
    const term = peopleSearch.trim().toLowerCase();

    return people.filter(person =>
      person.displayName.toLowerCase().includes(term) ||
      person.username.toLowerCase().includes(term),
    );
  }, [people, peopleSearch]);

  const selectedConversation = conversations.find(
    conversation => conversation.id === selectedId,
  );

  const selectedPerson = selectedConversation
    ? peopleByUid.get(otherUid(selectedConversation))
    : undefined;

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
    { label: 'Updates', icon: CirclePlay },
    { label: 'Explore', icon: Compass },
    { label: 'Activity', icon: Activity },
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

        <div className="pulse-account-menu-wrap">
          <button
            type="button"
            className="pulse-topbar-account"
            aria-expanded={accountMenuOpen}
            aria-label="Open account menu"
            onClick={() => setAccountMenuOpen(value => !value)}
          >
            <span>{displayName}</span>
            <Avatar name={displayName} photoURL={profile?.photoURL} small />
            <ChevronDown size={15} />
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
      </header>

      <main className="pulse-content">
        {error && (
          <div className="pulse-error" role="alert">
            <span>{error}</span>
            <button onClick={() => setError('')} aria-label="Dismiss error">×</button>
          </div>
        )}

        {activeTab === 'Chats' && (
          <section className={`pulse-chat-layout ${selectedId ? 'conversation-open' : ''}`}>
              <div className={`pulse-inbox ${selectedId ? "pulse-inbox-hidden" : ""}`}>
              <div className="pulse-page-heading">
                <div>
                  <span className="pulse-eyebrow">YOUR PEOPLE</span>
                  <h1>Chats</h1>
                  <p>Your conversations, together in one inbox.</p>
                </div>
              </div>

              <label className="pulse-search">
                <Search size={17} />
                <input
                  value={conversationSearch}
                  onChange={event => setConversationSearch(event.target.value)}
                  placeholder="Search conversations"
                />
              </label>

              <div className="pulse-inbox-list">
                {inboxConversations.map(({ conversation, partner, latest }) => (
                  <button
                    key={conversation.id}
                    className={`pulse-conversation ${selectedId === conversation.id ? 'active' : ''}`}
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
                      {latest ? timestampLabel(latest.createdAt) : ''}
                    </span>
                  </button>
                ))}

                {inboxConversations.length === 0 && (
                  <div className="pulse-empty-small">
                    <MessageCircle size={25} />
                    <strong>
                      {conversations.length === 0 ? 'Your inbox is ready' : 'No matching conversations'}
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
                        setViewedProfile(selectedPerson);
                        setProfileReturnTo('chat');
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
                      </span>
                    </button>
                  </div>

                  <div className="pulse-message-list">
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
                            {item.text}
                            <small>{timestampLabel(item.createdAt)}</small>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <form
                    className="pulse-composer"
                    onSubmit={event => {
                      event.preventDefault();
                      void sendMessage();
                    }}
                  >
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

        {activeTab === 'Updates' && (
          <section className="pulse-standard-page">
            <span className="pulse-eyebrow">MOMENTS FROM YOUR WORLD</span>
            <h1>Updates</h1>
            <p className="pulse-lead">A place for moments you choose to share with your people.</p>
            <div className="pulse-empty-card">
              <CirclePlay size={31} />
              <h2>No updates to show yet</h2>
              <p>There are no published PULSE updates available to this account. We will connect this page to real 24-hour status publishing and audience controls before enabling it.</p>
            </div>
          </section>
        )}

        {activeTab === 'Explore' && (
          <section className="pulse-standard-page">
            <span className="pulse-eyebrow">REAL PEOPLE. REAL CONNECTIONS.</span>
            <h1>Explore</h1>
            <p className="pulse-lead">Discover PULSE members and connect with their profiles.</p>

            <label className="pulse-search pulse-explore-search">
              <Search size={17} />
              <input
                value={peopleSearch}
                onChange={event => setPeopleSearch(event.target.value)}
                placeholder="Search members by name or username"
              />
            </label>

            <div className="pulse-people-grid">
              {filteredPeople.map(person => (
                <article className="pulse-person-card" key={person.uid}>
                  <Avatar name={person.displayName} photoURL={person.photoURL} />
                  <div className="pulse-person-copy">
                    <strong>{person.displayName}</strong>
                    <span>@{person.username}</span>
                    {person.bio && <p>{person.bio}</p>}
                  </div>
                  <button onClick={() => {
                    setViewedProfile(person);
                    setProfileReturnTo('explore');
                    setRelationshipView(null);
                    setEditingProfile(false);
                    setActiveTab('Profile');
                  }}>
                    View profile
                  </button>
                  <button onClick={() => void toggleFollow(person)}>
                    {followingUids.includes(person.uid) ? 'Following' : 'Follow'}
                  </button>
                  <button onClick={() => void openMessage(person)}>
                    <MessageCircle size={16} /> Message
                  </button>
                </article>
              ))}
            </div>

            {filteredPeople.length === 0 && (
              <div className="pulse-empty-card">
                <Compass size={30} />
                <h2>No discoverable members found</h2>
                <p>Only real PULSE accounts that have enabled discoverability appear here.</p>
              </div>
            )}
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
          <section className="pulse-standard-page">
            {viewedProfile && viewedProfile.uid !== user.uid ? (
              <>
                <button
                  className="pulse-public-profile-back"
                  onClick={() => {
                    setViewedProfile(null);
                    setActiveTab(profileReturnTo === 'chat' ? 'Chats' : 'Explore');
                  }}
                >
                  <ArrowLeft size={17} /> {profileReturnTo === 'chat' ? 'Back to conversation' : 'Back to Explore'}
                </button>

                <span className="pulse-eyebrow">PULSE MEMBER</span>
                <h1>{viewedProfile.displayName}</h1>

                <div className="pulse-profile-card pulse-public-profile-card">
                  <Avatar
                    name={viewedProfile.displayName}
                    photoURL={viewedProfile.photoURL}
                  />
                  <div className="pulse-profile-identity">
                    <h2>{viewedProfile.displayName}</h2>
                    <span>@{viewedProfile.username}</span>
                    <p>{viewedProfile.bio || 'This member has not added a bio yet.'}</p>
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
                <p className="pulse-profile-privacy-note">
                  Public profile information only. Private account details are not displayed.
                </p>
              </>
            ) : (
              <>
                <span className="pulse-eyebrow">YOUR PULSE ACCOUNT</span>
                <h1>Profile</h1>

                <div className="pulse-profile-card">
                  <Avatar name={displayName} photoURL={profile?.photoURL} />
                  <div className="pulse-profile-identity">
                    <h2>{displayName}</h2>
                    <span>@{profile?.username ?? user.uid.slice(0, 10)}</span>
                    <p>{profile?.bio || 'Your PULSE profile.'}</p>
                    <small>{user.email ?? 'Email not provided'}</small>
                  </div>
                </div>

                <div className="pulse-profile-photo-controls">
                  <label className="pulse-photo-upload">
                    <Camera size={16} />
                    {profilePhotoBusy
                      ? `Uploading ${profilePhotoProgress}%`
                      : 'Change profile photo'}
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
                      <Trash2 size={15} /> Remove photo
                    </button>
                  )}
                  <small>JPG, PNG or WebP · Maximum 5 MB</small>
                </div>

                <div className="pulse-social-stats">
                  <button onClick={() => setRelationshipView(relationshipView === 'followers' ? null : 'followers')}>
                    <strong>{followerUids.length}</strong><span>Followers</span>
                  </button>
                  <button onClick={() => setRelationshipView(relationshipView === 'following' ? null : 'following')}>
                    <strong>{followingUids.length}</strong><span>Following</span>
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
                              <span><strong>{person.displayName}</strong><small>@{person.username}</small></span>
                            </>
                          ) : <span><small>Loading member profile…</small></span>}
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
                        <button type="submit" disabled={profileSaving}>{profileSaving ? 'Saving…' : 'Save profile'}</button>
                      </div>
                    </form>
                  )}
                </div>

                <div className="pulse-settings-card">
                  <div className="pulse-settings-heading">
                    <ShieldCheck size={20} />
                    <div>
                      <strong>Discoverability</strong>
                      <p>Control whether other PULSE members can find your public profile in Explore.</p>
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
                      ? 'Your public profile can appear in member discovery. Your email address remains private.'
                      : 'Your profile is excluded from member discovery. You can turn discoverability back on at any time.'}
                  </p>
                </div>

              </>
            )}
          </section>
        )}
      </main>

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
    </div>
  );
}

export default App;
