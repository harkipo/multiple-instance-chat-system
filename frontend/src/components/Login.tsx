import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { CREATE_USER, GET_USER_BY_USERNAME, GET_USERS } from '../graphql/queries';
import { useNavigate } from 'react-router-dom';
import { getActiveSession, setSession } from '../utils/session';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const navigate = useNavigate();

  const [createUser] = useMutation(CREATE_USER);
  const { data: usersData } = useQuery(GET_USERS);

  // Check for existing session and redirect if user is already logged in
  useEffect(() => {
    const session = getActiveSession();
    
    if (session) {
      // User has an active session, redirect to chat
      console.log('User already logged in, redirecting to chat...');
      navigate('/chat');
    } else {
      // No active session, show login form
      setIsCheckingSession(false);
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // First, try to find existing user
      try {
        const { data: existingUser } = await createUser({
          variables: {
            createUserInput: {
              username,
              email,
              displayName: displayName || username,
            },
          },
        });

        if (existingUser?.createUser) {
          // Store user info in localStorage
          setSession({
            userId: existingUser.createUser.id,
            username: existingUser.createUser.username,
            displayName: existingUser.createUser.displayName || existingUser.createUser.username,
          });
          
          navigate('/chat');
        }
      } catch (createError: any) {
        // If user already exists, try to find them
        if (createError.message.includes('already exists')) {
          try {
            // Find existing user by username or email
            const existingUser = usersData?.users?.find((user: any) => 
              user.username === username || user.email === email
            );
            
            if (existingUser) {
              // Use the actual UUID from the database
              setSession({
                userId: existingUser.id,
                username: existingUser.username,
                displayName: existingUser.displayName || existingUser.username,
              });
              
              navigate('/chat');
            } else {
              setError('User already exists but could not be found. Please try again.');
            }
          } catch (lookupError) {
            setError('User already exists. Please use a different username or email.');
          }
        } else {
          setError(createError.message);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading screen while checking for existing session
  if (isCheckingSession) {
    return (
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-5">
            <div className="card shadow-lg mt-5">
              <div className="card-body p-4 text-center">
                <div className="spinner-border text-primary mb-3" role="status">
                  <span className="visually-hidden">Checking session...</span>
                </div>
                <p className="text-muted">Checking for existing session...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-5">
          <div className="card shadow-lg mt-5">
            <div className="card-body p-4">
              <h2 className="card-title text-center mb-4">Join Chat System</h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="username" className="form-label">Username</label>
                  <input
                    type="text"
                    className="form-control"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={isLoading}
                    placeholder="Enter username"
                  />
                </div>
                
                <div className="mb-3">
                  <label htmlFor="email" className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    placeholder="Enter email"
                  />
                </div>
                
                <div className="mb-3">
                  <label htmlFor="displayName" className="form-label">Display Name <small className="text-muted">(Optional)</small></label>
                  <input
                    type="text"
                    className="form-control"
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={isLoading}
                    placeholder="Enter display name"
                  />
                </div>
                
                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}
                
                <div className="d-grid">
                  <button 
                    type="submit" 
                    className="btn btn-primary btn-lg" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Joining...
                      </>
                    ) : (
                      'Join Chat'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
