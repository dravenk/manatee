/**
 * 钱包类型定义
 */

export enum WalletType {
  ONEKEY = 'onekey',
  LEDGER = 'ledger',
  TREZOR = 'trezor',
  MNEMONIC = 'mnemonic', // 助记词钱包
  PRIVATE_KEY = 'private_key', // 私钥钱包
}

export interface WalletAddress {
  address: string;
  publicKey?: string;
  chainId?: string;
}

export interface WalletConnection {
  type: WalletType;
  address: string;
  publicKey?: string;
  connected: boolean;
  chainId?: string;
  accountIndex?: number; // 账户索引，用于区分同一硬件钱包的不同账户
}

export interface WalletProvider {
  type: WalletType;
  name: string;
  isAvailable(): boolean | Promise<boolean>;
  connect(): Promise<WalletAddress>;
  disconnect(): Promise<void>;
  getAddress(): Promise<string>;
  getPublicKey(): Promise<string>;
  signMessage(message: string): Promise<string>;
  signTransaction(transaction: any): Promise<any>;
  // 获取多个账户的地址（可选，硬件钱包支持）
  getMultipleAccounts?(accountCount?: number): Promise<WalletAddress[]>;
}

export interface WalletError {
  code: string;
  message: string;
  type: WalletType;
}
