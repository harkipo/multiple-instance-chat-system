import React, { useEffect, useState } from 'react';
import { useQuery, useSubscription } from '@apollo/client';
import { GET_MESSAGE_READ_STATUS, MESSAGE_READ_UPDATED } from '../graphql/queries';

interface ReadReceiptIndicatorProps {
  messageId: string;
  senderId: string;
  currentUserId: string;
}

const ReadReceiptIndicator: React.FC<ReadReceiptIndicatorProps> = ({ 
  messageId, 
  senderId, 
  currentUserId 
}) => {
  const [isFullyRead, setIsFullyRead] = useState(false);

  // Only show read receipts for messages sent by current user
  const shouldShow = senderId === currentUserId;

  const { data, refetch } = useQuery(GET_MESSAGE_READ_STATUS, {
    variables: { messageId },
    skip: !shouldShow,
    onCompleted: (data) => {
      if (data?.messageReadStatus) {
        setIsFullyRead(data.messageReadStatus.isFullyRead);
      }
    },
  });

  // Subscribe to read status updates
  useSubscription(MESSAGE_READ_UPDATED, {
    variables: { messageId },
    skip: !shouldShow,
    onData: ({ data }) => {
      if (data.data?.messageReadUpdated) {
        // Refetch to get updated status
        refetch();
      }
    },
  });

  // Update local state when data changes
  useEffect(() => {
    if (data?.messageReadStatus) {
      setIsFullyRead(data.messageReadStatus.isFullyRead);
    }
  }, [data]);

  if (!shouldShow) {
    return null;
  }

  return (
    <span 
      style={{ 
        marginLeft: '5px',
        fontSize: '14px',
        display: 'inline-block',
      }}
      title={isFullyRead ? 'Read by all' : 'Sent'}
    >
      {isFullyRead ? (
        // Blue double tick - all participants have read
        <span style={{ color: '#0084ff' }}>✓✓</span>
      ) : (
        // Gray double tick - not all participants have read
        <span style={{ color: '#999' }}>✓✓</span>
      )}
    </span>
  );
};

export default ReadReceiptIndicator;

