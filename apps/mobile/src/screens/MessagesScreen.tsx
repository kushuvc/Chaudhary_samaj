import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { showAlert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, InlineError, ScreenLoader } from '../components/AppFeedback';
import { useAppLanguage } from '../context/LanguageContext';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

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

// Feature flag for monetization
const FEATURES = {
  CHAT_FREE: true,
  SEND_MESSAGE_FREE: true,
};

export function MessagesScreen({ onBack }: MessagesScreenProps) {
  const { palette } = useAppTheme();
  const { t } = useAppLanguage();
  const styles = useMemo(() => createStyles(palette), [palette]);
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

  const loadMatches = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getMyMatches();
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

  const loadMessages = async (match: Match) => {
    if (!FEATURES.CHAT_FREE) {
      setError('Upgrade to premium to chat with matches.');
      return;
    }

    try {
      setError(null);
      const data = await api.getMessages(match.id);
      setMessages(data);
      setSelectedMatch(match);
      setView('chat');
    } catch (err) {
      const msg = (err as Error).message || 'Unable to load messages. Please try again.';
      setError(msg);
      showAlert('Failed to Load Chat', msg);
    }
  };

  const sendMessage = async () => {
    if (!selectedMatch) {
      showAlert('No Match Selected', 'Please select a match to send a message.');
      return;
    }
    if (!newMessage.trim()) {
      showAlert('Empty Message', 'Please type a message before sending.');
      return;
    }
    if (sending) return;

    if (!FEATURES.SEND_MESSAGE_FREE) {
      showAlert('Premium Feature', 'Upgrade to premium to send messages.');
      setError('Upgrade to premium to send messages.');
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
      const msg = (err as Error).message || 'Failed to send message. Please try again.';
      setError(msg);
      showAlert('Send Failed', msg);
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
    if (diffDays === 1) return 'Yesterday';
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
          {item.lastMessage || 'Start chatting...'}
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
        <Text style={styles.messageTime}>{formatTime(item.createdAt)}</Text>
      </View>
    );
  };

  if (loading) {
    return <ScreenLoader message="Loading matches..." />;
  }

  // Chat View
  if (view === 'chat' && selectedMatch) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <Pressable onPress={() => setView('list')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={palette.text} />
          </Pressable>
          <View style={styles.chatHeaderInfo}>
            <Text style={styles.chatHeaderName}>{selectedMatch.name}</Text>
            <Text style={styles.chatHeaderStatus}>Online</Text>
          </View>
          <Pressable
            style={styles.moreButton}
            onPress={() => {
              showAlert(
                selectedMatch.name,
                'What would you like to do?',
                [
                  { text: 'View Profile', onPress: () => {} },
                  { text: 'Clear Chat', style: 'destructive', onPress: () => setMessages([]) },
                  { text: 'Cancel', style: 'cancel' },
                ]
              );
            }}
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
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {error ? <InlineError message={error} /> : null}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
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
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {error ? <InlineError message={error} /> : null}

      {matches.length === 0 ? (
        <EmptyState
          title="No Messages Yet"
          subtitle="When you match with someone, you can chat with them here. Send interests to find your match!"
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

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 60,
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
      paddingTop: 60,
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
      color: '#4CAF50',
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
    messageTime: {
      fontSize: 11,
      color: palette.muted,
      marginTop: 4,
      alignSelf: 'flex-end',
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
    sendButtonDisabled: {
      opacity: 0.5,
    },
  });
}
