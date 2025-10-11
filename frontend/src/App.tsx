import React from 'react';
import { ApolloProvider } from '@apollo/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { apolloClient } from './apollo/client';
import Login from './components/Login';
import ChatApp from './components/ChatApp';

function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/chat" element={<ChatApp />} />
          </Routes>
        </div>
      </Router>
    </ApolloProvider>
  );
}

export default App;
