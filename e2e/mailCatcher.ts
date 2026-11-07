import fs from 'fs';
import net from 'net';
import { MAIL_CATCHER_PORT } from './ports';

// A mail catcher for the multi-user gateway's password codes by email
// (docs/MULTI-USER-EMAIL-AND-REMINDERS.md). Just enough SMTP for Nodemailer, on loopback and
// unencrypted, which the gateway allows only to this machine (FLYBUDGET_DEV_MAIL_PORT). Each
// message is appended to `file` as one JSON line: { to, raw }.

export function startMailCatcher(file: string): Promise<net.Server> {
  const server = net.createServer((socket) => {
    socket.setEncoding('utf8');
    let buffer = '';
    let data: string[] | null = null;
    let to: string[] = [];
    const reply = (line: string) => socket.write(`${line}\r\n`);
    reply('220 localhost mail catcher');
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      let end: number;
      while ((end = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (data) {
          if (line !== '.') {
            data.push(line.startsWith('..') ? line.slice(1) : line);
            continue;
          }
          fs.appendFileSync(file, JSON.stringify({ to, raw: data.join('\n') }) + '\n');
          data = null;
          to = [];
          reply('250 queued');
          continue;
        }
        const command = line.slice(0, 4).toUpperCase();
        if (command === 'EHLO' || command === 'HELO') reply('250 localhost');
        else if (command === 'MAIL') reply('250 ok');
        else if (command === 'RCPT') {
          to.push(/<([^>]*)>/.exec(line)?.[1] ?? '');
          reply('250 ok');
        } else if (command === 'DATA') {
          data = [];
          reply('354 go ahead');
        } else if (command === 'QUIT') {
          reply('221 bye');
          socket.end();
        } else if (command === 'RSET' || command === 'NOOP') reply('250 ok');
        else reply('502 not here');
      }
    });
    socket.on('error', () => {});
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(MAIL_CATCHER_PORT, '127.0.0.1', () => resolve(server));
  });
}

/** The messages caught so far, newest last */
export function caughtMail(file: string): { to: string[]; raw: string }[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}
