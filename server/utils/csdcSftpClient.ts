import SftpClient from 'ssh2-sftp-client';
import { Client as SSHClient } from 'ssh2';
import { getCsdcRemotePath, getCsdcFileName } from './csdcFileGenerator';
import fs from 'fs';
import path from 'path';

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

const PROXY_HOST = process.env.CSDC_PROXY_HOST || '165.245.131.175';
const PROXY_PORT = parseInt(process.env.CSDC_PROXY_PORT || '22', 10);
const PROXY_USER = process.env.CSDC_PROXY_USER || 'root';

function getProxyPrivateKey(): string | undefined {
  if (process.env.CSDC_PROXY_KEY) {
    return process.env.CSDC_PROXY_KEY;
  }
  const keyPath = path.join(process.env.HOME || '/home/runner', '.ssh', 'id_rsa_digitalocean');
  try {
    return fs.readFileSync(keyPath, 'utf8');
  } catch {
    return undefined;
  }
}

function isProxyEnabled(): boolean {
  return !!(getProxyPrivateKey());
}

function createTunneledStream(
  targetHost: string,
  targetPort: number
): Promise<{ stream: any; jumpClient: SSHClient }> {
  return new Promise((resolve, reject) => {
    const jumpClient = new SSHClient();
    const privateKey = getProxyPrivateKey();

    if (!privateKey) {
      return reject(new Error('No proxy SSH key found. Set CSDC_PROXY_KEY env var or place key at ~/.ssh/id_rsa_digitalocean'));
    }

    jumpClient.on('ready', () => {
      console.log(`[CSDC Proxy] Connected to jump host ${PROXY_HOST}`);
      jumpClient.forwardOut(
        '127.0.0.1', 0,
        targetHost, targetPort,
        (err, stream) => {
          if (err) {
            jumpClient.end();
            return reject(new Error(`Tunnel creation failed: ${err.message}`));
          }
          console.log(`[CSDC Proxy] Tunnel established to ${targetHost}:${targetPort} via ${PROXY_HOST}`);
          resolve({ stream, jumpClient });
        }
      );
    });

    jumpClient.on('error', (err) => {
      reject(new Error(`Jump host connection failed: ${err.message}`));
    });

    jumpClient.connect({
      host: PROXY_HOST,
      port: PROXY_PORT,
      username: PROXY_USER,
      privateKey,
      readyTimeout: 15000,
    });
  });
}

async function connectSftp(sftp: SftpClient, credentials: SftpCredentials): Promise<SSHClient | null> {
  const host = credentials.host || CSDC_HOST;
  const port = credentials.port || CSDC_PORT;

  if (isProxyEnabled()) {
    console.log(`[CSDC SFTP] Connecting via proxy ${PROXY_HOST} -> ${host}:${port}`);
    const { stream, jumpClient } = await createTunneledStream(host, port);

    await sftp.connect({
      host: host,
      port: port,
      username: credentials.username,
      password: credentials.password,
      sock: stream,
    });

    return jumpClient;
  } else {
    console.log(`[CSDC SFTP] Connecting directly to ${host}:${port} (no proxy configured)`);
    await sftp.connect({
      host: host,
      port: port,
      username: credentials.username,
      password: credentials.password,
    });
    return null;
  }
}

function cleanupJumpClient(jumpClient: SSHClient | null) {
  if (jumpClient) {
    try { jumpClient.end(); } catch {}
  }
}

export async function uploadCsdcFile(
  credentials: SftpCredentials,
  stateAbbr: string,
  fileContent: string
): Promise<UploadResult> {
  const sftp = new SftpClient();
  let jumpClient: SSHClient | null = null;
  const remotePath = getCsdcRemotePath(stateAbbr);
  const fileName = getCsdcFileName(stateAbbr);
  const recordCount = fileContent.split('\n').filter(l => l.trim().length > 0).length;

  try {
    jumpClient = await connectSftp(sftp, credentials);

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
    cleanupJumpClient(jumpClient);
  }
}

export async function uploadMultipleCsdcFiles(
  credentials: SftpCredentials,
  files: Array<{ stateAbbr: string; content: string }>
): Promise<UploadResult[]> {
  const sftp = new SftpClient();
  let jumpClient: SSHClient | null = null;
  const results: UploadResult[] = [];

  try {
    jumpClient = await connectSftp(sftp, credentials);

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
    cleanupJumpClient(jumpClient);
  }

  return results;
}

export async function downloadCsdcDeterminations(
  credentials: SftpCredentials,
  stateAbbr: string
): Promise<DeterminationDownloadResult> {
  const sftp = new SftpClient();
  let jumpClient: SSHClient | null = null;
  const upper = stateAbbr.toUpperCase();
  const remoteDir = `${upper}.DIR;1`;

  try {
    jumpClient = await connectSftp(sftp, credentials);

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
    cleanupJumpClient(jumpClient);
  }
}

export async function testCsdcConnection(
  credentials: SftpCredentials
): Promise<{ success: boolean; message: string; directories?: string[]; proxyUsed?: boolean }> {
  const sftp = new SftpClient();
  let jumpClient: SSHClient | null = null;
  const proxyUsed = isProxyEnabled();

  try {
    jumpClient = await connectSftp(sftp, credentials);

    const listing = await sftp.list('/');
    const dirs = listing
      .filter(f => f.type === 'd' || f.name.includes('.DIR'))
      .map(f => f.name);

    console.log('[CSDC SFTP] Connection test successful');

    return {
      success: true,
      message: proxyUsed
        ? `SFTP connection successful via proxy (${PROXY_HOST})`
        : 'SFTP connection successful (direct)',
      directories: dirs,
      proxyUsed,
    };
  } catch (error: any) {
    console.error('[CSDC SFTP] Connection test failed:', error?.message);
    return {
      success: false,
      message: `Connection failed: ${error?.message}`,
      proxyUsed,
    };
  } finally {
    try { await sftp.end(); } catch {}
    cleanupJumpClient(jumpClient);
  }
}

export async function testProxyConnection(): Promise<{ success: boolean; message: string; proxyHost: string }> {
  const privateKey = getProxyPrivateKey();
  if (!privateKey) {
    return {
      success: false,
      message: 'No proxy SSH key configured. Set CSDC_PROXY_KEY or place key at ~/.ssh/id_rsa_digitalocean',
      proxyHost: PROXY_HOST,
    };
  }

  return new Promise((resolve) => {
    const client = new SSHClient();
    const timeout = setTimeout(() => {
      try { client.end(); } catch {}
      resolve({
        success: false,
        message: `Connection to proxy ${PROXY_HOST} timed out after 15 seconds`,
        proxyHost: PROXY_HOST,
      });
    }, 15000);

    client.on('ready', () => {
      clearTimeout(timeout);
      client.exec('echo "proxy-ok" && hostname', (err, stream) => {
        if (err) {
          client.end();
          return resolve({
            success: true,
            message: `Connected to proxy ${PROXY_HOST} (exec failed but SSH works)`,
            proxyHost: PROXY_HOST,
          });
        }
        let output = '';
        stream.on('data', (data: Buffer) => { output += data.toString(); });
        stream.on('close', () => {
          client.end();
          resolve({
            success: true,
            message: `Proxy ${PROXY_HOST} connected successfully: ${output.trim()}`,
            proxyHost: PROXY_HOST,
          });
        });
      });
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      resolve({
        success: false,
        message: `Proxy connection failed: ${err.message}`,
        proxyHost: PROXY_HOST,
      });
    });

    client.connect({
      host: PROXY_HOST,
      port: PROXY_PORT,
      username: PROXY_USER,
      privateKey,
      readyTimeout: 15000,
    });
  });
}
