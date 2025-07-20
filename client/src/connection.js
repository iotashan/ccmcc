import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { PROTOCOL_VERSION, ClientMessageTypes, ServerMessageTypes } from '../../shared/protocol.js';
import { saveAuthToken } from './config.js';
import { decryptWebSocketMessage, encryptWebSocketMessage, deriveEncryptionKeyFromToken } from './utils/encryption.js';

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
    // Derive encryption key from API token
    this.encryptionKey = deriveEncryptionKeyFromToken(config.authToken);
  }

  async connect() {
    try {
      const serverUrl = this.config.serverAddress
        .replace(/^https/, 'wss')
        .replace(/^http/, 'ws');
      // Always use the API token from config for authentication
      const url = `${serverUrl}/machine?token=${encodeURIComponent(this.config.authToken || '')}`;
      
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
      auth_token: this.config.authToken,  // Use API token from config
      protocol_version: PROTOCOL_VERSION
    });
  }

  handleMessage(data) {
    try {
      const message = decryptWebSocketMessage(data.toString(), this.encryptionKey);
      
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
          
        case ServerMessageTypes.REQUEST_SHELL_INIT:
          this.emit('request:shell:init', message);
          break;
          
        case ServerMessageTypes.REQUEST_SHELL_INPUT:
          this.emit('request:shell:input', message);
          break;
          
        case ServerMessageTypes.REQUEST_SHELL_RESIZE:
          this.emit('request:shell:resize', message);
          break;
          
        case ServerMessageTypes.REQUEST_SHELL_EXIT:
          this.emit('request:shell:exit', message);
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
    // Don't override the API token with machine auth token
    // this.authToken = message.machine.auth_token;
    
    this.logger.info(`Registered as machine: ${message.machine.name} (${this.machineId})`);
    
    // Note: We keep using the API token for authentication, not the machine-specific token
    
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
      const encrypted = encryptWebSocketMessage(message, this.encryptionKey);
      this.ws.send(encrypted);
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