import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface LocalUser {
  id: string;
  createdAt: string;
}

let cachedUser: LocalUser | null = null;

function getUserFilePath(): string {
  return path.join(app.getPath('userData'), 'user.json');
}

export function getLocalUser(): LocalUser {
  if (cachedUser) return cachedUser;

  const filePath = getUserFilePath();
  if (fs.existsSync(filePath)) {
    try {
      cachedUser = JSON.parse(fs.readFileSync(filePath, 'utf8')) as LocalUser;
      return cachedUser;
    } catch {
      // corrupted — regenerate
    }
  }

  cachedUser = { id: uuidv4(), createdAt: new Date().toISOString() };
  fs.writeFileSync(filePath, JSON.stringify(cachedUser, null, 2), 'utf8');
  return cachedUser;
}
