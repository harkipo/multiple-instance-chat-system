import React, { useState, useEffect, useRef } from 'react';
import { useMutation } from '@apollo/client';
import { MARK_MESSAGE_AS_READ } from '../graphql/queries';
import AddUsersModal from './AddUsersModal';
import ReadReceiptIndicator from './ReadReceiptIndicator';
import { useUnreadCounts } from '../hooks/useUnreadCounts';

interface Message {
  id: string;
  content: string;
  senderId: string;
  chatId: string;
  createdAt: string;
  isEdited: boolean;
  editedAt?: string;
}

interface User {
  id: string;
  username: string;
  displayName?: string;
}

interface ChatWindowProps {
  chatId: string;
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  chatType?: string;
  participantIds?: string[];
  users?: User[];
}

const ChatWindow: React.FC<ChatWindowProps> = ({ 
  chatId, 
  messages, 
  onSendMessage, 
  isLoading,
  chatType = 'group',
  participantIds = [],
  users = []
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showAddUsersModal, setShowAddUsersModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userId = localStorage.getItem('userId');
  const [markedAsRead, setMarkedAsRead] = useState<Set<string>>(new Set());
  const { getUnreadCount } = useUnreadCounts(userId || '');

  const [markMessageAsRead] = useMutation(MARK_MESSAGE_AS_READ);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-mark messages as read when viewing the chat
  useEffect(() => {
    if (!userId || messages.length === 0) return;

    // Only mark messages as read if there are unread messages in this chat
    const unreadCount = getUnreadCount(chatId);
    if (unreadCount === 0) return;

    // Mark all messages not sent by current user as read
    messages.forEach(async (message) => {
      // Skip if message was sent by current user or already marked as read
      if (message.senderId === userId || markedAsRead.has(message.id)) {
        return;
      }

      try {
        await markMessageAsRead({
          variables: {
            messageId: message.id,
            userId: userId,
          },
        });
        // Add to marked set to avoid duplicate marking
        setMarkedAsRead(prev => new Set(prev).add(message.id));
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    });
  }, [messages, userId, markMessageAsRead, markedAsRead, chatId, getUnreadCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      await onSendMessage(newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getUsername = (senderId: string) => {
    if (senderId === userId) return 'You';
    
    // Find the user by ID and return display name or username
    const user = users.find(u => u.id === senderId);
    if (user) {
      return user.displayName || user.username;
    }
    
    // Fallback to showing last 4 chars of ID if user not found
    return `User ${senderId.slice(-4)}`;
  };

  if (isLoading) {
    return (
      <div className="d-flex align-items-center justify-content-center h-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading messages...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-messages">
      {chatType === 'group' && (
        <div className="p-2 border-bottom d-flex justify-content-between align-items-center bg-light">
          <span className="text-muted small">
            <i className="bi bi-people-fill me-1"></i>
            Group Chat • {participantIds.length} member{participantIds.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setShowAddUsersModal(true)}
            className="btn btn-sm btn-primary"
          >
            <i className="bi bi-person-plus me-1"></i>
            Add Users
          </button>
        </div>
      )}
      
      <div className="messages-list">
        {messages.length === 0 ? (
          <div className="text-center text-muted p-4">
            <p className="fs-5">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`message ${
                message.senderId === userId ? 'sent' : 'received'
              }`}
            >
              {chatType === 'group' && message.senderId !== userId && (
                <div className="small fw-bold mb-1" style={{ opacity: 0.8 }}>
                  {getUsername(message.senderId)}
                </div>
              )}
              <div className="mb-1">
                {message.content}
              </div>
              <div className="d-flex justify-content-between align-items-center small" style={{ opacity: 0.7 }}>
                <div className="d-flex align-items-center">
                  <span>{formatTime(message.createdAt)}</span>
                  <ReadReceiptIndicator 
                    messageId={message.id}
                    senderId={message.senderId}
                    currentUserId={userId || ''}
                  />
                </div>
                {message.isEdited && (
                  <span className="fst-italic">(edited)</span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="message-input" onSubmit={handleSubmit}>
        <input
          type="text"
          className="form-control"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          disabled={isSending}
          autoFocus
        />
        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={!newMessage.trim() || isSending}
        >
          {isSending ? (
            <>
              <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
              Sending
            </>
          ) : (
            'Send'
          )}
        </button>
      </form>

      {/* Add Users Modal */}
      <AddUsersModal
        chatId={chatId}
        currentParticipants={participantIds}
        isOpen={showAddUsersModal}
        onClose={() => setShowAddUsersModal(false)}
        onSuccess={() => {
          // Optionally refresh or update the UI
          setShowAddUsersModal(false);
        }}
      />
    </div>
  );
};

export default ChatWindow;
