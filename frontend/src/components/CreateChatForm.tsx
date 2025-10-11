import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { GET_USERS } from '../graphql/queries';

interface CreateChatFormProps {
  onCreateChat: (name: string, description: string, participantIds: string[], chatType: string) => void;
  onCancel: () => void;
}

const CreateChatForm: React.FC<CreateChatFormProps> = ({ onCreateChat, onCancel }) => {
  const [chatType, setChatType] = useState<'direct' | 'group'>('group');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');

  const { data: usersData, loading: usersLoading } = useQuery(GET_USERS);
  const currentUserId = localStorage.getItem('userId');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    // Validation based on chat type
    if (chatType === 'direct' && !selectedUser) return;
    if (chatType === 'group' && (!name.trim() || selectedParticipants.length === 0)) return;

    setIsSubmitting(true);
    try {
      const participants = chatType === 'direct' ? [selectedUser] : selectedParticipants;
      await onCreateChat(name.trim(), description.trim(), participants, chatType);
    } catch (error) {
      console.error('Error creating chat:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChatTypeChange = (type: 'direct' | 'group') => {
    setChatType(type);
    if (type === 'direct') {
      // Clear group selections and reset
      setSelectedParticipants([]);
      setSelectedUser('');
      setName('');
      setDescription('');
    } else {
      // Clear direct selection
      setSelectedUser('');
    }
  };

  const handleUserSelect = (userId: string) => {
    setSelectedUser(userId);
    // Auto-set the chat name to the selected user's display name
    const user = usersData?.users?.find((u: any) => u.id === userId);
    if (user) {
      setName(user.displayName || user.username);
    }
  };

  const handleParticipantToggle = (userId: string) => {
    if (chatType === 'direct' && selectedParticipants.length >= 1 && !selectedParticipants.includes(userId)) {
      setSelectedParticipants([userId]);
    } else {
      setSelectedParticipants(prev => 
        prev.includes(userId) 
          ? prev.filter(id => id !== userId)
          : [...prev, userId]
      );
    }
  };

  if (usersLoading) {
    return (
      <div className="text-center p-3">
        <div className="spinner-border spinner-border-sm" role="status">
          <span className="visually-hidden">Loading users...</span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3">
      <div className="mb-3">
        <label className="form-label fw-bold small">Chat Type:</label>
        <div className="btn-group w-100" role="group">
          <input
            type="radio"
            className="btn-check"
            name="chatType"
            id="groupRadio"
            value="group"
            checked={chatType === 'group'}
            onChange={() => handleChatTypeChange('group')}
            disabled={isSubmitting}
          />
          <label className="btn btn-outline-primary btn-sm" htmlFor="groupRadio">
            Group Chat
          </label>
          
          <input
            type="radio"
            className="btn-check"
            name="chatType"
            id="directRadio"
            value="direct"
            checked={chatType === 'direct'}
            onChange={() => handleChatTypeChange('direct')}
            disabled={isSubmitting}
          />
          <label className="btn btn-outline-primary btn-sm" htmlFor="directRadio">
            1:1 Chat
          </label>
        </div>
      </div>

      {chatType === 'group' && (
        <div className="mb-2">
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Chat name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>
      )}
      
      {chatType === 'direct' && name && (
        <div className="alert alert-info py-2 small" role="alert">
          Chat with: <strong>{name}</strong>
        </div>
      )}
      
      {/* {chatType === 'group' && (
        <div className="mb-2">
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      )} */}

      <div className="mb-3">
        <label className="form-label fw-bold small">
          {chatType === 'direct' ? 'Select contact:' : 'Select participants:'}
        </label>
        
        {chatType === 'direct' ? (
          <select
            className="form-select form-select-sm"
            value={selectedUser}
            onChange={(e) => handleUserSelect(e.target.value)}
            disabled={isSubmitting}
          >
            <option value="">Choose a contact...</option>
            {usersData?.users
              ?.filter((user: any) => {
                const isCurrentUser = user.id === currentUserId || user.username === localStorage.getItem('username');
                return !isCurrentUser;
              })
              ?.map((user: any) => (
                <option key={user.id} value={user.id}>
                  {user.displayName || user.username}
                </option>
              ))}
          </select>
        ) : (
          <div className="border rounded p-2" style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {usersData?.users?.map((user: any) => (
              <div key={user.id} className="form-check small">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id={`user-${user.id}`}
                  checked={selectedParticipants.includes(user.id)}
                  onChange={() => handleParticipantToggle(user.id)}
                  disabled={isSubmitting}
                />
                <label className="form-check-label" htmlFor={`user-${user.id}`}>
                  {user.displayName || user.username}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="d-flex gap-2">
        <button
          type="submit"
          className="btn btn-success btn-sm flex-fill"
          disabled={
            isSubmitting || 
            (chatType === 'direct' && !selectedUser) ||
            (chatType === 'group' && (!name.trim() || selectedParticipants.length === 0))
          }
        >
          {isSubmitting ? (
            <>
              <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
              Creating...
            </>
          ) : (
            `Create ${chatType === 'direct' ? 'Chat' : 'Group'}`
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="btn btn-secondary btn-sm flex-fill"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default CreateChatForm;
