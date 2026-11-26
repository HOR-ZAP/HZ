import { Hike, PlannedRoute, ParticipantProfile } from '../types';

export const DRIVE_BACKUP_FILENAME = 'horsky-zapisnik-zaloha.json';

export interface DriveBackupPayload {
  version: string;
  app: string;
  exportedAt: string;
  hikes: Hike[];
  plannedRoutes: PlannedRoute[];
  participants: Record<string, ParticipantProfile>;
}

export interface DriveBackupInfo {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

export class DriveAuthExpiredError extends Error {
  constructor() {
    super('Platnost přihlášení k Google Disku vypršela. Přihlaste se prosím znovu.');
    this.name = 'DriveAuthExpiredError';
  }
}

async function handleDriveResponse(res: Response): Promise<Response> {
  if (res.status === 401) {
    throw new DriveAuthExpiredError();
  }
  if (!res.ok) {
    let details = '';
    try {
      const errJson = (await res.json()) as { error?: { message?: string } };
      details = errJson?.error?.message || '';
    } catch {
      // ignore
    }
    throw new Error(details || `Chyba komunikace s Google Diskem (HTTP ${res.status}).`);
  }
  return res;
}

export async function findDriveBackupFile(accessToken: string): Promise<DriveBackupInfo | null> {
  const query = encodeURIComponent(
    `name='${DRIVE_BACKUP_FILENAME}' and trashed=false`
  );
  const fields = encodeURIComponent('files(id,name,modifiedTime,size)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=${fields}&orderBy=modifiedTime%20desc&pageSize=1`;

  const res = await handleDriveResponse(
    await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  );

  const data = (await res.json()) as { files?: DriveBackupInfo[] };
  if (!data.files || data.files.length === 0) return null;
  return data.files[0];
}

export async function uploadBackupToDrive(
  accessToken: string,
  payload: DriveBackupPayload,
  existingFileId?: string | null
): Promise<DriveBackupInfo> {
  const boundary = 'horsky_zapisnik_boundary_' + Date.now();
  const metadata = existingFileId
    ? { name: DRIVE_BACKUP_FILENAME, mimeType: 'application/json' }
    : { name: DRIVE_BACKUP_FILENAME, mimeType: 'application/json' };

  const jsonBody = JSON.stringify(payload);
  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    jsonBody,
    `--${boundary}--`,
  ].join('\r\n');

  const endpoint = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
        existingFileId
      )}?uploadType=multipart&fields=id,name,modifiedTime,size`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size';

  const res = await handleDriveResponse(
    await fetch(endpoint, {
      method: existingFileId ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    })
  );

  return (await res.json()) as DriveBackupInfo;
}

export async function downloadBackupFromDrive(
  accessToken: string,
  fileId: string
): Promise<{
  hikes: unknown[];
  plannedRoutes: unknown[];
  participants: Record<string, ParticipantProfile>;
  exportedAt?: string;
}> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  const res = await handleDriveResponse(
    await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  );

  const parsed = (await res.json()) as unknown;

  if (Array.isArray(parsed)) {
    return { hikes: parsed, plannedRoutes: [], participants: {} };
  }

  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    return {
      hikes: Array.isArray(obj.hikes) ? obj.hikes : [],
      plannedRoutes: Array.isArray(obj.plannedRoutes) ? obj.plannedRoutes : [],
      participants:
        obj.participants && typeof obj.participants === 'object'
          ? (obj.participants as Record<string, ParticipantProfile>)
          : {},
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : undefined,
    };
  }

  throw new Error('Soubor zálohy na Google Disku nemá platný formát.');
}
