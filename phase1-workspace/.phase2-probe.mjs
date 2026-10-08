import { createIDosGamesClient } from '@idosgames/core';
import { NoopPlatformAdapter } from '@idosgames/core/platform';
import { randomUUID } from 'node:crypto';
const platform = new NoopPlatformAdapter();
platform.getDeviceID = () => 'astanavis-p2-audit-' + auditID;
const auditID = randomUUID();
const client = createIDosGamesClient({ titleID: '1ZPS8DLV-DEV', platform, clientPlatform: 'Web', loginViews: 'none' });
const login = await client.auth.loginWithDeviceID();
if (!login.ok) { console.log(JSON.stringify({step:'login',reason:login.reason,error:login.error})); process.exit(1); }
const before = client.data.user.getVirtualCurrencyAmount('VIS');
const result = await client.cloudCode.execute('astanavisInspectCapabilities', {}, 'Specific', 6);
await client.user.getUserInventory();
console.log(JSON.stringify({result,before,after:client.data.user.getVirtualCurrencyAmount('VIS')}));
process.exit(result.ok ? 0 : 1);
