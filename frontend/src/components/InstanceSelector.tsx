import React, { useState, useEffect } from 'react';
import { createApolloClient } from '../apollo/client';

interface InstanceSelectorProps {
  onInstanceChange?: () => void;
}

const InstanceSelector: React.FC<InstanceSelectorProps> = ({ onInstanceChange }) => {
  const [senderPort, setSenderPort] = useState(() => 
    localStorage.getItem('senderPort') || '4002'
  );
  const [receiverPort, setReceiverPort] = useState(() => 
    localStorage.getItem('receiverPort') || '4005'
  );

  // Initialize Apollo client on component mount
  useEffect(() => {
    createApolloClient();
  }, []);

  const handleSenderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPort = e.target.value;
    setSenderPort(newPort);
    localStorage.setItem('senderPort', newPort);
    
    // Recreate Apollo client when sender instance changes
    console.log('Sender instance changed to:', newPort);
    createApolloClient();
    
    // Small delay to ensure connections are established before reloading
    setTimeout(() => {
      if (onInstanceChange) {
        onInstanceChange();
      }
    }, 1000);
  };

  const handleReceiverChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPort = e.target.value;
    setReceiverPort(newPort);
    localStorage.setItem('receiverPort', newPort);
    
    // Recreate Apollo client when receiver instance changes
    console.log('Receiver instance changed to:', newPort);
    createApolloClient();
    
    // Small delay to ensure WebSocket connection is established before reloading
    setTimeout(() => {
      if (onInstanceChange) {
        onInstanceChange();
      }
    }, 1500);
  };

  return (
    <div style={{
      display: 'flex',
      gap: '15px',
      padding: '10px 15px',
      backgroundColor: '#f0f2f5',
      borderRadius: '8px',
      alignItems: 'center',
      fontSize: '13px',
    }}>
      <div style={{ fontWeight: 'bold', color: '#555' }}>Backend Instances:</div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label htmlFor="sender-select" style={{ fontWeight: '500', color: '#666' }}>
          Sender:
        </label>
        <select
          id="sender-select"
          value={senderPort}
          onChange={handleSenderChange}
          style={{
            padding: '5px 10px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            backgroundColor: 'white',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          <option value="4002">Instance 1 (Port 4002)</option>
          <option value="4004">Instance 2 (Port 4004)</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label htmlFor="receiver-select" style={{ fontWeight: '500', color: '#666' }}>
          Receiver:
        </label>
        <select
          id="receiver-select"
          value={receiverPort}
          onChange={handleReceiverChange}
          style={{
            padding: '5px 10px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            backgroundColor: 'white',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          <option value="4005">Instance 1 (Port 4005)</option>
          <option value="4006">Instance 2 (Port 4006)</option>
        </select>
      </div>

      <div style={{ fontSize: '11px', color: '#888', marginLeft: 'auto' }}>
        Connected to: Sender {senderPort === '4002' ? '1' : '2'} | Receiver {receiverPort === '4005' ? '1' : '2'}
      </div>
    </div>
  );
};

export default InstanceSelector;

