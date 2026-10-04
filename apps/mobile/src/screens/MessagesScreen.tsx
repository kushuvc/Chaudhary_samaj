import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { showAlert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, InlineError, ScreenLoader } from '../components/AppFeedback';
import { useAppLanguage } from '../context/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useKeyboard } from '../components/ui';
import { useCapabilities } from '../hooks/useCapabilities';
import { useNavigation, useRoute } from '@react-navigation/native';

interface Match {
  id: string;
  profileId: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  isRead: boolean;
}

type MessagesView = 'list' | 'chat';

interface MessagesScreenProps {
  onBack?: () => void;
}

export function MessagesScreen({ onBack }: MessagesScreenProps) {
  const capabilities = useCapabilities();
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useAppLanguage();
  const styles = useMemo(() => createStyles(palette, insets.top), [palette, insets.top]);
  const { session } = useAuth();
  const currentUserId = session?.user?.id || '';
  
  const [view, setView] = useState<MessagesView>('list');
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  // The chat menu, and the report sheet it can open.
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const REPORT_REASONS = [
    { id: 'harassment', label: t('rptHarassment') },
    { id: 'fake_profile', label: t('rptFake') },
    { id: 'inappropriate_content', label: t('rptInappropriate') },
    { id: 'scam', label: t('rptScam') },
    { id: 'underage', label: t('rptUnderage') },
    { id: 'other', label: t('rptOther') },
  ];

  /**
   * End the conversation. The server deletes the match and its messages for
   * both people and withdraws the accepted interests, so neither side is left
   * reading as mutually interested.
   */
  const handleUnmatch = async () => {
    if (!selectedMatch || busy) return;
    setBusy(true);
    try {
      await api.unmatch(selectedMatch.id);
      setSelectedMatch(null);
      setMessages([]);
      setView('list');
      await loadMatches();
    } catch (err) {
      showAlert(t('lblFailed'), (err as Error).message || t('alertSomethingWrong'));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Report, then leave the conversation.
   *
   * The server hides the reported member from the reporter straight away, so
   * staying in a chat with someone who has just been hidden would only show
   * an empty screen.
   */
  const handleReport = async () => {
    if (!selectedMatch || !reportReason || busy) return;
    setBusy(true);
    try {
      await api.reportProfile(selectedMatch.profileId, reportReason);
      setReportOpen(false);
      setSelectedMatch(null);
      setView('list');
      await loadMatches();
      showAlert(t('rptThanksTitle'), t('rptThanksBody'));
    } catch (err) {
      showAlert(t('lblFailed'), (err as Error).message || t('alertSomethingWrong'));
    } finally {
      setBusy(false);
    }
  };

  const loadMatches = useCallback(async (fresh = false) => {
    try {
      setError(null);
      const data = await api.getMyMatches(fresh);
      setMatches(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const keyboard = useKeyboard();

  // Interests' "Message" button lands here with the person to open.
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const openProfileId: string | undefined = route.params?.openProfileId;
  useEffect(() => {
    if (!openProfileId || loading) return;
    navigation.setParams({ openProfileId: undefined });
    const target = matches.find((m) => m.profileId === openProfileId);
    if (target) {
      void loadMessages(target);
    } else {
      // A match made a moment ago may not be in the list loaded earlier.
      void api.getMyMatches(true).then((fresh) => {
        setMatches(fresh);
        const match = fresh.find((m) => m.profileId === openProfileId);
        if (match) void loadMessages(match);
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openProfileId, loading]);

  /*
   * Back to the list. The list was loaded before the chat opened, so it still
   * carried that chat's unread count; clear it at once and refetch past the
   * server cache so the badge does not come back.
   */
  const closeChat = () => {
    const closedId = selectedMatch?.id;
    setView('list');
    if (closedId) {
      setMatches((current) =>
        current.map((m) => (m.id === closedId ? { ...m, unreadCount: 0 } : m))
      );
    }
    void loadMatches(true);
  };

  /*
   * Poll while a chat is open.
   *
   * Messages were fetched once when the chat opened and again only after you
   * sent one, so the other person's replies never arrived — you had to close
   * and reopen the app to see them. Polling is not elegant, but it is the
   * whole of "the chat works" and needs no new infrastructure.
   */
  useEffect(() => {
    if (view !== 'chat' || !selectedMatch) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const data = await api.getMessages(selectedMatch.id);
        if (cancelled) return;
        // Only touch state when something actually changed, so the list does
        // not re-render — and fight the scroll position — every few seconds.
        // Read state counts as a change too, so the seen tick appears.
        const readCount = (list: Message[]) => list.filter((m) => m.isRead).length;
        setMessages((current) =>
          current.length === data.length &&
          current[current.length - 1]?.id === data[data.length - 1]?.id &&
          readCount(current) === readCount(data)
            ? current
            : data
        );
      } catch {
        // A failed poll is not worth showing; the next one may succeed.
      }
    };

    const timer = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [view, selectedMatch]);

  const loadMessages = async (match: Match) => {
    if (!capabilities.canChat) {
      setError(t('mpUpgradeChat'));
      return;
    }

    try {
      setError(null);
      const data = await api.getMessages(match.id);
      setMessages(data);
      setSelectedMatch(match);
      setView('chat');
      // Opening the chat marked it read on the server; reflect that here.
      setMatches((current) =>
        current.map((m) => (m.id === match.id ? { ...m, unreadCount: 0 } : m))
      );
    } catch (err) {
      const msg = (err as Error).message || t('msgLoadFailed');
      setError(msg);
      showAlert(t('msgLoadFailedTitle'), msg);
    }
  };

  const sendMessage = async () => {
    if (!selectedMatch) {
      showAlert(t('msgNoMatchTitle'), t('msgNoMatchBody'));
      return;
    }
    if (!newMessage.trim()) {
      showAlert(t('msgEmptyTitleAlert'), t('msgEmptyBodyAlert'));
      return;
    }
    if (sending) return;

    if (!capabilities.canChat) {
      showAlert(t('alertPremiumFeature'), t('mpUpgradeSendMessage'));
      setError(t('mpUpgradeSendMessage'));
      return;
    }

    try {
      setSending(true);
      await api.sendMessage(selectedMatch.id, newMessage.trim());
      setNewMessage('');
      // Reload messages
      const data = await api.getMessages(selectedMatch.id);
      setMessages(data);
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      const msg = (err as Error).message || t('msgSendFailed');
      setError(msg);
      showAlert(t('msgSendFailedTitle'), msg);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return formatTime(dateString);
    if (diffDays === 1) return t('lblYesterday');
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderMatchItem = ({ item }: { item: Match }) => (
    <Pressable style={styles.matchCard} onPress={() => loadMessages(item)}>
      <View style={styles.avatarPlaceholder}>
        <Ionicons name="person" size={40} color={palette.muted} />
      </View>
      <View style={styles.matchInfo}>
        <Text style={styles.matchName}>{item.name}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage || t('msgStartChatting')}
        </Text>
      </View>
      <View style={styles.matchMeta}>
        <Text style={styles.timeText}>{formatDate(item.lastMessageTime)}</Text>
        {item.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unreadCount}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isMe = item.senderId === currentUserId;
    
    return (
      <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
          {item.content}
        </Text>
        <View style={styles.messageMeta}>
          <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>{formatTime(item.createdAt)}</Text>
          {isMe ? (
            <Ionicons
              name={item.isRead ? 'checkmark-done' : 'checkmark'}
              size={15}
              color={item.isRead ? '#7CF5E6' : 'rgba(255,255,255,0.75)'}
              accessibilityLabel={item.isRead ? t('msgSeen') : t('msgSent')}
            />
          ) : null}
        </View>
      </View>
    );
  };

  if (loading) {
    return <ScreenLoader message={t('loadingMatches')} />;
  }

  // Chat View
  if (view === 'chat' && selectedMatch) {
    return (
      <KeyboardAvoidingView
        /*
         * Android gets the padding explicitly: behavior undefined is a no-op
         * there, so the keyboard drew straight over the input you were typing
         * into.
         */
        style={[
          styles.container,
          Platform.OS === 'android' && keyboard.height > 0 && { paddingBottom: keyboard.height },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <Pressable onPress={closeChat} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={palette.text} />
          </Pressable>
          <View style={styles.chatHeaderInfo}>
            <Text style={styles.chatHeaderName}>{selectedMatch.name}</Text>
            {/* No presence tracking exists, so claiming "Online" was fiction. */}
            <Text style={styles.chatHeaderStatus}>{t('lblMatched')}</Text>
          </View>
          {/* This opened an alert whose only button was "Close" — the menu
              existed but did nothing at all. */}
          <Pressable
            style={styles.moreButton}
            onPress={() => setMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('msgWhatWouldYouLike')}
          >
            <Ionicons name="ellipsis-vertical" size={24} color={palette.text} />
          </Pressable>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessageItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {error ? <InlineError message={error} /> : null}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder={t('msgInputPlaceholder')}
            placeholderTextColor={palette.muted}
            multiline
          />
          <Pressable
            style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            <Ionicons name="send" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        {/* Chat menu */}
        <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setMenuOpen(false)}>
            <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} onPress={() => {}}>
              <Text style={styles.sheetTitle}>{selectedMatch.name}</Text>

              <Pressable
                style={styles.sheetRow}
                onPress={() => {
                  setMenuOpen(false);
                  setReportReason(null);
                  setReportOpen(true);
                }}
              >
                <Ionicons name="flag-outline" size={20} color={palette.text} />
                <Text style={styles.sheetRowText}>{t('actReport')}</Text>
              </Pressable>

              <Pressable
                style={styles.sheetRow}
                onPress={() => {
                  setMenuOpen(false);
                  // Deleting a conversation for both people is worth a
                  // confirmation; it cannot be undone from the app.
                  showAlert(t('msgUnmatchTitle'), t('msgUnmatchBody'), [
                    { text: t('actCancel'), style: 'cancel' },
                    {
                      text: t('actUnmatch'),
                      style: 'destructive',
                      onPress: () => void handleUnmatch(),
                    },
                  ]);
                }}
              >
                <Ionicons name="heart-dislike-outline" size={20} color={palette.danger} />
                <Text style={[styles.sheetRowText, { color: palette.danger }]}>{t('actUnmatch')}</Text>
              </Pressable>

              <Pressable style={styles.sheetCancel} onPress={() => setMenuOpen(false)}>
                <Text style={styles.sheetCancelText}>{t('actCancel')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Report reasons */}
        <Modal visible={reportOpen} transparent animationType="slide" onRequestClose={() => setReportOpen(false)}>
          <View style={styles.sheetBackdrop}>
            <Pressable style={{ flex: 1 }} onPress={() => setReportOpen(false)} />
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <Text style={styles.sheetTitle}>{t('rptTitle')}</Text>
              <ScrollView style={{ maxHeight: 320 }}>
                {REPORT_REASONS.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.sheetRow}
                    onPress={() => setReportReason(item.id)}
                  >
                    <Ionicons
                      name={reportReason === item.id ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={reportReason === item.id ? palette.primary : palette.muted}
                    />
                    <Text style={styles.sheetRowText}>{item.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable
                style={[styles.sheetSubmit, (!reportReason || busy) && styles.sheetSubmitDisabled]}
                disabled={!reportReason || busy}
                onPress={() => void handleReport()}
              >
                <Text style={styles.sheetSubmitText}>{busy ? t('lblPleaseWait') : t('actReport')}</Text>
              </Pressable>
              <Pressable style={styles.sheetCancel} onPress={() => setReportOpen(false)}>
                <Text style={styles.sheetCancelText}>{t('actCancel')}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    );
  }

  // List View
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <Pressable onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={palette.text} />
          </Pressable>
        )}
        <Text style={styles.headerTitle}>{t('messages')}</Text>
      </View>

      {error ? <InlineError message={error} /> : null}

      {matches.length === 0 ? (
        <EmptyState
          title={t('msgEmptyTitle')}
          subtitle={t('msgEmptyBody')}
        />
      ) : (
        <FlatList
          data={matches}
          renderItem={renderMatchItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

function createStyles(palette: ThemePalette, insetTop = 0) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: insetTop + 12,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: palette.text,
      marginLeft: 12,
    },
    list: {
      padding: 16,
    },
    matchCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.cardBg,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    avatarPlaceholder: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: palette.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    matchInfo: {
      flex: 1,
      marginLeft: 12,
    },
    matchName: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.text,
    },
    lastMessage: {
      fontSize: 14,
      color: palette.muted,
      marginTop: 2,
    },
    matchMeta: {
      alignItems: 'flex-end',
    },
    timeText: {
      fontSize: 12,
      color: palette.muted,
    },
    unreadBadge: {
      backgroundColor: palette.primary,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 4,
    },
    unreadText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    // Chat styles
    chatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: insetTop + 12,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
      backgroundColor: palette.cardBg,
    },
    chatHeaderInfo: {
      flex: 1,
      marginLeft: 12,
    },
    chatHeaderName: {
      fontSize: 18,
      fontWeight: '600',
      color: palette.text,
    },
    chatHeaderStatus: {
      fontSize: 12,
      color: palette.accent,
    },
    moreButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    messagesList: {
      padding: 16,
    },
    messageBubble: {
      maxWidth: '75%',
      padding: 12,
      borderRadius: 16,
      marginBottom: 8,
    },
    myMessage: {
      alignSelf: 'flex-end',
      backgroundColor: palette.primary,
      borderBottomRightRadius: 4,
    },
    theirMessage: {
      alignSelf: 'flex-start',
      backgroundColor: palette.cardBg,
      borderBottomLeftRadius: 4,
    },
    messageText: {
      fontSize: 15,
      lineHeight: 20,
    },
    myMessageText: {
      color: '#FFFFFF',
    },
    theirMessageText: {
      color: palette.text,
    },
    messageMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-end',
      gap: 4,
      marginTop: 4,
    },
    messageTime: {
      fontSize: 11,
      color: palette.muted,
    },
    myMessageTime: {
      color: 'rgba(255,255,255,0.75)',
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: palette.border,
      backgroundColor: palette.cardBg,
    },
    input: {
      flex: 1,
      backgroundColor: palette.bg,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      maxHeight: 100,
      fontSize: 15,
      color: palette.text,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: palette.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: palette.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 18,
      gap: 4,
    },
    sheetTitle: { fontSize: 17, fontWeight: '800', color: palette.text, marginBottom: 8 },
    sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
    sheetRowText: { fontSize: 16, color: palette.text, fontWeight: '600' },
    sheetSubmit: {
      marginTop: 12,
      backgroundColor: palette.primary,
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
    },
    sheetSubmitDisabled: { opacity: 0.5 },
    sheetSubmitText: { color: '#FFFFFF', fontSize: 15.5, fontWeight: '700' },
    sheetCancel: { paddingVertical: 14, alignItems: 'center' },
    sheetCancelText: { fontSize: 15.5, fontWeight: '600', color: palette.muted },
    sendButtonDisabled: {
      opacity: 0.5,
    },
  });
}
