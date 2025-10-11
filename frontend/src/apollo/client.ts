import { ApolloClient, InMemoryCache, createHttpLink, split, ApolloLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { Kind, OperationDefinitionNode } from 'graphql';
import { createClient } from 'graphql-ws';

// Get selected instances from localStorage or use defaults
const getSenderPort = () => localStorage.getItem('senderPort') || '4002';
const getReceiverPort = () => localStorage.getItem('receiverPort') || '4005';

// HTTP link for User Service
const userServiceLink = createHttpLink({
  uri: 'http://localhost:4001/graphql',
});

// Function to create sender service link dynamically
const createSenderLink = () => createHttpLink({
  uri: `http://localhost:${getSenderPort()}/graphql`,
});

// Function to create receiver service link dynamically
const createReceiverLink = () => createHttpLink({
  uri: `http://localhost:${getReceiverPort()}/graphql`,
});

// Function to create WebSocket link dynamically
const createWsLink = () => {
  const wsUrl = `ws://localhost:${getReceiverPort()}/graphql`;
  console.log('Creating WebSocket connection to:', wsUrl);
  
  return new GraphQLWsLink(createClient({
    url: wsUrl,
    connectionParams: () => {
      const userId = localStorage.getItem('userId');
      const username = localStorage.getItem('username');
      return {
        'user-id': userId || '',
        'username': username || '',
      };
    },
    shouldRetry: () => true,
    retryAttempts: 5,
  }));
};

// Auth link to add user context
const authLink = setContext((_, { headers }) => {
  const userId = localStorage.getItem('userId');
  const username = localStorage.getItem('username');
  
  return {
    headers: {
      ...headers,
      'user-id': userId || '',
      'username': username || '',
    }
  };
});

// Determine if operation is a mutation
const isMutation = (operation: any) => {
  const definition = getMainDefinition(operation.query);
  return definition.kind === Kind.OPERATION_DEFINITION && definition.operation === 'mutation';
};

// Determine if operation is a subscription
const isSubscription = (operation: any) => {
  const definition = getMainDefinition(operation.query);
  return definition.kind === Kind.OPERATION_DEFINITION && definition.operation === 'subscription';
};

// Determine if operation is chat/message related
const isChatMessageOperation = (operation: any) => {
  const definition = getMainDefinition(operation.query) as OperationDefinitionNode;
  const operationName = operation.operationName || definition.name?.value || '';
  
  const chatMessageOperations = [
    'chats', 'chat', 'chatsByParticipant',
    'messages', 'message', 'messageReadStatus',
    'createChat', 'addParticipant', 'addParticipants', 'removeParticipant', 'removeChat',
    'createMessage', 'updateMessage', 'removeMessage', 'markMessageAsRead',
    'chatAdded', 'chatUpdated',
    'messageAdded', 'messageUpdated', 'messageDeleted', 'messageReadUpdated',
    'chatMessageNotification', 'messageUpdateForChatList',
    'unreadCounts', 'unreadCount', 'unreadCountUpdated',
  ];
  
  return chatMessageOperations.some(op => 
    operationName.toLowerCase().includes(op.toLowerCase())
  );
};

// Create routing link that selects the correct service
const routingLink = new ApolloLink((operation, forward) => {
  const isChatMsg = isChatMessageOperation(operation);
  const isMut = isMutation(operation);
  
  // User operations go to user service
  if (!isChatMsg) {
    operation.setContext({
      uri: 'http://localhost:4001/graphql'
    });
  }
  // Chat/Message mutations go to sender service
  else if (isMut) {
    operation.setContext({
      uri: `http://localhost:${getSenderPort()}/graphql`
    });
  }
  // Chat/Message queries go to receiver service
  else {
    operation.setContext({
      uri: `http://localhost:${getReceiverPort()}/graphql`
    });
  }
  
  return forward(operation);
});

// Create dynamic HTTP link that uses the URI from context
const httpLink = createHttpLink({
  uri: (operation) => {
    return operation.getContext().uri || 'http://localhost:4001/graphql';
  },
});

// Combine auth and routing with HTTP link
const httpLinkWithAuth = authLink.concat(routingLink).concat(httpLink);

// Split link to use HTTP for queries/mutations and WebSocket for subscriptions
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === Kind.OPERATION_DEFINITION &&
      definition.operation === 'subscription'
    );
  },
  createWsLink(),
  httpLinkWithAuth
);

// Store the current Apollo client instance
let currentApolloClient: ApolloClient<any> | null = null;

// Function to create a new Apollo client instance
export const createApolloClient = () => {
  // Close existing WebSocket connection if client exists
  if (currentApolloClient) {
    console.log('Closing existing Apollo client and WebSocket connections...');
    currentApolloClient.stop();
  }
  
  const receiverPort = getReceiverPort();
  console.log('Creating new Apollo client with receiver port:', receiverPort);
  
  // Create WebSocket link with current port
  const wsClient = createClient({
    url: `ws://localhost:${receiverPort}/graphql`,
    connectionParams: () => {
      const userId = localStorage.getItem('userId');
      const username = localStorage.getItem('username');
      return {
        'user-id': userId || '',
        'username': username || '',
      };
    },
    shouldRetry: () => true,
    retryAttempts: 5,
  });
  
  // Add connection event listeners for debugging
  wsClient.on('connected', () => {
    console.log('WebSocket connected to receiver port:', receiverPort);
  });
  
  wsClient.on('closed', () => {
    console.log('WebSocket connection closed');
  });
  
  wsClient.on('error', (error) => {
    console.error('WebSocket connection error:', error);
  });
  
  const wsLink = new GraphQLWsLink(wsClient);
  
  const newClient = new ApolloClient({
    link: split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === Kind.OPERATION_DEFINITION &&
          definition.operation === 'subscription'
        );
      },
      wsLink,
      httpLinkWithAuth
    ),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        errorPolicy: 'all',
      },
      query: {
        errorPolicy: 'all',
      },
    },
  });
  
  currentApolloClient = newClient;
  return newClient;
};

export const apolloClient = createApolloClient();
