import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { GET_CHATS_BY_PARTICIPANT, CREATE_CHAT, GET_MESSAGES, CREATE_MESSAGE, MESSAGE_ADDED, ADD_PARTICIPANTS, GET_USERS, CHAT_ADDED, CHAT_UPDATED, CHAT_MESSAGE_NOTIFICATION, MESSAGE_UPDATE_FOR_CHAT_LIST } from '../graphql/queries';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import CreateChatForm from './CreateChatForm';
import InstanceSelector from './InstanceSelector';

const ChatApp: React.FC = () => {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showCreateChat, setShowCreateChat] = useState(false);
  const userId = localStorage.getItem('userId');
  const username = localStorage.getItem('username');
  const displayName = localStorage.getItem('displayName');

  const { data: chatsData, loading: chatsLoading, refetch: refetchChats } = useQuery(
    GET_CHATS_BY_PARTICIPANT,
    {
      variables: { userId },
      skip: !userId,
      fetchPolicy: 'cache-and-network', // Ensure we get fresh data
      onCompleted: (data) => {
        // Debug: Log chat data in development (can be removed after testing)
        if (process.env.NODE_ENV === 'development') {
          console.log('Chat data received:', data);
          if (data?.chatsByParticipant) {
            data.chatsByParticipant.forEach((chat: any) => {
              if (chat.chatType === 'group' && chat.messages && chat.messages.length > 0) {
                console.log(`Group chat "${chat.name}" has ${chat.messages.length} messages:`, 
                  chat.messages.map((msg: any) => ({
                    content: msg.content,
                    senderId: msg.senderId,
                    createdAt: msg.createdAt
                  }))
                );
              }
            });
          }
        }
      }
    }
  );

  const { data: usersData } = useQuery(GET_USERS);

  const { data: messagesData, loading: messagesLoading, refetch: refetchMessages } = useQuery(
    GET_MESSAGES,
    {
      variables: { chatId: selectedChatId },
      skip: !selectedChatId,
    }
  );

  const [createChat] = useMutation(CREATE_CHAT, {
    onCompleted: (data) => {
      refetchChats();
      setShowCreateChat(false);
      // Auto-select the newly created chat
      if (data?.createChat?.id) {
        setSelectedChatId(data.createChat.id);
      }
    },
  });

  const [addParticipants] = useMutation(ADD_PARTICIPANTS, {
    onCompleted: () => {
      refetchChats();
    },
  });

  const [createMessage] = useMutation(CREATE_MESSAGE, {
    onCompleted: () => {
      // Refetch messages after sending to ensure UI is updated
      refetchMessages();
    },
  });

  // Subscribe to new messages for the selected chat
  useSubscription(MESSAGE_ADDED, {
    variables: { chatId: selectedChatId },
    skip: !selectedChatId,
    onData: ({ data }) => {
      console.log('MESSAGE_ADDED subscription received:', data);
      if (data.data?.messageAdded) {
        console.log('New message received:', data.data.messageAdded);
        // Refetch messages to get the latest
        refetchMessages();
      }
    },
    onError: (error) => {
      console.error('MESSAGE_ADDED subscription error:', error);
    },
  });

  // Subscribe to new chats for the current user
  useSubscription(CHAT_ADDED, {
    variables: { userId },
    skip: !userId,
    onData: ({ data }) => {
      if (data.data?.chatAdded) {
        console.log('New chat added:', data.data.chatAdded);
        // Refetch chats to get the latest
        refetchChats();
      }
    },
  });

  // Subscribe to chat updates for the current user
  useSubscription(CHAT_UPDATED, {
    variables: { userId },
    skip: !userId,
    onData: ({ data }) => {
      if (data.data?.chatUpdated) {
        console.log('Chat updated:', data.data.chatUpdated);
        // Refetch chats to get the latest
        refetchChats();
      }
    },
  });

  // Subscribe to chat message notifications for the current user
  // This helps ensure users see chats when they receive messages
  useSubscription(CHAT_MESSAGE_NOTIFICATION, {
    variables: { userId },
    skip: !userId,
    onData: ({ data }) => {
      if (data.data?.chatMessageNotification) {
        console.log('Chat message notification:', data.data.chatMessageNotification);
        // Refetch chats to ensure the chat appears in the list
        refetchChats();
      }
    },
  });

  // Subscribe to message updates for chat list refresh
  // This ensures chat lists are updated when messages are sent by other users
  useSubscription(MESSAGE_UPDATE_FOR_CHAT_LIST, {
    variables: { userId },
    skip: !userId,
    onData: ({ data }) => {
      if (data.data?.messageUpdateForChatList) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Message update for chat list:', data.data.messageUpdateForChatList);
          console.log('Refetching chats to update latest message for all participants...');
        }
        // Refetch chats to update the latest message in chat list
        refetchChats();
      }
    },
  });

  useEffect(() => {
    if (!userId) {
      window.location.href = '/';
      return;
    }

    // Check if userId is a valid UUID, if not, try to find the correct user
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidUUID = uuidRegex.test(userId);
    
    if (!isValidUUID) {
      console.warn('Invalid UUID detected, attempting to fix:', userId);
      const currentUsername = localStorage.getItem('username');
      
      if (currentUsername && usersData?.users) {
        const correctUser = usersData.users.find((user: any) => user.username === currentUsername);
        if (correctUser) {
          console.log('Found correct user, updating localStorage:', correctUser.id);
          localStorage.setItem('userId', correctUser.id);
          localStorage.setItem('displayName', correctUser.displayName || correctUser.username);
          // Reload to use the correct user ID
          window.location.reload();
        }
      }
    }
  }, [userId, usersData]);

  const handleCreateChat = async (name: string, description: string, participantIds: string[], chatType: string) => {
    try {
      await createChat({
        variables: {
          createChatInput: {
            name,
            description,
            chatType,
            participantIds: [...participantIds, userId],
          },
        },
      });
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedChatId || !userId) {
      console.error('Missing selectedChatId or userId:', { selectedChatId, userId });
      return;
    }

    // Debug: Check if userId is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidUUID = uuidRegex.test(userId);
    console.log('User ID validation:', { userId, isValidUUID, userIdLength: userId.length });
    console.log('Sending message:', { content, senderId: userId, chatId: selectedChatId });

    try {
      const result = await createMessage({
        variables: {
          createMessageInput: {
            content,
            senderId: userId,
            chatId: selectedChatId,
          },
        },
      });
      console.log('Message sent successfully:', result);
      
      // Refetch chats to update the latest message in the chat list for the sender
      // The subscriptions will handle updates for other users
      refetchChats();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  const handleInstanceChange = () => {
    // Reload the page to reconnect with the new instances
    window.location.reload();
  };

  if (chatsLoading) {
    return (
      <div className="container mt-5">
        <div className="d-flex justify-content-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading chats...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid p-3">
      <nav className="navbar navbar-dark bg-primary rounded mb-3">
        <div className="container-fluid">
          <span className="navbar-brand mb-0 h1">Real-time Chat System</span>
          <div className="d-flex align-items-center">
            <span className="text-white me-3">Welcome, <strong>{displayName || username}</strong></span>
            <button onClick={handleLogout} className="btn btn-light btn-sm">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="mb-3">
        <InstanceSelector onInstanceChange={handleInstanceChange} />
      </div>

      <div className="chat-container rounded shadow">
        <div className="chat-sidebar">
          <div className="p-3 border-bottom">
            <button 
              onClick={() => setShowCreateChat(!showCreateChat)}
              className={`btn w-100 ${showCreateChat ? 'btn-secondary' : 'btn-success'}`}
            >
              {showCreateChat ? 'Cancel' : '+ Create New Chat'}
            </button>
            {showCreateChat && (
              <CreateChatForm
                onCreateChat={handleCreateChat}
                onCancel={() => setShowCreateChat(false)}
              />
            )}
          </div>
          
          <ChatList
            chats={chatsData?.chatsByParticipant || []}
            selectedChatId={selectedChatId}
            onSelectChat={setSelectedChatId}
            currentUserId={userId || ''}
            users={usersData?.users || []}
          />
        </div>

        <div className="chat-messages">
          {selectedChatId ? (
            <ChatWindow
              chatId={selectedChatId}
              messages={messagesData?.messages || []}
              onSendMessage={handleSendMessage}
              isLoading={messagesLoading}
              chatType={chatsData?.chatsByParticipant?.find((chat: any) => chat.id === selectedChatId)?.chatType}
              participantIds={chatsData?.chatsByParticipant?.find((chat: any) => chat.id === selectedChatId)?.participantIds || []}
              users={usersData?.users || []}
            />
          ) : (
            <div className="d-flex align-items-center justify-content-center h-100 text-muted">
              <div className="text-center">
                <i className="bi bi-chat-dots" style={{ fontSize: '4rem' }}></i>
                <p className="mt-3 fs-5">Select a chat to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatApp;
