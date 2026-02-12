import SftpClient from 'ssh2-sftp-client';
import { getCsdcRemotePath, getCsdcFileName } from './csdcFileGenerator';

interface SftpCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  hostKey?: string;
}

interface UploadResult {
  success: boolean;
  stateCode: string;
  remotePath: string;
  fileName: string;
  recordCount: number;
  error?: string;
  timestamp: string;
}

interface DeterminationDownloadResult {
  success: boolean;
  stateCode: string;
  files: Array<{ name: string; content: string }>;
  error?: string;
  timestamp: string;
}

const CSDC_HOST = 'hermes.csdco.com';
const CSDC_PORT = 22;

export async function uploadCsdcFile(
  credentials: SftpCredentials,
  stateAbbr: string,
  fileContent: string
): Promise<UploadResult> {
  const sftp = new SftpClient();
  const remotePath = getCsdcRemotePath(stateAbbr);
  const fileName = getCsdcFileName(stateAbbr);
  const recordCount = fileContent.split('\n').filter(l => l.trim().length > 0).length;

  try {
    await sftp.connect({
      host: credentials.host || CSDC_HOST,
      port: credentials.port || CSDC_PORT,
      username: credentials.username,
      password: credentials.password,
    });

    const buffer = Buffer.from(fileContent, 'ascii');
    await sftp.put(buffer, remotePath);

    console.log(`[CSDC SFTP] Uploaded ${fileName} (${recordCount} records) to ${remotePath}`);

    return {
      success: true,
      stateCode: stateAbbr.toUpperCase(),
      remotePath,
      fileName,
      recordCount,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error(`[CSDC SFTP] Upload failed for ${stateAbbr}:`, error?.message);
    return {
      success: false,
      stateCode: stateAbbr.toUpperCase(),
      remotePath,
      fileName,
      recordCount: 0,
      error: error?.message || 'Unknown SFTP error',
      timestamp: new Date().toISOString(),
    };
  } finally {
    try { await sftp.end(); } catch {}
  }
}

export async function uploadMultipleCsdcFiles(
  credentials: SftpCredentials,
  files: Array<{ stateAbbr: string; content: string }>
): Promise<UploadResult[]> {
  const sftp = new SftpClient();
  const results: UploadResult[] = [];

  try {
    await sftp.connect({
      host: credentials.host || CSDC_HOST,
      port: credentials.port || CSDC_PORT,
      username: credentials.username,
      password: credentials.password,
    });

    for (const file of files) {
      const remotePath = getCsdcRemotePath(file.stateAbbr);
      const fileName = getCsdcFileName(file.stateAbbr);
      const recordCount = file.content.split('\n').filter(l => l.trim().length > 0).length;

      try {
        const buffer = Buffer.from(file.content, 'ascii');
        await sftp.put(buffer, remotePath);

        console.log(`[CSDC SFTP] Uploaded ${fileName} (${recordCount} records)`);

        results.push({
          success: true,
          stateCode: file.stateAbbr.toUpperCase(),
          remotePath,
          fileName,
          recordCount,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        console.error(`[CSDC SFTP] Failed to upload ${fileName}:`, err?.message);
        results.push({
          success: false,
          stateCode: file.stateAbbr.toUpperCase(),
          remotePath,
          fileName,
          recordCount: 0,
          error: err?.message,
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (error: any) {
    console.error('[CSDC SFTP] Connection failed:', error?.message);
    for (const file of files) {
      if (!results.find(r => r.stateCode === file.stateAbbr.toUpperCase())) {
        results.push({
          success: false,
          stateCode: file.stateAbbr.toUpperCase(),
          remotePath: getCsdcRemotePath(file.stateAbbr),
          fileName: getCsdcFileName(file.stateAbbr),
          recordCount: 0,
          error: `Connection failed: ${error?.message}`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  } finally {
    try { await sftp.end(); } catch {}
  }

  return results;
}

export async function downloadCsdcDeterminations(
  credentials: SftpCredentials,
  stateAbbr: string
): Promise<DeterminationDownloadResult> {
  const sftp = new SftpClient();
  const upper = stateAbbr.toUpperCase();
  const remoteDir = `${upper}.DIR;1`;

  try {
    await sftp.connect({
      host: credentials.host || CSDC_HOST,
      port: credentials.port || CSDC_PORT,
      username: credentials.username,
      password: credentials.password,
    });

    const listing = await sftp.list(remoteDir);
    const detFiles = listing.filter(f =>
      f.type === '-' &&
      (f.name.toLowerCase().includes('det') ||
       f.name.toLowerCase().includes('determination') ||
       f.name.toLowerCase().includes('result') ||
       f.name.toLowerCase().includes('response'))
    );

    const files: Array<{ name: string; content: string }> = [];

    for (const detFile of detFiles) {
      try {
        const remotePath = `${remoteDir}/${detFile.name}`;
        const buffer = await sftp.get(remotePath);
        const content = buffer instanceof Buffer ? buffer.toString('ascii') : String(buffer);
        files.push({ name: detFile.name, content });
        console.log(`[CSDC SFTP] Downloaded determination file: ${detFile.name}`);
      } catch (err: any) {
        console.error(`[CSDC SFTP] Failed to download ${detFile.name}:`, err?.message);
      }
    }

    return {
      success: true,
      stateCode: upper,
      files,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error(`[CSDC SFTP] Determination download failed for ${stateAbbr}:`, error?.message);
    return {
      success: false,
      stateCode: upper,
      files: [],
      error: error?.message || 'Unknown SFTP error',
      timestamp: new Date().toISOString(),
    };
  } finally {
    try { await sftp.end(); } catch {}
  }
}

export async function testCsdcConnection(
  credentials: SftpCredentials
): Promise<{ success: boolean; message: string; directories?: string[] }> {
  const sftp = new SftpClient();

  try {
    await sftp.connect({
      host: credentials.host || CSDC_HOST,
      port: credentials.port || CSDC_PORT,
      username: credentials.username,
      password: credentials.password,
    });

    const listing = await sftp.list('/');
    const dirs = listing
      .filter(f => f.type === 'd' || f.name.includes('.DIR'))
      .map(f => f.name);

    console.log('[CSDC SFTP] Connection test successful');

    return {
      success: true,
      message: 'SFTP connection successful',
      directories: dirs,
    };
  } catch (error: any) {
    console.error('[CSDC SFTP] Connection test failed:', error?.message);
    return {
      success: false,
      message: `Connection failed: ${error?.message}`,
    };
  } finally {
    try { await sftp.end(); } catch {}
  }
}
