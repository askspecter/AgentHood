/**
 * Deploy AurnLocker to Robinhood Chain.
 *
 * Usage (with a funded deployer wallet — the key never leaves your machine):
 *   PRIVATE_KEY=0xYOUR_KEY node scripts/deploy-locker.mjs
 *
 * Optional env:
 *   RPC_URL   default https://rpc.mainnet.chain.robinhood.com
 *
 * After it prints the address, set it in the app's environment as
 *   NEXT_PUBLIC_LOCKER_ADDRESS=0x...
 * and redeploy. The Locked page then locks/unlocks on-chain and the public
 * list reads from this contract.
 */
import fs from 'node:fs';
import { JsonRpcProvider, Wallet, ContractFactory } from 'ethers';

const RPC = process.env.RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
const KEY = process.env.PRIVATE_KEY;
if (!KEY) {
  console.error('Set PRIVATE_KEY to a funded deployer wallet on Robinhood Chain.');
  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(new URL('../contracts/artifacts/AurnLocker.json', import.meta.url)));

const provider = new JsonRpcProvider(RPC, undefined, { staticNetwork: true });
const wallet = new Wallet(KEY, provider);

console.log('Deployer:', wallet.address);
const bal = await provider.getBalance(wallet.address);
console.log('Balance :', bal.toString(), 'wei');

const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);
const contract = await factory.deploy();
console.log('Deploy tx:', contract.deploymentTransaction()?.hash);
await contract.waitForDeployment();
const address = await contract.getAddress();

console.log('\nAurnLocker deployed at:', address);
console.log('\nNext: set NEXT_PUBLIC_LOCKER_ADDRESS=' + address + ' in your app env and redeploy.');
