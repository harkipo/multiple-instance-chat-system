import React from 'react';
import { useUnreadCounts } from '../hooks/useUnreadCounts';
import UnreadIndicator from './UnreadIndicator';

interface Chat {
  id: string;
  name: string;
  description?: string;
  chatType: string;
  participantIds: string[];
  createdAt: string;
  updatedAt: string;
  messages?: Array<{
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
  }>;
}

interface ChatListProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  currentUserId: string;
  users: any[];
}

const ChatList: React.FC<ChatListProps> = ({ chats, selectedChatId, onSelectChat, currentUserId, users }) => {
  const { getUnreadCount, hasUnreadMessages } = useUnreadCounts(currentUserId);
  const getDisplayName = (chat: Chat) => {
    // For 1:1 chats, show the other user's name instead of the chat name
    if (chat.chatType === 'direct') {
      const otherUserId = chat.participantIds.find(id => id !== currentUserId);
      if (otherUserId) {
        const otherUser = users.find(user => user.id === otherUserId);
        return otherUser ? (otherUser.displayName || otherUser.username) : 'Unknown User';
      }
    }
    // For group chats, use the original chat name
    return chat.name;
  };

  const getLastMessage = (chat: Chat) => {
    if (!chat.messages || chat.messages.length === 0) {
      return 'No messages yet';
    }
    
    // Sort messages by creation date to ensure we get the latest one
    const sortedMessages = [...chat.messages].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    const lastMessage = sortedMessages[0]; // Get the most recent message
    
    // Debug: Log message info for group chats (can be removed after testing)
    if (chat.chatType === 'group' && process.env.NODE_ENV === 'development') {
      console.log(`Group chat "${chat.name}" latest message:`, {
        content: lastMessage.content,
        senderId: lastMessage.senderId,
        currentUserId: currentUserId,
        createdAt: lastMessage.createdAt,
        isCurrentUser: lastMessage.senderId === currentUserId
      });
    }
    
    // Add appropriate prefix for messages
    const isCurrentUserMessage = lastMessage.senderId === currentUserId;
    let messagePrefix = '';
    
    if (isCurrentUserMessage) {
      messagePrefix = 'You: ';
    } else if (chat.chatType === 'group') {
      // For group chats, show sender's name for messages from other users
      const sender = users.find(user => user.id === lastMessage.senderId);
      if (sender) {
        messagePrefix = `${sender.displayName || sender.username}: `;
      }
    }
    
    const messageContent = messagePrefix + lastMessage.content;
    
    return messageContent.length > 50 
      ? messageContent.substring(0, 50) + '...'
      : messageContent;
  };

  const getLastMessageTime = (chat: Chat) => {
    if (!chat.messages || chat.messages.length === 0) {
      return new Date(chat.createdAt).toLocaleDateString();
    }
    
    // Sort messages by creation date to ensure we get the latest one
    const sortedMessages = [...chat.messages].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    const lastMessage = sortedMessages[0]; // Get the most recent message
    return new Date(lastMessage.createdAt).toLocaleDateString();
  };

  return (
    <div className="chat-list">
      {chats.length === 0 ? (
        <div className="text-center text-muted p-4">
          <p>No chats yet. Create one to get started!</p>
        </div>
      ) : (
        <div className="list-group list-group-flush">
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              className={`list-group-item list-group-item-action chat-item ${
                selectedChatId === chat.id ? 'active' : ''
              }`}
              onClick={() => onSelectChat(chat.id)}
            >
              <div className="d-flex w-100 justify-content-between align-items-start">
                <div className="d-flex align-items-center">
                  <h6 className="mb-1 fw-bold me-2">{getDisplayName(chat)}</h6>
                  <UnreadIndicator
                    chatId={chat.id}
                    userId={currentUserId}
                    hasUnreadMessages={hasUnreadMessages(chat.id)}
                    unreadCount={getUnreadCount(chat.id)}
                    isSelected={selectedChatId === chat.id}
                  />
                </div>
                <small className={selectedChatId === chat.id ? 'text-light' : 'text-muted'}>
                  {getLastMessageTime(chat)}
                </small>
              </div>
              <p className={`mb-0 small ${selectedChatId === chat.id ? 'text-light' : 'text-muted'}`}>
                {getLastMessage(chat)}
              </p>
              {chat.chatType === 'group' && (
                <span className={`badge mt-1 ${selectedChatId === chat.id ? 'bg-light text-primary' : 'bg-secondary'}`}>
                  Group
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatList;
