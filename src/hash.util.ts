import * as bcrypt from 'bcrypt';

export class HashUtil {
  static async genSalt(): Promise<string> {
    return bcrypt.genSalt(10);
  }

  static async hashPassword(password: string, salt: string): Promise<string> {
    return bcrypt.hash(password, salt);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static async hashEmail(email: string, salt: string): Promise<string> {
    return bcrypt.hash(email, salt);
  }

  static async compareEmail(email: string, hash: string, salt: string): Promise<boolean> {
    const emailHash = await bcrypt.hash(email, salt);
    return emailHash === hash;
  }
} 