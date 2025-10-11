import React from 'react';

interface UnreadIndicatorProps {
  chatId: string;
  userId: string;
  hasUnreadMessages: boolean;
  unreadCount: number;
  isSelected?: boolean;
}

const UnreadIndicator: React.FC<UnreadIndicatorProps> = ({
  chatId,
  userId,
  hasUnreadMessages,
  unreadCount,
  isSelected = false,
}) => {
  // Don't show indicator if no unread messages or if this is the currently selected chat
  if (!hasUnreadMessages || isSelected) {
    return null;
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '18px',
        height: '18px',
        backgroundColor: '#007bff',
        color: 'white',
        fontSize: '11px',
        fontWeight: 'bold',
        marginLeft: '8px',
        padding: unreadCount > 99 ? '2px 4px' : '0 4px',
        borderRadius: unreadCount > 99 ? '9px' : '50%',
      }}
      title={`${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}`}
    >
      {unreadCount > 99 ? '99+' : unreadCount}
    </div>
  );
};

export default UnreadIndicator;
