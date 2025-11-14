import { useColorScheme } from '@/hooks/use-color-scheme';
import { leapLiquidAI } from '@/services/leapLiquidAI';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Message {
  id: string;
  text: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export default function ChatScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! I\'m your AI assistant. How can I help you today?',
      role: 'assistant',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [currentResponseId, setCurrentResponseId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const colors = {
    background: isDark ? '#000000' : '#ffffff',
    surface: isDark ? '#1a1a1a' : '#f5f5f5',
    text: isDark ? '#ffffff' : '#000000',
    textSecondary: isDark ? '#a0a0a0' : '#666666',
    userBubble: isDark ? '#007AFF' : '#007AFF',
    assistantBubble: isDark ? '#2c2c2e' : '#e5e5ea',
    inputBackground: isDark ? '#1a1a1a' : '#f5f5f5',
    border: isDark ? '#333333' : '#e0e0e0',
  };

  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Initialize Leap SDK on mount
  useEffect(() => {
    let isMounted = true;

    const initializeSDK = async () => {
      if (isInitialized || isInitializing) return;

      setIsInitializing(true);
      try {
        // Default model path - can be customized
        const modelPath = '/data/local/tmp/leap/model.bundle';
        await leapLiquidAI.initialize(modelPath);
        await leapLiquidAI.createConversation();
        
        if (isMounted) {
          setIsInitialized(true);
          
          // Update welcome message
          setMessages([
            {
              id: '1',
              text: 'Hello! I\'m your AI assistant powered by Leap Liquid AI. How can I help you today?',
              role: 'assistant',
              timestamp: new Date(),
            },
          ]);
        }
      } catch (error: any) {
        console.error('Failed to initialize Leap SDK:', error);
        const errorMessage = error?.message || 'Unknown error';
        
        if (isMounted) {
          Alert.alert(
            'Initialization Error',
            `Failed to initialize AI model: ${errorMessage}\n\nMake sure you have:\n1. Downloaded a model bundle\n2. Pushed it to the device:\n   adb push model.bundle /data/local/tmp/leap/model.bundle`,
            [{ text: 'OK' }]
          );
          setMessages([
            {
              id: '1',
              text: `AI model not available. Error: ${errorMessage}\n\nPlease ensure the model bundle is loaded on the device.`,
              role: 'assistant',
              timestamp: new Date(),
            },
          ]);
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };

    initializeSDK();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (leapLiquidAI.isReady()) {
        leapLiquidAI.cleanup().catch(console.error);
      }
    };
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading || !isInitialized) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      role: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = inputText.trim();
    setInputText('');
    setIsLoading(true);

    // Create a placeholder message for the streaming response
    const responseId = (Date.now() + 1).toString();
    setCurrentResponseId(responseId);
    const assistantMessage: Message = {
      id: responseId,
      text: '',
      role: 'assistant',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      await leapLiquidAI.sendMessage(userInput, {
        onChunk: (chunk) => {
          // Update the assistant message with streaming chunks
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === responseId
                ? { ...msg, text: msg.text + chunk.text }
                : msg
            )
          );
        },
        onComplete: (complete) => {
          // Final update with complete response
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === responseId
                ? { ...msg, text: complete.text }
                : msg
            )
          );
        },
        onError: (error) => {
          console.error('Generation error:', error);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === responseId
                ? { ...msg, text: `Error: ${error.error}` }
                : msg
            )
          );
        },
      });
    } catch (error: any) {
      console.error('Error getting AI response:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === responseId
            ? { ...msg, text: `Sorry, I encountered an error: ${errorMessage}` }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setCurrentResponseId(null);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
        ]}>
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: isUser ? colors.userBubble : colors.assistantBubble,
              alignSelf: isUser ? 'flex-end' : 'flex-start',
            },
          ]}>
          <Text
            style={[
              styles.messageText,
              {
                color: isUser ? '#ffffff' : colors.text,
              },
            ]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>AI Chat</Text>
          {isInitializing && (
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Initializing model...
            </Text>
          )}
          {!isInitialized && !isInitializing && (
            <Text style={[styles.headerSubtitle, { color: '#ff6b6b' }]}>
              Model not loaded
            </Text>
          )}
          {isInitialized && (
            <Text style={[styles.headerSubtitle, { color: '#51cf66' }]}>
              Ready
            </Text>
          )}
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Loading Indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.textSecondary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              AI is thinking...
            </Text>
          </View>
        )}

        {/* Input Area */}
        <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.surface }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type your message..."
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={1000}
            editable={!isLoading}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              {
                backgroundColor: inputText.trim() && !isLoading ? colors.userBubble : colors.border,
              },
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isLoading || !isInitialized}>
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 12,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  assistantMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 16,
  },
  sendButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

