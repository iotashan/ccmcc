// Re-export all encryption utilities from shared module
export {
  encrypt,
  decrypt,
  deriveEncryptionKeyFromToken,
  encryptWebSocketMessage,
  decryptWebSocketMessage,
  encryptionMiddleware,
  decryptionMiddleware
} from '../../../shared/utils/encryption.js';