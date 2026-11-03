import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import * as crypto from 'crypto';

// Encrypted values are stored as `<iv_hex>:<ciphertext_hex>:<tag_hex>` where the
// IV is 12 bytes (24 hex chars) and the GCM tag is 16 bytes (32 hex chars).
// A value matching this shape is positively identified as ciphertext; anything
// else is legacy plaintext from before encryption-at-rest was introduced.
const ENCRYPTED_VALUE_PATTERN = /^[0-9a-f]{24}:[0-9a-f]+:[0-9a-f]{32}$/;

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-gcm';

  constructor(private readonly configService: ConfigService) {
    const rawKey = this.configService.get('ENCRYPTION_KEY');
    if (!rawKey) {
      throw new Error('ENCRYPTION_KEY environment variable is not defined');
    }
    // Hash the raw key using SHA-256 to ensure it is exactly 32 bytes (256 bits)
    this.encryptionKey = crypto.createHash('sha256').update(rawKey).digest();
  }

  encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(12); // 96-bit IV is optimal for GCM
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag().toString('hex');

      // Return combined representation: iv:ciphertext:tag
      return `${iv.toString('hex')}:${encrypted}:${tag}`;
    } catch (error) {
      throw new InternalServerErrorException('Transparent field encryption failed');
    }
  }

  /**
   * Fail-closed decrypt.
   * - Values that positively match the encrypted format but fail GCM verification
   *   (corrupt data or wrong key) raise an error. They are NEVER returned raw.
   * - Values that do not match the encrypted format at all are legacy plaintext
   *   stored before encryption was introduced; they are returned as-is so existing
   *   records keep working, and should be re-encrypted on their next write.
   */
  decrypt(encryptedText: string): string {
    if (!encryptedText) return '';

    if (!ENCRYPTED_VALUE_PATTERN.test(encryptedText)) {
      // Positively identified legacy plaintext (encrypted values always match the pattern above).
      return encryptedText;
    }

    try {
      const parts = encryptedText.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const ciphertext = parts[1];
      const tag = Buffer.from(parts[2], 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      // Fail closed: a value in encrypted format that does not verify is corrupt
      // or belongs to a different key. Returning it raw would silently hand a
      // useless or attacker-controlled token to callers.
      this.logger.error(
        'Stored value matches the encrypted format but failed AES-GCM verification (corrupt data or wrong ENCRYPTION_KEY). Refusing to return it.',
      );
      throw new InternalServerErrorException(
        'Stored credential could not be decrypted. It may be corrupt or encrypted with a different key.',
      );
    }
  }

  /** True when a stored value is already in encrypted form. */
  isEncrypted(value: string): boolean {
    return ENCRYPTED_VALUE_PATTERN.test(value || '');
  }
}
