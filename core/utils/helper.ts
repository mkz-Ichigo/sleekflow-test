import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Ensure .env is loaded if helper is imported standalone
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ============================================================
// Types & Interfaces
// ============================================================
export interface UserCredentials {
  email: string;
  password: string;
}

export interface TestDataSchema {
  registeredUser: UserCredentials;
  invalidUser: UserCredentials;
  invalidPassword: string;
  newSignupPassword: string;
  [key: string]: unknown;
}

// ============================================================
// TestDataHelper
// ============================================================
export class TestDataHelper {
  private static cachedData: TestDataSchema | null = null;
  private static defaultDataPath = path.resolve(__dirname, '../../data/users.json');

  /**
   * Reads and parses a JSON file synchronously from disk.
   */
  public static loadJson<T = TestDataSchema>(filePath: string = this.defaultDataPath): T {
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Test data file not found at: ${resolvedPath}`);
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    return JSON.parse(content) as T;
  }

  /**
   * Returns test data loaded from users.json as the single source of truth,
   * with sensitive credentials populated from environment variables if present.
   */
  public static getTestData(): TestDataSchema {
    if (!this.cachedData) {
      const data = this.loadJson<TestDataSchema>();
      data.registeredUser.email =
        process.env.TEST_REGISTERED_EMAIL ||
        data.registeredUser.email;
      data.registeredUser.password =
        process.env.TEST_REGISTERED_PASSWORD ||
        data.registeredUser.password;
      this.cachedData = data;
    }
    return this.cachedData;
  }

  /**
   * Generates a unique signup email using timestamp to avoid collisions.
   * Uses GMAIL_USER plus-addressing if available, otherwise falls back to gmail.com.
   */
  public static generateSignupEmail(prefix = 'testuser', domain = 'gmail.com'): string {
    if (process.env.GMAIL_USER) {
      const [user, mailDomain] = process.env.GMAIL_USER.split('@');
      if (user && mailDomain) {
        return `${user}+${prefix}_${Date.now()}@${mailDomain}`.toLowerCase();
      }
    }
    const ts = Date.now();
    return `${prefix}+${ts}@${domain}`;
  }
}

// ============================================================
// Data Exports
// ============================================================
export const testData = TestDataHelper.getTestData();

export const generateSignupEmail = (prefix?: string, domain?: string): string =>
  TestDataHelper.generateSignupEmail(prefix, domain);

export * from './gmail';
