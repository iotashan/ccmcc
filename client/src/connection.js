import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { PROTOCOL_VERSION, ClientMessageTypes, ServerMessageTypes } from '../../shared/protocol.js';
import { saveAuthToken } from './config.js';

export class MachineConnection extends EventEmitter {
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.heartbeatTimer = null;
    this.machineId = null;
    this.authToken = config.authToken;
  }

  async connect() {
    try {
      const serverUrl = this.config.serverAddress.replace(/^http/, 'ws');
      const url = `${serverUrl}/machine?token=${encodeURIComponent(this.authToken || '')}`;
      
      this.logger.info(`Connecting to ${serverUrl}...`);
      
      this.ws = new WebSocket(url);
      
      this.ws.on('open', () => this.handleOpen());
      this.ws.on('message', (data) => this.handleMessage(data));
      this.ws.on('close', () => this.handleClose());
      this.ws.on('error', (error) => this.handleError(error));
      
    } catch (error) {
      this.logger.error('Connection error:', error);
      this.scheduleReconnect();
    }
  }

  handleOpen() {
    this.logger.info('WebSocket connected');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    
    // Send registration message
    this.send({
      type: ClientMessageTypes.MACHINE_REGISTER,
      name: this.config.clientName,
      ip_address: this.config.clientName,
      capabilities: this.config.capabilities,
      auth_token: this.authToken,
      protocol_version: PROTOCOL_VERSION
    });
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      
      if (this.config.debug) {
        this.logger.debug('Received:', message.type);
      }
      
      switch (message.type) {
        case ServerMessageTypes.REGISTER_ACK:
          this.handleRegisterAck(message);
          break;
          
        case ServerMessageTypes.REGISTER_ERROR:
          this.logger.error('Registration failed:', message.error);
          this.disconnect();
          break;
          
        case ServerMessageTypes.HEARTBEAT_ACK:
          // Heartbeat acknowledged
          break;
          
        case ServerMessageTypes.REQUEST_PROJECT_LIST:
          this.emit('request:projects', message);
          break;
          
        case ServerMessageTypes.REQUEST_SESSION_LIST:
          this.emit('request:sessions', message);
          break;
          
        case ServerMessageTypes.REQUEST_CLAUDE_EXECUTE:
          this.emit('request:claude', message);
          break;
          
        case ServerMessageTypes.REQUEST_FILE_OPERATION:
          this.emit('request:file', message);
          break;
          
        case ServerMessageTypes.REQUEST_GIT_OPERATION:
          this.emit('request:git', message);
          break;
          
        case ServerMessageTypes.REQUEST_API_FORWARD:
          this.emit('request:api', message);
          break;
          
        default:
          this.logger.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      this.logger.error('Error handling message:', error);
    }
  }

  handleRegisterAck(message) {
    this.machineId = message.machine.id;
    this.authToken = message.machine.auth_token;
    
    this.logger.info(`Registered as machine: ${message.machine.name} (${this.machineId})`);
    
    // Save auth token for future connections
    if (message.machine.auth_token && !this.config.authToken) {
      this.logger.info('Received auth token - saving to .env file...');
      const saved = saveAuthToken(message.machine.auth_token);
      if (saved) {
        this.logger.info('Auth token saved successfully to .env file');
      } else {
        this.logger.warn('Failed to save auth token to .env file');
        this.logger.info('You can manually add to .env:');
        this.logger.info(`CLAUDE_CODE_UI_AUTH_TOKEN=${message.machine.auth_token}`);
      }
    }
    
    // Start heartbeat
    this.startHeartbeat();
    
    this.emit('registered', message.machine);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected && this.machineId) {
        this.send({
          type: ClientMessageTypes.MACHINE_HEARTBEAT,
          machine_id: this.machineId
        });
      }
    }, this.config.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  handleClose() {
    this.logger.warn('WebSocket disconnected');
    this.isConnected = false;
    this.stopHeartbeat();
    this.scheduleReconnect();
  }

  handleError(error) {
    this.logger.error('WebSocket error:', error.message);
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached. Giving up.');
      process.exit(1);
    }
    
    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval * this.reconnectAttempts;
    
    this.logger.info(`Reconnecting in ${delay / 1000} seconds... (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  send(message) {
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}