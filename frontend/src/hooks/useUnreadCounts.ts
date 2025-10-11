import { useState, useEffect } from 'react';
import { useQuery, useSubscription } from '@apollo/client';
import { GET_UNREAD_COUNTS, UNREAD_COUNT_UPDATED } from '../graphql/queries';

interface UnreadCount {
  id: string;
  chatId: string;
  userId: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

interface UnreadCountsHook {
  unreadCounts: Record<string, number>; // chatId -> count
  getUnreadCount: (chatId: string) => number;
  hasUnreadMessages: (chatId: string) => boolean;
  loading: boolean;
  error: any;
}

export const useUnreadCounts = (userId: string): UnreadCountsHook => {
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const { data, loading, error, refetch } = useQuery(GET_UNREAD_COUNTS, {
    variables: { userId },
    skip: !userId,
    fetchPolicy: 'cache-and-network',
    onCompleted: (data) => {
      if (data?.unreadCounts) {
        const countsMap: Record<string, number> = {};
        data.unreadCounts.forEach((count: UnreadCount) => {
          countsMap[count.chatId] = count.unreadCount;
        });
        setUnreadCounts(countsMap);
      }
    },
  });

  // Subscribe to unread count updates
  useSubscription(UNREAD_COUNT_UPDATED, {
    variables: { userId },
    skip: !userId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData?.data?.unreadCountUpdated) {
        const update = subscriptionData.data.unreadCountUpdated;
        setUnreadCounts(prev => ({
          ...prev,
          [update.chatId]: update.unreadCount,
        }));
      }
    },
    onError: (error) => {
      console.error('Unread count subscription error:', error);
    },
  });

  const getUnreadCount = (chatId: string): number => {
    return unreadCounts[chatId] || 0;
  };

  const hasUnreadMessages = (chatId: string): boolean => {
    return getUnreadCount(chatId) > 0;
  };

  return {
    unreadCounts,
    getUnreadCount,
    hasUnreadMessages,
    loading,
    error,
  };
};
