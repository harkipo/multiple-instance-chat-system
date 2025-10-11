import { gql } from '@apollo/client';

// User queries
export const GET_USERS = gql`
  query GetUsers {
    users {
      id
      username
      email
      displayName
      createdAt
    }
  }
`;

export const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      username
      email
      displayName
      createdAt
    }
  }
`;

export const GET_USER_BY_USERNAME = gql`
  query GetUserByUsername($username: String!) {
    userByUsername(username: $username) {
      id
      username
      email
      displayName
      createdAt
    }
  }
`;

export const CREATE_USER = gql`
  mutation CreateUser($createUserInput: CreateUserInput!) {
    createUser(createUserInput: $createUserInput) {
      id
      username
      email
      displayName
      createdAt
    }
  }
`;

// Chat queries
export const GET_CHATS = gql`
  query GetChats {
    chats {
      id
      name
      description
      participantIds
      createdAt
      updatedAt
      messages {
        id
        content
        senderId
        createdAt
      }
    }
  }
`;

export const GET_CHAT = gql`
  query GetChat($id: ID!) {
    chat(id: $id) {
      id
      name
      description
      participantIds
      createdAt
      updatedAt
      messages {
        id
        content
        senderId
        createdAt
        isEdited
        editedAt
      }
    }
  }
`;

export const GET_CHATS_BY_PARTICIPANT = gql`
  query GetChatsByParticipant($userId: String!) {
    chatsByParticipant(userId: $userId) {
      id
      name
      description
      chatType
      participantIds
      createdAt
      updatedAt
      messages {
        id
        content
        senderId
        createdAt
        isEdited
        editedAt
      }
    }
  }
`;

export const CREATE_CHAT = gql`
  mutation CreateChat($createChatInput: CreateChatInput!) {
    createChat(createChatInput: $createChatInput) {
      id
      name
      description
      chatType
      participantIds
      createdAt
    }
  }
`;

export const ADD_PARTICIPANTS = gql`
  mutation AddParticipants($chatId: ID!, $userIds: [String!]!) {
    addParticipants(chatId: $chatId, userIds: $userIds) {
      id
      name
      participantIds
      updatedAt
    }
  }
`;

// Message queries
export const GET_MESSAGES = gql`
  query GetMessages($chatId: ID!) {
    messages(chatId: $chatId) {
      id
      content
      senderId
      chatId
      createdAt
      isEdited
      editedAt
    }
  }
`;

export const CREATE_MESSAGE = gql`
  mutation CreateMessage($createMessageInput: CreateMessageInput!) {
    createMessage(createMessageInput: $createMessageInput) {
      id
      content
      senderId
      chatId
      createdAt
    }
  }
`;

export const UPDATE_MESSAGE = gql`
  mutation UpdateMessage($id: ID!, $content: String!, $userId: String!) {
    updateMessage(id: $id, content: $content, userId: $userId) {
      id
      content
      senderId
      chatId
      createdAt
      isEdited
      editedAt
    }
  }
`;

export const DELETE_MESSAGE = gql`
  mutation DeleteMessage($id: ID!, $userId: String!) {
    removeMessage(id: $id, userId: $userId) {
      id
    }
  }
`;

// Subscriptions
export const MESSAGE_ADDED = gql`
  subscription MessageAdded($chatId: ID!) {
    messageAdded(chatId: $chatId) {
      id
      content
      senderId
      chatId
      createdAt
      isEdited
      editedAt
    }
  }
`;

export const MESSAGE_UPDATED = gql`
  subscription MessageUpdated($chatId: ID!) {
    messageUpdated(chatId: $chatId) {
      id
      content
      senderId
      chatId
      createdAt
      isEdited
      editedAt
    }
  }
`;

export const MESSAGE_DELETED = gql`
  subscription MessageDeleted($chatId: ID!) {
    messageDeleted(chatId: $chatId) {
      id
      chatId
    }
  }
`;

export const CHAT_ADDED = gql`
  subscription ChatAdded($userId: String!) {
    chatAdded(userId: $userId) {
      id
      name
      description
      chatType
      participantIds
      createdAt
      updatedAt
    }
  }
`;

export const CHAT_UPDATED = gql`
  subscription ChatUpdated($userId: String!) {
    chatUpdated(userId: $userId) {
      id
      name
      description
      chatType
      participantIds
      createdAt
      updatedAt
    }
  }
`;

export const CHAT_MESSAGE_NOTIFICATION = gql`
  subscription ChatMessageNotification($userId: String!) {
    chatMessageNotification(userId: $userId) {
      id
      content
      senderId
      chatId
      createdAt
      isEdited
      editedAt
    }
  }
`;

export const MESSAGE_UPDATE_FOR_CHAT_LIST = gql`
  subscription MessageUpdateForChatList($userId: String!) {
    messageUpdateForChatList(userId: $userId) {
      id
      content
      senderId
      chatId
      createdAt
      isEdited
      editedAt
    }
  }
`;

// Read Receipt queries and mutations
export const GET_MESSAGE_READ_STATUS = gql`
  query GetMessageReadStatus($messageId: ID!) {
    messageReadStatus(messageId: $messageId) {
      messageId
      totalParticipants
      readByCount
      isFullyRead
      readByUsers {
        userId
        readAt
      }
    }
  }
`;

export const MARK_MESSAGE_AS_READ = gql`
  mutation MarkMessageAsRead($messageId: ID!, $userId: String!) {
    markMessageAsRead(messageId: $messageId, userId: $userId) {
      id
      messageId
      userId
      readAt
    }
  }
`;

export const MESSAGE_READ_UPDATED = gql`
  subscription MessageReadUpdated($messageId: ID!) {
    messageReadUpdated(messageId: $messageId) {
      messageId
      userId
      readAt
    }
  }
`;

// Unread count queries and subscriptions
export const GET_UNREAD_COUNTS = gql`
  query GetUnreadCounts($userId: String!) {
    unreadCounts(userId: $userId) {
      id
      chatId
      userId
      unreadCount
      createdAt
      updatedAt
    }
  }
`;

export const GET_UNREAD_COUNT = gql`
  query GetUnreadCount($chatId: ID!, $userId: String!) {
    unreadCount(chatId: $chatId, userId: $userId)
  }
`;

export const UNREAD_COUNT_UPDATED = gql`
  subscription UnreadCountUpdated($userId: String!) {
    unreadCountUpdated(userId: $userId) {
      chatId
      userId
      unreadCount
    }
  }
`;