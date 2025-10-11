import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_USERS, ADD_PARTICIPANTS } from '../graphql/queries';

interface AddUsersModalProps {
  chatId: string;
  currentParticipants: string[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddUsersModal: React.FC<AddUsersModalProps> = ({ 
  chatId, 
  currentParticipants, 
  isOpen,
  onClose, 
  onSuccess 
}) => {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const currentUserId = localStorage.getItem('userId');

  const { data: usersData, loading: usersLoading } = useQuery(GET_USERS);
  const [addParticipants] = useMutation(ADD_PARTICIPANTS);

  // Filter out users who are already participants AND the current user
  const availableUsers = usersData?.users?.filter(
    (user: any) => !currentParticipants.includes(user.id) && user.id !== currentUserId
  ) || [];

  // Filter users based on search term
  const filteredUsers = availableUsers.filter((user: any) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (user.displayName || user.username).toLowerCase().includes(searchLower) ||
      user.username.toLowerCase().includes(searchLower)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUsers.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addParticipants({
        variables: {
          chatId,
          userIds: selectedUsers,
        },
      });
      setSelectedUsers([]);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding participants:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      // Deselect all
      setSelectedUsers([]);
    } else {
      // Select all filtered users
      setSelectedUsers(filteredUsers.map((user: any) => user.id));
    }
  };

  const handleClose = () => {
    setSelectedUsers([]);
    setSearchTerm('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title d-flex align-items-center">
              <i className="bi bi-people-fill me-2"></i>
              Add Users to Chat
            </h5>
            <button 
              type="button" 
              className="btn-close btn-close-white" 
              onClick={handleClose}
              disabled={isSubmitting}
            ></button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {usersLoading ? (
                <div className="text-center p-3">
                  <div className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">Loading users...</span>
                  </div>
                </div>
              ) : !usersData?.users || usersData.users.length === 0 ? (
                <div className="alert alert-warning" role="alert">
                  <p className="mb-0">No users found in the system.</p>
                </div>
              ) : availableUsers.length === 0 ? (
                <div className="alert alert-info" role="alert">
                  <p className="mb-0">All users are already in this chat.</p>
                </div>
              ) : (
                <>
                  <p className="text-muted small mb-3">
                    Select users to add to this group chat:
                  </p>
                  
                  {/* Search input */}
                  <div className="mb-3">
                    <div className="input-group">
                      <span className="input-group-text">
                        <i className="bi bi-search"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  {/* Select All button */}
                  {filteredUsers.length > 0 && (
                    <div className="mb-2">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={handleSelectAll}
                        disabled={isSubmitting}
                      >
                        {selectedUsers.length === filteredUsers.length ? 'Deselect All' : 'Select All'}
                      </button>
                      <small className="text-muted ms-2">
                        {selectedUsers.length} of {filteredUsers.length} selected
                      </small>
                    </div>
                  )}

                  <div 
                    className="border rounded p-2" 
                    style={{ maxHeight: '300px', overflowY: 'auto' }}
                  >
                    {filteredUsers.length === 0 ? (
                      <div className="text-center text-muted p-3">
                        <i className="bi bi-person-x" style={{ fontSize: '2rem' }}></i>
                        <p className="mt-2 mb-0">No users found matching your search.</p>
                      </div>
                    ) : (
                      filteredUsers.map((user: any) => (
                      <div key={user.id} className="user-selection-item">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`add-user-${user.id}`}
                            checked={selectedUsers.includes(user.id)}
                            onChange={() => handleUserToggle(user.id)}
                            disabled={isSubmitting}
                          />
                        </div>
                        <label className="form-check-label d-flex align-items-center flex-grow-1" htmlFor={`add-user-${user.id}`}>
                          <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3" 
                               style={{ width: '40px', height: '40px', fontSize: '16px', fontWeight: 'bold' }}>
                            {(user.displayName || user.username).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="fw-semibold mb-1">{user.displayName || user.username}</div>
                            <small className="text-muted">@{user.username}</small>
                          </div>
                        </label>
                      </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={selectedUsers.length === 0 || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Adding...
                  </>
                ) : (
                  `Add ${selectedUsers.length} User${selectedUsers.length !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddUsersModal;
